import { createHash, randomBytes } from "crypto";

export const TEAM_INVITE_TTL_DAYS = 14;

export function createInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteExpiry(): string {
  const expires = new Date();
  expires.setDate(expires.getDate() + TEAM_INVITE_TTL_DAYS);
  return expires.toISOString();
}
