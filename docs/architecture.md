# Frontend Overview

# Backend Overview

# Directory Structure

## Project Configuration

Built-in generative-model templates live in `src/backend/models/templates.py`. Two example templates (`psychometric` and `poisson_rate`) expose parameter schemas with default prior hyperparameters.

API endpoints for interacting with templates are provided by `routers/templates.py`:

* `GET /api/templates` – list available built-in template names
* `GET /api/templates/{name}/schema` – fetch schema for a built-in template
* `POST /api/templates/upload` – upload a custom Python model file containing `parameter_schema()` which returns a schema

Projects store their wizard configuration JSON in the `config_json` column. Endpoints:

* `GET /api/projects/{project_id}/config` – retrieve current configuration
* `PUT /api/projects/{project_id}/config` – save configuration

The frontend exposes a wizard at `/projects/:projectId/configure` implemented in React. It loads existing configuration, walks through seven steps (metadata, model selection, priors, design variables, objective, constraints, review) and saves the final JSON via the above endpoints.
