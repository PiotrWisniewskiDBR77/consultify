/**
 * Web Search Intent Detector & Query Builder
 *
 * Lightweight heuristic service that:
 * 1. Detects whether a user message would benefit from web search
 * 2. Generates optimized search queries (not just raw message)
 * 3. Supports multi-query generation for complex questions
 *
 * Runs purely on heuristics — no LLM call, zero latency overhead.
 *
 * @version 1.0.0
 */
import logger from '../../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebSearchIntent {
  /** Whether a web search would likely benefit this message */
  shouldSearch: boolean;
  /** Confidence 0-1 that web search is needed */
  confidence: number;
  /** Reason for the decision (for logging/debugging) */
  reason: string;
  /** Optimized search queries (1-3) to run */
  queries: string[];
  /** Suggested search depth */
  searchDepth: 'basic' | 'advanced';
  /** Max results per query */
  maxResults: number;
}

// ---------------------------------------------------------------------------
// Patterns — heuristics for detecting web search intent
// ---------------------------------------------------------------------------

/** Patterns that strongly suggest the user wants current/external information */
const HIGH_INTENT_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  // Current events / time-sensitive
  {
    re: /\b(latest|newest|recent|current|today|this week|this month|2025|2026)\b/i,
    reason: 'time-sensitive query',
  },
  {
    re: /\b(najnowsz|ostatni|aktualn|dzisiaj|ten tydzień|ten miesiąc|bieżąc)\b/i,
    reason: 'zapytanie o aktualne dane',
  },
  // Explicit search intent
  {
    re: /\b(search|find|look up|google|wyszukaj|znajdź|poszukaj|sprawdź w internecie)\b/i,
    reason: 'explicit search request',
  },
  // News / trends
  {
    re: /\b(news|trending|trend|forecast|prediction|prognoz|wiadomo|nowości)\b/i,
    reason: 'news/trend query',
  },
  // Specific data requests
  {
    re: /\b(statistics|data|benchmark|report|study|research|survey|statystyk|dane|raport|badani)\b/i,
    reason: 'data/research request',
  },
  // Comparisons requiring external data
  {
    re: /\b(compare|versus|vs\.?|ranking|top \d|best \d|porównaj|ranking|najlepsz)\b/i,
    reason: 'comparison requiring external data',
  },
  // Pricing / market
  {
    re: /\b(price|pricing|cost|market|valuation|cena|cennik|rynek|wycen)\b/i,
    reason: 'market/pricing query',
  },
  // Regulations / laws
  {
    re: /\b(regulation|law|compliance|gdpr|iso|standard|regulacj|prawo|przepis|norma|standard)\b/i,
    reason: 'regulatory/standards query',
  },
  // Technology / tools
  {
    re: /\b(how to|tutorial|guide|documentation|example|jak zrobić|poradnik|dokumentacj|instrukcj)\b/i,
    reason: 'how-to/documentation query',
  },
  // People / companies
  {
    re: /\b(who is|company|startup|CEO|founder|kim jest|firma|spółka|startup|założyciel)\b/i,
    reason: 'entity information query',
  },
];

/** Patterns that suggest the message is about internal/project work (lower web search need) */
const LOW_INTENT_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  // Internal project references
  {
    re: /\b(our project|my team|this initiative|nasz projekt|mój zespół|ta inicjatywa)\b/i,
    reason: 'internal project context',
  },
  // Task management
  {
    re: /\b(create task|assign|schedule|move to|update status|utwórz zadanie|przypisz|zaplanuj)\b/i,
    reason: 'task management action',
  },
  // Report generation
  {
    re: /\b(generate report|create summary|podsumuj|wygeneruj raport)\b/i,
    reason: 'internal report request',
  },
  // Greetings / casual
  { re: /^(hi|hello|hey|cześć|hej|dzień dobry|siema|witam)\b/i, reason: 'greeting' },
  // Very short messages (likely follow-ups)
  { re: /^.{1,15}$/, reason: 'very short message (likely follow-up)' },
];

/** Domains / topics that especially benefit from web search */
const DOMAIN_BOOST_PATTERNS: RegExp[] = [
  /\b(AI|artificial intelligence|machine learning|LLM|GPT|sztuczna inteligencja)\b/i,
  /\b(digital transformation|Industry 4\.0|transformacja cyfrowa)\b/i,
  /\b(agile|scrum|kanban|devops|lean|six sigma)\b/i,
  /\b(cloud|AWS|Azure|GCP|kubernetes|docker)\b/i,
  /\b(cybersecurity|security|breach|vulnerability|bezpieczeństwo)\b/i,
  /\b(ESG|sustainability|carbon|zrównoważon)\b/i,
];

// ---------------------------------------------------------------------------
// Intent Detection
// ---------------------------------------------------------------------------

/**
 * Detect whether a message would benefit from web search.
 * Pure heuristic — fast, no API calls, no latency.
 */
export function detectWebSearchIntent(
  message: string,
  options?: {
    /** If true, lower the threshold for triggering search (user enabled webSearch toggle) */
    userEnabledWebSearch?: boolean;
    /** Conversation history length — longer convos may need less external search */
    historyLength?: number;
  }
): WebSearchIntent {
  const userEnabled = options?.userEnabledWebSearch ?? false;
  const historyLen = options?.historyLength ?? 0;

  let score = 0;
  const reasons: string[] = [];

  // Check high-intent patterns
  for (const { re, reason } of HIGH_INTENT_PATTERNS) {
    if (re.test(message)) {
      score += 0.3;
      reasons.push(reason);
    }
  }

  // Check low-intent patterns (decrease score)
  for (const { re, reason } of LOW_INTENT_PATTERNS) {
    if (re.test(message)) {
      score -= 0.3;
      reasons.push(`[low] ${reason}`);
    }
  }

  // Domain boost
  for (const re of DOMAIN_BOOST_PATTERNS) {
    if (re.test(message)) {
      score += 0.1;
    }
  }

  // Message length heuristic: longer messages tend to be more specific → more searchable
  if (message.length > 100) score += 0.1;
  if (message.length > 300) score += 0.1;

  // Question mark boost
  if (message.includes('?')) score += 0.15;

  // User explicitly enabled web search → lower threshold
  if (userEnabled) score += 0.2;

  // Long conversation → might need less external data (already has context)
  if (historyLen > 10) score -= 0.1;

  // Clamp
  const confidence = Math.max(0, Math.min(1, score));
  const shouldSearch = confidence >= 0.25;

  // Generate optimized queries
  const queries = shouldSearch ? buildSearchQueries(message) : [];

  const result: WebSearchIntent = {
    shouldSearch,
    confidence,
    reason: reasons.length > 0 ? reasons.join('; ') : 'no specific intent detected',
    queries,
    searchDepth: confidence >= 0.6 ? 'advanced' : 'basic',
    maxResults: confidence >= 0.6 ? 8 : 5,
  };

  logger.debug(
    `[WebSearchIntent] confidence=${confidence.toFixed(2)} search=${shouldSearch} reasons="${result.reason}" queries=${queries.length}`
  );
  return result;
}

// ---------------------------------------------------------------------------
// Query Builder
// ---------------------------------------------------------------------------

/**
 * Generate optimized search queries from a user message.
 * Returns 1-3 queries designed to maximize useful results.
 */
export function buildSearchQueries(message: string): string[] {
  const queries: string[] = [];
  const cleaned = rewriteConversationalSearchQuery(message);

  // If message is already short enough to be a good query, use it directly
  if (cleaned.length <= 120) {
    queries.push(cleaned);
    return queries;
  }

  // Extract the core question/request
  const sentences = cleaned
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  // Prioritize sentences with question marks or key phrases
  const questionSentences = sentences.filter(
    (s) =>
      /\?/.test(s) ||
      /\b(how|what|why|when|where|who|which|jak|co|dlaczego|kiedy|gdzie|kto|który)\b/i.test(s)
  );

  if (questionSentences.length > 0) {
    // Use the first 2 question sentences
    queries.push(...questionSentences.slice(0, 2).map((s) => s.slice(0, 150)));
  } else {
    // Use the first sentence as main query
    queries.push(sentences[0]?.slice(0, 150) || cleaned.slice(0, 150));
  }

  // If message mentions specific entities/topics, add a focused query
  const entities = extractKeyEntities(cleaned);
  if (entities.length > 0 && queries.length < 3) {
    const entityQuery = entities.slice(0, 3).join(' ') + ' 2026';
    if (!queries.some((q) => q.toLowerCase().includes(entityQuery.toLowerCase()))) {
      queries.push(entityQuery);
    }
  }

  // Deduplicate and limit to 3
  return [...new Set(queries)].slice(0, 3);
}

export function rewriteConversationalSearchQuery(message: string): string {
  let cleaned = String(message || '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  cleaned = cleaned
    .replace(/^(proszę|prosze|hej|cześć|czesc|anna|teresa)[,\s:;-]+/i, '')
    .replace(
      /^(opowiedz mi o|powiedz mi o|powiedz coś więcej o|powiedz cos wiecej o|podsumuj czym jest|wyjaśnij czym jest|wyjasnij czym jest)\s+/i,
      ''
    )
    .replace(/^(tell me about|summarize what|explain what)\s+/i, '')
    .replace(/\b(proszę|prosze)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (
    cleaned ||
    String(message || '')
      .slice(0, 150)
      .trim()
  );
}

/**
 * Extract key entities (proper nouns, technical terms, acronyms) from text.
 */
function extractKeyEntities(text: string): string[] {
  const entities: string[] = [];

  // Acronyms (2-6 uppercase letters)
  const acronyms = text.match(/\b[A-Z]{2,6}\b/g) || [];
  entities.push(
    ...acronyms.filter(
      (a) => !['AND', 'THE', 'FOR', 'BUT', 'NOT', 'WITH', 'THIS', 'THAT'].includes(a)
    )
  );

  // Quoted terms
  const quoted = text.match(/"([^"]+)"/g) || [];
  entities.push(...quoted.map((q) => q.replace(/"/g, '')));

  // Capitalized multi-word phrases (likely proper nouns)
  const properNouns = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) || [];
  entities.push(...properNouns);

  return [...new Set(entities)].slice(0, 5);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export default { detectWebSearchIntent, buildSearchQueries, rewriteConversationalSearchQuery };
