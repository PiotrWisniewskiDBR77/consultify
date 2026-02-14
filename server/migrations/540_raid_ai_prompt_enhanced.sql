-- Migration: 540_raid_ai_prompt_enhanced.sql
-- Enhanced RAID AI prompt with full field support (probability, impact, status, owner, 
-- proposedAction, mitigation, contingency, source, category)
-- Date: 2026-02-14

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
