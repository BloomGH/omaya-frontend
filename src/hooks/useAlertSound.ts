import { useSyncExternalStore } from "react";
import {
  subscribeAlertSound,
  getAlertSoundSnapshot,
} from "../lib/alert-prefs";

/**
 * Live-reactive read of the alert-sound (mute) preference. Mirrors the
 * `useSyncExternalStore` pattern in useEscalationSound's audio-blocked store:
 * getSnapshot is the cheap synchronous localStorage read, and subscribe wires
 * both same-tab (setAlertSoundEnabled → emit) and cross-tab ("storage" event)
 * updates, so a component like the NotificationsBell relabels the instant the
 * mute choice flips anywhere. The server snapshot reuses getSnapshot — this is a
 * client-only SPA and the preference is client-side, so there's no divergence.
 */
export function useAlertSoundEnabled(): boolean {
  return useSyncExternalStore(
    subscribeAlertSound,
    getAlertSoundSnapshot,
    getAlertSoundSnapshot,
  );
}
