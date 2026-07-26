import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Call } from "../types";

function toCall(raw: Record<string, unknown>): Call {
  return {
    id: raw.id as string,
    motherId: raw.mother_id as string,
    motherName: raw.mother_name as string,
    callType: raw.call_type as string,
    status: raw.status as Call["status"],
    scheduledAt: raw.scheduled_at as string,
    durationSeconds: raw.duration_seconds as number | undefined,
    dayInCare: raw.day_in_care as number | undefined,
    deliveryType: raw.delivery_type as string | undefined,
    flagsRaised: raw.flags_raised as number | undefined,
    severity: raw.severity as Call["severity"],
    summary: raw.summary as string | undefined,
    transcript: raw.transcript as Call["transcript"],
    audioUrl: raw.audio_url as string | undefined,
    channel: raw.channel as Call["channel"],
  };
}

export const useCalls = (date?: string) => {
  return useQuery<Call[]>({
    queryKey: ["calls", date ?? "all"],
    queryFn: async () => {
      const params: Record<string, string | boolean> = date
        ? { date }
        : { all_dates: true };
      const response = await api.get("/calls", { params });
      const raw = (response.data.calls ?? []) as Record<string, unknown>[];
      return raw.map(toCall);
    },
  });
};

export const useCall = (id: string) => {
  return useQuery<Call | null>({
    queryKey: ["call", id],
    queryFn: async () => {
      const response = await api.get(`/calls/${id}`);
      return response.data ? toCall(response.data as Record<string, unknown>) : null;
    },
    enabled: !!id,
  });
};
