import React, { useContext } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import ProjectWizard from "./pages/ProjectWizard";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthContext } from "./contexts/AuthContext";

const App = () => {
  const { authToken } = useContext(AuthContext);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/configure/*"
        element={
          <ProtectedRoute>
            <ProjectWizard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={authToken ? <Navigate to="/dashboard" /> : <Navigate to="/login" />}
      />
    </Routes>
  );
};

export default App;
