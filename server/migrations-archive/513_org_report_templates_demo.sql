-- Migration: 513_org_report_templates_demo.sql
-- Demo Organization Report Templates
-- Date: 2026-02-05
-- 
-- Creates 3 organization-specific report templates for demo purposes:
-- - Custom Quarterly Review Template
-- - Innovation Readiness Quick Assessment
-- - Stakeholder Summary Brief

-- ==========================================
-- ORGANIZATION REPORT TEMPLATES
-- ==========================================

-- 1. Custom Quarterly Review Template
INSERT OR REPLACE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type, 
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-org-quarterly-review',
  'org-dbr77-system',
  'Quarterly Digital Review',
  'Custom quarterly review template for tracking digital transformation progress. Includes executive summary, KPI dashboard, milestone tracking, and action items for the upcoming quarter.',
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
        "subtitle": "Quarterly Digital Transformation Review"
      }
    },
    {
      "key": "executive_summary",
      "type": "summary",
      "title": "Executive Summary",
      "required": true,
      "order": 1,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Provide a concise executive summary highlighting key achievements this quarter, current maturity level changes, and strategic priorities for the next quarter."
    },
    {
      "key": "kpi_dashboard",
      "type": "scorecard",
      "title": "KPI Dashboard",
      "required": true,
      "order": 2,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "config": {
        "showOverallScore": true,
        "showGap": true,
        "showTrend": true,
        "showQuarterlyComparison": true
      }
    },
    {
      "key": "progress_tracker",
      "type": "matrix",
      "title": "Progress Tracker",
      "required": true,
      "order": 3,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "config": {
        "matrixType": "progress",
        "showMilestones": true,
        "showDeadlines": true
      },
      "promptHints": "Track progress against quarterly milestones. Show completed initiatives, in-progress items, and upcoming deliverables with status indicators."
    },
    {
      "key": "action_items",
      "type": "recommendations",
      "title": "Action Items for Next Quarter",
      "required": true,
      "order": 4,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "List prioritized action items for the upcoming quarter with owners, deadlines, and expected outcomes."
    }
  ]',
  '{"defaultLength": "medium", "language": "en", "tone": "business"}',
  0,
  0,
  1,
  datetime('now')
);

-- 2. Innovation Readiness Quick Assessment
INSERT OR REPLACE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type, 
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-org-innovation-quick',
  'org-dbr77-system',
  'Innovation Readiness Snapshot',
  'Quick assessment template focused on innovation capabilities and readiness for emerging technologies. Perfect for board presentations and investor updates.',
  'ASSESSMENT',
  'ASSESSMENT_DRD',
  '[
    {
      "key": "cover",
      "type": "cover",
      "title": "Cover",
      "required": true,
      "order": 0,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "showLogo": true,
        "showDate": true,
        "subtitle": "Innovation Readiness Snapshot"
      }
    },
    {
      "key": "innovation_scorecard",
      "type": "scorecard",
      "title": "Innovation Scorecard",
      "required": true,
      "order": 1,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "config": {
        "showOverallScore": true,
        "showInnovationIndex": true,
        "showCompetitivePosition": true
      },
      "promptHints": "Present the overall innovation readiness score with breakdown by key dimensions: technology adoption, R&D investment, talent readiness, and organizational agility."
    },
    {
      "key": "emerging_tech",
      "type": "analysis",
      "title": "Emerging Technology Assessment",
      "required": true,
      "order": 2,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Analyze readiness for key emerging technologies: AI/ML, IoT, Cloud, Automation, and Data Analytics. Provide maturity level and adoption recommendations for each."
    },
    {
      "key": "quick_wins",
      "type": "recommendations",
      "title": "Quick Wins & Opportunities",
      "required": true,
      "order": 3,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Identify 3-5 quick wins that can accelerate innovation with minimal investment. Focus on high-impact, low-effort opportunities."
    }
  ]',
  '{"defaultLength": "short", "language": "en", "tone": "executive"}',
  0,
  0,
  1,
  datetime('now')
);

-- 3. Stakeholder Summary Brief
INSERT OR REPLACE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type, 
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-org-stakeholder-brief',
  'org-dbr77-system',
  'Stakeholder Summary Brief',
  'Concise one-pager template designed for sharing digital transformation status with external stakeholders, partners, and board members. Focus on key metrics and strategic direction.',
  'ASSESSMENT',
  'ASSESSMENT_DRD',
  '[
    {
      "key": "header",
      "type": "cover",
      "title": "Header",
      "required": true,
      "order": 0,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "showLogo": true,
        "showDate": true,
        "compact": true,
        "subtitle": "Digital Transformation Brief"
      }
    },
    {
      "key": "key_metrics",
      "type": "scorecard",
      "title": "Key Metrics at a Glance",
      "required": true,
      "order": 1,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "showOverallScore": true,
        "showGap": true,
        "compactView": true,
        "showTrendIndicators": true
      },
      "promptHints": "Present 4-5 key metrics in a compact visual format. Include overall maturity score, year-over-year progress, investment ROI, and competitive benchmark."
    },
    {
      "key": "strategic_highlights",
      "type": "summary",
      "title": "Strategic Highlights",
      "required": true,
      "order": 2,
      "defaultLength": "short",
      "defaultLanguage": "executive",
      "promptHints": "Summarize in 3-4 bullet points the most important strategic developments and their business impact. Keep it concise and impactful."
    },
    {
      "key": "next_steps",
      "type": "recommendations",
      "title": "Next Steps",
      "required": true,
      "order": 3,
      "defaultLength": "short",
      "defaultLanguage": "executive",
      "promptHints": "List 2-3 critical next steps with clear timelines. Focus on strategic priorities that require stakeholder awareness or input."
    }
  ]',
  '{"defaultLength": "short", "language": "en", "tone": "executive", "format": "one-pager"}',
  0,
  0,
  1,
  datetime('now')
);
