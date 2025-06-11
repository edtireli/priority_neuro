from __future__ import annotations

from typing import Any, Dict, List

import numpy as np
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel


class ThompsonBanditAgent:
    """Simple Thompson sampling bandit agent for Bernoulli rewards."""

    def __init__(
        self,
        n_actions: int,
        prior_alpha: float = 1.0,
        prior_beta: float = 1.0,
        exploration_rate: float = 0.0,
    ) -> None:
        self.n_actions = n_actions
        self.alpha = np.ones(n_actions) * prior_alpha
        self.beta = np.ones(n_actions) * prior_beta
        self.exploration_rate = exploration_rate

    def select_action(self, state: Dict[str, Any] | None) -> int:
        if np.random.rand() < self.exploration_rate:
            return int(np.random.randint(self.n_actions))
        samples = np.random.beta(self.alpha, self.beta)
        return int(np.argmax(samples))

    def update(self, action: int, reward: float, next_state: Dict[str, Any] | None) -> None:
        self.alpha[action] += reward
        self.beta[action] += 1.0 - reward


class GPSurrogateAgent:
    """Bandit agent using a Gaussian process surrogate and UCB acquisition."""

    def __init__(self, actions: List[Dict[str, Any]], kappa: float = 1.0):
        self.actions = actions
        self.kappa = kappa
        self.X: List[np.ndarray] = []
        self.y: List[float] = []
        kernel = RBF(length_scale=1.0) + WhiteKernel(noise_level=1e-6)
        self.gp = GaussianProcessRegressor(kernel=kernel, normalize_y=True)

    def select_action(self, state: Dict[str, Any] | None) -> int:
        if not self.X:
            return 0
        X_train = np.stack(self.X)
        y_train = np.array(self.y)
        self.gp.fit(X_train, y_train)
        action_arr = np.stack([self._to_vec(a) for a in self.actions])
        mu, sigma = self.gp.predict(action_arr, return_std=True)
        acquisition = mu + self.kappa * sigma
        return int(np.argmax(acquisition))

    def update(self, action: int, reward: float, next_state: Dict[str, Any] | None) -> None:
        self.X.append(self._to_vec(self.actions[action]))
        self.y.append(reward)

    @staticmethod
    def _to_vec(action: Dict[str, Any]) -> np.ndarray:
        return np.array([action[k] for k in sorted(action.keys())], dtype=float)
