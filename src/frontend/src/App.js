import React, { useContext } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import ProjectWizard from "./pages/ProjectWizard";
import ProjectJobsPage from "./pages/ProjectJobsPage";
import ResultsPage from "./pages/ResultsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import Header from "./components/Header";
import EmailVerificationPage from "./pages/EmailVerificationPage";
import ResendVerificationPage from "./pages/ResendVerificationPage";
import { AuthContext } from "./contexts/AuthContext";

const App = () => {
  const { authToken } = useContext(AuthContext);

  return (
    <>
      <Header />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<EmailVerificationPage />} />
      <Route path="/resend-verification" element={<ResendVerificationPage />} />
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
        path="/projects/:projectId/jobs"
        element={
          <ProtectedRoute>
            <ProjectJobsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/jobs/:jobId/results"
        element={
          <ProtectedRoute>
            <ResultsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={authToken ? <Navigate to="/dashboard" /> : <Navigate to="/login" />}
      />
    </Routes>
    </>
  );
};

export default App;
