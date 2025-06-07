import React, { useEffect, useState, useContext } from "react";
import api from "../api";
import stringifyError from "../utils/stringifyError";
import { useNavigate, NavLink } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

const DashboardPage = () => {
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newProj, setNewProj] = useState({ name: "", description: "" });

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const resp = await api.get("/projects");
        setProjects(resp.data);
      } catch (err) {
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          logout();
          navigate("/login");
        } else {
          setError("Failed to load projects");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [logout, navigate]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newProj.name) return;
    try {
      const resp = await api.post("/projects", newProj);
      setProjects([resp.data, ...projects]);
      setNewProj({ name: "", description: "" });
      navigate(`/projects/${resp.data.id}/configure`);
    } catch {
      setError("Failed to create project");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/projects/${id}`);
      setProjects(projects.filter((p) => p.id !== id));
    } catch {
      setError("Delete failed");
    }
  };


  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto" }}>
      <h2>Projects</h2>
      {error && <p style={{ color: "red" }}>{stringifyError(error)}</p>}
      <form onSubmit={handleCreate} style={{ marginTop: "1rem" }}>
        <input
          placeholder="Name"
          value={newProj.name}
          onChange={(e) => setNewProj({ ...newProj, name: e.target.value })}
          required
        />
        <input
          placeholder="Description"
          value={newProj.description}
          onChange={(e) => setNewProj({ ...newProj, description: e.target.value })}
        />
        <button type="submit">Create</button>
      </form>
      <table style={{ width: "100%", marginTop: "1rem" }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Created At</th>
            <th>Updated At</th>
            <th></th>
            <th></th>
            <th></th>
          </tr>
        </thead>
      <tbody>
        {projects.map((p) => (
          <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.description}</td>
              <td>{new Date(p.created_at).toLocaleString()}</td>
              <td>{new Date(p.updated_at).toLocaleString()}</td>
              <td>
                <button onClick={() => handleDelete(p.id)}>Delete</button>
              </td>
              <td>
                <NavLink to={`/projects/${p.id}/configure`}>
                  {p.config_json ? "Edit Configuration" : "Configure"}
                </NavLink>
              </td>
              <td>
                <NavLink to={`/projects/${p.id}/jobs`}>Run Optimisation</NavLink>
              </td>
            </tr>
        ))}
      </tbody>
      </table>
    </div>
  );
};

export default DashboardPage;
