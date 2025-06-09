import React, { useEffect, useState } from "react";
import { Container, Paper, Typography, Avatar, Box, CircularProgress, Alert } from "@mui/material";
import api from "../api";
import stringifyError from "../utils/stringifyError";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data);
        setError("");
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message);
      });
  }, []);

  if (!user && !error)
    return (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    );

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        User Profile
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {stringifyError(error)}
        </Alert>
      )}
      {user && (
        <Paper sx={{ p: 3, display: "flex", alignItems: "center", gap: 3 }}>
          <Avatar sx={{ width: 80, height: 80 }}>
            {user.full_name
              ? user.full_name.charAt(0).toUpperCase()
              : user.email.charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="h6">{user.full_name}</Typography>
            <Typography color="text.secondary">{user.email}</Typography>
            {user.institution && (
              <Typography color="text.secondary">{user.institution}</Typography>
            )}
          </Box>
        </Paper>
      )}
    </Container>
  );
}
