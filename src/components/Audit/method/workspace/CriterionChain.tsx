/**
 * CriterionChain — łańcuch kroków Criterion Workspace, ZAWSZE widoczny (nie
 * ukryty w akordeonie/tabach). Osiemnaście ogniw, DOSŁOWNIE jak w mandacie:
 *
 *   kryterium/źródło → pytanie audytowe → oczekiwany dowód → dostarczony
 *   dowód → procedura audytora → próba → wykonany test → wynik testu →
 *   wniosek audytora → status zgodności → ustalenie → odpowiedź właściciela →
 *   korekcja → przyczyna źródłowa → działanie korygujące → właściciel/termin
 *   → weryfikacja skuteczności → zamknięcie
 *
 * Ten komponent renderuje TYLKO pasek postępu (18 kropek/etykiet w kolejności,
 * `data-testid="chain-step-<id>"`) — treść każdego ogniwa (pola, formularze,
 * panele) mieszka w `CriterionWorkspace`/`EvidencePanel`/`FindingPanel`/
 * `RemediationPanel`, każde we WŁASNEJ, osobnej sekcji
 * (`data-testid="chain-link-<id>"`) — nigdy zlane w jeden formularz
 * „odpowiedź" (kanon mandatu W1: „audyt nie jest ankietą").
 *
 * Ogniwo NIEOSIĄGALNE (np. „ustalenie" zanim jest wykonany test) renderuje się
 * jako nieaktywne Z WYJAŚNIENIEM, czego brakuje — nigdy niema blokada.
 */
import { Check, Circle, Lock } from 'lucide-react';
import React from 'react';

export type ChainLinkState = 'done' | 'current' | 'inactive';

export interface ChainLink {
  id: string;
  label: string;
  state: ChainLinkState;
  /** Wymagane, gdy `state === 'inactive'` — dlaczego to ogniwo jest jeszcze nieosiągalne. */
  reason?: string;
}

export interface CriterionChainProps {
  links: ChainLink[];
  isPolish: boolean;
}

const STATE_DOT: Record<ChainLinkState, React.ReactNode> = {
  done: <Check size={11} aria-hidden />,
  current: <Circle size={11} className="fill-current" aria-hidden />,
  inactive: <Lock size={10} aria-hidden />,
};

const STATE_CLASS: Record<ChainLinkState, string> = {
  done: 'border-c-success/40 bg-c-success/10 text-c-success',
  // `text-c-focus` is the translucent ring token (rgba, alpha 0.4) — fine for
  // borders/rings, too low-contrast for text (axe color-contrast, serious).
  // `text-c-focus-solid` on `bg-c-focus/10` (the pairing used elsewhere, e.g.
  // IdeaPanelHistory) measures 4.32:1 on THIS chip in light mode — under the
  // 4.5:1 AA floor (verified with a real Playwright + axe render, not a
  // static-token guess: the composited chip background here differs enough
  // from other call sites that the same pairing does not clear AA on it).
  // `/5` instead of `/10` lightens the wash just enough to clear 4.5:1 in
  // both themes (measured ~4.77:1 light / ~4.68:1 dark) while keeping the
  // same blue-focus family and the same token names — no new colour.
  current: 'border-c-focus/50 bg-c-focus/5 text-c-focus-solid',
  inactive: 'border-c-border-subtle bg-c-surface text-c-text-muted',
};

export const CriterionChain: React.FC<CriterionChainProps> = ({ links, isPolish }) => {
  return (
    <nav
      data-testid="criterion-chain"
      aria-label={isPolish ? 'Łańcuch kroków audytu' : 'Audit step chain'}
      // Potentially-scrollable region (overflow-x-auto) must itself be
      // reachable by keyboard (axe scrollable-region-focusable, serious) —
      // the nav already carries a role+name, tabIndex just makes it focusable.
      tabIndex={0}
      className="flex flex-wrap items-center gap-1.5 overflow-x-auto rounded-token-md border border-c-border-subtle bg-c-surface-raised/30 p-2"
    >
      {links.map((link, i) => (
        <React.Fragment key={link.id}>
          <div
            data-testid={`chain-step-${link.id}`}
            data-state={link.state}
            title={link.state === 'inactive' ? link.reason : undefined}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${STATE_CLASS[link.state]}`}
          >
            {STATE_DOT[link.state]}
            <span>{link.label}</span>
          </div>
          {i < links.length - 1 && <span className="shrink-0 text-c-text-muted/40">→</span>}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default CriterionChain;
