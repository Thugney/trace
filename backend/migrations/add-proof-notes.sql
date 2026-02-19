-- Migration: Add proof_notes column to proofs table
-- Date: 2026-01-13
-- Description: Adds proof_notes field for parent review notes (separate from verification comments)

-- Add proof_notes column to proofs table
ALTER TABLE proofs ADD COLUMN proof_notes TEXT;

-- Update existing proofs to have empty notes
UPDATE proofs SET proof_notes = '' WHERE proof_notes IS NULL;

-- Create index for faster lookups on notes (optional)
CREATE INDEX IF NOT EXISTS idx_proofs_notes ON proofs(proof_notes) WHERE proof_notes != '';