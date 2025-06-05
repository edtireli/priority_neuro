import React from "react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Welcome to Neuro-Exp-Design</h1>
      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        <div style={{ border: "1px solid #ccc", padding: "1rem", width: "200px" }}>
          <h3>Configure Project</h3>
          <p>Set up model, priors, design variables, objective, constraints.</p>
          <Link to="/configure">Go</Link>
        </div>
        <div style={{ border: "1px solid #ccc", padding: "1rem", width: "200px" }}>
          <h3>Run Optimisation</h3>
          <p>Launch BOED jobs and monitor status.</p>
          <Link to="/jobs">Go</Link>
        </div>
        <div style={{ border: "1px solid #ccc", padding: "1rem", width: "200px" }}>
          <h3>View Results</h3>
          <p>Inspect completed job outputs and visuals.</p>
          <Link to="/results">Go</Link>
        </div>
        <div style={{ border: "1px solid #ccc", padding: "1rem", width: "200px" }}>
          <h3>User Profile</h3>
          <p>Manage account and settings.</p>
          <Link to="/profile">Go</Link>
        </div>
      </div>
    </div>
  );
}
