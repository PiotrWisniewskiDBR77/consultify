import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/Logger.js';
import enterpriseSecurity from './enterpriseSecurity.js';

export type PolicyDecisionOutcome = 'allow' | 'deny';

export type PolicyDecisionCategory =
  | 'ok'
  | 'prompt_injection'
  | 'sensitive_data_request'
  | 'cybersecurity_misuse'
  | 'self_harm'
  | 'hate_or_harassment'
  | 'unknown';

export type EvidenceMode = 'citations_or_uncertainty';

export type ClaimCitationPolicy = {
  minCoverageScore?: number;
  requireAllFactualCited?: boolean;
  maxUncitedClaims?: number;
};

export interface ChatPolicyDecision {
  id: string;
  version: 'p34b-v1';
  createdAt: string;
  allowed: boolean;
  outcome: PolicyDecisionOutcome;
  category: PolicyDecisionCategory;
  rationale: string;
  evidence: {
    mode: EvidenceMode;
    required: boolean;
    /**
     * Policy is enforced as: if the response appears factual and citations are missing/weak,
     * we must emit an explicit uncertainty marker (never silently pretend we’re grounded).
     */
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
  return /\b(suicide|kill myself|self[-\s]?harm)\b/i.test(m) || /\b(jak się zabić|samobójstwo)\b/i.test(m);
}

function looksLikeHateOrHarassment(message: string): boolean {
  const m = String(message || '').toLowerCase();
  return /\b(genocide|exterminate|racial slur|kill all)\b/i.test(m);
}

function looksLikeFactfulAsk(message: string): boolean {
  const m = String(message || '').trim();
  if (!m) return false;
  // Bounded heuristic: if user asks for "facts" / sources / numbers / dates, require evidence posture.
  return (
    /\b(source|sources|cite|citation|evidence|proof)\b/i.test(m) ||
    /\b(who|when|where|what is|how many|how much|latest|current)\b/i.test(m) ||
    /\d{2,}/.test(m) ||
    /\b(dane|źródło|źródła|cytuj|dowód|kiedy|kto|ile|jaka jest)\b/i.test(m)
  );
}

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

  // EN fallback
  if (category === 'prompt_injection') {
    return {
      userMessage:
        'I can’t comply with that request — it looks like an attempt to override safeguards or extract system instructions. I can still help in a safe way.',
      nextSteps: [
        'Tell me your goal without asking to reveal prompts/secrets.',
        'Paste the data you want analyzed (without sensitive information).',
        'If you’re debugging AI behavior, describe the symptom and expected result.',
      ],
    };
  }
  if (category === 'sensitive_data_request') {
    return {
      userMessage:
        'I can’t help with obtaining or revealing sensitive data (passwords, API keys, card details, etc.).',
      nextSteps: [
        'If your goal is security: describe what you’re trying to protect.',
        'I can help with key rotation policy, a security checklist, or incident response steps.',
        'For account access, use official reset/admin channels.',
      ],
    };
  }
  if (category === 'cybersecurity_misuse') {
    return {
      userMessage:
        'I can’t help with instructions that enable hacking, bypassing security, or harmful actions.',
      nextSteps: [
        'I can help with defensive security: hardening, monitoring, detection, response.',
        'Share your environment and defensive objective.',
      ],
    };
  }
  if (category === 'self_harm') {
    return {
      userMessage:
        'I’m really sorry you’re feeling this way. I can’t help with self-harm instructions. If you’re in immediate danger, please contact local emergency services or someone you trust right now.',
      nextSteps: [
        'If you tell me your country/city, I can help find immediate support options.',
        'If you want, I can help draft a short message to a friend, family member, or clinician.',
      ],
    };
  }
  if (category === 'hate_or_harassment') {
    return {
      userMessage: 'I can’t help with content promoting hate or violence against groups of people.',
      nextSteps: ['If you want, I can help with a neutral, educational framing.'],
    };
  }
  return {
    userMessage: 'I can’t comply with that request due to safety policy.',
    nextSteps: ['Please rephrase your question and I’ll help within safe bounds.'],
  };
}

export async function evaluateChatPolicyDecision(
  args: EvaluateChatPolicyArgs
): Promise<{ decision: ChatPolicyDecision; sanitizedMessage: string }> {
  const now = new Date().toISOString();
  const lang = normalizeLang(args.language);
  const message = String(args.message || '').trim();

  // 1) Security scan (PII + injection). This is deterministic and auditable.
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
    logger.debug('[ChatPolicyGateway] enterpriseSecurity unavailable:', e?.message || String(e));
  }

  // 2) Deny list checks (bounded)
  let category: PolicyDecisionCategory = 'ok';
  let allowed = true;
  let rationale = 'Allowed by policy gateway';

  if (injectionBlocked) {
    allowed = false;
    category = 'prompt_injection';
    rationale = 'Prompt injection / instruction override attempt detected';
  } else if (looksLikeSensitiveDataRequest(message)) {
    allowed = false;
    category = 'sensitive_data_request';
    rationale = 'Sensitive data request detected';
  } else if (looksLikeCyberMisuse(message)) {
    allowed = false;
    category = 'cybersecurity_misuse';
    rationale = 'Cybersecurity misuse request detected';
  } else if (looksLikeSelfHarm(message)) {
    allowed = false;
    category = 'self_harm';
    rationale = 'Self-harm content detected';
  } else if (looksLikeHateOrHarassment(message)) {
    allowed = false;
    category = 'hate_or_harassment';
    rationale = 'Hate/harassment content detected';
  }

  const evidenceRequired = allowed && looksLikeFactfulAsk(message);

  const decision: ChatPolicyDecision = {
    id: uuidv4(),
    version: 'p34b-v1',
    createdAt: now,
    allowed,
    outcome: allowed ? 'allow' : 'deny',
    category,
    rationale,
    evidence: {
      mode: 'citations_or_uncertainty',
      required: evidenceRequired,
      claimCitationPolicy: evidenceRequired
        ? {
            // Bounded defaults: allow some uncited claims but force explicit uncertainty marker
            // when the response is clearly "factful" yet unguided by evidence.
            minCoverageScore: 0.25,
            maxUncitedClaims: 2,
            requireAllFactualCited: false,
          }
        : { minCoverageScore: 0, maxUncitedClaims: 999, requireAllFactualCited: false },
      uncertaintyMarkerRequiredIfInsufficientEvidence: evidenceRequired,
    },
    ...(allowed
      ? {}
      : {
          refusal: buildRefusal(lang, category),
        }),
  };

  return { decision, sanitizedMessage };
}

