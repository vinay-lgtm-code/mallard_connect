"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Upload, Check } from "lucide-react";
import { readOnboarding, writeOnboarding } from "@/lib/onboarding/state";

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
    <div className="bg-white border border-gray-100 rounded-[16px] p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary mb-1">Step 4 of 5</p>
        <h1 className="text-2xl font-bold text-gray-900">Import your existing leads</h1>
        <p className="mt-1 text-sm text-gray-500">
          {dataSource === "brevo"
            ? "We'll pull contacts from your Brevo lists and create them as leads in Sequence."
            : dataSource === "mab"
            ? "Drop your latest MAB Platform CSV export. We'll auto-map columns and dedupe."
            : "You can still add leads manually one-by-one, or come back to this step later."}
        </p>
      </div>

      {dataSource === "brevo" && (
        <div className="rounded-[12px] border border-gray-100 p-6 mb-6">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
            Brevo API key
          </label>
          <input
            type="password"
            placeholder="xkeysib-..."
            onChange={(e) => writeOnboarding({ brevoApiKey: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm font-mono"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Find this in Brevo → Settings → API keys. Read-only access is enough.
          </p>

          <button
            onClick={simulateImport}
            disabled={showProgress && importedCount > 0 && importedCount < 187}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-primary-dark disabled:opacity-60"
          >
            {importedCount === 0 ? "Test connection &amp; import" : importedCount < 187 ? "Importing..." : "Imported"}
          </button>
        </div>
      )}

      {dataSource === "mab" && (
        <div className="rounded-[12px] border-2 border-dashed border-gray-200 p-10 mb-6 text-center">
          <Upload size={28} className="mx-auto text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">Drag CSV here or click to upload</p>
          <p className="text-xs text-gray-500 mb-4">.csv, .xls, .xlsx accepted</p>
          <button
            onClick={simulateImport}
            className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-dark"
          >
            Upload sample file
          </button>
        </div>
      )}

      {dataSource === "other" && (
        <div className="rounded-[12px] border border-gray-100 p-6 mb-6 bg-gray-50">
          <p className="text-sm text-gray-700">
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
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft size={14} />
          Back
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={skipImport}
            className="text-sm text-gray-500 hover:text-gray-900 px-3 py-2"
          >
            Skip for now
          </button>
          <button
            onClick={handleNext}
            className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-primary-dark"
          >
            Continue
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
