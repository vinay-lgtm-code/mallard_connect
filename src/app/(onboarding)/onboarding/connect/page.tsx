"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Database, Upload, Building2, Check } from "lucide-react";
import { readOnboarding, writeOnboarding, type DataSource } from "@/lib/onboarding/state";
import { Button } from "@/components/ui/button";

const SOURCES: {
  id: DataSource;
  title: string;
  subtitle: string;
  icon: typeof Database;
  body: string;
  cta?: string;
}[] = [
  {
    id: "brevo",
    title: "Brevo",
    subtitle: "Recommended if you already use it",
    icon: Database,
    body: "We'll pull your existing contacts and sync open/click events into the Sequence activity timeline. Read-only — your Brevo data is never modified.",
    cta: "Paste API key on the next step",
  },
  {
    id: "mab",
    title: "MAB Platform CSV",
    subtitle: "Most common UK setup",
    icon: Upload,
    body: "Export from MAB Platform every week and drop the CSV here. Sequence auto-maps columns and dedupes against existing leads.",
    cta: "Upload CSV on the next step",
  },
  {
    id: "other",
    title: "Other CRM (FLG, Dashly, Intelligent Office, Smart365…)",
    subtitle: "We'll figure it out together",
    icon: Building2,
    body: "Tell us what you use and our team will check for an integration path. You can still get started with manual lead entry today.",
    cta: "Add a note for sales",
  },
];

export default function OnboardingConnectPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<DataSource | null>(null);
  const [otherCrm, setOtherCrm] = useState("");

  useEffect(() => {
    const s = readOnboarding();
    if (s.dataSource) setSelected(s.dataSource);
    if (s.otherCrmName) setOtherCrm(s.otherCrmName);
  }, []);

  function handleNext() {
    if (!selected) return;
    writeOnboarding({ dataSource: selected, otherCrmName: selected === "other" ? otherCrm : undefined });
    router.push("/onboarding/import");
  }

  return (
    <div className="bg-white border border-border rounded-[16px] p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary mb-1">Step 3 of 5</p>
        <h1 className="text-2xl font-bold text-text-primary">Connect your existing data source</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Sequence is built to bolt on to whatever you already use. Pick the option closest to your
          current workflow.
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {SOURCES.map((source) => {
          const Icon = source.icon;
          const active = selected === source.id;
          return (
            <button
              key={source.id}
              onClick={() => setSelected(source.id)}
              className={`w-full text-left rounded-[12px] border-2 p-5 transition-all ${
                active
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-border-strong hover:bg-page"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    active ? "bg-primary text-white" : "bg-gray-100 text-text-secondary"
                  }`}
                >
                  {active ? <Check size={18} /> : <Icon size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-text-primary">{source.title}</p>
                    <p className="text-xs text-text-secondary">{source.subtitle}</p>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">{source.body}</p>
                  {source.cta && active && (
                    <p className="mt-2 text-xs font-medium text-primary">{source.cta}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected === "other" && (
        <div className="mb-6">
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
            Which CRM do you use?
          </label>
          <input
            type="text"
            value={otherCrm}
            onChange={(e) => setOtherCrm(e.target.value)}
            placeholder="e.g. FLG, Intelligent Office, Smart365..."
            className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          />
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Link
          href="/onboarding/invite"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ChevronLeft size={14} />
          Back
        </Link>
        <Button
          onClick={handleNext}
          variant="primary"
          disabled={!selected || (selected === "other" && !otherCrm)}
        >
          Continue
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
