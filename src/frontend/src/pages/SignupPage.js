import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

const SignupPage = () => {
  const [form, setForm] = useState({
    full_name: "",
    institution: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return (
      form.full_name &&
      emailRegex.test(form.email) &&
      form.password.length >= 8
    );
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      setError("Please fill out all fields correctly.");
      return;
    }
    try {
      await api.post("/auth/register", form);
      setSuccess(true);
    } catch (err) {
      setError("Registration failed");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "2rem auto" }}>
      <h2>Sign Up</h2>
      {success ? (
        <p>
          Account created. <Link to="/login">Login</Link>
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div>
            <label>Full Name:</label>
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label>Institution:</label>
            <input
              name="institution"
              value={form.institution}
              onChange={handleChange}
            />
          </div>
          <div>
            <label>Email:</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label>Password:</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>
          {error && <p style={{ color: "red" }}>{error}</p>}
          <button type="submit">Sign Up</button>
        </form>
      )}
    </div>
  );
};

export default SignupPage;
