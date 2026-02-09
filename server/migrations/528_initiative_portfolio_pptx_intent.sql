-- Migration: 528_initiative_portfolio_pptx_intent.sql
-- Adds initiative_portfolio + prioritization_matrix PPTX intents.
--
-- WHY: New PPTX v2 pipeline layouts for initiative cards and
-- prioritization matrices need dedicated slide intents rather than
-- falling back to 'assessment' or 'appendix'.
--
-- WHAT:
--   1. Update prioritization block to use 'prioritization_matrix' intent
--   2. Update consulting_2x2 block to use 'prioritization_matrix' intent
--   3. Insert 'initiatives' block type with 'initiative_portfolio' intent
--
-- Date: 2026-02-08

-- ==========================================
-- 1. UPDATE EXISTING: prioritization → prioritization_matrix
-- ==========================================

UPDATE report_builder_block_types SET
  slide_intent = 'prioritization_matrix',
  pptx_prompt_template = 'Generate a JSON object for a prioritization matrix slide.

Return ONLY valid JSON:
{
  "type": "prioritization_matrix",
  "quadrants": [
    {
      "label": "Quick Wins",
      "position": "top_left",
      "items": [{"name": "<initiative>", "description": "<1 sentence>"}]
    },
    {
      "label": "Major Projects",
      "position": "top_right",
      "items": [{"name": "<initiative>", "description": "<1 sentence>"}]
    },
    {
      "label": "Fill-ins",
      "position": "bottom_left",
      "items": [{"name": "<initiative>", "description": "<1 sentence>"}]
    },
    {
      "label": "Reconsider",
      "position": "bottom_right",
      "items": [{"name": "<initiative>", "description": "<1 sentence>"}]
    }
  ],
  "xAxisLabel": "Effort",
  "yAxisLabel": "Impact"
}

Rules: max 5 items per quadrant. Place initiatives based on actual assessment data.
Context: {{assessment}}, {{axisData}}, {{companyContext}}.',
  pptx_output_schema = '{"type":"object","required":["type","quadrants","xAxisLabel","yAxisLabel"],"properties":{"type":{"const":"prioritization_matrix"},"quadrants":{"type":"array","minItems":4,"maxItems":4},"xAxisLabel":{"type":"string"},"yAxisLabel":{"type":"string"}}}'
WHERE id = 'prioritization';

-- consulting_2x2 → prioritization_matrix
UPDATE report_builder_block_types SET
  slide_intent = 'prioritization_matrix',
  pptx_prompt_template = 'Generate a JSON for 2x2 prioritization matrix. Return ONLY valid JSON: {"type":"prioritization_matrix","quadrants":[{"label":"Quick Wins","position":"top_left","items":[{"name":"<item>"}]},{"label":"Major Projects","position":"top_right","items":[{"name":"<item>"}]},{"label":"Fill-ins","position":"bottom_left","items":[{"name":"<item>"}]},{"label":"Reconsider","position":"bottom_right","items":[{"name":"<item>"}]}],"xAxisLabel":"Effort","yAxisLabel":"Impact"}.',
  pptx_output_schema = '{"type":"object","required":["type","quadrants"]}'
WHERE id = 'consulting_2x2';

-- ==========================================
-- 2. NEW BLOCK: initiatives → initiative_portfolio
-- ==========================================

INSERT OR IGNORE INTO report_builder_block_types (
  id, organization_id, name, description,
  source_types_json, render_kind, prompt_template,
  input_schema_json, default_length, default_language,
  is_system, is_active, category, display_order,
  slide_intent, pptx_prompt_template, pptx_output_schema,
  created_at, updated_at
) VALUES (
  'initiatives', NULL, 'Initiative Portfolio',
  'Strategic initiative cards with impact, effort, timeline, and effort profiles.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'initiatives',
  'Generate a structured set of digital transformation initiatives based on assessment findings. Return JSON with initiative details including name, summary, strategic intent, priority, impact, effort, budget, ROI, timeline, and owner.',
  NULL, 'long', 'business', 1, 1, 'visual', 30,
  'initiative_portfolio',
  'Generate a JSON object for an initiative portfolio slide.

Return ONLY valid JSON:
{
  "type": "initiative_portfolio",
  "initiatives": [
    {
      "name": "<initiative name, concise and actionable>",
      "summary": "<1-2 sentence description>",
      "strategicIntent": "Grow|Fix|Stabilize|De-risk|Build Capability",
      "strategicRole": "Foundation|Enabler|Accelerator|Scaling",
      "priority": "critical|high|medium|low",
      "timeline": "<e.g. 0-3 months>",
      "impact": 4,
      "effort": 3,
      "effortProfile": {"analytical": 3, "operational": 4, "change": 2},
      "budget": "<e.g. $50k-100k>",
      "roi": "<e.g. 3-5x>",
      "owner": "<responsible role>",
      "relatedGap": "<gap from assessment>",
      "relatedAxis": "<assessment axis>",
      "tags": ["<tag1>", "<tag2>"]
    }
  ]
}

Rules: 4-8 initiatives. Mix of strategic intents and roles. Sort by priority.
Impact and effort are 1-5 integers. Include a mix of timelines.
Context: {{assessment}}, {{axisData}}, {{companyContext}}.',
  '{"type":"object","required":["type","initiatives"],"properties":{"type":{"const":"initiative_portfolio"},"initiatives":{"type":"array","minItems":1,"maxItems":12,"items":{"type":"object","required":["name","priority","impact","effort"],"properties":{"name":{"type":"string"},"summary":{"type":"string"},"strategicIntent":{"type":"string"},"strategicRole":{"type":"string"},"priority":{"enum":["critical","high","medium","low"]},"timeline":{"type":"string"},"impact":{"type":"integer","minimum":1,"maximum":5},"effort":{"type":"integer","minimum":1,"maximum":5},"effortProfile":{"type":"object"},"budget":{"type":"string"},"roi":{"type":"string"},"owner":{"type":"string"},"relatedGap":{"type":"string"},"relatedAxis":{"type":"string"},"tags":{"type":"array","items":{"type":"string"}}}}}}}',
  datetime('now'), datetime('now')
);
