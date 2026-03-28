import { describe, expect, it } from 'vitest';

import {
  getTeresaEmptyResponseMessage,
  getTeresaStartFailureMessage,
} from '../../../src/components/AIChat/teresaRuntimeCopy';

describe('teresaRuntimeCopy', () => {
  it('returns a product-safe start failure message without backend setup details', () => {
    const english = getTeresaStartFailureMessage('en');
    const polish = getTeresaStartFailureMessage('pl');

    expect(english).toContain('Teresa is temporarily unavailable');
    expect(polish).toContain('Teresa jest chwilowo niedostepna');

    expect(english).not.toContain('backend');
    expect(english).not.toContain('OPENAI_API_KEY');
    expect(english).not.toContain('GEMINI_API_KEY');

    expect(polish).not.toContain('backend');
    expect(polish).not.toContain('OPENAI_API_KEY');
    expect(polish).not.toContain('GEMINI_API_KEY');
  });

  it('returns a product-safe empty-response fallback without technical remediation copy', () => {
    const english = getTeresaEmptyResponseMessage('en');
    const polish = getTeresaEmptyResponseMessage('pl');

    expect(english).toContain('Teresa did not return a complete answer');
    expect(polish).toContain('Teresa nie zwrocila pelnej odpowiedzi');

    expect(english).not.toContain('provider');
    expect(english).not.toContain('configuration');
    expect(polish).not.toContain('provider');
    expect(polish).not.toContain('konfigur');
  });
});
