import React from "react";
import { useForm, Controller } from "react-hook-form";

function Step3_Priors({ config, setConfig, setStep }) {
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
      } catch {
        setError(key, { type: "manual", message: "Invalid JSON" });
        return;
      }
    }
    setConfig((prev) => ({ ...prev, priors: parsed }));
    setStep(4);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h3>Specify Priors</h3>
      {parameters.map((param) => (
        <div key={param.name} style={{ marginBottom: "1rem" }}>
          <label>
            {param.name} ({param.type})
          </label>
          <Controller
            name={param.name}
            control={control}
            rules={{
              required: "Required",
              validate: (v) => {
                try {
                  JSON.parse(v);
                  return true;
                } catch {
                  return "Invalid JSON";
                }
              },
            }}
            render={({ field }) => (
              <input {...field} placeholder={JSON.stringify(param.default_prior)} />
            )}
          />
          {errors[param.name] && (
            <p style={{ color: "red" }}>{errors[param.name].message}</p>
          )}
          <small>
            Enter JSON for prior (e.g., {"{"}"dist":"Normal","mean":0.5,"sd":0.2"{"}"})
          </small>
        </div>
      ))}
      <button type="button" onClick={() => setStep((s) => s - 1)}>
        Back
      </button>
      <button type="submit">Next</button>
    </form>
  );
}

export default Step3_Priors;
