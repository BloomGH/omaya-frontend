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

// Plays the chime whenever the number of active escalations increases.
// Skips the initial load so the sound only fires on genuinely new arrivals.
export function useEscalationSound(escalations: EscalationItem[] | undefined) {
  const prevCount = useRef<number | null>(null);

  useEffect(() => {
    const count = escalations?.length ?? 0;
    // prevCount must persist across renders for the whole component lifetime —
    // it's how we detect a genuinely new escalation. Do NOT reset it in a
    // cleanup: the effect re-runs precisely when `escalations` changes (i.e. a
    // new alert arrives), so a cleanup that nulls the ref would fire first and
    // suppress the very chime this hook exists to play. First run stays silent
    // because prevCount starts null.
    if (prevCount.current !== null && count > prevCount.current) {
      playSuccessChime();
    }
    prevCount.current = count;
  }, [escalations]);
}
