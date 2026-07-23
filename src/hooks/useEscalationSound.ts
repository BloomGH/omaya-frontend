import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { EscalationItem } from "../types";
import { isAlertSoundEnabled } from "../lib/alert-prefs";

// Singleton AudioContext shared across the tab lifetime.
// Creating a new context per chime leaks suspended contexts — browsers cap at
// around 6 and start throwing after that.
let _ctx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  if (!_ctx) {
    _ctx = new AudioContext();
    // Browsers block AudioContext construction in suspended state until a user
    // gesture has occurred (autoplay policy). Wire a one-time gesture listener
    // so the context resumes the first time the clinician interacts — typically
    // already satisfied by the login flow, but this covers tab-restore sessions.
    const resume = () => {
      _ctx?.resume();
      document.removeEventListener("mousedown", resume);
      document.removeEventListener("keydown", resume);
      document.removeEventListener("touchstart", resume);
    };
    document.addEventListener("mousedown", resume, { once: true });
    document.addEventListener("keydown", resume, { once: true });
    document.addEventListener("touchstart", resume, { passive: true, once: true } as AddEventListenerOptions);
  }
  return _ctx;
}

// ─── Audio-blocked external store ────────────────────────────────────────────
// The AudioContext's `state` is an external mutable store (it flips from
// "suspended" to "running" once the autoplay gesture gate is crossed — possibly
// by our own unlock() OR by the module-level one-time gesture listener). React
// reads it via useSyncExternalStore so the "Enable alert sound" affordance shows
// while blocked and hides the instant it unlocks, tear-free under concurrency.

// True when audio can't play yet — the AudioContext hasn't been created, or
// exists but hasn't crossed the autoplay gesture gate. If the API is unavailable
// we report "not blocked" so the enable-sound affordance never dangles with no
// way to resolve it.
function getAudioBlockedSnapshot(): boolean {
  if (typeof AudioContext === "undefined") return false;
  // Pure read — do NOT construct the context here (getSnapshot runs during
  // render). subscribeAudioBlocked constructs it on subscribe; until then a
  // not-yet-created context counts as blocked so the affordance shows promptly.
  return _ctx === null || _ctx.state !== "running";
}

function subscribeAudioBlocked(onChange: () => void): () => void {
  const ctx = getAudioContext();
  if (!ctx || typeof document === "undefined") return () => {};
  ctx.addEventListener("statechange", onChange);
  // A refocus/visibility change is a common moment for the gate to have been
  // crossed elsewhere; cheap to re-check.
  document.addEventListener("visibilitychange", onChange);
  return () => {
    ctx.removeEventListener("statechange", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

// Plays a short two-tone ascending chime (Web Audio API, no files needed).
// Mirrors the "success" cue from the Cuelume library API.
function playSuccessChime() {
  const ctx = getAudioContext();
  // ctx.state === "suspended" means the gesture gate hasn't been crossed yet
  // (rare after login). Let it fail silently — the badge is the primary signal.
  if (!ctx || ctx.state !== "running") return;

  const notes = [
    { freq: 523.25, start: 0 },      // C5
    { freq: 659.25, start: 0.12 },   // E5
  ];
  notes.forEach(({ freq, start }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime + start);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.35);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + 0.38);
  });
}

// ─── OS notification fallback ────────────────────────────────────────────────
// A backgrounded/blurred tab can't rely on the chime being heard (or, on a ward
// monitor, on it playing at all). A Web Notification surfaces the alert at the
// OS level even when the tab isn't focused. Only fires when the browser has
// already GRANTED permission — the request itself is deferred to the same
// user-gesture "enable" affordance, so we never nag on load.
function notificationsGranted(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

function buildAlertSummary(items: EscalationItem[]): { title: string; body: string } {
  // PHI-safe: an OS notification surfaces on a lock screen / notification centre
  // (visible to bystanders, cached in OS history), so it must NOT carry
  // identifying patient data — no name, no postpartum day. The severity tier
  // alone is not identifying and conveys the urgency; the details live behind
  // auth in the portal, one tap away.
  if (items.length === 1) {
    // severity is already a lowercase tier enum ('crisis' | 'elevated' | …).
    return {
      title: `New ${items[0].severity} alert`,
      body: "A patient needs attention — open Omaya to view.",
    };
  }
  return {
    title: `${items.length} new alerts`,
    body: "Open Omaya to view.",
  };
}

function fireOsNotification(newItems: EscalationItem[]) {
  if (!notificationsGranted() || newItems.length === 0) return;
  const { title, body } = buildAlertSummary(newItems);
  try {
    const n = new Notification(title, {
      body,
      // Collapse repeat notifications so a churning poll doesn't stack a pile of
      // OS toasts — the newest replaces the previous.
      tag: "omaya-escalation",
      icon: "/logo.png",
      requireInteraction: true,
    });
    // Focusing the tab is the useful action; the escalations already live on
    // the dashboard the clinician lands on.
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Some browsers throw if a service worker is required for notifications.
    // The chime + badge remain the primary signals; swallow silently.
  }
}

// ─── Hidden-tab title flash ──────────────────────────────────────────────────
// When the tab is backgrounded, briefly rewrite the document title so a glance
// at the tab strip reveals a new alert. Restored the moment the tab regains
// focus. Kept module-level so overlapping alerts don't clobber the saved title.
let _titleFlashOriginal: string | null = null;
let _titleFlashTimer: ReturnType<typeof setTimeout> | null = null;

function restoreTitle() {
  if (_titleFlashOriginal !== null) {
    document.title = _titleFlashOriginal;
    _titleFlashOriginal = null;
  }
  if (_titleFlashTimer !== null) {
    clearTimeout(_titleFlashTimer);
    _titleFlashTimer = null;
  }
}

function flashTitle(newItems: EscalationItem[]) {
  if (typeof document === "undefined" || !document.hidden || newItems.length === 0) return;
  if (_titleFlashOriginal === null) _titleFlashOriginal = document.title;
  const label =
    newItems.length === 1
      ? "🔔 New alert"
      : `🔔 ${newItems.length} new alerts`;
  document.title = `${label} — Omaya Care`;
  // Clear the flash on refocus; also cap it so it self-heals if the visibility
  // listener somehow doesn't fire.
  if (_titleFlashTimer !== null) clearTimeout(_titleFlashTimer);
  _titleFlashTimer = setTimeout(restoreTitle, 60_000);
}

// Plays the chime whenever a genuinely NEW escalation appears (H3). Keyed on the
// originating call_id (stable across the provisional→real-alert transition, so a
// provisional reconciling to its real alert does NOT double-chime). Count-based
// detection missed new alerts when the set churned (one resolved + one new →
// count unchanged) and double-fired on reconcile; id-diffing fixes both.
//
// Returns `audioBlocked` (the autoplay gate hasn't been crossed, so the chime is
// currently silent) and `unlock` — call it from a user gesture to resume the
// AudioContext and, opportunistically, request OS-notification permission. The
// UI renders a small "Enable alert sound" affordance while `audioBlocked` is
// true and hides it once unlocked.
export function useEscalationSound(escalations: EscalationItem[] | undefined) {
  const prevKeys = useRef<Set<string> | null>(null);
  // `audioBlocked` mirrors the AudioContext's suspended/running state — an
  // external store — so the enable-sound affordance appears while blocked and
  // disappears the instant the gate is crossed (by unlock() or any gesture).
  const audioBlocked = useSyncExternalStore(
    subscribeAudioBlocked,
    getAudioBlockedSnapshot,
    getAudioBlockedSnapshot, // server snapshot (SPA — same, and audio is client-only)
  );

  // Restore any flashed title as soon as the clinician returns to the tab.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) restoreTitle();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const unlock = useCallback(() => {
    const ctx = getAudioContext();
    // resume() must be called from within a user gesture (this handler is one).
    // The resulting `statechange` propagates through the external store, so the
    // affordance hides on its own — no manual setState needed here.
    ctx?.resume().catch(() => {});
    // Piggyback the permission request on the same gesture so we never prompt
    // on load. Harmless if already granted/denied.
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const list = escalations ?? [];
    const keys = new Set(list.map((e) => e.callId || e.id));
    // prevKeys must persist across renders for the whole component lifetime —
    // it's how we detect a genuinely new escalation. First run stays silent
    // (prevKeys starts null) so the initial load doesn't chime; after that,
    // collect every escalation whose key is new since the last poll tick.
    if (prevKeys.current !== null) {
      const prev = prevKeys.current;
      const newItems = list.filter((e) => !prev.has(e.callId || e.id));
      if (newItems.length > 0) {
        // Sound is opt-out (mute respected); the OS notification + title flash
        // still fire so a muted clinician on a backgrounded tab isn't left with
        // no signal at all.
        if (isAlertSoundEnabled()) playSuccessChime();
        fireOsNotification(newItems);
        flashTitle(newItems);
      }
    }
    prevKeys.current = keys;
  }, [escalations]);

  return { audioBlocked, unlock };
}
