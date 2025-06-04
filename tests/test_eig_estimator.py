import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))
import numpy as np
from models.expressions import BernoulliModel
from tasks import build_training_set, train_flow, estimate_eig


def analytic_eig_uniform_bernoulli():
    from math import log
    Hy = log(2)
    return Hy - 0.5  # E_theta[H(Y|theta)] = 0.5


def test_eig_estimation_accuracy():
    prior = {"p": {"dist": "Uniform", "low": 0.0, "high": 1.0}}
    design_vars = []
    model = BernoulliModel([{"name": "p"}])
    theta, d, y = build_training_set(prior, design_vars, model, N_train=2000)
    flow = train_flow(theta, d, y, epochs=30)
    est = estimate_eig({}, flow, prior, model, M_test=5000)
    true_val = analytic_eig_uniform_bernoulli()
    assert abs(est - true_val) < 0.02
