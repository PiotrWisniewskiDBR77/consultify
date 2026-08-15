import type { TransformationPlanningIntakeDto } from '@/services/api/v8/transformation-cases';

const LABELS: Record<string, { pl: string; en: string }> = {
  measurable_outcomes: { pl: 'mierzalny wynik', en: 'measurable outcome' },
  sponsor: { pl: 'sponsor', en: 'sponsor' },
  scope: { pl: 'zakres', en: 'scope' },
  horizon: { pl: 'horyzont', en: 'horizon' },
};

export const transformationIntakeMissingLabels = (keys: string[], language: 'pl' | 'en') =>
  keys.map((key) => LABELS[key]?.[language] ?? key.replaceAll('_', ' ')).join(', ');

export function transformationCaseReadyMessage(caseId: string, language: 'pl' | 'en') {
  const query = new URLSearchParams({ tab: 'agent', transformationCaseId: caseId }).toString();
  return language === 'pl'
    ? `Plan został utworzony.\n\n[Otwórz plan w My Work](/my-work?${query})`
    : `The plan was created.\n\n[Open the plan in My Work](/my-work?${query})`;
}

export function planningIntakeIdempotencyKey(conversationId: string, messageId: string) {
  let hash = 2166136261;
  for (const char of messageId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `teresa-plan:${conversationId}:${(hash >>> 0).toString(16)}`;
}

const field = (text: string, labels: string) =>
  text.match(new RegExp(`(?:^|\\n)\\s*(?:${labels})\\s*:\\s*(.+)`, 'i'))?.[1]?.trim();

export function parsePlanningClarification(text: string): {
  measurableOutcomes?: string[]; sponsor?: string; scope?: string; horizon?: string;
} {
  const outcome = field(text, 'Cel|Outcome|Wynik');
  return {
    measurableOutcomes: outcome ? [outcome] : undefined,
    sponsor: field(text, 'Sponsor'),
    scope: field(text, 'Zakres|Scope'),
    horizon: field(text, 'Horyzont|Horizon'),
  };
}

export function planningFollowUp(intake: TransformationPlanningIntakeDto, language: 'pl' | 'en') {
  const missing = transformationIntakeMissingLabels(intake.missingKeys, language);
  return language === 'pl'
    ? `Potrzebuję jeszcze: ${missing}. Odpowiedz tylko brakującymi polami: Cel:, Sponsor:, Zakres:, Horyzont:.`
    : `I still need: ${missing}. Reply only with the missing fields: Outcome:, Sponsor:, Scope:, Horizon:.`;
}
