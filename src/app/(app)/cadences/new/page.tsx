"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import { isCadencesTemplatesEnabled } from "@/lib/feature-flags";
import { ComingSoon } from "@/components/coming-soon";
import { CadenceBuilder } from "@/components/cadences/cadence-builder";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { isDemoUser } from "@/lib/mock-data";
import type { CadenceTrigger, CadenceStep } from "@/types";
import posthog from "posthog-js";

export default function NewCadencePage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useSupabase();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isCadencesTemplatesEnabled()) {
    return (
      <ComingSoon
        icon={Zap}
        title="Cadences"
        description="Automated multi-step nurture sequences that trigger on stage changes or manual enrollment. This feature is being finalized and will be available soon."
      />
    );
  }

  async function handleSubmit(data: {
    name: string;
    description?: string;
    trigger: CadenceTrigger;
    steps: CadenceStep[];
    isActive: boolean;
  }) {
    setSaving(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase!.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/cadences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create cadence");
      }

      posthog.capture("cadence_created", {
        trigger_type: data.trigger.type,
        step_count: data.steps.length,
        is_active: data.isActive,
      });
      router.push("/cadences");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create cadence"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-6 py-8 max-w-5xl">
      <Link
        href="/cadences"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-4"
      >
        <ArrowLeft size={14} /> Back to cadences
      </Link>

      <h1 className="text-2xl font-bold text-text-primary">New cadence</h1>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <CadenceBuilder
        onSubmit={handleSubmit}
        isSubmitting={saving}
        isDemo={user ? isDemoUser(user.id) : false}
      />
    </div>
  );
}
