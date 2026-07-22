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
                  <span className="text-xs text-gray-400 font-normal">L3 ·</span>
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

        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">RESPONSE SLA</span>
            <span className="text-xs font-normal text-gray-500">4 hr · L3</span>
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
