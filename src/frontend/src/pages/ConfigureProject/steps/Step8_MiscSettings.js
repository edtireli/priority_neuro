import React, { useState, useEffect } from "react";
import { Typography, TextField, Checkbox, FormControlLabel, Button, Grid, Box } from "@mui/material";

function Step8_MiscSettings({ config, setConfig }) {
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

  useEffect(() => {
    if (settings.notifyEmail && !settings.emailAddress) return;
    setConfig((prev) => ({ ...prev, misc: settings }));
  }, [settings, setConfig]);

  return (
    <div>
      <h3>Additional Settings</h3>
      <Typography sx={{ mb: 2 }}>
        Step 8: Configure miscellaneous settings. Example: enable GPU mode and
        email notifications.
      </Typography>
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
            value={settings.jobName || ""}
            onChange={(e) => update("jobName", e.target.value)}
            fullWidth
          />
        </Grid>
      </Grid>
      {/* Navigation handled by WizardNav */}
    </div>
  );
}

export default Step8_MiscSettings;
