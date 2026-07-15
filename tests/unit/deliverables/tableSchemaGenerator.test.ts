// @vitest-environment node
/**
 * Unit tests — tableSchemaGeneratorService (W4 / B4)
 *
 * FT-1: typed-schema generation logic
 *   1. STANDARD → fallbackUsed=true, 3 pola text (singleLineText), 0 seed
 *   2. PREMIUM + LLM "tabela ryzyk" → singleSelect z kolorami + seedRows≥3
 *   3. LLM nieprawidłowy type → mapowany na 'singleLineText'
 *   4. premium: ≥1 pole nie-text + singleSelect ma options z kolorami (jakość)
 * FT-8: fail-open / flag-OFF
 *   5. LLM rzuca → fallbackUsed=true, brak rzutu
 *   6. orgId→resolver; preferPremium=false → STANDARD
 *
 * Resolver tier injektowany via flagi premiumEnabled — ale generateTableSchema
 * woła resolveDeliverableTier({ orgId, preferPremium }) bez tej DI seam, więc
 * sterujemy tierem przez mock B5 resolvera + mock llmService.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock B5 tier resolver ──────────────────────────────────────
const mockResolveTier = vi.fn();
vi.mock('../../../server/src/services/deliverableGenerationTier.js', () => ({
  resolveDeliverableTier: (opts: any) => mockResolveTier(opts),
  DELIVERABLE_GENERATION_PURPOSE: 'deliverable_generation',
  deliverableModelConfig: (fb?: any) => fb ?? { id: 'premium' },
}));

// ── Mock llmService + modelRouter (dynamic imports) ────────────
const mockLlmCall = vi.fn();
vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: any[]) => mockLlmCall(...args) },
}));
vi.mock('../../../server/src/services/ai/modelRouter.js', () => ({
  default: { select: vi.fn().mockResolvedValue({ id: 'premium-model' }) },
}));

// ── Mock logger (avoid pulling the full logging stack) ─────────
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { generateTableSchema } from '../../../server/src/services/tableSchemaGeneratorService.js';

const RISK_LLM_OBJECT = {
  fields: [
    { key: 'risk', header: 'Risk', type: 'singleLineText' },
    {
      key: 'likelihood',
      header: 'Likelihood',
      type: 'singleSelect',
      options: [
        { label: 'Low', color: '#16A34A' },
        { label: 'Med', color: '#D97706' },
        { label: 'High', color: '#DC2626' },
      ],
    },
    {
      key: 'impact',
      header: 'Impact',
      type: 'singleSelect',
      options: [
        { label: 'Low', color: '#16A34A' },
        { label: 'High', color: '#DC2626' },
      ],
    },
    { key: 'owner', header: 'Owner', type: 'singleLineText' },
  ],
  seedRows: [
    { risk: 'Vendor delay', likelihood: 'Med', impact: 'High', owner: 'Anna' },
    { risk: 'Budget overrun', likelihood: 'High', impact: 'High', owner: 'Piotr' },
    { risk: 'Scope creep', likelihood: 'Low', impact: 'Med', owner: 'Maria' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('tableSchemaGeneratorService (B4)', () => {
  // ── FT-1 ──────────────────────────────────────────────────────
  it('FT-1/1: STANDARD tier → fallback (3 text fields, 0 seed)', async () => {
    mockResolveTier.mockReturnValue('STANDARD');

    const result = await generateTableSchema('tabela ryzyk', { orgId: 'org-1' });

    expect(result.fallbackUsed).toBe(true);
    expect(result.tierUsed).toBe('STANDARD');
    expect(result.fields).toHaveLength(3);
    expect(result.fields.every((f) => f.type === 'singleLineText')).toBe(true);
    expect(result.seedRows).toHaveLength(0);
    // STANDARD never calls the LLM.
    expect(mockLlmCall).not.toHaveBeenCalled();
  });

  it('FT-1/2: PREMIUM + LLM risk table → singleSelect with colors + seedRows≥3', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockResolvedValue({ object: RISK_LLM_OBJECT });

    const result = await generateTableSchema('tabela ryzyk projektu', { orgId: 'org-1' });

    expect(result.fallbackUsed).toBe(false);
    expect(result.tierUsed).toBe('PREMIUM');

    const likelihood = result.fields.find((f) => f.key === 'likelihood');
    expect(likelihood?.type).toBe('singleSelect');
    expect(likelihood?.options?.length).toBeGreaterThanOrEqual(2);
    expect(likelihood?.options?.every((o) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(o.color!))).toBe(
      true
    );
    expect(result.seedRows.length).toBeGreaterThanOrEqual(3);
  });

  it('FT-1/3: LLM invalid field type → mapped to singleLineText', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockResolvedValue({
      object: {
        fields: [
          { key: 'name', header: 'Name', type: 'bogus_type' },
          { key: 'count', header: 'Count', type: 'number' },
          {
            key: 'status',
            header: 'Status',
            type: 'singleSelect',
            options: [{ label: 'Open', color: '#16A34A' }],
          },
        ],
        seedRows: [
          { name: 'A', count: 1, status: 'Open' },
          { name: 'B', count: 2, status: 'Open' },
          { name: 'C', count: 3, status: 'Open' },
        ],
      },
    });

    const result = await generateTableSchema('cokolwiek', { orgId: 'org-1' });

    const nameField = result.fields.find((f) => f.key === 'name');
    expect(nameField?.type).toBe('singleLineText'); // bogus_type → singleLineText
    expect(result.fields.find((f) => f.key === 'count')?.type).toBe('number');
    expect(result.fallbackUsed).toBe(false);
  });

  it('FT-1/4: premium quality — ≥1 typed field AND singleSelect options carry hex colors', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockResolvedValue({ object: RISK_LLM_OBJECT });

    const result = await generateTableSchema('tabela ryzyk', { orgId: 'org-1' });

    // ≥1 pole nie-text
    const typed = result.fields.filter((f) => f.type !== 'singleLineText');
    expect(typed.length).toBeGreaterThanOrEqual(1);
    // każdy singleSelect ma options z kolorami hex
    for (const f of result.fields) {
      if (f.type === 'singleSelect' || f.type === 'multiSelect') {
        expect(f.options && f.options.length).toBeGreaterThan(0);
        expect(f.options!.every((o) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(o.color!))).toBe(true);
      }
    }
  });

  it('FT-1/4b: premium schema with NO typed field → fails quality → fallback', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockResolvedValue({
      object: {
        fields: [
          { key: 'a', header: 'A', type: 'singleLineText' },
          { key: 'b', header: 'B', type: 'singleLineText' },
        ],
        seedRows: [{ a: '1', b: '2' }, { a: '3', b: '4' }, { a: '5', b: '6' }],
      },
    });

    const result = await generateTableSchema('plaska tabela', { orgId: 'org-1' });
    expect(result.fallbackUsed).toBe(true);
    expect(result.tierUsed).toBe('STANDARD');
  });

  it('FT-1/4c: premium with <3 seed rows → fails quality → fallback', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockResolvedValue({
      object: {
        fields: [{ key: 'count', header: 'Count', type: 'number' }],
        seedRows: [{ count: 1 }],
      },
    });

    const result = await generateTableSchema('zbyt malo wierszy', { orgId: 'org-1' });
    expect(result.fallbackUsed).toBe(true);
  });

  // ── FT-8 ──────────────────────────────────────────────────────
  it('FT-8/5: LLM throws → fallbackUsed=true, no throw (fail-open)', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockRejectedValue(new Error('LLM boom'));

    await expect(
      generateTableSchema('tabela ryzyk', { orgId: 'org-1' })
    ).resolves.toMatchObject({ fallbackUsed: true, tierUsed: 'STANDARD' });
  });

  it('FT-8/6: orgId+preferPremium passed to resolver; preferPremium=false → STANDARD', async () => {
    mockResolveTier.mockReturnValue('STANDARD');

    const result = await generateTableSchema('tabela', {
      orgId: 'org-42',
      preferPremium: false,
    });

    expect(mockResolveTier).toHaveBeenCalledWith({ orgId: 'org-42', preferPremium: false });
    expect(result.tierUsed).toBe('STANDARD');
    expect(result.fallbackUsed).toBe(true);
    expect(mockLlmCall).not.toHaveBeenCalled();
  });

  // ── FT-D — defaults injection ──────────────────────────────────
  it('FT-D/1: PREMIUM system prompt contains seedRows from deliverableDefaults (8)', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockResolvedValue({ object: RISK_LLM_OBJECT });

    await generateTableSchema('tabela projektow', { orgId: 'org-1' });

    const callArgs = mockLlmCall.mock.calls[0][0];
    const systemPrompt: string =
      callArgs?.messages?.find?.((m: any) => m.role === 'system')?.content ??
      callArgs?.system ??
      JSON.stringify(callArgs);
    expect(systemPrompt).toMatch(/\b8\b/);
  });

  it('FT-D/2: PREMIUM system prompt contains TOTALS ROW guidance', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockResolvedValue({ object: RISK_LLM_OBJECT });

    await generateTableSchema('budzet projektu', { orgId: 'org-1' });

    const callArgs = mockLlmCall.mock.calls[0][0];
    const systemPrompt: string =
      callArgs?.messages?.find?.((m: any) => m.role === 'system')?.content ??
      callArgs?.system ??
      JSON.stringify(callArgs);
    expect(systemPrompt).toMatch(/TOTALS ROW/i);
  });

  // ── FT-G — data-integrity guard (§0.3 parity, commit 0868a37b09) ────────
  // Smoke test mirroring docGenerationRuntime.test.ts's "startSheet: system
  // prompt zabrania prezentowania zmyślonych liczb jako realnych danych org
  // (§0.3)": asserts the premium sheet-schema brief carries the same
  // fabrication-forbidding doctrine, not the exact wording.
  it('FT-G/1: PREMIUM system prompt forbids presenting fabricated numbers as real org data (§0.3)', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockResolvedValue({ object: RISK_LLM_OBJECT });

    await generateTableSchema('tabela ryzyk projektu', { orgId: 'org-1' });

    const callArgs = mockLlmCall.mock.calls[0][0];
    const systemPrompt: string = callArgs?.systemPrompt ?? '';
    expect(systemPrompt).toContain('§0.3');
    expect(systemPrompt).toMatch(/DATA INTEGRITY/i);
    expect(systemPrompt).toMatch(/ILLUSTRATIVE EXAMPLE/i);
    expect(systemPrompt).toMatch(
      /NEVER invent a precise-looking business metric.*present it as real organisation data/i
    );
  });

  it('FT-G/2: PREMIUM system prompt instructs verbatim use of caller-embedded real data', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockResolvedValue({ object: RISK_LLM_OBJECT });

    await generateTableSchema('tabela z danymi', { orgId: 'org-1' });

    const callArgs = mockLlmCall.mock.calls[0][0];
    const systemPrompt: string = callArgs?.systemPrompt ?? '';
    expect(systemPrompt).toMatch(/reproduce EXACTLY those values, unmodified/i);
  });
});
