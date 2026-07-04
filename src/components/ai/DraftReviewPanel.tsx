/**
 * DraftReviewPanel Component
 *
 * Displays AI-generated drafts for review with Accept/Reject/Edit actions.
 * Part of the Draft-Review-Approve pattern for human-in-the-loop AI.
 */

import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  FileText,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { AIDraft, useDraftApproval } from '../../hooks/useDraftApproval';

interface DraftReviewPanelProps {
  projectId?: string;
  entityType?: string;
  entityId?: string;
  draftType?: string;
  onApproved?: (draft: AIDraft, modifications?: any) => void;
  onRejected?: (draft: AIDraft) => void;
  showStats?: boolean;
  compact?: boolean;
}

const DRAFT_TYPE_LABELS: Record<string, string> = {
  INITIATIVE: 'Inicjatywa',
  REPORT_SECTION: 'Sekcja raportu',
  TASK_BREAKDOWN: 'Podział zadania',
  RECOMMENDATION: 'Rekomendacja',
  RISK_ANALYSIS: 'Analiza ryzyka',
  FIELD_SUGGESTION: 'Sugestia pola',
  PATTERN: 'Wzorzec',
  SUMMARY: 'Podsumowanie',
};

const CONFIDENCE_LEVELS = {
  HIGH: { min: 0.8, color: 'text-green-600', bg: 'bg-green-100' },
  MEDIUM: { min: 0.6, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  LOW: { min: 0, color: 'text-danger-600', bg: 'bg-danger-100' },
};

function getConfidenceLevel(score: number) {
  if (score >= CONFIDENCE_LEVELS.HIGH.min) return CONFIDENCE_LEVELS.HIGH;
  if (score >= CONFIDENCE_LEVELS.MEDIUM.min) return CONFIDENCE_LEVELS.MEDIUM;
  return CONFIDENCE_LEVELS.LOW;
}

export function DraftReviewPanel({
  projectId,
  entityType,
  entityId,
  draftType,
  onApproved,
  onRejected,
  showStats = true,
  compact = false,
}: DraftReviewPanelProps) {
  const { drafts, loading, error, stats, pendingCount, fetchDrafts, approveDraft, rejectDraft } =
    useDraftApproval({
      projectId,
      draftType,
      autoRefresh: true,
    });

  const [expandedDrafts, setExpandedDrafts] = useState<Set<string>>(new Set());
  const [editingDraft, setEditingDraft] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [processingDrafts, setProcessingDrafts] = useState<Set<string>>(new Set());

  // Filter drafts if entity specified
  const filteredDrafts = useMemo(() => {
    if (entityType && entityId) {
      return drafts.filter(
        (d) => d.target_entity_type === entityType && d.target_entity_id === entityId
      );
    }
    return drafts;
  }, [drafts, entityType, entityId]);

  const toggleExpand = (draftId: string) => {
    setExpandedDrafts((prev) => {
      const next = new Set(prev);
      if (next.has(draftId)) {
        next.delete(draftId);
      } else {
        next.add(draftId);
      }
      return next;
    });
  };

  const handleApprove = async (draft: AIDraft, modifications?: any) => {
    setProcessingDrafts((prev) => new Set(prev).add(draft.id));

    const success = await approveDraft(draft.id, undefined, modifications);

    if (success && onApproved) {
      onApproved(draft, modifications);
    }

    setProcessingDrafts((prev) => {
      const next = new Set(prev);
      next.delete(draft.id);
      return next;
    });
    setEditingDraft(null);
  };

  const handleReject = async (draft: AIDraft, notes?: string) => {
    setProcessingDrafts((prev) => new Set(prev).add(draft.id));

    const success = await rejectDraft(draft.id, notes);

    if (success && onRejected) {
      onRejected(draft);
    }

    setProcessingDrafts((prev) => {
      const next = new Set(prev);
      next.delete(draft.id);
      return next;
    });
  };

  const startEditing = (draft: AIDraft) => {
    setEditingDraft(draft.id);
    setEditContent(
      typeof draft.suggested_content === 'string'
        ? draft.suggested_content
        : JSON.stringify(draft.suggested_content, null, 2)
    );
  };

  const renderContent = (content: any) => {
    if (typeof content === 'string') {
      return <p className="whitespace-pre-wrap">{content}</p>;
    }
    return (
      <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-sm overflow-auto max-h-96">
        {JSON.stringify(content, null, 2)}
      </pre>
    );
  };

  const renderDraftCard = (draft: AIDraft) => {
    const isExpanded = expandedDrafts.has(draft.id);
    const isEditing = editingDraft === draft.id;
    const isProcessing = processingDrafts.has(draft.id);
    const confidenceLevel = getConfidenceLevel(draft.confidence_score);
    const expiresAt = draft.expires_at ? new Date(draft.expires_at) : null;
    const isExpiringSoon = expiresAt && expiresAt.getTime() - Date.now() < 3600000; // 1 hour

    return (
      <div
        key={draft.id}
        className={`border rounded-lg transition-all ${
          isExpiringSoon
            ? 'border-amber-300 bg-amber-50/50'
            : 'border-gray-200 dark:border-gray-700'
        } ${compact ? 'p-3' : 'p-4'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Sparkles className="w-4 h-4 text-primary-500 flex-shrink-0" />
            <span className="font-medium truncate">
              {DRAFT_TYPE_LABELS[draft.draft_type] || draft.draft_type}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${confidenceLevel.bg} ${confidenceLevel.color}`}
            >
              {Math.round(draft.confidence_score * 100)}% pewności
            </span>
            {isExpiringSoon && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Wygasa wkrótce
              </span>
            )}
          </div>

          <button
            onClick={() => toggleExpand(draft.id)}
            className="p-1 hover:bg-gray-100 dark:bg-navy-800 dark:hover:bg-gray-800 rounded"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Preview or Expanded Content */}
        <div className={`mt-3 ${isExpanded ? '' : 'line-clamp-2'}`}>
          {isEditing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-48 p-3 border rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-c-focus"
            />
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {renderContent(draft.suggested_content)}
            </div>
          )}
        </div>

        {/* Reasoning (if expanded) */}
        {isExpanded && draft.reasoning && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
              Uzasadnienie AI:
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400">{draft.reasoning}</p>
          </div>
        )}

        {/* Original vs Suggested (if has diff) */}
        {isExpanded && draft.original_content && draft.diff_data?.hasChanges && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
              <p className="text-xs font-medium text-danger-700 mb-1">Oryginał:</p>
              <div className="text-sm">{renderContent(draft.original_content)}</div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-xs font-medium text-green-700 mb-1">Sugestia AI:</p>
              <div className="text-sm">{renderContent(draft.suggested_content)}</div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {draft.model_used && <span>Model: {draft.model_used}</span>}
            <span className="mx-2">•</span>
            <span>{new Date(draft.created_at).toLocaleString('pl-PL')}</span>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setEditingDraft(null)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:bg-navy-800 rounded-lg"
                  disabled={isProcessing}
                >
                  Anuluj
                </button>
                <button
                  onClick={() => handleApprove(draft, editContent)}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Zapisz zmiany
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleReject(draft)}
                  className="p-2 text-danger-600 hover:bg-danger-50 rounded-lg"
                  disabled={isProcessing}
                  title="Odrzuć"
                >
                  <XCircle className="w-5 h-5" />
                </button>
                <button
                  onClick={() => startEditing(draft)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  disabled={isProcessing}
                  title="Edit"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleApprove(draft)}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Akceptuj
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="p-4 bg-danger-50 text-danger-700 rounded-lg flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" />
        <span>{error}</span>
        <button onClick={fetchDrafts} className="ml-auto text-sm underline">
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      {showStats && stats && (
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              <span className="font-medium">Sugestie AI</span>
              {pendingCount > 0 && (
                <span className="bg-navy-900 text-white text-xs px-2 py-0.5 rounded-full">
                  {pendingCount} do przeglądu
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-lg font-semibold text-green-600">{stats.approved || 0}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Zaakceptowane</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-danger-600">{stats.rejected || 0}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Odrzucone</p>
            </div>
            {stats.acceptanceRate !== null && (
              <div className="text-center">
                <p className="text-lg font-semibold text-blue-600">{stats.acceptanceRate}%</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs">Akceptacja</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && filteredDrafts.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-primary-500" />
          <span className="ml-2 text-gray-500 dark:text-gray-400">Ładowanie sugestii...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredDrafts.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p className="font-medium">Brak sugestii do przeglądu</p>
          <p className="text-sm">Nowe sugestie AI pojawią się tutaj</p>
        </div>
      )}

      {/* Drafts List */}
      <div className="space-y-3">{filteredDrafts.map(renderDraftCard)}</div>
    </div>
  );
}

export default DraftReviewPanel;
