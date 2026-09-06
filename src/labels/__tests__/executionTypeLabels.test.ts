import { describe, expect, it } from 'vitest';

import { executionTypeLabel, executionTypeLabelEntries } from '../executionTypeLabels';

describe('executionTypeLabel', () => {
  it('maps every canonical axis key in Polish and English', () => {
    expect(executionTypeLabelEntries).toEqual({
      PROCESSES: { pl: 'Procesy', en: 'Processes' },
      DIGITAL: { pl: 'Cyfryzacja', en: 'Digital' },
      MODELS: { pl: 'Modele biznesowe', en: 'Business models' },
      DATA: { pl: 'Dane', en: 'Data' },
      CULTURE: { pl: 'Kultura', en: 'Culture' },
      CYBERSECURITY: { pl: 'Cyberbezpieczeństwo', en: 'Cybersecurity' },
      AI: { pl: 'AI', en: 'AI' },
      STRATEGIC: { pl: 'Strategiczna', en: 'Strategic' },
      OPERATIONAL: { pl: 'Operacyjna', en: 'Operational' },
      TRANSFORMATIONAL: { pl: 'Transformacyjna', en: 'Transformational' },
      COMPLIANCE: { pl: 'Zgodność (compliance)', en: 'Compliance' },
    });
    expect(executionTypeLabel('PROCESSES', true)).toBe('Procesy');
    expect(executionTypeLabel('DIGITAL', true)).toBe('Cyfryzacja');
    expect(executionTypeLabel('MODELS', true)).toBe('Modele biznesowe');
    expect(executionTypeLabel('DATA', true)).toBe('Dane');
    expect(executionTypeLabel('CULTURE', true)).toBe('Kultura');
    expect(executionTypeLabel('CYBERSECURITY', true)).toBe('Cyberbezpieczeństwo');
    expect(executionTypeLabel('AI', true)).toBe('AI');
    expect(executionTypeLabel('PROCESSES', false)).toBe('Processes');
  });

  // Wartości zmierzone na żywo (evidence/mvp-naprawy-noc-2/, `curl
  // /api/initiatives` na lokalnym stanowisku, org DBR77): ŻADNA z nich nie
  // trafiała w stary `getTypeCode` w ExecutionHub.tsx (wszystkie spadały do
  // fallbacku 'EXE') — to jest dowód mutacyjny wprost z realnych danych, nie
  // wymyślony przypadek brzegowy.
  it('recognizes the real-world axis spellings measured live on /api/initiatives (org DBR77)', () => {
    expect(executionTypeLabel('Cybersecurity', true)).toBe('Cyberbezpieczeństwo');
    expect(executionTypeLabel('Culture of Transformation', true)).toBe('Kultura');
    expect(executionTypeLabel('Digital Products', true)).toBe('Cyfryzacja');
    expect(executionTypeLabel('AI Maturity', true)).toBe('AI');
    expect(executionTypeLabel('Digital Processes', true)).toBe('Procesy');
    expect(executionTypeLabel('Data Management', true)).toBe('Dane');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(executionTypeLabel('  processes  ', true)).toBe('Procesy');
    expect(executionTypeLabel('cybersecurity', true)).toBe('Cyberbezpieczeństwo');
  });

  // NAPRAWA (audyt MVP 06.09, RAPORT_A3.md, WAŻNY #2): `select axis,
  // count(*) from initiatives … group by axis` na stanowisku lokalnym
  // (org DBR77, 71 wierszy) pokazało 13/71 (18%) z `axis='transformational'`
  // — to WALIDOWANA wartość `InitiativeAxisEnum`
  // (server/src/validators/initiative.validators.ts:24-29:
  // `['strategic','operational','transformational','compliance']`), inna
  // (realna) oś tego samego pola, nie literówka i nie zgadywanie. Musi
  // dostać własną etykietę, nie "Nieznany typ".
  it('recognizes the sibling InitiativeAxisEnum vocabulary (strategic/operational/transformational/compliance) — validator-confirmed, not guessed', () => {
    expect(executionTypeLabel('transformational', true)).toBe('Transformacyjna');
    expect(executionTypeLabel('transformational', false)).toBe('Transformational');
    expect(executionTypeLabel('strategic', true)).toBe('Strategiczna');
    expect(executionTypeLabel('operational', true)).toBe('Operacyjna');
    expect(executionTypeLabel('compliance', true)).toBe('Zgodność (compliance)');
  });

  // NAPRAWA (audyt MVP 06.09, RAPORT_A3.md, WAŻNY #2): 48/71 (68%) wierszy
  // na stanowisku lokalnym mają `axis IS NULL` w bazie — sprawdzone SQL-em
  // wprost, nie zgadywane. Brak pomiaru NIE jest tym samym co nierozpoznana
  // wartość (CLAUDE.md / pamięć nadzorcy "Brak pomiaru nie jest wynikiem")
  // — musi dostać osobny, uczciwy stan "—", nigdy "Nieznany typ".
  //
  // DOWÓD MUTACYJNY: usuń w `executionTypeLabel` gałąź `if (!trimmed) return
  // NO_AXIS_LABEL[locale]` (albo cofnij `toPortfolioInitiative`'s `axis:
  // (initiative as any).axis ?? ''` do starego `String(initiative.axis)`)
  // → ten test i "no raw code" test padają, bo brak danych znów pokazuje
  // się jako "Nieznany typ".
  it('renders "—" for missing axis data — never "Nieznany typ" for an absent measurement', () => {
    expect(executionTypeLabel(undefined, true)).toBe('—');
    expect(executionTypeLabel(null, true)).toBe('—');
    expect(executionTypeLabel('', true)).toBe('—');
    expect(executionTypeLabel('   ', true)).toBe('—');
    expect(executionTypeLabel(undefined, false)).toBe('—');
  });

  it('still falls back to an honest "unknown" label for a genuinely unrecognized, non-empty value', () => {
    expect(executionTypeLabel('FUTURE_AXIS', true)).toBe('Nieznany typ');
    expect(executionTypeLabel('FUTURE_AXIS', false)).toBe('Unknown type');
  });
});
