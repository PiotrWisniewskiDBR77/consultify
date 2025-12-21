import React, { useState, useEffect } from 'react';
import { FileText, Activity, AlertCircle, FileCode, Clock, ChevronDown, ChevronUp, Download, Loader2 } from 'lucide-react';
import ConfidenceBadge from './ConfidenceBadge';

interface Evidence {
    link_id: string;
    evidence_id: string;
    type: string;
    source: string;
    weight: number;
    note: string | null;
    payload: Record<string, unknown>;
    created_at: string;
}

interface Reasoning {
    id: string;
    reasoning_summary: string;
    assumptions: string[];
    confidence: number;
    created_at: string;
}

interface Explanation {
    entity_type: string;
    entity_id: string;
    confidence: number;
    reasoning: Reasoning[];
    evidences: Evidence[];
    evidence_count: number;
    has_explanation: boolean;
}

interface EvidencePanelProps {
    entityType: 'proposal' | 'decision' | 'execution' | 'run_step' | 'playbook_run';
    entityId: string;
    token: string;
}

const EVIDENCE_TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    METRIC_SNAPSHOT: {
        icon: <Activity className="w-4 h-4" />,
        label: 'Metric',
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    },
    SIGNAL: {
        icon: <AlertCircle className="w-4 h-4" />,
        label: 'Signal',
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    },
    DOC_REF: {
        icon: <FileText className="w-4 h-4" />,
        label: 'Document',
        color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
    },
    USER_EVENT: {
        icon: <Clock className="w-4 h-4" />,
        label: 'User Event',
        color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    },
    SYSTEM_EVENT: {
        icon: <FileCode className="w-4 h-4" />,
        label: 'System Event',
        color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    }
};

const EvidencePanel: React.FC<EvidencePanelProps> = ({ entityType, entityId, token }) => {
    const [explanation, setExplanation] = useState<Explanation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const fetchExplanation = async () => {
            if (!entityId || !token) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`/api/ai/explain/${entityType}/${entityId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch explanation: ${response.statusText}`);
                }

                const data = await response.json();
                setExplanation(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load explanation');
            } finally {
                setLoading(false);
            }
        };

        fetchExplanation();
    }, [entityType, entityId, token]);

    const handleExport = async () => {
        if (!entityId || !token) return;

        try {
            setExporting(true);

            const response = await fetch(`/api/ai/explain/${entityType}/${entityId}/export?format=json`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Export failed: ${response.statusText}`);
            }

            const data = await response.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `explainability_${entityType}_${entityId}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export error:', err);
        } finally {
            setExporting(false);
        }
    };

    const toggleEvidence = (id: string) => {
        setExpandedEvidence(expandedEvidence === id ? null : id);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-500 dark:text-gray-400">Loading evidence...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    if (!explanation || !explanation.has_explanation) {
        return (
            <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
                <FileText className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No evidence available for this item yet.</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Evidence is generated when AI decisions are made.
                </p>
            </div>
        );
    }

    const latestReasoning = explanation.reasoning[0];

    return (
        <div className="space-y-6">
            {/* Header with Confidence and Export */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Evidence & Reasoning
                    </h3>
                    <ConfidenceBadge confidence={explanation.confidence} />
                </div>
                <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                    {exporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Download className="w-4 h-4" />
                    )}
                    Export Evidence Pack
                </button>
            </div>

            {/* Reasoning Section */}
            {latestReasoning && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                        Reasoning Summary
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 mb-3">
                        {latestReasoning.reasoning_summary}
                    </p>

                    {latestReasoning.assumptions && latestReasoning.assumptions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                            <h5 className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-2">
                                Assumptions
                            </h5>
                            <ul className="space-y-1">
                                {latestReasoning.assumptions.map((assumption, idx) => (
                                    <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                                        <span className="text-blue-500 mt-1">•</span>
                                        {assumption}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-500">
                        Recorded: {formatDate(latestReasoning.created_at)}
                    </div>
                </div>
            )}

            {/* Evidence List */}
            <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Linked Evidence ({explanation.evidence_count})
                </h4>

                {explanation.evidences.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        No evidence objects linked.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {explanation.evidences.map((evidence) => {
                            const config = EVIDENCE_TYPE_CONFIG[evidence.type] || EVIDENCE_TYPE_CONFIG.SYSTEM_EVENT;
                            const isExpanded = expandedEvidence === evidence.link_id;

                            return (
                                <div
                                    key={evidence.link_id}
                                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                                >
                                    <div
                                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                        onClick={() => toggleEvidence(evidence.link_id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${config.color}`}>
                                                {config.icon}
                                                {config.label}
                                            </span>
                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                {evidence.source}
                                            </span>
                                            {evidence.weight < 1 && (
                                                <span className="text-xs text-gray-400">
                                                    (weight: {Math.round(evidence.weight * 100)}%)
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-400">
                                                {formatDate(evidence.created_at)}
                                            </span>
                                            {isExpanded ? (
                                                <ChevronUp className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-gray-400" />
                                            )}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                                            {evidence.note && (
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 italic">
                                                    Note: {evidence.note}
                                                </p>
                                            )}
                                            <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 overflow-x-auto">
                                                <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap">
                                                    {JSON.stringify(evidence.payload, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EvidencePanel;
