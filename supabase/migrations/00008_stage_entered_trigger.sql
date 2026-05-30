-- Keep current_stage_entered_at honest server-side.
--
-- Previously current_stage_entered_at was only set by the Kanban drag handler.
-- New leads (creation, CSV import, API) never set it, and the RAG/time-in-stage
-- fallback then used updated_at — which the leads_updated_at trigger bumps on
-- EVERY update, so any unrelated edit reset the stage clock to "Today".
--
-- This trigger stamps current_stage_entered_at:
--   - on INSERT, when it wasn't explicitly provided (covers creation/import/API)
--   - on UPDATE, only when current_stage_id actually changes (the real "moved
--     stage" event — drag, API, etc.)
-- It never touches the column on unrelated updates, so the clock is stable.

CREATE OR REPLACE FUNCTION set_stage_entered_at() RETURNS TRIGGER AS $func$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.current_stage_entered_at IS NULL)
     OR (NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id) THEN
    NEW.current_stage_entered_at := now();
  END IF;
  RETURN NEW;
END; $func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stage_entered_at ON leads;
CREATE TRIGGER trg_stage_entered_at BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_stage_entered_at();
