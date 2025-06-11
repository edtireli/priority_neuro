from .learning_curve import LearningCurveModel
from .calcium_imaging import CalciumImagingModel

# Registry of built-in template model classes
template_registry = {
    "learning_curve": LearningCurveModel,
    "calcium_imaging": CalciumImagingModel,
}

__all__ = ["LearningCurveModel", "CalciumImagingModel", "template_registry"]
