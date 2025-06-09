import React, { useContext } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { AppBar, Toolbar, Button, IconButton, useTheme } from "@mui/material";
import { Brightness4, Brightness7 } from "@mui/icons-material";
import { AuthContext } from "../contexts/AuthContext";
import { ColorModeContext } from "../contexts/ColorModeContext";

export default function Navbar({ isAuthenticated, userEmail }) {
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);
  const theme = useTheme();
  const { toggleColorMode } = useContext(ColorModeContext);
  const handleLogout = () => {
    if (logout) logout();
    navigate("/login");
  };
  return (
    <AppBar
      position="static"
      sx={{
        mb: 2,
        bgcolor: theme.palette.mode === "dark" ? "#202123" : "#fff",
        color: theme.palette.mode === "dark" ? "#fff" : "#000",
      }}
    >
      <Toolbar>
        <img src="/smalllogo.png" alt="priority" style={{ height: 32, marginRight: 16 }} />
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
        <IconButton sx={{ ml: "auto" }} color="inherit" onClick={toggleColorMode}>
          {theme.palette.mode === "dark" ? <Brightness7 /> : <Brightness4 />}
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
