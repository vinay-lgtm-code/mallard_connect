-- Sequence Admin-provisioned organization domains.
-- These records are managed by service-role APIs only; no client RLS policy
-- is exposed because provisioning is a platform-admin operation.

CREATE TYPE organization_provision_status AS ENUM ('provisioned', 'claimed', 'disabled');

CREATE TABLE organization_provisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  normalized_domain TEXT NOT NULL,
  company_name TEXT NOT NULL,
  org_poc_name TEXT NOT NULL,
  org_poc_email TEXT NOT NULL,
  normalized_org_poc_email TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  status organization_provision_status NOT NULL DEFAULT 'provisioned',
  claim_token_hash TEXT,
  claim_token_expires_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_by_email TEXT NOT NULL,
  updated_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_provisions_domain_check
    CHECK (normalized_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  CONSTRAINT organization_provisions_poc_domain_check
    CHECK (split_part(normalized_org_poc_email, '@', 2) = normalized_domain),
  CONSTRAINT organization_provisions_claim_consistency
    CHECK (
      (status = 'claimed' AND tenant_id IS NOT NULL AND claimed_at IS NOT NULL)
      OR status <> 'claimed'
    )
);

CREATE UNIQUE INDEX organization_provisions_active_domain_unique
  ON organization_provisions (normalized_domain)
  WHERE status IN ('provisioned', 'claimed');

CREATE UNIQUE INDEX organization_provisions_active_poc_unique
  ON organization_provisions (normalized_org_poc_email)
  WHERE status IN ('provisioned', 'claimed');

CREATE INDEX organization_provisions_tenant_idx
  ON organization_provisions (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE TRIGGER organization_provisions_updated_at BEFORE UPDATE ON organization_provisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE organization_provisions ENABLE ROW LEVEL SECURITY;
