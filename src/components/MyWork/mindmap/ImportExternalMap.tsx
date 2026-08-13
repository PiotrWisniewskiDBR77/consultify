/**
 * ImportExternalMap — Import mind maps from FreeMind (.mm XML),
 * XMind (.xmind ZIP with content.json), and OPML (.opml) formats.
 */
import { FileUp, Loader2, Upload, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

interface ImportedNode {
  id: string;
  label: string;
  notes?: string;
  children: ImportedNode[];
}

interface ImportExternalMapProps {
  open: boolean;
  onClose: () => void;
  locked: boolean;
  onImport: (
    nodes: Array<{ label: string; parentLabel?: string; branchKey?: string; notes?: string }>
  ) => void;
}

// ── FreeMind (.mm) parser ───────────────────────────────────────────────

function parseFreeMindXML(xml: string): ImportedNode | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const root = doc.querySelector('node');
    if (!root) return null;

    let counter = 0;
    function parseNode(el: Element): ImportedNode {
      const label = el.getAttribute('TEXT') || el.getAttribute('text') || `Node ${++counter}`;
      const richContent = el.querySelector(':scope > richcontent');
      const notes = richContent?.textContent?.trim() || undefined;
      const children: ImportedNode[] = [];
      const childEls = el.querySelectorAll(':scope > node');
      childEls.forEach((child) => children.push(parseNode(child)));
      return { id: `imported-${counter++}`, label, notes, children };
    }

    return parseNode(root);
  } catch {
    return null;
  }
}

// ── XMind (.xmind) parser ───────────────────────────────────────────────

async function parseXMindZip(file: File): Promise<ImportedNode | null> {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(file);

    let counter = 0;
    function parseTopic(topic: any): ImportedNode {
      const label = topic.title || `Topic ${++counter}`;
      const notes = topic.notes?.plain?.content || topic.notes?.content || undefined;
      const children: ImportedNode[] = [];
      const attached = topic.children?.attached || topic.children || [];
      if (Array.isArray(attached)) {
        for (const child of attached) children.push(parseTopic(child));
      }
      return { id: `imported-${counter++}`, label, notes, children };
    }

    // XMind 2020+ format: content.json at zip root
    const contentFile = zip.file('content.json');
    if (contentFile) {
      const contentStr = await contentFile.async('string');
      const content = JSON.parse(contentStr);
      const sheet = Array.isArray(content) ? content[0] : content;
      const rootTopic = sheet?.rootTopic || sheet?.topic;
      if (rootTopic) return parseTopic(rootTopic);
    }

    // XMind 8 fallback: metadata.json contains sheet/topic structure
    const metaFile = zip.file('metadata.json');
    if (metaFile) {
      const metaStr = await metaFile.async('string');
      const meta = JSON.parse(metaStr);
      const rootTopic = meta?.rootTopic || meta?.topic;
      if (rootTopic) return parseTopic(rootTopic);
    }

    return null;
  } catch {
    return null;
  }
}

// ── OPML (.opml) parser ─────────────────────────────────────────────────

function parseOPML(xml: string): ImportedNode | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const body = doc.querySelector('body');
    if (!body) return null;

    let counter = 0;
    function parseOutline(el: Element): ImportedNode {
      const label = el.getAttribute('text') || el.getAttribute('title') || `Outline ${++counter}`;
      const notes = el.getAttribute('_note') || el.getAttribute('note') || undefined;
      const children: ImportedNode[] = [];
      const childEls = el.querySelectorAll(':scope > outline');
      childEls.forEach((child) => children.push(parseOutline(child)));
      return { id: `imported-${counter++}`, label, notes, children };
    }

    const topOutlines = body.querySelectorAll(':scope > outline');
    if (topOutlines.length === 0) return null;

    if (topOutlines.length === 1) {
      return parseOutline(topOutlines[0]);
    }

    const titleEl = doc.querySelector('head > title');
    const rootLabel = titleEl?.textContent?.trim() || 'Imported OPML';
    const children: ImportedNode[] = [];
    topOutlines.forEach((outline) => children.push(parseOutline(outline)));
    return { id: `imported-root`, label: rootLabel, children };
  } catch {
    return null;
  }
}

// ── Flatten tree (unlimited depth) ──────────────────────────────────────

function flattenTree(
  root: ImportedNode
): Array<{ label: string; parentLabel?: string; branchKey?: string; notes?: string }> {
  const result: Array<{ label: string; parentLabel?: string; branchKey?: string; notes?: string }> =
    [];

  function walk(node: ImportedNode, parentLabel?: string, isTopBranch?: boolean) {
    result.push({
      label: node.label,
      parentLabel,
      branchKey: isTopBranch ? 'options' : undefined,
      notes: node.notes,
    });
    for (const child of node.children) {
      walk(child, node.label, false);
    }
  }

  for (const branch of root.children) {
    walk(branch, undefined, true);
  }

  return result;
}

function countNodes(node: ImportedNode): number {
  let count = 1;
  for (const child of node.children) count += countNodes(child);
  return count;
}

// ── Component ───────────────────────────────────────────────────────────

export const ImportExternalMap: React.FC<ImportExternalMapProps> = ({
  open,
  onClose,
  locked,
  onImport,
}) => {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportedNode | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setFileName(file.name);

    try {
      let root: ImportedNode | null = null;

      if (file.name.endsWith('.mm')) {
        const text = await file.text();
        root = parseFreeMindXML(text);
      } else if (file.name.endsWith('.xmind')) {
        root = await parseXMindZip(file);
      } else if (file.name.endsWith('.opml')) {
        const text = await file.text();
        root = parseOPML(text);
      } else {
        toast.error(
          t(
            'ideas.mindmap.unsupportedFormatUseMmXmindOpml',
            'Unsupported format. Use .mm, .xmind, or .opml'
          )
        );
        setLoading(false);
        return;
      }

      if (!root) {
        toast.error(t('ideas.mindmap.failedParseFile', 'Failed to parse file'));
      } else {
        setPreview(root);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImport = useCallback(() => {
    if (!preview) return;
    const flat = flattenTree(preview);
    onImport(flat);
    const total = countNodes(preview);
    toast.success(t('ideas.mindmap.importedNNodes', 'Imported {{count}} nodes', { count: total }), {
      duration: 1500,
    });
    onClose();
  }, [onClose, onImport, preview, t]);

  const renderTree = (node: ImportedNode, depth: number = 0): React.ReactNode => (
    <div key={node.id} style={{ marginLeft: depth * 16 }}>
      <div
        className={`text-[${depth === 0 ? '12' : '10'}px] ${depth === 0 ? 'font-bold text-c-text-secondary dark:text-c-text' : 'text-c-text-secondary dark:text-c-text-muted'} py-0.5`}
      >
        {depth > 0 && (
          <span className="text-c-text-secondary mr-1">{'─'.repeat(Math.min(depth, 3))}</span>
        )}
        {node.label}
        {node.notes && (
          <span className="ml-1 text-[8px] text-c-text-secondary" title={node.notes}>
            📝
          </span>
        )}
      </div>
      {node.children.map((child) => renderTree(child, depth + 1))}
    </div>
  );

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  const nodeCount = preview ? countNodes(preview) : 0;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-external-map-modal-heading"
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div className="flex items-center gap-2">
            <FileUp size={16} className="text-c-info" />
            <h3 className="text-sm font-bold text-c-text dark:text-c-text" id="import-external-map-modal-heading">
              {t('ideas.mindmap.importMindMap', 'Import Mind Map')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {!preview && !loading && (
            <div className="text-center py-6">
              <Upload
                size={36}
                className="text-c-text-secondary dark:text-c-text-muted mx-auto mb-3"
              />
              <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted mb-4">
                {t(
                  'ideas.mindmap.importMapFromMmFreemindXmind',
                  'Import a map from .mm (FreeMind), .xmind (XMind), or .opml (OPML) file.'
                )}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".mm,.xmind,.opml"
                onChange={handleFile}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={locked}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-c-surface-raised text-[11px] font-bold text-c-info dark:text-c-info transition-all disabled:opacity-40"
              >
                <Upload size={14} />
                {t('ideas.mindmap.chooseFile', 'Choose file')}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={16} className="animate-spin text-c-info" />
              <span className="text-[11px] text-c-text-secondary">
                {t('ideas.mindmap.parsing', 'Parsing...')}
              </span>
            </div>
          )}

          {preview && (
            <>
              <div className="mb-3 p-2 rounded-xl bg-c-surface-raised border border-c-info">
                <div className="text-[10px] font-bold text-c-info dark:text-c-info">{fileName}</div>
                <div className="text-[9px] text-c-text-secondary">
                  {nodeCount} {t('ideas.mindmap.nodes', 'nodes')} · {preview.children.length}{' '}
                  {t('ideas.mindmap.branches', 'branches')}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle max-h-[250px] overflow-y-auto">
                {renderTree(preview)}
              </div>
            </>
          )}
        </div>

        {preview && (
          <div className="px-5 py-3 border-t border-c-border-subtle dark:border-c-border-subtle flex items-center gap-2">
            <button
              onClick={() => {
                setPreview(null);
                setFileName('');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border-subtle dark:border-c-border-subtle text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
            >
              {t('ideas.mindmap.differentFile', 'Different file')}
            </button>
            <button
              onClick={handleImport}
              disabled={locked}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-c-surface-raised text-c-info dark:text-c-info border border-c-info transition-all disabled:opacity-40"
            >
              <FileUp size={12} />
              {t('ideas.mindmap.importMap', 'Import to map')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportExternalMap;
