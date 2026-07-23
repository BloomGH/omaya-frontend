import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellRing } from "lucide-react";
import { useEscalations } from "../../hooks/useEscalations";
import { useEscalationSound } from "../../hooks/useEscalationSound";
import { useAlertSoundEnabled } from "../../hooks/useAlertSound";
import { useAuth } from "../../contexts/AuthContext";
import { getSeverityTokens } from "../../lib/badge-helpers";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";

/**
 * Global notifications bell. Lives in the top bar so it's reachable from every
 * page. Open escalation alerts double as the in-app notifications — the same
 * `useEscalations` query (and 15s poll) the dashboard uses, so the cache is
 * shared and there's no extra network cost for surfacing the count.
 */
export const NotificationsBell: React.FC = () => {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canEscalate = can("escalate");
  const [notifOpen, setNotifOpen] = useState(false);

  // Escalation alerts carry mother PHI (name, postpartum day). Only roles with
  // the `escalate` permission may see or fetch them — mirrors the Dashboard
  // gate. Passing `enabled` also stops the 15s poll for everyone else.
  const { data: escalations = [], isLoading, isError } = useEscalations({
    enabled: canEscalate,
  });
  const notifCount = escalations.length;
  // Drives the alert chime (the hook's own effect plays it on each new
  // escalation) and exposes `audioBlocked` (autoplay gate uncrossed → chime
  // silently inert) + `resumeAudio` (cross that gate on a gesture, audio-only, no
  // permission dialog). We use `resumeAudio` (not `unlock`) on the link so the
  // notification-permission prompt stays on the Settings toggle / first-login
  // modal and never pops mid-navigation.
  const { audioBlocked, resumeAudio } = useEscalationSound(escalations);

  // Live-reactive mute state so the header link reflects the CURRENT setting
  // (re-labels the instant it's toggled — here, in Settings, or in another tab).
  const soundOn = useAlertSoundEnabled();
  // The chime is only truly audible when the pref is ON *and* the autoplay gate
  // has been crossed. Labelling off the pref alone would read "Disable" on a
  // just-restored ward monitor that's never been clicked — asserting sound is
  // armed when it's silently blocked. Fold in `audioBlocked` so the label never
  // over-promises; any click (incl. navigating to Settings) crosses the gate.
  const effectivelyOn = soundOn && !audioBlocked;
  const soundLinkLabel = effectivelyOn ? "Disable alert sound" : "Enable alert sound";

  const handleNotifNavigate = () => {
    setNotifOpen(false);
    navigate("/dashboard");
  };

  // The alert-sound link deep-links to Settings → Notifications (the one place
  // that shows the real mute toggle) rather than flipping the pref inline. But it
  // DOES cross the browser autoplay gate on this click via `resumeAudio()`: the
  // one-shot passive gesture listener may already be spent (e.g. a backgrounded
  // ward monitor whose AudioContext re-suspended), in which case only an explicit
  // resume here makes the chime audible again. Audio-only — no permission dialog,
  // so it never disrupts the destination scroll.
  const handleEnableSound = () => {
    resumeAudio();
    setNotifOpen(false);
    navigate("/settings?section=notifications");
  };

  if (!canEscalate) return null;

  return (
    <>
      {/* a11y: the chime has no visual equivalent for deaf/HoH clinicians —
          announce the alert count to screen readers whenever it changes.
          Polite (role="status" is implicitly polite) so re-announcing on every
          count change — including when alerts are acknowledged — doesn't
          interrupt or clear the screen reader's queued speech. */}
      <span className="sr-only" role="status" aria-live="polite">
        {notifCount > 0
          ? `${notifCount} escalation alert${notifCount === 1 ? "" : "s"} needing attention`
          : ""}
      </span>
      <Popover open={notifOpen} onOpenChange={setNotifOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            notifCount > 0
              ? `Notifications, ${notifCount} needing attention`
              : "Notifications"
          }
          className="bell-trigger p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors relative"
        >
          <Bell size={18} className="bell-swing" />
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 bg-primary text-white text-[9px] font-bold leading-[15px] text-center rounded-full">
              {notifCount > 9 ? "9+" : notifCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-80 p-0 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-900">
            Notifications
          </span>
          {/* Right of the title, in line with it: a persistent link to the
              alert-sound setting. Label tracks the live mute state ("Enable" vs
              "Disable"). Routes to Settings → Notifications (the source of truth
              for the toggle) and crosses the browser autoplay gate on the
              gesture. Keeps the BellRing icon in both states — the click routes
              to Settings, it doesn't mute inline, so a BellOff would mislead. */}
          <button
            type="button"
            onClick={handleEnableSound}
            aria-label={`Alert sound ${effectivelyOn ? "on" : "off"} — open notification settings`}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-700 transition-colors"
          >
            <BellRing size={13} className="flex-none" />
            <span className="whitespace-nowrap">{soundLinkLabel}</span>
          </button>
        </div>

        {isError ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center">
            <Bell size={22} className="text-gray-300" />
            <p className="text-sm font-medium text-gray-500">
              Couldn't load alerts
            </p>
            <p className="text-xs font-normal text-gray-400">
              Retrying automatically — check your connection.
            </p>
          </div>
        ) : isLoading && notifCount === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center">
            <Bell size={22} className="text-gray-300 animate-pulse" />
            <p className="text-sm font-medium text-gray-500">Loading alerts…</p>
          </div>
        ) : notifCount === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center">
            <Bell size={22} className="text-gray-300" />
            <p className="text-sm font-medium text-gray-500">
              You're all caught up
            </p>
            <p className="text-xs font-normal text-gray-400">
              Crisis and elevated alerts will appear here.
            </p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto py-1">
            {escalations.map((item) => {
              const tokens = getSeverityTokens(item.severity);
              const overdue = item.timeLeftMinutes <= 0;
              const timeLabel = overdue
                ? "Overdue"
                : item.timeLeftMinutes < 60
                  ? `${item.timeLeftMinutes}m left`
                  : `${Math.floor(item.timeLeftMinutes / 60)}h left`;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={handleNotifNavigate}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-start gap-2.5"
                >
                  <span
                    className={`mt-1 shrink-0 w-2 h-2 rounded-full ${tokens.dot}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {item.motherName}
                      </span>
                      <span
                        className={`text-xs font-medium shrink-0 ${overdue ? "text-red-600" : "text-gray-400"}`}
                      >
                        {timeLabel}
                      </span>
                    </div>
                    <span className="text-xs font-normal text-gray-500">
                      {item.severity.charAt(0).toUpperCase() +
                        item.severity.slice(1)}
                      {" · "}Day {item.dayPostpartum}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={handleNotifNavigate}
          className="w-full px-4 py-2.5 border-t border-gray-100 text-xs font-medium text-primary hover:bg-gray-50 transition-colors text-center"
        >
          View all on dashboard
        </button>
      </PopoverContent>
    </Popover>
    </>
  );
};
