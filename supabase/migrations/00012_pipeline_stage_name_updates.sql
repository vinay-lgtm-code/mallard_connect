-- Update pipeline stage names and insert the new DIP stage for existing tenants.

UPDATE pipeline_stages
SET name = 'Not proceeded.',
    position = 2
WHERE slug = 'not_ready_yet';

UPDATE pipeline_stages
SET position = 3
WHERE slug = 'nurturing';

INSERT INTO pipeline_stages (tenant_id, name, slug, position, color, is_terminal)
SELECT DISTINCT tenant_id, 'Decision in Principle done', 'decision_in_principle_done', 4, '#14b8a6', false
FROM pipeline_stages existing
WHERE NOT EXISTS (
  SELECT 1
  FROM pipeline_stages dip
  WHERE dip.tenant_id = existing.tenant_id
    AND dip.slug = 'decision_in_principle_done'
);

UPDATE pipeline_stages
SET name = 'Decision in Principle done',
    position = 4,
    color = COALESCE(color, '#14b8a6'),
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
    position = 5
WHERE slug = 'ready_to_proceed'
   OR slug = 'offer_accepted'
   OR lower(name) = 'offer accepted';

UPDATE lead_stage_history
SET stage_slug = 'ready_to_proceed'
WHERE stage_slug = 'offer_accepted';

UPDATE pipeline_stages
SET position = 6
WHERE slug = 'referred_to_mab';
