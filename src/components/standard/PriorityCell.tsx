/**
 * PriorityCell — kanoniczna prezentacja priorytetu / pilności w listach.
 *
 * KANON TRIADA A4: priorytet to **kropka + tonowany TEKST**, nigdy wypełniona
 * pigułka z tłem. Powód (decyzja Piotra 2026-07-04, potwierdzona w przeglądzie
 * 128 zrzutów 2026-07-27): wypełnione czerwone pigułki zamieniają listę
 * w ścianę alarmów, w której nic już nie alarmuje.
 *
 * Dlaczego ten plik istnieje — N-24 / N-29 z przeglądu:
 * priorytet miał CZTERY niezależne implementacje i trzy z nich łamały kanon:
 *   - tabela Tasks              → kropka + tekst  ✓ (wzorzec, ekran przyjęty przez Piotra)
 *   - My Work → Inbox           → czerwona pigułka z tłem i ramką  ✗
 *   - My Work → Decisions       → pigułka `● Medium` z tłem  ✗
 *   - kanban Tasks              → pełna pigułka `● CRITICAL` UPPERCASE  ✗
 *   - Initiatives → Portfolio   → pigułka `● MEDIUM` z tłem  ✗
 * Najostrzej widać to było w module Tasks: ta sama encja miała dwa różne
 * standardy priorytetu w tabeli i na kanbanie.
 *
 * Skala kolorów jest przeniesiona 1:1 z `getPriorityConfig` w
 * `MyWork/MyTasksListContent.tsx`, żeby wzorcowy ekran nie zmienił wyglądu
 * ani o piksel po przepięciu na wspólny komponent.
 */
import React from 'react';

export type PriorityTone = 'critical' | 'high' | 'medium' | 'low' | 'normal';

export interface PriorityToneStyle {
  /** Kolor tekstu — tonowany, nie krzyczy. */
  text: string;
  /** Kolor kropki — jedyny nośnik semantyki. */
  dot: string;
}

const TONES: Record<PriorityTone, PriorityToneStyle> = {
  critical: { text: 'text-danger-700 dark:text-danger-300', dot: 'bg-danger-500' },
  high: { text: 'text-c-text-secondary', dot: 'bg-amber-500' },
  medium: { text: 'text-c-text-secondary', dot: 'bg-blue-500' },
  low: { text: 'text-c-text-muted', dot: 'bg-slate-400' },
  normal: { text: 'text-c-text-muted', dot: 'bg-slate-400' },
};

/**
 * Sprowadza dowolny zapis priorytetu z bazy do jednego z pięciu tonów.
 * Przyjmuje `CRITICAL`, `critical`, `Urgent`, `p1` itd. — przegląd znalazł
 * `commercial`/`COMMERCIAL` i `medium`/`MEDIUM` na przemian w sąsiednich
 * wierszach (N-59, N-79), więc normalizacja jest częścią kontraktu.
 */
export function priorityTone(value?: string | null): PriorityTone {
  switch (
    String(value ?? '')
      .toLowerCase()
      .trim()
  ) {
    case 'urgent':
    case 'critical':
    case 'p0':
    case 'p1':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
    case 'normal_high':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'normal';
  }
}

export function priorityToneStyle(value?: string | null): PriorityToneStyle {
  return TONES[priorityTone(value)];
}

export interface PriorityCellProps {
  /** Surowa wartość z rekordu — normalizowana wewnątrz. */
  value?: string | null;
  /**
   * Etykieta do pokazania. Podaj przetłumaczoną; gdy pominięta, komponent
   * pokazuje wartość surową (lepsze niż pusta komórka, ale to nie jest
   * docelowa ścieżka — etykiety należą do warstwy i18n ekranu).
   */
  label?: React.ReactNode;
  /** Dodatkowe klasy kontenera (np. szerokość kolumny). */
  className?: string;
  /** Gdy priorytet jest pusty — co pokazać. Domyślnie myślnik (kanon C7). */
  emptyLabel?: string;
}

export const PriorityCell: React.FC<PriorityCellProps> = ({
  value,
  label,
  className,
  emptyLabel = '—',
}) => {
  if (!value) {
    return <span className={`text-xs text-c-text-muted ${className ?? ''}`}>{emptyLabel}</span>;
  }

  const tone = priorityToneStyle(value);
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${tone.text} ${className ?? ''}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
      {label ?? value}
    </span>
  );
};

export default PriorityCell;
