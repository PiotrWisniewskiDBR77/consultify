/**
 * IdeaTeresaSection — treść trzeciej karty panelu idei = TERESA (D16/D17).
 *
 * Zastępuje dawną osobną kartę „AI Suggestions": trzecia karta JEST Teresą —
 * (a) skrót do JEDNEJ dokowanej Teresy (prawa strona, kontekst idei) przez
 *     `onDiscuss` (workspace `handleDiscussWithTeresa` → globalny dok czatu),
 * (b) chipy KOMEND kontekstowych (Uzupełnij puste · Synteza · Kontrola jakości ·
 *     Kontynuuj) zasiewane do Teresy KANONICZNYM kanałem pending-prompt
 *     (`consultify.teresa.pendingPrompt` + event — dokładnie jak InsightViewer
 *     po D17-faza1 i AIConsultantPanel), NIGDY drugi czat,
 * (c) proaktywny strumień sugestii = reużyty `<IdeaAISuggestionsPanel embedded>`
 *     1:1 (sugestie AI jako proaktywne wiadomości Teresy w tej karcie — D16).
 *
 * Wyłącznie tokeny `c-*`. CTA/stany aktywne = neutralne; fokus = c-focus.
 * Zero crimson (pułapka `primary-*`).
 *
 * ★ Rozwożenie prawego pasa (2026-08-30, docs/program/grafika/ANALIZA_PRAWY_PANEL.md
 * §3/§4): za flagą `ff_artifact_right_rail` Teresa przestaje być tą kartą
 * akordeonu — staje się IKONĄ SZYNY w `IdeaRightPanel`/`ArtifactRightRail`.
 * `IDEA_TERESA_COMMANDS` i `seedIdeaTeresaPrompt` są WYEKSPORTOWANE właśnie
 * po to, żeby wołający (`IdeaMapWorkspace`) mógł zbudować te same 4 komendy
 * dla trybu Teresy szyny — JEDNO źródło treści komend, nie druga kopia
 * etykiet/promptów. Ten komponent (i jego OFF-owa ścieżka akordeonu) zostaje
 * bez zmian zachowania.
 */
import {
  CheckCircle2,
  type LucideIcon,
  MessageSquarePlus,
  RefreshCw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import React, { useCallback, useMemo } from 'react';

import { IdeaAISuggestionsPanel } from './IdeaAISuggestionsPanel';

/** Kanoniczny kanał zasiewu promptu do dokowanej Teresy (parytet z InsightViewer/AIConsultantPanel). */
export function seedIdeaTeresaPrompt(prompt: string): void {
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        'consultify.teresa.pendingPrompt',
        JSON.stringify({ prompt, ts: Date.now() })
      );
      window.dispatchEvent(new CustomEvent('consultify:teresa-pending-prompt'));
    }
  } catch {
    // Non-critical — otwarcie Teresy (onDiscuss) i tak nastąpi.
  }
}

export interface IdeaTeresaCommand {
  id: string;
  label: string;
  labelEn: string;
  icon: LucideIcon;
  promptPl: string;
  promptEn: string;
}

export const IDEA_TERESA_COMMANDS: IdeaTeresaCommand[] = [
  {
    id: 'fill-empty',
    label: 'Uzupełnij puste',
    labelEn: 'Fill empty',
    icon: Wand2,
    promptPl:
      'Uzupełnij puste i słabe miejsca tej mapy/idei dobrze uzasadnioną propozycją, opartą na istniejącym kontekście. Wskaż, co dokładasz.',
    promptEn:
      'Fill the empty and weak parts of this map/idea with a well-reasoned proposal grounded in the existing context. Call out what you add.',
  },
  {
    id: 'synthesize',
    label: 'Synteza',
    labelEn: 'Synthesize',
    icon: Sparkles,
    promptPl:
      'Zsyntetyzuj tę ideę: wydobądź kluczowe wątki, napięcia i myśl przewodnią spinającą całość.',
    promptEn:
      'Synthesize this idea: surface the key threads, tensions, and the through-line across the whole.',
  },
  {
    id: 'quality-check',
    label: 'Kontrola jakości',
    labelEn: 'Quality check',
    icon: CheckCircle2,
    promptPl:
      'Zrób kontrolę jakości tej idei: czego brakuje, co jest słabe, sprzeczne lub niegotowe? Podaj listę priorytetową.',
    promptEn:
      'Do a quality check of this idea: what is missing, weak, contradictory, or not ready? Give a prioritized list.',
  },
  {
    id: 'continue',
    label: 'Kontynuuj',
    labelEn: 'Continue',
    icon: RefreshCw,
    promptPl:
      'Kontynuujmy pracę nad tą ideą od miejsca, w którym skończyliśmy — jaki jest najbardziej wartościowy następny krok i pomóż mi go wykonać.',
    promptEn:
      'Continue where we left off on this idea — what is the most valuable next step, and help me do it.',
  },
];

export interface IdeaTeresaSectionProps {
  /** Otwiera JEDNĄ dokowaną Teresę z kontekstem idei (workspace handleDiscussWithTeresa). */
  onDiscuss?: () => void;
  /** Nieprzezroczysty bundle propsów dla <IdeaAISuggestionsPanel> (buduje go workspace). */
  aiSuggestionsProps: Record<string, unknown>;
  isPolish?: boolean;
}

export const IdeaTeresaSection: React.FC<IdeaTeresaSectionProps> = ({
  onDiscuss,
  aiSuggestionsProps,
  isPolish = false,
}) => {
  const runCommand = useCallback(
    (cmd: IdeaTeresaCommand) => {
      // Otwórz JEDNĄ dokowaną Teresę, potem zasiej prompt komendy.
      onDiscuss?.();
      seedIdeaTeresaPrompt(isPolish ? cmd.promptPl : cmd.promptEn);
    },
    [onDiscuss, isPolish]
  );

  const commands = useMemo(() => IDEA_TERESA_COMMANDS, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Skrót do jednej dokowanej Teresy — neutralny CTA (zero crimson). */}
      <button
        type="button"
        onClick={() => onDiscuss?.()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-c-border bg-c-surface px-3 py-2 text-xs font-medium text-c-text transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] focus-visible:ring-inset"
      >
        <MessageSquarePlus size={14} className="text-c-text-muted" />
        {isPolish ? 'Rozmawiaj z Teresą' : 'Discuss with Teresa'}
      </button>

      {/* Chipy komend kontekstowych — zasiew promptu do Teresy. */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
          {isPolish ? 'Komendy' : 'Commands'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {commands.map((cmd) => (
            <button
              key={cmd.id}
              type="button"
              onClick={() => runCommand(cmd)}
              className="inline-flex items-center gap-1.5 rounded-full border border-c-border bg-c-surface px-2.5 py-1 text-[11px] font-medium text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] focus-visible:ring-inset"
            >
              <cmd.icon size={13} className="text-c-text-muted" aria-hidden="true" />
              {isPolish ? cmd.label : cmd.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Proaktywny strumień sugestii Teresy — reużyty 1:1, embedded (bez chromu szuflady). */}
      <div className="-mx-4 border-t border-c-border-subtle pt-1">
        <IdeaAISuggestionsPanel {...(aiSuggestionsProps as any)} open embedded />
      </div>
    </div>
  );
};

export default IdeaTeresaSection;
