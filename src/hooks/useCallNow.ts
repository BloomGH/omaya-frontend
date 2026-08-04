import { toast } from "sonner";
import { useTriggerCall, CallRoute } from "./useMutations";

/**
 * Shared "Call now" action for the two places that offer it (the call detail
 * footer and the mother record). Owns the toasts and the error mapping so the
 * two surfaces can't drift apart on what a 409 means.
 *
 * `useTriggerCall` raises no toasts of its own — every message the clinician
 * sees for this action comes from here.
 */
export const useCallNow = (motherId: string) => {
  const triggerCall = useTriggerCall();

  const callNow = async (route: CallRoute) => {
    try {
      const data = await triggerCall.mutateAsync({ motherId, route });
      // Rollback-skew guard: an older backend ignores the body and places a
      // PHONE call. A WhatsApp success toast over a phone call would put a
      // false statement in the clinician's head — check what actually ran.
      if (route === "whatsapp" && (data as { route?: string })?.route !== "whatsapp") {
        toast.warning("A phone call was placed instead — WhatsApp calling isn't available on the server yet.");
        return;
      }
      toast.success(
        route === "whatsapp"
          ? "WhatsApp call triggered. She will receive a call shortly."
          : "Call triggered. She will receive a call shortly.",
      );
    } catch (err: unknown) {
      const resp = (err as {
        response?: { status?: number; data?: { detail?: { error_code?: string; message?: string } } };
      })?.response;
      const status = resp?.status;
      const detail = resp?.data?.detail;
      if (status === 409 && detail?.error_code === "whatsapp_unavailable") {
        toast.error(detail.message ?? "WhatsApp calling is not available for this mother.");
      } else if (status === 409) {
        toast.error("This mother is not active, so a call can't be placed.");
      } else if (status === 403) {
        toast.error("Your role does not have permission to place calls.");
      } else {
        toast.error("Could not trigger call. Please try again.");
      }
    }
  };

  return { callNow, isPending: triggerCall.isPending };
};
