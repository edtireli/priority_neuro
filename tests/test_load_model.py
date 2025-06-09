import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

import tasks
from tasks import load_model, PsychometricModel


def test_load_model_builtin_psychometric():
    cfg = {
        'type': 'built-in',
        'templateName': 'psychometric',
        'parameters': [],
        'designName': 'x',
    }
    model = load_model(cfg, uuid.uuid4())
    assert isinstance(model, PsychometricModel)
    assert model.design_name == 'x'


def test_load_model_custom(tmp_path, monkeypatch):
    monkeypatch.setattr(tasks, 'UPLOADS_ROOT', str(tmp_path))
    job_id = uuid.uuid4()
    model_dir = tmp_path / 'custom_models' / str(job_id)
    model_dir.mkdir(parents=True)
    model_file = model_dir / 'dummy.py'
    model_file.write_text(
        """
class Model:
    def __init__(self, params):
        self.params = params
    def simulate(self, theta, design):
        return 1
    def log_likelihood(self, data, theta, design):
        return -1.0
"""
    )
    cfg = {
        'type': 'custom',
        'customFileName': 'dummy.py',
        'parameters': [],
    }
    model = load_model(cfg, job_id)
    assert model.simulate({}, {}) == 1
    assert model.log_likelihood(None, {}, {}) == -1.0

