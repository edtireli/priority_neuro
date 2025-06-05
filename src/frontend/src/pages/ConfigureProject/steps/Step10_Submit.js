import React, { useState } from "react";
import api from "../../../api";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Box, CircularProgress, Alert } from "@mui/material";

function Step10_Submit({ config }) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(`/projects/${projectId}/jobs`, config);
      const jobId = res.data.job_id;
      alert(`Job ${jobId} submitted successfully`);
      navigate(`/projects/${projectId}/jobs`);
    } catch (err) {
      const detail = err.response?.data?.detail || "Server error";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h3>Submit Job</h3>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
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
