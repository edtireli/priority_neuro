import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "backend"))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import app
from database import Base
from models import User
from dependencies import get_db

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
from sqlalchemy.pool import StaticPool

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db


@pytest.fixture()
def client():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_register_login_and_me(client):
    user_payload = {
        "email": "user@example.com",
        "full_name": "Test User",
        "institution": "Test Inst",
        "password": "secret",
    }
    resp = client.post("/api/auth/register", json=user_payload)
    assert resp.status_code == 201
    db = TestingSessionLocal()
    token_val = db.query(User).filter(User.email == user_payload["email"]).first().verification_token
    db.close()
    client.post("/api/auth/verify", json={"token": token_val})
    login_resp = client.post("/api/auth/login", json={"email": user_payload["email"], "password": user_payload["password"]})
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == user_payload["email"]
