import { AlertTriangle, Clock, Check } from 'lucide-react';

function formatRelativeTime(isoString: string): { relative: string; timeOfDay: string } {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return { relative: "just now", timeOfDay: "" };

  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60_000);
  let relative: string;
  if (diffMinutes < 1) relative = "just now";
  else if (diffMinutes < 60) relative = `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  else if (diffMinutes < 120) relative = "1 hour ago";
  else relative = `${Math.floor(diffMinutes / 60)} hours ago`;

  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return { relative, timeOfDay: `${h}:${m}` };
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Badge } from '../ui/Badge';
import { getSeverityBadgeClass } from '../../lib/badge-helpers';
import { Button } from '../ui/Button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { EscalationItem } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface EscalationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcknowledge: () => void;
  item: EscalationItem | null;
}

const formatTimeLeft = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const EscalationModal = ({ isOpen, onClose, onAcknowledge, item }: EscalationModalProps) => {
  const { can } = useAuth();
  if (!item) return null;

  const triggered = item.createdAt ? formatRelativeTime(item.createdAt) : null;

  const slaLimit = item.severity === 'crisis' ? 120 : 240;
  const progressPercent = Math.max(0, Math.min(100, (item.timeLeftMinutes / slaLimit) * 100));
  // Tier label + SLA hours derived from severity (crisis = L4) — not hardcoded,
  // so an L4 crisis isn't mislabelled "L3 · 4 hr" next to the "Not paged" callout.
  const tierLabel =
    ({ crisis: 'L4', elevated: 'L3', monitor: 'L2', routine: 'L1' } as Record<string, string>)[
      item.severity
    ] ?? item.severity.toUpperCase();
  const slaHours = Math.round(slaLimit / 60);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="text-amber-500" size={22} />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-gray-900">{item.motherName}</DialogTitle>
              <DialogDescription asChild>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-gray-400 font-normal">{tierLabel} ·</span>
                  <Badge variant="outline" className={getSeverityBadgeClass(item.severity)} size="sm" dot>
                    {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
                  </Badge>
                </div>
              </DialogDescription>
              <p className="text-xs text-gray-400 font-normal mt-0.5">
                Day {item.dayPostpartum} of postnatal care
              </p>
            </div>
          </div>
        </DialogHeader>

        {triggered && (
          <div className="flex items-center gap-1.5 text-gray-500">
            <Clock size={14} className="text-gray-400" />
            <span className="text-sm font-normal">Triggered</span>
            <span className="text-sm font-medium text-gray-700">{triggered.relative}</span>
            {triggered.timeOfDay && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-sm font-normal">{triggered.timeOfDay}</span>
              </>
            )}
          </div>
        )}

        <p className="text-sm text-gray-600 font-normal">
          Alert triggered at day {item.dayPostpartum} of postnatal care. Clinician review required.
        </p>

        {item.pageStatus === 'blocked' && (
          // The escalation SMS page was never delivered. Force the clinician to
          // reach the on-call person manually. Copy is PHI-safe: no name, phone,
          // or provider error detail — just the blocked delivery state.
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-red-600" />
            <span className="font-normal">
              The on-call clinician was <span className="font-semibold">not reached by SMS</span> — delivery is blocked. Please contact them directly and acknowledge this alert.
            </span>
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">RESPONSE SLA</span>
            <span className="text-xs font-normal text-gray-500">{slaHours} hr · {tierLabel}</span>
          </div>
          <div className="flex items-baseline">
            <span className="text-3xl font-bold text-gray-900">{formatTimeLeft(item.timeLeftMinutes)}</span>
            <span className="text-sm font-normal text-gray-400 ml-2">remaining</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full w-full origin-left bg-primary rounded-full transition-transform duration-500"
              style={{ transform: `scaleX(${progressPercent / 100})` }}
            />
          </div>
        </div>

        <DialogFooter>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={!can("escalate") ? "w-full cursor-not-allowed" : "w-full"}>
                <Button
                  variant="default"
                  size="lg"
                  className="gap-2 w-full"
                  onClick={() => {
                    onAcknowledge();
                    onClose();
                  }}
                  disabled={!can("escalate")}
                >
                  <Check size={20} />
                  <span>Acknowledge</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{can("escalate") ? "Acknowledge this alert" : "You don't have permission to acknowledge alerts"}</p>
            </TooltipContent>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { EscalationModal };
