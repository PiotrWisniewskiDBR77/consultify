-- Delete ALL existing decisions
DELETE FROM decisions;

-- 10 fully-populated decisions (English)
-- Owner: piotr-dbr77, Org: org-dbr77-system, Project: project-dbr77-001
-- Initiative: init-dbr77-001 (Digital Performance Management)

-- ═══════════════════════════════════════════════════════
-- 1. PENDING — CRM Platform Selection
-- ═══════════════════════════════════════════════════════
INSERT INTO decisions (
  id, title, description, type, status, priority, impact,
  decision_maker_id, created_by, organization_id, project_id, initiative_id,
  deadline, escalation_deadline, escalation_level,
  options, criteria, pmo_domain, required,
  created_at, updated_at
) VALUES (
  'dec-rich-001',
  'Select CRM Platform for Enterprise Rollout',
  'Evaluate and select a CRM platform to replace the legacy Siebel system across 14 business units. The new platform must support multi-language, integrate with SAP ERP, and handle 50K+ active customer records. Budget envelope: $800K for licensing + implementation in Year 1.',
  'APPROVAL', 'pending', 'CRITICAL', 'HIGH',
  'piotr-dbr77', 'user-dbr77-justyna', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  datetime('now', '+3 days'), datetime('now', '+5 days'), 'none',
  '[{"id":"opt-sf","label":"Salesforce Enterprise","description":"Industry leader, highest cost, best ecosystem. $520K/yr licensing."},{"id":"opt-hub","label":"HubSpot Enterprise","description":"Strong marketing integration, lower cost. $280K/yr licensing."},{"id":"opt-dyn","label":"Microsoft Dynamics 365","description":"Deep Office 365 integration, mid-range cost. $350K/yr licensing."}]',
  '[{"id":"crit-1","label":"Total Cost of Ownership (3-year)","weight":30},{"id":"crit-2","label":"SAP ERP Integration Capability","weight":25},{"id":"crit-3","label":"User Adoption & Training Effort","weight":20},{"id":"crit-4","label":"Multi-language Support","weight":15},{"id":"crit-5","label":"Vendor Lock-in Risk","weight":10}]',
  'technology', 1,
  datetime('now', '-10 days'), datetime('now', '-1 days')
);

-- ═══════════════════════════════════════════════════════
-- 2. PENDING — Cloud Migration Strategy
-- ═══════════════════════════════════════════════════════
INSERT INTO decisions (
  id, title, description, type, status, priority, impact,
  decision_maker_id, created_by, organization_id, project_id, initiative_id,
  deadline, escalation_deadline, escalation_level,
  options, criteria, pmo_domain, required,
  created_at, updated_at
) VALUES (
  'dec-rich-002',
  'Approve Cloud Migration Strategy: Azure vs AWS',
  'Determine the primary cloud provider for the enterprise-wide migration of 47 on-premise workloads. Decision impacts 3-year infrastructure roadmap, team skill investments, and vendor negotiations. Current hybrid state costs $180K/month in dual maintenance.',
  'APPROVAL', 'pending', 'HIGH', 'HIGH',
  'piotr-dbr77', 'user-dbr77-pawel', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  datetime('now', '+5 days'), datetime('now', '+7 days'), 'none',
  '[{"id":"opt-azure","label":"Microsoft Azure","description":"Strong enterprise integration, existing EA agreement. 28% discount secured."},{"id":"opt-aws","label":"Amazon Web Services","description":"Broadest service catalog, team expertise. Requires new contract negotiation."},{"id":"opt-multi","label":"Multi-cloud (Azure primary + AWS secondary)","description":"Avoid vendor lock-in, higher operational complexity. +15% overhead cost."}]',
  '[{"id":"crit-1","label":"Cost Efficiency (3-year TCO)","weight":25},{"id":"crit-2","label":"Existing Team Expertise","weight":20},{"id":"crit-3","label":"Enterprise Agreement Terms","weight":20},{"id":"crit-4","label":"Service Breadth & Innovation","weight":15},{"id":"crit-5","label":"Compliance & Data Residency","weight":10},{"id":"crit-6","label":"Vendor Lock-in Risk","weight":10}]',
  'infrastructure', 1,
  datetime('now', '-14 days'), datetime('now', '-2 days')
);

-- ═══════════════════════════════════════════════════════
-- 3. PENDING — Budget Reallocation for AI Initiative
-- ═══════════════════════════════════════════════════════
INSERT INTO decisions (
  id, title, description, type, status, priority, impact,
  decision_maker_id, created_by, organization_id, project_id, initiative_id,
  deadline, escalation_deadline, escalation_level,
  options, criteria, pmo_domain, required,
  created_at, updated_at
) VALUES (
  'dec-rich-003',
  'Approve Q2 Budget Reallocation for AI Initiative',
  'Reallocate $450K from the deferred ERP Phase 3 budget to accelerate the AI-powered analytics initiative. The AI project has demonstrated 3x ROI in pilot phase but needs immediate funding to hit the Q3 launch window. ERP Phase 3 can be deferred to Q4 without business impact.',
  'APPROVAL', 'pending', 'HIGH', 'MEDIUM',
  'piotr-dbr77', 'user-dbr77-bartosz', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  datetime('now', '+2 days'), datetime('now', '+4 days'), 'none',
  '[{"id":"opt-full","label":"Full reallocation ($450K)","description":"Fully fund AI initiative, defer entire ERP Phase 3 to Q4."},{"id":"opt-partial","label":"Partial reallocation ($250K)","description":"Fund core AI features only, split ERP Phase 3 across Q3-Q4."},{"id":"opt-defer","label":"Defer AI to Q3, keep ERP timeline","description":"Maintain current budget allocation, AI initiative delayed 3 months."}]',
  '[{"id":"crit-1","label":"Expected ROI","weight":30},{"id":"crit-2","label":"Business Risk of ERP Delay","weight":25},{"id":"crit-3","label":"Market Window for AI Features","weight":25},{"id":"crit-4","label":"Team Capacity Impact","weight":20}]',
  'finance', 1,
  datetime('now', '-7 days'), datetime('now')
);

-- ═══════════════════════════════════════════════════════
-- 4. ESCALATED — Vendor Contract Renewal
-- ═══════════════════════════════════════════════════════
INSERT INTO decisions (
  id, title, description, type, status, priority, impact,
  decision_maker_id, created_by, organization_id, project_id, initiative_id,
  deadline, escalation_deadline, escalation_level,
  escalated_at, escalated_by, escalation_reason,
  options, criteria, pmo_domain, required,
  created_at, updated_at
) VALUES (
  'dec-rich-004',
  'Renew or Replace DataDog Monitoring Contract',
  'Current DataDog enterprise contract expires in 18 days. Annual spend: $340K. Usage has grown 40% YoY but budget is flat. Options: negotiate renewal with volume discount, migrate to open-source stack (Grafana + Prometheus), or evaluate Dynatrace as alternative. Migration risk: 6-week transition period with reduced observability.',
  'APPROVAL', 'escalated', 'CRITICAL', 'HIGH',
  'piotr-dbr77', 'user-dbr77-konard', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  datetime('now', '-2 days'), datetime('now', '-1 days'), 'amber',
  datetime('now', '-1 days'), 'user-dbr77-konard', 'Contract expires in 18 days. Original decision maker on PTO until next week. Requires immediate executive approval to avoid service disruption.',
  '[{"id":"opt-renew","label":"Renew DataDog (negotiate 15% discount)","description":"Lowest risk, maintain current tooling. Estimated $289K/yr after discount."},{"id":"opt-oss","label":"Migrate to open-source stack","description":"Grafana + Prometheus + Loki. $80K infrastructure cost + 6 weeks migration."},{"id":"opt-dynatrace","label":"Switch to Dynatrace","description":"AI-powered observability, $310K/yr. 4-week migration with vendor support."}]',
  '[{"id":"crit-1","label":"Continuity Risk","weight":30},{"id":"crit-2","label":"Annual Cost","weight":25},{"id":"crit-3","label":"Feature Coverage","weight":20},{"id":"crit-4","label":"Migration Effort","weight":15},{"id":"crit-5","label":"Team Skill Availability","weight":10}]',
  'operations', 1,
  datetime('now', '-20 days'), datetime('now', '-1 days')
);

-- ═══════════════════════════════════════════════════════
-- 5. ESCALATED — Data Governance Policy
-- ═══════════════════════════════════════════════════════
INSERT INTO decisions (
  id, title, description, type, status, priority, impact,
  decision_maker_id, created_by, organization_id, project_id, initiative_id,
  deadline, escalation_deadline, escalation_level,
  escalated_at, escalated_by, escalation_reason,
  options, criteria, pmo_domain, required,
  created_at, updated_at
) VALUES (
  'dec-rich-005',
  'Approve Enterprise Data Governance Framework',
  'Establish a unified data governance framework to comply with GDPR, CCPA, and upcoming EU AI Act requirements. Currently operating with inconsistent data policies across 6 departments. Legal has flagged non-compliance risk at $2.4M in potential fines. Framework must define data ownership, classification, retention, and access controls.',
  'GO_NO_GO', 'escalated', 'CRITICAL', 'HIGH',
  'piotr-dbr77', 'user-dbr77-katarzyna-m', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  datetime('now', '-4 days'), datetime('now', '-2 days'), 'amber',
  datetime('now', '-2 days'), 'user-dbr77-katarzyna-m', 'Legal department flagged imminent regulatory deadline. Board audit committee requires framework approval before March 1st.',
  '[{"id":"opt-go","label":"GO — Implement full framework","description":"6-month rollout, $180K consulting + $60K tooling. Full compliance by Q3."},{"id":"opt-phased","label":"GO (Phased) — Critical areas first","description":"Phase 1: PII & financial data (8 weeks). Phase 2: remaining data classes (Q4)."},{"id":"opt-nogo","label":"NO-GO — Defer to next fiscal year","description":"Accept regulatory risk. Estimated exposure: $2.4M in fines + reputational damage."}]',
  '[{"id":"crit-1","label":"Regulatory Compliance","weight":35},{"id":"crit-2","label":"Implementation Cost","weight":20},{"id":"crit-3","label":"Organizational Readiness","weight":20},{"id":"crit-4","label":"Risk Exposure Reduction","weight":15},{"id":"crit-5","label":"Timeline Feasibility","weight":10}]',
  'governance', 1,
  datetime('now', '-30 days'), datetime('now', '-2 days')
);

-- ═══════════════════════════════════════════════════════
-- 6. PENDING — Hire Senior Architect
-- ═══════════════════════════════════════════════════════
INSERT INTO decisions (
  id, title, description, type, status, priority, impact,
  decision_maker_id, created_by, organization_id, project_id, initiative_id,
  deadline, escalation_deadline, escalation_level,
  options, criteria, pmo_domain, required,
  created_at, updated_at
) VALUES (
  'dec-rich-006',
  'Approve Hiring: Senior Solutions Architect',
  'Request to open a Senior Solutions Architect position ($165K-$195K base + equity). The role is critical for leading the microservices migration and mentoring 4 mid-level engineers. Current team is blocked on architectural decisions, creating a 3-week delivery bottleneck. Two strong candidates identified through referral pipeline.',
  'APPROVAL', 'pending', 'MEDIUM', 'MEDIUM',
  'piotr-dbr77', 'user-dbr77-torian', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  datetime('now', '+7 days'), datetime('now', '+10 days'), 'none',
  '[{"id":"opt-hire-full","label":"Hire full-time Senior Architect","description":"$165K-$195K base + equity. 4-6 week hiring timeline."},{"id":"opt-contract","label":"Engage contract architect (6 months)","description":"$250/hr, ~$130K for 6 months. Immediate start, no long-term commitment."},{"id":"opt-promote","label":"Promote internal candidate + training","description":"Promote mid-level engineer, $30K training budget. 3-month ramp-up period."},{"id":"opt-defer","label":"Defer hiring to Q3","description":"Absorb bottleneck, redistribute work. Risk: 2 engineers considering offers elsewhere."}]',
  '[{"id":"crit-1","label":"Speed to Productivity","weight":25},{"id":"crit-2","label":"Long-term Team Building","weight":25},{"id":"crit-3","label":"Budget Impact","weight":20},{"id":"crit-4","label":"Delivery Unblocking","weight":20},{"id":"crit-5","label":"Retention Risk Mitigation","weight":10}]',
  'people', 1,
  datetime('now', '-5 days'), datetime('now')
);

-- ═══════════════════════════════════════════════════════
-- 7. PENDING — API Versioning Strategy
-- ═══════════════════════════════════════════════════════
INSERT INTO decisions (
  id, title, description, type, status, priority, impact,
  decision_maker_id, created_by, organization_id, project_id, initiative_id,
  deadline, escalation_deadline, escalation_level,
  options, criteria, pmo_domain, required,
  created_at, updated_at
) VALUES (
  'dec-rich-007',
  'Define API Versioning & Deprecation Strategy',
  'Establish a company-wide API versioning standard as we scale to 45+ external integrations. Currently running 3 incompatible versioning schemes across teams. Need to define: version format, deprecation policy, migration support period, and breaking change communication. Decision impacts all 8 product teams and 120+ API consumers.',
  'OTHER', 'pending', 'MEDIUM', 'MEDIUM',
  'piotr-dbr77', 'user-dbr77-pawel', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  datetime('now', '+10 days'), datetime('now', '+14 days'), 'none',
  '[{"id":"opt-semver","label":"Semantic versioning in URL path","description":"/api/v2/resource — Simple, explicit, widely understood. Breaking changes = major version bump."},{"id":"opt-header","label":"Header-based versioning","description":"Accept: application/vnd.company.v2+json — Cleaner URLs, more complex client implementation."},{"id":"opt-graphql","label":"Move to GraphQL (no versioning needed)","description":"Schema evolution handles changes. 6-month migration, requires team retraining."}]',
  '[{"id":"crit-1","label":"Developer Experience","weight":30},{"id":"crit-2","label":"Migration Complexity","weight":25},{"id":"crit-3","label":"Backward Compatibility","weight":20},{"id":"crit-4","label":"Team Adoption Speed","weight":15},{"id":"crit-5","label":"Industry Standard Alignment","weight":10}]',
  'technology', 0,
  datetime('now', '-8 days'), datetime('now', '-1 days')
);

-- ═══════════════════════════════════════════════════════
-- 8. APPROVED — Production Kubernetes Upgrade
-- ═══════════════════════════════════════════════════════
INSERT INTO decisions (
  id, title, description, type, status, priority, impact,
  decision_maker_id, created_by, organization_id, project_id, initiative_id,
  deadline, escalation_deadline, escalation_level,
  options, criteria, pmo_domain, required,
  selected_option, decision_rationale, decided_at,
  created_at, updated_at
) VALUES (
  'dec-rich-008',
  'GO/NO-GO: Production Kubernetes 1.29 Upgrade',
  'Approve the in-place upgrade of production Kubernetes cluster from 1.27 to 1.29. Upgrade required to maintain vendor support (1.27 EOL in 45 days) and enable new features: gateway API, sidecar containers, and improved HPA. Rollback plan tested. 4-hour maintenance window scheduled for Saturday 2AM.',
  'GO_NO_GO', 'approved', 'HIGH', 'HIGH',
  'piotr-dbr77', 'user-dbr77-bartosz', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  datetime('now', '-5 days'), datetime('now', '-3 days'), 'none',
  '[{"id":"opt-go","label":"GO — Proceed with upgrade","description":"4-hour maintenance window Saturday 2AM. Rollback tested and ready."},{"id":"opt-defer","label":"Defer to next maintenance window","description":"2 weeks delay. Still within 1.27 support window."},{"id":"opt-nogo","label":"NO-GO — Skip 1.29, wait for 1.30","description":"6-week delay. 1.27 will be EOL, vendor support gap."}]',
  '[{"id":"crit-1","label":"Rollback Safety","weight":30},{"id":"crit-2","label":"Testing Coverage","weight":25},{"id":"crit-3","label":"Business Impact of Downtime","weight":20},{"id":"crit-4","label":"EOL Urgency","weight":15},{"id":"crit-5","label":"New Feature Value","weight":10}]',
  'infrastructure', 1,
  'opt-go',
  'All staging tests passed. Rollback plan verified in DR environment. Maintenance window approved by all stakeholders. On-call team briefed and ready. Proceeding with Saturday 2AM upgrade window.',
  datetime('now', '-5 days'),
  datetime('now', '-15 days'), datetime('now', '-5 days')
);

-- ═══════════════════════════════════════════════════════
-- 9. APPROVED — Open-Source Contribution Policy
-- ═══════════════════════════════════════════════════════
INSERT INTO decisions (
  id, title, description, type, status, priority, impact,
  decision_maker_id, created_by, organization_id, project_id, initiative_id,
  deadline, escalation_deadline, escalation_level,
  options, criteria, pmo_domain, required,
  selected_option, decision_rationale, decided_at,
  created_at, updated_at
) VALUES (
  'dec-rich-009',
  'Approve Open-Source Contribution Policy',
  'Establish a formal policy allowing engineers to contribute to open-source projects during work hours (up to 10% time). Legal has reviewed IP implications. Policy includes: contribution approval workflow, allowed license types (MIT, Apache 2.0, BSD), prohibited projects list, and public disclosure guidelines. 23 engineers have expressed interest.',
  'APPROVAL', 'approved', 'MEDIUM', 'MEDIUM',
  'piotr-dbr77', 'user-dbr77-torian', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  datetime('now', '-8 days'), datetime('now', '-5 days'), 'none',
  '[{"id":"opt-full","label":"Approve full policy (10% time)","description":"Engineers can contribute 4 hours/week to approved OSS projects."},{"id":"opt-limited","label":"Limited policy (5% time, senior+ only)","description":"Senior engineers only, 2 hours/week, manager approval per contribution."},{"id":"opt-reject","label":"Reject — maintain current policy","description":"No work-time contributions. Personal time only."}]',
  '[{"id":"crit-1","label":"Employer Brand & Recruiting","weight":30},{"id":"crit-2","label":"IP & Legal Risk","weight":25},{"id":"crit-3","label":"Productivity Impact","weight":20},{"id":"crit-4","label":"Engineer Satisfaction","weight":15},{"id":"crit-5","label":"Knowledge Development","weight":10}]',
  'people', 0,
  'opt-full',
  'Legal review completed with no blockers. Strong signal from engineering team. Competitive advantage for recruiting in tight talent market. Policy includes safeguards (approval workflow, prohibited list, no proprietary code). Trial period: 6 months with quarterly review.',
  datetime('now', '-8 days'),
  datetime('now', '-20 days'), datetime('now', '-8 days')
);

-- ═══════════════════════════════════════════════════════
-- 10. APPROVED — GenAI Usage Policy
-- ═══════════════════════════════════════════════════════
INSERT INTO decisions (
  id, title, description, type, status, priority, impact,
  decision_maker_id, created_by, organization_id, project_id, initiative_id,
  deadline, escalation_deadline, escalation_level,
  options, criteria, pmo_domain, required,
  selected_option, decision_rationale, decided_at,
  created_at, updated_at
) VALUES (
  'dec-rich-010',
  'Approve Enterprise GenAI Acceptable Use Policy',
  'Define and approve the enterprise-wide policy for Generative AI tool usage (ChatGPT, Claude, Copilot, Midjourney). Policy covers: approved tools list, data classification restrictions (no PII or confidential data in prompts), code review requirements for AI-generated code, procurement guidelines, and audit trail requirements. 78% of employees already using GenAI tools informally.',
  'APPROVAL', 'approved', 'HIGH', 'HIGH',
  'piotr-dbr77', 'user-dbr77-katarzyna-s', 'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  datetime('now', '-12 days'), datetime('now', '-10 days'), 'none',
  '[{"id":"opt-open","label":"Open policy with guardrails","description":"All approved tools available to everyone. Mandatory training + data classification rules."},{"id":"opt-restricted","label":"Restricted by role and classification","description":"Engineering: Copilot + Claude. Marketing: ChatGPT. No confidential data."},{"id":"opt-ban","label":"Temporary ban pending full assessment","description":"Block all GenAI tools until comprehensive security audit complete (est. 3 months)."}]',
  '[{"id":"crit-1","label":"Data Security & Privacy","weight":30},{"id":"crit-2","label":"Productivity Gains","weight":25},{"id":"crit-3","label":"Regulatory Compliance","weight":20},{"id":"crit-4","label":"Employee Satisfaction","weight":15},{"id":"crit-5","label":"Competitive Positioning","weight":10}]',
  'governance', 1,
  'opt-open',
  'Balanced approach: enable innovation while maintaining security. Mandatory training completion before tool access. Quarterly audit of usage patterns. Data classification enforcement via DLP tools. 90-day review cycle to update approved tools list. CISO and Legal both signed off.',
  datetime('now', '-12 days'),
  datetime('now', '-25 days'), datetime('now', '-12 days')
);
