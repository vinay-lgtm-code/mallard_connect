"use client";

import { createContext, useContext, type ReactNode } from "react";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  primaryColor?: string;
  logoUrl?: string;
};

const TenantContext = createContext<Tenant | null>(null);

export function TenantProvider({ tenant, children }: { tenant: Tenant | null; children: ReactNode }) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}

export function useTenant(): Tenant | null {
  return useContext(TenantContext);
}
