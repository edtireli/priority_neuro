import React, { useState } from "react";
import { TextField, Checkbox, FormControlLabel, Button, Grid, Box } from "@mui/material";

function Step8_MiscSettings({ config, setConfig, setStep }) {
  const [settings, setSettings] = useState(config.misc || {
    randomSeed: "",
    cpuCores: 4,
    gpuEnabled: false,
    notifyEmail: false,
    inAppNotify: false,
    highContrast: false,
    emailAddress: config.metadata?.contact_email || "",
    jobName: "",
  });

  const update = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const onNext = () => {
    if (settings.notifyEmail && !settings.emailAddress) {
      alert("Notification email required");
      return;
    }
    setConfig((prev) => ({ ...prev, misc: settings }));
    setStep(9);
  };

  return (
    <div>
      <h3>Additional Settings</h3>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6}>
          <TextField
            label="Random Seed"
            type="number"
            value={settings.randomSeed}
            onChange={(e) => update("randomSeed", e.target.value)}
            fullWidth
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            label="Number of CPU Cores"
            type="number"
            inputProps={{ min: 1, max: 16 }}
            value={settings.cpuCores}
            onChange={(e) => update("cpuCores", Number(e.target.value))}
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={<Checkbox checked={settings.gpuEnabled} onChange={(e) => update("gpuEnabled", e.target.checked)} />}
            label="Enable GPU Mode"
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={<Checkbox checked={settings.notifyEmail} onChange={(e) => update("notifyEmail", e.target.checked)} />}
            label="Notify By Email"
          />
        </Grid>
        {settings.notifyEmail && (
          <Grid item xs={12}>
            <TextField
              label="Notification Email"
              value={settings.emailAddress}
              onChange={(e) => update("emailAddress", e.target.value)}
              fullWidth
            />
          </Grid>
        )}
        <Grid item xs={12}>
          <FormControlLabel
            control={<Checkbox checked={settings.inAppNotify} onChange={(e) => update("inAppNotify", e.target.checked)} />}
            label="Enable In-App Notification"
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={<Checkbox checked={settings.highContrast} onChange={(e) => update("highContrast", e.target.checked)} />}
            label="High Contrast Mode"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Job Name (optional)"
            value={settings.jobName}
            onChange={(e) => update("jobName", e.target.value)}
            fullWidth
          />
        </Grid>
      </Grid>
      <Box display="flex" justifyContent="flex-end" gap={1}>
        <Button variant="contained" onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        <Button variant="contained" color="primary" onClick={onNext}>
          Next
        </Button>
      </Box>
    </div>
  );
}

export default Step8_MiscSettings;
