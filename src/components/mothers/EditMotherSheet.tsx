import { useState } from "react";
import { Loader2, CalendarIcon, AlertCircle } from "lucide-react";
import { format, parse } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Alert, AlertDescription } from "../ui/alert";
import { ChipSelect } from "../onboarding/ChipSelect";
import {
  emptyEmergencyContact,
  emergencyContactsValid,
  toEmergencyContactsPayload,
  RELATIONSHIP_OPTIONS,
  type EmergencyContactForm,
} from "../onboarding/emergency-contacts";
import { EmergencyContacts } from "../onboarding/EmergencyContacts";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useUpdateMother } from "../../hooks/useMutations";
import { LANGUAGE_OPTIONS } from "../../lib/languages";
import { Mother } from "../../types";
import { toast } from "sonner";

interface EditMotherSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mother: Mother;
}

const CALLING_WINDOW_OPTIONS = [
  { value: "morning", label: "Morning (8am–12pm)" },
  { value: "afternoon", label: "Afternoon (12pm–4pm)" },
  { value: "evening", label: "Evening (4pm–7pm)" },
  { value: "inbound", label: "Inbound (mother calls)" },
];

const DELIVERY_TYPE_OPTIONS = [
  { value: "vaginal", label: "Vaginal" },
  { value: "caesarean", label: "Caesarean" },
];

const KNOWN_COUNTRY_CODES = ["+233", "+234", "+225", "+228", "+221"];

// Split a stored E.164 phone into { countryCode, localDigits } for the form.
const splitPhone = (phone: string) => {
  const code = KNOWN_COUNTRY_CODES.find((c) => phone.startsWith(c));
  if (code) {
    return { countryCode: code, phone: phone.slice(code.length).replace(/\D/g, "") };
  }
  return { countryCode: "+233", phone: phone.replace(/^\+/, "").replace(/\D/g, "") };
};

// A stored relationship maps to a known chip if it matches an option's value or
// label (case-insensitive); otherwise it's treated as the free-text "other".
const splitRelationship = (relationship: string) => {
  const match = RELATIONSHIP_OPTIONS.find(
    (o) =>
      o.value !== "other" &&
      (o.value === relationship.toLowerCase() ||
        o.label.toLowerCase() === relationship.toLowerCase()),
  );
  return match
    ? { relationship: match.value, relationshipCustom: "" }
    : { relationship: "other", relationshipCustom: relationship };
};

// Seed the editable emergency-contact rows from a mother's stored contacts,
// falling back to the deprecated single fields, then to one empty row.
const buildEmergencyContacts = (mother: Mother): EmergencyContactForm[] => {
  const source =
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
  if (source.length === 0) return [emptyEmergencyContact()];
  return source.map((c) => ({
    id: crypto.randomUUID(),
    name: c.name,
    ...splitPhone(c.phone),
    ...splitRelationship(c.relationship),
  }));
};

// A labelled date field. Extracted to a real component (not an inline
// renderXxx() call) so React preserves the Popover's identity across renders.
const DatePickerField = ({
  id,
  label,
  field,
  value,
  onChange,
}: {
  id: string;
  label: string;
  field: "dateOfBirth" | "deliveryDate";
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="ghost"
          className="justify-start gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 font-normal w-full h-10 hover:bg-gray-50"
        >
          <CalendarIcon size={16} className="text-gray-400 shrink-0" />
          {value ? (
            format(parse(value, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")
          ) : (
            <span className="text-gray-400">Select date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          {...(field === "dateOfBirth" ? { captionLayout: "dropdown" as const, startMonth: new Date(1940, 0, 1), endMonth: new Date() } : {})}
          selected={value ? parse(value, "yyyy-MM-dd", new Date()) : undefined}
          onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : "")}
        />
      </PopoverContent>
    </Popover>
  </div>
);

const buildForm = (mother: Mother) => ({
  phone: mother.phone,
  dateOfBirth: mother.dateOfBirth ?? "",
  language: mother.language ?? "",
  gravida: mother.gravida != null ? String(mother.gravida) : "",
  para: mother.para != null ? String(mother.para) : "",
  preferredCallWindow: mother.preferredCallWindow ?? "",
  deliveryType: mother.deliveryType ?? "",
  deliveryDate: mother.deliveryDate ?? "",
});

const EditMotherSheet = ({ isOpen, onClose, mother }: EditMotherSheetProps) => {
  const updateMutation = useUpdateMother();

  const [form, setForm] = useState(() => buildForm(mother));
  const [emergencyContacts, setEmergencyContacts] = useState<
    EmergencyContactForm[]
  >(() => buildEmergencyContacts(mother));
  const [emergencyTouched, setEmergencyTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form each time the sheet opens (or the mother changes while
  // open) by comparing against the previous open-signature during render —
  // avoids the extra render + stale-value flash of a useEffect. Uses the pure
  // "adjust state when a prop changes" idiom (setState during render triggers
  // an immediate re-render with no committed paint).
  const openSig = isOpen ? mother.id : "__closed__";
  const [prevSig, setPrevSig] = useState(openSig);
  if (openSig !== prevSig) {
    setPrevSig(openSig);
    if (isOpen) {
      setForm(buildForm(mother));
      setEmergencyContacts(buildEmergencyContacts(mother));
      setEmergencyTouched(false);
      setError(null);
    }
  }

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "phone") setError(null);
  };

  const handleSave = async () => {
    setError(null);
    if (!emergencyContactsValid(emergencyContacts)) {
      setEmergencyTouched(true);
      return;
    }
    try {
      await updateMutation.mutateAsync({
        motherId: mother.id,
        data: {
          phone: form.phone || undefined,
          date_of_birth: form.dateOfBirth || undefined,
          language: form.language || undefined,
          gravida: form.gravida !== "" ? parseInt(form.gravida) : undefined,
          para: form.para !== "" ? parseInt(form.para) : undefined,
          preferred_call_window: form.preferredCallWindow || undefined,
          delivery_type: form.deliveryType || undefined,
          delivery_date: form.deliveryDate || undefined,
          // Full-replacement list (1–3 contacts).
          emergency_contacts: toEmergencyContactsPayload(emergencyContacts),
        },
      });
      toast.success("Details updated.");
      onClose();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { error?: string } } })?.response?.status;
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (status === 409 || code === "phone_already_enrolled") {
        setError("This phone number is already enrolled with another mother.");
      } else if (status === 404 || code === "mother_not_found") {
        setError("This mother's record was not found. Please reload and try again.");
      } else {
        toast.error("Could not update details. Please try again.");
      }
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md flex flex-col h-full p-0">
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <SheetHeader>
            <SheetTitle>Edit: {mother.name}</SheetTitle>
          </SheetHeader>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium -mb-1">Contact</p>

          <Input
            label="Phone number"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            fullWidth
          />

          <DatePickerField
            id="edit-mother-dob"
            label="Date of birth"
            field="dateOfBirth"
            value={form.dateOfBirth}
            onChange={(value) => updateField("dateOfBirth", value)}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-mother-language" className="text-sm font-medium text-gray-700">Preferred language</label>
            <ChipSelect
              id="edit-mother-language"
              max={1}
              options={LANGUAGE_OPTIONS}
              selected={form.language ? [form.language] : []}
              onChange={(val) => updateField("language", val.length > 0 ? val[0] : "")}
            />
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-4">Clinical</p>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <Input
                label="Gravida"
                type="number"
                min="0"
                placeholder="0"
                value={form.gravida}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || parseInt(val) >= 0) updateField("gravida", val);
                }}
                fullWidth
              />
              <Input
                label="Para"
                type="number"
                min="0"
                placeholder="0"
                value={form.para}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || parseInt(val) >= 0) updateField("para", val);
                }}
                fullWidth
              />
            </div>

            <div className="flex flex-col gap-1.5 mb-5">
              <label htmlFor="edit-mother-delivery-type" className="text-sm font-medium text-gray-700">Delivery type</label>
              <ChipSelect
                id="edit-mother-delivery-type"
                max={1}
                options={DELIVERY_TYPE_OPTIONS}
                selected={form.deliveryType ? [form.deliveryType] : []}
                onChange={(val) => updateField("deliveryType", val.length > 0 ? val[0] : "")}
              />
            </div>

            <DatePickerField
              id="edit-mother-delivery-date"
              label="Delivery date"
              field="deliveryDate"
              value={form.deliveryDate}
              onChange={(value) => updateField("deliveryDate", value)}
            />
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-4">Program settings</p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-mother-call-window" className="text-sm font-medium text-gray-700">Preferred calling window</label>
              <ChipSelect
                id="edit-mother-call-window"
                max={1}
                options={CALLING_WINDOW_OPTIONS}
                selected={form.preferredCallWindow ? [form.preferredCallWindow] : []}
                onChange={(val) => updateField("preferredCallWindow", val.length > 0 ? val[0] : "")}
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-4">
              Emergency contacts
            </p>
            <EmergencyContacts
              contacts={emergencyContacts}
              onChange={setEmergencyContacts}
              touched={emergencyTouched}
            />
          </div>
        </div>

        {/* Fixed footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex-1 gap-2"
          >
            {updateMutation.isPending && <Loader2 size={16} className="animate-spin" />}
            Save changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export { EditMotherSheet };
