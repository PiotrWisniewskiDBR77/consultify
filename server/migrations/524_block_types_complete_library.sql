-- Migration: 524_block_types_complete_library.sql
-- Populate report_builder_block_types with a complete, canonical list of all available blocks.
-- This makes the Block Library the single source of truth for the entire report system.
-- Date: 2026-02-07

-- ==========================================
-- 1. ADD CATEGORY COLUMN
-- ==========================================
-- SQLite: ALTER TABLE ADD COLUMN is safe to re-run only if column doesn't exist.
-- Migration runner should tolerate "duplicate column" errors.

DO $$
BEGIN
  ALTER TABLE report_builder_block_types ADD COLUMN category TEXT DEFAULT 'content';
EXCEPTION WHEN duplicate_column THEN
  -- noop
END $$;

-- Update existing blocks with category
UPDATE report_builder_block_types SET category = 'content'  WHERE id = 'consulting_takeaway';
UPDATE report_builder_block_types SET category = 'content'  WHERE id = 'consulting_implications';
UPDATE report_builder_block_types SET category = 'data'     WHERE id = 'consulting_decisions';
UPDATE report_builder_block_types SET category = 'data'     WHERE id = 'consulting_risks_register';
UPDATE report_builder_block_types SET category = 'data'     WHERE id = 'consulting_2x2';
UPDATE report_builder_block_types SET category = 'visual'   WHERE id = 'consulting_benchmark_bar';
UPDATE report_builder_block_types SET category = 'content'  WHERE id = 'consulting_roadmap';

-- ==========================================
-- 2. ADD DISPLAY ORDER COLUMN
-- ==========================================

DO $$
BEGIN
  ALTER TABLE report_builder_block_types ADD COLUMN display_order INTEGER DEFAULT 999;
EXCEPTION WHEN duplicate_column THEN
  -- noop
END $$;

-- Set order for existing consulting blocks (they go after the core blocks)
UPDATE report_builder_block_types SET display_order = 50 WHERE id = 'consulting_takeaway';
UPDATE report_builder_block_types SET display_order = 51 WHERE id = 'consulting_implications';
UPDATE report_builder_block_types SET display_order = 52 WHERE id = 'consulting_decisions';
UPDATE report_builder_block_types SET display_order = 53 WHERE id = 'consulting_risks_register';
UPDATE report_builder_block_types SET display_order = 54 WHERE id = 'consulting_2x2';
UPDATE report_builder_block_types SET display_order = 55 WHERE id = 'consulting_benchmark_bar';
UPDATE report_builder_block_types SET display_order = 56 WHERE id = 'consulting_roadmap';

-- ==========================================
-- 3. CONTENT BLOCKS
-- ==========================================

INSERT INTO report_builder_block_types (
  id, organization_id, name, description,
  source_types_json, render_kind, prompt_template, input_schema_json,
  default_length, default_language,
  is_system, is_active, category, display_order,
  created_at, updated_at
) VALUES
(
  'cover', NULL, 'Cover Page',
  'Title page with company name, date, report subtitle, and branding.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'markdown',
  'Generate a professional cover page. Include: report title, company name, assessment type, date, and a one-line subtitle that captures the key theme.',
  NULL, 'short', 'business', true, true, 'content', 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'summary', NULL, 'Executive Summary',
  'High-level overview of key findings, maturity level, and top recommendations.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'markdown',
  'Write a concise executive summary covering: overall maturity assessment, top 3-5 key findings, critical gaps, and high-priority recommendations. Use board-ready consulting language.',
  NULL, 'medium', 'business', true, true, 'content', 2,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'analysis', NULL, 'Detailed Analysis',
  'In-depth analysis of assessment results across all dimensions.',
  '["ASSESSMENT"]',
  'markdown',
  'Provide a detailed analysis of assessment results. Cover each dimension with current state, gaps, strengths, and areas for improvement. Use data-driven insights.',
  NULL, 'long', 'business', true, true, 'content', 3,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'recommendations', NULL, 'Recommendations',
  'Actionable, prioritized recommendations based on findings.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'markdown',
  'Provide strategic, actionable recommendations. Each should include: recommendation title, rationale, expected impact, priority (high/medium/low), timeline, and responsible stakeholder role.',
  NULL, 'medium', 'business', true, true, 'content', 4,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'methodology', NULL, 'Methodology',
  'Description of assessment methodology, scoring framework, and approach used.',
  '["ASSESSMENT"]',
  'markdown',
  'Describe the assessment methodology used: framework overview, scoring approach (scale, criteria), data collection methods, and any limitations or assumptions.',
  NULL, 'short', 'technical', true, true, 'content', 5,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'custom', NULL, 'Custom Section',
  'Free-form text section with custom content. Use for any bespoke narrative.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'markdown',
  'Write a section based on the provided context and any custom instructions. Maintain professional consulting tone.',
  NULL, 'medium', 'business', true, true, 'content', 6,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'quote', NULL, 'Key Quote',
  'Highlighted quote, key statement, or callout message for emphasis.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'callout',
  'Extract or compose one powerful, memorable quote or key statement that captures the essence of the findings. Keep it punchy and board-ready.',
  NULL, 'short', 'business', true, true, 'content', 7,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'context', NULL, 'Context / Company Profile',
  'Business context, scope, key assumptions, and organization background.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'markdown',
  'Describe the business context: company profile, industry, digital maturity journey, scope of assessment, and key assumptions or constraints.',
  NULL, 'medium', 'business', true, true, 'content', 8,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'axis_analysis', NULL, 'Axis / Topic Analysis',
  'Deep-dive analysis repeated per axis or topic. Used with repeatFor.',
  '["ASSESSMENT"]',
  'markdown',
  'Provide an in-depth analysis of this specific axis/topic. Cover: current maturity score, strengths, weaknesses, area-by-area breakdown, and targeted recommendations.',
  NULL, 'long', 'business', true, true, 'content', 9,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'action_plan', NULL, 'Action Plan / Next Steps',
  'Phased roadmap-style actions with owners, timelines, and milestones.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'markdown',
  'Create an action plan organized by timeframe (Now 0-3mo, Next 3-6mo, Later 6-12mo). Each action: title, description, owner role, dependencies, success criteria.',
  NULL, 'medium', 'business', true, true, 'content', 10,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'appendix', NULL, 'Appendix',
  'Additional details: scoring tables, methodology reference, glossary, evidence.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'markdown',
  'Generate appendix content: detailed scoring tables, methodology reference, glossary of terms, and supporting evidence or data tables.',
  NULL, 'long', 'technical', true, true, 'content', 11,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  source_types_json = EXCLUDED.source_types_json,
  render_kind = EXCLUDED.render_kind,
  prompt_template = EXCLUDED.prompt_template,
  input_schema_json = EXCLUDED.input_schema_json,
  default_length = EXCLUDED.default_length,
  default_language = EXCLUDED.default_language,
  is_system = EXCLUDED.is_system,
  is_active = EXCLUDED.is_active,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  updated_at = EXCLUDED.updated_at;

-- ==========================================
-- 4. DATA BLOCKS
-- ==========================================

INSERT INTO report_builder_block_types (
  id, organization_id, name, description,
  source_types_json, render_kind, prompt_template, input_schema_json,
  default_length, default_language,
  is_system, is_active, category, display_order,
  created_at, updated_at
) VALUES
(
  'matrix', NULL, 'Assessment Matrix',
  'Visual matrix showing maturity scores across axes and areas.',
  '["ASSESSMENT"]',
  'matrix',
  'Generate an assessment matrix visualization from the scores data. Present axes, areas, current scores, and target scores in a structured matrix format.',
  NULL, 'medium', 'business', true, true, 'data', 20,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'table', NULL, 'Data Table',
  'Structured data presented in table format with configurable columns.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'table',
  'Present the relevant data in a clear, structured table format. Include appropriate column headers and organize rows logically.',
  '{"type":"object","properties":{"columns":{"type":"array","items":{"type":"string"}}}}',
  'medium', 'business', true, true, 'data', 21,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'findings', NULL, 'Key Findings',
  'Numbered list of the most important findings from the analysis.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'markdown',
  'List the top key findings (5-10). Each finding should have a clear title, supporting evidence, and impact assessment. Rank by importance.',
  NULL, 'medium', 'business', true, true, 'data', 22,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'dashboard', NULL, 'Dashboard / Score Summary',
  'High-level scorecard with key metrics, overall scores, and critical gaps.',
  '["ASSESSMENT","TOOL"]',
  'json',
  'Create a dashboard summary with: overall maturity score, scores by dimension, top 3 gaps, top 3 strengths, and trend indicators. Format as structured data.',
  NULL, 'medium', 'business', true, true, 'data', 23,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'scorecard', NULL, 'Scorecard',
  'Structured summary of scores, targets, and gap analysis per dimension.',
  '["ASSESSMENT","TOOL"]',
  'table',
  'Create a scorecard table with columns: Dimension, Current Score, Target Score, Gap, Priority, and Status. Sort by gap size descending.',
  NULL, 'medium', 'business', true, true, 'data', 24,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'gap_analysis', NULL, 'Gap Analysis',
  'Comparison of current state vs target state with gap identification.',
  '["ASSESSMENT","TOOL"]',
  'table',
  'Perform a gap analysis. For each dimension: current maturity level, target level, gap size, root causes, and recommended actions to close the gap.',
  NULL, 'medium', 'business', true, true, 'data', 25,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  source_types_json = EXCLUDED.source_types_json,
  render_kind = EXCLUDED.render_kind,
  prompt_template = EXCLUDED.prompt_template,
  input_schema_json = EXCLUDED.input_schema_json,
  default_length = EXCLUDED.default_length,
  default_language = EXCLUDED.default_language,
  is_system = EXCLUDED.is_system,
  is_active = EXCLUDED.is_active,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  updated_at = EXCLUDED.updated_at;

-- ==========================================
-- 5. VISUAL BLOCKS
-- ==========================================

INSERT INTO report_builder_block_types (
  id, organization_id, name, description,
  source_types_json, render_kind, prompt_template, input_schema_json,
  default_length, default_language,
  is_system, is_active, category, display_order,
  created_at, updated_at
) VALUES
(
  'chart_bar', NULL, 'Bar Chart',
  'Bar chart visualization for comparing values across categories.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'chart',
  'Prepare data for a bar chart visualization. Provide: labels (categories), data series with values, and 2-3 insight bullets. Format as structured chart data.',
  '{"type":"object","properties":{"labels":{"type":"array","items":{"type":"string"}},"series":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"values":{"type":"array","items":{"type":"number"}}}}}}}',
  'short', 'business', true, true, 'visual', 30,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'chart_pie', NULL, 'Pie Chart',
  'Pie chart for showing proportional distribution of data.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'chart',
  'Prepare data for a pie chart visualization. Provide: segment labels, values (percentages), and 2-3 insight bullets about the distribution.',
  '{"type":"object","properties":{"labels":{"type":"array","items":{"type":"string"}},"values":{"type":"array","items":{"type":"number"}}}}',
  'short', 'business', true, true, 'visual', 31,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'image', NULL, 'Image / Diagram',
  'Placeholder for a custom image, diagram, or architecture visualization.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'json',
  'Describe the diagram or visual that should be placed here. Include: diagram type, key elements, relationships, and any labels or annotations needed.',
  NULL, 'short', 'business', true, true, 'visual', 32,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'roadmap', NULL, 'Roadmap',
  'Phased timeline with milestones, deliverables, and dependencies.',
  '["ASSESSMENT","INITIATIVE","TOOL"]',
  'markdown',
  'Create a visual roadmap with phases (Now / Next / Later or Q1-Q4). Each phase: key milestones, deliverables, owners, and dependencies. Keep it slide-ready.',
  NULL, 'medium', 'business', true, true, 'visual', 33,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'kpis', NULL, 'KPIs',
  'Key performance indicators to track progress and measure outcomes.',
  '["ASSESSMENT","INITIATIVE","TOOL"]',
  'table',
  'Define 5-8 KPIs to track transformation progress. Each KPI: name, current value, target value, measurement frequency, owner role, and status (on track / at risk / off track).',
  NULL, 'medium', 'business', true, true, 'visual', 34,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'risk', NULL, 'Risks',
  'Risk register with probability, impact assessment, and mitigation strategies.',
  '["ASSESSMENT","INITIATIVE","TOOL"]',
  'table',
  'Create a risk register (top 8-10 risks). Columns: Risk description, Category, Probability (Low/Med/High), Impact (Low/Med/High), Risk Score, Mitigation strategy, Owner role.',
  NULL, 'medium', 'business', true, true, 'visual', 35,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'prioritization', NULL, 'Prioritization',
  '2x2 matrix for prioritizing initiatives by impact vs effort.',
  '["ASSESSMENT","INITIATIVE","TOOL"]',
  'matrix',
  'Create a prioritization matrix (Impact vs Effort). Place 6-10 initiatives into four quadrants: Quick Wins, Major Projects, Fill-Ins, Thankless Tasks. Include brief rationale.',
  NULL, 'medium', 'business', true, true, 'visual', 36,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  source_types_json = EXCLUDED.source_types_json,
  render_kind = EXCLUDED.render_kind,
  prompt_template = EXCLUDED.prompt_template,
  input_schema_json = EXCLUDED.input_schema_json,
  default_length = EXCLUDED.default_length,
  default_language = EXCLUDED.default_language,
  is_system = EXCLUDED.is_system,
  is_active = EXCLUDED.is_active,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  updated_at = EXCLUDED.updated_at;

-- ==========================================
-- 6. INDEX ON CATEGORY + ORDER
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_rb_block_types_category ON report_builder_block_types(category);
CREATE INDEX IF NOT EXISTS idx_rb_block_types_order ON report_builder_block_types(display_order);
