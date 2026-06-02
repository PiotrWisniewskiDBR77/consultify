import { Globe, Mic, Monitor, MoreVertical, Plus, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import TeresaMark from '../../../components/shared/TeresaMark';
import { Api } from '../../../services/api';
interface VirtualWorker {
  id: string;
  slug: string;
  name: string;
  role: string;
  status: string;
  surface: string;
  voice_enabled: boolean;
  voice_name: string | null;
  locale_default: string;
  description: string | null;
  created_at: string;
}

interface WorkersListProps {
  onSelectWorker: (workerId: string) => void;
}

const ROLE_LABELS: Record<string, string> = {
  sales_lp: 'Sales (Landing Page)',
  internal_consultant: 'Internal Consultant',
  onboarding: 'Onboarding',
  custom: 'Custom',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  disabled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const SURFACE_ICONS: Record<string, React.ReactNode> = {
  landing_page: <Globe size={14} />,
  in_platform: <Monitor size={14} />,
  both: <Globe size={14} />,
};

export const WorkersList: React.FC<WorkersListProps> = ({ onSelectWorker }) => {
  const [workers, setWorkers] = useState<VirtualWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const response = await Api.get('/api/virtual-workers');
      const list = response?.data?.data ?? response?.data;
      setWorkers(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to fetch workers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            All Virtual Workers
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {workers.length} worker{workers.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Add Worker
        </button>
      </div>

      {showCreateForm && (
        <CreateWorkerForm
          onCreated={() => {
            setShowCreateForm(false);
            fetchWorkers();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {workers.map((worker) => (
          <WorkerCard key={worker.id} worker={worker} onClick={() => onSelectWorker(worker.id)} />
        ))}

        {workers.length === 0 && (
          <div className="col-span-full text-center py-16">
            <TeresaMark className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400">
              No virtual workers yet
            </h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              Create your first virtual worker to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const WorkerCard: React.FC<{ worker: VirtualWorker; onClick: () => void }> = ({
  worker,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="text-left w-full bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-5 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all group"
  >
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-primary-600 flex items-center justify-center text-white font-bold text-sm">
          {worker.name.charAt(0)}
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {worker.name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {ROLE_LABELS[worker.role] || worker.role}
          </p>
        </div>
      </div>
      <MoreVertical
        size={16}
        className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>

    {worker.description && (
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">
        {worker.description}
      </p>
    )}

    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[worker.status] || STATUS_COLORS.draft}`}
      >
        {worker.status}
      </span>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-navy-700 dark:text-slate-300">
        {SURFACE_ICONS[worker.surface]}
        {worker.surface.replace('_', ' ')}
      </span>
      {worker.voice_enabled && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <Mic size={12} />
          Voice
        </span>
      )}
    </div>
  </button>
);

const CreateWorkerForm: React.FC<{
  onCreated: () => void;
  onCancel: () => void;
}> = ({ onCreated, onCancel }) => {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('custom');
  const [surface, setSurface] = useState('landing_page');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim() || !name.trim()) return;
    setSaving(true);
    try {
      await Api.post('/api/virtual-workers', {
        slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
        name: name.trim(),
        role,
        surface,
        status: 'draft',
      });
      onCreated();
    } catch (err) {
      console.error('Failed to create worker:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6 space-y-4"
    >
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
        Create New Virtual Worker
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Anna"
            className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Slug (unique ID)
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. anna"
            className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="sales_lp">Sales (Landing Page)</option>
            <option value="internal_consultant">Internal Consultant</option>
            <option value="onboarding">Onboarding</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Surface
          </label>
          <select
            value={surface}
            onChange={(e) => setSurface(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="landing_page">Landing Page</option>
            <option value="in_platform">In Platform</option>
            <option value="both">Both</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving || !slug.trim() || !name.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {saving ? 'Creating...' : 'Create Worker'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
