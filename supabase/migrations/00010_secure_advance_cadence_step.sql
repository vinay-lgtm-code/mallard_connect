-- Security hardening for advance_cadence_step (see 00009).
--
-- The function was created SECURITY DEFINER, which bypasses RLS, and Postgres
-- grants EXECUTE to PUBLIC by default. That let any authenticated (or anon)
-- role call it via PostgREST (POST /rest/v1/rpc/advance_cadence_step) with an
-- arbitrary enrollment UUID and mutate cadence_enrollments across tenants —
-- a cross-tenant write IDOR, since the UPDATE is keyed only by id.
--
-- The function is only ever invoked by the cadence cron via the service-role
-- client, which bypasses RLS on its own. So we:
--   1. Switch to SECURITY INVOKER (least privilege — no RLS bypass baked in).
--   2. Revoke EXECUTE from PUBLIC/anon/authenticated so untrusted roles can't
--      reach it at all.
--   3. Grant EXECUTE only to service_role (the cron path).

ALTER FUNCTION advance_cadence_step(uuid, int, int, timestamptz, boolean)
  SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION advance_cadence_step(uuid, int, int, timestamptz, boolean)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION advance_cadence_step(uuid, int, int, timestamptz, boolean)
  TO service_role;
