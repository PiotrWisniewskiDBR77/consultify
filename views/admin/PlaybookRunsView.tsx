import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { PlaybookTemplateVersion, TemplateStatus } from '../../types';
import { Play, Clock, CheckCircle, XCircle, Pause, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface PlaybookRun {
    id: string;
    templateId: string;
    templateKey: string;
    templateTitle: string;
    organizationId: string;
    correlationId: string;
    initiatedBy: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
    steps?: Array<{
        id: string;
        title: string;
        status: string;
        actionType: string;
    }>;
}

/**
 * PlaybookRunsView
 * Step 13: Visual Playbook Editor
 * 
 * Admin view for monitoring playbook runs.
 */
export const PlaybookRunsView: React.FC = () => {
    const { token } = useStore();
    const [templates, setTemplates] = useState<PlaybookTemplateVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

    useEffect(() => {
        loadPublishedTemplates();
    }, []);

    const loadPublishedTemplates = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/ai/playbooks/templates/published', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to load templates');

            const data = await res.json();
            setTemplates(data);
        } catch (err) {
            console.error('Error loading templates:', err);
            toast.error('Failed to load published templates');
        } finally {
            setLoading(false);
        }
    };

    const handleStartRun = async (templateId: string) => {
        try {
            const res = await fetch('/api/ai/playbooks/runs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ templateId })
            });

            if (!res.ok) throw new Error('Failed to start run');

            const run = await res.json();
            toast.success(`Run started: ${run.correlationId}`);
        } catch (err) {
            toast.error('Failed to start playbook run');
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'PENDING':
                return <Clock className="w-4 h-4 text-gray-500" />;
            case 'IN_PROGRESS':
                return <Play className="w-4 h-4 text-blue-500" />;
            case 'COMPLETED':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'FAILED':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'CANCELLED':
                return <Pause className="w-4 h-4 text-gray-500" />;
            default:
                return <Clock className="w-4 h-4 text-gray-400" />;
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Playbook Runs</h1>
                <p className="text-gray-600 mt-1">View published playbooks and start runs</p>
            </div>

            {/* Published Templates */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : templates.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <Play className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Published Templates</h3>
                    <p className="text-gray-500">Contact an administrator to publish playbook templates.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-semibold text-gray-900">{template.title}</h3>
                                    <p className="text-xs text-gray-500 font-mono">{template.key}</p>
                                </div>
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-300">
                                    PUBLISHED
                                </span>
                            </div>

                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                {template.description || 'No description'}
                            </p>

                            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                <div className="text-xs text-gray-500">
                                    <span>v{template.version}</span>
                                    <span className="mx-2">•</span>
                                    <span>{template.estimatedDurationMins} min</span>
                                </div>
                                <button
                                    onClick={() => handleStartRun(template.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                                >
                                    <Play size={14} />
                                    Start Run
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Runs Section */}
            <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Runs</h2>
                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
                    <p>Run history will be displayed here.</p>
                    <p className="text-sm mt-1">Start a run from the templates above to see activity.</p>
                </div>
            </div>
        </div>
    );
};

export default PlaybookRunsView;
