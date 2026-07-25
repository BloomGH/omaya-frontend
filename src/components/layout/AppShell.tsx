import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Phone,
  UserCog,
  Settings,
  ChevronsUpDown,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useDrawer } from "../../contexts/DrawerContext";
import { useAuth } from "../../contexts/AuthContext";
import { RolePermissions } from "../../types";
import { getClinician, clearSession, initialsOf } from "../../lib/auth";
import { logout } from "../../lib/auth-api";
import { useSlideIndicator } from "../../hooks/useSlideIndicator";
import { Sheet, SheetContent } from "../../components/ui/sheet";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "../../components/ui/tooltip";
import { Button } from "../../components/ui/Button";
import { NotificationsBell } from "./NotificationsBell";
import { AlertSoundPrompt } from "./AlertSoundPrompt";
import { SidebarAlertSoundReminder } from "./SidebarAlertSoundReminder";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";

const AddMother = lazy(() => import("../../pages/AddMother"));
const NewDischarge = lazy(() => import("../../pages/NewDischarge"));

interface AppShellProps {
  children: React.ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", route: "/dashboard" },
  { icon: Users,           label: "Mothers",   route: "/mothers" },
  { icon: Phone,           label: "Calls",     route: "/calls" },
  { icon: UserCog,         label: "Staff",     route: "/staff" },
];

const navItemPermissions: Record<string, keyof RolePermissions | null> = {
  "/dashboard": null,
  "/mothers": "view_mothers",
  "/calls": "view_mothers",
  "/staff": "manage_staff",
};

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { drawerType, closeDrawer, requestCloseDrawer } = useDrawer();
  const { can } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const visibleNavItems = navItems.filter((item) => {
    const required = navItemPermissions[item.route];
    return required === null || can(required);
  });

  // Sliding active-pill: measure the active nav link and slide a single pill
  // to it instead of statically swapping a background between items.
  const navRef = useRef<HTMLElement>(null);
  const navIndicator = useSlideIndicator(navRef, '[aria-current="page"]', [
    location.pathname,
    sidebarCollapsed,
    visibleNavItems.length,
  ]);

  const clinician = getClinician();
  const displayName = clinician?.name ?? clinician?.email ?? "";
  const roleLabel = clinician?.role ?? "";
  const hospitalName = clinician?.hospital_name ?? "";

  // Browser tab title — scoped to the signed-in hospital while in the app.
  useEffect(() => {
    document.title = hospitalName
      ? `Omaya Care | ${hospitalName}`
      : "Omaya Care";
    return () => {
      document.title = "Omaya Care";
    };
  }, [hospitalName]);

  const handleSignOut = () => {
    // Fire-and-forget. The server still needs the round-trip to clear the
    // HttpOnly session cookie (JS can't), but the clinician must never WAIT on
    // it: `await` here held local cleanup behind the shared 15s request timeout,
    // so on a stalled network the portal stayed visibly signed-in and fully
    // usable after sign-out was confirmed — on a shared clinic device that is
    // precisely the risk sign-out exists to remove. `logout()` swallows its own
    // errors, and navigating does not abort the in-flight request.
    void logout();
    queryClient.removeQueries({ queryKey: ["me"] });
    clearSession();
    navigate("/", { replace: true });
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-white">
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ──────────────────────────────────────────── */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30 lg:z-auto
          ${sidebarCollapsed ? "lg:w-[64px]" : "lg:w-[220px]"}
          w-[220px] flex-none h-full flex flex-col py-4
          bg-white border-r border-gray-200
          transition-[width,transform] duration-200 ease-in-out motion-reduce:transition-none overflow-hidden
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo row */}
        <div className={`pt-2 pb-8 flex items-center px-5 ${sidebarCollapsed ? "lg:justify-center lg:px-0" : "justify-between"}`}>
          <Link
            to="/dashboard"
            className="flex-none hover:opacity-80 transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <img src="/logo.png" className="h-[28px] w-auto object-contain" alt="Omaya Care" />
          </Link>

          {/* Mobile close */}
          <button
            type="button"
            className="lg:hidden text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>

          {/* Desktop collapse toggle */}
          {!sidebarCollapsed && (
            <button
              type="button"
              className="hidden lg:flex text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          )}
        </div>

        {/* Nav items.
            Scoped zero-delay tooltip provider: when the sidebar is collapsed
            the icon labels show on hover, and the global 150ms delay made them
            feel laggy ("appears after staying on one too long"). delayDuration=0
            + disableHoverableContent makes them instant and non-sticky. */}
        <TooltipProvider
          delayDuration={0}
          skipDelayDuration={0}
          disableHoverableContent
        >
        <nav ref={navRef} className="relative flex-1 space-y-1 px-2">
          {/* Sliding active pill — animates between nav items on click. */}
          {navIndicator && (
            <div
              aria-hidden
              className="absolute z-0 rounded-lg bg-primary-100 transition-transform duration-300 ease-out pointer-events-none"
              style={{
                top: 0,
                left: navIndicator.left,
                width: navIndicator.width,
                height: navIndicator.height,
                transform: `translateY(${navIndicator.top}px)`,
              }}
            />
          )}
          {/* Expand toggle when collapsed */}
          {sidebarCollapsed && (
            <div className="hidden lg:flex justify-center mb-3">
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-md hover:bg-gray-100"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen size={18} />
              </button>
            </div>
          )}

          {visibleNavItems.map((item) => (
            <NavLink
              key={item.route}
              to={item.route}
              onClick={() => setMobileSidebarOpen(false)}
              className={({ isActive }) => `
                relative z-10 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm group
                transition-[color,background-color,transform] duration-200 ease-out
                ${
                  isActive
                    ? "text-primary font-medium"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 hover:translate-x-0.5 font-normal"
                }
                focus-visible:ring-0 focus-visible:outline-none
              `}
            >
              {({ isActive }) => {
                const content = (
                  <div className="flex items-center gap-3">
                    <item.icon
                      size={18}
                      className={`flex-none transition-colors duration-200 ease-out ${isActive ? "text-primary" : "text-gray-400 group-hover:text-gray-500"}`}
                    />
                    <span
                      className={`whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
                        sidebarCollapsed
                          ? "lg:max-w-0 lg:opacity-0"
                          : "max-w-[160px] opacity-100"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                );
                // Only mount the tooltip when the sidebar is collapsed and the
                // label is hidden — that's the one case it's needed. Mounting a
                // portalled Radix tooltip on every item in the expanded view is
                // pure overhead and what caused the laggy hover-pop.
                if (!sidebarCollapsed) return content;
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }}
            </NavLink>
          ))}
        </nav>
        </TooltipProvider>

        {/* Bottom section */}
        <div className="mt-auto px-2">
          {/* Muted-sound reminder — only for escalate-capable clinicians who have
              turned the alert chime off. Sits above the profile row at the very
              bottom of the sidebar. */}
          <SidebarAlertSoundReminder collapsed={sidebarCollapsed} />

          {/* Profile popover */}
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <div className="w-8 h-8 bg-primary rounded-full flex-none flex items-center justify-center text-white text-xs font-semibold">
                  {initialsOf(clinician)}
                </div>
                <div
                  className={`flex flex-col min-w-0 overflow-hidden transition-[max-width,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
                    sidebarCollapsed
                      ? "lg:max-w-0 lg:opacity-0 flex-1"
                      : "max-w-[160px] opacity-100 flex-1"
                  }`}
                >
                  <span className="text-sm font-medium text-gray-700 truncate whitespace-nowrap">{displayName}</span>
                  <span className="text-xs font-normal text-gray-400 truncate whitespace-nowrap">{roleLabel}</span>
                </div>
                <ChevronsUpDown
                  size={14}
                  className={`text-gray-400 flex-none transition-opacity duration-200 motion-reduce:transition-none ${sidebarCollapsed ? "lg:opacity-0" : "opacity-100"}`}
                />
              </div>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="w-48 p-1"
              sideOffset={8}
            >
              <Link
                to="/settings"
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
              >
                <Settings size={15} />
                <span>Settings</span>
              </Link>
              <div className="h-px bg-gray-100 my-1" />
              <button
                type="button"
                onClick={() => setSignOutOpen(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <LogOut size={15} />
                <span>Sign out</span>
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <main className="flex-1 bg-surface-app relative flex flex-col lg:rounded-tl-2xl lg:shadow-[-6px_0_20px_-6px_rgba(0,0,0,0.12)] overflow-y-auto">
        {/* Mobile top bar — logo + menu toggle. The bell floats top-right
            (below), so it's not repeated here. */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 flex-shrink-0">
          <img src="/logo.png" className="h-7 w-auto object-contain" alt="Omaya Care" />
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open menu"
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            <Menu size={22} />
          </button>
        </div>

        {/* Global notifications bell — floats top-right so it lines up with
            the first line of the page (e.g. the dashboard date). */}
        <div className="absolute top-3 right-4 lg:top-4 lg:right-4 z-10">
          <NotificationsBell />
        </div>

        {/* react-doctor-disable-next-line react-doctor/no-transition-all -- animate-in enter keyframe (duration-N is animation-duration), not a CSS transition:all */}
        <div
          key={location.pathname}
          className="flex flex-1 flex-col min-h-0 px-4 lg:px-6 pt-4 lg:pt-6 pb-4 lg:pb-6 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
        >
          {children}
        </div>
      </main>

      {/* ── ONBOARDING DRAWER ────────────────────────────────── */}
      <Sheet open={!!drawerType} onOpenChange={(open) => !open && requestCloseDrawer()}>
        <SheetContent
          side="right"
          className="w-full sm:w-[580px] p-0 gap-0 sm:max-w-none [&>button]:hidden"
          overlayClassName="bg-black/40"
        >
          <Suspense fallback={
            <div className="w-full sm:w-[580px] h-full bg-white flex flex-col">
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex-shrink-0">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-5 bg-gray-200 rounded-lg animate-pulse" />
              </div>
              <div className="flex-1 px-4 sm:px-8 py-6 sm:py-10 space-y-4">
                <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-64 bg-gray-100 rounded animate-pulse" />
                <div className="h-20 bg-gray-50 rounded-xl" />
                <div className="h-20 bg-gray-50 rounded-xl" />
              </div>
              <div className="border-t border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex justify-between flex-shrink-0">
                <div className="h-9 w-20 bg-gray-200 rounded-md animate-pulse" />
                <div className="h-9 w-32 bg-gray-200 rounded-md animate-pulse" />
              </div>
            </div>
          }>
            {drawerType === "add-mother" && <AddMother onClose={closeDrawer} />}
            {drawerType === "discharge" && can("create_discharges") && <NewDischarge onClose={closeDrawer} />}
          </Suspense>
        </SheetContent>
      </Sheet>

      {/* ── SIGN-OUT CONFIRMATION ────────────────────────────── */}
      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Sign out?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-1">
              You'll be returned to the login screen and will need to sign in
              again to continue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setSignOutOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut size={16} />
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── FIRST-LOGIN ALERT-SOUND PROMPT ───────────────────── */}
      {/* AppShell sits behind Protected and wraps every page, so mounting here
          yields exactly one instance. Self-gated: only shows once, only for
          roles that can act on escalations. */}
      <AlertSoundPrompt />
    </div>
  );
};
