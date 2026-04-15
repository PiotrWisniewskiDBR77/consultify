-- Migration: 549_initiative_status_history_columns.sql
-- Adds missing columns to initiative_status_history for tables created by 061_initiative_lifecycle
-- (which has changed_at only; 532 has full schema but CREATE TABLE IF NOT EXISTS skips when 061 ran first)
-- Date: 2026-02-18

-- Add organization_id (for WHERE filter; backfill from initiatives)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'initiative_status_history') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'initiative_status_history' AND column_name = 'organization_id') THEN
            ALTER TABLE initiative_status_history ADD COLUMN organization_id TEXT;
            UPDATE initiative_status_history h
            SET organization_id = i.organization_id
            FROM initiatives i
            WHERE h.initiative_id = i.id AND h.organization_id IS NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'initiative_status_history' AND column_name = 'gate_type') THEN
            ALTER TABLE initiative_status_history ADD COLUMN gate_type TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'initiative_status_history' AND column_name = 'created_at') THEN
            ALTER TABLE initiative_status_history ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'initiative_status_history' AND column_name = 'changed_at') THEN
                UPDATE initiative_status_history SET created_at = changed_at WHERE created_at IS NULL AND changed_at IS NOT NULL;
            END IF;
        END IF;
    END IF;
END $$;
