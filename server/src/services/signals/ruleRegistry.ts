import { SignalDomainValues, type SignalRule } from '../../types/workSignals.js';

export function validateRuleRegistry(rules: readonly SignalRule[]): readonly SignalRule[] {
  const ids = new Set<string>();
  for (const rule of rules) {
    if (!rule.ruleId || ids.has(rule.ruleId)) {
      throw new Error(`Duplicate or empty signal ruleId: ${rule.ruleId}`);
    }
    ids.add(rule.ruleId);
    if (!SignalDomainValues.includes(rule.domain)) {
      throw new Error(`Invalid domain for signal rule ${rule.ruleId}`);
    }
    if (!Number.isInteger(rule.ruleVersion) || rule.ruleVersion < 1) {
      throw new Error(`Invalid version for signal rule ${rule.ruleId}`);
    }
    if (!Number.isInteger(rule.maxPerRunPerOrg) || rule.maxPerRunPerOrg <= 0) {
      throw new Error(`Invalid maxPerRunPerOrg for signal rule ${rule.ruleId}`);
    }
    for (const required of ['evaluate', 'dedupeKey', 'evidence', 'action', 'audience'] as const) {
      if (typeof rule[required] !== 'function') {
        throw new Error(`Signal rule ${rule.ruleId} is missing ${required}`);
      }
    }
  }
  return rules;
}

const registeredRules: SignalRule[] = [];

export function registerSignalRules(rules: readonly SignalRule[]): void {
  validateRuleRegistry(rules);
  registeredRules.splice(0, registeredRules.length, ...rules);
}

export function getSignalRules(): readonly SignalRule[] {
  return validateRuleRegistry(registeredRules);
}
