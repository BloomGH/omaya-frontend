import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { AuthCard, AuthError } from "../components/auth/AuthCard";
import { changePassword, validatePassword } from "../lib/auth-api";
import { extractApiError } from "../lib/api";
import { isAuthenticated } from "../lib/auth";

/**
 * Forced rotation for a seat that signed in with must_change_password=true.
 * Reachable only with a valid session (the JWT is already stored); on
 * success the re-issued token clears the flag and we land on the dashboard.
 */
const ChangePassword = () => {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const weak = validatePassword(next);
    if (weak) {
      setError(weak);
      return;
    }
    if (next !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(current, next);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      // Clear the busy flag on both paths — a reset only after a resolved
      // request leaves the button stuck disabled when the request rejects.
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Update your password"
      subtitle="For security, set a new password before continuing."
    >
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <AuthError message={error} />

        <Input
          type={showPassword ? "text" : "password"}
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          fullWidth
          required
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          }
        />

        <Input
          type={showPassword ? "text" : "password"}
          placeholder="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          fullWidth
          required
        />

        <Input
          type={showPassword ? "text" : "password"}
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          fullWidth
          required
        />

        <div className="pt-1">
          <Button
            type="submit"
            variant="default"
            size="lg"
            disabled={submitting}
            className="w-full"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </div>
      </form>
    </AuthCard>
  );
};

export default ChangePassword;
