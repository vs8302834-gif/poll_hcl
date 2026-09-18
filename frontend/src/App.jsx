import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";

import "./App.css";
import Signup from "./Signup";
import Dashboard from "./Dashboard";
import CreatePoll from "./CreatePoll";
import Results from "./Results";
import VoterPoll from "./pages/VoterPoll";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    setMessage("Logging in...");

    try {
      const response = await fetch("http://localhost:8080/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Login failed");
        return;
      }

      // Save JWT for later API requests
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setMessage("Login successful! 🎉");

      console.log("Logged in user:", data.user);

      // Go to dashboard after successful login
      setTimeout(() => {
        navigate("/dashboard");
      }, 500);

    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to backend");
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <h1>Login</h1>

        <form onSubmit={handleLogin}>

          {/* Email */}
          <div className="input-group">
            <label htmlFor="email">Email</label>

            <input
              type="email"
              id="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div className="input-group">
            <label htmlFor="password">Password</label>

            <input
              type={showPassword ? "text" : "password"}
              id="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {/* Password visibility toggle */}
            <button
              type="button"
              className={`toggle-eye ${
                showPassword ? "showing" : ""
              }`}
              onClick={() =>
                setShowPassword(!showPassword)
              }
              aria-label="Toggle password visibility"
            >

              {/* Eye open */}
              <svg
                className="eye-on"
                viewBox="0 0 24 24"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>

              {/* Eye closed */}
              <svg
                className="eye-off"
                viewBox="0 0 24 24"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />

                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />

                <line
                  x1="1"
                  y1="1"
                  x2="23"
                  y2="23"
                />

                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              </svg>

            </button>
          </div>

          {/* Login button */}
          <button
            type="submit"
            className="login-btn"
          >
            {message === "Logging in..."
              ? "Logging in..."
              : "Log in"}
          </button>

        </form>

        {/* Login message */}
        {message && message !== "Logging in..." && (
          <p className="login-message">
            {message}
          </p>
        )}

        {/* Register */}
        <p className="register-text">
          Don't have an account?
          <Link to="/signup">
            Register
          </Link>
        </p>

      </div>
    </div>
  );
}


function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* Login */}
        <Route
          path="/"
          element={<Login />}
        />

        {/* Signup */}
        <Route
          path="/signup"
          element={<Signup />}
        />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        {/* Create Poll */}
        <Route
          path="/create"
          element={<CreatePoll />}
        />

        {/* Results */}
        <Route
          path="/results/:shareToken"
          element={<Results />}
        />

        <Route
          path="/poll/:shareToken"
          element={<VoterPoll />}
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;