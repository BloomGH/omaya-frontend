import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MailCheck, Loader2 } from "lucide-react";
import { AuthShell } from "../components/auth/AuthShell";
import { AuthError } from "../components/auth/AuthCard";
import { forgotPassword } from "../lib/auth-api";
import { extractApiError } from "../lib/api";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#7a2850]/10 flex items-center justify-center mb-5 mx-auto">
            <MailCheck className="h-7 w-7 text-[#7a2850]" />
          </div>
          <h1 className="text-lg font-semibold text-[#0F172A]">Check your email</h1>
          <p className="text-sm text-[#6B7280] mt-2 mb-8 leading-relaxed">
            If an account exists for that address, we've sent a link to reset
            your password. It expires in 1 hour.
          </p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="w-full h-11 rounded-md border border-[hsl(220,13%,88%)] bg-white text-[#7a2850] text-sm font-semibold flex items-center justify-center hover:bg-[#7a2850]/5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#7a2850] focus:ring-offset-2"
          >
            Back to log in
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      header={
        <div className="mt-4">
          <h1 className="text-lg font-semibold text-[#0F172A]">Forgot password?</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Enter your email and we'll send you a link to reset it.
          </p>
        </div>
      }
    >
      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-11 rounded-md bg-[#7a2850] text-white text-sm font-semibold flex items-center justify-center hover:bg-[#5d1f3d] active:bg-[#4a1830] transition-colors focus:outline-none focus:ring-2 focus:ring-[#7a2850] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send reset link
        </button>
      </form>

      {/* Back to log in */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6B7280] hover:text-[#7a2850] transition-colors focus:outline-none underline-offset-4 hover:underline"
        >
          <ArrowLeft size={16} />
          Back to log in
        </button>
      </div>
    </AuthShell>
  );
};

export default ForgotPassword;
