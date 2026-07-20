import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Phone, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useDrawer } from "../contexts/DrawerContext";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard } from "../components/dashboard/StatCard";
import { SectionHeader } from "../components/dashboard/SectionHeader";
import { AlertsTable } from "../components/dashboard/AlertsTable";
import { CallsTable } from "../components/dashboard/CallsTable";
import { EscalationModal } from "../components/dashboard/EscalationModal";
import { useMothers } from "../hooks/useMothers";
import { useCalls } from "../hooks/useCalls";
import { useEscalations } from "../hooks/useEscalations";
import { useDashboardStats } from "../hooks/useDashboardStats";
import { useAcknowledgeAlert } from "../hooks/useMutations";
import { EscalationItem } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { getClinician } from "../lib/auth";
import { formatResponseMinutes } from "../lib/format";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "../components/ui/alert";

const Dashboard = () => {
  const navigate = useNavigate();
  const { openDrawer } = useDrawer();
  const { can } = useAuth();
  const { data: mothers = [], isLoading: mothersLoading } = useMothers();
  const todayISO = new Date().toISOString().slice(0, 10);
  const { data: calls = [], isLoading: callsLoading, isError: callsError, refetch: refetchCalls } = useCalls(todayISO);
  // Escalations carry mother PHI — only fetch when the caller may act on them.
  // Backend also enforces this (require_permission("escalate")); this avoids the
  // ungated request and a misleading empty-state for view-only roles.
  const { data: escalations = [], isLoading: escalationsLoading, isError: escalationsError, refetch: refetchEscalations } = useEscalations({ enabled: can("escalate") });
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const acknowledgeMutation = useAcknowledgeAlert();

  const [acknowledgeModal, setAcknowledgeModal] = useState<{
    open: boolean;
    item: EscalationItem | null;
  }>({
    open: false,
    item: null,
  });

  const handleNewDischarge = () => {
    openDrawer('discharge');
  };

  const handleAcknowledgeClick = (item: EscalationItem) => {
    setAcknowledgeModal({ open: true, item });
  };

  const handleAcknowledgeConfirm = async () => {
    if (acknowledgeModal.item) {
      try {
        await acknowledgeMutation.mutateAsync(acknowledgeModal.item.id);
        toast.success("Alert acknowledged.");
        setAcknowledgeModal({ open: false, item: null });
      } catch (err) {
        toast.error("Could not acknowledge. Please try again.");
        console.error("Failed to acknowledge alert", err);
      }
    }
  };

  const clinician = getClinician();
  const firstName = clinician?.name?.split(/\s+/)[0] ?? "User";

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* BLOCK 1: PAGE HEADER */}
      <PageHeader userName={firstName} onNewDischarge={can("create_discharges") ? handleNewDischarge : undefined} />

      {/* BLOCK 2: STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mothersLoading || callsLoading || escalationsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-none rounded-2xl bg-surface-tint-3">
              <CardContent className="p-3 md:p-4 space-y-2">
                <Skeleton className="h-4 w-24 bg-primary-200" />
                <Skeleton className="h-3 w-32 bg-primary-200" />
                <Skeleton className="h-9 w-16 bg-primary-200" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="Mothers in care"
              sublabel="Active right now"
              value={mothers.filter((m) => m.consentStatus === "active").length}
              tint={3}
              onViewAll={() => navigate("/mothers")}
            />
            <StatCard
              label="Calls today"
              sublabel="Scheduled & completed"
              value={calls.length}
              tint={3}
              onViewAll={() => navigate("/calls")}
            />
            {can("escalate") && (
              <StatCard
                label="Need attention"
                sublabel="L3 & L4 unacknowledged"
                value={escalations.length}
                tint={3}
                footerText={escalations.length > 0 ? `${escalations.length} waiting` : undefined}
                footerColor="#DC2626"
              />
            )}
            <StatCard
              label="Avg. response time"
              sublabel="To L3 & L4 alerts"
              value={stats ? formatResponseMinutes(stats.avgResponseMinutesL3L4) : "--"}
              tint={3}
            />
          </>
        )}
      </div>

      {/* BLOCK 3: TWO COLUMN ROW */}
      <div className="flex flex-col lg:flex-row gap-4">
        {can("escalate") && (
          <Card className="border-gray-200 shadow-sm rounded-2xl flex-1 flex flex-col min-h-[200px]">
            <CardHeader className="px-3 md:px-5 pt-4 md:pt-5 pb-0">
              <SectionHeader
                title="Needs attention now"
                count={escalations.length > 0 ? escalations.length : undefined}
              />
            </CardHeader>
            <CardContent className="px-3 md:px-5 pb-3 flex-1 flex flex-col">
              {escalationsLoading ? (
                <div className="flex flex-col gap-3 py-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-4 w-16 ml-4" />
                    </div>
                  ))}
                </div>
              ) : escalationsError ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <Alert variant="destructive" className="max-w-xs">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>Could not load alerts.</AlertDescription>
                  </Alert>
                  <button type="button" onClick={() => refetchEscalations()} className="mt-3 text-xs text-primary hover:underline flex items-center gap-1">
                    <RefreshCw size={12} /> Try again
                  </button>
                </div>
              ) : escalations.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
                  <CheckCircle2 size={32} className="text-primary" />
                  <span className="text-sm font-semibold text-gray-700 mt-1">No alerts right now</span>
                  <span className="text-xs text-gray-400 font-normal text-center max-w-[220px]">
                    All mothers are within safe response times.
                  </span>
                </div>
              ) : (
                <AlertsTable
                  escalations={escalations}
                  onAcknowledgeClick={handleAcknowledgeClick}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* RIGHT — "This week" summary panel */}
        <Card className="border-gray-200 shadow-sm rounded-2xl w-full lg:w-80 self-start">
          <CardHeader className="px-3 md:px-5 pt-4 md:pt-5 pb-0">
            <div className="flex justify-between items-center">
              <h3 className="text-sm md:text-base font-semibold text-gray-900">This week</h3>
              <span className="text-xs text-gray-400">Mon – today</span>
            </div>
          </CardHeader>
          <CardContent className="px-3 md:px-5 pb-3">
            {statsLoading ? (
              <div className="flex flex-col">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i}>
                    {i > 0 && <Separator className="bg-gray-100" />}
                    <div className="flex justify-between items-center py-3">
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-7 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col">
                {[
                  { label: "Calls completed", sub: "across the cohort", value: stats?.thisWeek.callsCompleted ?? '--' },
                  { label: "Escalations resolved", sub: "L3 & L4 acknowledged", value: stats?.thisWeek.escalationsResolved ?? '--' },
                  { label: "New discharges", sub: "mothers enrolled", value: stats?.thisWeek.newDischarges ?? '--' },
                  { label: "Avg. response time", sub: "to L3 & L4 alerts", value: stats ? formatResponseMinutes(stats.thisWeek.avgResponseMinutes) : '--' },
                ].map((row, idx) => (
                  <div key={row.label}>
                    {idx > 0 && <Separator className="bg-gray-100" />}
                    <div className="flex justify-between items-start py-3">
                      <div>
                        <div className="text-sm font-normal text-gray-600">
                          {row.label}
                        </div>
                        <div className="text-xs font-normal text-gray-400 mt-0.5">
                          {row.sub}
                        </div>
                      </div>
                      <div className={`text-xl font-bold ${row.value === '--' || row.value === '—' ? 'text-gray-300' : 'text-gray-900'}`}>
                        {row.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* BLOCK 4: TODAY'S CALLS */}
      <Card className="border-gray-200 shadow-sm rounded-2xl items-start">
        <CardHeader className="px-3 md:px-5 pt-4 md:pt-5 pb-0 w-full">
          <SectionHeader
            title="Today's calls"
            onViewAll={() => navigate("/calls")}
          />
        </CardHeader>
        <CardContent className="px-3 md:px-5 pb-3 w-full">
          {callsLoading ? (
            <div className="flex flex-col gap-4 py-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : callsError ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <Alert variant="destructive" className="max-w-xs">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Could not load calls.</AlertDescription>
              </Alert>
              <button type="button" onClick={() => refetchCalls()} className="text-xs text-primary hover:underline flex items-center gap-1">
                <RefreshCw size={12} /> Try again
              </button>
            </div>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <Phone size={32} className="text-primary" />
              <span className="text-sm font-semibold text-gray-700 mt-1">No calls scheduled today</span>
              <span className="text-xs text-gray-400 font-normal text-center max-w-[260px]">
                Calls will appear here once mothers are enrolled and discharged.
              </span>
            </div>
          ) : (
            <>
              <div className="text-xs md:text-sm font-normal text-gray-400 -mt-3 mb-4">
                {calls.filter(c => c.status === 'completed').length} of {calls.length} completed
              </div>
              <CallsTable calls={calls} />
            </>
          )}
        </CardContent>
      </Card>

      {can("escalate") && (
        <EscalationModal
          isOpen={acknowledgeModal.open}
          onClose={() =>
            setAcknowledgeModal({ ...acknowledgeModal, open: false })
          }
          onAcknowledge={handleAcknowledgeConfirm}
          item={acknowledgeModal.item}
        />
      )}
    </div>
  );
};

export default Dashboard;
