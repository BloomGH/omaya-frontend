import React, { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthShell } from "../components/auth/AuthShell";
import { AuthError } from "../components/auth/AuthCard";
import { signIn } from "../lib/auth-api";
import { extractApiError } from "../lib/api";
import { isAuthenticated } from "../lib/auth";

const Login = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rawNext = params.get("next");
  const next = rawNext && /^\/(?![/\\])/.test(rawNext) ? rawNext : null;
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated()) {
    return <Navigate to={next || "/dashboard"} replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { mustChangePassword } = await signIn(email, password);
      navigate(mustChangePassword ? "/change-password" : next || "/dashboard", {
        replace: true,
      });
    } catch (err) {
      setError(extractApiError(err, "Invalid email or password.").message);
    } finally {
      // Reset in finally so a rejected sign-in clears the busy flag too — a
      // trailing reset on the success path alone would leave the button stuck
      // disabled if the request rejects.
      setSubmitting(false);
    }
  };

  return (
    <AuthShell header={<p className="text-sm text-[#6B7280] mt-1">Sign in to continue</p>}>
      {/* Form */}
      <form onSubmit={handleSignIn} className="flex flex-col gap-5">
        <AuthError message={error} />

        {/* Email */}
        <div className="flex flex-col">
          <label htmlFor="email" className="text-sm font-medium text-[#374151] mb-1.5 ml-0.5">
            Email address
          </label>
          <input
            id="email"
            type="email"
            placeholder="name@hospital.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 w-full rounded-md border border-[hsl(220,13%,88%)] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#7a2850] focus:ring-offset-2 focus:border-transparent transition-shadow"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col">
          <label htmlFor="password" className="text-sm font-medium text-[#374151] mb-1.5 ml-0.5">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-md border border-[hsl(220,13%,88%)] bg-white px-3 py-2 pr-10 text-sm text-[#0F172A] placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#7a2850] focus:ring-offset-2 focus:border-transparent transition-shadow"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#7a2850] transition-colors p-1 focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-11 rounded-md bg-[#7a2850] text-white text-sm font-semibold flex items-center justify-center hover:bg-[#5d1f3d] active:bg-[#4a1830] transition-colors focus:outline-none focus:ring-2 focus:ring-[#7a2850] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </button>
      </form>

      {/* Forgot password */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => navigate("/forgot-password")}
          className="text-sm font-medium text-[#6B7280] hover:text-[#7a2850] transition-colors focus:outline-none underline-offset-4 hover:underline"
        >
          Forgot password?
        </button>
      </div>

      {/* No account */}
      <div className="mt-8 pt-6 border-t border-[hsl(220,13%,88%)] text-center">
        <p className="text-sm text-[#6B7280]">
          Don't have an account?{" "}
          <a
            href="https://omayacare.com/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#7a2850] hover:underline underline-offset-4 transition-colors"
          >
            Contact the Omaya team
          </a>
        </p>
      </div>
    </AuthShell>
  );
};

export default Login;
