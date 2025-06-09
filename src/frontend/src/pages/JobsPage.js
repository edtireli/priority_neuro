import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Select,
  MenuItem,
} from "@mui/material";
import api from "../api";
import stringifyError from "../utils/stringifyError";

export default function JobsPage() {
  const [projects, setProjects] = useState({});
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const fetchJobs = async (arch = false) => {
    try {
      const res = await api.get("/jobs", { params: { archived: arch } });
      setJobs(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  useEffect(() => {
    api
      .get("/projects")
      .then((res) => {
        const map = {};
        res.data.forEach((p) => {
          map[p.id] = p.name;
        });
        setProjects(map);
        setError("");
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message);
      });
  }, []);

  useEffect(() => {
    fetchJobs(filter === "archived");
  }, [filter]);

  const archiveJob = async (projectId, jobId) => {
    try {
      await api.post(`/projects/${projectId}/jobs/${jobId}/archive`);
      fetchJobs(filter === "archived");
    } catch (err) {
      console.error(err);
    }
  };

  const cancelJob = async (projectId, jobId) => {
    try {
      await api.delete(`/projects/${projectId}/jobs/${jobId}`);
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

  if (jobs === null || Object.keys(projects).length === 0)
    return (
      <Box display="flex" justifyContent="center" my={4}>
        {error ? <Alert severity="error">{stringifyError(error)}</Alert> : <CircularProgress />}
      </Box>
    );

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
            View and manage all your optimisation jobs.
          </Typography>
          <Box mb={2} display="flex" gap={2} alignItems="center">
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              size="small"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="running">Running</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {stringifyError(error)}
        </Alert>
      )}
      {visibleJobs && visibleJobs.length === 0 ? (
        <Typography>No jobs found.</Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Project</TableCell>
                <TableCell>Job ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Submitted At</TableCell>
                <TableCell>Completed At</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleJobs?.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>{projects[job.project_id] || job.project_id}</TableCell>
                  <TableCell>{job.id}</TableCell>
                  <TableCell>{job.status}</TableCell>
                  <TableCell>{job.submitted_at ? new Date(job.submitted_at).toLocaleString() : "-"}</TableCell>
                  <TableCell>{job.completed_at ? new Date(job.completed_at).toLocaleString() : "-"}</TableCell>
                  <TableCell>
                    <Box component="span" display="flex" gap={1}>
                      <Button component={Link} to={`/projects/${job.project_id}/jobs/${job.id}`} size="small">
                        View
                      </Button>
                      {!job.archived && ["queued", "paused_awaiting_data"].includes(job.status) && (
                        <Button size="small" onClick={() => cancelJob(job.project_id, job.id)}>
                          Cancel
                        </Button>
                      )}
                      {!job.archived && ["succeeded", "failed"].includes(job.status) && (
                        <Button size="small" onClick={() => archiveJob(job.project_id, job.id)}>
                          Archive
                        </Button>
                      )}
                    </Box>
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
