#!/usr/bin/env node

import fs from 'node:fs/promises';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const { Client } = pg;

const DEFAULT_USER_ID = 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2';
const DEFAULT_ORG_ID = 'a3e05d4a-5397-419d-b486-8e44366c0063';
const ENV_PATH =
  process.env.RAILWAY_MINDMAP_ENV_PATH ||
  '/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/.env.staging.local';

function edge(source, target, kind = 'structural', extra = {}) {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    type: kind === 'relation' ? 'smoothstep' : 'gradient',
    animated: kind !== 'relation',
    data: {
      edgeRole: kind,
      ...(extra.data || {}),
    },
    ...(extra.style ? { style: extra.style } : {}),
  };
}

function branchNode(id, label, x, y, branchKey) {
  return {
    id,
    type: 'branch',
    position: { x, y },
    data: { label, branchKey, hint: 'Seeded showcase branch' },
  };
}

function ideaNode(id, label, x, y, branchKey, data = {}) {
  return {
    id,
    type: 'idea',
    position: { x, y },
    data: {
      label,
      branchKey,
      sourceType: 'manual',
      priority: 50,
      ...data,
    },
  };
}

function cardNode(id, type, label, x, y, branchKey, data = {}) {
  return {
    id,
    type,
    position: { x, y },
    data: {
      label,
      branchKey,
      kind:
        type === 'knowledgeCard'
          ? 'knowledge_card'
          : type === 'noteCard'
            ? 'note_card'
            : 'evidence_card',
      ...data,
    },
  };
}

function starterFrame(problemLabel, branchDefinitions) {
  const root = {
    id: 'root',
    type: 'center',
    position: { x: 0, y: 0 },
    data: {
      label: problemLabel,
      semanticType: 'problem',
      hint: 'Seeded showcase problem statement',
    },
  };
  const branches = branchDefinitions.map((branch) =>
    branchNode(branch.id, branch.label, branch.x, branch.y, branch.branchKey)
  );
  const branchEdges = branchDefinitions.map((branch) => edge('root', branch.id));
  return { root, branches, branchEdges };
}

function makeMap(title, body, tags, nodes, edges, extensions = {}) {
  return { title, body, tags, nodes, edges, extensions };
}

function showcaseMaps() {
  // ═══════════════════════════════════════════════════════════════════════
  // MAP 1 — Strategy: 3-branch compact decision tree (simple, focused)
  // Theme: Product pricing pivot
  // ═══════════════════════════════════════════════════════════════════════
  const map1 = (() => {
    const base = starterFrame('Conversion rate dropped 40% after the last pricing change.', [
      { id: 'b-causes', label: 'Root Causes', x: -380, y: -160, branchKey: 'causes' },
      { id: 'b-options', label: 'Options', x: 380, y: -160, branchKey: 'options' },
      { id: 'b-validation', label: 'Validation', x: 0, y: 260, branchKey: 'validation' },
    ]);
    const nodes = [
      base.root, ...base.branches,
      ideaNode('c-anchor', 'Price anchor shifted from $49 to $89 without value framing', -620, -220, 'causes', {
        semanticType: 'hypothesis', status: 'exploring', tags: ['pricing', 'ux'],
        context: 'Landing page still shows old value props that matched the $49 tier.',
      }),
      ideaNode('c-segment', 'SMB segment is price-sensitive; enterprise is not', -580, -80, 'causes', {
        semanticType: 'insight', tags: ['segments'],
        notes: 'Churn concentrated in accounts under $500 MRR.',
      }),
      ideaNode('c-competitor', 'Competitor launched a free tier the same week', -640, 50, 'causes', {
        semanticType: 'signal', status: 'validated',
        evidenceLinks: [{ id: 'ev-comp', type: 'url', title: 'Competitor launch post', url: 'https://example.com/competitor-free-tier' }],
      }),
      ideaNode('o-revert', 'Revert to $49 with annual commitment', 580, -220, 'options', {
        semanticType: 'option', status: 'candidate', priority: 70,
      }),
      ideaNode('o-tiered', 'Introduce a $29 starter tier with usage caps', 620, -80, 'options', {
        semanticType: 'option', status: 'candidate', priority: 85,
        goal: 'Recapture SMB segment without cannibalizing enterprise.',
      }),
      ideaNode('o-value', 'Rebuild value page to justify $89 with ROI calculator', 560, 50, 'options', {
        semanticType: 'action', tags: ['marketing', 'ux'],
      }),
      ideaNode('v-ab', 'A/B test $29 tier vs current pricing for 2 weeks', -160, 330, 'validation', {
        semanticType: 'action', goal: 'Measure conversion lift and revenue impact.',
      }),
      ideaNode('v-interviews', 'Run 10 exit interviews with churned SMB accounts', 160, 330, 'validation', {
        semanticType: 'action', goal: 'Confirm price is the primary churn driver.',
      }),
      cardNode('k-benchmark', 'knowledgeCard', 'SaaS pricing benchmarks show 3x conversion lift from adding a starter tier.', -300, 140, 'causes', {
        notes: 'Source: OpenView 2025 SaaS Benchmarks report.', tags: ['benchmark'],
      }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('b-causes', 'c-anchor'), edge('b-causes', 'c-segment'), edge('b-causes', 'c-competitor'),
      edge('b-options', 'o-revert'), edge('b-options', 'o-tiered'), edge('b-options', 'o-value'),
      edge('b-validation', 'v-ab'), edge('b-validation', 'v-interviews'),
      edge('c-segment', 'k-benchmark'),
      edge('c-anchor', 'o-value', 'relation', { data: { relation: 'supports', label: 'supports' } }),
      edge('c-segment', 'o-tiered', 'relation', { data: { relation: 'supports', label: 'supports' } }),
      edge('v-ab', 'o-tiered', 'relation', { data: { relation: 'validates', label: 'validates' } }),
    ];
    return makeMap('Pricing Pivot Analysis', 'Compact 3-branch decision tree analyzing a pricing drop with root causes, options and validation experiments.', ['showcase', 'pricing', 'strategy'], nodes, edges,
      { mindmap: { viewState: { collapsedNodeIds: [], viewport: { x: 0, y: 0, zoom: 0.95 } } } });
  })();

  // ═══════════════════════════════════════════════════════════════════════
  // MAP 2 — Research: 5-branch deep interview synthesis
  // Theme: Customer discovery for new product line
  // ═══════════════════════════════════════════════════════════════════════
  const map2 = (() => {
    const base = starterFrame('We do not know which jobs-to-be-done justify building a second product line.', [
      { id: 'b-personas', label: 'Personas', x: -440, y: -200, branchKey: 'personas' },
      { id: 'b-jtbd', label: 'Jobs-to-be-Done', x: 0, y: -300, branchKey: 'jtbd' },
      { id: 'b-evidence', label: 'Evidence', x: 440, y: -200, branchKey: 'evidence' },
      { id: 'b-gaps', label: 'Gaps', x: -380, y: 120, branchKey: 'gaps' },
      { id: 'b-next', label: 'Next Steps', x: 380, y: 120, branchKey: 'next' },
    ]);
    const nodes = [
      base.root, ...base.branches,
      ideaNode('p-ops', 'Operations Manager', -660, -260, 'personas', { semanticType: 'topic', tags: ['persona'], notes: 'Manages 5-15 people, needs workflow automation.' }),
      ideaNode('p-analyst', 'Business Analyst', -640, -130, 'personas', { semanticType: 'topic', tags: ['persona'], notes: 'Spends 60% of time on data prep, wants self-service.' }),
      ideaNode('p-exec', 'VP of Strategy', -680, 0, 'personas', { semanticType: 'topic', tags: ['persona'], notes: 'Needs board-ready outputs, not raw data.' }),
      ideaNode('j-automate', 'Automate repetitive intake without losing control', -180, -400, 'jtbd', { semanticType: 'hypothesis', status: 'exploring' }),
      ideaNode('j-synthesize', 'Synthesize scattered inputs into one decision view', 180, -400, 'jtbd', { semanticType: 'hypothesis', status: 'validated' }),
      ideaNode('j-report', 'Generate stakeholder-ready reports from working artifacts', 0, -200, 'jtbd', { semanticType: 'hypothesis', status: 'exploring' }),
      cardNode('ev-quote1', 'noteCard', '"I spend Monday mornings copying data between 4 tools."', 580, -260, 'evidence', { notes: 'Ops Manager, Interview #3', tags: ['quote'] }),
      cardNode('ev-quote2', 'noteCard', '"The board deck takes me 2 days because nothing connects."', 620, -130, 'evidence', { notes: 'VP Strategy, Interview #7', tags: ['quote'] }),
      cardNode('ev-survey', 'evidenceCard', 'Survey: 78% of analysts say data prep is their biggest time sink', 560, 0, 'evidence', {
        evidenceLinks: [{ id: 'ev-s1', type: 'url', title: 'Survey results', url: 'https://example.com/survey-2025' }],
      }),
      ideaNode('g-integration', 'No clear integration story between intake and reporting', -560, 180, 'gaps', { semanticType: 'risk', riskNote: 'Could fragment the product further.' }),
      ideaNode('g-positioning', 'Unclear whether this is an add-on or standalone product', -520, 300, 'gaps', { semanticType: 'question' }),
      ideaNode('n-prototype', 'Build a clickable prototype of the synthesis view', 520, 180, 'next', { semanticType: 'action', goal: 'Test with 5 analysts in 2 weeks.' }),
      ideaNode('n-pricing', 'Run willingness-to-pay study with existing customers', 560, 300, 'next', { semanticType: 'action', goal: 'Determine if add-on or standalone pricing works.' }),
      ideaNode('n-compete', 'Map competitive landscape for synthesis tools', 480, 60, 'next', { semanticType: 'action' }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('b-personas', 'p-ops'), edge('b-personas', 'p-analyst'), edge('b-personas', 'p-exec'),
      edge('b-jtbd', 'j-automate'), edge('b-jtbd', 'j-synthesize'), edge('b-jtbd', 'j-report'),
      edge('b-evidence', 'ev-quote1'), edge('b-evidence', 'ev-quote2'), edge('b-evidence', 'ev-survey'),
      edge('b-gaps', 'g-integration'), edge('b-gaps', 'g-positioning'),
      edge('b-next', 'n-prototype'), edge('b-next', 'n-pricing'), edge('b-next', 'n-compete'),
      edge('ev-quote1', 'j-automate', 'relation', { data: { relation: 'evidence_for', label: 'evidence' } }),
      edge('ev-quote2', 'j-report', 'relation', { data: { relation: 'evidence_for', label: 'evidence' } }),
      edge('ev-survey', 'j-synthesize', 'relation', { data: { relation: 'supports', label: 'supports' } }),
      edge('p-analyst', 'j-automate', 'relation', { data: { relation: 'needs', label: 'needs' } }),
      edge('g-positioning', 'n-pricing', 'relation', { data: { relation: 'requires', label: 'requires' } }),
      edge('j-synthesize', 'n-prototype', 'relation', { data: { relation: 'validates', label: 'validates' } }),
    ];
    return makeMap('Product Discovery: Second Product Line', 'Deep research map with personas, jobs-to-be-done, evidence quotes, gaps and next steps.', ['showcase', 'research', 'discovery'], nodes, edges,
      { mindmap: { viewState: { collapsedNodeIds: [], viewport: { x: 0, y: 0, zoom: 0.85 } } } });
  })();

  // ═══════════════════════════════════════════════════════════════════════
  // MAP 3 — Execution: 4-branch with deep nesting (3 levels)
  // Theme: Platform migration project
  // ═══════════════════════════════════════════════════════════════════════
  const map3 = (() => {
    const base = starterFrame('Legacy platform migration is blocked because data integrity checks keep failing.', [
      { id: 'b-blockers', label: 'Blockers', x: -400, y: -180, branchKey: 'blockers' },
      { id: 'b-workstreams', label: 'Workstreams', x: 400, y: -180, branchKey: 'workstreams' },
      { id: 'b-risks', label: 'Risks', x: -340, y: 180, branchKey: 'risks' },
      { id: 'b-milestones', label: 'Milestones', x: 340, y: 180, branchKey: 'milestones' },
    ]);
    const nodes = [
      base.root, ...base.branches,
      ideaNode('bl-schema', 'Schema drift between legacy and target DB', -620, -240, 'blockers', { status: 'blocked', semanticType: 'risk' }),
      ideaNode('bl-orphan', 'Orphaned records with no foreign key match', -600, -100, 'blockers', { status: 'at_risk' }),
      ideaNode('bl-schema-fix', 'Write migration script to reconcile schema differences', -820, -300, 'blockers', { semanticType: 'action', goal: 'Automate schema alignment.' }),
      ideaNode('bl-schema-test', 'Validate migration script against staging copy', -840, -180, 'blockers', { semanticType: 'action' }),
      ideaNode('bl-orphan-audit', 'Audit orphaned records and classify: migrate, archive, or delete', -800, -40, 'blockers', { semanticType: 'action' }),
      ideaNode('ws-data', 'Data migration workstream', 600, -240, 'workstreams', { semanticType: 'topic', tags: ['workstream'] }),
      ideaNode('ws-api', 'API compatibility layer', 640, -100, 'workstreams', { semanticType: 'topic', tags: ['workstream'] }),
      ideaNode('ws-data-etl', 'Build ETL pipeline with checksums', 800, -300, 'workstreams', { semanticType: 'action' }),
      ideaNode('ws-data-validate', 'Run row-count and hash validation post-migration', 820, -180, 'workstreams', { semanticType: 'action' }),
      ideaNode('ws-api-shim', 'Deploy backward-compatible API shim for 90 days', 840, -60, 'workstreams', { semanticType: 'action', rationale: 'Gives consumers time to migrate without breaking.' }),
      ideaNode('r-downtime', 'Extended downtime during cutover', -520, 240, 'risks', { riskNote: 'Max acceptable: 4 hours. Current estimate: 8 hours.' }),
      ideaNode('r-rollback', 'No tested rollback procedure', -520, 360, 'risks', { riskNote: 'Must have verified rollback before go-live.', semanticType: 'risk' }),
      ideaNode('m-staging', 'Staging migration complete', 520, 240, 'milestones', { semanticType: 'decision_point', status: 'exploring' }),
      ideaNode('m-golive', 'Production go-live', 520, 360, 'milestones', { semanticType: 'decision_point', status: 'idea' }),
      cardNode('k-pattern', 'knowledgeCard', 'Blue-green deployment reduces cutover risk to near-zero downtime.', -200, 320, 'risks', { notes: 'Requires parallel infrastructure budget.', tags: ['pattern'] }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('b-blockers', 'bl-schema'), edge('b-blockers', 'bl-orphan'),
      edge('bl-schema', 'bl-schema-fix'), edge('bl-schema', 'bl-schema-test'),
      edge('bl-orphan', 'bl-orphan-audit'),
      edge('b-workstreams', 'ws-data'), edge('b-workstreams', 'ws-api'),
      edge('ws-data', 'ws-data-etl'), edge('ws-data', 'ws-data-validate'),
      edge('ws-api', 'ws-api-shim'),
      edge('b-risks', 'r-downtime'), edge('b-risks', 'r-rollback'), edge('b-risks', 'k-pattern'),
      edge('b-milestones', 'm-staging'), edge('b-milestones', 'm-golive'),
      edge('bl-schema-fix', 'ws-data-etl', 'relation', { data: { relation: 'blocks', label: 'blocks' } }),
      edge('r-downtime', 'm-golive', 'relation', { data: { relation: 'constrains', label: 'constrains' } }),
      edge('k-pattern', 'r-downtime', 'relation', { data: { relation: 'mitigates', label: 'mitigates' } }),
      edge('ws-data-validate', 'm-staging', 'relation', { data: { relation: 'validates', label: 'validates' } }),
    ];
    return makeMap('Platform Migration War Room', 'Execution map with deep nesting (3 levels), blockers, workstreams, risks and milestone gates.', ['showcase', 'migration', 'execution'], nodes, edges,
      { mindmap: { viewState: { collapsedNodeIds: [], viewport: { x: 0, y: 0, zoom: 0.88 } } } });
  })();

  // ═══════════════════════════════════════════════════════════════════════
  // MAP 4 — Governance: 6-branch wide map with many cross-links
  // Theme: AI rollout governance
  // ═══════════════════════════════════════════════════════════════════════
  const map4 = (() => {
    const base = starterFrame('AI features are shipping without consistent governance, creating compliance risk.', [
      { id: 'b-inventory', label: 'AI Inventory', x: -440, y: -220, branchKey: 'inventory' },
      { id: 'b-controls', label: 'Controls', x: 0, y: -300, branchKey: 'controls' },
      { id: 'b-owners', label: 'Owners', x: 440, y: -220, branchKey: 'owners' },
      { id: 'b-gaps', label: 'Gaps', x: -440, y: 80, branchKey: 'gaps' },
      { id: 'b-actions', label: 'Actions', x: 440, y: 80, branchKey: 'actions' },
      { id: 'b-metrics', label: 'Metrics', x: 0, y: 300, branchKey: 'metrics' },
    ]);
    const nodes = [
      base.root, ...base.branches,
      ideaNode('inv-chat', 'AI Chat assistant', -660, -280, 'inventory', { semanticType: 'topic', tags: ['ai', 'chat'] }),
      ideaNode('inv-suggest', 'AI Suggestion engine', -640, -160, 'inventory', { semanticType: 'topic', tags: ['ai', 'suggestions'] }),
      ideaNode('inv-expand', 'AI Branch expander', -660, -40, 'inventory', { semanticType: 'topic', tags: ['ai', 'mindmap'] }),
      ideaNode('ctrl-review', 'Propose-preview-accept on every AI output', -180, -380, 'controls', { semanticType: 'constraint' }),
      ideaNode('ctrl-audit', 'Audit trail for every AI action', 180, -380, 'controls', { semanticType: 'constraint' }),
      ideaNode('ctrl-confidence', 'Confidence score visible to user', 0, -220, 'controls', { semanticType: 'constraint' }),
      ideaNode('own-product', 'Product team owns AI feature flags', 620, -280, 'owners', { semanticType: 'action' }),
      ideaNode('own-legal', 'Legal reviews AI disclosure language quarterly', 640, -160, 'owners', { semanticType: 'action' }),
      ideaNode('own-eng', 'Engineering owns audit log infrastructure', 620, -40, 'owners', { semanticType: 'action' }),
      ideaNode('gap-disclosure', 'No user-facing AI disclosure in 3 of 5 features', -620, 140, 'gaps', { semanticType: 'risk', riskNote: 'Regulatory exposure.' }),
      ideaNode('gap-replay', 'AI replay log not exposed in UI for 2 features', -600, 260, 'gaps', { semanticType: 'risk' }),
      ideaNode('act-disclosure', 'Add AI disclosure badge to all AI-powered surfaces', 600, 140, 'actions', { semanticType: 'action', priority: 90 }),
      ideaNode('act-panel', 'Ship AI governance panel in workspace', 620, 260, 'actions', { semanticType: 'action', priority: 85 }),
      ideaNode('met-coverage', 'AI governance coverage: % of features with full controls', -160, 380, 'metrics', { semanticType: 'metric' }),
      ideaNode('met-incidents', 'AI incident count per quarter', 160, 380, 'metrics', { semanticType: 'metric' }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('b-inventory', 'inv-chat'), edge('b-inventory', 'inv-suggest'), edge('b-inventory', 'inv-expand'),
      edge('b-controls', 'ctrl-review'), edge('b-controls', 'ctrl-audit'), edge('b-controls', 'ctrl-confidence'),
      edge('b-owners', 'own-product'), edge('b-owners', 'own-legal'), edge('b-owners', 'own-eng'),
      edge('b-gaps', 'gap-disclosure'), edge('b-gaps', 'gap-replay'),
      edge('b-actions', 'act-disclosure'), edge('b-actions', 'act-panel'),
      edge('b-metrics', 'met-coverage'), edge('b-metrics', 'met-incidents'),
      edge('gap-disclosure', 'act-disclosure', 'relation', { data: { relation: 'mitigates', label: 'mitigates' } }),
      edge('gap-replay', 'act-panel', 'relation', { data: { relation: 'mitigates', label: 'mitigates' } }),
      edge('ctrl-audit', 'own-eng', 'relation', { data: { relation: 'requires', label: 'requires' } }),
      edge('ctrl-review', 'inv-chat', 'relation', { data: { relation: 'constrains', label: 'constrains' } }),
      edge('ctrl-review', 'inv-suggest', 'relation', { data: { relation: 'constrains', label: 'constrains' } }),
      edge('act-disclosure', 'met-coverage', 'relation', { data: { relation: 'tracks', label: 'tracks' } }),
      edge('inv-expand', 'gap-replay', 'relation', { data: { relation: 'blocks', label: 'blocks' } }),
    ];
    return makeMap('AI Governance Framework', 'Wide 6-branch governance map with inventory, controls, owners, gaps, actions and metrics — heavy cross-linking.', ['showcase', 'governance', 'ai'], nodes, edges,
      {
        canvasGovernance: { status: 'draft', aiReplayLog: [{ id: 'seed-1', tool: 'mindmap', generatorType: 'seed', proposalIds: [], rationale: ['Initial governance framework seed'], citations: [], acceptedAt: new Date().toISOString() }] },
        mindmap: { viewState: { collapsedNodeIds: [], viewport: { x: 0, y: 0, zoom: 0.82 } } },
      });
  })();

  // ═══════════════════════════════════════════════════════════════════════
  // MAP 5 — Lean: 2-branch minimal map with deep sub-branches
  // Theme: Personal OKR planning
  // ═══════════════════════════════════════════════════════════════════════
  const map5 = (() => {
    const base = starterFrame('Q3 personal OKRs are unclear because team priorities shifted mid-quarter.', [
      { id: 'b-objectives', label: 'Objectives', x: -400, y: 0, branchKey: 'objectives' },
      { id: 'b-blockers', label: 'Blockers & Risks', x: 400, y: 0, branchKey: 'blockers' },
    ]);
    const nodes = [
      base.root, ...base.branches,
      ideaNode('obj-ship', 'Ship mindmap module to production', -620, -140, 'objectives', { semanticType: 'decision', status: 'exploring', priority: 95 }),
      ideaNode('obj-ship-kr1', 'KR: 5 test maps pass full QA on Railway', -820, -200, 'objectives', { semanticType: 'metric', goal: 'All 5 maps load, edit, save, reload without errors.' }),
      ideaNode('obj-ship-kr2', 'KR: Zero silent AI overwrites in production', -840, -80, 'objectives', { semanticType: 'metric' }),
      ideaNode('obj-adopt', 'Drive internal adoption across 3 teams', -620, 60, 'objectives', { semanticType: 'decision', status: 'idea', priority: 80 }),
      ideaNode('obj-adopt-kr1', 'KR: 10 real maps created by non-engineering users', -820, 0, 'objectives', { semanticType: 'metric' }),
      ideaNode('obj-adopt-kr2', 'KR: Positive NPS from 3 pilot teams', -840, 120, 'objectives', { semanticType: 'metric' }),
      ideaNode('obj-learn', 'Complete AI governance certification', -620, 240, 'objectives', { semanticType: 'action', status: 'idea', priority: 60 }),
      ideaNode('obj-learn-kr1', 'KR: Pass internal AI safety review', -820, 200, 'objectives', { semanticType: 'metric' }),
      ideaNode('bl-scope', 'Scope creep from adjacent modules', 620, -140, 'blockers', { semanticType: 'risk', riskNote: 'Finance and table modules keep pulling attention.' }),
      ideaNode('bl-data', 'Test data quality on Railway is inconsistent', 640, 0, 'blockers', { semanticType: 'risk', riskNote: 'Seeded maps sometimes have stale schema.' }),
      ideaNode('bl-time', 'Only 3 weeks left in the quarter', 620, 140, 'blockers', { semanticType: 'constraint' }),
      cardNode('k-focus', 'knowledgeCard', 'Rule of 3: never pursue more than 3 objectives simultaneously.', 200, -200, 'blockers', { notes: 'From "Measure What Matters" — Doerr.', tags: ['okr', 'focus'] }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('b-objectives', 'obj-ship'), edge('b-objectives', 'obj-adopt'), edge('b-objectives', 'obj-learn'),
      edge('obj-ship', 'obj-ship-kr1'), edge('obj-ship', 'obj-ship-kr2'),
      edge('obj-adopt', 'obj-adopt-kr1'), edge('obj-adopt', 'obj-adopt-kr2'),
      edge('obj-learn', 'obj-learn-kr1'),
      edge('b-blockers', 'bl-scope'), edge('b-blockers', 'bl-data'), edge('b-blockers', 'bl-time'),
      edge('b-blockers', 'k-focus'),
      edge('bl-scope', 'obj-ship', 'relation', { data: { relation: 'blocks', label: 'blocks' } }),
      edge('bl-data', 'obj-ship-kr1', 'relation', { data: { relation: 'blocks', label: 'blocks' } }),
      edge('bl-time', 'obj-learn', 'relation', { data: { relation: 'constrains', label: 'constrains' } }),
    ];
    return makeMap('Q3 Personal OKR Planning', 'Lean 2-branch map with deep sub-branches (3 levels) for personal OKR planning with blockers.', ['showcase', 'okr', 'personal'], nodes, edges,
      { mindmap: { viewState: { collapsedNodeIds: ['obj-learn'], viewport: { x: 0, y: 0, zoom: 0.9 } } } });
  })();

  return [map1, map2, map3, map4, map5];
}

async function getDatabaseUrl() {
  const env = await fs.readFile(ENV_PATH, 'utf8');
  const databasePublicUrl = env
    .split('\n')
    .find((line) => line.startsWith('DATABASE_PUBLIC_URL='))
    ?.split('=')[1]
    ?.trim();
  const databaseUrl = env
    .split('\n')
    .find((line) => line.startsWith('DATABASE_URL='))
    ?.split('=')[1]
    ?.trim();
  const effective = databasePublicUrl || databaseUrl;
  if (!effective) return null;
  if (/\.railway\.internal(?::\d+)?\b/i.test(effective)) {
    throw new Error(
      'Refusing private Railway database host outside Railway. Use DATABASE_PUBLIC_URL in .env.staging.local.'
    );
  }
  return effective;
}

async function main() {
  const DATABASE_URL = await getDatabaseUrl();
  if (!DATABASE_URL) throw new Error('Missing DATABASE_URL in .env.staging.local');

  const userId = process.env.RAILWAY_MINDMAP_USER_ID || DEFAULT_USER_ID;
  const organizationId = process.env.RAILWAY_MINDMAP_ORG_ID || DEFAULT_ORG_ID;

  const client = new Client({ connectionString: DATABASE_URL, ssl: false });
  await client.connect();

  const tables = ['my_ideas', 'my_idea_maps', 'my_idea_edges', 'my_idea_map_versions'];
  const existing = {};
  for (const table of tables) {
    const check = await client.query('SELECT to_regclass($1) as name', [table]);
    existing[table] = Boolean(check.rows[0]?.name);
  }
  const mapColumns = existing.my_idea_maps
    ? new Set(
        (
          await client.query(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'my_idea_maps'`
          )
        ).rows.map((row) => String(row.column_name || ''))
      )
    : new Set();

  await client.query('BEGIN');
  try {
    const mappedIdeaIds = existing.my_idea_maps
      ? (
          await client.query(
            `SELECT DISTINCT idea_id
             FROM my_idea_maps
             WHERE user_id = $1 AND organization_id = $2`,
            [userId, organizationId]
          )
        ).rows
          .map((row) => row.idea_id)
          .filter(Boolean)
      : [];
    if (existing.my_idea_edges) {
      await client.query('DELETE FROM my_idea_edges WHERE user_id = $1 AND organization_id = $2', [userId, organizationId]);
    }
    if (existing.my_idea_map_versions) {
      await client.query('DELETE FROM my_idea_map_versions WHERE user_id = $1 AND organization_id = $2', [userId, organizationId]);
    }
    if (existing.my_idea_maps) {
      await client.query('DELETE FROM my_idea_maps WHERE user_id = $1 AND organization_id = $2', [userId, organizationId]);
    }
    if (existing.my_ideas && mappedIdeaIds.length > 0) {
      await client.query('DELETE FROM my_ideas WHERE user_id = $1 AND organization_id = $2 AND id = ANY($3::text[])', [
        userId,
        organizationId,
        mappedIdeaIds,
      ]);
    }

    const created = [];
    for (const map of showcaseMaps()) {
      const ideaId = randomUUID();
      const mapId = randomUUID();
      await client.query(
        `INSERT INTO my_ideas (
          id, user_id, organization_id, title, body, tags, stage, source_type, area, branch, priority, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())`,
        [
          ideaId,
          userId,
          organizationId,
          map.title,
          map.body,
          JSON.stringify(map.tags || []),
          'framing',
          'manual',
          'strategy',
          'mindmap',
          50,
        ]
      );
      await client.query(
        `INSERT INTO my_idea_maps (${[
          'id',
          'idea_id',
          'user_id',
          'organization_id',
          'nodes_json',
          'edges_json',
          'version',
          'created_at',
          'updated_at',
          mapColumns.has('preferred_tool') ? 'preferred_tool' : null,
          mapColumns.has('extensions_json') ? 'extensions_json' : null,
          mapColumns.has('schema_version') ? 'schema_version' : null,
        ]
          .filter(Boolean)
          .join(', ')})
         VALUES (${[
           '$1',
           '$2',
           '$3',
           '$4',
           '$5',
           '$6',
           '$7',
           'NOW()',
           'NOW()',
           mapColumns.has('preferred_tool') ? '$8' : null,
           mapColumns.has('extensions_json') ? `$${mapColumns.has('preferred_tool') ? '9' : '8'}` : null,
           mapColumns.has('schema_version')
             ? `$${1 + Number(mapColumns.has('preferred_tool')) + Number(mapColumns.has('extensions_json')) + 7}`
             : null,
         ]
           .filter(Boolean)
           .join(', ')})`,
        [
          mapId,
          ideaId,
          userId,
          organizationId,
          JSON.stringify(map.nodes),
          JSON.stringify(map.edges),
          1,
          ...(mapColumns.has('preferred_tool') ? ['mindmap'] : []),
          ...(mapColumns.has('extensions_json') ? [JSON.stringify(map.extensions || {})] : []),
          ...(mapColumns.has('schema_version') ? [3] : []),
        ]
      );
      created.push({ id: ideaId, title: map.title, nodes: map.nodes.length, edges: map.edges.length });
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ userId, organizationId, createdCount: created.length, created }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
