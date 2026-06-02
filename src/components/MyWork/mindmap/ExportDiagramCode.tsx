/**
 * ExportDiagramCode — Exports mind map as Mermaid or PlantUML diagram code.
 */
import { CheckCircle2, ClipboardCopy, Code, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
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
        toast.success(isPl ? 'Skopiowano!' : 'Copied!', { duration: 1000 });
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error('Failed to copy'));
  }, [code, isPl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-2">
            <Code size={16} className="text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              {isPl ? 'Eksport diagramu' : 'Export Diagram Code'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
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
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${format === f ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800'}`}
              >
                {f === 'mermaid' ? 'Mermaid' : 'PlantUML'}
              </button>
            ))}
          </div>

          <div className="relative">
            <pre className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950/30 border border-slate-200/30 dark:border-navy-700/30 text-[10px] text-slate-600 dark:text-slate-400 overflow-auto max-h-[350px] whitespace-pre-wrap font-mono">
              {code}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 dark:bg-navy-800/80 text-slate-500 hover:text-amber-600 transition-colors"
            >
              {copied ? (
                <CheckCircle2 size={14} className="text-emerald-500" />
              ) : (
                <ClipboardCopy size={14} />
              )}
            </button>
          </div>

          <p className="text-[9px] text-slate-400 mt-3 text-center">
            {format === 'mermaid'
              ? isPl
                ? 'Wklej do edytora Mermaid lub dokumentacji Markdown.'
                : 'Paste into Mermaid editor or Markdown docs.'
              : isPl
                ? 'Wklej do PlantUML renderera.'
                : 'Paste into PlantUML renderer.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExportDiagramCode;
