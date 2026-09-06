import { describe, expect, it } from 'vitest';

import { organizationFieldLabel, organizationFieldLabelEntries } from '../organizationFieldLabels';

/**
 * BLOKER audytu evidence/audyt-mvp-20260906/B/RAPORT_B.md (defekt #2):
 * OrganizationReadinessScreen.tsx renderowała surowy claimPath ("myWork.idea",
 * "tools.sessionOutput", "notes.manualContext", "operations.interviewAnswers") jako
 * treść dla użytkownika zamiast spolszczonej etykiety.
 *
 * Mutacja: usuń dowolny wpis z ORGANIZATION_FIELD_LABELS (np. "myWork.idea") →
 * `organizationFieldLabel('myWork.idea', true)` przestaje zwracać "Pomysł z „Mojej
 * pracy"" i spada na fallback "Nieznane pole" → test poniżej czerwony.
 */

// Ścieżki z RAPORT_B, dosłownie wskazane jako pokazywane surowo na ekranie.
const REPORTED_RAW_PATHS = [
  'myWork.idea',
  'tools.sessionOutput',
  'notes.manualContext',
  'operations.interviewAnswers',
];

describe('organizationFieldLabel', () => {
  it('humanizuje dokładnie te ścieżki, które audyt złapał jako surowe na ekranie', () => {
    for (const path of REPORTED_RAW_PATHS) {
      const pl = organizationFieldLabel(path, true);
      const en = organizationFieldLabel(path, false);
      expect(pl, path).not.toBe(path);
      expect(en, path).not.toBe(path);
      expect(pl.length, path).toBeGreaterThan(0);
      expect(en.length, path).toBeGreaterThan(0);
    }
  });

  it('zna każdą ścieżkę z kanonicznej listy ORGANIZATION_CONTEXT_CLAIM_PATHS (server)', () => {
    // Kopia server/src/services/organizationContext/OrganizationContextService.ts:27-85 —
    // celowo zduplikowana (frontend nie importuje kodu servera), rozjazd wykrywa ten test.
    const CANONICAL_PATHS = [
      'profile.companyName',
      'profile.description',
      'profile.industry',
      'profile.industryCode',
      'profile.industrySubsector',
      'profile.companySize',
      'profile.location',
      'profile.employeeCount',
      'profile.annualRevenue',
      'profile.website',
      'profile.defaultLanguage',
      'profile.defaultTimezone',
      'profile.currency',
      'profile.linkedinUrl',
      'profile.twitterUrl',
      'profile.customDomain',
      'profile.brandColor',
      'profile.accentColor',
      'strategic.goals',
      'strategic.priorities',
      'strategic.mission',
      'strategic.vision',
      'strategic.competitivePosition',
      'strategic.growthStage',
      'strategic.riskAppetite',
      'operations.keyMetrics',
      'operations.constraints',
      'operations.gaps',
      'operations.interviewAnswers',
      'systems.stack',
      'systems.cloudAdoption',
      'systems.integrations',
      'stakeholders.people',
      'notes.manualContext',
      'metadata.custom',
      'evidence.interview',
      'evidence.documentExtraction',
      'signals.interviewInsights',
      'signals.interviewFindings',
      'tools.sessionOutput',
      'myWork.idea',
      'chat.explicitContext',
      'integrations.signal',
      'profile.organizationType',
      'profile.revenueModel',
      'profile.foundingYear',
      'operations.deliveryModel',
      'operations.productionArchetype',
      'operations.shiftPattern',
      'operations.automationLevel',
      'systems.coreSystems',
      'profile.communicationStyle',
      'profile.industryJargonLevel',
      'finance.statements',
      'finance.models',
      'finance.laneStatus',
      'finance.versionStatus',
    ];

    for (const path of CANONICAL_PATHS) {
      expect(organizationFieldLabelEntries[path], path).toBeDefined();
      expect(organizationFieldLabelEntries[path]?.pl, path).toEqual(expect.any(String));
      expect(organizationFieldLabelEntries[path]?.en, path).toEqual(expect.any(String));
    }
  });

  it('nigdy nie zwraca surowego, nierozpoznanego klucza technicznego — fallback jawny', () => {
    expect(organizationFieldLabel('some.future.unmapped.path', true)).toBe('Nieznane pole');
    expect(organizationFieldLabel('some.future.unmapped.path', false)).toBe('Unknown field');
    expect(organizationFieldLabel('some.future.unmapped.path', true)).not.toContain(
      'some.future.unmapped.path'
    );
    expect(organizationFieldLabel(null, true)).toBe('Nieznane pole');
    expect(organizationFieldLabel(undefined, false)).toBe('Unknown field');
    expect(organizationFieldLabel('', true)).toBe('Nieznane pole');
  });
});
