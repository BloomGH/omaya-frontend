import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Loader2, Lock, Eye, EyeOff, AlertCircle, AlertTriangle } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useMe } from '../hooks/useMe';
import { useUpdateMe, useChangePassword } from '../hooks/useMutations';
import { useEscalationSound } from '../hooks/useEscalationSound';
import { isAlertSoundEnabled, setAlertSoundEnabled } from '../lib/alert-prefs';
import { extractApiError } from '../lib/api';
import { toast } from 'sonner';

/* ─── Toggle ─────────────────────────────────────────────────── */
interface ToggleProps {
  enabled: boolean;
  onChange?: () => void;
  locked?: boolean;
  label?: string;
}

const Toggle = ({ enabled, onChange, locked = false, label }: ToggleProps) => (
  <button
    role="switch"
    type="button"
    aria-checked={enabled}
    aria-label={label ?? "Toggle setting"}
    onClick={locked ? undefined : onChange}
    className={`
      relative inline-flex w-11 h-6 rounded-full flex-shrink-0
      transition-colors duration-200 ease-in-out
      ${enabled ? 'bg-primary' : 'bg-gray-200'}
      ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    <span
      className={`
        absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm
        transition-transform duration-200 ease-in-out
        ${enabled ? 'translate-x-5' : 'translate-x-0.5'}
      `}
    />
  </button>
);

/* ─── Section shell ───────────────────────────────────────────── */
const Section = ({
  heading,
  subtitle,
  children,
}: {
  heading: string;
  subtitle: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-3">
    <div>
      <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
      <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
    </div>
    <div className="bg-white rounded-2xl border border-gray-100 p-6">{children}</div>
  </div>
);

/* ─── Notification row ────────────────────────────────────────── */
const NotifRow = ({
  label,
  description,
  enabled,
  onToggle,
  locked = false,
  last = false,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle?: () => void;
  locked?: boolean;
  last?: boolean;
}) => (
  <div className={`flex items-center justify-between py-4 ${last ? '' : 'border-b border-gray-100'}`}>
    <div className="pr-8">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <p className="text-sm text-gray-400 mt-0.5">{description}</p>
    </div>
    <Toggle enabled={enabled} onChange={onToggle} locked={locked} label={label} />
  </div>
);

/* ─── Profile skeleton ────────────────────────────────────────── */
const ProfileSkeleton = () => (
  <>
    <div className="flex items-center gap-4 mb-6">
      <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3.5 w-52" />
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ))}
    </div>
  </>
);

/* ─── Initials helper ─────────────────────────────────────────── */
function initials(nameOrEmail: string): string {
  const parts = nameOrEmail.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

/* ─── Password field (show/hide toggle via rightIcon) ─────────── */
const PasswordField = ({
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
}) => {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col">
      <Input
        label={label}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        fullWidth
        rightIcon={
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="text-gray-400 hover:text-gray-500 transition-colors"
            tabIndex={-1}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        }
      />
      {error && (
        <p className="text-xs text-red-500 mt-1 ml-0.5">{error}</p>
      )}
    </div>
  );
};

/* ─── Password validation ──────────────────────────────────────── */
function passwordMeetsPolicy(p: string): boolean {
  return p.length >= 10 && /[a-zA-Z]/.test(p) && /[0-9]/.test(p);
}

/* ─── Change password section ─────────────────────────────────── */
const ChangePasswordSection = () => {
  const changePassword = useChangePassword();

  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const currentError = attempted && !current ? 'Enter your current password.' : undefined;
  const newError = attempted && !newPass
    ? 'Enter a new password.'
    : attempted && !passwordMeetsPolicy(newPass)
      ? 'At least 10 characters, one letter, and one digit.'
      : undefined;
  const confirmError = attempted && newPass && confirm !== newPass
    ? "Passwords don't match."
    : undefined;

  const handleSubmit = async () => {
    setAttempted(true);
    setApiError(null);
    if (!current || !newPass || !passwordMeetsPolicy(newPass) || newPass !== confirm) return;

    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: newPass });
      toast.success('Password updated successfully.');
      setCurrent('');
      setNewPass('');
      setConfirm('');
      setAttempted(false);
    } catch (err: unknown) {
      // Read the CANONICAL envelope ({error_code, message} under `detail`) via
      // the shared helper. The hand-rolled shape probing this replaces matched
      // nothing the backend actually sends: it tested `status === 400` and
      // `data.error === 'incorrect_current_password'`, but a wrong current
      // password is 401 `invalid_credentials` (auth.py). So the real case fell
      // to the generic toast with no inline message — and 400, which is only
      // ever about the NEW password (weak_password / password_too_long), was
      // mislabelled "your current password is incorrect", sending clinicians to
      // retype a password that was never wrong.
      //
      // This also completes the contract the 401 interceptor now depends on:
      // `invalid_credentials` is deliberately NOT treated as a dead session
      // (lib/api.ts AMBIGUOUS_401_CODES), on the premise that this page renders
      // it. Now it does.
      const { error_code, message, status } = extractApiError(err);
      if (error_code === 'invalid_credentials') {
        setApiError('Your current password is incorrect.');
      } else if (error_code === 'weak_password' || error_code === 'password_too_long') {
        // Surface the server's own text: the client policy check mirrors the
        // length/letter/digit rule but NOT bcrypt's 72-BYTE ceiling, so a long
        // accented or non-Latin passphrase passes here and fails there.
        setApiError(message);
      } else if (status === 403) {
        setApiError("You don't have permission to change your password.");
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {apiError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PasswordField
          label="Current password"
          value={current}
          onChange={(v) => { setCurrent(v); setApiError(null); }}
          error={currentError}
        />

        {/* Empty cell to keep new password below current on the left column */}
        <span className="hidden sm:block" />

        <PasswordField
          label="New password"
          value={newPass}
          onChange={setNewPass}
          error={newError}
          placeholder="Min. 10 chars, one letter, one digit"
        />

        <PasswordField
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          error={confirmError}
        />
      </div>

      <div className="flex justify-end mt-2">
        <Button
          variant="default"
          onClick={handleSubmit}
          disabled={changePassword.isPending}
          className="flex items-center gap-2"
        >
          {changePassword.isPending && <Loader2 size={16} className="animate-spin" />}
          {changePassword.isPending ? 'Updating...' : 'Update password'}
        </Button>
      </div>
    </div>
  );
};

/* ─── Page ────────────────────────────────────────────────────── */
const SettingsPage = () => {
  const { data: me, isLoading } = useMe();
  const updateMe = useUpdateMe();
  const [params] = useSearchParams();
  // `location.key` changes on EVERY navigation — including navigating to the same
  // URL — so keying the scroll effect on it re-drives the scroll even when the
  // clinician is already on /settings?section=notifications and clicks the link
  // again (the search params alone wouldn't change, so the effect wouldn't re-run).
  const location = useLocation();
  const passwordSectionRef = useRef<HTMLDivElement>(null);
  const notificationsSectionRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  // In-app escalation alert sound — persisted per-browser in localStorage. This
  // chime is the de-facto real-time notifier, so it defaults ON; muting is an
  // explicit opt-out. Muting only silences the chime — OS notifications (when
  // permitted) still fire so a muted tab isn't left with no signal.
  const [alertSound, setAlertSound] = useState<boolean>(() => isAlertSoundEnabled());
  // `unlock` resumes the shared AudioContext + requests OS-notification permission,
  // but only works inside a user gesture. Passing `undefined` means this hook
  // instance never chimes itself — we only want `unlock`.
  const { unlock } = useEscalationSound(undefined);

  const toggleAlertSound = () => {
    const next = !alertSound;
    setAlertSound(next);
    setAlertSoundEnabled(next);
    // Turning sound ON is the moment to cross the browser autoplay gate and ask
    // for notification permission — this click is the required gesture. No-op when
    // disabling; harmless if permission is already granted/denied.
    if (next) unlock();
  };

  useEffect(() => {
    if (me) setName(me.name ?? '');
  }, [me]);

  // Deep-link from the notifications bell's alert-sound link
  // (/settings?section=notifications) — scroll the Notifications section into
  // view so the toggle is on screen on arrival. Gated on `!isLoading`: `useMe`
  // resolves after mount and reflows the page (profile fields + the
  // must-change-password banner), so scrolling before data settles lands in the
  // wrong spot — the cause of the "doesn't work every time". Waiting for load,
  // then deferring one frame for layout, makes it reliable. Mirrors the password
  // section's scroll options.
  useEffect(() => {
    if (params.get('section') !== 'notifications' || isLoading) return;
    const raf = requestAnimationFrame(() =>
      notificationsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
    return () => cancelAnimationFrame(raf);
  }, [params, location.key, isLoading]);


  const nameChanged = name.trim() !== (me?.name ?? '').trim() && name.trim() !== '';
  const canSave = nameChanged && !updateMe.isPending && !isLoading;

  const handleSave = async () => {
    if (!nameChanged) return;
    try {
      await updateMe.mutateAsync(name.trim());
      toast.success('Profile updated.');
    } catch {
      toast.error('Failed to save changes. Please try again.');
    }
  };

  return (
    <div>
      <div className="w-full flex flex-col gap-10 pb-10">

        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>

        {/* ── Must-change-password banner ──────────────────────── */}
        {!isLoading && me?.mustChangePassword && (
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3.5 -mt-4">
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">Password change required</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Your account requires a new password before you can continue using Omaya Care.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                passwordSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="text-sm font-medium text-amber-800 hover:text-amber-900 underline underline-offset-2 flex-shrink-0 whitespace-nowrap"
            >
              Change now
            </button>
          </div>
        )}

        {/* ── Section 1: Your profile ─────────────────────────── */}
        <Section
          heading="Your profile"
          subtitle="Your account details and how you sign in."
        >
          {isLoading ? (
            <ProfileSkeleton />
          ) : (
            <>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-primary text-white font-bold text-lg flex items-center justify-center flex-shrink-0 select-none">
                  {initials(me?.name || me?.email || '?')}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{me?.name || me?.email}</p>
                  <p className="text-sm text-gray-400">
                    {me?.role} · {me?.hospitalName}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                />

                <Input
                  label="Work email"
                  type="email"
                  value={me?.email ?? ''}
                  disabled
                  rightIcon={<Lock size={14} className="text-gray-300" />}
                  fullWidth
                />

                <Input
                  label="Role"
                  value={me?.role ?? ''}
                  disabled
                  fullWidth
                />

                <Input
                  label="Hospital"
                  value={me?.hospitalName ?? ''}
                  disabled
                  fullWidth
                />

                <p className="col-span-2 text-xs text-gray-400 -mt-1">
                  Roles and hospital are managed by your administrator.
                </p>
              </div>

              <div className="flex justify-end mt-5">
                <Button
                  variant="default"
                  onClick={handleSave}
                  disabled={!canSave}
                  className="flex items-center gap-2"
                >
                  {updateMe.isPending && <Loader2 size={16} className="animate-spin" />}
                  {updateMe.isPending ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </>
          )}
        </Section>

        {/* ── Section 2: Change password ───────────────────────── */}
        <div ref={passwordSectionRef}>
          <Section
            heading="Change password"
            subtitle="Choose a strong password. It must be at least 10 characters with one letter and one digit."
          >
            <ChangePasswordSection />
          </Section>
        </div>

        {/* ── Section 3: Notifications ────────────────────────── */}
        <div ref={notificationsSectionRef}>
        <Section
          heading="Notifications"
          subtitle="Crisis and elevated alerts are always active. More preferences are coming soon."
        >
          <NotifRow
            label="Alert sound"
            description="Play a chime in this browser when a new escalation arrives."
            enabled={alertSound}
            onToggle={toggleAlertSound}
          />
          <NotifRow
            label="Crisis alerts (L4)"
            description="Always on. A mother in crisis needs an immediate response."
            enabled={true}
            locked={true}
          />
          <NotifRow
            label="Elevated alerts (L3)"
            description="When a mother's check-in is flagged as elevated."
            enabled={false}
            locked={true}
          />
          <NotifRow
            label="Missed check-ins"
            description="When a scheduled call goes unanswered."
            enabled={false}
            locked={true}
          />
          <NotifRow
            label="Daily summary email"
            description="A morning digest of your cohort."
            enabled={false}
            locked={true}
          />
          <NotifRow
            label="Weekly report"
            description="Cohort trends and resolved escalations, every Monday."
            enabled={false}
            locked={true}
            last
          />
          <p className="text-xs text-gray-400 pt-2">
            Notification preferences will be configurable in a future update.
          </p>
        </Section>
        </div>



      </div>
    </div>
  );
};

export default SettingsPage;
