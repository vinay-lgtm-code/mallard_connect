"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LockKeyhole, Mail, UserRoundCheck } from "lucide-react";
import { roleLabel } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";

interface InviteDetails {
  email: string;
  fullName: string;
  role: string;
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [details, setDetails] = useState<InviteDetails | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadInvite() {
      if (!token) {
        setError("Invitation link is missing a token.");
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => null);
      if (cancelled) return;
      if (!res.ok) {
        setError(data?.error ?? "Invitation is no longer active.");
      } else {
        setDetails(data);
      }
      setLoading(false);
    }
    loadInvite();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Unable to accept invitation.");
      router.push("/login?invite=accepted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to accept invitation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="bg-white rounded-[12px] shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary mb-4">
            <UserRoundCheck size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Accept Invitation</h1>
          {details && (
            <p className="text-sm text-text-secondary mt-1">
              Join Sequence as {details.fullName}.
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : error && !details ? (
          <div className="text-center">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
            <Link href="/login" className="mt-5 inline-block text-sm font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="rounded-lg bg-page border border-border px-4 py-3 text-sm">
              <div className="flex items-start gap-3">
                <Mail size={16} className="mt-0.5 text-text-muted" />
                <div className="min-w-0">
                  <p className="font-medium text-text-primary truncate">{details?.email}</p>
                  <p className="text-text-secondary">{roleLabel(details?.role)}</p>
                </div>
              </div>
            </div>
            <label className="block">
              <span className="block text-sm font-medium text-text-secondary mb-1.5">Password</span>
              <div className="relative">
                <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full border border-border-strong rounded-lg py-2.5 pl-9 pr-3.5 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                />
              </div>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-text-secondary mb-1.5">Confirm password</span>
              <div className="relative">
                <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full border border-border-strong rounded-lg py-2.5 pl-9 pr-3.5 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                />
              </div>
            </label>
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              className="w-full"
            >
              {saving ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
