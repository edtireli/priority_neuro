# neuro-exp-design
An open‐source implementation of ML‐enhanced Bayesian Optimal Experimental Design for biomedical research. Includes surrogate modeling, expected‐utility computation, and a user‐friendly web interface to optimise experimental parameters and training protocols.

## Backend Setup

```
cd src/backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then fill in DATABASE_URL and JWT_SECRET_KEY
alembic upgrade head
./run.sh
```

To run optimisation jobs:
```
redis-server &
cd src/backend && ./start-celery.sh &
```

Key hyperparameters can be specified under `advanced_options` in the project configuration JSON:

- `n_train`: number of training samples for the neural density estimator
- `epochs`: training epochs for the flow
- `bo_budget`: number of Bayesian optimisation iterations
- `M_test`: Monte Carlo samples when estimating EIG
- `gp_restarts`: restarts for GP hyperparameter optimisation

Pipeline overview:

1. `build_training_set` – draw `(\theta, d, y)` from the prior and generative model.
2. `train_flow` – train a normalising flow to approximate `p(\theta|y,d)`.
3. `optimize_design` – use Bayesian optimisation with a GP surrogate to maximise EIG.
4. `estimate_eig` – evaluate the best design with Monte Carlo samples.
5. Results saved to `result.json` with `optimalDesign` and `utilityValue`.

## Results Visualization

Running a job generates `result_detailed.json` containing:

```json
{
  "optimalDesign": {"x": 0.5},
  "utilityValue": 1.23,
  "evaluatedDesigns": [{"design": {"x":0.1}, "utility":0.5}, ...],
  "topDesigns": [...],
  "priorSamples": [ {"threshold":0.4, "slope":0.9}, ... ],
  "posteriorSamples": [ {"threshold":0.45, "slope":0.8}, ... ],
  "learningCurve": {
    "sessions": [1,2,...],
    "meanPerformance": [...],
    "ciLower": [...],
    "ciUpper": [...]
  }
}
```

Open `/projects/{pid}/jobs/{jid}/results` to view the basic result or `/results-detailed` for visualisation. The frontend uses `react-plotly.js` to render utility surfaces, histograms comparing prior and posterior, and predicted learning curves. Use the "View Results" button from the jobs table to open the page. A "Download CSV" option exports evaluated designs.

### Running tests

```
cd src/backend
pytest tests/test_eig_estimator.py
pytest tests/test_jobs_boed.py
```

Test the API with `/health`, `/api/auth/register`, and `/api/auth/login`.

## Frontend Setup

```
cd src/frontend
npm install
npm start
```

Ensure the backend API is running at http://localhost:8000/api.

Navigate to a project and click "Run Optimisation" to start a job and view results.
