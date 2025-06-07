import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
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

export default function RunOptimisationPage() {
  const { projectId } = useParams();
  const [jobs, setJobs] = useState(null);
  const [loadingError, setLoadingError] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [filter, setFilter] = useState("all");

  const renderError = (err) => {
    if (!err) return null;
    if (Array.isArray(err)) {
      return (
        <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
          {err.map((e, i) => (
            <li key={i}>{typeof e === "string" ? e : e.msg || JSON.stringify(e)}</li>
          ))}
        </ul>
      );
    }
    return typeof err === "string" ? err : err.msg || JSON.stringify(err);
  };

  // fetch jobs
  const fetchJobs = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs`);
      const list = res.data.jobs || res.data; // backend returns list directly in some places
      setJobs(list);
      setLoadingError("");
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setLoadingError(detail);
    }
  };

  useEffect(() => {
    fetchJobs();
    const id = setInterval(fetchJobs, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleStart = async () => {
    setStarting(true);
    setStartError("");
    try {
      const res = await api.post(`/projects/${projectId}/jobs`, {
        job_name: "Job",
        mode: "single_shot",
        compute_type: "cpu",
        advanced_options: {},
      });
      const newJob = res.data;
      setJobs((prev) => [newJob, ...(prev || [])]);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setStartError(detail);
    } finally {
      setStarting(false);
    }
  };

  const visibleJobs = jobs?.filter((j) => {
    if (filter === "all") return true;
    if (filter === "running") return j.status === "running" || j.status === "queued";
    if (filter === "completed") return j.status === "succeeded";
    if (filter === "failed") return j.status === "failed";
    return true;
  });

  return (
    <Container sx={{ py: 4 }}>
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
        </Select>
      </Box>
      {startError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {renderError(startError)}
        </Alert>
      )}
      {jobs === null ? (
        <Box display="flex" justifyContent="center" my={4}>
          {loadingError ? (
            <Alert severity="error">{renderError(loadingError)}</Alert>
          ) : (
            <CircularProgress />
          )}
        </Box>
      ) : visibleJobs.length === 0 ? (
        <Typography>No jobs yet. Click “Start New Optimization” to begin.</Typography>
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
                    <Chip label={job.status} color={
                      job.status === "succeeded"
                        ? "success"
                        : job.status === "failed"
                        ? "error"
                        : "warning"
                    } size="small" />
                  </TableCell>
                  <TableCell>{job.submitted_at ? new Date(job.submitted_at).toLocaleString() : "-"}</TableCell>
                  <TableCell>{job.started_at ? new Date(job.started_at).toLocaleString() : "-"}</TableCell>
                  <TableCell>{job.completed_at ? new Date(job.completed_at).toLocaleString() : "-"}</TableCell>
                  <TableCell>{job.iteration ?? "-"}</TableCell>
                  <TableCell>
                    <Button component={Link} to={`/projects/${projectId}/jobs/${job.id}`} size="small">
                      View
                    </Button>
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
