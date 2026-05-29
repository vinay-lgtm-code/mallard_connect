-- Sequence — initial Postgres schema
-- Supabase project region: eu-west-2 (London) for UK data residency

-- ============================================================
-- Enums
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'advisor');
CREATE TYPE mortgage_type AS ENUM ('first-time-buyer', 'purchase', 'remortgage', 'self-employed', 'buy-to-let', 'other');
CREATE TYPE readiness AS ENUM ('ready-now', '1-3-months', '3-6-months', '6-12-months', 'exploring');
CREATE TYPE lead_status AS ENUM ('active', 'on-hold', 'lost', 'converted');
CREATE TYPE dip_status AS ENUM ('not-started', 'pending', 'done', 'declined');
CREATE TYPE activity_type AS ENUM ('call', 'email', 'meeting', 'note', 'sms', 'whatsapp', 'stage-change');
CREATE TYPE task_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('pending', 'snoozed', 'completed', 'cancelled');
CREATE TYPE tenant_plan AS ENUM ('trial', 'base', 'growth');
CREATE TYPE cadence_trigger_type AS ENUM ('stage_entered', 'manual', 'lead_created');
CREATE TYPE cadence_channel AS ENUM ('email', 'sms', 'task', 'reminder');
CREATE TYPE enrollment_status AS ENUM ('active', 'paused', 'completed', 'unsubscribed');
CREATE TYPE template_channel AS ENUM ('email', 'sms');
CREATE TYPE integration_provider AS ENUM ('brevo', 'mab', 'other');
CREATE TYPE integration_status AS ENUM ('connected', 'disconnected', 'error');
CREATE TYPE import_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  primary_color TEXT,
  logo_url TEXT,
  plan tenant_plan NOT NULL DEFAULT 'trial',
  seat_limit INT NOT NULL DEFAULT 5,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'advisor',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  position INT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  source_id UUID REFERENCES lead_sources(id),
  status lead_status NOT NULL DEFAULT 'active',
  current_stage_id UUID REFERENCES pipeline_stages(id),
  assigned_to UUID REFERENCES users(id),
  mortgage_type mortgage_type,
  readiness readiness,
  property_value NUMERIC,
  deposit_amount NUMERIC,
  loan_amount NUMERIC,
  deal_value NUMERIC,
  estimated_close_date DATE,
  confidence INT CHECK (confidence >= 0 AND confidence <= 100),

  -- Mortgage pipeline milestones (from Mallard's workflow)
  fact_find_date DATE,
  dip_status dip_status NOT NULL DEFAULT 'not-started',
  dip_date DATE,
  application_submitted_date DATE,
  offer_date DATE,
  completion_date DATE,

  next_follow_up_date TIMESTAMPTZ,
  follow_up_reason TEXT,
  follow_up_notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  referred_by TEXT,
  import_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  lost_reason TEXT
);

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  performed_by UUID REFERENCES users(id),
  activity_type activity_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  priority task_priority NOT NULL DEFAULT 'normal',
  status task_status NOT NULL DEFAULT 'pending',
  reminder_emails TEXT[] NOT NULL DEFAULT '{}',
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  channel template_channel NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cadences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  trigger JSONB NOT NULL,
  steps JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cadence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  cadence_id UUID NOT NULL REFERENCES cadences(id),
  current_step INT NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ,
  status enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  provider integration_provider NOT NULL,
  api_key_encrypted TEXT,
  list_id TEXT,
  status integration_status NOT NULL DEFAULT 'disconnected',
  last_sync_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE (tenant_id, provider)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE import_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  file_name TEXT NOT NULL,
  column_mapping JSONB NOT NULL DEFAULT '{}',
  stats JSONB NOT NULL DEFAULT '{"total":0,"imported":0,"skipped":0,"failed":0}',
  status import_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_lead_sources_tenant ON lead_sources(tenant_id);
CREATE INDEX idx_leads_tenant ON leads(tenant_id);
CREATE INDEX idx_leads_tenant_stage ON leads(tenant_id, current_stage_id);
CREATE INDEX idx_leads_tenant_assigned ON leads(tenant_id, assigned_to);
CREATE INDEX idx_leads_tenant_status ON leads(tenant_id, status);
CREATE INDEX idx_leads_tenant_dip ON leads(tenant_id, dip_status) WHERE dip_status != 'not-started';
CREATE INDEX idx_activities_lead ON activities(lead_id);
CREATE INDEX idx_activities_tenant_created ON activities(tenant_id, created_at DESC);
CREATE INDEX idx_tasks_tenant_assigned_due ON tasks(tenant_id, assigned_to, due_date);
CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);
CREATE INDEX idx_enrollments_lead ON cadence_enrollments(lead_id);
CREATE INDEX idx_enrollments_next_run ON cadence_enrollments(next_run_at) WHERE status = 'active';
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER cadences_updated_at BEFORE UPDATE ON cadences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
