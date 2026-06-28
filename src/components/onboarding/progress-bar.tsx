"use client";

export function OnboardingProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="w-full h-2 bg-border rounded-full overflow-hidden">
      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}
