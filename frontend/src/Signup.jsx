import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "./config";

function Signup() {
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();

    // Check passwords before contacting backend
    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    setMessage("Creating account...");

    try {
      const response = await fetch(`${API_URL}/api/signup`, {
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
        setMessage(data.error || "Signup failed");
        return;
      }

      setMessage("Account created successfully! 🎉");

      // Go back to login after successful signup
      setTimeout(() => {
        navigate("/");
      }, 1200);

    } catch (error) {
      console.error(error);
      setMessage("Cannot connect to backend");
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Sign Up</h1>

        <form onSubmit={handleSignup}>

          

          {/* Email */}
          <div className="input-group">
            <label htmlFor="signup-email">Email</label>

            <input
              type="email"
              id="signup-email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div className="input-group">
            <label htmlFor="signup-password">Password</label>

            <input
              type={showPassword ? "text" : "password"}
              id="signup-password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="button"
              className={`toggle-eye ${
                showPassword ? "showing" : ""
              }`}
              onClick={() => setShowPassword(!showPassword)}
              aria-label="Toggle password visibility"
            >
              <svg className="eye-on" viewBox="0 0 24 24">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>

              <svg className="eye-off" viewBox="0 0 24 24">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              </svg>
            </button>
          </div>

          {/* Confirm Password */}
          <div className="input-group">
            <label htmlFor="confirm-password">
              Confirm Password
            </label>

            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirm-password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              required
            />

            <button
              type="button"
              className={`toggle-eye ${
                showConfirmPassword ? "showing" : ""
              }`}
              onClick={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
              aria-label="Toggle password visibility"
            >
              <svg className="eye-on" viewBox="0 0 24 24">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>

              <svg className="eye-off" viewBox="0 0 24 24">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              </svg>
            </button>
          </div>

          <button type="submit" className="login-btn">
            {message === "Creating account..."
              ? "Creating account..."
              : "Sign Up"}
          </button>
        </form>

        {message && message !== "Creating account..." && (
          <p className="login-message">
            {message}
          </p>
        )}

        <p className="register-text">
          Already have an account?
          <Link to="/">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;