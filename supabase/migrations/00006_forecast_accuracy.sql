ALTER TABLE leads ADD COLUMN IF NOT EXISTS confidence_at_close INT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closed_outcome TEXT;
CREATE OR REPLACE FUNCTION capture_confidence_at_close() RETURNS TRIGGER AS $func$
BEGIN
  IF NEW.status IN ('converted','lost') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.confidence_at_close := NEW.confidence;
    NEW.closed_outcome := NEW.status;
  END IF;
  RETURN NEW;
END; $func$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_confidence_at_close ON leads;
CREATE TRIGGER trg_confidence_at_close BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION capture_confidence_at_close();
