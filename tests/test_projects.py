import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "backend"))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from uuid import uuid4

from app import app
from database import Base
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


def create_user(client):
    payload = {
        "email": "user@example.com",
        "full_name": "Test User",
        "institution": "TI",
        "password": "secret",
    }
    client.post("/api/auth/register", json=payload)
    login = client.post("/api/auth/login", json={"email": payload["email"], "password": payload["password"]})
    token = login.json()["access_token"]
    return token


def test_project_crud(client):
    token = create_user(client)

    # create
    resp = client.post(
        "/api/projects/",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "proj1", "description": "desc"},
    )
    assert resp.status_code == 201
    project = resp.json()
    project_id = project["id"]

    # list
    resp = client.get("/api/projects/", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # get
    resp = client.get(f"/api/projects/{project_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "proj1"

    # update
    resp = client.put(
        f"/api/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "proj1-upd", "description": "updated"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "proj1-upd"

    # delete
    resp = client.delete(f"/api/projects/{project_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204

    # ensure deleted
    resp = client.get(f"/api/projects/{project_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404
