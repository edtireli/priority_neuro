import React, { useState } from "react";
import api from "../../api";
import { useNavigate } from "react-router-dom";
import { Button, Box, CircularProgress, Alert } from "@mui/material";

function Step7_ReviewSubmit({ config, projectId }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.put(`/projects/${projectId}/config`, config);
      navigate("/dashboard");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || "Failed to save configuration");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h3>Review Configuration</h3>
      <pre style={{ background: "#f0f0f0", padding: "1rem" }}>
        {JSON.stringify(config, null, 2)}
      </pre>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box display="flex" justifyContent="flex-end" gap={1}>
        <Button variant="contained" onClick={() => navigate("/dashboard")}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={submitting}
          startIcon={submitting && <CircularProgress size={20} />}
        >
          {submitting ? "Saving" : "Save Configuration"}
        </Button>
      </Box>
    </div>
  );
}

export default Step7_ReviewSubmit;
