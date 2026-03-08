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

// ── Knowledge Card ──────────────────────────────────────────────────────────

const KnowledgeCardNode: React.FC<NodeProps> = ({ id, data, selected }) => {
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
      className={`relative min-w-[160px] max-w-[240px] rounded-xl border bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-600 shadow-sm px-3 py-2 ${
        selected ? 'ring-2 ring-indigo-500/60' : ''
      }`}
      onDoubleClick={() => {
        if (!data?.locked) setEditing(true);
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-indigo-400" />

      <div className="flex items-center gap-1.5 mb-1">
        <BookOpen size={12} className="text-indigo-500 shrink-0" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-500/80">
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
          className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none border-b border-indigo-400 resize-none"
          rows={2}
        />
      ) : (
        <div className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-3">
          {data?.label || 'Knowledge card'}
        </div>
      )}

      {data?.source && (
        <div className="mt-1 text-[8px] text-indigo-400 truncate flex items-center gap-0.5">
          <Lightbulb size={8} />
          {data.source}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-indigo-400" />
    </div>
  );
};

// ── Note Card ───────────────────────────────────────────────────────────────

const NoteCardNode: React.FC<NodeProps> = ({ id, data, selected }) => {
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
      className={`relative min-w-[140px] max-w-[220px] rounded-xl border bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-600 shadow-sm px-3 py-2 ${
        selected ? 'ring-2 ring-amber-500/60' : ''
      }`}
      onDoubleClick={() => {
        if (!data?.locked) setEditing(true);
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-amber-400" />

      <div className="flex items-center gap-1.5 mb-1">
        <StickyNote size={12} className="text-amber-500 shrink-0" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500/80">
          Note
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
          className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none border-b border-amber-400 resize-none"
          rows={3}
        />
      ) : (
        <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap line-clamp-5">
          {data?.label || 'Note'}
        </div>
      )}

      {data?.createdAt && (
        <div className="mt-1 text-[7px] text-amber-400">
          {new Date(data.createdAt).toLocaleDateString()}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-amber-400" />
    </div>
  );
};

// ── Evidence Card ───────────────────────────────────────────────────────────

const EvidenceCardNode: React.FC<NodeProps> = ({ id, data, selected }) => {
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
      className={`relative min-w-[140px] max-w-[200px] rounded-xl border bg-${cfg.color}-50 dark:bg-${cfg.color}-900/20 border-${cfg.color}-300 dark:border-${cfg.color}-600 shadow-sm px-3 py-2 ${
        selected ? `ring-2 ring-${cfg.color}-500/60` : ''
      }`}
      onDoubleClick={() => {
        if (data?.url) window.open(data.url, '_blank');
        else if (data?.onNodeDetail) data.onNodeDetail(id, data);
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />

      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className={`text-${cfg.color}-500 shrink-0`} />
        <span className={`text-[9px] font-bold uppercase tracking-wider text-${cfg.color}-500/80`}>
          {cfg.label}
        </span>
      </div>

      <div className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
        {data?.label || data?.title || 'Evidence'}
      </div>

      {data?.url && (
        <div className="mt-1 text-[8px] text-cyan-500 truncate flex items-center gap-0.5">
          <ExternalLink size={8} />
          {data.url}
        </div>
      )}

      {data?.artifactId && (
        <div className="mt-1 text-[8px] text-emerald-500 truncate">ID: {data.artifactId}</div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />
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
