-- Migration 011: Initiative Generator Support
-- Adds tables for draft initiatives, assessment-initiative links, and enhanced initiative tracking

-- Table for storing draft initiatives before approval
CREATE TABLE IF NOT EXISTS initiative_drafts (
    assessment_id TEXT NOT NULL,
    initiatives_json TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (assessment_id)
);

-- Table for linking initiatives to their source assessments
CREATE TABLE IF NOT EXISTS assessment_initiatives (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    assessment_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    source_axis TEXT,
    gap_size REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assessment_id, initiative_id)
);

-- Add columns to maturity_assessments for initiative tracking
ALTER TABLE maturity_assessments ADD COLUMN initiatives_generated INTEGER DEFAULT 0;
ALTER TABLE maturity_assessments ADD COLUMN initiatives_generated_at DATETIME;
ALTER TABLE maturity_assessments ADD COLUMN initiatives_count INTEGER DEFAULT 0;

-- Add columns to initiatives for enhanced tracking
ALTER TABLE initiatives ADD COLUMN created_from TEXT;
ALTER TABLE initiatives ADD COLUMN created_by TEXT;
ALTER TABLE initiatives ADD COLUMN estimated_roi REAL;
ALTER TABLE initiatives ADD COLUMN estimated_budget REAL;
ALTER TABLE initiatives ADD COLUMN timeline TEXT;
ALTER TABLE initiatives ADD COLUMN risk_level TEXT;
ALTER TABLE initiatives ADD COLUMN ai_generated INTEGER DEFAULT 0;
ALTER TABLE initiatives ADD COLUMN source_assessment_id TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_initiative_drafts_updated 
    ON initiative_drafts(updated_at);

CREATE INDEX IF NOT EXISTS idx_assessment_initiatives_assessment 
    ON assessment_initiatives(assessment_id);

CREATE INDEX IF NOT EXISTS idx_assessment_initiatives_initiative 
    ON assessment_initiatives(initiative_id);

CREATE INDEX IF NOT EXISTS idx_initiatives_source_assessment 
    ON initiatives(source_assessment_id);

CREATE INDEX IF NOT EXISTS idx_initiatives_created_from 
    ON initiatives(created_from);

