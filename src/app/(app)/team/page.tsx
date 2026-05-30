"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTenantUsers } from "@/hooks/use-leads";
import { useLeads } from "@/hooks/use-leads";
import { getInitials } from "@/lib/utils";
import type { User, UserRole } from "@/types";

const ROLE_STYLES: Record<UserRole, string> = {
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  advisor: "bg-gray-100 text-gray-600",
};

export default function TeamPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role === "advisor") {
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

  if (!user || user.role === "advisor") return null;

  const loading = usersLoading || leadsLoading;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Team</h1>
        <Link
          href="/team/invite"
          className="flex items-center gap-1.5 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
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
        <div className="bg-white rounded-[12px] p-10 shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 text-sm">No team members yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((member) => {
            const activeLeads = leadCountByUser[member.id] ?? 0;
            return (
              <Link
                key={member.id}
                href={`/team/${member.id}`}
                className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all block"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">
                      {getInitials(member.fullName)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{member.fullName}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{member.email}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ROLE_STYLES[member.role]}`}>
                        {member.role}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${member.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {member.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
                  <div>
                    <p className="font-semibold text-gray-900 text-base">{activeLeads}</p>
                    <p>Active Leads</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
