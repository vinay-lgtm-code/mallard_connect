"use client";

import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase/client";
import type { User, Tenant } from "@/types";
import { Timestamp } from "firebase/firestore";

const DEMO_TENANT_ID = "mallard";
const DEMO_TENANT_KEY = "sequence_demo_tenant";

const DEMO_USERS: Record<string, User> = {
  "demo-manager": {
    id: "demo-manager",
    tenantId: DEMO_TENANT_ID,
    email: "shankardivya100@gmail.com",
    fullName: "Della Mallard",
    phone: "+44 114 000 0001",
    role: "manager",
    avatarUrl: null,
    isActive: true,
    createdAt: Timestamp.now(),
  },
  "demo-sales": {
    id: "demo-sales",
    tenantId: DEMO_TENANT_ID,
    email: "shankardivya100@gmail.com",
    fullName: "Alex Rivera",
    phone: "+44 114 000 0002",
    role: "advisor",
    avatarUrl: null,
    isActive: true,
    createdAt: Timestamp.now(),
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
    createdAt: Timestamp.now(),
  },
  "friends-capital": {
    id: "friends-capital",
    name: "Friends Capital",
    slug: "friends-capital",
    primaryColor: "#0F172A",
    plan: "growth",
    seatLimit: 10,
    createdAt: Timestamp.now(),
  },
  acme: {
    id: "acme",
    name: "Acme Mortgages",
    slug: "acme",
    primaryColor: "#7C3AED",
    plan: "base",
    seatLimit: 5,
    createdAt: Timestamp.now(),
  },
};

export function getDemoUser(): User | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem("mallard_demo_user");
  if (!id) return null;
  const user = DEMO_USERS[id];
  if (!user) return null;
  // Allow demo tenant override via /demo switcher
  const overrideTenantId = localStorage.getItem(DEMO_TENANT_KEY);
  if (overrideTenantId && DEMO_TENANTS[overrideTenantId]) {
    return { ...user, tenantId: overrideTenantId };
  }
  return user;
}

export function getDemoTenant(): Tenant | null {
  if (typeof window === "undefined") return null;
  const slug = localStorage.getItem(DEMO_TENANT_KEY) ?? DEMO_TENANT_ID;
  return DEMO_TENANTS[slug] ?? null;
}

export function setDemoTenant(slug: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_TENANT_KEY, slug);
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

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

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

    // Without Firebase config we can still serve marketing + demo routes;
    // just resolve loading=false with no signed-in user.
    if (!isFirebaseConfigured) {
      setUser(null);
      setTenant(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        let resolvedUser: User;
        if (userDoc.exists()) {
          resolvedUser = { id: firebaseUser.uid, ...userDoc.data() } as User;
        } else {
          resolvedUser = {
            id: firebaseUser.uid,
            tenantId: "",
            email: firebaseUser.email ?? "",
            fullName: firebaseUser.displayName ?? "User",
            phone: null,
            role: "advisor",
            avatarUrl: null,
            isActive: true,
            createdAt: null as never,
          };
        }
        setUser(resolvedUser);

        if (resolvedUser.tenantId) {
          const tenantDoc = await getDoc(doc(db, "tenants", resolvedUser.tenantId));
          if (tenantDoc.exists()) {
            setTenant({ id: tenantDoc.id, ...tenantDoc.data() } as Tenant);
          } else {
            setTenant(null);
          }
        } else {
          setTenant(null);
        }
      } else {
        setUser(null);
        setTenant(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [refreshDemoUser]);

  return { user, tenant, loading };
}
