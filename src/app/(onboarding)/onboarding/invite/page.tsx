"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronLeft, X, Plus } from "lucide-react";
import { readOnboarding, writeOnboarding } from "@/lib/onboarding/state";

type Invite = { email: string; fullName?: string; role: "manager" | "advisor" };

export default function OnboardingInvitePage() {
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"manager" | "advisor">("advisor");

  useEffect(() => {
    const s = readOnboarding();
    if (s.invites) setInvites(s.invites);
  }, []);

  function addInvite() {
    if (!email) return;
    if (invites.length >= 4) return;
    setInvites((prev) => [...prev, { email, fullName: fullName || undefined, role }]);
    setEmail("");
    setFullName("");
    setRole("advisor");
  }

  function removeInvite(idx: number) {
    setInvites((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleNext() {
    writeOnboarding({ invites });
    router.push("/onboarding/connect");
  }

  return (
    <div className="bg-white border border-gray-100 rounded-[16px] p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary mb-1">Step 2 of 5</p>
        <h1 className="text-2xl font-bold text-gray-900">Invite your team</h1>
        <p className="mt-1 text-sm text-gray-500">
          You + 4 invited users on the £50/month base tier. Add more later from the Team page.
        </p>
      </div>

      {invites.length > 0 && (
        <ul className="mb-5 divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {invites.map((inv, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{inv.fullName ?? inv.email}</p>
                <p className="text-xs text-gray-500">
                  {inv.fullName ? inv.email : ""} · {inv.role}
                </p>
              </div>
              <button
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

      {invites.length < 4 && (
        <div className="rounded-lg border border-dashed border-gray-200 p-4 mb-5">
          <div className="grid grid-cols-12 gap-2.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@firm.co.uk"
              className="col-span-5 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name (optional)"
              className="col-span-4 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "manager" | "advisor")}
              className="col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm"
            >
              <option value="advisor">Adviser</option>
              <option value="manager">Manager</option>
            </select>
            <button
              type="button"
              onClick={addInvite}
              className="col-span-1 inline-flex items-center justify-center bg-primary text-white rounded-lg hover:bg-primary-dark"
              aria-label="Add invite"
            >
              <Plus size={16} />
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {4 - invites.length} more seat{invites.length === 3 ? "" : "s"} included on the base tier.
          </p>
        </div>
      )}

      {invites.length === 0 && (
        <p className="mb-5 text-sm text-gray-400">
          Skipping is fine — you can add team members later.
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
          onClick={handleNext}
          className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-primary-dark"
        >
          Continue
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
