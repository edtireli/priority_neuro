import React, { useEffect, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import api from "../api";

const cache = {};

export default function JobSparkline({
  projectId,
  jobId,
  status,
  yKey = "utility",
  label = "Utility",
  units = "",
}) {
  const theme = useTheme();
  const [data, setData] = useState(cache[jobId] || null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let id;
    const fetchMetrics = async () => {
      try {
        const res = await api.get(
          `/projects/${projectId}/jobs/${jobId}/metrics`
        );
        const ordered = Array.isArray(res.data)
          ? res.data.sort((a, b) => a.iteration - b.iteration)
          : [];
        cache[jobId] = ordered;
        setData(ordered);
        setError(false);
      } catch {
        setError(true);
      }
    };
    fetchMetrics();
    if (status === "running" || status === "queued") {
      id = setInterval(fetchMetrics, 4000);
    }
    return () => clearInterval(id);
  }, [projectId, jobId, status]);

  if (error) return (
    <Typography color="error" component="span" fontSize="0.8rem">N/A</Typography>
  );
  if (!data) return <Typography component="span">-</Typography>;
  if (data.length < 2) return <Typography color="text.secondary" component="span">-</Typography>;

  const values = data.map((d) => (d[yKey] !== undefined ? d[yKey] : d.utility));
  console.log(yKey, values);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const width = 100;
  const height = 20;
  const norm = (u) =>
    height - ((u - min) / (max - min || 1)) * height;
  const points = values
    .map((u, i) => `${(i / (values.length - 1)) * width},${norm(u)}`)
    .join(" ");

  return (
    <Box sx={{ width: "100%", color: theme.palette.primary.main }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        aria-label={`${label} sparkline`}
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
            cx={(i / (values.length - 1)) * width}
            cy={norm(m[yKey] !== undefined ? m[yKey] : m.utility)}
            r={1.5}
          >
            <title>
              {`Iteration ${m.iteration} \u2192 ${m[yKey] !== undefined ? m[yKey] : m.utility}${units ? ` ${units}` : ""}`}
            </title>
          </circle>
        ))}
      </svg>
    </Box>
  );
}
