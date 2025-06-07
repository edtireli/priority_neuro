import React, { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import { NotificationContext } from "../contexts/NotificationContext";
import stringifyError from "../utils/stringifyError";
import {
  TextField,
  Button,
  Select,
  MenuItem,
  Grid,
  Box,
  CircularProgress,
  Alert,
  Tooltip,
} from "@mui/material";

function ProjectJobsPage() {
  const { projectId } = useParams();
  const { addNotification } = useContext(NotificationContext);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    job_name: "",
    mode: "single_shot",
    compute_type: "cpu",
    advanced_options: "{}",
  });
  const [error, setError] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [resultView, setResultView] = useState(null);
  const [polling, setPolling] = useState({});
  const [logView, setLogView] = useState({ open: false, text: "" });
  const [longRunning, setLongRunning] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [designAvailability, setDesignAvailability] = useState({});

  useEffect(() => {
    fetchJobs();
    return () => {
      Object.values(polling).forEach(clearInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs`);
      setJobs(res.data);
      res.data.forEach((j) => {
        if (j.status === "succeeded") {
          api
            .get(`/projects/${projectId}/jobs/${j.id}/results-detailed`)
            .then((r) => {
              setDesignAvailability((prev) => ({
                ...prev,
                [j.id]: Array.isArray(r.data.evaluatedDesigns) && r.data.evaluatedDesigns.length > 0,
              }));
            })
            .catch(() => {});
        }
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    let adv;
    try {
      adv = JSON.parse(formData.advanced_options);
    } catch {
      return setError("Invalid JSON in Advanced Options");
    }
    const payload = {
      job_name: formData.job_name,
      mode: formData.mode,
      compute_type: formData.compute_type,
      advanced_options: adv,
    };
    try {
      const res = await api.post(`/projects/${projectId}/jobs`, payload);
      const newJob = res.data;
      setJobs((prev) => [newJob, ...prev]);
      startPolling(newJob.id);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create job");
    } finally {
      setSubmitting(false);
    }
  };

  const startPolling = (jobId) => {
    if (polling[jobId]) return;
    const startTime = Date.now();
    const intervalId = setInterval(async () => {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/status`);
      const updated = res.data;
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
      const name = jobs.find((j) => j.id === jobId)?.job_name || jobId;
      if (updated.status === "running" && Date.now() - startTime > 300000 && !longRunning[jobId]) {
        setLongRunning((prev) => ({ ...prev, [jobId]: true }));
        addNotification({ message: `Job ${name} is still running after 5 minutes. You will receive a notification when it completes.`, severity: "warning" });
      }
      if (["succeeded", "failed"].includes(updated.status)) {
        clearInterval(intervalId);
        setPolling((prev) => {
          const copy = { ...prev };
          delete copy[jobId];
          return copy;
        });
        addNotification({ message: `Job ${name} ${updated.status}`, severity: updated.status === "succeeded" ? "success" : "error" });
      }
    }, 2000);
    setPolling((prev) => ({ ...prev, [jobId]: intervalId }));
  };

  const handleCancel = async (jobId) => {
    try {
      await api.delete(`/projects/${projectId}/jobs/${jobId}`);
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: "failed" } : j)));
      clearInterval(polling[jobId]);
    } catch (err) {
      console.error(err);
    }
  };

  const downloadJSON = async (jobId) => {
    const res = await api.get(`/projects/${projectId}/jobs/${jobId}/results-detailed`);
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-${jobId}-results.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = async (jobId) => {
    const res = await api.get(`/projects/${projectId}/jobs/${jobId}/results-detailed`);
    const evals = res.data.evaluatedDesigns || [];
    if (!evals.length) {
      alert("No evaluated designs available");
      return;
    }
    const cols = new Set();
    evals.forEach((e) => {
      Object.keys(e.design || {}).forEach((k) => cols.add(k));
    });
    const headers = [...cols, "utility"];
    const rows = evals.map((e) =>
      headers.map((h) => (h === "utility" ? e.utility : e.design[h] ?? "")).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-${jobId}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewLog = async (jobId) => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/log`);
      setLogView({ open: true, text: res.data.log });
    } catch {
      setLogView({ open: true, text: "Failed to fetch log" });
    }
  };

  if (loading)
    return (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    );

  return (
    <div>
      <h2>Run Optimisation</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: "2rem" }}>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Job Name"
              name="job_name"
              value={formData.job_name}
              onChange={handleChange}
              required
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Select fullWidth name="mode" value={formData.mode} onChange={handleChange}>
              <MenuItem value="single_shot">Single-Shot</MenuItem>
              <MenuItem value="sequential">Sequential</MenuItem>
            </Select>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Select fullWidth name="compute_type" value={formData.compute_type} onChange={handleChange}>
              <MenuItem value="cpu">CPU</MenuItem>
              <MenuItem value="gpu">GPU</MenuItem>
            </Select>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Advanced Options (JSON)"
              name="advanced_options"
              value={formData.advanced_options}
              onChange={handleChange}
              multiline
              rows={3}
              fullWidth
            />
          </Grid>
        </Grid>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {stringifyError(error)}
          </Alert>
        )}
        <Box display="flex" justifyContent="flex-end">
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={submitting}
            startIcon={submitting && <CircularProgress size={20} />}
          >
            Start Optimisation
          </Button>
        </Box>
      </form>

      <h3>Job History</h3>
      {Object.keys(longRunning).map((jid) => (
        longRunning[jid] && (
          <div key={jid} style={{ backgroundColor: '#ffecb3', padding: '8px', marginBottom: '8px' }}>
            Job {jobs.find(j => j.id === jid)?.job_name || jid} is still running after 5 minutes. You will receive a notification when it completes.
          </div>
        )
      ))}
      <table border="1" cellPadding="5" style={{ width: "100%", textAlign: "left" }}>
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Name</th>
            <th>Status</th>
            <th>Submitted</th>
            <th>Started</th>
            <th>Completed</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td>{job.id}</td>
              <td>{job.job_name}</td>
              <td>{job.status}</td>
              <td>{new Date(job.submitted_at).toLocaleString()}</td>
              <td>{job.started_at ? new Date(job.started_at).toLocaleString() : "-"}</td>
              <td>{job.completed_at ? new Date(job.completed_at).toLocaleString() : "-"}</td>
              <td>
                {job.status === "running" && (
                  <Button variant="outlined" size="small" onClick={() => handleCancel(job.id)}>
                    Cancel
                  </Button>
                )}
                {job.status === "succeeded" && (
                  <Box display="flex" gap={1}>
                    <Button variant="outlined" size="small" onClick={() => downloadJSON(job.id)}>
                      Download JSON
                    </Button>
                    <Tooltip
                      title={designAvailability[job.id] ? "" : "No evaluated designs available."}
                    >
                      <span>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => downloadCSV(job.id)}
                          disabled={!designAvailability[job.id]}
                        >
                          Download CSV
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                )}
                {job.status === "failed" && (
                  <Button variant="outlined" size="small" onClick={() => handleViewLog(job.id)}>
                    View Log
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {resultView && (
        <div style={{ marginTop: "1rem" }}>
          <h4>Optimal Design:</h4>
          <pre>{JSON.stringify(resultView.optimalDesign, null, 2)}</pre>
          <p>Expected Information Gain: {resultView.utilityValue.toFixed(2)} nats</p>
        </div>
      )}
      {logView.open && (
        <div className="modal" onClick={() => setLogView({ open: false, text: "" })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h4>Job Log</h4>
            <pre style={{ whiteSpace: "pre-wrap" }}>{logView.text}</pre>
            <button onClick={() => setLogView({ open: false, text: "" })}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectJobsPage;
