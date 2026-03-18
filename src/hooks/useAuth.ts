"use client";

import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { User } from "@/types";
import { Timestamp } from "firebase/firestore";

const DEMO_USERS: Record<string, User> = {
  "demo-manager": {
    id: "demo-manager",
    email: "shankardivya100@gmail.com",
    fullName: "Della Sheridan",
    phone: "+44 114 000 0001",
    role: "manager",
    avatarUrl: null,
    isActive: true,
    createdAt: Timestamp.now(),
  },
  "demo-sales": {
    id: "demo-sales",
    email: "shankardivya100@gmail.com",
    fullName: "Alex Rivera",
    phone: "+44 114 000 0002",
    role: "advisor",
    avatarUrl: null,
    isActive: true,
    createdAt: Timestamp.now(),
  },
};

export function getDemoUser(): User | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem("mallard_demo_user");
  return id ? DEMO_USERS[id] ?? null : null;
}

export function setDemoUser(id: string) {
  localStorage.setItem("mallard_demo_user", id);
  document.cookie = `__session=demo-${id}; path=/; max-age=86400; SameSite=Lax`;
}

export function clearDemoUser() {
  localStorage.removeItem("mallard_demo_user");
  document.cookie = "__session=; path=/; max-age=0";
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshDemoUser = useCallback(() => {
    const demo = getDemoUser();
    if (demo) {
      setUser(demo);
      setLoading(false);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (refreshDemoUser()) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          setUser({ id: firebaseUser.uid, ...userDoc.data() } as User);
        } else {
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email ?? "",
            fullName: firebaseUser.displayName ?? "User",
            phone: null,
            role: "advisor",
            avatarUrl: null,
            isActive: true,
            createdAt: null as never,
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [refreshDemoUser]);

  return { user, loading };
}
