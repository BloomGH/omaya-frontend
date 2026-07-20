import { useEffect, useRef } from "react";
import { EscalationItem } from "../types";

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

// Plays the chime whenever a genuinely NEW escalation appears (H3). Keyed on the
// originating call_id (stable across the provisional→real-alert transition, so a
// provisional reconciling to its real alert does NOT double-chime). Count-based
// detection missed new alerts when the set churned (one resolved + one new →
// count unchanged) and double-fired on reconcile; id-diffing fixes both.
export function useEscalationSound(escalations: EscalationItem[] | undefined) {
  const prevKeys = useRef<Set<string> | null>(null);

  useEffect(() => {
    const keys = new Set((escalations ?? []).map((e) => e.callId || e.id));
    // prevKeys must persist across renders for the whole component lifetime —
    // it's how we detect a genuinely new escalation. First run stays silent
    // (prevKeys starts null) so the initial load doesn't chime; after that,
    // chime once if ANY key is new since the last poll tick.
    if (prevKeys.current !== null) {
      for (const k of keys) {
        if (!prevKeys.current.has(k)) {
          playSuccessChime();
          break;
        }
      }
    }
    prevKeys.current = keys;
  }, [escalations]);
}
