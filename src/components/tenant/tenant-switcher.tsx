"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useTenant } from "./tenant-provider";
import { resetDemoTenant, isValidDemoSlug } from "@/lib/demo/seed";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Banner shown at the top of the (app) layout when the user is in demo mode.
 * Surfaces the current tenant name, a reset action, and a switcher link.
 */
export function DemoBanner({ visible }: { visible: boolean }) {
  const tenant = useTenant();
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    if (!tenant?.slug || !isValidDemoSlug(tenant.slug)) return;
    if (!confirm(`Reset all demo data for ${tenant.name}? This wipes any edits and re-seeds the original fixtures.`)) return;
    setResetting(true);
    try {
      await resetDemoTenant(tenant.slug);
      window.location.reload();
    } catch (err) {
      console.error("Reset demo failed:", err);
      setResetting(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs">
      <div className="flex items-center gap-2 text-amber-900">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
        <span className="font-medium">Demo mode</span>
        <span className="text-amber-700">— viewing {tenant?.name ?? "Sequence"}</span>
      </div>
      <div className="flex items-center gap-3">
        {isSupabaseConfigured && tenant?.slug && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="inline-flex items-center gap-1 font-medium text-amber-900 hover:text-amber-950 disabled:opacity-60"
          >
            <RotateCcw size={11} />
            {resetting ? "Resetting..." : "Reset demo"}
          </button>
        )}
        <Link
          href="/demo"
          className="inline-flex items-center gap-1 font-medium text-amber-900 hover:text-amber-950"
        >
          Switch tenant
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

export function TenantSwitcher() {
  return null;
}
