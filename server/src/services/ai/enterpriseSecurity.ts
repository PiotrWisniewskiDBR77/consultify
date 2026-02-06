/**
 * Enterprise Security Service - PII Redaction & Prompt Injection Defense
 * Enterprise SaaS Architecture - TypeScript Backend
 */
import { run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export type PIIType =
  | 'email'
  | 'phone'
  | 'credit_card'
  | 'pesel'
  | 'nip'
  | 'regon'
  | 'iban'
  | 'ip_address'
  | 'ssn';
export type PIISensitivity = 'low' | 'medium' | 'high';

export interface PIIDetection {
  type: PIIType;
  value: string;
  redactedValue: string;
  confidence: number;
}
export interface PIIDetectionResult {
  hasPII: boolean;
  detections: PIIDetection[];
  redactedText: string;
}
export interface PromptInjectionResult {
  isInjection: boolean;
  confidence: number;
  detectedPatterns: string[];
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

const PII: Array<{
  type: PIIType;
  re: RegExp;
  sens: PIISensitivity;
  redact: (m: string) => string;
}> = [
  {
    type: 'email',
    re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    sens: 'low',
    redact: (m) => `[EMAIL:${m.slice(0, 2)}***]`,
  },
  {
    type: 'phone',
    re: /(?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4})?/g,
    sens: 'medium',
    redact: () => '[PHONE:***]',
  },
  {
    type: 'credit_card',
    re: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    sens: 'high',
    redact: (m) => `[CARD:****${m.slice(-4)}]`,
  },
  {
    type: 'pesel',
    re: /\b\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{5}\b/g,
    sens: 'high',
    redact: () => '[PESEL:***]',
  },
  {
    type: 'nip',
    re: /\b\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g,
    sens: 'high',
    redact: () => '[NIP:***]',
  },
  { type: 'regon', re: /\b\d{9}(?:\d{5})?\b/g, sens: 'medium', redact: () => '[REGON:***]' },
  {
    type: 'iban',
    re: /\b[A-Z]{2}\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}\b/g,
    sens: 'high',
    redact: (m) => `[IBAN:${m.slice(0, 4)}***]`,
  },
  { type: 'ip_address', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, sens: 'low', redact: () => '[IP:***]' },
  { type: 'ssn', re: /\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g, sens: 'high', redact: () => '[SSN:***]' },
];

const INJ: Array<{ re: RegExp; name: string; sev: PromptInjectionResult['riskLevel'] }> = [
  {
    re: /ignore (?:all )?(?:previous |above )?instructions/i,
    name: 'instruction_override',
    sev: 'critical',
  },
  {
    re: /disregard (?:all )?(?:previous )?(?:instructions|rules)/i,
    name: 'instruction_override',
    sev: 'critical',
  },
  {
    re: /forget (?:everything|all|your) (?:instructions|rules)/i,
    name: 'instruction_override',
    sev: 'critical',
  },
  {
    re: /you are now (?:a )?(?:DAN|jailbreak|unrestricted)/i,
    name: 'role_override',
    sev: 'critical',
  },
  {
    re: /(?:show|reveal|print|repeat) (?:your |the )?(?:system )?(?:prompt|instructions)/i,
    name: 'prompt_extraction',
    sev: 'high',
  },
  { re: /```system|<\|im_start\|>|<\|system\|>/i, name: 'delimiter_injection', sev: 'critical' },
  {
    re: /zignoruj (?:wszystkie )?(?:poprzednie )?(?:instrukcje|zasady)/i,
    name: 'instr_override_pl',
    sev: 'critical',
  },
  {
    re: /zapomnij (?:o )?(?:wszystkim|wszystkich) (?:zasadach|instrukcjach)/i,
    name: 'instr_override_pl',
    sev: 'critical',
  },
];

const SENS_ORDER: Record<PIISensitivity, number> = { low: 0, medium: 1, high: 2 };

class EnterpriseSecurityService {
  private sensitivity: PIISensitivity = 'medium';
  setSensitivity(level: PIISensitivity) {
    this.sensitivity = level;
  }

  detectAndRedactPII(text: string, sensitivity?: PIISensitivity): PIIDetectionResult {
    const lvl = sensitivity || this.sensitivity;
    const min = SENS_ORDER[lvl];
    const detections: PIIDetection[] = [];
    let redacted = text;
    for (const p of PII.filter((x) => SENS_ORDER[x.sens] >= min)) {
      p.re.lastIndex = 0;
      const matches: RegExpExecArray[] = [];
      let m: RegExpExecArray | null;
      while ((m = p.re.exec(text)) !== null) matches.push({ ...m } as any);
      for (const match of matches) {
        const v = match[0],
          rv = p.redact(v);
        if (p.type === 'phone' && v.replace(/\D/g, '').length < 7) continue;
        detections.push({
          type: p.type,
          value: v,
          redactedValue: rv,
          confidence: p.sens === 'high' ? 0.9 : 0.7,
        });
        redacted = redacted.replace(v, rv);
      }
    }
    if (detections.length)
      logger.info(
        `[Security] Detected ${detections.length} PII (${[...new Set(detections.map((d) => d.type))].join(',')})`
      );
    return { hasPII: detections.length > 0, detections, redactedText: redacted };
  }

  detectPromptInjection(text: string): PromptInjectionResult {
    const found: string[] = [];
    let maxSev: PromptInjectionResult['riskLevel'] = 'none';
    const ord: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
    for (const { re, name, sev } of INJ) {
      re.lastIndex = 0;
      if (re.test(text)) {
        found.push(name);
        if (ord[sev] > ord[maxSev]) maxSev = sev;
      }
    }
    if (found.length) logger.warn(`[Security] Injection: ${found.join(',')} (${maxSev})`);
    return {
      isInjection: found.length > 0,
      confidence: found.length ? Math.min(1, 0.4 + found.length * 0.2) : 0,
      detectedPatterns: found,
      riskLevel: maxSev,
    };
  }

  async scanAndSanitize(text: string, userId?: string, orgId?: string) {
    const pii = this.detectAndRedactPII(text);
    const inj = this.detectPromptInjection(pii.redactedText);
    const blocked = inj.riskLevel === 'critical';
    if (pii.hasPII || inj.isInjection) {
      try {
        await dbRun(
          `INSERT INTO ai_security_audit_log (event_type,user_id,organization_id,details,severity,created_at) VALUES (?,?,?,?,?,?)`,
          [
            blocked ? 'injection_blocked' : pii.hasPII ? 'pii_redacted' : 'injection_detected',
            userId || null,
            orgId || null,
            `PII:${pii.detections.length} INJ:${inj.detectedPatterns.join(',')}`,
            blocked ? 'critical' : 'warning',
            new Date().toISOString(),
          ]
        );
      } catch {}
    }
    return {
      sanitizedText: blocked ? '' : pii.redactedText,
      piiResult: pii,
      injectionResult: inj,
      blocked,
    };
  }
}

export const enterpriseSecurity = new EnterpriseSecurityService();
export default enterpriseSecurity;
export { EnterpriseSecurityService };
