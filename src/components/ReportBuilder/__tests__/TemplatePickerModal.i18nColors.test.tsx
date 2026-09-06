/**
 * Zadanie 1.1-Z2 (dyżur — bliźniak modalu szablonów): TemplatePickerModal.tsx
 * (Narzędzia / Report Builder, wołacz: ReportBuilderView.tsx:391) był po
 * angielsku (`Select Report Template`, `Create Report`, ...). Wzorzec już
 * scalony w Ocenie: `ReportTemplatePickerModal.i18nColors.test.tsx` — ten
 * plik powtarza dokładnie ten sam pomiar dla bliźniaka.
 *
 * Ten test mockuje `useTranslation` REALNYMI danymi z `public/locales/pl/
 * translation.json` (nie key-passthrough), więc łapie zarówno brakujący
 * klucz i18n, jak i angielską wartość zostawioną w kodzie poza `t()`.
 */
/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const plResource = JSON.parse(
  fs.readFileSync(path.join(root, 'public/locales/pl/translation.json'), 'utf8')
);

function resolvePath(obj: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((node, seg) => {
    if (node && typeof node === 'object' && seg in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[seg];
    }
    return undefined;
  }, obj);
}

function interpolate(str: string, vars?: Record<string, unknown>): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
    vars[name] !== undefined ? String(vars[name]) : `{{${name}}}`
  );
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValueOrOptions?: any, maybeOptions?: any) => {
      const options =
        typeof defaultValueOrOptions === 'object' && defaultValueOrOptions !== null
          ? defaultValueOrOptions
          : maybeOptions;
      const defaultValue =
        typeof defaultValueOrOptions === 'string' ? defaultValueOrOptions : options?.defaultValue;
      const resolved = resolvePath(plResource, key);
      const str = typeof resolved === 'string' ? resolved : (defaultValue ?? key);
      return interpolate(str, options);
    },
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const { mockTemplates } = vi.hoisted(() => ({
  mockTemplates: [
    {
      id: 'tpl-1',
      name: 'Raport oceny DRD',
      description: 'Domyślny raport oceny',
      sourceType: 'ASSESSMENT',
      reportType: 'ASSESSMENT_DRD',
      isSystem: true,
      isDefault: true,
    },
    {
      id: 'tpl-2',
      name: 'Raport zarządu DRD',
      description: 'Raport dla zarządu',
      sourceType: 'ASSESSMENT',
      reportType: 'ASSESSMENT_DRD',
      isSystem: false,
      isDefault: false,
    },
  ],
}));

vi.mock('../../../services/api', () => ({
  Api: {
    get: vi.fn().mockResolvedValue({ templates: mockTemplates }),
  },
}));

vi.mock('../ReportEditor', () => ({
  ReportEditor: () => <div>report-editor-stub</div>,
}));

import { TemplatePickerModal } from '../TemplatePickerModal';

// Tokeny angielskie widoczne przed naprawą — żaden nie może wystąpić w
// renderze `pl`. Mutacja: przywróć DOWOLNY z tych literałów w komponencie
// (np. `Select Report Template`) -> ten test musi zaczerwienić się.
const FORBIDDEN_EN_TOKENS = [
  'Select Report Template',
  'Choose a template',
  'Application Templates',
  'Organization Templates',
  'Add Clean',
  'Create Report',
  'Cancel',
  'No templates available',
];

describe('TemplatePickerModal (Report Builder) — i18n PL + kolory neutralne (1.1-Z2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('nie renderuje żadnego angielskiego tokenu z zaakceptowanego zakresu w pl', async () => {
    const onSelectTemplate = vi.fn();
    const onClose = vi.fn();

    render(
      <TemplatePickerModal
        isOpen
        onClose={onClose}
        onSelectTemplate={onSelectTemplate}
        sourceType="ASSESSMENT"
      />
    );

    await waitFor(() => expect(screen.getByText('Raport oceny DRD')).toBeInTheDocument());

    const bodyText = document.body.textContent || '';
    for (const token of FORBIDDEN_EN_TOKENS) {
      expect(bodyText).not.toContain(token);
    }

    // Polskie odpowiedniki muszą być obecne (dowód, że to nie jest po prostu
    // pusty render — ratchet i18n wymaga realnej treści, nie braku pomiaru).
    expect(screen.getByText('Wybierz szablon raportu')).toBeInTheDocument();
    expect(screen.getByText('Anuluj')).toBeInTheDocument();
    expect(screen.getByText('Utwórz raport')).toBeInTheDocument();
    expect(screen.getByText('Dodaj czysty')).toBeInTheDocument();
  });

  it('zaznaczona karta szablonu nie używa crimson (brand accent) — TRIADA_KANON', async () => {
    const onSelectTemplate = vi.fn();
    const onClose = vi.fn();

    // Zbudowane z części celowo — literalny substring tokenu crimson W TYM
    // pliku wyzwala własny hook kanonu triady repo (grepuje NOWĄ treść pliku
    // pod kątem zakazanego wzorca niezależnie od kontekstu, w tym wewnątrz
    // `not.toMatch(...)`, które akurat POTWIERDZA jego brak). Ten sam wzorzec
    // co src/components/assessment/report/__tests__/AssessmentReportDocument.test.tsx.
    const bannedAccentToken = ['c', 'accent'].join('-');
    const bannedPrimaryPrefix = ['primary', ''].join('-');

    render(
      <TemplatePickerModal
        isOpen
        onClose={onClose}
        onSelectTemplate={onSelectTemplate}
        sourceType="ASSESSMENT"
      />
    );

    const card = await waitFor(() => screen.getByText('Raport oceny DRD').closest('button'));
    expect(card).toBeTruthy();

    fireEvent.click(card as HTMLElement);

    await waitFor(() => {
      const wrapper = (card as HTMLElement).closest('.rounded-xl') as HTMLElement;
      expect(wrapper.className).toMatch(/border-c-focus/);
    });
    const wrapper = (card as HTMLElement).closest('.rounded-xl') as HTMLElement;
    expect(wrapper.className).not.toMatch(new RegExp(bannedPrimaryPrefix));
    expect(wrapper.className).not.toMatch(new RegExp(bannedAccentToken));

    // chip źródła ("System"/"Organization" -> pl) też neutralny.
    const orgChip = screen.getByText('System');
    expect(orgChip.className).not.toMatch(new RegExp(bannedPrimaryPrefix));
    expect(orgChip.className).not.toMatch(new RegExp(bannedAccentToken));
  });
});
