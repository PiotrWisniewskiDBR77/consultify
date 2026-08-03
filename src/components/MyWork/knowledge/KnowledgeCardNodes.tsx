/**
 * KnowledgeCardNodes — ReactFlow node components for the Knowledge object family.
 *
 * Three node types:
 * - knowledgeCard — general knowledge snippet (insight, reference, fact)
 * - noteCard — user note attached to the workspace
 * - evidenceCard — evidence item (URL, artifact, document reference)
 *
 * Register the exported `knowledgeNodeTypes` with ReactFlow.
 */
import { BookOpen, ExternalLink, FileText, Lightbulb, StickyNote } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Handle, type NodeProps, Position } from 'reactflow';

import {
  MindMapNodeResizer,
  MM_MIN_NODE_HEIGHT,
  MM_MIN_NODE_WIDTH,
  useNodeHasExplicitSize,
} from '../mindmap/MindMapNodeResizer';

/**
 * Ręczna zmiana rozmiaru (2026-07-27): karty wiedzy są węzłami Mapy Myśli,
 * więc obowiązuje je ta sama umowa co węzły `idea`/`branch`/ramki — uchwyty
 * przy zaznaczeniu, rozmiar w `node.style` (przeżywa zapis i przeładowanie),
 * a `min-w`/`max-w` znika dopiero, gdy użytkownik SAM nadał rozmiar.
 */

// ── Knowledge Card ──────────────────────────────────────────────────────────

const KnowledgeCardNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const hasExplicitSize = useNodeHasExplicitSize(id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(data?.label || ''));
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    if (data?.onLabelChange && draft !== data?.label) data.onLabelChange(draft);
  }, [data, draft]);

  return (
    <div
      className={`relative ${
        hasExplicitSize ? 'w-full h-full overflow-auto' : 'min-w-[160px] max-w-[240px]'
      } rounded-xl border bg-[color-mix(in_srgb,var(--c-tag-2)_12%,transparent)] border-c-tag-2 shadow-sm px-3 py-2 ${
        selected ? 'ring-2 ring-c-tag-2' : ''
      }`}
      onDoubleClick={() => {
        if (!data?.locked) setEditing(true);
      }}
    >
      <MindMapNodeResizer
        selected={selected}
        locked={Boolean(data?.locked)}
        minWidth={MM_MIN_NODE_WIDTH}
        minHeight={MM_MIN_NODE_HEIGHT}
      />
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-c-tag-2" />

      <div className="flex items-center gap-1.5 mb-1">
        <BookOpen size={12} className="text-c-tag-2 shrink-0" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-c-tag-2">
          {data?.category || 'Knowledge'}
        </span>
      </div>

      {editing ? (
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-full bg-transparent text-xs text-c-text-secondary outline-none border-b border-c-tag-2 resize-none"
          rows={2}
        />
      ) : (
        <div className="text-xs font-medium text-c-text-secondary line-clamp-3">
          {data?.label || 'Knowledge card'}
        </div>
      )}

      {data?.source && (
        <div className="mt-1 text-[8px] text-c-tag-2 truncate flex items-center gap-0.5">
          <Lightbulb size={8} />
          {data.source}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-c-tag-2" />
    </div>
  );
};

// ── Note Card ───────────────────────────────────────────────────────────────

const NoteCardNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const hasExplicitSize = useNodeHasExplicitSize(id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(data?.label || ''));
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    if (data?.onLabelChange && draft !== data?.label) data.onLabelChange(draft);
  }, [data, draft]);

  return (
    <div
      className={`relative ${
        hasExplicitSize ? 'w-full h-full overflow-auto' : 'min-w-[140px] max-w-[220px]'
      } rounded-xl border bg-[color-mix(in_srgb,var(--c-tag-9)_12%,transparent)] border-c-tag-9 shadow-sm px-3 py-2 ${
        selected ? 'ring-2 ring-c-tag-9' : ''
      }`}
      onDoubleClick={() => {
        if (!data?.locked) setEditing(true);
      }}
    >
      <MindMapNodeResizer
        selected={selected}
        locked={Boolean(data?.locked)}
        minWidth={MM_MIN_NODE_WIDTH}
        minHeight={MM_MIN_NODE_HEIGHT}
      />
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-c-tag-9" />

      <div className="flex items-center gap-1.5 mb-1">
        <StickyNote size={12} className="text-c-tag-9 shrink-0" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-c-tag-9">Note</span>
      </div>

      {editing ? (
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-full bg-transparent text-xs text-c-text-secondary outline-none border-b border-c-tag-9 resize-none"
          rows={3}
        />
      ) : (
        <div className="text-xs text-c-text-secondary whitespace-pre-wrap line-clamp-5">
          {data?.label || 'Note'}
        </div>
      )}

      {data?.createdAt && (
        <div className="mt-1 text-[7px] text-c-tag-9">
          {new Date(data.createdAt).toLocaleDateString()}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-c-tag-9" />
    </div>
  );
};

// ── Evidence Card ───────────────────────────────────────────────────────────

const EvidenceCardNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const hasExplicitSize = useNodeHasExplicitSize(id);
  const evidenceType: 'url' | 'artifact' | 'note' | 'document' = data?.evidenceType || 'note';

  const typeConfig = {
    url: { icon: ExternalLink, color: 'cyan', label: 'URL' },
    artifact: { icon: FileText, color: 'emerald', label: 'Artifact' },
    note: { icon: StickyNote, color: 'amber', label: 'Note' },
    document: { icon: FileText, color: 'violet', label: 'Document' },
  };

  const cfg = typeConfig[evidenceType] || typeConfig.note;
  const Icon = cfg.icon;

  return (
    <div
      className={`relative ${
        hasExplicitSize ? 'w-full h-full overflow-auto' : 'min-w-[140px] max-w-[200px]'
      } rounded-xl border bg-${cfg.color}-50 dark:bg-${cfg.color}-900/20 border-${cfg.color}-300 dark:border-${cfg.color}-600 shadow-sm px-3 py-2 ${
        selected ? `ring-2 ring-${cfg.color}-500/60` : ''
      }`}
      onDoubleClick={() => {
        if (data?.url) window.open(data.url, '_blank');
        else if (data?.onNodeDetail) data.onNodeDetail(id, data);
      }}
    >
      <MindMapNodeResizer
        selected={selected}
        locked={Boolean(data?.locked)}
        minWidth={MM_MIN_NODE_WIDTH}
        minHeight={MM_MIN_NODE_HEIGHT}
      />
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-c-tag-8" />

      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className={`text-${cfg.color}-500 shrink-0`} />
        <span className={`text-[9px] font-bold uppercase tracking-wider text-${cfg.color}-500/80`}>
          {cfg.label}
        </span>
      </div>

      <div className="text-xs font-medium text-c-text-secondary line-clamp-2">
        {data?.label || data?.title || 'Evidence'}
      </div>

      {data?.url && (
        <div className="mt-1 text-[8px] text-c-tag-1 truncate flex items-center gap-0.5">
          <ExternalLink size={8} />
          {data.url}
        </div>
      )}

      {data?.artifactId && (
        <div className="mt-1 text-[8px] text-c-tag-6 truncate">ID: {data.artifactId}</div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-c-tag-8" />
    </div>
  );
};

// ── Node types registry ─────────────────────────────────────────────────────

export const knowledgeNodeTypes: Record<string, React.ComponentType<NodeProps>> = {
  knowledgeCard: KnowledgeCardNode,
  noteCard: NoteCardNode,
  evidenceCard: EvidenceCardNode,
};

export { EvidenceCardNode, KnowledgeCardNode, NoteCardNode };
