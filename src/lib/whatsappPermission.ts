/**
 * Copy for WhatsApp call-permission state, shared by the two surfaces that
 * render it (the call detail footer and the mother record) so they cannot
 * drift on what a status word means to a clinician.
 *
 * The raw vocabulary is Meta's, mirrored on the backend; a midwife should not
 * have to learn it. "no permission" in particular read as a system fault
 * rather than "she hasn't been asked yet", which is what it actually means.
 */

/** Why the WhatsApp call option is unavailable, phrased as her state. */
export function permissionLabel(status?: string): string {
  switch (status) {
    case undefined:
    case "":
      return "not asked yet";
    case "requested":
      return "waiting for her reply";
    case "denied":
      return "she declined";
    case "expired":
      return "permission expired";
    case "revoked":
      return "she turned calls off";
    default:
      // An unknown status is still information — show it rather than
      // flattening it to a wrong label.
      return status;
  }
}

/** Why the "ask her" action itself is currently unavailable. `undefined` when
 *  there is nothing to explain (the action is clickable). */
export function askBlockedLabel(reason?: string): string | undefined {
  switch (reason) {
    case "cooldown_24h":
      return "already asked today";
    case "cooldown_7d":
      return "weekly limit reached";
    case "ask_in_flight":
      return "already sending";
    case "no_phone":
      return "no phone number";
    case "withdrawn":
    case "mother_not_active":
      return "consent not active";
    case "not_opted_in":
      return "WhatsApp not enabled for her";
    default:
      return undefined;
  }
}

/** Why the action is held shut by the LAST attempt rather than by her state.
 *  Takes precedence over `askBlockedLabel` — it is the more recent fact. */
export function askHeldLabel(blocked?: "cooloff" | "unconfigured" | null): string | undefined {
  switch (blocked) {
    case "cooloff":
      return "send failed — retry shortly";
    case "unconfigured":
      return "not configured on this server";
    default:
      return undefined;
  }
}
