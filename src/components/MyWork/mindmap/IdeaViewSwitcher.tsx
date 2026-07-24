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
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getIdeaWorkspaceToolLabel, TOOL_CONFIG } from '../IdeaWorkspaceToolbar';
import type { CanvasToolType } from '../ideaSelectionTypes';

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
  const [box, setBox] = useState<{ right: number; bottom: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const canvas = document.querySelector('[data-testid="mels-canvas"]');
      if (!canvas) {
        setBox(null);
        return;
      }
      const r = canvas.getBoundingClientRect();
      // Każda reprezentacja renderuje własny klaster zoom/dopasuj/minimapy w
      // prawym-dolnym rogu (React Flow / kontrolki Tabeli). D2 chce przełącznik
      // OBOK nich, a twardy wymóg zakazuje nakładania. Szukamy tego klastra i
      // siadamy DOKŁADNIE nad nim; gdy go nie ma (np. Tabela bez minimapy),
      // kotwiczymy do dolnej krawędzi płótna.
      // Fallback: nawet gdy nie zmierzymy klastra (montuje się później niż my),
      // siadamy 60px nad dolną krawędzią — NIGDY dokładnie na rogu, gdzie są
      // kontrolki. Gdy klaster znajdziemy, kotwiczymy dokładnie nad nim.
      let bottomOffset = window.innerHeight - r.bottom + 60;
      const rogi = [
        ...document.querySelectorAll<HTMLElement>(
          '.z-dropdown, .react-flow__controls, [class*="bottom-3"][class*="right-3"]'
        ),
      ];
      let najwyzszyGorny = Infinity;
      for (const el of rogi) {
        if (el.getAttribute('data-testid') === 'idea-view-switcher') continue;
        if (el.closest('[data-testid="idea-view-switcher"]')) continue;
        const er = el.getBoundingClientRect();
        if (er.width < 20 || er.height < 15) continue;
        // tylko elementy realnie w prawym-dolnym rogu płótna
        if (er.right > r.right - 320 && er.bottom > r.bottom - 140) {
          najwyzszyGorny = Math.min(najwyzszyGorny, er.top);
        }
      }
      if (najwyzszyGorny !== Infinity) {
        // nad klastrem: dół przełącznika = góra klastra + 8px odstępu
        bottomOffset = window.innerHeight - najwyzszyGorny + 8;
      }
      setBox({
        right: Math.max(0, window.innerWidth - r.right + rightInset),
        bottom: Math.max(0, bottomOffset),
      });
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
  }, [rightInset]);

  if (!box) return null;

  const node = (
    <div
      ref={anchorRef}
      className="fixed z-dropdown pointer-events-auto flex items-center gap-0.5 rounded-hig-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-sm border border-c-border-subtle dark:border-c-border-subtle shadow-hig-xl px-1 py-1"
      style={{ right: box.right, bottom: box.bottom }}
      data-testid="idea-view-switcher"
    >
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
              className={`flex h-8 w-8 items-center justify-center rounded-hig-xl transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
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
    </div>
  );

  return createPortal(node, document.body);
}
