-- Add progress column to initiatives table
ALTER TABLE initiatives ADD COLUMN progress INTEGER DEFAULT 0;
