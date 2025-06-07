import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";
import api from "../api";

export default function JobDetailPage() {
  const { projectId, jobId } = useParams();
  const [job, setJob] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJob();
    const id = setInterval(fetchMetrics, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, jobId]);

  const fetchJob = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/status`);
      setJob(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/metrics`);
      setMetrics(res.data);
    } catch {}
  };

  const handleRetry = async () => {
    try {
      await api.post(`/projects/${projectId}/jobs/${jobId}/retry`);
      fetchJob();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  if (!job)
    return (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    );

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>
        Job {job.id}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Typography>Status: {job.status}</Typography>
      {job.status === "failed" && (
        <Button sx={{ mt: 2 }} variant="contained" onClick={handleRetry}>
          Retry
        </Button>
      )}
      {metrics && metrics.loss && metrics.loss.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6">Training Loss</Typography>
          <pre>{JSON.stringify(metrics, null, 2)}</pre>
        </Box>
      )}
    </Container>
  );
}
