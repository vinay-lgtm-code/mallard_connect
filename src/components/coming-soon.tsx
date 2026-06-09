"use client";

import type { LucideIcon } from "lucide-react";

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function ComingSoon({ icon: Icon, title, description }: ComingSoonProps) {
  return (
    <div className="px-6 py-8 max-w-5xl">
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-5">
          <Icon size={28} className="text-amber-600" />
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 mb-4">
          Coming Soon
        </span>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-500 text-center max-w-md">{description}</p>
      </div>
    </div>
  );
}
