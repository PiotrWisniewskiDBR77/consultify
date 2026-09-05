/**
 * IdeaRightPanel — Menu 1 (Narzędzia/Kontekst i powiązania/Sugestie AI) →
 * kanoniczny prawy panel idei.
 *
 * DLACZEGO TEN TEST ISTNIEJE:
 * `RUNDA2_RAPORT.md` (odbiór żywy 2026-09-05) zmierzył, że w otwartej idei
 * (Moja Praca → Pomysły) trzy ikony Menu 1 podświetlają się, ale ŻADEN panel
 * się nie pojawia — `IdeaMapWorkspace.tsx` montował `<IdeaRightPanel>`
 * wyłącznie pod warunkiem `!melsCanvasEnabled`, a `melsCanvasEnabled` jest
 * przybite na sztywno na `true` („the canonical Ideas shell is no longer
 * feature-gated"). Naprawa wydzieliła montaż do `renderIdeaRightPanel()` i
 * podłączyła go jako właściwą kolumnę obok płótna w żywej ścieżce MELS —
 * zobacz `IdeaMapWorkspace.menu1RightPanel.ownerFeedback.test.ts` (dowód
 * source-level, bo `IdeaMapWorkspace` jest zbyt duży/stanowy, żeby zamontować
 * go w całości w teście jednostkowym — ten sam wzorzec co
 * `IdeaMapWorkspace.candidateGate.ownerFeedback.test.ts`).
 *
 * Ten plik pokrywa DRUGĄ połowę naprawy z realnym RTL: że komponent, który
 * teraz faktycznie się montuje (`IdeaRightPanel`), poprawnie otwiera sekcję
 * odpowiadającą klikniętej ikonie Menu 1 (`activeSection` mapowane 1:1 z
 * `toolsPanelOpen`/`contextPanelOpen`/`aiPanelOpen` w `IdeaMapWorkspace`), że
 * Eksport/Konwertuj (Menu 1 kebab parity) są klikalne, i że sekcja Teresy —
 * zgodnie z decyzją właściciela 01.09 „jedna Teresa, w swoim oknie" (czat NIE
 * wchodzi na szynę) — pozostaje treścią dostarczoną przez wołającego
 * (przycisk-wejście), a nie bespoke czatem tego komponentu.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaRightPanel } from '../IdeaRightPanel';

// UWAGA nagłówki sekcji: `ArtifactRightPanel` NADPISUJE `label` sekcji własnym
// SSOT (`ARTIFACT_PANEL_SECTION_LABELS`) wg WYKRYTEGO `i18n.language` —
// globalny mock `react-i18next` w `tests/setup.ts` ustawia `language: 'en'`
// dla całego repo, więc nagłówki sekcji renderują się PO ANGIELSKU niezależnie
// od `isPolish` przekazanego do `IdeaRightPanel` (ten prop steruje TREŚCIĄ
// wewnątrz sekcji — np. etykietami Eksportuj/Konwertuj — nie nagłówkiem karty).
describe('IdeaRightPanel — sekcja otwierana z Menu 1', () => {
  it('activeSection="properties" (ikona Narzędzia) otwiera Właściwości i pokazuje propertiesContent', () => {
    render(
      <IdeaRightPanel
        isPolish
        activeSection="properties"
        propertiesContent={<div data-testid="props-content">Pola idei</div>}
        relationsContent={<div data-testid="rel-content">Powiązania idei</div>}
        teresaContent={<div data-testid="teresa-content">Komendy Teresy</div>}
      />
    );

    expect(screen.getByText('Properties')).toBeInTheDocument();
    expect(screen.getByTestId('props-content')).toBeInTheDocument();
    // Powiązania nie jest domyślnie otwarte dla activeSection="properties" —
    // treść karty NIE jest w DOM (ArtifactRightPanel renderuje `body` tylko
    // gdy `open`).
    expect(screen.queryByTestId('rel-content')).not.toBeInTheDocument();
  });

  it('activeSection="relations" (ikona Kontekst i powiązania) otwiera Powiązania i pokazuje relationsContent', () => {
    render(
      <IdeaRightPanel
        isPolish
        activeSection="relations"
        propertiesContent={<div data-testid="props-content">Pola idei</div>}
        relationsContent={<div data-testid="rel-content">Powiązania idei</div>}
        teresaContent={<div data-testid="teresa-content">Komendy Teresy</div>}
      />
    );

    expect(screen.getByText('Relations')).toBeInTheDocument();
    expect(screen.getByTestId('rel-content')).toBeInTheDocument();
    expect(screen.queryByTestId('props-content')).not.toBeInTheDocument();
  });

  it('activeSection="teresa" (ikona Sugestie AI) otwiera Akcje i pokazuje teresaContent — jako treść dostarczoną przez wołającego, nie bespoke czat', () => {
    render(
      <IdeaRightPanel
        isPolish
        activeSection="teresa"
        propertiesContent={<div data-testid="props-content">Pola idei</div>}
        relationsContent={<div data-testid="rel-content">Powiązania idei</div>}
        teresaContent={<div data-testid="teresa-content">Komendy Teresy</div>}
      />
    );

    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByTestId('teresa-content')).toBeInTheDocument();
    // Kanon: brak własnego pola tekstowego czatu w tym komponencie — Teresa
    // to treść dostarczona przez wołającego (przycisk-wejście do głównego
    // dokowanego okna), nigdy drugi czat wbudowany w panel.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('Eksportuj/Konwertuj (parytet z kebabem Menu 1/3) renderują się i wywołują realne handlery workspace', () => {
    const onExport = vi.fn();
    const onConvert = vi.fn();
    render(
      <IdeaRightPanel
        isPolish
        activeSection="properties"
        propertiesContent={<div />}
        relationsContent={<div />}
        teresaContent={<div />}
        onExport={onExport}
        onConvert={onConvert}
      />
    );

    // Akcje nie jest domyślnie otwarta dla activeSection="properties" —
    // otwieramy ją, żeby zweryfikować przyciski (kliknięcie nagłówka sekcji).
    fireEvent.click(screen.getByText('Actions').closest('button')!);

    fireEvent.click(screen.getByText('Eksportuj'));
    fireEvent.click(screen.getByText('Konwertuj'));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onConvert).toHaveBeenCalledTimes(1);
  });

  it('bez onExport/onConvert (brak realnego handlera) Akcje nie renderuje przycisków-widm', () => {
    render(
      <IdeaRightPanel
        isPolish
        activeSection={null}
        propertiesContent={<div />}
        relationsContent={<div />}
        teresaContent={<div data-testid="teresa-content">Komendy Teresy</div>}
      />
    );

    expect(screen.queryByText('Eksportuj')).not.toBeInTheDocument();
    expect(screen.queryByText('Konwertuj')).not.toBeInTheDocument();
    // Akcje domyślnie otwarta gdy activeSection === null — teresaContent
    // dalej widoczny (Historia zostaje pusta, jak przed Z8).
    expect(screen.getByTestId('teresa-content')).toBeInTheDocument();
  });
});
