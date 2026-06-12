"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  sticky: boolean;
}

interface ToastContextValue {
  toast: (message: string, opts?: { variant?: ToastVariant; sticky?: boolean }) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, opts?: { variant?: ToastVariant; sticky?: boolean }) => {
    const id = ++nextId;
    const variant = opts?.variant ?? "success";
    const sticky = opts?.sticky ?? variant === "error";

    setItems((prev) => [...prev, { id, message, variant, sticky }]);

    if (!sticky) {
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    }
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const variantStyles: Record<ToastVariant, string> = {
    success: "bg-gray-900 text-white",
    error: "bg-red-600 text-white",
    info: "bg-blue-600 text-white",
  };

  return (
    <ToastContext value={{ toast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
        {items.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 ${variantStyles[item.variant]}`}
          >
            <span>{item.message}</span>
            {item.sticky && (
              <button
                onClick={() => dismiss(item.id)}
                className="ml-1 opacity-70 hover:opacity-100 text-current"
                aria-label="Dismiss"
              >
                &times;
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
