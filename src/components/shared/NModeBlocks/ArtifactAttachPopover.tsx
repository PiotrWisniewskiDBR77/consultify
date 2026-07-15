/**
 * ArtifactAttachPopover — V5-IDEA-33
 *
 * Lightweight search-and-attach popover for linking artifacts to workspace objects.
 * Supports: search by text/artifact index, filter by type, paste deep link.
 */
import { Link2, Search, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ArtifactLinkRole, ArtifactType } from '../../../utils/artifactLinks';
import {
  ARTIFACT_IDENTITY,
  buildArtifactCode,
  getArtifactLabel,
  parseArtifactRef,
} from '../../../utils/artifactLinks';

export interface ArtifactSearchResult {
  type: ArtifactType;
  id: string;
  title: string;
  status?: string;
  owner?: string;
}

export interface ArtifactAttachPopoverProps {
  open: boolean;
  onClose: () => void;
  onAttach: (
    ref: { type: ArtifactType; id: string; title: string },
    role: ArtifactLinkRole
  ) => void;
  searchResults?: ArtifactSearchResult[];
  onSearch?: (query: string) => void;
  isPl?: boolean;
  anchorPosition?: { x: number; y: number };
}

const QUICK_TYPES: ArtifactType[] = [
  'initiative',
  'task',
  'decision',
  'process',
  'role',
  'system',
  'kpi',
  'report',
  'presentation',
  'tool',
  'tool_session',
  'notebook',
  'knowledge',
  'financial_model',
  'budget',
];

const ROLE_OPTIONS: { value: ArtifactLinkRole; labelKey: string }[] = [
  { value: 'related', labelKey: 'sharedComponents.artifactAttachPopover.roleRelated' },
  { value: 'context', labelKey: 'sharedComponents.artifactAttachPopover.roleContext' },
  { value: 'source', labelKey: 'sharedComponents.artifactAttachPopover.roleSource' },
  { value: 'evidence', labelKey: 'sharedComponents.artifactAttachPopover.roleEvidence' },
  { value: 'output', labelKey: 'sharedComponents.artifactAttachPopover.roleOutput' },
];

export const ArtifactAttachPopover: React.FC<ArtifactAttachPopoverProps> = ({
  open,
  onClose,
  onAttach,
  searchResults = [],
  onSearch,
  isPl = false,
}) => {
  const { i18n } = useTranslation();
  const t = i18n.getFixedT(isPl ? 'pl' : 'en');
  const [query, setQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<ArtifactLinkRole>('related');
  const [filterType, setFilterType] = useState<ArtifactType | null>(null);
  const [pasteStatus, setPasteStatus] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      onSearch?.(q);
    },
    [onSearch]
  );

  const handlePaste = useCallback(
    (text: string) => {
      const parsed = parseArtifactRef(text);
      if (parsed) {
        setPasteStatus('');
        onAttach(
          { type: parsed.type, id: parsed.id, title: `${parsed.type}:${parsed.id}` },
          selectedRole
        );
        onClose();
        return;
      }
      setPasteStatus(t('sharedComponents.artifactAttachPopover.invalidRef'));
    },
    [onAttach, onClose, selectedRole, t]
  );

  const filteredResults = filterType
    ? searchResults.filter((r) => r.type === filterType)
    : searchResults;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
      <div className="w-[380px] max-h-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/60 dark:border-white/[0.06] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200/40 dark:border-white/[0.04]">
          <Link2 size={14} className="text-blue-500" />
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex-1">
            {t('sharedComponents.artifactAttachPopover.title')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600"
          >
            <X size={12} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200/40 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <Search size={12} className="text-slate-600" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (text.includes(':')) handlePaste(text);
              }}
              placeholder={t('sharedComponents.artifactAttachPopover.searchPlaceholder')}
              className="flex-1 text-[10px] bg-transparent outline-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400/60"
              autoFocus
            />
          </div>
          {pasteStatus && (
            <div
              role="status"
              className="mt-1 text-[10px] text-amber-700 dark:text-amber-400"
              data-testid="artifact-paste-status"
            >
              {pasteStatus}
            </div>
          )}
        </div>

        {/* Type filter */}
        <div className="px-3 pb-1.5 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setFilterType(null)}
            className={`px-2 py-0.5 rounded text-[9px] font-medium transition-colors ${
              !filterType
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {t('sharedComponents.artifactAttachPopover.filterAll')}
          </button>
          {QUICK_TYPES.map((quickType) => (
            <button
              key={quickType}
              type="button"
              onClick={() => setFilterType(filterType === quickType ? null : quickType)}
              className={`px-2 py-0.5 rounded text-[9px] font-medium transition-colors ${
                filterType === quickType
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {getArtifactLabel(quickType, isPl ? 'pl' : 'en')}
            </button>
          ))}
        </div>

        {/* Role selector */}
        <div className="px-3 pb-1.5 flex items-center gap-1">
          <span className="text-[9px] text-slate-600 mr-1">
            {t('sharedComponents.artifactAttachPopover.roleLabel')}
          </span>
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setSelectedRole(r.value)}
              className={`px-1.5 py-0.5 rounded text-[8px] font-medium transition-colors ${
                selectedRole === r.value
                  ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400'
                  : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {filteredResults.length === 0 && query.length > 0 && (
            <div className="text-[10px] text-slate-600 text-center py-4">
              {t('sharedComponents.artifactAttachPopover.noResults')}
            </div>
          )}
          {filteredResults.length === 0 && query.length === 0 && (
            <div className="text-[10px] text-slate-600 text-center py-4">
              {t('sharedComponents.artifactAttachPopover.emptyHint')}
            </div>
          )}
          {filteredResults.map((result) => {
            const identity = ARTIFACT_IDENTITY[result.type];
            return (
              <button
                key={`${result.type}:${result.id}`}
                type="button"
                onClick={() => {
                  onAttach({ type: result.type, id: result.id, title: result.title }, selectedRole);
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors text-left"
              >
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-${identity?.accent || 'slate'}-500/10 text-${identity?.accent || 'slate'}-500`}
                >
                  {(identity?.prefix || 'ART').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                    {result.title}
                  </div>
                  <div className="text-[8px] text-slate-600">
                    {getArtifactLabel(result.type, isPl ? 'pl' : 'en')} ·{' '}
                    {buildArtifactCode(result.type, result.id)}
                    {result.status ? ` · ${result.status}` : ''}
                    {result.owner ? ` · ${result.owner}` : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ArtifactAttachPopover;
