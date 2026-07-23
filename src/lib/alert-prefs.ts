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
  // Notify in-memory subscribers regardless of whether the write landed — the
  // toggle still flipped the intended value for this tab's lifetime, and the
  // NotificationsBell label must track it live. Kept OUTSIDE the try/catch so a
  // storage failure never swallows the notification.
  emit();
}

// ─── Reactive layer ──────────────────────────────────────────────────────────
// The read helpers above stay cheap synchronous localStorage reads (they're hit
// every poll tick and gate a SAFETY chime). This thin pub/sub sits alongside so
// UI can subscribe via useSyncExternalStore and re-render the moment the mute
// choice flips — either in this tab (setAlertSoundEnabled → emit) or another tab
// (the "storage" event). It deliberately holds NO cached value: getSnapshot
// re-reads localStorage, so there's no store state to drift.
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((cb) => cb());
}

// A single shared "storage" listener, ref-counted against the subscriber set, so
// cross-tab mute changes fan out to every local subscriber. Only mounted while
// something is subscribed and torn down when the set empties — no idle listener.
let storageListener: ((e: StorageEvent) => void) | null = null;

/**
 * Subscribe to alert-sound preference changes (same-tab and cross-tab). Returns
 * an unsubscribe that removes the callback and tears down the shared storage
 * listener once no subscribers remain. SSR-safe (no-op without a window).
 */
export function subscribeAlertSound(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(cb);
  if (!storageListener) {
    storageListener = (e: StorageEvent) => {
      // key === null fires on storage.clear() — treat it as "our key may have
      // changed" and re-notify so a cleared preference is picked up too.
      if (e.key === ALERT_SOUND_KEY || e.key === null) emit();
    };
    window.addEventListener("storage", storageListener);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && storageListener) {
      window.removeEventListener("storage", storageListener);
      storageListener = null;
    }
  };
}

/** getSnapshot for useSyncExternalStore — the cheap synchronous read. */
export function getAlertSoundSnapshot(): boolean {
  return isAlertSoundEnabled();
}

// ─── First-login prompt "seen" flag ──────────────────────────────────────────
// Whether we've already offered the one-time "turn on alert sounds" modal. Kept
// separate from the mute preference: a clinician can dismiss the prompt without
// ever touching the sound setting, and we must not nag again.
const ALERT_PROMPT_SEEN_KEY = "omaya_alert_prompt_seen_v1";

/**
 * Whether the first-login alert-sound prompt has already been shown. FAILS CLOSED
 * to "seen": if localStorage is unreadable we must NOT pop a modal we can never
 * record dismissing (it would re-appear every mount).
 */
export function hasSeenAlertPrompt(): boolean {
  try {
    return localStorage.getItem(ALERT_PROMPT_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

/** Record that the first-login prompt has been shown. Best-effort — never throws. */
export function markAlertPromptSeen(): void {
  try {
    localStorage.setItem(ALERT_PROMPT_SEEN_KEY, "1");
  } catch {
    // If the write fails the prompt may re-appear on a future load in this
    // locked-down browser; that's a benign degradation, not a crash.
  }
}
