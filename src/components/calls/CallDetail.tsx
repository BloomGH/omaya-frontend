import { useState } from "react";
import { PhoneCall, Clock, Heart, Calendar, Mic, Flag, Loader2, UserRound, FileText, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Call } from "../../types";
import { Badge } from "../ui/Badge";
import { getSeverityBadgeClass, getStatusBadgeClass } from "../../lib/badge-helpers";
import { Button } from "../ui/Button";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { WaveformPlayer } from "../ui/WaveformPlayer";
import { useTriggerCall } from "../../hooks/useMutations";
import { formatDateTime } from "../../lib/format";
import { toast } from "sonner";

interface CallDetailProps {
  call: Call | null;
  isLoading?: boolean;
}

const statusLabel: Record<string, string> = {
  completed:   "Completed",
  in_progress: "In progress",
  upcoming:    "Upcoming",
  missed:      "Missed",
};

function formatDuration(seconds?: number): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

const CallDetail = ({ call, isLoading }: CallDetailProps) => {
  const navigate = useNavigate();
  const triggerCall = useTriggerCall();
  // In-place view switch: the detail card transforms into the transcript view
  // (back button + waveform audio + full transcript) instead of a modal.
  // CallDetail is keyed on the call id in Calls.tsx, so this resets per call.
  const [view, setView] = useState<"details" | "transcript">("details");

  const handleViewMother = () => {
    if (!call) return;
    navigate("/mothers", { state: { motherId: call.motherId } });
  };

  const handleCallNow = async () => {
    if (!call) return;
    try {
      await triggerCall.mutateAsync(call.motherId);
      toast.success("Call triggered. She will receive a call shortly.");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) toast.error("This mother is not active, so a call can't be placed.");
      else if (status === 403) toast.error("Your role does not have permission to place calls.");
      else toast.error("Could not trigger call. Please try again.");
    }
  };

  if (!call && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-in fade-in-0 zoom-in-95 duration-300 motion-reduce:animate-none">
        <PhoneCall className="text-gray-300 mb-2" size={48} />
        <p className="text-sm text-gray-400 font-normal">Select a call to view details</p>
      </div>
    );
  }

  if (!call) return null;

  const label = statusLabel[call.status] ?? call.status;
  const isCompleted = call.status === "completed";
  const hasTranscript = (call.transcript ?? []).length > 0;

  const initials = call.motherName
    ?.split(" ")
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase() ?? "?";

  const motherFirstName = call.motherName?.split(" ")[0] || "Mother";

  // ── TRANSCRIPT VIEW ──────────────────────────────────────
  // The whole detail card transforms into this; the back button returns
  // to the details view above.
  if (view === "transcript") {
    return (
      <div className="flex flex-1 flex-col min-h-0 animate-in fade-in-0 slide-in-from-right-2 duration-200 motion-reduce:animate-none">
        {/* Back header */}
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setView("details")}
            aria-label="Back to call details"
            className="shrink-0 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 truncate">{call.motherName}</h2>
            <p className="text-xs text-gray-400">{call.callType} · transcript</p>
          </div>
        </div>

        {/* Recording (waveform) */}
        {call.audioUrl && (
          <div className="pt-4 pb-5 shrink-0 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest pb-2">Recording</p>
            <WaveformPlayer key={call.id} src={call.audioUrl} />
          </div>
        )}

        {/* Full transcript — chat conversation */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide mt-6 pr-1">
          <div className="flex flex-col py-1">
            {(call.transcript ?? []).map((row, idx, arr) => {
              const isOmaya = row.speaker === "omaya";
              const speakerName = isOmaya ? "Omaya" : motherFirstName;
              // Group consecutive turns from the same speaker: show the
              // avatar + name only on the first turn of a group, and add the
              // big gap between groups (tight spacing within a group).
              const startsGroup = idx === 0 || arr[idx - 1].speaker !== row.speaker;
              return (
                <div
                  key={`${idx}-${row.speaker}-${row.text}`}
                  className={`flex flex-col ${startsGroup ? "mt-5 first:mt-0" : "mt-1"} ${
                    isOmaya ? "items-start" : "items-end"
                  }`}
                >
                  {startsGroup && (
                    <div
                      className={`flex items-center gap-1.5 mb-1 px-0.5 ${
                        isOmaya ? "" : "flex-row-reverse"
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                          isOmaya ? "bg-primary text-white" : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {isOmaya ? "O" : (call.motherName?.charAt(0)?.toUpperCase() ?? "M")}
                      </div>
                      <span className="text-xs font-medium text-gray-500">{speakerName}</span>
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                      isOmaya
                        ? `bg-gray-100 text-gray-800 rounded-2xl ${startsGroup ? "rounded-tl-md" : ""}`
                        : `bg-primary text-white rounded-2xl ${startsGroup ? "rounded-tr-md" : ""}`
                    }`}
                  >
                    {row.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">

        {/* ── AVATAR HEADER ─────────────────────────────────── */}
        <div className="flex flex-col items-center pt-6 pb-5 border-b border-gray-100">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-xl font-bold text-primary mb-3 ring-4 ring-white shadow-sm">
            {initials}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{call.motherName}</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getStatusBadgeClass(call.status)} size="sm" dot>
              {label}
            </Badge>
            <span className="text-xs text-gray-400">{call.callType}</span>
          </div>
        </div>

        {/* ── CALL DETAILS ──────────────────────────────────── */}
        <div className="px-4 py-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-200">Call info</p>
          <div className="divide-y divide-gray-100">
            {[
              { icon: Calendar, label: "Scheduled",     value: formatDateTime(call.scheduledAt) },
              { icon: Mic,      label: "Duration",      value: isCompleted ? formatDuration(call.durationSeconds) : "—" },
              { icon: Clock,    label: "Day in care",   value: call.dayInCare != null ? `Day ${call.dayInCare}` : "—" },
              { icon: Heart,    label: "Delivery type", value: call.deliveryType ? call.deliveryType.charAt(0).toUpperCase() + call.deliveryType.slice(1) : "—" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-1.5">
                  <item.icon size={12} className="text-gray-400" />
                  <span className="text-sm text-gray-500 font-normal">{item.label}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>

          {/* ── OUTCOME ─────────────────────────────────────── */}
          {isCompleted && (
            <div className="mt-6">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-200">Outcome</p>
              <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-2">
                  <Flag size={14} className={call.flagsRaised ? "text-amber-500" : "text-gray-300"} />
                  <span className="text-sm text-gray-600 font-normal">
                    {call.flagsRaised
                      ? `${call.flagsRaised} flag${call.flagsRaised > 1 ? "s" : ""} raised`
                      : "No flags raised"}
                  </span>
                </div>
                {call.severity && (
                  <Badge variant="outline" className={getSeverityBadgeClass(call.severity)} size="sm" dot>
                    {call.severity.charAt(0).toUpperCase() + call.severity.slice(1)}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* ── SUMMARY + READ MORE ─────────────────────────── */}
          <div className="mt-6">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-200">Summary</p>
            {hasTranscript ? (
              <div className="pt-3">
                <p className="text-sm text-gray-700 font-normal leading-relaxed">
                  {call.summary || "This call has a full transcript on record."}
                </p>
                <button
                  type="button"
                  onClick={() => setView("transcript")}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-700 transition-colors"
                >
                  <FileText size={14} />
                  Read more — {call.audioUrl ? "audio & full transcript" : "full transcript"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400 font-normal pt-3">
                {call.status === "upcoming"
                  ? "Call has not happened yet."
                  : call.status === "missed"
                  ? "No answer — call was not connected."
                  : "No transcript available for this call."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── ACTIONS (pinned footer) ────────────────────────── */}
      <div className="shrink-0 pt-4 border-t border-gray-100 flex justify-end items-center gap-2 bg-white">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1.5" onClick={handleViewMother}>
              <UserRound size={15} />
              <span className="font-medium">Mother record</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top"><p>Go to this mother's profile.</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-1.5"
              disabled={triggerCall.isPending}
              onClick={handleCallNow}
            >
              {triggerCall.isPending ? <Loader2 size={15} className="animate-spin" /> : <PhoneCall size={15} />}
              <span className="font-medium">Call now</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top"><p>Trigger an immediate check-in call for this mother.</p></TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export { CallDetail };
