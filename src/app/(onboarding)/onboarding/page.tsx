"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { readOnboarding, writeOnboarding } from "@/lib/onboarding/state";
import { clearDemoUser } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import posthog from "posthog-js";

const COLORS = ["#1A5653", "#0F172A", "#7C3AED", "#0369A1", "#B45309", "#BE185D"];
const LOGO_ACCEPT = ".svg,.png,.jpg,.jpeg,.webp";
const LOGO_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/webp"];
const LOGO_EXTENSIONS = [".svg", ".png", ".jpg", ".jpeg", ".webp"];
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateLogo(file: File): string | null {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!LOGO_TYPES.includes(file.type) && !LOGO_EXTENSIONS.includes(extension)) {
    return "Logo must be an SVG, PNG, JPEG, or WebP file.";
  }
  if (file.size > MAX_LOGO_SIZE) {
    return `Logo is too large (${formatFileSize(file.size)}). Maximum is 2 MB.`;
  }
  return null;
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
      <div className="bg-white border border-border rounded-[16px] p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Check your email</h1>
        <p className="text-sm text-text-secondary mb-1">
          We sent a new confirmation link to <strong>{email}</strong>.
        </p>
        <p className="text-sm text-text-secondary">Click the link within the next hour to activate your account.</p>
        <Link href="/login" className="inline-block mt-6 text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-[16px] p-8">
      <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-text-primary text-center mb-2">Confirmation link expired</h1>
      <p className="text-sm text-text-secondary text-center mb-6">
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
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          disabled={sending}
          className="w-full"
        >
          {sending ? "Sending..." : "Resend confirmation email"}
        </Button>
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
  const searchParams = useSearchParams();
  const claimToken = searchParams.get("claim") ?? undefined;
  const [firmName, setFirmName] = useState("");
  const [slug, setSlug] = useState("");
  const [primaryColor, setPrimaryColor] = useState(COLORS[0]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
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
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [logoFile]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(firmName));
  }, [firmName, slugTouched]);

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) return;

    const validationError = validateLogo(selected);
    if (validationError) {
      setLogoFile(null);
      setLogoError(validationError);
      e.target.value = "";
      return;
    }

    setLogoError(null);
    setLogoFile(selected);
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoError(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (logoFile) {
      const validationError = validateLogo(logoFile);
      if (validationError) {
        setLogoError(validationError);
        return;
      }
    }

    setLoading(true);

    writeOnboarding({ firmName, slug, primaryColor });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!user || !session?.access_token) {
        router.push("/login");
        return;
      }

      const formData = new FormData();
      formData.append("firmName", firmName);
      formData.append("slug", slug);
      formData.append("primaryColor", primaryColor);
      if (claimToken) formData.append("claimToken", claimToken);
      if (logoFile) formData.append("logo", logoFile);

      const res = await fetch("/api/onboarding/provision", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
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
      posthog.capture("onboarding_completed", {
        logo_uploaded: Boolean(logoFile),
      });
      clearDemoUser();
      router.push("/onboarding/invite");
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
    <form onSubmit={handleSubmit} className="bg-white border border-border rounded-[16px] p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Set up your workspace</h1>
        <p className="mt-1 text-sm text-text-secondary">
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
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
            Firm name
          </label>
          <input
            type="text"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            required
            placeholder="Acme Mortgages"
            className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
            Set custom firm URL
          </label>
          <p className="text-xs text-text-secondary mb-2">
            e.g. if you are Acme Mortgages, set as acme-mortgages.sequence-ai.com
          </p>
          <div className="flex items-center border border-border rounded-lg overflow-hidden focus-within:ring-[3px] focus-within:ring-primary/10 focus-within:border-primary">
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
            <span className="px-3 py-2.5 bg-page text-sm text-text-secondary border-l border-border">
              .sequence-ai.com
            </span>
          </div>
          <p className="mt-1.5 text-xs text-text-secondary">
            Your team will sign in at{" "}
            <span className="font-mono">{slug || "your-firm"}.sequence-ai.com</span>.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
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

        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Logo
          </label>
          <div className="rounded-lg border border-border bg-page p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-white overflow-hidden">
                {logoPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreviewUrl} alt="Selected firm logo" className="h-full w-full object-contain p-2" />
                ) : (
                  <Upload size={20} className="text-text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {logoFile ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-text-primary">{logoFile.name}</p>
                    <span className="text-xs text-text-secondary">{formatFileSize(logoFile.size)}</span>
                    <button
                      type="button"
                      onClick={clearLogo}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-white hover:text-text-secondary"
                      aria-label="Remove logo"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-text-primary">Upload your firm logo</p>
                )}
                <p className="mt-1 text-xs text-text-secondary">SVG, PNG, JPEG, or WebP up to 2 MB.</p>
              </div>
              <label
                htmlFor="firm-logo"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-text-secondary hover:bg-page"
              >
                <Upload size={15} />
                Choose file
              </label>
              <input
                id="firm-logo"
                ref={logoInputRef}
                type="file"
                accept={LOGO_ACCEPT}
                onChange={handleLogoChange}
                className="hidden"
              />
            </div>
          </div>
          {logoError && <p className="mt-2 text-xs text-destructive">{logoError}</p>}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button
          type="submit"
          variant="primary"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Creating workspace…
            </>
          ) : (
            "Create my workspace"
          )}
        </Button>
      </div>
    </form>
  );
}
