import os, sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "backend"))
import numpy as np
from models.expressions import BernoulliModel
from boed_utils import estimate_eig, sample_from_prior


def analytic_eig_uniform_bernoulli():
    from math import log

    Hy = log(2)
    return Hy - 0.5  # E_theta[H(Y|theta)] = 0.5


def test_eig_estimation_accuracy():
    prior = {"p": {"dist": "Uniform", "low": 0.0, "high": 1.0}}
    design = {}
    model = BernoulliModel([{"name": "p"}])
    est, se, _ = estimate_eig(prior, design, model, n_samples=5000, random_seed=1)
    true_val = analytic_eig_uniform_bernoulli()
    assert abs(est - true_val) < 0.02


def test_control_variate_variance_reduction():
    prior = {"p": {"dist": "Uniform", "low": 0.0, "high": 1.0}}
    model = BernoulliModel([{"name": "p"}])
    design = {}
    _, se_mc, _ = estimate_eig(prior, design, model, n_samples=4000, random_seed=0)
    _, se_cv, _ = estimate_eig(
        prior,
        design,
        model,
        n_samples=4000,
        use_control_variates=True,
        random_seed=0,
    )
    assert se_cv <= 0.9 * se_mc


def test_reproducibility_seed():
    prior = {"p": {"dist": "Uniform", "low": 0.0, "high": 1.0}}
    model = BernoulliModel([{"name": "p"}])
    design = {}
    res1 = estimate_eig(prior, design, model, n_samples=100, random_seed=123)
    res2 = estimate_eig(prior, design, model, n_samples=100, random_seed=123)
    assert res1 == res2


def test_antithetic_variance_reduction():
    prior = {"p": {"dist": "Uniform", "low": 0.0, "high": 1.0}}
    model = BernoulliModel([{"name": "p"}])
    design = {}
    _, se_mc, _ = estimate_eig(prior, design, model, n_samples=1000, random_seed=0)
    _, se_ant, _ = estimate_eig(
        prior,
        design,
        model,
        n_samples=1000,
        use_antithetic=True,
        random_seed=0,
    )
    assert se_ant <= 0.9 * se_mc


def test_qmc_reproducibility_and_variance():
    prior = {"p": {"dist": "Uniform", "low": 0.0, "high": 1.0}}
    model = BernoulliModel([{"name": "p"}])
    design = {}
    res1 = estimate_eig(
        prior,
        design,
        model,
        n_samples=1024,
        sampling_method="QMC",
        random_seed=7,
    )
    res2 = estimate_eig(
        prior,
        design,
        model,
        n_samples=1024,
        sampling_method="QMC",
        random_seed=7,
    )
    assert res1 == res2
    _, se_mc, _ = estimate_eig(prior, design, model, n_samples=1024, random_seed=7)
    _, se_qmc, _ = res1
    assert se_qmc <= 0.95 * se_mc


def test_adaptive_sampling():
    prior = {"p": {"dist": "Uniform", "low": 0.0, "high": 1.0}}
    model = BernoulliModel([{"name": "p"}])
    design = {}
    mean, se, N_used = estimate_eig(
        prior,
        design,
        model,
        n_samples=100,
        ci_threshold=0.02,
        N_max=500,
        random_seed=1,
    )
    assert N_used >= 100
    assert abs(se / mean) <= 0.02 or N_used == 500


def test_optimal_beta():
    prior = {"p": {"dist": "Uniform", "low": 0.0, "high": 1.0}}
    model = BernoulliModel([{"name": "p"}])
    design = {}
    _, se_fixed, _ = estimate_eig(
        prior,
        design,
        model,
        n_samples=2000,
        use_control_variates=True,
        beta=1.0,
        random_seed=0,
    )
    _, se_opt, _ = estimate_eig(
        prior,
        design,
        model,
        n_samples=2000,
        use_control_variates=True,
        use_optimal_beta=True,
        random_seed=0,
    )
    assert se_opt < se_fixed
