import React, { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { AuthContext } from "../contexts/AuthContext";

const Header = () => {
  const { authToken, logout } = useContext(AuthContext);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (authToken) {
      api
        .get("/auth/me")
        .then((res) => setUser(res.data))
        .catch(() => {});
    } else {
      setUser(null);
    }
  }, [authToken]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header style={{ background: "#1976d2", padding: "0.5rem", color: "white" }}>
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        <div>
          {authToken && (
            <Link to="/dashboard" style={{ color: "white", marginRight: "1rem" }}>
              Dashboard
            </Link>
          )}
        </div>
        <div>
          {!authToken && (
            <Link to="/signup" style={{ color: "white", marginRight: "1rem" }}>
              Register
            </Link>
          )}
          {authToken && user && (
            <span style={{ marginRight: "1rem" }}>{user.full_name}</span>
          )}
          {authToken ? (
            <button onClick={handleLogout}>Logout</button>
          ) : (
            <Link to="/login" style={{ color: "white" }}>
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
