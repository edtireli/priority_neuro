import os
import json
from datetime import datetime
import uuid
from celery_app import celery
from database import SessionLocal
from models import Job, Project, JobStatus, RunMode, JobMetric, JobResult
from fastapi.templating import Jinja2Templates
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
import asyncio
import traceback
from celery.signals import task_failure
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
UPLOADS_ROOT = os.getenv("UPLOADS_ROOT", "uploads")

conf = ConnectionConfig(
    MAIL_USERNAME="your_smtp_username",
    MAIL_PASSWORD="your_smtp_password",
    MAIL_FROM="no-reply@yourdomain.com",
    MAIL_SERVER="smtp.yourprovider.com",
    MAIL_PORT=587,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)
templates = Jinja2Templates(directory="./email_templates")


@celery.task(name="send_verification_email")
def send_verification_email(email: str, full_name: str, token: str):
    verify_link = f"http://localhost:3000/verify-email?token={token}"
    html_content = templates.get_template("verify_email.html").render(
        full_name=full_name,
        verify_link=verify_link,
    )
    message = MessageSchema(
        subject="Please verify your email",
        recipients=[email],
        body=html_content,
        subtype="html",
    )
    fm = FastMail(conf)
    asyncio.run(fm.send_message(message))


def simple_sample_design(design_vars):
    d = {}
    for dv in design_vars:
        if dv["type"] == "continuous":
            lo, hi = dv["range"]
            d[dv["name"]] = float(np.random.uniform(lo, hi))
        else:
            d[dv["name"]] = dv["values"][0]
    return d


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
            return MLP(
                in_features=data_design_dim,
                out_features=out_features,
                hidden_features=128,
                num_hidden_layers=2,
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
    dataset = TensorDataset(x_tensor, theta_tensor)
    train_loader = DataLoader(
        TensorDataset(X_train, th_train), batch_size=batch_size, shuffle=True
    )
    val_loader = DataLoader(TensorDataset(X_val, th_val), batch_size=batch_size)
    flow = create_flow(theta_tensor.shape[1], X.shape[1])
    optimizer = torch.optim.Adam(flow.parameters(), lr=1e-3)
    best_val = float("inf")
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
            total += loss.item() * len(xb)
        train_loss = total / len(train_loader.dataset)
        flow.eval()
        with torch.no_grad():
            val_total = 0
            for xb, tb in val_loader:
                val_total += -flow.log_prob(tb, xb).mean().item() * len(xb)
            val_loss = val_total / len(val_loader.dataset)
        log_lines.append(f"{ep+1},{train_loss:.4f},{val_loss:.4f}")
        if val_loss < best_val:
            best_val = val_loss
            patience = 0
            torch.save(flow.state_dict(), os.path.join(out_dir, "flow.pth"))
        else:
            patience += 1
        if patience >= 10:
            break
    with open(os.path.join(out_dir, "training.log"), "w") as f:
        f.write("epoch,train_loss,val_loss\n" + "\n".join(log_lines))
    flow.load_state_dict(torch.load(os.path.join(out_dir, "flow.pth")))
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


def estimate_eig(design, flow, prior_dict, model, M_test=2000):
    post_minus_prior = []
    d_vec = [design[n] for n in sorted(design.keys())]
    for _ in range(M_test):
        theta = sample_from_prior(prior_dict)
        y = model.simulate(theta, design)
        theta_vec = torch.tensor(
            [[theta[n] for n in sorted(prior_dict.keys())]], dtype=torch.float32
        )
        y_part = [y] if np.isscalar(y) else list(y)
        y_design = torch.tensor([y_part + d_vec], dtype=torch.float32)
        log_post = flow.log_prob(theta_vec, y_design).item()
        log_p = log_prior(theta_vec[0].numpy(), prior_dict)
        post_minus_prior.append(log_post - log_p)
    return float(np.mean(post_minus_prior))


def optimize_design(prior_dict, design_vars, model, flow, bo_budget=50):
    evaluated_d = []
    evaluated_u = []
    evaluated_records = []

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
        evaluated_records.append({"design": d, "utility": u})

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
                from math import erf, sqrt, exp

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
            best_proposal = sample_design()

        u_new = estimate_eig(best_proposal, flow, prior_dict, model)
        print(f"Iteration {it-19}: proposed design {best_proposal}, EIG = {u_new:.3f}")
        evaluated_d.append(
            [best_proposal[name] for name in sorted(best_proposal.keys())]
        )
        evaluated_u.append(u_new)
        evaluated_records.append({"design": best_proposal, "utility": u_new})
        X = np.array(evaluated_d)
        y = np.array(evaluated_u)
        gp.fit(X, y)
        if u_new > evaluated_u[best_idx]:
            best_idx = len(evaluated_u) - 1
            best_design = best_proposal

    return best_design, evaluated_records


@celery.task(name="run_boed_job")
def run_boed_job(job_id: str):
    """Run a simple BOED loop and record metrics."""
    db: Session = SessionLocal()
    job = None
    try:
        jid = uuid.UUID(job_id)
        job = db.query(Job).filter(Job.id == jid).first()
        if not job:
            return
        job.status = JobStatus.running
        job.started_at = datetime.utcnow()
        db.commit()

        project = db.query(Project).filter(Project.id == job.project_id).first()
        config = project.config_json or {}
        model_cfg = config.get("model", {})

        # Instantiate model (built-in or custom)
        design_vars = config.get("designVariables", [])
        if model_cfg.get("type") == "built-in":
            tmpl = model_cfg.get("templateName")
            dname = design_vars[0]["name"] if design_vars else "x"
            if tmpl == "psychometric":
                model = PsychometricModel(model_cfg.get("parameters", []), design_name=dname)
            else:
                model = PoissonRateModel(model_cfg.get("parameters", []), design_name=dname)
        else:
            import importlib.util

            file_name = model_cfg.get("customFileName")
            model_path = os.path.join(UPLOADS_ROOT, "custom_models", str(job.id), file_name)
            spec = importlib.util.spec_from_file_location("custom_model", model_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            if hasattr(module, "Model"):
                model = module.Model(model_cfg.get("parameters", []))
            else:
                class WrappedModel:
                    def __init__(self, mod):
                        self.mod = mod

                    def simulate(self, theta, design):
                        return self.mod.simulate(theta, design)

                    def log_likelihood(self, data, theta, design):
                        return self.mod.log_likelihood(data, theta, design)

                model = WrappedModel(module)

        priors = config.get("priors", {})
        trial_budget = config.get("trialBudget") or config.get("constraints", {}).get("trialLimit", 0)
        trial_budget = int(trial_budget)

        # Sample "true" theta from the prior
        theta_true = sample_from_prior(priors)

        # Initialize posterior particles
        n_particles = 500
        particles = [sample_from_prior(priors) for _ in range(n_particles)]

        def summarize(ps):
            summary = {}
            for name in priors.keys():
                vals = np.array([p[name] for p in ps], dtype=float)
                summary[name] = {"mean": float(np.mean(vals)), "sd": float(np.std(vals))}
            return summary

        design_history = []
        util_traj = []
        for i in range(1, trial_budget + 1):
            design = simple_sample_design(design_vars)
            design_history.append(design)
            y = model.simulate(theta_true, design)

            logw = np.array([model.log_likelihood(y, th, design) for th in particles], dtype=float)
            logw -= logw.max()
            w = np.exp(logw)
            w /= w.sum()
            idx = np.random.choice(len(particles), size=len(particles), p=w)
            particles = [particles[j].copy() for j in idx]

            summary = summarize(particles)

            metric = JobMetric(
                job_id=job.id,
                iteration=i,
                design_point=design,
                utility=0.0,
                posterior_summary=summary,
            )
            db.add(metric)
            db.commit()
            util_traj.append(0.0)

        final_summary = {
            "posterior": summarize(particles),
            "designs_tested": design_history,
            "utility_trajectory": util_traj,
        }
        db.add(JobResult(job_id=job.id, summary=final_summary))
        job.status = JobStatus.succeeded
        job.completed_at = datetime.utcnow()
        db.commit()
    except Exception as exc:
        if job:
            job.status = JobStatus.failed
            setattr(job, "error_detail", str(exc))
            job.log = str(exc)
            job.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


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
        job.results_folder = results_dir
        db.commit()

        if job.mode == RunMode.sequential:
            batch_size = adv.get("batch_size", 5)
            max_iter = job.maxIterations or adv.get("max_iterations")
            job.maxIterations = max_iter
            iter_no = job.iteration
            if iter_no == 0:
                designs = [
                    simple_sample_design(config["designVariables"])
                    for _ in range(batch_size)
                ]
                idir = os.path.join(results_dir, f"iteration_{iter_no}")
                os.makedirs(idir, exist_ok=True)
                with open(os.path.join(idir, "designs.json"), "w") as f:
                    json.dump(designs, f, indent=2)
                job.iteration = iter_no + 1
                job.status = JobStatus.paused_awaiting_data
                db.commit()
                return
            data_path = os.path.join(
                UPLOADS_ROOT, "data", str(job.id), f"iteration_{iter_no-1}.json"
            )
            if not os.path.exists(data_path):
                job.log = (job.log or "") + f"\nMissing data for iteration {iter_no-1}"
                job.status = JobStatus.paused_awaiting_data
                db.commit()
                return
            if max_iter is not None and iter_no >= max_iter:
                with open(os.path.join(results_dir, "optimal.json"), "w") as f:
                    json.dump({"final_iteration": iter_no}, f)
                job.status = JobStatus.succeeded
                job.completed_at = datetime.utcnow()
                db.commit()
                return
            designs = [
                simple_sample_design(config["designVariables"])
                for _ in range(batch_size)
            ]
            idir = os.path.join(results_dir, f"iteration_{iter_no}")
            os.makedirs(idir, exist_ok=True)
            with open(os.path.join(idir, "designs.json"), "w") as f:
                json.dump(designs, f, indent=2)
            job.iteration = iter_no + 1
            db.commit()
            return

        if config["model"]["templateName"] == "psychometric":
            model = PsychometricModel(
                config["model"]["parameters"],
                design_name=config["designVariables"][0]["name"],
            )
        else:
            model = PoissonRateModel(config["model"]["parameters"])

        n_train = adv.get("n_train", 2000)
        theta_arr, design_arr, y_arr = build_training_set(
            config["priors"], config["designVariables"], model, N_train=n_train
        )
        flow = train_flow(
            theta_arr,
            design_arr,
            y_arr,
            epochs=adv.get("epochs", 100),
            out_dir=results_dir,
        )

        best_design, eval_records = optimize_design(
            config["priors"],
            config["designVariables"],
            model,
            flow,
            bo_budget=adv.get("bo_budget", 20),
        )
        best_u = estimate_eig(
            best_design, flow, config["priors"], model, M_test=adv.get("M_test", 1000)
        )

        evaluated_designs = eval_records
        top_designs = sorted(
            evaluated_designs, key=lambda r: r["utility"], reverse=True
        )[:10]

        n_samples = 2000
        prior_samples = [sample_from_prior(config["priors"]) for _ in range(n_samples)]
        theta0 = sample_from_prior(config["priors"])
        y_obs = model.simulate(theta0, best_design)
        y_vec = [y_obs] if np.isscalar(y_obs) else list(y_obs)
        design_vec = [best_design[n] for n in sorted(best_design.keys())]
        context = torch.tensor([y_vec + design_vec], dtype=torch.float32).repeat(
            n_samples, 1
        )
        with torch.no_grad():
            post_samples_arr = flow.sample(n_samples, context=context).numpy()
        param_names = sorted(config["priors"].keys())
        post_samples = []
        for row in post_samples_arr:
            post_samples.append(
                {name: float(row[i]) for i, name in enumerate(param_names)}
            )

        def to_hist(samples_list):
            hists = {}
            for name in param_names:
                values = [s[name] for s in samples_list]
                bins = np.linspace(min(values), max(values), 200)
                density, _ = np.histogram(values, bins=bins, density=True)
                hists[name] = {
                    "bins": bins[:-1].tolist(),
                    "density": density.tolist(),
                }
            return hists

        raw_prior_samples = prior_samples
        raw_post_samples = post_samples
        if len(param_names) > 6:
            prior_samples = to_hist(prior_samples)
            post_samples = to_hist(post_samples)

        learning_curve = None
        if config.get("objective", {}).get("type") == "training_efficiency":
            T = config.get("constraints", {}).get("trialLimit") or 20
            sessions = list(range(1, T + 1))
            perf_samples = []
            for samp in raw_post_samples:
                thr = samp.get("threshold", 0.0)
                slope = samp.get("slope", 1.0)
                perf = 1 / (1 + np.exp(-(np.array(sessions) - thr) / slope))
                perf_samples.append(perf)
            perf_arr = np.stack(perf_samples)
            mean_perf = perf_arr.mean(axis=0)
            lower = np.quantile(perf_arr, 0.025, axis=0)
            upper = np.quantile(perf_arr, 0.975, axis=0)
            learning_curve = {
                "sessions": sessions,
                "meanPerformance": mean_perf.tolist(),
                "ciLower": lower.tolist(),
                "ciUpper": upper.tolist(),
            }

        result = {
            "job_id": job_id_str,
            "project_id": str(project.id),
            "optimalDesign": best_design,
            "utilityValue": best_u,
            "evaluatedDesigns": evaluated_designs,
            "topDesigns": top_designs,
            "priorSamples": prior_samples,
            "posteriorSamples": post_samples,
            "learningCurve": learning_curve,
            "status": "succeeded",
            "timestamp": datetime.utcnow().isoformat(),
        }

        result_path = os.path.join(results_dir, "result.json")
        detailed_path = os.path.join(results_dir, "result_detailed.json")
        with open(result_path, "w") as f:
            json.dump(
                {"optimalDesign": best_design, "utilityValue": best_u}, f, indent=2
            )

        with open(detailed_path, "w") as f:
            json.dump(result, f, indent=2)

        job.status = JobStatus.succeeded
        job.completed_at = datetime.utcnow()
        job.results_folder = results_dir
        db.commit()
    except MemoryError:
        if job:
            job.status = JobStatus.failed
            job.completed_at = datetime.utcnow()
            job.log = "Out of memory: " + traceback.format_exc()
            db.commit()
    except Exception:
        if job:
            job.status = JobStatus.failed
            job.completed_at = datetime.utcnow()
            job.log = traceback.format_exc()
            db.commit()
    finally:
        db.close()


@task_failure.connect
def capture_failure(
    sender=None, task_id=None, exception=None, args=None, kwargs=None, **others
):
    job_id = task_id
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    if job:
        job.status = JobStatus.failed
        job.log = f"Uncaught exception: {traceback.format_exc()}"
        job.completed_at = datetime.utcnow()
        db.commit()
    db.close()
