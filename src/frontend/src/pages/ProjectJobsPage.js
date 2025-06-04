import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

function ProjectJobsPage() {
  const { projectId } = useParams();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    job_name: "",
    mode: "single_shot",
    compute_type: "cpu",
    advanced_options: "{}",
  });
  const [error, setError] = useState("");
  const [polling, setPolling] = useState({});

  useEffect(() => {
    fetchJobs();
    return () => {
      Object.values(polling).forEach(clearInterval);
    };
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs`);
      setJobs(res.data);
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
    }
  };

  const startPolling = (jobId) => {
    if (polling[jobId]) return;
    const intervalId = setInterval(async () => {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/status`);
      const updated = res.data;
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
      if (["succeeded", "failed"].includes(updated.status)) {
        clearInterval(intervalId);
        setPolling((prev) => {
          const copy = { ...prev };
          delete copy[jobId];
          return copy;
        });
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

  const handleViewResults = async (jobId) => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/results`);
      const data = JSON.parse(res.data);
      alert("Optimal Design:\n" + JSON.stringify(data.optimalDesign, null, 2));
    } catch (err) {
      alert("Failed to fetch results");
    }
  };

  if (loading) return <p>Loading jobs…</p>;

  return (
    <div>
      <h2>Run Optimisation</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: "2rem" }}>
        <div>
          <label>Job Name:</label>
          <input type="text" name="job_name" value={formData.job_name} onChange={handleChange} required />
        </div>
        <div>
          <label>Mode:</label>
          <select name="mode" value={formData.mode} onChange={handleChange}>
            <option value="single_shot">Single-Shot</option>
            <option value="sequential">Sequential</option>
          </select>
        </div>
        <div>
          <label>Compute Type:</label>
          <select name="compute_type" value={formData.compute_type} onChange={handleChange}>
            <option value="cpu">CPU</option>
            <option value="gpu">GPU</option>
          </select>
        </div>
        <div>
          <label>Advanced Options (JSON):</label>
          <textarea name="advanced_options" value={formData.advanced_options} onChange={handleChange} rows={3} cols={40} />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit">Start Optimisation</button>
      </form>

      <h3>Job History</h3>
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
                {job.status === "running" && <button onClick={() => handleCancel(job.id)}>Cancel</button>}
                {job.status === "succeeded" && (
                  <button onClick={() => handleViewResults(job.id)}>View Results</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ProjectJobsPage;
