-- Tenant team invitations. Invitation records are created through service-role
-- APIs and accepted through token-bearing public endpoints.

CREATE TYPE team_invitation_status AS ENUM ('pending', 'accepted', 'cancelled', 'expired');

CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'advisor',
  token_hash TEXT NOT NULL UNIQUE,
  status team_invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES users(id),
  accepted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX team_invitations_pending_email_unique
  ON team_invitations (tenant_id, normalized_email)
  WHERE status = 'pending';

CREATE INDEX team_invitations_tenant_idx
  ON team_invitations (tenant_id, created_at DESC);

CREATE TRIGGER team_invitations_updated_at BEFORE UPDATE ON team_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
