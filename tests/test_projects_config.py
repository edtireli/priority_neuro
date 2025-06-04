import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "backend"))
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import app
from database import Base
from dependencies import get_db

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
    login = client.post("/api/auth/login", json={"email": payload["email"], "password": payload["password"]})
    token = login.json()["access_token"]
    return token


def test_project_config_crud(client):
    token = create_user(client)

    # create project
    resp = client.post(
        "/api/projects/",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "proj1", "description": "desc"},
    )
    assert resp.status_code == 201
    project_id = resp.json()["id"]

    # get config should be null
    resp = client.get(f"/api/projects/{project_id}/config", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json() == {"config": None}

    # update config
    sample_cfg = {
        "metadata": {"name": "proj1", "description": "desc"},
        "model": {
            "type": "built-in",
            "templateName": "psychometric",
            "parameters": [
                {
                    "name": "threshold",
                    "type": "float",
                    "default_prior": {"dist": "Normal", "mean": 0.5, "sd": 0.2},
                },
                {
                    "name": "slope",
                    "type": "float",
                    "default_prior": {"dist": "Gamma", "shape": 2.0, "scale": 1.0},
                },
            ],
        },
        "priors": {
            "threshold": {"dist": "Normal", "mean": 0.5, "sd": 0.2},
            "slope": {"dist": "Gamma", "shape": 2.0, "scale": 1.0},
        },
        "designVariables": [
            {
                "name": "intensity",
                "type": "continuous",
                "range": [0.1, 1.0],
                "units": "a.u.",
            }
        ],
        "objective": {"type": "group_separation", "options": {}},
        "constraints": {
            "sampleSize": 20,
            "trialLimit": 100,
            "costWeights": {"subject": 1, "trial": 1, "session": 1},
        },
    }
    resp = client.put(
        f"/api/projects/{project_id}/config",
        headers={"Authorization": f"Bearer {token}"},
        json=sample_cfg,
    )
    assert resp.status_code == 204

    # fetch again
    resp = client.get(f"/api/projects/{project_id}/config", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    returned = resp.json()["config"]
    assert returned["metadata"]["name"] == "proj1"
    assert returned["model"]["templateName"] == "psychometric"

