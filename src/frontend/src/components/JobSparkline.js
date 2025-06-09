import React, { useEffect, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import api from "../api";

const cache = {};

export default function JobSparkline({ projectId, jobId }) {
  const theme = useTheme();
  const [data, setData] = useState(cache[jobId] || null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cache[jobId]) return;
    api
      .get(`/projects/${projectId}/jobs/${jobId}/metrics`)
      .then((res) => {
        const ordered = Array.isArray(res.data)
          ? res.data.sort((a, b) => a.iteration - b.iteration)
          : [];
        cache[jobId] = ordered;
        setData(ordered);
      })
      .catch(() => {
        setError(true);
      });
  }, [projectId, jobId]);

  if (error) return (
    <Typography color="error" component="span" fontSize="0.8rem">N/A</Typography>
  );
  if (!data) return <Typography component="span">-</Typography>;
  if (data.length < 2) return <Typography color="text.secondary" component="span">-</Typography>;

  const utilities = data.map((d) => d.utility);
  const max = Math.max(...utilities);
  const min = Math.min(...utilities);
  const width = 100;
  const height = 20;
  const norm = (u) =>
    height - ((u - min) / (max - min || 1)) * height;
  const points = utilities
    .map((u, i) => `${(i / (utilities.length - 1)) * width},${norm(u)}`)
    .join(" ");

  return (
    <Box sx={{ width: "100%", color: theme.palette.primary.main }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        style={{ display: "block" }}
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          points={points}
        />
        {data.map((m, i) => (
          <circle
            key={i}
            cx={(i / (utilities.length - 1)) * width}
            cy={norm(m.utility)}
            r={1.5}
          >
            <title>{`Iteration ${m.iteration} \u2192 ${m.utility}`}</title>
          </circle>
        ))}
      </svg>
    </Box>
  );
}
