-- Add 'assignment' to activity_type enum for lead reassignment tracking.
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'assignment';

-- Allow user deletion by updating foreign key constraints
-- that reference users(id) to use ON DELETE SET NULL or CASCADE.

-- leads.assigned_to → SET NULL (preserve lead, unassign)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey;
ALTER TABLE leads ADD CONSTRAINT leads_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- activities.performed_by → SET NULL (preserve activity history)
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_performed_by_fkey;
ALTER TABLE activities ADD CONSTRAINT activities_performed_by_fkey
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL;

-- tasks.assigned_to → SET NULL (preserve task, unassign)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- tasks.created_by → SET NULL (preserve task history)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- notifications.user_id → CASCADE (notifications are meaningless without user)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- import_records.uploaded_by → make nullable, then SET NULL
ALTER TABLE import_records ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE import_records DROP CONSTRAINT IF EXISTS import_records_uploaded_by_fkey;
ALTER TABLE import_records ADD CONSTRAINT import_records_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;
