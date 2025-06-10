import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))
import numpy as np
from boed_utils import optimize_design
import logging

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


def test_n_restarts_improves_utility(monkeypatch):
    design_vars = [
        {"name": "x", "type": "continuous", "range": [0.0, 1.0]},
        {"name": "mode", "type": "discrete", "values": [0, 1]},
    ]

    class Res:
        def __init__(self, x, fun):
            self.x = np.array([x])
            self.fun = fun
            self.success = True

    def fake_minimize(fn, x0, bounds=None, method=None):
        return Res(0.25 if x0[0] < 0.5 else 0.75, -1.0 if x0[0] < 0.5 else -0.5)

    util_fn = lambda d: 2.0 if d["x"] == 0.25 else 1.0

    monkeypatch.setattr("scipy.optimize.minimize", fake_minimize)

    np.random.seed(0)
    _, rec1 = optimize_design(
        {},
        design_vars,
        DummyModel(),
        None,
        bo_budget=21,
        util_fn=util_fn,
        n_restarts=1,
        prune_fraction=0.0,
        random_fallback=0,
    )

    np.random.seed(0)
    _, rec2 = optimize_design(
        {},
        design_vars,
        DummyModel(),
        None,
        bo_budget=21,
        util_fn=util_fn,
        n_restarts=5,
        prune_fraction=0.0,
        random_fallback=0,
    )

    util1 = max(r["utility"] for r in rec1)
    util2 = max(r["utility"] for r in rec2)
    assert util2 > util1


def test_prune_fraction_extremes(monkeypatch, caplog):
    design_vars = [
        {"name": "x", "type": "continuous", "range": [0.0, 1.0]},
        {"name": "mode", "type": "discrete", "values": [0, 1]},
    ]

    util_fn = lambda d: 0.0
    monkeypatch.setattr("scipy.optimize.minimize", lambda f, x0, bounds=None, method=None: type("R", (), {"x": x0, "fun": 0.0, "success": True})())

    caplog.set_level(logging.INFO)
    optimize_design(
        {},
        design_vars,
        DummyModel(),
        None,
        bo_budget=21,
        util_fn=util_fn,
        prune_fraction=0.0,
        random_fallback=0,
    )
    assert any("Pruned 0" in r.message for r in caplog.records)
    caplog.clear()

    optimize_design(
        {},
        design_vars,
        DummyModel(),
        None,
        bo_budget=21,
        util_fn=util_fn,
        prune_fraction=1.0,
        random_fallback=0,
    )
    assert any("Pruned 1 of 2" in r.message for r in caplog.records)
