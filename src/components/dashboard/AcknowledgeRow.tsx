import { EscalationItem } from "../../types";
import { Badge } from "../ui/Badge";
import { getSeverityBadgeClass } from "../../lib/badge-helpers";
import { Button } from "../ui/Button";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { TableRow, TableCell } from "../ui/table";
import { useAuth } from "../../contexts/AuthContext";

interface AcknowledgeRowProps {
  item: EscalationItem;
  onAcknowledge: (id: string) => void;
}

const formatTimeLeft = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

const getTimeStatusStyles = (totalMinutes: number) => {
  if (totalMinutes < 30) {
    return "text-red-600 animate-soft-pulse";
  }
  if (totalMinutes <= 120) {
    return "text-amber-600";
  }
  return "text-gray-400";
};

const AcknowledgeRow = ({ item, onAcknowledge }: AcknowledgeRowProps) => {
  const { can } = useAuth();
  const statusStyles = getTimeStatusStyles(item.timeLeftMinutes);
  const canEscalate = can("escalate");

  return (
    <TableRow className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <TableCell className="py-3">
        <div className="font-medium text-gray-900">{item.motherName}</div>
        <div className="text-sm font-normal text-gray-400">
          Day {item.dayPostpartum}
        </div>
      </TableCell>
      <TableCell className="py-3">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={getSeverityBadgeClass(item.severity)} size="sm" dot>
            {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
          </Badge>
          {item.pageStatus === "blocked" && (
            // The on-call clinician's SMS page was never delivered — the only
            // visible difference between a paged and a blocked open alert.
            <Badge
              variant="outline"
              className="bg-red-50 text-red-700 border-red-200"
              size="sm"
            >
              Not paged
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className={`py-3 ${statusStyles}`}>
        <div className="text-base font-semibold">
          {formatTimeLeft(item.timeLeftMinutes)}
        </div>
        <div className="text-xs font-normal opacity-80">left within SLA</div>
      </TableCell>
      <TableCell className="py-3 text-right">
        {canEscalate ? (
          // Enabled: plain button, no tooltip. The label already reads
          // "Acknowledge", so a hover hint here is pure noise — and a
          // portalled Radix tooltip per row is what caused the laggy
          // pop / flicker when the pointer lingered on a row.
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAcknowledge(item.id)}
          >
            Acknowledge
          </Button>
        ) : (
          // Disabled: keep the tooltip — it's the only way to explain WHY
          // the button can't be clicked. disableHoverableContent so it closes
          // the instant the pointer leaves, instead of lingering until the
          // next pointermove re-checks Radix's hover grace-area polygon.
          <Tooltip disableHoverableContent>
            <TooltipTrigger asChild>
              <span className="cursor-not-allowed inline-flex">
                <Button variant="outline" size="sm" disabled>
                  Acknowledge
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>You don't have permission to acknowledge alerts</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
};

export { AcknowledgeRow };
