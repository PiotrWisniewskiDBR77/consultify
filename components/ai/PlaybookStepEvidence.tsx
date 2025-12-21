import React, { useState, useEffect } from 'react';
import { GitBranch, CheckCircle2, AlertCircle, Loader2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import ConfidenceBadge from './ConfidenceBadge';

interface BranchTrace {
    matched_rule?: string;
    reason?: string;
    evaluation_context?: Record<string, unknown>;
}

interface StepEvidence {
    reasoning_summary: string;
    assumptions: string[];
    confidence: number;
    evidences: Array<{
        type: string;
        source: string;
        payload: Record<string, unknown>;
    }>;
    branch_trace?: BranchTrace;
}

interface PlaybookStepEvidenceProps {
    stepId: string;
    stepType: 'ACTION' | 'CHECK' | 'WAIT' | 'BRANCH';
    decisionId?: string;
    executionId?: string;
    token: string;
}

/**
 * PlaybookStepEvidence Component
 * 
 * Displays evidence and reasoning for a specific playbook step.
 * For BRANCH/CHECK steps, also shows the evaluation trace.
 */
const PlaybookStepEvidence: React.FC<PlaybookStepEvidenceProps> = ({
    stepId,
    stepType,
    decisionId,
    executionId,
    token
}) => {
    const [evidence, setEvidence] = useState<StepEvidence | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showRawTrace, setShowRawTrace] = useState(false);

    useEffect(() => {
        const fetchEvidence = async () => {
            if (!stepId || !token) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                // Determine which entity to fetch evidence for
                let entityType = 'run_step';
                let entityId = stepId;

                // If this step has a decision, get evidence from decision
                if (decisionId && stepType === 'ACTION') {
                    entityType = 'decision';
                    entityId = decisionId;
                }

                const response = await fetch(`/api/ai/explain/${entityType}/${entityId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch evidence: ${response.statusText}`);
                }

                const data = await response.json();

                // Map API response to our component state
                const latestReasoning = data.reasoning?.[0];
                setEvidence({
                    reasoning_summary: latestReasoning?.reasoning_summary || 'No reasoning available',
                    assumptions: latestReasoning?.assumptions || [],
                    confidence: data.confidence || 0,
                    evidences: data.evidences || [],
                    branch_trace: data.branch_trace
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load evidence');
            } finally {
                setLoading(false);
            }
        };

        fetchEvidence();
    }, [stepId, stepType, decisionId, token]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading evidence...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 py-3 text-sm text-red-500">
                <AlertCircle className="w-4 h-4" />
                {error}
            </div>
        );
    }

    if (!evidence) {
        return (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
                <FileText className="w-4 h-4" />
                No evidence available for this step.
            </div>
        );
    }

    const isBranchStep = stepType === 'BRANCH' || stepType === 'CHECK';

    return (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            {/* Header with Confidence */}
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    Step Evidence
                </h4>
                <ConfidenceBadge confidence={evidence.confidence} size="sm" />
            </div>

            {/* Reasoning Summary */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    {evidence.reasoning_summary}
                </p>

                {evidence.assumptions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Assumptions:</p>
                        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                            {evidence.assumptions.map((assumption, idx) => (
                                <li key={idx} className="flex items-start gap-1">
                                    <span className="text-blue-500">•</span>
                                    {assumption}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Branch Trace (for BRANCH/CHECK steps) */}
            {isBranchStep && evidence.branch_trace && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between mb-2">
                        <h5 className="text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1.5 uppercase">
                            <GitBranch className="w-3.5 h-3.5" />
                            Branch Evaluation
                        </h5>
                        <button
                            onClick={() => setShowRawTrace(!showRawTrace)}
                            className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                        >
                            {showRawTrace ? 'Hide' : 'Show'} trace
                            {showRawTrace ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                    </div>

                    {evidence.branch_trace.matched_rule && (
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                Matched: <code className="text-xs bg-purple-100 dark:bg-purple-800 px-1.5 py-0.5 rounded">{evidence.branch_trace.matched_rule}</code>
                            </span>
                        </div>
                    )}

                    {evidence.branch_trace.reason && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                            Reason: {evidence.branch_trace.reason}
                        </p>
                    )}

                    {showRawTrace && evidence.branch_trace.evaluation_context && (
                        <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-700">
                            <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono overflow-x-auto">
                                {JSON.stringify(evidence.branch_trace.evaluation_context, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}

            {/* Evidence Count */}
            {evidence.evidences.length > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    {evidence.evidences.length} evidence object{evidence.evidences.length !== 1 ? 's' : ''} linked
                </div>
            )}
        </div>
    );
};

export default PlaybookStepEvidence;
