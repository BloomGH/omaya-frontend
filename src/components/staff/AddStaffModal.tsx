import { useState } from "react";
import { Loader2, AlertCircle, MailWarning } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert, AlertDescription } from "../ui/alert";
import { Skeleton } from "../ui/skeleton";
import { useAddStaff } from "../../hooks/useMutations";
import { useRoles } from "../../hooks/useRoles";
import { StaffRole } from "../../types";
import { toast } from "sonner";

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddStaffModal = ({ isOpen, onClose }: AddStaffModalProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<StaffRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteWarning, setInviteWarning] = useState(false);

  const addStaff = useAddStaff();
  const { data: roles = [], isLoading: rolesLoading } = useRoles();

  const canSubmit =
    name.trim() !== "" &&
    email.trim() !== "" &&
    selectedRole !== null &&
    !addStaff.isPending;

  const handleClose = () => {
    setName("");
    setEmail("");
    setSelectedRole(null);
    setError(null);
    setInviteWarning(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedRole) return;
    setError(null);

    try {
      const result = await addStaff.mutateAsync({ name, email, role: selectedRole });
      if (!result.invite_sent) {
        setInviteWarning(true);
      } else {
        toast.success(`Invite sent to ${email}.`);
        handleClose();
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setError("This email is already registered. Use a different email address.");
      } else if (status === 403) {
        setError("You don't have permission to add staff members.");
      } else {
        toast.error("Something went wrong. Please try again.");
        setError("Something went wrong. Please try again.");
      }
    }
  };

  // Post-success state: invite email failed
  if (inviteWarning) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Account created
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-1">
              The staff member was added but the invite email failed to send.
            </DialogDescription>
          </DialogHeader>

          <Alert className="mt-4 border-amber-200 bg-amber-50">
            <MailWarning className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 text-sm">
              The invite email didn't reach <strong>{email}</strong>. Ask them to use
              "Forgot password" to set their password and gain access.
            </AlertDescription>
          </Alert>

          <DialogFooter className="mt-6">
            <Button variant="default" onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Add a staff member
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 mt-1">
            They'll receive an email to set their own password.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Fields */}
        <div className="mt-5 flex flex-col gap-4">
          <Input
            label="Full name"
            placeholder="e.g. Abena Mensah"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <Input
            label="Work email"
            type="email"
            placeholder="name@korlebu.gov.gh"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
          />
        </div>

        {/* Role selector */}
        <div className="mt-5">
          <span id="add-staff-role-label" className="text-sm font-medium text-gray-700">Role</span>
          <div className="grid grid-cols-2 gap-2.5 mt-2" role="radiogroup" aria-labelledby="add-staff-role-label">
            {rolesLoading ? (
              [1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))
            ) : (
              roles.map((r) => {
                const selected = selectedRole === r.name;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedRole(r.name as StaffRole)}
                    className={`border rounded-xl p-3 cursor-pointer transition-colors text-left ${
                      selected
                        ? "border-primary bg-primary-100"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span className={`text-sm font-semibold ${selected ? "text-primary" : "text-gray-900"}`}>
                      {r.name}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5 font-normal">
                      {r.description ?? "No description available."}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-3 mt-7">
          <Button variant="outline" onClick={handleClose} disabled={addStaff.isPending}>
            Cancel
          </Button>
          <Button
            variant="default"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="flex items-center gap-2"
          >
            {addStaff.isPending && <Loader2 size={16} className="animate-spin" />}
            {addStaff.isPending ? "Sending invite..." : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { AddStaffModal };
