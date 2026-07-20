import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  totalItems: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  totalItems,
}) => {
  if (totalItems === 0) return null;

  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  // Helper to generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const seen = new Set<number>();
    const addPage = (n: number) => {
      if (!seen.has(n)) {
        seen.add(n);
        pages.push(n);
      }
    };
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) addPage(i);
    } else {
      addPage(1);
      if (currentPage > 3) pages.push("...");

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        addPage(i);
      }

      if (currentPage < totalPages - 2) pages.push("...");
      addPage(totalPages);
    }
    return pages;
  };

  const showNav = totalPages > 1;

  return (
    <div className="flex items-center justify-between pt-3 pb-0 mt-0 border-t border-gray-100 gap-4 flex-nowrap">
      {/* LEFT: Rows per page */}
      <div className="flex items-center">
        {onPageSizeChange && (
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-gray-400 whitespace-nowrap">
              Rows per page:
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => onPageSizeChange(Number(val))}
            >
              <SelectTrigger className="h-auto border border-gray-200 bg-white rounded-md px-2 py-1 text-xs font-semibold text-gray-700 hover:text-primary focus:ring-0 shadow-none [&>svg]:text-gray-400 [&>svg]:h-3 [&>svg]:w-3 gap-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* RIGHT: Row range + Navigation */}
      <div className="flex items-center gap-4">
        <span className="text-xs font-medium text-gray-400 tabular-nums">
          {firstItem}–{lastItem} of {totalItems}
        </span>

        {showNav && (
          <div className="flex items-center gap-2">
            {/* Previous */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                  className="p-1 text-gray-400 hover:text-primary disabled:opacity-20 transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
              </TooltipTrigger>
              {currentPage > 1 && (
                <TooltipContent side="top">
                  <p>Previous page</p>
                </TooltipContent>
              )}
            </Tooltip>

            {/* Numbers */}
            <div className="flex items-center gap-1.5">
              {getPageNumbers().map((p, idx) => {
                if (p === "...") {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="text-xs text-gray-300"
                    >
                      ...
                    </span>
                  );
                }
                const isActive = p === currentPage;
                return (
                  <button
                    type="button"
                    key={`page-${p}`}
                    onClick={() => onPageChange(p as number)}
                    className={`
                      text-xs transition-all px-0.5
                      ${isActive ? "font-bold text-gray-900" : "text-gray-400 hover:text-primary"}
                    `}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Next */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                  className="p-1 text-gray-400 hover:text-primary disabled:opacity-20 transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </TooltipTrigger>
              {currentPage < totalPages && (
                <TooltipContent side="top">
                  <p>Next page</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
};
