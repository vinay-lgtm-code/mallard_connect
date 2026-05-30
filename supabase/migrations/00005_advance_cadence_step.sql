-- Atomic cadence step advancement with optimistic locking.
-- Prevents duplicate email sends on crash and concurrent cron overlap.

CREATE OR REPLACE FUNCTION advance_cadence_step(
  p_enrollment_id UUID,
  p_expected_step INT,
  p_next_step INT,
  p_next_run_at TIMESTAMPTZ DEFAULT NULL,
  p_is_completed BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INT;
BEGIN
  IF p_is_completed THEN
    UPDATE cadence_enrollments
    SET status       = 'completed',
        completed_at = now(),
        next_run_at  = NULL
    WHERE id           = p_enrollment_id
      AND current_step = p_expected_step
      AND status       = 'active';
  ELSE
    UPDATE cadence_enrollments
    SET current_step = p_next_step,
        next_run_at  = p_next_run_at
    WHERE id           = p_enrollment_id
      AND current_step = p_expected_step
      AND status       = 'active';
  END IF;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;
