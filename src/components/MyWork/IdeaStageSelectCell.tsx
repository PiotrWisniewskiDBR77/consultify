/**
 * IdeaStageSelectCell — zmiana etapu idei JEDNYM otwarciem listy, prosto z wiersza.
 *
 * P-T14 (pilotaż Tomka, DEC-496 pkt XIV): „status/priorytet w tabeli wymaga
 * 2 kliknięć zamiast 1 (rozwijana lista)". Przed zmianą etap w wierszu był
 * WYŁĄCZNIE odznaką do czytania (`IdeasTableContent.renderStageBadge`), a
 * jedyna droga zmiany prowadziła przez kebab wiersza → blok „stage" → pozycja
 * (`MyIdeasListContent.tsx` blok `id: 'stage'`). To dwa kroki menu, zanim w
 * ogóle pojawi się lista etapów.
 *
 * Dlaczego natywny `<select>` nałożony na odznakę, a nie własny popup:
 *  · kanon (TRIADA §A) zabrania klejenia własnych menu/tabel per ekran —
 *    natywna lista nie jest własnym menu, tylko kontrolką przeglądarki;
 *  · WYGLĄD WIERSZA NIE ZMIENIA SIĘ O PIKSEL: nadal renderuje się dokładnie
 *    ta sama `ChipBase` + `ChipDot` co wcześniej, a `<select>` jest przezroczystą
 *    warstwą nad nią (`opacity-0`), więc zrzuty PRZED/PO są identyczne poza
 *    kursorem i obwódką fokusu;
 *  · zero kodu pozycjonowania popupu (brak klasy błędów „menu ucieka za krawędź
 *    tabeli"), zero pułapki z portalami w wirtualizowanym wierszu;
 *  · dostępność z pudełka: rola listbox, klawiatura, czytnik ekranu.
 *
 * Zapis jest natychmiastowy (`onChange` → `handleZmienEtap` w
 * `MyIdeasListContent.tsx`): optymistyczna zmiana lokalna, toast potwierdzenia,
 * a przy błędzie toast błędu + `fetchIdeas()` cofające wiersz do stanu z bazy.
 */
import React from 'react';

import { ChipBase, ChipDot } from '@/components/ui/primitives/chips/chipBase';

import { IDEA_STAGE_BUCKET_LABELS } from './ideaEntryTypes';
import { STAGE_DOT_VAR } from './ideaPreviewMeta';
import type { IdeaStage } from './myIdeasTypes';

/** Kolejność etapów = kolejność cyklu życia idei (iskra → promowany). */
export const IDEA_STAGE_ORDER: readonly IdeaStage[] = [
  'spark',
  'incubating',
  'shaping',
  'ready',
  'promoted',
] as const;

export interface IdeaStageSelectCellProps {
  stage?: IdeaStage;
  isPolish: boolean;
  /** Brak handlera = komórka pozostaje czystą odznaką do czytania. */
  onChangeStage?: (stage: IdeaStage) => void;
  disabled?: boolean;
  /** Nazwa idei — wchodzi do etykiety dostępności, żeby czytnik nie mówił 5× „Etap". */
  ideaTitle?: string;
}

export const IdeaStageSelectCell: React.FC<IdeaStageSelectCellProps> = ({
  stage,
  isPolish,
  onChangeStage,
  disabled = false,
  ideaTitle,
}) => {
  const resolvedStage = (stage || 'spark') as IdeaStage;
  const badge = (
    <ChipBase size="sm" leading={<ChipDot colorVar={STAGE_DOT_VAR[resolvedStage]} size="sm" />}>
      {isPolish
        ? IDEA_STAGE_BUCKET_LABELS[resolvedStage].pl
        : IDEA_STAGE_BUCKET_LABELS[resolvedStage].en}
    </ChipBase>
  );

  if (!onChangeStage || disabled) return badge;

  const label = isPolish
    ? `Etap${ideaTitle ? ` — ${ideaTitle}` : ''}`
    : `Stage${ideaTitle ? ` — ${ideaTitle}` : ''}`;

  return (
    <div className="relative inline-flex items-center rounded-full focus-within:ring-2 focus-within:ring-[color:var(--c-focus)]">
      {badge}
      <select
        aria-label={label}
        data-testid="idea-stage-select"
        value={resolvedStage}
        // Zatrzymanie propagacji: wiersz tabeli ma własny `onClick` otwierający
        // podgląd/ideę — bez tego jedno kliknięcie w etap otwierałoby też ideę.
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          const next = event.target.value as IdeaStage;
          if (next === resolvedStage) return;
          onChangeStage(next);
        }}
        // Warstwa jest przezroczysta ZAWSZE — obwódkę fokusu rysuje `focus-within`
        // na opakowaniu wyżej, żeby klawiatura miała widoczny ślad, a wygląd
        // wiersza pozostał odznaką z kanonu (zero natywnej strzałki `select`).
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none border-0 bg-transparent p-0 opacity-0 outline-none"
      >
        {IDEA_STAGE_ORDER.map((value) => (
          <option key={value} value={value}>
            {isPolish ? IDEA_STAGE_BUCKET_LABELS[value].pl : IDEA_STAGE_BUCKET_LABELS[value].en}
          </option>
        ))}
      </select>
    </div>
  );
};

export default IdeaStageSelectCell;
