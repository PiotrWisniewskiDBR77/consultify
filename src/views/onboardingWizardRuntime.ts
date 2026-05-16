import type { OnboardingResumeSnapshot } from '@/models/onboarding/ResumeOnAbandonment';
import type { OnboardingPersona, PersonaConfidence } from '@/services/onboarding/personaInference';
import { resolveFirstOnboardingSurface } from '@/services/onboarding/personaJourneys';

export type OnboardingWizardStep = 1 | 2 | 3;

export type OnboardingWizardContext = {
  role: string;
  industry: string;
  problems: string;
  urgency: string;
  targets: string;
};

export type OnboardingWizardRuntimeState = {
  context: OnboardingWizardContext;
  step: OnboardingWizardStep;
  plan: any | null;
  selectedInitiativeIds: string[];
  trustViewedAt: string | null;
  trustAcknowledged: boolean;
  selectedPersona?: OnboardingPersona | null;
  personaConfidence?: PersonaConfidence | null;
  personaConfirmed?: boolean;
  adminConsoleAcknowledged?: boolean;
};

const STEP_MAP: Record<OnboardingWizardStep, string> = {
  1: 'context_input',
  2: 'plan_generating',
  3: 'plan_review',
};

const REVERSE_STEP_MAP: Record<string, OnboardingWizardStep> = {
  context_input: 1,
  plan_generating: 2,
  plan_review: 3,
};

export function normalizeOnboardingPersona(input: string | null | undefined): string {
  const value = String(input || '')
    .trim()
    .toLowerCase();
  if (!value) return 'Transformation Officer';
  if (value.includes('partner')) return 'Partner';
  if (value.includes('cfo') || value.includes('finance') || value.includes('finans')) return 'CFO';
  if (value.includes('ceo')) return 'CEO';
  if (value.includes('coo') || value.includes('operations') || value.includes('oper')) return 'COO';
  if (value.includes('ciso') || value.includes('security') || value.includes('bezpiec'))
    return 'CISO';
  return 'Transformation Officer';
}

export function buildOnboardingWizardSnapshot(
  state: OnboardingWizardRuntimeState,
  persona: string
): OnboardingResumeSnapshot {
  const currentStep = !state.trustAcknowledged
    ? 'trust_banner'
    : state.selectedPersona && !state.personaConfirmed
      ? 'persona_capture'
      : state.selectedPersona &&
          resolveFirstOnboardingSurface(state.selectedPersona) === 'admin_console' &&
          !state.adminConsoleAcknowledged
        ? 'admin_console'
        : STEP_MAP[state.step];
  return {
    persona,
    personaConfidence: state.personaConfidence || 'high',
    overrideHistory: [],
    connectorTarget: null,
    connectorScopes: [],
    uploadedFiles: [],
    currentDraft: JSON.stringify({
      context: state.context,
      step: state.step,
      plan: state.plan,
      selectedInitiativeIds: state.selectedInitiativeIds,
      trustViewedAt: state.trustViewedAt,
      trustAcknowledged: state.trustAcknowledged,
      selectedPersona: state.selectedPersona,
      personaConfidence: state.personaConfidence,
      personaConfirmed: state.personaConfirmed,
      adminConsoleAcknowledged: state.adminConsoleAcknowledged,
    }),
    approvalHistory: [],
    trustBanner: {
      viewedAt: state.trustViewedAt,
      acknowledged: state.trustAcknowledged,
    },
    unresolvedValidationBlockers: [],
    currentStep,
    deltaHint: null,
  };
}

export function restoreOnboardingWizardState(
  snapshot: OnboardingResumeSnapshot | null | undefined,
  fallbackContext: OnboardingWizardContext
): OnboardingWizardRuntimeState | null {
  if (!snapshot?.currentDraft) return null;
  try {
    const parsed = JSON.parse(snapshot.currentDraft) as Partial<OnboardingWizardRuntimeState>;
    const stepFromPayload =
      typeof parsed.step === 'number' && [1, 2, 3].includes(parsed.step)
        ? (parsed.step as OnboardingWizardStep)
        : null;
    const step = stepFromPayload || REVERSE_STEP_MAP[String(snapshot.currentStep || '')] || 1;
    return {
      context: {
        role: String(parsed.context?.role || fallbackContext.role || ''),
        industry: String(parsed.context?.industry || fallbackContext.industry || ''),
        problems: String(parsed.context?.problems || fallbackContext.problems || ''),
        urgency: String(parsed.context?.urgency || fallbackContext.urgency || 'Normal'),
        targets: String(parsed.context?.targets || fallbackContext.targets || ''),
      },
      step,
      plan: parsed.plan ?? null,
      selectedInitiativeIds: Array.isArray(parsed.selectedInitiativeIds)
        ? parsed.selectedInitiativeIds.map((value) => String(value))
        : [],
      trustViewedAt:
        typeof parsed.trustViewedAt === 'string'
          ? parsed.trustViewedAt
          : snapshot.trustBanner?.viewedAt || null,
      trustAcknowledged:
        typeof parsed.trustAcknowledged === 'boolean'
          ? parsed.trustAcknowledged
          : Boolean(snapshot.trustBanner?.acknowledged),
      selectedPersona: (parsed.selectedPersona as OnboardingPersona | null | undefined) ?? null,
      personaConfidence: (parsed.personaConfidence as PersonaConfidence | null | undefined) ?? null,
      personaConfirmed: Boolean(parsed.personaConfirmed),
      adminConsoleAcknowledged: Boolean(parsed.adminConsoleAcknowledged),
    };
  } catch {
    return null;
  }
}
