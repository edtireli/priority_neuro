import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

from sequence_optimizer import optimize_sequence_local


def test_optimize_sequence_local_basic():
    priors = {"p": {"dist": "Uniform", "low": 0.2, "high": 0.8}}
    design_vars = [{"name": "condition", "type": "discrete", "values": ["A", "B"]}]
    posterior = {"A": {"alpha": 2, "beta": 2}, "B": {"alpha": 2, "beta": 1}}
    seq = optimize_sequence_local({}, priors, design_vars, posterior, max_iters=5)
    assert isinstance(seq, list)
    assert len(seq) <= 5
    for step in seq:
        assert set(step.keys()) == {"condition"}
