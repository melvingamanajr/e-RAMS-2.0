import numpy as np


def normalized(vector):
    value = np.asarray(vector, dtype=np.float32)
    if value.shape != (512,) or not np.isfinite(value).all():
        raise ValueError("Invalid embedding")
    norm = float(np.linalg.norm(value))
    if norm < 1e-6:
        raise ValueError("Empty embedding")
    return value / norm


def best_match(query, templates, threshold=0.55, margin=0.08):
    """Require both an absolute cosine threshold and separation from second best."""
    query = normalized(query)
    if not templates:
        return None
    scores = sorted(
        ((employee_id, float(np.dot(query, normalized(vector)))) for employee_id, vector in templates),
        key=lambda item: item[1], reverse=True,
    )
    employee_id, score = scores[0]
    if score < threshold or (len(scores) > 1 and score - scores[1][1] < margin):
        return None
    return {"employeeId": employee_id, "confidence": max(-1.0, min(1.0, score))}
