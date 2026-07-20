import { lazy, Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import axios from "axios";
import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import SetupPassword from "./pages/SetupPassword";
import ChangePassword from "./pages/ChangePassword";
import { AppShell } from "./components/layout/AppShell";
import { RequireAuth } from "./components/auth/RequireAuth";
import { DocsGate } from "./components/auth/DocsGate";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { RolePermissions } from "./types";
import { DrawerProvider } from "./contexts/DrawerContext";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import DocsLoading from "./components/DocsLoading";

// Authenticated dashboard pages are code-split: each loads on first navigation
// instead of riding in the initial bundle, so sign-in stays light. The auth
// pages (Login etc.) are kept eager — they're on the critical first-paint path.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MothersPage = lazy(() => import("./pages/Mothers"));
const CallsPage = lazy(() => import("./pages/Calls"));
const StaffPage = lazy(() => import("./pages/Staff"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Docs = lazy(() => import("./Docs"));

// Loader shown in the content area while a code-split page chunk loads.
function PageLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Loader2 className="animate-spin text-muted-foreground" size={24} />
    </div>
  );
}

// The docs.* host (a Vercel alias of this same project) serves the API
// reference. It's a separate origin, so it has its own session — users
// sign in there too; the docs gate (auth + the server-side `docs_access`
// allowlist) applies either way.
const isDocsHost = window.location.hostname.startsWith("docs.");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry client-error responses — a 401/403/404/422 won't succeed on
      // a second try; retrying just doubles backend load and delays the error /
      // forced-sign-out path. Retry once for everything else (network, 5xx).
      retry: (count, error) => {
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;
        if (status && [401, 403, 404, 422].includes(status)) return false;
        return count < 1;
      },
      staleTime: 30_000,
    },
  },
});

// Sentry-instrumented <SentryRoutes> — parameterized route names on errors/breadcrumbs.
const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);

// ErrorBoundary fallback. Deliberately shows NO error detail in the DOM (this
// is a PHI screen); the detail goes to Sentry, not the clinician.
function ErrorFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The page hit an unexpected error. Please refresh, or sign in again.
      </p>
    </div>
  );
}

const routePermissions: Partial<Record<string, keyof RolePermissions>> = {
  "/mothers": "view_mothers",
  "/calls": "view_mothers",
  "/staff": "manage_staff",
};

/** Protected page: requires a session + permission, rendered inside the app shell. */
function Protected({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { can, isLoading } = useAuth();
  const required = routePermissions[pathname];

  if (required && !isLoading && !can(required)) {
    return <Navigate to="/dashboard" replace />;
  }

  // While /auth/me is still loading for a permission-gated route, render a
  // loader inside the shell instead of mounting the page — otherwise the page
  // fetches its data and 403s before the post-load redirect can fire.
  const content =
    required && isLoading ? <PageLoading /> : children;

  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={<PageLoading />}>{content}</Suspense>
      </AppShell>
    </RequireAuth>
  );
}

// API docs — gated by sign-in + the server-side `docs_access` allowlist.
// DocsGate requires a session; the gated backend `/openapi.json` returns
// 403 for a non-allowlisted email, which Docs renders as a "No access" state.
const gatedDocs = (
  <DocsGate>
    <Suspense fallback={<DocsLoading />}>
      <Docs />
    </Suspense>
  </DocsGate>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
        <DrawerProvider>
          <TooltipProvider delayDuration={150}>
            <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
              {isDocsHost ? (
                // Docs host: only sign-in + the gated docs. Everything funnels
                // to /docs so the host never exposes the app surface.
                <SentryRoutes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/change-password" element={<ChangePassword />} />
                  <Route path="/docs" element={gatedDocs} />
                  <Route path="*" element={<Navigate to="/docs" replace />} />
                </SentryRoutes>
              ) : (
                <SentryRoutes>
                  {/* Public auth routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/activate" element={<SetupPassword />} />
                  <Route path="/reset" element={<SetupPassword />} />
                  <Route path="/change-password" element={<ChangePassword />} />

                  {/* Protected app */}
                  <Route
                    path="/dashboard"
                    element={
                      <Protected>
                        <Dashboard />
                      </Protected>
                    }
                  />
                  <Route
                    path="/mothers"
                    element={
                      <Protected>
                        <MothersPage />
                      </Protected>
                    }
                  />
                  <Route
                    path="/calls"
                    element={
                      <Protected>
                        <CallsPage />
                      </Protected>
                    }
                  />
                  <Route
                    path="/staff"
                    element={
                      <Protected>
                        <StaffPage />
                      </Protected>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <Protected>
                        <SettingsPage />
                      </Protected>
                    }
                  />

                  {/* API docs — sign-in + server-side docs_access allowlist */}
                  <Route path="/docs" element={gatedDocs} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </SentryRoutes>
              )}
            </Sentry.ErrorBoundary>
          </TooltipProvider>
        </DrawerProvider>
        </AuthProvider>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
