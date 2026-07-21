import assert from "node:assert/strict";
import test from "node:test";
import {
  isPendingTeamInviteConflict,
  pendingTeamInviteAction,
} from "../src/lib/team-invitations.ts";

test("creates an invitation when no pending invitation exists", () => {
  assert.equal(pendingTeamInviteAction(null), "create");
});

test("reuses an active pending invitation", () => {
  assert.equal(
    pendingTeamInviteAction(
      { id: "invite-1", expires_at: "2026-08-01T00:00:00.000Z" },
      Date.parse("2026-07-21T00:00:00.000Z"),
    ),
    "reuse",
  );
});

test("retires an expired pending invitation before creating a replacement", () => {
  assert.equal(
    pendingTeamInviteAction(
      { id: "invite-1", expires_at: "2026-07-01T00:00:00.000Z" },
      Date.parse("2026-07-21T00:00:00.000Z"),
    ),
    "expire-and-create",
  );
});

test("recognizes only the pending-email unique constraint", () => {
  assert.equal(
    isPendingTeamInviteConflict({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "team_invitations_pending_email_unique"',
    }),
    true,
  );
  assert.equal(
    isPendingTeamInviteConflict({
      code: "23505",
      message: 'duplicate key value violates unique constraint "team_invitations_token_hash_key"',
    }),
    false,
  );
  assert.equal(
    isPendingTeamInviteConflict({
      code: "23503",
      message: "foreign key violation",
    }),
    false,
  );
});
