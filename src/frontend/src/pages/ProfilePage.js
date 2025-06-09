import React, { useEffect, useState } from "react";
import {
  Container,
  Paper,
  Typography,
  Avatar,
  Box,
  CircularProgress,
  Alert,
  Button,
} from "@mui/material";
import api from "../api";
import stringifyError from "../utils/stringifyError";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");

  const fetchProfilePicture = () => {
    api
      .get("/auth/profile-picture", { responseType: "blob" })
      .then((res) => {
        setAvatarUrl(URL.createObjectURL(res.data));
      })
      .catch(() => {});
  };

  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data);
        if (res.data.profile_picture_url) fetchProfilePicture();
        setError("");
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message);
      });
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    api
      .post("/auth/profile-picture", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => {
        setUser({ ...user, profile_picture_url: res.data.url });
        fetchProfilePicture();
        setError("");
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message);
      })
      .finally(() => setUploading(false));
  };

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
          <Avatar
            src={avatarUrl || undefined}
            sx={{ width: 80, height: 80, filter: "grayscale(100%)" }}
          >
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
            <Box mt={1}>
              <input
                accept="image/*"
                id="profile-upload"
                type="file"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <label htmlFor="profile-upload">
                <Button
                  variant="outlined"
                  component="span"
                  size="small"
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload Picture"}
                </Button>
              </label>
            </Box>
          </Box>
        </Paper>
      )}
    </Container>
  );
}
