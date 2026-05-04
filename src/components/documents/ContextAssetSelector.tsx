/**
 * Shared Context Asset Selector.
 *
 * Source of truth: docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md §4.3
 *
 * Reusable component for AI workflows (Interview Insight Creator, AI Chat,
 * future modules) to let users explicitly select organization context documents
 * with honest visibility of:
 * - readiness (only `ready` documents are selectable)
 * - workflow mode (selected_material_only, selected_material_plus_selected_context,
 *   selected_material_plus_approved_org_context, org_context_research_mode)
 * - excluded documents and their reasons
 *
 * No silent execution: the component never enables non-ready documents and the
 * workflow mode picker is always visible to the user.
 */

import { CheckCircle2, Circle, FileText, Info, ShieldAlert } from 'lucide-react';
import React from 'react';

import { Document } from '../../types';

export type ContextWorkflowMode =
  | 'selected_material_only'
  | 'selected_material_plus_selected_context'
  | 'selected_material_plus_approved_org_context'
  | 'org_context_research_mode';

export const CONTEXT_WORKFLOW_MODES: ContextWorkflowMode[] = [
  'selected_material_only',
  'selected_material_plus_selected_context',
  'selected_material_plus_approved_org_context',
  'org_context_research_mode',
];

const WORKFLOW_MODE_LABELS: Record<
  ContextWorkflowMode,
  { label: string; description: string }
> = {
  selected_material_only: {
    label: 'Selected material only',
    description:
      'AI uses only the explicitly selected source material (interview, doc). No organization context is added.',
  },
  selected_material_plus_selected_context: {
    label: 'Selected material + selected context',
    description:
      'AI uses the selected material plus chunks retrieved from documents you select below.',
  },
  selected_material_plus_approved_org_context: {
    label: 'Selected material + approved org context',
    description:
      'AI uses the selected material, your selected documents, and additional approved organization-wide context where relevant.',
  },
  org_context_research_mode: {
    label: 'Org-wide research mode',
    description:
      'AI searches the full approved organization context. No specific source material is required.',
  },
};

interface ContextAssetSelectorProps {
  documents: Document[];
  selectedDocumentIds: string[];
  onChangeSelectedDocuments: (ids: string[]) => void;
  workflowMode: ContextWorkflowMode;
  onChangeWorkflowMode: (mode: ContextWorkflowMode) => void;
  loading?: boolean;
  disabled?: boolean;
  helperText?: string;
  showWorkflowModePicker?: boolean;
  maxSelections?: number;
}

function isDocumentReadyForRetrieval(doc: Document): boolean {
  const status = String(doc?.status || '').toLowerCase();
  return ['ready', 'indexed', 'complete', 'completed'].includes(status);
}

function getStatusHint(doc: Document): string | null {
  const status = String(doc?.status || '').toLowerCase();
  switch (status) {
    case 'ready':
    case 'indexed':
      return null;
    case 'partial_ready':
      return 'Partially understood — not selectable';
    case 'processing':
      return 'Processing — try again later';
    case 'ocr_required':
      return 'Needs OCR — not selectable';
    case 'unreadable':
      return 'Unreadable — not selectable';
    case 'failed':
      return 'Failed — not selectable';
    case 'policy_blocked':
      return 'Blocked by policy';
    case 'quota_blocked':
      return 'Blocked by quota';
    default:
      return status ? `Status: ${status}` : null;
  }
}

export const ContextAssetSelector: React.FC<ContextAssetSelectorProps> = ({
  documents,
  selectedDocumentIds,
  onChangeSelectedDocuments,
  workflowMode,
  onChangeWorkflowMode,
  loading = false,
  disabled = false,
  helperText,
  showWorkflowModePicker = true,
  maxSelections,
}) => {
  const selectedSet = new Set(selectedDocumentIds);
  const isModeWithoutSelection = workflowMode === 'org_context_research_mode';
  const documentSelectionDisabled =
    disabled ||
    workflowMode === 'selected_material_only' ||
    isModeWithoutSelection ||
    loading;

  const toggleDocument = (doc: Document) => {
    if (documentSelectionDisabled) return;
    if (!isDocumentReadyForRetrieval(doc)) return;
    const next = new Set(selectedSet);
    if (next.has(doc.id)) {
      next.delete(doc.id);
    } else {
      if (maxSelections && next.size >= maxSelections) return;
      next.add(doc.id);
    }
    onChangeSelectedDocuments(Array.from(next));
  };

  return (
    <div data-testid="context-asset-selector" className="space-y-3 text-sm">
      {showWorkflowModePicker && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-600">
            <Info className="h-3.5 w-3.5" />
            <span>Context workflow mode</span>
          </div>
          <div className="space-y-1.5">
            {CONTEXT_WORKFLOW_MODES.map((mode) => {
              const meta = WORKFLOW_MODE_LABELS[mode];
              const checked = workflowMode === mode;
              return (
                <label
                  key={mode}
                  className={`flex cursor-pointer items-start gap-2 rounded p-1.5 hover:bg-white ${
                    checked ? 'bg-white ring-1 ring-blue-200' : ''
                  } ${disabled ? 'opacity-60' : ''}`}
                >
                  <input
                    type="radio"
                    name="context-workflow-mode"
                    value={mode}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onChangeWorkflowMode(mode)}
                    className="mt-1"
                    aria-label={meta.label}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{meta.label}</span>
                    <span className="text-xs text-gray-600">{meta.description}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {helperText && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
          {helperText}
        </div>
      )}

      {!isModeWithoutSelection && (
        <div className="rounded-md border border-gray-200">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-600">
              Documents
            </span>
            <span className="text-xs text-gray-500">
              {selectedSet.size} selected
              {maxSelections ? ` / ${maxSelections}` : ''}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-6 text-center text-xs text-gray-500">
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-gray-500">
                No documents available
              </div>
            ) : (
              documents.map((doc) => {
                const isReady = isDocumentReadyForRetrieval(doc);
                const isSelected = selectedSet.has(doc.id);
                const statusHint = getStatusHint(doc);
                const itemDisabled = !isReady || documentSelectionDisabled;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    disabled={itemDisabled}
                    onClick={() => toggleDocument(doc)}
                    aria-pressed={isSelected}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors ${
                      isSelected ? 'bg-blue-50' : 'bg-white'
                    } ${itemDisabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-50'}`}
                  >
                    <div className="mt-0.5">
                      {isSelected ? (
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {doc.name || doc.filename || 'Untitled document'}
                      </span>
                      {statusHint && (
                        <span className="flex items-center gap-1 text-xs text-amber-700">
                          <ShieldAlert className="h-3 w-3" />
                          {statusHint}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {isModeWithoutSelection && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-600">
          Org-wide research mode searches the full approved organization context. No specific
          documents need to be selected.
        </div>
      )}
    </div>
  );
};

export default ContextAssetSelector;
