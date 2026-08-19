/**
 * Menu3Row smoke tests
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  MENU_3_ACTION_DANGER,
  MENU_3_ACTION_NEUTRAL,
  MENU_3_INNER_CLASS,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
  Menu3BulkRow,
} from '../../ModuleMenu3';
import { Menu3Row } from '../Menu3Row';

describe('Menu3Row', () => {
  it('renders left and right slots inside the canonical inner row', () => {
    const { container } = render(
      <Menu3Row left={<span>Preset chips</span>} right={<button>Action</button>} />
    );

    expect(screen.getByText('Preset chips')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();

    const inner = container.firstChild as HTMLElement;
    // Uses the canonical MENU_3 inner / left / right class tokens.
    expect(inner.className).toContain(MENU_3_INNER_CLASS.split(' ')[0]);
    expect(container.innerHTML).toContain(MENU_3_LEFT_CLASS.split(' ')[0]);
    expect(container.innerHTML).toContain(MENU_3_RIGHT_CLASS.split(' ')[0]);
  });

  it('merges extra className onto the inner row', () => {
    const { container } = render(<Menu3Row className="custom-row" left={null} right={null} />);
    expect((container.firstChild as HTMLElement).className).toContain('custom-row');
  });

  it('renders bulk selection and every action in one outlined left cluster', () => {
    const onClear = vi.fn();
    const onDelete = vi.fn();

    render(
      <Menu3BulkRow
        selectedLabel="3 selected"
        onSelectAll={vi.fn()}
        onClear={onClear}
        clearLabel="Clear"
        actions={[
          {
            id: 'delete',
            label: 'Delete',
            onClick: onDelete,
            variant: 'danger',
          },
        ]}
      />
    );

    const selectAll = screen.getByRole('button', { name: 'Select all' });
    const clear = screen.getByRole('button', { name: 'Clear' });
    const deleteButton = screen.getByRole('button', { name: 'Delete' });

    expect(selectAll.parentElement).toBe(clear.parentElement);
    expect(clear.parentElement).toBe(deleteButton.parentElement);
    expect(selectAll.className).toContain(MENU_3_ACTION_NEUTRAL.split(' ')[0]);
    expect(deleteButton.className).toContain(MENU_3_ACTION_DANGER.split(' ')[0]);
    expect(clear.querySelector('svg')).toBeInTheDocument();

    fireEvent.click(clear);
    fireEvent.click(deleteButton);
    expect(onClear).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });
});

/**
 * ── R02-A-FIX · parytet Menu 3 z BulkSelectionCluster (R02-B) ───────────────
 *
 * Audyt R02-A-FINAL-QA wykazał, że dwa kanoniczne klastry bulk wyglądały
 * inaczej przy tej samej operacji. Te testy zamrażają zbieżność, żeby nie
 * rozjechały się ponownie.
 */
describe('R02-A-FIX · parytet klastrów bulk', () => {
  const bulk = (actions: Parameters<typeof Menu3BulkRow>[0]['actions']) =>
    render(
      <Menu3BulkRow
        selectedLabel="3 selected"
        clearLabel="Clear"
        onClear={vi.fn()}
        actions={actions}
      />
    );

  const buttons = () => [
    ...(document.querySelector('[data-menu3-bulk]') as HTMLElement).querySelectorAll('button'),
  ];

  it('geometria: h-8, pigułka, ramka — jak w R02-B', () => {
    bulk([{ id: 'a', label: 'Archive', onClick: vi.fn() }]);
    for (const button of buttons()) {
      expect(button.className).toContain('h-8');
      expect(button.className).toContain('rounded-full');
      expect(button.className).toContain('border');
    }
  });

  it('disabled to 45%, ta sama wartość co R01/R02-B/R03', () => {
    bulk([{ id: 'a', label: 'Archive', onClick: vi.fn(), disabled: true }]);
    const archive = screen.getByRole('button', { name: 'Archive' });
    expect(archive).toBeDisabled();
    expect(archive.className).toContain('disabled:opacity-45');
    // Stare, lokalne nadpisanie 40% zniknęło.
    expect(archive.className).not.toContain('opacity-40');
  });

  it('focus jest tokenem, nie zakodowanym błękitem', () => {
    bulk([{ id: 'a', label: 'Archive', onClick: vi.fn() }]);
    for (const button of buttons()) {
      expect(button.className).toContain('ring-c-focus');
      expect(button.className).not.toContain('blue-500');
    }
  });

  it('neutral jest outline, nie wypełniony', () => {
    bulk([{ id: 'a', label: 'Archive', onClick: vi.fn() }]);
    const archive = screen.getByRole('button', { name: 'Archive' });
    expect(archive.className).not.toContain('bg-slate-100');
    expect(archive.className).toContain('border-c-border-subtle');
  });

  it('danger ZAWSZE na końcu, choćby ekran podał go pierwszego', () => {
    bulk([
      { id: 'del', label: 'Delete', onClick: vi.fn(), variant: 'danger' },
      { id: 'arch', label: 'Archive', onClick: vi.fn() },
    ]);
    const labels = buttons().map((b) => b.textContent?.trim());
    expect(labels[labels.length - 1]).toBe('Delete');
  });

  it('kolejność akcji neutralnych pozostaje taka, jak podał ekran', () => {
    bulk([
      { id: 'b', label: 'Beta', onClick: vi.fn() },
      { id: 'a', label: 'Alpha', onClick: vi.fn() },
    ]);
    const labels = buttons().map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Clear', 'Beta', 'Alpha']);
  });

  it('Clear jest zawsze obecny, z ikoną X 14 px i etykietą', () => {
    bulk([{ id: 'a', label: 'Archive', onClick: vi.fn() }]);
    const clear = document.querySelector('[data-menu3-clear]') as HTMLElement;
    expect(clear).toBeInTheDocument();
    expect(clear.textContent).toContain('Clear');
    expect(clear.querySelector('svg')?.getAttribute('width')).toBe('14');
  });

  it('tylko danger jest czerwony', () => {
    bulk([
      { id: 'arch', label: 'Archive', onClick: vi.fn() },
      { id: 'del', label: 'Delete', onClick: vi.fn(), variant: 'danger' },
    ]);
    const red = buttons().filter((b) => b.className.includes('danger'));
    expect(red.map((b) => b.textContent?.trim())).toEqual(['Delete']);
  });

  it('żadna pozycja nie jest atrapą bez handlera', () => {
    const onClick = vi.fn();
    bulk([{ id: 'a', label: 'Archive', onClick }]);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

/**
 * ── R02-A-FIX-2 · migracja 6 klastrów bulk w InterviewHub ───────────────────
 *
 * Audyt R02-A-FINAL-QA wykazał, że InterviewHub składał klastry bulk RĘCZNIE —
 * `<div className={MENU_3_ROW_CLASS}>` + gołe `<button className={
 * MENU_3_ACTION_NEUTRAL}>` — obok 27 poprawnych użyć prymitywu. Ręczny klaster
 * nie ma żadnego wymuszenia anatomii: kolejność i wariant zależały wyłącznie od
 * tego, jak akurat ułożono JSX.
 *
 * Te testy czytają ŹRÓDŁO huba, bo nie da się zmontować InterviewHuba w jsdom
 * (routing, i18n, ~40 zapytań sieciowych). Dowód strukturalny jest tu mocniejszy
 * niż render: sprawdza WSZYSTKIE 6 klastrów naraz, a nie jedną ścieżkę, którą
 * akurat udało się wyrenderować.
 */
describe('R02-A-FIX-2 · InterviewHub · 6 klastrów bulk', () => {
  const hubSource = readFileSync(
    resolve(__dirname, '../../../Interview/InterviewHub.tsx'),
    'utf8'
  );

  /*
   * Same klastry, wycięte ze źródła. Asercje MUSZĄ celować w nie, a nie w cały
   * plik: `variant: 'danger'` i `comingSoonBackend` żyją legalnie w menu
   * wierszowych (teren R01) i w kartach — pierwsza wersja tych testów tego nie
   * rozróżniała i czerwieniała na cudzym, poprawnym kodzie.
   */
  const bulkRows = hubSource.match(/<Menu3BulkRow[\s\S]*?\n\s*\/>/g) ?? [];

  it('dokładnie 6 klastrów przeszło na prymityw', () => {
    expect(hubSource.match(/<Menu3BulkRow/g)).toHaveLength(6);
    expect(bulkRows).toHaveLength(6);
  });

  it('nie został ANI JEDEN ręcznie składany przycisk bulk', () => {
    // Stała stylu akcji nie jest już nawet importowana — gdyby wróciła choć
    // jedna ręczna `<button className={MENU_3_ACTION_…}>`, ten test czerwienieje,
    // zanim ktokolwiek zobaczy rozjechany klaster na ekranie.
    const importBlock = hubSource.slice(
      hubSource.indexOf('} from '),
      hubSource.indexOf("} from '@/components/shared/ModuleMenu3'")
    );
    expect(importBlock).not.toContain('MENU_3_ACTION_');
    for (const row of bulkRows) {
      expect(row).not.toContain('MENU_3_ACTION_');
      expect(row).not.toContain('<button');
    }
  });

  it('każdy klaster ma etykietę „N selected" i Clear', () => {
    expect(hubSource.match(/selectedLabel=\{`\$\{selectedCount\}/g)).toHaveLength(6);
    expect(hubSource.match(/clearLabel=\{t\('interview\.hub\.clear'\)\}/g)).toHaveLength(6);
    expect(hubSource.match(/onClear=\{\(\) => setSelected/g)).toHaveLength(6);
  });

  it('żadna akcja bulk nie jest atrapą — każda ma handler', () => {
    // Kanon §1: funkcja niezaimplementowana jest POMIJANA, nie pokazywana jako
    // wyszarzony przycisk z „Coming soon". Klaster Initiatives miał dokładnie
    // taki przycisk (disabled, BEZ onClick) — R02-A-FIX-2 go usuwa. Poza
    // klastrami `comingSoonBackend` zostaje: to inny teren, nie ten pakiet.
    for (const row of bulkRows) {
      expect(row).not.toContain('comingSoonBackend');
      // Każda pozycja `id:` ma parę `onClick:` w tym samym klastrze.
      const ids = // `id:` bywa też szablonem (`delay-${d}`), więc obie formy cytowania.
      row.match(/\bid: [`']/g) ?? [];
      const clicks = row.match(/\bonClick: /g) ?? [];
      expect(clicks.length).toBe(ids.length);
    }
    // Klastry faktycznie NIOSĄ akcje — inaczej pętla wyżej byłaby pusta i zielona.
    expect(bulkRows.join('').match(/\bid: [`']/g)?.length ?? 0).toBeGreaterThanOrEqual(14);
  });

  it('spinner „w toku" przeżył migrację jako komponent modułowy', () => {
    // `Menu3BulkAction.icon` renderuje `<Icon size={14} />` BEZ className, więc
    // naiwne przeniesienie `<Loader2 className="animate-spin" />` zabiłoby
    // animację — jedyny sygnał, że operacja masowa trwa.
    expect(hubSource).toContain('const BulkBusyIcon = () => <Loader2 size={14} className="animate-spin" />');
    expect(hubSource).toMatch(/icon: \w+Busy \? BulkBusyIcon :/);
  });

  it('operacja nieodwracalna (Trash) jest jedyną akcją bulk oznaczoną jako danger', () => {
    const joined = bulkRows.join('\n');
    expect(joined.match(/variant: 'danger'/g)).toHaveLength(1);
    // Wariant należy do TEGO SAMEGO obiektu akcji co `id: 'trash'`.
    const trashIndex = joined.indexOf("id: 'trash'");
    const dangerIndex = joined.indexOf("variant: 'danger'");
    expect(trashIndex).toBeGreaterThan(-1);
    expect(dangerIndex - trashIndex).toBeGreaterThan(0);
    expect(dangerIndex - trashIndex).toBeLessThan(300);
    // Archiwizacja jest odwracalna — NIE jest czerwona.
    expect(joined).toContain("id: 'archive'");
  });
});

/**
 * ── R02-A-FIX-2 · anatomia wymuszona przez prymityw ─────────────────────────
 *
 * Testy strukturalne wyżej dowodzą, że huby PRZESTAŁY składać klastry ręcznie.
 * Te dowodzą, że przejście na prymityw faktycznie coś DAJE — że anatomia jest
 * wymuszona, a nie tylko przeniesiona w inne miejsce.
 */
describe('R02-A-FIX-2 · prymityw wymusza anatomię', () => {
  it('danger ląduje na końcu, nawet gdy ekran wstawi go w środek', () => {
    render(
      <Menu3BulkRow
        selectedLabel="4 selected"
        clearLabel="Clear"
        onClear={vi.fn()}
        actions={[
          { id: 'archive', label: 'Archive', onClick: vi.fn() },
          { id: 'trash', label: 'Trash', onClick: vi.fn(), variant: 'danger' },
          { id: 'export', label: 'Export', onClick: vi.fn() },
        ]}
      />
    );
    const labels = [
      ...(document.querySelector('[data-menu3-bulk]') as HTMLElement).querySelectorAll('button'),
    ].map((b) => b.textContent?.trim());
    // Clear pierwszy, neutralne w kolejności ekranu, danger ostatni.
    expect(labels).toEqual(['Clear', 'Archive', 'Export', 'Trash']);
  });

  it('disabled to 45% i realne `disabled`, nie samo przygaszenie', () => {
    render(
      <Menu3BulkRow
        selectedLabel="1 selected"
        clearLabel="Clear"
        onClear={vi.fn()}
        actions={[{ id: 'approve', label: 'Approve', onClick: vi.fn(), disabled: true }]}
      />
    );
    const approve = screen.getByRole('button', { name: 'Approve' });
    expect(approve).toBeDisabled();
    expect(approve.className).toContain('disabled:opacity-45');
    expect(approve.className).not.toContain('opacity-40');
  });

  it('focus jest tokenem `ring-c-focus` na KAŻDYM przycisku klastra', () => {
    render(
      <Menu3BulkRow
        selectedLabel="2 selected"
        clearLabel="Clear"
        onClear={vi.fn()}
        actions={[
          { id: 'a', label: 'Archive', onClick: vi.fn() },
          { id: 'd', label: 'Delete', onClick: vi.fn(), variant: 'danger' },
        ]}
      />
    );
    for (const button of (
      document.querySelector('[data-menu3-bulk]') as HTMLElement
    ).querySelectorAll('button')) {
      expect(button.className).toContain('ring-c-focus');
    }
  });

  it('kliknięcie każdej akcji woła handler ekranu — zero no-op', () => {
    const onArchive = vi.fn();
    const onTrash = vi.fn();
    const onClear = vi.fn();
    render(
      <Menu3BulkRow
        selectedLabel="3 selected"
        clearLabel="Clear"
        onClear={onClear}
        actions={[
          { id: 'archive', label: 'Archive', onClick: onArchive },
          { id: 'trash', label: 'Trash', onClick: onTrash, variant: 'danger' },
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trash' }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(onArchive).toHaveBeenCalledOnce();
    expect(onTrash).toHaveBeenCalledOnce();
  });
});

/**
 * ── R02-A-FIX · Menu 2 bez liczników ────────────────────────────────────────
 */
describe('R02-A-FIX · Menu 2 nie pokazuje liczników', () => {
  it('prymitywy Menu 3 nie eksponują licznika w klasie akcji', () => {
    // Liczniki należą WYŁĄCZNIE do chipów Menu 3 (Menu3Badge), nigdy do
    // zakładek Menu 2 (§3 Zakazy). Klasa akcji nie ma nic wspólnego z licznikiem.
    expect(MENU_3_ACTION_NEUTRAL).not.toContain('badge');
    expect(MENU_3_ACTION_DANGER).not.toContain('badge');
  });
});
