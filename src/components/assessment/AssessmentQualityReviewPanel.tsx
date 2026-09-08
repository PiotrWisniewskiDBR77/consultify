/**
 * ASM-005/006/007 — evidence/scoring, manager accept/return, and the
 * immutable accepted output for a single DRD assessment. Self-contained:
 * owns its own data fetching against the new v8 endpoints, does not
 * participate in the Hub's StandardTable/list machinery.
 *
 * ★ ODBIÓR WŁAŚCICIELA 2026-08-30 — pytanie, na które ten plik odpowiada:
 * „Taka tabela jest możliwa, tylko pamiętaj, że w asesmencie mamy macierz
 * odpowiedzi i ona jest ważna, bo jest narzędziem. To nie jest tylko
 * prezentacja, to jest narzędzie, które sprawia, że wchodzimy w interakcję.
 * Nie wiem, czy to, co mi tu pokazujesz, ma zastąpić macierz. Jeśli tak, to
 * nie działa w ten sposób."
 *
 * ODPOWIEDŹ, sprawdzona w kodzie, a nie zgadnięta: NIE zastępuje. Ten panel
 * nie ustawia ani jednego poziomu — nie ma tu żadnego zapisu poziomu obecnego
 * ani docelowego. Robi trzy rzeczy: (1) czyta wyliczone pokrycie i średnie
 * per oś (`V8AssessmentApi.getScoring`), (2) dokłada DOWÓD do wskazanej pary
 * oś/obszar (`addEvidence`), (3) przyjmuje decyzję recenzenta accept/return
 * (`submitReview`) i pokazuje zamrożony output. Poziomy ustawia się w macierzy
 * sesji (`DRDAssessmentEditor` / `DRDMatrixSession`, trasa
 * `/assessment/:framework/:assessmentId`, przełącznik „Macierz"). Dlatego od
 * 2026-08-30 ekran mówi to CZYTELNIKOWI wprost, na górze panelu, i prowadzi
 * do macierzy linkiem — zamiast zostawiać właściciela z tym pytaniem.
 */
import {
  AlertTriangle,
  CheckCircle2,
  Grid3x3,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { nazwaWJezyku } from './drd/drdNazwa';

import {
  type DRDEditorAnswers,
  DRDMatrixGrid,
} from '@/components/assessment/drd/DRDAssessmentEditor';
import type { TableColumn, TableRow } from '@/components/standard/StandardTable';
import { StandardTable } from '@/components/standard/StandardTable';
import type {
  V8AssessmentAcceptedReport,
  V8AssessmentDerivedScoring,
  V8AssessmentEvidence,
  V8AssessmentReviewRecord,
} from '@/services/api/v8/assessment';
import { V8AssessmentApi } from '@/services/api/v8/assessment';
import { DRD_STRUCTURE } from '@/services/drdStructure';
import { formatListDateTime } from '@/utils/listDateFormat';

interface AssessmentQualityReviewPanelProps {
  assessmentId: string;
}

type EvidenceType = 'note' | 'link' | 'document' | 'reference';

export const AssessmentQualityReviewPanel: React.FC<AssessmentQualityReviewPanelProps> = ({
  assessmentId,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = (i18n.language || '').toLowerCase().startsWith('pl');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<V8AssessmentEvidence[]>([]);
  const [scoring, setScoring] = useState<V8AssessmentDerivedScoring | null>(null);
  const [reviews, setReviews] = useState<V8AssessmentReviewRecord[]>([]);
  const [report, setReport] = useState<V8AssessmentAcceptedReport | null>(null);
  const [matrixValue, setMatrixValue] = useState<DRDEditorAnswers>();
  const [selectedMatrixCell, setSelectedMatrixCell] = useState<{
    areaId: string;
    level: number;
  } | null>(null);

  const [axisId, setAxisId] = useState<string>(String(DRD_STRUCTURE[0]?.id ?? '1'));
  const [areaId, setAreaId] = useState<string>(DRD_STRUCTURE[0]?.areas[0]?.id ?? '');
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('note');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [addingEvidence, setAddingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const [rationale, setRationale] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const selectedAxis = useMemo(
    () => DRD_STRUCTURE.find((axis) => String(axis.id) === axisId),
    [axisId]
  );

  const scoringColumns: TableColumn[] = useMemo(
    () => [
      { id: 'axisName', label: t('assessment.qualityReview.table.axis', 'Axis') },
      {
        id: 'avgAchievedLevel',
        label: t('assessment.qualityReview.table.achieved', 'Achieved'),
        align: 'right',
        render: (row: TableRow) => Number(row.avgAchievedLevel).toFixed(1),
      },
      {
        id: 'avgTargetLevel',
        label: t('assessment.qualityReview.table.target', 'Target'),
        align: 'right',
        render: (row: TableRow) => Number(row.avgTargetLevel).toFixed(1),
      },
      {
        id: 'gap',
        label: t('assessment.qualityReview.table.gap', 'Gap'),
        align: 'right',
        render: (row: TableRow) => Number(row.gap).toFixed(1),
      },
      {
        id: 'evidenceCount',
        label: t('assessment.qualityReview.table.evidence', 'Evidence'),
        align: 'right',
        render: (row: TableRow) =>
          row.hasEvidence ? (
            // emerald/amber-600 dawały 4.31:1 / 3.79:1 zamiast 4,5:1 na białym
            // (axe: color-contrast, zmierzone na assessment-quality-review-panel).
            <span className="text-emerald-700 dark:text-emerald-400">{row.evidenceCount}</span>
          ) : (
            // MPQ odbiór 2026-08-13: brak dowodu to normalny, oczekiwany stan
            // oceny dojrzałości (jeszcze nie udokumentowane) — NIE błąd/awaria.
            // Crimson/danger w tym repo jest zarezerwowany dla semantyki
            // krytycznej; tu ostrzegawczy amber (do uzupełnienia, nie alarm).
            <span className="text-amber-800 dark:text-amber-400">brak</span>
          ),
      },
    ],
    []
  );

  const scoringRows: TableRow[] = useMemo(
    () => (scoring?.axes || []).map((axis) => ({ id: axis.axisId, ...axis })),
    [scoring]
  );

  useEffect(() => {
    if (selectedAxis && !selectedAxis.areas.find((area) => area.id === areaId)) {
      setAreaId(selectedAxis.areas[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axisId]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [assessmentRes, evidenceRes, reviewRes] = await Promise.all([
        V8AssessmentApi.getAssessment(assessmentId),
        V8AssessmentApi.listEvidence(assessmentId),
        V8AssessmentApi.listReviewHistory(assessmentId),
      ]);
      const answers = assessmentRes.assessment.answers as { drd?: DRDEditorAnswers } | undefined;
      setMatrixValue(answers?.drd);
      setEvidence(evidenceRes.evidence || []);
      setScoring(evidenceRes.scoring || null);
      setReviews(reviewRes.reviews || []);
      try {
        const reportRes = await V8AssessmentApi.getAcceptedReport(assessmentId);
        setReport(reportRes);
      } catch {
        // No accepted output yet — not an error state for this panel.
        setReport(null);
      }
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error
          ? err.message
          : t('assessment.qualityReview.errors.load', 'The review data could not be loaded')
      );
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddEvidence = async () => {
    setAddingEvidence(true);
    setEvidenceError(null);
    try {
      await V8AssessmentApi.addEvidence(assessmentId, {
        axisId,
        areaId,
        evidenceType,
        title,
        description: description || null,
        url: url || null,
      });
      setTitle('');
      setDescription('');
      setUrl('');
      await load();
    } catch (err: unknown) {
      setEvidenceError(
        err instanceof Error
          ? err.message
          : t('assessment.qualityReview.errors.addEvidence', 'The evidence could not be added')
      );
    } finally {
      setAddingEvidence(false);
    }
  };

  const handleReview = async (action: 'accept' | 'return') => {
    setSubmittingReview(true);
    setReviewError(null);
    try {
      await V8AssessmentApi.submitReview(assessmentId, { action, rationale });
      setRationale('');
      await load();
    } catch (err: unknown) {
      setReviewError(
        err instanceof Error
          ? err.message
          : action === 'accept'
            ? t('assessment.qualityReview.errors.accept', 'The assessment could not be accepted')
            : t('assessment.qualityReview.errors.return', 'The assessment could not be sent back')
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
        <Loader2 className="animate-spin mr-2" size={18} />
        {t('assessment.qualityReview.loading', 'Loading…')}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 text-danger-600 dark:text-danger-400 flex items-center gap-2 text-sm">
        <AlertTriangle size={16} />
        {loadError}
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-auto p-6 space-y-8"
      data-testid="assessment-quality-review-panel"
    >
      {/* ── Czym ten ekran JEST, a czym NIE JEST — patrz nagłówek pliku ── */}
      <section className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-white/5 p-4">
        <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
          {t('assessment.qualityReview.title', 'Assessment quality review')}
        </h3>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {t('assessment.qualityReview.intro1Prefix', 'This screen checks the')}{' '}
          <strong className="font-semibold text-navy-900 dark:text-white">
            {t('assessment.qualityReview.quality', 'quality')}
          </strong>{' '}
          {t(
            'assessment.qualityReview.intro1Suffix',
            'of a finished assessment: how many areas have evidence, where evidence is missing, and whether the reviewer accepts the assessment. You can add evidence and record a decision here — but no level is set on this screen.'
          )}
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          <strong className="font-semibold text-navy-900 dark:text-white">
            {t('assessment.qualityReview.notMatrix', 'This is not the assessment matrix')}
          </strong>{' '}
          {t(
            'assessment.qualityReview.notMatrixSuffix',
            'and it does not replace it. The matrix (areas × levels) is the working tool — that is where the current and target level of every area is set. The table below reads out its result, collapsed to an average per axis.'
          )}
        </p>
        <a
          href={`/assessment/drd/${assessmentId}`}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-2 text-sm font-medium text-navy-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)]"
        >
          <Grid3x3 size={16} />
          {t('assessment.qualityReview.openMatrix', 'Open the assessment matrix')}
        </a>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {t(
            'assessment.qualityReview.openMatrixHint',
            'Opens the session of this assessment; the matrix is there under the “Matrix” switch in the header.'
          )}
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-1">
          {t('assessment.qualityReview.scoring.title', 'Scoring and evidence coverage')}
        </h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          {t(
            'assessment.qualityReview.scoring.subtitle',
            'A read-out of the matrix, collapsed to an average per axis — this is not where levels are edited.'
          )}
        </p>
        {scoring ? (
          <>
            {selectedAxis ? (
              <div className="mb-4 rounded-xl border border-slate-200 dark:border-navy-700 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-navy-900 dark:text-white">
                      {t('assessment.qualityReview.matrix.title', 'DRD assessment matrix · axis {{axis}}', {
                        axis: selectedAxis.id,
                      })}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t(
                        'assessment.qualityReview.matrix.hint',
                        'Click a cell to pick an area and a level for review. Levels are changed in the assessment session.'
                      )}
                    </p>
                  </div>
                  {selectedMatrixCell ? (
                    <span className="shrink-0 rounded-lg bg-slate-100 dark:bg-white/10 px-2.5 py-1.5 text-xs font-medium text-navy-900 dark:text-white">
                      {t('assessment.qualityReview.matrix.selected', '{{area}} · level {{level}}', {
                        area: selectedMatrixCell.areaId,
                        level: selectedMatrixCell.level,
                      })}
                    </span>
                  ) : null}
                </div>
                <DRDMatrixGrid
                  areas={selectedAxis.areas}
                  levelCount={selectedAxis.levelCount}
                  value={matrixValue}
                  compact
                  columnMinPx={150}
                  rowHint={t('assessment.qualityReview.matrix.rowHint', 'Click to select for review')}
                  selectedCell={selectedMatrixCell}
                  onCellClick={(nextAreaId, level) => {
                    setAreaId(nextAreaId);
                    setSelectedMatrixCell({ areaId: nextAreaId, level });
                  }}
                  onAreaClick={(nextAreaId) => setAreaId(nextAreaId)}
                  areaStripLabel="Area"
                  overflowHint={(hidden) =>
                    t(
                      'assessment.qualityReview.matrix.overflowHint',
                      '{{count}} more columns to the right — scroll sideways.',
                      { count: hidden }
                    )
                  }
                />
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div
                data-testid="assessment-quality-tile-completeness"
                className="p-3 rounded-lg border border-slate-200 dark:border-navy-700"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('assessment.qualityReview.tiles.completeness', 'Completeness')}
                </div>
                <div className="text-lg font-semibold text-navy-900 dark:text-white">
                  {scoring.completionPercent}%
                </div>
              </div>
              <div
                data-testid="assessment-quality-tile-avg-level"
                className="p-3 rounded-lg border border-slate-200 dark:border-navy-700"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('assessment.qualityReview.tiles.avgAchieved', 'Avg. level achieved')}
                </div>
                <div className="text-lg font-semibold text-navy-900 dark:text-white">
                  {scoring.overallAvgAchievedLevel.toFixed(1)}
                </div>
              </div>
              <div
                data-testid="assessment-quality-tile-evidence-coverage"
                className="p-3 rounded-lg border border-slate-200 dark:border-navy-700"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">Pokrycie dowodami</div>
                <div className="text-lg font-semibold text-navy-900 dark:text-white">
                  {scoring.evidenceCoverage}%
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden">
              <StandardTable
                columns={scoringColumns}
                data={scoringRows}
                persistKey="assessment.qualityReview.axisScoring"
                canvasClassName="p-0"
              />
            </div>
          </>
        ) : (
          // Odbiór 05.09 (defekt 2): ten komunikat pojawiał się NA REKORDZIE DRD,
          // bo serwer rozstrzygał framework tylko po `assessment_type`, a rekordy
          // właściciela trzymają go w `framework_type` (assessment_type=MATURITY,
          // framework_type=DRD). Serwer poprawiony (isDrdAssessmentRow); tutaj
          // zostaje uczciwy komunikat dla frameworków, które faktycznie nie mają
          // wyliczanego pokrycia — bez sugerowania, że rekord DRD nim nie jest.
          <p
            className="text-sm text-slate-500 dark:text-slate-400"
            data-testid="assessment-quality-scoring-unavailable"
          >
            {t(
              'assessment.qualityReview.scoring.unavailable',
              'This assessment has no computed evidence coverage — today coverage is computed for the DRD framework.'
            )}
          </p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-3">
          {t('assessment.qualityReview.evidence.addTitle', 'Add evidence')}
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* aria-label: żaden z trzech selectów niżej nie ma widocznej etykiety
              (axe: select-name, zmierzone na assessment-quality-review-panel). */}
          <select
            aria-label={t('assessment.qualityReview.evidence.axisLabel', 'DRD axis')}
            value={axisId}
            onChange={(e) => setAxisId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)]"
          >
            {DRD_STRUCTURE.map((axis) => (
              <option key={axis.id} value={String(axis.id)}>
                {nazwaWJezyku(axis.namePL, axis.name, isPolish)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('assessment.qualityReview.evidence.areaLabel', 'Area')}
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)]"
          >
            {(selectedAxis?.areas || []).map((area) => (
              <option key={area.id} value={area.id}>
                {nazwaWJezyku(area.namePL, area.name, isPolish)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select
            aria-label={t('assessment.qualityReview.evidence.typeLabel', 'Evidence type')}
            value={evidenceType}
            onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)]"
          >
            <option value="note">{t('assessment.qualityReview.evidence.typeNote', 'Note')}</option>
            <option value="link">{t('assessment.qualityReview.evidence.typeLink', 'Link')}</option>
            <option value="document">
              {t('assessment.qualityReview.evidence.typeDocument', 'Document')}
            </option>
            <option value="reference">
              {t('assessment.qualityReview.evidence.typeReference', 'Reference')}
            </option>
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('assessment.qualityReview.evidence.titlePlaceholder', 'Evidence title')}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)]"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('assessment.qualityReview.evidence.descriptionPlaceholder', 'Description (optional)')}
          rows={2}
          className="w-full mb-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400 resize-none focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)]"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('assessment.qualityReview.evidence.urlPlaceholder', 'URL (optional)')}
          className="w-full mb-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)]"
        />
        {evidenceError && (
          <div className="mb-3 text-sm text-danger-600 dark:text-danger-400 flex items-center gap-2">
            <AlertTriangle size={14} />
            {evidenceError}
          </div>
        )}
        <button
          type="button"
          onClick={handleAddEvidence}
          disabled={addingEvidence || !title.trim()}
          className="px-4 py-2 rounded-lg font-medium bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {addingEvidence
            ? t('assessment.qualityReview.evidence.adding', 'Adding…')
            : t('assessment.qualityReview.evidence.addTitle', 'Add evidence')}
        </button>

        {evidence.length > 0 && (
          <ul className="mt-4 space-y-2">
            {evidence.map((item) => (
              <li
                key={item.id}
                className="text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700"
              >
                <span className="font-medium text-navy-900 dark:text-white">{item.title}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {' '}
                  {t('assessment.qualityReview.evidence.itemMeta', '· axis {{axis}}/{{area}} · {{type}}', {
                    axis: item.axisId,
                    area: item.areaId,
                    type: item.evidenceType,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-3">
          {t('assessment.qualityReview.decision.title', 'Reviewer decision')}
        </h3>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder={t('assessment.qualityReview.decision.rationalePlaceholder', 'Decision rationale (required)')}
          rows={2}
          className="w-full mb-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400 resize-none focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)]"
        />
        {reviewError && (
          <div className="mb-3 text-sm text-danger-600 dark:text-danger-400 flex items-center gap-2">
            <AlertTriangle size={14} />
            {reviewError}
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleReview('accept')}
            disabled={submittingReview || rationale.trim().length < 3}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldCheck size={16} />
            {t('assessment.qualityReview.decision.accept', 'Accept')}
          </button>
          <button
            type="button"
            onClick={() => handleReview('return')}
            disabled={submittingReview || rationale.trim().length < 3}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw size={16} />
            {t('assessment.qualityReview.decision.return', 'Send back for correction')}
          </button>
        </div>

        {reviews.length > 0 && (
          <ul className="mt-4 space-y-2">
            {reviews.map((rev) => (
              <li
                key={rev.id}
                className="text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700"
              >
                <span
                  className={
                    rev.action === 'accept'
                      ? 'font-medium text-emerald-700 dark:text-emerald-400'
                      : 'font-medium text-amber-800 dark:text-amber-400'
                  }
                >
                  {rev.action === 'accept'
                    ? t('assessment.qualityReview.decision.accepted', 'Accepted')
                    : t('assessment.qualityReview.decision.returned', 'Sent back')}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {' '}
                  · {formatListDateTime(rev.createdAt)} · {rev.rationale}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-3">
          Zaakceptowany output
        </h3>
        {report ? (
          <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/10">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium mb-1">
              <CheckCircle2 size={16} />
              Niezmienny output istnieje
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('assessment.qualityReview.acceptedBy', 'Accepted {{date}} by {{who}}', {
                date: formatListDateTime(report.acceptedAt),
                who: report.acceptedBy,
              })}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ten assessment nie ma jeszcze zaakceptowanego outputu.
          </p>
        )}
      </section>
    </div>
  );
};

export default AssessmentQualityReviewPanel;
