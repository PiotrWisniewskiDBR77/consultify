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
  FileText,
  Download,
  FileWarning,
  HelpCircle,
  Lightbulb,
  ShieldAlert,
  Target,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import {
  DRDMatrixReadOnly,
  drdOdpowiedziZOutputu,
} from '../drd/DRDMatrixReadOnly';

import { getHeaders } from '@/services/api/baseClient';

import { idOcenyZWierszaZastanego } from '../assessmentOutputProjection';

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
import { localeListy } from '@/utils/listDateFormat';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(localeListy(), {
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
    return new Intl.DateTimeFormat(localeListy(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
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
}) => {
  const { t } = useTranslation();
  return (
    <p className={`text-xs leading-relaxed text-c-text-secondary ${className ?? ''}`}>
      {language === 'en' ? (
        <span
          className="mr-1.5 rounded border border-c-border-subtle px-1 py-px align-middle text-[9px] font-semibold uppercase tracking-wider text-c-text-muted"
          title={t(
            'assessment.report.methodologySourceEn',
            'Source: the DRD methodology in its English original — this axis has no Polish translation in the pack yet.'
          )}
        >
          EN
        </span>
      ) : null}
      {text}
    </p>
  );
};

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
  /** Notatka konsultanta z zapisu sesji (`answers.drd.areas[*].levelNotes`
   * dla poziomu obecnego) — tekst zapisany, nie wyliczony. */
  note?: string | null;
}> = ({
  unitId,
  unitName,
  methodPackId,
  methodPackVersion,
  current,
  target,
  gap,
  levelCount,
  hasFinding,
  note,
}) => {
  const { t } = useTranslation();
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
            {t('assessment.report.area.currentLevel', 'Current level {{level}} — {{title}}', {
              level: currentLevel.level,
              title: currentLevel.title,
            })}
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
            ? t(
                'assessment.report.area.currentUnresolved',
                'The current level was not determined in this assessment.'
              )
            : t(
                'assessment.report.area.levelDefinitionMissing',
                'The methodology pinned in this Output carries no definition of this level.'
              )}
        </p>
      )}

      {/* Cel osiągnięty → NIE powtarzamy tej samej definicji drugi raz.
          Bez tego obszar bez luki drukował identyczny akapit dwa razy pod
          rząd („Poziom obecny 6 — ERP" / „Poziom docelowy 6 — ERP"), co
          w dokumencie dla zarządu czyta się jak błąd składu. */}
      {targetLevel && targetLevel.level !== currentLevel?.level ? (
        <div className="mt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
            {t('assessment.report.area.targetLevel', 'Target level {{level}} — {{title}}', {
              level: targetLevel.level,
              title: targetLevel.title,
            })}
          </p>
          <MethodologyProse
            className="mt-0.5"
            text={targetLevel.description}
            language={targetLevel.sourceLanguage}
          />
        </div>
      ) : targetLevel ? (
        <p className="mt-2 text-[11px] font-medium text-c-success">
          {t(
            'assessment.report.area.targetReached',
            'Target level {{level}} — reached; definition as above.',
            { level: targetLevel.level }
          )}
        </p>
      ) : null}

      {note ? (
        <div className="mt-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-2.5 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
            {t('assessment.report.area.assessmentNote', 'Assessment note')}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-c-text">{note}</p>
        </div>
      ) : null}

      {!hasFinding ? (
        <p className="mt-2 text-[11px] font-medium text-c-warning">
          {t(
            'assessment.report.area.noAcceptedEvidence',
            'No accepted evidence for this area — the numbers above come from the session record, but are not backed by accepted evidence material.'
          )}
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
  unitNotes?: Readonly<Record<string, string>>;
  zZapisuSesji?: boolean;
}> = ({ axis, unitIds, output, aggregatedLevel, unitNotes, zZapisuSesji }) => {
  const { t } = useTranslation();
  const findingUnitIds = new Set((output.findings ?? []).map((f) => f.unitId));
  const assessed = axis.areas.filter((a) => unitIds.includes(a.id));
  const notAssessed = axis.areas.filter((a) => !unitIds.includes(a.id));

  return (
    <SectionCard
      id={`os-${axis.axisNumber}`}
      eyebrow={t(
        'assessment.report.axis.eyebrow',
        'Axis {{number}} of 7 · scale 1–{{levels}} · {{areas}} areas',
        { number: axis.axisNumber, levels: axis.levelCount, areas: axis.areas.length }
      )}
      title={`${axis.axisNumber}. ${axis.axisName}`}
    >
      {axis.description ? (
        <MethodologyProse text={axis.description} language={axis.descriptionLanguage} className="mb-3" />
      ) : null}

      <p className="mb-3 text-[11px] text-c-text-muted">
        {t('assessment.report.axis.assessedCount', '{{assessed}} of {{total}} areas of this axis assessed.', {
          assessed: assessed.length,
          total: axis.areas.length,
        })}
        {aggregatedLevel !== null && aggregatedLevel !== undefined
          ? ` ${t('assessment.report.axis.axisScore', 'Axis score: {{score}} (scale 1–{{levels}}).', {
              score: aggregatedLevel,
              levels: axis.levelCount,
            })}`
          : zZapisuSesji
            ? ` ${t(
                'assessment.report.axis.scoreOnFreeze',
                'The axis score is produced when the assessment is frozen — this assessment has not been frozen yet.'
              )}`
            : ` ${t(
                'assessment.report.axis.scoreMissing',
                'The frozen Output carries no aggregated score for this axis.'
              )}`}
      </p>

      {assessed.length === 0 ? (
        <p className="rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs italic text-c-text-muted">
          {t(
            'assessment.report.axis.noAreaAssessed',
            'No area of this axis was covered by this assessment. The axis stays in the document so the reader can see what the study did not touch — dropping the chapter would change the perceived scope of the assessment.'
          )}
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
              note={unitNotes?.[area.id] ?? null}
            />
          ))}
        </div>
      )}

      {assessed.length > 0 && notAssessed.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
            {t('assessment.report.axis.notAssessedAreas', 'Areas of this axis not covered ({{count}})', {
              count: notAssessed.length,
            })}
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
// Pobieranie plików — DOCX · PPTX · PDF
// ---------------------------------------------------------------------------

/**
 * Trzy przyciski pobierania dla oceny z magazynu zastanego.
 *
 * ★ PO CO. Raport i prezentacja istniały dotąd WYŁĄCZNIE jako ekran. Właściciel
 * ocenia dokument otwierając PLIK, nie oglądając ekran — a z tego ekranu nie
 * dało się pobrać niczego. To jest ten ostatni przewód: przycisk → trasa
 * `/api/assessment-reports/assessment/:id/export/*` → gotowy plik.
 *
 * Wynik zamrożony w jądrze ma własny przycisk DOCX w `AssessmentReportContractView`
 * (trasa `/api/method/...`), dlatego ten pasek pokazuje się tylko dla oceny
 * zastanej — nie dublujemy jednego działania dwoma przyciskami.
 */
const PLIKI_DO_POBRANIA = [
  { format: 'report.docx', klucz: 'docx' },
  { format: 'deck.pptx', klucz: 'pptx' },
  { format: 'deck.pdf', klucz: 'pdf' },
] as const;

const PasekPobierania: React.FC<{ assessmentId: string }> = ({ assessmentId }) => {
  const { t } = useTranslation();
  const [trwa, setTrwa] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);

  const pobierz = useCallback(
    async (format: string) => {
      setTrwa(format);
      setBlad(null);
      try {
        const headers = getHeaders();
        delete headers['Content-Type'];
        const odpowiedz = await fetch(
          `/api/assessment-reports/assessment/${encodeURIComponent(assessmentId)}/export/${format}`,
          { headers }
        );
        if (!odpowiedz.ok) {
          const tresc = (await odpowiedz.json().catch(() => ({}))) as { code?: string };
          throw new Error(tresc.code ?? `HTTP_${odpowiedz.status}`);
        }
        const dyspozycja = odpowiedz.headers.get('Content-Disposition') ?? '';
        const zUtf8 = /filename\*=UTF-8''([^;]+)/i.exec(dyspozycja);
        const zAscii = /filename="([^"]+)"/i.exec(dyspozycja);
        const nazwa = zUtf8
          ? decodeURIComponent(zUtf8[1])
          : (zAscii?.[1] ?? `${assessmentId}-${format}`);
        const blob = await odpowiedz.blob();
        const url = window.URL.createObjectURL(blob);
        const kotwica = document.createElement('a');
        kotwica.href = url;
        kotwica.download = nazwa;
        document.body.appendChild(kotwica);
        kotwica.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(kotwica);
      } catch (error) {
        setBlad(error instanceof Error ? error.message : 'UNKNOWN_ERROR');
      } finally {
        setTrwa(null);
      }
    },
    [assessmentId]
  );

  return (
    <div className="mt-4 border-t border-c-border-subtle pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
        {t('assessment.report.download.heading', 'Files to send to the client')}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PLIKI_DO_POBRANIA.map((pozycja) => (
          <button
            key={pozycja.format}
            type="button"
            onClick={() => void pobierz(pozycja.format)}
            disabled={trwa !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text transition-colors hover:bg-c-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-60"
            data-testid={`assessment-report-download-${pozycja.klucz}`}
          >
            <Download size={14} aria-hidden="true" />
            {trwa === pozycja.format
              ? t('assessment.report.download.inProgress', 'Preparing the file…')
              : pozycja.klucz === 'docx'
                ? t('assessment.report.download.docx', 'Download report (DOCX)')
                : pozycja.klucz === 'pptx'
                  ? t('assessment.report.download.pptx', 'Download deck (PPTX)')
                  : t('assessment.report.download.pdf', 'Download deck (PDF)')}
          </button>
        ))}
      </div>
      {blad ? (
        <p className="mt-2 text-xs text-c-danger" role="alert">
          {t('assessment.report.download.error', 'The file could not be downloaded — code: {{code}}', {
            code: blad,
          })}
        </p>
      ) : null}
    </div>
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
  // Magazyn, z którego przyszedł wynik — patrz
  // `src/components/assessment/assessmentOutputProjection.ts`. Brak pola =
  // stary, kanoniczny przypadek (zamrożony Output jądra).
  const zZapisuSesji = data.source === 'legacy';
  const unitNotes = data.unitNotes;
  // Identyfikator oceny zastanej wyjęty z identyfikatora wiersza (`ocena~<id>`)
  // — to jest klucz, którym trasy eksportu adresują ocenę.
  const idOceny = zZapisuSesji ? idOcenyZWierszaZastanego(output.id) : null;
  const narrative = data.narrative ?? null;

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
        label: t('assessment.report.table.unitName', 'Assessment unit'),
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
        label: t('assessment.report.table.levels', 'Current / Target'),
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
        label: t('assessment.report.table.gap', 'Gap'),
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
        label: t('assessment.report.table.band', 'Position on the scale'),
        width: '140px',
        render: (row) => (row.bandLabel ? <span className="text-xs text-c-text-secondary">{row.bandLabel as string}</span> : <span className="text-c-text-muted">—</span>),
      },
      {
        id: 'hasFinding',
        label: t('assessment.report.table.evidence', 'Evidence'),
        width: '132px',
        render: (row) =>
          row.hasFinding ? (
            <StatusChip
              label={t('assessment.report.table.evidenceConfirmed', 'Confirmed by evidence')}
              tone="success"
              size="sm"
            />
          ) : (
            <StatusChip
              label={t('assessment.report.table.evidenceMissing', 'No evidence')}
              tone="warning"
              size="sm"
            />
          ),
      },
    ],
    [t]
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

  // ★ Liczniki luk liczone z LICZB Outputu (`current`/`target`), nie z listy
  // wniosków. Poprzednio „Jednostek z luką" brało `gaps.length` (wnioski),
  // więc Output BEZ wniosków — a taki jest każdy wynik z zapisu sesji —
  // drukował „0 jednostek z luką" tuż obok 39 obszarów pokazujących +3, +2, +1.
  // To ta sama liczba w dwóch miejscach dokumentu, sprzeczna ze sobą.
  const jednostkiZLuka = useMemo(
    () =>
      unitIds
        .map((id) => ({ id, gap: output.gap?.[id] ?? null }))
        .filter((u): u is { id: string; gap: number } => typeof u.gap === 'number' && u.gap > 0)
        .sort((a, b) => b.gap - a.gap),
    [unitIds, output.gap]
  );
  const jednostkiBezLuki = useMemo(
    () => unitIds.filter((id) => typeof output.gap?.[id] === 'number' && (output.gap[id] as number) <= 0),
    [unitIds, output.gap]
  );
  const najwiekszaLuka = jednostkiZLuka[0] ?? null;
  const nazwaJednostki = useCallback(
    (unitId: string): string =>
      resolveDrdUnitLabel(output.methodPackId, output.methodPackVersion, unitId)?.unitName ??
      findingByUnit.get(unitId)?.unitName ??
      unitId,
    [output.methodPackId, output.methodPackVersion, findingByUnit]
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

  // Wynik z magazynu zastanego NIE jest zamrożony — chip nie może twierdzić
  // inaczej, bo „Zamrożony (niezmienny)" to obietnica, której ten zapis nie
  // spełnia (ocena wciąż może się zmienić w warsztacie).
  const lifecycleTone: 'neutral' | 'success' | 'warning' = zZapisuSesji
    ? 'warning'
    : superseded
      ? 'neutral'
      : 'success';
  const lifecycleLabel = zZapisuSesji
    ? t('assessment.report.lifecycleSessionRecord', 'Assessment session record — not frozen yet')
    : superseded
      ? t('assessment.report.lifecycleSuperseded', 'Frozen — superseded by a newer revision')
      : t('assessment.report.lifecycleFrozen', 'Frozen (immutable)');

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

  // Cała fraza, nie wrzutka do „Sesja była …" — inaczej brak metadanych dawał
  // zdanie „Sesja była tryb prowadzenia nie został zapisany", które w dokumencie
  // dla zarządu czyta się jak usterka składu.
  const surveyModeSentence =
    session?.mode === 'teresa_led'
      ? t(
          'assessment.report.surveyMode.teresaLed',
          'The session was led by the assistant (Teresa), with every step recorded in the event store.'
        )
      : session?.mode === 'guided_manual'
        ? t(
            'assessment.report.surveyMode.guidedManual',
            'The session was led by a consultant — answers and evidence entered manually during the session.'
          )
        : t(
            'assessment.report.surveyMode.unknown',
            'The way the session was run was not recorded in the metadata.'
          );

  return (
    <article className="mx-auto flex max-w-[880px] flex-col gap-4 pb-16">
      {/* ── Demo bypass banner — never hidden (CLAUDE.md #7) ───────────── */}
      {output.demoBypassActive ? (
        <div className="flex items-start gap-2 rounded-xl border border-c-warning/40 bg-c-warning/10 px-4 py-3 text-xs text-c-warning">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            {t(
              'assessment.report.demoBypassBanner',
              'This Output comes from a session created in demo mode (the pack readiness gate was bypassed). This is NOT a production result — it must not be presented as an approved pilot or production outcome.'
            )}
          </p>
        </div>
      ) : null}

      {/* ── Skąd pochodzi ten wynik — gdy NIE z zamrożonego Outputu jądra ──
          Dokument dla zarządu klienta nie może milczeć o tym, że liczby
          pochodzą z zapisu sesji, a nie z zamrożonego, niezmiennego wyniku.
          Baner jest częścią treści, nie ostrzeżeniem technicznym. */}
      {zZapisuSesji ? (
        <div className="flex items-start gap-2 rounded-xl border border-c-border-subtle bg-c-surface-raised px-4 py-3 text-xs text-c-text-secondary">
          <FileWarning size={16} className="mt-0.5 shrink-0 text-c-text-muted" aria-hidden="true" />
          <p>
            <Trans
              i18nKey="assessment.report.sessionRecordBanner"
              defaults="This report was produced from the <1>assessment session record</1> — the areas and the current and target levels come from answers saved in the workshop, not from a frozen, immutable Output of the method kernel. The axis structure, area names and level descriptions come from the methodology in the version compiled into this application. Until the result is frozen, the numbers may still change."
              components={[<span key="0" />, <strong key="1" className="text-c-text" />]}
            />
          </p>
        </div>
      ) : null}

      {/* ── 1. Header ───────────────────────────────────────────────────── */}
      <header className="rounded-2xl border border-c-border-subtle bg-c-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              {t('assessment.report.title', 'Maturity assessment report')}
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
            value={session?.projectId ?? t('assessment.report.noProject', 'No project assigned')}
            mono={!!session?.projectId}
          />
          <Property
            label={t('assessment.report.session', 'Sesja')}
            value={output.sessionId || '—'}
            mono={!!output.sessionId}
          />
          <Property
            label={t('assessment.report.outputVersion', 'Wersja Outputu')}
            value={zZapisuSesji ? '—' : `v${output.outputVersion}`}
          />
          <Property
            label={t('assessment.report.frozenAt', 'Frozen at')}
            value={formatDateTime(output.frozenAt)}
          />
          <Property
            label={t('assessment.report.approvedBy', 'Approved by')}
            value={
              latestApproval ? (
                <span>
                  <span className="font-mono text-[12px]">{latestApproval.actorUserId}</span>
                  {' · '}
                  {formatDate(latestApproval.createdAt)}
                </span>
              ) : (
                <span className="italic text-c-text-muted">
                  {t('assessment.report.noApproval', 'No approval recorded')}
                </span>
              )
            }
          />
          <Property
            label={t('assessment.report.module', 'Module')}
            value={
              output.module === 'assessment'
                ? t('assessment.report.moduleAssessment', 'Assessment')
                : output.module
            }
          />
        </dl>

        {superseded ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs text-c-text-secondary">
            <FileWarning size={14} className="mt-0.5 shrink-0 text-c-text-muted" aria-hidden="true" />
            <span>
              {t(
                'assessment.report.supersededNotice',
                'This Output has been superseded by a newer revision{{suffix}}. The content below stays the immutable record of THIS revision — it is not updated.',
                { suffix: supersededByOutputId ? ` (${supersededByOutputId})` : '' }
              )}
            </span>
          </div>
        ) : null}

        {idOceny ? <PasekPobierania assessmentId={idOceny} /> : null}
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
        title={t('assessment.report.chapter1.title', 'How the assessment was run')}
        icon={ClipboardList}
        lede={t(
          'assessment.report.chapter1.lede',
          'Scope, mode and the credibility limits of this assessment — before the first number.'
        )}
      >
        <SectionCard id="wstep-przebieg" title={t('assessment.report.chapter1.courseTitle', 'How the assessment progressed')}>
          <div className="space-y-2 text-xs leading-relaxed text-c-text-secondary">
            <p>
              <Trans
                i18nKey="assessment.report.intro.method"
                defaults="The assessment was carried out with the <1>{{method}}</1> methodology, pack version <3>{{version}}</3>"
                values={{ method: output.methodPackId.toUpperCase(), version: output.methodPackVersion }}
                components={[
                  <span key="0" />,
                  <strong key="1" className="text-c-text" />,
                  <span key="2" />,
                  <span key="3" className="font-mono text-[11px]" />,
                ]}
              />
              {axisNarratives.length > 0 ? (
                <>
                  {' '}
                  {t(
                    'assessment.report.intro.methodAxes',
                    '— {{axes}} transformation axes, {{areas}} analytical areas in total, each axis on its own maturity scale ({{scales}} levels).',
                    {
                      axes: axisNarratives.length,
                      areas: totalMethodAreas,
                      scales: levelScaleSummary,
                    }
                  )}
                </>
              ) : (
                '.'
              )}{' '}
              {surveyModeSentence}
            </p>
            <p>
              <Trans
                i18nKey="assessment.report.intro.coverage"
                defaults="The study covered <1>{{units}}</1>{{ofTotal}} areas"
                values={{
                  units: unitIds.length,
                  ofTotal:
                    totalMethodAreas > 0
                      ? t('assessment.report.intro.ofTotal', ' of {{total}}', {
                          total: totalMethodAreas,
                        })
                      : '',
                }}
                components={[<span key="0" />, <strong key="1" className="text-c-text" />]}
              />
              {axisNarratives.length > 0 ? (
                <>
                  {' '}
                  <Trans
                    i18nKey="assessment.report.intro.coverageAxes"
                    defaults="in <1>{{covered}}</1> of {{total}} axes"
                    values={{ covered: axesCoveredCount, total: axisNarratives.length }}
                    components={[<span key="0" />, <strong key="1" className="text-c-text" />]}
                  />
                </>
              ) : null}
              {t(
                'assessment.report.intro.evidenceSplit',
                '. For {{withEvidence}} of them the organisation provided evidence that was accepted; for {{withoutEvidence}} no evidence was accepted — those areas are listed by name in chapter 3 and are not counted as zero.',
                {
                  withEvidence: output.findings?.length ?? 0,
                  withoutEvidence: unitsWithoutFinding.length,
                }
              )}
              {evidenceCompleteness
                ? ` ${t(
                    'assessment.report.intro.completeness',
                    'The evidence completeness of this assessment is {{percent}}%.',
                    {
                      percent: Math.round((evidenceCompleteness.completenessRatio ?? 0) * 100),
                    }
                  )}`
                : ''}
            </p>
            <p>
              {zZapisuSesji
                ? t(
                    'assessment.report.intro.notFrozenYet',
                    'This result has not been frozen yet — it comes from the assessment session record'
                  )
                : t('assessment.report.intro.frozenAt', 'The result was frozen on {{date}}', {
                    date: formatDateTime(output.frozenAt),
                  })}
              {session?.createdAt
                ? t('assessment.report.intro.sessionOpened', ', the session was opened on {{date}}', {
                    date: formatDate(session.createdAt),
                  })
                : null}
              .{' '}
              {latestApproval ? (
                <>
                  {t(
                    'assessment.report.intro.approvalRecorded',
                    'The approval was recorded on {{date}} (revision {{revision}})',
                    {
                      date: formatDate(latestApproval.createdAt),
                      revision: latestApproval.revision,
                    }
                  )}
                  {latestApproval.comment
                    ? t('assessment.report.intro.approvalComment', ' — “{{comment}}”', {
                        comment: latestApproval.comment,
                      })
                    : null}
                  .
                </>
              ) : (
                <>
                  {t('assessment.report.intro.noApprovalPrefix', 'For this revision ')}
                  <strong className="text-c-text">
                    {t('assessment.report.intro.noApprovalStrong', 'no approval was recorded')}
                  </strong>
                  {' — '}
                  {zZapisuSesji
                    ? t(
                        'assessment.report.intro.readOfSessionRecord',
                        ' the document is a read-out of the session record, not an approved result.'
                      )
                    : t(
                        'assessment.report.intro.readOfFrozen',
                        ' the document is a read-out of the frozen result, not an approved result.'
                      )}
                </>
              )}
            </p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Property
              label={t('assessment.report.props.sessionOwner', 'Session owner')}
              value={session?.ownerUserId ?? '—'}
              mono={!!session?.ownerUserId}
            />
            <Property
              label={t('assessment.report.props.sessionOpened', 'Session opened')}
              value={formatDate(session?.createdAt)}
            />
            <Property
              label={t('assessment.report.props.resultFrozen', 'Result frozen')}
              value={formatDate(output.frozenAt)}
            />
            <Property
              label={t('assessment.report.props.sessionRevision', 'Session revision')}
              value={session ? `v${session.version}` : '—'}
            />
          </dl>
        </SectionCard>

        {/* Zastrzeżenia metodyczne należą do wstępu, nie do stopki — czytelnik
            ma je poznać PRZED liczbami, nie po nich. */}
        {output.limitations && output.limitations.length > 0 ? (
          <SectionCard
            id="limitations"
            title={t('assessment.report.limitationsTitle', 'Limitations and assumptions')}
            icon={AlertTriangle}
          >
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
        title={
          axisNarratives.length === 7
            ? t('assessment.report.chapter2.titleSeven', 'The seven axes of the methodology')
            : t('assessment.report.chapter2.title', 'Axes of the methodology ({{count}})', {
                count: axisNarratives.length,
              })
        }
        icon={BookOpen}
        lede={t(
          'assessment.report.chapter2.lede',
          'For every axis: what the axis is, and then each of its analytical areas — with the definition of the current and the target level.'
        )}
      >
      <SectionCard
        id="overall"
        title={t('assessment.report.overall.title', 'Overall result')}
        icon={CheckCircle2}
      >
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat
            label={t('assessment.report.overall.unitsAssessed', 'Units assessed')}
            value={unitIds.length}
          />
          <SummaryStat
            label={t('assessment.report.overall.withEvidence', 'With confirmed evidence')}
            value={output.findings?.length ?? 0}
          />
          <SummaryStat
            label={t('assessment.report.overall.withoutEvidence', 'Without accepted evidence')}
            value={unitsWithoutFinding.length}
          />
          <SummaryStat
            label={t('assessment.report.overall.unitsWithGap', 'Units with a gap')}
            value={jednostkiZLuka.length}
          />
        </div>
        {aggregationEntries.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              {t('assessment.report.overall.perDimension', 'Result per dimension (axis)')}
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
            {zZapisuSesji
              ? t(
                  'assessment.report.overall.aggregationOnFreeze',
                  'The aggregated result per dimension (axis) is produced when the assessment is frozen — this assessment has not been frozen yet, so it is not here. We do not compute a stand-in, so that the document never states a number nobody approved. Below is the full result per unit, which such an aggregation would be built from.'
                )
              : t(
                  'assessment.report.overall.aggregationMissing',
                  'This Output carries no aggregated result per dimension (axis) — the kernel computes that aggregation outside the moment of freezing (see “Limitations and assumptions” above). Below is the full result per unit, which such an aggregation would be built from.'
                )}
          </p>
        )}
      </SectionCard>

        {/* ── Rozdziały osi: opis osi → obszary z definicją poziomów ────── */}
        {axisNarratives.length === 0 ? (
          <p className="rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs italic text-c-text-muted">
            {t(
              'assessment.report.axisNarrativesUnavailable',
              'Axis and level descriptions are available only for a DRD pack whose version matches the one pinned in this Output ({{packId}} {{packVersion}}). This Output pins a version the compiled pack does not know — so the document shows the numbers alone, without methodology definitions, rather than describing levels from a different version of the methodology than the one assessed.',
              { packId: output.methodPackId, packVersion: output.methodPackVersion }
            )}
          </p>
        ) : (
          axisNarratives.map((axis) => (
            <AxisSection
              key={axis.axisId}
              axis={axis}
              unitIds={unitIdsByAxis.get(axis.axisId) ?? []}
              output={output}
              aggregatedLevel={output.aggregation?.byGroup?.[axis.axisId]}
              unitNotes={unitNotes}
              zZapisuSesji={zZapisuSesji}
            />
          ))
        )}

        {unitsOutsideAxes.length > 0 ? (
          <SectionCard
            id="axis-unmapped"
            title={t('assessment.report.unmapped.title', 'Units outside the axis structure')}
            icon={AlertTriangle}
          >
            <p className="mb-2 text-xs text-c-text-secondary">
              {t(
                'assessment.report.unmapped.body',
                'These units cannot be mapped to any axis of the methodology pinned in this Output. They are listed so that they do not fall out of the document between chapters.'
              )}
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
        <SectionCard
          id="dimensions"
          title={t('assessment.report.dimensionsTitle', 'Summary table of all units')}
          icon={CheckCircle2}
        >
          <StandardTable columns={dimensionColumns} data={dimensionRows} minTableWidth="auto" persistKey="assessment.report.dimensions" />
        </SectionCard>
      </Chapter>

      {/* ══ 3. ODPOWIEDZI I WSTĘPNA PALETA WNIOSKÓW ═══════════════════════ */}
      <Chapter
        id="odpowiedzi"
        number={3}
        title={t('assessment.report.chapter3.title', 'Answers and the initial palette of conclusions')}
        icon={Lightbulb}
        lede={t(
          'assessment.report.chapter3.lede',
          'What the organisation showed as evidence, what it did not show, and what follows from that.'
        )}
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
            {t('assessment.report.chapter3.bannerPrefix', 'A frozen Output carries ')}
            <strong className="text-c-text">
              {t('assessment.report.chapter3.bannerStrong', 'the accepted level and the evidence')}
            </strong>
            {t(
              'assessment.report.chapter3.bannerSuffix',
              ', not the literal text of the session answers — that stays in the session event record. What follows is therefore what the document really holds: the evidence material per area, the areas without evidence, and the conclusions derived from the accepted levels.'
            )}
          </p>
        </div>

      <SectionCard
        id="strengths-gaps"
        title={t('assessment.report.strengthsGaps.title', 'Strengths and gaps')}
        icon={Lightbulb}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-c-success">
              {t('assessment.report.strengthsGaps.strengths', 'Strengths ({{count}})', {
                count: strengths.length,
              })}
            </p>
            <ul className="space-y-2">
              {strengths.length === 0 ? (
                <li className="text-xs italic text-c-text-muted">
                  {t(
                    'assessment.report.strengthsGaps.noStrengths',
                    'No units without a gap in this Output.'
                  )}
                </li>
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
              {t('assessment.report.strengthsGaps.gaps', 'Gaps ({{count}})', { count: gaps.length })}
            </p>
            <ul className="space-y-2">
              {gaps.length === 0 ? (
                <li className="text-xs italic text-c-text-muted">
                  {t(
                    'assessment.report.strengthsGaps.noGaps',
                    'No gaps identified in this Output.'
                  )}
                </li>
              ) : (
                gaps.map((f) => (
                  <li key={f.id} className="rounded-lg border border-c-border-subtle px-3 py-2">
                    <p className="text-xs font-medium text-c-text">
                      {f.unitName} <span className="font-mono text-c-text-muted">({f.unitId})</span>
                      <span className="ml-2 text-c-danger">
                        {t('assessment.report.strengthsGaps.gapValue', 'gap {{gap}}', { gap: f.gap })}
                      </span>
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
          {t(
            'assessment.report.noKnowledge.body',
            'This is not “zero points” — it is a separate, diagnostic category: at the time of the assessment the organisation could not provide sufficient evidence for the units below. A frozen Output does not today distinguish “answered I don’t know” from “nobody has answered yet” at the level of a single unit (see “Limitations and assumptions”) — the list below shows the units WITHOUT accepted evidence, that is both situations together, honestly undistinguished.'
          )}
        </p>
        {evidenceCompleteness ? (
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat
              label={t('assessment.report.noKnowledge.totalUnits', 'Units in total')}
              value={evidenceCompleteness.totalUnits}
            />
            <SummaryStat
              label={t('assessment.report.noKnowledge.withAccepted', 'With accepted evidence')}
              value={evidenceCompleteness.unitsWithAcceptedEvidence}
            />
            <SummaryStat
              label={t('assessment.report.noKnowledge.withoutAccepted', 'Without accepted evidence')}
              value={evidenceCompleteness.unitsMissingEvidence}
            />
            <SummaryStat
              label={t('assessment.report.noKnowledge.completeness', 'Evidence completeness')}
              value={`${Math.round((evidenceCompleteness.completenessRatio ?? 0) * 100)}%`}
            />
          </div>
        ) : null}
        {unitsWithoutFinding.length === 0 ? (
          <p className="text-xs italic text-c-text-muted">
            {t(
              'assessment.report.noKnowledge.allCovered',
              'Every assessed unit has accepted evidence.'
            )}
          </p>
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
      <SectionCard
        id="evidence"
        title={t('assessment.report.evidence.title', 'Evidence')}
        icon={FileWarning}
      >
        {evidenceRows.length === 0 ? (
          <p className="text-xs italic text-c-text-muted">
            {t('assessment.report.evidence.none', 'This Output has no registered evidence.')}
          </p>
        ) : (
          <StandardTable
            columns={[
              { id: 'unitName', label: t('assessment.report.evidence.criterion', 'Criterion'), render: (row) => (
                <span className="text-xs text-c-text">
                  {row.unitName as string} <span className="font-mono text-c-text-muted">({row.unitId as string})</span>
                </span>
              ) },
              { id: 'evidenceType', label: t('assessment.report.evidence.type', 'Evidence type'), width: '140px' },
              {
                id: 'strength',
                label: t('assessment.report.evidence.strength', 'Strength'),
                width: '90px',
                render: (row) => <span className="font-mono text-xs">{row.strength as string}</span>,
              },
              { id: 'locator', label: t('assessment.report.evidence.locator', 'Location / reference'), render: (row) => (
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
        title={t('assessment.report.chapter4.title', 'Summary')}
        icon={Target}
        lede={t(
          'assessment.report.chapter4.lede',
          'Closing: the whole picture and the order of actions that follows from the accepted levels.'
        )}
      >
        <SectionCard
          id="closing"
          title={t('assessment.report.closing.title', 'The whole picture')}
        >
          <div className="space-y-2 text-xs leading-relaxed text-c-text-secondary">
            <p>
              {t(
                'assessment.report.closing.coverage',
                'The assessment covered {{units}}{{ofTotal}} areas{{inAxes}}. In {{withoutGap}} areas the organisation is at or above the target level; in {{withGap}} a gap remains',
                {
                  units: unitIds.length,
                  ofTotal:
                    totalMethodAreas > 0
                      ? t('assessment.report.intro.ofTotal', ' of {{total}}', {
                          total: totalMethodAreas,
                        })
                      : '',
                  inAxes:
                    axisNarratives.length > 0
                      ? t('assessment.report.closing.inAxes', ' in {{covered}} of {{total}} axes', {
                          covered: axesCoveredCount,
                          total: axisNarratives.length,
                        })
                      : '',
                  withoutGap: jednostkiBezLuki.length,
                  withGap: jednostkiZLuka.length,
                }
              )}
              {najwiekszaLuka ? (
                <>
                  <Trans
                    i18nKey="assessment.report.closing.largestGap"
                    defaults=", the largest in the area <1>{{area}}</1> ({{gap}} levels)"
                    values={{
                      area: nazwaJednostki(najwiekszaLuka.id),
                      gap: najwiekszaLuka.gap,
                    }}
                    components={[<span key="0" />, <strong key="1" className="text-c-text" />]}
                  />
                </>
              ) : null}
              .
            </p>
            <p>
              {unitsWithoutFinding.length === 0
                ? t(
                    'assessment.report.closing.allDocumented',
                    'Every assessed area has accepted evidence — the result can be treated as fully documented.'
                  )
                : t(
                    'assessment.report.closing.someUndocumented',
                    'For {{count}} areas no evidence was accepted. These are not zeros: they are areas this assessment does not decide about, and the first item to close in the next round.',
                    { count: unitsWithoutFinding.length }
                  )}
            </p>
            <p>
              {t(
                'assessment.report.closing.orderRationale',
                'The order of actions below follows only from the size of the gap between the current and the target level — not from a separate prioritisation model.'
              )}
            </p>
          </div>
        </SectionCard>

        {/* ── Treść raportu zapisanego w module Ocena ──────────────────────
            Wyłącznie dla wyniku z magazynu zastanego i wyłącznie z wiersza
            `assessment_reports` powiązanego z tą oceną: to są akapity, które
            KTOŚ napisał i zapisał, przepisane bez zmian. Gdy raportu nie ma
            albo pole jest puste — blok się nie pojawia, zamiast drukować
            wypełniacz. */}
        {narrative &&
        (narrative.executiveSummary ||
          narrative.detailedAnalysis ||
          narrative.recommendations.length > 0) ? (
          <SectionCard
            id="tresc-raportu-oceny"
            title={t('assessment.report.narrative.title', 'Content of the report saved in the Assessment module')}
            icon={FileText}
          >
            <p className="mb-2.5 text-[11px] text-c-text-muted">
              {t('assessment.report.narrative.source', 'Source: report “{{name}}”', {
                name: narrative.reportName ?? narrative.reportId,
              })}
              {narrative.reportStatus
                ? t('assessment.report.narrative.status', ' (status: {{status}})', {
                    status: narrative.reportStatus,
                  })
                : null}
              {t(
                'assessment.report.narrative.verbatim',
                ' — content copied from the record, unchanged.'
              )}
            </p>
            {narrative.executiveSummary ? (
              <div className="mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('assessment.report.narrative.executiveSummary', 'Executive summary')}
                </p>
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-c-text">
                  {narrative.executiveSummary}
                </p>
              </div>
            ) : null}
            {narrative.detailedAnalysis ? (
              <div className="mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('assessment.report.narrative.detailedAnalysis', 'Detailed analysis')}
                </p>
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-c-text">
                  {narrative.detailedAnalysis}
                </p>
              </div>
            ) : null}
            {narrative.recommendations.length > 0 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('assessment.report.narrative.savedItems', 'Saved report items ({{count}})', {
                    count: narrative.recommendations.length,
                  })}
                </p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-c-text-secondary">
                  {narrative.recommendations.map((r, i) => (
                    <li key={`${i}-${r}`}>{r}</li>
                  ))}
                </ol>
              </div>
            ) : null}
          </SectionCard>
        ) : null}

      <SectionCard
        id="recommendations"
        title={t('assessment.report.recommendations.title', 'Priority recommendations')}
        icon={Lightbulb}
      >
        {recommendations.length === 0 ? (
          <p className="text-xs italic text-c-text-muted">
            {zZapisuSesji
              ? t(
                  'assessment.report.recommendations.onFreeze',
                  'Per-area recommendations are produced when the result is frozen (conclusions of the method kernel). This assessment has not been frozen yet — above is what was saved in the assessment report, and the per-area gaps are visible in the summary table in chapter 2.'
                )
              : t('assessment.report.recommendations.none', 'No recommendations in this Output.')}
          </p>
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
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-c-danger">
                      {t('assessment.report.strengthsGaps.gapValue', 'gap {{gap}}', { gap: f.gap })}
                    </span>
                  ) : f.gap === 0 ? (
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-c-success">
                      {t('assessment.report.recommendations.noGap', 'no gap')}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-c-text-secondary">{f.recommendation}</p>
                {f.priorityRationale ? (
                  <p className="mt-1 text-[11px] italic text-c-text-muted">
                    {t('assessment.report.recommendations.priorityRationale', 'Priority rationale: {{value}}', {
                      value: f.priorityRationale,
                    })}
                  </p>
                ) : null}
                {f.expectedOutcome ? (
                  <p className="mt-1 text-[11px] text-c-text-muted">
                    {t('assessment.report.recommendations.expectedOutcome', 'Expected outcome: {{value}}', {
                      value: f.expectedOutcome,
                    })}
                  </p>
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
          {zZapisuSesji
            ? t(
                'assessment.report.footer.sessionRecord',
                'This document is a read-out of the assessment session record. The content is not recomputed on display — it shows exactly what was saved in the workshop. Freezing the result gives it immutability, a content hash and an approval trace; this assessment does not have that yet.'
              )
            : t(
                'assessment.report.footer.frozen',
                'This document is a read-out of the frozen, immutable Output. The content is not recomputed on display — it shows exactly what was approved at the moment of freezing.'
              )}
        </p>
        {zZapisuSesji ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <Property label={t('assessment.report.footer.assessment', 'Assessment')} value={output.scope} />
            <Property
              label={t('assessment.report.footer.methodology', 'Methodology')}
              value={`${output.methodPackId.toUpperCase()} ${output.methodPackVersion}`}
            />
            <Property
              label={t('assessment.report.footer.createdAt', 'Assessment created on')}
              value={formatDate(output.createdAt)}
            />
            <Property label={t('assessment.report.footer.frozenAt', 'Frozen')} value="—" />
          </dl>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <Property
              label={t('assessment.report.footer.outputId', 'Output identifier')}
              value={output.id}
              mono
            />
            <Property
              label={t('assessment.report.footer.contentHash', 'Content hash')}
              value={output.contentHash}
              mono
            />
            <Property
              label={t('assessment.report.footer.outputVersion', 'Output version')}
              value={`v${output.outputVersion}`}
            />
            <Property
              label={t('assessment.report.footer.frozenAt', 'Frozen')}
              value={formatDateTime(output.frozenAt)}
            />
          </dl>
        )}
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
