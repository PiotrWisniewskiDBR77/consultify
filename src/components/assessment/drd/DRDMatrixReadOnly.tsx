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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const axis = DRD_STRUCTURE.find((a) => a.id === axisNumber);
  if (!axis) {
    // Bez zgadywania: nie rysujemy siatki udającej macierz osi, której
    // w przypiętej metodyce nie ma.
    return (
      <p className="text-sm text-c-text-secondary">
        {t('assessment.drd.matrix.readOnly.axisNotFound', {
          axisNumber,
          defaultValue:
            "This axis's matrix can't be drawn: axis {{axisNumber}} structure is not present in the methodology pinned to this Output.",
        })}
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
      overflowHint={(n) =>
        t('assessment.drd.matrix.readOnly.overflowHint', {
          count: n,
          defaultValue: '{{count}} more column to the right — scroll to see it.',
          defaultValue_other: '{{count}} more columns to the right — scroll to see them.',
        })
      }
    />
  );
};

export default DRDMatrixReadOnly;
