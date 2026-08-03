/**
 * PriorityChip — priorytet w wierszu tabeli: kropka + tonowany tekst.
 *
 * KANON TRIADA A4: priorytet NIE jest pigułką. Do 2026-07-28 ten komponent
 * opakowywał treść w `ChipBase`, czyli neutralne tło + ramkę + `rounded-full` —
 * i to właśnie wychodziło na zrzutach jako „pigułka `● MEDIUM` z tłem"
 * (N-29 / N-24 w przeglądzie 128 zrzutów). Ponieważ ten sam komponent karmi
 * SZEŚĆ tabel — Initiatives→Portfolio, My Work→Decisions, Discovery Tools,
 * Tools→Assessment, Interview, Execution — poprawka siedzi tutaj, a nie
 * w sześciu wywołaniach.
 *
 * Wzorcem jest tabela Tasks (jedyny ekran, o którym Piotr powiedział
 * „na moje ok"): kolor niesie wyłącznie kropka, tekst jest tonowany.
 * Skala mieszka we wspólnym `standard/PriorityCell`.
 *
 * Drugi naprawiony tutaj rozjazd — N-79: ekrany podawały `label` prosto
 * z bazy, więc w sąsiednich wierszach stało `MEDIUM`, `Medium` i `medium`.
 * Etykieta poziomu to nazwa własna skali, nie treść użytkownika, więc jest
 * normalizowana do jednego zapisu.
 */

import React from 'react';

import { PriorityCell } from '@/components/standard/PriorityCell';

import { type ChipSize } from './chipBase';

export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low';

const PRIORITY_FALLBACK_LABEL: Record<PriorityLevel, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** `MEDIUM` / `medium` / `Medium` → `Medium`. Nie-tekstowe etykiety zostawia bez zmian. */
function normalizeLabel(label: React.ReactNode): React.ReactNode {
  if (typeof label !== 'string') return label;
  const trimmed = label.trim();
  if (!trimmed) return label;
  // Wielowyrazowe etykiety (np. "Very high") — każde słowo osobno.
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export interface PriorityChipProps {
  level: PriorityLevel;
  /** Override the visible label (e.g. localized). Defaults to a capitalized level. */
  label?: React.ReactNode;
  /** Zachowane dla zgodności API — geometria pigułki zniknęła wraz z jej tłem. */
  size?: ChipSize;
  className?: string;
  title?: string;
}

export const PriorityChip: React.FC<PriorityChipProps> = ({ level, label, className, title }) => (
  <span title={title}>
    <PriorityCell
      value={level}
      label={normalizeLabel(label ?? PRIORITY_FALLBACK_LABEL[level])}
      className={className}
    />
  </span>
);

export default PriorityChip;
