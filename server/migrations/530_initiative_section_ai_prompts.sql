-- ==========================================
-- Populate AI prompt templates for initiative section types
-- ==========================================

-- Overview / Summary
UPDATE initiative_section_types SET ai_prompt_template = 
'You are a strategic initiative advisor. Generate a comprehensive executive summary for an initiative.

Context:
- Initiative name: {{initiativeName}}
- Category: {{category}}
- Module: {{module}}
- Current status: {{status}}
- Problem statement: {{problemStatement}}

Write a clear, professional executive summary (2-3 paragraphs) that:
1. Describes the initiative''s purpose and strategic alignment
2. Outlines the expected benefits and impact
3. Summarizes the approach and timeline

Language: {{language}}
Respond in the requested language only.'
WHERE key = 'overview';

-- Problem Definition
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
WHERE key = 'problem_definition';

-- Target State
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
WHERE key = 'target_state';

-- Scope
UPDATE initiative_section_types SET ai_prompt_template = 
'You are a project management expert. Define the scope for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Target state: {{targetState}}

Generate a structured JSON response with:
{
  "inScope": ["Item 1", "Item 2", "Item 3"],
  "outOfScope": ["Item 1", "Item 2"],
  "killCriteria": ["Condition that would stop this initiative 1", "Condition 2"]
}

Language: {{language}}
Return valid JSON only.'
WHERE key = 'scope';

-- Tasks & Milestones
UPDATE initiative_section_types SET ai_prompt_template = 
'You are a project manager. Suggest tasks and milestones for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Workflow phases: {{phases}}
- Target state: {{targetState}}

Suggest 5-8 key tasks with phases and priorities. Generate a JSON array:
[
  { "title": "Task title", "phase": "PLAN|BUILD|TEST|DEPLOY", "priority": "high|medium|low", "estimatedDays": 5 }
]

Language: {{language}}
Return valid JSON array only.'
WHERE key = 'tasks';

-- Decisions
UPDATE initiative_section_types SET ai_prompt_template = 
'You are a governance advisor. Identify key decisions needed for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Scope: {{scope}}

Suggest 3-5 critical decisions that need to be made. Generate a JSON array:
[
  { "title": "Decision title", "description": "Why this decision matters", "urgency": "high|medium|low", "suggestedPhase": "PLAN|BUILD|TEST|DEPLOY" }
]

Language: {{language}}
Return valid JSON array only.'
WHERE key = 'decisions';

-- RAID
UPDATE initiative_section_types SET ai_prompt_template = 
'You are a senior risk management and project governance expert. Perform a comprehensive RAID (Risk, Assumption, Issue, Dependency) analysis for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Problem statement: {{problemStatement}}
- Scope: {{scope}}
- Category: {{category}}
- Module: {{module}}
- Current status: {{status}}

Analyze the initiative thoroughly and generate a COMPLETE RAID log covering all 4 categories.
For each category, identify 2-4 items based on the initiative context.

Generate a JSON object with this EXACT structure:
{
  "risks": [
    {
      "title": "Clear, specific risk title",
      "description": "Detailed description of the risk and its potential consequences",
      "probability": "low|medium|high|critical",
      "impact": "low|medium|high|critical",
      "category": "technical|business|financial|operational|security",
      "status": "open",
      "mitigation": "Specific mitigation strategy to reduce probability",
      "contingency": "Fallback plan if the risk materializes",
      "proposedAction": "Immediate next action to address this risk",
      "owner": "",
      "source": "AI analysis"
    }
  ],
  "assumptions": [
    {
      "title": "Clear assumption statement",
      "description": "Why this assumption matters and what depends on it",
      "impact": "low|medium|high|critical",
      "category": "business|technical|operational",
      "status": "open",
      "proposedAction": "How to validate this assumption (specific steps)",
      "owner": "",
      "source": "AI analysis"
    }
  ],
  "issues": [
    {
      "title": "Specific issue title",
      "description": "Current impact and urgency of this issue",
      "impact": "low|medium|high|critical",
      "category": "technical|business|operational",
      "status": "open",
      "proposedAction": "Resolution plan with concrete steps",
      "owner": "",
      "source": "AI analysis"
    }
  ],
  "dependencies": [
    {
      "title": "Dependency description",
      "description": "What depends on this and what is the consequence if not met",
      "impact": "low|medium|high|critical",
      "category": "technical|business|operational",
      "status": "open",
      "proposedAction": "Management plan for this dependency",
      "owner": "",
      "source": "AI analysis"
    }
  ]
}

IMPORTANT RULES:
- Generate realistic, specific items based on the initiative context — NOT generic placeholders
- Each risk MUST have both probability AND impact fields
- Assumptions, Issues, Dependencies have impact only (NO probability)
- All items MUST have proposedAction with actionable content
- Use professional, concise language
- Risks should include both mitigation AND contingency plans
- Issues should focus on CURRENT problems, not potential future ones
- Dependencies should identify both internal and external blockers

Language: {{language}}
Return valid JSON only. No markdown, no code blocks, no commentary.'
WHERE key = 'raid';

-- KPIs
UPDATE initiative_section_types SET ai_prompt_template = 
'You are a performance measurement expert. Define KPIs for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Target state: {{targetState}}
- Expected benefits: {{benefits}}

Suggest 3-5 measurable KPIs. Generate a JSON array:
[
  { "name": "KPI name", "unit": "%, count, days, EUR", "baseline": "current value", "target": "target value", "frequency": "weekly|monthly|quarterly" }
]

Language: {{language}}
Return valid JSON array only.'
WHERE key = 'kpis';

-- Financial Analysis
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
WHERE key = 'financial_analysis';

-- Financial Impact
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
WHERE key = 'financial_impact';

-- Pilot
UPDATE initiative_section_types SET ai_prompt_template = 
'You are a lean methodology expert. Design a pilot phase for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Target state: {{targetState}}

Design a pilot as JSON:
{
  "hypotheses": ["Hypothesis 1 to test", "Hypothesis 2"],
  "successCriteria": ["Measurable criterion 1", "Criterion 2"],
  "failureCriteria": ["What would mean the pilot failed 1"],
  "suggestedDuration": "2-4 weeks",
  "suggestedScope": "Description of pilot scope"
}

Language: {{language}}
Return valid JSON only.'
WHERE key = 'pilot';

-- Resources
UPDATE initiative_section_types SET ai_prompt_template = 
'You are a resource planning expert. Estimate resource needs for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Timeline: {{timeline}}
- Scope: {{scope}}

Estimate resources as JSON:
{
  "fteAllocation": [{ "role": "Role name", "fte": 0.5, "duration": "3 months" }],
  "budgetEstimate": "Rough budget range",
  "toolsNeeded": ["Tool or system 1", "Tool 2"]
}

Language: {{language}}
Return valid JSON only.'
WHERE key = 'resources';

-- Gate Readiness
UPDATE initiative_section_types SET ai_prompt_template = 
'You are a governance expert. Assess gate readiness for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Current phase: {{currentPhase}}
- Tasks completed: {{completedTasks}} / {{totalTasks}}
- Open risks: {{openRisks}}
- Open decisions: {{openDecisions}}

Provide a gate readiness assessment as JSON:
{
  "readinessScore": 0-100,
  "recommendation": "PROCEED|HOLD|REWORK",
  "gaps": ["Gap 1 that needs addressing", "Gap 2"],
  "strengths": ["Strength 1", "Strength 2"]
}

Language: {{language}}
Return valid JSON only.'
WHERE key = 'gates';
