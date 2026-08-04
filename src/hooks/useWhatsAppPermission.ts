import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRequestWhatsAppPermission } from "./useMutations";

/**
 * Shared "ask her for WhatsApp call permission" action for the two surfaces
 * that offer it (the call detail footer and the mother record) — the sibling
 * of `useCallNow`, and for the same reason: the two surfaces must not drift on
 * what a denial means.
 *
 * Every toast the clinician sees for this action comes from here; the mutation
 * raises none of its own.
 */

/** Meta's ask limits are per business↔mother pair, not per clinician — so a
 *  cooldown message must not read as "your account is rate limited". */
const REASON_COPY: Record<string, string> = {
  already_granted: "She has already allowed WhatsApp calls.",
  cooldown_24h: "WhatsApp allows only one permission request per day. Try again tomorrow.",
  cooldown_7d: "WhatsApp allows only two permission requests per week. Try again in a few days.",
  ask_in_flight: "Another request for this mother is already being sent.",
  no_phone: "No phone number on file for this mother.",
};

/** Server-side reasons that no amount of clicking will fix — they need someone
 *  to change configuration, not a retry. */
const NON_RETRYABLE = new Set(["send_secret_unconfigured"]);

/** How long to hold the action shut after a failed send. The send is not
 *  idempotent from the clinician's side: an immediate re-arm invites a second
 *  ask that costs one of Meta's two weekly slots for this mother. */
const RETRY_COOLOFF_MS = 60_000;

export type AskBlock = "cooloff" | "unconfigured";

export const useRequestWhatsAppCallPermission = (motherId: string) => {
  const request = useRequestWhatsAppPermission();
  const [blocked, setBlocked] = useState<AskBlock | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear on unmount and whenever the panel switches mother — a cooloff earned
  // by one mother must not silently disable the action for the next one.
  useEffect(() => {
    setBlocked(null);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [motherId]);

  const holdShut = (kind: AskBlock) => {
    setBlocked(kind);
    if (timer.current) clearTimeout(timer.current);
    // A misconfigured server stays shut for this mount: re-arming would just
    // invite the same failure with the same useless "try again" copy.
    if (kind === "cooloff") {
      timer.current = setTimeout(() => setBlocked(null), RETRY_COOLOFF_MS);
    }
  };

  const requestPermission = async () => {
    try {
      const data = await request.mutateAsync({ motherId });
      if (data?.status === "requested") {
        // Deliberately not "she can now be called": the grant is hers to give,
        // and it arrives later. Promising availability here would have the
        // clinician click WhatsApp call and hit a refusal.
        toast.success(
          "Request sent. She'll get a WhatsApp message asking to allow calls — the WhatsApp call option unlocks once she accepts.",
        );
        return;
      }
      const reason = data?.reason ?? "";
      if (data?.status === "error") {
        // The send failed server-side but still returns 200, so React Query
        // calls this a success and re-enables the item. Without the hold below
        // the clinician gets an identical-looking button and a "try again" that
        // changes nothing — the documented-likely outcome while the vendor
        // transport for interactive messages is unproven.
        if (NON_RETRYABLE.has(reason)) {
          holdShut("unconfigured");
          toast.error(
            "WhatsApp permission requests aren't configured on this server. Report this — retrying won't help.",
          );
          return;
        }
        holdShut("cooloff");
        toast.error("The message couldn't be sent to WhatsApp. You can try again in a minute.");
        return;
      }
      toast.error(REASON_COPY[reason] ?? "Could not send the permission request. Please try again.");
    } catch (err: unknown) {
      const resp = (err as {
        response?: { status?: number; data?: { detail?: { error_code?: string; message?: string } } };
      })?.response;
      const status = resp?.status;
      const errorCode = resp?.data?.detail?.error_code;
      if (status === 409) {
        toast.error(
          "She can't be contacted on WhatsApp. Check that her consent is active and WhatsApp is switched on for her.",
        );
      } else if (status === 403) {
        toast.error("Your role does not have permission to message mothers.");
      } else if (status === 404 && errorCode === "mother_not_found") {
        // Distinguished from the endpoint-missing 404 below: telling a
        // clinician "not available on this server" when the mother was simply
        // transferred out sends her chasing a phantom deployment problem.
        toast.error("This mother's record is no longer available.");
      } else if (status === 404) {
        toast.error("WhatsApp permission requests aren't available on this server yet.");
      } else {
        // No `response` at all means the axios timeout fired — the send may
        // still be in flight, so hold shut rather than inviting a duplicate.
        if (!resp) holdShut("cooloff");
        toast.error("Could not send the permission request. Please try again.");
      }
    }
  };

  return { requestPermission, isPending: request.isPending, blocked };
};
