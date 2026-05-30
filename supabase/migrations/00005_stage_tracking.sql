ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS expected_days INT;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS amber_pct INT NOT NULL DEFAULT 75;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_stage_entered_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS lead_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES pipeline_stages(id),
  stage_slug TEXT,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead ON lead_stage_history(lead_id);
ALTER TABLE lead_stage_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lsh_all ON lead_stage_history;
CREATE POLICY lsh_all ON lead_stage_history USING (tenant_id = public.tenant_id());
DROP POLICY IF EXISTS lsh_demo ON lead_stage_history;
CREATE POLICY lsh_demo ON lead_stage_history FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM tenants WHERE id = lead_stage_history.tenant_id AND is_demo = true));
UPDATE leads SET current_stage_entered_at = updated_at WHERE current_stage_entered_at IS NULL;
