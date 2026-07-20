import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { AuthCard, AuthError } from "../components/auth/AuthCard";
import {
  verifyToken,
  setPassword,
  validatePassword,
  type VerifyTokenResult,
} from "../lib/auth-api";
import { extractApiError } from "../lib/api";
import { isAuthenticated } from "../lib/auth";

type Phase = "verifying" | "invalid" | "ready";

/**
 * Mounted at both /activate?token= (invite, first login) and
 * /reset?token= (password reset). The flow is identical — verify-token
 * tells us which `purpose` we're in — so a single screen serves both.
 */
const SetupPassword = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rawToken = params.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>("verifying");
  const [info, setInfo] = useState<VerifyTokenResult | null>(null);
  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Intentional token-verify phase machine: verify-token drives the
  // verifying → ready/invalid transition (sets info + phase together).
  // react-doctor-disable-next-line react-doctor/no-cascading-set-state
  useEffect(() => {
    let active = true;
    if (!rawToken) {
      setPhase("invalid");
      return;
    }
    verifyToken(rawToken)
      .then((res) => {
        if (active) {
          setInfo(res);
          setPhase("ready");
        }
      })
      .catch(() => {
        if (active) setPhase("invalid");
      });
    return () => {
      active = false;
    };
  }, [rawToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const weak = validatePassword(password);
    if (weak) {
      setError(weak);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await setPassword(info!.setup_token, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const apiErr = extractApiError(err);
      // The 15-min setup token can lapse while the user types. The link
      // token itself is still live (consumed only on success), so re-mint
      // a fresh setup token and retry once.
      if (apiErr.error_code === "setup_token_expired") {
        try {
          const fresh = await verifyToken(rawToken);
          setInfo(fresh);
          await setPassword(fresh.setup_token, password);
          navigate("/dashboard", { replace: true });
          return;
        } catch {
          // Racy first-login: the initial setPassword may have already
          // activated the account + written a session before this retry ran
          // against the now-consumed link token. If we're signed in, it
          // succeeded — go to the dashboard instead of stranding the user.
          if (isAuthenticated()) {
            navigate("/dashboard", { replace: true });
            return;
          }
          setError("This link has expired. Request a new one.");
          setSubmitting(false);
          return;
        }
      }
      setError(apiErr.message);
      setSubmitting(false);
    }
  };

  if (phase === "verifying") {
    return (
      <AuthCard title="One moment" subtitle="Verifying your link…">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </AuthCard>
    );
  }

  if (phase === "invalid") {
    return (
      <AuthCard
        title="Link expired"
        subtitle="This link is invalid or has already been used. Request a fresh one and we'll email it to you."
      >
        <Button
          variant="default"
          size="lg"
          className="w-full py-4 md:py-6 text-base md:text-lg font-bold"
          onClick={() => navigate("/forgot-password")}
        >
          Request a new link
        </Button>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700 cursor-pointer focus:outline-none"
        >
          Back to log in
        </button>
      </AuthCard>
    );
  }

  const isInvite = info?.purpose === "invite";

  return (
    <AuthCard
      title={isInvite ? "Set your password" : "Reset your password"}
      subtitle={
        isInvite
          ? "Welcome to Omaya. Choose a password to activate your account."
          : "Choose a new password for your account."
      }
    >
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <AuthError message={error} />

        {info?.email && (
          <Input type="email" value={info.email} fullWidth disabled readOnly />
        )}

        <Input
          type={showPassword ? "text" : "password"}
          placeholder="New password"
          value={password}
          onChange={(e) => setPasswordValue(e.target.value)}
          autoComplete="new-password"
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
          placeholder="Confirm password"
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
            className="w-full py-4 md:py-6 text-base md:text-lg font-bold"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isInvite ? "Activate account" : "Reset password"}
          </Button>
        </div>
      </form>
    </AuthCard>
  );
};

export default SetupPassword;
