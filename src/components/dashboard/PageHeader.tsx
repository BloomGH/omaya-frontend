import React from "react";
import { Plus } from "lucide-react";
import { Button } from "../ui/Button";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

interface PageHeaderProps {
  userName: string;
  onNewDischarge?: () => void;
}

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const formatDate = () => {
  const now = new Date();
  return `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]}`;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

export const PageHeader: React.FC<PageHeaderProps> = ({
  userName,
  onNewDischarge,
}) => {
  return (
    <div>
      {/* Date sits on its own line — the notifications bell (in AppShell)
          floats top-right and lines up with it. */}
      <span className="block text-gray-400 text-xs md:text-sm font-normal mb-2 md:mb-3">
        {formatDate()}
      </span>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl md:text-3xl font-bold text-gray-900">
          {getGreeting()}, {userName}
        </h1>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={!onNewDischarge ? "cursor-not-allowed inline-flex shrink-0" : "inline-flex shrink-0"}>
              <Button
                variant="default"
                onClick={onNewDischarge}
                disabled={!onNewDischarge}
                className="flex items-center gap-1.5 h-[2.4rem] md:h-[2.8rem] px-3 md:px-5"
              >
                <Plus size={14} className="md:size-4" />
                <span className="font-medium text-xs md:text-sm">New discharge</span>
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{onNewDischarge ? "Enrol a new mother" : "You don't have permission to enrol mothers"}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
