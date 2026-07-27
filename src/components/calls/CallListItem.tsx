import { Clock } from "lucide-react";
import { Call } from "../../types";
import { Badge } from "../ui/Badge";
import { getStatusBadgeClass } from "../../lib/badge-helpers";
import { formatDateTime } from "../../lib/format";

interface CallListItemProps {
  call: Call;
  isSelected: boolean;
  onClick: () => void;
}

const statusLabel: Record<string, string> = {
  completed:   "Completed",
  in_progress: "In progress",
  upcoming:    "Upcoming",
  missed:      "Missed",
};

const CallListItem = ({ call, isSelected, onClick }: CallListItemProps) => {
  const label = statusLabel[call.status] ?? call.status;
  const initials = call.motherName?.charAt(0) ?? "?";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View call for ${call.motherName}`}
      data-slide-active={isSelected ? "true" : undefined}
      className={`
        relative z-10 w-full px-4 py-3 text-left transition-[background-color,transform] duration-200 ease-out
        ${isSelected ? "" : "hover:bg-gray-50 hover:translate-x-0.5"}
      `}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-[10px] font-bold text-primary">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center gap-2">
            <span className="block text-sm font-medium text-gray-900 truncate">
              {call.motherName}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {(call.channel === "whatsapp" || call.channel === "whatsapp_call") && (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-700"
                  size="sm"
                >
                  {call.channel === "whatsapp_call" ? "WhatsApp call" : "WhatsApp"}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={getStatusBadgeClass(call.status)}
                size="sm"
                dot
              >
                {label}
              </Badge>
            </div>
          </div>

          <div className="mt-1 flex items-center gap-1.5">
            <Clock size={11} className="text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500 font-normal truncate">
              {call.callType} · {formatDateTime(call.scheduledAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};

export { CallListItem };
