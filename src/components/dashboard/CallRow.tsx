import { format, parseISO, isValid } from "date-fns";
import { Call } from "../../types";
import { Badge } from "../ui/Badge";
import { getStatusBadgeClass } from "../../lib/badge-helpers";
import { TableRow, TableCell } from "../ui/table";

function formatCallTime(raw: string): string {
  if (!raw || raw === "--:--") return raw;
  try {
    const date = parseISO(raw);
    if (isValid(date)) return format(date, "h:mm a");
  } catch {
    // not an ISO string, fall through
  }
  return raw;
}

interface CallRowProps {
  call: Call;
}

const statusLabel: Record<string, string> = {
  completed: "Completed",
  in_progress: "In progress",
  upcoming: "Upcoming",
  missed: "Missed",
};

const CallRow = ({
  call,
}: CallRowProps) => {
  const label = statusLabel[call.status] ?? call.status;

  const motherName = call.motherName;
  const time = call.scheduledAt;
  const callType = call.callType;

  return (
    <TableRow className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <TableCell className="py-3 text-sm text-gray-900 truncate">
        {motherName}
      </TableCell>
      <TableCell className="py-3 text-xs md:text-sm text-gray-700">
        {formatCallTime(time)}
      </TableCell>
      <TableCell className="py-3 text-sm text-gray-500 hidden md:table-cell">
        {callType}
      </TableCell>
      <TableCell className="py-3 text-right">
        <div className="flex items-center justify-end gap-2">
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
      </TableCell>
    </TableRow>
  );
};

export { CallRow };
