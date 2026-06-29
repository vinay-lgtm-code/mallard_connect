"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Building2 } from "lucide-react";
import { setDemoUser, setDemoTenant } from "@/hooks/useAuth";
import { seedDemoTenantIfNeeded } from "@/lib/demo/seed";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { DemoTenantSlug } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

type DemoTenant = {
  slug: DemoTenantSlug;
  name: string;
  ownerName: string;
  ownerInitials: string;
  ownerRole: string;
  ownerUserId: "demo-manager" | "demo-sales";
  swatch: string;
};

const TENANTS: DemoTenant[] = [
  {
    slug: "mallard",
    name: "Mallard Mortgages",
    ownerName: "Della Mallard",
    ownerInitials: "DM",
    ownerRole: "Owner / Manager",
    ownerUserId: "demo-manager",
    swatch: "bg-[#1A5653]",
  },
  {
    slug: "friends-capital",
    name: "Friends Capital",
    ownerName: "Charlotte Pemberton",
    ownerInitials: "CP",
    ownerRole: "Partner",
    ownerUserId: "demo-manager",
    swatch: "bg-[#0F172A]",
  },
  {
    slug: "acme",
    name: "Acme Mortgages",
    ownerName: "Sam Carter",
    ownerInitials: "SC",
    ownerRole: "Manager",
    ownerUserId: "demo-manager",
    swatch: "bg-[#7C3AED]",
  },
];

export default function DemoPage() {
  const router = useRouter();
  const [seeding, setSeeding] = useState<{ slug: string; persona: string } | null>(null);

  async function tryDemo(tenant: DemoTenant, persona: "demo-manager" | "demo-sales") {
    if (seeding) return;
    setSeeding({ slug: tenant.slug, persona });
    try {
      if (isSupabaseConfigured) {
        await seedDemoTenantIfNeeded(tenant.slug);
      }
    } catch (err) {
      console.error("Demo seed failed:", err);
    }
    setDemoTenant(tenant.slug);
    setDemoUser(persona);
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <span className="text-lg font-bold text-text-primary">Sequence</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-text-secondary hover:text-text-primary">
            Log in
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 sm:py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-primary mb-2">Live demo</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary">
            Pick a firm to step into
          </h1>
        </div>

        <div className="mt-10 grid lg:grid-cols-3 gap-5">
          {TENANTS.map((t) => (
            <div
              key={t.slug}
              className="bg-white border border-border rounded-[12px] p-6 flex flex-col hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-10 h-10 rounded-lg ${t.swatch} flex items-center justify-center`}>
                  <Building2 size={18} className="text-white" />
                </div>
                <h2 className="text-base font-bold text-text-primary leading-tight">{t.name}</h2>
              </div>

              <div className="border-t border-border pt-4 mb-4 flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{t.ownerInitials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{t.ownerName}</p>
                    <p className="text-xs text-text-secondary">{t.ownerRole}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => tryDemo(t, "demo-manager")}
                  variant="primary"
                  disabled={!!seeding}
                  className="w-full"
                >
                  {seeding?.slug === t.slug && seeding.persona === "demo-manager" ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Preparing demo...
                    </>
                  ) : (
                    <>
                      Try as owner
                      <ChevronRight size={14} />
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => tryDemo(t, "demo-sales")}
                  variant="secondary"
                  disabled={!!seeding}
                  className="w-full"
                >
                  {seeding?.slug === t.slug && seeding.persona === "demo-sales" ? "Preparing demo..." : "Try as adviser"}
                </Button>
              </div>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}
