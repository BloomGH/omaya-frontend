import { ArrowLeft } from "lucide-react";
import { Call } from "../../types";
import { WaveformPlayer } from "../ui/WaveformPlayer";

interface CallTranscriptViewProps {
  call: Call;
  onBack: () => void;
}

/**
 * The transcript half of the call detail card. Not a modal: CallDetail swaps
 * itself for this view in place, and `onBack` swaps it back.
 */
const CallTranscriptView = ({ call, onBack }: CallTranscriptViewProps) => {
  const motherFirstName = call.motherName?.split(" ")[0] || "Mother";

  return (
    // react-doctor-disable-next-line react-doctor/no-transition-all -- animate-in enter keyframe (duration-N is animation-duration), not a CSS transition:all
    <div className="flex flex-1 flex-col min-h-0 animate-in fade-in-0 slide-in-from-right-2 duration-200 motion-reduce:animate-none">
      {/* Back header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <button
          type="button"
          onClick={onBack}
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
                // Composite key on an append-only transcript that never
                // reorders or filters; idx only guarantees uniqueness when a
                // speaker repeats identical text. This is not the reorder/
                // filter hazard the rule targets.
                // react-doctor-disable-next-line react-doctor/no-array-index-as-key
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
};

export { CallTranscriptView };
