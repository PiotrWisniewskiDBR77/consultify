/**
 * The 9 slides of the assessment presentation deck (worker brief minimum).
 * Every slide is a thin renderer over `PresentationDeckModel`
 * (`buildPresentationDeck.ts`) — no slide computes anything; each one only
 * picks, formats and lays out fields that are already on the model.
 */
import {
  Award,
  Compass,
  Gauge,
  HelpCircle,
  ListChecks,
  ShieldAlert,
  Target,
  Users,
} from 'lucide-react';
import React from 'react';

import type {
  AreaAssessment,
  MatrixAreaDef,
  MatrixLevelDef,
} from '@/components/Reports/AreaMatrixTable';
import { AreaMatrixTable } from '@/components/Reports/AreaMatrixTable';

import type { AxisMatrixModel } from '../groupLabels';
import type { FindingHighlight, PresentationDeckModel } from './buildPresentationDeck';
import { MissingNarrativeNote, PresentationSlideShell, StatChip } from './PresentationSlideShell';

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatLevel(value: number | null): string {
  if (value === null) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

// ---------------------------------------------------------------------------
// 1. Tytuł
// ---------------------------------------------------------------------------

export const TitleSlide: React.FC<{ model: PresentationDeckModel; locale: string }> = ({
  model,
  locale,
}) => (
  <PresentationSlideShell
    kicker={model.methodPackId.toUpperCase()}
    title={model.narrative.clientName ?? model.scope}
    lede={model.narrative.clientName ? model.scope : undefined}
  >
    <div className="flex flex-wrap items-center gap-3">
      <StatChip
        label="Pakiet metodyczny"
        value={`${model.methodPackId} v${model.methodPackVersion}`}
      />
      <StatChip label="Data zamrożenia" value={formatDate(model.frozenAt, locale)} />
      <StatChip label="Wersja Outputu" value={`v${model.outputVersion}`} />
    </div>
  </PresentationSlideShell>
);

// ---------------------------------------------------------------------------
// 2. Po co ta ocena
// ---------------------------------------------------------------------------

export const PurposeSlide: React.FC<{ model: PresentationDeckModel }> = ({ model }) => (
  <PresentationSlideShell
    kicker="Cel oceny"
    title="Po co przeprowadziliśmy tę ocenę"
    lede={model.scope}
  >
    <div className="flex items-start gap-3">
      <Compass size={22} className="mt-1 flex-shrink-0 text-c-text-muted" />
      {model.narrative.businessQuestion ? (
        <p className="max-w-2xl text-lg text-c-text">{model.narrative.businessQuestion}</p>
      ) : (
        <MissingNarrativeNote label="Pytanie biznesowe nie zostało zapisane w zamrożonym Output — do uzupełnienia przez konsultanta przed spotkaniem." />
      )}
    </div>
  </PresentationSlideShell>
);

// ---------------------------------------------------------------------------
// 3. Jak oceniliśmy
// ---------------------------------------------------------------------------

export const MethodSlide: React.FC<{ model: PresentationDeckModel }> = ({ model }) => (
  <PresentationSlideShell kicker="Metoda" title="Jak oceniliśmy">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatChip
        label="Pakiet metodyczny"
        value={`${model.methodPackId} v${model.methodPackVersion}`}
      />
      <StatChip
        label="Wiarygodność (dowód zaakceptowany)"
        value={`${model.unknowns.unitsWithAcceptedEvidence} / ${model.unknowns.totalUnits} (${formatPercent(model.unknowns.completenessRatio)})`}
      />
      <StatChip label="Reguła agregacji" value={model.aggregationRule || '—'} />
    </div>
    <div className="mt-6 flex items-start gap-3">
      <Users size={20} className="mt-1 flex-shrink-0 text-c-text-muted" />
      {model.narrative.participants && model.narrative.participants.length > 0 ? (
        <p className="text-base text-c-text-secondary">
          {model.narrative.participants.join(' · ')}
        </p>
      ) : (
        <MissingNarrativeNote label="Lista uczestników nie jest częścią zamrożonego Output — do uzupełnienia przez konsultanta." />
      )}
    </div>
    {model.limitations.length > 0 ? (
      <p className="mt-6 text-sm text-c-text-muted">
        Ograniczenia: {model.limitations.join(' · ')}
      </p>
    ) : null}
  </PresentationSlideShell>
);

// ---------------------------------------------------------------------------
// 4. Wynik ogólny
// ---------------------------------------------------------------------------

export const OverallResultSlide: React.FC<{ model: PresentationDeckModel }> = ({ model }) => (
  <PresentationSlideShell kicker="Wynik" title="Wynik ogólny">
    <div className="flex flex-col items-center justify-center gap-4 text-center">
      <Gauge size={40} className="text-c-text-muted" />
      <p className="text-7xl font-bold text-c-text sm:text-8xl">
        {formatLevel(model.overallResult)}
      </p>
      <p className="max-w-md text-sm text-c-text-muted">
        Średnia poziomów dojrzałości per wymiar (skala natywna pakietu {model.methodPackId}, reguła
        agregacji „{model.aggregationRule || '—'}", wersja mapowania{' '}
        {model.aggregationMappingVersion || '—'}).
      </p>
    </div>
  </PresentationSlideShell>
);

// ---------------------------------------------------------------------------
// 5. Profil per wymiar
// ---------------------------------------------------------------------------

export const DimensionProfileSlide: React.FC<{ model: PresentationDeckModel }> = ({ model }) => {
  const maxLevel = Math.max(1, ...model.dimensionProfile.map((d) => d.currentLevel ?? 0));
  return (
    <PresentationSlideShell kicker="Profil" title="Profil per wymiar">
      {model.dimensionProfile.length === 0 ? (
        <MissingNarrativeNote label="Output nie zawiera zagregowanych wyników per wymiar." />
      ) : (
        <div className="space-y-3">
          {model.dimensionProfile.map((d) => (
            <div key={d.groupId} className="flex items-center gap-4">
              {/* ★ Width sized for a real DIMENSION NAME, not a raw id. `w-28`
                  (112px) dated from when `groupName` echoed the raw
                  `aggregation.byGroup` key (`axis-1`); now that
                  `buildPresentationDeck` resolves real names, every DRD axis
                  ("Cyfrowe Modele Biznesowe", "Cyberbezpieczeństwo") clipped
                  to "Cyfrowe Mode…" on a board-facing deck. `title` stays as
                  the fallback for an unusually long name from another pack.
                  224px (`w-56`) clears the longest DRD axis label, measured at
                  185px — verified in the dev-render harness, not estimated. */}
              <span
                className="w-56 flex-shrink-0 truncate text-sm font-semibold text-c-text-secondary"
                title={d.groupName}
              >
                {d.groupName}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-c-surface-raised">
                <div
                  className="h-full rounded-full bg-c-text-muted"
                  style={{
                    width:
                      d.currentLevel === null
                        ? '0%'
                        : `${Math.max(4, (d.currentLevel / maxLevel) * 100)}%`,
                  }}
                />
              </div>
              <span className="w-10 flex-shrink-0 text-right text-sm font-bold text-c-text">
                {formatLevel(d.currentLevel)}
              </span>
            </div>
          ))}
        </div>
      )}
    </PresentationSlideShell>
  );
};

// ---------------------------------------------------------------------------
// 5b. MACIERZ obszary × poziomy — jeden slajd na oś
//
// ★ ODBIÓR WŁAŚCICIELA 2026-08-30: „Jeśli to ma być raport, to musi być opis,
// muszą być na nim macierze, muszą być ich opisy. Teraz nie ma macierzy nawet."
// Deck miał profil per oś — siedem słupków, jedna liczba na oś. Macierz jest
// w metodyce NARZĘDZIEM: pokazuje każdy obszar osi na drabinie poziomów naraz,
// z zaznaczonym stanem obecnym (●) i celem (○).
//
// Rysuje REALNY `AreaMatrixTable` (`src/components/Reports/`) — ten sam
// komponent, którym macierz oglądano na ekranie `drd-macierz-obszary-poziomy`.
// NIE dotyka `DRDAssessmentEditor.tsx` (macierz sesji, cudza praca w toku):
// tamten komponent EDYTUJE ocenę, ten ją tylko pokazuje.
//
// ★ Podpisy wierszy. Nazwy poziomów w DRD są per OBSZAR, nie per oś —
// zmierzone: osie 4–7 mają po cztery obszary z własną drabiną. Dlatego wiersze
// dostają nazwę tylko wtedy, gdy cała oś dzieli jedną drabinę (osie 1 i 2);
// inaczej podpisujemy je samym numerem poziomu. Wzięcie nazw z `areas[0]`
// wypisałoby na osi 4 nazwy poziomów obszaru 4A dla obszarów 4B–4E.
// ---------------------------------------------------------------------------

/** Rampa poziomów skopiowana z `MATURITY_LEVELS` (od najniższego do
 * najwyższego) i rozciągana na 5/6/7 poziomów, żeby najniższy był zawsze
 * „zimny", a najwyższy „gorący" niezależnie od liczby wierszy osi. */
const LEVEL_RAMP = ['#f43f5e', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#ec4899'];

function levelColor(level: number, count: number): string {
  if (count <= 1) return LEVEL_RAMP[0];
  const idx = Math.round(((level - 1) / (count - 1)) * (LEVEL_RAMP.length - 1));
  return LEVEL_RAMP[Math.min(LEVEL_RAMP.length - 1, Math.max(0, idx))];
}

export const AxisMatrixSlide: React.FC<{ matrix: AxisMatrixModel; locale: string }> = ({
  matrix,
  locale,
}) => {
  const areas: MatrixAreaDef[] = matrix.areas.map((a) => ({
    id: a.id,
    name: `${a.id} · ${a.name}`,
    namePl: `${a.id} · ${a.name}`,
  }));

  const levels: MatrixLevelDef[] = matrix.levels.map((l) => {
    const label = l.title ?? `Poziom ${l.level}`;
    return {
      level: l.level,
      name: label,
      namePl: label,
      color: levelColor(l.level, matrix.levelCount),
    };
  });

  // Wyłącznie obszary FAKTYCZNIE ocenione. Obszar bez pomiaru nie dostaje
  // wpisu, więc macierz drukuje w jego kolumnie „-", a nie „0" — to jest
  // różnica między „nie mierzyliśmy" a „zmierzyliśmy zero".
  const assessments: AreaAssessment[] = matrix.areas
    .filter((a) => a.currentLevel !== null || a.targetLevel !== null)
    .map((a) => ({
      areaId: a.id,
      currentLevel: a.currentLevel ?? 0,
      targetLevel: a.targetLevel ?? 0,
    }));

  return (
    <PresentationSlideShell
      kicker={`Macierz · oś ${matrix.axisNumber}`}
      title={matrix.axisName}
      lede={matrix.description ?? undefined}
      footnote={
        <span>
          Oceniono {matrix.assessedCount} z {matrix.areas.length} obszarów tej osi · skala 1–
          {matrix.levelCount} · ● stan obecny, ○ cel, „-" obszar nieobjęty oceną.
          {matrix.hasSharedLadder
            ? ''
            : ' Obszary tej osi mają własne, różne nazwy poziomów — wiersze podpisano numerem poziomu.'}
          {matrix.description && matrix.descriptionLanguage === 'en'
            ? ' Opis osi w oryginale angielskim — polskiej wersji metodyka w pakiecie jeszcze nie ma.'
            : ''}
        </span>
      }
    >
      {/* Zagęszczenie na slajd: `AreaMatrixTable` jest zbudowany pod stronę
          raportu (własna biała karta, 24 px marginesu i paddingu, komórki
          44 px). Na slajdzie 900 px wysokości urywało to wiersze podsumowań
          i legendę. Nadpisujemy TYLKO geometrię i obudowę karty — kolory
          i semantyka siatki zostają nietknięte. */}
      <style>{`
        .drd-matrix-slide .area-matrix-container {
          margin: 0;
          padding: 0;
          background: transparent;
          box-shadow: none;
        }
        .drd-matrix-slide .matrix-header { margin-bottom: 12px; }
        .drd-matrix-slide .matrix-cell { height: 30px; }
        .drd-matrix-slide .level-cell { padding: 6px 12px !important; }
        .drd-matrix-slide .matrix-table th,
        .drd-matrix-slide .matrix-table td { padding: 5px; }
        .drd-matrix-slide .summary-row td { padding: 5px 6px !important; }
        .drd-matrix-slide .area-header { padding: 6px 4px !important; }
        /* Kolumna poziomów szersza niż domyślne 140 px: najdłuższa nazwa
           poziomu w metodyce („Basic Data Registration") łamała się na dwie
           linie i podwajała wysokość wiersza, przez co legenda wypadała poza
           slajd. */
        .drd-matrix-slide .level-header,
        .drd-matrix-slide .level-cell { min-width: 178px; }
        .drd-matrix-slide .level-cell .level-name { white-space: nowrap; }
        .drd-matrix-slide .matrix-cell { height: 26px; }
        .drd-matrix-slide .level-header { padding: 8px 12px !important; }
        .drd-matrix-slide .matrix-legend { margin-top: 8px; padding-top: 8px; }
      `}</style>
      <div className="drd-matrix-slide max-h-full overflow-auto">
        <AreaMatrixTable
          axisId={matrix.axisId}
          axisName={matrix.axisName}
          areaAssessments={assessments}
          areas={areas}
          levels={levels}
          language={locale.startsWith('pl') ? 'pl' : 'en'}
          showAnimation={false}
        />
      </div>
    </PresentationSlideShell>
  );
};

// ---------------------------------------------------------------------------
// 6/7 shared highlight list
// ---------------------------------------------------------------------------

const HighlightList: React.FC<{
  items: readonly FindingHighlight[];
  emptyLabel: string;
  limit?: number;
}> = ({ items, emptyLabel, limit = 6 }) => {
  if (items.length === 0) return <MissingNarrativeNote label={emptyLabel} />;
  const shown = items.slice(0, limit);
  const hidden = items.length - shown.length;
  return (
    <ul className="space-y-3">
      {shown.map((item) => (
        <li
          key={item.findingId}
          className="rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-bold text-c-text">{item.unitName}</span>
            <span className="flex-shrink-0 text-xs font-semibold text-c-text-muted">
              {formatLevel(item.currentLevel)} → {formatLevel(item.targetLevel)}
            </span>
          </div>
          <p className="mt-1 text-sm text-c-text-secondary">{item.text || '—'}</p>
        </li>
      ))}
      {hidden > 0 ? <li className="text-xs text-c-text-muted">+{hidden} więcej</li> : null}
    </ul>
  );
};

// ---------------------------------------------------------------------------
// 6. Mocne strony
// ---------------------------------------------------------------------------

export const StrengthsSlide: React.FC<{ model: PresentationDeckModel }> = ({ model }) => (
  <PresentationSlideShell kicker="Mocne strony" title="Co już działa">
    <div className="flex items-start gap-3">
      <Award size={22} className="mt-1 flex-shrink-0 text-c-success" />
      <div className="flex-1">
        <HighlightList
          items={model.strengths}
          emptyLabel="Żadna jednostka nie osiągnęła jeszcze poziomu docelowego w zaakceptowanych ustaleniach tego Outputu."
        />
      </div>
    </div>
  </PresentationSlideShell>
);

// ---------------------------------------------------------------------------
// 7. Luki i ryzyka
// ---------------------------------------------------------------------------

export const GapsAndRisksSlide: React.FC<{ model: PresentationDeckModel }> = ({ model }) => (
  <PresentationSlideShell kicker="Luki i ryzyka" title="Gdzie jest największe ryzyko">
    <div className="flex items-start gap-3">
      <ShieldAlert size={22} className="mt-1 flex-shrink-0 text-c-danger" />
      <div className="flex-1">
        <HighlightList
          items={model.gapsAndRisks}
          emptyLabel="Brak zaakceptowanych ustaleń z luką powyżej zera w tym Output."
        />
      </div>
    </div>
  </PresentationSlideShell>
);

// ---------------------------------------------------------------------------
// 8. Obszary bez dowodu
//
// ★ Deliberately NOT titled "Czego organizacja nie wie o sobie" — that
// phrasing asserts a state of KNOWLEDGE the data cannot back up. The frozen
// Output's `unitsMissingEvidence` collapses `dont_know` (honest "we don't
// know") and `no_evidence` (possibly "we know, just never documented it")
// into one bucket BEFORE freezing (`drdAdapter.ts`'s level evaluation) —
// two different findings, two different follow-up conversations with the
// client's board. Renders the two-category breakdown automatically the day
// `model.unknowns.reasonBreakdown` is populated (see
// `buildPresentationDeck.ts`); until then, shows one aggregated count with
// an explicit, on-slide disclaimer instead of pretending the distinction
// was made.
// ---------------------------------------------------------------------------

export const UnknownsSlide: React.FC<{ model: PresentationDeckModel }> = ({ model }) => {
  const breakdown = model.unknowns.reasonBreakdown;
  return (
    <PresentationSlideShell
      kicker="Białe plamy"
      title="Obszary bez dowodu"
      lede="Brak zaakceptowanego dowodu to osobne, wartościowe odkrycie — nie luka w danych."
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex items-start gap-3">
            <HelpCircle size={22} className="mt-1 flex-shrink-0 text-c-warning" />
            <StatChip
              label="Jednostki bez zaakceptowanego dowodu"
              value={`${model.unknowns.unitsMissingEvidence} / ${model.unknowns.totalUnits}`}
              tone={model.unknowns.unitsMissingEvidence > 0 ? 'danger' : 'success'}
            />
          </div>
          {breakdown ? (
            <>
              <StatChip label="Nie wiemy (dont_know)" value={String(breakdown.dontKnow)} />
              <StatChip
                label="Wiemy, brak dokumentacji (no_evidence)"
                value={String(breakdown.noEvidence)}
              />
            </>
          ) : null}
        </div>
        <div className="flex-1">
          {model.unknowns.unknownUnits.length === 0 ? (
            <p className="text-sm text-c-text-muted">
              Brak jednostek z nierozstrzygniętym poziomem bieżącym.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {model.unknowns.unknownUnits.slice(0, 12).map((u) => (
                <li
                  key={u.unitId}
                  className="rounded-full border border-c-border-subtle bg-c-surface-raised px-3 py-1 text-xs font-semibold text-c-text-secondary"
                >
                  {u.unitName ?? u.unitId}
                </li>
              ))}
              {model.unknowns.unknownUnits.length > 12 ? (
                <li className="text-xs text-c-text-muted">
                  +{model.unknowns.unknownUnits.length - 12} więcej
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </div>
      {!breakdown ? (
        <p className="mt-6 text-xs text-c-text-muted">
          Ten Output nie rozróżnia przyczyny braku dowodu — „nie wiemy" (dont_know) i „wiemy, ale
          nie udokumentowaliśmy" (no_evidence) są tu jedną zagregowaną liczbą. To dwie różne rozmowy
          z zarządem; rozstrzygnięcie wymaga wglądu poza ten zamrożony Output.
        </p>
      ) : null}
      {model.draftFindingCount > 0 ? (
        <p className="mt-2 text-xs text-c-text-muted">
          Dodatkowo {model.draftFindingCount} ustaleń w tym Output ma status roboczy
          (niezaakceptowany dowód) i nie wchodzi w treść tej prezentacji.
        </p>
      ) : null}
    </PresentationSlideShell>
  );
};

// ---------------------------------------------------------------------------
// 9. Co dalej
// ---------------------------------------------------------------------------

export const NextStepsSlide: React.FC<{ model: PresentationDeckModel }> = ({ model }) => (
  <PresentationSlideShell kicker="Co dalej" title="Rekomendacje i kolejny krok">
    <div className="flex items-start gap-3">
      <Target size={22} className="mt-1 flex-shrink-0 text-c-text-muted" />
      <div className="flex-1">
        {model.recommendations.length === 0 ? (
          <MissingNarrativeNote label="Brak rekomendacji w zaakceptowanych ustaleniach tego Outputu." />
        ) : (
          <ol className="space-y-3">
            {model.recommendations.slice(0, 6).map((rec, idx) => (
              <li
                key={rec}
                className="flex gap-3 rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3"
              >
                <span className="flex-shrink-0 text-sm font-bold text-c-text-muted">
                  {idx + 1}.
                </span>
                <span className="text-sm text-c-text">{rec}</span>
              </li>
            ))}
            {model.recommendations.length > 6 ? (
              <li className="flex items-center gap-2 text-xs text-c-text-muted">
                <ListChecks size={14} />+{model.recommendations.length - 6} więcej rekomendacji w
                pełnym Output
              </li>
            ) : null}
          </ol>
        )}
      </div>
    </div>
  </PresentationSlideShell>
);

/** Liczba slajdów STAŁEGO szkieletu decku (tytuł → … → co dalej). Od
 * 2026-08-30 deck ma dodatkowo po jednym slajdzie macierzy na każdą ocenioną
 * oś, więc realną długość liczy `presentationSlideCount(model)` — ta stała
 * pozostaje kontraktem szkieletu i jest używana jako baza. */
export const PRESENTATION_SLIDE_COUNT = 9;

/** Realna liczba slajdów dla konkretnego modelu: szkielet + macierze osi. */
export function presentationSlideCount(model: PresentationDeckModel): number {
  return PRESENTATION_SLIDE_COUNT + (model.axisMatrices?.length ?? 0);
}
