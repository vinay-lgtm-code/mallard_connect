"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Check, Mail, MessageSquare, CheckSquare, Bell } from "lucide-react";
import { readOnboarding, writeOnboarding, clearOnboarding } from "@/lib/onboarding/state";
import { STARTER_CADENCES } from "@/lib/cadences/seeds";
import type { CadenceChannel } from "@/types";
import { Button } from "@/components/ui/button";

const ICONS: Record<CadenceChannel, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  task: CheckSquare,
  reminder: Bell,
};

export default function OnboardingCadencesPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [provisioning, setProvisioning] = useState(false);

  useEffect(() => {
    const s = readOnboarding();
    if (s.selectedCadenceSlugs?.length) {
      setSelected(new Set(s.selectedCadenceSlugs));
    } else {
      // Default: all three on
      setSelected(new Set(STARTER_CADENCES.map((c) => c.name)));
    }
  }, []);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function finish() {
    writeOnboarding({ selectedCadenceSlugs: Array.from(selected) });
    setProvisioning(true);
    // In a real signup we'd POST /api/onboarding/provision here.
    await new Promise((r) => setTimeout(r, 1200));
    clearOnboarding();
    router.push("/dashboard");
  }

  return (
    <div className="bg-white border border-border rounded-[16px] p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary mb-1">Step 5 of 5</p>
        <h1 className="text-2xl font-bold text-text-primary">Pick your starter cadences</h1>
        <p className="mt-1 text-sm text-text-secondary">
          We&apos;ve seeded three nurture sequences that cover the most common scenarios. Toggle any
          off you don&apos;t want, or edit them anytime from the Cadences page.
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {STARTER_CADENCES.map((cadence) => {
          const active = selected.has(cadence.name);
          return (
            <button
              key={cadence.name}
              onClick={() => toggle(cadence.name)}
              className={`w-full text-left rounded-[12px] border-2 p-5 transition-all ${
                active
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-border-strong hover:bg-page"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    active ? "bg-primary border-primary text-white" : "border-border-strong"
                  }`}
                >
                  {active && <Check size={11} strokeWidth={3} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary mb-1">{cadence.name}</p>
                  <p className="text-sm text-text-secondary leading-relaxed mb-3">{cadence.description}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {cadence.steps.map((s, i) => {
                      const Icon = ICONS[s.channel];
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-border text-xs text-text-secondary"
                        >
                          <Icon size={11} />
                          {s.delayDays === 0 ? "Day 0" : `+${s.delayDays}d`}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Link
          href="/onboarding/import"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ChevronLeft size={14} />
          Back
        </Link>
        <Button
          onClick={finish}
          variant="primary"
          disabled={provisioning}
        >
          {provisioning ? (
            <>
              <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Provisioning...
            </>
          ) : (
            <>Finish &amp; open Sequence</>
          )}
        </Button>
      </div>
    </div>
  );
}
