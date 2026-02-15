-- Migration: 542_fix_initiative_section_ai_prompt_keys.sql
-- Fix AI prompt templates for initiative_section_types keys (camelCase)
--
-- Background:
-- - Section types are seeded with camelCase keys (e.g. problemDefinition, financialAnalysis).
-- - Earlier prompt migration used snake_case keys (e.g. problem_definition, financial_analysis),
--   which does not match the seeded keys and leaves ai_prompt_template NULL for those sections.

-- Problem Definition (camelCase key)
UPDATE initiative_section_types SET ai_prompt_template =
'You are a strategic consultant. Analyze the initiative and generate a structured problem definition.

Context:
- Initiative name: {{initiativeName}}
- Current description: {{summary}}
- Module/Area: {{module}}

Generate a structured JSON response with:
{
  "symptom": "Observable symptoms of the problem (2-3 sentences)",
  "rootCause": "Root cause analysis (2-3 sentences)",
  "costOfInaction": "What happens if we do nothing (2-3 sentences)"
}

Language: {{language}}
Respond in the requested language only. Return valid JSON only.'
WHERE key = 'problemDefinition';

-- Target State (camelCase key)
UPDATE initiative_section_types SET ai_prompt_template =
'You are a strategic consultant. Define the target state for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Problem: {{problemStatement}}
- Current description: {{summary}}

Generate a structured JSON response with:
{
  "targetDescription": "Vision of the desired end state (2-3 sentences)",
  "successCriteria": ["Criterion 1", "Criterion 2", "Criterion 3"],
  "deliverables": ["Deliverable 1", "Deliverable 2", "Deliverable 3"]
}

Language: {{language}}
Return valid JSON only.'
WHERE key = 'targetState';

-- Financial Analysis (camelCase key)
UPDATE initiative_section_types SET ai_prompt_template =
'You are a financial analyst. Estimate the financial parameters for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Scope: {{scope}}
- Timeline: {{timeline}}

Provide financial estimates as JSON:
{
  "capexEstimate": "Brief CAPEX description and rough range",
  "opexEstimate": "Brief OPEX description and rough range",
  "roiEstimate": "Expected ROI range and timeframe",
  "paybackPeriod": "Estimated payback period"
}

Note: These are rough AI estimates. Mark clearly that they need validation.
Language: {{language}}
Return valid JSON only.'
WHERE key = 'financialAnalysis';

-- Financial Impact (camelCase key)
UPDATE initiative_section_types SET ai_prompt_template =
'You are a business analyst. Estimate the financial impact of this initiative.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- KPIs: {{kpis}}

Provide P&L impact estimates as JSON:
{
  "revenueImpact": "Expected revenue impact description",
  "costSavings": "Expected cost savings description",
  "benefitsRealization": "How and when benefits will be realized"
}

Language: {{language}}
Return valid JSON only.'
WHERE key = 'financialImpact';

