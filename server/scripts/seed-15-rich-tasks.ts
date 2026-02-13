#!/usr/bin/env node
/**
 * Seed 15 rich, fully-populated tasks (English)
 * Deletes all existing tasks first, then inserts 15 well-filled ones.
 *
 * Usage: cd server && DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/seed-15-rich-tasks.ts
 */

import { v4 as uuidv4 } from 'uuid';
import { createDatabase } from '../src/database/Database.js';

const c = { r: '\x1b[0m', g: '\x1b[32m', y: '\x1b[33m', c: '\x1b[36m', d: '\x1b[2m', red: '\x1b[31m' };

const today = new Date();
const addDays = (days: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};
const pastDate = (days: number) => addDays(-days);

const tasks = [
  // ── OVERDUE ──────────────────────────────
  {
    title: 'Review Q4 Budget Report',
    description: 'Analyze the quarterly budget report from the finance department. Verify actual vs. forecasted spend across all cost centers. Flag deviations >10% and prepare a summary with recommendations for the CFO review meeting.',
    status: 'in_progress',
    priority: 'high',
    due_date: addDays(-5),
    started_at: pastDate(12),
    task_type: 'review',
    step_phase: 'execution',
    estimated_hours: 8,
    budget_allocated: 0,
    budget_spent: 0,
    risk_rating: 'medium',
    acceptance_criteria: '1. All cost center variances documented\\n2. Summary report delivered to CFO\\n3. Deviations >10% highlighted with root cause',
    tags: JSON.stringify(['finance', 'quarterly', 'budget']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Download raw budget data from SAP', completed: true },
      { id: 'c2', text: 'Compare actuals vs forecast per cost center', completed: true },
      { id: 'c3', text: 'Identify deviations above threshold', completed: false },
      { id: 'c4', text: 'Write executive summary', completed: false },
    ]),
    why: 'Board requires quarterly budget transparency report before next governance meeting.',
  },
  {
    title: 'Submit compliance documentation',
    description: 'Complete and submit the required SOC 2 Type II compliance documentation package for the annual external audit. Includes evidence collection, control narratives, and gap remediation sign-offs from all department heads.',
    status: 'todo',
    priority: 'critical',
    due_date: addDays(-2),
    started_at: null,
    task_type: 'compliance',
    step_phase: 'design',
    estimated_hours: 16,
    budget_allocated: 2500,
    budget_spent: 800,
    risk_rating: 'high',
    acceptance_criteria: '1. All 47 control narratives completed\\n2. Evidence artifacts uploaded to GRC portal\\n3. Department head sign-offs obtained\\n4. External auditor notified of submission',
    tags: JSON.stringify(['compliance', 'audit', 'soc2', 'critical']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Collect evidence for access control policies', completed: true },
      { id: 'c2', text: 'Update change management narratives', completed: true },
      { id: 'c3', text: 'Obtain CISO sign-off', completed: false },
      { id: 'c4', text: 'Upload to GRC portal', completed: false },
      { id: 'c5', text: 'Notify external auditor', completed: false },
    ]),
    why: 'SOC 2 certification renewal deadline is end of month. Non-compliance blocks client onboarding.',
  },
  {
    title: 'Fix critical production bug',
    description: 'Investigate and resolve the memory leak in the payment processing module. The issue causes pod OOMKills after ~4h under production load. Root cause suspected in the retry logic of the Stripe webhook handler. Hotfix required before next business day.',
    status: 'in_progress',
    priority: 'critical',
    due_date: addDays(-1),
    started_at: pastDate(2),
    task_type: 'bugfix',
    step_phase: 'execution',
    estimated_hours: 6,
    budget_allocated: 0,
    budget_spent: 0,
    risk_rating: 'critical',
    acceptance_criteria: '1. Memory leak eliminated — pods stable >24h\\n2. No regressions in payment flow\\n3. Load test passed at 2x production traffic\\n4. Post-mortem documented',
    tags: JSON.stringify(['production', 'hotfix', 'payments', 'p0']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Reproduce locally with heap profiling', completed: true },
      { id: 'c2', text: 'Identify root cause in webhook handler', completed: true },
      { id: 'c3', text: 'Implement fix and unit tests', completed: false },
      { id: 'c4', text: 'Run load test in staging', completed: false },
      { id: 'c5', text: 'Deploy hotfix to production', completed: false },
      { id: 'c6', text: 'Monitor for 24h and write post-mortem', completed: false },
    ]),
    why: 'Payment failures directly impact revenue. 3 client escalations received in last 48h.',
  },

  // ── TODAY ──────────────────────────────
  {
    title: 'Team standup presentation',
    description: 'Prepare and deliver the weekly progress update to the cross-functional team (12 people). Cover: sprint burndown, blockers, key decisions needed, and upcoming milestones. Include demo of the new reporting feature shipped this week.',
    status: 'todo',
    priority: 'medium',
    due_date: addDays(0),
    started_at: null,
    task_type: 'communication',
    step_phase: 'execution',
    estimated_hours: 2,
    budget_allocated: 0,
    budget_spent: 0,
    risk_rating: 'low',
    acceptance_criteria: '1. Slide deck prepared (max 8 slides)\\n2. Demo environment ready\\n3. All blockers documented with owners\\n4. Action items captured and assigned',
    tags: JSON.stringify(['standup', 'weekly', 'team']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Update burndown chart from Jira', completed: false },
      { id: 'c2', text: 'Prepare demo environment', completed: false },
      { id: 'c3', text: 'List blockers and decisions needed', completed: false },
      { id: 'c4', text: 'Send calendar invite with agenda', completed: false },
    ]),
    why: 'Weekly alignment meeting ensures team stays on track and blockers are resolved quickly.',
  },
  {
    title: 'Review pull requests',
    description: 'Review and approve 4 pending pull requests from the development team. PRs include: authentication refactor (#412), dashboard performance optimization (#415), API rate limiting (#418), and dark mode fixes (#420). Each requires security and performance review.',
    status: 'in_progress',
    priority: 'high',
    due_date: addDays(0),
    started_at: pastDate(0),
    task_type: 'review',
    step_phase: 'execution',
    estimated_hours: 4,
    budget_allocated: 0,
    budget_spent: 0,
    risk_rating: 'low',
    acceptance_criteria: '1. All 4 PRs reviewed with inline comments\\n2. Security implications assessed\\n3. Performance benchmarks verified\\n4. CI/CD pipeline green before merge',
    tags: JSON.stringify(['code-review', 'engineering', 'pr']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Review PR #412 — auth refactor', completed: true },
      { id: 'c2', text: 'Review PR #415 — dashboard perf', completed: true },
      { id: 'c3', text: 'Review PR #418 — rate limiting', completed: false },
      { id: 'c4', text: 'Review PR #420 — dark mode fixes', completed: false },
    ]),
    why: 'Blocking 3 team members from merging. Sprint velocity at risk if not completed today.',
  },

  // ── THIS WEEK ──────────────────────────────
  {
    title: 'Update project documentation',
    description: 'Bring the technical documentation up to date with recent API changes (v2.4→v2.5). Update OpenAPI specs, integration guides, error code reference, and the onboarding tutorial. Ensure all code examples are tested and working.',
    status: 'todo',
    priority: 'medium',
    due_date: addDays(2),
    started_at: null,
    task_type: 'documentation',
    step_phase: 'design',
    estimated_hours: 10,
    budget_allocated: 0,
    budget_spent: 0,
    risk_rating: 'low',
    acceptance_criteria: '1. OpenAPI spec matches production API\\n2. All code examples compile and run\\n3. Integration guide updated for v2.5 breaking changes\\n4. Published to docs portal',
    tags: JSON.stringify(['documentation', 'api', 'developer-experience']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Audit current docs vs actual API', completed: false },
      { id: 'c2', text: 'Update OpenAPI spec', completed: false },
      { id: 'c3', text: 'Rewrite breaking changes section', completed: false },
      { id: 'c4', text: 'Test all code examples', completed: false },
      { id: 'c5', text: 'Publish to portal', completed: false },
    ]),
    why: 'Client onboarding team reports 40% of support tickets stem from outdated documentation.',
  },
  {
    title: 'Prepare demo for stakeholders',
    description: 'Build a compelling demo environment for the upcoming executive stakeholder meeting. Showcase: AI-powered reporting, real-time dashboards, and the new decision management module. Prepare scripted walkthrough and backup slides for offline fallback.',
    status: 'todo',
    priority: 'high',
    due_date: addDays(3),
    started_at: null,
    task_type: 'execution',
    step_phase: 'design',
    estimated_hours: 12,
    budget_allocated: 500,
    budget_spent: 0,
    risk_rating: 'medium',
    acceptance_criteria: '1. Demo environment stable with realistic data\\n2. Scripted walkthrough tested end-to-end\\n3. Backup slides ready for offline scenario\\n4. Q&A prep document with anticipated questions',
    tags: JSON.stringify(['demo', 'stakeholders', 'executive']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Seed demo environment with realistic data', completed: false },
      { id: 'c2', text: 'Build scripted walkthrough (15 min)', completed: false },
      { id: 'c3', text: 'Create backup slides', completed: false },
      { id: 'c4', text: 'Prepare Q&A document', completed: false },
      { id: 'c5', text: 'Dry run with product team', completed: false },
    ]),
    why: 'Executive buy-in needed to secure Phase 3 funding ($2.1M). Meeting scheduled for Friday.',
  },
  {
    title: 'Code review session',
    description: 'Conduct a structured code review session for the new event-driven architecture implementation. Review covers: message broker integration, dead letter queue handling, idempotency patterns, and observability instrumentation. 3 senior engineers participating.',
    status: 'todo',
    priority: 'medium',
    due_date: addDays(4),
    started_at: null,
    task_type: 'review',
    step_phase: 'execution',
    estimated_hours: 3,
    budget_allocated: 0,
    budget_spent: 0,
    risk_rating: 'low',
    acceptance_criteria: '1. All critical paths reviewed\\n2. Idempotency patterns validated\\n3. Dead letter queue tested\\n4. Observability meets SLI requirements\\n5. Action items assigned',
    tags: JSON.stringify(['architecture', 'review', 'event-driven']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Distribute code for pre-review', completed: false },
      { id: 'c2', text: 'Prepare review checklist', completed: false },
      { id: 'c3', text: 'Run session (90 min)', completed: false },
      { id: 'c4', text: 'Document findings and action items', completed: false },
    ]),
    why: 'Architecture decision gate — event-driven migration cannot proceed without sign-off.',
  },
  {
    title: 'Infrastructure planning',
    description: 'Plan cloud infrastructure upgrades for Q2. Evaluate: migrating from EKS to ECS Fargate for cost optimization, implementing multi-region DR, upgrading RDS to Aurora, and right-sizing current EC2 fleet. Produce a costed proposal with timeline.',
    status: 'todo',
    priority: 'low',
    due_date: addDays(5),
    started_at: null,
    task_type: 'planning',
    step_phase: 'design',
    estimated_hours: 20,
    budget_allocated: 0,
    budget_spent: 0,
    risk_rating: 'medium',
    acceptance_criteria: '1. Cost comparison document (current vs proposed)\\n2. Risk assessment for each change\\n3. Migration timeline with milestones\\n4. CTO approval obtained',
    tags: JSON.stringify(['infrastructure', 'cloud', 'cost-optimization', 'planning']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Audit current AWS spend by service', completed: false },
      { id: 'c2', text: 'Model ECS Fargate costs', completed: false },
      { id: 'c3', text: 'Design multi-region DR architecture', completed: false },
      { id: 'c4', text: 'Prepare costed proposal', completed: false },
      { id: 'c5', text: 'Present to CTO for approval', completed: false },
    ]),
    why: 'Current infrastructure costs growing 15% MoM. Board mandated 20% cloud cost reduction by Q3.',
  },

  // ── LATER ──────────────────────────────
  {
    title: 'Annual performance reviews',
    description: 'Complete performance review documentation for all 8 direct reports. Write calibrated assessments covering: delivery quality, leadership behaviors, technical growth, and cross-team impact. Prepare compensation adjustment recommendations.',
    status: 'todo',
    priority: 'medium',
    due_date: addDays(14),
    started_at: null,
    task_type: 'management',
    step_phase: 'design',
    estimated_hours: 24,
    budget_allocated: 0,
    budget_spent: 0,
    risk_rating: 'low',
    acceptance_criteria: '1. All 8 reviews written and calibrated\\n2. Self-assessment inputs incorporated\\n3. Peer feedback summarized\\n4. Compensation recommendations submitted to HR\\n5. 1:1 delivery meetings scheduled',
    tags: JSON.stringify(['performance', 'management', 'hr', 'annual']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Collect self-assessments from team', completed: false },
      { id: 'c2', text: 'Gather peer feedback (360)', completed: false },
      { id: 'c3', text: 'Write individual assessments', completed: false },
      { id: 'c4', text: 'Calibration session with VP', completed: false },
      { id: 'c5', text: 'Submit to HR', completed: false },
      { id: 'c6', text: 'Schedule 1:1 delivery meetings', completed: false },
    ]),
    why: 'Annual review cycle deadline March 1. Compensation adjustments effective April 1.',
  },
  {
    title: 'Technology stack evaluation',
    description: 'Evaluate emerging technologies for potential adoption in 2027 roadmap. Focus areas: AI/ML frameworks (LangChain vs LlamaIndex), edge computing platforms, real-time data streaming (Kafka vs Pulsar), and observability (OpenTelemetry maturity). Produce recommendation matrix.',
    status: 'todo',
    priority: 'low',
    due_date: addDays(30),
    started_at: null,
    task_type: 'research',
    step_phase: 'design',
    estimated_hours: 32,
    budget_allocated: 1000,
    budget_spent: 0,
    risk_rating: 'low',
    acceptance_criteria: '1. Evaluation matrix with weighted criteria\\n2. PoC results for top 2 candidates per category\\n3. TCO analysis (3-year)\\n4. Team skill gap assessment\\n5. CTO-approved recommendation',
    tags: JSON.stringify(['research', 'technology', 'strategy', '2027']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Define evaluation criteria and weights', completed: false },
      { id: 'c2', text: 'Research AI/ML frameworks', completed: false },
      { id: 'c3', text: 'Research edge computing', completed: false },
      { id: 'c4', text: 'Research streaming platforms', completed: false },
      { id: 'c5', text: 'Build PoCs for top candidates', completed: false },
      { id: 'c6', text: 'Write recommendation report', completed: false },
    ]),
    why: 'Technology strategy refresh required for 2027 roadmap planning starting Q3.',
  },

  // ── NO DATE ──────────────────────────────
  {
    title: 'Refactor authentication module',
    description: 'Refactor the legacy authentication module to support OAuth 2.0 + PKCE, SAML SSO, and multi-factor authentication. Current implementation is monolithic with hard-coded providers. Target: modular auth adapter pattern with pluggable providers.',
    status: 'todo',
    priority: 'medium',
    due_date: null,
    started_at: null,
    task_type: 'refactoring',
    step_phase: 'design',
    estimated_hours: 40,
    budget_allocated: 0,
    budget_spent: 0,
    risk_rating: 'high',
    acceptance_criteria: '1. Auth adapter interface defined\\n2. OAuth 2.0 + PKCE working\\n3. SAML SSO integrated\\n4. MFA support (TOTP + WebAuthn)\\n5. Zero-downtime migration plan\\n6. Security audit passed',
    tags: JSON.stringify(['security', 'auth', 'refactoring', 'architecture']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Design auth adapter interface', completed: false },
      { id: 'c2', text: 'Implement OAuth 2.0 + PKCE provider', completed: false },
      { id: 'c3', text: 'Implement SAML SSO provider', completed: false },
      { id: 'c4', text: 'Add MFA support', completed: false },
      { id: 'c5', text: 'Write migration plan', completed: false },
      { id: 'c6', text: 'Security audit', completed: false },
    ]),
    why: 'Enterprise clients require SAML SSO. Currently blocking 3 deals worth $450K ARR.',
  },
  {
    title: 'Research AI integration options',
    description: 'Explore AI/ML integration possibilities for product enhancement. Evaluate: GPT-4o for document summarization, Claude for structured analysis, Whisper for meeting transcription, and custom fine-tuned models for domain-specific classification. Build cost model and architecture proposal.',
    status: 'todo',
    priority: 'low',
    due_date: null,
    started_at: null,
    task_type: 'research',
    step_phase: 'design',
    estimated_hours: 24,
    budget_allocated: 2000,
    budget_spent: 150,
    risk_rating: 'medium',
    acceptance_criteria: '1. Model comparison matrix (quality, latency, cost)\\n2. Architecture proposal for AI layer\\n3. Cost projection (per-user per-month)\\n4. Data privacy assessment\\n5. PoC for top use case',
    tags: JSON.stringify(['ai', 'research', 'product', 'innovation']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Benchmark GPT-4o for summarization', completed: true },
      { id: 'c2', text: 'Benchmark Claude for analysis', completed: false },
      { id: 'c3', text: 'Test Whisper for transcription', completed: false },
      { id: 'c4', text: 'Evaluate fine-tuning options', completed: false },
      { id: 'c5', text: 'Build cost model', completed: false },
      { id: 'c6', text: 'Write architecture proposal', completed: false },
    ]),
    why: 'AI features are top-3 requested capability in customer survey (78% interest).',
  },

  // ── COMPLETED ──────────────────────────────
  {
    title: 'Deploy v2.5 release',
    description: 'Successfully planned and executed the v2.5 production deployment. Included: 47 features, 23 bug fixes, database migration with zero downtime, and rollback verification. Coordinated across 4 teams with 12-hour deployment window.',
    status: 'done',
    priority: 'high',
    due_date: addDays(-3),
    started_at: pastDate(10),
    task_type: 'deployment',
    step_phase: 'execution',
    estimated_hours: 16,
    budget_allocated: 0,
    budget_spent: 0,
    risk_rating: 'high',
    acceptance_criteria: '1. All services healthy post-deploy\\n2. Error rate below 0.1% threshold\\n3. Rollback tested and verified\\n4. Release notes published\\n5. Customer communication sent',
    tags: JSON.stringify(['deployment', 'release', 'production']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Pre-deploy checklist completed', completed: true },
      { id: 'c2', text: 'Database migration executed', completed: true },
      { id: 'c3', text: 'Services deployed and healthy', completed: true },
      { id: 'c4', text: 'Smoke tests passed', completed: true },
      { id: 'c5', text: 'Rollback verified', completed: true },
      { id: 'c6', text: 'Release notes published', completed: true },
    ]),
    why: 'Quarterly release cadence. Client commitments for 3 key features in this release.',
  },
  {
    title: 'Security audit completion',
    description: 'Completed the quarterly penetration test and security audit with CrowdStrike. Scope covered: web application, API endpoints, infrastructure, and social engineering vectors. No critical findings. 4 medium-severity issues identified and remediated within SLA.',
    status: 'done',
    priority: 'critical',
    due_date: addDays(-7),
    started_at: pastDate(21),
    task_type: 'compliance',
    step_phase: 'execution',
    estimated_hours: 40,
    budget_allocated: 15000,
    budget_spent: 14200,
    risk_rating: 'high',
    acceptance_criteria: '1. Pen test report received\\n2. All critical/high findings remediated\\n3. Medium findings remediated within 30 days\\n4. CISO sign-off obtained\\n5. Audit trail documented',
    tags: JSON.stringify(['security', 'audit', 'compliance', 'penetration-test']),
    checklist: JSON.stringify([
      { id: 'c1', text: 'Kick-off with CrowdStrike', completed: true },
      { id: 'c2', text: 'Provide access and scoping docs', completed: true },
      { id: 'c3', text: 'Review preliminary findings', completed: true },
      { id: 'c4', text: 'Remediate medium-severity issues', completed: true },
      { id: 'c5', text: 'Retest and verify fixes', completed: true },
      { id: 'c6', text: 'Obtain CISO sign-off', completed: true },
      { id: 'c7', text: 'Archive final report', completed: true },
    ]),
    why: 'Regulatory requirement for financial services clients. Quarterly cadence mandated by CISO.',
  },
];

async function main() {
  console.log('\n🧹 Clearing old tasks and seeding 15 rich tasks...\n');

  const db = await createDatabase();

  const userResult = await db.get(`SELECT id, organization_id FROM users LIMIT 1`);
  if (!userResult) { console.error('No users found. Run main seeder first.'); process.exit(1); }

  const userId = userResult.id;
  const orgId = userResult.organization_id;
  console.log(`  User: ${userId}`);
  console.log(`  Org:  ${orgId}`);

  // Get or create project
  let project = await db.get(`SELECT id, name FROM projects WHERE organization_id = ? LIMIT 1`, [orgId]);
  if (!project) {
    const pid = uuidv4();
    await db.run(`INSERT INTO projects (id, name, code, description, organization_id, status, created_at) VALUES (?,?,?,?,?,?,datetime('now'))`,
      [pid, 'DBR77 Transformation Program', 'DBR77', 'Digital transformation program', orgId, 'active']);
    project = { id: pid, name: 'DBR77 Transformation Program' };
  }
  console.log(`  Project: ${project.name}\n`);

  // Get initiative if exists
  const initiative = await db.get(`SELECT id FROM initiatives WHERE organization_id = ? LIMIT 1`, [orgId]);

  // DELETE all existing tasks
  const countBefore = await db.get(`SELECT COUNT(*) as cnt FROM tasks WHERE organization_id = ?`, [orgId]);
  await db.run(`DELETE FROM tasks WHERE organization_id = ?`, [orgId]);
  console.log(`  🗑  Deleted ${countBefore?.cnt || 0} existing tasks\n`);

  // INSERT 15 rich tasks
  for (const t of tasks) {
    const taskId = uuidv4();
    const completedAt = t.status === 'done' ? t.due_date : null;

    await db.run(`
      INSERT INTO tasks (
        id, title, description, status, priority, due_date, started_at,
        assignee_id, reporter_id, owner_id, organization_id, project_id, initiative_id,
        task_type, step_phase, estimated_hours, budget_allocated, budget_spent,
        risk_rating, acceptance_criteria, tags, checklist, why,
        created_at, updated_at, completed_at
      ) VALUES (?,?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, datetime('now'),datetime('now'),?)
    `, [
      taskId, t.title, t.description, t.status, t.priority, t.due_date, t.started_at,
      userId, userId, userId, orgId, project.id, initiative?.id || null,
      t.task_type, t.step_phase, t.estimated_hours, t.budget_allocated, t.budget_spent,
      t.risk_rating, t.acceptance_criteria, t.tags, t.checklist, t.why,
      completedAt,
    ]);

    const dueLabel = t.due_date
      ? new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'no date';
    console.log(`  ${c.g}✓${c.r} ${t.title} ${c.d}(${t.priority}, ${t.status}, ${dueLabel})${c.r}`);
  }

  console.log(`\n✅ Done — 15 fully-populated tasks seeded.\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
