"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { rowToApp } from "@/lib/supabase/mappers";
import { getMockUsers } from "@/lib/mock-data";
import type { User, Tenant } from "@/types";

const DEMO_TENANT_ID = "mallard";
const DEMO_TENANT_KEY = "sequence_demo_tenant";

const now = new Date().toISOString();

const DEMO_USERS: Record<string, User> = {
  "demo-manager": {
    id: "demo-manager",
    tenantId: DEMO_TENANT_ID,
    email: "della@mallardmortgages.co.uk",
    fullName: "Della Mallard",
    phone: "+44 114 000 0001",
    role: "manager",
    avatarUrl: null,
    isActive: true,
    createdAt: now,
  },
  "demo-sales": {
    id: "demo-sales",
    tenantId: DEMO_TENANT_ID,
    email: "alex@mallardmortgages.co.uk",
    fullName: "Alex Rivera",
    phone: "+44 114 000 0002",
    role: "advisor",
    avatarUrl: null,
    isActive: true,
    createdAt: now,
  },
};

const DEMO_TENANTS: Record<string, Tenant> = {
  mallard: {
    id: "mallard",
    name: "Mallard Mortgages",
    slug: "mallard",
    primaryColor: "#1A5653",
    plan: "base",
    seatLimit: 5,
    createdAt: now,
  },
  "friends-capital": {
    id: "friends-capital",
    name: "Friends Capital",
    slug: "friends-capital",
    primaryColor: "#0F172A",
    plan: "growth",
    seatLimit: 10,
    createdAt: now,
  },
  acme: {
    id: "acme",
    name: "Acme Mortgages",
    slug: "acme",
    primaryColor: "#7C3AED",
    plan: "base",
    seatLimit: 5,
    createdAt: now,
  },
};

export function getDemoUser(): User | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem("mallard_demo_user");
  if (!id) return null;
  const overrideTenantId = localStorage.getItem(DEMO_TENANT_KEY);
  const slug = overrideTenantId && DEMO_TENANTS[overrideTenantId] ? overrideTenantId : DEMO_TENANT_ID;
  const tenantUsers = getMockUsers();
  const persona = id === "demo-manager" ? "manager" : "advisor";
  const tenantUser = tenantUsers.find((u) => u.role === persona);
  if (tenantUser) return { ...tenantUser, tenantId: slug };
  const fallback = DEMO_USERS[id];
  if (!fallback) return null;
  return { ...fallback, tenantId: slug };
}

export function getDemoTenant(): Tenant | null {
  if (typeof window === "undefined") return null;
  const slug = localStorage.getItem(DEMO_TENANT_KEY) ?? DEMO_TENANT_ID;
  return DEMO_TENANTS[slug] ?? null;
}

export function setDemoTenant(slug: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_TENANT_KEY, slug);
  window.dispatchEvent(new Event("demo-tenant-changed"));
}

export function setDemoUser(id: string) {
  localStorage.setItem("mallard_demo_user", id);
  document.cookie = `__session=demo-${id}; path=/; max-age=86400; SameSite=Lax`;
}

export function clearDemoUser() {
  localStorage.removeItem("mallard_demo_user");
  localStorage.removeItem(DEMO_TENANT_KEY);
  document.cookie = "__session=; path=/; max-age=0";
}

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("mallard_demo_user");
}

function subscribeToDemoChanges(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("demo-tenant-changed", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("demo-tenant-changed", cb);
  };
}
function getDemoSnapshot() {
  return localStorage.getItem(DEMO_TENANT_KEY) + "|" + localStorage.getItem("mallard_demo_user");
}
const serverSnapshot = "";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const demoKey = useSyncExternalStore(subscribeToDemoChanges, getDemoSnapshot, () => serverSnapshot);

  const refreshDemoUser = useCallback(() => {
    const demo = getDemoUser();
    if (demo) {
      setUser(demo);
      setTenant(getDemoTenant());
      setLoading(false);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (refreshDemoUser()) return;

    if (!isSupabaseConfigured) {
      setUser(null);
      setTenant(null);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!authUser) {
        setUser(null);
        setTenant(null);
        setLoading(false);
        return;
      }

      let { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      // If the profile query returned nothing but the user has a tenant_id in
      // app_metadata, the JWT is stale (missing tenant_id the RLS policy needs).
      // Force a session refresh so subsequent queries use a JWT that includes
      // the tenant_id claim set during onboarding.
      if (!profile && authUser.app_metadata?.tenant_id) {
        await supabase.auth.refreshSession();
        const retry = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();
        profile = retry.data;
      }

      if (profile) {
        const resolvedUser = rowToApp<User>(profile);
        setUser({ ...resolvedUser, id: authUser.id });

        if (resolvedUser.tenantId) {
          const { data: tenantRow } = await supabase
            .from("tenants")
            .select("*")
            .eq("id", resolvedUser.tenantId)
            .single();
          setTenant(tenantRow ? rowToApp<Tenant>(tenantRow) : null);
        }
      } else {
        setUser({
          id: authUser.id,
          tenantId: (authUser.app_metadata?.tenant_id as string) ?? "",
          email: authUser.email ?? "",
          fullName: (authUser.user_metadata?.full_name as string) ?? "User",
          phone: null,
          role: "advisor",
          avatarUrl: null,
          isActive: true,
          createdAt: authUser.created_at,
        });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT") {
          setUser(null);
          setTenant(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [refreshDemoUser, demoKey]);

  const needsOnboarding = !loading && !!user && !user.tenantId;

  return { user, tenant, loading, needsOnboarding };
}
