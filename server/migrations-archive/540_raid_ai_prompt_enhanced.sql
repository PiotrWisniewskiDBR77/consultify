-- Migration: 540_raid_ai_prompt_enhanced.sql
-- Enterprise RAID AI prompt — PMBOK/PRINCE2/Big4 standard
-- Includes: response strategies, type-specific statuses, comprehensive fields
-- Date: 2026-02-14

UPDATE initiative_section_types SET ai_prompt_template = 
'You are a senior risk management and project governance expert with deep expertise in PMBOK, PRINCE2, and Big4 consulting methodologies. Perform a comprehensive RAID (Risk, Assumption, Issue, Dependency) analysis for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Description: {{summary}}
- Problem statement: {{problemStatement}}
- Scope: {{scope}}
- Category: {{category}}
- Module: {{module}}
- Current status: {{status}}

Analyze the initiative thoroughly using industry-standard RAID methodology.
Generate a COMPLETE RAID log covering all 4 categories with 2-4 items each.

METHODOLOGY REFERENCE:
- RISKS: Future uncertain events that could negatively impact the initiative. Use PMBOK response strategies (avoid/transfer/mitigate/accept/escalate). Include both probability AND impact.
- ASSUMPTIONS: Statements believed to be true but not yet verified. If false, they become Issues. Include validation plan.
- ISSUES: Current problems that are already impacting the initiative. Require immediate resolution plan with owner and deadline.
- DEPENDENCIES: External factors the initiative relies on but cannot fully control. Include management plan and fallback.

Generate a JSON object with this EXACT structure:
{
  "risks": [
    {
      "title": "Clear, specific risk title",
      "description": "Detailed description: what could happen, why, and what would be the consequence",
      "probability": "low|medium|high|critical",
      "impact": "low|medium|high|critical",
      "category": "technical|business|financial|operational|security|legal|regulatory",
      "status": "open",
      "responseStrategy": "avoid|transfer|mitigate|accept|escalate",
      "mitigation": "Specific mitigation strategy to reduce probability (PMBOK: risk response plan)",
      "contingency": "Fallback plan if the risk materializes (PMBOK: contingency response)",
      "proposedAction": "Immediate next action with clear deliverable and timeline",
      "owner": "",
      "source": "AI analysis"
    }
  ],
  "assumptions": [
    {
      "title": "Clear assumption statement (e.g. We assume that X is true)",
      "description": "Why this assumption matters, what depends on it, and what happens if it is false",
      "impact": "low|medium|high|critical",
      "category": "business|technical|operational|regulatory",
      "status": "open",
      "proposedAction": "Specific validation plan: what evidence do we need, who to ask, what test to run",
      "owner": "",
      "source": "AI analysis"
    }
  ],
  "issues": [
    {
      "title": "Specific issue title (current problem, not future risk)",
      "description": "Current impact, urgency, and what is being blocked by this issue",
      "impact": "low|medium|high|critical",
      "category": "technical|business|operational",
      "status": "open",
      "proposedAction": "Resolution plan: concrete steps, who needs to be involved, expected timeline",
      "owner": "",
      "source": "AI analysis"
    }
  ],
  "dependencies": [
    {
      "title": "Dependency description (what we depend on)",
      "description": "Who/what we depend on, what is the consequence if not met, internal vs external",
      "impact": "low|medium|high|critical",
      "category": "technical|business|operational",
      "status": "open",
      "proposedAction": "Management plan: how to track, who monitors, what is the fallback if dependency fails",
      "owner": "",
      "source": "AI analysis"
    }
  ]
}

CRITICAL RULES (Big4 / PMBOK standard):
1. Each risk MUST have BOTH probability AND impact AND responseStrategy
2. Each risk MUST have BOTH mitigation AND contingency plans
3. Assumptions MUST be phrased as "We assume that..." statements
4. Issues MUST be CURRENT problems (already happening), NOT potential future events
5. Dependencies MUST identify the external party/system and the deadline
6. ALL items MUST have actionable proposedAction with concrete next steps
7. Use professional, executive-level language suitable for PMO/steering committee
8. Generate realistic items specific to this initiative — NOT generic placeholders
9. Categories should match the initiative domain (e.g. regulatory for banking, security for IT)
10. Response strategies: avoid=eliminate the threat, transfer=shift to third party, mitigate=reduce probability/impact, accept=acknowledge and monitor, escalate=defer to higher authority

Language: {{language}}
Return valid JSON only. No markdown, no code blocks, no commentary.'
WHERE key = 'raid';
