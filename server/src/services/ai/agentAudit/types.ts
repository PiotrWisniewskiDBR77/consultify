import { z } from 'zod';

export type AgentKind = 'industry' | 'functional' | 'adversarial';

export type UserIntent = 'validate' | 'stress_test' | 'approve';

export type QualityStatus = 'PASS' | 'PASS_WITH_RISKS' | 'FAIL';

export type RiskArea =
  | 'cashflow'
  | 'capex'
  | 'safety'
  | 'uptime'
  | 'quality'
  | 'compliance'
  | 'cybersecurity'
  | 'vendor_risk'
  | 'delivery_otif'
  | 'change_management'
  | 'architecture_integrations'
  | 'other';

function normalizeRiskArea(raw: unknown): RiskArea {
  const t = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!t) return 'other';

  // common synonyms
  if (t.includes('cash') || t.includes('liquidity') || t.includes('płyn')) return 'cashflow';
  if (t.includes('capex') || t.includes('investment') || t.includes('inwest')) return 'capex';
  if (t.includes('safety') || t.includes('bhp') || t.includes('loto')) return 'safety';
  if (t.includes('uptime') || t.includes('downtime') || t.includes('availability')) return 'uptime';
  if (t.includes('quality') || t.includes('defect') || t.includes('scrap') || t.includes('jako')) {
    return 'quality';
  }
  if (t.includes('compliance') || t.includes('regul') || t.includes('rodo')) return 'compliance';
  if (t.includes('cyber') || t.includes('security') || t.includes('infosec'))
    return 'cybersecurity';
  if (
    t.includes('vendor') ||
    t.includes('supplier') ||
    t.includes('single_source') ||
    t.includes('tco')
  ) {
    return 'vendor_risk';
  }
  if (t.includes('otif') || t.includes('delivery') || t.includes('lead_time'))
    return 'delivery_otif';
  if (
    t.includes('change') ||
    t.includes('adoption') ||
    t.includes('training') ||
    t.includes('opór')
  ) {
    return 'change_management';
  }
  if (t.includes('integration') || t.includes('architecture') || t.includes('api')) {
    return 'architecture_integrations';
  }

  // canonical
  const allowed = new Set<RiskArea>([
    'cashflow',
    'capex',
    'safety',
    'uptime',
    'quality',
    'compliance',
    'cybersecurity',
    'vendor_risk',
    'delivery_otif',
    'change_management',
    'architecture_integrations',
    'other',
  ]);
  return allowed.has(t as RiskArea) ? (t as RiskArea) : 'other';
}

export const RiskAreaSchema = z.preprocess(
  (v) => normalizeRiskArea(v),
  z.enum([
    'cashflow',
    'capex',
    'safety',
    'uptime',
    'quality',
    'compliance',
    'cybersecurity',
    'vendor_risk',
    'delivery_otif',
    'change_management',
    'architecture_integrations',
    'other',
  ])
);

export const DecisionContextSchema = z.object({
  topic: z.string().min(1),
  industry: z.string().optional(),
  horizon: z.string().optional(),
  functions: z.array(z.string()).default([]),
  riskFocus: z.array(z.string()).default([]),
});
export type DecisionContext = z.infer<typeof DecisionContextSchema>;

// ---------------------------------------------------------------------------
// KB entry contract (future-proofing for per-agent KB)
// ---------------------------------------------------------------------------

export const KBEntryTypeSchema = z.enum([
  'checklist',
  'failure',
  'metric',
  'constraint',
  'case',
  'definition',
]);
export type KBEntryType = z.infer<typeof KBEntryTypeSchema>;

export const KBEntrySchema = z.object({
  id: z.string().min(1),
  type: KBEntryTypeSchema,
  domain: z.string().min(1),
  purpose: z.string().min(1),
  triggerQuestions: z.array(z.string().min(1)).max(10).default([]),
  limits: z.array(z.string().min(1)).max(10).default([]),
  severityHints: z.array(z.string().min(1)).max(10).default([]),
  content: z.string().min(1).max(6000), // ~1 page
  version: z.string().optional(),
});
export type KBEntry = z.infer<typeof KBEntrySchema>;

// ---------------------------------------------------------------------------
// Sources (for transparency)
// ---------------------------------------------------------------------------

export const SourceUsedSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('dt_section'),
    section: z.string().min(1),
    quote: z.string().optional(),
  }),
  z.object({
    type: z.literal('kb_snippet'),
    kbId: z.string().min(1), // which KB collection / agent KB
    docId: z.string().min(1),
    title: z.string().min(1),
    version: z.string().optional(),
    snippet: z.string().min(1),
    score: z.number().optional(),
  }),
  z.object({
    type: z.literal('web_source'),
    url: z.string().url(),
    title: z.string().optional(),
    domain: z.string().optional(),
  }),
]);
export type SourceUsed = z.infer<typeof SourceUsedSchema>;

export const SuggestedAgentSchema = z.object({
  agentId: z.string().min(1),
  type: z.enum(['industry', 'functional', 'adversarial']),
  whySelected: z.string().min(1),
  expectedFindings: z.array(z.string()).max(8).default([]),
  // Optional selection transparency
  ruleId: z.string().optional(),
  signals: z.array(z.string()).max(12).optional().default([]),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type SuggestedAgent = z.infer<typeof SuggestedAgentSchema>;

export const SuggestedAgentsSetSchema = z.object({
  orchestratorRunId: z.string().min(1),
  decisionContext: DecisionContextSchema,
  agents: z.array(SuggestedAgentSchema).min(1),
  constraints: z.object({
    maxAgents: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    requireManualApproval: z.literal(true),
  }),
});
export type SuggestedAgentsSet = z.infer<typeof SuggestedAgentsSetSchema>;

export const AgentReviewSchema = z.object({
  agentId: z.string().min(1),
  agentVersion: z.string().optional(),
  verdict: z.enum(['ok', 'risk', 'blocker']),
  overreach: z.enum(['none', 'suspected', 'hard']).default('none'),
  overreachReason: z.string().optional(),
  observations: z.array(z.string()).max(12).default([]),
  challengedAssumptions: z.array(z.string()).max(10).default([]),
  impactIfIgnored: z.string().min(1).optional(),
  whenItFails: z.string().min(1).optional(),
  topQuestions: z.array(z.string().min(1)).max(5).default([]),
  findings: z
    .array(
      z.object({
        area: RiskAreaSchema.default('other'),
        severity: z.enum(['low', 'medium', 'high']),
        claim: z.string().min(1),
        evidenceFromDT: z.array(z.string()).max(6).default([]),
        sourcesUsed: z.array(SourceUsedSchema).max(12).default([]),
        // Convention: prefix MUST: for Gate C candidates
        missingDataQuestions: z.array(z.string()).max(10).default([]),
        suggestedDeepening: z.string().min(1),
      })
    )
    .max(12)
    .default([]),
  conflicts: z
    .array(
      z.object({
        withAgentId: z.string().min(1),
        aboutArea: RiskAreaSchema.default('other'),
        conflictStatement: z.string().min(1),
      })
    )
    .max(10)
    .default([]),
});
export type AgentReview = z.infer<typeof AgentReviewSchema>;

export const GateIdSchema = z.enum(['A', 'B', 'C', 'D']);
export type GateId = z.infer<typeof GateIdSchema>;

export const GateExplanationSchema = z.object({
  gate: GateIdSchema,
  reason: z.string().min(1),
  // Optional pointers (e.g. which agent/finding triggered)
  triggeredBy: z
    .object({
      agentId: z.string().optional(),
      area: RiskAreaSchema.optional(),
      severity: z.enum(['low', 'medium', 'high']).optional(),
      claim: z.string().optional(),
    })
    .optional(),
});
export type GateExplanation = z.infer<typeof GateExplanationSchema>;

export const OrchestratorVerdictSchema = z.object({
  qualityStatus: z.enum(['PASS', 'PASS_WITH_RISKS', 'FAIL']),
  gatesTriggered: z.array(GateIdSchema).default([]),
  gateExplanations: z.array(GateExplanationSchema).max(12).default([]),
  agentsSummary: z
    .array(
      z.object({
        agentId: z.string().min(1),
        agentVersion: z.string().min(1),
      })
    )
    .default([]),
  sourcesSummary: z
    .object({
      counts: z.object({
        dt_section: z.number().int().nonnegative(),
        kb_snippet: z.number().int().nonnegative(),
        web_source: z.number().int().nonnegative(),
      }),
      kb: z
        .array(
          z.object({
            kbId: z.string().min(1),
            docId: z.string().min(1),
            title: z.string().min(1),
            version: z.string().optional(),
          })
        )
        .default([]),
      web: z
        .array(
          z.object({
            url: z.string().url(),
            title: z.string().optional(),
            domain: z.string().optional(),
          })
        )
        .default([]),
    })
    .default({
      counts: { dt_section: 0, kb_snippet: 0, web_source: 0 },
      kb: [],
      web: [],
    }),
  criticalRisks: z.array(AgentReviewSchema.shape.findings.element).default([]),
  actionableFollowups: z
    .array(
      z.object({
        id: z.string().min(1),
        owner: z.enum(['user', 'deep_thinking']),
        question: z.string().min(1),
        whyCritical: z.string().min(1),
      })
    )
    .default([]),
  directedLoop: z
    .union([
      z.null(),
      z.object({
        iteration: z.union([z.literal(1), z.literal(2)]),
        deepThinkingPrompt: z.string().min(1),
      }),
    ])
    .default(null),
});
export type OrchestratorVerdict = z.infer<typeof OrchestratorVerdictSchema>;

export type AgentDefinition = {
  id: string;
  kind: AgentKind;
  version?: string;
  displayName: { pl: string; en: string };
  description: { pl: string; en: string };
  // High-level focus areas (helps orchestrator explain selection & aggregate)
  defaultRiskAreas: RiskArea[];
  // Prompt fragment (role identity + typical veto logic)
  systemIdentityPrompt: string;
};
