import os, sys, json, uuid
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import app
from database import Base
from dependencies import get_db
from models import User, JobMetric
import tasks
from tasks import run_optimisation_task

engine = create_engine(os.environ['DATABASE_URL'], connect_args={'check_same_thread': False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    monkeypatch.setenv('RESULTS_ROOT', str(tmp_path / 'results'))
    monkeypatch.setenv('UPLOADS_ROOT', str(tmp_path / 'uploads'))
    monkeypatch.setattr(tasks, 'SessionLocal', TestingSessionLocal)
    tasks.celery.conf.task_always_eager = True
    tasks.celery.conf.broker_url = 'memory://'
    tasks.celery.conf.result_backend = 'cache+memory://'
    from tasks import send_verification_email
    send_verification_email.apply_async = lambda *a, **k: None
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def auth_token(client):
    client.post('/api/auth/register', json={'email':'p@test.com','full_name':'T','institution':'I','password':'pass'})
    db = TestingSessionLocal()
    token_val = db.query(User).filter(User.email=='p@test.com').first().verification_token
    db.close()
    client.post('/api/auth/verify', json={'token': token_val})
    login = client.post('/api/auth/login', json={'email':'p@test.com','password':'pass'})
    return login.json()['access_token']


class DummyFlow:
    def sample(self, n, context=None):
        import numpy as np
        return np.zeros((n, 1))


def dummy_optimize(*a, **k):
    records = [
        {'iteration': 1, 'design': {'x':0.1}, 'utility': 0.2, 'se':0.01, 'ci_lower':0.1, 'ci_upper':0.3, 'N_used':1},
    ]
    return {'x': 0.1}, records


@pytest.fixture(autouse=True)
def patches(monkeypatch):
    monkeypatch.setattr(tasks, 'build_training_set', lambda *a, **k: ([], [], []))
    monkeypatch.setattr(tasks, 'train_flow', lambda *a, **k: DummyFlow())
    monkeypatch.setattr(tasks, 'optimize_design', dummy_optimize)
    monkeypatch.setattr(tasks, 'estimate_eig', lambda *a, **k: (0.2,0.01,0.1,0.3,1))
    monkeypatch.setattr(tasks, 'sample_from_prior', lambda pri: {k:0 for k in pri})


def create_job(client, headers):
    proj = client.post('/api/projects', json={'name':'P','description':''}, headers=headers).json()
    pid = proj['id']
    cfg = {
        'metadata': {'name':'P','description':''},
        'model': {'type':'built-in','templateName':'psychometric','parameters':[],'dependentVariables':['y']},
        'priors': {},
        'designVariables': [{'name':'x','type':'continuous','range':[0,1]}],
        'objective': {'type':'information_gain'},
        'constraints': {'sampleSize':1,'trialLimit':2,'costWeights':{'subject':1,'trial':1,'session':1}},
        'experimentalMode': 'sequential',
    }
    client.put(f'/api/projects/{pid}/config', json=cfg, headers=headers)
    res = client.post(f'/api/projects/{pid}/jobs', data={'config': json.dumps(cfg)}, headers=headers)
    job = res.json()
    return pid, job['id']


def test_pilot_data_advances_iteration(client, tmp_path):
    token = auth_token(client)
    headers = {'Authorization': f'Bearer {token}'}
    pid, jid = create_job(client, headers)
    pilot_file = tmp_path/'pilot.csv'
    pilot_file.write_text('x,y\n0,1')
    with open(pilot_file,'rb') as f:
        client.post(f'/api/projects/{pid}/jobs/{jid}/data', files={'pilot_data':('pilot.csv', f, 'text/csv')}, headers=headers)
    run_optimisation_task.run(jid)
    db = TestingSessionLocal()
    job = db.query(tasks.Job).get(uuid.UUID(jid))
    metrics = db.query(JobMetric).filter(JobMetric.job_id==uuid.UUID(jid)).all()
    db.close()
    assert job.iteration == 2
    assert len(metrics) == 0

