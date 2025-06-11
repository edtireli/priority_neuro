from .learning_curve import LearningCurveModel

# Registry of built-in template model classes
template_registry = {
    "learning_curve": LearningCurveModel,
}

__all__ = ["LearningCurveModel", "template_registry"]
