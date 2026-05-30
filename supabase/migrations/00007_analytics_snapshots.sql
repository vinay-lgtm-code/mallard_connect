CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  period_month DATE NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_month)
);
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snap_read ON analytics_snapshots;
CREATE POLICY snap_read ON analytics_snapshots FOR SELECT USING (tenant_id = public.tenant_id());
DROP POLICY IF EXISTS snap_demo ON analytics_snapshots;
CREATE POLICY snap_demo ON analytics_snapshots FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM tenants WHERE id = analytics_snapshots.tenant_id AND is_demo = true));
