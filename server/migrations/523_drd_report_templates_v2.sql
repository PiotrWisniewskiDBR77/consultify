-- Migration: 523_drd_report_templates_v2.sql
-- Replace ALL assessment report templates with 3 high-quality DRD-only templates
-- Keep Interview and Tool templates intact
-- Date: 2026-02-07

-- ==========================================
-- STEP 1: Delete ALL assessment templates
-- (keeps tpl-interview-* and tpl-tool-* intact)
-- ==========================================

DELETE FROM report_builder_templates WHERE source_type = 'ASSESSMENT';

-- ==========================================
-- TEMPLATE 1: DRD Full Diagnostic Report
-- Audience: Transformation team / consultant
-- ~14 sections, comprehensive, data-rich
-- ==========================================

INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-drd-full-diagnostic-v2',
  NULL,
  'DRD Full Diagnostic Report',
  'Comprehensive digital maturity diagnostic covering all 7 transformation axes with detailed gap analysis, axis-by-axis deep dives, strategic recommendations, and a prioritized roadmap. Best suited for transformation teams, consultants, and technical stakeholders who need the full picture.',
  'ASSESSMENT',
  'ASSESSMENT_DRD',
  '[
    {
      "key": "cover",
      "type": "cover",
      "title": "Cover Page",
      "required": true,
      "order": 0,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "showLogo": true,
        "showDate": true,
        "showVersion": true,
        "showOrganization": true,
        "subtitle": "Digital Readiness Diagnosis — Full Diagnostic Report"
      }
    },
    {
      "key": "executive_summary",
      "type": "summary",
      "title": "Executive Summary",
      "required": true,
      "order": 1,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Write a compelling executive summary (400-600 words) structured in 4 parts: (1) Context — why this assessment was conducted and what business objectives it serves; (2) Key Findings — the overall maturity score, top 3 strongest axes and top 3 weakest axes with scores; (3) Critical Gaps — the largest gaps between achieved and target levels, quantified as percentages; (4) Strategic Priority — the single most impactful recommendation with expected ROI timeline. Use confident, consulting-grade language. Include 2-3 concrete data points from the assessment scores."
    },
    {
      "key": "methodology",
      "type": "methodology",
      "title": "Assessment Methodology",
      "required": true,
      "order": 2,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Describe the DRD (Digital Readiness Diagnosis) methodology based on the Digital Pathfinder framework by Dr. Piotr Wiśniewski. Explain: (1) the 7 axes of digital transformation and what each measures; (2) the scoring scale — levels 1-7 for Process and Data axes, levels 1-5 for remaining axes; (3) how achieved vs. target levels create the gap analysis; (4) how the assessment was conducted (self-assessment, interviews, evidence review). Keep it professional but accessible — the reader should understand the framework without prior knowledge."
    },
    {
      "key": "overall_maturity",
      "type": "matrix",
      "title": "Overall Maturity Overview",
      "required": true,
      "order": 3,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "config": {
        "showOverallScore": true,
        "showGap": true,
        "showComparison": true
      },
      "promptHints": "Create a high-level maturity overview presenting: (1) The overall weighted maturity score as a percentage; (2) A summary table of all 7 axes showing achieved level, target level, gap, and a Red/Amber/Green status indicator; (3) A brief narrative (2-3 sentences per axis) explaining what the score means in practical business terms. Highlight the axes where the gap exceeds 30% as critical priorities. Use markdown tables for structured data."
    },
    {
      "key": "axis_1_processes",
      "type": "axis_analysis",
      "title": "Axis 1: Digital Processes",
      "required": true,
      "order": 4,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "axis",
      "repeatKey": "1",
      "promptHints": "Provide a deep-dive analysis of Axis 1 (Digital Processes) structured as: (1) Current State — describe the achieved maturity level and what it means (e.g., Level 3 = processes are documented but not standardized); (2) Area Breakdown — analyze each area within this axis with its individual score and key observations from the justifications provided; (3) Strengths — 2-3 specific things the organization does well in process digitization; (4) Gaps & Risks — specific weaknesses with business impact (e.g., manual handoffs cause X delays); (5) Quick Wins — 2-3 improvements achievable within 3 months. Reference actual scores and justification data."
    },
    {
      "key": "axis_2_products",
      "type": "axis_analysis",
      "title": "Axis 2: Digital Products & Services",
      "required": true,
      "order": 5,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "axis",
      "repeatKey": "2",
      "promptHints": "Provide a deep-dive analysis of Axis 2 (Digital Products & Services) structured as: (1) Current State — what the achieved level reveals about the organization''s product/service digitization maturity; (2) Area Breakdown — individual area scores with observations; (3) Strengths — what digital offerings already exist and work well; (4) Gaps & Risks — missing digital channels, outdated customer interfaces, competitive threats from more digitized competitors; (5) Quick Wins — immediate improvements to digital product/service delivery. Ground every observation in the actual assessment data."
    },
    {
      "key": "axis_3_business_models",
      "type": "axis_analysis",
      "title": "Axis 3: Digital Business Models",
      "required": true,
      "order": 6,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "axis",
      "repeatKey": "3",
      "promptHints": "Provide a deep-dive analysis of Axis 3 (Digital Business Models) structured as: (1) Current State — what level of business model innovation the organization has achieved; (2) Area Breakdown — scores per area with key observations; (3) Strengths — any existing digital revenue streams or platform thinking; (4) Gaps & Risks — over-reliance on traditional models, lack of data monetization, ecosystem gaps; (5) Strategic Opportunities — 2-3 business model innovations that align with the organization''s capabilities and market position. Be specific and reference industry benchmarks where relevant."
    },
    {
      "key": "axis_4_data",
      "type": "axis_analysis",
      "title": "Axis 4: Data & Analytics",
      "required": true,
      "order": 7,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "axis",
      "repeatKey": "4",
      "promptHints": "Provide a deep-dive analysis of Axis 4 (Data & Analytics) structured as: (1) Current State — data maturity level and what it implies about data governance, quality, and utilization; (2) Area Breakdown — per-area scores analyzing data collection, storage, processing, analytics, and governance; (3) Strengths — existing data assets, tools, or practices that work; (4) Gaps & Risks — data silos, quality issues, missing governance, analytics capability gaps, GDPR/compliance risks; (5) Data Strategy Recommendations — prioritized steps to improve data maturity including quick wins and long-term initiatives. This axis uses a 1-7 scale — explain what the specific level means."
    },
    {
      "key": "axis_5_culture",
      "type": "axis_analysis",
      "title": "Axis 5: Organizational Culture & Competencies",
      "required": true,
      "order": 8,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "axis",
      "repeatKey": "5",
      "promptHints": "Provide a deep-dive analysis of Axis 5 (Organizational Culture & Competencies) structured as: (1) Current State — cultural readiness for digital transformation; (2) Area Breakdown — scores covering digital skills, change management, leadership, innovation culture, and learning; (3) Strengths — existing cultural enablers (e.g., agile teams, innovation programs); (4) Gaps & Risks — resistance to change, skills shortages, leadership gaps, siloed mindset; (5) People & Culture Recommendations — training programs, change management initiatives, organizational design changes. Emphasize that culture is often the #1 barrier to successful digital transformation."
    },
    {
      "key": "axis_6_security",
      "type": "axis_analysis",
      "title": "Axis 6: Cybersecurity & Risk Management",
      "required": true,
      "order": 9,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "axis",
      "repeatKey": "6",
      "promptHints": "Provide a deep-dive analysis of Axis 6 (Cybersecurity & Risk Management) structured as: (1) Current State — security posture and risk management maturity; (2) Area Breakdown — scores covering threat detection, incident response, access management, compliance, business continuity; (3) Strengths — existing security controls and certifications; (4) Gaps & Risks — critical vulnerabilities, missing controls, compliance gaps (NIS2, DORA if applicable), unmanaged third-party risks; (5) Security Roadmap — prioritized recommendations from immediate actions (patch critical gaps) to strategic initiatives (zero-trust architecture). Flag any score below 3 as requiring urgent attention."
    },
    {
      "key": "axis_7_ai",
      "type": "axis_analysis",
      "title": "Axis 7: AI & Machine Learning",
      "required": true,
      "order": 10,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "axis",
      "repeatKey": "7",
      "promptHints": "Provide a deep-dive analysis of Axis 7 (AI & Machine Learning) structured as: (1) Current State — AI adoption maturity and readiness; (2) Area Breakdown — scores covering AI strategy, data readiness for AI, ML capabilities, AI governance, use case portfolio; (3) Strengths — any existing AI/ML initiatives, tools, or competencies; (4) Gaps & Risks — missing AI strategy, data quality issues blocking AI, talent gaps, ethical/governance concerns, unrealistic expectations; (5) AI Adoption Roadmap — phased approach from quick wins (RPA, simple ML) to advanced capabilities (generative AI, autonomous systems). Position AI maturity relative to the organization''s data maturity (Axis 4)."
    },
    {
      "key": "gap_analysis",
      "type": "recommendations",
      "title": "Strategic Gap Analysis & Priorities",
      "required": true,
      "order": 11,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Create a cross-cutting strategic gap analysis that synthesizes findings from all 7 axes: (1) Priority Matrix — rank all gaps by business impact (High/Medium/Low) and implementation effort (High/Medium/Low), creating a clear 2x2 prioritization; (2) Interdependencies — identify where gaps in one axis block progress in another (e.g., weak data governance blocks AI adoption); (3) Top 5 Strategic Priorities — the most critical transformation initiatives with expected impact, timeline, and estimated investment range; (4) Risk Assessment — what happens if the organization does NOT address these gaps (competitive risk, regulatory risk, operational risk). Use concrete language and avoid generic consulting jargon."
    },
    {
      "key": "roadmap",
      "type": "action_plan",
      "title": "Transformation Roadmap",
      "required": true,
      "order": 12,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Design a phased transformation roadmap with 3 horizons: (1) Quick Wins (0-3 months) — 5-7 immediate actions that require minimal investment but close critical gaps or deliver visible improvements, each with owner suggestion, estimated effort, and expected outcome; (2) Foundation Building (3-12 months) — 4-6 medium-term initiatives that establish the infrastructure for sustained digital transformation, including technology investments, process redesign, and capability building; (3) Strategic Transformation (12-36 months) — 3-4 major transformation programs that fundamentally change the organization''s digital capabilities. For each initiative, specify: objective, key activities, success metrics (KPIs), dependencies, estimated budget range, and risk factors. Present as a structured timeline."
    },
    {
      "key": "appendix",
      "type": "appendix",
      "title": "Appendix: Detailed Scores & Data",
      "required": false,
      "order": 13,
      "defaultLength": "long",
      "defaultLanguage": "technical",
      "promptHints": "Generate a comprehensive appendix containing: (1) Complete Score Table — all areas across all 7 axes with achieved level, target level, gap, and confidence rating in a structured markdown table; (2) Methodology Details — scoring criteria for each level (what defines Level 1, 2, 3, etc.); (3) Glossary — key terms used in the report (DRD, digital maturity, axis, area, etc.); (4) Assessment Metadata — date conducted, assessors, data sources, limitations and caveats. This section serves as the reference data backing all conclusions in the report."
    }
  ]',
  '{"intent": {"audience": "executive", "goal": "diagnosis", "tone": "consulting", "scope": "full", "targetLength": "long"}, "styling": {"theme": "professional", "layoutOrientation": "vertical", "footerMode": "minimal"}}',
  1, 1, 1, CURRENT_TIMESTAMP
);


-- ==========================================
-- TEMPLATE 2: DRD Board Report
-- Audience: Board of Directors / C-suite
-- ~8 sections, concise, decision-focused
-- ==========================================

INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-drd-board-report-v2',
  NULL,
  'DRD Board Report',
  'Concise, decision-oriented report for board members and C-level executives. Focuses on strategic implications, investment decisions, and key risks — stripped of technical details. Designed to be read in 15 minutes and drive boardroom decisions.',
  'ASSESSMENT',
  'ASSESSMENT_DRD',
  '[
    {
      "key": "cover",
      "type": "cover",
      "title": "Cover Page",
      "required": true,
      "order": 0,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "showLogo": true,
        "showDate": true,
        "showVersion": false,
        "showOrganization": true,
        "subtitle": "Digital Readiness — Board Summary"
      }
    },
    {
      "key": "key_message",
      "type": "summary",
      "title": "Key Message",
      "required": true,
      "order": 1,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Write a single-page executive brief (200-300 words) that a board member can read in 2 minutes. Structure it as: (1) One-sentence verdict — ''The organization''s digital maturity is at X% of target, placing it [ahead of / in line with / behind] industry peers''; (2) The 3 most important findings — each in one sentence with the score data; (3) The single biggest risk if no action is taken — framed in business/competitive terms; (4) The recommended investment decision — approve/defer/accelerate digital transformation budget with a ballpark figure. Use authoritative, boardroom-appropriate language. No jargon, no technical details."
    },
    {
      "key": "maturity_dashboard",
      "type": "matrix",
      "title": "Digital Maturity Dashboard",
      "required": true,
      "order": 2,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "config": {
        "showOverallScore": true,
        "showGap": true,
        "showComparison": true
      },
      "promptHints": "Present a board-level maturity dashboard with: (1) Overall Score — single number as percentage with a traffic light indicator (Green >70%, Amber 40-70%, Red <40%); (2) Axis Summary Table — 7 rows, each with axis name, achieved score, target score, gap, and status (On Track / At Risk / Critical); (3) Trend Indicators — for each axis, indicate whether the organization is improving, stable, or declining relative to where it should be; (4) Peer Comparison — if available, compare against industry benchmarks. Keep visuals-first, text-light. Board members scan tables, they don''t read paragraphs."
    },
    {
      "key": "strategic_findings",
      "type": "recommendations",
      "title": "Strategic Findings",
      "required": true,
      "order": 3,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Present exactly 5 strategic findings, each structured as a standalone insight card: (1) Finding title — sharp, memorable (e.g., ''Data silos are blocking AI adoption''); (2) Evidence — 1-2 sentences citing specific scores; (3) Business Impact — what this means in revenue, cost, risk, or competitive terms; (4) Recommended Action — one clear next step. Rank findings by business impact (highest first). Frame everything in terms the board cares about: market position, revenue growth, cost optimization, risk exposure, and regulatory compliance."
    },
    {
      "key": "risk_register",
      "type": "recommendations",
      "title": "Key Risks & Mitigation",
      "required": true,
      "order": 4,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Create a board-level risk register with 4-6 risks derived from the assessment gaps. For each risk: (1) Risk Title — e.g., ''Cybersecurity posture below regulatory requirements''; (2) Likelihood — High/Medium/Low based on the gap severity; (3) Impact — quantified where possible (potential fine, revenue loss, operational disruption); (4) Current Mitigation — what the organization already has in place (if anything); (5) Recommended Mitigation — the action needed to reduce this risk; (6) Timeline — how urgently this needs attention (Immediate / Q1-Q2 / This Year). Present as a structured markdown table. Focus on risks that could appear on the board''s audit committee agenda."
    },
    {
      "key": "investment_decision",
      "type": "action_plan",
      "title": "Investment Recommendations",
      "required": true,
      "order": 5,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Present 3-4 investment recommendations for board approval, structured as decision items: (1) Initiative Name — clear and specific; (2) Objective — what business outcome it delivers; (3) Investment Range — estimated budget (use ranges like ''€200K-400K'' based on scope); (4) Expected Return — ROI timeline and type (cost savings, revenue uplift, risk reduction); (5) Priority — Must-Do / Should-Do / Nice-to-Have; (6) Board Decision Required — Approve / Approve with conditions / Defer to management. Frame as a menu of options the board can vote on. Include a ''do nothing'' scenario showing the cost of inaction."
    },
    {
      "key": "next_steps",
      "type": "action_plan",
      "title": "Next Steps & Timeline",
      "required": true,
      "order": 6,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Provide a crisp next-steps summary with exactly 5-7 action items for the next 90 days. Each item should have: (1) Action — what needs to happen; (2) Owner — suggested role (CTO, CDO, CISO, CFO, CEO); (3) Deadline — specific date or ''within X weeks''; (4) Deliverable — what the board will see as evidence of completion. End with the date of the next board review of digital transformation progress. This should feel like meeting minutes — actionable and trackable."
    },
    {
      "key": "appendix_scores",
      "type": "appendix",
      "title": "Appendix: Score Details",
      "required": false,
      "order": 7,
      "defaultLength": "medium",
      "defaultLanguage": "technical",
      "promptHints": "Provide a compact appendix with: (1) Full score table — all axes and areas in one markdown table; (2) One-paragraph methodology summary explaining DRD scoring; (3) Assessment date and assessor information. Keep this brief — it exists only as reference if a board member wants to drill into specific numbers."
    }
  ]',
  '{"intent": {"audience": "board", "goal": "investment_decision", "tone": "decisive", "scope": "executive", "targetLength": "short"}, "styling": {"theme": "corporate", "layoutOrientation": "vertical", "footerMode": "minimal"}}',
  1, 0, 1, CURRENT_TIMESTAMP
);


-- ==========================================
-- TEMPLATE 3: DRD Presentation Deck
-- Audience: Mixed (workshops, stakeholders)
-- ~10 sections, slide-style, visual-first
-- ==========================================

INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-drd-presentation-v2',
  NULL,
  'DRD Presentation Deck',
  'Slide-style presentation format optimized for workshops, stakeholder meetings, and transformation kickoffs. Each section maps to 1-3 slides with visual-first content — charts, scorecards, bullet points. Designed for PPTX export.',
  'ASSESSMENT',
  'ASSESSMENT_DRD',
  '[
    {
      "key": "cover",
      "type": "cover",
      "title": "Title Slide",
      "required": true,
      "order": 0,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "showLogo": true,
        "showDate": true,
        "showVersion": false,
        "showOrganization": true,
        "subtitle": "Digital Readiness Diagnosis — Results Presentation"
      }
    },
    {
      "key": "agenda",
      "type": "summary",
      "title": "Agenda & Objectives",
      "required": true,
      "order": 1,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Create a presentation agenda slide with: (1) Meeting objective — one sentence explaining the purpose (e.g., ''Review digital maturity assessment results and align on transformation priorities''); (2) Agenda items — numbered list of 5-7 topics matching the sections in this presentation; (3) Expected outcomes — 2-3 bullet points on what decisions/alignments should be achieved by the end. Keep it to bullet points only, no paragraphs. This should look like a clean agenda slide."
    },
    {
      "key": "headline_findings",
      "type": "summary",
      "title": "Headline Findings",
      "required": true,
      "order": 2,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Create a ''headlines'' slide presenting 4-5 key findings as punchy statements. Each finding should be: (1) A bold headline (max 8 words) — e.g., ''Data maturity is our biggest blocker''; (2) One supporting sentence with the data point; (3) An impact indicator — use emoji or text markers: 🟢 Strength, 🟡 Watch, 🔴 Critical. Format as a visually scannable list. These headlines should tell the story of the assessment in 30 seconds. Think of them as newspaper headlines — dramatic, specific, data-backed."
    },
    {
      "key": "maturity_scorecard",
      "type": "matrix",
      "title": "Maturity Scorecard",
      "required": true,
      "order": 3,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "config": {
        "showOverallScore": true,
        "showGap": true,
        "showComparison": true
      },
      "promptHints": "Create a visual scorecard slide showing: (1) The overall maturity score prominently (large number, percentage); (2) A compact table with all 7 axes — for each: axis name, achieved score, target score, gap as a bar/percentage, and a color-coded status; (3) A one-sentence narrative below the table summarizing the pattern (e.g., ''Strong in processes and security, significant gaps in AI and data''). Optimize for visual impact — this is the slide everyone will photograph with their phones. Use markdown tables with clear formatting."
    },
    {
      "key": "strengths",
      "type": "recommendations",
      "title": "What We Do Well",
      "required": true,
      "order": 4,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Create a ''strengths'' slide highlighting 4-5 things the organization does well, based on the highest-scoring areas. For each strength: (1) A positive headline — e.g., ''Process standardization ahead of target''; (2) The score backing it up — e.g., ''Achieved 4.2 vs target 4.0''; (3) Why it matters — one sentence on business value. Start with positives to set an encouraging tone before diving into gaps. Use checkmarks or green indicators. This slide should make people feel proud before the harder conversations."
    },
    {
      "key": "gaps_challenges",
      "type": "recommendations",
      "title": "Critical Gaps & Challenges",
      "required": true,
      "order": 5,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Create a ''gaps'' slide presenting the 5-6 most significant gaps from the assessment. For each gap: (1) Gap title — specific, not generic (e.g., ''No centralized data governance'' not ''Data issues''); (2) Current vs Target score; (3) Business impact — one sentence explaining the real-world consequence; (4) Urgency level — Immediate / Short-term / Medium-term. Sort by urgency. Use red/amber indicators. Be direct but constructive — frame gaps as opportunities, not failures. End with a transition sentence like ''The good news: these gaps have clear, actionable solutions.''"
    },
    {
      "key": "axis_deep_dives",
      "type": "axis_analysis",
      "title": "Axis Deep Dives (Top 3 Priority Axes)",
      "required": true,
      "order": 6,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Create deep-dive slides for the 3 axes with the LARGEST GAPS (not all 7 — this is a presentation, not a report). For each axis: (1) Axis name and score (achieved vs target) as a header; (2) 3-4 key observations as bullet points; (3) Area-level breakdown as a compact table; (4) The #1 recommended action for this axis. Keep each axis to the equivalent of 1-2 slides. Focus on the axes where action is most needed. For the remaining 4 axes, include a single summary sentence each. Use the data from the assessment to be specific — avoid generic statements."
    },
    {
      "key": "roadmap_visual",
      "type": "action_plan",
      "title": "Transformation Roadmap",
      "required": true,
      "order": 7,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Create a visual roadmap slide with 3 time horizons: (1) NOW (0-3 months) — 3-4 quick wins as bullet points with owners; (2) NEXT (3-12 months) — 3-4 foundation initiatives as bullet points with estimated effort; (3) LATER (12-36 months) — 2-3 strategic programs as bullet points with expected outcomes. Present as a timeline/swimlane structure using markdown formatting. Below the roadmap, add a ''Key Dependencies'' section listing 2-3 critical dependencies that could delay execution. This should be the slide that generates the most discussion in the room."
    },
    {
      "key": "discussion_questions",
      "type": "custom",
      "title": "Discussion & Decision Points",
      "required": true,
      "order": 8,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Create a facilitation slide with 4-5 discussion questions for the stakeholder group, designed to drive alignment and decisions. Examples: (1) ''Do we agree that [specific axis] is our #1 priority?''; (2) ''Are we willing to invest in [specific initiative] this quarter?''; (3) ''Who should own the digital transformation roadmap?''; (4) ''What is our risk tolerance for [specific gap]?''. Customize the questions based on the actual assessment findings — they should be specific to this organization''s results, not generic. End with a ''Decisions Needed Today'' section listing 2-3 yes/no decisions."
    },
    {
      "key": "next_steps_slide",
      "type": "action_plan",
      "title": "Next Steps",
      "required": true,
      "order": 9,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Create a closing slide with exactly 5 next steps, each as: (1) Action — what happens next; (2) Who — responsible person/role; (3) By When — specific timeline. Include: scheduling the detailed planning workshop, distributing the full diagnostic report, setting up the transformation governance structure, launching the first quick win, and setting the date for the 90-day review. End with a ''Thank you'' line and contact information placeholder. This is the slide that turns a presentation into action."
    }
  ]',
  '{"intent": {"audience": "mixed", "goal": "stakeholder_update", "tone": "consulting", "scope": "full", "targetLength": "standard"}, "styling": {"theme": "modern", "layoutOrientation": "horizontal", "footerMode": "none"}}',
  1, 0, 1, CURRENT_TIMESTAMP
);
