import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/Logger.js';
import enterpriseSecurity from './enterpriseSecurity.js';

// ==========================================
// POLICY DECISION TYPES
// ==========================================

export type PolicyDecisionOutcome = 'allow' | 'allow_with_limits' | 'refuse';

export type PolicyDecisionCategory =
  | 'ok'
  | 'prompt_injection'
  | 'sensitive_data_request'
  | 'cybersecurity_misuse'
  | 'self_harm'
  | 'hate_or_harassment'
  | 'scope_limited'
  | 'unknown';

export type EvidenceMode = 'citations_or_uncertainty';

export type ClaimCitationPolicy = {
  minCoverageScore?: number;
  requireAllFactualCited?: boolean;
  maxUncitedClaims?: number;
};

// ==========================================
// SCOPE RESOLUTION (§2.3.2 — before ranking)
// ==========================================

export type AllowedScope = 'org_shared' | 'user_private' | 'public_kb';
export type BlockedScopeCategory =
  | 'other_user_private'
  | 'other_tenant'
  | 'restricted'
  | 'insufficient_role';

export interface ScopeResolution {
  tenantId: string;
  userId: string | null;
  allowedScopes: AllowedScope[];
  blockedScopes: { category: BlockedScopeCategory; reason: string }[];
  privacyMode: boolean;
}

// ==========================================
// SOURCE LEDGER (§2.3.2 — used/blocked)
// ==========================================

export interface SourceLedgerEntry {
  category: string;
  reason: string;
}

export interface SourceLedger {
  type: 'source_ledger';
  used_sources: SourceLedgerEntry[];
  blocked_sources: SourceLedgerEntry[];
  degraded: { mode: string; reason: string } | null;
}

// ==========================================
// CHAT POLICY DECISION
// ==========================================

export interface ChatPolicyDecision {
  id: string;
  version: 'p34b-v1';
  createdAt: string;
  allowed: boolean;
  outcome: PolicyDecisionOutcome;
  category: PolicyDecisionCategory;
  rationale: string;
  scopeResolution: ScopeResolution;
  sourceLedger: SourceLedger;
  evidence: {
    mode: EvidenceMode;
    required: boolean;
    claimCitationPolicy: ClaimCitationPolicy;
    uncertaintyMarkerRequiredIfInsufficientEvidence: boolean;
  };
  refusal?: {
    userMessage: string;
    nextSteps: string[];
  };
}

export interface EvaluateChatPolicyArgs {
  message: string;
  language?: string | null;
  organizationId?: string | null;
  userId?: string | null;
  projectId?: string | null;
  privateMode?: boolean;
  aiModes?: Record<string, unknown> | null;
  knowledgeSources?: Record<string, unknown> | null;
}

// ==========================================
// RETRIEVAL POLICY TYPES (single gateway)
// ==========================================

export type RetrievalConsumerClass = 'chat' | 'teresa' | 'anna' | 'agent' | 'worker' | 'background';

export interface EvaluateRetrievalPolicyArgs {
  consumerClass: RetrievalConsumerClass;
  query: string;
  organizationId: string;
  userId: string;
  projectId?: string | null;
  privateMode?: boolean;
  language?: string | null;
  requestedSourceRefs?: string[];
}

export interface RetrievalPolicyDecision {
  id: string;
  version: 'p34b-v1';
  createdAt: string;
  consumerClass: RetrievalConsumerClass;
  outcome: PolicyDecisionOutcome;
  allowed: boolean;
  category: PolicyDecisionCategory;
  rationale: string;
  scopeResolution: ScopeResolution;
  sourceLedger: SourceLedger;
  evidence: {
    mode: EvidenceMode;
    required: boolean;
    claimCitationPolicy: ClaimCitationPolicy;
    uncertaintyMarkerRequiredIfInsufficientEvidence: boolean;
  };
  refusal?: {
    userMessage: string;
    nextSteps: string[];
  };
}

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[ChatPolicyGateway]';

function normalizeLang(language?: string | null): 'pl' | 'en' {
  const l = String(language || '').toLowerCase();
  if (l.startsWith('pl')) return 'pl';
  return 'en';
}

function looksLikeSensitiveDataRequest(message: string): boolean {
  const m = String(message || '').toLowerCase();
  return (
    /\b(api[\s_-]?key|access[\s_-]?token|secret|password|passcode|credential|private key)\b/i.test(
      m
    ) ||
    /\b(credit card|card number|cvv|ssn|social security|pesel|iban)\b/i.test(m) ||
    /\b(steal|exfiltrate|leak|dump)\b/i.test(m)
  );
}

function looksLikeCyberMisuse(message: string): boolean {
  const m = String(message || '').toLowerCase();
  return (
    /\b(exploit|payload|malware|ransomware|keylogger|phishing|bypass|ddos)\b/i.test(m) ||
    /\b(hack|crack)\b.*\b(account|password|wifi|server)\b/i.test(m)
  );
}

function looksLikeSelfHarm(message: string): boolean {
  const m = String(message || '').toLowerCase();
  return (
    /\b(suicide|kill myself|self[-\s]?harm)\b/i.test(m) ||
    /\b(jak się zabić|samobójstwo)\b/i.test(m)
  );
}

function looksLikeHateOrHarassment(message: string): boolean {
  const m = String(message || '').toLowerCase();
  return /\b(genocide|exterminate|racial slur|kill all)\b/i.test(m);
}

function looksLikeFactfulAsk(message: string): boolean {
  const m = String(message || '').trim();
  if (!m) return false;
  return (
    /\b(source|sources|cite|citation|evidence|proof)\b/i.test(m) ||
    /\b(who|when|where|what is|how many|how much|latest|current)\b/i.test(m) ||
    /\d{2,}/.test(m) ||
    /\b(dane|źródło|źródła|cytuj|dowód|kiedy|kto|ile|jaka jest)\b/i.test(m)
  );
}

// ==========================================
// SCOPE RESOLUTION (tenant → org → user/private)
// ==========================================

function resolveScope(args: {
  organizationId?: string | null;
  userId?: string | null;
  privateMode?: boolean;
}): ScopeResolution {
  const tenantId = args.organizationId || 'unknown';
  const userId = args.userId || null;
  const privacyMode = Boolean(args.privateMode);

  const allowedScopes: AllowedScope[] = [];
  const blockedScopes: ScopeResolution['blockedScopes'] = [];

  if (userId) {
    allowedScopes.push('user_private');
  }

  if (!privacyMode && tenantId !== 'unknown') {
    allowedScopes.push('org_shared');
    allowedScopes.push('public_kb');
  } else if (privacyMode) {
    blockedScopes.push({
      category: 'restricted',
      reason: 'privacy_mode_active',
    });
  }

  blockedScopes.push({
    category: 'other_user_private',
    reason: 'forbidden_by_policy',
  });
  blockedScopes.push({
    category: 'other_tenant',
    reason: 'tenant_boundary',
  });

  return {
    tenantId,
    userId,
    allowedScopes,
    blockedScopes,
    privacyMode,
  };
}

// ==========================================
// SOURCE LEDGER BUILDER
// ==========================================

function buildSourceLedger(scopeResolution: ScopeResolution, allowed: boolean): SourceLedger {
  if (!allowed) {
    return {
      type: 'source_ledger',
      used_sources: [],
      blocked_sources: scopeResolution.blockedScopes.map((b) => ({
        category: b.category,
        reason: b.reason,
      })),
      degraded: { mode: 'refused', reason: 'policy_refusal' },
    };
  }

  const usedSources: SourceLedgerEntry[] = scopeResolution.allowedScopes.map((scope) => ({
    category: scope,
    reason: 'allowed_by_policy',
  }));

  const blockedSources: SourceLedgerEntry[] = scopeResolution.blockedScopes.map((b) => ({
    category: b.category,
    reason: b.reason,
  }));

  const degraded =
    usedSources.length === 0 ? { mode: 'no_sources', reason: 'no_citations_collected' } : null;

  return {
    type: 'source_ledger',
    used_sources: usedSources,
    blocked_sources: blockedSources,
    degraded,
  };
}

// ==========================================
// REFUSAL BUILDER (bilingual, §2.3.4)
// ==========================================

function buildRefusal(lang: 'pl' | 'en', category: PolicyDecisionCategory) {
  if (lang === 'pl') {
    if (category === 'prompt_injection') {
      return {
        userMessage:
          'Nie mogę spełnić tej prośby — wygląda jak próba obejścia zasad lub wyciągnięcia instrukcji systemowych. Mogę natomiast pomóc w bezpieczny sposób.',
        nextSteps: [
          'Napisz, jaki masz cel (bez próśb o ujawnianie promptów/sekretów).',
          'Wklej fragment danych, które chcesz przeanalizować (bez danych wrażliwych).',
          'Jeśli potrzebujesz debugować zachowanie AI, opisz symptom i oczekiwany rezultat.',
        ],
      };
    }
    if (category === 'sensitive_data_request') {
      return {
        userMessage:
          'Nie mogę pomóc w pozyskiwaniu ani ujawnianiu danych wrażliwych (np. haseł, kluczy API, danych kart).',
        nextSteps: [
          'Jeśli chcesz zabezpieczyć system: opisz, jakiego typu dane chcesz chronić.',
          'Mogę pomóc napisać politykę rotacji kluczy, checklistę bezpieczeństwa lub procedurę incident response.',
          'Jeśli potrzebujesz pomocy z dostępem: użyj oficjalnych kanałów resetu/administracji.',
        ],
      };
    }
    if (category === 'cybersecurity_misuse') {
      return {
        userMessage:
          'Nie mogę pomóc w instrukcjach, które ułatwiają włamanie, obejście zabezpieczeń lub szkodliwe działania.',
        nextSteps: [
          'Mogę pomóc w defensywie: hardening, monitoring, detekcja, reagowanie.',
          'Opisz swój kontekst (środowisko, ryzyko, cele obronne).',
        ],
      };
    }
    if (category === 'self_harm') {
      return {
        userMessage:
          'Bardzo mi przykro, że tak się czujesz. Nie mogę pomóc w treściach prowadzących do samouszkodzeń. Jeśli jesteś w niebezpieczeństwie, skontaktuj się proszę z lokalnymi służbami alarmowymi lub kimś zaufanym.',
        nextSteps: [
          'Jeśli możesz, powiedz gdzie jesteś (kraj/miasto) — podpowiem, gdzie szukać natychmiastowej pomocy.',
          'Jeśli chcesz, mogę pomóc ułożyć krótką wiadomość do bliskiej osoby lub lekarza.',
        ],
      };
    }
    if (category === 'hate_or_harassment') {
      return {
        userMessage:
          'Nie mogę pomóc w treściach, które promują nienawiść lub przemoc wobec grup ludzi.',
        nextSteps: ['Jeśli chcesz, mogę pomóc w neutralnym, edukacyjnym ujęciu tematu.'],
      };
    }
    return {
      userMessage: 'Nie mogę spełnić tej prośby ze względów polityki bezpieczeństwa.',
      nextSteps: ['Spróbuj przeformułować pytanie, a pomogę w bezpiecznym zakresie.'],
    };
  }

  if (category === 'prompt_injection') {
    return {
      userMessage:
        "I can't comply with that request — it looks like an attempt to override safeguards or extract system instructions. I can still help in a safe way.",
      nextSteps: [
        'Tell me your goal without asking to reveal prompts/secrets.',
        'Paste the data you want analyzed (without sensitive information).',
        "If you're debugging AI behavior, describe the symptom and expected result.",
      ],
    };
  }
  if (category === 'sensitive_data_request') {
    return {
      userMessage:
        "I can't help with obtaining or revealing sensitive data (passwords, API keys, card details, etc.).",
      nextSteps: [
        "If your goal is security: describe what you're trying to protect.",
        'I can help with key rotation policy, a security checklist, or incident response steps.',
        'For account access, use official reset/admin channels.',
      ],
    };
  }
  if (category === 'cybersecurity_misuse') {
    return {
      userMessage:
        "I can't help with instructions that enable hacking, bypassing security, or harmful actions.",
      nextSteps: [
        'I can help with defensive security: hardening, monitoring, detection, response.',
        'Share your environment and defensive objective.',
      ],
    };
  }
  if (category === 'self_harm') {
    return {
      userMessage:
        "I'm really sorry you're feeling this way. I can't help with self-harm instructions. If you're in immediate danger, please contact local emergency services or someone you trust right now.",
      nextSteps: [
        'If you tell me your country/city, I can help find immediate support options.',
        'If you want, I can help draft a short message to a friend, family member, or clinician.',
      ],
    };
  }
  if (category === 'hate_or_harassment') {
    return {
      userMessage: "I can't help with content promoting hate or violence against groups of people.",
      nextSteps: ['If you want, I can help with a neutral, educational framing.'],
    };
  }
  return {
    userMessage: "I can't comply with that request due to safety policy.",
    nextSteps: ["Please rephrase your question and I'll help within safe bounds."],
  };
}

// ==========================================
// EVIDENCE POSTURE BUILDER
// ==========================================

function buildEvidencePosture(message: string, allowed: boolean) {
  const evidenceRequired = allowed && looksLikeFactfulAsk(message);

  return {
    mode: 'citations_or_uncertainty' as EvidenceMode,
    required: evidenceRequired,
    claimCitationPolicy: evidenceRequired
      ? {
          minCoverageScore: 0.25,
          maxUncitedClaims: 2,
          requireAllFactualCited: false,
        }
      : { minCoverageScore: 0, maxUncitedClaims: 999, requireAllFactualCited: false },
    uncertaintyMarkerRequiredIfInsufficientEvidence: evidenceRequired,
  };
}

// ==========================================
// SAFETY CLASSIFIER
// ==========================================

function classifySafety(
  message: string,
  injectionBlocked: boolean
): { allowed: boolean; category: PolicyDecisionCategory; rationale: string } {
  if (injectionBlocked) {
    return {
      allowed: false,
      category: 'prompt_injection',
      rationale: 'Prompt injection / instruction override attempt detected',
    };
  }
  if (looksLikeSensitiveDataRequest(message)) {
    return {
      allowed: false,
      category: 'sensitive_data_request',
      rationale: 'Sensitive data request detected',
    };
  }
  if (looksLikeCyberMisuse(message)) {
    return {
      allowed: false,
      category: 'cybersecurity_misuse',
      rationale: 'Cybersecurity misuse request detected',
    };
  }
  if (looksLikeSelfHarm(message)) {
    return {
      allowed: false,
      category: 'self_harm',
      rationale: 'Self-harm content detected',
    };
  }
  if (looksLikeHateOrHarassment(message)) {
    return {
      allowed: false,
      category: 'hate_or_harassment',
      rationale: 'Hate/harassment content detected',
    };
  }
  return { allowed: true, category: 'ok', rationale: 'Allowed by policy gateway' };
}

// ==========================================
// PRIMARY GATEWAY: evaluateChatPolicyDecision
// ==========================================

export async function evaluateChatPolicyDecision(
  args: EvaluateChatPolicyArgs
): Promise<{ decision: ChatPolicyDecision; sanitizedMessage: string }> {
  const now = new Date().toISOString();
  const lang = normalizeLang(args.language);
  const message = String(args.message || '').trim();

  let sanitizedMessage = message;
  let injectionBlocked = false;
  try {
    const scan = await enterpriseSecurity.scanAndSanitize(
      message,
      args.userId || undefined,
      args.organizationId || undefined
    );
    injectionBlocked = Boolean(scan?.blocked);
    if (scan?.sanitizedText) sanitizedMessage = String(scan.sanitizedText).trim();
  } catch (e: any) {
    logger.debug(`${LOG_PREFIX} enterpriseSecurity unavailable:`, e?.message || String(e));
  }

  const safety = classifySafety(message, injectionBlocked);
  const scopeResolution = resolveScope(args);
  const sourceLedger = buildSourceLedger(scopeResolution, safety.allowed);
  const evidence = buildEvidencePosture(message, safety.allowed);

  let outcome: PolicyDecisionOutcome;
  let category = safety.category;
  let rationale = safety.rationale;

  // Structural blocks (other_user_private, other_tenant) are invariant security
  // boundaries — they don't make the decision "limited". Only additional
  // restrictions (e.g. privacy_mode_active) trigger allow_with_limits.
  const STRUCTURAL_REASONS = new Set(['forbidden_by_policy', 'tenant_boundary']);
  const hasAdditionalRestrictions = scopeResolution.blockedScopes.some(
    (b) => !STRUCTURAL_REASONS.has(b.reason)
  );

  if (!safety.allowed) {
    outcome = 'refuse';
  } else if (hasAdditionalRestrictions) {
    outcome = 'allow_with_limits';
    if (category === 'ok') {
      category = 'scope_limited';
      rationale = 'Allowed with limits — privacy mode restricts to user-private scope only';
    }
  } else {
    outcome = 'allow';
  }

  const decision: ChatPolicyDecision = {
    id: uuidv4(),
    version: 'p34b-v1',
    createdAt: now,
    allowed: safety.allowed,
    outcome,
    category,
    rationale,
    scopeResolution,
    sourceLedger,
    evidence,
    ...(safety.allowed
      ? {}
      : {
          refusal: buildRefusal(lang, category),
        }),
  };

  logger.info(
    `${LOG_PREFIX} Decision ${decision.id}: outcome=${outcome}, category=${category}, ` +
      `scopes=[${scopeResolution.allowedScopes.join(',')}], ` +
      `blocked=[${scopeResolution.blockedScopes.map((b) => b.category).join(',')}]`
  );

  return { decision, sanitizedMessage };
}

// ==========================================
// RETRIEVAL GATEWAY: evaluateRetrievalPolicyDecision
// Single entry point for all AI consumers (Teresa, Anna, agents, workers).
// No consumer may bypass this gateway for RAG/retrieval.
// ==========================================

export async function evaluateRetrievalPolicyDecision(
  args: EvaluateRetrievalPolicyArgs
): Promise<{ decision: RetrievalPolicyDecision; sanitizedQuery: string }> {
  const now = new Date().toISOString();
  const lang = normalizeLang(args.language);
  const query = String(args.query || '').trim();

  let sanitizedQuery = query;
  let injectionBlocked = false;
  try {
    const scan = await enterpriseSecurity.scanAndSanitize(query, args.userId, args.organizationId);
    injectionBlocked = Boolean(scan?.blocked);
    if (scan?.sanitizedText) sanitizedQuery = String(scan.sanitizedText).trim();
  } catch (e: any) {
    logger.debug(`${LOG_PREFIX} enterpriseSecurity unavailable:`, e?.message || String(e));
  }

  const safety = classifySafety(query, injectionBlocked);
  const scopeResolution = resolveScope({
    organizationId: args.organizationId,
    userId: args.userId,
    privateMode: args.privateMode,
  });
  const sourceLedger = buildSourceLedger(scopeResolution, safety.allowed);
  const evidence = buildEvidencePosture(query, safety.allowed);

  let outcome: PolicyDecisionOutcome;
  let { category, rationale } = safety;

  const STRUCTURAL = new Set(['forbidden_by_policy', 'tenant_boundary']);
  const hasExtraRestrictions = scopeResolution.blockedScopes.some((b) => !STRUCTURAL.has(b.reason));

  if (!safety.allowed) {
    outcome = 'refuse';
  } else if (hasExtraRestrictions) {
    outcome = 'allow_with_limits';
    if (category === 'ok') {
      category = 'scope_limited';
      rationale =
        `Retrieval allowed with limits for consumer=${args.consumerClass}; ` +
        `scopes=[${scopeResolution.allowedScopes.join(',')}]`;
    }
  } else {
    outcome = 'allow';
  }

  const decision: RetrievalPolicyDecision = {
    id: uuidv4(),
    version: 'p34b-v1',
    createdAt: now,
    consumerClass: args.consumerClass,
    outcome,
    allowed: safety.allowed,
    category,
    rationale,
    scopeResolution,
    sourceLedger,
    evidence,
    ...(safety.allowed
      ? {}
      : {
          refusal: buildRefusal(lang, category),
        }),
  };

  logger.info(
    `${LOG_PREFIX} Retrieval decision ${decision.id}: consumer=${args.consumerClass}, ` +
      `outcome=${outcome}, scopes=[${scopeResolution.allowedScopes.join(',')}]`
  );

  return { decision, sanitizedQuery };
}
