"use client";

import { useTenant } from "./tenant-provider";

export function TenantLogo({ className }: { className?: string }) {
  const tenant = useTenant();
  if (tenant?.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={tenant.logoUrl} alt={tenant.name} className={className} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/sequence-mark.svg" alt="Sequence" className={className} />;
}
