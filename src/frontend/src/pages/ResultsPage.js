import React, { useEffect, useState } from "react";
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

export default function ResultsPage() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await api.get("/jobs", { params: { archived: true } });
        const succeeded = res.data.filter((j) => j.status === "succeeded");
        setJobs(succeeded);
      } catch (err) {
        setError(err.response?.data?.detail || err.message);
      }
    };
    fetchJobs();
  }, []);

  if (!jobs)
    return (
      <Box display="flex" justifyContent="center" my={4}>
        {error ? <Alert severity="error">{stringifyError(error)}</Alert> : <CircularProgress />}
      </Box>
    );

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Results
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {stringifyError(error)}
        </Alert>
      )}
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Project</TableCell>
              <TableCell>Job ID</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Submitted At</TableCell>
              <TableCell>Completed At</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>{job.project_id}</TableCell>
                <TableCell>{job.id}</TableCell>
                <TableCell>{job.status}</TableCell>
                <TableCell>
                  {job.submitted_at ? new Date(job.submitted_at).toLocaleString() : "-"}
                </TableCell>
                <TableCell>
                  {job.completed_at ? new Date(job.completed_at).toLocaleString() : "-"}
                </TableCell>
                <TableCell>
                  <Button
                    component={Link}
                    to={`/projects/${job.project_id}/jobs/${job.id}`}
                    size="small"
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Container>
  );
}
