import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Navbar({ isAuthenticated, userEmail }) {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };
  return (
    <nav style={{ padding: "1rem", borderBottom: "1px solid #ddd" }}>
      <Link to="/" style={{ marginRight: "1rem" }}>Home</Link>
      {isAuthenticated ? (
        <>
          <Link to="/dashboard" style={{ marginRight: "1rem" }}>Dashboard</Link>
          <span style={{ marginRight: "1rem" }}>{userEmail}</span>
          <button onClick={handleLogout}>Logout</button>
        </>
      ) : (
        <>
          <Link to="/login" style={{ marginRight: "1rem" }}>Login</Link>
          <Link to="/register">Register</Link>
        </>
      )}
    </nav>
  );
}
