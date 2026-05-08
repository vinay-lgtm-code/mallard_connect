"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const STEPS = [
  { path: "/onboarding", label: "Firm" },
  { path: "/onboarding/invite", label: "Team" },
  { path: "/onboarding/connect", label: "Data source" },
  { path: "/onboarding/import", label: "Import" },
  { path: "/onboarding/cadences", label: "Cadences" },
];

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const stepIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.path === pathname)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <span className="text-lg font-bold text-gray-900">Sequence</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900">
            Already have an account? Sign in
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 pt-8">
        {/* Progress bar */}
        <ol className="flex items-center gap-2 mb-8">
          {STEPS.map((step, i) => {
            const active = i === stepIndex;
            const done = i < stepIndex;
            return (
              <li key={step.path} className="flex-1 flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2.5">
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold ${
                      done
                        ? "bg-primary text-white"
                        : active
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      active ? "text-gray-900" : done ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 ${i < stepIndex ? "bg-primary" : "bg-gray-200"}`} />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <main className="max-w-3xl mx-auto px-6 pb-16">{children}</main>
    </div>
  );
}
