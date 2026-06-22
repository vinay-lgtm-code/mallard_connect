-- Document vault: per-lead file storage for mortgage case management.

CREATE TYPE document_category AS ENUM (
  'proof_of_id',
  'proof_of_address',
  'bank_statement',
  'payslip',
  'tax_return',
  'credit_report',
  'valuation',
  'mortgage_offer',
  'dip',
  'insurance',
  'other'
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  category document_category NOT NULL DEFAULT 'other',
  description TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_lead ON documents(tenant_id, lead_id);
CREATE INDEX idx_documents_category ON documents(tenant_id, category);

CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_select ON documents
  FOR SELECT USING (tenant_id = public.tenant_id());

CREATE POLICY documents_insert ON documents
  FOR INSERT WITH CHECK (tenant_id = public.tenant_id());

CREATE POLICY documents_update ON documents
  FOR UPDATE USING (tenant_id = public.tenant_id());

CREATE POLICY documents_delete ON documents
  FOR DELETE USING (tenant_id = public.tenant_id() AND public.is_manager());

-- Storage bucket for case documents. Supabase Storage RLS uses the same JWT.
-- Bucket creation and storage policies are applied via the Supabase dashboard
-- or supabase CLI; the SQL below documents the intended policy shape:
--
--   Bucket: case-documents (private)
--   Path convention: {tenant_id}/{lead_id}/{document_id}/{filename}
--
--   SELECT policy: (storage.foldername(name))[1]::uuid = public.tenant_id()
--   INSERT policy: (storage.foldername(name))[1]::uuid = public.tenant_id()
--   DELETE policy: (storage.foldername(name))[1]::uuid = public.tenant_id() AND public.is_manager()
