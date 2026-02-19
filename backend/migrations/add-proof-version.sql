-- Migration: Add version column to proofs table for conflict resolution
-- Date: 2026-01-13
-- Description: Adds version field for optimistic concurrency control and conflict resolution

-- Add version column to proofs table with default value 1
ALTER TABLE proofs ADD COLUMN version INTEGER DEFAULT 1;

-- Update existing proofs to have version 1
UPDATE proofs SET version = 1 WHERE version IS NULL;

-- Create index for faster version lookups
CREATE INDEX IF NOT EXISTS idx_proofs_version ON proofs(version);