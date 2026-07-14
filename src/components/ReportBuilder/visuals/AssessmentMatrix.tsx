import React, { useMemo } from 'react';

export interface AssessmentMatrixData {
  type: 'assessment_matrix';
  scaleMax: number;
  axes: Array<{
    axisId: string;
    axisName: string;
    score: number;
    maxScore: number;
    gap?: number;
  }>;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export const AssessmentMatrix: React.FC<{ data: AssessmentMatrixData }> = ({ data }) => {
  const scaleMax = clamp(Number(data.scaleMax || 7), 3, 10);

  const columns = useMemo(() => Array.from({ length: scaleMax }, (_, i) => i + 1), [scaleMax]);

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          Assessment Matrix
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Scores per axis on a {scaleMax}-level scale
        </div>
      </div>

      <div className="overflow-auto">
        <table
          /* §27-exempt: macierz/komorki kalkulacyjne, osobny spec matrix-editor */ className="min-w-full"
        >
          <thead className="sticky top-0 bg-white dark:bg-navy-900">
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider w-64">
                Axis
              </th>
              {columns.map((c) => (
                <th
                  key={c}
                  className="text-center px-2 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  {c}
                </th>
              ))}
              <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider w-16">
                Score
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {(data.axes || []).map((ax) => {
              const score = Number.isFinite(ax.score) ? ax.score : 0;
              const pos = clamp(Math.round(score), 1, scaleMax);
              return (
                <tr
                  key={ax.axisId || ax.axisName}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                    {ax.axisName || ax.axisId}
                  </td>
                  {columns.map((c) => {
                    const isHit = c === pos;
                    return (
                      <td key={c} className="px-2 py-3">
                        <div
                          className={`
                            h-6 rounded-md border
                            ${
                              isHit
                                ? 'bg-navy-900 border-navy-900'
                                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-slate-700'
                            }
                          `}
                          title={isHit ? `Score: ${score.toFixed(1)}` : undefined}
                        />
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 text-right tabular-nums">
                    {Number.isFinite(score) ? score.toFixed(1) : '—'}
                  </td>
                </tr>
              );
            })}
            {(!data.axes || data.axes.length === 0) && (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-10 text-center text-slate-500">
                  No axis scores available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
