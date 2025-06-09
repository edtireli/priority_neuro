import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))
import numpy as np
from boed_utils import optimize_design

class DummyModel:
    def simulate(self, theta, design):
        return 0.0
    def log_likelihood(self, data, theta, design):
        return 0.0


def test_optimize_design_custom_util():
    design_vars = [{"name": "x", "type": "continuous", "range": [0.0, 1.0]}]
    util_vals = []
    def util_fn(d):
        util_vals.append(d)
        return 5.0
    best, records = optimize_design({}, design_vars, DummyModel(), None, bo_budget=22, util_fn=util_fn)
    assert len(util_vals) == 22
    assert all(rec["utility"] == 5.0 for rec in records)
