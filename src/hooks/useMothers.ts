import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Mother, CheckIn, EmergencyContact, WhatsAppCallInfo } from "../types";

function toWhatsAppCallInfo(raw: unknown): WhatsAppCallInfo | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const wc = raw as Record<string, unknown>;
  return {
    available: Boolean(wc.available),
    permissionStatus: (wc.permission_status as string) ?? undefined,
    permissionExpiresAt: (wc.permission_expires_at as string) ?? undefined,
    canRequestPermission: Boolean(wc.can_request_permission),
    canRequestReason: (wc.can_request_reason as string) ?? undefined,
  };
}

export function toMother(raw: Record<string, unknown>): Mother {
  return {
    id: raw.id as string,
    name: raw.name as string,
    phone: (raw.phone as string) ?? "",
    hospital: (raw.hospital as string) ?? "",
    midwife: (raw.midwife as string) ?? "",
    severity: raw.severity as Mother["severity"],
    consentStatus: raw.consent_status as Mother["consentStatus"],
    consentRecording: raw.consent_recording as boolean | undefined,
    lastInteraction: (raw.last_interaction as string) ?? "",
    note: (raw.note as string) ?? "",
    currentFlag: (raw.current_flag as string) ?? undefined,
    nextCallAt: (raw.next_call_at as string) ?? undefined,
    checkIns: ((raw.check_ins as Record<string, unknown>[]) ?? []).map(
      (ci): CheckIn => ({
        id: ci.id as string,
        date: ci.date as string,
        day: ci.day as number,
        summary: ci.summary as string,
        severity: ci.severity as CheckIn["severity"],
      }),
    ),
    deliveryType: raw.delivery_type as Mother["deliveryType"],
    deliveryDate: (raw.delivery_date as string) ?? undefined,
    dischargeDate: (raw.discharge_date as string) ?? "",
    dayPostpartum: (raw.day_postpartum as number) ?? 0,
    dateOfBirth: (raw.date_of_birth as string) ?? undefined,
    gravida: raw.gravida as number | undefined,
    para: raw.para as number | undefined,
    language: (raw.language as string) ?? undefined,
    medications: (raw.medications as string[]) ?? undefined,
    risks: (raw.risks as string[]) ?? undefined,
    preferredCallWindow: (raw.preferred_call_window as Mother["preferredCallWindow"]) ?? undefined,
    emergencyContacts: ((raw.emergency_contacts as Record<string, unknown>[]) ?? []).map(
      (ec): EmergencyContact => ({
        name: (ec.name as string) ?? "",
        phone: (ec.phone as string) ?? "",
        relationship: (ec.relationship as string) ?? "",
      }),
    ),
    emergencyContactName: (raw.emergency_contact_name as string) ?? undefined,
    emergencyContactPhone: (raw.emergency_contact_phone as string) ?? undefined,
    emergencyContactRelationship: (raw.emergency_contact_relationship as string) ?? undefined,
    whatsappCall: toWhatsAppCallInfo(raw.whatsapp_call),
  };
}

export const useMothers = () => {
  return useQuery<Mother[]>({
    queryKey: ["mothers"],
    queryFn: async () => {
      const response = await api.get("/mothers");
      const raw = response.data.mothers as Record<string, unknown>[];
      return (raw ?? []).map(toMother);
    },
  });
};

export const useMother = (id: string) => {
  return useQuery<Mother | null>({
    queryKey: ["mother", id],
    queryFn: async () => {
      const response = await api.get(`/mothers/${id}`);
      const raw = response.data as Record<string, unknown>;
      return raw ? toMother(raw) : null;
    },
    enabled: !!id,
  });
};
