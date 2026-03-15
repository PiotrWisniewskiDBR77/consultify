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
  const map1 = (() => {
    const base = starterFrame('Revenue growth is stalling because CAC payback is above 6 months.', [
      { id: 'branch-signals', label: 'Signals', x: -360, y: -200, branchKey: 'signals' },
      { id: 'branch-options', label: 'Options', x: 360, y: -220, branchKey: 'options' },
      { id: 'branch-constraints', label: 'Constraints', x: 420, y: 30, branchKey: 'constraints' },
      { id: 'branch-experiments', label: 'Experiments', x: 60, y: 300, branchKey: 'experiments' },
      { id: 'branch-proof', label: 'Proof', x: -420, y: 60, branchKey: 'proof' },
    ]);
    const nodes = [
      base.root,
      ...base.branches,
      ideaNode('signal-pipeline', 'Pipeline quality dropped after broadening ICP', -620, -250, 'signals', {
        semanticType: 'signal',
        context: 'Win rate fell while top-of-funnel volume increased.',
      }),
      ideaNode('signal-payback', 'Average CAC payback moved from 4.5 to 7.2 months', -600, -130, 'signals', {
        semanticType: 'metric',
      }),
      ideaNode('opt-pl', 'Launch in Poland first with one beachhead vertical', 560, -260, 'options', {
        semanticType: 'option',
        status: 'candidate',
        tags: ['market', 'launch', 'vertical'],
        context: 'Fastest path to sharper positioning and shorter learning loops.',
        artifactLinks: [{ artifactRef: { type: 'decision', id: 'DEC-PL-LAUNCH' }, label: 'Launch decision' }],
      }),
      ideaNode('opt-de', 'Pilot in Germany with channel partner', 600, -140, 'options', {
        semanticType: 'option',
        status: 'candidate',
        tags: ['partner', 'pilot'],
        context: 'Could unlock larger contracts, but adds partner dependency.',
      }),
      ideaNode('constraint-compliance', 'German expansion adds compliance and localization overhead', 610, 20, 'constraints', {
        semanticType: 'risk',
        riskNote: 'Need local accounting and tax partner.',
      }),
      ideaNode('constraint-team', 'Team can only support one new motion in the next 90 days', 460, 130, 'constraints', {
        semanticType: 'constraint',
      }),
      ideaNode('exp-smb', 'Run 3-week outbound sprint in one Polish niche', 120, 380, 'experiments', {
        semanticType: 'action',
        goal: 'Validate demand and close 5 discovery calls with one segment.',
      }),
      ideaNode('exp-pricing', 'Test value-based pricing in current market before expansion', -40, 320, 'experiments', {
        semanticType: 'action',
        goal: 'Check whether growth issue is positioning vs. geography.',
      }),
      cardNode('knowledge-growth', 'knowledgeCard', 'Benchmarks show one beachhead market beats simultaneous country launches.', -160, -350, 'proof', {
        notes: 'Use one market as a proof layer before cross-border scaling.',
        tags: ['benchmark', 'growth'],
      }),
      cardNode('note-team', 'noteCard', 'CEO prefers the lower-complexity path that can show traction in one quarter.', 260, -20, 'options', {
        notes: 'Keep team overhead low in the first 90 days.',
      }),
      cardNode('evidence-report', 'evidenceCard', 'Desk research on market attractiveness', -560, 150, 'proof', {
        evidenceLinks: [{ id: 'ev-1', type: 'url', title: 'Research memo', url: 'https://example.com/research' }],
      }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('branch-signals', 'signal-pipeline'),
      edge('branch-signals', 'signal-payback'),
      edge('branch-options', 'opt-pl'),
      edge('branch-options', 'opt-de'),
      edge('branch-constraints', 'constraint-compliance'),
      edge('branch-constraints', 'constraint-team'),
      edge('branch-experiments', 'exp-smb'),
      edge('branch-experiments', 'exp-pricing'),
      edge('branch-proof', 'knowledge-growth'),
      edge('branch-proof', 'evidence-report'),
      edge('opt-pl', 'note-team'),
      edge('signal-payback', 'opt-pl', 'relation', { data: { relation: 'supports', label: 'supports' } }),
      edge('constraint-compliance', 'opt-de', 'relation', { data: { relation: 'blocks', label: 'blocks' } }),
      edge('exp-smb', 'opt-pl', 'relation', { data: { relation: 'validates', label: 'validates' } }),
      edge('exp-pricing', 'signal-payback', 'relation', { data: { relation: 'tests', label: 'tests' } }),
    ];
    return makeMap(
      'Market Expansion Decision',
      'Problem-centered growth map with signals, strategic options, constraints and experiments.',
      ['showcase', 'strategy', 'growth'],
      nodes,
      edges,
      { mindmap: { viewState: { collapsedNodeIds: [], viewport: { x: 50, y: 80, zoom: 0.92 } } } }
    );
  })();

  const map2 = (() => {
    const base = starterFrame('New customers do not reach first value during the first week.', [
      { id: 'branch-segments', label: 'Segments', x: -420, y: -220, branchKey: 'segments' },
      { id: 'branch-friction', label: 'Friction', x: -420, y: 20, branchKey: 'friction' },
      { id: 'branch-quotes', label: 'Quotes', x: 0, y: -320, branchKey: 'quotes' },
      { id: 'branch-opportunities', label: 'Opportunities', x: 420, y: -160, branchKey: 'opportunities' },
      { id: 'branch-next', label: 'Next Interviews', x: 140, y: 320, branchKey: 'next' },
    ]);
    const nodes = [
      base.root,
      ...base.branches,
      ideaNode('seg-smb', 'SMB operators need proof of value in 3 days', -650, -260, 'segments', {
        context: 'Small teams do not have time for multi-session onboarding.',
      }),
      ideaNode('seg-enterprise', 'Enterprise champions want guided rollout templates', -630, -150, 'segments', {
        context: 'They need repeatability across teams.',
      }),
      ideaNode('friction-manual', 'Setup feels too manual and workshop-heavy', -620, 0, 'friction', {
        context: 'Repeated in 7/10 interviews.',
        tags: ['interviews', 'ops'],
      }),
      ideaNode('friction-reporting', 'Teams cannot see ROI quickly', -620, 120, 'friction', {
        context: 'Exec buyers want week-one visibility.',
      }),
      cardNode('quote-ops', 'noteCard', '"We loved the idea, but setup still took two workshops."', -120, -450, 'quotes', {
        notes: 'Interview quote from operations lead.',
        tags: ['quote'],
      }),
      cardNode('quote-cfo', 'noteCard', '"If I cannot show a before/after report in week one, the pilot dies."', 140, -410, 'quotes', {
        notes: 'Quote from CFO buyer interview.',
      }),
      ideaNode('opp-guided', 'Build guided setup flow with progress checklist', 560, -230, 'opportunities', {
        semanticType: 'option',
      }),
      ideaNode('opp-templates', 'Offer role-based starter templates', 610, -110, 'opportunities', {
        semanticType: 'option',
      }),
      ideaNode('opp-report', 'Ship a default 7-day value report', 520, 20, 'opportunities', {
        semanticType: 'option',
      }),
      ideaNode('next-concierge', 'Run concierge onboarding for 5 pilots', 30, 390, 'next', {
        goal: 'Validate which setup tasks must be automated first.',
      }),
      cardNode('knowledge-pattern', 'knowledgeCard', 'Pattern: value realization requires a visible 7-day success artifact.', -300, 220, 'friction', {
        notes: 'Strong signal across buyers and champions.',
      }),
      cardNode('evidence-call', 'evidenceCard', 'Interview recording index', 250, 300, 'next', {
        artifactLinks: [{ artifactRef: { type: 'meeting', id: 'MTG-CUST-07' }, label: 'Interview call' }],
      }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('branch-segments', 'seg-smb'),
      edge('branch-segments', 'seg-enterprise'),
      edge('branch-friction', 'friction-manual'),
      edge('branch-friction', 'friction-reporting'),
      edge('branch-friction', 'knowledge-pattern'),
      edge('branch-quotes', 'quote-ops'),
      edge('branch-quotes', 'quote-cfo'),
      edge('branch-opportunities', 'opp-guided'),
      edge('branch-opportunities', 'opp-templates'),
      edge('branch-opportunities', 'opp-report'),
      edge('branch-next', 'next-concierge'),
      edge('branch-next', 'evidence-call'),
      edge('quote-ops', 'friction-manual', 'relation', { data: { relation: 'evidence_for', label: 'evidence' } }),
      edge('quote-cfo', 'friction-reporting', 'relation', { data: { relation: 'evidence_for', label: 'evidence' } }),
      edge('knowledge-pattern', 'opp-report', 'relation', { data: { relation: 'supports', label: 'supports' } }),
      edge('next-concierge', 'opp-guided', 'relation', { data: { relation: 'validates', label: 'validates' } }),
      edge('seg-enterprise', 'opp-templates', 'relation', { data: { relation: 'supports', label: 'supports' } }),
    ];
    return makeMap(
      'Customer Interview Synthesis',
      'Research map centered on onboarding problem with segments, quotes and solution opportunities.',
      ['showcase', 'research', 'customer'],
      nodes,
      edges,
      { mindmap: { viewState: { collapsedNodeIds: ['branch-quotes'], viewport: { x: -40, y: 60, zoom: 0.88 } } } }
    );
  })();

  const map3 = (() => {
    const base = starterFrame('Analysts lose too much time on repetitive intake and triage work.', [
      { id: 'branch-current', label: 'Current Work', x: -430, y: -220, branchKey: 'current' },
      { id: 'branch-automation', label: 'Automation Bets', x: 420, y: -220, branchKey: 'automation' },
      { id: 'branch-guardrails', label: 'Guardrails', x: 520, y: 20, branchKey: 'guardrails' },
      { id: 'branch-dependencies', label: 'Dependencies', x: -420, y: 80, branchKey: 'dependencies' },
      { id: 'branch-pilot', label: 'Pilot Metrics', x: 80, y: 320, branchKey: 'pilot' },
    ]);
    const nodes = [
      base.root,
      ...base.branches,
      ideaNode('current-copy', 'Analysts repeat the same intake checklist 20+ times per week', -660, -250, 'current', {
        status: 'active',
      }),
      ideaNode('current-routing', 'Triage routing decisions are manual and inconsistent', -600, -130, 'current', {
        status: 'at_risk',
      }),
      ideaNode('option-ai-brief', 'Generate draft brief from uploaded docs', 610, -260, 'automation', {
        semanticType: 'action',
        artifactLinks: [{ artifactRef: { type: 'tool', id: 'TOOL-DOC-PARSER' }, label: 'Doc parser' }],
      }),
      ideaNode('option-routing', 'Route items by semantic tags', 640, -120, 'automation', { semanticType: 'action' }),
      ideaNode('option-summary', 'Auto-summarize key context before analyst review', 520, 20, 'automation', {
        semanticType: 'action',
      }),
      ideaNode('guardrail-review', 'Every AI step must remain propose -> preview -> accept', 660, 20, 'guardrails', {
        riskNote: 'Must keep accept/reject governance.',
      }),
      ideaNode('guardrail-confidence', 'Confidence score required on every AI-generated step', 560, 140, 'guardrails', {
        semanticType: 'constraint',
      }),
      cardNode('dep-parser', 'evidenceCard', 'Existing parser service can feed structured intake fields', -500, 170, 'dependencies', {
        artifactLinks: [{ artifactRef: { type: 'tool', id: 'TOOL-DOC-PARSER' }, label: 'Doc parser' }],
      }),
      cardNode('dep-audit', 'knowledgeCard', 'Audit requirement: generated output must be reviewable and attributable.', -260, 260, 'dependencies', {
        notes: 'Keeps the automation acceptable for operations and governance.',
      }),
      ideaNode('pilot-shadow', 'Shadow-run automation for 2 weeks', -20, 380, 'pilot', {
        goal: 'Measure time saved before operational rollout.',
      }),
      ideaNode('pilot-target', 'Target: save 30% analyst handling time without hidden auto-actions', 170, 320, 'pilot', {
        semanticType: 'metric',
      }),
      cardNode('note-ops', 'noteCard', 'Ops wants confidence score on every generated step.', 300, 110, 'automation'),
      cardNode('evidence-audit', 'evidenceCard', 'AI audit checklist', 240, 430, 'pilot', {
        artifactLinks: [{ artifactRef: { type: 'report', id: 'REP-AI-AUDIT' }, label: 'AI audit report' }],
      }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('branch-current', 'current-copy'),
      edge('branch-current', 'current-routing'),
      edge('branch-automation', 'option-ai-brief'),
      edge('branch-automation', 'option-routing'),
      edge('branch-automation', 'option-summary'),
      edge('branch-guardrails', 'guardrail-review'),
      edge('branch-guardrails', 'guardrail-confidence'),
      edge('branch-dependencies', 'dep-parser'),
      edge('branch-dependencies', 'dep-audit'),
      edge('branch-pilot', 'pilot-shadow'),
      edge('branch-pilot', 'pilot-target'),
      edge('branch-pilot', 'evidence-audit'),
      edge('option-ai-brief', 'note-ops'),
      edge('dep-audit', 'guardrail-review', 'relation', { data: { relation: 'supports', label: 'supports' } }),
      edge('pilot-shadow', 'option-ai-brief', 'relation', { data: { relation: 'validates', label: 'validates' } }),
      edge('current-routing', 'option-routing', 'relation', { data: { relation: 'supports', label: 'supports' } }),
      edge('guardrail-confidence', 'option-summary', 'relation', { data: { relation: 'constrains', label: 'constrains' } }),
    ];
    return makeMap(
      'AI Workflow Automation Blueprint',
      'Automation map with current-state pain, governance guardrails, dependencies and pilot metrics.',
      ['showcase', 'automation', 'ai'],
      nodes,
      edges,
      {
        governance: {
          replay: [{ action: 'seeded_showcase', at: new Date().toISOString(), summary: 'Initial governed automation blueprint' }],
        },
        mindmap: { viewState: { collapsedNodeIds: [], viewport: { x: 30, y: 40, zoom: 0.94 } } },
      }
    );
  })();

  const map4 = (() => {
    const base = starterFrame('Q2 delivery is slipping because dependencies have no clear owners.', [
      { id: 'branch-breakdowns', label: 'Breakdowns', x: -430, y: -220, branchKey: 'breakdowns' },
      { id: 'branch-recovery', label: 'Recovery Plays', x: 430, y: -220, branchKey: 'recovery' },
      { id: 'branch-owners', label: 'Owners', x: 500, y: 40, branchKey: 'owners' },
      { id: 'branch-metrics', label: 'Metrics', x: -320, y: 210, branchKey: 'metrics' },
      { id: 'branch-risks', label: 'Risks', x: 120, y: 330, branchKey: 'risks' },
      { id: 'branch-comms', label: 'Comms', x: -540, y: 20, branchKey: 'comms' },
    ]);
    const nodes = [
      base.root,
      ...base.branches,
      ideaNode('break-milestones', 'Critical milestones slipped by 3 weeks', -650, -260, 'breakdowns', { status: 'blocked' }),
      ideaNode('break-handoffs', 'Cross-team handoffs fail without a DRI', -620, -120, 'breakdowns', { status: 'at_risk' }),
      ideaNode('recovery-warroom', 'Create daily recovery war room for the top dependency chain', 610, -250, 'recovery', { priority: 80 }),
      ideaNode('recovery-scope', 'Freeze lower-priority scope until forecast stabilizes', 610, -110, 'recovery', { priority: 75 }),
      ideaNode('owner-dri', 'Assign one DRI for each dependency cluster', 620, 50, 'owners', {
        semanticType: 'action',
      }),
      ideaNode('owner-pmo', 'PMO owns escalation cadence and unblock decisions', 500, 170, 'owners', {
        semanticType: 'action',
      }),
      cardNode('knowledge-kpi', 'knowledgeCard', 'Recovery success metric: restore forecast confidence above 80%.', -320, 300, 'metrics', {
        artifactLinks: [{ artifactRef: { type: 'kpi', id: 'KPI-DELIVERY-CONFIDENCE' }, label: 'Delivery confidence KPI' }],
      }),
      ideaNode('metric-backlog', 'Track open blockers older than 48 hours', -520, 220, 'metrics', {
        semanticType: 'metric',
      }),
      ideaNode('risk-morale', 'Recovery pace could burn out the team', 40, 430, 'risks', { riskNote: 'Need explicit workload guardrails.' }),
      ideaNode('risk-quality', 'Compressed recovery could increase defect leakage', 220, 360, 'risks', { riskNote: 'Protect quality gates.' }),
      cardNode('note-standup', 'noteCard', 'Daily exec-ready status note must be generated by 16:00.', -640, 70, 'comms'),
      cardNode('evidence-plan', 'evidenceCard', 'Recovery worksheet', -450, 120, 'comms', {
        artifactLinks: [{ artifactRef: { type: 'project', id: 'PRJ-Q2-RECOVERY' }, label: 'Recovery project' }],
      }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('branch-breakdowns', 'break-milestones'),
      edge('branch-breakdowns', 'break-handoffs'),
      edge('branch-recovery', 'recovery-warroom'),
      edge('branch-recovery', 'recovery-scope'),
      edge('branch-owners', 'owner-dri'),
      edge('branch-owners', 'owner-pmo'),
      edge('branch-metrics', 'knowledge-kpi'),
      edge('branch-metrics', 'metric-backlog'),
      edge('branch-risks', 'risk-morale'),
      edge('branch-risks', 'risk-quality'),
      edge('branch-comms', 'note-standup'),
      edge('branch-comms', 'evidence-plan'),
      edge('break-handoffs', 'owner-dri', 'relation', { data: { relation: 'mitigates', label: 'mitigates' } }),
      edge('owner-pmo', 'recovery-warroom', 'relation', { data: { relation: 'supports', label: 'supports' } }),
      edge('risk-morale', 'recovery-warroom', 'relation', { data: { relation: 'constrains', label: 'constrains' } }),
      edge('metric-backlog', 'break-handoffs', 'relation', { data: { relation: 'tracks', label: 'tracks' } }),
    ];
    return makeMap(
      'Q2 Delivery Recovery Plan',
      'Execution recovery map with owner assignment, metrics, risks and communication plan.',
      ['showcase', 'delivery', 'execution'],
      nodes,
      edges,
      { mindmap: { viewState: { collapsedNodeIds: ['branch-comms'], viewport: { x: 80, y: 30, zoom: 0.9 } } } }
    );
  })();

  const map5 = (() => {
    const base = starterFrame('Statement imports fail because issuer data is inconsistent and weakly controlled.', [
      { id: 'branch-defects', label: 'Source Defects', x: -430, y: -220, branchKey: 'defects' },
      { id: 'branch-controls', label: 'Controls', x: 430, y: -220, branchKey: 'controls' },
      { id: 'branch-model', label: 'Model Changes', x: 520, y: 20, branchKey: 'model' },
      { id: 'branch-validation', label: 'Validation', x: -350, y: 210, branchKey: 'validation' },
      { id: 'branch-rollout', label: 'Rollout', x: 80, y: 330, branchKey: 'rollout' },
    ]);
    const nodes = [
      base.root,
      ...base.branches,
      ideaNode('defect-ifrs', 'IFRS labels vary by issuer and language', -650, -260, 'defects', {
        tags: ['finance', 'imports'],
      }),
      ideaNode('defect-missing', 'Some issuers omit or reorder required lines', -620, -120, 'defects', {
        tags: ['finance', 'quality'],
      }),
      ideaNode('control-registry', 'Enforce canonical line registry', 620, -250, 'controls', { semanticType: 'decision' }),
      ideaNode('control-scorecard', 'Add quality scorecard per import batch', 620, -120, 'controls', { semanticType: 'option' }),
      ideaNode('model-locale', 'Store locale-aware aliases under one canonical concept', 580, 40, 'model', {
        semanticType: 'decision',
      }),
      ideaNode('model-exceptions', 'Persist explicit exception handling for ambiguous mappings', 620, 160, 'model', {
        semanticType: 'decision',
      }),
      cardNode('knowledge-ifrs', 'knowledgeCard', 'IFRS imports need locale-aware canonical mapping and reviewable exceptions.', -340, 290, 'validation', {
        notes: 'Polish and English variants should map to one concept where possible.',
      }),
      cardNode('evidence-json', 'evidenceCard', 'Real corpus audit JSON', -520, 180, 'validation', {
        artifactLinks: [{ artifactRef: { type: 'report', id: 'REP-REAL-CORPUS' }, label: 'Real corpus report' }],
      }),
      ideaNode('validation-corpus', 'Run real-corpus audit on 20 statements', -110, 380, 'rollout', {
        goal: 'Verify scorecard coverage against real data.',
      }),
      ideaNode('validation-gate', 'Ship only after exception review workflow is visible in UI', 120, 310, 'rollout', {
        semanticType: 'constraint',
      }),
      cardNode('note-audit', 'noteCard', 'Attach every generated audit artifact back to the map.', 300, 420, 'rollout', {
        artifactLinks: [{ artifactRef: { type: 'analysis', id: 'ANL-FINANCE-V3' }, label: 'Import analysis' }],
      }),
      ideaNode('risk-false-positive', 'Aggressive normalization can hide real defects', 300, -20, 'controls', {
        riskNote: 'Need explicit audit and exception review.',
      }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('branch-defects', 'defect-ifrs'),
      edge('branch-defects', 'defect-missing'),
      edge('branch-controls', 'control-registry'),
      edge('branch-controls', 'control-scorecard'),
      edge('branch-controls', 'risk-false-positive'),
      edge('branch-model', 'model-locale'),
      edge('branch-model', 'model-exceptions'),
      edge('branch-validation', 'knowledge-ifrs'),
      edge('branch-validation', 'evidence-json'),
      edge('branch-rollout', 'validation-corpus'),
      edge('branch-rollout', 'validation-gate'),
      edge('branch-rollout', 'note-audit'),
      edge('knowledge-ifrs', 'control-registry', 'relation', { data: { relation: 'supports', label: 'supports' } }),
      edge('risk-false-positive', 'control-registry', 'relation', { data: { relation: 'constrains', label: 'constrains' } }),
      edge('validation-corpus', 'control-scorecard', 'relation', { data: { relation: 'validates', label: 'validates' } }),
      edge('model-exceptions', 'validation-gate', 'relation', { data: { relation: 'requires', label: 'requires' } }),
    ];
    return makeMap(
      'Finance Reporting Modernization',
      'Finance modernization map with source defects, control design, validation and rollout gates.',
      ['showcase', 'finance', 'reporting'],
      nodes,
      edges,
      { mindmap: { viewState: { collapsedNodeIds: [], viewport: { x: 0, y: 70, zoom: 0.91 } } } }
    );
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
