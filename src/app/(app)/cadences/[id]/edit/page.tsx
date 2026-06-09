"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { useCadences } from "@/hooks/use-cadences";
import { isCadencesTemplatesEnabled } from "@/lib/feature-flags";
import { isDemoUser } from "@/lib/mock-data";
import { ComingSoon } from "@/components/coming-soon";
import { CadenceBuilder } from "@/components/cadences/cadence-builder";

export default function EditCadencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useSupabase();
  const { cadences } = useCadences();

  const cadence = useMemo(() => cadences.find((c) => c.id === id), [cadences, id]);

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

  if (!user) return null;

  if (!cadence) {
    return (
      <div className="px-6 py-8 max-w-5xl">
        <Link
          href="/cadences"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={14} /> Back to cadences
        </Link>
        <p className="mt-6 text-gray-500">Cadence not found.</p>
      </div>
    );
  }

  async function handleSubmit(data: {
    name: string;
    description?: string;
    trigger: { type: string; stageId?: string };
    steps: { delayDays: number; channel: string; templateId?: string; subject?: string; body?: string }[];
    isActive: boolean;
  }) {
    if (!supabase) return;
    setSaving(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/cadences/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Save failed (${res.status})`);
      }

      router.push(`/cadences/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save cadence.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-6 py-8 max-w-5xl">
      <Link
        href={`/cadences/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft size={14} /> Back to cadence
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Edit: {cadence.name}
      </h1>

      <CadenceBuilder
        initialData={{
          name: cadence.name,
          description: cadence.description,
          trigger: cadence.trigger,
          steps: cadence.steps,
          isActive: cadence.isActive,
        }}
        onSubmit={handleSubmit}
        isSubmitting={saving}
        isDemo={isDemoUser(user.id)}
      />

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
