from .learning_curve import LearningCurveModel

BUILT_IN_TEMPLATES = {
    "psychometric": {
        "description": "Sigmoid psychometric function: P(response|stimulus) = logistic((x - threshold)/slope)",
        "parameters": [
            {
                "name": "threshold",
                "type": "float",
                "default_prior": {"dist": "Normal", "mean": 0.5, "sd": 0.2},
            },
            {
                "name": "slope",
                "type": "float",
                "default_prior": {"dist": "Gamma", "shape": 2.0, "scale": 1.0},
            },
        ],
    },
    "poisson_rate": {
        "description": "Neural firing-rate model: spike counts \u223c Poisson(rate)",
        "parameters": [
            {
                "name": "rate_control",
                "type": "float",
                "default_prior": {"dist": "Gamma", "shape": 2.0, "scale": 1.0},
            },
            {
                "name": "rate_experimental",
                "type": "float",
                "default_prior": {"dist": "Gamma", "shape": 2.0, "scale": 1.0},
            },
        ],
    },
    "learning_curve": LearningCurveModel.parameter_schema(),
}


def list_templates():
    return list(BUILT_IN_TEMPLATES.keys())


def get_template_schema(name: str):
    return BUILT_IN_TEMPLATES.get(name)
