import React, { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { useEscalationSound } from "../../hooks/useEscalationSound";
import {
  isAlertSoundEnabled,
  setAlertSoundEnabled,
  hasSeenAlertPrompt,
  markAlertPromptSeen,
} from "../../lib/alert-prefs";

/**
 * One-time first-login prompt that offers to turn on the escalation alert
 * sound (and, via `unlock`, OS-notification permission) on a genuine user
 * gesture — the click of the primary button. It exists because both signals are
 * gated: audio needs a gesture to cross the browser autoplay policy, and OS
 * notifications need an explicit permission grant. Surfacing one clear modal on
 * first login is a far better moment to ask than nagging on every page.
 *
 * Only shown to roles that can act on escalations, and only once ever
 * (persisted via markAlertPromptSeen). Every dismissal path records "seen" so it
 * can never re-appear. Mounted once in AppShell.
 */
export const AlertSoundPrompt: React.FC = () => {
  const { can } = useAuth();
  const canEscalate = can("escalate");

  // `unlock` is the SINGLE source of truth for resuming audio + requesting
  // notification permission (stable, gesture-safe, idempotent). Passing
  // `undefined` means the hook never chimes on this mount — this component isn't
  // watching escalations, it only borrows the gesture-safe `unlock`.
  const { unlock } = useEscalationSound(undefined);

  const [open, setOpen] = useState(false);

  // Decide once whether to offer the prompt. Idempotent + StrictMode-safe: the
  // "seen" flag short-circuits a second run, and setState to an already-`false`
  // value is a no-op. Depends only on `canEscalate` — a permission that settles
  // shortly after mount as /auth/me resolves.
  useEffect(() => {
    if (!canEscalate) return;
    if (hasSeenAlertPrompt()) return;
    // Nothing left to offer if OS notifications are already denied AND the in-app
    // chime is already on — skip the pointless modal.
    const notifDenied =
      typeof Notification !== "undefined" && Notification.permission === "denied";
    if (notifDenied && isAlertSoundEnabled()) {
      markAlertPromptSeen();
      return;
    }
    setOpen(true);
  }, [canEscalate]);

  // Any close path (Esc, overlay click, the X, or "Not now") records "seen" so
  // the prompt is truly one-time — dismissing counts as an answer.
  const dismiss = () => {
    markAlertPromptSeen();
    setOpen(false);
  };

  const handleEnable = () => {
    // Runs inside the button's click gesture, so unlock() can legally resume the
    // AudioContext and request notification permission here.
    unlock();
    setAlertSoundEnabled(true);
    markAlertPromptSeen();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) dismiss();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <BellRing size={18} className="text-primary flex-none" />
            Turn on alert sounds?
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 mt-1">
            While Omaya is open in a browser tab, it plays a chime and — with
            your permission — shows a desktop notification the moment a mother's
            check-in is flagged crisis or elevated, even if the tab isn't in
            focus. You can change this any time in Settings → Notifications.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={dismiss}>
            Not now
          </Button>
          <Button
            variant="default"
            onClick={handleEnable}
            className="flex items-center gap-2"
          >
            <BellRing size={16} />
            Enable alert sounds
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
