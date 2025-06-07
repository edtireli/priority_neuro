import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import stringifyError from "../utils/stringifyError";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("Verifying...");
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setMessage("No verification token provided.");
      return;
    }
    api
      .post("/auth/verify", { token })
      .then(() => setMessage("Email verified! You can now log in."))
      .catch((err) =>
        setMessage(err.response?.data.detail || "Verification failed.")
      );
  }, [token]);

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Email Verification</h2>
      <p>{stringifyError(message)}</p>
    </div>
  );
}
