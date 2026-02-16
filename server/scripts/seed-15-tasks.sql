-- Delete ALL existing tasks
DELETE FROM tasks;

-- 15 fully-populated tasks (English)
-- User: piotr-dbr77, Org: org-dbr77-system, Project: project-dbr77-001
-- Initiative: init-dbr77-001 (Digital Performance Management)

-- ═══════════════════════════════════════════════════════
-- 1. OVERDUE — Review Q4 Budget Report
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at
) VALUES (
  'task-rich-001',
  'Review Q4 Budget Report',
  'Analyze the quarterly budget report from the finance department. Verify actual vs. forecasted spend across all cost centers. Flag deviations >10% and prepare a summary with recommendations for the CFO review meeting.',
  'in_progress', 'high',
  datetime('now', '-5 days'), datetime('now', '-12 days'),
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'review', 'execution', 8, 0, 0,
  'medium',
  '1. All cost center variances documented
2. Summary report delivered to CFO
3. Deviations >10% highlighted with root cause',
  '',
  '["finance","quarterly","budget"]',
  '[{"id":"c1","text":"Download raw budget data from SAP","completed":true},{"id":"c2","text":"Compare actuals vs forecast per cost center","completed":true},{"id":"c3","text":"Identify deviations above threshold","completed":false},{"id":"c4","text":"Write executive summary","completed":false}]',
  'Board requires quarterly budget transparency report before next governance meeting.',
  datetime('now', '-14 days'), datetime('now', '-1 days')
);

-- ═══════════════════════════════════════════════════════
-- 2. OVERDUE — Submit Compliance Documentation
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at
) VALUES (
  'task-rich-002',
  'Submit Compliance Documentation',
  'Complete and submit the required SOC 2 Type II compliance documentation package for the annual external audit. Includes evidence collection, control narratives, and gap remediation sign-offs from all department heads.',
  'todo', 'critical',
  datetime('now', '-2 days'), NULL,
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'compliance', 'design', 16, 2500, 800,
  'high',
  '1. All 47 control narratives completed
2. Evidence artifacts uploaded to GRC portal
3. Department head sign-offs obtained
4. External auditor notified of submission',
  'Waiting for CISO sign-off on Section 4.2 (access control narratives)',
  '["compliance","audit","soc2","critical"]',
  '[{"id":"c1","text":"Collect evidence for access control policies","completed":true},{"id":"c2","text":"Update change management narratives","completed":true},{"id":"c3","text":"Obtain CISO sign-off","completed":false},{"id":"c4","text":"Upload to GRC portal","completed":false},{"id":"c5","text":"Notify external auditor","completed":false}]',
  'SOC 2 certification renewal deadline is end of month. Non-compliance blocks client onboarding.',
  datetime('now', '-20 days'), datetime('now', '-1 days')
);

-- ═══════════════════════════════════════════════════════
-- 3. OVERDUE — Fix Critical Production Bug
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at
) VALUES (
  'task-rich-003',
  'Fix Critical Production Bug',
  'Investigate and resolve the memory leak in the payment processing module. The issue causes pod OOMKills after ~4h under production load. Root cause suspected in the retry logic of the Stripe webhook handler. Hotfix required before next business day.',
  'in_progress', 'critical',
  datetime('now', '-1 days'), datetime('now', '-2 days'),
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'bugfix', 'execution', 6, 0, 0,
  'critical',
  '1. Memory leak eliminated — pods stable >24h
2. No regressions in payment flow
3. Load test passed at 2x production traffic
4. Post-mortem documented',
  'Staging environment currently down — DevOps fixing k8s cluster',
  '["production","hotfix","payments","p0"]',
  '[{"id":"c1","text":"Reproduce locally with heap profiling","completed":true},{"id":"c2","text":"Identify root cause in webhook handler","completed":true},{"id":"c3","text":"Implement fix and unit tests","completed":false},{"id":"c4","text":"Run load test in staging","completed":false},{"id":"c5","text":"Deploy hotfix to production","completed":false},{"id":"c6","text":"Monitor for 24h and write post-mortem","completed":false}]',
  'Payment failures directly impact revenue. 3 client escalations received in last 48h.',
  datetime('now', '-3 days'), datetime('now')
);

-- ═══════════════════════════════════════════════════════
-- 4. TODAY — Team Standup Presentation
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at
) VALUES (
  'task-rich-004',
  'Team Standup Presentation',
  'Prepare and deliver the weekly progress update to the cross-functional team (12 people). Cover: sprint burndown, blockers, key decisions needed, and upcoming milestones. Include demo of the new reporting feature shipped this week.',
  'todo', 'medium',
  datetime('now'), NULL,
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'communication', 'execution', 2, 0, 0,
  'low',
  '1. Slide deck prepared (max 8 slides)
2. Demo environment ready
3. All blockers documented with owners
4. Action items captured and assigned',
  '',
  '["standup","weekly","team"]',
  '[{"id":"c1","text":"Update burndown chart from Jira","completed":false},{"id":"c2","text":"Prepare demo environment","completed":false},{"id":"c3","text":"List blockers and decisions needed","completed":false},{"id":"c4","text":"Send calendar invite with agenda","completed":false}]',
  'Weekly alignment meeting ensures team stays on track and blockers are resolved quickly.',
  datetime('now', '-7 days'), datetime('now')
);

-- ═══════════════════════════════════════════════════════
-- 5. TODAY — Review Pull Requests
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at
) VALUES (
  'task-rich-005',
  'Review Pull Requests',
  'Review and approve 4 pending pull requests from the development team. PRs include: authentication refactor (#412), dashboard performance optimization (#415), API rate limiting (#418), and dark mode fixes (#420). Each requires security and performance review.',
  'in_progress', 'high',
  datetime('now'), datetime('now'),
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'review', 'execution', 4, 0, 0,
  'low',
  '1. All 4 PRs reviewed with inline comments
2. Security implications assessed
3. Performance benchmarks verified
4. CI/CD pipeline green before merge',
  '',
  '["code-review","engineering","pr"]',
  '[{"id":"c1","text":"Review PR #412 — auth refactor","completed":true},{"id":"c2","text":"Review PR #415 — dashboard perf","completed":true},{"id":"c3","text":"Review PR #418 — rate limiting","completed":false},{"id":"c4","text":"Review PR #420 — dark mode fixes","completed":false}]',
  'Blocking 3 team members from merging. Sprint velocity at risk if not completed today.',
  datetime('now', '-2 days'), datetime('now')
);

-- ═══════════════════════════════════════════════════════
-- 6. THIS WEEK — Update Project Documentation
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at
) VALUES (
  'task-rich-006',
  'Update Project Documentation',
  'Bring the technical documentation up to date with recent API changes (v2.4 to v2.5). Update OpenAPI specs, integration guides, error code reference, and the onboarding tutorial. Ensure all code examples are tested and working.',
  'todo', 'medium',
  datetime('now', '+2 days'), NULL,
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'documentation', 'design', 10, 0, 0,
  'low',
  '1. OpenAPI spec matches production API
2. All code examples compile and run
3. Integration guide updated for v2.5 breaking changes
4. Published to docs portal',
  '',
  '["documentation","api","developer-experience"]',
  '[{"id":"c1","text":"Audit current docs vs actual API","completed":false},{"id":"c2","text":"Update OpenAPI spec","completed":false},{"id":"c3","text":"Rewrite breaking changes section","completed":false},{"id":"c4","text":"Test all code examples","completed":false},{"id":"c5","text":"Publish to portal","completed":false}]',
  'Client onboarding team reports 40% of support tickets stem from outdated documentation.',
  datetime('now', '-5 days'), datetime('now', '-1 days')
);

-- ═══════════════════════════════════════════════════════
-- 7. THIS WEEK — Prepare Demo for Stakeholders
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at
) VALUES (
  'task-rich-007',
  'Prepare Demo for Stakeholders',
  'Build a compelling demo environment for the upcoming executive stakeholder meeting. Showcase: AI-powered reporting, real-time dashboards, and the new decision management module. Prepare scripted walkthrough and backup slides for offline fallback.',
  'todo', 'high',
  datetime('now', '+3 days'), NULL,
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'execution', 'design', 12, 500, 0,
  'medium',
  '1. Demo environment stable with realistic data
2. Scripted walkthrough tested end-to-end
3. Backup slides ready for offline scenario
4. Q&A prep document with anticipated questions',
  '',
  '["demo","stakeholders","executive"]',
  '[{"id":"c1","text":"Seed demo environment with realistic data","completed":false},{"id":"c2","text":"Build scripted walkthrough (15 min)","completed":false},{"id":"c3","text":"Create backup slides","completed":false},{"id":"c4","text":"Prepare Q&A document","completed":false},{"id":"c5","text":"Dry run with product team","completed":false}]',
  'Executive buy-in needed to secure Phase 3 funding ($2.1M). Meeting scheduled for Friday.',
  datetime('now', '-3 days'), datetime('now')
);

-- ═══════════════════════════════════════════════════════
-- 8. THIS WEEK — Code Review Session
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at
) VALUES (
  'task-rich-008',
  'Architecture Review Session',
  'Conduct a structured code review session for the new event-driven architecture implementation. Review covers: message broker integration, dead letter queue handling, idempotency patterns, and observability instrumentation. 3 senior engineers participating.',
  'todo', 'medium',
  datetime('now', '+4 days'), NULL,
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'review', 'execution', 3, 0, 0,
  'low',
  '1. All critical paths reviewed
2. Idempotency patterns validated
3. Dead letter queue tested
4. Observability meets SLI requirements
5. Action items assigned',
  '',
  '["architecture","review","event-driven"]',
  '[{"id":"c1","text":"Distribute code for pre-review","completed":false},{"id":"c2","text":"Prepare review checklist","completed":false},{"id":"c3","text":"Run session (90 min)","completed":false},{"id":"c4","text":"Document findings and action items","completed":false}]',
  'Architecture decision gate — event-driven migration cannot proceed without sign-off.',
  datetime('now', '-2 days'), datetime('now')
);

-- ═══════════════════════════════════════════════════════
-- 9. THIS WEEK — Infrastructure Planning
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at
) VALUES (
  'task-rich-009',
  'Cloud Infrastructure Planning',
  'Plan cloud infrastructure upgrades for Q2. Evaluate: migrating from EKS to ECS Fargate for cost optimization, implementing multi-region DR, upgrading RDS to Aurora, and right-sizing current EC2 fleet. Produce a costed proposal with timeline.',
  'todo', 'low',
  datetime('now', '+5 days'), NULL,
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'planning', 'design', 20, 0, 0,
  'medium',
  '1. Cost comparison document (current vs proposed)
2. Risk assessment for each change
3. Migration timeline with milestones
4. CTO approval obtained',
  '',
  '["infrastructure","cloud","cost-optimization","planning"]',
  '[{"id":"c1","text":"Audit current AWS spend by service","completed":false},{"id":"c2","text":"Model ECS Fargate costs","completed":false},{"id":"c3","text":"Design multi-region DR architecture","completed":false},{"id":"c4","text":"Prepare costed proposal","completed":false},{"id":"c5","text":"Present to CTO for approval","completed":false}]',
  'Current infrastructure costs growing 15% MoM. Board mandated 20% cloud cost reduction by Q3.',
  datetime('now', '-7 days'), datetime('now')
);

-- ═══════════════════════════════════════════════════════
-- 10. LATER — Annual Performance Reviews
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at
) VALUES (
  'task-rich-010',
  'Annual Performance Reviews',
  'Complete performance review documentation for all 8 direct reports. Write calibrated assessments covering: delivery quality, leadership behaviors, technical growth, and cross-team impact. Prepare compensation adjustment recommendations.',
  'todo', 'medium',
  datetime('now', '+14 days'), NULL,
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'management', 'design', 24, 0, 0,
  'low',
  '1. All 8 reviews written and calibrated
2. Self-assessment inputs incorporated
3. Peer feedback summarized
4. Compensation recommendations submitted to HR
5. 1:1 delivery meetings scheduled',
  '',
  '["performance","management","hr","annual"]',
  '[{"id":"c1","text":"Collect self-assessments from team","completed":false},{"id":"c2","text":"Gather peer feedback (360)","completed":false},{"id":"c3","text":"Write individual assessments","completed":false},{"id":"c4","text":"Calibration session with VP","completed":false},{"id":"c5","text":"Submit to HR","completed":false},{"id":"c6","text":"Schedule 1:1 delivery meetings","completed":false}]',
  'Annual review cycle deadline March 1. Compensation adjustments effective April 1.',
  datetime('now', '-10 days'), datetime('now')
);

-- ═══════════════════════════════════════════════════════
-- 11. LATER — Technology Stack Evaluation
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at
) VALUES (
  'task-rich-011',
  'Technology Stack Evaluation',
  'Evaluate emerging technologies for potential adoption in 2027 roadmap. Focus areas: AI/ML frameworks (LangChain vs LlamaIndex), edge computing platforms, real-time data streaming (Kafka vs Pulsar), and observability (OpenTelemetry maturity). Produce recommendation matrix.',
  'todo', 'low',
  datetime('now', '+30 days'), NULL,
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'research', 'design', 32, 1000, 0,
  'low',
  '1. Evaluation matrix with weighted criteria
2. PoC results for top 2 candidates per category
3. TCO analysis (3-year)
4. Team skill gap assessment
5. CTO-approved recommendation',
  '',
  '["research","technology","strategy","2027"]',
  '[{"id":"c1","text":"Define evaluation criteria and weights","completed":false},{"id":"c2","text":"Research AI/ML frameworks","completed":false},{"id":"c3","text":"Research edge computing","completed":false},{"id":"c4","text":"Research streaming platforms","completed":false},{"id":"c5","text":"Build PoCs for top candidates","completed":false},{"id":"c6","text":"Write recommendation report","completed":false}]',
  'Technology strategy refresh required for 2027 roadmap planning starting Q3.',
  datetime('now', '-5 days'), datetime('now')
);

-- ═══════════════════════════════════════════════════════
-- 12. NO DATE — Refactor Authentication Module
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at
) VALUES (
  'task-rich-012',
  'Refactor Authentication Module',
  'Refactor the legacy authentication module to support OAuth 2.0 + PKCE, SAML SSO, and multi-factor authentication. Current implementation is monolithic with hard-coded providers. Target: modular auth adapter pattern with pluggable providers.',
  'todo', 'medium',
  NULL, NULL,
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'refactoring', 'design', 40, 0, 0,
  'high',
  '1. Auth adapter interface defined
2. OAuth 2.0 + PKCE working
3. SAML SSO integrated
4. MFA support (TOTP + WebAuthn)
5. Zero-downtime migration plan
6. Security audit passed',
  'Depends on Identity Provider contract finalization (legal review in progress)',
  '["security","auth","refactoring","architecture"]',
  '[{"id":"c1","text":"Design auth adapter interface","completed":false},{"id":"c2","text":"Implement OAuth 2.0 + PKCE provider","completed":false},{"id":"c3","text":"Implement SAML SSO provider","completed":false},{"id":"c4","text":"Add MFA support","completed":false},{"id":"c5","text":"Write migration plan","completed":false},{"id":"c6","text":"Security audit","completed":false}]',
  'Enterprise clients require SAML SSO. Currently blocking 3 deals worth $450K ARR.',
  datetime('now', '-15 days'), datetime('now')
);

-- ═══════════════════════════════════════════════════════
-- 13. NO DATE — Research AI Integration Options
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at
) VALUES (
  'task-rich-013',
  'Research AI Integration Options',
  'Explore AI/ML integration possibilities for product enhancement. Evaluate: GPT-4o for document summarization, Claude for structured analysis, Whisper for meeting transcription, and custom fine-tuned models for domain-specific classification. Build cost model and architecture proposal.',
  'todo', 'low',
  NULL, NULL,
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'research', 'design', 24, 2000, 150,
  'medium',
  '1. Model comparison matrix (quality, latency, cost)
2. Architecture proposal for AI layer
3. Cost projection (per-user per-month)
4. Data privacy assessment
5. PoC for top use case',
  '',
  '["ai","research","product","innovation"]',
  '[{"id":"c1","text":"Benchmark GPT-4o for summarization","completed":true},{"id":"c2","text":"Benchmark Claude for analysis","completed":false},{"id":"c3","text":"Test Whisper for transcription","completed":false},{"id":"c4","text":"Evaluate fine-tuning options","completed":false},{"id":"c5","text":"Build cost model","completed":false},{"id":"c6","text":"Write architecture proposal","completed":false}]',
  'AI features are top-3 requested capability in customer survey (78% interest).',
  datetime('now', '-8 days'), datetime('now')
);

-- ═══════════════════════════════════════════════════════
-- 14. COMPLETED — Deploy v2.5 Release
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at, completed_at
) VALUES (
  'task-rich-014',
  'Deploy v2.5 Release',
  'Successfully planned and executed the v2.5 production deployment. Included: 47 features, 23 bug fixes, database migration with zero downtime, and rollback verification. Coordinated across 4 teams with 12-hour deployment window.',
  'done', 'high',
  datetime('now', '-3 days'), datetime('now', '-10 days'),
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'deployment', 'execution', 16, 0, 0,
  'high',
  '1. All services healthy post-deploy
2. Error rate below 0.1% threshold
3. Rollback tested and verified
4. Release notes published
5. Customer communication sent',
  '',
  '["deployment","release","production"]',
  '[{"id":"c1","text":"Pre-deploy checklist completed","completed":true},{"id":"c2","text":"Database migration executed","completed":true},{"id":"c3","text":"Services deployed and healthy","completed":true},{"id":"c4","text":"Smoke tests passed","completed":true},{"id":"c5","text":"Rollback verified","completed":true},{"id":"c6","text":"Release notes published","completed":true}]',
  'Quarterly release cadence. Client commitments for 3 key features in this release.',
  datetime('now', '-12 days'), datetime('now', '-3 days'), datetime('now', '-3 days')
);

-- ═══════════════════════════════════════════════════════
-- 15. COMPLETED — Security Audit
-- ═══════════════════════════════════════════════════════
INSERT INTO tasks (
  id, title, description, status, priority, due_date, started_at,
  assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
  task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
  risk_rating, acceptance_criteria, blocking_issues, tags, checklist, why,
  created_at, updated_at, completed_at
) VALUES (
  'task-rich-015',
  'Security Audit Completion',
  'Completed the quarterly penetration test and security audit with CrowdStrike. Scope covered: web application, API endpoints, infrastructure, and social engineering vectors. No critical findings. 4 medium-severity issues identified and remediated within SLA.',
  'done', 'critical',
  datetime('now', '-7 days'), datetime('now', '-21 days'),
  'piotr-dbr77', 'piotr-dbr77', 'piotr-dbr77',
  'org-dbr77-system', 'project-dbr77-001', 'init-dbr77-001',
  'compliance', 'execution', 40, 15000, 14200,
  'high',
  '1. Pen test report received
2. All critical/high findings remediated
3. Medium findings remediated within 30 days
4. CISO sign-off obtained
5. Audit trail documented',
  '',
  '["security","audit","compliance","penetration-test"]',
  '[{"id":"c1","text":"Kick-off with CrowdStrike","completed":true},{"id":"c2","text":"Provide access and scoping docs","completed":true},{"id":"c3","text":"Review preliminary findings","completed":true},{"id":"c4","text":"Remediate medium-severity issues","completed":true},{"id":"c5","text":"Retest and verify fixes","completed":true},{"id":"c6","text":"Obtain CISO sign-off","completed":true},{"id":"c7","text":"Archive final report","completed":true}]',
  'Regulatory requirement for financial services clients. Quarterly cadence mandated by CISO.',
  datetime('now', '-25 days'), datetime('now', '-7 days'), datetime('now', '-7 days')
);
