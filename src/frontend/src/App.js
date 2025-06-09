import React, { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import Dashboard from "./pages/Dashboard";
import ConfigureProjectPage from "./pages/ConfigureProject";
import RunOptimisationPage from "./pages/RunOptimisationPage";
import JobsPage from "./pages/JobsPage";
import JobDetailPage from "./pages/JobDetailPage";
import ProfilePage from "./pages/ProfilePage";
import PrivateRoute from "./components/PrivateRoute";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const token =
      sessionStorage.getItem("token") || localStorage.getItem("token");
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUserEmail(payload.sub_email || payload.sub);
      setIsAuthenticated(true);
    }
  }, []);

  return (
    <>
      <Navbar isAuthenticated={isAuthenticated} userEmail={userEmail} />
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={() => setIsAuthenticated(true)} />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute authenticated={isAuthenticated}>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute authenticated={isAuthenticated}>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/projects/:projectId/configure"
          element={
            <PrivateRoute authenticated={isAuthenticated}>
              <ConfigureProjectPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/projects/:projectId/jobs"
          element={
            <PrivateRoute authenticated={isAuthenticated}>
              <RunOptimisationPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/jobs"
          element={
            <PrivateRoute authenticated={isAuthenticated}>
              <JobsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/projects/:projectId/jobs/:jobId"
          element={
            <PrivateRoute authenticated={isAuthenticated}>
              <JobDetailPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute authenticated={isAuthenticated}>
              <ProfilePage />
            </PrivateRoute>
          }
        />
      </Routes>
      <img src="/logo.png" alt="logo" className="footer-logo" />
    </>
  );
}

export default App;
