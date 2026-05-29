-- Row Level Security policies
-- Supabase has "enforce RLS on all new tables" enabled at project level.

-- ============================================================
-- RLS helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION auth.tenant_id() RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.is_manager() RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'admin'),
    false
  );
$$ LANGUAGE sql STABLE;

-- ============================================================
-- Enable RLS on all tables
-- ============================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadences ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_records ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Tenant policies
-- ============================================================

CREATE POLICY tenant_read ON tenants
  FOR SELECT USING (id = auth.tenant_id() OR is_demo = true);
CREATE POLICY tenant_update ON tenants
  FOR UPDATE USING (id = auth.tenant_id() AND auth.is_manager());

-- ============================================================
-- Users: read own tenant, update own profile
-- ============================================================

CREATE POLICY users_select ON users
  FOR SELECT USING (tenant_id = auth.tenant_id());
CREATE POLICY users_update ON users
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- Lead sources: read all in tenant, managers can write
-- ============================================================

CREATE POLICY lead_sources_select ON lead_sources
  FOR SELECT USING (tenant_id = auth.tenant_id());
CREATE POLICY lead_sources_insert ON lead_sources
  FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() AND auth.is_manager());
CREATE POLICY lead_sources_update ON lead_sources
  FOR UPDATE USING (tenant_id = auth.tenant_id() AND auth.is_manager());
CREATE POLICY lead_sources_delete ON lead_sources
  FOR DELETE USING (tenant_id = auth.tenant_id() AND auth.is_manager());

-- ============================================================
-- Pipeline stages: read all in tenant, managers can write
-- ============================================================

CREATE POLICY stages_select ON pipeline_stages
  FOR SELECT USING (tenant_id = auth.tenant_id());
CREATE POLICY stages_insert ON pipeline_stages
  FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() AND auth.is_manager());
CREATE POLICY stages_update ON pipeline_stages
  FOR UPDATE USING (tenant_id = auth.tenant_id() AND auth.is_manager());
CREATE POLICY stages_delete ON pipeline_stages
  FOR DELETE USING (tenant_id = auth.tenant_id() AND auth.is_manager());

-- ============================================================
-- Leads: full CRUD for all tenant members
-- ============================================================

CREATE POLICY leads_select ON leads
  FOR SELECT USING (tenant_id = auth.tenant_id());
CREATE POLICY leads_insert ON leads
  FOR INSERT WITH CHECK (tenant_id = auth.tenant_id());
CREATE POLICY leads_update ON leads
  FOR UPDATE USING (tenant_id = auth.tenant_id());
CREATE POLICY leads_delete ON leads
  FOR DELETE USING (tenant_id = auth.tenant_id());

-- ============================================================
-- Activities: full CRUD for all tenant members
-- ============================================================

CREATE POLICY activities_select ON activities
  FOR SELECT USING (tenant_id = auth.tenant_id());
CREATE POLICY activities_insert ON activities
  FOR INSERT WITH CHECK (tenant_id = auth.tenant_id());
CREATE POLICY activities_update ON activities
  FOR UPDATE USING (tenant_id = auth.tenant_id());
CREATE POLICY activities_delete ON activities
  FOR DELETE USING (tenant_id = auth.tenant_id());

-- ============================================================
-- Tasks: full CRUD for all tenant members
-- ============================================================

CREATE POLICY tasks_select ON tasks
  FOR SELECT USING (tenant_id = auth.tenant_id());
CREATE POLICY tasks_insert ON tasks
  FOR INSERT WITH CHECK (tenant_id = auth.tenant_id());
CREATE POLICY tasks_update ON tasks
  FOR UPDATE USING (tenant_id = auth.tenant_id());
CREATE POLICY tasks_delete ON tasks
  FOR DELETE USING (tenant_id = auth.tenant_id());

-- ============================================================
-- Templates: read all in tenant, managers can write
-- ============================================================

CREATE POLICY templates_select ON templates
  FOR SELECT USING (tenant_id = auth.tenant_id());
CREATE POLICY templates_insert ON templates
  FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() AND auth.is_manager());
CREATE POLICY templates_update ON templates
  FOR UPDATE USING (tenant_id = auth.tenant_id() AND auth.is_manager());
CREATE POLICY templates_delete ON templates
  FOR DELETE USING (tenant_id = auth.tenant_id() AND auth.is_manager());

-- ============================================================
-- Cadences: read all in tenant, managers can write
-- ============================================================

CREATE POLICY cadences_select ON cadences
  FOR SELECT USING (tenant_id = auth.tenant_id());
CREATE POLICY cadences_insert ON cadences
  FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() AND auth.is_manager());
CREATE POLICY cadences_update ON cadences
  FOR UPDATE USING (tenant_id = auth.tenant_id() AND auth.is_manager());
CREATE POLICY cadences_delete ON cadences
  FOR DELETE USING (tenant_id = auth.tenant_id() AND auth.is_manager());

-- ============================================================
-- Cadence enrollments: full CRUD for all tenant members
-- ============================================================

CREATE POLICY enrollments_select ON cadence_enrollments
  FOR SELECT USING (tenant_id = auth.tenant_id());
CREATE POLICY enrollments_insert ON cadence_enrollments
  FOR INSERT WITH CHECK (tenant_id = auth.tenant_id());
CREATE POLICY enrollments_update ON cadence_enrollments
  FOR UPDATE USING (tenant_id = auth.tenant_id());
CREATE POLICY enrollments_delete ON cadence_enrollments
  FOR DELETE USING (tenant_id = auth.tenant_id());

-- ============================================================
-- Integrations: managers only
-- ============================================================

CREATE POLICY integrations_select ON integrations
  FOR SELECT USING (tenant_id = auth.tenant_id() AND auth.is_manager());
CREATE POLICY integrations_insert ON integrations
  FOR INSERT WITH CHECK (tenant_id = auth.tenant_id() AND auth.is_manager());
CREATE POLICY integrations_update ON integrations
  FOR UPDATE USING (tenant_id = auth.tenant_id() AND auth.is_manager());
CREATE POLICY integrations_delete ON integrations
  FOR DELETE USING (tenant_id = auth.tenant_id() AND auth.is_manager());

-- ============================================================
-- Notifications: user can read/update own, insert by tenant
-- ============================================================

CREATE POLICY notifications_select ON notifications
  FOR SELECT USING (tenant_id = auth.tenant_id() AND user_id = auth.uid());
CREATE POLICY notifications_update ON notifications
  FOR UPDATE USING (tenant_id = auth.tenant_id() AND user_id = auth.uid());
CREATE POLICY notifications_insert ON notifications
  FOR INSERT WITH CHECK (tenant_id = auth.tenant_id());

-- ============================================================
-- Import records: full CRUD for all tenant members
-- ============================================================

CREATE POLICY imports_select ON import_records
  FOR SELECT USING (tenant_id = auth.tenant_id());
CREATE POLICY imports_insert ON import_records
  FOR INSERT WITH CHECK (tenant_id = auth.tenant_id());
CREATE POLICY imports_update ON import_records
  FOR UPDATE USING (tenant_id = auth.tenant_id());

-- ============================================================
-- Demo access: unauthenticated users can read demo tenant data
-- ============================================================

CREATE POLICY demo_tenants_read ON tenants
  FOR SELECT TO anon USING (is_demo = true);
CREATE POLICY demo_leads_read ON leads
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = leads.tenant_id AND is_demo = true)
  );
CREATE POLICY demo_activities_read ON activities
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = activities.tenant_id AND is_demo = true)
  );
CREATE POLICY demo_tasks_read ON tasks
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = tasks.tenant_id AND is_demo = true)
  );
CREATE POLICY demo_users_read ON users
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = users.tenant_id AND is_demo = true)
  );
CREATE POLICY demo_stages_read ON pipeline_stages
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = pipeline_stages.tenant_id AND is_demo = true)
  );
CREATE POLICY demo_sources_read ON lead_sources
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = lead_sources.tenant_id AND is_demo = true)
  );
CREATE POLICY demo_cadences_read ON cadences
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = cadences.tenant_id AND is_demo = true)
  );
CREATE POLICY demo_templates_read ON templates
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = templates.tenant_id AND is_demo = true)
  );
CREATE POLICY demo_enrollments_read ON cadence_enrollments
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM tenants WHERE id = cadence_enrollments.tenant_id AND is_demo = true)
  );
