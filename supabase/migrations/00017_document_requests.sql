-- Document upload requests: adviser sends a token-authenticated link to a lead
-- so they can upload documents without logging in.

CREATE TYPE document_request_status AS ENUM ('pending', 'completed', 'expired', 'cancelled');

CREATE TABLE document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  lead_email TEXT NOT NULL,
  requested_categories document_category[] NOT NULL,
  message TEXT,
  status document_request_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_requests_tenant ON document_requests(tenant_id);
CREATE INDEX idx_document_requests_lead ON document_requests(tenant_id, lead_id);
CREATE INDEX idx_document_requests_token ON document_requests(token_hash);

CREATE TRIGGER document_requests_updated_at BEFORE UPDATE ON document_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_requests_select ON document_requests
  FOR SELECT USING (tenant_id = public.tenant_id());

CREATE POLICY document_requests_insert ON document_requests
  FOR INSERT WITH CHECK (tenant_id = public.tenant_id());

CREATE POLICY document_requests_update ON document_requests
  FOR UPDATE USING (tenant_id = public.tenant_id());
