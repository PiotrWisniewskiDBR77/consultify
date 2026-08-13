/**
 * ExportDiagramCode — Exports mind map as Mermaid or PlantUML diagram code.
 */
import { CheckCircle2, ClipboardCopy, Code, X } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

interface ExportDiagramCodeProps {
  open: boolean;
  onClose: () => void;
  ideaTitle: string;
  nodes: Array<{ id: string; data: any }>;
  edges: Array<{ source: string; target: string }>;
}

type DiagramFormat = 'mermaid' | 'plantuml';

function sanitize(text: string): string {
  return (text || '')
    .replace(/\[|\]|["(){}|<>]/g, '')
    .replace(/\n/g, ' ')
    .trim()
    .slice(0, 60);
}

function generateMermaid(
  title: string,
  nodes: ExportDiagramCodeProps['nodes'],
  edges: ExportDiagramCodeProps['edges']
): string {
  const lines: string[] = ['mindmap'];
  lines.push(`  root((${sanitize(title)}))`);

  const branchNodes = nodes.filter((n) => n.id.startsWith('branch-'));
  const ideaNodes = nodes.filter((n) => n.id !== 'root' && !n.id.startsWith('branch-'));

  for (const bn of branchNodes) {
    lines.push(`    ${sanitize(bn.data?.label || bn.id)}`);
    const children = edges
      .filter((e) => e.source === bn.id)
      .map((e) => ideaNodes.find((n) => n.id === e.target))
      .filter(Boolean);
    for (const child of children) {
      lines.push(`      ${sanitize(child!.data?.label || child!.id)}`);
    }
  }

  return lines.join('\n');
}

function generatePlantUML(
  title: string,
  nodes: ExportDiagramCodeProps['nodes'],
  edges: ExportDiagramCodeProps['edges']
): string {
  const lines: string[] = ['@startmindmap'];
  lines.push(`* ${sanitize(title)}`);

  const branchNodes = nodes.filter((n) => n.id.startsWith('branch-'));
  const ideaNodes = nodes.filter((n) => n.id !== 'root' && !n.id.startsWith('branch-'));

  for (const bn of branchNodes) {
    lines.push(`** ${sanitize(bn.data?.label || bn.id)}`);
    const children = edges
      .filter((e) => e.source === bn.id)
      .map((e) => ideaNodes.find((n) => n.id === e.target))
      .filter(Boolean);
    for (const child of children) {
      lines.push(`*** ${sanitize(child!.data?.label || child!.id)}`);
      const grandchildren = edges
        .filter((e) => e.source === child!.id)
        .map((e) => ideaNodes.find((n) => n.id === e.target))
        .filter(Boolean);
      for (const gc of grandchildren) {
        lines.push(`**** ${sanitize(gc!.data?.label || gc!.id)}`);
      }
    }
  }

  lines.push('@endmindmap');
  return lines.join('\n');
}

export const ExportDiagramCode: React.FC<ExportDiagramCodeProps> = ({
  open,
  onClose,
  ideaTitle,
  nodes,
  edges,
}) => {
  const { t } = useTranslation();
  const [format, setFormat] = useState<DiagramFormat>('mermaid');
  const [copied, setCopied] = useState(false);

  const code = useMemo(() => {
    return format === 'mermaid'
      ? generateMermaid(ideaTitle, nodes, edges)
      : generatePlantUML(ideaTitle, nodes, edges);
  }, [edges, format, ideaTitle, nodes]);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        toast.success(t('ideas.mindmap.copied', 'Copied!'), { duration: 1000 });
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error(t('ideas.mindmap.copyFailed', 'Failed to copy')));
  }, [code, t]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-diagram-code-modal-heading"
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div className="flex items-center gap-2">
            <Code size={16} className="text-c-warning" />
            <h3 className="text-sm font-bold text-c-text dark:text-c-text" id="export-diagram-code-modal-heading">
              {t('ideas.mindmap.exportDiagramCode', 'Export Diagram Code')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            {(['mermaid', 'plantuml'] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFormat(f);
                  setCopied(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${format === f ? 'bg-c-surface-raised text-c-warning dark:text-c-warning' : 'text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface'}`}
              >
                {f === 'mermaid' ? 'Mermaid' : 'PlantUML'}
              </button>
            ))}
          </div>

          <div className="relative">
            <pre className="p-3 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle text-[10px] text-c-text-secondary dark:text-c-text-muted overflow-auto max-h-[350px] whitespace-pre-wrap font-mono">
              {code}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-c-surface-raised dark:bg-c-surface text-c-text-secondary hover:text-c-warning transition-colors"
            >
              {copied ? (
                <CheckCircle2 size={14} className="text-c-success" />
              ) : (
                <ClipboardCopy size={14} />
              )}
            </button>
          </div>

          <p className="text-[9px] text-c-text-secondary mt-3 text-center">
            {format === 'mermaid'
              ? t(
                  'ideas.mindmap.pasteIntoMermaidEditorMarkdownDocs',
                  'Paste into Mermaid editor or Markdown docs.'
                )
              : t('ideas.mindmap.pasteIntoPlantumlRenderer', 'Paste into PlantUML renderer.')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExportDiagramCode;
