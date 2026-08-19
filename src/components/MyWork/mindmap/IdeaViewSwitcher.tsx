/**
 * IdeaViewSwitcher — przełącznik czterech reprezentacji w PRAWYM DOLNYM ROGU
 * płótna (decyzja właściciela D2, standard rozdz. 03 §7 / rozdz. 06 §2).
 *
 * Dziś przełącznik żyje w lewym railu (`CanvasLeftToolbar`, blok `onToolChange`).
 * D2 przenosi go do rogu, obok zoom/dopasuj/minimapy — rail przestaje być
 * miejscem przełączania. Zmiana wizualna, więc wchodzi ZA FLAGĄ (domyślnie OFF,
 * reguła #7): flaga ON = przełącznik tutaj i zdjęty z railа; OFF = jak dziś.
 *
 * Renderowany przez `createPortal` do body i kotwiczony do prawego-dolnego rogu
 * pasma płótna (`[data-testid="mels-canvas"]`, z fallbackiem na kontener) —
 * tym samym wzorcem pomiaru co rail, żeby nie wchodzić na paski powłoki ani na
 * własny pasek reprezentacji.
 *
 * ★ 2026-07-28, flaga `ideaBottomBarUnified` (domyślnie OFF): heurystyczny
 * pomiar ma gałąź „usiądź PIĘTRO NAD klastrem", gdy w rzędzie brakuje miejsca —
 * i to ona dawała Piotrowi „dwa klastry jeden nad drugim". Przy fladze ON nic
 * nie mierzymy: przełącznik portaluje się do gniazda WEWNĄTRZ pigułki zoomu
 * (`IDEA_BOTTOM_BAR_SWITCHER_SLOT_ID`), więc jeden rząd jest gwarantowany
 * układem, a nie szczęściem pomiaru. OFF = dzisiejsza ścieżka co do piksela.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useFullscreenPortalTarget } from '@/hooks/useFullscreenPortalTarget';

import {
  IDEA_BOTTOM_BAR_SWITCHER_SLOT_ID,
  isIdeaBottomBarUnifiedEnabled,
} from '../../../utils/ideaBottomBarUnifiedFlag';
import type { CanvasToolType } from '../ideaSelectionTypes';
import { getIdeaWorkspaceToolLabel, TOOL_CONFIG } from '../IdeaWorkspaceToolbar';

interface IdeaViewSwitcherProps {
  activeTool: CanvasToolType;
  onToolChange: (tool: CanvasToolType) => void;
  isPl: boolean;
  /** Liczba elementów per reprezentacja — kropka „ma treść". */
  familyCounts?: Partial<Record<CanvasToolType, number>>;
  /** Odsunięcie od prawej krawędzi płótna, żeby nie nachodzić na zoom/minimapę. */
  rightInset?: number;
}

export function IdeaViewSwitcher({
  activeTool,
  onToolChange,
  isPl,
  familyCounts,
  rightInset = 12,
}: IdeaViewSwitcherProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  /** Cel portalu ścieżki OFF: `body` normalnie, element pełnoekranowy w F11. */
  const portalTarget = useFullscreenPortalTarget();
  const zjednoczonyPasek = isIdeaBottomBarUnifiedEnabled();
  const [compactViewport, setCompactViewport] = useState(
    () => typeof window !== 'undefined' && (window.innerWidth < 768 || window.innerHeight < 500)
  );
  useEffect(() => {
    const updateCompactViewport = () =>
      setCompactViewport(window.innerWidth < 768 || window.innerHeight < 500);
    window.addEventListener('resize', updateCompactViewport);
    return () => window.removeEventListener('resize', updateCompactViewport);
  }, []);
  /**
   * Tabela nie ma płótna React Flow, więc nie ma `CanvasZoomControls`, a co za
   * tym idzie — gniazda. Nie zgadujemy tego z DOM (to by dało migotanie albo,
   * jak w pierwszym podejściu, ZNIKNIĘCIE przełącznika w Tabeli): jedziemy z
   * `activeTool`, który jest deterministyczny. Tabela zostaje na dzisiejszej
   * ścieżce — własna pigułka w rogu. To NAZWANY wyjątek, nie przeoczenie.
   */
  const bezPlotna = activeTool === 'table';
  const doGniazda = zjednoczonyPasek && !bezPlotna && !compactViewport;
  // Gniazdo w pigułce zoomu. Montuje się razem z `CanvasZoomControls`, czyli
  // PÓŹNIEJ niż my i na nowo przy każdej zmianie narzędzia — stąd krótkie
  // dopytywanie, a nie jednorazowe `getElementById` na starcie.
  const [gniazdo, setGniazdo] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!doGniazda) {
      setGniazdo(null);
      return;
    }
    let tiki = 0;
    const szukaj = () => {
      const el = document.getElementById(IDEA_BOTTOM_BAR_SWITCHER_SLOT_ID);
      setGniazdo((poprzednie) => (poprzednie === el ? poprzednie : el));
    };
    szukaj();
    const raf = requestAnimationFrame(szukaj);
    // Kontrolki rogu montują się później niż my (płótno ładuje graf) — stąd
    // krótkie dopytywanie; pętla wygasa po ~6 s, żeby nie tykać w nieskończoność.
    const interwal = window.setInterval(() => {
      szukaj();
      if (++tiki > 20) window.clearInterval(interwal);
    }, 300);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(interwal);
    };
  }, [doGniazda, activeTool]);

  useEffect(() => {
    // Wchodzimy do gniazda => zero pomiaru; pozycję narzuca pigułka zoomu.
    if (doGniazda) return;
    const measure = () => {
      const canvas = document.querySelector('[data-testid="mels-canvas"]');
      if (!canvas) {
        setBox(null);
        return;
      }
      const r = canvas.getBoundingClientRect();
      // Każda reprezentacja renderuje własny klaster zoom/dopasuj/minimapy w
      // prawym-dolnym rogu (React Flow / kontrolki Tabeli). D2 chce przełącznik
      // OBOK nich — właściciel 2026-07-24: „zrób je koło siebie, a nie jeden na
      // drugim". Szukamy klastra i siadamy W TYM SAMYM RZĘDZIE, na lewo od
      // niego, wyrównani DOŁEM. Gdy klastra nie ma (np. Tabela bez minimapy),
      // kotwiczymy do prawego-dolnego rogu płótna.
      let rightOffset = window.innerWidth - r.right + rightInset;
      let bottomOffset = window.innerHeight - r.bottom + 12;
      const rogi = [
        ...document.querySelectorAll<HTMLElement>(
          '.z-dropdown, .react-flow__controls, [class*="bottom-3"][class*="right-3"]'
        ),
      ];
      let lewaKrawedzKlastra = Infinity;
      let dolKlastra = -Infinity;
      let gornaKrawedzKlastra = Infinity;
      for (const el of rogi) {
        if (el.getAttribute('data-testid') === 'idea-view-switcher') continue;
        if (el.closest('[data-testid="idea-view-switcher"]')) continue;
        const er = el.getBoundingClientRect();
        if (er.width < 20 || er.height < 15) continue;
        // tylko elementy realnie w prawym-dolnym rogu płótna
        if (er.right > r.right - 320 && er.bottom > r.bottom - 140) {
          lewaKrawedzKlastra = Math.min(lewaKrawedzKlastra, er.left);
          dolKlastra = Math.max(dolKlastra, er.bottom);
          gornaKrawedzKlastra = Math.min(gornaKrawedzKlastra, er.top);
        }
      }
      if (lewaKrawedzKlastra !== Infinity) {
        const wlasnaSzerokosc = anchorRef.current?.offsetWidth ?? 148;
        const wlasnaWysokosc = anchorRef.current?.offsetHeight ?? 42;

        // Inne pływające karty przy dolnej krawędzi płótna (podpowiedź AI jest
        // wyśrodkowana `left-1/2`, więc na wąskim oknie sięga aż tutaj). Rząd
        // obok klastra nie może ich przykryć — „Działaj" musi zostać klikalny.
        const przeszkody: DOMRect[] = [];
        for (const el of document.querySelectorAll<HTMLElement>('body *')) {
          if (el.closest('[data-testid="idea-view-switcher"]')) continue;
          const cs = getComputedStyle(el);
          if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
          if (cs.pointerEvents === 'none' || cs.visibility === 'hidden') continue;
          const er = el.getBoundingClientRect();
          if (er.width < 40 || er.height < 20) continue;
          // Przeszkodą jest pływająca KARTA, nie wielka warstwa tła płótna
          // (`react-flow__pane`/`__renderer` też są absolute i pokrywają cały
          // dolny pas — bez tego filtra rząd nigdy by się nie ułożył).
          if (er.width > r.width * 0.6 || er.height > 160) continue;
          if (el.contains(canvas)) continue;
          if (er.bottom < r.bottom - 160 || er.top > r.bottom) continue;
          // sam klaster kotwiczący nie jest przeszkodą — obok niego siadamy
          if (er.left >= lewaKrawedzKlastra - 1 && er.bottom >= dolKlastra - 1) continue;
          przeszkody.push(er);
        }

        // Kotwiczymy PRAWĄ krawędź przełącznika 8px na lewo od LEWEJ krawędzi
        // klastra — dzięki temu nie musimy znać własnej szerokości do pozycji.
        const obokPrawa = lewaKrawedzKlastra - 8;
        const obokLewa = obokPrawa - wlasnaSzerokosc;
        const obokDol = dolKlastra;
        const obokGora = obokDol - wlasnaWysokosc;

        const miesciSieWPlotnie = obokLewa >= r.left + 8;
        const wchodziNaKogos = przeszkody.some(
          (p) =>
            !(
              obokPrawa <= p.left ||
              obokLewa >= p.right ||
              obokDol <= p.top ||
              obokGora >= p.bottom
            )
        );

        if (miesciSieWPlotnie && !wchodziNaKogos) {
          // ★ Układ preferowany (właściciel 2026-07-24: „zrób je koło siebie,
          //   a nie jeden na drugim") — jeden rząd, wyrównany dołem.
          rightOffset = window.innerWidth - lewaKrawedzKlastra + 8;
          bottomOffset = window.innerHeight - dolKlastra;
        } else {
          // Nie ma miejsca w rzędzie (wąskie płótno albo karta podpowiedzi) —
          // wracamy na piętro nad klaster. Lepiej piętro niż nachodzenie.
          rightOffset = window.innerWidth - r.right + rightInset;
          bottomOffset = window.innerHeight - gornaKrawedzKlastra + 8;
        }
      }
      const compactCanvas = r.width < 720 || r.height < 260;
      setBox(
        compactCanvas
          ? {
              // At 200% zoom the bottom controls and the canvas empty state
              // occupy the same narrow band. Keep the representation switcher
              // actionable in the top-left safe area instead of stacking it
              // over tool CTAs.
              left: Math.max(0, r.left + 12),
              top: Math.max(0, r.top + 8),
            }
          : {
              right: Math.max(0, rightOffset),
              bottom: Math.max(0, bottomOffset),
            }
      );
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    const canvas = document.querySelector('[data-testid="mels-canvas"]');
    if (ro && canvas) ro.observe(canvas);
    window.addEventListener('resize', measure);
    // Kontrolki rogu (zoom/minimapa) montują się później niż my — re-mierzymy
    // kilka razy w pierwszej sekundzie, żeby usiąść nad nimi, gdy się pojawią.
    const raf = requestAnimationFrame(measure);
    const timery = [150, 400, 900, 1600].map((ms) => setTimeout(measure, ms));
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
      timery.forEach(clearTimeout);
    };
  }, [rightInset, doGniazda]);

  const przyciski = (
    <>
      {TOOL_CONFIG.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        const hasContent = (familyCounts?.[tool.id] ?? 0) > 0;
        const label = getIdeaWorkspaceToolLabel(tool.id, isPl);
        return (
          <div key={tool.id} className="relative">
            <button
              type="button"
              data-testid={`idea-view-switcher-${tool.id}`}
              onClick={() => onToolChange(tool.id)}
              title={label}
              aria-label={label}
              aria-pressed={isActive}
              className={`flex h-11 w-11 items-center justify-center rounded-hig-xl transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                isActive
                  ? 'bg-c-surface dark:bg-c-surface-raised text-c-text dark:text-c-text'
                  : 'text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface dark:hover:bg-c-surface-raised'
              }`}
            >
              <Icon size={15} aria-hidden="true" />
            </button>
            {hasContent && !isActive && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-c-info/60 pointer-events-none" />
            )}
          </div>
        );
      })}
    </>
  );

  // ── Flaga ON: jeden rząd — wchodzimy DO pigułki zoomu ────────────────────
  if (doGniazda) {
    if (!gniazdo) return null;
    return createPortal(
      <div
        ref={anchorRef}
        data-testid="idea-view-switcher"
        data-compact-viewport={String(compactViewport)}
        className="flex items-center gap-0.5"
      >
        {przyciski}
        {/* Separator po naszej stronie, nie po stronie gniazda — puste gniazdo
            nie zostawia wtedy sierocej kreski przy samym „−". */}
        <div className="w-px h-5 bg-c-border-subtle dark:bg-c-border-subtle mx-0.5" />
      </div>,
      gniazdo
    );
  }

  // ── Flaga OFF: dzisiejsza ścieżka (własna pigułka, pomiar heurystyczny) ──
  if (!box) return null;

  const node = (
    <div
      ref={anchorRef}
      className="fixed z-dropdown pointer-events-auto flex items-center gap-0.5 rounded-hig-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-sm border border-c-border-subtle dark:border-c-border-subtle shadow-hig-xl px-1 py-1"
      style={{ left: box.left, right: box.right, top: box.top, bottom: box.bottom }}
      data-testid="idea-view-switcher"
      data-compact-viewport={String(compactViewport)}
    >
      {przyciski}
    </div>
  );

  // 2026-07-28: `body` poza pełnym ekranem, element pełnoekranowy w pełnym
  // ekranie — inaczej przełącznik znikał razem z lewym paskiem (to samo
  // pochodzenie błędu: portal do rodzeństwa elementu pełnoekranowego).
  if (!portalTarget) return null;
  return createPortal(node, portalTarget);
}
