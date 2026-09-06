/**
 * P7K część A — komórki tabel raportu OKR (poziomy 1 i 2).
 *
 * Same PREZENTERY: przyjmują policzone dane z `okrReportModel.ts` i zwracają
 * węzeł. Zero pobierania danych, zero własnej tabeli — kolumny wpina
 * `StandardTable`.
 *
 * ── KOLOR (kanon UI #3, WYNIKI_ZALOZENIA §1) ──────────────────────────────
 * Czerwień (`c-danger`) WYŁĄCZNIE dla stanu krytycznego. Bursztyn
 * (`c-warning`) dla zagrożenia. Zieleń (`c-success`) wyłącznie jako KROPKA
 * i cienka ramka „na dobrej drodze”, nigdy jako wypełnienie. Brak sygnału —
 * neutralnie. Ani jednego `primary-*`.
 *
 * ── DLACZEGO PIGUŁKA NIE MA IKONY KARTY DZIAŁANIA ─────────────────────────
 * Prototyp rysuje przy „Krytyczny” ikonkę otwartej karty działania. Ta karta
 * dla OKR NIE ISTNIEJE w systemie — `evidence/p7k-wyniki/KROK_0_MAPOWANIE_
 * SSOT_SCHEMA_DTO.md` ma przy pozycji „Karta działania po odchyleniu OKR”
 * wprost status „brak”, a mechanika odchylenia to część B tej paczki, jeszcze
 * niezbudowana. Rysowanie ikony bez karty byłoby martwym afordansem
 * (obietnicą kliknięcia, które nic nie robi), więc pigułka zostaje bez ikony
 * do czasu części B. Jest to ODSTĘPSTWO OD PROTOTYPU, zgłoszone w raporcie.
 */
import React from 'react';

import { HonestValueCell } from '../../HonestValue';
import type { HonestValue } from '../../types';

import type { OkrReportState } from './okrReportModel';
import { OKR_EMPTY } from './okrReportModel';
import type { OkrReportStateCounts } from './okrReportApi';

// ==========================================
// Kolumna STAN poziomu 1 — cztery liczby z kolorowymi kropkami
// ==========================================

const DOT_CLASS: Record<'ok' | 'warn' | 'bad' | 'muted', string> = {
  ok: 'bg-c-success',
  warn: 'bg-c-warning',
  bad: 'bg-c-danger',
  muted: 'bg-c-text-muted',
};

const countOrDash = (value: number): string => (value > 0 ? String(value) : OKR_EMPTY);

export interface OkrStateCountsCellProps {
  counts: OkrReportStateCounts;
  /** Pełny opis do dymka — składany przez ekran z tłumaczeń. */
  title: string;
}

/**
 * Nagłówek kolumny to samo „STAN”; cztery liczby dostają KOLOROWE KROPKI
 * zamiast liter-skrótów (werdykt K-1d: „STAN · N / O / K / B" był
 * skrót-kodem czytelnym dopiero po odgadnięciu). Pełny opis w `title`.
 * Zero zamiast wartości nie pojawia się nigdy — puste kubełki to „—”.
 */
export const OkrStateCountsCell: React.FC<OkrStateCountsCellProps> = ({ counts, title }) => (
  <span
    title={title}
    className="inline-flex items-center whitespace-nowrap text-xs tabular-nums text-c-text-secondary"
  >
    <i aria-hidden="true" className={`mr-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS.ok}`} />
    {countOrDash(counts.onTrack)}
    <span aria-hidden="true" className="mx-1 text-c-text-muted">
      ·
    </span>
    <i aria-hidden="true" className={`mr-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS.warn}`} />
    {countOrDash(counts.atRisk)}
    <span aria-hidden="true" className="mx-1 text-c-text-muted">
      ·
    </span>
    <i aria-hidden="true" className={`mr-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS.bad}`} />
    {countOrDash(counts.critical)}
    <span aria-hidden="true" className="mx-1 text-c-text-muted">
      ·
    </span>
    <i aria-hidden="true" className={`mr-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS.muted}`} />
    {countOrDash(counts.noSignal)}
  </span>
);

// ==========================================
// Pigułka STANU rezultatu (poziom 2 i bloki karty celu)
// ==========================================

const STATE_PILL_CLASS: Record<OkrReportState, string> = {
  'on-track': 'border-c-success/40 text-c-success',
  'at-risk': 'border-c-warning/40 bg-c-warning/10 text-c-warning',
  critical: 'border-c-danger/40 bg-c-danger/10 text-c-danger',
  'no-signal': 'border-c-border-subtle text-c-text-secondary',
};

export interface OkrStatePillProps {
  state: OkrReportState;
  label: string;
  /** Dopisek do dymka (np. data ostatniego check-inu albo jego brak). */
  title?: string;
}

/** K5 werdyktu: pigułka ZAWSZE jednowierszowa (`whitespace-nowrap`), pełna
 * treść w dymku — trzyliniowa pigułka była pierwszym defektem prototypu. */
export const OkrStatePill: React.FC<OkrStatePillProps> = ({ state, label, title }) => (
  <span
    title={title ?? label}
    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATE_PILL_CLASS[state]}`}
  >
    {label}
  </span>
);

// ==========================================
// Kolumna POSTĘP
// ==========================================

export interface OkrProgressCellProps {
  value: HonestValue<number>;
  isPolish: boolean;
  notCalculableReason?: string;
}

/** Postęp jako procent, przez `HonestValueCell` — `null` daje „—”, a
 * strukturalnie niepoliczalny postęp daje odrębny znacznik „n.d.”, nigdy 0%
 * (niezmiennik programu, patrz nagłówek `HonestValue.tsx`). */
export const OkrProgressCell: React.FC<OkrProgressCellProps> = ({
  value,
  isPolish,
  notCalculableReason,
}) => (
  <HonestValueCell<number>
    value={value}
    align="right"
    isPolish={isPolish}
    notCalculableReason={notCalculableReason}
    format={(progress) =>
      `${(progress * 100).toLocaleString(isPolish ? 'pl-PL' : 'en-US', {
        maximumFractionDigits: 0,
      })}%`
    }
  />
);

// ==========================================
// Komórka tekstowa tabeli — jedna warstwa dla WSZYSTKICH kolumn tekstowych
// ==========================================

export interface OkrTextCellProps {
  value: string | null | undefined;
  /** `true` = treść opisowa, zawijana do dwóch linii (K11). */
  wrap?: boolean;
  className?: string;
  /** Podtekst pod wartością (np. ambicja pod nazwą celu). */
  hint?: string | null;
  strong?: boolean;
}

/**
 * K11/K12/K13 werdyktu 1c: komórka NIGDY nie wylewa się poza swój boks.
 * Domyślnie jedna linia z `truncate`, `wrap` daje dwie linie
 * (`line-clamp-2`), a PEŁNA treść zawsze siedzi w `title` — dzięki temu
 * pomiar „zero tekstu uciętego bez dymka” przechodzi z definicji.
 *
 * `line-clamp-2` ustawia `display:-webkit-box`, więc świadomie NIE dokładamy
 * `block` — ta sama pułapka, którą opisuje prototyp (wiersz puchł do trzech
 * linii, bo `block` z tej samej warstwy Tailwinda wygrywał kolejnością).
 */
export const OkrTextCell: React.FC<OkrTextCellProps> = ({
  value,
  wrap = false,
  className = '',
  hint,
  strong = false,
}) => {
  const text = value === null || value === undefined || value === '' ? OKR_EMPTY : value;
  const isEmpty = text === OKR_EMPTY;
  return (
    <div className="min-w-0">
      <span
        title={text}
        className={`text-sm ${
          isEmpty ? 'text-c-text-muted' : strong ? 'font-medium text-c-text' : 'text-c-text-secondary'
        } ${wrap ? 'line-clamp-2 break-normal' : 'block truncate'} ${className}`.trim()}
      >
        {text}
      </span>
      {hint ? (
        <span className="block truncate text-[10px] text-c-text-muted" title={hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
};
