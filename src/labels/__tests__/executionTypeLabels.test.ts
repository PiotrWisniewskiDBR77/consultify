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

  it('never exposes a raw code or an unrecognized value — falls back to an honest "unknown" label', () => {
    expect(executionTypeLabel(undefined, true)).toBe('Nieznany typ');
    expect(executionTypeLabel(null, true)).toBe('Nieznany typ');
    expect(executionTypeLabel('', true)).toBe('Nieznany typ');
    // Belongs to a DIFFERENT axis vocabulary (initiatives.axis.* — strategic/
    // operational/tactical/transformational) that must never be silently
    // mapped onto one of these 7 families.
    expect(executionTypeLabel('transformational', true)).toBe('Nieznany typ');
    expect(executionTypeLabel('transformational', false)).toBe('Unknown type');
    expect(executionTypeLabel('FUTURE_AXIS', true)).toBe('Nieznany typ');
  });
});
