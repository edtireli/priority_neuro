import os
import json
from datetime import datetime
import uuid
from celery_app import celery
from database import SessionLocal
from models import Job, Project, JobStatus, RunMode
from sqlalchemy.orm import Session
import numpy as np
from models.expressions import PsychometricModel, PoissonRateModel
from sklearn.model_selection import train_test_split
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset
from nflows.flows.base import Flow
from nflows.distributions import StandardNormal
from nflows.transforms import CompositeTransform
from nflows.transforms.coupling import AffineCouplingTransform
from nflows.transforms.normalization import BatchNorm
from nflows.nn.nets import MLP
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel

RESULTS_ROOT = os.getenv("RESULTS_ROOT", "results")


def sample_from_prior(prior_dict):
    theta = {}
    for name, spec in prior_dict.items():
        dist = spec["dist"]
        if dist == "Normal":
            theta[name] = np.random.normal(spec["mean"], spec["sd"])
        elif dist == "Gamma":
            theta[name] = np.random.gamma(spec["shape"], spec["scale"])
        elif dist == "Uniform":
            theta[name] = np.random.uniform(spec["low"], spec["high"])
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
                design[dv["name"]] = np.random.uniform(lo, hi)
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
            return MLP(in_shape=data_design_dim, out_shape=out_features,
                       hidden_sizes=[128, 128])
        transforms.append(AffineCouplingTransform(mask=mask,
                                                 transform_net_create_fn=make_net))
        transforms.append(BatchNorm(features=theta_dim))
        mask = 1 - mask
    transform = CompositeTransform(transforms)
    return Flow(transform, StandardNormal([theta_dim]))


def train_flow(theta_arr, design_arr, y_arr, epochs=100, batch_size=128):
    X = np.concatenate([y_arr, design_arr], axis=1)
    theta_tensor = torch.tensor(theta_arr, dtype=torch.float32)
    x_tensor = torch.tensor(X, dtype=torch.float32)
    X_train, X_val, th_train, th_val = train_test_split(x_tensor, theta_tensor, test_size=0.1, random_state=0)
    dataset = TensorDataset(x_tensor, theta_tensor)
    train_loader = DataLoader(TensorDataset(X_train, th_train), batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(TensorDataset(X_val, th_val), batch_size=batch_size)
    flow = create_flow(theta_tensor.shape[1], X.shape[1])
    optimizer = torch.optim.Adam(flow.parameters(), lr=1e-3)
    best_val = float('inf')
    patience = 0
    log_lines = []
    for ep in range(epochs):
        flow.train()
        total = 0
        for xb, tb in train_loader:
            optimizer.zero_grad()
            loss = -flow.log_prob(tb, xb).mean()
            loss.backward()
            optimizer.step()
            total += loss.item()*len(xb)
        train_loss = total/len(train_loader.dataset)
        flow.eval()
        with torch.no_grad():
            val_total=0
            for xb, tb in val_loader:
                val_total += (-flow.log_prob(tb, xb).mean().item()*len(xb))
            val_loss = val_total/len(val_loader.dataset)
        log_lines.append(f"{ep+1},{train_loss:.4f},{val_loss:.4f}")
        if val_loss < best_val:
            best_val = val_loss
            patience = 0
            torch.save(flow.state_dict(), "flow.pth")
        else:
            patience += 1
        if patience >= 10:
            break
    with open("training.log", "w") as f:
        f.write("epoch,train_loss,val_loss\n" + "\n".join(log_lines))
    flow.load_state_dict(torch.load("flow.pth"))
    flow.eval()
    return flow


def log_prior(theta, prior_dict):
    total = 0.0
    for i, name in enumerate(sorted(prior_dict.keys())):
        spec = prior_dict[name]
        x = theta[i]
        if spec["dist"] == "Normal":
            mean = spec["mean"]
            sd = spec["sd"]
            total += -0.5*((x-mean)/sd)**2 - np.log(sd*np.sqrt(2*np.pi))
        elif spec["dist"] == "Gamma":
            shape = spec["shape"]
            scale = spec["scale"]
            total += (shape-1)*np.log(x) - x/scale - shape*np.log(scale) - gammaln(shape)
        elif spec["dist"] == "Uniform":
            low = spec["low"]
            high = spec["high"]
            if low <= x <= high:
                total += -np.log(high-low)
            else:
                total += -np.inf
        else:
            raise ValueError("Unsupported prior distribution")
    return total


def estimate_eig(design, flow, prior_dict, model, M_test=2000):
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


def optimize_design(prior_dict, design_vars, model, flow, bo_budget=50):
    evaluated_d = []
    evaluated_u = []

    def sample_design():
        d = {}
        for dv in design_vars:
            if dv["type"] == "continuous":
                lo, hi = dv["range"]
                d[dv["name"]] = float(np.random.uniform(lo, hi))
            else:
                d[dv["name"]] = np.random.choice(dv["values"])
        return d

    for _ in range(20):
        d = sample_design()
        u = estimate_eig(d, flow, prior_dict, model)
        print(f"Iteration 0: evaluated EIG at design {d} = {u:.3f}")
        evaluated_d.append([d[name] for name in sorted(d.keys())])
        evaluated_u.append(u)

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
                        nc = c.copy(); nc[dv["name"]] = val
                        new_combos.append(nc)
                discrete_combos = new_combos

        for combo in discrete_combos:
            def ei_objective(x):
                point = np.array([*x, *[combo.get(name) for name in sorted(combo.keys()) if name in combo]])
                mu, sigma = gp.predict(point.reshape(1, -1), return_std=True)
                sigma = sigma[0]
                mu = mu[0]
                current_best = np.max(y)
                z = (mu - current_best)/sigma if sigma>0 else 0
                from math import erf, sqrt, exp
                ei = (mu - current_best)*0.5*(1+erf(z/np.sqrt(2))) + sigma*np.exp(-0.5*z**2)/np.sqrt(2*np.pi)
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
                        best_proposal = {**{n:v for n,v in zip(cont_names, res.x)}, **combo}
            else:
                ei_val = -ei_objective(np.array([]))
                if ei_val > best_ei:
                    best_ei = ei_val
                    best_proposal = combo

        if best_proposal is None:
            best_proposal = sample_design()

        u_new = estimate_eig(best_proposal, flow, prior_dict, model)
        print(f"Iteration {it-19}: proposed design {best_proposal}, EIG = {u_new:.3f}")
        evaluated_d.append([best_proposal[name] for name in sorted(best_proposal.keys())])
        evaluated_u.append(u_new)
        X = np.array(evaluated_d)
        y = np.array(evaluated_u)
        gp.fit(X, y)
        if u_new > evaluated_u[best_idx]:
            best_idx = len(evaluated_u)-1
            best_design = best_proposal

    return best_design


@celery.task(bind=True)
def run_optimisation_task(self, job_id_str: str):
    db: Session = SessionLocal()
    job = None
    try:
        job_id = uuid.UUID(job_id_str)
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
        job.status = JobStatus.running
        job.started_at = datetime.utcnow()
        db.commit()

        project = db.query(Project).filter(Project.id == job.project_id).first()
        config = project.config_json
        adv = config.get("advanced_options", {})

        results_dir = os.path.join(RESULTS_ROOT, str(project.id), str(job.id))
        os.makedirs(results_dir, exist_ok=True)

        def sample_design():
            d = {}
            for dv in config["designVariables"]:
                if dv["type"] == "continuous":
                    lo, hi = dv["range"]
                    d[dv["name"]] = float(np.random.uniform(lo, hi))
                else:
                    d[dv["name"]] = np.random.choice(dv["values"])
            return d

        if job.mode == RunMode.single_shot:
            best_design = {}
            for dv in config["designVariables"]:
                if dv["type"] == "continuous":
                    lo, hi = dv["range"]
                    best_design[dv["name"]] = float((lo + hi) / 2)
                else:
                    best_design[dv["name"]] = dv["values"][0]
            best_u = 0.0

            result = {
                "job_id": job_id_str,
                "project_id": str(project.id),
                "optimalDesign": best_design,
                "utilityValue": best_u,
                "status": "succeeded",
                "timestamp": datetime.utcnow().isoformat()
            }

            result_path = os.path.join(results_dir, "result.json")
            with open(result_path, "w") as f:
                json.dump(result, f, indent=2)

            job.status = JobStatus.succeeded
            job.completed_at = datetime.utcnow()
            job.results_folder = results_dir
            db.commit()
        else:
            batch_size = adv.get("batch_size", 5)
            max_iter = job.maxIterations or adv.get("maxIterations")
            iter_dir = os.path.join(results_dir, f"iteration_{job.iteration}")
            os.makedirs(iter_dir, exist_ok=True)

            # finalisation check
            if job.iteration > 0:
                data_path = os.path.join("uploads", "data", str(job.id), f"iteration_{job.iteration-1}.json")
                if not os.path.exists(data_path):
                    job.status = JobStatus.failed
                    job.log = f"Missing data for iteration {job.iteration-1}"
                    db.commit()
                    return

            if max_iter is not None and job.iteration >= max_iter:
                optimal_path = os.path.join(results_dir, "optimal.json")
                with open(optimal_path, "w") as f:
                    json.dump({"completed": True}, f)
                job.status = JobStatus.succeeded
                job.completed_at = datetime.utcnow()
                job.results_folder = results_dir
                db.commit()
                return

            designs = [sample_design() for _ in range(batch_size)]
            with open(os.path.join(iter_dir, "designs.json"), "w") as f:
                json.dump(designs, f, indent=2)

            job.iteration += 1
            job.results_folder = results_dir
            job.status = JobStatus.running
            db.commit()
    except Exception as e:
        if job:
            job.status = JobStatus.failed
            job.completed_at = datetime.utcnow()
            job.log = str(e)
            db.commit()
    finally:
        db.close()
