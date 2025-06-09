# priority
![21ca02aa-ccef-4d75-ab07-d2f76e5cfe85 (2)](https://github.com/user-attachments/assets/a634dfde-e031-40af-9454-a4a0a0a3b968)

**priority** is an open-source toolkit for machine-learning enhanced Bayesian Optimal Experimental Design (BOED). It combines generative modelling, neural density estimation and a modern web interface so that neuroscience researchers can efficiently optimise their experimental protocols.

## Features
- Built-in templates for common generative models (e.g. psychometric and Poisson-rate) with the option to upload custom models.
- Bayesian objectives including group separation, expected information gain (EIG) and training efficiency.
- Sequential or single-shot optimisation using CPU or GPU workers via Celery.
- Interactive result visualisations: utility surfaces, prior vs. posterior histograms and learning curves.
- Personal user profile page with account details.
- Upload a profile picture; images are automatically converted to black and white and stored securely.

## BOED and Machine Learning
At its core **priority** uses a simulation-based approach to Bayesian Optimal
Experimental Design. A differentiable generative model produces synthetic
observations for candidate stimuli. A neural density estimator – currently a
normalising flow – learns the posterior \( p(\theta | y, d) \) from this data.
Expected information gain and other objectives can then be estimated cheaply and
optimised by Bayesian optimisation.

Sequential designs are supported by retraining the flow after each batch of
acquired data. This active learning loop enables efficient exploration of large
design spaces.

Potential neuroscience applications include:

- Adaptive psychophysics experiments that quickly map perceptual thresholds.
- Optimising stimuli for neural system identification or tuning curve recovery.
- Designing behavioural tasks that maximise separability between competing
  cognitive models.

## Getting Started
The project comprises a Python backend and a React frontend. A complete setup guide is available in [docs/getting_started.md](docs/getting_started.md).

## Workflow
1. **Build training set** – sample `(\theta, d, y)` from the prior and generative model.
2. **Train normalising flow** – approximate `p(\theta | y, d)` using the `nflows` library.
3. **Optimise design** – maximise the chosen utility with Bayesian optimisation and a GP surrogate.
4. **Estimate utility** – evaluate the resulting design with Monte Carlo sampling.
5. **Inspect results** – `result.json` and `result_detailed.json` contain the optimal design, top candidates and learning curves.

Key hyperparameters can be adjusted in `advanced_options` (`n_train`, `epochs`, `bo_budget`, `M_test`, `gp_restarts`). Results can be viewed at `/projects/{pid}/jobs/{jid}/results` or `/results-detailed`.

## Documentation
Refer to [docs/architecture.md](docs/architecture.md) for details on the API and configuration workflow, and [docs/usage.md](docs/usage.md) for step-by-step instructions.

## Running Tests
From `src/backend` run:
```bash
pytest
```
Unit tests cover the EIG estimator, job orchestration and API endpoints.

## License
Released under the [MIT License](LICENSE).
