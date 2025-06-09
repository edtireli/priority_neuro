import os
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
from nflows.nn.nets import MLP
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel
from scipy.special import gammaln


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
            return MLP(
                in_shape=data_design_dim,
                out_shape=out_features,
                hidden_sizes=[128, 128],
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
    X_train, X_val, th_train, th_val = train_test_split(x_tensor, theta_tensor, test_size=0.1, random_state=0)
    train_loader = DataLoader(TensorDataset(X_train, th_train), batch_size=batch_size, shuffle=True)
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
            total += (shape - 1) * np.log(x) - x / scale - shape * np.log(scale) - gammaln(shape)
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


def estimate_eig(*args, **kwargs):
    """Estimate expected information gain.

    Supports two calling conventions:
    1) estimate_eig(prior_dict, design, model, n_samples=200)
    2) estimate_eig(design, flow, prior_dict, model, M_test=2000)
    """
    if len(args) >= 4 and isinstance(args[1], Flow):
        design, flow, prior_dict, model = args[:4]
        M_test = args[4] if len(args) > 4 else kwargs.get("M_test", 2000)
        post_minus_prior = []
        d_vec = [design[n] for n in sorted(design.keys())]
        for _ in range(M_test):
            theta = sample_from_prior(prior_dict)
            y = model.simulate(theta, design)
            theta_vec = torch.tensor([[theta[n] for n in sorted(prior_dict.keys())]], dtype=torch.float32)
            y_part = [y] if np.isscalar(y) else list(y)
            y_design = torch.tensor([y_part + d_vec], dtype=torch.float32)
            log_post = flow.log_prob(theta_vec, y_design).item()
            log_p = log_prior(theta_vec[0].numpy(), prior_dict)
            post_minus_prior.append(log_post - log_p)
        return float(np.mean(post_minus_prior))
    else:
        prior_dict, design, model = args[:3]
        n_samples = kwargs.get("n_samples", 200)
        theta_samples = [sample_from_prior(prior_dict) for _ in range(n_samples)]
        utilities = []
        for theta in theta_samples:
            y = model.simulate(theta, design)
            lp_theta = model.log_likelihood(y, theta, design)
            lps = [model.log_likelihood(y, th, design) for th in theta_samples]
            max_lp = max(lps)
            log_py = np.log(np.mean(np.exp(np.array(lps) - max_lp))) + max_lp
            utilities.append(lp_theta - log_py)
        return float(np.mean(utilities))


def optimize_design(prior_dict, design_vars, model, flow, bo_budget=50):
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
        u = estimate_eig(d, flow, prior_dict, model)
        evaluated_d.append([d[name] for name in sorted(d.keys())])
        evaluated_u.append(u)
        evaluated_records.append({"design": d, "utility": u})

    X = np.array(evaluated_d)
    y = np.array(evaluated_u)
    kernel = RBF(length_scale=1.0) + WhiteKernel(noise_level=1e-6)
    gp = GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=5, normalize_y=True)
    gp.fit(X, y)
    best_idx = int(np.argmax(y))
    best_design = {name: evaluated_d[best_idx][i] for i, name in enumerate(sorted(d.keys()))}

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
                point = np.array([
                    *x,
                    *[combo.get(name) for name in sorted(combo.keys()) if name in combo],
                ])
                mu, sigma = gp.predict(point.reshape(1, -1), return_std=True)
                sigma = sigma[0]
                mu = mu[0]
                current_best = np.max(y)
                z = (mu - current_best) / sigma if sigma > 0 else 0
                from math import erf

                ei = (mu - current_best) * 0.5 * (1 + erf(z / np.sqrt(2))) + sigma * np.exp(-0.5 * z**2) / np.sqrt(2 * np.pi)
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
                        best_proposal = {**{n: v for n, v in zip(cont_names, res.x)}, **combo}
            else:
                ei_val = -ei_objective(np.array([]))
                if ei_val > best_ei:
                    best_ei = ei_val
                    best_proposal = combo

        if best_proposal is None:
            best_proposal = sample_design_local()

        u_new = estimate_eig(best_proposal, flow, prior_dict, model)
        evaluated_d.append([best_proposal[name] for name in sorted(best_proposal.keys())])
        evaluated_u.append(u_new)
        evaluated_records.append({"design": best_proposal, "utility": u_new})
        X = np.array(evaluated_d)
        y = np.array(evaluated_u)
        gp.fit(X, y)
        if u_new > evaluated_u[best_idx]:
            best_idx = len(evaluated_u) - 1
            best_design = best_proposal

    return best_design, evaluated_records


def fit_flow(prior_dict, model, design_vars=None, n_train=2000, epochs=30, cache_path=None):
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

    theta_arr, design_arr, y_arr = build_training_set(prior_dict, design_vars, model, N_train=n_train)
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

