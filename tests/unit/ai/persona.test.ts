import { describe, expect, it } from 'vitest';
import {
  buildPersonaPrompt,
  detectLanguage,
  getAvailableEmphases,
  getLanguageConfig,
  getScreenEmphasis,
} from '../../../server/src/ai/persona';

describe('persona helpers', () => {
  it('detectLanguage prefers conversation language, then user preference, then default', () => {
    expect(detectLanguage('en-US', 'pl')).toBe('en');
    expect(detectLanguage(undefined, 'de-DE')).toBe('de');
    // ZMIANA 2026-09-06 (SSOT jezyka): domyslka to `pl`, nie `en`.
    // Poprzednia asercja (`toBe('en')`) utrwalala defekt zmierzony 05.09:
    // `/api/ai/chat/stream` z polskim pytaniem odpowiadalo po angielsku, bo
    // KAZDY wolacz bez jawnego `language` trafial na `|| 'en'`.
    // `docs/ssot/ZASADY_AI_TERESA_SSOT.md` par.8 J1: „Polski jest domyslny".
    // Wybor EN nadal dziala — musi byc jawny (patrz asercja wyzej).
    expect(detectLanguage(undefined, undefined)).toBe('pl');
  });

  it('detectLanguage maps unsupported common languages to english fallback', () => {
    expect(detectLanguage('pt-BR', 'pl')).toBe('en');
    expect(detectLanguage('it', undefined)).toBe('en');
    expect(detectLanguage('fr', undefined)).toBe('en');
  });

  it('detectLanguage falls back to polish for unknown language codes', () => {
    expect(detectLanguage('xx', 'yy')).toBe('en');
  });

  it('getScreenEmphasis matches exact and partial keys with normalization', () => {
    expect(getScreenEmphasis('assessment')?.role).toBe('consultant');
    expect(getScreenEmphasis('assessment-summary')?.role).toBe('consultant');
    expect(getScreenEmphasis('context-builder')?.role).toBe('consultant');
    expect(getScreenEmphasis('roadmap_overview')?.role).toBe('pm');
  });

  it('getScreenEmphasis returns null for unknown screens', () => {
    expect(getScreenEmphasis('unknown-screen')).toBeNull();
    expect(getScreenEmphasis(undefined)).toBeNull();
  });

  it('getAvailableEmphases returns a defensive copy', () => {
    const emphases = getAvailableEmphases();
    expect(emphases).toHaveProperty('assessment');
    emphases.assessment = { role: 'analyst', instructions: 'mutated' };
    expect(getAvailableEmphases().assessment.role).toBe('consultant');
  });

  it('getLanguageConfig returns a config for a supported language', () => {
    const cfg = getLanguageConfig('en');
    expect(cfg.coreTone).toMatch(/English/i);
  });

  it('buildPersonaPrompt uses english by default and injects screen emphasis', () => {
    const prompt = buildPersonaPrompt('assessment');
    expect(prompt).toContain('## ROLE & IDENTITY');
    expect(prompt).toContain('### Screen Context');
    expect(prompt).toContain('Strategic Consultant');
  });

  it('buildPersonaPrompt supports english language and screen context labels', () => {
    const prompt = buildPersonaPrompt('roadmap', 'en');
    expect(prompt).toContain('## ROLE & IDENTITY');
    expect(prompt).toContain('### Screen Context');
    expect(prompt).toContain('Program Manager');
  });

  it('buildPersonaPrompt handles unsupported language by falling back to english', () => {
    const prompt = buildPersonaPrompt('roadmap', 'pt');
    expect(prompt).toContain('## ROLE & IDENTITY');
  });
});
