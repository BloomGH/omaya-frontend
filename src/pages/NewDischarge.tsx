import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  UserPlus,
  CheckCircle2,
  Baby,
  Scissors,
  Heart,
  Phone,
  ArrowRight,
  ArrowLeft,
  CalendarIcon,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { format, parse, addDays } from "date-fns";
import { OnboardingShell } from "../components/onboarding/OnboardingShell";
import { StepHeader } from "../components/onboarding/StepHeader";
import { ChipSelect } from "../components/onboarding/ChipSelect";
import {
  emptyEmergencyContact,
  emergencyContactsValid,
  toEmergencyContactsPayload,
  RELATIONSHIP_OPTIONS,
  type EmergencyContactForm,
} from "../components/onboarding/emergency-contacts";
import { EmergencyContacts } from "../components/onboarding/EmergencyContacts";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "../components/ui/alert";
import { Card, CardContent } from "../components/ui/card";
import { Calendar } from "../components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { useDrawer } from "../contexts/DrawerContext";
import { useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "../lib/api";
import { groupPhoneDigits } from "../lib/format";
import { LANGUAGE_OPTIONS } from "../lib/languages";
import { toast } from "sonner";

interface NewDischargeProps {
  onClose?: () => void;
}

// Risk factors split into history (present before this pregnancy) vs. those
// that arose during/because of this pregnancy. Both groups still write to the
// single `formData.risks` array, so the payload is unchanged.
const PRE_EXISTING_RISKS = [
  { value: "prior_csection", label: "Previous C-section" },
  { value: "prior_loss", label: "Previous pregnancy loss" },
  { value: "sickle_cell", label: "Sickle cell disease" },
  { value: "hiv_pmtct", label: "On HIV care (PMTCT)" },
];
const PREGNANCY_RISKS = [
  { value: "hypertension", label: "High blood pressure or pre-eclampsia" },
  { value: "diabetes", label: "Diabetes (including during pregnancy)" },
  { value: "multiple", label: "Twins or more" },
];
const PRE_EXISTING_VALUES = PRE_EXISTING_RISKS.map((o) => o.value);
const PREGNANCY_VALUES = PREGNANCY_RISKS.map((o) => o.value);

interface MotherSearchResult {
  id: string;
  name: string;
  phone: string;
  edd: string;
}

const relationshipLabel = (c: EmergencyContactForm) => {
  if (c.relationship === "other") return c.relationshipCustom.trim();
  return (
    RELATIONSHIP_OPTIONS.find((o) => o.value === c.relationship)?.label ??
    c.relationship
  );
};

const labelForMedication = (value: string) => {
  const labels: Record<string, string> = {
    pain_relief: "Pain relief",
    antibiotics: "Antibiotics",
    iron_folic: "Iron & folic acid",
    wound_care: "Wound-care supplies",
    none: "None",
    not_sure: "Not sure",
  };
  return labels[value] || value.replace(/_/g, " ");
};

const NewDischarge = ({ onClose }: NewDischargeProps = {}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openDrawer, setCloseHandler } = useDrawer();
  // Raw close — used on successful submit (no prompt).
  const handleClose = onClose ?? (() => navigate("/dashboard"));
  const [searchPhase, setSearchPhase] = useState(true);
  const [foundMother, setFoundMother] = useState<MotherSearchResult | null>(
    null,
  );
  const [currentStep, setCurrentStep] = useState(1);
  // Slide direction for the step transition: forward slides in from the right,
  // back from the left.
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [discardOpen, setDiscardOpen] = useState(false);
  // Whether the free-text "Other" risk chip is toggled on (the typed value
  // lives in formData.risksOther and is sent as `risks_other`, NOT in `risks`).
  const [riskOtherOn, setRiskOtherOn] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [touched, setTouched] = useState(false);
  const [countryCode, setCountryCode] = useState("+233");
  // 1–3 emergency contacts (index 0 = primary). Each carries its own country
  // code since each phone is independent. Resets on unmount (drawer close).
  const [emergencyContacts, setEmergencyContacts] = useState<
    EmergencyContactForm[]
  >([emptyEmergencyContact()]);
  // Holds the mother's id once a record is selected/created. Read only inside
  // submit handlers to choose the POST path — never rendered — so a ref keeps
  // it out of the render cycle.
  const motherIdRef = useRef("");
  const [searchResults, setSearchResults] = useState<MotherSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [formData, setFormData] = useState({
    motherName: "",
    phoneNumber: "",
    deliveryDate: "",
    dischargeDate: new Date().toISOString().split("T")[0],
    deliveryType: "" as "vaginal" | "caesarean" | "",
    outcome: "" as "well" | "loss" | "",
    medications: [] as string[],
    callingWindow: "" as "morning" | "afternoon" | "evening" | "inbound" | "",
    language: "",
    dateOfBirth: "",
    edd: "",
    gravida: "",
    para: "",
    risks: [] as string[],
    risksOther: "",
    consentCalls: false,
    consentRecording: false,
  });

  const totalSteps = foundMother ? 5 : 6;

  // "Progress" worth warning about = an existing mother has been selected, or
  // the user has moved past the search screen into the actual form.
  const isDirty = foundMother !== null || (!searchPhase && currentStep >= 1);

  // Guarded close: used by the X, the intro Back, and overlay-click / Escape
  // (registered with the drawer). Prompts before discarding when dirty. A
  // successful submit calls handleClose() directly and skips this.
  const requestClose = () => {
    if (isDirty) setDiscardOpen(true);
    else handleClose();
  };

  // Register the guard so the drawer's overlay-click / Escape route through it.
  useEffect(() => {
    setCloseHandler(requestClose);
    return () => setCloseHandler(null);
    // requestClose is intentionally re-bound only when isDirty changes.
    // react-doctor-disable-next-line react-doctor/exhaustive-deps
  }, [isDirty, setCloseHandler]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Intentional debounced-search flow: loading/error/results are set together
  // as the query settles.
  // react-doctor-disable-next-line react-doctor/no-cascading-set-state
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setSearchError("");
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await api.get(
          `/mothers/search?q=${encodeURIComponent(searchQuery)}`,
        );
        const results = res.data?.results;
        if (Array.isArray(results)) {
          setSearchResults(results);
        } else {
          setSearchResults([]);
          // Only show error if we expected results but got none due to error
          if (res.data?.error) {
            toast.error("Could not load results. Please try again.");
          }
        }
      } catch (err) {
        console.error("Search error:", err);
        setSearchResults([]);
        toast.error("Search failed. Please check your connection.");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deliveryDate = formData.deliveryDate
    ? parse(formData.deliveryDate, "yyyy-MM-dd", new Date())
    : null;
  const dischargeDate = formData.dischargeDate
    ? parse(formData.dischargeDate, "yyyy-MM-dd", new Date())
    : null;
  const firstCallDate =
    deliveryDate && dischargeDate
      ? deliveryDate >= today
        ? format(addDays(dischargeDate, 3), "dd/MM/yyyy")
        : format(addDays(new Date(), 1), "dd/MM/yyyy")
      : "";

  // Mirror AddMother's country-code-aware check: strip the dial code + any
  // separators, require >=9 local digits. (The old +233-only regex rejected
  // the non-GH numbers enrollment accepts.)
  const phoneDigits = formData.phoneNumber
    .replace(countryCode, "")
    .replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 9;

  const emergencyValid = emergencyContactsValid(emergencyContacts);

  // Summary rows for the emergency contacts (one "name (relationship)" + phone
  // pair per contact). Labels number the contacts when there's more than one.
  const emergencySummaryRows = emergencyContacts.flatMap((c, idx) => {
    const suffix =
      emergencyContacts.length > 1 ? ` ${idx + 1}` : "";
    return [
      {
        label: `Emergency contact${suffix}`,
        value: c.name.trim()
          ? `${c.name.trim()} (${relationshipLabel(c)})`
          : "None recorded",
      },
      {
        label: `Emergency phone${suffix}`,
        value: c.phone
          ? `${c.countryCode}${c.phone.replace(/\D/g, "")}`
          : "None recorded",
      },
    ];
  });

  // Para (births) can never exceed gravida (pregnancies) — they're tied.
  const paraExceedsGravida =
    formData.gravida !== "" &&
    formData.para !== "" &&
    Number(formData.para) > Number(formData.gravida);

  // Whether the current step is complete enough to advance. Mirrors the
  // per-step guards in handleNext so the Continue button greys out until the
  // required fields are filled. Optional steps (intro, medications) and the
  // final review step are always allowed.
  const canContinue = (() => {
    if (currentStep === 0) return true;
    if (foundMother) {
      if (currentStep === 1)
        return Boolean(
          formData.deliveryDate &&
            formData.dischargeDate &&
            formData.callingWindow &&
            formData.deliveryType,
        );
      if (currentStep === 2) return Boolean(formData.outcome);
      if (currentStep === 3) return formData.medications.length > 0;
      if (currentStep === 4) return emergencyValid;
      return true;
    }
    if (currentStep === 1)
      return Boolean(
        formData.motherName &&
          formData.phoneNumber &&
          phoneValid &&
          formData.dateOfBirth &&
          formData.gravida !== "" &&
          formData.para !== "" &&
          !paraExceedsGravida &&
          formData.deliveryDate &&
          formData.dischargeDate &&
          formData.language &&
          formData.callingWindow &&
          formData.deliveryType,
      );
    if (currentStep === 2) return Boolean(formData.outcome);
    if (currentStep === 3)
      // Optional step, but a toggled-on "Other" must be described.
      return !riskOtherOn || formData.risksOther.trim() !== "";
    if (currentStep === 4) return Boolean(formData.consentCalls);
    if (currentStep === 5) return emergencyValid;
    return true;
  })();

  const handleNext = async () => {
    // Step 0 intro - no validation
    if (currentStep === 0) {
      setCurrentStep(1);
      return;
    }

    setTouched(true);

    if (foundMother) {
      // Shorter 4-step flow validation for existing patients
      if (currentStep === 1) {
        const step1Valid =
          formData.deliveryDate &&
          formData.dischargeDate &&
          formData.callingWindow &&
          formData.deliveryType;
        if (!step1Valid) return;
      } else if (currentStep === 2) {
        const step2Valid = formData.outcome;
        if (!step2Valid) return;
      } else if (currentStep === 3) {
        // Medications must be answered explicitly ("None sent home" counts).
        if (formData.medications.length === 0) return;
      }
      if (currentStep === 4) {
        if (!emergencyValid) return;
      }
    } else {
      // 6-step flow validation for new patients
      if (currentStep === 1) {
        const step1Valid =
          formData.motherName &&
          formData.phoneNumber &&
          phoneValid &&
          formData.dateOfBirth &&
          formData.gravida !== "" &&
          formData.para !== "" &&
          !paraExceedsGravida &&
          formData.deliveryDate &&
          formData.dischargeDate &&
          formData.language &&
          formData.callingWindow &&
          formData.deliveryType;
        if (!step1Valid) return;
      } else if (currentStep === 2) {
        const step2Valid = formData.outcome;
        if (!step2Valid) return;
      } else if (currentStep === 3) {
        // Optional step, but a toggled-on "Other" must be described.
        if (riskOtherOn && formData.risksOther.trim() === "") return;
      } else if (currentStep === 4) {
        const step4Valid = formData.consentCalls;
        if (!step4Valid) return;
      } else if (currentStep === 5) {
        if (!emergencyValid) return;
      }
    }

    setTouched(false);
    if (currentStep < totalSteps) {
      setDirection("forward");
      setCurrentStep((prev) => prev + 1);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const dischargePayload: Record<string, unknown> = {
        delivery_date: formData.deliveryDate,
        discharge_date: formData.dischargeDate,
        delivery_type: formData.deliveryType,
        medications: formData.medications.filter(
          (m) => m !== "none" && m !== "not_sure",
        ),
        outcome: formData.outcome,
        preferred_call_window: formData.callingWindow,
        // Existing mothers have no consent step in this flow — omit the keys so
        // the backend keeps their originally-recorded consent (do NOT fabricate
        // it as true). Only the new-patient flow below collects fresh consent.
        ...(foundMother
          ? {}
          : {
              consent_calls: formData.consentCalls,
              consent_recording: formData.consentRecording,
            }),
        emergency_contacts: toEmergencyContactsPayload(emergencyContacts),
      };
      if (formData.phoneNumber) {
        dischargePayload.phone = formData.phoneNumber;
      }

      let dischargeRes;
      if (motherIdRef.current) {
        // existing patient OR new patient whose record was already created on a prior failed attempt
        dischargeRes = await api.post(`/mothers/${motherIdRef.current}/discharge`, dischargePayload);
      } else {
        const motherRes = await api.post("/mothers", {
          full_name: formData.motherName,
          phone: formData.phoneNumber,
          date_of_birth: formData.dateOfBirth,
          edd: formData.deliveryDate,
          gravida: parseInt(formData.gravida) || 0,
          para: parseInt(formData.para) || 0,
          language: formData.language,
          risks: formData.risks.filter((r) => r !== "none"),
          risks_other: formData.risksOther.trim()
            ? [formData.risksOther.trim()]
            : [],
          consent_calls: formData.consentCalls,
          consent_recording: formData.consentRecording,
        });
        const newId: string = motherRes.data.mother_id ?? motherRes.data.id;
        motherIdRef.current = newId;
        dischargeRes = await api.post(`/mothers/${newId}/discharge`, dischargePayload);
      }

      const firstCallAt: string | null = dischargeRes.data?.first_call_scheduled_at ?? null;
      const successMsg =
        formData.outcome === "loss"
          ? "Discharge recorded. Bereavement support flow activated."
          : firstCallAt
            ? `Discharge recorded. First call scheduled for ${format(new Date(firstCallAt), "d MMM 'at' h:mm a")}.`
            : "Discharge recorded. Her first call has been scheduled.";
      queryClient.invalidateQueries({ queryKey: ["mothers"] });
      queryClient.invalidateQueries({ queryKey: ["mother"] });
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      toast.success(successMsg);
      handleClose();
    } catch (err: unknown) {
      const apiError = extractApiError(
        err,
        "Could not save discharge. Please try again.",
      );
      // Log the precise, field-level 422 detail (field + message + type only —
      // we deliberately don't echo the submitted `input` values, which are PHI)
      // so a validation failure is debuggable straight from the console.
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      if (Array.isArray(detail)) {
        console.error(
          "Discharge rejected (422):",
          detail.map((d) => {
            const it = d as { loc?: unknown[]; msg?: string; type?: string };
            return {
              field: Array.isArray(it.loc) ? it.loc.join(".") : it.loc,
              msg: it.msg,
              type: it.type,
            };
          }),
        );
      }
      if (apiError.status === 409 || apiError.error_code === "already_discharged") {
        setSubmitError(
          "This mother has already been discharged. Search for her record to view or update it.",
        );
      } else if (
        apiError.status === 403 ||
        apiError.error_code === "insufficient_role"
      ) {
        setSubmitError(
          "You don't have permission to record discharges. Contact your administrator.",
        );
      } else if (
        apiError.status === 422 ||
        apiError.error_code === "validation_error"
      ) {
        // Show exactly which field(s) the backend rejected.
        setSubmitError(`Some details were rejected — ${apiError.message}`);
      } else {
        setSubmitError(apiError.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setTouched(false);
    setDirection("back");
    if (currentStep === 0) {
      requestClose();
      return;
    }
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    } else if (currentStep === 1) {
      if (foundMother) {
        setSearchPhase(true);
      } else {
        setCurrentStep(0);
      }
    }
  };

  const updateField = <K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K],
  ) => {
    if (field === "risks") {
      const newRisks = value as string[];
      const prevRisks = formData.risks;

      // If 'none' was just added, clear others
      if (newRisks.includes("none") && !prevRisks.includes("none")) {
        setFormData((prev) => ({ ...prev, risks: ["none"] }));
        return;
      }
      // If something else was added while 'none' was present, remove 'none'
      if (newRisks.length > 1 && newRisks.includes("none")) {
        setFormData((prev) => ({
          ...prev,
          risks: newRisks.filter((r) => r !== "none"),
        }));
        return;
      }
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const discardDialog = (
    <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Discard this discharge?</DialogTitle>
          <DialogDescription>
            You'll lose the details you've entered so far. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => setDiscardOpen(false)}>
            Keep editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setDiscardOpen(false);
              handleClose();
            }}
          >
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (searchPhase) {
    return (
      <>
      <OnboardingShell
        onClose={requestClose}
        currentStep={0}
        totalSteps={totalSteps}
        stepLabel="Discharge"
      >
        <div className="max-w-lg mx-auto mt-6">
          <StepHeader
            step={1}
            title="Find her record"
            description="She enrolled during a pregnancy visit"
          />

          {searchError && (
            <div className="mt-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{searchError}</AlertDescription>
              </Alert>
            </div>
          )}

          <label
            htmlFor="discharge-search"
            className="text-sm font-medium text-gray-700 mt-6"
          >
            Search for an existing patient
          </label>

          <div className="relative mt-2">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <Input
              id="discharge-search"
              placeholder="Search by name or phone number"
              className="border-gray-200 placeholder:text-gray-400 h-10 pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {!searching &&
              searchResults?.length > 0 &&
              searchResults.map((result) => (
                <button
                  type="button"
                  key={result.id}
                  onClick={() => {
                    motherIdRef.current = result.id;
                    setFoundMother(result);
                    setFormData((prev) => ({
                      ...prev,
                      motherName: result.name,
                      phoneNumber: result.phone,
                    }));
                    setDirection("forward");
                    setSearchPhase(false);
                    setCurrentStep(1);
                  }}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-primary cursor-pointer transition-colors flex justify-between items-center group shadow-sm"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900">
                      {result.name}
                    </span>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400 font-normal">
                        {result.phone}
                      </span>
                      {result.edd && (
                        <>
                          <span className="text-xs text-gray-300">·</span>
                          <span className="text-xs text-gray-400 font-normal">
                            EDD{" "}
                            {format(
                              parse(result.edd, "yyyy-MM-dd", new Date()),
                              "dd/MM/yyyy",
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    Select →
                  </span>
                </button>
              ))}
            {!searchError &&
              searchQuery.length >= 2 &&
              !searching &&
              searchResults?.length === 0 && (
                <Alert className="border-gray-200 bg-gray-50 text-gray-500 mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Not found</AlertTitle>
                  <AlertDescription>
                    No record found for '{searchQuery}'. If she was not enrolled
                    during pregnancy, use the new discharge option below.
                  </AlertDescription>
                </Alert>
              )}
            {searching && (
              <div className="flex flex-col gap-2 mt-2">
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex justify-between items-center">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="h-px bg-gray-100 flex-1" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-widest">
              or
            </span>
            <div className="h-px bg-gray-100 flex-1" />
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setDirection("forward");
                setFoundMother(null);
                setSearchPhase(false);
                setCurrentStep(0);
              }}
              className="bg-white border border-gray-200 rounded-xl px-5 py-6 cursor-pointer hover:border-primary hover:bg-primary-100/30 transition-colors flex flex-col items-center text-center gap-3 shadow-sm"
            >
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <UserPlus size={20} className="text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-900">
                  Discharging a new mother
                </span>
                <span className="text-xs text-gray-400 font-normal mt-1 leading-relaxed">
                  She has no antenatal record with us
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => openDrawer("add-mother")}
              className="bg-white border border-gray-200 rounded-xl px-5 py-6 cursor-pointer hover:border-primary hover:bg-primary-100/30 transition-colors flex flex-col items-center text-center gap-3 shadow-sm"
            >
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <Baby size={20} className="text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-900">
                  Enrolling during pregnancy
                </span>
                <span className="text-xs text-gray-400 font-normal mt-1 leading-relaxed">
                  She is still pregnant, not yet delivered
                </span>
              </div>
            </button>
          </div>
        </div>
      </OnboardingShell>
      {discardDialog}
      </>
    );
  }

  return (
    <>
    <OnboardingShell
      onClose={requestClose}
      currentStep={currentStep}
      totalSteps={totalSteps}
      stepLabel={
        foundMother ? "Discharge - existing patient" : "Discharge - new patient"
      }
      leftAction={
        <Button variant="ghost" onClick={handleBack} className="gap-2">
          <ArrowLeft size={18} />
          <span>Back</span>
        </Button>
      }
      rightAction={
        <Button
          variant="default"
          onClick={handleNext}
          className="gap-2"
          disabled={submitting || !canContinue}
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          <span>
            {currentStep === 0
              ? "Start enrollment"
              : currentStep === totalSteps
                ? "Confirm discharge"
                : "Continue"}
          </span>
          {!submitting && <ArrowRight size={18} />}
        </Button>
      }
    >
      {/* Keyed per step so the block remounts and the directional slide replays
          on every Continue / Back. */}
      <div
        key={currentStep}
        className={`animate-in fade-in-0 duration-300 ease-out motion-reduce:animate-none ${
          direction === "forward"
            ? "slide-in-from-right-5"
            : "slide-in-from-left-5"
        }`}
      >
      {currentStep === 0 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            title="Before we start"
            description="This takes about 3 minutes. You're enrolling her in Omaya's follow-up care program. She'll receive check-in calls after delivery to make sure she and her baby are doing well."
          />
          <div className="flex flex-col gap-3">
            {[
              {
                icon: Phone,
                title: "She'll receive calls, not messages",
                description:
                  "Omaya calls her directly. No app needed. Works on any phone.",
              },
              {
                icon: ShieldCheck,
                title: "Her data is private",
                description:
                  "Only her care team can see her record. She controls her consent.",
              },
              {
                icon: Clock,
                title: "You can stop anytime",
                description:
                  "If she changes her mind, you can withdraw her from the program in one click.",
              },
            ].map((card) => (
              <Card key={card.title} className="border-gray-100 shadow-sm">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                    <card.icon size={20} className="text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900">
                      {card.title}
                    </span>
                    <span className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {card.description}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── EXISTING PATIENT FLOW ── */}

      {foundMother && currentStep === 1 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={1}
            title="Discharge details"
            description="Dates, delivery type, and preferred contact window."
          />
          <div className="flex flex-col gap-5">
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1">
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 font-medium">
                  Full name
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {foundMother.name}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 font-medium">Phone</span>
                <span className="text-sm font-semibold text-gray-900">
                  {foundMother.phone}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-gray-700">
                  Delivery date
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`justify-start gap-2 bg-white border rounded-md px-3 py-2 text-sm text-gray-900 font-normal w-full h-10 hover:bg-gray-50 ${touched && !formData.deliveryDate ? "border-red-400" : "border-gray-200"}`}
                    >
                      <CalendarIcon
                        size={16}
                        className="text-gray-400 shrink-0"
                      />
                      {formData.deliveryDate ? (
                        format(
                          parse(
                            formData.deliveryDate,
                            "yyyy-MM-dd",
                            new Date(),
                          ),
                          "dd/MM/yyyy",
                        )
                      ) : (
                        <span className="text-gray-400">Select date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        formData.deliveryDate
                          ? parse(
                              formData.deliveryDate,
                              "yyyy-MM-dd",
                              new Date(),
                            )
                          : undefined
                      }
                      onSelect={(date) =>
                        updateField(
                          "deliveryDate",
                          date ? format(date, "yyyy-MM-dd") : "",
                        )
                      }
                    />
                  </PopoverContent>
                </Popover>
                {touched && !formData.deliveryDate && (
                  <span className="text-xs text-red-500">
                    Please select a delivery date
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-gray-700">
                  Discharge date
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`justify-start gap-2 bg-white border rounded-md px-3 py-2 text-sm text-gray-900 font-normal w-full h-10 hover:bg-gray-50 ${touched && !formData.dischargeDate ? "border-red-400" : "border-gray-200"}`}
                    >
                      <CalendarIcon
                        size={16}
                        className="text-gray-400 shrink-0"
                      />
                      {formData.dischargeDate ? (
                        format(
                          parse(
                            formData.dischargeDate,
                            "yyyy-MM-dd",
                            new Date(),
                          ),
                          "dd/MM/yyyy",
                        )
                      ) : (
                        <span className="text-gray-400">Select date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        formData.dischargeDate
                          ? parse(
                              formData.dischargeDate,
                              "yyyy-MM-dd",
                              new Date(),
                            )
                          : undefined
                      }
                      onSelect={(date) =>
                        updateField(
                          "dischargeDate",
                          date ? format(date, "yyyy-MM-dd") : "",
                        )
                      }
                    />
                  </PopoverContent>
                </Popover>
                {touched && !formData.dischargeDate && (
                  <span className="text-xs text-red-500">
                    Please select a discharge date
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-700 mb-3 block">
                Delivery type
              </span>
              <div
                className={`grid grid-cols-2 gap-4 ${touched && !formData.deliveryType ? "[&>button]:border-red-400" : ""}`}
              >
                {[
                  { id: "vaginal", icon: Baby, title: "Vaginal delivery" },
                  { id: "caesarean", icon: Scissors, title: "C-section" },
                ].map((type) => (
                  <button
                    type="button"
                    key={type.id}
                    onClick={() => updateField("deliveryType", type.id as (typeof formData)["deliveryType"])}
                    className={`border rounded-xl px-5 py-4 cursor-pointer transition-colors flex flex-col items-center text-center gap-2 ${formData.deliveryType === type.id ? "border-primary bg-primary-100" : "border-gray-200 hover:border-primary/40"}`}
                  >
                    <type.icon
                      size={24}
                      className={
                        formData.deliveryType === type.id
                          ? "text-primary"
                          : "text-gray-400"
                      }
                    />
                    <span className="text-sm font-semibold text-gray-900">
                      {type.title}
                    </span>
                  </button>
                ))}
              </div>
              {touched && !formData.deliveryType && (
                <span className="text-xs text-red-500 mt-2">
                  Please select a delivery type
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-700 mb-3 block">
                Preferred calling window
              </span>
              <ChipSelect
                options={[
                  { value: "morning", label: "Morning 8am-11am" },
                  { value: "afternoon", label: "Afternoon 12pm-3pm" },
                  { value: "evening", label: "Evening 4pm-6pm" },
                  { value: "inbound", label: "She will call in" },
                ]}
                selected={
                  formData.callingWindow ? [formData.callingWindow] : []
                }
                onChange={(val) =>
                  updateField(
                    "callingWindow",
                    val.length > 0 ? (val[0] as (typeof formData)["callingWindow"]) : "",
                  )
                }
                max={1}
              />
              {formData.callingWindow === "inbound" && (
                <span className="text-xs text-primary font-medium mt-2">
                  We will share the care line number with her on the welcome SMS
                </span>
              )}
              {touched && !formData.callingWindow && (
                <span className="text-xs text-red-500 mt-1">
                  Please select a calling window
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {foundMother && currentStep === 2 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={2}
            title="Birth outcome"
            description="How did mother and baby do?"
          />
          <div className="flex flex-col gap-3">
            {[
              {
                id: "well",
                icon: CheckCircle2,
                title: "Mother and baby are well",
                description: "Both mother and newborn are stable and healthy",
              },
              {
                id: "loss",
                icon: Heart,
                title: "The baby passed away",
                description:
                  "Omaya switches to gentle bereavement support instead of routine check-in calls",
              },
            ].map((outcome) => (
              <button
                type="button"
                key={outcome.id}
                onClick={() => updateField("outcome", outcome.id as (typeof formData)["outcome"])}
                className={`text-left border rounded-xl px-5 py-4 cursor-pointer transition-colors flex items-center gap-4 ${formData.outcome === outcome.id ? "border-primary bg-primary-100" : "border-gray-200 hover:border-primary/40"} ${touched && !formData.outcome ? "border-red-400" : ""}`}
              >
                <outcome.icon
                  size={24}
                  className={`shrink-0 ${formData.outcome === outcome.id ? "text-primary" : "text-gray-400"}`}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">
                    {outcome.title}
                  </span>
                  <span className="text-xs text-gray-500 mt-0.5">
                    {outcome.description}
                  </span>
                </div>
              </button>
            ))}
            {touched && !formData.outcome && (
              <span className="text-xs text-red-500">
                Please select an outcome
              </span>
            )}
          </div>
        </div>
      )}

      {foundMother && currentStep === 3 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={3}
            title="Medications"
            description="What was she discharged with?"
          />
          <div className="flex flex-col gap-5">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-700 mb-3 block">
                Medications sent home
              </span>
              <ChipSelect
                options={[
                  { value: "pain_relief", label: "Pain relief" },
                  { value: "antibiotics", label: "Antibiotics" },
                  { value: "iron_folic", label: "Iron & folic acid" },
                  { value: "wound_care", label: "Wound care" },
                  { value: "none", label: "None sent home" },
                  { value: "not_sure", label: "Not sure" },
                ]}
                selected={formData.medications}
                onChange={(val) => updateField("medications", val)}
              />
              {touched && formData.medications.length === 0 && (
                <span className="text-xs text-red-500 mt-2">
                  Please select what she was discharged with (or "None sent home")
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {foundMother && currentStep === 4 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={4}
            title="Emergency contacts"
            description="Who should we call if we cannot reach her? Add up to 3."
          />
          <EmergencyContacts
            contacts={emergencyContacts}
            onChange={setEmergencyContacts}
            touched={touched}
          />
        </div>
      )}

      {!foundMother && currentStep === 5 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={5}
            title="Emergency contacts"
            description="Who should we call if we cannot reach her? Add up to 3."
          />
          <EmergencyContacts
            contacts={emergencyContacts}
            onChange={setEmergencyContacts}
            touched={touched}
          />
        </div>
      )}

      {foundMother && currentStep === 5 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={5}
            title="Summary"
            description="Review all details before confirming discharge."
          />
          {submitError && (
            <div className="mb-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            </div>
          )}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            {[
              { label: "Full name", value: formData.motherName },
              { label: "Phone", value: formData.phoneNumber },
              {
                label: "Delivery date",
                value: formData.deliveryDate
                  ? format(
                      parse(formData.deliveryDate, "yyyy-MM-dd", new Date()),
                      "dd/MM/yyyy",
                    )
                  : "",
              },
              {
                label: "Discharge date",
                value: formData.dischargeDate
                  ? format(
                      parse(formData.dischargeDate, "yyyy-MM-dd", new Date()),
                      "dd/MM/yyyy",
                    )
                  : "",
              },
              {
                label: "Delivery type",
                value:
                  formData.deliveryType === "vaginal"
                    ? "Vaginal delivery"
                    : "C-section",
              },
              {
                label: "Outcome",
                value:
                  formData.outcome === "well"
                    ? "Mother and baby well"
                    : "Pregnancy loss",
              },
              {
                label: "Medications",
                value:
                  formData.medications.length > 0
                    ? formData.medications.map(labelForMedication).join(", ")
                    : "None recorded",
              },
              {
                label: "Calling window",
                value: ({
                    morning: "Morning 8am–11am",
                    afternoon: "Afternoon 12pm–3pm",
                    evening: "Evening 4pm–6pm",
                    inbound: "She will call in",
                  } as Record<string, string>)[formData.callingWindow] || "",
              },
              {
                label: "First call",
                value:
                  formData.outcome === "well"
                    ? formData.callingWindow === "inbound"
                      ? "Care line number will be sent to her"
                      : firstCallDate || ""
                    : "Bereavement support flow",
                highlight: true,
              },
              ...emergencySummaryRows,
            ].map((row, idx) => (
              <div
                key={row.label}
                className={`flex justify-between items-center px-6 py-3 ${idx % 2 === 1 ? "bg-gray-50" : ""}`}
              >
                <span className="text-sm text-gray-500 font-normal">
                  {row.label}
                </span>
                <span
                  className={`text-sm font-semibold ${"highlight" in row && row.highlight ? "text-primary" : "text-gray-900"}`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── NEW PATIENT FLOW ── */}

      {!foundMother && currentStep === 1 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={1}
            title="Discharge details"
            description="Her details, dates, and how to reach her after discharge."
          />
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Input
                  label="Full name"
                  placeholder="e.g. Ama Mensah"
                  value={formData.motherName}
                  onChange={(e) => updateField("motherName", e.target.value)}
                  className={
                    touched && !formData.motherName ? "border-red-400" : ""
                  }
                  fullWidth
                />
                {touched && !formData.motherName && (
                  <span className="text-xs text-red-500">
                    Please enter her full name
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="discharge-phone"
                  className="text-sm font-medium text-gray-700"
                >
                  Phone number
                </label>
                <div
                  className={`flex items-center border rounded-md h-10 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${touched && (!formData.phoneNumber || !phoneValid) ? "border-red-400" : "border-gray-200"}`}
                >
                  <Select
                    value={countryCode}
                    onValueChange={(val) => {
                      setCountryCode(val);
                      const local = formData.phoneNumber.replace(
                        countryCode,
                        "",
                      );
                      updateField("phoneNumber", local ? `${val}${local}` : "");
                    }}
                  >
                    <SelectTrigger className="h-auto w-fit border-0 bg-transparent px-2 py-2 text-sm font-medium text-gray-700 shadow-none focus:ring-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-gray-400 [&>span]:line-clamp-none whitespace-nowrap shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="min-w-[100px]">
                      <SelectItem value="+233">🇬🇭 +233</SelectItem>
                      <SelectItem value="+234">🇳🇬 +234</SelectItem>
                      <SelectItem value="+225">🇨🇮 +225</SelectItem>
                      <SelectItem value="+228">🇹🇬 +228</SelectItem>
                      <SelectItem value="+221">🇸🇳 +221</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="h-6 w-px bg-gray-200" />
                  <Input
                    id="discharge-phone"
                    type="tel"
                    placeholder="55 123 4567"
                    value={groupPhoneDigits(formData.phoneNumber.replace(countryCode, ""))}
                    onChange={(e) => {
                      const raw = e.target.value
                        .replace(/\D/g, "")
                        .replace(/^0+/, "")
                        .slice(0, 9);
                      updateField(
                        "phoneNumber",
                        raw ? `${countryCode}${raw}` : "",
                      );
                    }}
                    className="flex-1 border-0 bg-transparent px-2 py-2 text-gray-900 focus-visible:ring-0 shadow-none h-auto"
                  />
                </div>
                {touched && !formData.phoneNumber && (
                  <span className="text-xs text-red-500">
                    Please enter a phone number
                  </span>
                )}
                {touched && formData.phoneNumber && !phoneValid && (
                  <span className="text-xs text-red-500">
                    Please enter a valid phone number
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-gray-700">
                Date of birth
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`justify-start gap-2 bg-white border rounded-md px-3 py-2 text-sm text-gray-900 font-normal w-full h-10 hover:bg-gray-50 ${touched && !formData.dateOfBirth ? "border-red-400" : "border-gray-200"}`}
                  >
                    <CalendarIcon
                      size={16}
                      className="text-gray-400 shrink-0"
                    />
                    {formData.dateOfBirth ? (
                      format(
                        parse(formData.dateOfBirth, "yyyy-MM-dd", new Date()),
                        "dd/MM/yyyy",
                      )
                    ) : (
                      <span className="text-gray-400">Select date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    captionLayout="dropdown"
                    startMonth={new Date(1940, 0, 1)}
                    endMonth={new Date()}
                    selected={
                      formData.dateOfBirth
                        ? parse(formData.dateOfBirth, "yyyy-MM-dd", new Date())
                        : undefined
                    }
                    onSelect={(date) =>
                      updateField(
                        "dateOfBirth",
                        date ? format(date, "yyyy-MM-dd") : "",
                      )
                    }
                  />
                </PopoverContent>
              </Popover>
              {touched && !formData.dateOfBirth && (
                <span className="text-xs text-red-500">
                  Please select her date of birth
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Input
                  label="Gravida"
                  type="number"
                  min="0"
                  placeholder="Number of pregnancies"
                  value={formData.gravida}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || parseInt(val) >= 0)
                      updateField("gravida", val);
                  }}
                  className={
                    touched && formData.gravida === "" ? "border-red-400" : ""
                  }
                  fullWidth
                />
                {touched && formData.gravida === "" && (
                  <span className="text-xs text-red-500">
                    Please enter number of pregnancies
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Input
                  label="Para"
                  type="number"
                  min="0"
                  placeholder="Number of births"
                  value={formData.para}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || parseInt(val) >= 0)
                      updateField("para", val);
                  }}
                  className={
                    (touched && formData.para === "") || paraExceedsGravida
                      ? "border-red-400"
                      : ""
                  }
                  fullWidth
                />
                {touched && formData.para === "" ? (
                  <span className="text-xs text-red-500">
                    Please enter number of births
                  </span>
                ) : paraExceedsGravida ? (
                  <span className="text-xs text-red-500">
                    Births (para) can't exceed pregnancies (gravida)
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-gray-700">
                  Delivery date
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`justify-start gap-2 bg-white border rounded-md px-3 py-2 text-sm text-gray-900 font-normal w-full h-10 hover:bg-gray-50 ${touched && !formData.deliveryDate ? "border-red-400" : "border-gray-200"}`}
                    >
                      <CalendarIcon
                        size={16}
                        className="text-gray-400 shrink-0"
                      />
                      {formData.deliveryDate ? (
                        format(
                          parse(
                            formData.deliveryDate,
                            "yyyy-MM-dd",
                            new Date(),
                          ),
                          "dd/MM/yyyy",
                        )
                      ) : (
                        <span className="text-gray-400">Select date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        formData.deliveryDate
                          ? parse(
                              formData.deliveryDate,
                              "yyyy-MM-dd",
                              new Date(),
                            )
                          : undefined
                      }
                      onSelect={(date) =>
                        updateField(
                          "deliveryDate",
                          date ? format(date, "yyyy-MM-dd") : "",
                        )
                      }
                    />
                  </PopoverContent>
                </Popover>
                {touched && !formData.deliveryDate && (
                  <span className="text-xs text-red-500">
                    Please select a delivery date
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-gray-700">
                  Discharge date
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`justify-start gap-2 bg-white border rounded-md px-3 py-2 text-sm text-gray-900 font-normal w-full h-10 hover:bg-gray-50 ${touched && !formData.dischargeDate ? "border-red-400" : "border-gray-200"}`}
                    >
                      <CalendarIcon
                        size={16}
                        className="text-gray-400 shrink-0"
                      />
                      {formData.dischargeDate ? (
                        format(
                          parse(
                            formData.dischargeDate,
                            "yyyy-MM-dd",
                            new Date(),
                          ),
                          "dd/MM/yyyy",
                        )
                      ) : (
                        <span className="text-gray-400">Select date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        formData.dischargeDate
                          ? parse(
                              formData.dischargeDate,
                              "yyyy-MM-dd",
                              new Date(),
                            )
                          : undefined
                      }
                      onSelect={(date) =>
                        updateField(
                          "dischargeDate",
                          date ? format(date, "yyyy-MM-dd") : "",
                        )
                      }
                    />
                  </PopoverContent>
                </Popover>
                {touched && !formData.dischargeDate && (
                  <span className="text-xs text-red-500">
                    Please select a discharge date
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-700 mb-3 block">
                Preferred language for calls
              </span>
              <ChipSelect
                max={1}
                options={LANGUAGE_OPTIONS}
                selected={formData.language ? [formData.language] : []}
                onChange={(val) =>
                  updateField("language", val.length > 0 ? val[0] : "")
                }
              />
              {touched && !formData.language && (
                <span className="text-xs text-red-500 mt-1">
                  Please select a preferred language
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-700 mb-3 block">
                Preferred calling window
              </span>
              <ChipSelect
                max={1}
                options={[
                  { value: "morning", label: "Morning 8am-11am" },
                  { value: "afternoon", label: "Afternoon 12pm-3pm" },
                  { value: "evening", label: "Evening 4pm-6pm" },
                  { value: "inbound", label: "She will call in" },
                ]}
                selected={
                  formData.callingWindow ? [formData.callingWindow] : []
                }
                onChange={(val) =>
                  updateField(
                    "callingWindow",
                    val.length > 0 ? (val[0] as (typeof formData)["callingWindow"]) : "",
                  )
                }
              />
              {formData.callingWindow === "inbound" && (
                <span className="text-xs text-primary font-medium mt-2">
                  We will share the care line number with her on the welcome SMS
                </span>
              )}
              {touched && !formData.callingWindow && (
                <span className="text-xs text-red-500 mt-1">
                  Please select a calling window
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-700 mb-3 block">
                Delivery type
              </span>
              <div
                className={`grid grid-cols-2 gap-4 ${touched && !formData.deliveryType ? "[&>button]:border-red-400" : ""}`}
              >
                {[
                  { id: "vaginal", icon: Baby, title: "Vaginal delivery" },
                  { id: "caesarean", icon: Scissors, title: "C-section" },
                ].map((type) => (
                  <button
                    type="button"
                    key={type.id}
                    onClick={() => updateField("deliveryType", type.id as (typeof formData)["deliveryType"])}
                    className={`border rounded-xl px-5 py-4 cursor-pointer transition-colors flex flex-col items-center text-center gap-2 ${formData.deliveryType === type.id ? "border-primary bg-primary-100" : "border-gray-200 hover:border-primary/40"}`}
                  >
                    <type.icon
                      size={24}
                      className={
                        formData.deliveryType === type.id
                          ? "text-primary"
                          : "text-gray-400"
                      }
                    />
                    <span className="text-sm font-semibold text-gray-900">
                      {type.title}
                    </span>
                  </button>
                ))}
              </div>
              {touched && !formData.deliveryType && (
                <span className="text-xs text-red-500 mt-2">
                  Please select a delivery type
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {!foundMother && currentStep === 2 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={2}
            title="Birth outcome"
            description="How did mother and baby do?"
          />
          <div className="flex flex-col gap-3">
            {[
              {
                id: "well",
                icon: CheckCircle2,
                title: "Mother and baby are well",
                description: "Both mother and newborn are stable and healthy",
              },
              {
                id: "loss",
                icon: Heart,
                title: "The baby passed away",
                description:
                  "Omaya switches to gentle bereavement support instead of routine check-in calls",
              },
            ].map((outcome) => (
              <button
                type="button"
                key={outcome.id}
                onClick={() => updateField("outcome", outcome.id as (typeof formData)["outcome"])}
                className={`text-left border rounded-xl px-5 py-4 cursor-pointer transition-colors flex items-center gap-4 ${formData.outcome === outcome.id ? "border-primary bg-primary-100" : "border-gray-200 hover:border-primary/40"} ${touched && !formData.outcome ? "border-red-400" : ""}`}
              >
                <outcome.icon
                  size={24}
                  className={`shrink-0 ${formData.outcome === outcome.id ? "text-primary" : "text-gray-400"}`}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">
                    {outcome.title}
                  </span>
                  <span className="text-xs text-gray-500 mt-0.5">
                    {outcome.description}
                  </span>
                </div>
              </button>
            ))}
            {touched && !formData.outcome && (
              <span className="text-xs text-red-500">
                Please select an outcome
              </span>
            )}
          </div>
        </div>
      )}

      {!foundMother && currentStep === 3 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={3}
            title="Clinical background"
            description="Tap any that apply — this helps Omaya escalate sooner."
          />
          <div className="flex flex-col gap-6 mt-2">
            {/* Pre-existing — present before this pregnancy */}
            <div className="flex flex-col">
              <h4 className="text-xs font-semibold text-gray-400 tracking-wide uppercase mb-3">
                Before this pregnancy
              </h4>
              <ChipSelect
                options={PRE_EXISTING_RISKS}
                selected={formData.risks.filter((r) =>
                  PRE_EXISTING_VALUES.includes(r),
                )}
                onChange={(val) =>
                  updateField("risks", [
                    ...formData.risks.filter(
                      (r) => !PRE_EXISTING_VALUES.includes(r),
                    ),
                    ...val,
                  ])
                }
              />
            </div>

            {/* Pregnancy-related — arose during/because of this pregnancy */}
            <div className="flex flex-col">
              <h4 className="text-xs font-semibold text-gray-400 tracking-wide uppercase mb-3">
                From this pregnancy
              </h4>
              <ChipSelect
                options={PREGNANCY_RISKS}
                selected={formData.risks.filter((r) =>
                  PREGNANCY_VALUES.includes(r),
                )}
                onChange={(val) =>
                  updateField("risks", [
                    ...formData.risks.filter(
                      (r) => !PREGNANCY_VALUES.includes(r),
                    ),
                    ...val,
                  ])
                }
              />
            </div>

            {/* Other — free-text risk, sent separately as `risks_other` */}
            <div className="flex flex-col">
              <h4 className="text-xs font-semibold text-gray-400 tracking-wide uppercase mb-3">
                Something else
              </h4>
              <ChipSelect
                options={[{ value: "other", label: "Other" }]}
                selected={riskOtherOn ? ["other"] : []}
                onChange={(val) => {
                  const on = val.includes("other");
                  setRiskOtherOn(on);
                  if (!on) updateField("risksOther", "");
                }}
              />
              {riskOtherOn && (
                <div className="flex flex-col gap-1.5 mt-3">
                  <Input
                    placeholder="Describe the risk factor"
                    value={formData.risksOther}
                    maxLength={80}
                    onChange={(e) => updateField("risksOther", e.target.value)}
                    className={
                      touched && formData.risksOther.trim() === ""
                        ? "border-red-400"
                        : ""
                    }
                    fullWidth
                  />
                  {touched && formData.risksOther.trim() === "" && (
                    <span className="text-xs text-red-500">
                      Describe the risk factor, or unselect "Other"
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!foundMother && currentStep === 4 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={4}
            title="Her consent"
            description="Read this to her out loud, or show her the screen. Both options below must be addressed before you can enroll her."
          />
          {touched && !formData.consentCalls && (
            <div className="mb-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Consent required</AlertTitle>
                <AlertDescription>
                  You must obtain consent to check-in calls before enrolling
                </AlertDescription>
              </Alert>
            </div>
          )}
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => {
                const next = !formData.consentCalls;
                // Recording consent can't stand without calls consent — clear
                // it whenever calls is switched off.
                setFormData((prev) => ({
                  ...prev,
                  consentCalls: next,
                  consentRecording: next ? prev.consentRecording : false,
                }));
              }}
              className={`w-full text-left border rounded-xl px-5 py-4 flex items-start gap-4 cursor-pointer transition-colors ${formData.consentCalls ? "border-primary bg-primary-100" : "border-gray-200 bg-white"} ${touched && !formData.consentCalls ? "border-red-400" : ""}`}
            >
              <div
                className={`w-5 h-5 rounded flex-shrink-0 border mt-0.5 flex items-center justify-center ${formData.consentCalls ? "bg-primary border-primary" : "bg-white border-gray-300"}`}
              >
                {formData.consentCalls && (
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-900">
                  Check-in calls
                </span>
                <span className="block text-sm text-gray-500 font-normal mt-1 leading-relaxed">
                  Omaya will call her to check how she and her baby are doing
                  after she goes home. She can ask to stop at any time.
                </span>
                <span className="text-xs text-primary font-semibold mt-2 uppercase tracking-wide">
                  Required to enroll
                </span>
              </div>
            </button>

            <button
              type="button"
              disabled={!formData.consentCalls}
              onClick={() => {
                if (!formData.consentCalls) return;
                updateField("consentRecording", !formData.consentRecording);
              }}
              aria-disabled={!formData.consentCalls || undefined}
              className={`w-full text-left border rounded-xl px-5 py-4 flex items-start gap-4 transition-[color,background-color,border-color,opacity] ${
                !formData.consentCalls
                  ? "border-gray-200 bg-gray-50 opacity-60"
                  : formData.consentRecording
                    ? "border-primary bg-primary-100 cursor-pointer"
                    : "border-gray-200 bg-white cursor-pointer"
              }`}
            >
              <div
                className={`w-5 h-5 rounded flex-shrink-0 border mt-0.5 flex items-center justify-center ${formData.consentRecording ? "bg-primary border-primary" : "bg-white border-gray-300"}`}
              >
                {formData.consentRecording && (
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-900">
                  Call recording
                </span>
                <span className="block text-sm text-gray-500 font-normal mt-1 leading-relaxed">
                  Calls may be recorded to improve care quality. Recordings are
                  stored securely and only used by her care team.
                </span>
                <span className="text-xs text-gray-400 font-semibold mt-2 uppercase tracking-wide">
                  {formData.consentCalls ? "Optional" : "Consent to calls first"}
                </span>
              </div>
            </button>
          </div>
          <p className="text-xs text-gray-400 font-normal mt-6">
            By tapping 'Confirm discharge', you confirm that you have explained
            this program to the mother and she has agreed to participate.
          </p>
        </div>
      )}

      {!foundMother && currentStep === 6 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={6}
            title="Summary"
            description="Review all details before confirming discharge."
          />
          {submitError && (
            <div className="mb-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            </div>
          )}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            {[
              { label: "Full name", value: formData.motherName },
              { label: "Phone", value: formData.phoneNumber },
              {
                label: "Date of birth",
                value: formData.dateOfBirth
                  ? format(
                      parse(formData.dateOfBirth, "yyyy-MM-dd", new Date()),
                      "dd/MM/yyyy",
                    )
                  : "",
              },
              {
                label: "Gravida / Para",
                value: `G${formData.gravida} P${formData.para}`,
              },
              {
                label: "Delivery date",
                value: formData.deliveryDate
                  ? format(
                      parse(formData.deliveryDate, "yyyy-MM-dd", new Date()),
                      "dd/MM/yyyy",
                    )
                  : "",
              },
              {
                label: "Discharge date",
                value: formData.dischargeDate
                  ? format(
                      parse(formData.dischargeDate, "yyyy-MM-dd", new Date()),
                      "dd/MM/yyyy",
                    )
                  : "",
              },
              {
                label: "Delivery type",
                value:
                  formData.deliveryType === "vaginal"
                    ? "Vaginal delivery"
                    : "C-section",
              },
              {
                label: "Outcome",
                value:
                  formData.outcome === "well"
                    ? "Mother and baby well"
                    : "Pregnancy loss",
              },
              {
                label: "Language",
                value:
                  { english: "English", twi: "Twi", ga: "Ga" }[
                    formData.language
                  ] || formData.language,
              },
              {
                label: "Clinical risks",
                value:
                  formData.risks.length > 0 || formData.risksOther.trim()
                    ? [
                        ...formData.risks.map((r) => r.replace(/_/g, " ")),
                        ...(formData.risksOther.trim()
                          ? [formData.risksOther.trim()]
                          : []),
                      ].join(", ")
                    : "None recorded",
              },
              {
                label: "Consent",
                value: formData.consentCalls
                  ? "Consented to calls"
                  : "No consent",
                highlight: formData.consentCalls,
              },
              {
                label: "First call",
                value:
                  formData.outcome === "well"
                    ? formData.callingWindow === "inbound"
                      ? "Care line number will be sent to her"
                      : firstCallDate || ""
                    : "Bereavement support flow",
                highlight: true,
              },
              ...emergencySummaryRows,
            ].map((row, idx) => (
              <div
                key={row.label}
                className={`flex justify-between items-center px-6 py-3 ${idx % 2 === 1 ? "bg-gray-50" : ""}`}
              >
                <span className="text-sm text-gray-500 font-normal">
                  {row.label}
                </span>
                <span
                  className={`text-sm font-semibold ${"highlight" in row && row.highlight ? "text-primary" : "text-gray-900"}`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </OnboardingShell>
    {discardDialog}
    </>
  );
};

export default NewDischarge;
