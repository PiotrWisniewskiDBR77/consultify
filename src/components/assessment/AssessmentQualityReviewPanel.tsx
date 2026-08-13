/**
 * ASM-005/006/007 — evidence/scoring, manager accept/return, and the
 * immutable accepted output for a single DRD assessment. Self-contained:
 * owns its own data fetching against the new v8 endpoints, does not
 * participate in the Hub's StandardTable/list machinery.
 */
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

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

interface AssessmentQualityReviewPanelProps {
  assessmentId: string;
}

type EvidenceType = 'note' | 'link' | 'document' | 'reference';

export const AssessmentQualityReviewPanel: React.FC<AssessmentQualityReviewPanelProps> = ({
  assessmentId,
}) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<V8AssessmentEvidence[]>([]);
  const [scoring, setScoring] = useState<V8AssessmentDerivedScoring | null>(null);
  const [reviews, setReviews] = useState<V8AssessmentReviewRecord[]>([]);
  const [report, setReport] = useState<V8AssessmentAcceptedReport | null>(null);

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
      { id: 'axisName', label: 'Oś' },
      {
        id: 'avgAchievedLevel',
        label: 'Osiągnięty',
        align: 'right',
        render: (row: TableRow) => Number(row.avgAchievedLevel).toFixed(1),
      },
      {
        id: 'avgTargetLevel',
        label: 'Docelowy',
        align: 'right',
        render: (row: TableRow) => Number(row.avgTargetLevel).toFixed(1),
      },
      {
        id: 'gap',
        label: 'Luka',
        align: 'right',
        render: (row: TableRow) => Number(row.gap).toFixed(1),
      },
      {
        id: 'evidenceCount',
        label: 'Dowody',
        align: 'right',
        render: (row: TableRow) =>
          row.hasEvidence ? (
            <span className="text-emerald-600 dark:text-emerald-400">{row.evidenceCount}</span>
          ) : (
            // MPQ odbiór 2026-08-13: brak dowodu to normalny, oczekiwany stan
            // oceny dojrzałości (jeszcze nie udokumentowane) — NIE błąd/awaria.
            // Crimson/danger w tym repo jest zarezerwowany dla semantyki
            // krytycznej; tu ostrzegawczy amber (do uzupełnienia, nie alarm).
            <span className="text-amber-600 dark:text-amber-400">brak</span>
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
      const [evidenceRes, reviewRes] = await Promise.all([
        V8AssessmentApi.listEvidence(assessmentId),
        V8AssessmentApi.listReviewHistory(assessmentId),
      ]);
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
      setLoadError(err instanceof Error ? err.message : 'Nie udało się wczytać danych recenzji');
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
      setEvidenceError(err instanceof Error ? err.message : 'Nie udało się dodać dowodu');
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
            ? 'Nie udało się zaakceptować assessmentu'
            : 'Nie udało się odesłać assessmentu'
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
        <Loader2 className="animate-spin mr-2" size={18} />
        Ładowanie…
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
      <section>
        <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-3">
          Ocena i pokrycie dowodami
        </h3>
        {scoring ? (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-navy-700">
                <div className="text-xs text-slate-500 dark:text-slate-400">Kompletność</div>
                <div className="text-lg font-semibold text-navy-900 dark:text-white">
                  {scoring.completionPercent}%
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 dark:border-navy-700">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Śr. poziom osiągnięty
                </div>
                <div className="text-lg font-semibold text-navy-900 dark:text-white">
                  {scoring.overallAvgAchievedLevel.toFixed(1)}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 dark:border-navy-700">
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
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ocena dostępna tylko dla assessmentów DRD.
          </p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-3">Dodaj dowód</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select
            value={axisId}
            onChange={(e) => setAxisId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)]"
          >
            {DRD_STRUCTURE.map((axis) => (
              <option key={axis.id} value={String(axis.id)}>
                {axis.namePL || axis.name}
              </option>
            ))}
          </select>
          <select
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)]"
          >
            {(selectedAxis?.areas || []).map((area) => (
              <option key={area.id} value={area.id}>
                {area.namePL || area.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select
            value={evidenceType}
            onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)]"
          >
            <option value="note">Notatka</option>
            <option value="link">Link</option>
            <option value="document">Dokument</option>
            <option value="reference">Odniesienie</option>
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tytuł dowodu"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)]"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Opis (opcjonalnie)"
          rows={2}
          className="w-full mb-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white placeholder-slate-400 resize-none focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)]"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL (opcjonalnie)"
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
          {addingEvidence ? 'Dodawanie…' : 'Dodaj dowód'}
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
                  · oś {item.axisId}/{item.areaId} · {item.evidenceType}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-3">
          Decyzja recenzenta
        </h3>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Uzasadnienie decyzji (wymagane)"
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
            Zaakceptuj
          </button>
          <button
            type="button"
            onClick={() => handleReview('return')}
            disabled={submittingReview || rationale.trim().length < 3}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw size={16} />
            Odeślij do poprawy
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
                      ? 'font-medium text-emerald-600 dark:text-emerald-400'
                      : 'font-medium text-amber-600 dark:text-amber-400'
                  }
                >
                  {rev.action === 'accept' ? 'Zaakceptowano' : 'Odesłano'}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {' '}
                  · {new Date(rev.createdAt).toLocaleString()} · {rev.rationale}
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
              Zaakceptowano {new Date(report.acceptedAt).toLocaleString()} przez {report.acceptedBy}
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
