import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('T2 startuje na Rekordzie i przełącza ciało na Teresę bez drugiego panelu', async () => {
    const { container } = render(<Surface />, { wrapper: Wrapper });
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(tabs[1]);

    expect(await screen.findByLabelText('Teresa composer')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
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

  it('T7 nie wprowadza zakazanych rodzin tokenów', () => {
    const { container } = render(<Surface />, { wrapper: Wrapper });
    const controlledMarkup = [
      container.querySelector('[data-right-panel]')?.getAttribute('class'),
      ...screen.getAllByRole('tab').map((tab) => tab.getAttribute('class')),
    ].join(' ');
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
