import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from "@mui/material";
import api from "../../api";
import WizardNav from "../../components/WizardNav";
import Step1_Metadata from "./steps/Step1_Metadata";
import Step2_ModelSelection from "./steps/Step2_ModelSelection";
import Step3_Groups from "./steps/Step3_Groups";
import Step4_DesignVariables from "./steps/Step4_DesignVariables";
import Step5_Priors from "./steps/Step5_Priors";
import Step6_Objective from "./steps/Step6_Objective";
import Step6b_SequenceSettings from "./steps/Step6b_SequenceSettings";
import Step7_Constraints from "./steps/Step7_Constraints";
import Step8_MiscSettings from "./steps/Step8_MiscSettings";
import Step9_Review from "./steps/Step9_Review";
import Step10_Submit from "./steps/Step10_Submit";
import ErrorBoundary from "../../components/ErrorBoundary";

function ProjectWizard() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [step, setStep] = useState(1);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");

  useEffect(() => {
    api
      .get(`/projects/${projectId}/config`)
      .then((res) => {
        if (res.data.config) setConfig(res.data.config);
        else
          setConfig({
            metadata: {},
            model: {},
            groups: [],
            priors: {},
            designVariables: [],
            objective: {},
            constraints: {
              sampleSize: null,
              trialLimit: null,
              costWeights: { subject: 1, trial: 1, session: 1 },
            },
            misc: {},
          });
      })
      .catch(() => navigate("/dashboard"))
      .finally(() => setLoading(false));
  }, [projectId, navigate]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      setImportText(text);
    } catch (err) {
      setImportError("Failed to read file");
    }
  };

  const handleValidateLoad = () => {
    try {
      const parsed = JSON.parse(importText);
      const required = [
        "metadata",
        "model",
        "groups",
        "priors",
        "designVariables",
        "objective",
        "constraints",
        "misc",
        "trialBudget",
        "experimentalMode",
      ];
      for (const key of required) {
        if (!(key in parsed)) {
          throw new Error(`Missing key '${key}'`);
        }
      }
      setConfig(parsed);
      setImportModalOpen(false);
      setImportError("");
      setStep(10);
    } catch (err) {
      setImportError(err.message);
    }
  };

  const handleCancel = () => {
    setImportError("");
    setImportModalOpen(false);
  };

  if (loading || !config) return <p>Loading wizard…</p>;

  return (
    <ErrorBoundary fallback={<Alert severity="error">Wizard crashed.</Alert>}>
      <Container
        maxWidth="md"
        sx={{
          py: 4,
          backgroundColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(0,0,0,0.6)"
              : "rgba(255,255,255,0.8)",
          borderRadius: 2,
          p: 3,
          border: "1px solid rgba(0,0,0,0.5)",
        }}
      >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Configure Project</Typography>
        <Button variant="outlined" onClick={() => setImportModalOpen(true)}>
          Import JSON
        </Button>
      </Box>
      <WizardNav step={step} setStep={setStep} />
      <Card sx={{ p: 2 }}>
        <CardContent>
          {step === 1 && (
            <Step1_Metadata config={config} setConfig={setConfig} setStep={setStep} />
          )}
          {step === 2 && (
            <Step2_ModelSelection config={config} setConfig={setConfig} />
          )}
          {step === 3 && (
            <Step3_Groups config={config} setConfig={setConfig} />
          )}
          {step === 4 && (
            <Step4_DesignVariables config={config} setConfig={setConfig} />
          )}
          {step === 5 && (
            <Step5_Priors config={config} setConfig={setConfig} />
          )}
          {step === 6 && (
            <Step6_Objective config={config} setConfig={setConfig} />
          )}
          {step === 7 && (
            <Step6b_SequenceSettings config={config} setConfig={setConfig} />
          )}
          {step === 8 && (
            <Step7_Constraints config={config} setConfig={setConfig} />
          )}
          {step === 9 && (
            <Step8_MiscSettings config={config} setConfig={setConfig} />
          )}
      {step === 10 && <Step9_Review config={config} setStep={setStep} />}
      {step === 11 && <Step10_Submit config={config} />}
      </CardContent>
      </Card>

      <Dialog open={importModalOpen} onClose={handleCancel} maxWidth="sm" fullWidth>
        <DialogTitle>Import Configuration JSON</DialogTitle>
        <DialogContent>
          <TextField
            label="Configuration JSON"
            multiline
            fullWidth
            minRows={6}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            variant="filled"
            sx={{ mt: 1, backgroundColor: "rgba(0,0,0,0.3)" }}
            InputProps={{ style: { color: "#fff" } }}
            InputLabelProps={{ style: { color: "#fff" } }}
          />
          <Box sx={{ mt: 2 }}>
            <Button variant="outlined" component="label">
              Choose file
              <input type="file" accept=".json" hidden onChange={handleFileChange} />
            </Button>
          </Box>
          {importError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {importError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button variant="contained" onClick={handleValidateLoad}>
            Validate &amp; Load
          </Button>
        </DialogActions>
      </Dialog>
      </Container>
    </ErrorBoundary>
  );
}

export default ProjectWizard;
