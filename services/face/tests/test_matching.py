import os
os.environ["AI_SERVICE_KEY"] = "test-service-key-that-is-at-least-32-characters"

import numpy as np
import pytest
from fastapi.testclient import TestClient
from app.matching import best_match, normalized
from app.main import app


def vector(index):
    value = np.zeros(512)
    value[index] = 1
    return value


def test_accepts_distinct_match():
    assert best_match(vector(0), [("one", vector(0)), ("two", vector(1))])["employeeId"] == "one"


def test_rejects_ambiguous_faces():
    assert best_match(vector(0), [("one", vector(0)), ("two", vector(0))]) is None


def test_rejects_low_confidence():
    assert best_match(vector(0), [("other", vector(1))]) is None


@pytest.mark.parametrize("value", [np.zeros(512), np.ones(128), [float("nan")] * 512])
def test_invalid_embedding(value):
    with pytest.raises(ValueError):
        normalized(value)


def test_service_auth_and_missing_model():
    with TestClient(app) as client:
        assert client.get("/health").status_code == 401
        headers = {"X-Service-Key": os.environ["AI_SERVICE_KEY"]}
        assert client.get("/health", headers=headers).json()["ready"] is False
        assert client.post("/extract", headers=headers, json={"image": "x" * 50}).status_code == 503
        assert client.post("/recognize", headers=headers, json={"image": "x" * 50, "templates": []}).status_code == 503
