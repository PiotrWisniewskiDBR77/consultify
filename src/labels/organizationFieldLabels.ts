/**
 * BLOKER audytu evidence/audyt-mvp-20260906/B/RAPORT_B.md (defekt #2, pozycja 01-2/01-4):
 * `OrganizationReadinessScreen.tsx` (i bliźniaczo `OrganizationDecisionQualityPanel.tsx`)
 * renderowały surowy `claimPath` z bazy wprost jako treść dla użytkownika —
 * „Konflikt: myWork.idea", „Konflikt: tools.sessionOutput" itd. To są techniczne
 * identyfikatory pól kontekstu organizacji (kropkowana notacja `sekcja.pole`), nie
 * treść po polsku.
 *
 * Kanoniczna lista ścieżek = `ORGANIZATION_CONTEXT_CLAIM_PATHS`
 * (`server/src/services/organizationContext/OrganizationContextService.ts:27-85`).
 * Ten słownik jest CELOWO frontendowy (nie importujemy kodu servera do bundla klienta) —
 * wzorem `src/labels/ideaSourceLabels.ts` (P4): stały słownik + funkcja z fallbackiem.
 *
 * Fallback dla nierozpoznanej ścieżki: „Nieznane pole" / "Unknown field" — NIGDY surowy
 * klucz techniczny nie trafia do UI.
 */

export type LabelLocale = 'pl' | 'en';

const ORGANIZATION_FIELD_LABELS: Record<string, Record<LabelLocale, string>> = {
  'profile.companyName': { pl: 'Nazwa firmy', en: 'Company name' },
  'profile.description': { pl: 'Opis firmy', en: 'Company description' },
  'profile.industry': { pl: 'Branża', en: 'Industry' },
  'profile.industryCode': { pl: 'Kod branży', en: 'Industry code' },
  'profile.industrySubsector': { pl: 'Podsektor branży', en: 'Industry subsector' },
  'profile.companySize': { pl: 'Wielkość firmy', en: 'Company size' },
  'profile.location': { pl: 'Lokalizacja', en: 'Location' },
  'profile.employeeCount': { pl: 'Liczba pracowników', en: 'Employee count' },
  'profile.annualRevenue': { pl: 'Przychód roczny', en: 'Annual revenue' },
  'profile.website': { pl: 'Strona internetowa', en: 'Website' },
  'profile.defaultLanguage': { pl: 'Domyślny język', en: 'Default language' },
  'profile.defaultTimezone': { pl: 'Domyślna strefa czasowa', en: 'Default timezone' },
  'profile.currency': { pl: 'Waluta', en: 'Currency' },
  'profile.linkedinUrl': { pl: 'Adres LinkedIn', en: 'LinkedIn URL' },
  'profile.twitterUrl': { pl: 'Adres Twitter/X', en: 'Twitter/X URL' },
  'profile.customDomain': { pl: 'Własna domena', en: 'Custom domain' },
  'profile.brandColor': { pl: 'Kolor marki', en: 'Brand color' },
  'profile.accentColor': { pl: 'Kolor akcentu', en: 'Accent color' },
  'strategic.goals': { pl: 'Cele strategiczne', en: 'Strategic goals' },
  'strategic.priorities': { pl: 'Priorytety strategiczne', en: 'Strategic priorities' },
  'strategic.mission': { pl: 'Misja', en: 'Mission' },
  'strategic.vision': { pl: 'Wizja', en: 'Vision' },
  'strategic.competitivePosition': { pl: 'Pozycja konkurencyjna', en: 'Competitive position' },
  'strategic.growthStage': { pl: 'Etap wzrostu', en: 'Growth stage' },
  'strategic.riskAppetite': { pl: 'Apetyt na ryzyko', en: 'Risk appetite' },
  'operations.keyMetrics': { pl: 'Kluczowe wskaźniki operacyjne', en: 'Key operational metrics' },
  'operations.constraints': { pl: 'Ograniczenia operacyjne', en: 'Operational constraints' },
  'operations.gaps': { pl: 'Luki operacyjne', en: 'Operational gaps' },
  'operations.interviewAnswers': { pl: 'Odpowiedzi z wywiadu', en: 'Interview answers' },
  'systems.stack': { pl: 'Stos systemów', en: 'Systems stack' },
  'systems.cloudAdoption': { pl: 'Wykorzystanie chmury', en: 'Cloud adoption' },
  'systems.integrations': { pl: 'Integracje systemowe', en: 'System integrations' },
  'stakeholders.people': { pl: 'Interesariusze', en: 'Stakeholders' },
  'notes.manualContext': { pl: 'Notatki kontekstowe', en: 'Manual context notes' },
  'metadata.custom': { pl: 'Metadane niestandardowe', en: 'Custom metadata' },
  'evidence.interview': { pl: 'Dowód: wywiad', en: 'Evidence: interview' },
  'evidence.documentExtraction': { pl: 'Dowód: ekstrakcja z dokumentu', en: 'Evidence: document extraction' },
  'signals.interviewInsights': { pl: 'Wnioski z wywiadu', en: 'Interview insights' },
  'signals.interviewFindings': { pl: 'Ustalenia z wywiadu', en: 'Interview findings' },
  'tools.sessionOutput': { pl: 'Wynik sesji narzędzia', en: 'Tool session output' },
  'myWork.idea': { pl: 'Pomysł z „Mojej pracy"', en: 'Idea from "My Work"' },
  'chat.explicitContext': { pl: 'Kontekst podany w czacie', en: 'Explicit chat context' },
  'integrations.signal': { pl: 'Sygnał z integracji', en: 'Integration signal' },
  'profile.organizationType': { pl: 'Typ organizacji', en: 'Organization type' },
  'profile.revenueModel': { pl: 'Model przychodów', en: 'Revenue model' },
  'profile.foundingYear': { pl: 'Rok założenia', en: 'Founding year' },
  'operations.deliveryModel': { pl: 'Model dostawy', en: 'Delivery model' },
  'operations.productionArchetype': { pl: 'Archetyp produkcji', en: 'Production archetype' },
  'operations.shiftPattern': { pl: 'Wzorzec zmianowy', en: 'Shift pattern' },
  'operations.automationLevel': { pl: 'Poziom automatyzacji', en: 'Automation level' },
  'systems.coreSystems': { pl: 'Systemy kluczowe', en: 'Core systems' },
  'profile.communicationStyle': { pl: 'Styl komunikacji', en: 'Communication style' },
  'profile.industryJargonLevel': { pl: 'Poziom żargonu branżowego', en: 'Industry jargon level' },
  'finance.statements': { pl: 'Sprawozdania finansowe', en: 'Financial statements' },
  'finance.models': { pl: 'Modele finansowe', en: 'Financial models' },
  'finance.laneStatus': { pl: 'Status toru finansowego', en: 'Finance lane status' },
  'finance.versionStatus': { pl: 'Status wersji', en: 'Version status' },
};

const UNKNOWN_ORGANIZATION_FIELD: Record<LabelLocale, string> = {
  pl: 'Nieznane pole',
  en: 'Unknown field',
};

/**
 * Zamienia techniczną ścieżkę claimu kontekstu organizacji (np. "myWork.idea") na
 * czytelną etykietę po polsku/angielsku. Nierozpoznana ścieżka → fallback "Nieznane
 * pole" ("Unknown field"), NIGDY surowy klucz techniczny.
 */
export function organizationFieldLabel(path: string | null | undefined, isPolish: boolean): string {
  const normalized = String(path ?? '').trim();
  const locale: LabelLocale = isPolish ? 'pl' : 'en';
  if (!normalized) return UNKNOWN_ORGANIZATION_FIELD[locale];
  const labels = ORGANIZATION_FIELD_LABELS[normalized];
  return labels?.[locale] ?? UNKNOWN_ORGANIZATION_FIELD[locale];
}

export const organizationFieldLabelEntries = ORGANIZATION_FIELD_LABELS;
