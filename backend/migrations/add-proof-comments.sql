-- Migration: Add comment column to proofs table and update status values
-- Date: 2026-01-11
-- Description: Adds comment field for proof feedback and expands status options

-- Add comment column to proofs table
ALTER TABLE proofs ADD COLUMN comment TEXT;

-- Update existing proofs to have empty comments
UPDATE proofs SET comment = '' WHERE comment IS NULL;

-- Add verified_by column to track who approved/rejected the proof
ALTER TABLE proofs ADD COLUMN verified_by INTEGER REFERENCES profiles(id);

-- Add verified_at column
ALTER TABLE proofs ADD COLUMN verified_at DATETIME;

-- Update status values to be more descriptive
UPDATE proofs SET status = 'approved' WHERE status = 'pending' AND task_id IN (
  SELECT id FROM tasks WHERE completed = 1 AND proof_photo_url IS NULL
);

UPDATE proofs SET status = 'rejected' WHERE status = 'pending' AND task_id IN (
  SELECT id FROM tasks WHERE completed = 0 AND proof_photo_url IS NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_proofs_task_id ON proofs(task_id);
CREATE INDEX IF NOT EXISTS idx_proofs_status ON proofs(status);