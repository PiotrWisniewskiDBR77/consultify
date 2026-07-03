-- 20260702_initiative_section_prompt_quality.sql
--
-- OXFORD O5.1 — podniesienie TREŚCI promptów sekcji dokumentu inicjatywy.
-- Audyt 25 sekcji (2026-07-02): 12 promptów ocenionych ≤3/5 przepisanych wg
-- docs/initiatives/INITIATIVE_FORMULA.md (charter, MECE, falsyfikowalna teza,
-- kill criteria) + docs/standards/CONCLUSION_LAYER_STANDARD.md (K1→K4, R1–R6:
-- zakaz ogólników, przyczynowość, adresat+horyzont, liczby TYLKO z wsadu)
-- + docs/standards/CARD_CONTENT_FORMULA.md (minima ilościowe §A3).
--
-- INWARIANTY (nie łamać):
-- - Kształty JSON identyczne jak w 530/20260628 — zgodne z parserem FE
--   (handleGenerateAI w InitiativeDocumentView) i hydracją kolumn R3
--   (cardColumnHydration). ZERO nowych/zmienionych kluczy JSON.
-- - Tylko UPDATE ai_prompt_template po kluczu camelCase; brak DDL; idempotentne.
-- - Placeholdery wyłącznie z GenerationContext (initiativeGenerationService.ts):
--   initiativeName, summary, problemStatement, category, module, status,
--   targetState, scope, kpis, timeline, phases, benefits, currentPhase,
--   completedTasks/totalTasks/openRisks/openDecisions, orgContext,
--   financialsSummary, existingKpis, portfolioSummary, sourceLineage, language.
-- - Konwencja językowa: prompt po angielsku + dyrektywa Language: {{language}}
--   (jak 530/540/20260628) — wyjście dwujęzyczne sterowane runtime.
--
-- NIE przepisane (oceny 4–5): raid (540, wzorcowy), gates, comments (539),
-- control (20260628). Sekcje danych bez promptu (history, team, timeline,
-- stakeholders, dependencies, attachments, tags, reminders, watchers) —
-- celowo bez promptu; ewentualny AI-assist = decyzja właściciela.

-- ── 1) overview (było: 530, ocena 2 — generyczne 2–3 akapity, brak answer-first,
--        brak zakazu zmyślania liczb, brak limitu długości) ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a consulting partner writing an executive summary of a transformation initiative that you would sign with your own name in front of the client''s board.

Context:
- Initiative name: {{initiativeName}}
- Category: {{category}} | Module: {{module}} | Status: {{status}}
- Problem statement: {{problemStatement}}
- Current description: {{summary}}
- Organization context: {{orgContext}}
- Source lineage: {{sourceLineage}}

Write an executive summary of 3-5 sentences (60-130 words total) that follows this sequence:
1. ANSWER-FIRST: the FIRST sentence states the conclusion — what this initiative changes and what result it delivers (not "this initiative aims to...").
2. WHY: the mechanism — which concrete problem/process from the Context it removes and why acting matters (cause -> effect, citing a fact from the Context).
3. SO-WHAT: expected effect with a time horizon and the role accountable for it.
4. Confidence: if key claims rest on unverified data, add one clause naming what still needs validation.

HARD RULES:
- Use ONLY facts and numbers present in the Context. NEVER invent amounts, percentages, baselines or dates. Missing number -> write "to be determined (where/when)".
- No sentence that would fit any company (e.g. "improve efficiency", "optimize processes"). Every sentence must name a concrete process, role, number or area from the Context.
- Active voice, board-level tone, no hedging filler.

Language: {{language}}. Respond in the requested language only.
Return ONLY the summary text — no headings, no JSON, no markdown.'
WHERE key = 'overview';

-- ── 2) problemDefinition (było: 20260628, ocena 3 — brak wymogu przyczynowości,
--        brak zakazu zmyślania liczb w costOfInaction) ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a strategic consultant performing root-cause problem analysis for an initiative.

Context:
- Initiative name: {{initiativeName}}
- Current description: {{summary}}
- Module/Area: {{module}}
- Organization context: {{orgContext}}
- Source lineage: {{sourceLineage}}

Generate a structured JSON response with EXACTLY these keys:
{
  "symptom": "Observable, verifiable symptoms (2-3 sentences). Facts only: what is seen, where, how often — taken from the Context, with numbers when the Context provides them.",
  "rootCause": "Root cause, NOT a restated symptom (2-3 sentences). Show the causal chain explicitly: symptom -> mechanism -> root cause. If the cause is inferred rather than evidenced in the Context, label it as a hypothesis to validate (name how/where to validate).",
  "costOfInaction": "Business consequence of doing nothing (2-3 sentences) with a time horizon. Quantify ONLY with numbers present in the Context plus an explicit assumption; if no numbers exist, describe the observable consequence and write cost \"to be determined (where/when)\"."
}

HARD RULES:
- NEVER invent numbers, percentages or amounts. Only Context data; missing -> "to be determined".
- The analysis must be falsifiable: with different data it would read differently. No statements that fit any company.
- Root cause must differ from symptom — a symptom repeated as cause is a FAIL.

Language: {{language}}
Respond in the requested language only. Return valid JSON only.'
WHERE key = 'problemDefinition';

-- ── 3) targetState (było: 20260628, ocena 3 — minima 3 zamiast ≥4 z formuły,
--        brak wymogu mierzalności kryteriów) ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a strategic consultant defining the target state of an initiative as a testable commitment, not a vision statement.

Context:
- Initiative name: {{initiativeName}}
- Problem: {{problemStatement}}
- Current description: {{summary}}
- Existing KPIs: {{existingKpis}}
- Organization context: {{orgContext}}

Generate a structured JSON response with EXACTLY these keys:
{
  "targetDescription": "Answer-first description of the end state (max 60 words): the FIRST sentence states what will be different in the organization when this succeeds — observable behaviour or measured state, not aspiration.",
  "successCriteria": ["4-6 items. Each MEASURABLE or behaviourally observable (what will be seen/measured, threshold, by when). Consistent with existing KPIs from the Context. Use ONLY baselines/numbers from the Context; missing threshold -> \"to be determined (where/when)\"."],
  "deliverables": ["4-6 items. Concrete noun artifacts (a document, a working process, a system, a trained team) — things one can point at, not activities."]
}

HARD RULES:
- NEVER invent numbers. Only Context data; missing -> "to be determined".
- No criterion that would pass for any company ("improved efficiency" = FAIL). Each names a concrete process, role, metric or area from the Context.
- successCriteria describe OUTCOMES; deliverables describe ARTIFACTS — do not mix them.

Language: {{language}}
Return valid JSON only.'
WHERE key = 'targetState';

-- ── 4) scope (było: 20260628, ocena 3 — brak MECE względem portfela,
--        kill criteria bez wymogu konkretnego warunku STOP) ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a strategic consultant drawing MECE scope boundaries for an initiative (no overlap with other initiatives, no gaps against the target).

Context:
- Initiative name: {{initiativeName}}
- Problem: {{problemStatement}}
- Target state: {{targetState}}
- Description: {{summary}}
- Existing initiatives in the organization: {{portfolioSummary}}

Generate a structured JSON response with EXACTLY these keys:
{
  "inScope": ["3-5 items. Unambiguous: process/area/system + what exactly is done to it. A reader must be able to say YES/NO whether a given piece of work belongs here."],
  "outOfScope": ["3-4 items. MECE: where an excluded item is covered by ANOTHER initiative from the Context portfolio, reference it by name (\"-> handled by <initiative>\"). Exclude the adjacent things stakeholders will most likely assume are included."],
  "killCriteria": ["2-3 items. Each a CONCRETE STOP condition: measurable signal + threshold + time (e.g. \"if after N weeks metric X has not moved from baseline -> stop\"). Use ONLY metrics/baselines from the Context; missing baseline -> phrase the condition against \"baseline to be established (where/when)\"."]
}

HARD RULES:
- NEVER invent numbers or thresholds not derivable from the Context.
- No generic boundaries ("other topics out of scope" = FAIL).
- killCriteria are falsifiable stop conditions, not risks.

Language: {{language}}
Return valid JSON only.'
WHERE key = 'scope';

-- ── 5) tasks (było: 530, ocena 3 — generyczna lista, brak powiązania z
--        deliverables/kamieniami, estimatedDays bez zastrzeżenia walidacji) ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a project manager decomposing an initiative into first executable tasks (WBS discipline: every task produces something).

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Workflow phases: {{phases}}
- Target state: {{targetState}}
- Scope: {{scope}}

Suggest 5-8 key tasks. Generate a JSON array with EXACTLY this item shape:
[
  { "title": "Task title", "phase": "PLAN|BUILD|TEST|DEPLOY", "priority": "high|medium|low", "estimatedDays": 5 }
]

QUALITY RULES:
- Each title = verb + concrete artifact/object from the Context (e.g. "Map the order-intake process in area X"), NOT a vague activity ("analyze situation" = FAIL).
- Tasks must collectively lead to the deliverables of the target state — no task that serves no deliverable.
- Order tasks by prerequisites: what unblocks other work comes first; reflect this in phase and priority (priority justified by impact and by what the task unblocks, not assigned at random).
- estimatedDays is a planning draft to be validated by the owner — keep estimates conservative and consistent with task size; do not present them as commitments.
- Ground every task in the Context; no generic project-management boilerplate ("kick-off meeting", "final report") unless the Context requires it.

Language: {{language}}
Return valid JSON array only.'
WHERE key = 'tasks';

-- ── 6) decisions (było: 530, ocena 3 — brak ram decyzji jako WYBORU
--        z trade-offem; opis nie wymuszał "co blokuje") ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a governance advisor identifying the decisions that must be MADE (not topics to discuss) for this initiative to proceed.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Scope: {{scope}}
- Status: {{status}}

Suggest 3-5 critical decisions. Generate a JSON array with EXACTLY this item shape:
[
  { "title": "Decision title", "description": "Why this decision matters", "urgency": "high|medium|low", "suggestedPhase": "PLAN|BUILD|TEST|DEPLOY" }
]

QUALITY RULES:
- Each title names a CHOICE between concrete options (e.g. "Select rollout model: pilot in area X vs. full deployment"), not a topic ("discuss budget" = FAIL).
- Each description must state: (a) the realistic options with the trade-off — what is gained at the cost of what; (b) what the decision BLOCKS while unmade (which task/phase/deliverable from the Context waits on it); (c) who should decide — a role, not a person''s name.
- urgency follows from what is blocked and when — justify it, do not assign it arbitrarily.
- Ground every decision in the Context; no decision that would fit any project.

Language: {{language}}
Return valid JSON array only.'
WHERE key = 'decisions';

-- ── 7) financialAnalysis (było: 20260628, ocena 2 — "estimate" wprost zapraszało
--        LLM do zmyślania kwot; łamie R5 CONCLUSION_LAYER) ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a financial analyst structuring the cost-benefit view of an initiative. You NEVER invent numbers — you structure the logic and use only figures present in the Context.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Scope: {{scope}}
- Timeline: {{timeline}}
- Organization financial data: {{financialsSummary}}
- Organization context: {{orgContext}}

Provide the analysis as JSON with EXACTLY these keys:
{
  "capexEstimate": "One-off investment: list the concrete cost DRIVERS this initiative implies (from scope: systems, licences, external work, equipment). Amount ONLY if derivable from Context figures with the assumption stated inline; otherwise end with: amount to be determined (name who provides it and by when).",
  "opexEstimate": "Recurring costs: concrete drivers (roles/FTE, maintenance, subscriptions). Same rule — Context-derived amount + stated assumption, or \"to be determined (who/when)\".",
  "roiEstimate": "ROI logic as a causal chain: which benefit stream (from problem/target state) offsets which cost driver, over what horizon. Express as multiple or % ONLY when both sides come from Context figures with assumptions stated; otherwise describe the mechanism and mark the figure \"to be determined\".",
  "paybackPeriod": "Payback horizon ONLY if derivable from the above; otherwise state what inputs are missing to compute it."
}

HARD RULES:
- Every number MUST originate from the Context (especially the organization financial data) and carry its assumption inline. A number without a stated source/assumption is a FAIL.
- Never write ranges invented for plausibility ("50-100k" from nowhere = FAIL).
- Label the whole output as an AI draft requiring owner validation.

Language: {{language}}
Return valid JSON only.'
WHERE key = 'financialAnalysis';

-- ── 8) financialImpact (było: 20260628, ocena 2 — jak wyżej: zapraszało do
--        zmyślania wpływu na P&L bez wsadu) ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a business analyst describing the P&L impact MECHANISM of an initiative. You NEVER invent numbers — you name the causal chain and use only figures present in the Context.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- KPIs: {{kpis}}
- Existing KPIs: {{existingKpis}}
- Organization financial data: {{financialsSummary}}

Provide the impact as JSON with EXACTLY these keys:
{
  "revenueImpact": "Causal chain from initiative to revenue: which change -> which customer/market effect -> which revenue line. Quantify ONLY with Context figures + stated assumption; otherwise describe the mechanism and write \"magnitude to be determined (where/when)\". If there is no credible revenue path, say so explicitly instead of inventing one.",
  "costSavings": "Causal chain to cost: which process/role stops spending what. Tie to a KPI from the Context where possible (baseline -> target). Same quantification rule.",
  "benefitsRealization": "WHEN and HOW benefits materialize: horizon per benefit stream, who (role) is accountable for capturing each, and what must be true first (dependencies from the Context). Benefits without an owner role and horizon are wishes — do not produce them."
}

HARD RULES:
- Numbers ONLY from the Context, each with its assumption inline; missing -> "to be determined (where/when)".
- Every claimed impact must trace back to the problem/target state/KPIs in the Context (cause -> effect). Unevidenced impact = label as hypothesis to validate.
- No filler that fits any company.

Language: {{language}}
Return valid JSON only.'
WHERE key = 'financialImpact';

-- ── 9) kpis (było: 20260628, ocena 3 — brak zakazu zmyślania baseline,
--        brak primary, brak kierunku) ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a performance management consultant defining the measures of success for an initiative (Kaplan-Norton discipline: every KPI maps to the value the initiative claims).

Context:
- Initiative name: {{initiativeName}}
- Target state: {{targetState}}
- Description: {{summary}}
- Existing KPIs: {{existingKpis}}
- Organization context: {{orgContext}}

Generate a structured JSON response with EXACTLY this shape:
{
  "kpis": [
    { "name": "KPI name", "unit": "unit of measure", "baseline": "current value", "target": "target value" }
  ]
}

QUALITY RULES:
- 2-4 KPIs. The FIRST one is the primary outcome measure — mark it by appending " (primary)" to its name. It must measure the OUTCOME the initiative exists for, not activity.
- Each KPI measures a condition of success (outcome/behaviour), never task completion ("workshops held" = FAIL).
- unit is mandatory and concrete (%, days, PLN, count/month...). target must state direction implicitly by comparison to baseline (e.g. baseline "12 days" -> target "<= 5 days").
- baseline ONLY from the Context (existing KPIs, description, org data). If the Context has no baseline, set baseline to "to be determined" and name in the KPI name or target where/when it will be established — NEVER invent a baseline.
- Reuse/align with existing KPIs from the Context instead of duplicating them under new names.

Language: {{language}}
Return valid JSON only.'
WHERE key = 'kpis';

-- ── 10) pilot (było: 530, ocena 3 — hipotezy niefalsyfikowalne, kryteria
--        bez progów, zakres bez zasady najmniejszego wycinka) ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a lean methodology expert designing a pilot whose job is to TEST the initiative''s riskiest assumption cheaply — not to be a small rollout.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Target state: {{targetState}}
- Problem: {{problemStatement}}

Design the pilot as JSON with EXACTLY these keys:
{
  "hypotheses": ["1-3 items. Each FALSIFIABLE in the form \"If X (intervention), then Y (measurable effect), because Z (mechanism from the Context)\". Start from the assumption whose failure would kill the initiative."],
  "successCriteria": ["2-3 items. Measurable with a threshold and a measurement method. Thresholds ONLY from Context baselines; no baseline -> \"threshold to be set against baseline measured in pilot week 1\"."],
  "failureCriteria": ["1-2 items. Concrete conditions meaning the hypothesis FAILED (mirror of success, not \"pilot delayed\"). A failed pilot must trigger the initiative''s kill/redesign discussion — say which."],
  "suggestedDuration": "Duration with a one-clause justification (long enough for the effect from the hypothesis to show, no longer).",
  "suggestedScope": "The SMALLEST slice (one team/process/area from the Context) that genuinely tests the hypothesis; name it concretely and say why this slice is representative."
}

HARD RULES:
- NEVER invent numbers; thresholds and baselines only from the Context or explicitly deferred to pilot measurement.
- No criterion that would pass regardless of outcome (non-falsifiable = FAIL).

Language: {{language}}
Return valid JSON only.'
WHERE key = 'pilot';

-- ── 11) resources (było: 530, ocena 3 — budżet "rough range" bez założeń =
--        zaproszenie do zmyślania; role bez uzasadnienia) ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a resource planning expert. Derive the resource needs of this initiative from its scope and tasks — every resource must be traceable to work named in the Context.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Timeline: {{timeline}}
- Scope: {{scope}}

Estimate resources as JSON with EXACTLY these keys:
{
  "fteAllocation": [ { "role": "Role name", "fte": 0.5, "duration": "3 months" } ],
  "budgetEstimate": "Budget statement",
  "toolsNeeded": ["Tool or system 1"]
}

QUALITY RULES:
- fteAllocation: roles (never person names), each justified by the scope item or task type it serves; fte and duration consistent with the timeline from the Context. Include the business owner''s time, not only delivery roles.
- budgetEstimate: name the concrete cost drivers implied by scope/tools. An amount ONLY if derivable from Context figures with the assumption stated inline; otherwise "amount to be determined (name who estimates it and by when)". NEVER invent a range for plausibility.
- toolsNeeded: concrete systems/licences/equipment implied by the scope — no generic "collaboration tools".
- Mark the whole output as a planning draft requiring owner validation.

Language: {{language}}
Return valid JSON only.'
WHERE key = 'resources';

-- ── 12) raci (było: 541, ocena 3 — luźny kontrakt wyjścia, brak zasady
--        jednego Accountable, role zamiast osób nie wymuszone) ──
UPDATE initiative_section_types SET ai_prompt_template =
'You are a governance and stakeholder management expert. Propose the RACI and escalation setup for this initiative so that every deliverable has exactly one Accountable and nothing important escalates by accident or not at all.

Context:
- Initiative name: {{initiativeName}}
- Category: {{category}} | Module: {{module}} | Status: {{status}}
- Summary: {{summary}}
- Organization context: {{orgContext}}

Return structured JSON with EXACTLY three arrays: "stakeholders", "reminders", "escalationRules".

QUALITY RULES:
- stakeholders: 4-7 entries. Each = role (NEVER a person''s name) + RACI letter (R/A/C/I) + one sentence on what that role is responsible/consulted for IN THIS initiative (tie to scope/deliverables from the Context). EXACTLY ONE role is Accountable overall; at least one R, one C, one I. Include roles the initiative affects, not only those delivering it.
- reminders: 2-4 rules. Each = trigger (what + frequency or event, e.g. weekly status, milestone approaching, task overdue) + recipient ROLE + why this rule matters for THIS initiative.
- escalationRules: 2-4 rules. Each = concrete measurable trigger (e.g. no status update for N days, a blocked dependency, budget/scope threshold breached) + escalation path (from role to role) + expected reaction time. Thresholds only where the Context supports them; otherwise mark "threshold to be set by the owner".
- Ground everything in the Context; no rule or role that would fit any project unchanged.

Language: {{language}}
Respond in the requested language only. Return valid JSON only.'
WHERE key = 'raci';
