import { describe, expect, it } from 'vitest';

import { DEDICATED_TOOL_TYPES } from '@/components/DiscoveryTools/dedicatedToolTypes';
import { validateAll } from '../validator';
import { TOOL_PACKS, getToolPack } from '../registry';

/**
 * Test kontraktowy registry ↔ roster.
 * Roster kanoniczny = 31 narzędzi z żywej bazy demo (Gate T0).
 */
describe('rejestr Tool Packów', () => {
  it('pokrywa dokładnie 31 kanonicznych narzędzi', () => {
    expect(TOOL_PACKS).toHaveLength(31);
  });

  it('pokrywa się 1:1 z ToolType (bez dodawania i usuwania narzędzi)', () => {
    const inRegistry = new Set<string>(TOOL_PACKS.map((p) => String(p.toolType)));
    const canonical = new Set<string>(DEDICATED_TOOL_TYPES.map((t) => String(t)));

    const missing = [...canonical].filter((t) => !inRegistry.has(t));
    const extra = [...inRegistry].filter((t) => !canonical.has(t));

    expect(missing, `brak packów dla: ${missing.join(', ')}`).toEqual([]);
    expect(extra, `packi spoza rosteru: ${extra.join(', ')}`).toEqual([]);
  });

  it('nie zawiera duplikatów toolType', () => {
    const ids = TOOL_PACKS.map((p) => p.toolType);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('każdy pack przechodzi walidację', () => {
    const { results } = validateAll(TOOL_PACKS);
    const invalid = results.filter((r) => !r.valid);
    const detail = invalid
      .map((r) => `${r.toolType}: ${r.issues.filter((i) => i.severity === 'error').map((i) => i.field).join(', ')}`)
      .join(' | ');
    expect(invalid, detail).toHaveLength(0);
  });

  // BRAMKA: dopóki DoD runtime nie jest dowiezione, nic nie jest RUNTIME_ACTIVE.
  it('żadne narzędzie nie jest jeszcze RUNTIME_ACTIVE', () => {
    const active = TOOL_PACKS.filter((p) => p.runtimeStatus === 'RUNTIME_ACTIVE');
    expect(active.map((p) => p.toolType)).toEqual([]);
  });

  it('rozdziela stan treści od stanu runtime', () => {
    const { summary } = validateAll(TOOL_PACKS);
    expect(summary.total).toBe(31);
    // 19 packów spisanych z realnych silników (Dynamic SWOT + fala 18)
    expect(summary.packComplete).toBe(19);
    expect(summary.packNotAuthored).toBe(0);
    expect(summary.evidenceMissing).toBe(12); // = dokładnie zbiór coming soon
    // Kompletna treść NIE otwiera runtime — to jest cały sens rozdziału.
    expect(summary.runtimeActive).toBe(0);
    expect(summary.invalid).toBe(0);
  });

  it('19 spisanych packów pokrywa dokładnie narzędzia z silnikiem', () => {
    const complete = TOOL_PACKS.filter((p) => p.contentStatus === 'PACK_COMPLETE');
    expect(complete).toHaveLength(19);
    complete.forEach((p) => {
      expect(p.engine, `${p.toolType} bez wiązania z silnikiem`).toBeDefined();
      expect(p.rights, `${p.toolType} bez rejestru praw`).toBeDefined();
    });
  });

  // Rejestr praw: żadne narzędzie nie może twierdzić, że jest prawnie „free".
  it('żaden pack nie deklaruje „Free" jako statusu prawnego', () => {
    TOOL_PACKS.filter((p) => p.rights).forEach((p) => {
      expect(
        /^free$/i.test(String(p.rights!.commercialUseStatus)),
        `${p.toolType} deklaruje Free`
      ).toBe(false);
      expect(p.rights!.legalReviewStatus).toBe('LEGAL_REVIEW_REQUIRED');
    });
  });

  it('12 narzędzi bez dowodów jest oznaczonych COMING_SOON, nie PENDING', () => {
    const noEvidence = TOOL_PACKS.filter((p) => p.contentStatus === 'EVIDENCE_MISSING');
    expect(noEvidence).toHaveLength(12);
    noEvidence.forEach((p) => {
      expect(p.runtimeStatus, `${p.toolType} musi być COMING_SOON`).toBe('COMING_SOON');
    });
  });

  it('Dynamic SWOT jest kompletnym wzorcem pionowym', () => {
    const pack = getToolPack('dynamic-swot');
    expect(pack).toBeDefined();
    expect(pack!.contentStatus).toBe('PACK_COMPLETE');
    // Kompletna treść NIE czyni narzędzia dostępnym.
    expect(pack!.runtimeStatus).toBe('RUNTIME_PENDING');
    expect(pack!.phases.length).toBeGreaterThanOrEqual(5);
    expect(pack!.questions.length).toBeGreaterThanOrEqual(5);
  });

  it('fazy Dynamic SWOT zgadzają się z id kroków runtime', () => {
    // SWOT_STEPS w src/store/useToolStore.ts:1342
    const runtimeStepIds = ['mission', 'input', 'swot', 'insights', 'outputs'];
    const packPhaseIds = getToolPack('dynamic-swot')!.phases.map((p) => p.id);
    expect(packPhaseIds).toEqual(runtimeStepIds);
  });

  it('każdy pack deklaruje archetyp geometrii sygnaturowej', () => {
    TOOL_PACKS.forEach((p) => {
      expect(p.signatureArchetype, `${p.toolType} bez archetypu`).toBeTruthy();
    });
  });
});
