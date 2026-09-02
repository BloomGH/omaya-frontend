import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { StaffRole, RolePermissions, Me } from "../types";
import { getClinician, setSession, clearMustChange } from "../lib/auth";
import { toMe } from "./useMe";
import { toMother } from "./useMothers";

/**
 * Hook to acknowledge an escalation/alert.
 * Uses POST /alerts/{alert_id}/acknowledge from the API.
 */
export const useAcknowledgeAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const response = await api.post(`/alerts/${alertId}/acknowledge`);
      return response.data;
    },
    onSuccess: () => {
      // Refresh escalations list after acknowledgment
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
    },
  });
};

/**
 * Hook to trigger an ad-hoc check-in call on either transport.
 * Uses POST /mothers/{mother_id}/calls from the API; `route` picks the
 * transport ("phone" = Twilio, "whatsapp" = WhatsApp call). Same call, same
 * pipeline — the backend 409s (`whatsapp_unavailable`) rather than silently
 * falling back to phone.
 */
export type CallRoute = "phone" | "whatsapp";

export const useTriggerCall = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      motherId,
      route = "phone",
      idempotencyKey,
    }: {
      motherId: string;
      route?: CallRoute;
      idempotencyKey: string;
    }) => {
      const response = await api.post(
        `/mothers/${motherId}/calls`,
        { route },
        {
          headers: route === "phone" ? { "Idempotency-Key": idempotencyKey } : undefined,
        },
      );
      return response.data;
    },
    onSuccess: (_data, { motherId }) => {
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      queryClient.invalidateQueries({ queryKey: ["mother", motherId] });
    },
  });
};

/**
 * Hook to ask a mother for WhatsApp call permission.
 * Uses POST /mothers/{mother_id}/whatsapp-call-permission.
 *
 * Meta forbids business-initiated WhatsApp calls without her approval, so this
 * is what unblocks a "no permission" mother. It sends her a message; it does
 * NOT place a call and does NOT grant the permission — she still has to tap
 * Allow, and her reply arrives asynchronously on the messaging webhook. The
 * ["mother", id] invalidation therefore refreshes to `requested`, not
 * `granted`; the flip to `granted` lands on a later refetch.
 */
export interface WhatsAppPermissionAck {
  status: "requested" | "denied" | "error";
  reason?: string | null;
  permission_status?: string | null;
}

export const useRequestWhatsAppPermission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ motherId }: { motherId: string }) => {
      const response = await api.post(`/mothers/${motherId}/whatsapp-call-permission`);
      return response.data as WhatsAppPermissionAck;
    },
    onSuccess: (_data, { motherId }) => {
      queryClient.invalidateQueries({ queryKey: ["mother", motherId] });
    },
  });
};

export const useLogVisit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      motherId,
      clinicalObservation,
      medicationAdvice,
      nextAction,
    }: {
      motherId: string;
      clinicalObservation: string;
      medicationAdvice: string;
      nextAction: string;
    }) => {
      const response = await api.post(`/mothers/${motherId}/visits`, {
        clinical_observation: clinicalObservation,
        medication_advice: medicationAdvice,
        next_action: nextAction,
      });
      return response.data;
    },
    onSuccess: (_data, { motherId }) => {
      queryClient.invalidateQueries({ queryKey: ["mother", motherId] });
    },
  });
};

export const useUpdateMother = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ motherId, data }: { motherId: string; data: Record<string, unknown> }) => {
      const response = await api.patch(`/mothers/${motherId}`, data);
      return response.data as Record<string, unknown>;
    },
    onSuccess: (data, { motherId }) => {
      // Use the returned full profile to update the detail cache immediately (no extra refetch)
      queryClient.setQueryData(["mother", motherId], toMother(data));
      // Invalidate the list so name/phone/severity changes reflect there too
      queryClient.invalidateQueries({ queryKey: ["mothers"] });
    },
  });
};

export const useWithdrawMother = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ motherId, reason }: { motherId: string; reason: string }) => {
      const response = await api.post(`/mothers/${motherId}/withdraw`, {
        reason,
        send_confirmation_sms: true,
      });
      return response.data;
    },
    onSuccess: (_data, { motherId }) => {
      queryClient.invalidateQueries({ queryKey: ["mothers"] });
      queryClient.invalidateQueries({ queryKey: ["mother", motherId] });
    },
  });
};

export const useAddStaff = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; email: string; role: StaffRole }) => {
      const res = await api.post("/admin/clinicians", data);
      return res.data as { clinician_id: string; email: string; invite_sent: boolean; role: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });
};

export const useUpdateClinician = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clinicianId,
      ...body
    }: {
      clinicianId: string;
      name?: string;
      role?: StaffRole;
      status?: "active" | "suspended";
    }) => {
      const res = await api.patch(`/admin/clinicians/${clinicianId}`, body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });
};

export const useDeleteClinician = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clinicianId: string) => {
      await api.delete(`/admin/clinicians/${clinicianId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });
};

export const useAddRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      permissions: RolePermissions;
    }) => {
      const res = await api.post("/admin/roles", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
};

export const useDeleteRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roleId: string) => {
      await api.delete(`/admin/roles/${roleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
};

export const useUpdateMe = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await api.patch("/auth/me", { name });
      return toMe(res.data) as Me;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["me"], data);
      // Keep localStorage clinician name in sync so AppShell reflects the change
      const stored = getClinician();
      if (stored) {
        setSession({ ...stored, name: data.name }, data.mustChangePassword);
      }
    },
  });
};

export const useChangePassword = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const res = await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      return res.data as { token: string; token_type: string; expires_in: number };
    },
    onSuccess: () => {
      // The backend re-set the session cookie with must_change_password
      // cleared; just clear the client-side flag.
      clearMustChange();
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
};
