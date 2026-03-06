import { z } from 'zod';

import { aiLogger } from './logger.js';

export const IntentSchema = z.enum([
  'answer', 'analyze', 'recommend', 'create', 'update', 'explain',
  'compare', 'summarize', 'diagnose', 'plan', 'clarify', 'unknown',
]);

export type Intent = z.infer<typeof IntentSchema>;

export const ContextArtifactRefSchema = z.object({
  artifactType: z.string(),
  artifactId: z.string(),
  title: z.string().optional(),
  relevanceScore: z.number().min(0).max(1).optional(),
});

export type ContextArtifactRef = z.infer<typeof ContextArtifactRefSchema>;

export const IntentRoutingResultSchema = z.object({
  intent: IntentSchema,
  confidence: z.number().min(0).max(1),
  requiredContext: z.array(z.string()),
  suggestedModel: z.object({
    tier: z.string(),
    purpose: z.string(),
    reason: z.string(),
  }),
  contextArtifacts: z.array(ContextArtifactRefSchema),
  routingTrace: z.array(z.object({
    step: z.string(),
    result: z.string(),
    durationMs: z.number().optional(),
  })),
});

export type IntentRoutingResult = z.infer<typeof IntentRoutingResultSchema>;

const INTENT_PATTERNS: Array<{
  intent: Intent;
  patterns: RegExp[];
  contextNeeds: string[];
}> = [
  { intent: 'create', patterns: [/\b(create|add|new|make|generate|build)\b/i], contextNeeds: ['tasks', 'initiatives'] },
  { intent: 'update', patterns: [/\b(update|change|modify|edit|set|assign)\b/i], contextNeeds: ['tasks', 'initiatives'] },
  { intent: 'analyze', patterns: [/\b(analyze|analysis|assess|evaluate|review)\b/i], contextNeeds: ['kpis', 'risks', 'tasks', 'initiatives'] },
  { intent: 'recommend', patterns: [/\b(recommend|suggest|advise|propose|what should)\b/i], contextNeeds: ['tasks', 'risks', 'decisions', 'initiatives'] },
  { intent: 'compare', patterns: [/\b(compare|versus|vs|difference|between)\b/i], contextNeeds: ['initiatives', 'kpis', 'benchmarks'] },
  { intent: 'summarize', patterns: [/\b(summarize|summary|overview|brief|recap)\b/i], contextNeeds: ['initiatives', 'tasks', 'decisions'] },
  { intent: 'diagnose', patterns: [/\b(diagnose|why|root cause|problem|issue|blocked)\b/i], contextNeeds: ['tasks', 'risks', 'decisions', 'signals'] },
  { intent: 'plan', patterns: [/\b(plan|schedule|roadmap|timeline|milestone)\b/i], contextNeeds: ['tasks', 'milestones', 'dependencies'] },
  { intent: 'explain', patterns: [/\b(explain|how|what is|describe|tell me about)\b/i], contextNeeds: ['knowledge'] },
  { intent: 'clarify', patterns: [/\b(clarify|unclear|confused|what do you mean)\b/i], contextNeeds: [] },
];

const INTENT_TO_TIER: Record<string, string> = {
  create: 'STANDARD',
  update: 'STANDARD',
  answer: 'STANDARD',
  analyze: 'PREMIUM',
  recommend: 'PREMIUM',
  diagnose: 'PREMIUM',
  compare: 'PREMIUM',
  plan: 'PREMIUM',
  summarize: 'STANDARD',
  explain: 'STANDARD',
  clarify: 'BUDGET',
  unknown: 'STANDARD',
};

const INTENT_TO_PURPOSE: Record<string, string> = {
  create: 'task_management',
  update: 'task_management',
  analyze: 'analysis',
  diagnose: 'analysis',
  recommend: 'advisory',
  plan: 'advisory',
  compare: 'analysis',
  summarize: 'general',
  explain: 'general',
  answer: 'general',
  clarify: 'general',
  unknown: 'general',
};

export function classifyIntent(message: string): { intent: Intent; confidence: number } {
  let bestIntent: Intent = 'unknown';
  let bestScore = 0;

  for (const rule of INTENT_PATTERNS) {
    let score = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(message)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIntent = rule.intent;
    }
  }

  const confidence = bestScore > 0 ? Math.min(0.5 + bestScore * 0.2, 0.95) : 0.3;
  return { intent: bestIntent, confidence };
}

export async function routeIntent(
  message: string,
  orgId: string,
  conversationContext?: { recentIntents?: string[]; artifactIds?: string[] },
): Promise<IntentRoutingResult> {
  const startTime = Date.now();
  const trace: IntentRoutingResult['routingTrace'] = [];

  const { intent, confidence } = classifyIntent(message);
  trace.push({
    step: 'classify_intent',
    result: `${intent} (${confidence})`,
    durationMs: Date.now() - startTime,
  });

  const rule = INTENT_PATTERNS.find(r => r.intent === intent);
  const requiredContext = rule?.contextNeeds || ['knowledge'];
  trace.push({ step: 'determine_context', result: requiredContext.join(', ') });

  const contextArtifacts: ContextArtifactRef[] = (conversationContext?.artifactIds || []).map(id => ({
    artifactType: 'unknown',
    artifactId: id,
    relevanceScore: 0.8,
  }));
  trace.push({ step: 'resolve_artifacts', result: `${contextArtifacts.length} artifacts` });

  const tier = INTENT_TO_TIER[intent] || 'STANDARD';
  const purpose = INTENT_TO_PURPOSE[intent] || 'general';
  trace.push({ step: 'select_model', result: `tier=${tier}, purpose=${purpose}` });

  aiLogger.info('IntentRouter', `Routed intent="${intent}" conf=${confidence} tier=${tier} org=${orgId}`);

  return {
    intent,
    confidence,
    requiredContext,
    suggestedModel: {
      tier,
      purpose,
      reason: `Intent "${intent}" maps to ${tier} tier for ${purpose}`,
    },
    contextArtifacts,
    routingTrace: trace,
  };
}
