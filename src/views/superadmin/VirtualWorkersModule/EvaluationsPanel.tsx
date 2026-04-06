import { FlaskConical, Plus, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../../../services/api';

interface Evaluation {
  id: string;
  name: string;
  status: string;
  score: number | null;
  created_at: string;
  run_at: string | null;
}

interface EvaluationsPanelProps {
  workerId: string;
}

const STATUS_COLORS: Record<string, string> = {
  passed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const EvaluationsPanel: React.FC<EvaluationsPanelProps> = ({ workerId }) => {
  const [items, setItems] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('draft');
  const [score, setScore] = useState('');
  const [datasetJson, setDatasetJson] = useState('[]');
  const [resultsJson, setResultsJson] = useState('{}');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tryParseJson = (value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await Api.get(`/api/virtual-workers/${workerId}/evaluations`);
      const payload = response?.data?.data ?? response?.data;
      setItems(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error('Failed to fetch evaluations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [workerId]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await Api.post(`/api/virtual-workers/${workerId}/evaluations`, {
        name: name.trim(),
        status,
        score: score.trim() ? Number(score) : null,
        dataset_json: tryParseJson(datasetJson),
        results_json: tryParseJson(resultsJson),
      });
      setName('');
      setStatus('draft');
      setScore('');
      setDatasetJson('[]');
      setResultsJson('{}');
      fetchItems();
    } catch (err: any) {
      console.error('Failed to create evaluation:', err);
      setError(err?.response?.data?.error || 'Failed to create evaluation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Evaluations
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Track benchmark runs, regression checks, and readiness gates before release.
            </p>
          </div>
          <button
            onClick={fetchItems}
            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg text-sm text-slate-700 dark:text-slate-300"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Anna public QA - April"
            className="md:col-span-2 px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
          >
            <option value="draft">Draft</option>
            <option value="running">Running</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>
          <input
            type="number"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="Score"
            className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <textarea
            value={datasetJson}
            onChange={(e) => setDatasetJson(e.target.value)}
            rows={6}
            placeholder='[{"input":"What is Consultify?","expected":"..."}]'
            className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white font-mono resize-y"
          />
          <textarea
            value={resultsJson}
            onChange={(e) => setResultsJson(e.target.value)}
            rows={6}
            placeholder='{"summary":"passed regression set","checks":[...]}'
            className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white font-mono resize-y"
          />
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
          Passed and failed evaluations now require a non-empty dataset, non-empty results, and a
          score.
        </p>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={
            saving ||
            !name.trim() ||
            tryParseJson(datasetJson) === undefined ||
            tryParseJson(resultsJson) === undefined
          }
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
        >
          <Plus size={14} />
          {saving ? 'Creating...' : 'Create Evaluation'}
        </button>
      </section>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <FlaskConical className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No evaluations yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-5 flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Created {new Date(item.created_at).toLocaleString()}
                  {item.run_at ? ` · Last run ${new Date(item.run_at).toLocaleString()}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {item.score !== null && (
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.score}
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status] || STATUS_COLORS.draft}`}
                >
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
