import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Paper,
} from "@mui/material";

const LoginPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);

  const validate = () => {
    if (!email || !password) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      setError("Please provide valid credentials.");
      return;
    }
    try {
      const resp = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", resp.data.access_token);
      if (onLogin) onLogin();
      navigate("/dashboard");
    } catch (err) {
      if (
        err.response &&
        err.response.status === 401 &&
        err.response.data.detail &&
        err.response.data.detail.includes("Email not verified")
      ) {
        setUnverified(true);
        setError(err.response.data.detail);
      } else {
        setError("Invalid email or password");
      }
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" align="center" gutterBottom>
          Login
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email"
            margin="normal"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            fullWidth
            label="Password"
            margin="normal"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        {error && (
          <Typography color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
        {unverified && (
          <Typography align="center" sx={{ mt: 1 }}>
            <Link to="/resend-verification">Resend Verification Email</Link>
          </Typography>
        )}
        <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
          Login
        </Button>
      </Box>
        <Typography align="center" sx={{ mt: 2 }}>
          Don't have an account? <Link to="/register">Register</Link>
        </Typography>
      </Paper>
    </Container>
  );
};

export default LoginPage;
