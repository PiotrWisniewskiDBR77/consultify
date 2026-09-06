/**
 * MVP 1.1-O4 (06.09.2026): modal wyboru szablonu raportu w Ocenie
 * (Ocena → Raporty → „Nowy raport") był po angielsku (P3) i zaznaczony
 * kafel/chip „org" miał kolor crimson (`primary-*` = #85182F, TRIADA_KANON
 * zakazuje crimson jako neutralnego stanu zaznaczenia — P6).
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
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
      reportType: 'ASSESSMENT_DRD',
      isSystem: true,
      isDefault: true,
    },
    {
      id: 'tpl-2',
      name: 'Raport zarządu DRD',
      description: 'Raport dla zarządu',
      reportType: 'ASSESSMENT_DRD',
      isSystem: false,
      isDefault: false,
    },
  ],
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn().mockResolvedValue({ templates: mockTemplates }),
  },
}));

vi.mock('@/components/ReportBuilder/ReportEditor', () => ({
  ReportEditor: () => <div>report-editor-stub</div>,
}));

import { ReportTemplatePickerModal } from '../ReportTemplatePickerModal';

// Tokeny angielskie widoczne na zrzucie właściciela (06.09 15:26) — żaden nie
// może wystąpić w renderze `pl`. Mutacja: przywróć DOWOLNY z tych literałów
// (np. `Select Report Template`) w komponencie -> ten test musi zaczerwienić się.
const FORBIDDEN_EN_TOKENS = [
  'Select Report Template',
  'available templates',
  'Recipient',
  'New Template',
  'Generate Report',
  'Cancel',
  'Double-click',
];

describe('ReportTemplatePickerModal — i18n PL + kolory neutralne (1.1-O4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('nie renderuje żadnego angielskiego tokenu z zaakceptowanego zakresu w pl', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <ReportTemplatePickerModal isOpen onClose={onClose} onSelect={onSelect} sourceType="ASSESSMENT" />
    );

    await waitFor(() => expect(screen.getByText('Raport oceny DRD')).toBeInTheDocument());

    const bodyText = document.body.textContent || '';
    for (const token of FORBIDDEN_EN_TOKENS) {
      expect(bodyText).not.toContain(token);
    }

    // Polskie odpowiedniki muszą być obecne (dowód, że to nie jest po prostu
    // pusty render — ratchet i18n wymaga realnej treści, nie braku pomiaru).
    expect(screen.getByText('Wybierz szablon raportu')).toBeInTheDocument();
    expect(screen.getByText(/dostępnych szablonów/)).toBeInTheDocument();
    expect(screen.getByText('Anuluj')).toBeInTheDocument();
    expect(screen.getByText('Generuj raport')).toBeInTheDocument();
  });

  it('zaznaczony kafel szablonu nie używa klasy `primary-` (crimson) — TRIADA_KANON', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <ReportTemplatePickerModal isOpen onClose={onClose} onSelect={onSelect} sourceType="ASSESSMENT" />
    );

    const card = await waitFor(() => screen.getByText('Raport oceny DRD').closest('button'));
    expect(card).toBeTruthy();

    fireEvent.click(card as HTMLElement);

    await waitFor(() => {
      expect((card as HTMLElement).className).toMatch(/border-c-focus/);
    });
    expect((card as HTMLElement).className).not.toMatch(/primary-/);

    // chip źródła ("app"/"org" -> "aplikacji"/"organizacji") też neutralny.
    const orgChip = screen.getByText('organizacji');
    expect(orgChip.className).not.toMatch(/primary-/);
  });
});
