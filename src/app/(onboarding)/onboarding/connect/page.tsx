"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Database, Upload, Building2, Check } from "lucide-react";
import { readOnboarding, writeOnboarding, type DataSource } from "@/lib/onboarding/state";

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
    <div className="bg-white border border-gray-100 rounded-[16px] p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary mb-1">Step 3 of 5</p>
        <h1 className="text-2xl font-bold text-gray-900">Connect your existing data source</h1>
        <p className="mt-1 text-sm text-gray-500">
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
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    active ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {active ? <Check size={18} /> : <Icon size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-900">{source.title}</p>
                    <p className="text-xs text-gray-500">{source.subtitle}</p>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{source.body}</p>
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
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
            Which CRM do you use?
          </label>
          <input
            type="text"
            value={otherCrm}
            onChange={(e) => setOtherCrm(e.target.value)}
            placeholder="e.g. FLG, Intelligent Office, Smart365..."
            className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Link
          href="/onboarding/invite"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft size={14} />
          Back
        </Link>
        <button
          onClick={handleNext}
          disabled={!selected || (selected === "other" && !otherCrm)}
          className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
