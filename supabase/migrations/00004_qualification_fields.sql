-- Add qualification fields that exist in the UI but were never persisted.
-- These are core fact-find data for mortgage advising.

CREATE TYPE employment_type AS ENUM ('employed', 'self-employed', 'contractor', 'retired', 'other');
CREATE TYPE credit_score_band AS ENUM ('excellent', 'good', 'fair', 'poor', 'unknown');

ALTER TABLE leads
  ADD COLUMN employment_type employment_type,
  ADD COLUMN self_employed_years INT CHECK (self_employed_years >= 0),
  ADD COLUMN annual_income NUMERIC,
  ADD COLUMN credit_score_band credit_score_band,
  ADD COLUMN has_ccjs BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN has_defaults BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN has_iva BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_first_time_buyer BOOLEAN;
