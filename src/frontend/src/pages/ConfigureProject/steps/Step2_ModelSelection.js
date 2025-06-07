import React, { useEffect, useState } from "react";
import api from "../../../api";
import { useParams } from "react-router-dom";
import {
  TextField,
  Button,
  Grid,
  Box,
  Select,
  MenuItem,
  FormHelperText,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
} from "@mui/material";

function Step2_ModelSelection({ config, setConfig, setStep }) {
  const { projectId } = useParams();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(
    config.model.templateName || "",
  );
  const [customFile, setCustomFile] = useState(null);
  const [schema, setSchema] = useState(config.model.parameters || null);
  const [dvChoices, setDvChoices] = useState(config.model.dependentVariables || []);
  const [dvs, setDvs] = useState(config.model.dependentVariables || []);
  const [error, setError] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingSchema, setLoadingSchema] = useState(false);

  useEffect(() => {
    api
      .get("/templates")
      .then((res) => setTemplates(res.data))
      .catch(() => setError("Could not load templates"))
      .finally(() => setLoadingTemplates(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const templateOutcomes = {
    psychometric: ["Choice", "Reaction Time"],
    "drift-diffusion rt-accuracy model": ["Choice", "Reaction Time"],
    "poisson rate model": ["Spike Count", "Firing Rate"],
    "gaussian process calcium model": [
      "ΔF/F trace",
      "Peak Amplitude",
      "Time to Peak",
    ],
    "hybrid psychometric/poisson": ["Choice", "Spike Count"],
  };

  const formatPrior = (prior) => {
    if (!prior) return "";
    if (prior.dist === "Normal") {
      return `Normal(μ=${prior.mean},σ=${prior.sd})`;
    }
    if (prior.dist === "Gamma") {
      return `Gamma(shape=${prior.shape},scale=${prior.scale})`;
    }
    if (prior.dist === "Beta") {
      return `Beta(α=${prior.alpha},β=${prior.beta})`;
    }
    return prior.dist;
  };

  const chooseBuiltIn = (e) => {
    const name = e.target.value;
    setSelectedTemplate(name);
    setCustomFile(null);
    setError("");
    setLoadingSchema(true);
    api
      .get(`/templates/${name}/schema`)
      .then((res) => {
        const lookup =
          templateOutcomes[name] || templateOutcomes[name.toLowerCase()] || [];
        const schemaData = res.data.schema || res.data;
        setSchema(schemaData);
        setDvChoices(lookup);
        setDvs(lookup);
        setConfig((prev) => ({
          ...prev,
          model: {
            type: "built-in",
            templateName: name,
            parameters: schemaData.parameters,
          },
        }));
      })
      .catch(() => setError("Could not fetch template schema"))
      .finally(() => setLoadingSchema(false));
  };

  const uploadCustom = (e) => {
    setCustomFile(e.target.files[0]);
    setSelectedTemplate("");
    setSchema(null);
    setError("");
  };

  const submitCustom = async () => {
    if (!customFile) return setError("Please select a Python file");
    const form = new FormData();
    form.append("file", customFile);
    form.append("project_id", projectId);
    setLoadingSchema(true);
    try {
      const res = await api.post("/templates/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const schemaData = res.data.schema;
      setSchema(schemaData);
      setDvChoices([]);
      setDvs([]);
      setConfig((prev) => ({
        ...prev,
        model: {
          type: "custom",
          customFileName: customFile.name,
          parameters: schemaData.parameters,
        },
      }));
  } catch {
      setError("Upload failed or invalid model file");
    } finally {
      setLoadingSchema(false);
    }
  };

  const handleDvChange = (dv, checked) => {
    setDvs((prev) => {
      if (checked) {
        return prev.includes(dv) ? prev : [...prev, dv];
      }
      return prev.filter((x) => x !== dv);
    });
  };

  const onNext = () => {
    if (!schema) {
      setError("Please select a template or upload a valid custom model");
      return;
    }
    if (dvs.length === 0) {
      setError("Select at least one outcome variable");
      return;
    }
    setConfig((prev) => ({
      ...prev,
      model: { ...prev.model, dependentVariables: dvs },
    }));
    setStep(3);
  };

  return (
    <div>
      <Typography sx={{ mb: 2 }}>
        Step 2: Choose your computational model. You may pick one of our built-in
        templates or upload your own Python model file. Built-ins include schema
        and default priors; custom models must implement a get_schema() function
        that returns name, description, parameters.
      </Typography>
      <h3>Choose Model</h3>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {loadingTemplates ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={6}>
            <Select
              fullWidth
              value={selectedTemplate}
              displayEmpty
              onChange={chooseBuiltIn}
            >
              <MenuItem value="">
                <em>-- Select a template --</em>
              </MenuItem>
              {templates.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Built-in Templates</FormHelperText>
          </Grid>
          <Grid item xs={12} md={6}>
            <Button variant="outlined" component="label">
              Upload Custom Model
              <input type="file" accept=".py" hidden onChange={uploadCustom} />
            </Button>
            <Button onClick={submitCustom} sx={{ ml: 1 }} variant="contained">
              Upload & Validate
            </Button>
          </Grid>
        </Grid>
      )}
      {loadingSchema && (
        <Box display="flex" justifyContent="center" my={2}>
          <CircularProgress />
        </Box>
      )}
      {schema && (
        <Box my={2}>
          {schema.description && (
            <Typography sx={{ mb: 1 }}>{schema.description}</Typography>
          )}
          <TableContainer component={Paper} sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Parameter</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Default Prior</TableCell>
                  <TableCell>Description</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schema.parameters.map((param) => (
                  <TableRow key={param.name}>
                    <TableCell>{param.name}</TableCell>
                    <TableCell>{param.type}</TableCell>
                    <TableCell>{formatPrior(param.default_prior)}</TableCell>
                    <TableCell>{param.description || "\u2013"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography sx={{ mb: 1 }}>
            Select one or more outcome measures that will be optimized.
          </Typography>
          {dvChoices.length === 0 ? (
            <Typography>
              No outcome variables defined. You can add them now or in the
              Priors step.
            </Typography>
          ) : (
            <Box>
              {dvChoices.map((dv) => (
                <FormControlLabel
                  key={dv}
                  control={
                    <Checkbox
                      checked={dvs.includes(dv)}
                      onChange={(e) => handleDvChange(dv, e.target.checked)}
                    />
                  }
                  label={dv}
                />
              ))}
            </Box>
          )}
        </Box>
      )}
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

export default Step2_ModelSelection;
