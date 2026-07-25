import axios, { AxiosError } from "axios";
import { toast } from "sonner";
import { clearSession } from "./auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
  // Send the HttpOnly `omaya_session` cookie on every request (incl. the
  // cross-subdomain prod case). The cookie is the session credential now —
  // JS can't read it, so there's no Bearer interceptor anymore.
  withCredentials: true,
});

// Endpoints that genuinely own their 401 inline, so the interceptor must not
// hijack it. This is an exact allowlist, NOT an `/auth/` prefix: /auth/me is
// the AuthContext bootstrap, and a 401 there is exactly the signal that turns
// the optimistic shell into a real logout.
const SELF_HANDLED_401_PATHS = new Set([
  "/auth/sign-in", // invalid_credentials — Login.tsx renders it
  "/auth/set-password", // setup_token_expired / invalid_setup_token — SetupPassword retries on it
  "/auth/verify-token", // 400 today; pre-session screen, keep it self-handling
  "/auth/forgot-password", // 200/429 today; pre-session screen
]);

// Endpoints whose 401 is AMBIGUOUS, keyed to the one error_code the page owns.
// /auth/change-password declares Depends(current_user) backend-side, so it 401s
// for a DEAD SESSION (token_expired/_invalid/_missing) just as readily as for a
// wrong CURRENT password (invalid_credentials). Allowlisting it by path would
// swallow the session-death case and strand a clinician on the forced-rotation
// screen — typing the correct password and being told, forever, that it's wrong.
// Discriminate on the code so only the password case is self-handled.
const AMBIGUOUS_401_CODES = new Map([
  ["/auth/change-password", "invalid_credentials"],
]);

/** True when the calling page renders this 401 itself and the interceptor must not hijack it. */
function selfHandles401(path: string, error: AxiosError<unknown>): boolean {
  if (SELF_HANDLED_401_PATHS.has(path)) return true;
  const ownedCode = AMBIGUOUS_401_CODES.get(path);
  return ownedCode !== undefined && extractApiError(error).error_code === ownedCode;
}

// Public auth screens where a dead session should still clear local state but
// must NOT redirect: /activate?token= and /reset?token= carry the one-shot
// link token in the URL, and bouncing to /login would discard it. (/login and
// /, which just forwards to it, are here for the obvious reason.)
const NO_REDIRECT_PATHS = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/activate",
  "/reset",
]);

/** Normalize `config.url` (a path today, but tolerate an absolute URL and a query string). */
function requestPath(rawUrl: string): string {
  const path = rawUrl.split("?")[0].replace(/^https?:\/\/[^/]+/, "");
  return path.replace(/\/+$/, "") || "/";
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<unknown>) => {
    const status = error.response?.status;
    const url = error.config?.url ?? "";

    // A 401 on a protected request is AUTHORITATIVE: the HttpOnly session
    // cookie has expired or been revoked (JS can't read it, so the cached
    // profile is only an optimistic "logged-in" guess — see lib/auth.ts).
    // The first such 401 — including the bootstrap /auth/me fired by
    // AuthContext — is what turns the optimistic shell into a real logout.
    if (status === 401 && !selfHandles401(requestPath(url), error)) {
      clearSession();
      // Normalize BOTH sides: a trailing slash (/login/) still routes to the
      // same screen, so comparing the raw pathname would let it escape the set
      // and redirect /login/ to itself.
      if (!NO_REDIRECT_PATHS.has(requestPath(window.location.pathname))) {
        // Preserve the intended destination so re-login lands back here
        // (mirrors RequireAuth's ?next= handling).
        const next = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        window.location.assign(`/login?next=${next}`);
      }
    }

    if (status !== undefined && status >= 500) {
      toast.error(extractApiError(error).message);
    }
    return Promise.reject(error);
  },
);

export interface ApiError {
  error_code: string;
  message: string;
  status: number;
}

/**
 * Turn a FastAPI 422 `detail` list into a readable, field-qualified string,
 * e.g. `emergency_contacts.0.phone: value is not a valid phone number;
 * gravida: input should be greater than or equal to 0`. Lists every failing
 * field so a form submit shows exactly what to fix.
 */
function formatValidationErrors(detail: unknown): string {
  if (!Array.isArray(detail)) return "";
  return detail
    .flatMap((item) => {
      const it = item as { loc?: unknown; msg?: string };
      let path = "";
      if (Array.isArray(it.loc)) {
        const parts: string[] = [];
        it.loc.forEach((p, i) => {
          // Drop the leading "body"/"query"/"path" scope marker.
          if (i === 0 && (p === "body" || p === "query" || p === "path")) return;
          parts.push(String(p));
        });
        path = parts.join(".");
      }
      const msg = it.msg ?? "invalid value";
      const line = path ? `${path}: ${msg}` : msg;
      return line ? [line] : [];
    })
    .join("; ");
}

/**
 * Normalize an axios error into the backend's `{error_code, message}`
 * envelope (carried under `detail`). Falls back gracefully for 422
 * validation lists and non-HTTP failures (network/timeout).
 */
export function extractApiError(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): ApiError {
  const ax = err as AxiosError<{ detail?: unknown }>;
  const status = ax.response?.status ?? 0;
  const detail = ax.response?.data?.detail;

  // Canonical auth envelope: detail = {error_code, message}
  if (
    detail &&
    typeof detail === "object" &&
    !Array.isArray(detail) &&
    "error_code" in detail
  ) {
    const d = detail as { error_code: string; message?: string };
    return { error_code: d.error_code, message: d.message ?? fallback, status };
  }

  // FastAPI request-validation error: detail = [{loc, msg, ...}, ...].
  // Include the field path so the message says WHICH field failed, and list
  // every failing field (not just the first) — far easier to debug.
  if (Array.isArray(detail) && detail.length > 0) {
    return {
      error_code: "validation_error",
      message: formatValidationErrors(detail) || fallback,
      status,
    };
  }

  if (ax.code === "ECONNABORTED" || ax.message === "Network Error") {
    return {
      error_code: "network_error",
      message: "Can't reach the server. Check your connection and try again.",
      status,
    };
  }

  return { error_code: "unknown", message: fallback, status };
}
