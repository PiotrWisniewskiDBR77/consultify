-- Z-39 / DEC-508: make projects.current_phase part of the strict migration chain.
-- Source parity: server/src/database/PostgresDatabase.ts:1745-1765 (projects table self-heal).

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS current_phase text DEFAULT 'Context'::text;
