import type { OnboardingPersona } from './personaInference';

export type PersonaJourney = {
  persona: OnboardingPersona;
  primaryArtifactType: string;
  primaryConnector: string;
  secondaryConnector: string | null;
  suppressedConnectors: string[];
  ahaTargetSeconds: number;
  reviewGateLanguage: string;
  libraryDestination: string;
  entrySurface: 'admin_console' | 'artifact_seed';
  headline: string;
  subheadline: string;
  generateLabel: string;
};

export const PERSONA_ROUTE_SLUGS: Record<OnboardingPersona, string> = {
  Partner: 'partner',
  CFO: 'cfo',
  CEO: 'ceo',
  COO: 'coo',
  CISO: 'ciso',
  'Transformation Officer': 'transformation-officer',
};

export const PERSONA_JOURNEYS: Record<OnboardingPersona, PersonaJourney> = {
  Partner: {
    persona: 'Partner',
    primaryArtifactType: 'slide_deck',
    primaryConnector: 'crm',
    secondaryConnector: 'upload',
    suppressedConnectors: ['evidence_register'],
    ahaTargetSeconds: 210,
    reviewGateLanguage: 'Client-share safe?',
    libraryDestination: 'Partner playbooks',
    entrySurface: 'artifact_seed',
    headline: 'Build a partner-ready activation story.',
    subheadline: 'Start from the offer, objections, and first client proof you need to share.',
    generateLabel: 'Generate partner activation strategy',
  },
  CFO: {
    persona: 'CFO',
    primaryArtifactType: 'memo + spreadsheet',
    primaryConnector: 'upload',
    secondaryConnector: 'erp',
    suppressedConnectors: ['marketing_analytics'],
    ahaTargetSeconds: 180,
    reviewGateLanguage: 'Audit-ready?',
    libraryDestination: 'Finance operating reviews',
    entrySurface: 'artifact_seed',
    headline: 'Build a finance-ready first value plan.',
    subheadline: 'Focus on reporting speed, control points, and a memo the CFO can sign off on.',
    generateLabel: 'Generate finance strategy',
  },
  CEO: {
    persona: 'CEO',
    primaryArtifactType: 'decision_doc',
    primaryConnector: 'upload',
    secondaryConnector: 'crm',
    suppressedConnectors: ['detailed_security_audit'],
    ahaTargetSeconds: 240,
    reviewGateLanguage: 'Decision-ready?',
    libraryDestination: 'Executive decision briefs',
    entrySurface: 'artifact_seed',
    headline: 'Shape the executive decision narrative.',
    subheadline: 'Translate your current challenge into a focused decision memo and next bets.',
    generateLabel: 'Generate executive strategy',
  },
  COO: {
    persona: 'COO',
    primaryArtifactType: 'raci + memo',
    primaryConnector: 'project_hub',
    secondaryConnector: 'upload',
    suppressedConnectors: ['board_pack'],
    ahaTargetSeconds: 240,
    reviewGateLanguage: 'Execution-ready?',
    libraryDestination: 'Operations launch kits',
    entrySurface: 'artifact_seed',
    headline: 'Turn bottlenecks into an operating plan.',
    subheadline: 'Clarify owners, flow constraints, and the first execution moves worth launching.',
    generateLabel: 'Generate operations strategy',
  },
  CISO: {
    persona: 'CISO',
    primaryArtifactType: 'research_report + evidence_register',
    primaryConnector: 'security_stack',
    secondaryConnector: 'upload',
    suppressedConnectors: ['crm'],
    ahaTargetSeconds: 300,
    reviewGateLanguage: 'Policy-safe?',
    libraryDestination: 'Security evidence library',
    entrySurface: 'admin_console',
    headline: 'Start from policy posture before generation.',
    subheadline:
      'Review retention, ACL inheritance, and workspace restrictions before any artifact is created.',
    generateLabel: 'Continue to secure onboarding',
  },
  'Transformation Officer': {
    persona: 'Transformation Officer',
    primaryArtifactType: 'research_report',
    primaryConnector: 'upload',
    secondaryConnector: 'project_hub',
    suppressedConnectors: ['security_stack'],
    ahaTargetSeconds: 240,
    reviewGateLanguage: 'Transformation-ready?',
    libraryDestination: 'Transformation playbooks',
    entrySurface: 'artifact_seed',
    headline: 'Build the first transformation artifact.',
    subheadline: 'Use real context to generate a plan you can immediately carry into delivery.',
    generateLabel: 'Generate transformation strategy',
  },
};

export function resolvePersonaJourney(persona: OnboardingPersona): PersonaJourney {
  return PERSONA_JOURNEYS[persona] || PERSONA_JOURNEYS['Transformation Officer'];
}

export function resolveFirstOnboardingSurface(
  persona: OnboardingPersona
): 'admin_console' | 'artifact_seed' {
  return resolvePersonaJourney(persona).entrySurface;
}

export function personaToRouteSlug(persona: OnboardingPersona): string {
  return PERSONA_ROUTE_SLUGS[persona];
}

export function routeSlugToPersona(slug: string | null | undefined): OnboardingPersona | null {
  const normalized = String(slug || '')
    .trim()
    .toLowerCase();
  const match = Object.entries(PERSONA_ROUTE_SLUGS).find(([, value]) => value === normalized);
  return (match?.[0] as OnboardingPersona | undefined) || null;
}
