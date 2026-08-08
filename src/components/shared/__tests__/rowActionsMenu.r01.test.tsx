/**
 * R01 — testy jednego renderera menu wiersza (KEBAB + PPM).
 *
 * Kontrakt: `MY_WORK_TABLE_SURFACE_CONTRACT_V1.md` §7 (Kebab), §8 (PPM), §9
 * (focus/kolor/viewport). Liczby biorą się z `src/contracts/tableSurface/canon.ts`
 * (pakiet R00), żeby test i implementacja nie mogły rozjechać się po cichu.
 *
 * OGRANICZENIE DOWODOWE: jsdom nie liczy layoutu — `getBoundingClientRect`
 * zwraca zera, `offsetHeight` zero. Dlatego geometria jest tu dowodzona przez
 * KLASY i style inline, które ją ustalają, a nie przez zmierzone piksele.
 * Wymiar w pikselach domyka dowód wizualny G3/G4 na 1440×900 i 1280×720.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  czyAtrapa,
  normalizeZones,
  type RowAction,
  type RowActionSection,
  RowActionsMenu,
} from '@/components/shared/RowActionsMenu';
import {
  CANON_HEIGHT,
  CANON_HIT_TARGET,
  CANON_ICON,
  CANON_ROW_MENU,
} from '@/contracts/tableSurface/canon';

const noop = () => undefined;

const action = (id: string, label: string, extra: Partial<RowAction> = {}): RowAction => ({
  id,
  label,
  onClick: noop,
  ...extra,
});

/** Sekcje w siedmiu legacy rodzajach — wejście, które dawało defekt T01-KEBAB-K04. */
const legacySevenKinds: RowActionSection[] = [
  { id: 's1', kind: 'open', actions: [action('open', 'Open')] },
  { id: 's2', kind: 'ai', actions: [action('ai-summary', 'Summarise')] },
  { id: 's3', kind: 'convert', actions: [action('to-initiative', 'To initiative')] },
  { id: 's4', kind: 'output', actions: [action('export', 'Export')] },
  { id: 's5', kind: 'manage', actions: [action('edit', 'Edit')] },
  { id: 's6', kind: 'danger', actions: [action('delete', 'Delete', { variant: 'danger' })] },
];

const openKebab = () => fireEvent.click(screen.getByLabelText('Row actions'));
const panel = () => document.querySelector('[role="menu"]') as HTMLElement;
const itemButtons = () =>
  [...panel().querySelectorAll('button[role="menuitem"]')] as HTMLButtonElement[];
const labels = () => itemButtons().map((b) => b.textContent?.trim());

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── Strefy i separatory (§7) ────────────────────────────────────────────────

describe('R01 · strefy context → manage → danger', () => {
  it('składa siedem legacy rodzajów sekcji w dokładnie trzy strefy', () => {
    const zones = normalizeZones(legacySevenKinds);
    expect(zones.map((z) => z.zone)).toEqual(['context', 'manage', 'danger']);
  });

  it('mapuje ai/convert/output do manage, nie do własnych stref (§10)', () => {
    const zones = normalizeZones(legacySevenKinds);
    const manage = zones.find((z) => z.zone === 'manage')!;
    expect(manage.actions.map((a) => a.id)).toEqual([
      'ai-summary',
      'to-initiative',
      'export',
      'edit',
    ]);
  });

  it('renderuje najwyżej dwa separatory (defekt T01-KEBAB-K04, P0)', () => {
    render(<RowActionsMenu sections={legacySevenKinds} />);
    openKebab();
    const separators = panel().querySelectorAll(':scope > .border-t');
    expect(separators.length).toBe(2);
    expect(separators.length).toBeLessThanOrEqual(CANON_ROW_MENU.separatorsMax);
  });

  it('pusta strefa znika razem ze swoim separatorem', () => {
    render(
      <RowActionsMenu
        sections={[
          { id: 'm', kind: 'manage', actions: [action('edit', 'Edit')] },
          { id: 'd', kind: 'danger', actions: [action('delete', 'Delete', { variant: 'danger' })] },
        ]}
      />
    );
    openKebab();
    // Brak strefy context → 2 strefy, 1 separator (§7).
    expect(panel().querySelectorAll(':scope > .border-t').length).toBe(1);
  });

  it('danger jest zawsze ostatni, niezależnie od kolejności wejścia', () => {
    render(
      <RowActionsMenu
        sections={[
          { id: 'd', kind: 'danger', actions: [action('delete', 'Delete', { variant: 'danger' })] },
          { id: 'c', kind: 'context', actions: [action('open', 'Open')] },
        ]}
      />
    );
    openKebab();
    expect(labels()[labels().length - 1]).toBe('Delete');
  });

  it('zachowuje kolejność akcji wewnątrz strefy', () => {
    const zones = normalizeZones([
      { id: 'c', kind: 'context', actions: [action('a', 'A'), action('b', 'B'), action('c', 'C')] },
    ]);
    expect(zones[0].actions.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });
});

// ── Parity kebab ↔ PPM (§8) ─────────────────────────────────────────────────

describe('R01 · parity kebab ↔ PPM', () => {
  it('oba triggery renderują ten sam zestaw i tę samą kolejność pozycji', () => {
    const { unmount } = render(<RowActionsMenu sections={legacySevenKinds} />);
    openKebab();
    const kebabLabels = labels();
    const kebabSeparators = panel().querySelectorAll(':scope > .border-t').length;
    unmount();

    render(<RowActionsMenu sections={legacySevenKinds} contextMenuAnchor={{ x: 400, y: 300 }} />);
    const ppmLabels = labels();
    const ppmSeparators = panel().querySelectorAll(':scope > .border-t').length;

    expect(ppmLabels).toEqual(kebabLabels);
    expect(ppmSeparators).toBe(kebabSeparators);
  });

  it('PPM otwiera się bez klikania kebaba i znaczy się jako context', () => {
    render(<RowActionsMenu sections={legacySevenKinds} contextMenuAnchor={{ x: 10, y: 10 }} />);
    expect(panel().getAttribute('data-row-actions-menu')).toBe('context');
  });

  it('kebab znaczy się jako kebab — różni się WYŁĄCZNIE anchorem', () => {
    render(<RowActionsMenu sections={legacySevenKinds} />);
    openKebab();
    expect(panel().getAttribute('data-row-actions-menu')).toBe('kebab');
  });

  it('żadna akcja nie istnieje wyłącznie w PPM', () => {
    const { unmount } = render(<RowActionsMenu sections={legacySevenKinds} />);
    openKebab();
    const kebabIds = new Set(labels());
    unmount();
    render(<RowActionsMenu sections={legacySevenKinds} contextMenuAnchor={{ x: 5, y: 5 }} />);
    for (const label of labels()) expect(kebabIds.has(label)).toBe(true);
  });
});

// ── Geometria (§7 kontrakt graficzny) ───────────────────────────────────────

describe('R01 · geometria', () => {
  it('panel deklaruje kanoniczne minimum 220 px', () => {
    render(<RowActionsMenu sections={legacySevenKinds} />);
    openKebab();
    expect(panel().className).toContain(`min-w-[${CANON_ROW_MENU.minWidth}px]`);
  });

  it('panel nigdy nie przekracza 320 px', () => {
    render(<RowActionsMenu sections={legacySevenKinds} />);
    openKebab();
    const maxWidth = Number.parseInt(panel().style.maxWidth, 10);
    expect(Number.isNaN(maxWidth)).toBe(false);
    expect(maxWidth).toBeLessThanOrEqual(CANON_ROW_MENU.maxWidth);
    expect(maxWidth).toBeGreaterThanOrEqual(CANON_ROW_MENU.minWidth);
  });

  it('pozycja menu ma wysokość 36 px', () => {
    render(<RowActionsMenu sections={legacySevenKinds} />);
    openKebab();
    // h-9 = 36 px; kanon trzyma tę liczbę w CANON_HEIGHT.menuItem.
    expect(CANON_HEIGHT.menuItem).toBe(36);
    for (const button of itemButtons()) expect(button.className).toContain('h-9');
  });

  it('trigger ma cel 32×32 px', () => {
    render(<RowActionsMenu sections={legacySevenKinds} />);
    const trigger = screen.getByLabelText('Row actions');
    expect(CANON_HIT_TARGET.min).toBe(32);
    expect(trigger.className).toContain('h-8');
    expect(trigger.className).toContain('w-8');
  });

  it('ikony mają 16 px także przy size="sm"', () => {
    render(<RowActionsMenu sections={legacySevenKinds} size="sm" />);
    const svg = screen.getByLabelText('Row actions').querySelector('svg');
    expect(CANON_ICON.default).toBe(16);
    expect(svg?.getAttribute('width')).toBe('16');
  });

  it('radius panelu jest tokenowy, bez lokalnego wariantu', () => {
    render(<RowActionsMenu sections={legacySevenKinds} />);
    openKebab();
    expect(panel().className).toContain('rounded-xl');
  });
});

// ── Kolory i stany (§7, §9) ─────────────────────────────────────────────────

describe('R01 · kolory i stany', () => {
  it('tylko danger jest czerwony', () => {
    render(<RowActionsMenu sections={legacySevenKinds} />);
    openKebab();
    const red = itemButtons().filter((b) => b.className.includes('text-danger-600'));
    expect(red.map((b) => b.textContent?.trim())).toEqual(['Delete']);
  });

  it('primary NIE jest wyróżniony kolorem w menu wiersza', () => {
    render(
      <RowActionsMenu
        sections={[
          { id: 'c', kind: 'context', actions: [action('o', 'Open', { variant: 'primary' })] },
        ]}
      />
    );
    openKebab();
    const [button] = itemButtons();
    expect(button.className).not.toContain('text-danger');
    expect(button.className).not.toContain('text-primary');
  });

  it('disabled pozostaje WIDOCZNY i jaśniejszy (nie znika)', () => {
    render(
      <RowActionsMenu
        sections={[
          {
            id: 'm',
            kind: 'manage',
            actions: [
              action('edit', 'Edit'),
              action('archive', 'Archive', {
                disabled: true,
                description: 'Finish or cancel it first',
              }),
            ],
          },
        ]}
      />
    );
    openKebab();
    const archive = screen.getByText('Archive').closest('button')!;
    expect(archive).toBeInTheDocument();
    expect(archive).toBeDisabled();
    expect(archive.className).toContain('disabled:opacity-45');
  });

  /**
   * Decyzja zarządzająca R01 (2026-08-06), NADRZĘDNA wobec P-17/P-18
   * z 2026-07-28: pozycja wyłączona zostaje widoczna i jaśniejsza, ale powód
   * blokady NIE jest prezentowany — ani jako dopisek, ani jako tooltip.
   * Stan biznesowy i sama blokada pozostają nietknięte.
   */
  it('powód blokady NIE jest prezentowany — ani dopiskiem, ani tooltipem (§1, §7, §10)', () => {
    render(
      <RowActionsMenu
        sections={[
          {
            id: 'm',
            kind: 'manage',
            actions: [
              action('edit', 'Edit'),
              action('archive', 'Archive', {
                disabled: true,
                description: 'Finish or cancel it first',
              }),
            ],
          },
        ]}
      />
    );
    openKebab();
    const archive = screen.getByText('Archive').closest('button')!;

    // Blokada działa i jest widoczna…
    expect(archive).toBeDisabled();
    // …ale powód nigdzie nie wycieka do UI.
    expect(screen.queryByText(/Finish or cancel it first/)).toBeNull();
    expect(archive.getAttribute('title')).toBeNull();
    expect(archive.textContent).toBe('Archive');
  });

  it('opis pozycji AKTYWNEJ nadal się renderuje — usunięta jest tylko prezentacja POWODU', () => {
    render(
      <RowActionsMenu
        sections={[
          {
            id: 'c',
            kind: 'context',
            actions: [action('open', 'Open', { description: 'Opens the full record' })],
          },
        ]}
      />
    );
    openKebab();
    expect(screen.getByText('Opens the full record')).toBeInTheDocument();
    expect(screen.getByText('Open').closest('button')!.getAttribute('title')).toBe(
      'Opens the full record'
    );
  });

  it('powód nadal DOCIERA do komponentu — usunięto prezentację, nie dane', () => {
    // Deskryptor capability wciąż niesie powód (audyt, testy, telemetria);
    // renderer po prostu go nie pokazuje.
    const archive = action('archive', 'Archive', {
      disabled: true,
      description: 'Finish or cancel it first',
    });
    const zones = normalizeZones([{ id: 'm', kind: 'manage', actions: [archive] }]);
    expect(zones[0].actions[0].description).toBe('Finish or cancel it first');
    expect(zones[0].actions[0].disabled).toBe(true);
  });

  it('ścieżka legacy (płaska tablica) NIE usuwa już pozycji wyłączonych', () => {
    // Stan bazowy filtrował `!action.disabled`, czyli kasował pozycję z menu.
    render(
      <RowActionsMenu
        actions={[
          action('edit', 'Edit'),
          action('archive', 'Archive', { disabled: true, description: 'Archive first' }),
        ]}
      />
    );
    openKebab();
    expect(screen.getByText('Archive')).toBeInTheDocument();
  });
});

// ── Atrapy (§1, §10) ────────────────────────────────────────────────────────

describe('R01 · zakaz atrap', () => {
  it('usuwa pozycję nazwaną „Coming soon" nawet gdy jest aktywna', () => {
    render(
      <RowActionsMenu
        sections={[
          {
            id: 'm',
            kind: 'manage',
            actions: [action('edit', 'Edit'), action('export', 'Export (coming soon)')],
          },
        ]}
      />
    );
    openKebab();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('usuwa „Wkrótce" z opisu pozycji wyłączonej', () => {
    render(
      <RowActionsMenu
        sections={[
          {
            id: 'm',
            kind: 'manage',
            actions: [
              action('edit', 'Edit'),
              action('archive', 'Archiwizuj', { disabled: true, description: 'Wkrótce' }),
            ],
          },
        ]}
      />
    );
    openKebab();
    expect(screen.queryByText('Archiwizuj')).toBeNull();
  });

  it('ZOSTAWIA realną blokadę produktową (reguła, nie atrapa)', () => {
    expect(
      czyAtrapa({ disabled: true, description: 'Safes are automatic — cannot be deleted' })
    ).toBe(false);
    expect(czyAtrapa({ disabled: true, label: 'Export (coming soon)' })).toBe(true);
  });
});

// ── Klawiatura i focus (§7) ─────────────────────────────────────────────────

describe('R01 · klawiatura i focus', () => {
  const keyboardSections: RowActionSection[] = [
    { id: 'c', kind: 'context', actions: [action('open', 'Open'), action('share', 'Share')] },
    {
      id: 'm',
      kind: 'manage',
      actions: [
        action('edit', 'Edit'),
        action('archive', 'Archive', { disabled: true, description: 'Archive first' }),
      ],
    },
    { id: 'd', kind: 'danger', actions: [action('delete', 'Delete', { variant: 'danger' })] },
  ];

  it('ArrowDown schodzi na pierwszą pozycję, kolejne przesuwają w dół', () => {
    render(<RowActionsMenu sections={keyboardSections} />);
    openKebab();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent?.trim()).toBe('Open');
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent?.trim()).toBe('Share');
  });

  it('ArrowUp z pozycji pierwszej zawija na ostatnią', () => {
    render(<RowActionsMenu sections={keyboardSections} />);
    openKebab();
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(document.activeElement?.textContent?.trim()).toBe('Delete');
  });

  it('Home i End skaczą na skraje listy', () => {
    render(<RowActionsMenu sections={keyboardSections} />);
    openKebab();
    fireEvent.keyDown(document, { key: 'End' });
    expect(document.activeElement?.textContent?.trim()).toBe('Delete');
    fireEvent.keyDown(document, { key: 'Home' });
    expect(document.activeElement?.textContent?.trim()).toBe('Open');
  });

  it('nawigacja POMIJA pozycje wyłączone, ale ich nie ukrywa', () => {
    render(<RowActionsMenu sections={keyboardSections} />);
    openKebab();
    fireEvent.keyDown(document, { key: 'End' });
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    // Archive jest wyłączone → ArrowUp przeskakuje na Edit.
    expect(document.activeElement?.textContent?.trim()).toBe('Edit');
    expect(screen.getByText('Archive')).toBeInTheDocument();
  });

  it('Enter uruchamia aktywną pozycję i zamyka menu', () => {
    const onClick = vi.fn();
    render(
      <RowActionsMenu
        sections={[{ id: 'c', kind: 'context', actions: [action('open', 'Open', { onClick })] }]}
      />
    );
    openKebab();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('Space działa jak Enter', () => {
    const onClick = vi.fn();
    render(
      <RowActionsMenu
        sections={[{ id: 'c', kind: 'context', actions: [action('open', 'Open', { onClick })] }]}
      />
    );
    openKebab();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Esc zamyka menu i zwraca focus do triggera', () => {
    render(<RowActionsMenu sections={keyboardSections} />);
    const trigger = screen.getByLabelText('Row actions');
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Esc zamyka najpierw SUBMENU, dopiero potem menu (§9)', () => {
    render(
      <RowActionsMenu
        sections={[
          {
            id: 'm',
            kind: 'manage',
            actions: [
              action('delay', 'Delay', {
                submenu: [action('d1', '+1 day'), action('d3', '+3 days')],
              }),
            ],
          },
        ]}
      />
    );
    openKebab();
    fireEvent.click(screen.getByText('Delay'));
    expect(screen.getByText('+1 day')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('+1 day')).toBeNull();
    expect(document.querySelector('[role="menu"]')).not.toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('klik poza menu zamyka je', () => {
    render(<RowActionsMenu sections={keyboardSections} />);
    openKebab();
    const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('typeahead skacze do pozycji po pierwszej literze', () => {
    render(<RowActionsMenu sections={keyboardSections} />);
    openKebab();
    fireEvent.keyDown(document, { key: 'd' });
    expect(document.activeElement?.textContent?.trim()).toBe('Delete');
  });

  it('trigger deklaruje aria-haspopup i aria-expanded', () => {
    render(<RowActionsMenu sections={keyboardSections} />);
    const trigger = screen.getByLabelText('Row actions');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });
});

// ── Flip / clamp przy 1280×720 (§9) ─────────────────────────────────────────

describe('R01 · flip i clamp na minimalnym desktopie 1280×720', () => {
  const setViewport = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
  };

  const anchorTrigger = (rect: Partial<DOMRect>) => {
    vi.spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      width: 32,
      height: 32,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rect,
    } as DOMRect);
  };

  it('zachowuje 12 px odstępu od dolnej krawędzi (clamp)', () => {
    setViewport(1280, 720);
    // Trigger tuż nad dolną krawędzią — panel nie zmieści się w dół.
    anchorTrigger({ top: 700, bottom: 716, right: 1240 });
    render(<RowActionsMenu sections={legacySevenKinds} />);
    openKebab();

    const top = Number.parseInt(panel().style.top, 10);
    expect(top).toBeGreaterThanOrEqual(CANON_ROW_MENU.viewportClearance);
    // Panel (jsdom: wysokość zastępcza 200 px) nie wystaje poza viewport.
    expect(top + 200).toBeLessThanOrEqual(720 - CANON_ROW_MENU.viewportClearance + 1);
  });

  it('zachowuje 12 px odstępu od prawej krawędzi', () => {
    setViewport(1280, 720);
    anchorTrigger({ top: 100, bottom: 132, right: 1279 });
    render(<RowActionsMenu sections={legacySevenKinds} />);
    openKebab();
    const right = Number.parseInt(panel().style.right, 10);
    expect(right).toBeGreaterThanOrEqual(CANON_ROW_MENU.viewportClearance);
  });

  it('auto-flip do góry, gdy w dół nie ma miejsca', () => {
    setViewport(1280, 720);
    anchorTrigger({ top: 690, bottom: 706, right: 1240 });
    render(<RowActionsMenu sections={legacySevenKinds} />);
    openKebab();
    expect(panel().style.transformOrigin).toContain('bottom');
  });

  it('otwiera w dół, gdy miejsce jest', () => {
    setViewport(1280, 720);
    anchorTrigger({ top: 100, bottom: 132, right: 1240 });
    render(<RowActionsMenu sections={legacySevenKinds} />);
    openKebab();
    expect(panel().style.transformOrigin).toContain('top');
  });
});

// ── Brak regresji API ───────────────────────────────────────────────────────

describe('R01 · zgodność wsteczna', () => {
  it('nie renderuje nic, gdy nie ma żadnej realnej akcji', () => {
    const { container } = render(<RowActionsMenu sections={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('menu złożone wyłącznie z atrap nie renderuje triggera', () => {
    const { container } = render(
      <RowActionsMenu actions={[action('x', 'Coming soon', { disabled: true })]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('nadal wspiera płaską tablicę `actions` i wariant poziomy', () => {
    render(<RowActionsMenu actions={[action('open', 'Open')]} iconVariant="horizontal" />);
    openKebab();
    expect(within(panel()).getByText('Open')).toBeInTheDocument();
  });

  it('ignoruje `divider` na pozycji — separatory należą do stref', () => {
    render(
      <RowActionsMenu
        actions={[
          action('a', 'A'),
          action('b', 'B', { divider: true }),
          action('c', 'C', { divider: true }),
        ]}
      />
    );
    openKebab();
    // Wszystkie trzy trafiają do strefy context → zero separatorów.
    expect(panel().querySelectorAll(':scope > .border-t').length).toBe(0);
  });
});
