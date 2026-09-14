/**
 * F4 — zgłoszenie właściciela 15.09 (My Work → Ideas → warsztat Process Flow /
 * Value Stream), trzy rzeczy w jednym pliku, bo dotyczą jednego rogu ekranu:
 *
 *  (1) „prawego panelu właściwości (ACTIONS/PROPERTIES/RELATIONS/…) nie da się
 *      zamknąć, żeby został tylko panel Teresy" — ani „×", ani „Panel".
 *  (2) „przyciski «Panel» i «Work with AI» wyglądają wieśniacko" — „Work with
 *      AI" był fioletowy (`c-ai`) z tintem i obwódką, czyli AKCENT KOLOROWY na
 *      CTA; kanon: CTA/stany aktywne neutralne, akcent tylko `c-focus`.
 *  (3) „«Work with AI» tu nie działa".
 *
 * ZMIERZONE (playwright na dev-render `processflow-canvas`, czyli REALNY
 * `IdeaMapWorkspace`, nie atrapa), stan PRZED naprawą:
 *   • przy Teresie trzymanej otwartej: klik „×" → panel ZOSTAJE (localStorage
 *     wracał z "1" na "0"); klik „Panel" → panel ZOSTAJE. Przyczyna: efekt na
 *     `isChatCollapsed` był POZIOMOWY i wymuszał `panelZamkniety = false` za
 *     każdym razem, gdy rozmowa była otwarta, a oba zamknięcia gasiły czat,
 *     który dok Teresy natychmiast przywracał. Pętla.
 *   • menu „Work with AI" OTWIERAŁO się i wołało realny `generateAIProposal`
 *     (pozycje: Analizuj · Uzupełnij tę sekcję · Uzupełnij cały dokument) —
 *     martwych pozycji NIE było. Nieszczelna była droga wyniku i brak
 *     jakiejkolwiek oznaki pracy.
 *
 * Testy niżej pilnują, żeby żadna z tych trzech rzeczy nie odrosła.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaCornerActions } from '../IdeaCanvasMenu1Bits';
import { PracujZAI } from '../../standard/PracujZAI';

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({
    t: (_k: string, d?: unknown) => (typeof d === 'string' ? d : _k),
    i18n: { language: 'en' },
  }),
}));

const workspace = fs.readFileSync(path.resolve(__dirname, '../IdeaMapWorkspace.tsx'), 'utf8');

// ── (1) Zamykanie panelu ────────────────────────────────────────────────────
describe('F4 (1) — prawy panel właściwości daje się zamknąć, Teresa zostaje', () => {
  it('efekt „otwórz panel razem z Teresą" jest ZBOCZOWY, nie poziomowy', () => {
    // Poziomowy wariant (`if (!isChatCollapsed) setPanelZamkniety(false)` bez
    // porównania z poprzednim stanem) był przyczyną pętli: każde zamknięcie
    // panelu wracało bumerangiem, dopóki rozmowa stała otwarta.
    expect(workspace).toContain('const poprzedniCzatDlaPanelu = useRef<boolean>(isChatCollapsed);');
    expect(workspace).toContain('if (byloZamkniete && !isChatCollapsed) {');
  });

  it('zamknięcie panelu NIE gasi rozmowy (dwie ścieżki: „×" i przycisk „Panel")', () => {
    // Właściciel prosi wprost: „żeby został tylko panel Teresy". Gdyby któraś
    // ścieżka znów wołała `toggleChatCollapse()`, Teresa gasłaby razem z
    // panelem — i pętla z punktu wyżej wróciłaby razem z nią.
    expect(workspace).not.toContain('if (nastepny && !isChatCollapsed) toggleChatCollapse();');
    expect(workspace).not.toContain(
      'if (!isChatCollapsed) toggleChatCollapse();\n                  }}'
    );
  });

  it('„×" w osadzonych sekcjach chowa CAŁY panel, a nie tylko zeruje sekcję', () => {
    // Wcześniej `onClose` wołał sam `handlePanelChange(null)`: kolumna
    // zostawała na ekranie, tylko z inną treścią (fallback na inspektor) —
    // dokładnie to właściciel zobaczył jako „nie da się zamknąć".
    expect(workspace).toContain('const zamknijPrawyPanel = useCallback(() => {');
    // Wszystkie TRZY osadzone sekcje kanonicznego panelu (Właściwości /
    // Powiązania / Sugestie AI) muszą wołać to samo zamknięcie. Sprawdzamy
    // ciało `renderIdeaRightPanel()`, a nie cały plik — dziś nieosiągalna
    // ścieżka legacy (`renderMelsCanvasRightRailPanel`, `rightRailTools={[]}`)
    // celowo zostaje przy swoim `handlePanelChange(null)`.
    const cialo = workspace.slice(
      workspace.indexOf('function renderIdeaRightPanel(): React.ReactNode {')
    );
    const kanoniczny = cialo.slice(0, cialo.indexOf('function renderWorkspaceSiblings'));
    expect(kanoniczny.match(/onClose=\{zamknijPrawyPanel\}/g)).toHaveLength(3);
    expect(kanoniczny).not.toContain('onClose={() => handlePanelChange(null)}');
  });
});

// ── (2) Kanon przycisków ────────────────────────────────────────────────────
const KANON_ZAKAZ = /primary-\d|violet-|purple-|fuchsia-|indigo-|bg-gradient|c-ai\b/;

describe('F4 (2) — „Panel" i „Work with AI" w kanonie (neutralne, zero fioletu)', () => {
  it('„Panel": neutralna pigułka, stan aktywny NEUTRALNY, fokus c-focus', () => {
    const { rerender } = render(
      <IdeaCornerActions panelOpen={false} onTogglePanel={() => {}} panelLabel="Panel" />
    );
    const zamkniety = screen.getByTestId('idea-corner-panel');
    expect(zamkniety.className).not.toMatch(KANON_ZAKAZ);
    expect(zamkniety.className).toContain('border-c-border-subtle');
    expect(zamkniety.className).toContain('bg-c-surface');
    expect(zamkniety.className).toContain('var(--c-focus)');
    expect(zamkniety).toHaveAttribute('aria-pressed', 'false');

    rerender(<IdeaCornerActions panelOpen onTogglePanel={() => {}} panelLabel="Panel" />);
    const otwarty = screen.getByTestId('idea-corner-panel');
    // Stan aktywny = neutralne wypełnienie, nie kolor akcentu.
    expect(otwarty.className).not.toMatch(KANON_ZAKAZ);
    expect(otwarty.className).toContain('bg-c-surface-raised');
    expect(otwarty).toHaveAttribute('aria-pressed', 'true');
  });

  it('„Work with AI": ten sam kształt co „Panel", zero fioletu, zero primary-*', () => {
    render(
      <PracujZAI
        onAnalizuj={() => {}}
        moznaEdytowac
        kontekstArtefaktu={{ title: 'Proces wdrożenia', status: 'shaping', type: 'idea' }}
      />
    );
    const btn = screen.getByTestId('pracuj-z-ai');
    expect(btn.className).not.toMatch(KANON_ZAKAZ);
    expect(btn.className).toContain('border-c-border-subtle');
    expect(btn.className).toContain('rounded-lg');
    expect(btn.className).toContain('h-8');
    // Oba przyciski muszą mieć identyczną bazę kształtu — inaczej róg znowu
    // wygląda na sklejony z dwóch różnych ekranów.
    render(<IdeaCornerActions panelOpen={false} onTogglePanel={() => {}} panelLabel="Panel" />);
    for (const klasa of ['h-8', 'rounded-lg', 'px-2.5', 'text-xs']) {
      expect(screen.getByTestId('idea-corner-panel').className).toContain(klasa);
      expect(btn.className).toContain(klasa);
    }
  });

  it('cały komponent „Work with AI" nie niesie fioletowego CTA', () => {
    const zrodlo = fs.readFileSync(path.resolve(__dirname, '../../standard/PracujZAI.tsx'), 'utf8');
    // Przyciski (CTA) — neutralne. Sam glif ✨ może zostać tokenem `c-ai`,
    // ale żaden przycisk nie ma już tintu ani obwódki w tym kolorze.
    expect(zrodlo).not.toContain('border-c-ai/40 bg-c-ai/10');
  });
});

// ── (3) „Work with AI" działa ───────────────────────────────────────────────
describe('F4 (3) — „Work with AI" otwiera menu i nie ma martwych pozycji', () => {
  it('klik otwiera listę z trzema działaniami, „Analizuj" woła handler', () => {
    const analizuj = vi.fn();
    render(
      <PracujZAI
        onAnalizuj={analizuj}
        moznaEdytowac
        kontekstArtefaktu={{ title: 'Proces wdrożenia', status: 'shaping', type: 'idea' }}
        aktywnaSekcja="process_flow"
        uzupelnijSekcje={{ rodzaj: 'wlasnaPropozycja', uruchom: () => {}, opis: 'x' }}
        uzupelnijDokument={{ rodzaj: 'wlasnaPropozycja', uruchom: () => {}, opis: 'y' }}
      />
    );
    const btn = screen.getByTestId('pracuj-z-ai');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    const pozycje = screen.getAllByRole('menuitem');
    expect(pozycje).toHaveLength(3);
    fireEvent.click(pozycje[0]);
    expect(analizuj).toHaveBeenCalledTimes(1);
  });

  it('warsztat karmi spinner i pokazuje panel, gdy wrócą propozycje', () => {
    // Bez `analizaWToku` przycisk milczał przez cały czas wołania serwera, a
    // wynik lądował w panelu, który mógł być zamknięty — z perspektywy
    // właściciela „nic się nie dzieje", czyli „nie działa".
    expect(workspace).toContain('analizaWToku={aiPlotnaWToku}');
    expect(workspace).toContain('setAiPlotnaWToku(true);');
    expect(workspace).toContain('setAiPlotnaWToku(false);');
    expect(workspace).toMatch(/setActivePanel\('tools'\);[\s\S]{0,900}setPanelZamkniety\(false\);/);
  });

  it('opisy zgód idą przez i18n, nie twardym polskim tekstem (DEC-461)', () => {
    expect(workspace).not.toContain("opis: 'Propozycje dla aktywnego centrum");
    expect(workspace).toContain("'mindmap.pracujZAI.opisAktywneCentrum'");
    expect(workspace).toContain("'mindmap.pracujZAI.opisCalyPomysl'");
    for (const loc of ['en', 'pl']) {
      const slownik = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, `../../../../public/locales/${loc}/translation.json`),
          'utf8'
        )
      );
      expect(slownik.mindmap.pracujZAI.opisAktywneCentrum).toBeTruthy();
      expect(slownik.mindmap.pracujZAI.opisCalyPomysl).toBeTruthy();
    }
  });
});
