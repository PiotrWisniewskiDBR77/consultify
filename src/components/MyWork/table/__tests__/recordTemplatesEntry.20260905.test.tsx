/**
 * Wejście do menedżera szablonów REKORDU — pomiar na żywo 05.09
 * (`idea-table-record-templates`).
 *
 * Zmierzony objaw: „menedżera szablonów rekordu nie udało się otworzyć
 * klikaniem"; pozycja „Szablony" w „Więcej narzędzi" otwierała galerię
 * szablonów TABEL, a rozwijana strzałka przy „Wiersz" — popover „SZABLON
 * WIERSZA" ze stałą listą typów. Trzy różne rzeczy pod prawie tą samą nazwą.
 *
 * Zmierzona przyczyna (nie ta z hipotezy): komponent NIE był martwym
 * montażem — RISK-06 podłączył go wcześniej i do dziś jest importowany oraz
 * renderowany w IdeaTableTool. Pozycja menu była UKRYTA warunkiem
 * `show: usePlatform`, bo tabela działała na silniku zastanym.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { Copy, LayoutTemplate } from 'lucide-react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  TableBarOverflowMenu,
  type TableBarOverflowSection,
} from '../TableBarOverflowMenu';

function buildSections(usePlatform: boolean, onRecordTemplates: () => void) {
  const sections: TableBarOverflowSection[] = [
    {
      id: 'more',
      heading: 'Więcej',
      items: [
        {
          id: 'templates',
          label: 'Szablony tabeli',
          icon: LayoutTemplate,
          onClick: vi.fn(),
          show: true,
        },
        {
          id: 'record-templates',
          label: 'Szablony rekordów',
          icon: Copy,
          onClick: onRecordTemplates,
          show: true,
          disabled: !usePlatform,
          disabledReason: 'Szablony rekordów wymagają tabeli platformowej.',
          testId: 'idea-table-overflow-record-templates',
        },
      ],
    },
  ];
  return sections;
}

describe('„Więcej narzędzi" — szablony rekordów vs szablony tabeli', () => {
  it('pokazuje OBIE pozycje pod rozróżnialnymi nazwami', () => {
    render(
      <TableBarOverflowMenu sections={buildSections(true, vi.fn())} title="Więcej narzędzi" />
    );
    fireEvent.click(screen.getByLabelText('Więcej narzędzi'));

    expect(screen.getByText('Szablony tabeli')).toBeTruthy();
    expect(screen.getByText('Szablony rekordów')).toBeTruthy();
    // Kolizja nazw zniknęła: nie ma już gołego „Szablony".
    expect(screen.queryByText('Szablony')).toBeNull();
  });

  it('w trybie platformowym pozycja otwiera menedżera szablonów rekordu', () => {
    const onRecordTemplates = vi.fn();
    render(
      <TableBarOverflowMenu
        sections={buildSections(true, onRecordTemplates)}
        title="Więcej narzędzi"
      />
    );
    fireEvent.click(screen.getByLabelText('Więcej narzędzi'));
    const item = screen.getByTestId('idea-table-overflow-record-templates');
    expect(item).not.toBeDisabled();
    fireEvent.click(item);
    expect(onRecordTemplates).toHaveBeenCalledTimes(1);
  });

  it('poza trybem platformowym pozycja JEST widoczna, ale wyszarzona z powodem', () => {
    const onRecordTemplates = vi.fn();
    render(
      <TableBarOverflowMenu
        sections={buildSections(false, onRecordTemplates)}
        title="Więcej narzędzi"
      />
    );
    fireEvent.click(screen.getByLabelText('Więcej narzędzi'));
    const item = screen.getByTestId('idea-table-overflow-record-templates');
    // Ukrycie czyta się jak brak funkcji — pozycja ma być widoczna…
    expect(item).toBeTruthy();
    // …ale nieklikalna, z jawnym powodem, a nie martwym handlerem.
    expect(item).toBeDisabled();
    expect(item.getAttribute('title')).toContain('platformow');
    fireEvent.click(item);
    expect(onRecordTemplates).not.toHaveBeenCalled();
  });
});

describe('IdeaTableTool — realne podłączenie pozycji', () => {
  it('menedżer szablonów rekordu jest zaimportowany, zamontowany i wołany z menu', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.resolve(__dirname, '../../IdeaTableTool.tsx'), 'utf8');

    expect(source).toContain("import { RecordTemplateManager } from './table/RecordTemplateManager'");
    expect(source).toContain('<RecordTemplateManager');
    expect(source).toContain('setShowRecordTemplateManager(true)');
    // Pozycja NIE jest już ukrywana warunkiem trybu — jest wyszarzana z powodem.
    // To był zmierzony defekt, więc pilnujemy DOKŁADNIE tej pary, a nie samej
    // obecności napisu „disabledReason" gdziekolwiek w pliku.
    const entry = source.slice(
      source.indexOf("id: 'record-templates'"),
      source.indexOf("testId: 'idea-table-overflow-record-templates'")
    );
    expect(entry).toContain('show: true');
    expect(entry).toContain('disabled: !usePlatform');
    expect(entry).toContain("'ideas.table.recordTemplates.requiresPlatformTable'");
    // Sąsiednia pozycja ma własną, rozróżnialną etykietę.
    expect(source).toContain("label: t('ideas.table.tableTemplates'");
  });

  it('obie etykiety istnieją w pl i naprawdę są po polsku', async () => {
    const pl = (await import('../../../../../public/locales/pl/translation.json')).default as any;
    expect(pl.ideas.table.tableTemplates).toBe('Szablony tabeli');
    expect(pl.ideas.table.recordTemplates.recordTemplatesTitle).toBe('Szablony rekordów');
    expect(pl.ideas.table.recordTemplates.requiresPlatformTable).toMatch(/platformow/i);
  });
});
