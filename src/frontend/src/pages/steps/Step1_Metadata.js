import React from "react";
import { useForm } from "react-hook-form";
import { TextField, Button, Grid, Box } from "@mui/material";

function Step1_Metadata({ config, setConfig, setStep }) {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: config.metadata.name || "",
      description: config.metadata.description || "",
    },
  });

  const onSubmit = (data) => {
    setConfig((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, name: data.name, description: data.description },
    }));
    setStep(2);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12}>
          <TextField
            label="Project Name"
            required
            fullWidth
            {...register("name", { required: true })}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Description"
            multiline
            rows={3}
            fullWidth
            {...register("description")}
          />
        </Grid>
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

export default Step1_Metadata;
