// Client-side preference for the in-app escalation alert sound. Persisted in
// localStorage (mirrors the auth.ts key convention) so a clinician's mute
// choice survives refreshes. Defaults to ON — silence must be opted into, never
// the accidental default, because this chime is the de-facto real-time notifier
// (the escalation SMS pages don't reach Ghana clinicians).
const ALERT_SOUND_KEY = "omaya_alert_sound_v1";

/** Whether the escalation chime is enabled. Defaults to true (unset = on). */
export function isAlertSoundEnabled(): boolean {
  return localStorage.getItem(ALERT_SOUND_KEY) !== "0";
}

/** Persist the enable/mute choice. */
export function setAlertSoundEnabled(enabled: boolean): void {
  localStorage.setItem(ALERT_SOUND_KEY, enabled ? "1" : "0");
}
