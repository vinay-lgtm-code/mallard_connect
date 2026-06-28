import { cn } from "@/lib/utils";

const variants = {
  "due-today": "bg-amber-100 text-amber-800 border-amber-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
  new: "bg-primary/10 text-primary border-primary/20",
  planned: "bg-gray-100 text-gray-700 border-gray-200",
  completed: "bg-primary/10 text-primary border-primary/20",
} as const;

export function Badge({
  variant,
  children,
  className,
}: {
  variant: keyof typeof variants;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
