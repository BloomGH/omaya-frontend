import React from 'react';
import { X } from 'lucide-react';

interface OnboardingShellProps {
  onClose: () => void;
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
}

const OnboardingShell = ({
  onClose,
  children,
  currentStep,
  totalSteps,
  stepLabel,
  leftAction,
  rightAction,
}: OnboardingShellProps) => {
  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full sm:w-[580px] h-full bg-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-700">{stepLabel}</span>
          <span className="text-xs font-medium text-brand-plum">Step {currentStep} of {totalSteps}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-50"
        >
          <X size={20} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-0.5 bg-gray-100 flex-shrink-0">
        <div
          className="h-full w-full origin-left bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${progressPercent / 100})` }}
        />
      </div>

      {/* Content area. overflow-x-hidden so the per-step slide animation can't
          flash a horizontal scrollbar (dropdowns here are portalled). */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-8 py-6 sm:py-10">
        {children}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center flex-shrink-0">
        <div>{leftAction}</div>
        <div>{rightAction}</div>
      </div>
    </div>
  );
};

export { OnboardingShell };
