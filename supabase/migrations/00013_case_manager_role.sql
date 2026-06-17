-- Add Case Manager as a first-class tenant role.
-- Keep this migration ahead of any app code that writes `case_manager`.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'case_manager';
