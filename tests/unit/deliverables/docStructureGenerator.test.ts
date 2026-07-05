// @vitest-environment node
/**
 * Unit tests — documentStructureGenerator (W4 / B3)
 *
 * FT-1 (≥4): tier branching + block-type selection + invalid-type mapping
 *            + quality gate (>1 block type).
 * FT-8 (≥2): fail-open (LLM throws → fallback, no throw) + resolver wiring
 *            (preferPremium=false → STANDARD).
 *
 * Mockuje llmService + resolver (deliverableGenerationTier).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock loggera ---
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock tier resolvera — sterujemy PREMIUM/STANDARD per test.
const mockResolveTier = vi.fn();
vi.mock('../../../server/src/services/deliverableGenerationTier.js', () => ({
  resolveDeliverableTier: (...args: any[]) => mockResolveTier(...args),
  DELIVERABLE_GENERATION_PURPOSE: 'deliverable_generation',
  deliverableModelConfig: (fb?: any) => fb ?? { id: 'premium' },
}));

// Mock llmService (structured call).
const mockLlmCall = vi.fn();
vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: any[]) => mockLlmCall(...args) },
}));

const OUTLINE = [
  { title: 'Executive Summary', purpose: 'Top-line findings' },
  { title: 'Findings', purpose: 'Detailed observations' },
  { title: 'Risks', purpose: 'Risk register' },
];

describe('documentStructureGenerator — planDocumentStructure', () => {
  let planDocumentStructure: typeof import(
    '../../../server/src/services/documentStudio/documentStructureGenerator.js'
  ).planDocumentStructure;

  beforeEach(async () => {
    vi.resetModules();
    mockResolveTier.mockReset();
    mockLlmCall.mockReset();

    const mod = await import(
      '../../../server/src/services/documentStudio/documentStructureGenerator.js'
    );
    planDocumentStructure = mod.planDocumentStructure;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── FT-1.1 — STANDARD → fallback (heading+paragraph per sekcja) ──
  it('FT-1.1: STANDARD tier → fallbackUsed, each section = heading+paragraph', async () => {
    mockResolveTier.mockReturnValue('STANDARD');

    const plan = await planDocumentStructure('audit report', OUTLINE, {
      orgId: 'org-1',
    });

    expect(plan.tierUsed).toBe('STANDARD');
    expect(plan.fallbackUsed).toBe(true);
    expect(plan.sections).toHaveLength(3);
    for (const section of plan.sections) {
      expect(section.blocks.map((b) => b.type)).toEqual(['heading', 'paragraph']);
    }
    // STANDARD never calls the LLM.
    expect(mockLlmCall).not.toHaveBeenCalled();
  });

  // ── FT-1.2 — PREMIUM + LLM zwraca table+kpi+callout → >1 typ bloku ──
  it('FT-1.2: PREMIUM + LLM structure with table/kpi/callout → multiple block types', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockResolvedValue({
      object: {
        sections: [
          {
            title: 'Executive Summary',
            purpose: 'Top-line findings',
            blocks: [
              { type: 'heading', hint: 'Executive Summary' },
              { type: 'paragraph', hint: 'Overview' },
              { type: 'callout', hint: 'Key message' },
            ],
          },
          {
            title: 'Findings',
            purpose: 'Detailed observations',
            blocks: [
              { type: 'heading', hint: 'Findings' },
              { type: 'table', hint: 'Comparison of options' },
              { type: 'kpi_strip', hint: 'Process metrics' },
            ],
          },
        ],
      },
    });

    const plan = await planDocumentStructure('audit report', OUTLINE, {
      orgId: 'org-1',
      preferPremium: true,
    });

    expect(plan.tierUsed).toBe('PREMIUM');
    expect(plan.fallbackUsed).toBe(false);
    const types = plan.sections.flatMap((s) => s.blocks.map((b) => b.type));
    expect(types).toContain('table');
    expect(types).toContain('kpi_strip');
    expect(types).toContain('callout');
    expect(new Set(types).size).toBeGreaterThan(1);
  });

  // ── FT-1.3 — LLM zwraca nieprawidłowy typ → mapowany na 'paragraph' ──
  it('FT-1.3: invalid block type from LLM → mapped to paragraph', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockResolvedValue({
      object: {
        sections: [
          {
            title: 'Findings',
            blocks: [
              { type: 'heading', hint: 'Findings' },
              { type: 'super_fancy_widget', hint: 'nonsense type' },
              { type: 'table', hint: 'a real table' },
            ],
          },
        ],
      },
    });

    const plan = await planDocumentStructure('audit report', OUTLINE, {
      orgId: 'org-1',
      preferPremium: true,
    });

    const types = plan.sections.flatMap((s) => s.blocks.map((b) => b.type));
    expect(types).not.toContain('super_fancy_widget');
    // Nieprawidłowy typ stał się 'paragraph'.
    expect(types).toContain('paragraph');
    expect(types).toContain('table');
  });

  // ── FT-1.4 — premium plan: dokument ma >1 typ bloku (quality gate) ──
  it('FT-1.4: premium plan with only ONE block type fails quality → fallback', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    // LLM zwrócił same paragraphy (1 typ) → quality gate odrzuca → fallback.
    mockLlmCall.mockResolvedValue({
      object: {
        sections: [
          {
            title: 'Findings',
            blocks: [
              { type: 'paragraph', hint: 'a' },
              { type: 'paragraph', hint: 'b' },
            ],
          },
        ],
      },
    });

    const plan = await planDocumentStructure('audit report', OUTLINE, {
      orgId: 'org-1',
      preferPremium: true,
    });

    // Quality gate: single-type premium plan jest gorszy → fallback.
    expect(plan.fallbackUsed).toBe(true);
    expect(plan.tierUsed).toBe('STANDARD');
    // Fallback wciąż ma >1 typ (heading+paragraph) i pokrywa cały outline.
    expect(plan.sections).toHaveLength(3);
    const types = new Set(
      plan.sections.flatMap((s) => s.blocks.map((b) => b.type))
    );
    expect(types.size).toBeGreaterThan(1);
  });

  // ── FT-8.1 — LLM rzuca → fallbackUsed, brak rzutu ──
  it('FT-8.1: LLM throws → fail-open to fallback, never throws', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockRejectedValue(new Error('LLM provider 503'));

    const plan = await planDocumentStructure('audit report', OUTLINE, {
      orgId: 'org-1',
      preferPremium: true,
    });

    expect(plan.fallbackUsed).toBe(true);
    expect(plan.tierUsed).toBe('STANDARD');
    expect(plan.sections).toHaveLength(3);
    for (const section of plan.sections) {
      expect(section.blocks.length).toBeGreaterThan(0);
    }
  });

  // ── FT-8.2 — orgId→resolver; preferPremium=false → STANDARD ──
  it('FT-8.2: orgId + preferPremium forwarded to resolver; false → STANDARD', async () => {
    // Realistyczna logika resolvera: preferPremium=false wymusza STANDARD.
    mockResolveTier.mockImplementation((o: any) =>
      o?.preferPremium === false ? 'STANDARD' : 'PREMIUM'
    );

    const plan = await planDocumentStructure('audit report', OUTLINE, {
      orgId: 'org-XYZ',
      preferPremium: false,
    });

    expect(mockResolveTier).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-XYZ', preferPremium: false })
    );
    expect(plan.tierUsed).toBe('STANDARD');
    expect(plan.fallbackUsed).toBe(true);
    expect(mockLlmCall).not.toHaveBeenCalled();
  });

  // ── FT-D — defaults injection ──────────────────────────────────
  it('FT-D/1: PREMIUM system prompt contains register="professional"', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockResolvedValue({
      object: {
        sections: OUTLINE.map((s) => ({
          title: s.title,
          blocks: [
            { type: 'heading', hint: s.title },
            { type: 'kpi_strip', hint: 'key metrics' },
          ],
        })),
      },
    });

    await planDocumentStructure('AI readiness report', OUTLINE, { orgId: 'org-1' });

    const callArgs = mockLlmCall.mock.calls[0][0];
    const systemPrompt: string =
      callArgs?.messages?.find?.((m: any) => m.role === 'system')?.content ??
      callArgs?.system ??
      JSON.stringify(callArgs);
    expect(systemPrompt).toMatch(/professional/i);
  });

  it('FT-D/2: PREMIUM system prompt contains answer-first guidance', async () => {
    mockResolveTier.mockReturnValue('PREMIUM');
    mockLlmCall.mockResolvedValue({
      object: {
        sections: OUTLINE.map((s) => ({
          title: s.title,
          blocks: [
            { type: 'heading', hint: s.title },
            { type: 'callout', hint: 'key warning' },
          ],
        })),
      },
    });

    await planDocumentStructure('strategy report', OUTLINE, { orgId: 'org-1' });

    const callArgs = mockLlmCall.mock.calls[0][0];
    const systemPrompt: string =
      callArgs?.messages?.find?.((m: any) => m.role === 'system')?.content ??
      callArgs?.system ??
      JSON.stringify(callArgs);
    expect(systemPrompt).toMatch(/answer.first/i);
  });
});
