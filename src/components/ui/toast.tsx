"use client";

export function Toast({ message }: { message: string }) {
  return <div className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm">{message}</div>;
}
