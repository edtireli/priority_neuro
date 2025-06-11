# Frontend Overview

# Backend Overview

# Directory Structure

## Project Configuration

Built-in generative-model templates live in `src/backend/models/templates.py` and `src/backend/template_models`. Templates include `psychometric`, `poisson_rate`, `learning_curve` and `calcium_imaging`, each exposing a parameter schema with default priors.

API endpoints for interacting with templates are provided by `routers/templates.py`:

* `GET /api/templates` – list available built-in template names
* `GET /api/templates/{name}/schema` – fetch schema for a built-in template
* `POST /api/templates/upload` – upload a custom Python model file containing `parameter_schema()` which returns a schema

Projects store their wizard configuration JSON in the `config_json` column. Endpoints:

* `GET /api/projects/{project_id}/config` – retrieve current configuration
* `PUT /api/projects/{project_id}/config` – save configuration

The `ObjectiveConfig` schema includes a `simulateOnly` flag for sequence optimisation jobs. When enabled the backend generates synthetic data from a specified template (e.g. `learning_curve`) instead of requiring uploaded trial data.

Projects using the `calcium_imaging` template may specify a `calciumData` object with fields `path` and `format` ("NWB" or "TIFF") describing where the imaging data lives.

The frontend exposes a wizard at `/projects/:projectId/configure` implemented in React. It loads existing configuration, walks through seven steps (metadata, model selection, priors, design variables, objective, constraints, review) and saves the final JSON via the above endpoints.
