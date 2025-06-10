import os
import logging
import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset
from torch import nn
from sklearn.model_selection import train_test_split
from nflows.flows.base import Flow
from nflows.distributions import StandardNormal
from nflows.transforms import CompositeTransform
from nflows.transforms.coupling import AffineCouplingTransform
from nflows.transforms.normalization import BatchNorm
from nflows.nn.nets import ResidualNet
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel
from scipy.special import gammaln

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------
# Basic sampling utilities
# ---------------------------------------------------------------------


def sample_from_prior(prior_dict):
    theta = {}
    for name, spec in prior_dict.items():
        dist = spec["dist"]
        if dist == "Normal":
            theta[name] = float(np.random.normal(spec["mean"], spec["sd"]))
        elif dist == "Gamma":
            theta[name] = float(np.random.gamma(spec["shape"], spec["scale"]))
        elif dist == "Uniform":
            theta[name] = float(np.random.uniform(spec["low"], spec["high"]))
        else:
            raise ValueError(f"Unsupported prior {dist}")
    return theta


def build_training_set(prior_dict, design_vars, model, N_train=10000):
    """Generate (theta, design, y) samples for training."""
    theta_list = []
    design_list = []
    y_list = []
    for _ in range(N_train):
        theta = sample_from_prior(prior_dict)
        design = {}
        for dv in design_vars:
            if dv["type"] == "continuous":
                lo, hi = dv["range"]
                design[dv["name"]] = float(np.random.uniform(lo, hi))
            else:
                design[dv["name"]] = np.random.choice(dv["values"])
        y = model.simulate(theta, design)
        theta_list.append([theta[n] for n in sorted(theta.keys())])
        design_list.append([design[n] for n in sorted(design.keys())])
        y_list.append([y] if np.isscalar(y) else list(y))
    theta_arr = np.array(theta_list, dtype=float)
    design_arr = np.array(design_list, dtype=float)
    y_arr = np.array(y_list, dtype=float)
    return theta_arr, design_arr, y_arr


def create_flow(theta_dim, data_design_dim):
    transforms = []
    mask = np.arange(theta_dim) % 2
    for _ in range(5):

        def make_net(in_features, out_features):
            return ResidualNet(
                in_features=in_features,
                out_features=out_features,
                hidden_features=128,
                context_features=data_design_dim,
            )

        transforms.append(
            AffineCouplingTransform(mask=mask, transform_net_create_fn=make_net)
        )
        transforms.append(BatchNorm(features=theta_dim))
        mask = 1 - mask
    transform = CompositeTransform(transforms)
    return Flow(transform, StandardNormal([theta_dim]))


def train_flow(theta_arr, design_arr, y_arr, epochs=100, batch_size=128, out_dir="."):
    X = np.concatenate([y_arr, design_arr], axis=1)
    theta_tensor = torch.tensor(theta_arr, dtype=torch.float32)
    x_tensor = torch.tensor(X, dtype=torch.float32)
    X_train, X_val, th_train, th_val = train_test_split(
        x_tensor, theta_tensor, test_size=0.1, random_state=0
    )
    train_loader = DataLoader(
        TensorDataset(X_train, th_train), batch_size=batch_size, shuffle=True
    )
    val_loader = DataLoader(TensorDataset(X_val, th_val), batch_size=batch_size)
    flow = create_flow(theta_tensor.shape[1], X.shape[1])
    optimizer = torch.optim.Adam(flow.parameters(), lr=1e-3)
    best_val = float("inf")
    patience = 0
    for ep in range(epochs):
        flow.train()
        total = 0
        for xb, tb in train_loader:
            optimizer.zero_grad()
            loss = -flow.log_prob(tb, xb).mean()
            loss.backward()
            optimizer.step()
            total += loss.item() * len(xb)
        train_loss = total / len(train_loader.dataset)
        flow.eval()
        with torch.no_grad():
            val_total = 0
            for xb, tb in val_loader:
                val_total += -flow.log_prob(tb, xb).mean().item() * len(xb)
            val_loss = val_total / len(val_loader.dataset)
        if val_loss < best_val:
            best_val = val_loss
            patience = 0
            torch.save(flow.state_dict(), os.path.join(out_dir, "flow.pth"))
        else:
            patience += 1
        if patience >= 10:
            break
    flow.load_state_dict(torch.load(os.path.join(out_dir, "flow.pth")))
    flow.eval()
    return flow


def log_prior(theta_vec, prior_dict):
    total = 0.0
    for i, name in enumerate(sorted(prior_dict.keys())):
        spec = prior_dict[name]
        x = theta_vec[i]
        if spec["dist"] == "Normal":
            mean = spec["mean"]
            sd = spec["sd"]
            total += -0.5 * ((x - mean) / sd) ** 2 - np.log(sd * np.sqrt(2 * np.pi))
        elif spec["dist"] == "Gamma":
            shape = spec["shape"]
            scale = spec["scale"]
            total += (
                (shape - 1) * np.log(x)
                - x / scale
                - shape * np.log(scale)
                - gammaln(shape)
            )
        elif spec["dist"] == "Uniform":
            low = spec["low"]
            high = spec["high"]
            if low <= x <= high:
                total += -np.log(high - low)
            else:
                total += -np.inf
        else:
            raise ValueError("Unsupported prior distribution")
    return total


def estimate_eig(
    *args,
    use_control_variates: bool = False,
    control_variate: str = "prior_loglik",
    beta: float = 1.0,
    sampling_method: str = "MC",
    use_antithetic: bool = False,
    ci_threshold: float | None = None,
    N_max: int = 10000,
    use_optimal_beta: bool = False,
    random_seed: int | None = None,
    **kwargs,
):
    """Estimate expected information gain.

    Supports two calling conventions:
    1) estimate_eig(prior_dict, design, model, n_samples=200)
    2) estimate_eig(design, flow, prior_dict, model, M_test=2000)

    Returns (mean, standard_error, N_used).
    """

    if random_seed is not None:
        np.random.seed(random_seed)

    if len(args) >= 4 and isinstance(args[1], Flow):
        # Fall back to Monte Carlo using the model log-likelihood for robustness
        design, flow, prior_dict, model = args[:4]
        n_samples = args[4] if len(args) > 4 else kwargs.get("M_test", 2000)
        return estimate_eig(
            prior_dict,
            design,
            model,
            n_samples=n_samples,
            use_control_variates=use_control_variates,
            control_variate=control_variate,
            beta=beta,
            sampling_method=sampling_method,
            random_seed=random_seed,
        )
    else:
        prior_dict, design, model = args[:3]
        N = kwargs.get("n_samples", 200)

        def sample_theta(n):
            if sampling_method == "QMC":
                from scipy.stats import qmc, norm, gamma

                dim = len(prior_dict)
                engine = qmc.Sobol(d=dim, scramble=True, seed=random_seed)
                u = engine.random(n)
                th_list = []
                names = sorted(prior_dict.keys())
                for row in u:
                    th = {}
                    for i, name in enumerate(names):
                        spec = prior_dict[name]
                        if spec["dist"] == "Uniform":
                            lo, hi = spec["low"], spec["high"]
                            th[name] = float(lo + (hi - lo) * row[i])
                        elif spec["dist"] == "Normal":
                            th[name] = float(
                                norm.ppf(row[i], loc=spec["mean"], scale=spec["sd"])
                            )
                        elif spec["dist"] == "Gamma":
                            th[name] = float(
                                gamma.ppf(row[i], a=spec["shape"], scale=spec["scale"])
                            )
                        else:
                            th[name] = sample_from_prior({name: spec})[name]
                    th_list.append(th)
                return th_list
            else:
                return [sample_from_prior(prior_dict) for _ in range(n)]

        def antithetic(th):
            at = {}
            for name, spec in prior_dict.items():
                val = th[name]
                if spec["dist"] == "Uniform":
                    at[name] = spec["low"] + spec["high"] - val
                elif spec["dist"] == "Normal":
                    mean = spec["mean"]
                    at[name] = 2 * mean - val
                else:
                    at[name] = val
            return at

        utilities = []
        h_vals = []
        total_samples = 0
        while True:
            theta_samples = sample_theta(N)
            if use_antithetic:
                theta_samples += [antithetic(th) for th in theta_samples]
            total_samples += len(theta_samples)
            for theta in theta_samples:
                y = model.simulate(theta, design)
                lp_theta = model.log_likelihood(y, theta, design)
                lps = [model.log_likelihood(y, th, design) for th in theta_samples]
                max_lp = max(lps)
                log_py = np.log(np.mean(np.exp(np.array(lps) - max_lp))) + max_lp
                u_i = lp_theta - log_py
                utilities.append(u_i)
                if use_control_variates:
                    h_vals.append(log_py)

            arr = np.array(utilities, dtype=float)
            mean = arr.mean()
            se = arr.std(ddof=1) / np.sqrt(len(arr))
            if (
                ci_threshold is None
                or abs(se / mean) <= ci_threshold
                or len(arr) >= N_max
            ):
                break
            N = min(N_max - len(arr), N)

        if use_control_variates:
            h_arr = np.array(h_vals)
            if use_optimal_beta:
                cov = np.cov(arr, h_arr, ddof=1)[0, 1]
                var_h = h_arr.var(ddof=1)
                if var_h > 0:
                    beta = cov / var_h
            adj = arr - beta * (h_arr - h_arr.mean())
            arr = adj

        mean = float(arr.mean())
        se = float(arr.std(ddof=1) / np.sqrt(len(arr)))
        return mean, se, len(arr)


def optimize_design(
    prior_dict, design_vars, model, flow, bo_budget=50, util_fn=estimate_eig
):
    evaluated_d = []
    evaluated_u = []
    evaluated_records = []

    def sample_design_local():
        d = {}
        for dv in design_vars:
            if dv["type"] == "continuous":
                lo, hi = dv["range"]
                d[dv["name"]] = float(np.random.uniform(lo, hi))
            else:
                d[dv["name"]] = np.random.choice(dv["values"])
        return d

    for _ in range(20):
        d = sample_design_local()
        res = util_fn(d)
        if isinstance(res, tuple):
            if len(res) == 3:
                u, se, _ = res
            else:
                u, se = res
        else:
            u, se = res, None
        log.info(f"EIG={u:.4f} \u00b1{(se or 0.0):.4f}")
        evaluated_d.append([d[name] for name in sorted(d.keys())])
        evaluated_u.append(u)
        rec = {"design": d, "utility": u}
        if se is not None:
            rec["se"] = se
        evaluated_records.append(rec)

    X = np.array(evaluated_d)
    y = np.array(evaluated_u)
    kernel = RBF(length_scale=1.0) + WhiteKernel(noise_level=1e-6)
    gp = GaussianProcessRegressor(
        kernel=kernel, n_restarts_optimizer=5, normalize_y=True
    )
    gp.fit(X, y)
    best_idx = int(np.argmax(y))
    best_design = {
        name: evaluated_d[best_idx][i] for i, name in enumerate(sorted(d.keys()))
    }

    for it in range(20, bo_budget):
        best_ei = -np.inf
        best_proposal = None
        discrete_combos = [{}]
        for dv in design_vars:
            if dv["type"] == "discrete":
                new_combos = []
                for c in discrete_combos:
                    for val in dv["values"]:
                        nc = c.copy()
                        nc[dv["name"]] = val
                        new_combos.append(nc)
                discrete_combos = new_combos

        for combo in discrete_combos:

            def ei_objective(x):
                point = np.array(
                    [
                        *x,
                        *[
                            combo.get(name)
                            for name in sorted(combo.keys())
                            if name in combo
                        ],
                    ]
                )
                mu, sigma = gp.predict(point.reshape(1, -1), return_std=True)
                sigma = sigma[0]
                mu = mu[0]
                current_best = np.max(y)
                z = (mu - current_best) / sigma if sigma > 0 else 0
                from math import erf

                ei = (mu - current_best) * 0.5 * (
                    1 + erf(z / np.sqrt(2))
                ) + sigma * np.exp(-0.5 * z**2) / np.sqrt(2 * np.pi)
                return -ei

            bounds = []
            cont_names = []
            for dv in design_vars:
                if dv["type"] == "continuous":
                    bounds.append(tuple(dv["range"]))
                    cont_names.append(dv["name"])

            if bounds:
                x0 = np.random.uniform([b[0] for b in bounds], [b[1] for b in bounds])
                from scipy.optimize import minimize

                res = minimize(ei_objective, x0, bounds=bounds, method="L-BFGS-B")
                if res.success:
                    ei_val = -res.fun
                    if ei_val > best_ei:
                        best_ei = ei_val
                        best_proposal = {
                            **{n: v for n, v in zip(cont_names, res.x)},
                            **combo,
                        }
            else:
                ei_val = -ei_objective(np.array([]))
                if ei_val > best_ei:
                    best_ei = ei_val
                    best_proposal = combo

        if best_proposal is None:
            best_proposal = sample_design_local()

        res = util_fn(best_proposal)
        if isinstance(res, tuple):
            if len(res) == 3:
                u_new, se_new, _ = res
            else:
                u_new, se_new = res
        else:
            u_new, se_new = res, None
        log.info(f"EIG={u_new:.4f} \u00b1{(se_new or 0.0):.4f}")
        evaluated_d.append(
            [best_proposal[name] for name in sorted(best_proposal.keys())]
        )
        evaluated_u.append(u_new)
        rec = {"design": best_proposal, "utility": u_new}
        if se_new is not None:
            rec["se"] = se_new
        evaluated_records.append(rec)
        X = np.array(evaluated_d)
        y = np.array(evaluated_u)
        gp.fit(X, y)
        if u_new > evaluated_u[best_idx]:
            best_idx = len(evaluated_u) - 1
            best_design = best_proposal

    return best_design, evaluated_records


def fit_flow(
    prior_dict, model, design_vars=None, n_train=2000, epochs=30, cache_path=None
):
    """Train a normalising flow or load a cached version if available."""
    design_vars = design_vars or []

    if cache_path and os.path.exists(cache_path):
        # Attempt to load a cached flow from disk
        theta_sample = sample_from_prior(prior_dict)
        dummy_design = {}
        for dv in design_vars:
            if dv["type"] == "continuous":
                dummy_design[dv["name"]] = float(dv["range"][0])
            else:
                dummy_design[dv["name"]] = dv["values"][0]
        y = model.simulate(theta_sample, dummy_design)
        y_dim = 1 if np.isscalar(y) else len(np.atleast_1d(y))
        flow = create_flow(len(prior_dict), y_dim + len(design_vars))
        try:
            flow.load_state_dict(torch.load(cache_path, map_location="cpu"))
            flow.eval()
            return flow
        except Exception:
            pass

    theta_arr, design_arr, y_arr = build_training_set(
        prior_dict, design_vars, model, N_train=n_train
    )
    flow = train_flow(theta_arr, design_arr, y_arr, epochs=epochs)
    if cache_path:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        torch.save(flow.state_dict(), cache_path)
    return flow


def summarize(particles):
    if not particles:
        return {}
    names = particles[0].keys()
    summary = {}
    for name in names:
        vals = [p[name] for p in particles]
        summary[name] = {
            "mean": float(np.mean(vals)),
            "variance": float(np.var(vals)),
        }
    return summary


def compute_group_separation_utility(priors, design, model, groups):
    """Compute a simple posterior separation metric between groups."""
    theta_true = sample_from_prior(priors)
    post_means = []
    for _ in groups:
        y = model.simulate(theta_true, design)
        samples = [sample_from_prior(priors) for _ in range(200)]
        log_w = np.array([model.log_likelihood(y, th, design) for th in samples])
        w = np.exp(log_w - np.max(log_w))
        w = w / np.sum(w)
        idx = np.random.choice(len(samples), size=len(samples), p=w)
        particles = [samples[i] for i in idx]
        summary = summarize(particles)
        if summary:
            post_means.append(
                np.array([summary[n]["mean"] for n in sorted(summary.keys())])
            )

    if len(post_means) < 2:
        return 0.0

    post_means = np.stack(post_means)
    dists = []
    for i in range(len(post_means)):
        for j in range(i + 1, len(post_means)):
            dists.append(np.linalg.norm(post_means[i] - post_means[j]))
    return float(np.mean(dists))
