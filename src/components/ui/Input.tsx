import * as React from "react";

import { cn } from "@/lib/utils";
export interface InputProps extends React.ComponentProps<"input"> {
  label?: string;
  containerClassName?: string;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

function Input({
  className,
  type,
  label,
  containerClassName,
  fullWidth,
  leftIcon,
  rightIcon,
  id,
  ref,
  ...props
}: InputProps) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    return (
      <div
        className={cn(
          "flex flex-col",
          fullWidth ? "w-full" : "w-auto",
          containerClassName,
        )}
      >
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700 mb-1.5 ml-0.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            type={type}
            className={cn(
              "flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              leftIcon && "pl-9",
              rightIcon && "pr-10",
              className,
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {rightIcon}
            </span>
          )}
        </div>
      </div>
    );
}

export { Input };
