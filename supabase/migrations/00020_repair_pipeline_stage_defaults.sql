-- Repair existing tenants whose pipeline stages predate the stage rename rollout.
-- This is intentionally idempotent so it can be run after partial/manual repairs.

INSERT INTO pipeline_stages (tenant_id, name, slug, position, color, is_terminal, amber_pct)
SELECT
  tenants.id,
  'Decision in Principle done',
  'decision_in_principle_done',
  4,
  '#14b8a6',
  false,
  75
FROM tenants
WHERE NOT EXISTS (
  SELECT 1
  FROM pipeline_stages existing
  WHERE existing.tenant_id = tenants.id
    AND existing.slug = 'decision_in_principle_done'
);

UPDATE pipeline_stages
SET name = 'Not proceeded.',
    position = 2,
    color = COALESCE(color, '#f59e0b'),
    is_terminal = false
WHERE slug = 'not_ready_yet';

UPDATE pipeline_stages
SET name = 'Nurturing',
    position = 3,
    is_terminal = false
WHERE slug = 'nurturing';

UPDATE pipeline_stages
SET name = 'Decision in Principle done',
    position = 4,
    color = '#14b8a6',
    is_terminal = false
WHERE slug = 'decision_in_principle_done';

UPDATE pipeline_stages stage
SET slug = 'ready_to_proceed'
WHERE slug = 'offer_accepted'
  AND NOT EXISTS (
    SELECT 1
    FROM pipeline_stages existing
    WHERE existing.tenant_id = stage.tenant_id
      AND existing.slug = 'ready_to_proceed'
  );

UPDATE pipeline_stages
SET name = 'Ready to proceed',
    position = 5,
    color = COALESCE(color, '#2563eb'),
    is_terminal = false
WHERE slug = 'ready_to_proceed';

UPDATE pipeline_stages
SET name = 'Deal Done',
    position = 6,
    is_terminal = true
WHERE slug = 'referred_to_mab';

WITH custom_positions AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY tenant_id ORDER BY position, name, id) AS rn
  FROM pipeline_stages
  WHERE slug NOT IN (
    'new_enquiry',
    'initial_contact',
    'not_ready_yet',
    'nurturing',
    'decision_in_principle_done',
    'ready_to_proceed',
    'referred_to_mab'
  )
)
UPDATE pipeline_stages stage
SET position = 6 + custom_positions.rn
FROM custom_positions
WHERE stage.id = custom_positions.id;
