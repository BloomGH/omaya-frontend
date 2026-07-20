import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useEscalations } from "../../hooks/useEscalations";
import { useEscalationSound } from "../../hooks/useEscalationSound";
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
 * `useEscalations` query (and 60s poll) the dashboard uses, so the cache is
 * shared and there's no extra network cost for surfacing the count.
 */
export const NotificationsBell: React.FC = () => {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canEscalate = can("escalate");
  const [notifOpen, setNotifOpen] = useState(false);

  // Escalation alerts carry mother PHI (name, postpartum day). Only roles with
  // the `escalate` permission may see or fetch them — mirrors the Dashboard
  // gate. Passing `enabled` also stops the 60s poll for everyone else.
  const { data: escalations = [], isLoading, isError } = useEscalations({
    enabled: canEscalate,
  });
  const notifCount = escalations.length;
  useEscalationSound(escalations);

  const handleNotifNavigate = () => {
    setNotifOpen(false);
    navigate("/dashboard");
  };

  if (!canEscalate) return null;

  return (
    <>
      {/* a11y: the chime has no visual equivalent for deaf/HoH clinicians —
          announce the alert count to screen readers whenever it changes. */}
      <span className="sr-only" role="status" aria-live="assertive">
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
          {notifCount > 0 && (
            <span className="text-xs font-medium text-gray-400">
              {notifCount} needing attention
            </span>
          )}
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
