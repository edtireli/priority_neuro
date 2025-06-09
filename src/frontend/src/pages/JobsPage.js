import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
} from "@mui/material";
import api from "../api";
import stringifyError from "../utils/stringifyError";

export default function JobsPage() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/projects")
      .then((res) => {
        setProjects(res.data);
        setError("");
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message);
      });
  }, []);

  if (projects === null)
    return (
      <Box display="flex" justifyContent="center" my={4}>
        {error ? <Alert severity="error">{stringifyError(error)}</Alert> : <CircularProgress />}
      </Box>
    );

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Run Optimization
      </Typography>
      <Typography variant="body1" gutterBottom>
        Select a project to start or monitor optimization jobs.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {stringifyError(error)}
        </Alert>
      )}
      {projects.length === 0 ? (
        <Typography>No projects found. Create a project first.</Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.description}</TableCell>
                  <TableCell>{new Date(p.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button
                      component={Link}
                      to={`/projects/${p.id}/jobs`}
                      variant="outlined"
                      size="small"
                    >
                      View Jobs
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Container>
  );
}
