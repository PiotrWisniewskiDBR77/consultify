import { act, fireEvent, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const appStore = vi.hoisted(() => ({
  isChatCollapsed: true,
  toggleChatCollapse: vi.fn(() => {
    appStore.isChatCollapsed = !appStore.isChatCollapsed;
  }),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: typeof appStore) => unknown) => selector(appStore),
}));

vi.mock('@/components/AIChat/UnifiedChatPanel', () => ({
  UnifiedChatPanel: () => <textarea aria-label="Teresa composer" />,
}));
vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isMobile: false, safeAreaInsets: { top: 0, bottom: 0 } }),
}));

// T4 zamyka i otwiera `TableWithPreviewLayout`'owy panel przez `AnimatePresence`
// (`mode="wait"`) — bez tej atrapy jsdom nigdy nie kończy animacji `exit`, więc
// zamknięty panel zostaje uwięziony w DOM ze starą treścią (fałszywy PASS/FAIL
// niezależny od realnego kontraktu, który to `AnimatePresence` steruje).
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) => <div {...props}>{children}</div>,
    // DEC-404: `TableWithPreviewLayout` renderuje swój JEDEN prawy panel jako
    // `motion.aside` (ten sam znacznik co `JedenPrawyPanel`), więc atrapa
    // framer-motion musi mieć `aside` — inaczej zwraca `undefined` i test
    // pada na „Element type is invalid", zamiast mierzyć produkt.
    aside: ({
      children,
      initial: _i2,
      animate: _a2,
      exit: _e2,
      transition: _t2,
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) => <aside {...props}>{children}</aside>,
  },
}));

import { StandardPreview } from '@/components/standard/StandardPreview';
import { StandardModuleBar } from '@/components/standard/StandardModuleBar';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';

import { JedenPrawyPanel } from '../JedenPrawyPanel';
import { resetJedenPanelForTests } from '../useJedenPanel';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={['/my-work']}>{children}</MemoryRouter>
);

function Surface({ title = 'Pierwszy rekord' }: { title?: string }) {
  return (
    <JedenPrawyPanel
      rekord={<StandardPreview title={title} onClose={() => undefined} details={{ text: title }} />}
    />
  );
}

function SurfaceWithMenu({ title = 'Pierwszy rekord' }: { title?: string }) {
  return (
    <>
      <StandardModuleBar />
      <Surface title={title} />
    </>
  );
}

function TableSurface() {
  return (
    <TableWithPreviewLayout
      selectedId="1"
      selectedItem={{ id: '1', title: 'Rekord' }}
      onSelect={() => undefined}
      renderPreview={() => <div>Treść</div>}
    >
      <div data-testid="table-content" />
    </TableWithPreviewLayout>
  );
}

/**
 * Odwzorowanie realnego wzorca `MyTasksListContent.tsx`/`ExecutionHub.tsx`:
 * `previewOpen={Boolean(previewTaskId)}` kontrolowany z zewnątrz, a wiersz
 * ustawia nowe zaznaczenie BEZPOŚREDNIO (`onRowClick={(row) => setPreviewTaskId(...)}`),
 * z pominięciem `TableWithPreviewLayout`'owego `handleSelect`. Regresja P1
 * (DEC-397, uwaga właściciela „panel wraca po X") żyła dokładnie w tym
 * kontrolowanym przejściu `previewOpen` false→true.
 *
 * ★ DEC-397b (06.09.2026 15:47) NADPISUJE DEC-397: właściciel chce dokładnie
 * to przejście z powrotem — „preview (…) działa przy pojedynczym kliknięciu
 * na linię" — patrz T4 niżej. Fix: `TableWithPreviewLayout` obserwuje
 * WYŁĄCZNIE `selectedId` (identyfikator, nie `previewOpen`/treść) i woła
 * `jedenPanel.otworz()` tylko gdy ten faktycznie się zmienia na nowy —
 * odróżnia to prawdziwy klik od biernego re-renderu pod tym samym `selectedId`.
 */
const CONTROLLED_ITEMS: Record<string, { id: string; title: string }> = {
  '1': { id: '1', title: 'Zadanie pierwsze' },
  '2': { id: '2', title: 'Zadanie drugie' },
};

function ControlledRowsSurface() {
  const [selectedId, setSelectedId] = React.useState<string | null>('1');
  const selectedItem = selectedId ? CONTROLLED_ITEMS[selectedId] : null;
  return (
    <>
      <StandardModuleBar />
      <TableWithPreviewLayout
        selectedId={selectedId}
        selectedItem={selectedItem}
        onSelect={setSelectedId}
        previewOpen={Boolean(selectedId)}
        renderPreview={(item) => <div>{item.title}</div>}
      >
        <button type="button" data-testid="row-2" onClick={() => setSelectedId('2')}>
          Zadanie drugie
        </button>
      </TableWithPreviewLayout>
    </>
  );
}

describe('jeden prawy panel — kontrakt', () => {
  beforeEach(() => {
    localStorage.clear();
    resetJedenPanelForTests();
    appStore.isChatCollapsed = true;
    appStore.toggleChatCollapse.mockClear();
  });

  it('T1 renderuje dokładnie jeden korzeń prawego panelu', () => {
    const { container } = render(<TableSurface />, { wrapper: Wrapper });
    expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
  });

  /*
   * ★ DEC-404 — T2 PRZEPISANY. Do 06.09 mierzył DOKŁADNIE ten kształt, który
   * właściciel odrzucił: rząd zakładek „Rekord | Teresa" i czat w kolumnie
   * podglądu. Teraz mierzy kontrakt odwrotny.
   */
  it('T2 panel podglądu nie ma zakładek ani Teresy (MUTACJA: przywróć zakładkę → RED)', async () => {
    const { container } = render(<Surface />, { wrapper: Wrapper });

    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryByLabelText('Teresa composer')).toBeNull();
    expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    // Nagłówek panelu = tytuł rekordu, nie „Teresa".
    expect(screen.getAllByText('Pierwszy rekord').length).toBeGreaterThan(0);

    const zrodloPanelu = fs.readFileSync(
      path.resolve('src/components/shared/PreviewPane/JedenPrawyPanel.tsx'),
      'utf8'
    );
    // Mierzymy KOD, nie komentarze: import czatu i rząd zakładek.
    expect(zrodloPanelu).not.toMatch(/from '@\/components\/AIChat\/UnifiedChatPanel'/);
    expect(zrodloPanelu).not.toMatch(/role=["']tablist["']/);
  });

  it('T2b otwarty dok Teresy CHOWA kolumnę podglądu (MUTACJA: usuń `dokOtwarty` → RED)', () => {
    const view = render(<TableSurface />, { wrapper: Wrapper });
    expect(view.container.querySelectorAll('[data-right-panel]')).toHaveLength(1);

    // Klik ikony Teresy w Menu 1 = globalne `toggleChatCollapse()`.
    act(() => {
      appStore.isChatCollapsed = false;
    });
    view.rerender(<TableSurface />);

    // Dok zastępuje podgląd — zero paneli podglądu, więc na ekranie
    // (razem z dokiem `MainLayout`) nadal DOKŁADNIE JEDEN <aside>
    // i DOKŁADNIE JEDEN UnifiedChatPanel.
    expect(view.container.querySelectorAll('[data-right-panel]')).toHaveLength(0);
    expect(screen.queryByLabelText('Teresa composer')).toBeNull();

    act(() => {
      appStore.isChatCollapsed = true;
    });
    view.rerender(<TableSurface />);
    expect(view.container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
  });

  it('T2c ekran listowy nie montuje własnego UnifiedChatPanel (MUTACJA: dołóż lazy czat → RED)', () => {
    const zrodloListy = fs.readFileSync(
      path.resolve('src/components/shared/TableWithPreviewLayout.tsx'),
      'utf8'
    );
    expect(zrodloListy).not.toMatch(/from '@\/components\/AIChat\/UnifiedChatPanel'/);
    expect(zrodloListy).not.toMatch(/role=["']tablist["']/);
    expect(zrodloListy).not.toMatch(/zakladka ===/);
    const zrodloMenu3 = fs.readFileSync(
      path.resolve('src/components/standard/StandardModuleBar.tsx'),
      'utf8'
    );
    // DEC-404: pigułka „Teresa" w Menu 3 znika, „Pokaż panel" zostaje.
    expect(zrodloMenu3).not.toMatch(/data-testid="open-list-teresa"/);
    expect(zrodloMenu3).toContain('show-list-panel');
  });

  it('T3 X jest lepki: zmiana rekordu nie otwiera panelu, jawny powrót otwiera', () => {
    const view = render(<SurfaceWithMenu />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(view.container.querySelector('[data-right-panel]')).toBeNull();

    view.rerender(<SurfaceWithMenu title="Drugi rekord" />);
    expect(view.container.querySelector('[data-right-panel]')).toBeNull();

    fireEvent.click(screen.getByTestId('show-list-panel'));
    expect(view.container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    expect(screen.getAllByText('Drugi rekord').length).toBeGreaterThan(0);
  });

  it('T4 DEC-397b (nadpisuje DEC-397): previewOpen kontrolowany, klik w inny wiersz po X PONOWNIE otwiera panel z tym wierszem (MUTACJA: usuń `otworz()` w efekcie `selectedId` → RED)', () => {
    const view = render(<ControlledRowsSurface />, { wrapper: Wrapper });
    expect(view.container.querySelectorAll('[data-right-panel]')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(view.container.querySelector('[data-right-panel]')).toBeNull();

    // ★ DEC-397b (właściciel, 06.09.2026 15:47): „preview jest otwierany tak,
    // jak wszędzie indziej: działa przy pojedynczym kliknięciu na linię".
    // Klik w drugi wiersz: konsument ustawia nowe zaznaczenie wprost
    // (`setPreviewTaskId`), `previewOpen` wraca na `true` — panel MA się
    // ponownie otworzyć, z NOWYM zaznaczeniem, bez potrzeby „Pokaż panel".
    fireEvent.click(screen.getByTestId('row-2'));
    expect(view.container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    expect(screen.getAllByText('Zadanie drugie').length).toBeGreaterThan(0);
  });

  it('T4b DEC-397b + DEC-404: dok Teresy otwarty → klik wiersza NIE otwiera drugiego panelu (MUTACJA: użyj `pokazPanel()` zamiast `otworz()` → RED)', () => {
    appStore.isChatCollapsed = false;
    const view = render(<ControlledRowsSurface />, { wrapper: Wrapper });
    // Dok zastępuje kolumnę podglądu — zero paneli, mimo że `selectedId` już
    // jest ustawiony (`'1'`, patrz `ControlledRowsSurface`).
    expect(view.container.querySelectorAll('[data-right-panel]')).toHaveLength(0);
    expect(appStore.toggleChatCollapse).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('row-2'));
    // Klik zmienił zaznaczenie (`otworz()` czyści `zamkniety`), ale dok
    // ZOSTAJE otwarty — `otworz()`, w odróżnieniu od `pokazPanel()`, nie
    // woła `toggleChatCollapse`, więc nie pojawia się drugi panel obok doku.
    expect(view.container.querySelectorAll('[data-right-panel]')).toHaveLength(0);
    expect(appStore.toggleChatCollapse).not.toHaveBeenCalled();
  });

  it('T7 nie wprowadza zakazanych rodzin tokenów', () => {
    // DEC-404: rzędu zakładek już nie ma — mierzymy sam korzeń panelu.
    const { container } = render(<Surface />, { wrapper: Wrapper });
    const controlledMarkup =
      container.querySelector('[data-right-panel]')?.getAttribute('class') ?? '';
    expect(controlledMarkup).not.toMatch(/primary-|navy-|slate-/);
  });

  it('T6 poniżej progu panel jest nakładką, a od 1184 px rodzeństwem flexa', () => {
    let callback: ResizeObserverCallback = () => undefined;
    class Observer {
      constructor(cb: ResizeObserverCallback) {
        callback = cb;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', Observer);
    const { container } = render(
      <TableWithPreviewLayout
        selectedId="1"
        selectedItem={{ id: '1', title: 'Rekord' }}
        onSelect={() => undefined}
        renderPreview={() => <div>Treść</div>}
      >
        <div data-testid="table" />
      </TableWithPreviewLayout>,
      { wrapper: Wrapper }
    );

    act(() => callback([{ contentRect: { width: 1000 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    expect(container.querySelector('[data-right-panel]')?.parentElement).toHaveClass('absolute');

    act(() => callback([{ contentRect: { width: 1184 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(container.querySelector('[data-right-panel]')?.parentElement).toHaveClass('contents');
    vi.unstubAllGlobals();
  });
});
