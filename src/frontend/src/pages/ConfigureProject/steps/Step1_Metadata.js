import React, { useState, useEffect } from "react";
import { Typography, TextField, Grid, RadioGroup, FormControlLabel, Radio } from "@mui/material";

function Step1_Metadata({ config, setConfig }) {
  const [name, setName] = useState(config.metadata.name || "");
  const [description, setDescription] = useState(
    config.metadata.description || ""
  );
  const [institution, setInstitution] = useState(
    config.metadata.institution || ""
  );
  const [contact, setContact] = useState(config.metadata.contact_email || "");
  const [modality, setModality] = useState(
    config.metadata.data_modality || ""
  );

  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      metadata: {
        name,
        description,
        institution,
        contact_email: contact,
        data_modality: modality,
      },
    }));
  }, [name, description, institution, contact, modality, setConfig]);

  return (
    <div>
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
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Description"
            multiline
            rows={3}
            fullWidth
            inputProps={{ maxLength: 500 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Institution/Lab"
            fullWidth
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Contact Email"
            fullWidth
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </Grid>
        <Grid item xs={12}>
          <RadioGroup
            row
            value={modality}
            onChange={(e) => setModality(e.target.value)}
          >
            <FormControlLabel
              value="behavioural"
              control={<Radio />}
              label="Behavioural"
            />
            <FormControlLabel
              value="physiological"
              control={<Radio />}
              label="Physiological"
            />
            <FormControlLabel
              value="combined"
              control={<Radio />}
              label="Combined"
            />
          </RadioGroup>
        </Grid>
      </Grid>
      {/* Navigation handled by WizardNav */}
    </div>
  );
}

export default Step1_Metadata;
