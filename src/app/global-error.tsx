"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { ensurePostHogInitialized } from "@/components/posthog-client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (ensurePostHogInitialized()) {
      posthog.captureException(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2">An unexpected error occurred.</p>
            <button className="mt-4" onClick={() => reset()}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
