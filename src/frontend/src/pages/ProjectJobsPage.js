import React, { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import { NotificationContext } from "../contexts/NotificationContext";

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
  const [resultView, setResultView] = useState(null);
  const [polling, setPolling] = useState({});
  const [logView, setLogView] = useState({ open: false, text: "" });
  const [longRunning, setLongRunning] = useState({});

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

  const handleViewResults = async (jobId) => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/results`);
      const data = JSON.parse(res.data);
      setResultView(data);
    } catch (err) {
      alert("Failed to fetch results");
    }
  };

  const handleViewLog = async (jobId) => {
    try {
      const res = await api.get(`/projects/${projectId}/jobs/${jobId}/log`);
      setLogView({ open: true, text: res.data.log });
    } catch {
      setLogView({ open: true, text: "Failed to fetch log" });
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
                {job.status === "running" && <button onClick={() => handleCancel(job.id)}>Cancel</button>}
                {job.status === "succeeded" && (
                  <button onClick={() => handleViewResults(job.id)}>View Results</button>
                )}
                {job.status === "failed" && (
                  <button onClick={() => handleViewLog(job.id)}>View Log</button>
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
