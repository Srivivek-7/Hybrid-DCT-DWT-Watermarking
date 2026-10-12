import { useState } from "react";
import type { FormEvent } from "react";
import { register } from "../services/auth";

interface RegisterProps {
  onRegisterSuccess: () => void;
  onLoginClick: () => void;
}

function Register({
  onRegisterSuccess,
  onLoginClick,
}: RegisterProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");

    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      await register(
        name.trim(),
        email.trim(),
        password
      );

      onRegisterSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create account. Please try again."
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
          <span className="auth-label">
            CREATE ACCOUNT
          </span>

          <h1>Get started</h1>

          <p>
            Create your secure account to use the
            watermarking laboratory.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >

          <div className="auth-field">
            <label htmlFor="register-name">
              Full Name
            </label>

            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Your name"
              autoComplete="name"
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-email">
              Email
            </label>

            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-password">
              Password
            </label>

            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-confirm-password">
              Confirm Password
            </label>

            <input
              id="register-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              placeholder="Re-enter your password"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          {error && (
            <div
              className="auth-error"
              role="alert"
            >
              <span>!</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Creating account..."
              : "Create Account"}

            {!loading && <span>→</span>}
          </button>

        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <div className="auth-switch">
          <span>
            Already have an account?
          </span>

          <button
            type="button"
            onClick={onLoginClick}
            disabled={loading}
          >
            Sign in
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

export default Register;
