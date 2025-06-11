import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { Container, Typography, Box, Button, Alert } from "@mui/material";
import api from "../api";

export default function AdaptiveDesign() {
  const { projectId } = useParams();
  const [file, setFile] = useState(null);
  const [design, setDesign] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!file) {
      setError("Please select a JSON file");
      return;
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.post(`/projects/${projectId}/adaptive/data`, data);
      const res = await api.get(`/projects/${projectId}/adaptive/next-design`);
      setDesign(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Adaptive Experimental Design
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <input
          type="file"
          accept="application/json"
          onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
        />
        <Button variant="contained" onClick={handleSubmit}>
          Next Step
        </Button>
      </Box>
      {design && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6">Next Design</Typography>
          {Array.isArray(design.sequence) ? (
            <ul>
              {design.sequence.map((step, i) => (
                <li key={i}>{JSON.stringify(step)}</li>
              ))}
            </ul>
          ) : (
            <pre>{JSON.stringify(design, null, 2)}</pre>
          )}
        </Box>
      )}
    </Container>
  );
}
