import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useAlertSoundEnabled } from "../../hooks/useAlertSound";

interface SidebarAlertSoundReminderProps {
  /** Desktop-collapsed sidebar (lg:w-[64px]) — collapse to the bell icon only. */
  collapsed: boolean;
}

/**
 * Persistent bottom-of-sidebar reminder, shown ONLY to escalate-capable
 * clinicians who have MUTED the escalation alert sound. The chime is the
 * de-facto real-time notifier, so a muted clinician is nudged to turn it back
 * on. Dismissible for the session (the ✕) — but the dismiss state is deliberately
 * NOT persisted, so it reappears on the next full reload and re-reminds a still-
 * muted clinician every session. The label deep-links to Settings → Notifications
 * where the real toggle lives; enabling there hides this live (reactive mute
 * state via `useAlertSoundEnabled`).
 */
export const SidebarAlertSoundReminder: React.FC<
  SidebarAlertSoundReminderProps
> = ({ collapsed }) => {
  const navigate = useNavigate();
  const { can } = useAuth();
  const soundOn = useAlertSoundEnabled();
  const [dismissed, setDismissed] = useState(false);

  // Only clinicians who receive alerts, only while muted, only if not dismissed
  // this session.
  if (!can("escalate") || soundOn || dismissed) return null;

  return (
    <div
      className={`mb-2 flex items-center gap-1 rounded-full bg-primary-50 py-1.5 px-3 ${
        collapsed ? "lg:px-0 lg:justify-center" : "justify-between"
      }`}
    >
      <button
        type="button"
        onClick={() => navigate("/settings?section=notifications")}
        aria-label="Alert sound is off — open notification settings"
        className="flex min-w-0 items-center gap-2 text-xs font-medium text-primary hover:text-primary-700 transition-colors"
      >
        <BellRing size={15} className="flex-none" />
        <span className={`truncate whitespace-nowrap ${collapsed ? "lg:hidden" : ""}`}>
          Enable alert sound
        </span>
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss alert sound reminder"
        className={`flex-none p-1 rounded-full text-primary/60 hover:text-primary hover:bg-primary-100 transition-colors ${
          collapsed ? "lg:hidden" : ""
        }`}
      >
        <X size={14} />
      </button>
    </div>
  );
};
