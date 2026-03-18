import { clsx, type ClassValue } from "clsx";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");

  if (digits.startsWith("+44")) {
    const national = digits.slice(3);
    return `+44 ${national.slice(0, 4)} ${national.slice(4)}`.trim();
  }

  if (digits.startsWith("0")) {
    return `+44 ${digits.slice(1, 5)} ${digits.slice(5)}`.trim();
  }

  return phone;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy");
}

export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;

  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isPast(d)) return "Overdue";

  return formatDate(d);
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .join("")
    .slice(0, 2);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
