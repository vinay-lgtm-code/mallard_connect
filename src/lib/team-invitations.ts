export interface PendingTeamInvitation {
  id: string;
  expires_at: string;
}

export type PendingTeamInviteAction = "create" | "reuse" | "expire-and-create";

export function pendingTeamInviteAction(
  invite: PendingTeamInvitation | null,
  now = Date.now(),
): PendingTeamInviteAction {
  if (!invite) return "create";
  return new Date(invite.expires_at).getTime() <= now ? "expire-and-create" : "reuse";
}

export function isPendingTeamInviteConflict(error: {
  code?: string;
  details?: string;
  message?: string;
} | null): boolean {
  if (error?.code !== "23505") return false;

  const description = `${error.message ?? ""} ${error.details ?? ""}`;
  return description.includes("team_invitations_pending_email_unique");
}
