import base64
import hashlib
import hmac
import io
import logging
import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

import cv2
import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field

from .matching import best_match, normalized

SERVICE_KEY = os.environ.get("AI_SERVICE_KEY", "")
if len(SERVICE_KEY) < 32:
    raise RuntimeError("AI_SERVICE_KEY must contain at least 32 characters")
ALLOW_RESEARCH = os.environ.get("ALLOW_UNVERIFIED_LIVENESS", "false").lower() == "true"
MODEL_NAME = os.environ.get("FACE_MODEL", "buffalo_l")
MODEL_ROOT = Path(os.environ.get("MODEL_ROOT", "/models"))
MODEL_ID = "unavailable"
engine = None
engine_lock = threading.Lock()


@asynccontextmanager
async def lifespan(_app):
    global engine, MODEL_ID
    # Fail closed when models are absent. Never download model weights implicitly.
    model_dir = MODEL_ROOT / "models" / MODEL_NAME
    files = sorted(model_dir.glob("*.onnx"))
    if len(files) >= 2:
        try:
            from insightface.app import FaceAnalysis
            digest = hashlib.sha256()
            for path in files:
                with path.open("rb") as model_file:
                    for chunk in iter(lambda: model_file.read(1024 * 1024), b""):
                        digest.update(chunk)
            engine = FaceAnalysis(name=MODEL_NAME, root=str(MODEL_ROOT), allowed_modules=["detection", "recognition"], providers=["CPUExecutionProvider"])
            engine.prepare(ctx_id=-1, det_size=(640, 640))
            MODEL_ID = f"{MODEL_NAME}:{digest.hexdigest()[:24]}"
        except Exception:
            engine = None
            logging.error("Face model could not be loaded. Check licensed ONNX model files and runtime.")
    else:
        logging.warning("Face model not configured. Enrollment and recognition are unavailable.")
    yield
    engine = None


def authorize(x_service_key: Annotated[str, Header()] = ""):
    if not hmac.compare_digest(x_service_key, SERVICE_KEY):
        raise HTTPException(401, "Invalid service credential")


app = FastAPI(title="e-RAMS Face Engine", lifespan=lifespan, dependencies=[Depends(authorize)], docs_url=None, redoc_url=None, openapi_url=None)


class Capture(BaseModel):
    model_config = ConfigDict(extra="forbid")
    image: str = Field(min_length=40, max_length=2_800_000)


class Template(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    employeeId: str = Field(min_length=1, max_length=36)
    embedding: list[float] = Field(min_length=512, max_length=512)
    model: str = Field(max_length=120)


class Recognition(Capture):
    templates: list[Template] = Field(max_length=10000)


def extract(image: str):
    if engine is None:
        raise HTTPException(503, "Model not configured")
    try:
        prefix, content = image.split(",", 1)
        if prefix not in ("data:image/jpeg;base64", "data:image/png;base64"):
            raise ValueError("Invalid image type")
        raw = base64.b64decode(content, validate=True)
        if len(raw) > 2_000_000:
            raise ValueError("Image too large")
        with Image.open(io.BytesIO(raw)) as header:
            if header.format not in ("JPEG", "PNG") or header.width * header.height > 4_000_000 or min(header.size) < 160:
                raise ValueError("Invalid image dimensions")
        frame = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Image cannot be decoded")
    except Exception as error:
        raise HTTPException(422, "Invalid image") from error
    with engine_lock:
        faces = engine.get(frame)
    if len(faces) != 1:
        raise HTTPException(422, "Exactly one face is required")
    face = faces[0]
    bbox = face.bbox
    if float(face.det_score) < 0.8 or min(bbox[2] - bbox[0], bbox[3] - bbox[1]) < 80:
        raise HTTPException(422, "Move closer to the camera")
    try:
        return normalized(face.normed_embedding)
    except ValueError as error:
        raise HTTPException(422, "Invalid face embedding") from error


@app.get("/health")
def health():
    return {"ready": engine is not None, "recognitionReady": engine is not None and ALLOW_RESEARCH, "model": MODEL_ID, "liveness": False, "researchMode": ALLOW_RESEARCH}


@app.post("/extract")
def enrollment(capture: Capture):
    return {"embedding": extract(capture.image).tolist(), "model": MODEL_ID}


@app.post("/recognize")
def recognize(capture: Recognition):
    if not ALLOW_RESEARCH:
        raise HTTPException(503, "Recognition disabled until liveness is validated; research override is off")
    vector = extract(capture.image)
    compatible = [(t.employeeId, t.embedding) for t in capture.templates if t.model == MODEL_ID]
    try:
        result = best_match(vector, compatible, float(os.environ.get("MATCH_THRESHOLD", "0.55")), float(os.environ.get("MATCH_MARGIN", "0.08")))
    except ValueError as error:
        raise HTTPException(422, "Invalid template") from error
    if result is None:
        raise HTTPException(404, "No confident match")
    return result
