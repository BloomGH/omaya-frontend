import { useRef } from "react";
import { toast } from "sonner";
import { useTriggerCall, CallRoute } from "./useMutations";

type KeyRef = { current: string | null };

/** Keep a phone action's key across transport retries, but not new actions. */
export const stableCallIdempotencyKey = (ref: KeyRef): string => {
  if (ref.current === null) ref.current = crypto.randomUUID();
  return ref.current;
};

export const callNowErrorMessage = (status?: number, errorCode?: string): string => {
  if (status === 409 && errorCode === "whatsapp_unavailable") {
    return "WhatsApp calling is not available for this mother.";
  }
  if (status === 409 && errorCode === "call_in_flight") {
    return "A call for this mother is already queued or in progress.";
  }
  if (status === 409) return "This mother is not active, so a call can't be placed.";
  if (status === 403) return "Your role does not have permission to place calls.";
  return "Could not trigger call. Please try again.";
};

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
  const phoneRetryKey = useRef<string | null>(null);

  const callNow = async (route: CallRoute) => {
    // Keep one key for this user action so a transport retry replays the
    // original queue row instead of minting a second human call.
    const idempotencyKey =
      route === "phone"
        ? stableCallIdempotencyKey(phoneRetryKey)
        : crypto.randomUUID();
    try {
      const data = await triggerCall.mutateAsync({ motherId, route, idempotencyKey });
      if (route === "phone") phoneRetryKey.current = null;
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
      toast.error(
        detail?.error_code === "whatsapp_unavailable" && detail.message
          ? detail.message
          : callNowErrorMessage(status, detail?.error_code),
      );
      // Preserve the key only for transport failures, where retrying the same
      // user action must replay the original request. Any HTTP response is a
      // definitive server outcome and ends this action.
      if (route === "phone" && status !== undefined) phoneRetryKey.current = null;
    }
  };

  return { callNow, isPending: triggerCall.isPending };
};
