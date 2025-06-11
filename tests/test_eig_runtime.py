import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

import boed_utils
from models.expressions import BernoulliModel


def test_n_max_used(monkeypatch):
    class DummyFlow:
        pass

    monkeypatch.setattr(boed_utils, "Flow", DummyFlow)

    priors = {"p": {"dist": "Uniform", "low": 0.0, "high": 1.0}}
    design_vars = [{"name": "x", "type": "continuous", "range": [0.0, 1.0]}]
    model = BernoulliModel([{"name": "p"}])

    N_max = 500

    util = lambda d: boed_utils.estimate_eig(
        d,
        DummyFlow(),
        priors,
        model,
        n_samples=N_max,
        random_seed=0,
    )

    _, records = boed_utils.optimize_design(priors, design_vars, model, DummyFlow(), bo_budget=1, util_fn=util)

    assert records[0]["N_used"] == N_max
