"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

function parseHashError(): { code: string; description: string } | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash || !hash.includes("error=")) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const errorCode = params.get("error_code") || params.get("error");
  const description = params.get("error_description");
  if (!errorCode) return null;
  return { code: errorCode, description: description || "An error occurred" };
}

function LinkExpiredError() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    setResendError(null);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to resend");
      }
      setSent(true);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-white border border-gray-100 rounded-[16px] p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
        <p className="text-sm text-gray-600 mb-1">
          We sent a new confirmation link to <strong>{email}</strong>.
        </p>
        <p className="text-sm text-gray-500">Click the link within the next hour to activate your account.</p>
        <Link href="/login" className="inline-block mt-6 text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-[16px] p-8">
      <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Confirmation link expired</h1>
      <p className="text-sm text-gray-600 text-center mb-6">
        Your email confirmation link has expired or is no longer valid.
        Enter your email below and we&apos;ll send a fresh one.
      </p>

      {resendError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {resendError}
        </div>
      )}

      <form onSubmit={handleResend} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={sending}
          className="w-full bg-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-primary-dark disabled:opacity-60"
        >
          {sending ? "Sending..." : "Resend confirmation email"}
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [firmName, setFirmName] = useState("");
  const [slug, setSlug] = useState("");
  const [primaryColor, setPrimaryColor] = useState(COLORS[0]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hashError, setHashError] = useState<{ code: string; description: string } | null>(null);

  useEffect(() => {
    const he = parseHashError();
    if (he) {
      setHashError(he);
      if (window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      return;
    }

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

  if (hashError) {
    return <LinkExpiredError />;
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
