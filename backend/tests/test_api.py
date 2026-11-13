from __future__ import annotations

from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import main
from auth import get_current_user


class FakeOCR:
    def __init__(self, result: str = "A sample printed page."):
        self.result = result
        self.calls = 0

    def predict_page(self, image):
        self.calls += 1
        return self.result


def jpeg_bytes() -> bytes:
    image = Image.new("RGB", (32, 32), color="white")
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("LOAD_OCR_MODEL", "false")
    main.app.dependency_overrides[get_current_user] = lambda: {
        "id": "00000000-0000-0000-0000-000000000001",
        "email": "verified@example.com",
    }
    with TestClient(main.app) as test_client:
        main.OCR = FakeOCR()
        yield test_client
    main.OCR = None
    main.app.dependency_overrides.clear()


def test_health_is_public_and_does_not_require_a_shared_key(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["model_loaded"] is True


def test_ocr_success_reserves_and_finishes_one_scan(client, monkeypatch):
    calls = {}

    def reserve_scan(user_id):
        calls["user_id"] = user_id
        return {
            "allowed": True,
            "reservation_id": "11111111-1111-1111-1111-111111111111",
            "scans_used": 1,
            "scan_limit": 5,
            "scans_remaining": 4,
            "plan": "free",
        }

    monkeypatch.setattr(main.quota_store, "reserve_scan", reserve_scan)
    monkeypatch.setattr(main.quota_store, "finish_scan", lambda reservation_id, characters: True)
    monkeypatch.setattr(main.quota_store, "get_usage", lambda user_id: {
        "plan": "free", "scans_used": 1, "scan_limit": 5, "scans_remaining": 4,
    })

    response = client.post(
        "/ocr",
        files={"file": ("sample.jpg", jpeg_bytes(), "image/jpeg")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["text"] == "A sample printed page."
    assert body["characters"] == len(body["text"])
    assert body["usage"]["scans_remaining"] == 4
    assert calls["user_id"] == "00000000-0000-0000-0000-000000000001"


def test_quota_exhaustion_returns_429_without_running_ocr(client, monkeypatch):
    monkeypatch.setattr(main.quota_store, "reserve_scan", lambda _user_id: {
        "allowed": False,
        "reason": "user_quota_exceeded",
        "scans_used": 5,
        "scan_limit": 5,
        "scans_remaining": 0,
    })
    response = client.post(
        "/ocr",
        files={"file": ("sample.jpg", jpeg_bytes(), "image/jpeg")},
    )

    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "quota_exceeded"
    assert main.OCR.calls == 0


def test_invalid_image_does_not_reserve_a_scan(client, monkeypatch):
    called = False

    def reserve_scan(_user_id):
        nonlocal called
        called = True
        raise AssertionError("quota must not be reserved for an invalid image")

    monkeypatch.setattr(main.quota_store, "reserve_scan", reserve_scan)
    response = client.post(
        "/ocr",
        files={"file": ("not-an-image.jpg", b"not image data", "image/jpeg")},
    )

    assert response.status_code == 400
    assert called is False


def test_health_route_is_public_but_me_requires_auth(monkeypatch):
    monkeypatch.setenv("LOAD_OCR_MODEL", "false")
    with TestClient(main.app) as test_client:
        response = test_client.get("/api/me/usage")
        assert response.status_code == 401
        assert test_client.get("/health").status_code == 200
