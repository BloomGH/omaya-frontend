// Client-side preference for the in-app escalation alert sound. Persisted in
// localStorage (mirrors the auth.ts key convention) so a clinician's mute
// choice survives refreshes. Defaults to ON — silence must be opted into, never
// the accidental default, because this chime is the de-facto real-time notifier
// (the escalation SMS pages don't reach Ghana clinicians).
const ALERT_SOUND_KEY = "omaya_alert_sound_v1";

/** Whether the escalation chime is enabled. Defaults to true (unset = on). */
export function isAlertSoundEnabled(): boolean {
  // localStorage can throw (private mode, quota, locked-down webview). This is
  // read every poll tick and gates a SAFETY chime, so a storage error must never
  // suppress it — fail to the default-on.
  try {
    return localStorage.getItem(ALERT_SOUND_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Persist the enable/mute choice. Best-effort — never throws into the caller. */
export function setAlertSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ALERT_SOUND_KEY, enabled ? "1" : "0");
  } catch {
    // A storage failure just means the choice doesn't survive a refresh; the
    // Settings toggle must not blow up over it.
  }
}
