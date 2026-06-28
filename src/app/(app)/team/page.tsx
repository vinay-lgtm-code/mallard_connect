"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { useAuth } from "@/hooks/useAuth";
import { useTenantUsers } from "@/hooks/use-leads";
import { useLeads } from "@/hooks/use-leads";
import { getInitials } from "@/lib/utils";
import { hasCapability, roleLabel } from "@/lib/auth/roles";
import type { User, UserRole } from "@/types";

const ROLE_STYLES: Record<UserRole, string> = {
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  case_manager: "bg-teal-100 text-teal-700",
  advisor: "bg-page text-text-secondary",
};

export default function TeamPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !hasCapability(user.role, "manageTeam")) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const { users, loading: usersLoading } = useTenantUsers();
  const { leads, loading: leadsLoading } = useLeads({ status: "active" });

  const leadCountByUser = useMemo(() => {
    const map: Record<string, number> = {};
    for (const lead of leads) {
      if (lead.assignedTo) {
        map[lead.assignedTo] = (map[lead.assignedTo] ?? 0) + 1;
      }
    }
    return map;
  }, [leads]);

  if (!user || !hasCapability(user.role, "manageTeam")) return null;

  const loading = usersLoading || leadsLoading;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-text-primary">Team</h1>
        <Link
          href="/team/invite"
          className="inline-flex items-center justify-center gap-1.5 font-semibold text-sm rounded-[var(--radius-button)] transition-colors bg-accent text-white hover:bg-accent-light px-4 py-2.5"
        >
          <UserPlus size={15} />
          Invite Member
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-[12px] p-10 border border-border text-center">
          <p className="text-text-muted text-sm">No team members yet.</p>
        </div>
      ) : (
        <>
        <SectionLabel>Team Members</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((member) => {
            const activeLeads = leadCountByUser[member.id] ?? 0;
            return (
              <Link
                key={member.id}
                href={`/team/${member.id}`}
                className="bg-white rounded-[12px] p-5 border border-border hover:border-primary/30 transition-all block"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">
                      {getInitials(member.fullName)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-primary truncate">{member.fullName}</p>
                    <p className="text-xs text-text-secondary truncate mt-0.5">{member.email}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_STYLES[member.role]}`}>
                        {roleLabel(member.role)}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${member.isActive ? "bg-green-100 text-green-700" : "bg-page text-text-secondary"}`}>
                        {member.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border flex items-center gap-4 text-xs text-text-secondary">
                  <div>
                    <p className="font-semibold text-text-primary text-base">{activeLeads}</p>
                    <p>Active Leads</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
