import React from "react";
import { useForm, Controller } from "react-hook-form";
import { TextField, Button, Grid, Box } from "@mui/material";

function Step4_Priors({ config, setConfig, setStep }) {
  const parameters = config.model.parameters || [];
  const defaultValues = parameters.reduce((acc, param) => {
    acc[param.name] = JSON.stringify(
      config.priors[param.name] || param.default_prior
    );
    return acc;
  }, {});
  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm({ defaultValues });

  const onSubmit = (data) => {
    const parsed = {};
    for (const [key, val] of Object.entries(data)) {
      try {
        parsed[key] = JSON.parse(val);
      } catch (err) {
        setError(key, { type: "manual", message: err.message });
        return;
      }
    }
    setConfig((prev) => ({ ...prev, priors: parsed }));
    setStep(5);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h3>Specify Priors</h3>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {parameters.map((param) => (
          <Grid item xs={12} key={param.name}>
            <Controller
              name={param.name}
              control={control}
              rules={{
                required: "Required",
                validate: (v) => {
                  try {
                    JSON.parse(v);
                    return true;
                  } catch (e) {
                    return `Invalid JSON: ${e.message}`;
                  }
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={`${param.name} (${param.type})`}
                  placeholder={JSON.stringify(param.default_prior)}
                  error={!!errors[param.name]}
                  helperText={errors[param.name]?.message || "Enter JSON for prior"}
                  onFocus={() => clearErrors(param.name)}
                />
              )}
            />
          </Grid>
        ))}
      </Grid>
      <Box display="flex" justifyContent="flex-end" gap={1}>
        <Button variant="contained" onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        <Button variant="contained" color="primary" type="submit">
          Next
        </Button>
      </Box>
    </form>
  );
}

export default Step4_Priors;
