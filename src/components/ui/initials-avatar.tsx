import { getInitials } from "@/lib/utils";

export function InitialsAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = getInitials(name);
  const sizes = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-11 h-11 text-base",
  };
  return (
    <div
      className={`${sizes[size]} rounded-full bg-primary flex items-center justify-center flex-shrink-0`}
    >
      <span className="text-white font-bold">{initials}</span>
    </div>
  );
}
