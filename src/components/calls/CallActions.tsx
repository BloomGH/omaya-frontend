import { PhoneCall, Loader2, UserRound, ChevronDown, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { useCallNow } from "../../hooks/useCallNow";
import { useMother } from "../../hooks/useMothers";

interface CallActionsProps {
  motherId: string;
}

/**
 * Pinned footer of the call detail card: jump to the mother's record, or
 * trigger a fresh call on either transport.
 *
 * WhatsApp availability and consent are properties of the mother RIGHT NOW,
 * not of the past call being viewed — so they're read off her record rather
 * than denormalised onto the call payload. `useMother` is `enabled: !!id`, and
 * its ["mother", id] key is invalidated by useTriggerCall, so this refreshes
 * after a trigger.
 */
const CallActions = ({ motherId }: CallActionsProps) => {
  const navigate = useNavigate();
  const motherQuery = useMother(motherId);
  const { callNow, isPending } = useCallNow(motherId);

  const mother = motherQuery.data;
  const isWithdrawn = mother?.consentStatus === "withdrawn";
  const whatsappAvailable = mother?.whatsappCall?.available ?? false;
  // Disabled while the fetch is in flight too: labelling it "not available"
  // before we know would be a false statement, not a conservative one.
  const whatsappPending = motherQuery.isLoading;
  // FAIL CLOSED: while consent state is unknown (loading) or unknowable
  // (errored), the trigger stays disabled — an enabled "Call now" for a
  // withdrawn mother relies on the backend refusing, which is a backstop,
  // not a UI contract. Error gets its own rendering below, never the
  // fabricated "no permission".
  const consentUnknown = motherQuery.isLoading || motherQuery.isError;

  const handleViewMother = () => {
    navigate("/mothers", { state: { motherId } });
  };

  return (
    <div className="shrink-0 pt-4 border-t border-gray-100 flex justify-end items-center gap-2 bg-white">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-1.5" onClick={handleViewMother}>
            <UserRound size={15} />
            <span className="font-medium">Mother record</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top"><p>Go to this mother's profile.</p></TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="flex items-center gap-1.5"
                  disabled={isWithdrawn || consentUnknown || isPending}
                >
                  {isPending ? <Loader2 size={15} className="animate-spin" /> : <PhoneCall size={15} />}
                  <span className="font-medium">Call now</span>
                  <ChevronDown size={13} className="opacity-70" />
                </Button>
              </DropdownMenuTrigger>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>
              {isWithdrawn
                ? "Cannot call. Consent withdrawn."
                : motherQuery.isError
                  ? "Couldn't verify consent — reload to retry."
                  : motherQuery.isLoading
                    ? "Checking consent…"
                    : "Trigger an immediate check-in call for this mother."}
            </p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => callNow("phone")}>
            <PhoneCall size={14} className="mr-2" />
            Phone call
          </DropdownMenuItem>
          {/* Mirrors MotherDetail: offering an action the backend answers
              with `whatsapp_unavailable` is a predictably failing click. */}
          <DropdownMenuItem
            disabled={whatsappPending || !whatsappAvailable}
            onClick={() => callNow("whatsapp")}
          >
            <MessageCircle size={14} className="mr-2" />
            WhatsApp call
            {/* An errored fetch must not render as "no permission" — that
                fabricates a consent fact we never obtained. */}
            {motherQuery.isError && (
              <span className="ml-2 text-[10px] text-gray-400">status unavailable</span>
            )}
            {!motherQuery.isError && !whatsappPending && !whatsappAvailable && (
              <span className="ml-2 text-[10px] text-gray-400">
                {mother?.whatsappCall?.permissionStatus
                  ? `permission ${mother.whatsappCall.permissionStatus}`
                  : "no permission"}
              </span>
            )}
            {whatsappPending && (
              <span className="ml-2 text-[10px] text-gray-400">checking…</span>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export { CallActions };
