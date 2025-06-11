import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "backend"))
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import Project
import boed_utils


def test_update_and_optimize(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    monkeypatch.setattr(boed_utils, "SessionLocal", TestingSessionLocal)

    pid = uuid4()
    data = [
        {"condition": "A", "outcome": 1},
        {"condition": "A", "outcome": 0},
        {"condition": "B", "outcome": 1},
    ]
    db = TestingSessionLocal()
    project = Project(
        id=pid,
        user_id=uuid4(),
        name="P",
        description="",
        config_json={
            "priors": {},
            "designVariables": [{"name": "condition", "type": "discrete", "values": ["A", "B"]}],
            "maxIterations": 3,
        },
    )
    db.add(project)
    db.commit()
    db.close()

    post = boed_utils.update_posterior(pid, data)
    assert post == {"A": {"alpha": 2, "beta": 2}, "B": {"alpha": 2, "beta": 1}}
    design = boed_utils.optimize_design_with_posterior(pid, post, max_iterations=3)
    assert isinstance(design["sequence"], list)
