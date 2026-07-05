/**
 * deriveArtifactTitle — clean human titles from messy briefs (beauty pass).
 * Ugly things don't get read: a raw brief or generic 'Executive presentation
 * draft' as the artifact title both read badly.
 */
import { describe, expect, it } from 'vitest';
import { deriveArtifactTitle } from '../../../server/src/services/v8/artifactRegistryService';

describe('deriveArtifactTitle', () => {
  it('strips leading format label + trailing instruction tail', () => {
    const t = deriveArtifactTitle(
      'Tabela: rejestr 8 inicjatyw transformacji AI — nazwa, właściciel. Dodaj przykładowe dane.',
      'Tabela operacyjna'
    );
    expect(t).not.toMatch(/^tabela:/i);
    expect(t.toLowerCase()).not.toContain('dodaj przykładowe');
    expect(t).toContain('rejestr 8 inicjatyw'.charAt(0).toUpperCase() + 'ejestr 8 inicjatyw');
  });

  it('caps length and capitalizes', () => {
    const long = 'a'.repeat(120);
    const t = deriveArtifactTitle(long, 'Fallback');
    expect(t.length).toBeLessThanOrEqual(70);
    expect(t.endsWith('…')).toBe(true);
    expect(t[0]).toBe('A');
  });

  it('empty goal → fallback', () => {
    expect(deriveArtifactTitle('', 'Prezentacja')).toBe('Prezentacja');
    expect(deriveArtifactTitle('   ', 'Raport')).toBe('Raport');
  });

  it('takes first clause only (no run-on)', () => {
    const t = deriveArtifactTitle('Diagnoza gotowości na AI. Druga myśl tutaj.', 'X');
    expect(t).toBe('Diagnoza gotowości na AI');
  });
});
