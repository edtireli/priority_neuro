import React from "react";
import { Navigate } from "react-router-dom";

export default function PrivateRoute({ authenticated, children }) {
  return authenticated ? children : <Navigate to="/login" />;
}
