"use client";

import { ErrorFallback } from "@/components/error-boundary";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center p-6 min-h-[50vh]">
      <ErrorFallback error={error} resetErrorBoundary={reset} />
    </div>
  );
}
