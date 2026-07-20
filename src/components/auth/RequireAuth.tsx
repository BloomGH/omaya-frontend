import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated, getMustChange } from "../../lib/auth";

/**
 * Gate for the authenticated app shell. Redirects to sign-in when there's
 * no session (preserving the intended destination via ?next=), and to
 * /change-password when the seat still owes a forced rotation (otherwise
 * every protected API call would 403).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();

  if (!isAuthenticated()) {
    const next = encodeURIComponent(pathname + search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (getMustChange()) {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
}
