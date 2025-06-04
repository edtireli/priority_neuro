import React, { useState } from "react";
import api from "../../api";
import { useNavigate } from "react-router-dom";

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
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button type="button" onClick={() => navigate("/dashboard")}>Cancel</button>
      <button type="button" onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Saving…" : "Save Configuration"}
      </button>
    </div>
  );
}

export default Step7_ReviewSubmit;
