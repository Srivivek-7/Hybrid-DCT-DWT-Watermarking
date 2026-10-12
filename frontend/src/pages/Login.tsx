import { useState } from "react";
import type { FormEvent } from "react";
import { login } from "../services/auth";

interface LoginProps {
  onLoginSuccess: () => void;
  onRegisterClick: () => void;
}

function Login({ onLoginSuccess, onRegisterClick }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      await login(email.trim(), password);

      onLoginSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to login. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-brand">
          <div className="auth-logo">◇</div>

          <div>
            <strong>WATERMARK LAB</strong>
            <span>Hybrid DCT-DWT</span>
          </div>
        </div>

        <div className="auth-heading">
          <span className="auth-label">SECURE ACCESS</span>

          <h1>Welcome back</h1>

          <p>
            Sign in to access your image watermarking laboratory.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">

          <div className="auth-field">
            <label htmlFor="login-email">
              Email
            </label>

            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">
              Password
            </label>

            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <span>!</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
            {!loading && <span>→</span>}
          </button>

        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <div className="auth-switch">
          <span>Don't have an account?</span>

          <button
            type="button"
            onClick={onRegisterClick}
            disabled={loading}
          >
            Create account
          </button>
        </div>

        <div className="auth-footer">
          <span>🔐</span>
          Protected research environment
        </div>

      </div>
    </div>
  );
}

export default Login;
