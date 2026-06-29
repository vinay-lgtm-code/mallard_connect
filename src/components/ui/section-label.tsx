export function SectionLabel({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "accent";
}) {
  return (
    <p
      className={`text-[11px] font-mono font-medium uppercase tracking-[0.12em] mb-2 ${
        variant === "accent" ? "text-accent" : "text-primary"
      }`}
    >
      {children}
    </p>
  );
}
