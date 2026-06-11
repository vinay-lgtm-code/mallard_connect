"use client";

import { TenantProvider } from "@/components/tenant/tenant-provider";
import { useAuth } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/ui/toast";

function TenantBridge({ children }: { children: React.ReactNode }) {
  const { tenant } = useAuth();
  return <TenantProvider tenant={tenant}>{children}</TenantProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <TenantBridge>{children}</TenantBridge>
    </ToastProvider>
  );
}
