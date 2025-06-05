import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../api";

const EmailVerificationPage = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState("Verifying...");

  useEffect(() => {
    if (token) {
      api
        .post("/auth/verify", { token })
        .then(() => setStatus("verified"))
        .catch(() => setStatus("error"));
    } else {
      setStatus("error");
    }
  }, [token]);

  if (status === "verified")
    return (
      <p>
        Email verified. <Link to="/login">Login</Link>
      </p>
    );
  if (status === "error") return <p>Invalid or expired token.</p>;
  return <p>{status}</p>;
};

export default EmailVerificationPage;
