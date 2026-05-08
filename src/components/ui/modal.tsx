"use client";

import type { ReactNode } from "react";

export function Modal({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">{children}</div>;
}
