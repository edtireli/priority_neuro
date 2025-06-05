import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "backend"))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
from app import app
from database import Base
from dependencies import get_db
from models import User

engine = create_engine(
    os.environ["DATABASE_URL"],
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture()
def client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_list_templates(client):
    response = client.get("/api/templates")
    assert response.status_code == 200
    data = response.json()
    assert "psychometric" in data and "poisson_rate" in data

def test_get_template_schema_success(client):
    response = client.get("/api/templates/psychometric/schema")
    assert response.status_code == 200
    schema = response.json()
    assert "parameters" in schema and isinstance(schema["parameters"], list)

def test_get_template_schema_not_found(client):
    response = client.get("/api/templates/nonexistent/schema")
    assert response.status_code == 404

def test_upload_custom_model_success(client, tmp_path):
    file_path = tmp_path / "dummy_model.py"
    file_path.write_text(
        "def parameter_schema():\n"
        "    return { 'parameters': [ { 'name': 'alpha', 'type': 'float', 'default_prior': { 'dist': 'Normal', 'mean': 0, 'sd': 1 } } ] }\n"
    )
    with open(file_path, "rb") as f:
        response = client.post(
            "/api/templates/upload",
            params={"project_id": "fake-id"},
            files={"file": ("dummy_model.py", f, "text/x-python")}
        )
    assert response.status_code == 201
    data = response.json()
    assert "schema" in data
    assert isinstance(data["schema"]["parameters"], list)

def test_upload_custom_model_missing_function(client, tmp_path):
    file_path = tmp_path / "bad_model.py"
    file_path.write_text("x = 1\n")
    with open(file_path, "rb") as f:
        response = client.post(
            "/api/templates/upload",
            params={"project_id": "fake-id"},
            files={"file": ("bad_model.py", f, "text/x-python")}
        )
    assert response.status_code == 400
    assert "must define" in response.json()["detail"]

def test_config_endpoints_validation(client, tmp_path):
    client.post("/api/auth/register", json={
        "email": "test@example.com",
        "full_name": "Test User",
        "institution": "Inst",
        "password": "TestPass123"
    })
    db = TestingSessionLocal()
    token_val = db.query(User).filter(User.email == "test@example.com").first().verification_token
    db.close()
    client.post("/api/auth/verify", json={"token": token_val})
    login_res = client.post("/api/auth/login", json={"email": "test@example.com", "password": "TestPass123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    proj_res = client.post("/api/projects", json={"name": "Test", "description": "Desc"}, headers=headers)
    project_id = proj_res.json()["id"]

    get_res = client.get(f"/api/projects/{project_id}/config", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json() == {"config": None}

    bad_payload = {"foo": "bar"}
    put_res = client.put(f"/api/projects/{project_id}/config", json=bad_payload, headers=headers)
    assert put_res.status_code == 422

    valid_payload = {
        "metadata": { "name": "Test", "description": "Desc" },
        "model": {
            "type": "built-in",
            "templateName": "psychometric",
            "parameters": [
                { "name": "threshold", "type": "float", "default_prior": { "dist": "Normal", "mean": 0.5, "sd": 0.2 } },
                { "name": "slope", "type": "float", "default_prior": { "dist": "Gamma", "shape": 2.0, "scale": 1.0 } }
            ]
        },
        "priors": {
            "threshold": { "dist": "Normal", "mean": 0.5, "sd": 0.2 },
            "slope": { "dist": "Gamma", "shape": 2.0, "scale": 1.0 }
        },
        "designVariables": [
            { "name": "intensity", "type": "continuous", "range": [0.1, 1.0], "units": "a.u." }
        ],
        "objective": { "type": "group_separation", "options": {} },
        "constraints": { "sampleSize": 20, "trialLimit": 100, "costWeights": { "subject": 1, "trial": 1, "session": 1 } }
    }
    put_res2 = client.put(f"/api/projects/{project_id}/config", json=valid_payload, headers=headers)
    assert put_res2.status_code == 204

    get_res2 = client.get(f"/api/projects/{project_id}/config", headers=headers)
    assert get_res2.status_code == 200
    returned = get_res2.json()["config"]
    assert returned["metadata"]["name"] == "Test"
    assert returned["model"]["templateName"] == "psychometric"
