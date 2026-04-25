import { ArrowLeft, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../../../services/api';
import { ConversationBrowser } from './ConversationBrowser';
import { EvaluationsPanel } from './EvaluationsPanel';
import { InsightsPanel } from './InsightsPanel';
import { KnowledgeAssignmentPanel } from './KnowledgeAssignmentPanel';
import { ReleasePanel } from './ReleasePanel';
import { WorkerAnalyticsDashboard } from './WorkerAnalyticsDashboard';
import { WorkerPreviewPanel } from './WorkerPreviewPanel';
import { WorkerProfileEditor } from './WorkerProfileEditor';

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
}

interface VirtualWorkerProfile {
  id: string;
  worker_id: string;
  version: number;
  persona_description: string | null;
  tone_description: string | null;
  system_prompt: string;
  priority_rules: Record<string, unknown> | null;
  boundaries: Record<string, unknown> | null;
  memory_policy: Record<string, unknown>;
  channel_policy: Record<string, unknown>;
  retrieval_policy: Record<string, unknown>;
  cta_policy: Record<string, unknown>;
  release_notes: string | null;
  is_active: boolean;
}

interface WorkerDetailProps {
  workerId: string;
  activeTab: string;
  onBack: () => void;
}

export const WorkerDetail: React.FC<WorkerDetailProps> = ({ workerId, activeTab, onBack }) => {
  const [worker, setWorker] = useState<VirtualWorker | null>(null);
  const [profile, setProfile] = useState<VirtualWorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorker = async () => {
    setLoading(true);
    try {
      const response = await Api.get(`/api/virtual-workers/${workerId}`);
      const payload = response?.data?.data ?? response?.data;
      if (payload) {
        setWorker(payload.worker);
        setProfile(payload.profile);
      }
    } catch (err) {
      console.error('Failed to fetch worker:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorker();
  }, [workerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500 dark:text-slate-400">Worker not found.</p>
        <button
          onClick={onBack}
          className="mt-4 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
        >
          Back to list
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
        >
          <ArrowLeft size={18} className="text-slate-500" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            {worker.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{worker.name}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {worker.slug} · {worker.role} · {worker.status}
            </p>
          </div>
        </div>
      </div>

      {activeTab === 'profile' && (
        <WorkerProfileEditor worker={worker} profile={profile} onProfileUpdated={fetchWorker} />
      )}
      {activeTab === 'knowledge' && <KnowledgeAssignmentPanel workerId={worker.id} />}
      {activeTab === 'preview' && (
        <WorkerPreviewPanel
          workerId={worker.id}
          workerSlug={worker.slug}
          localeDefault={worker.locale_default}
        />
      )}
      {activeTab === 'conversations' && <ConversationBrowser workerId={worker.id} />}
      {activeTab === 'analytics' && (
        <WorkerAnalyticsDashboard workerId={worker.id} workerSlug={worker.slug} />
      )}
      {activeTab === 'insights' && <InsightsPanel workerId={worker.id} />}
      {activeTab === 'evaluations' && <EvaluationsPanel workerId={worker.id} />}
      {activeTab === 'release' && (
        <ReleasePanel
          workerId={worker.id}
          profileId={profile?.id}
          profileVersion={profile?.version}
        />
      )}
    </div>
  );
};
