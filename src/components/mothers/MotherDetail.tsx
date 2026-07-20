import { useState } from "react";
import {
  UserRound,
  Clock,
  ShieldCheck,
  MessageCircle,
  AlertTriangle,
  XCircle,
  ClipboardList,
  Pencil,
  Loader2,
  PhoneCall,
} from "lucide-react";
import { Mother } from "../../types";
import { Badge } from "../ui/Badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { getSeverityBadgeClass } from "../../lib/badge-helpers";
import { Button } from "../ui/Button";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Alert, AlertDescription } from "../ui/alert";
import { formatDate, formatDateTime, formatPhone } from "../../lib/format";
import { useTriggerCall } from "../../hooks/useMutations";
import { toast } from "sonner";

interface MotherDetailProps {
  mother: Mother | null;
  onWithdrawClick?: () => void;
  onLogVisitClick?: () => void;
  onEditClick?: () => void;
}

const consentConfig = {
  active:    { label: "Active",    className: "bg-primary-100 text-primary-700" },
  withdrawn: { label: "Withdrawn", className: "bg-red-50 text-red-600" },
  pending:   { label: "Pending",   className: "bg-yellow-50 text-yellow-700" },
};

const callWindowLabels: Record<string, string> = {
  morning: "Morning", afternoon: "Afternoon", evening: "Evening", inbound: "Inbound",
};

type Tab = "details" | "checkins";

const MotherDetail = ({
  mother,
  onWithdrawClick,
  onLogVisitClick,
  onEditClick,
}: MotherDetailProps) => {
  const triggerCall = useTriggerCall();
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [transcriptModal, setTranscriptModal] = useState<{ open: boolean; text: string }>({
    open: false,
    text: "",
  });

  const handleTranscriptClick = (transcript: string) => {
    if (transcript.startsWith("http")) {
      window.open(transcript, "_blank", "noopener,noreferrer");
    } else {
      setTranscriptModal({ open: true, text: transcript });
    }
  };

  if (!mother) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-in fade-in-0 zoom-in-95 duration-300 motion-reduce:animate-none">
        <UserRound className="text-gray-300 mb-2" size={48} />
        <p className="text-sm text-gray-400 font-normal">
          Select a mother to view her profile
        </p>
      </div>
    );
  }

  const isWithdrawn = mother.consentStatus === "withdrawn";
  const consent = consentConfig[mother.consentStatus] ?? { label: mother.consentStatus, className: "bg-gray-100 text-gray-500" };

  const initials = mother.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();

  const handleCallNow = async () => {
    try {
      await triggerCall.mutateAsync(mother.id);
      toast.success("Call triggered. She will receive a call shortly.");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) toast.error("This mother is not active, so a call can't be placed.");
      else if (status === 403) toast.error("Your role does not have permission to place calls.");
      else toast.error("Could not trigger call. Please try again.");
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 animate-in fade-in-0 slide-in-from-right-3 duration-300 ease-out motion-reduce:animate-none">
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">

        {/* ── AVATAR HEADER ─────────────────────────────────── */}
        <div className="flex flex-col items-center pt-6 pb-5 border-b border-gray-100">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary mb-3 ring-4 ring-white shadow-sm">
            {initials}
          </div>

          <div className="flex items-center gap-2 mb-1.5">
            <h2 className="text-xl font-bold text-gray-900">{mother.name}</h2>
            {!isWithdrawn && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onEditClick}
                    disabled={!onEditClick}
                    aria-label="Edit mother details"
                    className="text-gray-300 hover:text-gray-500 transition-colors disabled:cursor-not-allowed"
                  >
                    <Pencil size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{onEditClick ? "Edit mother details" : "You don't have permission to edit"}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getSeverityBadgeClass(mother.severity)} size="sm" dot>
              {mother.severity.charAt(0).toUpperCase() + mother.severity.slice(1)}
            </Badge>
            <span className="text-xs text-gray-400">{mother.hospital}</span>
          </div>

          {isWithdrawn && (
            <p className="text-xs text-red-400 mt-2 font-normal">
              Record is read-only. Consent has been withdrawn.
            </p>
          )}
        </div>

        {/* ── STATUS STRIP ──────────────────────────────────── */}
        <div className="grid grid-cols-3 border-b border-gray-100">
          <div className="flex flex-col items-center py-3.5 gap-0.5">
            <div className="flex items-center gap-1 mb-0.5">
              <Clock size={11} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Day</span>
            </div>
            <span className="text-sm font-medium text-gray-800">
              {mother.dayPostpartum != null ? `Day ${mother.dayPostpartum}` : "—"}
            </span>
          </div>

          <div className="flex flex-col items-center py-3.5 gap-0.5 border-x border-gray-100">
            <div className="flex items-center gap-1 mb-0.5">
              <ShieldCheck size={11} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Consent</span>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${consent.className}`}>
              {consent.label}
            </span>
          </div>

          <div className="flex flex-col items-center py-3.5 gap-0.5">
            <div className="flex items-center gap-1 mb-0.5">
              <MessageCircle size={11} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Last call</span>
            </div>
            <span className="text-sm font-medium text-gray-800 text-center leading-tight">
              {mother.lastInteraction ? formatDateTime(mother.lastInteraction) : "None"}
            </span>
          </div>
        </div>

        {/* ── FLAG ──────────────────────────────────────────── */}
        {mother.currentFlag && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 flex gap-2.5 items-start">
            <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700 font-normal leading-snug">{mother.currentFlag}</p>
          </div>
        )}

        {/* ── TABS ──────────────────────────────────────────── */}
        <div className="flex justify-center gap-8 px-4 mt-4 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "details"
                ? "border-primary text-primary"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("checkins")}
            className={`pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
              activeTab === "checkins"
                ? "border-primary text-primary"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            Check-ins
            {mother.checkIns.length > 0 && (
              <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-medium">
                {mother.checkIns.length}
              </span>
            )}
          </button>
        </div>

        {/* ── TAB CONTENT ───────────────────────────────────── */}
        <div className="px-4 py-4">

          {activeTab === "details" && (
            <div className="flex flex-col gap-7">

              {/* Contact */}
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-200">Contact</p>
                <div className="divide-y divide-gray-100">
                  {[
                    { label: "Phone",         value: formatPhone(mother.phone) },
                    { label: "Call window",   value: mother.preferredCallWindow ? (callWindowLabels[mother.preferredCallWindow] ?? mother.preferredCallWindow) : "" },
                    { label: "Language",      value: mother.language ? mother.language.charAt(0).toUpperCase() + mother.language.slice(1) : "" },
                    { label: "Date of birth", value: formatDate(mother.dateOfBirth ?? "") },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-500 font-normal">{item.label}</span>
                      <span className="text-sm font-medium text-gray-900">{item.value || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clinical */}
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-200">Clinical</p>
                <div className="divide-y divide-gray-100">
                  {[
                    { label: "Delivery",       value: mother.deliveryType ? mother.deliveryType.charAt(0).toUpperCase() + mother.deliveryType.slice(1) : "" },
                    { label: "Gravida / Para", value: mother.gravida != null && mother.para != null ? `G${mother.gravida} P${mother.para}` : "" },
                    { label: "Delivered",      value: formatDate(mother.deliveryDate ?? "") },
                    { label: "Discharged",     value: formatDate(mother.dischargeDate) },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-500 font-normal">{item.label}</span>
                      <span className="text-sm font-medium text-gray-900">{item.value || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Emergency contacts (1–3). Falls back to the deprecated single
                  fields for records saved before the array existed. */}
              {(() => {
                const contacts =
                  mother.emergencyContacts && mother.emergencyContacts.length > 0
                    ? mother.emergencyContacts
                    : mother.emergencyContactName
                      ? [
                          {
                            name: mother.emergencyContactName,
                            phone: mother.emergencyContactPhone ?? "",
                            relationship: mother.emergencyContactRelationship ?? "",
                          },
                        ]
                      : [];
                if (contacts.length === 0) return null;
                return (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-200">
                      Emergency contacts
                    </p>
                    <div className="divide-y divide-gray-100">
                      {contacts.map((c, idx) => (
                        <div key={`${c.name}:${c.phone}`} className="flex items-center justify-between py-2">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">
                              {c.name || "—"}
                            </span>
                            {c.relationship && (
                              <span className="text-xs text-gray-400 font-normal capitalize">
                                {c.relationship}
                                {idx === 0 && contacts.length > 1 ? " · Primary" : ""}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {c.phone ? formatPhone(c.phone) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Alerts */}
              {((mother.risks && mother.risks.length > 0) || (mother.medications && mother.medications.length > 0)) && (
                <div className="flex flex-col gap-3">
                  {mother.risks && mother.risks.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-200 mb-2">Risk factors</p>
                      <div className="flex flex-wrap gap-1.5">
                        {mother.risks.map((r) => (
                          <span key={r} className="px-2.5 py-1 rounded-full text-amber-700 text-xs font-medium border border-amber-200 bg-amber-50">
                            {r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {mother.medications && mother.medications.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-200 mb-2">Medications</p>
                      <div className="flex flex-wrap gap-1.5">
                        {mother.medications.map((m) => (
                          <span key={m} className="px-2.5 py-1 rounded-full text-gray-600 text-xs font-medium border border-gray-200 bg-white">
                            {m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Alert className="border-gray-100 bg-gray-50">
                <ShieldCheck className="h-4 w-4 text-gray-400" />
                <AlertDescription className="text-gray-400 text-xs">
                  Severity labels are system-set and read-only for audit integrity.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {activeTab === "checkins" && (
            <div>
              {mother.checkIns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <PhoneCall size={32} className="text-gray-200" />
                  <p className="text-sm text-gray-400 font-normal">No check-ins recorded yet.</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-gray-100">
                  {mother.checkIns.map((checkIn) => (
                    <div key={checkIn.id} className="py-3.5 first:pt-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-800">{formatDate(checkIn.date)}</span>
                          <span className="text-gray-200">·</span>
                          <span className="text-xs text-gray-400 font-normal">Day {checkIn.day}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={getSeverityBadgeClass(checkIn.severity)}
                          size="sm"
                          dot
                        >
                          {checkIn.severity.charAt(0).toUpperCase() + checkIn.severity.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 font-normal leading-snug line-clamp-2">
                        {checkIn.summary}
                      </p>
                      {checkIn.transcript && (
                        <button
                          type="button"
                          onClick={() => handleTranscriptClick(checkIn.transcript!)}
                          className="mt-1.5 text-xs text-primary font-medium hover:underline"
                        >
                          View transcript →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── TRANSCRIPT MODAL ──────────────────────────────── */}
      <Dialog
        open={transcriptModal.open}
        onOpenChange={(open) => !open && setTranscriptModal({ open: false, text: "" })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Call transcript</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto mt-2">
            <pre className="whitespace-pre-wrap text-xs text-gray-700 font-mono leading-relaxed">
              {transcriptModal.text}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── ACTIONS (pinned footer) ────────────────────────── */}
      <div className="shrink-0 pt-4 border-t border-gray-100 flex justify-between items-center bg-white">
        <div>
          {!isWithdrawn && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onWithdrawClick}
                  className="text-xs text-red-400 font-normal flex items-center gap-1.5 hover:text-red-600 transition-colors"
                >
                  <XCircle size={15} />
                  <span>Withdraw from program</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>This will stop all scheduled calls for this mother.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={!onLogVisitClick ? "cursor-not-allowed" : ""}>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5"
                  onClick={onLogVisitClick}
                  disabled={!onLogVisitClick}
                >
                  <ClipboardList size={15} />
                  <span className="font-medium">Log visit</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{onLogVisitClick ? "Record a manual visit or note." : "You don't have permission to log visits"}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="flex items-center gap-1.5"
                disabled={isWithdrawn || triggerCall.isPending}
                onClick={handleCallNow}
              >
                {triggerCall.isPending
                  ? <Loader2 size={15} className="animate-spin" />
                  : <PhoneCall size={15} />}
                <span className="font-medium">Call now</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{isWithdrawn ? "Cannot call. Consent withdrawn." : "Trigger an immediate check-in call."}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export { MotherDetail };
