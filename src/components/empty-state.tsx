"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-[12px] p-8 shadow-sm border border-gray-100 text-center">
      {Icon && (
        <div className="flex justify-center mb-4">
          <Icon className="text-gray-300" size={48} strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 mt-1.5 max-w-sm mx-auto">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          <Link
            href={action.href}
            className="inline-flex items-center justify-center bg-primary text-white font-semibold py-2.5 px-5 rounded-lg text-sm hover:bg-primary-dark transition-colors"
          >
            {action.label}
          </Link>
        </div>
      )}
    </div>
  );
}
