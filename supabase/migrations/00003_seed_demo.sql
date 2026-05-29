-- Seed demo tenants and default data for Mallard pilot.
-- Run via service role (bypasses RLS).

-- ============================================================
-- Demo tenants
-- ============================================================

INSERT INTO tenants (id, name, slug, primary_color, plan, seat_limit, is_demo) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Mallard Mortgages', 'mallard', '#1A5653', 'base', 5, true),
  ('00000000-0000-0000-0000-000000000002', 'Friends Capital', 'friends-capital', '#0F172A', 'growth', 10, true),
  ('00000000-0000-0000-0000-000000000003', 'Acme Mortgages', 'acme', '#7C3AED', 'base', 5, true);

-- ============================================================
-- Default pipeline stages (same for all tenants)
-- ============================================================

INSERT INTO pipeline_stages (tenant_id, name, slug, position, color, is_terminal) VALUES
  ('00000000-0000-0000-0000-000000000001', 'New Enquiry', 'new_enquiry', 0, '#6366f1', false),
  ('00000000-0000-0000-0000-000000000001', 'Initial Contact', 'initial_contact', 1, '#3b82f6', false),
  ('00000000-0000-0000-0000-000000000001', 'Not Ready Yet', 'not_ready_yet', 2, '#f59e0b', false),
  ('00000000-0000-0000-0000-000000000001', 'Nurturing', 'nurturing', 3, '#22c55e', false),
  ('00000000-0000-0000-0000-000000000001', 'Ready to Proceed', 'ready_to_proceed', 4, '#2563eb', false),
  ('00000000-0000-0000-0000-000000000001', 'Referred to MAB', 'referred_to_mab', 5, '#a855f7', true);

-- Friends Capital stages
INSERT INTO pipeline_stages (tenant_id, name, slug, position, color, is_terminal) VALUES
  ('00000000-0000-0000-0000-000000000002', 'New Enquiry', 'new_enquiry', 0, '#6366f1', false),
  ('00000000-0000-0000-0000-000000000002', 'Initial Contact', 'initial_contact', 1, '#3b82f6', false),
  ('00000000-0000-0000-0000-000000000002', 'Not Ready Yet', 'not_ready_yet', 2, '#f59e0b', false),
  ('00000000-0000-0000-0000-000000000002', 'Nurturing', 'nurturing', 3, '#22c55e', false),
  ('00000000-0000-0000-0000-000000000002', 'Ready to Proceed', 'ready_to_proceed', 4, '#2563eb', false),
  ('00000000-0000-0000-0000-000000000002', 'Referred to MAB', 'referred_to_mab', 5, '#a855f7', true);

-- Acme stages
INSERT INTO pipeline_stages (tenant_id, name, slug, position, color, is_terminal) VALUES
  ('00000000-0000-0000-0000-000000000003', 'New Enquiry', 'new_enquiry', 0, '#6366f1', false),
  ('00000000-0000-0000-0000-000000000003', 'Initial Contact', 'initial_contact', 1, '#3b82f6', false),
  ('00000000-0000-0000-0000-000000000003', 'Not Ready Yet', 'not_ready_yet', 2, '#f59e0b', false),
  ('00000000-0000-0000-0000-000000000003', 'Nurturing', 'nurturing', 3, '#22c55e', false),
  ('00000000-0000-0000-0000-000000000003', 'Ready to Proceed', 'ready_to_proceed', 4, '#2563eb', false),
  ('00000000-0000-0000-0000-000000000003', 'Referred to MAB', 'referred_to_mab', 5, '#a855f7', true);

-- ============================================================
-- Lead sources (based on Mallard's actual spreadsheet)
-- ============================================================

INSERT INTO lead_sources (tenant_id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'TikTok', 'tiktok'),
  ('00000000-0000-0000-0000-000000000001', 'Facebook', 'facebook'),
  ('00000000-0000-0000-0000-000000000001', 'Instagram', 'instagram'),
  ('00000000-0000-0000-0000-000000000001', 'BNI', 'bni'),
  ('00000000-0000-0000-0000-000000000001', 'Google', 'google'),
  ('00000000-0000-0000-0000-000000000001', 'Website', 'website'),
  ('00000000-0000-0000-0000-000000000001', 'Referral', 'referral'),
  ('00000000-0000-0000-0000-000000000001', 'Phone', 'phone'),
  ('00000000-0000-0000-0000-000000000001', 'Walk-in', 'walk-in'),
  ('00000000-0000-0000-0000-000000000001', 'MAB Import', 'mab-import');

-- Friends Capital sources
INSERT INTO lead_sources (tenant_id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Referral', 'referral'),
  ('00000000-0000-0000-0000-000000000002', 'Website', 'website'),
  ('00000000-0000-0000-0000-000000000002', 'Phone', 'phone'),
  ('00000000-0000-0000-0000-000000000002', 'Networking', 'networking'),
  ('00000000-0000-0000-0000-000000000002', 'Social Media', 'social');

-- Acme sources
INSERT INTO lead_sources (tenant_id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000003', 'Website', 'website'),
  ('00000000-0000-0000-0000-000000000003', 'Referral', 'referral'),
  ('00000000-0000-0000-0000-000000000003', 'Phone', 'phone'),
  ('00000000-0000-0000-0000-000000000003', 'Walk-in', 'walk-in'),
  ('00000000-0000-0000-0000-000000000003', 'Social Media', 'social'),
  ('00000000-0000-0000-0000-000000000003', 'MAB Import', 'mab-import');
