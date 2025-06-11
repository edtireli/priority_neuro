import os
import uuid
import importlib.util
from typing import Any

from models.expressions import PsychometricModel, PoissonRateModel
from template_models import CalciumImagingModel

UPLOADS_ROOT = os.getenv("UPLOADS_ROOT", "uploads")


def load_model(model_cfg: dict, job_id: uuid.UUID) -> Any:
    """Instantiate a model object based on the configuration."""

    if not model_cfg or not model_cfg.get("type"):

        class Dummy:
            def simulate(self, theta, design):
                return 0.0

            def log_likelihood(self, data, theta, design):
                return 0.0

        return Dummy()

    parameters = model_cfg.get("parameters", [])
    design_name = model_cfg.get("designName", "x")

    if model_cfg.get("type") == "built-in":
        template = model_cfg.get("templateName")
        if template == "psychometric":
            return PsychometricModel(parameters, design_name=design_name)
        if template == "calcium_imaging":
            return CalciumImagingModel()
        else:
            return PoissonRateModel(parameters, design_name=design_name)

    # Custom model
    file_name = model_cfg.get("customFileName")
    if not file_name:
        raise ValueError("customFileName missing for custom model")

    model_path = os.path.join(UPLOADS_ROOT, "custom_models", str(job_id), file_name)
    spec = importlib.util.spec_from_file_location("custom_model", model_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    if hasattr(module, "Model"):
        return module.Model(parameters)

    class WrappedModel:
        def __init__(self, mod):
            self.mod = mod

        def simulate(self, theta, design):
            return self.mod.simulate(theta, design)

        def log_likelihood(self, data, theta, design):
            return self.mod.log_likelihood(data, theta, design)

    return WrappedModel(module)
