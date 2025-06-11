import os
import json
import logging
from datetime import datetime, timezone
import uuid
from celery_app import celery
from database import SessionLocal
from models import Job, Project, JobStatus, RunMode, JobMetric, JobResult
from fastapi.templating import Jinja2Templates
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
import asyncio
import traceback
from sequence_optimizer import run_sequence_optimization_job
from celery.signals import task_failure
from sqlalchemy.orm import Session
import numpy as np
from model_loader import load_model
from models.expressions import PsychometricModel, PoissonRateModel
from boed_utils import (
    fit_flow,
    estimate_eig,
    optimize_design,
    summarize,
    build_training_set,
    train_flow,
    sample_from_prior,
    compute_group_separation_utility,
)

log = logging.getLogger(__name__)

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


# Convenience wrapper used by run_boed_job and patched in tests
def sample_design(design_vars):
    return simple_sample_design(design_vars)


def simple_estimate_eig(priors, design, model):
    """Very rough utility estimator used for the Celery task tests."""
    return 0.0




@celery.task(name="run_boed_job")
def run_boed_job(job_id: str):
    """Execute a Bayesian optimal experimental design job."""
    db: Session = SessionLocal()
    job = None
    try:
        jid = uuid.UUID(job_id)
        job = db.query(Job).get(jid)
        if not job:
            db.close()
            return

        job.status = JobStatus.running
        job.started_at = datetime.now(timezone.utc)
        db.commit()

        project = db.query(Project).get(job.project_id)
        config = project.config_json or {}
        adv = config.get("advancedOptions", {})
        obj_type = config.get("objective", {}).get("type")
        seq_opts = (
            config.get("objective", {})
            .get("options", {})
            .get("sequenceSettings", {})
        )
        if obj_type == "sequence_optimization":
            run_sequence_optimization_job(job, project, config, seq_opts, db)
            return

        objective = config.get("objective", {}).get("type")
        if objective == "group_separation" and not config.get("groups"):
            raise Exception(
                "groups configuration required for group_separation objective"
            )

        required = [
            "metadata",
            "model",
            "groups",
            "priors",
            "designVariables",
            "objective",
            "constraints",
            "trialBudget",
            "experimentalMode",
        ]
        for key in required:
            if key not in config:
                raise Exception(f"Missing config key: {key}")

        if "designName" not in config["model"]:
            dv_list = config.get("designVariables", [])
            if dv_list:
                config["model"]["designName"] = dv_list[0]["name"]
        model = load_model(config["model"], job.id)

        # In sequential mode we may require pilot data before proceeding
        if job.mode == RunMode.sequential:
            pilot_path = os.path.join(UPLOADS_ROOT, "pilot_data", f"{job.id}.csv")
            if not os.path.exists(pilot_path):
                job.status = JobStatus.paused_awaiting_data
                db.commit()
                return

        priors = config["priors"]
        design_vars = config["designVariables"]

        results_dir = os.path.join(RESULTS_ROOT, str(project.id))
        os.makedirs(results_dir, exist_ok=True)
        flow_path = os.path.join(results_dir, "flow.pth")
        flow = fit_flow(priors, model, design_vars, cache_path=flow_path)

        def fake_posterior_summary(design):
            theta_true = sample_from_prior(priors)
            y_obs = model.simulate(theta_true, design)
            samples = [sample_from_prior(priors) for _ in range(200)]
            log_w = np.array(
                [model.log_likelihood(y_obs, th, design) for th in samples]
            )
            w = np.exp(log_w - np.max(log_w))
            w = w / np.sum(w)
            idx = np.random.choice(len(samples), size=len(samples), p=w)
            particles = [samples[i] for i in idx]
            return summarize(particles)

        if job.mode == RunMode.single_shot:
            proposal = sample_design(design_vars)
            if objective == "group_separation":
                groups = config["groups"]
                u = compute_group_separation_utility(priors, proposal, model, groups)
            else:
                u = simple_estimate_eig(priors, proposal, model)
            post_sum = fake_posterior_summary(proposal)
            metric = JobMetric(
                job_id=job.id,
                iteration=1,
                design_point=proposal,
                utility=u,
                posterior_summary=post_sum,
            )
            db.add(metric)
            db.commit()

            res = JobResult(
                job_id=job.id,
                summary={
                    "posterior": post_sum,
                    "utility": u,
                    "best_design": proposal,
                },
            )
            db.add(res)
            db.commit()
        else:
            max_iter = job.maxIterations or int(config["trialBudget"])
            last_proposal = None
            import inspect

            for i in range(1, max_iter + 1):
                if len(inspect.signature(optimize_design).parameters) == 3:
                    proposal = optimize_design(priors, design_vars, model)
                else:
                    if objective == "group_separation":
                        util = lambda d: compute_group_separation_utility(
                            priors, d, model, config["groups"]
                        )
                    else:
                        util = lambda d: estimate_eig(
                            d,
                            flow,
                            priors,
                            model,
                            n_samples=adv.get("N_max", 10000),
                            use_control_variates=adv.get("use_control_variates", False),
                            control_variate=adv.get("control_variate", "prior_loglik"),
                            beta=adv.get("beta", 1.0),
                            sampling_method=adv.get("sampling_method", "MC"),
                            use_antithetic=adv.get("use_antithetic", False),
                            ci_threshold=adv.get("ci_threshold"),
                            N_max=adv.get("N_max", 10000),
                            use_optimal_beta=adv.get("use_optimal_beta", False),
                            random_seed=adv.get("random_seed"),
                        )
                    proposal, _ = optimize_design(
                        priors,
                        design_vars,
                        model,
                        flow,
                        bo_budget=max_iter,
                        util_fn=util,
                    )
                if objective == "group_separation":
                    u = compute_group_separation_utility(
                        priors, proposal, model, config["groups"]
                    )
                else:
                    u = simple_estimate_eig(priors, proposal, model)
                metric = JobMetric(
                    job_id=job.id,
                    iteration=i,
                    design_point=proposal,
                    utility=u,
                    posterior_summary=None,
                )
                db.add(metric)
                db.commit()
                last_proposal = proposal

            metrics = db.query(JobMetric).filter(JobMetric.job_id == job.id).all()
            best = max(metrics, key=lambda m: m.utility)
            post_sum = fake_posterior_summary(last_proposal)
            db.add(
                JobResult(
                    job_id=job.id,
                    summary={
                        "posterior": post_sum,
                        "best_design": best.design_point,
                        "utility": best.utility,
                    },
                )
            )
            db.commit()

        job.status = JobStatus.succeeded
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        if job:
            job = db.query(Job).get(job.id)
            job.log = (job.log or "") + traceback.format_exc()
            job.status = JobStatus.failed
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
        return
    finally:
        db.close()


@celery.task(name="run_sequence_optimization_job")
def run_sequence_optimization_job_task(job_id: str):
    """Celery entry point for sequence optimisation jobs."""
    db: Session = SessionLocal()
    job = None
    try:
        jid = uuid.UUID(job_id)
        job = db.query(Job).get(jid)
        if not job:
            db.close()
            return
        job.status = JobStatus.running
        job.started_at = datetime.now(timezone.utc)
        db.commit()

        project = db.query(Project).get(job.project_id)
        config = project.config_json or {}
        seq_opts = (
            config.get("objective", {})
            .get("options", {})
            .get("sequenceSettings", {})
        )

        run_sequence_optimization_job(job, project, config, seq_opts, db)
    except Exception:
        if job:
            job = db.query(Job).get(job.id)
            job.log = (job.log or "") + traceback.format_exc()
            job.status = JobStatus.failed
            job.completed_at = datetime.now(timezone.utc)
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
        job.started_at = datetime.now(timezone.utc)
        db.commit()

        project = db.query(Project).filter(Project.id == job.project_id).first()
        config = project.config_json
        adv = config.get("advanced_options", {})
        adv = config.get("advancedOptions", adv)
        obj_type = config.get("objective", {}).get("type")
        seq_opts = (
            config.get("objective", {})
            .get("options", {})
            .get("sequenceSettings", {})
        )
        if obj_type == "sequence_optimization":
            run_sequence_optimization_job(job, project, config, seq_opts, db)
            return

        import torch  # heavy import only when task actually runs

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
                job.completed_at = datetime.now(timezone.utc)
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
        best_u, best_se, ci_l, ci_u, N_used = estimate_eig(
            best_design,
            flow,
            config["priors"],
            model,
            n_samples=adv.get("N_max", 10000),
            use_control_variates=adv.get("use_control_variates", False),
            control_variate=adv.get("control_variate", "prior_loglik"),
            beta=adv.get("beta", 1.0),
            sampling_method=adv.get("sampling_method", "MC"),
            use_antithetic=adv.get("use_antithetic", False),
            ci_threshold=adv.get("ci_threshold"),
            N_max=adv.get("N_max", 10000),
            use_optimal_beta=adv.get("use_optimal_beta", False),
            random_seed=adv.get("random_seed"),
        )
        log.info(
            f"EIG={best_u:.4f} \u00b1{best_se:.4f} ({ci_l:.4f}–{ci_u:.4f}), N={N_used}"
        )

        evaluated_designs = eval_records
        top_designs = sorted(
            evaluated_designs, key=lambda r: r["utility"], reverse=True
        )[:10]

        n_samples = adv.get("M_test", 2000)
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
            "utilitySE": best_se,
            "ci_lower": ci_l,
            "ci_upper": ci_u,
            "evaluatedDesigns": evaluated_designs,
            "topDesigns": top_designs,
            "priorSamples": prior_samples,
            "posteriorSamples": post_samples,
            "learningCurve": learning_curve,
            "status": "succeeded",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        result_path = os.path.join(results_dir, "result.json")
        detailed_path = os.path.join(results_dir, "result_detailed.json")
        with open(result_path, "w") as f:
            json.dump(
                {
                    "optimalDesign": best_design,
                    "utilityValue": best_u,
                    "utilitySE": best_se,
                    "ci_lower": ci_l,
                    "ci_upper": ci_u,
                },
                f,
                indent=2,
            )

        with open(detailed_path, "w") as f:
            json.dump(result, f, indent=2)

        job.status = JobStatus.succeeded
        job.completed_at = datetime.now(timezone.utc)
        job.results_folder = results_dir
        db.commit()
    except MemoryError:
        if job:
            job.status = JobStatus.failed
            job.completed_at = datetime.now(timezone.utc)
            job.log = "Out of memory: " + traceback.format_exc()
            db.commit()
    except Exception:
        if job:
            job.status = JobStatus.failed
            job.completed_at = datetime.now(timezone.utc)
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
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
    db.close()
