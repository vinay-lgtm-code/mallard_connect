"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { readOnboarding, writeOnboarding } from "@/lib/onboarding/state";

const COLORS = ["#1A5653", "#0F172A", "#7C3AED", "#0369A1", "#B45309", "#BE185D"];

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function OnboardingFirmDetailsPage() {
  const router = useRouter();
  const [firmName, setFirmName] = useState("");
  const [slug, setSlug] = useState("");
  const [primaryColor, setPrimaryColor] = useState(COLORS[0]);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    const s = readOnboarding();
    if (s.firmName) setFirmName(s.firmName);
    if (s.slug) {
      setSlug(s.slug);
      setSlugTouched(true);
    }
    if (s.primaryColor) setPrimaryColor(s.primaryColor);
  }, []);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(firmName));
  }, [firmName, slugTouched]);

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    writeOnboarding({ firmName, slug, primaryColor });
    router.push("/onboarding/invite");
  }

  return (
    <form onSubmit={handleNext} className="bg-white border border-gray-100 rounded-[16px] p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary mb-1">Step 1 of 5</p>
        <h1 className="text-2xl font-bold text-gray-900">Tell us about your firm</h1>
        <p className="mt-1 text-sm text-gray-500">
          We&apos;ll use these to set up your tenant. You can change them later.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
            Firm name
          </label>
          <input
            type="text"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            required
            placeholder="Acme Mortgages"
            className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
            Vanity URL
          </label>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary">
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setSlugTouched(true);
              }}
              required
              placeholder="acme"
              className="flex-1 px-3.5 py-2.5 text-sm focus:outline-none"
            />
            <span className="px-3 py-2.5 bg-gray-50 text-sm text-gray-500 border-l border-gray-200">
              .sequence-ai.com
            </span>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            Your team will sign in at <span className="font-mono">{slug || "your-firm"}.sequence-ai.com</span>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Primary colour
          </label>
          <div className="flex items-center gap-2.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setPrimaryColor(c)}
                className={`w-8 h-8 rounded-full transition-transform ${
                  primaryColor === c ? "ring-2 ring-offset-2 ring-gray-900 scale-110" : ""
                }`}
                style={{ background: c }}
                aria-label={`Pick ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-xs text-gray-600">
          <strong className="text-gray-900">Logo upload</strong> — optional, you can drop in a SVG or
          PNG later from Settings → Firm.
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-primary-dark"
        >
          Continue
          <ChevronRight size={14} />
        </button>
      </div>
    </form>
  );
}
