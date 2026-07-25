import * as React from "react"
import { useId } from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  label?: string;
  containerClassName?: string;
}

function Textarea({
  className,
  label,
  containerClassName,
  id,
  ref,
  ...props
}: TextareaProps) {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    return (
      <div className={cn("flex flex-col", containerClassName)}>
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-gray-700 mb-1.5 ml-0.5"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            "flex w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
            className,
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
}

export { Textarea };
