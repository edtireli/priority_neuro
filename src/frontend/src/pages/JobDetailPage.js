import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
  LinearProgress,
} from "@mui/material";
import api from "../api";

export default function JobDetailPage() {
  const { projectId, jobId } = useParams();
  const [job, setJob] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, jobId]);

  useEffect(() => {
    if (!job) return;
    if (["queued", "running", "paused_awaiting_data"].includes(job.status)) {
      const id = setInterval(fetchJob, 4000);
      return () => clearInterval(id);
    }
  }, [job]);

  useEffect(() => {
    if (!job) return;
    if (["succeeded", "failed"].includes(job.status)) {
      fetchMetrics();
      if (job.status === "succeeded") fetchResult();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

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

  const fetchResult = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/results`);
      setResult(res.data);
    } catch {}
  };

  const uploadPilot = async (file) => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("pilot_data", file);
    try {
      const res = await api.post(`/projects/${projectId}/jobs/${jobId}/data`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setJob(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setUploading(false);
    }
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

      {job.status === "running" && job.maxIterations && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress
            variant="determinate"
            value={(job.iteration / job.maxIterations) * 100}
          />
          <Typography sx={{ mt: 1 }}>
            {Math.round((job.iteration / job.maxIterations) * 100)}%
          </Typography>
        </Box>
      )}

      {job.status === "paused_awaiting_data" && (
        <Box sx={{ mt: 2 }}>
          <Typography>Awaiting pilot data upload</Typography>
          <Button
            component="label"
            variant="contained"
            sx={{ mt: 1 }}
            disabled={uploading}
          >
            Upload File
            <input
              type="file"
              accept=".csv"
              hidden
              onChange={(e) => uploadPilot(e.target.files[0])}
            />
          </Button>
        </Box>
      )}

      {["succeeded", "failed"].includes(job.status) && (
        <>
          {result && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6">Job Result</Typography>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </Box>
          )}
          {metrics && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6">Job Metrics</Typography>
              <pre>{JSON.stringify(metrics, null, 2)}</pre>
            </Box>
          )}
        </>
      )}

      {job.status === "failed" && (
        <Button sx={{ mt: 2 }} variant="contained" onClick={handleRetry}>
          Retry
        </Button>
      )}
    </Container>
  );
}
