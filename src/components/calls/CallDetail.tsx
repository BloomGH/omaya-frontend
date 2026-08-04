import { useState } from "react";
import { PhoneCall, Clock, Heart, Calendar, Mic, Flag, FileText } from "lucide-react";
import { Call } from "../../types";
import { Badge } from "../ui/Badge";
import { getSeverityBadgeClass, getStatusBadgeClass } from "../../lib/badge-helpers";
import { CallActions } from "./CallActions";
import { CallTranscriptView } from "./CallTranscriptView";
import { formatDateTime } from "../../lib/format";

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
  // In-place view switch: the detail card transforms into the transcript view
  // (back button + waveform audio + full transcript) instead of a modal.
  // CallDetail is keyed on the call id in Calls.tsx, so this resets per call.
  const [view, setView] = useState<"details" | "transcript">("details");

  if (!call && !isLoading) {
    return (
      // react-doctor-disable-next-line react-doctor/no-transition-all -- animate-in enter keyframe (duration-N is animation-duration), not a CSS transition:all
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

  // ── TRANSCRIPT VIEW ──────────────────────────────────────
  // The whole detail card transforms into this; the back button returns
  // to the details view above.
  if (view === "transcript") {
    return <CallTranscriptView call={call} onBack={() => setView("details")} />;
  }

  return (
    // react-doctor-disable-next-line react-doctor/no-transition-all -- animate-in enter keyframe (duration-N is animation-duration), not a CSS transition:all
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
            {(call.channel === "whatsapp" || call.channel === "whatsapp_call") && (
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700"
                size="sm"
              >
                {call.channel === "whatsapp_call" ? "WhatsApp call" : "WhatsApp"}
              </Badge>
            )}
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
      <CallActions motherId={call.motherId} />
    </div>
  );
};

export { CallDetail };
