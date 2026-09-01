import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DeckBuilderMelsView } from '../DeckBuilderMelsView';

const handlers = {
  onHistory: vi.fn(),
  onQa: vi.fn(),
  onGovernance: vi.fn(),
  onAnalytics: vi.fn(),
  onAudit: vi.fn(),
  onShare: vi.fn(),
  onToggleAgent: vi.fn(),
  onRun: vi.fn(),
  onRunFromStart: vi.fn(),
  onPresenter: vi.fn(),
};

function renderView(artifactStudioMode: boolean) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1800,
  });
  return render(
    <DeckBuilderMelsView
      artifactStudioMode={artifactStudioMode}
      title="Investment decision"
      topBarHandlers={handlers}
      leftRail={<div>Slides structure</div>}
      canvas={<div>Deck canvas</div>}
      menu3Slot={<div>Context menu 3</div>}
      reviewPanel={<div>Presentation QA and approval workflow</div>}
      titleTrailingSlot={<div>Saved Draft</div>}
      aiEntrySlot={<div>Global Teresa surface</div>}
      bottomBarSlot={<div>Presentation bottom bar</div>}
      rightRailPanels={{
        comments: <div>Presentation comments workflow</div>,
        evidence: <div>Presentation sources workflow</div>,
      }}
      persistRailState={false}
    />
  );
}

describe('DeckBuilderMelsView Artifact Studio adapter', () => {
  it('keeps the legacy Teresa chip and external bottom bar when the rollout is off', () => {
    renderView(false);

    expect(screen.getByRole('button', { name: 'Teresa' })).toBeInTheDocument();
    expect(screen.getByText('Global Teresa surface')).toBeInTheDocument();
    expect(screen.queryByText('Context menu 3')).not.toBeInTheDocument();
    expect(screen.getByText('Presentation bottom bar').parentElement).toHaveAttribute(
      'data-testid',
      'deck-builder-mels-root'
    );
  });

  it('removes the fixed Teresa chip and mounts Teresa plus bottom bar in the shared shell', () => {
    renderView(true);

    const panel = screen.getByTestId('artifact-studio-right-panel');

    expect(screen.queryByRole('button', { name: 'Teresa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Theme' })).not.toBeInTheDocument();
    // „Comments" istnieje wyłącznie jako NAGŁÓWEK SEKCJI prawego panelu
    // artefaktu (SPEC-A), nie jako pigułka Menu 2.
    expect(panel).toContainElement(screen.getByRole('button', { name: /Comments/ }));
    expect(screen.getByRole('button', { name: 'Present' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Presentation options' })).toBeInTheDocument();
    expect(screen.getByTestId('deck-builder-mels-view')).toHaveAttribute(
      'data-artifact-studio',
      'true'
    );
    expect(screen.getByText('Global Teresa surface')).toBeInTheDocument();
    expect(screen.getByText('Context menu 3')).toBeInTheDocument();
    expect(screen.getByText('Presentation bottom bar')).toBeInTheDocument();
    expect(screen.getByText('Saved Draft')).toBeInTheDocument();
    expect(screen.queryByTestId('mels-right-rail')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Slajdy' })).toHaveAttribute('aria-selected', 'true');
    // ★ Komentarze i Źródła NIE są już zakładkami lewej szyny — wróciły do
    // prawego panelu (SPEC-A §11.2). Lewa szyna to struktura + przegląd QA.
    expect(screen.queryByRole('tab', { name: 'Komentarze' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Źródła' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'QA i przegląd' }));
    expect(screen.getByText('Presentation QA and approval workflow')).toBeInTheDocument();
  });

  it('★ prawy panel artefaktu istnieje w trybie warsztatu i trzyma kolejność SPEC-A', () => {
    /*
     * BEZPIECZNIK REGRESJI (2026-08-30). Włączenie toru `presentation`
     * zabierało prezentacji CAŁĄ prawą powierzchnię: powłoka wygasza
     * `rightRailTools` w trybie warsztatu, a `DeckBuilder` podawał
     * `aiEntrySlot` wyłącznie przy torze WYŁĄCZONYM. Zmierzone: 417 px → 0 px.
     * Ten test pada, jeśli ktoś usunie `artifactRightPanelSlot` albo
     * przestawi kolejność sekcji.
     */
    renderView(true);

    const panel = screen.getByTestId('artifact-studio-right-panel');
    expect(panel).toBeInTheDocument();

    const naglowki = Array.from(panel.querySelectorAll('button'))
      .map((b) => (b.textContent ?? '').trim())
      .filter((label) =>
        [
          'Actions',
          'Properties',
          'Relations',
          'Sources and assumptions',
          'Comments',
          'History',
        ].some((canon) => label.startsWith(canon))
      )
      .map((label) => label.replace(/\d+$/, '').trim());

    // Kolejność kanonu: Akcje · Właściwości · Powiązania · Źródła i założenia
    // · Komentarze · Historia.
    // ★ 2026-08-30 (decyzja właściciela po odbiorze `deck-artifact`): sekcja
    // bez treści NIE znika — jest widoczna, zwinięta i mówi wprost, że jest
    // pusta. Domknięcie do sześciu robi powłoka `ArtifactRightPanel`, więc
    // ten adapter nie musi (i nie może) deklarować ich sam.
    expect(naglowki).toEqual([
      'Actions',
      'Properties',
      'Relations',
      'Sources and assumptions',
      'Comments',
      'History',
    ]);
  });

  it('★ prawy panel NIE pojawia się poza trybem warsztatu (zmiana addytywna)', () => {
    renderView(false);
    expect(screen.queryByTestId('artifact-studio-right-panel')).not.toBeInTheDocument();
  });

  it('uses one Present split button for audience and presenter modes', async () => {
    renderView(true);

    fireEvent.click(screen.getByRole('button', { name: 'Present' }));
    expect(handlers.onRun).toHaveBeenCalledTimes(1);

    const options = screen.getByRole('button', { name: 'Presentation options' });
    fireEvent.click(options);
    expect(screen.getByRole('menu', { name: 'Presentation options' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'From beginning' }));
    expect(handlers.onRunFromStart).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu', { name: 'Presentation options' })).not.toBeInTheDocument();

    fireEvent.click(options);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Presenter view' }));
    expect(handlers.onPresenter).toHaveBeenCalledTimes(1);

    fireEvent.click(options);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Presentation options' })).not.toBeInTheDocument();
    await waitFor(() => expect(options).toHaveFocus());
  });

  it('merges QA and governance under one canonical Artifact Studio destination', () => {
    renderView(true);

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));

    expect(screen.getAllByText('QA i przegląd').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('menuitem', { name: 'Zasady przeglądu' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Historia')).toHaveLength(2);
    expect(screen.getByRole('menuitem', { name: 'Dziennik audytu' })).toBeInTheDocument();
    expect(screen.getByText('Udostępnianie')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Analityka udostępniania' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Governance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Audit' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'QA i przegląd' }));
    expect(screen.getByText('Presentation QA and approval workflow')).toBeInTheDocument();
  });
});
