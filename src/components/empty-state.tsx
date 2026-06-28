"use client";

import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  illustration?: boolean;
  action?: {
    label: string;
    href: string;
  };
  onAction?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, illustration, action, onAction }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-[12px] p-8 border border-border text-center">
      {illustration && (
        <div className="flex justify-center">
          <Image src="/sequence-owl-icon.png" alt="" width={48} height={48} className="opacity-60 mb-2" />
        </div>
      )}
      {Icon && !illustration && (
        <div className="flex justify-center mb-4">
          <Icon className="text-text-muted" size={48} strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary mt-1.5 max-w-sm mx-auto">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          <Link href={action.href}>
            <Button variant="primary">
              {action.label}
            </Button>
          </Link>
        </div>
      )}
      {onAction && (
        <div className="mt-5">
          <Button variant="primary" onClick={onAction.onClick}>
            {onAction.label}
          </Button>
        </div>
      )}
    </div>
  );
}
