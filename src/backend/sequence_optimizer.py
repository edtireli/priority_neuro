from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TYPE_CHECKING

import numpy as np

from models import JobMetric, JobResult, JobStatus
from tasks import load_model
from boed_utils import sample_from_prior

if TYPE_CHECKING:
    from models import Job, Project
from sklearn.gaussian_process.kernels import RBF, WhiteKernel
from sklearn.gaussian_process import GaussianProcessRegressor


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def extract_state(
    posterior: List[Dict[str, float]],
    history: List[Dict[str, Any]],
    t: int,
    state_window: int = 1,
) -> Dict[str, Any]:
    """Return a simple state representation for the agent.

    Parameters
    ----------
    posterior : list of particles represented as dicts
    history : list of past action dictionaries
    t : int
        Current trial number (1-indexed)
    """
    if not posterior:
        return {"t": t}
    names = sorted(posterior[0].keys())
    arr = np.array([[p[n] for n in names] for p in posterior])
    mean = arr.mean(axis=0)
    var = arr.var(axis=0)
    state = {f"mean_{n}": float(m) for n, m in zip(names, mean)}
    state.update({f"var_{n}": float(v) for n, v in zip(names, var)})
    state["t"] = t
    if history:
        state["recent_actions"] = [h["action"] for h in history[-state_window:]]
    return state


def enumerate_actions(design_vars: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Enumerate candidate actions from design variable specifications."""
    combos = [{}]
    for dv in design_vars:
        new = []
        if dv.get("type") == "discrete":
            values = dv.get("values", [])
        else:
            lo, hi = dv.get("range", [0.0, 1.0])
            # simple discretisation of continuous variables
            values = np.linspace(lo, hi, num=5)
        for c in combos:
            for val in values:
                nc = c.copy()
                nc[dv["name"]] = float(val)
                new.append(nc)
        combos = new
    return combos


def compute_reward(
    t: int, history: List[Dict[str, Any]], criterion_met: bool, reward_def: Dict[str, Any]
) -> float:
    """Compute reward according to the configured definition."""

    rtype = reward_def.get("type", "default")
    if rtype == "trials_to_threshold":
        # Penalise each trial until the target criterion is met
        return 0.0 if criterion_met else -1.0
    return 1.0 if criterion_met else 0.0


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------

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



def run_sequence_optimization_job(
    job: Job, project: Project, config: dict, seq_opts: dict, db
) -> None:
    """Execute a sequence optimisation job."""
    model = load_model(config.get("model", {}), job.id)
    true_theta = sample_from_prior(config.get("priors", {}))

    n_particles = seq_opts.get("n_particles", 100)
    posterior = [sample_from_prior(config.get("priors", {})) for _ in range(n_particles)]
    history: List[Dict[str, Any]] = []

    actions = enumerate_actions(config.get("designVariables", []))
    agent_type = seq_opts["agentType"]
    if seq_opts.get("enableGPSurrogate") and agent_type == "gp":
        agent = GPSurrogateAgent(actions)
    else:
        agent = ThompsonBanditAgent(
            len(actions),
            exploration_rate=float(seq_opts["explorationRate"]),
        )

    trial_budget = int(seq_opts["trialBudget"])
    state_window = int(seq_opts["stateWindow"])
    reward_def = seq_opts.get("rewardDefinition", {})
    criterion_cfg = seq_opts["terminationCriterion"]

    best_reward = float("-inf")
    best_sequence: Optional[List[Dict[str, Any]]] = None

    cumulative_reward = 0.0
    for t in range(1, trial_budget + 1):
        state = extract_state(posterior, history, t, state_window=state_window)
        act_idx = agent.select_action(state)
        action = actions[act_idx]
        y = model.simulate(true_theta, action)
        # simple particle filter style posterior update
        log_w = np.array([model.log_likelihood(y, th, action) for th in posterior])
        w = np.exp(log_w - np.max(log_w))
        w = w / np.sum(w)
        idx = np.random.choice(len(posterior), size=len(posterior), p=w)
        posterior = [posterior[i] for i in idx]
        if criterion_cfg.get("type") == "posterior_variance":
            names = sorted(posterior[0].keys())
            arr = np.array([[p[n] for n in names] for p in posterior])
            var = arr.var(axis=0).mean()
            criterion_met = var <= float(criterion_cfg.get("threshold", 0.0))
        elif criterion_cfg.get("type") == "cumulative_reward":
            criterion_met = cumulative_reward >= float(criterion_cfg.get("threshold", 0.0))
        elif criterion_cfg.get("type") == "last_accuracy":
            last_acc = history[-1].get("accuracy", 0.0) if history else 0.0
            criterion_met = last_acc >= float(criterion_cfg.get("threshold", 1.0))
        else:
            criterion_met = False

        reward = compute_reward(t, history, criterion_met, reward_def)
        next_state = extract_state(
            posterior, history + [{"action": action}], t + 1, state_window=state_window
        )
        agent.update(act_idx, reward, next_state)
        cumulative_reward += reward
        history.append({"t": t, "action": action, "reward": reward})

        if cumulative_reward > best_reward:
            best_reward = cumulative_reward
            best_sequence = [h["action"] for h in history]
        metric = JobMetric(
            job_id=job.id,
            iteration=t,
            design_point=action,
            utility=reward,
            posterior_summary=None,
        )
        db.add(metric)
        db.commit()
        if criterion_met:
            break

    best_sequence = best_sequence or [h["action"] for h in history]
    db.add(
        JobResult(
            job_id=job.id,
            summary={"best_sequence": best_sequence, "best_reward": best_reward},
        )
    )
    job.status = JobStatus.succeeded
    job.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.close()
