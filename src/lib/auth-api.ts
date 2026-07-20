// Typed wrappers over the backend /auth/* surface. Each persists the
// session on success; callers handle thrown ApiErrors via extractApiError.
// The generated OpenAPI types don't yet include /auth/*, so the small,
// stable request/response shapes are declared locally here.

import { api } from "./api";
import { setSession, getClinician, clearMustChange, type Clinician } from "./auth";

interface TokenResponse {
  // TODO(cookie-migration): backend still returns `token` in the body for
  // backward-compat; remove this field once the backend drops it. The session
  // is now the HttpOnly cookie — we never read `token`.
  token: string;
  token_type: "bearer";
  expires_in: number;
  must_change_password: boolean;
  clinician: Clinician;
}

export interface SignInResult {
  mustChangePassword: boolean;
  clinician: Clinician;
}

export async function signIn(
  email: string,
  password: string,
): Promise<SignInResult> {
  const { data } = await api.post<TokenResponse>("/auth/sign-in", {
    email,
    password,
  });
  // The backend set the HttpOnly session cookie on this response; we only
  // persist the profile + must-change flag client-side.
  setSession(data.clinician, data.must_change_password);
  return {
    mustChangePassword: data.must_change_password,
    clinician: data.clinician,
  };
}

export async function forgotPassword(email: string): Promise<string> {
  const { data } = await api.post<{ status: string; message: string }>(
    "/auth/forgot-password",
    { email },
  );
  return data.message;
}

export interface VerifyTokenResult {
  setup_token: string;
  email: string;
  purpose: "invite" | "reset";
  expires_in: number;
}

export async function verifyToken(token: string): Promise<VerifyTokenResult> {
  const { data } = await api.post<VerifyTokenResult>("/auth/verify-token", {
    token,
  });
  return data;
}

export async function setPassword(
  setupToken: string,
  newPassword: string,
): Promise<Clinician> {
  const { data } = await api.post<Pick<TokenResponse, "clinician">>(
    "/auth/set-password",
    {
      setup_token: setupToken,
      new_password: newPassword,
    },
  );
  // Session cookie is set on the response; persist the profile only.
  setSession(data.clinician, false);
  return data.clinician;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api.post("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  // The backend re-set the session cookie with must_change_password cleared;
  // re-persist the stored profile with the flag cleared.
  const clinician = getClinician();
  if (clinician) {
    setSession(clinician, false);
  }
  clearMustChange();
}

/**
 * Clear the server-side session by clearing the HttpOnly cookie. JS can't
 * clear that cookie itself, so this round-trip is required. Must never
 * throw/block sign-out — the caller clears local state regardless.
 */
export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch {
    // Swallow: local state is cleared by the caller no matter what.
  }
}

/** Mirror of the backend rule (≥10 chars, ≥1 letter, ≥1 digit). Returns an
 *  error string or null. Keeps the form responsive without a round-trip. */
export function validatePassword(pw: string): string | null {
  if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return "Password must be at least 10 characters and include a letter and a digit.";
  }
  return null;
}
