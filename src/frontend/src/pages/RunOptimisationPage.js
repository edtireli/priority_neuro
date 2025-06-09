import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Select,
  MenuItem,
  Chip,
} from "@mui/material";
import api from "../api";
import stringifyError from "../utils/stringifyError";

export default function RunOptimisationPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState(null);
  const [loadingError, setLoadingError] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [config, setConfig] = useState(null);
  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState({});
  const [uploadError, setUploadError] = useState({});


  // fetch jobs
  const fetchJobs = async (arch = false) => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs`, { params: { archived: arch } });
      const list = res.data.jobs || res.data;
      setJobs(list);
      setLoadingError("");
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setLoadingError(detail);
    }
  };

  useEffect(() => {
    fetchJobs(filter === "archived");
    api.get(`/projects/${projectId}/config`).then((res) => setConfig(res.data.config));
    const id = setInterval(() => fetchJobs(filter === "archived"), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filter]);

  const handleStart = () => {
    setStarting(true);
    setStartError("");
    const form = new FormData();
    form.append("config", JSON.stringify(config));
    if (config?.sequentialSettings?.pilotFile) {
      form.append("pilot_data", config.sequentialSettings.pilotFile);
    }
    if (config?.customModelFile) {
      form.append("custom_model", config.customModelFile);
    }
    api
      .post(`/projects/${projectId}/jobs/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then(() => navigate(`/projects/${projectId}/jobs`)) // redirect to job list
      .catch((err) => {
        const detail = err.response?.status === 422 ? err.response.data.detail : err;
        setStartError(detail);
      })
      .finally(() => {
        setStarting(false);
      });
  };

  const uploadPilot = async (jobId, file) => {
    setUploading((p) => ({ ...p, [jobId]: true }));
    setUploadError((p) => ({ ...p, [jobId]: "" }));
    const form = new FormData();
    form.append("pilot_data", file);
    try {
      const res = await api.post(`/projects/${projectId}/jobs/${jobId}/data`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setJobs((prev) => prev.map((j) => (j.id === jobId ? res.data : j)));
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setUploadError((p) => ({ ...p, [jobId]: detail }));
    } finally {
      setUploading((p) => ({ ...p, [jobId]: false }));
    }
  };

  const archiveJob = async (jobId) => {
    try {
      await api.post(`/projects/${projectId}/jobs/${jobId}/archive`);
      fetchJobs(filter === "archived");
    } catch (err) {
      console.error(err);
    }
  };

  const visibleJobs = jobs?.filter((j) => {
    if (filter === "all" || filter === "archived") return true;
    if (filter === "running") return j.status === "running" || j.status === "queued";
    if (filter === "completed") return j.status === "succeeded";
    if (filter === "failed") return j.status === "failed";
    return true;
  });

  return (
    <Container
      sx={{
        py: 4,
        backgroundColor: (theme) =>
          theme.palette.mode === "dark"
            ? "rgba(0,0,0,0.6)"
            : "rgba(255,255,255,0.8)",
        borderRadius: 2,
        p: 3,
      }}
    >
      <Typography variant="h4" gutterBottom>
          Run Optimization
        </Typography>
        <Typography variant="body1" gutterBottom>
          View and manage your BOED jobs for this project. Start a new optimization run or monitor existing ones.
        </Typography>
          <Box mb={2} display="flex" gap={2} alignItems="center">
            <Button
              variant="contained"
              onClick={handleStart}
              disabled={starting}
              startIcon={starting ? <CircularProgress size={20} /> : null}
            >
              Start New Optimization
            </Button>
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} size="small">
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="running">Running</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </Box>
      {jobs && jobs.some((j) => j.status === "paused_awaiting_data") && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {jobs.filter((j) => j.status === "paused_awaiting_data").length} job is paused awaiting your pilot data upload.
        </Alert>
      )}
      {startError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {stringifyError(startError)}
        </Alert>
      )}
      {jobs === null ? (
        <Box display="flex" justifyContent="center" my={4}>
          {loadingError ? (
            <Alert severity="error">{stringifyError(loadingError)}</Alert>
          ) : (
            <CircularProgress />
          )}
        </Box>
      ) : visibleJobs.length === 0 ? (
        <Typography>
          {filter === "archived" ? "No archived jobs." : "No jobs yet. Click “Start New Optimization” to begin."}
        </Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Job ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Submitted At</TableCell>
                <TableCell>Started At</TableCell>
                <TableCell>Completed At</TableCell>
                <TableCell>Iteration</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>{job.id}</TableCell>
                  <TableCell>
                    <Chip
                      label={job.status}
                      color={
                        job.status === "succeeded"
                          ? "success"
                          : job.status === "failed"
                          ? "error"
                          : job.status === "paused_awaiting_data"
                          ? "info"
                          : "warning"
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{job.submitted_at ? new Date(job.submitted_at).toLocaleString() : "-"}</TableCell>
                  <TableCell>{job.started_at ? new Date(job.started_at).toLocaleString() : "-"}</TableCell>
                  <TableCell>{job.completed_at ? new Date(job.completed_at).toLocaleString() : "-"}</TableCell>
                  <TableCell>{job.iteration ?? "-"}</TableCell>
                  <TableCell>
                    {job.status === "paused_awaiting_data" ? (
                      <Box component="span" display="flex" alignItems="center" gap={1}>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => uploadPilot(job.id, e.target.files[0])}
                          disabled={uploading[job.id]}
                        />
                        {Array.isArray(config?.model?.dependentVariables) && (
                          <Typography variant="caption" sx={{ ml: 1 }}>
                            Required columns: {config.model.dependentVariables.join(', ')}
                          </Typography>
                        )}
                        {uploadError[job.id] && (
                          <Alert severity="error">{stringifyError(uploadError[job.id])}</Alert>
                        )}
                        <Button
                          size="small"
                          onClick={() =>
                            api
                              .delete(`/projects/${projectId}/jobs/${job.id}`)
                              .then(() => fetchJobs(filter === "archived"))
                          }
                        >
                          Cancel
                        </Button>
                      </Box>
                    ) : job.status === "running" || job.status === "queued" ? (
                      <Button
                        size="small"
                        onClick={() =>
                          api
                            .delete(`/projects/${projectId}/jobs/${job.id}`)
                            .then(() => fetchJobs(filter === "archived"))
                        }
                      >
                        Cancel
                      </Button>
                    ) : (
                      <Box component="span" display="flex" gap={1}>
                        <Button component={Link} to={`/projects/${projectId}/jobs/${job.id}`} size="small">
                          View
                        </Button>
                        {!job.archived && ["succeeded", "failed"].includes(job.status) && (
                          <Button size="small" onClick={() => archiveJob(job.id)}>
                            Archive
                          </Button>
                        )}
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

    </Container>
  );
}
