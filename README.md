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

Test the API with `/health`, `/api/auth/register`, and `/api/auth/login`.
