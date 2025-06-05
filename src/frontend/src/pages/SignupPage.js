import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  Alert,
} from "@mui/material";

const SignupPage = () => {
  const [form, setForm] = useState({
    full_name: "",
    institution: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return (
      form.full_name &&
      emailRegex.test(form.email) &&
      form.password.length >= 8
    );
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      setError("Please fill out all fields correctly.");
      return;
    }
    try {
      await api.post("/auth/register", form);
      setSuccess(true);
    } catch (err) {
      setError("Registration failed");
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" align="center" gutterBottom>
          Sign Up
        </Typography>
        {success ? (
          <Alert severity="success">
            Account created. <Link to="/login">Login</Link>
          </Alert>
        ) : (
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Full Name"
              name="full_name"
              fullWidth
              margin="normal"
              value={form.full_name}
              onChange={handleChange}
              required
            />
            <TextField
              label="Institution"
              name="institution"
              fullWidth
              margin="normal"
              value={form.institution}
              onChange={handleChange}
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              fullWidth
              margin="normal"
              value={form.email}
              onChange={handleChange}
              required
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              fullWidth
              margin="normal"
              value={form.password}
              onChange={handleChange}
              required
            />
            {error && (
              <Typography color="error" sx={{ mt: 1 }}>
                {error}
              </Typography>
            )}
            <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
              Sign Up
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default SignupPage;
