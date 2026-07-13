"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryErrorProps {
  error: Error | null;
  onRetry?: () => void;
  className?: string;
}

export function QueryError({ error, onRetry, className = "" }: QueryErrorProps) {
  if (!error) return null;

  return (
    <div
      className={`bg-white rounded-[12px] p-4 border border-border border-l-4 border-l-destructive flex items-start gap-3 ${className}`}
    >
      <AlertTriangle className="text-destructive flex-shrink-0 mt-0.5" size={18} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary">Something went wrong</p>
        <p className="text-xs text-text-secondary font-mono mt-0.5 break-words">
          {error.message}
        </p>
      </div>
      {onRetry && (
        <Button variant="primary" onClick={onRetry} className="flex-shrink-0 text-xs px-3 py-1.5">
          Try again
        </Button>
      )}
    </div>
  );
}
