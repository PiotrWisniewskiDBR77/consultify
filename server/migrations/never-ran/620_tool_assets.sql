-- V3-E11: Tool assets tracking (thumbnails, micro-video, preview graphics)
-- Migration: 620_tool_assets.sql
-- Date: 2026-03-04
--
-- Tracks asset production status for each consulting tool.
-- Each tool needs: thumbnail, micro_video, preview_graphic.

-- ==========================================
-- TOOL ASSETS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS tool_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_slug VARCHAR(100) NOT NULL,
  asset_type VARCHAR(30) NOT NULL CHECK (asset_type IN ('thumbnail', 'micro_video', 'preview_graphic')),
  file_path VARCHAR(500),
  file_format VARCHAR(20),
  file_size_bytes INTEGER,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'missing' CHECK (status IN ('missing', 'draft', 'approved', 'published')),
  uploaded_by UUID,
  approved_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tool_slug, asset_type)
);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_tool_assets_slug ON tool_assets(tool_slug);

-- ==========================================
-- SEED: Placeholder rows for 31 tools × 3 asset types
-- status='missing', is_required=TRUE for thumbnail/preview_graphic,
-- is_required=FALSE for micro_video (R1 scope)
-- ==========================================

INSERT INTO tool_assets (tool_slug, asset_type, status, is_required) VALUES
  -- dynamic-swot
  ('dynamic-swot', 'thumbnail', 'missing', TRUE),
  ('dynamic-swot', 'micro_video', 'missing', FALSE),
  ('dynamic-swot', 'preview_graphic', 'missing', TRUE),
  -- market-forces
  ('market-forces', 'thumbnail', 'missing', TRUE),
  ('market-forces', 'micro_video', 'missing', FALSE),
  ('market-forces', 'preview_graphic', 'missing', TRUE),
  -- growth-paths
  ('growth-paths', 'thumbnail', 'missing', TRUE),
  ('growth-paths', 'micro_video', 'missing', FALSE),
  ('growth-paths', 'preview_graphic', 'missing', TRUE),
  -- value-chain
  ('value-chain', 'thumbnail', 'missing', TRUE),
  ('value-chain', 'micro_video', 'missing', FALSE),
  ('value-chain', 'preview_graphic', 'missing', TRUE),
  -- portfolio-priority
  ('portfolio-priority', 'thumbnail', 'missing', TRUE),
  ('portfolio-priority', 'micro_video', 'missing', FALSE),
  ('portfolio-priority', 'preview_graphic', 'missing', TRUE),
  -- risk-uncertainty
  ('risk-uncertainty', 'thumbnail', 'missing', TRUE),
  ('risk-uncertainty', 'micro_video', 'missing', FALSE),
  ('risk-uncertainty', 'preview_graphic', 'missing', TRUE),
  -- capability-mapper
  ('capability-mapper', 'thumbnail', 'missing', TRUE),
  ('capability-mapper', 'micro_video', 'missing', FALSE),
  ('capability-mapper', 'preview_graphic', 'missing', TRUE),
  -- ambition-decomposer
  ('ambition-decomposer', 'thumbnail', 'missing', TRUE),
  ('ambition-decomposer', 'micro_video', 'missing', FALSE),
  ('ambition-decomposer', 'preview_graphic', 'missing', TRUE),
  -- focus-tradeoff
  ('focus-tradeoff', 'thumbnail', 'missing', TRUE),
  ('focus-tradeoff', 'micro_video', 'missing', FALSE),
  ('focus-tradeoff', 'preview_graphic', 'missing', TRUE),
  -- narrative-engine
  ('narrative-engine', 'thumbnail', 'missing', TRUE),
  ('narrative-engine', 'micro_video', 'missing', FALSE),
  ('narrative-engine', 'preview_graphic', 'missing', TRUE),
  -- sop-builder
  ('sop-builder', 'thumbnail', 'missing', TRUE),
  ('sop-builder', 'micro_video', 'missing', FALSE),
  ('sop-builder', 'preview_graphic', 'missing', TRUE),
  -- a3-problem-solving
  ('a3-problem-solving', 'thumbnail', 'missing', TRUE),
  ('a3-problem-solving', 'micro_video', 'missing', FALSE),
  ('a3-problem-solving', 'preview_graphic', 'missing', TRUE),
  -- vsm-builder
  ('vsm-builder', 'thumbnail', 'missing', TRUE),
  ('vsm-builder', 'micro_video', 'missing', FALSE),
  ('vsm-builder', 'preview_graphic', 'missing', TRUE),
  -- constraint-control
  ('constraint-control', 'thumbnail', 'missing', TRUE),
  ('constraint-control', 'micro_video', 'missing', FALSE),
  ('constraint-control', 'preview_graphic', 'missing', TRUE),
  -- decision-engine
  ('decision-engine', 'thumbnail', 'missing', TRUE),
  ('decision-engine', 'micro_video', 'missing', FALSE),
  ('decision-engine', 'preview_graphic', 'missing', TRUE),
  -- control-tower
  ('control-tower', 'thumbnail', 'missing', TRUE),
  ('control-tower', 'micro_video', 'missing', FALSE),
  ('control-tower', 'preview_graphic', 'missing', TRUE),
  -- automation-pipeline
  ('automation-pipeline', 'thumbnail', 'missing', TRUE),
  ('automation-pipeline', 'micro_video', 'missing', FALSE),
  ('automation-pipeline', 'preview_graphic', 'missing', TRUE),
  -- smed-planner
  ('smed-planner', 'thumbnail', 'missing', TRUE),
  ('smed-planner', 'micro_video', 'missing', FALSE),
  ('smed-planner', 'preview_graphic', 'missing', TRUE),
  -- dms-builder
  ('dms-builder', 'thumbnail', 'missing', TRUE),
  ('dms-builder', 'micro_video', 'missing', FALSE),
  ('dms-builder', 'preview_graphic', 'missing', TRUE),
  -- inventory-autopilot
  ('inventory-autopilot', 'thumbnail', 'missing', TRUE),
  ('inventory-autopilot', 'micro_video', 'missing', FALSE),
  ('inventory-autopilot', 'preview_graphic', 'missing', TRUE),
  -- robotics-feasibility
  ('robotics-feasibility', 'thumbnail', 'missing', TRUE),
  ('robotics-feasibility', 'micro_video', 'missing', FALSE),
  ('robotics-feasibility', 'preview_graphic', 'missing', TRUE),
  -- logistics-automation
  ('logistics-automation', 'thumbnail', 'missing', TRUE),
  ('logistics-automation', 'micro_video', 'missing', FALSE),
  ('logistics-automation', 'preview_graphic', 'missing', TRUE),
  -- rpa-scanner
  ('rpa-scanner', 'thumbnail', 'missing', TRUE),
  ('rpa-scanner', 'micro_video', 'missing', FALSE),
  ('rpa-scanner', 'preview_graphic', 'missing', TRUE),
  -- ai-discovery
  ('ai-discovery', 'thumbnail', 'missing', TRUE),
  ('ai-discovery', 'micro_video', 'missing', FALSE),
  ('ai-discovery', 'preview_graphic', 'missing', TRUE),
  -- integration-diagnostic
  ('integration-diagnostic', 'thumbnail', 'missing', TRUE),
  ('integration-diagnostic', 'micro_video', 'missing', FALSE),
  ('integration-diagnostic', 'preview_graphic', 'missing', TRUE),
  -- digital-value-pool
  ('digital-value-pool', 'thumbnail', 'missing', TRUE),
  ('digital-value-pool', 'micro_video', 'missing', FALSE),
  ('digital-value-pool', 'preview_graphic', 'missing', TRUE),
  -- legacy-analyzer
  ('legacy-analyzer', 'thumbnail', 'missing', TRUE),
  ('legacy-analyzer', 'micro_video', 'missing', FALSE),
  ('legacy-analyzer', 'preview_graphic', 'missing', TRUE),
  -- data-inventory
  ('data-inventory', 'thumbnail', 'missing', TRUE),
  ('data-inventory', 'micro_video', 'missing', FALSE),
  ('data-inventory', 'preview_graphic', 'missing', TRUE),
  -- pain-to-solution
  ('pain-to-solution', 'thumbnail', 'missing', TRUE),
  ('pain-to-solution', 'micro_video', 'missing', FALSE),
  ('pain-to-solution', 'preview_graphic', 'missing', TRUE),
  -- pain-explorer
  ('pain-explorer', 'thumbnail', 'missing', TRUE),
  ('pain-explorer', 'micro_video', 'missing', FALSE),
  ('pain-explorer', 'preview_graphic', 'missing', TRUE),
  -- process-automation
  ('process-automation', 'thumbnail', 'missing', TRUE),
  ('process-automation', 'micro_video', 'missing', FALSE),
  ('process-automation', 'preview_graphic', 'missing', TRUE)
ON CONFLICT (tool_slug, asset_type) DO NOTHING;

-- ==========================================
-- MIGRATION COMPLETE
-- ==========================================
