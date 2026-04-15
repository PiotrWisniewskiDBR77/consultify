-- Migration: 541_raci_section_type.sql
-- Add 'raci' section type for initiative RACI & Escalation module
-- The left nav uses id 'raci' but no DB section type existed with that key
-- Date: 2026-02-14

INSERT OR IGNORE INTO initiative_section_types (id, key, name, name_pl, description, description_pl, category, column_position, default_order, icon, icon_color, icon_bg, component_key, is_system, is_active) VALUES
('ist-raci', 'raci', 'RACI & Escalation', 'RACI i eskalacja', 'RACI responsibility matrix with reminders and escalation rules', 'Macierz odpowiedzialności RACI z przypomnieniami i regułami eskalacji', 'meta', 'right', 55, 'ShieldCheck', 'text-violet-500', 'from-violet-500/10 to-purple-500/10', 'raciEscalation', 1, 1);

-- AI prompt template for RACI & Escalation section
UPDATE initiative_section_types SET ai_prompt_template =
'You are a governance and stakeholder management expert. Suggest RACI assignments and escalation rules for this initiative.

Context:
- Initiative name: {{initiativeName}}
- Category: {{category}}
- Module: {{module}}
- Current status: {{status}}
- Summary: {{summary}}

Generate a structured RACI & Escalation plan that includes:
1. **RACI Matrix** — Suggest key stakeholder roles (Responsible, Accountable, Consulted, Informed) for the initiative. For each role, describe the expected responsibilities and who should fill them.
2. **Reminders** — Suggest automated reminder rules (e.g., weekly status updates, milestone approaching, overdue tasks) with recommended timing and recipients.
3. **Escalation Rules** — Define escalation triggers (e.g., no update for 7 days, budget overrun >10%, blocked dependency) with escalation paths and notification channels.

Format the response as structured JSON with three arrays: stakeholders, reminders, escalationRules.

Language: {{language}}
Respond in the requested language only.'
WHERE key = 'raci';
