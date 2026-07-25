import { useState } from "react";
import { Plus, Users, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useStaff } from "../hooks/useStaff";
import { useRoles } from "../hooks/useRoles";
import { StaffRow } from "../components/staff/StaffRow";
import { PermissionsMatrix } from "../components/staff/PermissionsMatrix";
import { AddStaffModal } from "../components/staff/AddStaffModal";
import { AddRoleModal } from "../components/staff/AddRoleModal";
import { Button } from "../components/ui/Button";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import { Skeleton } from "../components/ui/skeleton";

const StaffPage = () => {
  const { can } = useAuth();
  const { data: staffMembers = [], isLoading, isError } = useStaff();
  const { data: roles = [] } = useRoles();
  const [activeFilter, setActiveFilter] = useState("All");
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [addRoleOpen, setAddRoleOpen] = useState(false);

  if (isLoading && staffMembers.length === 0) {
    return (
      <div className="flex flex-col gap-6 overflow-y-auto h-full">
        <div className="space-y-1 mt-6 md:mt-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-52" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-100">
            <div className="grid grid-cols-[1fr_160px_144px_160px_44px] gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-4 w-16" />
              ))}
              <span />
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-6 py-4">
                <div className="grid grid-cols-[1fr_160px_144px_160px_44px] gap-4 items-center">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <span />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeCount = staffMembers.filter((s) => s.status === "active").length;
  const invitedCount = staffMembers.filter(
    (s) => s.status === "invited",
  ).length;

  const filters = [
    { key: "All", label: "All" },
    ...roles.map((r) => ({ key: r.name, label: r.name })),
  ];

  const countByRole = (role: string) =>
    staffMembers.filter((s) => s.role === role).length;

  const visibleStaff =
    activeFilter === "All"
      ? staffMembers
      : staffMembers.filter((s) => s.role === activeFilter);

  return (
    <div className="flex flex-col gap-6 overflow-y-auto h-full">
      {/* PAGE HEADER — offset from the top so the action button clears the
          notifications bell that floats top-right (matches the dashboard, whose
          date line pushes its header row below the bell). */}
      <div className="flex items-start justify-between flex-shrink-0 mt-6 md:mt-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff & roles</h1>
          <p className="text-sm text-gray-500 mt-1">
            {staffMembers.length > 0
              ? `${activeCount} active · ${invitedCount} invited`
              : "No members yet"}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={!can("manage_staff") ? "cursor-not-allowed" : ""}>
              <Button
                variant="default"
                className="flex items-center gap-1.5"
                onClick={() => setAddStaffOpen(true)}
                disabled={!can("manage_staff")}
              >
                <Plus size={16} />
                <span>Add staff member</span>
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{can("manage_staff") ? "Add a new staff member" : "You don't have permission to manage staff"}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* FILTER PILLS */}
      <div className="flex gap-2 flex-wrap flex-shrink-0 -mt-2">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActiveFilter(f.key)}
            className={`rounded-full px-3 py-1 text-sm transition-colors border ${
              activeFilter === f.key
                ? "bg-primary-100 text-primary border-primary font-medium"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label} {f.key === "All" ? staffMembers.length : countByRole(f.key)}
          </button>
        ))}
      </div>

      {/* STAFF TABLE */}
      <div className="bg-white rounded-2xl shadow-sm flex-shrink-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_160px_144px_160px_44px] px-6 py-3 border-b border-gray-100">
              {["Name", "Role", "Status", "Last active"].map((col) => (
                <span key={col} className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  {col}
                </span>
              ))}
              <span />
            </div>

            {/* Rows */}
            {isError ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <AlertCircle size={28} className="text-red-200" />
                <p className="text-sm text-gray-400 font-normal">Could not load staff members.</p>
              </div>
            ) : visibleStaff.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <Users size={28} className="text-gray-200" />
                <p className="text-sm text-gray-400 font-normal">
                  {activeFilter === "All"
                    ? "No staff members yet."
                    : `No ${activeFilter} members found.`}
                </p>
                {activeFilter !== "All" && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter("All")}
                    className="text-xs text-primary font-medium hover:underline mt-0.5"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            ) : (
              visibleStaff.map((member) => (
                <StaffRow key={member.id} member={member} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ROLES & PERMISSIONS */}
      <div className="flex-shrink-0 pb-6">
        <PermissionsMatrix onAddRole={() => setAddRoleOpen(true)} />
      </div>

      {/* MODALS */}
      <AddStaffModal
        isOpen={addStaffOpen}
        onClose={() => setAddStaffOpen(false)}
      />
      <AddRoleModal
        isOpen={addRoleOpen}
        onClose={() => setAddRoleOpen(false)}
      />
    </div>
  );
};

export default StaffPage;
