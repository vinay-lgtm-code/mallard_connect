"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Building2 } from "lucide-react";
import { setDemoUser, setDemoTenant } from "@/hooks/useAuth";
import { seedDemoTenantIfNeeded } from "@/lib/demo/seed";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { DemoTenantSlug } from "@/lib/mock-data";

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
      if (isFirebaseConfigured) {
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <span className="text-lg font-bold text-gray-900">Sequence</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900">
            Log in
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 sm:py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-primary mb-2">Live demo</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Pick a firm to step into
          </h1>
        </div>

        <div className="mt-10 grid lg:grid-cols-3 gap-5">
          {TENANTS.map((t) => (
            <div
              key={t.slug}
              className="bg-white border border-gray-200 rounded-[12px] p-6 flex flex-col hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-10 h-10 rounded-lg ${t.swatch} flex items-center justify-center`}>
                  <Building2 size={18} className="text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900 leading-tight">{t.name}</h2>
              </div>

              <div className="border-t border-gray-100 pt-4 mb-4 flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{t.ownerInitials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.ownerName}</p>
                    <p className="text-xs text-gray-500">{t.ownerRole}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => tryDemo(t, "demo-manager")}
                  disabled={!!seeding}
                  className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-60"
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
                </button>
                <button
                  onClick={() => tryDemo(t, "demo-sales")}
                  disabled={!!seeding}
                  className="w-full inline-flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  {seeding?.slug === t.slug && seeding.persona === "demo-sales" ? "Preparing demo..." : "Try as adviser"}
                </button>
              </div>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}
