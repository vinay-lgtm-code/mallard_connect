"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { readOnboarding, writeOnboarding, clearOnboarding } from "@/lib/onboarding/state";
import { clearDemoUser } from "@/hooks/useAuth";

const COLORS = ["#1A5653", "#0F172A", "#7C3AED", "#0369A1", "#B45309", "#BE185D"];

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function OnboardingPage() {
  const router = useRouter();
  const [firmName, setFirmName] = useState("");
  const [slug, setSlug] = useState("");
  const [primaryColor, setPrimaryColor] = useState(COLORS[0]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    writeOnboarding({ firmName, slug, primaryColor });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/onboarding/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.id,
          firmName,
          slug,
          primaryColor,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        if (res.status === 409) {
          setError("That vanity URL is already taken. Try a different one.");
        } else {
          setError(body.error ?? "Something went wrong. Please try again.");
        }
        return;
      }

      await supabase.auth.refreshSession();
      clearDemoUser();
      clearOnboarding();
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-[16px] p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Set up your workspace</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tell us about your firm. You can change these later in Settings.
        </p>
      </div>

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

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
            Set custom firm URL
          </label>
          <p className="text-xs text-gray-500 mb-2">
            e.g. if you are Acme Mortgages, set as acme-mortgages.sequence-ai.com
          </p>
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
            Your team will sign in at{" "}
            <span className="font-mono">{slug || "your-firm"}.sequence-ai.com</span>.
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
          PNG later from Settings.
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Creating workspace…
            </>
          ) : (
            "Create my workspace"
          )}
        </button>
      </div>
    </form>
  );
}
