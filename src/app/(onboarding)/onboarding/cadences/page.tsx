"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Check, Mail, MessageSquare, CheckSquare, Bell } from "lucide-react";
import { readOnboarding, writeOnboarding, clearOnboarding } from "@/lib/onboarding/state";
import { STARTER_CADENCES } from "@/lib/cadences/seeds";
import type { CadenceChannel } from "@/types";

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
    <div className="bg-white border border-gray-100 rounded-[16px] p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary mb-1">Step 5 of 5</p>
        <h1 className="text-2xl font-bold text-gray-900">Pick your starter cadences</h1>
        <p className="mt-1 text-sm text-gray-500">
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
                  : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    active ? "bg-primary border-primary text-white" : "border-gray-300"
                  }`}
                >
                  {active && <Check size={11} strokeWidth={3} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 mb-1">{cadence.name}</p>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{cadence.description}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {cadence.steps.map((s, i) => {
                      const Icon = ICONS[s.channel];
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-gray-200 text-xs text-gray-600"
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
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft size={14} />
          Back
        </Link>
        <button
          onClick={finish}
          disabled={provisioning}
          className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-primary-dark disabled:opacity-60"
        >
          {provisioning ? (
            <>
              <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Provisioning...
            </>
          ) : (
            <>Finish &amp; open Sequence</>
          )}
        </button>
      </div>
    </div>
  );
}
