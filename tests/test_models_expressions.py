import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))
from models.expressions import PsychometricModel, PoissonRateModel, BernoulliModel

def test_psychometric_sim_and_ll():
    model = PsychometricModel(parameter_specs=[{"name":"threshold"},{"name":"slope"}])
    theta = {"threshold":0.5, "slope":0.2}
    design = {"x":0.6}
    y = model.simulate(theta, design)
    model.log_likelihood(y, theta, design)

def test_poisson_sim_and_ll():
    model = PoissonRateModel(parameter_specs=[{"name":"rate_control"},{"name":"rate_experimental"}])
    theta = {"rate_control":5.0, "rate_experimental":8.0}
    design = {"condition":"control"}
    y = model.simulate(theta, design)
    model.log_likelihood(y, theta, design)

def test_bernoulli_sim_and_ll():
    model = BernoulliModel(parameter_specs=[{"name":"p"}])
    theta = {"p":0.7}
    design = {}
    y = model.simulate(theta, design)
    model.log_likelihood(y, theta, design)
