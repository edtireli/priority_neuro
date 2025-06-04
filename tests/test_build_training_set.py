import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))
from tasks import build_training_set
from models.expressions import PsychometricModel
import numpy as np

def test_build_training_set_basic():
    prior = {"threshold": {"dist": "Uniform", "low":0.0, "high":1.0},
             "slope": {"dist": "Uniform", "low":0.1, "high":1.0}}
    design_vars = [{"name":"x", "type":"continuous", "range":[0.0,1.0]}]
    model = PsychometricModel([])
    theta_arr, design_arr, y_arr = build_training_set(prior, design_vars, model, N_train=1000)
    assert theta_arr.min() >= 0.0 and theta_arr.max() <= 1.0 + 1e-6
    assert np.all((design_arr >= 0.0) & (design_arr <=1.0))
    assert set(np.unique(y_arr)).issubset({0,1})
