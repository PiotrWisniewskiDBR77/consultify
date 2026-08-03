/**
 * ArtifactPropertiesTable — wspólna tabela „Właściwości" prawego panelu artefaktu.
 *
 * SSOT: Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §11.2 (sekcja properties).
 * Wzorzec wyekstrahowany z TaskDetailView (referencja jakości, akcept Piotra 2026-07-22).
 *
 * Zasada „standard jest KODEM": każda N-karta (Task·Decision·Interview·Notification·
 * Insight·Tool·Initiative) renderuje sekcję `properties` prawego panelu WYŁĄCZNIE
 * przez ten komponent — moduł DEKLARUJE wiersze (label + value), komponent NARZUCA
 * wygląd (kontener, nagłówek Property/Value, ramki, tdKey/tdVal, ostatni wiersz bez
 * dolnej linii). Zero bespoke tabel properties per karta.
 *
 * Wygląd: kontener `rounded-lg border border-c-border-subtle overflow-hidden`,
 * nagłówek `bg-c-surface-raised` (Property left / Value right), wiersze z
 * `border-b border-c-border-subtle` (ostatni bez), klucz `text-c-text-muted`,
 * wartość `text-right text-c-text`. Wyłącznie tokeny c-* (zero navy/slate/hex/crimson).
 *
 * Value to dowolny ReactNode — pill statusu, select edytowalny, tekst, „—".
 * Karta odpowiada za treść wartości; komponent tylko za ramę i styl.
 */
import React from 'react';

export interface ArtifactPropertyRow {
  /** Stabilny klucz Reacta (zwykle id właściwości). */
  id: string;
  /** Etykieta właściwości (już przetłumaczona). */
  label: string;
  /** Wartość — pill / select / tekst / ReactNode. Gdy pusto, karta podaje '—'. */
  value: React.ReactNode;
  /** Cyfry w kolumnie (daty, liczby) — wyrównanie tabular-nums. */
  mono?: boolean;
}

export interface ArtifactPropertiesTableProps {
  /** Wiersze w kolejności deklaracji. */
  rows: ArtifactPropertyRow[];
  /** Nagłówek kolumny klucza (przetłumaczony; np. „Właściwość"/„Property"). */
  propertyLabel: string;
  /** Nagłówek kolumny wartości (przetłumaczony; np. „Wartość"/„Value"). */
  valueLabel: string;
}

const TH_BASE = 'font-medium text-c-text-muted px-3 py-2 border-b border-c-border-subtle';
const TD_KEY = 'px-3 py-2 text-c-text-muted';
const TD_VAL = 'px-3 py-2 text-right text-c-text';

export const ArtifactPropertiesTable: React.FC<ArtifactPropertiesTableProps> = ({
  rows,
  propertyLabel,
  valueLabel,
}) => {
  return (
    <div className="rounded-lg border border-c-border-subtle overflow-hidden">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-c-surface-raised">
            <th className={`text-left ${TH_BASE}`}>{propertyLabel}</th>
            <th className={`text-right ${TH_BASE}`}>{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const last = i === rows.length - 1;
            const border = last ? '' : ' border-b border-c-border-subtle';
            return (
              <tr key={row.id}>
                <td className={`${TD_KEY}${border}`}>{row.label}</td>
                <td className={`${TD_VAL}${border}${row.mono ? ' tabular-nums' : ''}`}>
                  {row.value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ArtifactPropertiesTable;
