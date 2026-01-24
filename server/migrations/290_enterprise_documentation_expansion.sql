-- Migration: 290_enterprise_documentation_expansion.sql
-- Purpose: Expand Knowledge Base with enterprise-grade documentation categories and articles
-- Date: 2026-01-20
-- Context: Harvard/BCG/McKinsey-level enterprise SaaS documentation standards

-- ============================================
-- NEW DOCUMENTATION CATEGORIES
-- ============================================

-- Getting Started
INSERT OR IGNORE INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES
    ('kb-cat-getting-started', 'getting-started', 'PlayCircle', 0, 1, 1);

INSERT OR IGNORE INTO kb_category_translations (id, category_id, language, name, description) VALUES
    ('kb-cat-trans-gs-en', 'kb-cat-getting-started', 'en', 'Getting Started', 'Quick start guides and platform onboarding');

-- Assessment Frameworks
INSERT OR IGNORE INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES
    ('kb-cat-assessment', 'assessment-frameworks', 'ClipboardCheck', 6, 1, 1);

INSERT OR IGNORE INTO kb_category_translations (id, category_id, language, name, description) VALUES
    ('kb-cat-trans-assess-en', 'kb-cat-assessment', 'en', 'Assessment Frameworks', 'DRD, SIRI, CMMI, Lean 4.0, and ADMA methodologies');

-- Industrial Modules
INSERT OR IGNORE INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES
    ('kb-cat-modules', 'industrial-modules', 'Factory', 7, 1, 1);

INSERT OR IGNORE INTO kb_category_translations (id, category_id, language, name, description) VALUES
    ('kb-cat-trans-mod-en', 'kb-cat-modules', 'en', 'Industrial Modules', 'MES, WMS, QMS, CMMS, IoT, and 14 more industrial modules');

-- AI Platform
INSERT OR IGNORE INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES
    ('kb-cat-ai', 'ai-platform', 'Brain', 8, 1, 1);

INSERT OR IGNORE INTO kb_category_translations (id, category_id, language, name, description) VALUES
    ('kb-cat-trans-ai-en', 'kb-cat-ai', 'en', 'AI Platform', 'AI Assistant, recommendations, prompts, and automation');

-- Analytics & Reporting
INSERT OR IGNORE INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES
    ('kb-cat-analytics', 'analytics-reporting', 'BarChart3', 9, 1, 1);

INSERT OR IGNORE INTO kb_category_translations (id, category_id, language, name, description) VALUES
    ('kb-cat-trans-analytics-en', 'kb-cat-analytics', 'en', 'Analytics & Reporting', 'Dashboards, KPIs, reports, and data export');

-- Transformation Management
INSERT OR IGNORE INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES
    ('kb-cat-transformation', 'transformation', 'TrendingUp', 10, 1, 1);

INSERT OR IGNORE INTO kb_category_translations (id, category_id, language, name, description) VALUES
    ('kb-cat-trans-transform-en', 'kb-cat-transformation', 'en', 'Transformation Management', 'Initiatives, roadmaps, ROI analysis, and change management');

-- Administration
INSERT OR IGNORE INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES
    ('kb-cat-admin', 'administration', 'Settings', 11, 1, 1);

INSERT OR IGNORE INTO kb_category_translations (id, category_id, language, name, description) VALUES
    ('kb-cat-trans-admin-en', 'kb-cat-admin', 'en', 'Administration', 'Organization setup, users, security, and compliance');

-- API Reference
INSERT OR IGNORE INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES
    ('kb-cat-api', 'api-reference', 'Code', 12, 1, 1);

INSERT OR IGNORE INTO kb_category_translations (id, category_id, language, name, description) VALUES
    ('kb-cat-trans-api-en', 'kb-cat-api', 'en', 'API Reference', 'REST API documentation, OpenAPI specs, and webhooks');

-- Integrations
INSERT OR IGNORE INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES
    ('kb-cat-integrations', 'integrations', 'Link', 13, 1, 1);

INSERT OR IGNORE INTO kb_category_translations (id, category_id, language, name, description) VALUES
    ('kb-cat-trans-int-en', 'kb-cat-integrations', 'en', 'Integrations', 'SAP, Microsoft 365, Slack, Power BI, and more');

-- Troubleshooting
INSERT OR IGNORE INTO kb_categories (id, slug, icon, sort_order, is_active, is_public) VALUES
    ('kb-cat-troubleshoot', 'troubleshooting', 'LifeBuoy', 14, 1, 1);

INSERT OR IGNORE INTO kb_category_translations (id, category_id, language, name, description) VALUES
    ('kb-cat-trans-trouble-en', 'kb-cat-troubleshoot', 'en', 'Troubleshooting', 'Common issues, error messages, and support');

-- ============================================
-- GETTING STARTED ARTICLES
-- ============================================

INSERT OR IGNORE INTO kb_articles (id, category_id, slug, status, is_featured, is_public, reading_time_minutes, related_modules, target_audience) VALUES
    ('kb-art-platform-overview', 'kb-cat-getting-started', 'platform-overview', 'published', 1, 1, 5, '["dashboard", "chat"]', '["all"]'),
    ('kb-art-first-assessment', 'kb-cat-getting-started', 'first-assessment-10-minutes', 'published', 1, 1, 10, '["assessment"]', '["new-user"]'),
    ('kb-art-first-initiative', 'kb-cat-getting-started', 'creating-first-initiative', 'published', 0, 1, 8, '["initiatives", "roadmap"]', '["manager"]'),
    ('kb-art-ai-chat-intro', 'kb-cat-getting-started', 'ai-chat-introduction', 'published', 1, 1, 5, '["chat", "ai"]', '["all"]'),
    ('kb-art-dashboard-guide', 'kb-cat-getting-started', 'understanding-dashboard', 'published', 0, 1, 6, '["dashboard"]', '["all"]'),
    ('kb-art-navigation', 'kb-cat-getting-started', 'navigation-interface-guide', 'published', 0, 1, 4, '["dashboard"]', '["all"]'),
    ('kb-art-mobile-pwa', 'kb-cat-getting-started', 'mobile-pwa-setup', 'published', 0, 1, 3, '["pwa"]', '["all"]');

-- Getting Started Article Translations
INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-platform-en', 'kb-art-platform-overview', 'en', 
     'IRIS Platform Overview',
     'Discover how IRIS 6.0 accelerates digital transformation with AI-powered assessment, planning, and execution capabilities.',
'# IRIS Platform Overview

## What is IRIS?

**IRIS** (Industrial Readiness & Intelligence System) is an enterprise-grade platform designed to help organizations assess, plan, and execute digital transformation initiatives.

## Core Capabilities

### 1. Assessment & Diagnosis
Evaluate organizational readiness across multiple proven frameworks:
- **DRD** - Digital Readiness Diagnostic
- **SIRI** - Smart Industry Readiness Index
- **CMMI** - Capability Maturity Model
- **Lean 4.0** - Lean Manufacturing Digitalization

### 2. AI-Powered Planning
Transform assessment insights into actionable roadmaps:
- AI-generated initiative recommendations
- Priority scoring based on impact and effort
- Resource and capacity planning
- ROI projection and business case generation

### 3. Execution Management
Track transformation progress with enterprise PMO tools:
- Initiative lifecycle management
- Task assignment and tracking
- Milestone and stage-gate workflows
- Risk and issue management

### 4. Industrial Excellence Modules
19 specialized modules for manufacturing operations:
- MES, WMS, QMS, CMMS, IoT, GEMBA
- HSE, ESG, KPI, APS, MRP, DT
- HRM, LMS, SKILLS, PARTNER, DATA-AI
- ADMIN, SETTINGS

## Getting Started

1. **Complete Assessment** - Start with DRD or SIRI
2. **Review AI Recommendations** - Analyze generated insights
3. **Create Initiatives** - Plan your transformation
4. **Execute & Track** - Manage implementation
5. **Measure Impact** - Monitor KPIs and benefits

Ready to begin? [Start your first assessment](/assessment)');

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-firstass-en', 'kb-art-first-assessment', 'en',
     'Your First Assessment in 10 Minutes',
     'Complete your first DRD assessment and receive AI-powered recommendations in just 10 minutes.',
'# Your First Assessment in 10 Minutes

## Overview

This guide walks you through completing your first Digital Readiness Diagnostic (DRD) assessment. In just 10 minutes, you''ll have a comprehensive view of your organization''s digital maturity.

## Step 1: Access Assessment Hub

1. Click **Assessment** in the main navigation
2. Select **DRD - Digital Readiness Diagnostic**
3. Click **Start New Assessment**

## Step 2: Answer Questions (7 Dimensions)

The DRD assessment covers 7 critical dimensions:

| Dimension | Questions | Time |
|-----------|-----------|------|
| Strategy | 5 | ~1 min |
| Organization | 5 | ~1 min |
| Technology | 6 | ~1.5 min |
| Data | 5 | ~1 min |
| People | 5 | ~1 min |
| Processes | 5 | ~1 min |
| Innovation | 5 | ~1 min |

> **Tip**: Answer honestly - inflated scores lead to incorrect recommendations.

## Step 3: Review Results

After submission, you''ll see:
- **Overall Maturity Score** (1-5)
- **Dimension Breakdown** with visual radar chart
- **Benchmark Comparison** vs. industry peers
- **Gap Analysis** highlighting improvement areas

## Step 4: AI Recommendations

Our AI engine generates:
- **Priority Initiatives** - Ranked by impact
- **Quick Wins** - Low-effort, high-impact items
- **Strategic Projects** - Long-term transformations
- **Estimated ROI** per recommendation

## Next Steps

1. Review top 3 recommendations
2. Click **Create Initiative** on any recommendation
3. Build your transformation roadmap

[Start Assessment Now](/assessment/drd)');

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-aichat-en', 'kb-art-ai-chat-intro', 'en',
     'AI Chat & Recommendations Guide',
     'Learn how to leverage IRIS AI for personalized recommendations, questions, and automation.',
'# AI Chat & Recommendations Guide

## Meet Your AI Co-Pilot

The IRIS AI Assistant is designed to help you navigate digital transformation with contextual, intelligent support.

## How to Use AI Chat

### Starting a Conversation

1. Click the **AI Chat** button (bottom right) or navigate to `/chat`
2. Type your question naturally
3. AI responds with context-aware suggestions

### Example Prompts

**Assessment & Analysis**
- "Analyze my latest DRD results"
- "What are my top 3 improvement areas?"
- "Compare my scores to industry benchmarks"

**Initiative Planning**
- "Suggest initiatives for improving our data maturity"
- "Create a roadmap for the next 6 months"
- "Estimate ROI for implementing MES"

**Reporting**
- "Generate an executive summary"
- "Create a board presentation"
- "Export KPI dashboard"

## AI Recommendations

### How They Work

1. AI analyzes your assessment data
2. Considers industry benchmarks
3. Factors in organization context
4. Generates prioritized initiatives

### Recommendation Types

| Type | Description |
|------|-------------|
| 🎯 Quick Wins | Low effort, immediate impact |
| 📈 Strategic | High impact, requires investment |
| 🛡️ Risk Mitigation | Reduce identified risks |
| 💡 Innovation | Competitive advantage opportunities |

## AI Settings

Customize AI behavior:
- Response format (detailed/concise)
- Language preference
- Memory settings
- Action automation level

[Open AI Chat](/chat)');

-- ============================================
-- INDUSTRIAL MODULES OVERVIEW ARTICLES
-- ============================================

INSERT OR IGNORE INTO kb_articles (id, category_id, slug, status, is_featured, is_public, reading_time_minutes, related_modules, target_audience) VALUES
    ('kb-art-mes-overview', 'kb-cat-modules', 'mes-manufacturing-execution', 'published', 1, 1, 6, '["mes"]', '["operations", "manager"]'),
    ('kb-art-wms-overview', 'kb-cat-modules', 'wms-warehouse-management', 'published', 1, 1, 6, '["wms"]', '["logistics", "manager"]'),
    ('kb-art-qms-overview', 'kb-cat-modules', 'qms-quality-management', 'published', 1, 1, 5, '["qms"]', '["quality", "manager"]'),
    ('kb-art-cmms-overview', 'kb-cat-modules', 'cmms-maintenance-management', 'published', 0, 1, 5, '["cmms"]', '["maintenance", "manager"]'),
    ('kb-art-iot-overview', 'kb-cat-modules', 'iot-device-management', 'published', 0, 1, 5, '["iot"]', '["engineer", "manager"]'),
    ('kb-art-gemba-overview', 'kb-cat-modules', 'gemba-shop-floor', 'published', 0, 1, 5, '["gemba"]', '["operator", "supervisor"]'),
    ('kb-art-hse-overview', 'kb-cat-modules', 'hse-health-safety', 'published', 0, 1, 5, '["hse"]', '["safety", "manager"]'),
    ('kb-art-esg-overview', 'kb-cat-modules', 'esg-sustainability', 'published', 0, 1, 5, '["esg"]', '["sustainability", "executive"]'),
    ('kb-art-kpi-overview', 'kb-cat-modules', 'kpi-performance-indicators', 'published', 0, 1, 5, '["kpi"]', '["analyst", "manager"]'),
    ('kb-art-aps-overview', 'kb-cat-modules', 'aps-advanced-planning', 'published', 0, 1, 6, '["aps"]', '["planner", "manager"]'),
    ('kb-art-mrp-overview', 'kb-cat-modules', 'mrp-material-planning', 'published', 0, 1, 5, '["mrp"]', '["supply-chain", "manager"]'),
    ('kb-art-dt-overview', 'kb-cat-modules', 'dt-digital-twin', 'published', 0, 1, 6, '["dt"]', '["engineer", "executive"]'),
    ('kb-art-hrm-overview', 'kb-cat-modules', 'hrm-human-resources', 'published', 0, 1, 5, '["hrm"]', '["hr", "manager"]'),
    ('kb-art-lms-overview', 'kb-cat-modules', 'lms-learning-management', 'published', 0, 1, 5, '["lms"]', '["training", "manager"]'),
    ('kb-art-skills-overview', 'kb-cat-modules', 'skills-competency', 'published', 0, 1, 5, '["skills"]', '["hr", "manager"]'),
    ('kb-art-partner-overview', 'kb-cat-modules', 'partner-portal', 'published', 0, 1, 4, '["partner"]', '["partner", "consultant"]'),
    ('kb-art-dataai-overview', 'kb-cat-modules', 'data-ai-analytics', 'published', 0, 1, 6, '["data-ai"]', '["analyst", "executive"]'),
    ('kb-art-admin-overview', 'kb-cat-modules', 'admin-administration', 'published', 0, 1, 5, '["admin"]', '["admin", "it"]'),
    ('kb-art-settings-overview', 'kb-cat-modules', 'settings-preferences', 'published', 0, 1, 3, '["settings"]', '["all"]');

-- MES Article Translation
INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-mes-en', 'kb-art-mes-overview', 'en',
     'MES - Manufacturing Execution System',
     'Real-time production tracking, work order management, and OEE analytics for shop floor excellence.',
'# MES - Manufacturing Execution System

## Overview

The MES module provides comprehensive manufacturing execution capabilities, connecting plant floor operations to enterprise planning systems.

## Key Features

### Production Tracking
- Real-time production monitoring
- Work order status visibility
- Cycle time tracking
- Operator activity logging

### Quality Control
- In-process quality checks
- First-pass yield metrics
- Defect tracking by workstation
- SPC integration

### OEE Analytics
- Availability tracking (downtime reasons)
- Performance metrics (speed losses)
- Quality rates (defects, rework)
- Six Big Losses analysis

### Work Order Management
- Order scheduling and sequencing
- Material consumption tracking
- Labor time collection
- Batch/lot traceability

## Integration

| System | Integration Type |
|--------|------------------|
| SAP PP | Bi-directional |
| APS Module | Native |
| IoT Sensors | Real-time |
| QMS Module | Native |

## Getting Started

1. Configure production lines
2. Define work centers
3. Import products and BOMs
4. Start production tracking

[Explore MES Module](/app/mes)');

-- WMS Article Translation
INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-wms-en', 'kb-art-wms-overview', 'en',
     'WMS - Warehouse Management System',
     'Inventory control, picking optimization, and warehouse operations for logistics excellence.',
'# WMS - Warehouse Management System

## Overview

The WMS module delivers end-to-end warehouse management capabilities from receiving to shipping.

## Key Features

### Inventory Management
- Real-time stock visibility
- Location management (bins, zones)
- Lot and serial tracking
- Expiration date management

### Receiving
- PO-based receiving
- Quality inspection integration
- Put-away optimization
- Label printing

### Picking & Packing
- Wave/batch picking
- Zone picking
- Pick-to-light support
- Packing verification

### Shipping
- Carrier integration
- Load planning
- Shipping documentation
- Track & trace

## Metrics & KPIs

| Metric | Description |
|--------|-------------|
| Inventory Accuracy | Cycle count results |
| Pick Accuracy | Errors per 1000 picks |
| Dock-to-Stock Time | Receiving efficiency |
| Order Cycle Time | Pick-pack-ship speed |

## Integration

- ERP Systems (SAP, Oracle)
- TMS (Transport Management)
- IoT Sensors (RFID, Barcode)
- MES Module

[Explore WMS Module](/app/wms)');

-- ============================================
-- AI PLATFORM ARTICLES
-- ============================================

INSERT OR IGNORE INTO kb_articles (id, category_id, slug, status, is_featured, is_public, reading_time_minutes, related_modules, target_audience) VALUES
    ('kb-art-ai-overview', 'kb-cat-ai', 'ai-assistant-overview', 'published', 1, 1, 5, '["ai", "chat"]', '["all"]'),
    ('kb-art-ai-recommendations', 'kb-cat-ai', 'ai-recommendations-engine', 'published', 1, 1, 6, '["ai", "initiatives"]', '["manager"]'),
    ('kb-art-ai-prompts', 'kb-cat-ai', 'prompt-engineering-industrial', 'published', 0, 1, 8, '["ai"]', '["power-user"]'),
    ('kb-art-ai-memory', 'kb-cat-ai', 'ai-memory-context', 'published', 0, 1, 5, '["ai", "settings"]', '["manager"]'),
    ('kb-art-ai-cost', 'kb-cat-ai', 'ai-cost-management', 'published', 0, 1, 4, '["ai", "admin"]', '["admin"]'),
    ('kb-art-ai-security', 'kb-cat-ai', 'ai-security-privacy', 'published', 0, 1, 5, '["ai", "security"]', '["admin", "executive"]'),
    ('kb-art-ai-actions', 'kb-cat-ai', 'ai-actions-automation', 'published', 0, 1, 6, '["ai", "automation"]', '["power-user"]');

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-aiov-en', 'kb-art-ai-overview', 'en',
     'AI Assistant Overview',
     'Understand the capabilities of IRIS AI and how it accelerates your digital transformation journey.',
'# AI Assistant Overview

## What is IRIS AI?

IRIS AI is an enterprise-grade artificial intelligence system designed specifically for industrial digital transformation. It combines domain expertise with advanced language models.

## Core Capabilities

### 1. Contextual Understanding
- Knows your organization context
- Remembers past conversations
- Understands industry terminology
- Adapts to your role and preferences

### 2. Assessment Analysis
- Interprets DRD, SIRI, CMMI results
- Identifies patterns and gaps
- Provides benchmark comparisons
- Suggests improvement areas

### 3. Initiative Recommendations
- AI-generated transformation ideas
- Priority scoring (impact × feasibility)
- Effort estimation
- ROI projection

### 4. Reporting & Insights
- Automated executive summaries
- KPI trend analysis
- Anomaly detection
- Natural language queries

## Using AI Chat

### Best Practices

1. **Be Specific** - "Analyze Q4 OEE trends" vs "Tell me about OEE"
2. **Provide Context** - "For our automotive plant in Germany..."
3. **Ask Follow-ups** - "Why is that?" "Give me an example"
4. **Request Actions** - "Create an initiative for this"

### Data Privacy

- Data never leaves your tenant
- PII is automatically redacted
- Full audit trail available
- SOC 2 Type II compliant

[Start Chatting with AI](/chat)');

-- ============================================
-- API REFERENCE ARTICLES
-- ============================================

INSERT OR IGNORE INTO kb_articles (id, category_id, slug, status, is_featured, is_public, reading_time_minutes, related_modules, target_audience) VALUES
    ('kb-art-api-intro', 'kb-cat-api', 'api-introduction', 'published', 1, 1, 5, '["api"]', '["developer"]'),
    ('kb-art-api-auth', 'kb-cat-api', 'api-authentication', 'published', 1, 1, 6, '["api", "security"]', '["developer"]'),
    ('kb-art-api-assess', 'kb-cat-api', 'api-assessments', 'published', 0, 1, 8, '["api", "assessment"]', '["developer"]'),
    ('kb-art-api-initiatives', 'kb-cat-api', 'api-initiatives', 'published', 0, 1, 8, '["api", "initiatives"]', '["developer"]'),
    ('kb-art-api-webhooks', 'kb-cat-api', 'api-webhooks', 'published', 0, 1, 6, '["api", "integrations"]', '["developer"]');

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-apiintro-en', 'kb-art-api-intro', 'en',
     'API Introduction',
     'Getting started with the IRIS REST API for programmatic access to assessments, initiatives, and analytics.',
'# API Introduction

## Overview

The IRIS API provides programmatic access to all platform capabilities. Build integrations, automate workflows, and extend functionality.

## Base URL

```
https://api.iris.technolex.io/v1
```

## Authentication

All API requests require authentication via:
- **API Keys** - For server-to-server
- **OAuth 2.0** - For user context

See [Authentication Guide](/docs/api-reference/api-authentication) for details.

## Response Format

All responses are JSON:

```json
{
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-01-20T12:00:00Z"
  }
}
```

## Rate Limits

| Plan | Requests/min | Requests/day |
|------|--------------|--------------|
| Starter | 60 | 10,000 |
| Professional | 300 | 100,000 |
| Enterprise | Custom | Custom |

## SDKs

Official SDKs available:
- JavaScript/TypeScript
- Python
- Java
- C# (.NET)

## Getting Started

1. [Create API Key](/settings/api-keys)
2. Make your first request
3. Explore endpoints

```bash
curl -X GET "https://api.iris.technolex.io/v1/assessments" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

[View Full API Reference](/docs/api-reference)');

-- ============================================
-- TROUBLESHOOTING ARTICLES
-- ============================================

INSERT OR IGNORE INTO kb_articles (id, category_id, slug, status, is_featured, is_public, reading_time_minutes, related_modules, target_audience) VALUES
    ('kb-art-faq-general', 'kb-cat-troubleshoot', 'frequently-asked-questions', 'published', 1, 1, 8, '[]', '["all"]'),
    ('kb-art-troubleshoot-login', 'kb-cat-troubleshoot', 'login-issues', 'published', 0, 1, 4, '["auth"]', '["all"]'),
    ('kb-art-troubleshoot-sync', 'kb-cat-troubleshoot', 'data-sync-issues', 'published', 0, 1, 5, '["integrations"]', '["admin"]'),
    ('kb-art-support', 'kb-cat-troubleshoot', 'contact-support', 'published', 0, 1, 2, '[]', '["all"]');

INSERT OR IGNORE INTO kb_article_translations (id, article_id, language, title, summary, content) VALUES
    ('kb-art-trans-faq-en', 'kb-art-faq-general', 'en',
     'Frequently Asked Questions',
     'Answers to common questions about IRIS platform, assessments, and features.',
'# Frequently Asked Questions

## General

### What is IRIS?
IRIS (Industrial Readiness & Intelligence System) is an enterprise platform for digital transformation assessment, planning, and execution.

### Which industries is IRIS designed for?
IRIS is designed for manufacturing and industrial organizations including automotive, aerospace, pharma, food & beverage, and discrete manufacturing.

### How is data secured?
IRIS is SOC 2 Type II certified with end-to-end encryption, GDPR compliance, and enterprise-grade security controls.

## Assessments

### How long does an assessment take?
The DRD assessment takes approximately 15-20 minutes. SIRI and multi-framework assessments may take 30-45 minutes.

### Can I pause and resume?
Yes, assessments auto-save after each section. You can continue where you left off.

### Who should complete assessments?
Ideally, cross-functional teams including operations, IT, HR, and executive leadership for comprehensive insights.

## AI Features

### What AI models does IRIS use?
IRIS uses multiple AI providers including OpenAI GPT-4, Anthropic Claude, and custom fine-tuned industrial models.

### Is my data used to train AI?
No. Your data is never used to train external AI models. All processing occurs within your secure tenant.

### Can I customize AI behavior?
Yes. Settings allow adjustment of response format, language, memory, and automation level.

## Pricing & Plans

### What plans are available?
Starter, Professional, and Enterprise tiers with varying features and usage limits.

### Is there a free trial?
Yes, 14-day free trial with full Professional features.

[Contact Support](/support)');

-- Update sort order for existing categories
UPDATE kb_categories SET sort_order = 1 WHERE slug = 'quick-guides';
UPDATE kb_categories SET sort_order = 2 WHERE slug = 'methodologies';
UPDATE kb_categories SET sort_order = 3 WHERE slug = 'best-practices';
UPDATE kb_categories SET sort_order = 4 WHERE slug = 'case-studies';
UPDATE kb_categories SET sort_order = 5 WHERE slug = 'tools-features';
