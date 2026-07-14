-- 20260628_initiative_core_section_prompts.sql
--
-- FIX (kręgosłup inicjatyw): generator F1 był de-facto martwy, bo 24/25 sekcji
-- nie miało `ai_prompt_template`. Przyczyna: migracja 530 ustawiała szablony pod
-- kluczami snake_case ('problem_definition'…), a kolumna `key` trzyma camelCase
-- ('problemDefinition'…) → UPDATE-y trafiały w 0 wierszy. Migracja 542 poprawiła
-- 4 sekcje, ale została zaaplikowana ZANIM wiersze istniały/pasowały (status
-- 'success', 0 wierszy) → szablony nadal puste. Ta migracja domyka rzecz dla
-- WSZYSTKICH 6 kart rdzenia (CORE_SECTION_KEYS), idempotentnie, pod camelCase.
--
-- Kształty JSON są ZGODNE z (a) parserem FE (handleGenerateAI) i (b) hydracją
-- kolumn typowanych R3 (cardColumnHydration): scope → inScope/outOfScope/
-- killCriteria → scope_in/scope_out/kill_criteria; problemDefinition → symptom →
-- problem_statement; targetState → successCriteria/deliverables.
--
-- Bezpieczne: tylko UPDATE istniejących wierszy section-types; brak DDL.

-- FRESH-DB GUARD (2026-07-14): initiative_section_types is created by
-- 529_initiative_section_types.sql, which sorts AFTER this file on a fresh
-- replay (and its rows are seeded at runtime, so these UPDATEs are 0-row
-- no-ops on a fresh database either way). Skip when the table does not exist
-- yet; unchanged behaviour on already-migrated DBs.
DO $mig20260628$
BEGIN
IF to_regclass('public.initiative_section_types') IS NOT NULL THEN

-- ── 1) problemDefinition (re-apply 542; symptom→problem_statement w R3) ──
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

-- ── 2) targetState (re-apply 542; successCriteria/deliverables→R3) ──
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

-- ── 3) financialImpact (re-apply 542) ──
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

-- ── 4) financialAnalysis (re-apply 542; not core but keep parity) ──
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

-- ── 5) scope (NEW; inScope/outOfScope/killCriteria → R3 scope_in/out/kill) ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a strategic consultant. Define the scope boundaries for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Problem: {{problemStatement}}
- Target state: {{targetState}}
- Description: {{summary}}

Generate a structured JSON response with:
{
  "inScope": ["What is explicitly in scope (3-5 concrete items)"],
  "outOfScope": ["What is explicitly excluded (2-4 items)"],
  "killCriteria": ["Conditions under which the initiative should be stopped (1-3 items)"]
}

Language: {{language}}
Return valid JSON only.'
WHERE key = 'scope';

-- ── 6) kpis (NEW; section display/AI — KPI table lives in its own table) ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a performance management consultant. Propose measurable KPIs for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Target state: {{targetState}}
- Description: {{summary}}

Generate a structured JSON response with:
{
  "kpis": [
    { "name": "KPI name", "unit": "unit of measure", "baseline": "current value", "target": "target value" }
  ]
}
Provide 2-4 KPIs that are measurable conditions of success, not tasks.
Language: {{language}}
Return valid JSON only.'
WHERE key = 'kpis';

-- ── 7) control (NEW; governance/ownership recommendation) ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a PMO governance consultant. Recommend the control and ownership setup for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Status: {{status}}

Generate a structured JSON response with:
{
  "recommendedOwner": "Profile of the ideal business owner (role, not a person name)",
  "governanceCadence": "Suggested review cadence and forum",
  "escalationTrigger": "Conditions that should trigger escalation"
}

Language: {{language}}
Return valid JSON only.'
WHERE key = 'control';

-- ── 8) raid (FIX 1a naprawa-r4Struct; risks→R3 key_risks; now CORE) ──
-- raid promoted into CORE_SECTION_KEYS so the risk register always generates and
-- hydrates key_risks (was empty on live demo). JSON shape matches buildRiskLines()
-- in cardColumnHydration: risks[] with {type,risk,mitigation}; type:"risk" so the
-- hydrator keeps them (assumptions/dependencies excluded from key_risks by design).
UPDATE initiative_section_types SET ai_prompt_template =
'You are a PMO risk consultant. Build the RAID risk register for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Problem: {{problemStatement}}
- Description: {{summary}}

Generate a structured JSON response with at least 2 RISK items, each grounded in the initiative context (no generic placeholders):
{
  "risks": [
    { "type": "risk", "risk": "Concrete risk (1 sentence)", "probability": "low|medium|high", "impact": "low|medium|high", "mitigation": "Preventive action", "contingency": "Plan B if it happens" }
  ]
}

Language: {{language}}
Return valid JSON only.'
WHERE key = 'raid';

END IF;
END
$mig20260628$;
