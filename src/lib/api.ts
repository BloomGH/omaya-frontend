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

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<unknown>) => {
    const status = error.response?.status;
    const url = error.config?.url ?? "";

    // A 401 on a protected request means the token expired/was revoked.
    // The /auth/* endpoints handle their own 401s inline (wrong password,
    // bad setup token), so don't hijack those.
    if (status === 401 && !url.startsWith("/auth/")) {
      clearSession();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
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
