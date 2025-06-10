# Configuring a Project

Start by following the instructions in [getting_started.md](getting_started.md) to install dependencies and run the application locally.

1. Create a project from the Dashboard.
2. After creation you will be redirected to `/projects/{id}/configure`.
3. Complete the wizard steps: metadata, model selection (choose built-in or upload custom), priors, design variables, objective, constraints.
4. Review the generated JSON and click **Save Configuration**.
5. Back on the dashboard the project row will show **Edit Configuration** which reopens the wizard with your saved values.

After launching optimisation the Jobs page lists past runs. Click **View Results** next to a completed job to open interactive plots comparing prior and posterior distributions and the utility surface.

Example result visualisations include utility curves for 1D designs and heatmaps for 2D designs. A learning curve plot appears when using the training_efficiency objective.

## Estimating EIG with Control Variates

The Python API exposes `estimate_eig` for computing expected information gain. By default it uses plain Monte Carlo sampling:

```python
eig, se = estimate_eig(priors, design, model, N=1000)
```

Passing `use_control_variates=True` activates a control variate based on the prior predictive log-likelihood which can dramatically reduce estimator variance:

```python
eig, se, N_used = estimate_eig(
    priors,
    design,
    model,
    N=1000,
    use_control_variates=True,
    beta=0.5,
    use_antithetic=True,
    sampling_method="QMC",
    ci_threshold=0.01,
    N_max=5000,
    use_optimal_beta=True,
    random_seed=42,
)
print(f"EIG = {eig:.3f} ± {se:.3f} (N={N_used})")
```

The returned standard error allows plotting error bars in the web interface.  
When `ci_threshold` is provided the estimator adaptively increases the number of
samples until the relative error falls below the threshold or `N_max` is
reached.  Antithetic variates and Sobol QMC sampling can further improve
efficiency.  Setting `use_optimal_beta=True` estimates the optimal control
variate coefficient automatically.
