import { CheckCircle2, RefreshCw, Rocket, Send } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../../../services/api';

interface Release {
  id: string;
  profile_id: string | null;
  evaluation_id: string | null;
  release_type: string;
  status: string;
  notes: string | null;
  created_at: string;
  activated_at: string | null;
}

interface ReleasePanelProps {
  workerId: string;
  profileId?: string | null;
  profileVersion?: number | null;
}

interface EvaluationOption {
  id: string;
  name: string;
  status: string;
  score: number | null;
}

interface ReleaseReadiness {
  activeProfileId: string | null;
  activeProfileVersion: number | null;
  latestPassedEvaluationId: string | null;
  latestPassedEvaluationName: string | null;
  latestPassedEvaluationScore: number | null;
  passedEvaluationCount: number;
  releaseable: boolean;
  blockers: string[];
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  ready: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  rolled_back: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const ReleasePanel: React.FC<ReleasePanelProps> = ({
  workerId,
  profileId,
  profileVersion,
}) => {
  const [items, setItems] = useState<Release[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationOption[]>([]);
  const [readiness, setReadiness] = useState<ReleaseReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('draft');
  const [evaluationId, setEvaluationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const [releasesResponse, evaluationsResponse, readinessResponse] = await Promise.all([
        Api.get(`/api/virtual-workers/${workerId}/releases`),
        Api.get(`/api/virtual-workers/${workerId}/evaluations`),
        Api.get(`/api/virtual-workers/${workerId}/release-readiness`),
      ]);
      const releasesPayload = releasesResponse?.data?.data ?? releasesResponse?.data;
      const evaluationsPayload = evaluationsResponse?.data?.data ?? evaluationsResponse?.data;
      const readinessPayload = readinessResponse?.data?.data ?? readinessResponse?.data;
      setItems(Array.isArray(releasesPayload) ? releasesPayload : []);
      setEvaluations(Array.isArray(evaluationsPayload) ? evaluationsPayload : []);
      setReadiness(readinessPayload || null);
      setEvaluationId(readinessPayload?.latestPassedEvaluationId || '');
    } catch (err) {
      console.error('Failed to fetch releases:', err);
      setError('Failed to load release control data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [workerId]);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      await Api.post(`/api/virtual-workers/${workerId}/releases`, {
        profile_id: profileId || null,
        evaluation_id: evaluationId || null,
        release_type: 'profile_version',
        status,
        notes: notes.trim() || null,
        payload_json: {
          created_from: 'virtual_workers_superadmin',
          active_profile_version: profileVersion || null,
        },
      });
      setNotes('');
      setStatus('draft');
      setEvaluationId('');
      fetchItems();
    } catch (err: any) {
      console.error('Failed to create release:', err);
      setError(err?.response?.data?.error || 'Failed to create release.');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (releaseId: string) => {
    try {
      setError(null);
      await Api.post(`/api/virtual-workers/${workerId}/releases/${releaseId}/activate`, {});
      fetchItems();
    } catch (err: any) {
      console.error('Failed to activate release:', err);
      setError(err?.response?.data?.error || 'Failed to activate release.');
    }
  };

  const passedEvaluations = evaluations.filter((item) => item.status === 'passed');

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Release Control</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Create governed release entries and activate a verified worker version.
        </p>

        {readiness && (
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Release readiness
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Active profile:{' '}
                  {readiness.activeProfileVersion ? `v${readiness.activeProfileVersion}` : 'none'}
                  {' · '}
                  Passed evaluations: {readiness.passedEvaluationCount}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  readiness.releaseable
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}
              >
                {readiness.releaseable ? 'Ready to package' : 'Blocked'}
              </span>
            </div>
            {readiness.latestPassedEvaluationName && (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-3">
                Recommended evaluation: {readiness.latestPassedEvaluationName}
                {readiness.latestPassedEvaluationScore !== null
                  ? ` (${readiness.latestPassedEvaluationScore})`
                  : ''}
              </p>
            )}
            {readiness.blockers.length > 0 && (
              <div className="mt-3 space-y-1">
                {readiness.blockers.map((blocker) => (
                  <p key={blocker} className="text-xs text-amber-700 dark:text-amber-300">
                    {blocker}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
          >
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
          </select>
          <select
            value={evaluationId}
            onChange={(e) => setEvaluationId(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
          >
            <option value="">Select passed evaluation</option>
            {passedEvaluations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} {item.score !== null ? `(${item.score})` : ''}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Release notes"
            className="md:col-span-2 px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
          />
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          `ready` releases require an active profile and a passed evaluation with dataset, results,
          and score.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            {error}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={
            saving ||
            !profileId ||
            (status === 'ready' && (!evaluationId || !readiness?.releaseable))
          }
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
        >
          <Send size={14} />
          {saving ? 'Creating...' : 'Create Release'}
        </button>
      </section>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Rocket className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No releases yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-5 flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {item.release_type} release
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {new Date(item.created_at).toLocaleString()}
                  {item.notes ? ` · ${item.notes}` : ''}
                </p>
                {item.activated_at && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    Activated {new Date(item.activated_at).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status] || STATUS_COLORS.draft}`}
                >
                  {item.status}
                </span>
                {item.status !== 'active' && (
                  <button
                    onClick={() => handleActivate(item.id)}
                    disabled={item.status !== 'ready'}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    <CheckCircle2 size={13} />
                    Activate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
