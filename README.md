# priority
![21ca02aa-ccef-4d75-ab07-d2f76e5cfe85 (2)](https://github.com/user-attachments/assets/a634dfde-e031-40af-9454-a4a0a0a3b968)

**priority** is an open-source toolkit for machine-learning enhanced Bayesian Optimal Experimental Design (BOED). It combines generative modelling, neural density estimation and a modern web interface so that neuroscience researchers can efficiently optimise their experimental protocols.

## Features
- Built-in templates for common generative models (e.g. psychometric and Poisson-rate) with the option to upload custom models.
- Bayesian objectives including group separation, expected information gain (EIG) and training efficiency.
- Sequential or single-shot optimisation using CPU or GPU workers via Celery.
- Interactive result visualisations: utility surfaces, prior vs. posterior histograms and learning curves.
- Personal user profile page with account details.
- Upload a profile picture; images are automatically converted to black and white.

## Quick Start
### Backend
```bash
cd src/backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # set DATABASE_URL and JWT_SECRET_KEY
alembic upgrade head
./run.sh
```
Launch Celery workers in separate processes:
```bash
redis-server &
cd src/backend && ./start-celery.sh &
```

### Frontend
```bash
cd src/frontend
npm install
npm start
```
Open `http://localhost:3000` with the backend API running at `http://localhost:8000/api`.

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
