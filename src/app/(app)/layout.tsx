"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  GitBranch,
  Users,
  Upload,
  Settings,
  Search,
  ChevronDown,
  BarChart3,
  UserPlus,
  Plus,
  Zap,
  FileText,
  TrendingUp,
} from "lucide-react";
import { useAuth, clearDemoUser, getDemoUser } from "@/hooks/useAuth";
import { NotificationDropdown } from "@/components/notifications";
import { DemoBanner } from "@/components/tenant/tenant-switcher";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch, adminOnly: false },
  { href: "/leads", label: "Leads", icon: Users, adminOnly: false },
  { href: "/cadences", label: "Cadences", icon: Zap, adminOnly: false },
  { href: "/templates", label: "Templates", icon: FileText, adminOnly: true },
  { href: "/team", label: "Team", icon: UserPlus, adminOnly: true },
  { href: "/reports", label: "Reports", icon: BarChart3, adminOnly: true },
  { href: "/reports/forecast", label: "Forecast", icon: TrendingUp, adminOnly: true },
  { href: "/import", label: "Import", icon: Upload, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: false },
];

// Order matters: more specific prefixes must come before their parents so the
// startsWith lookup below resolves the correct title (e.g. /reports/forecast).
const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pipeline": "Pipeline",
  "/leads": "Leads",
  "/cadences": "Cadences",
  "/templates": "Templates",
  "/team": "Team",
  "/reports/forecast": "Pipeline Forecast",
  "/reports": "Reports",
  "/import": "Import",
  "/capture": "Quick Capture",
  "/settings": "Settings",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, needsOnboarding } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (needsOnboarding) {
      router.push("/onboarding");
    }
  }, [user, loading, needsOnboarding, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user.role === "admin" || user.role === "manager"
  );

  // Active nav = the longest href that prefixes the current path, so nested
  // routes (e.g. /reports/forecast) don't also light up their parent (/reports).
  const activeHref = visibleNavItems
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const pageTitle =
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ?? "Sequence";

  async function handleSignOut() {
    if (getDemoUser()) {
      clearDemoUser();
    } else {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/login");
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar flex-shrink-0">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">S</span>
          </div>
          <span className="text-white font-bold text-base">Sequence</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary-light text-white"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{getInitials(user.fullName)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{user.fullName}</p>
              <p className="text-white/50 text-xs capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <DemoBanner visible={!!getDemoUser()} />
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 h-14 flex-shrink-0">
          <h1 className="text-lg font-bold text-gray-900">{pageTitle}</h1>

          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <Search size={18} />
            </button>
            <NotificationDropdown />

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-gray-100"
              >
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{getInitials(user.fullName)}</span>
                </div>
                <ChevronDown size={14} className="text-gray-500" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.fullName}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/settings"
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-gray-50"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile FAB for quick capture */}
      <Link
        href="/capture"
        className="md:hidden fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-accent shadow-lg flex items-center justify-center"
      >
        <Plus size={24} className="text-white" />
      </Link>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 flex">
        {visibleNavItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = activeHref === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                active ? "text-primary" : "text-gray-400"
              }`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
