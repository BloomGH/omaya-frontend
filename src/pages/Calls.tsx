import { useState, useEffect, useMemo, useRef } from "react";
import { Search, ArrowLeft, SlidersHorizontal, X } from "lucide-react";
import { useCalls, useCall } from "../hooks/useCalls";
import { CallListItem } from "../components/calls/CallListItem";
import { CallDetail } from "../components/calls/CallDetail";
import { Input } from "../components/ui/Input";
import { Skeleton } from "../components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { useSlideIndicator } from "../hooks/useSlideIndicator";
import { getStatusDotClass } from "../lib/badge-helpers";

const CallsPage = () => {
  const [selectedCallId, setSelectedCallId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // react-doctor-disable-next-line react-doctor/no-event-handler
  const apiDate = dateFilter === "today" ? new Date().toISOString().slice(0, 10) : undefined;
  const { data: calls = [], isLoading } = useCalls(apiDate);

  const { data: selectedCall = null, isLoading: isCallLoading } = useCall(selectedCallId);

  // Intentional: default-select the first call once on load. selectedCallId is
  // then user-controlled (clicking a list item), so this is an init default,
  // not derived state.
  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (calls.length > 0 && !selectedCallId) {
      // react-doctor-disable-next-line react-doctor/no-derived-state
      setSelectedCallId(calls[0].id);
    }
  }, [calls, selectedCallId]);

  const listRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (dateFilter !== "all" ? 1 : 0);

  const filteredCalls = useMemo(() => {
    return calls.filter((call) => {
      if (statusFilter !== "all" && call.status !== statusFilter) return false;

if (search.trim()) {
        const q = search.toLowerCase();
        if (!call.motherName.toLowerCase().includes(q) && !call.callType.toLowerCase().includes(q)) {
          return false;
        }
      }

      return true;
    });
    // dateFilter intentionally excluded — date filtering happens server-side via apiDate.
  }, [calls, statusFilter, search]);

  const callIndicator = useSlideIndicator(listRef, '[data-slide-active="true"]', [
    selectedCallId,
    filteredCalls,
  ]);
  const activeCall = filteredCalls.find((c) => c.id === selectedCallId);
  const activeAccent = activeCall ? getStatusDotClass(activeCall.status) : "";

  const handleSelectCall = (id: string) => {
    setSelectedCallId(id);
    setMobileDetailOpen(true);
  };

  if (isLoading && calls.length === 0) {
    return (
      <div className="flex flex-1 min-h-0 flex-row gap-6">
        <div className="w-full lg:w-80 bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-9 w-full rounded-md" />
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-7 w-16 rounded-lg" />)}
          </div>
          <div className="space-y-1 mt-1">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[64px] w-full rounded-lg" />)}
          </div>
        </div>
        <div className="flex-1 bg-white rounded-2xl shadow-sm p-6 hidden lg:block">
          <Skeleton className="h-7 w-48 mb-1" />
          <Skeleton className="h-4 w-32 mb-5" />
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
          <Skeleton className="h-4 w-24 mb-3" />
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg mb-2" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-row gap-6">
      {/* ── LEFT PANEL ──────────────────────────────────────── */}
      <div
        className={`
          flex-shrink-0 flex-col bg-white rounded-2xl overflow-hidden shadow-sm
          w-full lg:w-80 h-full
          ${mobileDetailOpen ? "hidden lg:flex" : "flex"}
        `}
      >
        <div className="px-4 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Calls</h2>
        </div>

        <div className="px-4 pb-3 flex-shrink-0">
          <Input
            placeholder="Search mother or call type"
            leftIcon={<Search size={16} />}
            className="bg-gray-50/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="px-4 pb-3 flex-shrink-0 flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white rounded-md py-1.5 px-2.5 font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <SlidersHorizontal size={14} />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="ml-1 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center animate-in zoom-in-50 duration-150 motion-reduce:animate-none">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-3">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["all", "upcoming", "in_progress", "completed", "missed"].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setStatusFilter(val)}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                          statusFilter === val
                            ? "border-primary bg-primary-100 text-primary font-medium"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {val === "all" ? "All" : val === "in_progress" ? "In progress" : val.charAt(0).toUpperCase() + val.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Date</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["all", "today"].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setDateFilter(val)}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                          dateFilter === val
                            ? "border-primary bg-primary-100 text-primary font-medium"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {val === "all" ? "All dates" : "Today"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setDateFilter("all");
              }}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-primary transition-colors"
            >
              <X size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>

        <div
          ref={listRef}
          className="relative flex-1 overflow-y-auto overflow-x-hidden border-t border-gray-200"
        >
          {/* Sliding selection — background block + status accent bar */}
          {callIndicator && (
            <>
              <div
                aria-hidden
                className="absolute left-0 right-0 top-0 z-0 h-px origin-top bg-gray-50 transition-transform duration-300 ease-out pointer-events-none"
                style={{
                  transform: `translateY(${callIndicator.top}px) scaleY(${callIndicator.height})`,
                }}
              />
              <div
                aria-hidden
                className={`absolute left-0 top-0 z-0 w-1 h-px origin-top transition-transform duration-300 ease-out pointer-events-none ${activeAccent}`}
                style={{
                  transform: `translateY(${callIndicator.top}px) scaleY(${callIndicator.height})`,
                }}
              />
            </>
          )}
          {filteredCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-1 px-4">
              <p className="text-sm text-gray-400 font-normal text-center">No calls match this filter.</p>
            </div>
          ) : (
            filteredCalls.map((call) => (
              <CallListItem
                key={call.id}
                call={call}
                isSelected={selectedCallId === call.id}
                onClick={() => handleSelectCall(call.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────── */}
      <div
        className={`
          flex-col bg-white rounded-2xl overflow-hidden shadow-sm p-6
          flex-1 h-full
          ${mobileDetailOpen ? "flex" : "hidden lg:flex"}
        `}
      >
        <button
          type="button"
          className="lg:hidden flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 -mt-1 self-start"
          onClick={() => setMobileDetailOpen(false)}
        >
          <ArrowLeft size={16} />
          <span>Back to list</span>
        </button>

        {isCallLoading ? (
          <div className="flex flex-col gap-4">
            <div className="pb-4 border-b border-gray-100">
              <Skeleton className="h-7 w-48 mb-1" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
            <Skeleton className="h-4 w-24 mt-1" />
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl mb-1" />)}
          </div>
        ) : (
          <CallDetail key={selectedCallId} call={selectedCall} />
        )}
      </div>
    </div>
  );
};

export default CallsPage;
