import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "backend"))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from uuid import uuid4

from app import app
from database import Base
from dependencies import get_db
from models import User, Project

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
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


def create_user(client):
    payload = {
        "email": "user@example.com",
        "full_name": "Test User",
        "institution": "TI",
        "password": "secret",
    }
    client.post("/api/auth/register", json=payload)
    db = TestingSessionLocal()
    token_val = (
        db.query(User).filter(User.email == payload["email"]).first().verification_token
    )
    db.close()
    client.post("/api/auth/verify", json={"token": token_val})
    login = client.post(
        "/api/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    return login.json()["access_token"]


def create_project(client, token):
    resp = client.post(
        "/api/projects/",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "proj", "description": "d"},
    )
    return resp.json()["id"]


def test_adaptive_endpoints(client):
    token = create_user(client)
    pid = create_project(client, token)

    data = [
        {"condition": "A", "outcome": 1},
        {"condition": "A", "outcome": 0},
        {"condition": "B", "outcome": 1},
    ]

    resp = client.post(
        f"/api/projects/{pid}/adaptive/data",
        headers={"Authorization": f"Bearer {token}"},
        json=data,
    )
    assert resp.status_code == 204

    db = TestingSessionLocal()
    proj = db.query(Project).get(pid)
    assert proj.current_posterior is not None
    db.close()

    resp = client.get(
        f"/api/projects/{pid}/adaptive/next-design",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["sequence"][0]["condition"] == "B"
