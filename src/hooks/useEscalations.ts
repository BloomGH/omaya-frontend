import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { EscalationItem, PageStatus } from "../types";

// Live-alert SLO: a new crisis (including a provisional crisis alert) must
// surface in the dashboard/bell within ~15s, so we poll at this cadence even
// while the list is empty — otherwise the FIRST crisis after a quiet period
// could take up to a minute to appear.
const LIVE_ALERT_POLL_MS = 15000;

function toEscalation(raw: Record<string, unknown>): EscalationItem {
  return {
    id: raw.id as string,
    callId: (raw.call_id as string) ?? "",
    motherName: (raw.mother_name as string) ?? "",
    dayPostpartum: (raw.day_postpartum as number) ?? 0,
    severity: (raw.severity as EscalationItem["severity"]) ?? "routine",
    timeLeftMinutes: (raw.time_left_minutes as number) ?? 0,
    createdAt: (raw.created_at as string) ?? "",
    pageStatus: (raw.page_status as PageStatus) ?? "not_applicable",
  };
}

export const useEscalations = (options?: { enabled?: boolean }) => {
  return useQuery<EscalationItem[]>({
    queryKey: ["escalations"],
    queryFn: async () => {
      const response = await api.get("/alerts");
      return ((response.data.alerts as Record<string, unknown>[]) ?? []).map(
        toEscalation,
      );
    },
    // Poll at the live-alert cadence (~15s) whether or not there are currently
    // active escalations, so the first crisis after a quiet period surfaces
    // within the SLO rather than waiting up to a minute for the next poll.
    refetchInterval: LIVE_ALERT_POLL_MS,
    // Keep polling while the tab is backgrounded/hidden (React Query pauses the
    // interval by default when the tab isn't visible). This in-app alert is the
    // de-facto only real-time notifier — a crisis arriving while a clinician is
    // on another tab must still be detected (chime on refocus + OS notification
    // now, not only when they happen to look back).
    refetchIntervalInBackground: true,
    // Callers without the `escalate` permission must not fetch escalation data
    // (it contains mother PHI). Defaults to enabled for the dashboard.
    enabled: options?.enabled ?? true,
  });
};
