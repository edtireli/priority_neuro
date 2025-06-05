import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Container, TextField, Button, Typography, Paper } from "@mui/material";

const ResendVerificationPage = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/resend-verification", { email });
      setMessage("Verification email resent. Please check your inbox.");
    } catch {
      setMessage("Failed to resend verification.");
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" align="center" gutterBottom>
          Resend Verification
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            margin="normal"
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
            Resend
          </Button>
        </form>
        {message && (
          <Typography align="center" sx={{ mt: 2 }}>
            {message}
          </Typography>
        )}
        <Typography align="center" sx={{ mt: 2 }}>
          <Link to="/login">Back to Login</Link>
        </Typography>
      </Paper>
    </Container>
  );
};

export default ResendVerificationPage;
