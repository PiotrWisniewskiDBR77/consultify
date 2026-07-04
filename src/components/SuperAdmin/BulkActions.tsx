import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CheckSquare,
  Copy,
  Download,
  FolderOpen,
  Globe,
  MoreHorizontal,
  RefreshCw,
  Send,
  Square,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';

import type { ContentCategory, ContentTag } from '../../types';

interface BulkActionsProps {
  selectedIds: string[];
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDelete: (ids: string[]) => Promise<void>;
  onArchive?: (ids: string[]) => Promise<void>;
  onPublish?: (ids: string[]) => Promise<void>;
  onDeprecate?: (ids: string[]) => Promise<void>;
  onAddTags?: (ids: string[], tagIds: string[]) => Promise<void>;
  onRemoveTags?: (ids: string[], tagIds: string[]) => Promise<void>;
  onSetCategory?: (ids: string[], categoryId: string) => Promise<void>;
  onClone?: (ids: string[]) => Promise<void>;
  onExport?: (ids: string[]) => Promise<void>;
  contentType: 'PLAYBOOK' | 'EMAIL' | 'MIXED';
  availableTags?: ContentTag[];
  availableCategories?: ContentCategory[];
}

type BulkActionMode =
  | null
  | 'delete'
  | 'archive'
  | 'publish'
  | 'deprecate'
  | 'addTags'
  | 'removeTags'
  | 'setCategory'
  | 'clone'
  | 'export';

export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedIds,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDelete,
  onArchive,
  onPublish,
  onDeprecate,
  onAddTags,
  onRemoveTags,
  onSetCategory,
  onClone,
  onExport,
  contentType,
  availableTags = [],
  availableCategories = [],
}) => {
  const [activeMode, setActiveMode] = useState<BulkActionMode>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const selectedCount = selectedIds.length;
  const isAllSelected = selectedCount === totalCount && totalCount > 0;
  const isSomeSelected = selectedCount > 0 && selectedCount < totalCount;

  const handleAction = useCallback(
    async (action: BulkActionMode) => {
      if (selectedCount === 0) return;

      setIsProcessing(true);
      setResult(null);

      try {
        switch (action) {
          case 'delete':
            await onDelete(selectedIds);
            setResult({ success: true, message: `Deleted ${selectedCount} items` });
            break;
          case 'archive':
            if (onArchive) {
              await onArchive(selectedIds);
              setResult({ success: true, message: `Archived ${selectedCount} items` });
            }
            break;
          case 'publish':
            if (onPublish) {
              await onPublish(selectedIds);
              setResult({ success: true, message: `Published ${selectedCount} items` });
            }
            break;
          case 'deprecate':
            if (onDeprecate) {
              await onDeprecate(selectedIds);
              setResult({ success: true, message: `Deprecated ${selectedCount} items` });
            }
            break;
          case 'addTags':
            if (onAddTags && selectedTagIds.length > 0) {
              await onAddTags(selectedIds, selectedTagIds);
              setResult({
                success: true,
                message: `Added ${selectedTagIds.length} tag(s) to ${selectedCount} items`,
              });
            }
            break;
          case 'removeTags':
            if (onRemoveTags && selectedTagIds.length > 0) {
              await onRemoveTags(selectedIds, selectedTagIds);
              setResult({
                success: true,
                message: `Removed ${selectedTagIds.length} tag(s) from ${selectedCount} items`,
              });
            }
            break;
          case 'setCategory':
            if (onSetCategory && selectedCategoryId) {
              await onSetCategory(selectedIds, selectedCategoryId);
              setResult({
                success: true,
                message: `Updated category for ${selectedCount} items`,
              });
            }
            break;
          case 'clone':
            if (onClone) {
              await onClone(selectedIds);
              setResult({ success: true, message: `Cloned ${selectedCount} items` });
            }
            break;
          case 'export':
            if (onExport) {
              await onExport(selectedIds);
              setResult({ success: true, message: `Exported ${selectedCount} items` });
            }
            break;
        }
        setActiveMode(null);
        setSelectedTagIds([]);
        setSelectedCategoryId('');
      } catch (error) {
        setResult({
          success: false,
          message: error instanceof Error ? error.message : 'Operation failed',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [
      selectedIds,
      selectedCount,
      selectedTagIds,
      selectedCategoryId,
      onDelete,
      onArchive,
      onPublish,
      onDeprecate,
      onAddTags,
      onRemoveTags,
      onSetCategory,
      onClone,
      onExport,
    ]
  );

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="sticky bottom-4 z-50 mx-4">
      <div className="bg-c-surface/95 backdrop-blur-xl border border-c-border rounded-xl shadow-2xl overflow-hidden">
        {/* Result Toast */}
        {result && (
          <div
            className={`flex items-center gap-2 px-4 py-2 text-sm ${
              result.success
                ? 'bg-emerald-500/10 text-emerald-400 border-b border-emerald-500/20'
                : 'bg-danger-500/10 text-danger-400 border-b border-danger-500/20'
            }`}
          >
            {result.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {result.message}
            <button onClick={() => setResult(null)} className="ml-auto hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Main Bar */}
        <div className="flex items-center gap-4 px-4 py-3">
          {/* Selection Checkbox */}
          <button
            onClick={isAllSelected ? onDeselectAll : onSelectAll}
            className="flex items-center gap-2 text-slate-400 dark:text-slate-500 hover:text-white"
          >
            {isAllSelected ? (
              <CheckSquare size={20} className="text-primary-400" />
            ) : isSomeSelected ? (
              <div className="w-5 h-5 border-2 border-primary-400 rounded bg-primary-400/30" />
            ) : (
              <Square size={20} />
            )}
          </button>

          {/* Selected Count */}
          <div className="flex items-center gap-2">
            <span className="text-c-text font-medium">{selectedCount}</span>
            <span className="text-slate-400 dark:text-slate-500">of {totalCount} selected</span>
            <button
              onClick={onDeselectAll}
              className="text-slate-500 dark:text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          <div className="w-px h-6 bg-c-surface-raised" />

          {/* Quick Actions */}
          <div className="flex items-center gap-1">
            {onPublish && (
              <ActionButton
                icon={<Globe size={16} />}
                label="Publish"
                onClick={() => setActiveMode('publish')}
                disabled={isProcessing}
                variant="success"
              />
            )}

            {onDeprecate && (
              <ActionButton
                icon={<Archive size={16} />}
                label="Deprecate"
                onClick={() => setActiveMode('deprecate')}
                disabled={isProcessing}
              />
            )}

            {onAddTags && availableTags.length > 0 && (
              <ActionButton
                icon={<Tag size={16} />}
                label="Add Tags"
                onClick={() => setActiveMode('addTags')}
                disabled={isProcessing}
              />
            )}

            {onSetCategory && availableCategories.length > 0 && (
              <ActionButton
                icon={<FolderOpen size={16} />}
                label="Set Category"
                onClick={() => setActiveMode('setCategory')}
                disabled={isProcessing}
              />
            )}

            {onClone && (
              <ActionButton
                icon={<Copy size={16} />}
                label="Clone"
                onClick={() => handleAction('clone')}
                disabled={isProcessing}
              />
            )}

            {onExport && (
              <ActionButton
                icon={<Download size={16} />}
                label="Export"
                onClick={() => handleAction('export')}
                disabled={isProcessing}
              />
            )}

            {/* More Actions Dropdown */}
            <div className="relative">
              <ActionButton
                icon={<MoreHorizontal size={16} />}
                label=""
                onClick={() => setShowMoreActions(!showMoreActions)}
                disabled={isProcessing}
              />
              {showMoreActions && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMoreActions(false)} />
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-c-surface-raised border border-c-border rounded-xl shadow-xl z-20 py-1">
                    {onRemoveTags && availableTags.length > 0 && (
                      <button
                        onClick={() => {
                          setActiveMode('removeTags');
                          setShowMoreActions(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-c-surface-raised/50"
                      >
                        <Tag size={14} />
                        Remove Tags
                      </button>
                    )}
                    {onArchive && (
                      <button
                        onClick={() => {
                          setActiveMode('archive');
                          setShowMoreActions(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-c-surface-raised/50"
                      >
                        <Archive size={14} />
                        Archive
                      </button>
                    )}
                    <hr className="my-1 border-c-border" />
                    <button
                      onClick={() => {
                        setActiveMode('delete');
                        setShowMoreActions(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger-400 hover:bg-danger-500/10"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Panels */}
        {activeMode === 'delete' && (
          <ActionPanel
            title="Delete Items"
            description={`Are you sure you want to delete ${selectedCount} item(s)? This action cannot be undone.`}
            variant="danger"
            isProcessing={isProcessing}
            onConfirm={() => handleAction('delete')}
            onCancel={() => setActiveMode(null)}
            confirmLabel="Delete"
          />
        )}

        {activeMode === 'publish' && (
          <ActionPanel
            title="Publish Items"
            description={`Are you sure you want to publish ${selectedCount} item(s)? They will become available for use.`}
            variant="success"
            isProcessing={isProcessing}
            onConfirm={() => handleAction('publish')}
            onCancel={() => setActiveMode(null)}
            confirmLabel="Publish"
          />
        )}

        {activeMode === 'deprecate' && (
          <ActionPanel
            title="Deprecate Items"
            description={`Are you sure you want to deprecate ${selectedCount} item(s)? They will be marked as deprecated.`}
            variant="warning"
            isProcessing={isProcessing}
            onConfirm={() => handleAction('deprecate')}
            onCancel={() => setActiveMode(null)}
            confirmLabel="Deprecate"
          />
        )}

        {activeMode === 'archive' && (
          <ActionPanel
            title="Archive Items"
            description={`Are you sure you want to archive ${selectedCount} item(s)?`}
            isProcessing={isProcessing}
            onConfirm={() => handleAction('archive')}
            onCancel={() => setActiveMode(null)}
            confirmLabel="Archive"
          />
        )}

        {activeMode === 'addTags' && (
          <div className="px-4 py-3 border-t border-c-border/50 bg-c-surface-raised/50">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-c-text">Add Tags to {selectedCount} items</span>
              <button
                onClick={() => {
                  setActiveMode(null);
                  setSelectedTagIds([]);
                }}
                className="text-slate-500 dark:text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedTagIds.includes(tag.id)
                      ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900'
                      : ''
                  }`}
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                    borderColor: `${tag.color}40`,
                    borderWidth: '1px',
                  }}
                >
                  <Tag size={10} />
                  {tag.name}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setActiveMode(null);
                  setSelectedTagIds([]);
                }}
                className="px-4 py-2 text-slate-400 dark:text-slate-500 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('addTags')}
                disabled={selectedTagIds.length === 0 || isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-c-text text-c-bg rounded-lg font-medium hover:bg-c-text-secondary disabled:opacity-50"
              >
                {isProcessing ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Tag size={14} />
                )}
                Add {selectedTagIds.length} Tag(s)
              </button>
            </div>
          </div>
        )}

        {activeMode === 'removeTags' && (
          <div className="px-4 py-3 border-t border-c-border/50 bg-c-surface-raised/50">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-c-text">Remove Tags from {selectedCount} items</span>
              <button
                onClick={() => {
                  setActiveMode(null);
                  setSelectedTagIds([]);
                }}
                className="text-slate-500 dark:text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedTagIds.includes(tag.id)
                      ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900'
                      : ''
                  }`}
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                    borderColor: `${tag.color}40`,
                    borderWidth: '1px',
                  }}
                >
                  <Tag size={10} />
                  {tag.name}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setActiveMode(null);
                  setSelectedTagIds([]);
                }}
                className="px-4 py-2 text-slate-400 dark:text-slate-500 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('removeTags')}
                disabled={selectedTagIds.length === 0 || isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-danger-500 text-white rounded-lg font-medium hover:bg-danger-600 disabled:opacity-50"
              >
                {isProcessing ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Tag size={14} />
                )}
                Remove {selectedTagIds.length} Tag(s)
              </button>
            </div>
          </div>
        )}

        {activeMode === 'setCategory' && (
          <div className="px-4 py-3 border-t border-c-border/50 bg-c-surface-raised/50">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-c-text">Set Category for {selectedCount} items</span>
              <button
                onClick={() => {
                  setActiveMode(null);
                  setSelectedCategoryId('');
                }}
                className="text-slate-500 dark:text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-c-focus"
            >
              <option value="">Select a category...</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setActiveMode(null);
                  setSelectedCategoryId('');
                }}
                className="px-4 py-2 text-slate-400 dark:text-slate-500 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('setCategory')}
                disabled={!selectedCategoryId || isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-c-text text-c-bg rounded-lg font-medium hover:bg-c-text-secondary disabled:opacity-50"
              >
                {isProcessing ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <FolderOpen size={14} />
                )}
                Set Category
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'success' | 'danger' | 'warning';
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  onClick,
  disabled = false,
  variant = 'default',
}) => {
  const variantStyles = {
    default: 'text-slate-400 dark:text-slate-500 hover:text-white hover:bg-c-surface-raised/50',
    success: 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10',
    danger: 'text-danger-400 hover:text-danger-300 hover:bg-danger-500/10',
    warning: 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${variantStyles[variant]}`}
    >
      {icon}
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
};

interface ActionPanelProps {
  title: string;
  description: string;
  variant?: 'default' | 'success' | 'danger' | 'warning';
  isProcessing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
}

const ActionPanel: React.FC<ActionPanelProps> = ({
  title,
  description,
  variant = 'default',
  isProcessing,
  onConfirm,
  onCancel,
  confirmLabel,
}) => {
  const variantStyles = {
    default: {
      bg: 'bg-c-surface-raised/50',
      border: 'border-c-border/50',
      button: 'bg-primary-500 hover:bg-primary-600',
      icon: <AlertTriangle size={16} className="text-slate-400 dark:text-slate-500" />,
    },
    success: {
      bg: 'bg-emerald-900/20',
      border: 'border-emerald-500/20',
      button: 'bg-emerald-500 hover:bg-emerald-600',
      icon: <CheckCircle2 size={16} className="text-emerald-400" />,
    },
    danger: {
      bg: 'bg-danger-900/20',
      border: 'border-danger-500/20',
      button: 'bg-danger-500 hover:bg-danger-600',
      icon: <AlertTriangle size={16} className="text-danger-400" />,
    },
    warning: {
      bg: 'bg-amber-900/20',
      border: 'border-amber-500/20',
      button: 'bg-amber-500 hover:bg-amber-600',
      icon: <AlertTriangle size={16} className="text-amber-400" />,
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={`px-4 py-3 border-t ${styles.border} ${styles.bg}`}>
      <div className="flex items-start gap-3">
        {styles.icon}
        <div className="flex-1">
          <h4 className="font-medium text-c-text mb-1">{title}</h4>
          <p className="text-sm text-slate-400 dark:text-slate-500">{description}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-400 dark:text-slate-500 hover:text-white"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 ${styles.button}`}
          >
            {isProcessing && <RefreshCw size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActions;
