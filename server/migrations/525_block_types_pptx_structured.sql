-- Migration: 525_block_types_pptx_structured.sql
-- Extends block types with PPTX-specific structured JSON prompts.
--
-- WHY: The PPTX v2 pipeline needs structured JSON output per intent,
-- but existing blocks generate markdown. Adding pptx_prompt_template
-- preserves markdown generation for PDF/DOCX/editor while enabling
-- structured JSON for PPTX slides.
--
-- WHAT:
--   1. Add pptx_prompt_template + pptx_output_schema columns
--   2. Add slide_intent column (explicit intent mapping per block)
--   3. Update 17 existing blocks with PPTX prompts + intent mappings
--   4. Insert 5 new blocks for missing intents
--
-- Date: 2026-02-07

-- ==========================================
-- 1. NEW COLUMNS
-- ==========================================

DO $$
BEGIN
  ALTER TABLE report_builder_block_types ADD COLUMN slide_intent TEXT;
EXCEPTION WHEN duplicate_column THEN
  -- noop
END $$;
DO $$
BEGIN
  ALTER TABLE report_builder_block_types ADD COLUMN pptx_prompt_template TEXT;
EXCEPTION WHEN duplicate_column THEN
  -- noop
END $$;
DO $$
BEGIN
  ALTER TABLE report_builder_block_types ADD COLUMN pptx_output_schema TEXT;
EXCEPTION WHEN duplicate_column THEN
  -- noop
END $$;

-- ==========================================
-- 2. CONTENT BLOCKS — PPTX prompts + intent
-- ==========================================

-- Cover
UPDATE report_builder_block_types SET
  slide_intent = 'cover',
  pptx_prompt_template = 'Generate a JSON object for the cover slide.

Return ONLY valid JSON:
{
  "type": "cover",
  "title": "<report title>",
  "subtitle": "<one-line theme that captures the key finding>",
  "organization": "<company name>",
  "date": "<formatted date>"
}

Use context: {{report.title}}, {{companyContext.name}}, {{assessment.framework}}.',
  pptx_output_schema = '{"type":"object","required":["type","title","organization","date"],"properties":{"type":{"const":"cover"},"title":{"type":"string"},"subtitle":{"type":"string"},"organization":{"type":"string"},"date":{"type":"string"}}}'
WHERE id = 'cover';

-- Executive Summary
UPDATE report_builder_block_types SET
  slide_intent = 'executive_summary',
  pptx_prompt_template = 'Generate a JSON object for the executive summary slide.

Return ONLY valid JSON:
{
  "type": "executive_summary",
  "headline": "<one sentence board-level headline, max 14 words>",
  "kpis": [
    {"name": "<metric name>", "value": <number>, "unit": "<% or /7 etc>", "trend": "up|down|flat", "status": "good|warning|critical"}
  ],
  "key_findings": [
    "<finding 1 — one sentence>",
    "<finding 2>",
    "<finding 3>"
  ],
  "recommendation": "<single most important recommendation>"
}

Rules: max 5 key_findings, max 4 kpis. Use board-ready consulting language.
Context: {{assessment}}, {{companyContext}}, {{axisData}}.',
  pptx_output_schema = '{"type":"object","required":["type","headline","key_findings"],"properties":{"type":{"const":"executive_summary"},"headline":{"type":"string","maxLength":120},"kpis":{"type":"array","maxItems":4},"key_findings":{"type":"array","maxItems":5,"items":{"type":"string"}},"recommendation":{"type":"string"}}}'
WHERE id = 'summary';

-- Detailed Analysis → appendix (deep-dive content)
UPDATE report_builder_block_types SET
  slide_intent = 'appendix',
  pptx_prompt_template = 'Generate a JSON object for a detailed analysis appendix slide.

Return ONLY valid JSON:
{
  "type": "appendix",
  "title": "Detailed Analysis",
  "body": "<2-3 paragraph analysis text, plain text no markdown>",
  "tables": [
    {"headers": ["Dimension","Score","Finding"], "rows": [["<dim>","<score>","<finding>"]]}
  ],
  "footnotes": ["Source: {{assessment.framework}} assessment"]
}

Context: {{assessment}}, {{axisData}}.',
  pptx_output_schema = '{"type":"object","required":["type","title","body"],"properties":{"type":{"const":"appendix"},"title":{"type":"string"},"body":{"type":"string"},"tables":{"type":"array"},"footnotes":{"type":"array","items":{"type":"string"}}}}'
WHERE id = 'analysis';

-- Recommendations
UPDATE report_builder_block_types SET
  slide_intent = 'recommendation_portfolio',
  pptx_prompt_template = 'Generate a JSON object for the recommendations slide.

Return ONLY valid JSON:
{
  "type": "recommendation_portfolio",
  "recommendations": [
    {
      "title": "<recommendation title>",
      "description": "<one sentence description>",
      "impact": "<expected impact, e.g. +15% OEE>",
      "priority": "critical|high|medium|low",
      "category": "<e.g. Process, Technology, People>"
    }
  ]
}

Rules: 3-8 recommendations. Sort by priority (critical first). Each title max 10 words.
Context: {{assessment}}, {{axisData}}, {{companyContext}}.',
  pptx_output_schema = '{"type":"object","required":["type","recommendations"],"properties":{"type":{"const":"recommendation_portfolio"},"recommendations":{"type":"array","minItems":1,"maxItems":8,"items":{"type":"object","required":["title","description","impact","priority"],"properties":{"title":{"type":"string"},"description":{"type":"string"},"impact":{"type":"string"},"priority":{"enum":["critical","high","medium","low"]},"category":{"type":"string"}}}}}}'
WHERE id = 'recommendations';

-- Methodology → section_intro
UPDATE report_builder_block_types SET
  slide_intent = 'section_intro',
  pptx_prompt_template = 'Generate a JSON object for a methodology section intro slide.

Return ONLY valid JSON:
{
  "type": "section_intro",
  "section_title": "Methodology",
  "section_number": null,
  "description": "<2-3 sentence overview of the assessment methodology>"
}

Context: {{assessment.framework}}.',
  pptx_output_schema = '{"type":"object","required":["type","section_title"],"properties":{"type":{"const":"section_intro"},"section_title":{"type":"string"},"section_number":{"type":"number"},"description":{"type":"string"}}}'
WHERE id = 'methodology';

-- Custom Section → appendix
UPDATE report_builder_block_types SET
  slide_intent = 'appendix',
  pptx_prompt_template = 'Generate a JSON object for a custom content slide.

Return ONLY valid JSON:
{
  "type": "appendix",
  "title": "{{section.title}}",
  "body": "<content as plain text, no markdown>",
  "footnotes": []
}

Context: {{section.customPrompt}}, {{companyContext}}.',
  pptx_output_schema = '{"type":"object","required":["type","title","body"],"properties":{"type":{"const":"appendix"},"title":{"type":"string"},"body":{"type":"string"},"footnotes":{"type":"array"}}}'
WHERE id = 'custom';

-- Key Quote → key_messages
UPDATE report_builder_block_types SET
  slide_intent = 'key_messages',
  pptx_prompt_template = 'Generate a JSON object for a key messages slide.

Return ONLY valid JSON:
{
  "type": "key_messages",
  "messages": [
    {"title": "<key message headline>", "description": "<supporting detail>", "icon": "◆"}
  ]
}

Rules: 1-3 messages. Each title max 8 words. Description max 2 sentences.
Context: {{assessment}}, {{companyContext}}.',
  pptx_output_schema = '{"type":"object","required":["type","messages"],"properties":{"type":{"const":"key_messages"},"messages":{"type":"array","minItems":1,"maxItems":4,"items":{"type":"object","required":["title","description"],"properties":{"title":{"type":"string"},"description":{"type":"string"},"icon":{"type":"string"}}}}}}'
WHERE id = 'quote';

-- Context / Company Profile → section_intro
UPDATE report_builder_block_types SET
  slide_intent = 'section_intro',
  pptx_prompt_template = 'Generate a JSON object for a context/company profile slide.

Return ONLY valid JSON:
{
  "type": "section_intro",
  "section_title": "Company Profile",
  "description": "<2-3 sentence company context overview>"
}

Context: {{companyContext}}.',
  pptx_output_schema = '{"type":"object","required":["type","section_title"],"properties":{"type":{"const":"section_intro"},"section_title":{"type":"string"},"description":{"type":"string"}}}'
WHERE id = 'context';

-- Axis / Topic Analysis → single_insight
UPDATE report_builder_block_types SET
  slide_intent = 'single_insight',
  pptx_prompt_template = 'Generate a JSON object for a single insight chart slide.

Return ONLY valid JSON:
{
  "type": "single_insight",
  "chart_type": "bar",
  "chart_data": {
    "labels": ["<area1>", "<area2>", "<area3>"],
    "series": [{"name": "Score", "values": [3.5, 4.2, 2.8]}]
  },
  "insight_text": "<2-3 sentence analysis of this axis/topic>",
  "source": "{{assessment.framework}} Assessment"
}

Use actual axis scores from: {{axisData}}.
Context: {{section.repeatName}}, {{section.repeatData}}.',
  pptx_output_schema = '{"type":"object","required":["type","chart_type","chart_data","insight_text"],"properties":{"type":{"const":"single_insight"},"chart_type":{"enum":["bar","line","pie","radar","gauge"]},"chart_data":{"type":"object","required":["labels","series"]},"insight_text":{"type":"string"},"source":{"type":"string"}}}'
WHERE id = 'axis_analysis';

-- Action Plan → roadmap
UPDATE report_builder_block_types SET
  slide_intent = 'roadmap',
  pptx_prompt_template = 'Generate a JSON object for a roadmap slide.

Return ONLY valid JSON:
{
  "type": "roadmap",
  "phases": [
    {"label": "Now", "timeframe": "0–3 months", "items": ["<action 1>","<action 2>"], "status": "in_progress"},
    {"label": "Next", "timeframe": "3–6 months", "items": ["<action 3>","<action 4>"], "status": "planned"},
    {"label": "Later", "timeframe": "6–12 months", "items": ["<action 5>","<action 6>"], "status": "planned"}
  ]
}

Rules: 2-4 phases, max 5 items per phase. Prioritize by impact.
Context: {{assessment}}, {{axisData}}, {{companyContext}}.',
  pptx_output_schema = '{"type":"object","required":["type","phases"],"properties":{"type":{"const":"roadmap"},"phases":{"type":"array","minItems":2,"maxItems":5,"items":{"type":"object","required":["label","timeframe","items"],"properties":{"label":{"type":"string"},"timeframe":{"type":"string"},"items":{"type":"array","maxItems":5,"items":{"type":"string"}},"status":{"enum":["completed","in_progress","planned"]}}}}}}'
WHERE id = 'action_plan';

-- Appendix
UPDATE report_builder_block_types SET
  slide_intent = 'appendix',
  pptx_prompt_template = 'Generate a JSON object for an appendix slide.

Return ONLY valid JSON:
{
  "type": "appendix",
  "title": "Appendix",
  "body": "<supporting details as plain text>",
  "tables": [
    {"headers": ["Item","Detail"], "rows": [["<item>","<detail>"]]}
  ],
  "footnotes": ["<source or note>"]
}

Context: {{assessment}}, {{axisData}}.',
  pptx_output_schema = '{"type":"object","required":["type","title","body"]}'
WHERE id = 'appendix';

-- ==========================================
-- 3. DATA BLOCKS — PPTX prompts + intent
-- ==========================================

-- Assessment Matrix → assessment
UPDATE report_builder_block_types SET
  slide_intent = 'assessment',
  pptx_prompt_template = 'Generate a JSON object for a maturity assessment heatmap slide.

Return ONLY valid JSON:
{
  "type": "assessment",
  "matrix_type": "heatmap",
  "axes": [
    {"axisId": "1", "axisName": "<axis name>", "score": 3.5, "maxScore": 7, "target": 5.0, "gap": 1.5}
  ],
  "scale_max": 7,
  "overall_score": 4.2
}

Use actual scores from: {{assessment.scores}}, {{axisData}}.
Include all assessed axes.',
  pptx_output_schema = '{"type":"object","required":["type","axes","scale_max"],"properties":{"type":{"const":"assessment"},"matrix_type":{"enum":["heatmap","maturity","radar"]},"axes":{"type":"array","items":{"type":"object","required":["axisId","axisName","score","maxScore"]}},"scale_max":{"type":"number"},"overall_score":{"type":"number"}}}'
WHERE id = 'matrix';

-- Key Findings → key_messages
UPDATE report_builder_block_types SET
  slide_intent = 'key_messages',
  pptx_prompt_template = 'Generate a JSON object for a key findings slide.

Return ONLY valid JSON:
{
  "type": "key_messages",
  "messages": [
    {"title": "<finding title, max 8 words>", "description": "<1-2 sentence detail>", "icon": "◆"}
  ]
}

Rules: 3-4 key findings. Sort by importance.
Context: {{assessment}}, {{axisData}}, {{companyContext}}.',
  pptx_output_schema = '{"type":"object","required":["type","messages"],"properties":{"type":{"const":"key_messages"},"messages":{"type":"array","minItems":1,"maxItems":4}}}'
WHERE id = 'findings';

-- Dashboard / Score Summary → performance_overview
UPDATE report_builder_block_types SET
  slide_intent = 'performance_overview',
  pptx_prompt_template = 'Generate a JSON object for a KPI dashboard slide.

Return ONLY valid JSON:
{
  "type": "performance_overview",
  "kpis": [
    {"name": "Overall Maturity", "value": 4.2, "unit": "/7", "trend": "up", "status": "warning"},
    {"name": "<dimension>", "value": 3.8, "unit": "/7", "trend": "down", "status": "critical"}
  ],
  "period": "Assessment Date: {{report.createdAt}}",
  "context": "<1 sentence overview>"
}

Rules: max 6 KPIs. Include overall + top dimensions.
Use actual scores from: {{assessment.scores}}, {{axisData}}.',
  pptx_output_schema = '{"type":"object","required":["type","kpis"],"properties":{"type":{"const":"performance_overview"},"kpis":{"type":"array","maxItems":6,"items":{"type":"object","required":["name","value"],"properties":{"name":{"type":"string"},"value":{"type":"number"},"unit":{"type":"string"},"trend":{"enum":["up","down","flat"]},"status":{"enum":["good","warning","critical"]}}}}}}'
WHERE id = 'dashboard';

-- Scorecard → performance_overview
UPDATE report_builder_block_types SET
  slide_intent = 'performance_overview',
  pptx_prompt_template = 'Generate a JSON object for a scorecard KPI dashboard slide.

Return ONLY valid JSON:
{
  "type": "performance_overview",
  "kpis": [
    {"name": "<dimension>", "value": 3.8, "unit": "/7", "target": 5.0, "trend": "down", "delta": -1.2, "status": "critical"}
  ],
  "context": "<1 sentence gap overview>"
}

Rules: max 6 KPIs. Sort by gap size.
Use: {{assessment.scores}}, {{axisData}}.',
  pptx_output_schema = '{"type":"object","required":["type","kpis"]}'
WHERE id = 'scorecard';

-- Gap Analysis → assessment (comparison view)
UPDATE report_builder_block_types SET
  slide_intent = 'assessment',
  pptx_prompt_template = 'Generate a JSON object for a gap analysis heatmap slide.

Return ONLY valid JSON:
{
  "type": "assessment",
  "matrix_type": "heatmap",
  "axes": [
    {"axisId": "1", "axisName": "<dimension>", "score": 3.5, "maxScore": 7, "target": 5.0, "gap": 1.5}
  ],
  "scale_max": 7,
  "overall_score": 4.2
}

Focus on dimensions with largest gaps. Use: {{assessment.scores}}, {{axisData}}.',
  pptx_output_schema = '{"type":"object","required":["type","axes","scale_max"]}'
WHERE id = 'gap_analysis';

-- ==========================================
-- 4. VISUAL BLOCKS — PPTX prompts + intent
-- ==========================================

-- Bar Chart → single_insight
UPDATE report_builder_block_types SET
  slide_intent = 'single_insight',
  pptx_prompt_template = 'Generate a JSON object for a bar chart insight slide.

Return ONLY valid JSON:
{
  "type": "single_insight",
  "chart_type": "bar",
  "chart_data": {
    "labels": ["<cat1>", "<cat2>", "<cat3>"],
    "series": [{"name": "<series>", "values": [1.0, 2.0, 3.0]}]
  },
  "insight_text": "<2-3 sentence insight from the data>",
  "source": "{{assessment.framework}}"
}

Use actual data from: {{assessment}}, {{axisData}}.',
  pptx_output_schema = '{"type":"object","required":["type","chart_type","chart_data","insight_text"]}'
WHERE id = 'chart_bar';

-- Pie Chart → single_insight
UPDATE report_builder_block_types SET
  slide_intent = 'single_insight',
  pptx_prompt_template = 'Generate a JSON object for a pie chart insight slide.

Return ONLY valid JSON:
{
  "type": "single_insight",
  "chart_type": "pie",
  "chart_data": {
    "labels": ["<seg1>", "<seg2>", "<seg3>"],
    "series": [{"name": "Distribution", "values": [40, 35, 25]}]
  },
  "insight_text": "<2-3 sentence insight about the distribution>",
  "source": "{{assessment.framework}}"
}

Use: {{assessment}}, {{axisData}}.',
  pptx_output_schema = '{"type":"object","required":["type","chart_type","chart_data","insight_text"]}'
WHERE id = 'chart_pie';

-- Roadmap → roadmap
UPDATE report_builder_block_types SET
  slide_intent = 'roadmap',
  pptx_prompt_template = 'Generate a JSON object for a roadmap slide.

Return ONLY valid JSON:
{
  "type": "roadmap",
  "phases": [
    {"label": "Phase 1", "timeframe": "0–3 months", "items": ["<milestone 1>","<milestone 2>"], "status": "in_progress"},
    {"label": "Phase 2", "timeframe": "3–6 months", "items": ["<milestone 3>","<milestone 4>"], "status": "planned"},
    {"label": "Phase 3", "timeframe": "6–12 months", "items": ["<milestone 5>"], "status": "planned"}
  ]
}

Rules: 2-4 phases, max 5 items each.
Context: {{assessment}}, {{companyContext}}.',
  pptx_output_schema = '{"type":"object","required":["type","phases"]}'
WHERE id = 'roadmap';

-- KPIs → performance_overview
UPDATE report_builder_block_types SET
  slide_intent = 'performance_overview',
  pptx_prompt_template = 'Generate a JSON object for a KPI dashboard slide.

Return ONLY valid JSON:
{
  "type": "performance_overview",
  "kpis": [
    {"name": "<KPI name>", "value": 85, "unit": "%", "target": 95, "trend": "up", "status": "warning"}
  ],
  "context": "<1 sentence about measurement approach>"
}

Rules: 5-6 KPIs with measurable targets.
Context: {{assessment}}, {{companyContext}}.',
  pptx_output_schema = '{"type":"object","required":["type","kpis"]}'
WHERE id = 'kpis';

-- Risks → risk_management
UPDATE report_builder_block_types SET
  slide_intent = 'risk_management',
  pptx_prompt_template = 'Generate a JSON object for a risk management slide.

Return ONLY valid JSON:
{
  "type": "risk_management",
  "risks": [
    {
      "risk": "<risk description>",
      "likelihood": "high|medium|low",
      "impact": "high|medium|low",
      "mitigation": "<mitigation strategy>",
      "owner": "<responsible role>"
    }
  ]
}

Rules: 5-8 risks. Sort by combined risk score (likelihood × impact).
Context: {{assessment}}, {{axisData}}, {{companyContext}}.',
  pptx_output_schema = '{"type":"object","required":["type","risks"],"properties":{"type":{"const":"risk_management"},"risks":{"type":"array","maxItems":8,"items":{"type":"object","required":["risk","likelihood","impact","mitigation"],"properties":{"risk":{"type":"string"},"likelihood":{"enum":["high","medium","low"]},"impact":{"enum":["high","medium","low"]},"mitigation":{"type":"string"},"owner":{"type":"string"}}}}}}'
WHERE id = 'risk';

-- Prioritization → assessment
UPDATE report_builder_block_types SET
  slide_intent = 'assessment',
  pptx_prompt_template = 'Generate a JSON object for a prioritization matrix (heatmap-style) slide.

Return ONLY valid JSON:
{
  "type": "assessment",
  "matrix_type": "heatmap",
  "axes": [
    {"axisId": "1", "axisName": "<initiative>", "score": 4, "maxScore": 5, "target": 5, "gap": 1}
  ],
  "scale_max": 5,
  "overall_score": null
}

Each axis = one initiative. Score = impact rating (1-5). Target = effort required (1-5). Gap = net priority.
Context: {{assessment}}, {{companyContext}}.',
  pptx_output_schema = '{"type":"object","required":["type","axes","scale_max"]}'
WHERE id = 'prioritization';

-- Image / Diagram → appendix (fallback — images not yet supported)
UPDATE report_builder_block_types SET
  slide_intent = 'appendix',
  pptx_prompt_template = 'Generate a JSON object describing a diagram placeholder.

Return ONLY valid JSON:
{
  "type": "appendix",
  "title": "{{section.title}}",
  "body": "<Description of the diagram or visual that belongs here>",
  "footnotes": ["Diagram to be inserted manually post-export"]
}',
  pptx_output_schema = '{"type":"object","required":["type","title","body"]}'
WHERE id = 'image';

-- Data Table → appendix
UPDATE report_builder_block_types SET
  slide_intent = 'appendix',
  pptx_prompt_template = 'Generate a JSON object for a data table slide.

Return ONLY valid JSON:
{
  "type": "appendix",
  "title": "{{section.title}}",
  "body": "<1 sentence context about the table>",
  "tables": [
    {"headers": ["<col1>","<col2>","<col3>"], "rows": [["<val>","<val>","<val>"]]}
  ]
}

Use actual data from: {{assessment}}, {{axisData}}.',
  pptx_output_schema = '{"type":"object","required":["type","title","body"]}'
WHERE id = 'table';

-- ==========================================
-- 5. CONSULTING BLOCKS — PPTX prompts + intent
-- ==========================================

UPDATE report_builder_block_types SET slide_intent = 'key_messages',
  pptx_prompt_template = 'Generate a JSON for key takeaway slide. Return ONLY valid JSON: {"type":"key_messages","messages":[{"title":"<takeaway headline>","description":"<1 sentence detail>","icon":"★"}]}. Max 3 messages.',
  pptx_output_schema = '{"type":"object","required":["type","messages"]}'
WHERE id = 'consulting_takeaway';

UPDATE report_builder_block_types SET slide_intent = 'key_messages',
  pptx_prompt_template = 'Generate a JSON for implications slide. Return ONLY valid JSON: {"type":"key_messages","messages":[{"title":"<implication>","description":"<so-what detail>","icon":"◆"}]}. Max 4 messages.',
  pptx_output_schema = '{"type":"object","required":["type","messages"]}'
WHERE id = 'consulting_implications';

UPDATE report_builder_block_types SET slide_intent = 'next_steps',
  pptx_prompt_template = 'Generate a JSON for decisions needed slide. Return ONLY valid JSON: {"type":"next_steps","actions":[{"action":"<decision needed>","owner":"<role>","deadline":"<timeframe>"}],"closing_message":"Decision required by board"}.',
  pptx_output_schema = '{"type":"object","required":["type","actions"]}'
WHERE id = 'consulting_decisions';

UPDATE report_builder_block_types SET slide_intent = 'risk_management',
  pptx_prompt_template = 'Generate a JSON for risk register slide. Return ONLY valid JSON: {"type":"risk_management","risks":[{"risk":"<risk>","likelihood":"high|medium|low","impact":"high|medium|low","mitigation":"<strategy>","owner":"<role>"}]}. Max 8 risks.',
  pptx_output_schema = '{"type":"object","required":["type","risks"]}'
WHERE id = 'consulting_risks_register';

UPDATE report_builder_block_types SET slide_intent = 'assessment',
  pptx_prompt_template = 'Generate a JSON for 2x2 prioritization matrix. Return ONLY valid JSON: {"type":"assessment","matrix_type":"heatmap","axes":[{"axisId":"1","axisName":"<initiative>","score":4,"maxScore":5,"target":3,"gap":1}],"scale_max":5}.',
  pptx_output_schema = '{"type":"object","required":["type","axes","scale_max"]}'
WHERE id = 'consulting_2x2';

UPDATE report_builder_block_types SET slide_intent = 'single_insight',
  pptx_prompt_template = 'Generate a JSON for benchmark chart slide. Return ONLY valid JSON: {"type":"single_insight","chart_type":"bar","chart_data":{"labels":["<dim1>","<dim2>"],"series":[{"name":"Company","values":[3.5,4.2]},{"name":"Benchmark","values":[5.0,4.8]}]},"insight_text":"<insight>","source":"Industry benchmark"}.',
  pptx_output_schema = '{"type":"object","required":["type","chart_type","chart_data","insight_text"]}'
WHERE id = 'consulting_benchmark_bar';

UPDATE report_builder_block_types SET slide_intent = 'roadmap',
  pptx_prompt_template = 'Generate a JSON for roadmap slide. Return ONLY valid JSON: {"type":"roadmap","phases":[{"label":"Now","timeframe":"0-3mo","items":["<item>"],"status":"in_progress"},{"label":"Next","timeframe":"3-6mo","items":["<item>"],"status":"planned"},{"label":"Later","timeframe":"6-12mo","items":["<item>"],"status":"planned"}]}.',
  pptx_output_schema = '{"type":"object","required":["type","phases"]}'
WHERE id = 'consulting_roadmap';

-- ==========================================
-- 6. NEW BLOCKS — missing intents
-- ==========================================

INSERT INTO report_builder_block_types (
  id, organization_id, name, description,
  source_types_json, render_kind, prompt_template,
  input_schema_json, default_length, default_language,
  is_system, is_active, category, display_order,
  slide_intent, pptx_prompt_template, pptx_output_schema,
  created_at, updated_at
) VALUES
(
  'root_cause', NULL, 'Root Cause Analysis',
  'Problem-Cause-Impact diagnosis: identifies root causes and their business impact.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'markdown',
  'Perform a root cause analysis. Identify the main problem, list 3-5 root causes, and for each cause describe the business impact and severity (high/medium/low).',
  NULL, 'medium', 'business', true, true, 'data', 26,
  'root_cause',
  'Generate a JSON object for a root cause analysis slide.

Return ONLY valid JSON:
{
  "type": "root_cause",
  "problem": "<main problem statement>",
  "causes": [
    {"cause": "<root cause>", "impact": "<business impact>", "severity": "high|medium|low"}
  ]
}

Rules: 3-5 causes. Sort by severity.
Context: {{assessment}}, {{axisData}}, {{companyContext}}.',
  '{"type":"object","required":["type","problem","causes"],"properties":{"type":{"const":"root_cause"},"problem":{"type":"string"},"causes":{"type":"array","minItems":1,"maxItems":5,"items":{"type":"object","required":["cause","impact","severity"],"properties":{"cause":{"type":"string"},"impact":{"type":"string"},"severity":{"enum":["high","medium","low"]}}}}}}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'comparison', NULL, 'Comparison (A vs B)',
  'Side-by-side comparison: current vs target, before vs after, option A vs B.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'markdown',
  'Create a side-by-side comparison. Define two sides with labels and 3-5 bullet points each. Include a verdict or recommendation.',
  NULL, 'medium', 'business', true, true, 'data', 27,
  'comparison',
  'Generate a JSON object for a comparison slide.

Return ONLY valid JSON:
{
  "type": "comparison",
  "left_label": "Current State",
  "right_label": "Target State",
  "left_items": ["<point 1>","<point 2>","<point 3>"],
  "right_items": ["<point 1>","<point 2>","<point 3>"],
  "verdict": "<one sentence conclusion>"
}

Rules: 3-5 items per side. Keep items concise (max 10 words each).
Context: {{assessment}}, {{axisData}}, {{companyContext}}.',
  '{"type":"object","required":["type","left_label","right_label","left_items","right_items"],"properties":{"type":{"const":"comparison"},"left_label":{"type":"string"},"right_label":{"type":"string"},"left_items":{"type":"array","maxItems":5},"right_items":{"type":"array","maxItems":5},"verdict":{"type":"string"}}}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'section_intro', NULL, 'Section Intro / Divider',
  'Section transition slide with title, number, and brief description.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'markdown',
  'Create a section introduction with a clear title and 1-2 sentence description of what this section covers.',
  NULL, 'short', 'business', true, true, 'content', 12,
  'section_intro',
  'Generate a JSON object for a section intro slide.

Return ONLY valid JSON:
{
  "type": "section_intro",
  "section_title": "<section name>",
  "section_number": null,
  "description": "<1-2 sentence description of section scope>"
}',
  '{"type":"object","required":["type","section_title"],"properties":{"type":{"const":"section_intro"},"section_title":{"type":"string"},"section_number":{"type":"number"},"description":{"type":"string"}}}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'key_messages', NULL, 'Key Messages',
  'Narrative framing: 3-4 key messages displayed as cards with icons.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'markdown',
  'Identify 3-4 key messages that frame the narrative of this report. Each message should have a headline and supporting detail.',
  NULL, 'short', 'business', true, true, 'content', 13,
  'key_messages',
  'Generate a JSON object for a key messages slide.

Return ONLY valid JSON:
{
  "type": "key_messages",
  "messages": [
    {"title": "<message headline, max 8 words>", "description": "<1-2 sentence supporting detail>", "icon": "◆"}
  ]
}

Rules: 3-4 messages. Each title max 8 words.
Context: {{assessment}}, {{axisData}}, {{companyContext}}.',
  '{"type":"object","required":["type","messages"],"properties":{"type":{"const":"key_messages"},"messages":{"type":"array","minItems":1,"maxItems":4}}}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'next_steps', NULL, 'Next Steps / Call to Action',
  'Action items with owners and deadlines — call to action for stakeholders.',
  '["ASSESSMENT","INTERVIEW","TOOL","INITIATIVE"]',
  'markdown',
  'Define 5-8 concrete next steps. Each should have: action description, responsible owner/role, and target deadline or timeframe.',
  NULL, 'medium', 'business', true, true, 'content', 14,
  'next_steps',
  'Generate a JSON object for a next steps slide.

Return ONLY valid JSON:
{
  "type": "next_steps",
  "actions": [
    {"action": "<concrete action>", "owner": "<responsible role>", "deadline": "<timeframe>", "status": "pending"}
  ],
  "closing_message": "<motivating closing statement>"
}

Rules: 5-8 actions. Sort by urgency.
Context: {{assessment}}, {{axisData}}, {{companyContext}}.',
  '{"type":"object","required":["type","actions"],"properties":{"type":{"const":"next_steps"},"actions":{"type":"array","minItems":1,"maxItems":10,"items":{"type":"object","required":["action"],"properties":{"action":{"type":"string"},"owner":{"type":"string"},"deadline":{"type":"string"},"status":{"enum":["pending","in_progress","done"]}}}},"closing_message":{"type":"string"}}}',
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
  slide_intent = EXCLUDED.slide_intent,
  pptx_prompt_template = EXCLUDED.pptx_prompt_template,
  pptx_output_schema = EXCLUDED.pptx_output_schema,
  updated_at = EXCLUDED.updated_at;

-- ==========================================
-- 7. INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_rb_block_types_intent ON report_builder_block_types(slide_intent);
