# Configuring a Project

Start by following the instructions in [getting_started.md](getting_started.md) to install dependencies and run the application locally.

1. Create a project from the Dashboard.
2. After creation you will be redirected to `/projects/{id}/configure`.
3. Complete the wizard steps: metadata, model selection (choose built-in or upload custom), priors, design variables, objective, constraints.
4. Review the generated JSON and click **Save Configuration**.
5. Back on the dashboard the project row will show **Edit Configuration** which reopens the wizard with your saved values.

After launching optimisation the Jobs page lists past runs. Click **View Results** next to a completed job to open interactive plots comparing prior and posterior distributions and the utility surface.

Example result visualisations include utility curves for 1D designs and heatmaps for 2D designs. A learning curve plot appears when using the training_efficiency objective.
