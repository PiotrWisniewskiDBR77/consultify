// @vitest-environment node
/**
 * W10.2 (seeding) — starterTemplates: katalog startowy + resolvery first-run.
 */
import { describe, expect, it } from 'vitest';
import {
  STARTER_TEMPLATES,
  STARTER_TEMPLATE_COUNT,
  getStarterTemplate,
  startersForFormat,
  startersByTag,
  firstRunSeedPlan,
} from '../../../server/src/services/deliverables/starterTemplates';
import { isThemeId } from '../../../server/src/services/deliverables/themeRegistry';

describe('W10.2 — katalog starterów', () => {
  it('ma ≥5 szablonów z unikalnymi id', () => {
    expect(STARTER_TEMPLATE_COUNT).toBeGreaterThanOrEqual(5);
    const ids = STARTER_TEMPLATES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('każdy szablon ma komplet pól + recommendedTheme z themeRegistry', () => {
    for (const s of STARTER_TEMPLATES) {
      expect(s.title, s.id).toBeTruthy();
      expect(s.description, s.id).toBeTruthy();
      expect(s.briefSkeleton.length, s.id).toBeGreaterThan(20);
      expect(s.tags.length, s.id).toBeGreaterThan(0);
      expect(isThemeId(s.recommendedTheme), `${s.id} theme`).toBe(true);
    }
  });

  it('briefSkeleton ma placeholdery {{...}} do uzupełnienia', () => {
    for (const s of STARTER_TEMPLATES) {
      expect(s.briefSkeleton, s.id).toMatch(/\{\{.+?\}\}/);
    }
  });

  it('pokrywa kluczowe formaty (bundle/deck/doc/sheet)', () => {
    const formats = new Set(STARTER_TEMPLATES.map((s) => s.format));
    expect(formats.has('bundle')).toBe(true);
    expect(formats.has('deck')).toBe(true);
    expect(formats.has('doc')).toBe(true);
    expect(formats.has('sheet')).toBe(true);
  });
});

describe('W10.2 — resolvery', () => {
  it('getStarterTemplate po id', () => {
    expect(getStarterTemplate('investor_business_plan')?.format).toBe('bundle');
    expect(getStarterTemplate('nieistnieje')).toBeNull();
  });

  it('startersForFormat filtruje', () => {
    const decks = startersForFormat('deck');
    expect(decks.length).toBeGreaterThan(0);
    expect(decks.every((s) => s.format === 'deck')).toBe(true);
  });

  it('startersByTag (case-insensitive)', () => {
    const ai = startersByTag('AI');
    expect(ai.length).toBeGreaterThan(0);
    expect(ai.some((s) => s.id === 'ai_readiness_diagnosis')).toBe(true);
    expect(startersByTag('')).toEqual([]);
  });
});

describe('W10.2 — firstRunSeedPlan', () => {
  it('bez hinta → featured = wiązki, all = wszystkie', () => {
    const plan = firstRunSeedPlan();
    expect(plan.all.length).toBe(STARTER_TEMPLATE_COUNT);
    expect(plan.featured.every((s) => s.format === 'bundle')).toBe(true);
    expect(plan.featured.length).toBeGreaterThan(0);
  });

  it('z hintem branżowym → featured dopasowane tagiem', () => {
    const plan = firstRunSeedPlan('sprzedaż');
    expect(plan.featured.some((s) => s.id === 'client_proposal')).toBe(true);
  });

  it('hint bez dopasowania → fallback na wiązki', () => {
    const plan = firstRunSeedPlan('xyz-nieznana-branża');
    expect(plan.featured.every((s) => s.format === 'bundle')).toBe(true);
  });
});
