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

import type { FindingHighlight, PresentationDeckModel } from './buildPresentationDeck';
import { MissingNarrativeNote, PresentationSlideShell, StatChip } from './PresentationSlideShell';

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(
      new Date(iso)
    );
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

export const TitleSlide: React.FC<{ model: PresentationDeckModel; locale: string }> = ({ model, locale }) => (
  <PresentationSlideShell
    kicker={model.methodPackId.toUpperCase()}
    title={model.narrative.clientName ?? model.scope}
    lede={model.narrative.clientName ? model.scope : undefined}
  >
    <div className="flex flex-wrap items-center gap-3">
      <StatChip label="Pakiet metodyczny" value={`${model.methodPackId} v${model.methodPackVersion}`} />
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
      <StatChip label="Pakiet metodyczny" value={`${model.methodPackId} v${model.methodPackVersion}`} />
      <StatChip
        label="Wiarygodność (dowód zaakceptowany)"
        value={`${model.unknowns.unitsWithAcceptedEvidence} / ${model.unknowns.totalUnits} (${formatPercent(model.unknowns.completenessRatio)})`}
      />
      <StatChip label="Reguła agregacji" value={model.aggregationRule || '—'} />
    </div>
    <div className="mt-6 flex items-start gap-3">
      <Users size={20} className="mt-1 flex-shrink-0 text-c-text-muted" />
      {model.narrative.participants && model.narrative.participants.length > 0 ? (
        <p className="text-base text-c-text-secondary">{model.narrative.participants.join(' · ')}</p>
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
      <p className="text-7xl font-bold text-c-text sm:text-8xl">{formatLevel(model.overallResult)}</p>
      <p className="max-w-md text-sm text-c-text-muted">
        Średnia poziomów dojrzałości per wymiar (skala natywna pakietu {model.methodPackId}, reguła agregacji „
        {model.aggregationRule || '—'}", wersja mapowania {model.aggregationMappingVersion || '—'}).
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
              <span className="w-28 flex-shrink-0 truncate text-sm font-semibold text-c-text-secondary" title={d.groupName}>
                {d.groupName}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-c-surface-raised">
                <div
                  className="h-full rounded-full bg-c-text-muted"
                  style={{ width: d.currentLevel === null ? '0%' : `${Math.max(4, (d.currentLevel / maxLevel) * 100)}%` }}
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
// 6/7 shared highlight list
// ---------------------------------------------------------------------------

const HighlightList: React.FC<{ items: readonly FindingHighlight[]; emptyLabel: string; limit?: number }> = ({
  items,
  emptyLabel,
  limit = 6,
}) => {
  if (items.length === 0) return <MissingNarrativeNote label={emptyLabel} />;
  const shown = items.slice(0, limit);
  const hidden = items.length - shown.length;
  return (
    <ul className="space-y-3">
      {shown.map((item) => (
        <li key={item.findingId} className="rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3">
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
              <StatChip label="Wiemy, brak dokumentacji (no_evidence)" value={String(breakdown.noEvidence)} />
            </>
          ) : null}
        </div>
        <div className="flex-1">
          {model.unknowns.unknownUnits.length === 0 ? (
            <p className="text-sm text-c-text-muted">Brak jednostek z nierozstrzygniętym poziomem bieżącym.</p>
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
                <li className="text-xs text-c-text-muted">+{model.unknowns.unknownUnits.length - 12} więcej</li>
              ) : null}
            </ul>
          )}
        </div>
      </div>
      {!breakdown ? (
        <p className="mt-6 text-xs text-c-text-muted">
          Ten Output nie rozróżnia przyczyny braku dowodu — „nie wiemy" (dont_know) i „wiemy, ale nie
          udokumentowaliśmy" (no_evidence) są tu jedną zagregowaną liczbą. To dwie różne rozmowy z zarządem;
          rozstrzygnięcie wymaga wglądu poza ten zamrożony Output.
        </p>
      ) : null}
      {model.draftFindingCount > 0 ? (
        <p className="mt-2 text-xs text-c-text-muted">
          Dodatkowo {model.draftFindingCount} ustaleń w tym Output ma status roboczy (niezaakceptowany dowód) i nie
          wchodzi w treść tej prezentacji.
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
              <li key={rec} className="flex gap-3 rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3">
                <span className="flex-shrink-0 text-sm font-bold text-c-text-muted">{idx + 1}.</span>
                <span className="text-sm text-c-text">{rec}</span>
              </li>
            ))}
            {model.recommendations.length > 6 ? (
              <li className="flex items-center gap-2 text-xs text-c-text-muted">
                <ListChecks size={14} />+{model.recommendations.length - 6} więcej rekomendacji w pełnym Output
              </li>
            ) : null}
          </ol>
        )}
      </div>
    </div>
  </PresentationSlideShell>
);

export const PRESENTATION_SLIDE_COUNT = 9;
