from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np

from models import JobResult, JobStatus, JobMetric, Job, Project
from model_loader import load_model
from boed_utils import sample_from_prior

try:  # allow running as script without package context
    from .bandit import ThompsonBanditAgent, GPSurrogateAgent
except ImportError:  # pragma: no cover - fallback for direct execution
    from bandit import ThompsonBanditAgent, GPSurrogateAgent
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
                if dv.get("type") == "discrete":
                    nc[dv["name"]] = val
                else:
                    nc[dv["name"]] = float(val)
                new.append(nc)
        combos = new
    return combos


def compute_reward(
    t: int, history: List[Dict[str, Any]], terminationCriterion: Dict[str, Any]
) -> tuple[float, bool]:
    """Compute reward and determine if the termination criterion is met."""

    ctype = terminationCriterion.get("type")
    thr = float(terminationCriterion.get("threshold", 0.0))

    if ctype == "trials_to_threshold":
        criterion_met = t >= thr
        reward = 0.0 if criterion_met else -1.0
    elif ctype == "cumulative_reward":
        cumulative = sum(h.get("reward", 0.0) for h in history)
        criterion_met = cumulative >= thr
        reward = cumulative
    elif ctype == "last_accuracy":
        last_acc = history[-1].get("accuracy", 0.0) if history else 0.0
        criterion_met = last_acc >= thr
        reward = last_acc
    else:
        criterion_met = False
        reward = 0.0

    return reward, criterion_met


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------


def optimize_sequence_local(
    config_model: Dict[str, Any],
    priors: Dict[str, Any],
    design_vars: List[Dict[str, Any]],
    posterior: Dict[str, Any],
    max_iters: int,
    job: Optional["Job"] = None,
    db=None,
    simulated_perf: List[float] | None = None,
    observed_data=None,
    record_history: bool = False,
) -> Any:
    """Run the sequence optimisation loop locally and return the best sequence.

    If ``record_history`` is ``True`` a tuple ``(sequence, history)`` is
    returned where ``history`` contains posterior samples and simulated
    performance for each iteration.
    """

    model = load_model(config_model, job.id if job else None)
    true_theta = sample_from_prior(priors)
    n_particles = 100
    particles = [sample_from_prior(priors) for _ in range(n_particles)]
    history: List[Dict[str, Any]] = []
    actions = enumerate_actions(design_vars)
    agent = ThompsonBanditAgent(len(actions))
    criterion = {"type": "trials_to_threshold", "threshold": max_iters}
    best_reward = float("-inf")
    best_sequence: Optional[List[Dict[str, Any]]] = None
    cumulative_reward = 0.0

    for t in range(1, max_iters + 1):
        state = extract_state(particles, history, t)
        a_idx = agent.select_action(state)
        action = actions[a_idx]
        if observed_data is None:
            y = model.simulate(true_theta, action)
        else:
            y = observed_data
        log_w = np.array([model.log_likelihood(y, th, action) for th in particles])
        w = np.exp(log_w - np.max(log_w))
        w = w / np.sum(w)
        idx = np.random.choice(len(particles), size=len(particles), p=w)
        particles = [particles[i] for i in idx]
        reward, done = compute_reward(t, history, criterion)
        next_state = extract_state(particles, history + [{"action": action}], t + 1)
        agent.update(a_idx, reward, next_state)
        cumulative_reward += reward
        record = {
            "iteration": t,
            "design_point": action,
            "simulated_perf": float(simulated_perf[t - 1])
            if simulated_perf is not None and t <= len(simulated_perf)
            else None,
            "posterior_samples": [p.copy() for p in particles],
        }
        history.append(record)
        if job is not None and db is not None:
            metric = JobMetric(
                job_id=job.id,
                iteration=t,
                design_point=action,
                utility=reward,
                posterior_summary=None,
            )
            db.add(metric)
            db.commit()

        if cumulative_reward > best_reward:
            best_reward = cumulative_reward
            best_sequence = [h["action"] for h in history]
        if done:
            break

    sequence = best_sequence or [h["design_point"] for h in history]
    if record_history:
        return sequence, history
    return sequence


def run_sequence_optimization_job(
    job: Job, project: Project, config: dict, seq_opts: dict, db
) -> None:
    """Execute a sequence optimisation job."""
    priors = config.get("priors", {})
    design_vars = config.get("designVariables", [])
    objective = config.get("objective", {})
    simulate_only = objective.get("simulateOnly", False)
    template_name = objective.get("template")
    simulated_perf = None
    if simulate_only and template_name:
        from template_models import template_registry

        model_cls = template_registry.get(template_name)
        if model_cls:
            sim_model = model_cls()
            params = sample_from_prior(model_cls.default_priors())
            sessions = job.maxIterations or int(seq_opts.get("trialBudget", 1))
            if template_name == "calcium_imaging":
                t = {"t": np.arange(sessions)}
                simulated_perf = sim_model.simulate(params, t)
            else:
                simulated_perf = sim_model.simulate(params, sessions)

    observed = None
    if template_name == "calcium_imaging":
        cal_cfg = config.get("calciumData")
        if cal_cfg:
            from data.calcium_loader import load_calcium_data
            cal = load_calcium_data(cal_cfg["path"], cal_cfg["format"])
            observed = cal["traces"]

    sequence, history = optimize_sequence_local(
        config.get("model", {}),
        priors,
        design_vars,
        {},
        job.maxIterations or int(seq_opts.get("trialBudget", 1)),
        job,
        db,
        simulated_perf=simulated_perf,
        observed_data=observed,
        record_history=True,
    )

    posterior_list = [sample_from_prior(priors) for _ in range(100)]

    db.add(
        JobResult(
            job_id=job.id,
            summary={
                "best_sequence": sequence,
                "initialPosterior": posterior_list,
                "simulationHistory": history,
            },
        )
    )
    job.status = JobStatus.succeeded
    job.completed_at = datetime.now(timezone.utc)
    db.commit()


class SequenceOptimizer:
    """Sequence optimiser used for adaptive design suggestions."""

    def __init__(
        self,
        config_model: Dict[str, Any],
        priors: Dict[str, Any],
        design_vars: List[Dict[str, Any]],
        posterior: Dict[str, Any],
        max_iterations: int,
        simulated_perf: List[float] | None = None,
        observed_data=None,
    ) -> None:
        self.config_model = config_model
        self.priors = priors
        self.design_vars = design_vars
        self.posterior = posterior
        self.max_iterations = max_iterations
        self.simulated_perf = simulated_perf
        self.observed_data = observed_data

    def optimize_sequence(self) -> List[Dict[str, Any]]:
        return optimize_sequence_local(
            self.config_model,
            self.priors,
            self.design_vars,
            self.posterior,
            self.max_iterations,
            simulated_perf=self.simulated_perf,
            observed_data=self.observed_data,
        )
