import React, { useContext } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { AppBar, Toolbar, Typography, Button } from "@mui/material";
import { AuthContext } from "../contexts/AuthContext";

export default function Navbar({ isAuthenticated, userEmail }) {
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);
  const handleLogout = () => {
    if (logout) logout();
    navigate("/login");
  };
  return (
    <AppBar position="static" sx={{ mb: 2 }}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Neuro-Exp-Design
        </Typography>
        {isAuthenticated ? (
          <>
            <Button color="inherit" component={RouterLink} to="/dashboard">
              Dashboard
            </Button>
            <Button color="inherit" component={RouterLink} to="/profile">
              {userEmail}
            </Button>
            <Button color="inherit" onClick={handleLogout}>
              Logout
            </Button>
          </>
        ) : (
          <>
            <Button color="inherit" component={RouterLink} to="/login">
              Login
            </Button>
            <Button color="inherit" component={RouterLink} to="/register">
              Register
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
