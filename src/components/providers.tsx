"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { TenantProvider } from "@/components/tenant/tenant-provider";
import { useAuth } from "@/hooks/useAuth";

function TenantBridge({ children }: { children: React.ReactNode }) {
  const { tenant } = useAuth();
  return <TenantProvider tenant={tenant}>{children}</TenantProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TenantBridge>{children}</TenantBridge>
    </QueryClientProvider>
  );
}
