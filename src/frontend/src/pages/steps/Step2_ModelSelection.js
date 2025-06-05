import React, { useEffect, useState } from "react";
import api from "../../api";
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
} from "@mui/material";

function Step2_ModelSelection({ config, setConfig, setStep }) {
  const { projectId } = useParams();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(config.model.templateName || "");
  const [customFile, setCustomFile] = useState(null);
  const [schema, setSchema] = useState(config.model.parameters || null);
  const [error, setError] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingSchema, setLoadingSchema] = useState(false);

  useEffect(() => {
    api
      .get("/templates")
      .then((res) => setTemplates(res.data))
      .catch(() => setError("Could not load templates"))
      .finally(() => setLoadingTemplates(false));
  }, []);

  const chooseBuiltIn = (e) => {
    const name = e.target.value;
    setSelectedTemplate(name);
    setCustomFile(null);
    setError("");
    setLoadingSchema(true);
    api
      .get(`/templates/${name}/schema`)
      .then((res) => {
        setSchema(res.data);
        setConfig((prev) => ({
          ...prev,
          model: { type: "built-in", templateName: name, parameters: res.data.parameters },
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
      setSchema(res.data.schema);
      setConfig((prev) => ({
        ...prev,
        model: { type: "custom", customFileName: customFile.name, parameters: res.data.schema.parameters },
      }));
    } catch {
      setError("Upload failed or invalid model file");
    } finally {
      setLoadingSchema(false);
    }
  };

  const onNext = () => {
    if (schema) setStep(3);
    else setError("Please select a template or upload a valid custom model");
  };

  return (
    <div>
      <h3>Choose Model</h3>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
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
          <pre>{JSON.stringify(schema, null, 2)}</pre>
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
