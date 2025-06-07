import React from "react";
import { useForm } from "react-hook-form";
import { Typography, TextField, Button, Grid, Box, RadioGroup, FormControlLabel, Radio } from "@mui/material";

function Step1_Metadata({ config, setConfig, setStep }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: config.metadata.name || "",
      description: config.metadata.description || "",
      institution: config.metadata.institution || "",
      contact_email: config.metadata.contact_email || "",
      modality: config.metadata.data_modality || "",
    },
  });

  const onSubmit = (data) => {
    setConfig((prev) => ({
      ...prev,
      metadata: {
        name: data.name,
        description: data.description,
        institution: data.institution,
        contact_email: data.contact_email,
        data_modality: data.modality,
      },
    }));
    setStep(2);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h3>Project Metadata</h3>
      <Typography sx={{ mb: 2 }}>
        Step 1: Enter project metadata.'.
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12}>
          <TextField
            label="Project Name"
            required
            fullWidth
            inputProps={{ maxLength: 100 }}
            {...register("name", {
              required: "Project name is required",
              maxLength: { value: 100, message: "Max length is 100" },
            })}
            error={!!errors.name}
            helperText={errors.name?.message}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Description"
            multiline
            rows={3}
            fullWidth
            inputProps={{ maxLength: 500 }}
            {...register("description", {
              maxLength: {
                value: 500,
                message: "Maximum length 500 characters",
              },
            })}
            error={!!errors.description}
            helperText={errors.description?.message}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField label="Institution/Lab" fullWidth {...register("institution")}/>
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Contact Email"
            fullWidth
            {...register("contact_email", {
              pattern: { value: /.+@.+\..+/, message: "Invalid email" },
            })}
            error={!!errors.contact_email}
            helperText={errors.contact_email?.message}
          />
        </Grid>
        <Grid item xs={12}>
          <RadioGroup row {...register("modality", { required: true })}>
            <FormControlLabel value="behavioural" control={<Radio />} label="Behavioural" />
            <FormControlLabel value="physiological" control={<Radio />} label="Physiological" />
            <FormControlLabel value="combined" control={<Radio />} label="Combined" />
          </RadioGroup>
        </Grid>
      </Grid>
      {/* Navigation handled by WizardNav */}
    </form>
  );
}

export default Step1_Metadata;
