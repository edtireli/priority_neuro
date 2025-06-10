import React, { useState, useEffect } from "react";
import {
  Typography,
  TextField,
  Grid,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
} from "@mui/material";

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
  const [dataSamples, setDataSamples] = useState(
    config.metadata.dataSamples || null
  );
  const [dataHeaders, setDataHeaders] = useState(
    config.metadata.dataHeaders || []
  );
  const [dataFileName, setDataFileName] = useState(
    config.metadata.dataFileName || ""
  );
  const [dataError, setDataError] = useState("");

  const parseCsv = (text) => {
    const rows = text
      .trim()
      .split(/[\r\n]+/)
      .map((r) => r.split(/[,\t]+/));
    if (rows.length === 0) return { headers: [], data: {} };
    let headers = rows[0];
    let start = 1;
    if (headers.every((v) => !isNaN(parseFloat(v)))) {
      headers = headers.map((_, i) => `col${i + 1}`);
      start = 0;
    }
    const data = {};
    headers.forEach((h) => (data[h] = []));
    for (let i = start; i < rows.length; i++) {
      rows[i].forEach((val, idx) => {
        const num = parseFloat(val);
        if (!isNaN(num)) data[headers[idx]].push(num);
      });
    }
    return { headers, data };
  };

  const handleDataUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (Object.keys(parsed.data).length === 0) {
        setDataError("No numeric columns found");
        return;
      }
      setDataSamples(parsed.data);
      setDataHeaders(parsed.headers);
      setDataFileName(file.name);
      setDataError("");
    } catch (err) {
      setDataError("Failed to parse file");
    }
  };

  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      metadata: {
        name,
        description,
        institution,
        contact_email: contact,
        data_modality: modality,
        dataSamples,
        dataHeaders,
        dataFileName,
      },
    }));
  }, [name, description, institution, contact, modality, dataSamples, dataHeaders, dataFileName, setConfig]);

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
        <Grid item xs={12}>
          <Button variant="outlined" component="label">
            Upload Data
            <input type="file" accept=".csv,.txt" hidden onChange={handleDataUpload} />
          </Button>
          {dataFileName && (
            <Typography variant="caption" sx={{ ml: 1 }}>
              {dataFileName}
            </Typography>
          )}
          {dataError && (
            <Typography color="error" variant="body2">
              {dataError}
            </Typography>
          )}
        </Grid>
      </Grid>
      {/* Navigation handled by WizardNav */}
    </div>
  );
}

export default Step1_Metadata;
