/**
 * TeresaEntryButton — JEDNO wejście do Teresy z panelu artefaktu/narzędzia.
 *
 * DECYZJA WŁAŚCICIELA 2026-09-01 (docs/program/grafika/KANON_Z_ODBIOROW.md,
 * sekcja „JEDNA TERESA, W SWOIM OKNIE"): czat Teresy znika z prawych paneli
 * narzędzi i artefaktów. W panelu zostaje WYŁĄCZNIE przycisk otwierający
 * GŁÓWNE okno Teresy z kontekstem obiektu. Jedno miejsce rozmowy w całej
 * aplikacji — zamiast N osadzonych czatów, z których każdy miał własną
 * historię, własny kontekst i własny wygląd.
 *
 * Wzorzec powstał w harnessie `dev-render/screens/prawy-pas-jedna-formula.tsx`
 * (commit 125e3ff82c) i został zaakceptowany na zrzutach; ten plik jest jego
 * produkcyjnym odpowiednikiem — 1:1 te same klasy, ta sama ikona, ten sam
 * `data-testid`, żeby zrzut z harnessu i zrzut z produktu dało się porównać
 * bez tłumaczenia.
 *
 * ETYKIETA JEST PER TYP OBIEKTU i nazywa obiekt, nie funkcję:
 *   „Zapytaj Teresę o tę notatkę" / „…o tę ideę" / „…o tę inicjatywę" /
 *   „…o tę prezentację" / „…o ten dokument".
 * Nie „AI", nie „Konsultant AI" — człowiek ma wiedzieć, o CZYM będzie rozmowa.
 *
 * TOKENY: wyłącznie neutralne `c-*`, ZERO crimson (`primary-*` w tailwindzie
 * Consultify to #85182F, patrz CLAUDE.md „Pułapka nr 1"). Fokus = `--c-focus`.
 */
import { Bot } from 'lucide-react';
import React from 'react';

export interface TeresaEntryButtonProps {
  /** Etykieta per typ obiektu, np. „Zapytaj Teresę o tę inicjatywę". */
  label: string;
  /** Otwiera GŁÓWNE okno Teresy z kontekstem obiektu (useOpenChatWithContext). */
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  /** Dopisek do klas — wyłącznie geometria (marginesy), nigdy kolor. */
  className?: string;
}

export const TeresaEntryButton: React.FC<TeresaEntryButtonProps> = ({
  label,
  onClick,
  disabled,
  title,
  className = '',
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title || label}
    data-testid="teresa-entry"
    className={`flex w-full items-center justify-center gap-2 rounded-lg border border-c-border bg-c-surface-raised px-3 py-2 text-xs font-medium text-c-text transition-colors hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
  >
    <Bot size={13} className="text-c-text-muted" />
    {label}
  </button>
);

export default TeresaEntryButton;
