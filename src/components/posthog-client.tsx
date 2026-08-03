"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { useAuth } from "@/hooks/useAuth";

let initialized = false;

export function ensurePostHogInitialized() {
  if (initialized) return true;

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!token || !host) {
    if (process.env.NODE_ENV !== "production") {
      const missingVariable = !token
        ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"
        : "NEXT_PUBLIC_POSTHOG_HOST";
      throw new Error(
        `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
      );
    }
    return false;
  }

  posthog.init(token, {
    api_host: host,
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
  initialized = true;
  return true;
}

export function PostHogClient() {
  const { user, loading } = useAuth();
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    ensurePostHogInitialized();
  }, []);

  useEffect(() => {
    if (!initialized || loading) return;

    if (!user) {
      if (identifiedUserId.current) {
        posthog.reset();
        identifiedUserId.current = null;
      }
      return;
    }

    if (identifiedUserId.current && identifiedUserId.current !== user.id) {
      posthog.reset();
    }

    posthog.identify(user.id, {
      email: user.email,
      name: user.fullName,
      role: user.role,
      tenant_id: user.tenantId,
    });
    identifiedUserId.current = user.id;
  }, [user, loading]);

  return null;
}
