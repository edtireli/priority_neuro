import React, { useState } from "react";
import api from "../../../api";
import { useNavigate, useParams } from "react-router-dom";
import { Typography, Button, Box, CircularProgress, Alert } from "@mui/material";
import stringifyError from "../../../utils/stringifyError";

function Step10_Submit({ config }) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const cfg = {
        metadata: config.metadata,
        model: config.model,
        groups: config.groups,
        priors: config.priors,
        designVariables: config.designVariables,
        objective: config.objective,
        constraints: config.constraints,
        misc: config.misc,
        trialBudget: config.trialBudget,
        experimentalMode: config.experimentalMode,
        ...(config.sequentialSettings && {
          sequentialSettings: {
            batchSize: config.sequentialSettings.batchSize,
            maxIter: config.sequentialSettings.maxIter,
          },
        }),
      };

      if (config.misc?.gpuEnabled) cfg.computeType = "gpu";

      const form = new FormData();
      form.append("config", JSON.stringify(cfg));
      if (config.sequentialSettings?.pilotFile) {
        form.append("pilot_data", config.sequentialSettings.pilotFile);
      }
      if (config.customModelFile) {
        form.append("custom_model", config.customModelFile);
      }

      const res = await api.post(`/projects/${projectId}/jobs/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const jobId = res.data.job_id || res.data.id;
      alert(`Job ${jobId} submitted successfully`);
      navigate(`/projects/${projectId}/jobs`); // redirect to job list
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h3>Submit Job</h3>
      <Typography sx={{ mb: 2 }}>
        Step 10: Submit your configuration for optimization. Example: click
        "Run Optimization" to launch the job.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {stringifyError(error)}
        </Alert>
      )}
      <Box display="flex" justifyContent="flex-end" gap={1}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={submitting}
          startIcon={submitting && <CircularProgress size={20} />}
        >
          {submitting ? "Submitting" : "Run Optimization"}
        </Button>
      </Box>
    </div>
  );
}

export default Step10_Submit;
