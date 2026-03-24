#!/usr/bin/env node

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3101/api';

function toBase64Url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildE2EToken() {
  const now = Math.floor(Date.now() / 1000);
  return `${toBase64Url({ alg: 'none', typ: 'JWT' })}.${toBase64Url({
    id: 'e2e-user-id',
    email: 'e2e@local.test',
    name: 'E2E User',
    role: 'ADMIN',
    organizationId: 'e2e-org-id',
    organizationName: 'E2E Organization',
    e2e: true,
    iat: now,
    exp: now + 60 * 60,
  })}.x`;
}

const TOKEN = buildE2EToken();

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
    ...(options.headers || {}),
  };
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${res.status} ${text}`);
  }
  return data;
}

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
    data: {
      label,
      branchKey,
      hint: 'Seeded showcase branch',
    },
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

function starterFrame(title) {
  const root = {
    id: 'root',
    type: 'center',
    position: { x: 0, y: 0 },
    data: {
      label: title,
      hint: 'Seeded showcase map',
    },
  };
  const branches = [
    branchNode('branch-problem', 'Problem', -320, -180, 'problem'),
    branchNode('branch-options', 'Options', 320, -180, 'options'),
    branchNode('branch-evidence', 'Evidence', -320, 20, 'evidence'),
    branchNode('branch-risks', 'Risks', 320, 20, 'risks'),
    branchNode('branch-experiments', 'Experiments', 0, 240, 'experiments'),
  ];
  const branchEdges = [
    edge('root', 'branch-problem'),
    edge('root', 'branch-options'),
    edge('root', 'branch-evidence'),
    edge('root', 'branch-risks'),
    edge('root', 'branch-experiments'),
  ];
  return { root, branches, branchEdges };
}

function makeMap(title, body, tags, nodes, edges, extensions = {}) {
  return { title, body, tags, nodes, edges, extensions };
}

function showcaseMaps() {
  const map1 = (() => {
    const base = starterFrame('Market Expansion Decision');
    const nodes = [
      base.root,
      ...base.branches,
      ideaNode('opt-pl', 'Launch in Poland first', 520, -240, 'options', {
        semanticType: 'option',
        status: 'candidate',
        tags: ['market', 'launch'],
        context: 'Fastest path to first revenue validation.',
        artifactLinks: [{ artifactRef: { type: 'decision', id: 'DEC-PL-LAUNCH' }, label: 'Launch decision' }],
      }),
      ideaNode('opt-de', 'Pilot in Germany with partner', 560, -140, 'options', {
        semanticType: 'option',
        status: 'candidate',
        tags: ['partner', 'pilot'],
      }),
      ideaNode('problem-ltv', 'CAC payback is too slow', -560, -220, 'problem', {
        semanticType: 'risk',
        rationale: 'Current funnel does not recover acquisition in < 6 months.',
      }),
      ideaNode('risk-compliance', 'Local compliance load', 560, 10, 'risks', {
        semanticType: 'risk',
        riskNote: 'Need local accounting and tax partner.',
      }),
      ideaNode('exp-smb', 'Run SMB outbound sprint', 80, 360, 'experiments', {
        semanticType: 'action',
        goal: 'Test demand and close 3 pilot calls.',
      }),
      cardNode('knowledge-growth', 'knowledgeCard', 'Benchmarks: niche B2B expansion works best with one beachhead market', -120, -320, 'evidence', {
        notes: 'Use one market as a proof layer before cross-border scaling.',
        tags: ['benchmark', 'growth'],
      }),
      cardNode('note-team', 'noteCard', 'CEO prefers low-complexity launch', 220, 110, 'options', {
        notes: 'Keep team overhead low in the first 90 days.',
      }),
      cardNode('evidence-report', 'evidenceCard', 'Desk research summary', -520, 120, 'evidence', {
        evidenceLinks: [{ id: 'ev-1', type: 'url', title: 'Research memo', url: 'https://example.com/research' }],
      }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('branch-options', 'opt-pl'),
      edge('branch-options', 'opt-de'),
      edge('branch-problem', 'problem-ltv'),
      edge('branch-risks', 'risk-compliance'),
      edge('branch-experiments', 'exp-smb'),
      edge('branch-evidence', 'knowledge-growth'),
      edge('branch-evidence', 'evidence-report'),
      edge('opt-pl', 'note-team'),
      edge('problem-ltv', 'opt-pl', 'relation', { data: { relation: 'supports', label: 'supports' } }),
      edge('risk-compliance', 'opt-de', 'relation', { data: { relation: 'blocks', label: 'blocks' } }),
      edge('exp-smb', 'opt-pl', 'relation', { data: { relation: 'validates', label: 'validates' } }),
    ];
    return makeMap(
      'Market Expansion Decision',
      'Showcase map for option comparison, evidence, risks and linked artifacts.',
      ['showcase', 'strategy', 'growth'],
      nodes,
      edges,
      {
        mindmap: {
          viewState: {
            collapsedNodeIds: [],
            viewport: { x: 50, y: 80, zoom: 0.92 },
          },
        },
      }
    );
  })();

  const map2 = (() => {
    const base = starterFrame('Customer Interview Synthesis');
    const nodes = [
      base.root,
      ...base.branches,
      ideaNode('problem-onboarding', 'Onboarding feels too manual', -560, -220, 'problem', {
        context: 'Repeated in 7/10 interviews.',
        tags: ['interviews', 'ops'],
      }),
      ideaNode('problem-reporting', 'Teams cannot see ROI quickly', -540, -120, 'problem', {
        context: 'Exec buyers want week-one visibility.',
      }),
      ideaNode('option-guided', 'Build guided setup flow', 520, -220, 'options', {
        semanticType: 'option',
      }),
      ideaNode('option-template', 'Offer role-based starter templates', 540, -120, 'options', {
        semanticType: 'option',
      }),
      ideaNode('experiment-concierge', 'Run concierge onboarding for 5 pilots', 40, 360, 'experiments', {
        goal: 'Validate which setup tasks must be automated first.',
      }),
      cardNode('note-quote', 'noteCard', '"We loved the idea, but setup took two workshops."', -120, 120, 'evidence', {
        notes: 'Interview quote from operations lead.',
        tags: ['quote'],
      }),
      cardNode('knowledge-pattern', 'knowledgeCard', 'Pattern: value realization needs first 7-day report', -520, 80, 'evidence', {
        notes: 'Strong signal across buyers and champions.',
      }),
      cardNode('evidence-call', 'evidenceCard', 'Interview recording index', -430, 200, 'evidence', {
        artifactLinks: [{ artifactRef: { type: 'meeting', id: 'MTG-CUST-07' }, label: 'Interview call' }],
      }),
      ideaNode('risk-overbuild', 'Automation scope could expand too early', 560, 20, 'risks', {
        riskNote: 'Avoid building integrations before core setup path is clear.',
      }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('branch-problem', 'problem-onboarding'),
      edge('branch-problem', 'problem-reporting'),
      edge('branch-options', 'option-guided'),
      edge('branch-options', 'option-template'),
      edge('branch-experiments', 'experiment-concierge'),
      edge('branch-evidence', 'note-quote'),
      edge('branch-evidence', 'knowledge-pattern'),
      edge('branch-evidence', 'evidence-call'),
      edge('branch-risks', 'risk-overbuild'),
      edge('knowledge-pattern', 'option-guided', 'relation', { data: { relation: 'supports', label: 'supports' } }),
      edge('note-quote', 'problem-onboarding', 'relation', { data: { relation: 'evidence_for', label: 'evidence' } }),
      edge('experiment-concierge', 'option-template', 'relation', { data: { relation: 'validates', label: 'validates' } }),
    ];
    return makeMap(
      'Customer Interview Synthesis',
      'Showcase map for note/evidence cards, interview findings and linked meeting artifact.',
      ['showcase', 'research', 'customer'],
      nodes,
      edges,
      {
        mindmap: {
          viewState: {
            collapsedNodeIds: ['branch-risks'],
            viewport: { x: -40, y: 60, zoom: 0.88 },
          },
        },
      }
    );
  })();

  const map3 = (() => {
    const base = starterFrame('AI Workflow Automation Blueprint');
    const nodes = [
      base.root,
      ...base.branches,
      ideaNode('problem-copy', 'Analysts repeat the same intake steps', -560, -200, 'problem', {
        status: 'active',
      }),
      ideaNode('option-ai-brief', 'Generate draft brief from uploaded docs', 560, -220, 'options', {
        semanticType: 'action',
        artifactLinks: [{ artifactRef: { type: 'tool', id: 'TOOL-DOC-PARSER' }, label: 'Doc parser' }],
      }),
      ideaNode('option-routing', 'Route items by semantic tags', 560, -120, 'options', {
        semanticType: 'action',
      }),
      ideaNode('risk-hallucination', 'AI writes silently without review', 560, 20, 'risks', {
        riskNote: 'Must keep accept/reject governance.',
      }),
      ideaNode('experiment-shadow', 'Shadow-run automation for 2 weeks', 0, 360, 'experiments', {
        goal: 'Measure time saved before operational rollout.',
      }),
      cardNode('knowledge-governance', 'knowledgeCard', 'Governed AI flow = propose -> preview -> accept', -420, 100, 'evidence', {
        notes: 'Core adoption requirement from audit.',
      }),
      cardNode('note-ops', 'noteCard', 'Ops wants confidence score on every generated step', 220, 110, 'options'),
      cardNode('evidence-audit', 'evidenceCard', 'Audit checklist', -520, 180, 'evidence', {
        artifactLinks: [{ artifactRef: { type: 'report', id: 'REP-AI-AUDIT' }, label: 'AI audit report' }],
      }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('branch-problem', 'problem-copy'),
      edge('branch-options', 'option-ai-brief'),
      edge('branch-options', 'option-routing'),
      edge('branch-risks', 'risk-hallucination'),
      edge('branch-experiments', 'experiment-shadow'),
      edge('branch-evidence', 'knowledge-governance'),
      edge('branch-evidence', 'evidence-audit'),
      edge('option-ai-brief', 'note-ops'),
      edge('knowledge-governance', 'risk-hallucination', 'relation', { data: { relation: 'mitigates', label: 'mitigates' } }),
      edge('experiment-shadow', 'option-ai-brief', 'relation', { data: { relation: 'validates', label: 'validates' } }),
      edge('problem-copy', 'option-routing', 'relation', { data: { relation: 'supports', label: 'supports' } }),
    ];
    return makeMap(
      'AI Workflow Automation Blueprint',
      'Showcase map for governance-related links, report artifacts and action-focused branches.',
      ['showcase', 'automation', 'ai'],
      nodes,
      edges,
      {
        governance: {
          replay: [
            {
              action: 'seeded_showcase',
              at: new Date().toISOString(),
              summary: 'Initial governed automation blueprint',
            },
          ],
        },
        mindmap: {
          viewState: {
            collapsedNodeIds: [],
            viewport: { x: 30, y: 40, zoom: 0.94 },
          },
        },
      }
    );
  })();

  const map4 = (() => {
    const base = starterFrame('Q2 Delivery Recovery Plan');
    const nodes = [
      base.root,
      ...base.branches,
      ideaNode('problem-slip', 'Critical milestones slipped by 3 weeks', -560, -220, 'problem', {
        status: 'blocked',
      }),
      ideaNode('problem-owners', 'Dependencies have no clear owner', -540, -110, 'problem', {
        status: 'at_risk',
      }),
      ideaNode('option-warroom', 'Create daily recovery war room', 560, -220, 'options', {
        priority: 80,
      }),
      ideaNode('option-scope', 'Freeze lower-priority scope', 560, -110, 'options', {
        priority: 75,
      }),
      ideaNode('risk-morale', 'Recovery pace could burn out team', 560, 20, 'risks', {
        riskNote: 'Need explicit workload guardrails.',
      }),
      ideaNode('experiment-pilot', 'Pilot one recovery cell before global rollout', 0, 360, 'experiments', {
        goal: 'Validate operating cadence on one stream first.',
      }),
      cardNode('knowledge-kpi', 'knowledgeCard', 'Recovery success metric: restore forecast confidence > 80%', -400, 100, 'evidence', {
        artifactLinks: [{ artifactRef: { type: 'kpi', id: 'KPI-DELIVERY-CONFIDENCE' }, label: 'Delivery confidence KPI' }],
      }),
      cardNode('note-owners', 'noteCard', 'Need one DRI for each dependency cluster', 240, 120, 'options'),
      cardNode('evidence-plan', 'evidenceCard', 'Recovery worksheet', -520, 180, 'evidence', {
        artifactLinks: [{ artifactRef: { type: 'project', id: 'PRJ-Q2-RECOVERY' }, label: 'Recovery project' }],
      }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('branch-problem', 'problem-slip'),
      edge('branch-problem', 'problem-owners'),
      edge('branch-options', 'option-warroom'),
      edge('branch-options', 'option-scope'),
      edge('branch-risks', 'risk-morale'),
      edge('branch-experiments', 'experiment-pilot'),
      edge('branch-evidence', 'knowledge-kpi'),
      edge('branch-evidence', 'evidence-plan'),
      edge('option-warroom', 'note-owners'),
      edge('problem-owners', 'option-warroom', 'relation', { data: { relation: 'supports', label: 'supports' } }),
      edge('risk-morale', 'option-warroom', 'relation', { data: { relation: 'constrains', label: 'constrains' } }),
      edge('experiment-pilot', 'option-scope', 'relation', { data: { relation: 'tests', label: 'tests' } }),
    ];
    return makeMap(
      'Q2 Delivery Recovery Plan',
      'Showcase map for execution planning, KPI artifacts and constraint links.',
      ['showcase', 'delivery', 'execution'],
      nodes,
      edges,
      {
        mindmap: {
          viewState: {
            collapsedNodeIds: ['branch-evidence'],
            viewport: { x: 80, y: 30, zoom: 0.9 },
          },
        },
      }
    );
  })();

  const map5 = (() => {
    const base = starterFrame('Finance Reporting Modernization');
    const nodes = [
      base.root,
      ...base.branches,
      ideaNode('problem-import', 'Statement imports are inconsistent across issuers', -560, -220, 'problem', {
        tags: ['finance', 'imports'],
      }),
      ideaNode('option-canonical', 'Enforce canonical line registry', 560, -220, 'options', {
        semanticType: 'decision',
      }),
      ideaNode('option-scorecard', 'Add quality scorecard per import batch', 560, -120, 'options', {
        semanticType: 'option',
      }),
      ideaNode('risk-false-positive', 'Aggressive normalization can hide defects', 560, 20, 'risks', {
        riskNote: 'Need explicit audit and exception review.',
      }),
      ideaNode('experiment-corpus', 'Run real-corpus audit on 20 statements', 0, 360, 'experiments', {
        goal: 'Verify scorecard coverage against real data.',
      }),
      cardNode('knowledge-ifrs', 'knowledgeCard', 'IFRS labels require locale-aware canonical mapping', -440, 100, 'evidence', {
        notes: 'Polish + English variants should map to same concept where possible.',
      }),
      cardNode('note-audit', 'noteCard', 'Keep generated audit docs attached to the map', 200, 120, 'options', {
        artifactLinks: [{ artifactRef: { type: 'analysis', id: 'ANL-FINANCE-V3' }, label: 'Import analysis' }],
      }),
      cardNode('evidence-json', 'evidenceCard', 'Real corpus audit JSON', -520, 180, 'evidence', {
        artifactLinks: [{ artifactRef: { type: 'report', id: 'REP-REAL-CORPUS' }, label: 'Real corpus report' }],
      }),
    ];
    const edges = [
      ...base.branchEdges,
      edge('branch-problem', 'problem-import'),
      edge('branch-options', 'option-canonical'),
      edge('branch-options', 'option-scorecard'),
      edge('branch-risks', 'risk-false-positive'),
      edge('branch-experiments', 'experiment-corpus'),
      edge('branch-evidence', 'knowledge-ifrs'),
      edge('branch-evidence', 'evidence-json'),
      edge('option-scorecard', 'note-audit'),
      edge('knowledge-ifrs', 'option-canonical', 'relation', { data: { relation: 'supports', label: 'supports' } }),
      edge('risk-false-positive', 'option-canonical', 'relation', { data: { relation: 'constrains', label: 'constrains' } }),
      edge('experiment-corpus', 'option-scorecard', 'relation', { data: { relation: 'validates', label: 'validates' } }),
    ];
    return makeMap(
      'Finance Reporting Modernization',
      'Showcase map for finance-oriented evidence, analyses and modernization decisions.',
      ['showcase', 'finance', 'reporting'],
      nodes,
      edges,
      {
        mindmap: {
          viewState: {
            collapsedNodeIds: [],
            viewport: { x: 0, y: 70, zoom: 0.91 },
          },
        },
      }
    );
  })();

  return [map1, map2, map3, map4, map5];
}

async function clearIdeas() {
  const ideas = await api('/my-work/my-ideas');
  for (const idea of ideas) {
    await api(`/my-work/my-ideas/${encodeURIComponent(idea.id)}`, { method: 'DELETE' });
  }
  return ideas.length;
}

async function createIdeaRecord(title, body, tags) {
  return api('/my-work/my-ideas', {
    method: 'POST',
    body: JSON.stringify({ title, body, tags }),
  });
}

async function syncMap(ideaId, nodes, edges, extensions) {
  return api(`/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/sync`, {
    method: 'POST',
    body: JSON.stringify({
      nodes,
      edges,
      baseVersion: 1,
      preferredTool: 'mindmap',
      extensions,
      reason: 'manual',
    }),
  });
}

async function createSnapshot(ideaId, label, nodes, edges) {
  return api(`/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/snapshots`, {
    method: 'POST',
    body: JSON.stringify({ label, nodes, edges }),
  });
}

async function main() {
  const removedCount = await clearIdeas();
  const maps = showcaseMaps();
  const created = [];

  for (const map of maps) {
    const idea = await createIdeaRecord(map.title, map.body, map.tags);
    const ideaId = String(idea?.id || idea?.idea?.id || '').trim();
    if (!ideaId) {
      throw new Error(`Missing idea id for "${map.title}"`);
    }
    await syncMap(ideaId, map.nodes, map.edges, map.extensions);
    await createSnapshot(ideaId, 'Initial showcase snapshot', map.nodes, map.edges).catch(() => null);
    created.push({
      id: ideaId,
      title: map.title,
      nodes: map.nodes.length,
      edges: map.edges.length,
    });
  }

  console.log(
    JSON.stringify(
      {
        removedCount,
        createdCount: created.length,
        created,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
