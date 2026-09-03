/**
 * AssessmentReportDocument — pure renderer of a frozen Assessment Output.
 *
 * ★ HARD RULE (task brief): this component is a RENDERER, not a calculator.
 * Every number shown here is read verbatim from `data.output` (the
 * immutable `method_outputs` / `method_findings` snapshot) or from
 * adjacent, already-persisted facts (`data.session`, `data.approvals`).
 * Nothing is re-derived from `method_events`, nothing is re-scored against
 * a method pack. The only "computation" this file performs on numbers is:
 *   - counting/partitioning existing frozen values (e.g. "how many findings
 *     have gap > 0") — reading, not scoring;
 *   - `maturityBands.describeMaturityPosition` — a display-only banding of
 *     an existing number into one of 5 fixed phrases (same class of
 *     operation as a progress bar picking a colour from a percentage).
 *
 * Zero crimson brand-accent token, zero `primary-*` — signal tones only via
 * `StatusChip` (`c-info`/`c-success`/`c-warning`/`c-danger`), focus via
 * `c-focus`. The per-dimension table is `StandardTable` — no bespoke,
 * hand-rolled table markup.
 *
 * ★ STRUKTURA = FORMUŁA WŁAŚCICIELA (2026-08-30, jego słowami):
 *   1. Wstęp z opisem, jak było prowadzone badanie.
 *   2. Siedem osi — dla każdej najpierw opis samej osi, potem obszaru.
 *   3. Odpowiedzi oraz wstępna paleta wniosków.
 *   4. Podsumowanie.
 * Dlatego rozdziały są ponumerowane 1–4 i w tej kolejności; wcześniejszy
 * układ (osiem równorzędnych kart bez wstępu, bez opisu osi i bez opisu
 * obszaru) realizował z tej formuły wyłącznie punkt 4 — zmierzone
 * w `docs/program/grafika/RAPORT_OCENY_STAN.md`.
 *
 * Licence boundary: renderuje opis osi (`DRDAxis.description`) oraz tytuł
 * i opis POZIOMU obszaru (`DRDLevel.title/description`) — za wyraźną zgodą
 * właściciela metodyki, patrz nagłówek `drdLabels.ts`. Warstwa coachingowa
 * QBank v2 (przykłady, pułapki oceniania) nadal NIE wychodzi do dokumentu.
 * Każdy akapit metodyki niesie widoczny znacznik języka źródła — korpus jest
 * dziś angielski dla osi 1–4 i 7, więc dokument mówi to wprost, zamiast
 * podawać angielski akapit jako polską treść produktu.
 */
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  HelpCircle,
  Lightbulb,
  ShieldAlert,
  Target,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DRDMatrixReadOnly,
  drdOdpowiedziZOutputu,
} from '../drd/DRDMatrixReadOnly';

import { StandardTable, type TableColumn, type TableRow } from '../../standard/StandardTable';
import { StatusChip } from '../../ui/primitives/chips';
import {
  listDrdAxisNarratives,
  resolveDrdAxisName,
  resolveDrdLevelNarrative,
  resolveDrdUnitLabel,
  type DrdSourceLanguage,
} from './drdLabels';
import { describeMaturityPosition } from './maturityBands';
import type { AssessmentReportData, ReportFinding } from './types';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

const SectionCard: React.FC<{
  title: string;
  eyebrow?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  id?: string;
}> = ({ title, eyebrow, icon: Icon, children, id }) => (
  <section
    id={id}
    className="rounded-2xl border border-c-border-subtle bg-c-surface p-5 sm:p-6"
    aria-labelledby={id ? `${id}-heading` : undefined}
  >
    <div className="mb-4 flex items-center gap-2">
      {Icon ? <Icon size={16} className="shrink-0 text-c-text-muted" aria-hidden="true" /> : null}
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">{eyebrow}</p>
        ) : null}
        {/* h3, nie h2 — od 2026-08-30 karty leżą WEWNĄTRZ numerowanych
            rozdziałów (`<Chapter>`), które niosą h2. */}
        <h3 id={id ? `${id}-heading` : undefined} className="text-sm font-semibold text-c-text">
          {title}
        </h3>
      </div>
    </div>
    {children}
  </section>
);

/** Rozdział formuły właściciela — numerowany, żeby dokument dało się czytać
 * jako raport, a nie jako zestaw równorzędnych kafli. */
const Chapter: React.FC<{
  number: number;
  title: string;
  lede?: React.ReactNode;
  icon?: React.ElementType;
  id: string;
  children: React.ReactNode;
}> = ({ number, title, lede, icon: Icon, id, children }) => (
  <section id={id} aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
    <div className="flex items-start gap-3 border-b border-c-border-subtle pb-3">
      {Icon ? <Icon size={18} className="mt-0.5 shrink-0 text-c-text-muted" aria-hidden="true" /> : null}
      <div className="min-w-0">
        <h2 id={`${id}-heading`} className="text-base font-semibold text-c-text">
          {number}. {title}
        </h2>
        {lede ? <p className="mt-1 text-xs text-c-text-secondary">{lede}</p> : null}
      </div>
    </div>
    {children}
  </section>
);

/**
 * Akapit pochodzący z metodyki (opis osi, opis poziomu) — zawsze ze
 * znacznikiem języka źródła. Angielski akapit w polskim dokumencie NIE jest
 * tu chowany ani „tłumaczony w locie": jest pokazany i nazwany, bo korpus
 * `drdStructure.ts` po prostu nie ma jeszcze polskiej wersji osi 1–4 i 7
 * (zmierzone — patrz nagłówek `drdLabels.ts`). Wymyślanie tłumaczenia
 * w komponencie byłoby wymyślaniem treści metodyki.
 */
const MethodologyProse: React.FC<{ text: string; language: DrdSourceLanguage; className?: string }> = ({
  text,
  language,
  className,
}) => (
  <p className={`text-xs leading-relaxed text-c-text-secondary ${className ?? ''}`}>
    {language === 'en' ? (
      <span
        className="mr-1.5 rounded border border-c-border-subtle px-1 py-px align-middle text-[9px] font-semibold uppercase tracking-wider text-c-text-muted"
        title="Źródło: metodyka DRD w oryginale angielskim — polskiego tłumaczenia tej osi jeszcze nie ma w pakiecie."
      >
        EN
      </span>
    ) : null}
    {text}
  </p>
);

const Property: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-medium uppercase tracking-wide text-c-text-muted">{label}</dt>
    <dd className={`mt-0.5 truncate text-sm text-c-text ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</dd>
  </div>
);

/** Two-tone bar (current vs target) over a unit's own pinned level scale.
 * Purely a visual re-expression of numbers already in `data.output.current`
 * / `.target` — no new value is computed. */
const LevelBar: React.FC<{
  current: number | null;
  target: number | null;
  min: number;
  max: number;
}> = ({ current, target, min, max }) => {
  const range = Math.max(1, max - min);
  const pct = (v: number | null): number | null =>
    v === null ? null : Math.min(100, Math.max(0, ((v - min) / range) * 100));
  const currentPct = pct(current);
  const targetPct = pct(target);
  return (
    <div
      className="relative h-2 w-full min-w-[96px] rounded-full bg-c-surface-raised"
      role="img"
      aria-label={`Poziom obecny ${current ?? 'brak'}, cel ${target ?? 'brak'}, skala ${min}-${max}`}
    >
      {currentPct !== null ? (
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-c-info"
          style={{ width: `${currentPct}%` }}
        />
      ) : null}
      {targetPct !== null ? (
        <div
          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-c-success"
          style={{ left: `${targetPct}%` }}
          title="Cel"
        />
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Rozdział jednej osi — punkt 2 formuły właściciela
// ---------------------------------------------------------------------------

/**
 * Jeden obszar analityczny: nagłówek z liczbami + DEFINICJA poziomu obecnego
 * i docelowego prosto z metodyki. To jest to, czego w raporcie nie było —
 * obszar dostawał sam nagłówek „1A Procesy Sprzedaży" i linijkę cyfr.
 *
 * Poziomy bierze `resolveDrdLevelNarrative`, czyli `area.levels` TEGO obszaru
 * — nigdy `areas[0]` (patrz komentarz przy tej funkcji w `drdLabels.ts`).
 */
const AreaBlock: React.FC<{
  unitId: string;
  unitName: string;
  methodPackId: string;
  methodPackVersion: string;
  current: number | null;
  target: number | null;
  gap: number | null;
  levelCount: number;
  hasFinding: boolean;
}> = ({ unitId, unitName, methodPackId, methodPackVersion, current, target, gap, levelCount, hasFinding }) => {
  const currentLevel = resolveDrdLevelNarrative(methodPackId, methodPackVersion, unitId, current);
  const targetLevel = resolveDrdLevelNarrative(methodPackId, methodPackVersion, unitId, target);
  return (
    <div className="rounded-xl border border-c-border-subtle px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-semibold text-c-text">
          <span className="font-mono text-c-text-muted">{unitId}</span> · {unitName}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] tabular-nums text-c-text-secondary">
            {current === null ? '—' : current} / {target === null ? '—' : target}
            <span className="text-c-text-muted"> (skala 1–{levelCount})</span>
          </span>
          <div className="w-24">
            <LevelBar current={current} target={target} min={1} max={levelCount} />
          </div>
          {gap !== null ? (
            <span
              className={`w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums ${gap > 0 ? 'text-c-danger' : 'text-c-success'}`}
            >
              {gap > 0 ? `+${gap}` : gap}
            </span>
          ) : (
            <span className="w-10 shrink-0 text-right text-[11px] text-c-text-muted">—</span>
          )}
        </div>
      </div>

      {currentLevel ? (
        <div className="mt-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
            Poziom obecny {currentLevel.level} — {currentLevel.title}
          </p>
          <MethodologyProse
            className="mt-0.5"
            text={currentLevel.description}
            language={currentLevel.sourceLanguage}
          />
        </div>
      ) : (
        <p className="mt-2.5 text-[11px] italic text-c-text-muted">
          {current === null
            ? 'Poziom obecny nie został w tej ocenie rozstrzygnięty.'
            : 'Metodyka przypięta w tym Outpucie nie niesie definicji tego poziomu.'}
        </p>
      )}

      {/* Cel osiągnięty → NIE powtarzamy tej samej definicji drugi raz.
          Bez tego obszar bez luki drukował identyczny akapit dwa razy pod
          rząd („Poziom obecny 6 — ERP" / „Poziom docelowy 6 — ERP"), co
          w dokumencie dla zarządu czyta się jak błąd składu. */}
      {targetLevel && targetLevel.level !== currentLevel?.level ? (
        <div className="mt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
            Poziom docelowy {targetLevel.level} — {targetLevel.title}
          </p>
          <MethodologyProse
            className="mt-0.5"
            text={targetLevel.description}
            language={targetLevel.sourceLanguage}
          />
        </div>
      ) : targetLevel ? (
        <p className="mt-2 text-[11px] font-medium text-c-success">
          Poziom docelowy {targetLevel.level} — osiągnięty; definicja jak wyżej.
        </p>
      ) : null}

      {!hasFinding ? (
        <p className="mt-2 text-[11px] font-medium text-c-warning">
          Brak przyjętego dowodu dla tego obszaru — liczby powyżej pochodzą z zapisu sesji, ale nie są
          poparte zaakceptowanym materiałem dowodowym.
        </p>
      ) : null}
    </div>
  );
};

/** Rozdział jednej osi: opis osi → jej obszary → obszary nieobjęte oceną. */
const AxisSection: React.FC<{
  axis: {
    readonly axisId: string;
    readonly axisNumber: number;
    readonly axisName: string;
    readonly description: string | null;
    readonly descriptionLanguage: DrdSourceLanguage;
    readonly levelCount: number;
    readonly areas: readonly { readonly id: string; readonly name: string }[];
  };
  unitIds: readonly string[];
  output: AssessmentReportData['output'];
  aggregatedLevel: number | null | undefined;
}> = ({ axis, unitIds, output, aggregatedLevel }) => {
  const findingUnitIds = new Set((output.findings ?? []).map((f) => f.unitId));
  const assessed = axis.areas.filter((a) => unitIds.includes(a.id));
  const notAssessed = axis.areas.filter((a) => !unitIds.includes(a.id));

  return (
    <SectionCard
      id={`os-${axis.axisNumber}`}
      eyebrow={`Oś ${axis.axisNumber} z 7 · skala 1–${axis.levelCount} · ${axis.areas.length} obszarów`}
      title={`${axis.axisNumber}. ${axis.axisName}`}
    >
      {axis.description ? (
        <MethodologyProse text={axis.description} language={axis.descriptionLanguage} className="mb-3" />
      ) : null}

      <p className="mb-3 text-[11px] text-c-text-muted">
        Oceniono {assessed.length} z {axis.areas.length} obszarów tej osi.
        {aggregatedLevel !== null && aggregatedLevel !== undefined
          ? ` Wynik osi: ${aggregatedLevel} (skala 1–${axis.levelCount}).`
          : ' Zamrożony Output nie niesie zagregowanego wyniku tej osi.'}
      </p>

      {assessed.length === 0 ? (
        <p className="rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs italic text-c-text-muted">
          Żaden obszar tej osi nie został objęty tą oceną. Oś zostaje w dokumencie, żeby było widać, czego
          badanie nie dotknęło — pominięcie rozdziału zmieniłoby zakres oceny w oczach czytelnika.
        </p>
      ) : (
        <div className="space-y-2.5">
          {/*
            ★ MACIERZ OSI — odbiór właściciela 30.08 („Jeśli to ma być raport,
            to muszą być na nim macierze") i eskalacja 01.09 („Ciągle nie wiem
            dlaczego nie używasz mojej macierzy DRD"). Do dziś rozdział osi miał
            same bloki obszarów — czytelnik nie widział drogi rozwoju obszaru
            po drabinie poziomów, tylko dwie liczby na obszar.

            To jest DOKŁADNIE ta siatka, którą właściciel zaakceptował na ekranie
            „Macierz oceny DRD — obszary x poziomy" (`drd-macierz-oceny`), a nie
            jej kopia — patrz `DRDMatrixReadOnly`.
          */}
          <DRDMatrixReadOnly
            axisNumber={axis.axisNumber}
            value={drdOdpowiedziZOutputu(
              axis.areas.map((a) => a.id),
              output.current ?? {},
              output.target ?? {}
            )}
          />

          {assessed.map((area) => (
            <AreaBlock
              key={area.id}
              unitId={area.id}
              unitName={area.name}
              methodPackId={output.methodPackId}
              methodPackVersion={output.methodPackVersion}
              current={output.current?.[area.id] ?? null}
              target={output.target?.[area.id] ?? null}
              gap={output.gap?.[area.id] ?? null}
              levelCount={axis.levelCount}
              hasFinding={findingUnitIds.has(area.id)}
            />
          ))}
        </div>
      )}

      {assessed.length > 0 && notAssessed.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
            Obszary tej osi nieobjęte oceną ({notAssessed.length})
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {notAssessed.map((area) => (
              <li
                key={area.id}
                className="rounded-full border border-c-border-subtle px-2.5 py-1 text-[11px] text-c-text-muted"
              >
                <span className="font-mono">{area.id}</span> {area.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export interface AssessmentReportDocumentProps {
  data: AssessmentReportData;
}

export const AssessmentReportDocument: React.FC<AssessmentReportDocumentProps> = ({ data }) => {
  const { t } = useTranslation();
  const { output, session, approvals, superseded, supersededByOutputId } = data;

  const latestApproval = useMemo(() => {
    const approved = approvals.filter((a) => a.decision === 'approved');
    if (approved.length === 0) return null;
    return [...approved].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [approvals]);

  // Every unit the Output touched — union of current/target/gap keys, NOT
  // just `findings` (a unit without accepted evidence still appears here,
  // with `hasFinding: false` — this is what powers §5 "nie wiem").
  const unitIds = useMemo(() => {
    const set = new Set<string>([
      ...Object.keys(output.current ?? {}),
      ...Object.keys(output.target ?? {}),
      ...Object.keys(output.gap ?? {}),
    ]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [output.current, output.target, output.gap]);

  const findingByUnit = useMemo(() => {
    const map = new Map<string, ReportFinding>();
    for (const f of output.findings ?? []) map.set(f.unitId, f);
    return map;
  }, [output.findings]);

  const dimensionRows: TableRow[] = useMemo(
    () =>
      unitIds.map((unitId) => {
        const label = resolveDrdUnitLabel(output.methodPackId, output.methodPackVersion, unitId);
        const finding = findingByUnit.get(unitId) ?? null;
        const current = output.current?.[unitId] ?? null;
        const target = output.target?.[unitId] ?? null;
        const gap = output.gap?.[unitId] ?? null;
        const band = label ? describeMaturityPosition(current, Math.min(...label.levelScale), Math.max(...label.levelScale)) : null;
        return {
          id: unitId,
          unitId,
          unitName: label?.unitName ?? finding?.unitName ?? unitId,
          axisName: label?.axisName ?? '—',
          current,
          target,
          gap,
          bandLabel: band?.label ?? null,
          hasFinding: !!finding,
          scaleMin: label ? Math.min(...label.levelScale) : null,
          scaleMax: label ? Math.max(...label.levelScale) : null,
        } as TableRow;
      }),
    [unitIds, findingByUnit, output.methodPackId, output.methodPackVersion, output.current, output.target, output.gap]
  );

  const dimensionColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'unitName',
        label: 'Jednostka oceny',
        sortable: true,
        render: (row) => (
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-c-text">{row.unitName as string}</div>
            {/* c-text-secondary, nie c-text-muted: renderuje się też na podbarwionym
                tle wiersza zaznaczonego — 4.21:1 zamiast 4,5:1 (axe: color-contrast,
                zmierzone na assessment-output-report po otwarciu podglądu). */}
            <div className="truncate text-[11px] font-mono text-c-text-secondary">{row.unitId as string}</div>
          </div>
        ),
      },
      // Kolumna „Wymiar (oś)" USUNIĘTA 2026-08-30: od kiedy tabela leży jako
      // zestawienie zbiorcze POD rozdziałami osi, oś jest już nagłówkiem
      // rozdziału, a tu zjadała 160 px z 880 px kolumny dokumentu — nazwa
      // jednostki ucinała się do „Procesy S…”. Oś zostaje w danych wiersza
      // (sortowanie/eksport), znika tylko z widoku.
      {
        id: 'levels',
        label: 'Obecny / Cel',
        width: '190px',
        render: (row) => (
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs tabular-nums text-c-text">
              {row.current === null || row.current === undefined ? '—' : String(row.current)}
              {' / '}
              {row.target === null || row.target === undefined ? '—' : String(row.target)}
            </span>
            {row.scaleMin !== null && row.scaleMax !== null ? (
              <LevelBar
                current={row.current as number | null}
                target={row.target as number | null}
                min={row.scaleMin as number}
                max={row.scaleMax as number}
              />
            ) : null}
          </div>
        ),
      },
      {
        id: 'gap',
        label: 'Luka',
        width: '90px',
        sortable: true,
        render: (row) => {
          const gap = row.gap as number | null;
          if (gap === null || gap === undefined) return <span className="text-c-text-secondary">—</span>;
          // `text-c-danger` renderuje się też na podbarwionym tle wiersza
          // zaznaczonego — 4.12:1 (light) / 4.47:1 (dark) zamiast 4,5:1 (axe:
          // color-contrast, zmierzone na assessment-output-report po otwarciu
          // podglądu); danger-700/danger-300 (skala Tailwind) mają margines na
          // obu tłach bez zmiany globalnego tokenu --c-danger.
          const tone = gap > 0 ? 'text-danger-700 dark:text-danger-300' : 'text-c-success';
          return <span className={`text-xs font-semibold tabular-nums ${tone}`}>{gap > 0 ? `+${gap}` : gap}</span>;
        },
      },
      {
        id: 'bandLabel',
        label: 'Pozycja na skali',
        width: '140px',
        render: (row) => (row.bandLabel ? <span className="text-xs text-c-text-secondary">{row.bandLabel as string}</span> : <span className="text-c-text-muted">—</span>),
      },
      {
        id: 'hasFinding',
        label: 'Dowody',
        width: '132px',
        render: (row) =>
          row.hasFinding ? (
            <StatusChip label="Potwierdzone dowodem" tone="success" size="sm" />
          ) : (
            <StatusChip label="Brak dowodu" tone="warning" size="sm" />
          ),
      },
    ],
    []
  );

  const strengths = useMemo(
    () => (output.findings ?? []).filter((f) => f.gap === null || f.gap <= 0),
    [output.findings]
  );
  const gaps = useMemo(
    () => [...(output.findings ?? [])].filter((f) => f.gap !== null && f.gap > 0).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0)),
    [output.findings]
  );

  const unitsWithoutFinding = useMemo(
    () => unitIds.filter((id) => !findingByUnit.has(id)),
    [unitIds, findingByUnit]
  );

  const recommendations = useMemo(
    () => [...(output.findings ?? [])].sort((a, b) => (b.gap ?? -Infinity) - (a.gap ?? -Infinity)),
    [output.findings]
  );

  const evidenceRows = useMemo(() => {
    const rows: { id: string; unitId: string; unitName: string; evidenceId: string; evidenceType: string; strength: string; locator: string }[] = [];
    for (const f of output.findings ?? []) {
      for (const ev of f.supportingEvidence ?? []) {
        rows.push({
          id: `${f.id}:${ev.evidenceId}`,
          unitId: f.unitId,
          unitName: f.unitName,
          evidenceId: ev.evidenceId,
          evidenceType: ev.evidenceType,
          strength: ev.strength,
          locator: ev.locator,
        });
      }
    }
    return rows;
  }, [output.findings]);

  const aggregation = output.aggregation ?? null;
  const aggregationEntries = aggregation?.byGroup ? Object.entries(aggregation.byGroup) : [];
  const evidenceCompleteness = output.evidenceCompleteness ?? null;

  const lifecycleTone = superseded ? 'neutral' : 'success';
  const lifecycleLabel = superseded
    ? t('assessment.report.lifecycleSuperseded', 'Zamrożony — zastąpiony nowszą rewizją')
    : t('assessment.report.lifecycleFrozen', 'Zamrożony (niezmienny)');

  // ── Formuła właściciela, punkt 2: „siedem osi" ────────────────────────────
  // Rozdziały osi powstają z metodyki (wszystkie 7, także te NIEobjęte tą
  // oceną — inaczej dokument milczy o tym, czego nie zbadano), a treść per
  // obszar z zamrożonego Outputu. Pusta lista = pakiet inny niż DRD albo
  // niezgodna przypięta wersja; wtedy dokument degraduje się do samego
  // zestawienia zbiorczego, zamiast pokazać opisy z innej wersji metodyki.
  const axisNarratives = useMemo(
    () => listDrdAxisNarratives(output.methodPackId, output.methodPackVersion),
    [output.methodPackId, output.methodPackVersion]
  );

  const unitIdsByAxis = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const unitId of unitIds) {
      const label = resolveDrdUnitLabel(output.methodPackId, output.methodPackVersion, unitId);
      const key = label?.axisId ?? 'axis-nieznana';
      const bucket = map.get(key);
      if (bucket) bucket.push(unitId);
      else map.set(key, [unitId]);
    }
    return map;
  }, [unitIds, output.methodPackId, output.methodPackVersion]);

  /** Jednostki, których metodyka nie umiała przypisać do osi (obcy pakiet,
   * niezgodna wersja, nieznany identyfikator) — nie wolno ich zgubić między
   * rozdziałami, więc dostają własny, jawnie nazwany blok. */
  const unitsOutsideAxes = useMemo(
    () => unitIdsByAxis.get('axis-nieznana') ?? [],
    [unitIdsByAxis]
  );

  const axesCoveredCount = useMemo(
    () => axisNarratives.filter((a) => (unitIdsByAxis.get(a.axisId) ?? []).length > 0).length,
    [axisNarratives, unitIdsByAxis]
  );

  const totalMethodAreas = useMemo(
    () => axisNarratives.reduce((sum, a) => sum + a.areas.length, 0),
    [axisNarratives]
  );

  const levelScaleSummary = useMemo(
    () => axisNarratives.map((a) => a.levelCount).join('/'),
    [axisNarratives]
  );

  /** Największa luka — `gaps` jest już posortowane malejąco po `gap`. */
  const largestGap = gaps[0] ?? null;

  const surveyModeLabel =
    session?.mode === 'teresa_led'
      ? 'prowadzona przez asystenta (Teresa), z zapisem każdego kroku w event-store'
      : session?.mode === 'guided_manual'
        ? 'prowadzona przez konsultanta — odpowiedzi i dowody wprowadzane ręcznie w sesji'
        : 'tryb prowadzenia nie został zapisany w metadanych sesji';

  return (
    <article className="mx-auto flex max-w-[880px] flex-col gap-4 pb-16">
      {/* ── Demo bypass banner — never hidden (CLAUDE.md #7) ───────────── */}
      {output.demoBypassActive ? (
        <div className="flex items-start gap-2 rounded-xl border border-c-warning/40 bg-c-warning/10 px-4 py-3 text-xs text-c-warning">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            {t(
              'assessment.report.demoBypassBanner',
              'Ten Output pochodzi z sesji utworzonej przez tryb demo (ominięcie bramki gotowości pakietu). To NIE jest wynik produkcyjny — nie może być przedstawiony jako zatwierdzony wynik pilota/produkcji.'
            )}
          </p>
        </div>
      ) : null}

      {/* ── 1. Header ───────────────────────────────────────────────────── */}
      <header className="rounded-2xl border border-c-border-subtle bg-c-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              {t('assessment.report.title', 'Raport oceny dojrzałości')}
            </p>
            <h1 className="mt-1 text-lg font-semibold text-c-text">
              {output.methodPackId.toUpperCase()} · {output.methodPackVersion}
            </h1>
            <p className="mt-1 text-xs text-c-text-secondary">{output.scope}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <StatusChip label={lifecycleLabel} tone={lifecycleTone} />
            {output.demoBypassActive ? (
              <StatusChip label={t('assessment.report.demoMode', 'Tryb demo')} tone="warning" />
            ) : null}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Property
            label={t('assessment.report.project', 'Projekt')}
            value={session?.projectId ?? t('assessment.report.noProject', 'Brak przypisanego projektu')}
            mono={!!session?.projectId}
          />
          <Property label={t('assessment.report.session', 'Sesja')} value={output.sessionId} mono />
          <Property label={t('assessment.report.outputVersion', 'Wersja Outputu')} value={`v${output.outputVersion}`} />
          <Property
            label={t('assessment.report.frozenAt', 'Data zamrożenia')}
            value={formatDateTime(output.frozenAt)}
          />
          <Property
            label={t('assessment.report.approvedBy', 'Zatwierdził')}
            value={
              latestApproval ? (
                <span>
                  <span className="font-mono text-[12px]">{latestApproval.actorUserId}</span>
                  {' · '}
                  {formatDate(latestApproval.createdAt)}
                </span>
              ) : (
                <span className="italic text-c-text-muted">
                  {t('assessment.report.noApproval', 'Brak zarejestrowanego zatwierdzenia')}
                </span>
              )
            }
          />
          <Property label={t('assessment.report.module', 'Moduł')} value={output.module} />
        </dl>

        {superseded ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs text-c-text-secondary">
            <FileWarning size={14} className="mt-0.5 shrink-0 text-c-text-muted" aria-hidden="true" />
            <span>
              {t(
                'assessment.report.supersededNotice',
                'Ten Output został zastąpiony nowszą rewizją{{suffix}}. Poniższa treść pozostaje niezmiennym zapisem TEJ rewizji — nie jest aktualizowana.',
                { suffix: supersededByOutputId ? ` (${supersededByOutputId})` : '' }
              )}
            </span>
          </div>
        ) : null}
      </header>

      {/* ══ 1. WSTĘP — jak prowadzono badanie ═════════════════════════════
          Formuła właściciela, punkt 1. Wszystko poniżej to fakty już
          zapisane (metadane sesji, ślad zatwierdzeń, liczniki dowodowe
          z Outputu) ułożone w prozę — ani jedna liczba nie jest tu
          przeliczana, ani jedno zdanie nie opisuje badania, którego dane
          nie potwierdzają. */}
      <Chapter
        id="wstep"
        number={1}
        title={t('assessment.report.chapter1.title', 'Jak prowadzono badanie')}
        icon={ClipboardList}
        lede={t(
          'assessment.report.chapter1.lede',
          'Zakres, tryb i granice wiarygodności tej oceny — zanim padnie pierwsza liczba.'
        )}
      >
        <SectionCard id="wstep-przebieg" title={t('assessment.report.chapter1.courseTitle', 'Przebieg oceny')}>
          <div className="space-y-2 text-xs leading-relaxed text-c-text-secondary">
            <p>
              Ocenę przeprowadzono metodyką <strong className="text-c-text">{output.methodPackId.toUpperCase()}</strong>{' '}
              w wersji pakietu <span className="font-mono text-[11px]">{output.methodPackVersion}</span>
              {axisNarratives.length > 0 ? (
                <>
                  {' '}— {axisNarratives.length} osi transformacji, łącznie {totalMethodAreas} obszarów
                  analitycznych, każda oś na własnej skali dojrzałości ({levelScaleSummary} poziomów).
                </>
              ) : (
                '.'
              )}{' '}
              Sesja była {surveyModeLabel}.
            </p>
            <p>
              Badanie objęło <strong className="text-c-text">{unitIds.length}</strong>
              {totalMethodAreas > 0 ? <> z {totalMethodAreas}</> : null} obszarów
              {axisNarratives.length > 0 ? (
                <>
                  {' '}w <strong className="text-c-text">{axesCoveredCount}</strong> z {axisNarratives.length} osi
                </>
              ) : null}
              . Dla {output.findings?.length ?? 0} z nich organizacja dostarczyła dowód, który został przyjęty;
              dla {unitsWithoutFinding.length} dowodu nie przyjęto — te obszary są w rozdziale 3 wymienione
              z nazwy i nie są liczone jako zero.
              {evidenceCompleteness
                ? ` Kompletność dowodowa tej oceny wynosi ${Math.round((evidenceCompleteness.completenessRatio ?? 0) * 100)}%.`
                : ''}
            </p>
            <p>
              Wynik zamrożono {formatDateTime(output.frozenAt)}
              {session?.createdAt ? <>, sesję otwarto {formatDate(session.createdAt)}</> : null}.{' '}
              {latestApproval ? (
                <>
                  Zatwierdzenie zarejestrowano{' '}
                  {formatDate(latestApproval.createdAt)} (rewizja {latestApproval.revision})
                  {latestApproval.comment ? <> — „{latestApproval.comment}"</> : null}.
                </>
              ) : (
                <>
                  Dla tej rewizji <strong className="text-c-text">nie zarejestrowano zatwierdzenia</strong> —
                  dokument jest odczytem zamrożonego wyniku, nie wynikiem zatwierdzonym.
                </>
              )}
            </p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Property label="Właściciel sesji" value={session?.ownerUserId ?? '—'} mono={!!session?.ownerUserId} />
            <Property label="Otwarcie sesji" value={formatDate(session?.createdAt)} />
            <Property label="Zamrożenie wyniku" value={formatDate(output.frozenAt)} />
            <Property label="Rewizja sesji" value={session ? `v${session.version}` : '—'} />
          </dl>
        </SectionCard>

        {/* Zastrzeżenia metodyczne należą do wstępu, nie do stopki — czytelnik
            ma je poznać PRZED liczbami, nie po nich. */}
        {output.limitations && output.limitations.length > 0 ? (
          <SectionCard id="limitations" title="Ograniczenia i założenia" icon={AlertTriangle}>
            <ul className="list-disc space-y-1.5 pl-5 text-xs text-c-text-secondary">
              {output.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </SectionCard>
        ) : null}
      </Chapter>

      {/* ══ 2. SIEDEM OSI ═════════════════════════════════════════════════
          Tytuł słowami właściciela („Siedem osi") — liczebnik słownie tylko
          wtedy, gdy metodyka faktycznie ma siedem osi; inaczej cyfra. */}
      <Chapter
        id="osie"
        number={2}
        title={axisNarratives.length === 7 ? 'Siedem osi metodyki' : `Osie metodyki (${axisNarratives.length})`}
        icon={BookOpen}
        lede="Dla każdej osi: czym oś jest, a następnie każdy jej obszar analityczny — z definicją poziomu obecnego i docelowego."
      >
      <SectionCard id="overall" title="Wynik ogólny" icon={CheckCircle2}>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat label="Ocenionych jednostek" value={unitIds.length} />
          <SummaryStat label="Z potwierdzonym dowodem" value={output.findings?.length ?? 0} />
          <SummaryStat label="Bez przyjętego dowodu" value={unitsWithoutFinding.length} />
          <SummaryStat label="Jednostek z luką" value={gaps.length} />
        </div>
        {aggregationEntries.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              Wynik per wymiar (oś)
            </p>
            {aggregationEntries.map(([axisId, value]) => {
              const targetsInAxis = Object.entries(output.gap ?? {});
              void targetsInAxis;
              // FIX-ATOM #8: resolve the raw `axis-N` group key to its
              // Polish axis name (same dictionary the "Jednostka oceny"
              // table below already uses) — never a bare code, known or
              // not (honest fallback to the raw id only when the pack
              // version genuinely doesn't match, same contract as
              // resolveDrdUnitLabel elsewhere in this file).
              const axisName =
                resolveDrdAxisName(output.methodPackId, output.methodPackVersion, axisId) ?? axisId;
              return (
                <div key={axisId} className="flex items-center justify-between gap-3 rounded-lg border border-c-border-subtle px-3 py-2">
                  <span className="text-xs font-medium text-c-text">{axisName}</span>
                  <span className="text-xs tabular-nums text-c-text-secondary">
                    {value === null ? '—' : value}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs italic text-c-text-muted">
            Ten Output nie zawiera zagregowanego wyniku per wymiar (oś) — kernel liczy tę agregację poza
            momentem zamrożenia (patrz „Ograniczenia i założenia" powyżej). Poniżej pełny wynik per
            jednostka, z których taka agregacja by się składała.
          </p>
        )}
      </SectionCard>

        {/* ── Rozdziały osi: opis osi → obszary z definicją poziomów ────── */}
        {axisNarratives.length === 0 ? (
          <p className="rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs italic text-c-text-muted">
            Opisy osi i poziomów są dostępne wyłącznie dla pakietu DRD w wersji zgodnej z wersją przypiętą
            w tym Outpucie ({output.methodPackId} {output.methodPackVersion}). Ten Output przypina wersję,
            której skompilowany pakiet nie zna — dokument pokazuje więc same liczby, bez definicji metodyki,
            zamiast opisywać poziomy z innej wersji metodyki niż ta, którą oceniano.
          </p>
        ) : (
          axisNarratives.map((axis) => (
            <AxisSection
              key={axis.axisId}
              axis={axis}
              unitIds={unitIdsByAxis.get(axis.axisId) ?? []}
              output={output}
              aggregatedLevel={output.aggregation?.byGroup?.[axis.axisId]}
            />
          ))
        )}

        {unitsOutsideAxes.length > 0 ? (
          <SectionCard id="axis-unmapped" title="Jednostki poza strukturą osi" icon={AlertTriangle}>
            <p className="mb-2 text-xs text-c-text-secondary">
              Tych jednostek nie da się przypisać do żadnej osi metodyki przypiętej w tym Outpucie. Są
              wymienione, żeby nie wypadły z dokumentu między rozdziałami.
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {unitsOutsideAxes.map((unitId) => (
                <li
                  key={unitId}
                  className="rounded-full border border-c-border-subtle px-2.5 py-1 font-mono text-[11px] text-c-text-muted"
                >
                  {unitId}
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}

        {/* Zestawienie zbiorcze — jedna tabela na wszystkie jednostki, żeby
            czytelnik miał obraz całości bez przewijania siedmiu rozdziałów.
            Kanon: StandardTable, nigdy własna tabela. */}
        <SectionCard id="dimensions" title="Zestawienie zbiorcze wszystkich jednostek" icon={CheckCircle2}>
          <StandardTable columns={dimensionColumns} data={dimensionRows} minTableWidth="auto" persistKey="assessment.report.dimensions" />
        </SectionCard>
      </Chapter>

      {/* ══ 3. ODPOWIEDZI I WSTĘPNA PALETA WNIOSKÓW ═══════════════════════ */}
      <Chapter
        id="odpowiedzi"
        number={3}
        title="Odpowiedzi i wstępna paleta wniosków"
        icon={Lightbulb}
        lede="Co organizacja pokazała na dowód, czego nie pokazała, i co z tego wynika."
      >
        {/* ★ UCZCIWOŚĆ, nie ozdobnik. Właściciel prosi w punkcie 3 o
            „odpowiedzi". Zamrożony Output NIE niesie treści odpowiedzi —
            niesie przyjęty poziom i lokalizatory dowodów; treść zdarzeń
            `ANSWER_CONFIRMED` zostaje w event-store i nie jest kopiowana do
            `method_findings` (zmierzone: RAPORT_OCENY_STAN.md, wymaganie 3a).
            Dokument mówi to wprost, zamiast podać dowody jako odpowiedzi. */}
        <div className="flex items-start gap-2 rounded-xl border border-c-border-subtle bg-c-surface-raised px-4 py-3 text-xs text-c-text-secondary">
          <FileWarning size={14} className="mt-0.5 shrink-0 text-c-text-muted" aria-hidden="true" />
          <p>
            Zamrożony Output przenosi <strong className="text-c-text">przyjęty poziom i dowody</strong>, a nie
            dosłowną treść odpowiedzi z sesji — ta zostaje w zapisie zdarzeń sesji. Poniżej jest więc to, co
            dokument naprawdę ma: materiał dowodowy per obszar, obszary bez dowodu, oraz wnioski wyprowadzone
            z przyjętych poziomów.
          </p>
        </div>

      <SectionCard id="strengths-gaps" title="Mocne strony i luki" icon={Lightbulb}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-c-success">
              Mocne strony ({strengths.length})
            </p>
            <ul className="space-y-2">
              {strengths.length === 0 ? (
                <li className="text-xs italic text-c-text-muted">Brak jednostek bez luki w tym Outpucie.</li>
              ) : (
                strengths.map((f) => (
                  <li key={f.id} className="rounded-lg border border-c-border-subtle px-3 py-2">
                    <p className="text-xs font-medium text-c-text">
                      {f.unitName} <span className="font-mono text-c-text-muted">({f.unitId})</span>
                    </p>
                    <p className="mt-0.5 text-xs text-c-text-secondary">{f.businessMeaning}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-c-danger">
              Luki ({gaps.length})
            </p>
            <ul className="space-y-2">
              {gaps.length === 0 ? (
                <li className="text-xs italic text-c-text-muted">Brak zidentyfikowanych luk w tym Outpucie.</li>
              ) : (
                gaps.map((f) => (
                  <li key={f.id} className="rounded-lg border border-c-border-subtle px-3 py-2">
                    <p className="text-xs font-medium text-c-text">
                      {f.unitName} <span className="font-mono text-c-text-muted">({f.unitId})</span>
                      <span className="ml-2 text-c-danger">luka {f.gap}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-c-text-secondary">{f.riskOrOpportunity ?? f.businessMeaning}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </SectionCard>

      {/* ── 5. Odpowiedzi „nie wiem" / brak dowodu ───────────────────────── */}
      <SectionCard id="unknowns" title="Brak wiedzy w organizacji („nie wiem” / brak dowodu)" icon={HelpCircle}>
        <p className="mb-3 text-xs text-c-text-secondary">
          To nie jest „zero punktów" — to osobna, diagnostyczna kategoria: organizacja nie potrafiła w
          momencie oceny dostarczyć wystarczającego dowodu dla poniższych jednostek. Zamrożony Output nie
          rozróżnia dziś „odpowiedziano nie wiem" od „nikt jeszcze nie odpowiedział" na poziomie pojedynczej
          jednostki (patrz „Ograniczenia i założenia") — poniższa lista pokazuje jednostki BEZ przyjętego
          dowodu, czyli obie te sytuacje razem, uczciwie nierozróżnione.
        </p>
        {evidenceCompleteness ? (
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="Jednostek łącznie" value={evidenceCompleteness.totalUnits} />
            <SummaryStat label="Z przyjętym dowodem" value={evidenceCompleteness.unitsWithAcceptedEvidence} />
            <SummaryStat label="Bez przyjętego dowodu" value={evidenceCompleteness.unitsMissingEvidence} />
            <SummaryStat
              label="Kompletność dowodowa"
              value={`${Math.round((evidenceCompleteness.completenessRatio ?? 0) * 100)}%`}
            />
          </div>
        ) : null}
        {unitsWithoutFinding.length === 0 ? (
          <p className="text-xs italic text-c-text-muted">Każda oceniana jednostka ma przyjęty dowód.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {unitsWithoutFinding.map((unitId) => {
              const label = resolveDrdUnitLabel(output.methodPackId, output.methodPackVersion, unitId);
              return (
                <li
                  key={unitId}
                  className="rounded-full border border-c-warning/40 bg-c-warning/10 px-2.5 py-1 text-[11px] font-medium text-c-warning"
                  title={unitId}
                >
                  {label?.unitName ?? unitId}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* ── 6. Dowody ───────────────────────────────────────────────────── */}
      <SectionCard id="evidence" title="Dowody" icon={FileWarning}>
        {evidenceRows.length === 0 ? (
          <p className="text-xs italic text-c-text-muted">Ten Output nie ma zarejestrowanych dowodów.</p>
        ) : (
          <StandardTable
            columns={[
              { id: 'unitName', label: 'Kryterium', render: (row) => (
                <span className="text-xs text-c-text">
                  {row.unitName as string} <span className="font-mono text-c-text-muted">({row.unitId as string})</span>
                </span>
              ) },
              { id: 'evidenceType', label: 'Typ dowodu', width: '140px' },
              {
                id: 'strength',
                label: 'Siła',
                width: '90px',
                render: (row) => <span className="font-mono text-xs">{row.strength as string}</span>,
              },
              { id: 'locator', label: 'Lokalizacja / odniesienie', render: (row) => (
                <span className="truncate font-mono text-[11px] text-c-text-muted">{row.locator as string}</span>
              ) },
            ]}
            data={evidenceRows}
            minTableWidth="auto"
            persistKey="assessment.report.evidence"
          />
        )}
      </SectionCard>

      </Chapter>

      {/* ══ 4. PODSUMOWANIE ═══════════════════════════════════════════════ */}
      <Chapter
        id="podsumowanie"
        number={4}
        title="Podsumowanie"
        icon={Target}
        lede="Domknięcie: obraz całości i kolejność działań wynikająca z przyjętych poziomów."
      >
        <SectionCard id="closing" title="Obraz całości">
          <div className="space-y-2 text-xs leading-relaxed text-c-text-secondary">
            <p>
              Ocena objęła {unitIds.length}
              {totalMethodAreas > 0 ? <> z {totalMethodAreas}</> : null} obszarów
              {axisNarratives.length > 0 ? <> w {axesCoveredCount} z {axisNarratives.length} osi</> : null}.
              W {strengths.length} obszarach organizacja jest na poziomie docelowym lub powyżej;
              w {gaps.length} pozostaje luka
              {largestGap
                ? (
                    <>
                      , największa na obszarze <strong className="text-c-text">{largestGap.unitName}</strong>{' '}
                      ({largestGap.gap} {largestGap.gap === 1 ? 'poziom' : 'poziomy'})
                    </>
                  )
                : null}
              .
            </p>
            <p>
              {unitsWithoutFinding.length === 0
                ? 'Każdy oceniany obszar ma przyjęty dowód — wynik można traktować jako udokumentowany w całości.'
                : `Dla ${unitsWithoutFinding.length} obszarów nie przyjęto dowodu. To nie są zera: to obszary, o których ta ocena nie rozstrzyga, i pierwsza pozycja do domknięcia w kolejnej rundzie.`}
            </p>
            <p>
              Kolejność działań poniżej wynika wyłącznie z wielkości luki między poziomem obecnym
              a docelowym — nie z osobnego modelu priorytetyzacji.
            </p>
          </div>
        </SectionCard>

      <SectionCard id="recommendations" title="Rekomendacje priorytetowe" icon={Lightbulb}>
        {recommendations.length === 0 ? (
          <p className="text-xs italic text-c-text-muted">Brak rekomendacji w tym Outpucie.</p>
        ) : (
          <ol className="space-y-3">
            {recommendations.map((f, idx) => (
              <li key={f.id} className="rounded-lg border border-c-border-subtle px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-c-text">
                    {idx + 1}. {f.unitName} <span className="font-mono text-c-text-muted">({f.unitId})</span>
                  </p>
                  {/* „luka 0" wydrukowana tonem ostrzegawczym była sygnałem
                      wprost odwrotnym do prawdy — obszar bez luki dostawał
                      w podsumowaniu ten sam czerwony znacznik co obszar
                      z luką 3. Ton krytyczny należy się WYŁĄCZNIE luce > 0. */}
                  {f.gap !== null && f.gap > 0 ? (
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-c-danger">luka {f.gap}</span>
                  ) : f.gap === 0 ? (
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-c-success">bez luki</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-c-text-secondary">{f.recommendation}</p>
                {f.priorityRationale ? (
                  <p className="mt-1 text-[11px] italic text-c-text-muted">Uzasadnienie priorytetu: {f.priorityRationale}</p>
                ) : null}
                {f.expectedOutcome ? (
                  <p className="mt-1 text-[11px] text-c-text-muted">Oczekiwany efekt: {f.expectedOutcome}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
      </Chapter>

      {/* ── Stopka ──────────────────────────────────────────────────────── */}
      <footer className="rounded-2xl border border-c-border-subtle bg-c-surface-raised p-5 text-[11px] text-c-text-muted">
        <p className="mb-2 font-semibold text-c-text-secondary">
          Ten dokument jest odczytem zamrożonego, niezmiennego Outputu. Treść nie jest przeliczana przy
          wyświetlaniu — pokazuje dokładnie to, co zostało zatwierdzone w momencie zamrożenia.
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <Property label="Identyfikator Outputu" value={output.id} mono />
          <Property label="Skrót treści (hash)" value={output.contentHash} mono />
          <Property label="Wersja Outputu" value={`v${output.outputVersion}`} />
          <Property label="Zamrożono" value={formatDateTime(output.frozenAt)} />
        </dl>
      </footer>
    </article>
  );
};

const SummaryStat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2.5">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">{label}</p>
    <p className="mt-0.5 text-lg font-semibold tabular-nums text-c-text">{value}</p>
  </div>
);

export default AssessmentReportDocument;
