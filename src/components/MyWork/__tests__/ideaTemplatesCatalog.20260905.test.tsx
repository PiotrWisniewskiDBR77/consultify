/**
 * Katalog szablonów idei — pomiar na żywo 05.09 (`idea-templates-catalog`).
 *
 * Zatwierdzony obraz: ~40 szablonów w 7 NAZWANYCH kategoriach (Strategia ·
 * Operacje/Lean · Finanse · Cyfryzacja/AI · Ludzie/Zmiana · Klient/Wzrost ·
 * PMO), karta z opisem oraz plakietkami sekcji/kolumn. Aplikacja rysowała
 * płaską siatkę bez nagłówków kategorii i bez plakietek — mimo że dane
 * (`catalogGroup` na każdym szablonie) leżały w repozytorium od początku.
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  CONSULTING_CATEGORY_LABELS,
  CONSULTING_CATEGORY_ORDER,
  CONSULTING_TEMPLATES,
  CONSULTING_TEMPLATES_BY_GROUP,
} from '../ideaConsultingTemplates';
import { summarizeIdeaTemplateSeed } from '../ideaTemplateSeedSummary';
import { IdeaTemplateGallery } from '../IdeaTemplateGallery';

// Tłumaczenia czytamy z REALNEGO pliku pl, a nie z atrapy zwracającej klucz:
// klucz może istnieć i trzymać angielskie słowo (osiemnasty kształt fałszywego
// „gotowe"), a licznik „9 sekcji" jest formą mnogą, której atrapa nie odtworzy.
vi.mock('react-i18next', async () => {
  const pl = (await import('../../../../public/locales/pl/translation.json')).default as any;
  // Reguła mnogości i18next dla polskiego (one / few / many).
  const plural = (count: number): 'one' | 'few' | 'many' => {
    if (count === 1) return 'one';
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'few';
    return 'many';
  };
  const lookup = (key: string): any =>
    key.split('.').reduce<any>((node, part) => (node == null ? node : node[part]), pl);
  return {
    useTranslation: () => ({
      t: (key: string, arg?: any) => {
        const count = arg && typeof arg === 'object' ? arg.count : undefined;
        const resolved =
          typeof count === 'number' ? lookup(`${key}_${plural(count)}`) : lookup(key);
        if (typeof resolved === 'string') {
          return typeof count === 'number'
            ? resolved.replace('{{count}}', String(count))
            : resolved;
        }
        if (typeof arg === 'string') return arg;
        if (arg && typeof arg === 'object' && 'defaultValue' in arg) return arg.defaultValue;
        return key;
      },
      i18n: { language: 'pl' },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    Trans: ({ children }: any) => children,
  };
});

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

describe('katalog szablonów konsultingowych — dane', () => {
  it('ma około 40 szablonów rozdzielonych na 7 nazwanych kategorii', () => {
    expect(CONSULTING_CATEGORY_ORDER).toHaveLength(7);
    expect(CONSULTING_TEMPLATES.length).toBeGreaterThanOrEqual(38);
    expect(CONSULTING_TEMPLATES.length).toBeLessThanOrEqual(45);

    // Każdy szablon należy do dokładnie jednej z siedmiu kategorii.
    for (const template of CONSULTING_TEMPLATES) {
      expect(CONSULTING_CATEGORY_ORDER).toContain(template.catalogGroup as any);
    }
    // Żadna kategoria nie jest pusta — inaczej nagłówek by zniknął.
    for (const category of CONSULTING_CATEGORY_ORDER) {
      expect(CONSULTING_TEMPLATES_BY_GROUP[category].length).toBeGreaterThan(0);
      expect(CONSULTING_CATEGORY_LABELS[category].pl).toBeTruthy();
    }
  });

  it('liczy kształt seeda z realnych węzłów, nie z osobnego pola opisowego', () => {
    const bmc = CONSULTING_TEMPLATES.find((entry) => entry.id === 'cx-bmc');
    expect(bmc).toBeTruthy();
    const summary = summarizeIdeaTemplateSeed(bmc!);
    // Business Model Canvas = 9 bloków (ramek) na tablicy.
    expect(summary.counts).toEqual([{ count: 9, unit: 'sections' }]);
    expect(summary.chips.length).toBe(9);

    // Tabela liczy kolumny ORAZ wiersze.
    const anyTable = CONSULTING_TEMPLATES.find((entry) => entry.tool === 'table');
    expect(anyTable).toBeTruthy();
    const tableSummary = summarizeIdeaTemplateSeed(anyTable!);
    expect(tableSummary.counts.map((entry) => entry.unit)).toEqual(['columns', 'rows']);
    expect(tableSummary.chips.length).toBe(tableSummary.counts[0].count);
  });

  it('nie zmyśla liczników dla pustego seeda', () => {
    expect(summarizeIdeaTemplateSeed({ tool: 'whiteboard', nodes: [], extensions: {} })).toEqual({
      counts: [],
      chips: [],
    });
  });
});

describe('IdeaTemplateGallery — układ katalogu', () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    onApplied: vi.fn(),
    ideaId: 'idea-1',
    activeTool: 'whiteboard' as const,
    baseVersion: 1,
    existingNodeCount: 0,
  };

  it('grupuje szablony pod nazwanymi nagłówkami kategorii', () => {
    render(<IdeaTemplateGallery {...baseProps} />);

    // Kategorie, które mają szablony tablicowe, muszą mieć własny nagłówek.
    const strategy = screen.getByRole('heading', { name: 'Strategia' });
    expect(strategy).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Operacje / Lean' })).toBeTruthy();

    // Nagłówek jest nagłówkiem SEKCJI, a nie luźnym napisem nad siatką.
    const section = screen.getByRole('region', { name: 'Strategia' });
    expect(within(section).getByText('Business Model Canvas')).toBeTruthy();
    // …i szablon z innej kategorii NIE leży w tej sekcji.
    expect(within(section).queryByText('Value Stream Mapping (VSM)')).toBeNull();
  });

  it('pokazuje na karcie licznik sekcji i plakietki nazw', () => {
    render(<IdeaTemplateGallery {...baseProps} />);
    const section = screen.getByRole('region', { name: 'Strategia' });
    // Licznik seeda z realnych ramek Business Model Canvas.
    expect(within(section).getAllByText('9 sekcji').length).toBeGreaterThan(0);
    // Plakietki = nazwy bloków frameworka.
    expect(within(section).getAllByText('Key Partners').length).toBeGreaterThan(0);
  });
});
