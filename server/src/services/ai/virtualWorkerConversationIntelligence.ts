type TurnLike = {
  role: 'user' | 'assistant';
  content: string;
};

type SurfaceContext =
  | {
      surface?: 'knowledge_article';
      articleTitle?: string;
      articleSummary?: string;
      categoryName?: string;
      currentSection?: string;
      articleUrl?: string;
    }
  | undefined;

export type ConversationIntelligence = {
  primaryTopic: string;
  secondaryTopics: string[];
  topicFamily: string;
  topicConfidence: number;
  intent: string;
  productsDiscussed: string[];
  fallbackReason: string | null;
  summary: string;
  qualityFlags: string[];
  sessionMemory: Record<string, unknown>;
  outcome: 'demo_requested' | 'trial_started' | 'question_answered' | 'escalated' | 'abandoned' | 'unknown';
};

const TOPIC_RULES: Array<{ family: string; topic: string; patterns: RegExp[] }> = [
  {
    family: 'pricing',
    topic: 'pricing_and_commercial_model',
    patterns: [/\bprice|pricing|cost|budget|subscription|cena|koszt|wycena|abonament\b/i],
  },
  {
    family: 'security',
    topic: 'security_and_trust',
    patterns: [/\bsecurity|secure|compliance|privacy|trust|bezpieczen|certyfik|dane\b/i],
  },
  {
    family: 'demo',
    topic: 'demo_and_next_step',
    patterns: [/\bdemo|book|schedule|spotkanie|prezentacj|pokaz|call\b/i],
  },
  {
    family: 'trial',
    topic: 'trial_and_activation',
    patterns: [/\btrial|start|signup|access|test|wdrozen|uruchom|triala\b/i],
  },
  {
    family: 'product',
    topic: 'product_capabilities',
    patterns: [/\bfeature|capabilit|workflow|module|product|funkcj|mozliw|jak dziala\b/i],
  },
  {
    family: 'roi',
    topic: 'business_value_and_roi',
    patterns: [/\broi|value|impact|benefit|outcome|wartosc|efekt|zwrot\b/i],
  },
  {
    family: 'ecosystem',
    topic: 'ecosystem_and_cross_product_fit',
    patterns: [/\becosystem|portfolio|vector|iris|iiot|digital twin|marketplace|dbr77\b/i],
  },
];

const PRODUCT_RULES: Array<{ slug: string; patterns: RegExp[] }> = [
  { slug: 'consultify', patterns: [/\bconsultify\b/i] },
  { slug: 'vector', patterns: [/\bvector\b/i] },
  { slug: 'dbr77', patterns: [/\bdbr77|\bdbr\b/i] },
  { slug: 'iris', patterns: [/\biris\b/i] },
  { slug: 'digital-twin', patterns: [/\bdigital twin|digital-twin\b/i] },
  { slug: 'iiot', patterns: [/\biiot|industrial iot\b/i] },
  { slug: 'marketplace', patterns: [/\bmarketplace\b/i] },
];

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function safeSlice(text: string, max = 280): string {
  const value = String(text || '').trim();
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

function detectProducts(text: string, existing: string[] = []): string[] {
  const matched = [...existing];
  for (const rule of PRODUCT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) matched.push(rule.slug);
  }
  return uniq(matched);
}

function inferIntent(text: string): string {
  if (/\bdemo|book|schedule|call|kontakt|porozmawiac\b/i.test(text)) return 'talk_to_human';
  if (/\btrial|start|signup|access|test\b/i.test(text)) return 'get_started';
  if (/\bprice|pricing|cost|budget|cena|koszt\b/i.test(text)) return 'pricing';
  if (/\bsecurity|compliance|privacy|bezpieczen|dane\b/i.test(text)) return 'security_compliance';
  if (/\bfit|use case|for us|dla nas|wdrozenie|pasuje\b/i.test(text)) return 'evaluate_fit';
  return 'learn';
}

function inferOutcome(text: string, answer: string): ConversationIntelligence['outcome'] {
  if (/\bdemo|book|schedule|kontakt|spotkanie\b/i.test(text) || /\bdemo\b/i.test(answer)) {
    return 'demo_requested';
  }
  if (/\btrial|signup|start\b/i.test(text) || /\btrial\b/i.test(answer)) {
    return 'trial_started';
  }
  if (/\bhuman|contact|sales|escalat|skontakt\b/i.test(answer)) {
    return 'escalated';
  }
  if (text.trim()) return 'question_answered';
  return 'unknown';
}

export function buildConversationIntelligence(args: {
  message: string;
  answer: string;
  history?: TurnLike[];
  matchedProducts?: string[];
  primaryProducts?: string[];
  fallbackReason?: string | null;
  surfaceContext?: SurfaceContext;
  priorSummary?: string | null;
}): ConversationIntelligence {
  const message = String(args.message || '').trim();
  const answer = String(args.answer || '').trim();
  const corpus = `${message}\n${answer}\n${args.priorSummary || ''}`;
  const detectedTopic =
    TOPIC_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(corpus))) ||
    TOPIC_RULES[4];
  const secondaryTopics = TOPIC_RULES.filter(
    (rule) =>
      rule.topic !== detectedTopic.topic && rule.patterns.some((pattern) => pattern.test(corpus))
  )
    .map((rule) => rule.topic)
    .slice(0, 3);
  const productsDiscussed = detectProducts(
    corpus,
    [...(args.matchedProducts || []), ...(args.primaryProducts || [])]
  );
  const intent = inferIntent(message);
  const qualityFlags: string[] = [];

  if (args.fallbackReason) qualityFlags.push('fallback_used');
  if (!productsDiscussed.length) qualityFlags.push('product_unspecified');
  if (answer.length < 40) qualityFlags.push('short_answer');

  const historyUserTurns = (args.history || []).filter((item) => item.role === 'user').length;
  const summaryParts = [
    `User is discussing ${detectedTopic.topic.replace(/_/g, ' ')}.`,
    productsDiscussed.length > 0 ? `Products: ${productsDiscussed.join(', ')}.` : null,
    args.surfaceContext?.articleTitle ? `Page context: ${args.surfaceContext.articleTitle}.` : null,
    historyUserTurns > 0 ? `The conversation already had ${historyUserTurns} prior user turns.` : null,
    `Latest user ask: ${safeSlice(message, 180)}.`,
  ].filter(Boolean);

  return {
    primaryTopic: detectedTopic.topic,
    secondaryTopics,
    topicFamily: detectedTopic.family,
    topicConfidence: secondaryTopics.length > 0 ? 0.78 : 0.92,
    intent,
    productsDiscussed,
    fallbackReason: args.fallbackReason || null,
    summary: summaryParts.join(' '),
    qualityFlags: uniq(qualityFlags),
    sessionMemory: {
      primary_topic: detectedTopic.topic,
      intent,
      products_discussed: productsDiscussed,
      latest_user_message: safeSlice(message, 220),
      last_answer_preview: safeSlice(answer, 220),
      article_context: args.surfaceContext?.articleTitle || null,
      summary: summaryParts.join(' '),
    },
    outcome: inferOutcome(message, answer),
  };
}
