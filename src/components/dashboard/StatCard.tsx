import { Card, CardContent } from "../ui/card";

interface StatCardProps {
  label: string;
  sublabel: string;
  value: string | number;
  /** Brand pastel, used in sequence across the dashboard cards (see docs/AI_CONTEXT.md). */
  tint?: 1 | 2 | 3 | 4;
  footerText?: string;
  footerColor?: string;
  onViewAll?: () => void;
}

// Static map so Tailwind sees the literal class names.
const TINT_BG: Record<number, string> = {
  1: "bg-surface-tint-1",
  2: "bg-surface-tint-2",
  3: "bg-surface-tint-3",
  4: "bg-surface-tint-4",
};

const StatCard = ({
  label,
  sublabel,
  value,
  tint = 1,
  footerText,
  footerColor,
  onViewAll,
}: StatCardProps) => {
  return (
    <Card
      className={`border-0 shadow-none rounded-2xl ${TINT_BG[tint]} transition-[box-shadow,transform] duration-200 hover:shadow-md hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
    >
      <CardContent className="p-3 md:p-4">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-xs md:text-sm font-medium text-surface-stat-label">
              {label}
            </span>
            <span className="text-xs font-normal text-surface-stat-label/70">
              {sublabel}
            </span>
          </div>
        </div>

        <div className="text-2xl md:text-4xl font-bold text-primary-900 mt-1.5 md:mt-2">
          {value}
        </div>

        {(footerText || onViewAll) && (
          <div className="mt-2.5 flex justify-between items-center">
            <div>
              {footerText && (
                <span
                  className="text-xs font-normal"
                  style={{ color: footerColor }}
                >
                  {footerText}
                </span>
              )}
            </div>
            {onViewAll && (
              <button
                type="button"
                onClick={onViewAll}
                className="text-sm font-medium text-primary hover:opacity-80 transition-opacity ml-auto"
              >
                View all
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { StatCard };
