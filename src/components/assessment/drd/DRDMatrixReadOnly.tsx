/**
 * DRDMatrixReadOnly — macierz DRD właściciela w wydaniu DO CZYTANIA
 * (raport z oceny, slajd prezentacji), bez edycji.
 *
 * ★ PO CO TEN PLIK ISTNIEJE. Właściciel trzy razy zgłosił to samo:
 * „Ciągle nie wiem dlaczego nie używasz mojej macierzy DRD — nie mam już siły
 * serio!!" (01.09). Raport i prezentacja rysowały `AreaMatrixTable` — komponent,
 * który właściciel odrzucił wprost (`docs/program/grafika/DZIENNIK_GRAFIKA.md`
 * Z-10) i który pokazuje siatkę z PUSTYMI komórkami. Macierz, o którą chodzi,
 * to `DRDMatrixGrid` z `DRDAssessmentEditor` — siatka z ekranu „Macierz oceny
 * DRD — obszary x poziomy" (`drd-macierz-oceny`), ocena B od właściciela 01.09.
 *
 * ★ DLACZEGO OPAKOWANIE, A NIE KOPIA. Kopii tej macierzy jest w repo już kilka
 * (`AreaMatrixTable`, `EmbeddedMatrix`, `DRDMatrixSession`) i to one są powodem
 * trzech pudeł w tej sprawie (Z-12: „kopii jest w tym repo więcej niż
 * oryginałów"). Ten plik NIE rysuje niczego sam — trzyma tylko wspólne
 * ustawienia trybu czytania i przepisanie stanu z zamrożonego Outputu, żeby
 * raport i prezentacja nie rozjechały się między sobą.
 *
 * ★ GRANICE JĘZYKOWE (decyzja właściciela, `KANON_Z_ODBIOROW.md`): angielskie
 * nazwy poziomów, obszarów i technologii ZOSTAJĄ — angielski jest wiodącym
 * językiem metodyki. Polski obowiązuje w podpisach interfejsu.
 */
import React from 'react';

import { DRDMatrixGrid, type DRDEditorAnswers } from './DRDAssessmentEditor';

import { DRD_STRUCTURE } from '@/services/drdStructure';

/**
 * Stan oceny w kształcie, którego oczekuje `DRDMatrixGrid` — przepisany 1:1
 * z zamrożonego Outputu. Żadnej nowej liczby: `current` → `achievedLevel`,
 * `target` → `targetLevel`. Obszar bez ŻADNEGO pomiaru nie dostaje wpisu,
 * więc siatka pokazuje go jako kolumnę nieocenioną — a nie jako zmierzone zero.
 */
export function drdOdpowiedziZOutputu(
  areaIds: readonly string[],
  current: Readonly<Record<string, number | null | undefined>>,
  target: Readonly<Record<string, number | null | undefined>>
): DRDEditorAnswers {
  const areas: NonNullable<DRDEditorAnswers['areas']> = {};
  for (const id of areaIds) {
    const as = current[id] ?? null;
    const to = target[id] ?? null;
    if (as === null && to === null) continue;
    areas[id] = {
      achievedLevel: as ?? 0,
      ...(to !== null ? { targetLevel: to } : {}),
    };
  }
  return { areas };
}

/** Polska odmiana: 1 kolumna · 2-4 kolumny · 5+ kolumn (z wyjątkiem 12-14). */
function polskaOdmianaKolumn(n: number): string {
  if (n === 1) return 'kolumna';
  const dziesiatki = n % 100;
  const jednosci = n % 10;
  if (jednosci >= 2 && jednosci <= 4 && !(dziesiatki >= 12 && dziesiatki <= 14)) return 'kolumny';
  return 'kolumn';
}

export interface DRDMatrixReadOnlyProps {
  /** Numer osi metodyki (1..7) — `DRD_STRUCTURE[*].id`. */
  readonly axisNumber: number;
  readonly value: DRDEditorAnswers;
  /**
   * `true` = siatka wypełnia wysokość rodzica i przewija się w środku
   * (slajd o stałym kadrze). `false` = rośnie w dół (dokument raportu).
   */
  readonly fillHeight?: boolean;
  readonly columnMinPx?: number;
}

export const DRDMatrixReadOnly: React.FC<DRDMatrixReadOnlyProps> = ({
  axisNumber,
  value,
  fillHeight = false,
  columnMinPx = 150,
}) => {
  const axis = DRD_STRUCTURE.find((a) => a.id === axisNumber);
  if (!axis) {
    // Bez zgadywania: nie rysujemy siatki udającej macierz osi, której
    // w przypiętej metodyce nie ma.
    return (
      <p className="text-sm text-c-text-secondary">
        Macierzy tej osi nie da się narysować: struktura osi {axisNumber} nie występuje w metodyce
        przypiętej do tego Outputu.
      </p>
    );
  }

  return (
    <DRDMatrixGrid
      areas={axis.areas}
      levelCount={axis.levelCount}
      value={value}
      compact
      fillHeight={fillHeight}
      columnMinPx={columnMinPx}
      /* Raport i slajd się OGLĄDA, nie klika — podpowiedź o klikaniu byłaby
         obietnicą bez pokrycia. */
      rowHint=""
      onCellClick={() => {}}
      onAreaClick={() => {}}
      areaStripLabel="Area"
      overflowHint={(n) => `Jeszcze ${n} ${polskaOdmianaKolumn(n)} po prawej — przewiń w bok.`}
    />
  );
};

export default DRDMatrixReadOnly;
