import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Phone,
  ShieldCheck,
  Clock,
  Info,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CalendarIcon,
} from "lucide-react";
import { format, parse } from "date-fns";
import { OnboardingShell } from "../components/onboarding/OnboardingShell";
import { StepHeader } from "../components/onboarding/StepHeader";
import { ChipSelect } from "../components/onboarding/ChipSelect";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Card, CardContent } from "../components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "../components/ui/alert";
import { Calendar } from "../components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { api, extractApiError } from "../lib/api";
import { groupPhoneDigits } from "../lib/format";
import { LANGUAGE_OPTIONS } from "../lib/languages";
import { useDrawer } from "../contexts/DrawerContext";
import { toast } from "sonner";

interface AddMotherProps {
  onClose?: () => void;
}

const stepLabels = [
  "Antenatal enrollment",
  "Her details",
  "Clinical background",
  "Consent",
  "Summary",
];

const step2Required = [
  { key: "fullName", label: "full name" },
  { key: "phone", label: "phone number" },
  { key: "dob", label: "date of birth" },
  { key: "edd", label: "expected delivery date" },
  { key: "gravida", label: "gravida" },
  { key: "para", label: "para" },
  { key: "language", label: "preferred language" },
] as const;

const fieldIsEmpty = (val: string | unknown[]) =>
  typeof val === "string" ? val.trim() === "" : val.length === 0;

const getLanguageLabel = (val: string) => {
  const labels: Record<string, string> = {
    english: "English",
    twi: "Twi",
    ewe: "Ewe",
  };
  return labels[val] || val;
};

const getRiskLabel = (val: string) => {
  const labels: Record<string, string> = {
    prior_csection: "Previous C-section",
    hypertension: "High blood pressure or pre-eclampsia",
    diabetes: "Diabetes",
    multiple: "Twins or more",
    sickle_cell: "Sickle cell disease",
    prior_loss: "Previous pregnancy loss",
    hiv_pmtct: "On HIV care (PMTCT)",
  };
  return labels[val] || val;
};

const AddMother = ({ onClose }: AddMotherProps = {}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openDrawer } = useDrawer();
  const handleClose = onClose ?? (() => navigate("/mothers"));
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [touched, setTouched] = useState(false);
  const [countryCode, setCountryCode] = useState("+233");

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    dob: "",
    edd: "",
    gravida: "",
    para: "",
    language: [] as string[],
    risks: [] as string[],
    consentCalls: false,
    consentRecording: false,
    whatsappOptIn: false,
  });

  const totalSteps = 5;

  // Para (births) can never exceed gravida (pregnancies) — they're tied.
  const paraExceedsGravida =
    formData.gravida !== "" &&
    formData.para !== "" &&
    Number(formData.para) > Number(formData.gravida);

  const step2Valid =
    step2Required.every(
      (f) => !fieldIsEmpty(formData[f.key as keyof typeof formData] as string | unknown[]),
    ) && !paraExceedsGravida;

  const phoneLocal = formData.phone.replace(countryCode, "");
  const phoneDigits = phoneLocal.replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 9;

  const handleNext = async () => {
    if (currentStep === 2) {
      setTouched(true);
      if (!step2Valid || !phoneValid) return;
    }
    if (currentStep === 4 && !formData.consentCalls) {
      setTouched(true);
      return;
    }

    // Advance to next step if not at the final summary step
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
      setTouched(false);
      return;
    }

    // At step 5, submit the form
    setSubmitting(true);
    setSubmitError("");
    try {
      await api.post("/mothers", {
        full_name: formData.fullName,
        phone: formData.phone,
        date_of_birth: formData.dob,
        edd: formData.edd,
        language: formData.language[0] || "",
        gravida: Number(formData.gravida) || 0,
        para: Number(formData.para) || 0,
        risks: formData.risks,
        consent_calls: formData.consentCalls,
        consent_recording: formData.consentRecording,
        whatsapp_opt_in: formData.whatsappOptIn,
      });
      queryClient.invalidateQueries({ queryKey: ["mothers"] });
      toast.success("Mother enrolled successfully.");
      handleClose();
    } catch (err: unknown) {
      const { message } = extractApiError(
        err,
        "Enrollment failed. Please check the form and try again.",
      );
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      setTouched(false);
    }
  };

  const updateField = <K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touched) {
      const fields = [
        ...step2Required.map((f) => f.key),
        "consentCalls" as const,
      ];
      if (fields.includes(field as never)) {
        setTouched(field !== "consentCalls" || value === true);
      }
    }
  };

  const showError = (key: string) => {
    if (!touched) return false;
    if (key === "phone") return fieldIsEmpty(formData.phone) || !phoneValid;
    const field = step2Required.find((f) => f.key === key);
    if (!field) return false;
    return fieldIsEmpty(formData[key as keyof typeof formData] as string | unknown[]);
  };

  return (
    <OnboardingShell
      onClose={handleClose}
      currentStep={currentStep}
      totalSteps={totalSteps}
      stepLabel={stepLabels[currentStep - 1]}
      leftAction={
        <Button
          variant="ghost"
          onClick={
            currentStep === 1 ? () => openDrawer("discharge") : handleBack
          }
          className="gap-2"
        >
          <ArrowLeft size={18} />
          <span>Back</span>
        </Button>
      }
      rightAction={
        <Button
          variant="default"
          onClick={handleNext}
          className="gap-2"
          disabled={submitting}
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          <span>
            {currentStep === 1
              ? "Start enrollment"
              : currentStep === 5
                ? "Enroll her"
                : "Continue"}
          </span>
          {!submitting && <ArrowRight size={18} />}
        </Button>
      }
    >
      {currentStep === 1 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={1}
            title="Before we start"
            description="This takes about 3 minutes. You're enrolling her in Omaya's follow-up care program. She'll receive check-in calls after delivery to make sure she and her baby are doing well."
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
          <div className="flex flex-col gap-3">
            {[
              {
                icon: Phone,
                title: "She'll receive calls, not messages",
                body: "Omaya calls her directly. No app needed. Works on any phone.",
              },
              {
                icon: ShieldCheck,
                title: "Her data is private",
                body: "Only her care team can see her record. She controls her consent.",
              },
              {
                icon: Clock,
                title: "You can stop anytime",
                body: "If she changes her mind, you can withdraw her from the program in one click.",
              },
            ].map((card) => (
              <Card key={card.title} className="border-gray-100 shadow-none">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                    <card.icon
                      size={20}
                      className="text-primary mt-0.5 shrink-0"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900">
                      {card.title}
                    </span>
                    <span className="text-sm text-gray-500 font-normal mt-0.5">
                      {card.body}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={2}
            title="Her details"
            description="Pre-fill from her ANC record where possible. Double-check the phone number. This is how Omaya reaches her."
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
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Input
                  label="Full name"
                  placeholder="e.g. Ama Mensah"
                  value={formData.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  className={showError("fullName") ? "border-red-400" : ""}
                  fullWidth
                />
                {showError("fullName") && (
                  <span className="text-xs text-red-500">
                    Please enter her full name
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="mother-phone"
                  className="text-sm font-medium text-gray-700"
                >
                  Phone number
                </label>
                <div
                  className={`flex items-center border rounded-md h-10 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${showError("phone") ? "border-red-400" : "border-gray-200"}`}
                >
                  <Select
                    value={countryCode}
                    onValueChange={(val) => {
                      setCountryCode(val);
                      const local = formData.phone.replace(countryCode, "");
                      updateField("phone", local ? `${val}${local}` : "");
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
                    id="mother-phone"
                    type="tel"
                    placeholder="55 123 4567"
                    value={groupPhoneDigits(formData.phone.replace(countryCode, ""))}
                    onChange={(e) => {
                      const raw = e.target.value
                        .replace(/\D/g, "")
                        .replace(/^0+/, "")
                        .slice(0, 9);
                      updateField("phone", raw ? `${countryCode}${raw}` : "");
                    }}
                    className="flex-1 border-0 bg-transparent px-2 py-2 text-gray-900 focus-visible:ring-0 shadow-none h-auto"
                  />
                </div>
                {showError("phone") && !formData.phone && (
                  <span className="text-xs text-red-500">
                    Please enter a phone number
                  </span>
                )}
                {showError("phone") && formData.phone && !phoneValid && (
                  <span className="text-xs text-red-500">
                    Please enter a valid phone number
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="mother-dob"
                  className="text-sm font-medium text-gray-700"
                >
                  Date of birth
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="mother-dob"
                      variant="ghost"
                      className={`justify-start gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 font-normal w-full h-10 hover:bg-gray-50 ${showError("dob") ? "border-red-400" : ""}`}
                    >
                      <CalendarIcon
                        size={16}
                        className="text-gray-400 shrink-0"
                      />
                      {formData.dob ? (
                        format(
                          parse(formData.dob, "yyyy-MM-dd", new Date()),
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
                        formData.dob
                          ? parse(formData.dob, "yyyy-MM-dd", new Date())
                          : undefined
                      }
                      onSelect={(date) =>
                        updateField(
                          "dob",
                          date ? format(date, "yyyy-MM-dd") : "",
                        )
                      }
                    />
                  </PopoverContent>
                </Popover>
                {showError("dob") && (
                  <span className="text-xs text-red-500">
                    Please select her date of birth
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="mother-edd"
                  className="text-sm font-medium text-gray-700"
                >
                  Expected delivery date
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="mother-edd"
                      variant="ghost"
                      className={`justify-start gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 font-normal w-full h-10 hover:bg-gray-50 ${showError("edd") ? "border-red-400" : ""}`}
                    >
                      <CalendarIcon
                        size={16}
                        className="text-gray-400 shrink-0"
                      />
                      {formData.edd ? (
                        format(
                          parse(formData.edd, "yyyy-MM-dd", new Date()),
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
                        formData.edd
                          ? parse(formData.edd, "yyyy-MM-dd", new Date())
                          : undefined
                      }
                      onSelect={(date) =>
                        updateField(
                          "edd",
                          date ? format(date, "yyyy-MM-dd") : "",
                        )
                      }
                    />
                  </PopoverContent>
                </Popover>
                {showError("edd") && (
                  <span className="text-xs text-red-500">
                    Please select the expected delivery date
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Input
                  label="Gravida"
                  type="number"
                  min="0"
                  max="30"
                  placeholder="Number of pregnancies"
                  value={formData.gravida}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || (parseInt(val) >= 0 && parseInt(val) <= 30)) {
                      updateField("gravida", val);
                    }
                  }}
                  className={showError("gravida") ? "border-red-400" : ""}
                  fullWidth
                />
                {showError("gravida") && (
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
                  max="30"
                  placeholder="Number of births"
                  value={formData.para}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || (parseInt(val) >= 0 && parseInt(val) <= 30)) {
                      updateField("para", val);
                    }
                  }}
                  className={
                    showError("para") || paraExceedsGravida ? "border-red-400" : ""
                  }
                  fullWidth
                />
                {showError("para") ? (
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

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="mother-language"
                className="text-sm font-medium text-gray-700"
              >
                Preferred language for calls
              </label>
              <ChipSelect
                id="mother-language"
                max={1}
                options={LANGUAGE_OPTIONS}
                selected={formData.language}
                onChange={(val) => updateField("language", val)}
              />
              {showError("language") && (
                <span className="text-xs text-red-500">
                  Please select a preferred language
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={3}
            title="Clinical background"
            description="Select anything that applies. This helps Omaya ask the right questions and know when to escalate faster. Leave blank if nothing applies."
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
          <h4 className="text-xs font-semibold text-gray-400 tracking-wide uppercase mb-4">
            SELECT ALL THAT APPLY
          </h4>
          <ChipSelect
            options={[
              { value: "prior_csection", label: "Previous C-section" },
              {
                value: "hypertension",
                label: "High blood pressure or pre-eclampsia",
              },
              {
                value: "diabetes",
                label: "Diabetes (including during pregnancy)",
              },
              { value: "multiple", label: "Twins or more" },
              { value: "sickle_cell", label: "Sickle cell disease" },
              { value: "prior_loss", label: "Previous pregnancy loss" },
              { value: "hiv_pmtct", label: "On HIV care (PMTCT)" },
            ]}
            selected={formData.risks}
            onChange={(val) => updateField("risks", val)}
          />
          <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-start gap-3 mt-6">
            <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-500 font-normal leading-relaxed">
              These flags are stored securely and only visible to her assigned
              midwife and hospital admin. They are never shared or used for
              anything outside her care.
            </p>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={4}
            title="Her consent"
            description="Read this to her out loud, or show her the screen. Both options below must be addressed before you can enroll her."
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
          <div className="flex flex-col gap-4">
            <button
              type="button"
              aria-pressed={formData.consentCalls}
              onClick={() =>
                updateField("consentCalls", !formData.consentCalls)
              }
              className={`
                w-full text-left border rounded-xl px-5 py-4 flex items-start gap-4 cursor-pointer transition-colors
                ${formData.consentCalls ? "border-primary bg-primary-100" : "border-gray-200 bg-white"}
                ${touched && !formData.consentCalls ? "border-red-400" : ""}
              `}
            >
              <div
                className={`
                w-5 h-5 rounded flex-shrink-0 border mt-0.5 flex items-center justify-center
                ${formData.consentCalls ? "bg-primary border-primary" : "bg-white border-gray-300"}
              `}
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
                  REQUIRED TO ENROLL
                </span>
              </div>
            </button>
            {touched && !formData.consentCalls && (
              <span className="text-xs text-red-500 -mt-3">
                You must obtain consent to check-in calls before enrolling
              </span>
            )}

            <button
              type="button"
              aria-pressed={formData.consentRecording}
              onClick={() =>
                updateField("consentRecording", !formData.consentRecording)
              }
              className={`
                w-full text-left border rounded-xl px-5 py-4 flex items-start gap-4 cursor-pointer transition-colors
                ${formData.consentRecording ? "border-primary bg-primary-100" : "border-gray-200 bg-white"}
              `}
            >
              <div
                className={`
                w-5 h-5 rounded flex-shrink-0 border mt-0.5 flex items-center justify-center
                ${formData.consentRecording ? "bg-primary border-primary" : "bg-white border-gray-300"}
              `}
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
                  OPTIONAL
                </span>
              </div>
            </button>

            <button
              type="button"
              aria-pressed={formData.whatsappOptIn}
              onClick={() =>
                updateField("whatsappOptIn", !formData.whatsappOptIn)
              }
              className={`
                w-full text-left border rounded-xl px-5 py-4 flex items-start gap-4 cursor-pointer transition-colors
                ${formData.whatsappOptIn ? "border-primary bg-primary-100" : "border-gray-200 bg-white"}
              `}
            >
              <div
                className={`
                w-5 h-5 rounded flex-shrink-0 border mt-0.5 flex items-center justify-center
                ${formData.whatsappOptIn ? "bg-primary border-primary" : "bg-white border-gray-300"}
              `}
              >
                {formData.whatsappOptIn && (
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-900">
                  WhatsApp messages
                </span>
                <span className="block text-sm text-gray-500 font-normal mt-1 leading-relaxed">
                  She can message Omaya on WhatsApp with questions or concerns
                  between check-in calls. She can opt out at any time.
                </span>
                <span className="text-xs text-gray-400 font-semibold mt-2 uppercase tracking-wide">
                  OPTIONAL
                </span>
              </div>
            </button>
          </div>
          <p className="text-xs text-gray-400 font-normal mt-6">
            By tapping 'Enroll her', you confirm that you have explained this
            program to the mother and she has agreed to participate.
          </p>
        </div>
      )}

      {currentStep === 5 && (
        <div className="flex flex-col mt-6">
          <StepHeader
            step={5}
            title="Review details"
            description="Double check her information before enrolling her in the program."
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
              { label: "Full name", value: formData.fullName },
              { label: "Phone number", value: formData.phone },
              {
                label: "Date of birth",
                value: formData.dob
                  ? format(
                      parse(formData.dob, "yyyy-MM-dd", new Date()),
                      "dd/MM/yyyy",
                    )
                  : "",
              },
              {
                label: "Expected delivery",
                value: formData.edd
                  ? format(
                      parse(formData.edd, "yyyy-MM-dd", new Date()),
                      "dd/MM/yyyy",
                    )
                  : "",
              },
              {
                label: "Gravida / Para",
                value: `G${formData.gravida} P${formData.para}`,
              },
              {
                label: "Language",
                value: getLanguageLabel(formData.language[0] || ""),
              },
              {
                label: "Clinical risks",
                value:
                  formData.risks.length > 0
                    ? formData.risks.map(getRiskLabel).join(", ")
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
                label: "Call recording",
                value: formData.consentRecording ? "Consented" : "No consent",
              },
              {
                label: "WhatsApp messages",
                value: formData.whatsappOptIn ? "Consented" : "No consent",
              },
            ].map((row, idx) => (
              <div
                key={row.label}
                className={`flex justify-between items-center px-6 py-3 ${idx % 2 === 1 ? "bg-gray-50" : ""}`}
              >
                <span className="text-sm text-gray-500 font-normal">
                  {row.label}
                </span>
                <span
                  className={`text-sm font-semibold ${row.highlight ? "text-primary" : "text-gray-900"}`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 font-normal mt-6">
            By tapping 'Enroll her', you confirm that you have explained this
            program to the mother and she has agreed to participate.
          </p>
        </div>
      )}
    </OnboardingShell>
  );
};

export default AddMother;
