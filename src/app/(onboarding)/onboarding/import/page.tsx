"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Upload, Check } from "lucide-react";
import { readOnboarding, writeOnboarding } from "@/lib/onboarding/state";
import { Button } from "@/components/ui/button";

export default function OnboardingImportPage() {
  const router = useRouter();
  const [dataSource, setDataSource] = useState<string | undefined>();
  const [importedCount, setImportedCount] = useState<number>(0);
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => {
    const s = readOnboarding();
    setDataSource(s.dataSource);
    if (s.importedLeadCount) setImportedCount(s.importedLeadCount);
  }, []);

  function simulateImport() {
    setShowProgress(true);
    let done = 0;
    const target = dataSource === "brevo" ? 187 : dataSource === "mab" ? 64 : 0;
    const tick = setInterval(() => {
      done = Math.min(done + Math.ceil(target / 20), target);
      setImportedCount(done);
      if (done >= target) clearInterval(tick);
    }, 80);
  }

  function handleNext() {
    writeOnboarding({ importedLeadCount: importedCount });
    router.push("/onboarding/cadences");
  }

  function skipImport() {
    writeOnboarding({ importedLeadCount: 0 });
    router.push("/onboarding/cadences");
  }

  return (
    <div className="bg-white border border-border rounded-[16px] p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary mb-1">Step 4 of 5</p>
        <h1 className="text-2xl font-bold text-text-primary">Import your existing leads</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {dataSource === "brevo"
            ? "We'll pull contacts from your Brevo lists and create them as leads in Sequence."
            : dataSource === "mab"
            ? "Drop your latest MAB Platform CSV export. We'll auto-map columns and dedupe."
            : "You can still add leads manually one-by-one, or come back to this step later."}
        </p>
      </div>

      {dataSource === "brevo" && (
        <div className="rounded-[12px] border border-border p-6 mb-6">
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
            Brevo API key
          </label>
          <input
            type="password"
            placeholder="xkeysib-..."
            onChange={(e) => writeOnboarding({ brevoApiKey: e.target.value })}
            className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm font-mono"
          />
          <p className="mt-1.5 text-xs text-text-secondary">
            Find this in Brevo → Settings → API keys. Read-only access is enough.
          </p>

          <Button
            onClick={simulateImport}
            variant="primary"
            disabled={showProgress && importedCount > 0 && importedCount < 187}
            className="mt-4 w-full"
          >
            {importedCount === 0 ? "Test connection &amp; import" : importedCount < 187 ? "Importing..." : "Imported"}
          </Button>
        </div>
      )}

      {dataSource === "mab" && (
        <div className="rounded-[12px] border-2 border-dashed border-border p-10 mb-6 text-center">
          <Upload size={28} className="mx-auto text-text-muted mb-3" />
          <p className="text-sm font-medium text-text-primary mb-1">Drag CSV here or click to upload</p>
          <p className="text-xs text-text-secondary mb-4">.csv, .xls, .xlsx accepted</p>
          <Button
            onClick={simulateImport}
            variant="primary"
          >
            Upload sample file
          </Button>
        </div>
      )}

      {dataSource === "other" && (
        <div className="rounded-[12px] border border-border p-6 mb-6 bg-page">
          <p className="text-sm text-text-secondary">
            We&apos;ll reach out within 24 hours to scope an integration. In the meantime, you can
            start adding leads manually from the dashboard.
          </p>
        </div>
      )}

      {showProgress && importedCount > 0 && (
        <div className="rounded-[12px] border border-green-100 bg-green-50 px-5 py-4 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
            <Check size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-900">
              {importedCount} lead{importedCount === 1 ? "" : "s"} ready to import
            </p>
            <p className="text-xs text-green-800">
              Mapped to {Math.ceil(importedCount * 0.85)} new, {Math.floor(importedCount * 0.15)} likely duplicates skipped.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Link
          href="/onboarding/connect"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ChevronLeft size={14} />
          Back
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={skipImport}
            className="text-sm text-text-secondary hover:text-text-primary px-3 py-2"
          >
            Skip for now
          </button>
          <Button
            onClick={handleNext}
            variant="primary"
          >
            Continue
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
