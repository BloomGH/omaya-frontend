import { useMemo } from "react";

interface Option {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface ChipSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  max?: number;
  id?: string;
}

const ChipSelect = ({ options, selected, onChange, max, id }: ChipSelectProps) => {
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleOption = (value: string) => {
    const option = options.find((o) => o.value === value);
    if (option?.disabled) return;
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      if (max === 1) {
        onChange([value]);
      } else if (!max || selected.length < max) {
        onChange([...selected, value]);
      }
    }
  };

  return (
    <div id={id} className="flex flex-wrap gap-3">
      {options.map((option) => {
        const isSelected = selectedSet.has(option.value);
        return (
          <button
            type="button"
            key={option.value}
            onClick={() => toggleOption(option.value)}
            disabled={option.disabled}
            aria-pressed={isSelected}
            className={`
              px-4 py-2.5 rounded-xl border text-sm transition-[color,background-color,border-color,opacity] flex flex-col text-left
              ${
                option.disabled
                  ? 'border-gray-200 bg-gray-50 text-gray-400 opacity-60'
                  : isSelected
                    ? 'border-primary bg-primary-100 text-primary font-medium cursor-pointer'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40 font-normal cursor-pointer'
              }
            `}
          >
            <span className={option.description ? 'font-semibold' : ''}>{option.label}</span>
            {option.description && (
              <span className="text-xs mt-0.5 opacity-80 font-normal">
                {option.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export { ChipSelect };
