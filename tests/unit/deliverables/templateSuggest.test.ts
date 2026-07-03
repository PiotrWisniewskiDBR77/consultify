// @vitest-environment node
/**
 * Unit tests — deliverableTemplateSuggestService (T4)
 *
 * FT-1: ≥3 keyword matching + FT-6: ≥1 golden-path accuracy.
 * Mockuje listDeliverableTemplates żeby serwis nie trafiał do DB.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock serwisu szablonów (nie DB) ---
vi.mock('../../../server/src/services/deliverableTemplateService.js', () => ({
  listDeliverableTemplates: vi.fn().mockResolvedValue([]),
}));

// --- Mock loggera ---
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('deliverableTemplateSuggestService (keyword mode)', () => {
  let suggestTemplate: (
    intent: string,
    type: 'doc' | 'deck' | 'table',
    orgId: string,
    opts?: { useLlm?: boolean }
  ) => Promise<any>;

  beforeEach(async () => {
    vi.resetModules();
    // Re-mock po resetModules
    vi.mock('../../../server/src/services/deliverableTemplateService.js', () => ({
      listDeliverableTemplates: vi.fn().mockResolvedValue([]),
    }));
    vi.mock('../../../server/src/utils/Logger.js', () => ({
      default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));

    const mod = await import('../../../server/src/services/deliverableTemplateSuggestService.js');
    suggestTemplate = mod.suggestTemplate;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // FT-1.1 — audyt → dbr77-doc-audit-report
  it('PL: "raport audytowy" → dbr77-doc-audit-report', async () => {
    const result = await suggestTemplate('raport audytowy', 'doc', 'org-test');
    expect(result).not.toBeNull();
    expect(result!.templateId).toBe('dbr77-doc-audit-report');
    expect(result!.confidence).toMatch(/high|medium|low/);
    expect(result!.reasoning).toBeTruthy();
  });

  // FT-1.2 — brak dopasowania → null
  it('returns null for unrelated intent', async () => {
    const result = await suggestTemplate('niezwiązany tekst xyz 12345', 'doc', 'org-test');
    expect(result).toBeNull();
  });

  // FT-1.3 — EN: board presentation → dbr77-deck-board
  it('EN: "board presentation" → dbr77-deck-board', async () => {
    const result = await suggestTemplate('board presentation', 'deck', 'org-test');
    expect(result).not.toBeNull();
    expect(result!.templateId).toBe('dbr77-deck-board');
  });

  // FT-6 golden — PL: ryzyko → dbr77-table-risk-register
  it('FT-6/golden: PL "analiza ryzyk projektu" → dbr77-table-risk-register', async () => {
    const result = await suggestTemplate('analiza ryzyk projektu', 'table', 'org-test');
    expect(result).not.toBeNull();
    expect(result!.templateId).toBe('dbr77-table-risk-register');
  });

  // FT-1.4 — EN: executive memo → dbr77-doc-exec-memo
  it('EN: "executive brief for management" → dbr77-doc-exec-memo', async () => {
    const result = await suggestTemplate('executive brief for management', 'doc', 'org-test');
    expect(result).not.toBeNull();
    expect(result!.templateId).toBe('dbr77-doc-exec-memo');
  });

  // FT-1.5 — KPI dashboard
  it('EN: "kpi metrics dashboard" → dbr77-table-kpi-dashboard', async () => {
    const result = await suggestTemplate('kpi metrics dashboard', 'table', 'org-test');
    expect(result).not.toBeNull();
    expect(result!.templateId).toBe('dbr77-table-kpi-dashboard');
  });

  // FT-1.6 — diagnostic deck
  it('PL: "diagnoza sytuacji firmy" → dbr77-deck-diagnostic', async () => {
    const result = await suggestTemplate('diagnoza sytuacji firmy', 'deck', 'org-test');
    expect(result).not.toBeNull();
    expect(result!.templateId).toBe('dbr77-deck-diagnostic');
  });

  // FT-1.7 — typ doc nie zwraca deck templates
  it('does not match deck templates for doc type', async () => {
    const result = await suggestTemplate('board deck presentation', 'doc', 'org-test');
    // 'board' jest w dbr77-deck-board, ale nie ma dbr77-doc-* z tymi słowami kluczami
    expect(result).toBeNull();
  });

  // FT-1.8 — useLlm=false → tylko keyword matcher (nie wywołuje LLM)
  it('useLlm=false uses only keyword matching (no LLM import)', async () => {
    const result = await suggestTemplate('audit report check', 'doc', 'org-test', { useLlm: false });
    expect(result).not.toBeNull();
    expect(result!.templateId).toBe('dbr77-doc-audit-report');
  });
});
