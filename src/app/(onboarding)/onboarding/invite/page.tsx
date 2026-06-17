"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronLeft, X, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  readOnboarding,
  writeOnboarding,
  type OnboardingCaseManager,
  type OnboardingInvite,
  type OnboardingInviteRole,
} from "@/lib/onboarding/state";

const MAX_INVITES = 20;

function fallbackName(email: string): string {
  return email.split("@")[0]?.replace(/[._-]+/g, " ") || email;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export default function OnboardingInvitePage() {
  const router = useRouter();
  const [invites, setInvites] = useState<OnboardingInvite[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<OnboardingInviteRole>("advisor");
  const [caseManager, setCaseManager] = useState<OnboardingCaseManager>({ email: "", fullName: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = readOnboarding();
    if (s.invites) setInvites(s.invites);
    if (s.caseManager) setCaseManager(s.caseManager);
  }, []);

  const usedEmails = useMemo(() => {
    const set = new Set(invites.map((invite) => normalizeEmail(invite.email)));
    if (caseManager.email) set.add(normalizeEmail(caseManager.email));
    return set;
  }, [invites, caseManager.email]);

  function addInvite() {
    const normalized = normalizeEmail(email);
    if (!normalized) return;
    if (invites.length >= MAX_INVITES) return;
    if (usedEmails.has(normalized)) {
      setError("That email is already in the invite list.");
      return;
    }
    setInvites((prev) => [
      ...prev,
      { email: normalized, fullName: fullName.trim() || fallbackName(normalized), role },
    ]);
    setEmail("");
    setFullName("");
    setRole("advisor");
    setError(null);
  }

  function removeInvite(idx: number) {
    setInvites((prev) => prev.filter((_, i) => i !== idx));
  }

  async function sendInvite(token: string, invite: { email: string; fullName: string; role: string }) {
    const res = await fetch("/api/team", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "invite",
        email: invite.email,
        fullName: invite.fullName,
        role: invite.role,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? `Failed to invite ${invite.email}`);
  }

  async function handleNext() {
    setError(null);

    const normalizedCaseManagerEmail = normalizeEmail(caseManager.email);
    const hasCaseManager = normalizedCaseManagerEmail || caseManager.fullName.trim();
    if (hasCaseManager && (!normalizedCaseManagerEmail || !caseManager.fullName.trim())) {
      setError("Enter both name and email for the Case Manager, or leave both blank.");
      return;
    }

    const duplicateCaseManager = normalizedCaseManagerEmail
      ? invites.some((invite) => normalizeEmail(invite.email) === normalizedCaseManagerEmail)
      : false;
    if (duplicateCaseManager) {
      setError("The Case Manager email is already in the team invite list.");
      return;
    }

    writeOnboarding({
      invites,
      caseManager: hasCaseManager
        ? { email: normalizedCaseManagerEmail, fullName: caseManager.fullName.trim() }
        : undefined,
    });

    const outboundInvites = [
      ...invites,
      ...(hasCaseManager
        ? [{ email: normalizedCaseManagerEmail, fullName: caseManager.fullName.trim(), role: "case_manager" }]
        : []),
    ];

    if (outboundInvites.length === 0) {
      router.push("/onboarding/connect");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        router.push("/login");
        return;
      }

      for (const invite of outboundInvites) {
        await sendInvite(token, invite);
      }

      router.push("/onboarding/connect");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invites.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-[16px] p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary mb-1">Step 2 of 5</p>
        <h1 className="text-2xl font-bold text-gray-900">Invite your team</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add up to {MAX_INVITES} team members now, or continue and invite them later from Team.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-lg border border-gray-100 p-4">
        <h2 className="text-sm font-bold text-gray-900">Case Manager</h2>
        <p className="mt-1 text-xs text-gray-500">
          Optional. Case Managers can add and allocate leads and view everyone's pipeline, but cannot access Reports or Forecast.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
          <input
            type="text"
            value={caseManager.fullName}
            onChange={(e) => setCaseManager((prev) => ({ ...prev, fullName: e.target.value }))}
            placeholder="Full name"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="email"
            value={caseManager.email}
            onChange={(e) => setCaseManager((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="case.manager@firm.co.uk"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {invites.length > 0 && (
        <ul className="mb-5 divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {invites.map((inv, i) => (
            <li key={`${inv.email}-${i}`} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{inv.fullName}</p>
                <p className="text-xs text-gray-500">
                  {inv.email} · {inv.role === "advisor" ? "Advisor" : "Manager"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeInvite(i)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400"
                aria-label="Remove invite"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {invites.length < MAX_INVITES && (
        <div className="rounded-lg border border-dashed border-gray-200 p-4 mb-5">
          <div className="grid grid-cols-12 gap-2.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@firm.co.uk"
              className="col-span-12 md:col-span-5 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name (optional)"
              className="col-span-12 md:col-span-4 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as OnboardingInviteRole)}
              className="col-span-10 md:col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm"
            >
              <option value="advisor">Advisor</option>
              <option value="manager">Manager</option>
            </select>
            <button
              type="button"
              onClick={addInvite}
              className="col-span-2 md:col-span-1 inline-flex items-center justify-center bg-primary text-white rounded-lg hover:bg-primary-dark"
              aria-label="Add invite"
            >
              <Plus size={16} />
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {MAX_INVITES - invites.length} invite{invites.length === MAX_INVITES - 1 ? "" : "s"} remaining.
          </p>
        </div>
      )}

      {invites.length === 0 && !caseManager.email && (
        <p className="mb-5 text-sm text-gray-400">
          Skipping is fine. You can add team members later.
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft size={14} />
          Back
        </Link>
        <button
          type="button"
          onClick={handleNext}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-primary-dark disabled:opacity-60"
        >
          {saving ? "Sending invites..." : "Continue"}
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
