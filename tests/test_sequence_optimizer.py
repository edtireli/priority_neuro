import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "backend"))
import numpy as np
import pytest
from sequence_optimizer import (
    ThompsonBanditAgent,
    GPSurrogateAgent,
    compute_reward,
)


def test_thompson_bandit_agent_learns_best_arm():
    np.random.seed(0)
    agent = ThompsonBanditAgent(n_actions=2)
    probs = [0.2, 0.8]
    for _ in range(200):
        a = agent.select_action(None)
        r = 1.0 if np.random.rand() < probs[a] else 0.0
        agent.update(a, r, None)
    est0 = agent.alpha[0] / (agent.alpha[0] + agent.beta[0])
    est1 = agent.alpha[1] / (agent.alpha[1] + agent.beta[1])
    assert est1 > est0


def test_gp_surrogate_agent_selects_near_optimal_action():
    np.random.seed(0)
    actions = [{"x": float(i)} for i in range(5)]
    agent = GPSurrogateAgent(actions)
    def reward(a):
        x = actions[a]["x"]
        return -((x - 2.0) ** 2) + np.random.normal(scale=0.1)
    for _ in range(10):
        a = agent.select_action(None)
        r = reward(a)
        agent.update(a, r, None)
    best_idx = agent.select_action(None)
    assert abs(actions[best_idx]["x"] - 2.0) <= 1.0


def test_compute_reward_trials_to_threshold():
    r, met = compute_reward(2, [], {"type": "trials_to_threshold", "threshold": 2})
    assert met is True
    assert r == 0.0
    r, met = compute_reward(1, [], {"type": "trials_to_threshold", "threshold": 2})
    assert met is False
    assert r == -1.0


def test_compute_reward_cumulative_reward():
    hist = [
        {"t": 1, "action": {}, "reward": 0.6},
        {"t": 2, "action": {}, "reward": 0.5},
    ]
    r, met = compute_reward(3, hist, {"type": "cumulative_reward", "threshold": 1.0})
    assert met is True
    assert r == pytest.approx(1.1)


def test_compute_reward_last_accuracy():
    hist = [{"t": 1, "action": {}, "reward": 0.0, "accuracy": 0.7}]
    r, met = compute_reward(2, hist, {"type": "last_accuracy", "threshold": 0.5})
    assert met is True
    assert r == 0.7
