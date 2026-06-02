/**
 * EmbedInReports — Generates an embeddable summary of the mind map
 * that can be inserted into reports and presentations.
 */
import { CheckCircle2, ClipboardCopy, Code, FileText, Image, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface EmbedInReportsProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  ideaTitle: string;
  nodes: Array<{ id: string; data: any }>;
  edges: Array<{ source: string; target: string }>;
}

type EmbedFormat = 'markdown' | 'html' | 'json';

export const EmbedInReports: React.FC<EmbedInReportsProps> = ({
  open,
  onClose,
  ideaId,
  ideaTitle,
  nodes,
  edges,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [format, setFormat] = useState<EmbedFormat>('markdown');
  const [copied, setCopied] = useState(false);

  const branchNodes = useMemo(() => nodes.filter((n) => n.id.startsWith('branch-')), [nodes]);
  const ideaNodes = useMemo(
    () => nodes.filter((n) => n.id !== 'root' && !n.id.startsWith('branch-')),
    [nodes]
  );

  const embedContent = useMemo(() => {
    if (format === 'markdown') {
      let md = `# ${ideaTitle}\n\n`;
      md += `> Mind Map · ${branchNodes.length} branches · ${ideaNodes.length} ideas\n\n`;
      for (const bn of branchNodes) {
        const children = edges
          .filter((e) => e.source === bn.id)
          .map((e) => ideaNodes.find((n) => n.id === e.target))
          .filter(Boolean);
        md += `## ${bn.data?.label || bn.id}\n\n`;
        if (children.length === 0) {
          md += `_No ideas yet_\n\n`;
        } else {
          for (const child of children) {
            const status = child!.data?.status ? ` (${child!.data.status})` : '';
            md += `- ${child!.data?.label || child!.id}${status}\n`;
          }
          md += '\n';
        }
      }
      return md;
    }

    if (format === 'html') {
      let html = `<div class="mindmap-embed" data-idea-id="${ideaId}">\n`;
      html += `  <h2>${ideaTitle}</h2>\n`;
      html += `  <p><em>${branchNodes.length} branches · ${ideaNodes.length} ideas</em></p>\n`;
      for (const bn of branchNodes) {
        const children = edges
          .filter((e) => e.source === bn.id)
          .map((e) => ideaNodes.find((n) => n.id === e.target))
          .filter(Boolean);
        html += `  <h3>${bn.data?.label || bn.id}</h3>\n`;
        html += `  <ul>\n`;
        for (const child of children) {
          html += `    <li>${child!.data?.label || child!.id}</li>\n`;
        }
        html += `  </ul>\n`;
      }
      html += `</div>`;
      return html;
    }

    // JSON
    const structure = {
      ideaId,
      title: ideaTitle,
      branches: branchNodes.map((bn) => ({
        key: bn.data?.branchKey,
        label: bn.data?.label,
        ideas: edges
          .filter((e) => e.source === bn.id)
          .map((e) => {
            const node = ideaNodes.find((n) => n.id === e.target);
            return node
              ? { id: node.id, label: node.data?.label, status: node.data?.status }
              : null;
          })
          .filter(Boolean),
      })),
      stats: {
        totalBranches: branchNodes.length,
        totalIdeas: ideaNodes.length,
        exportedAt: new Date().toISOString(),
      },
    };
    return JSON.stringify(structure, null, 2);
  }, [branchNodes, edges, format, ideaId, ideaNodes, ideaTitle]);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(embedContent)
      .then(() => {
        setCopied(true);
        toast.success(isPl ? 'Skopiowano!' : 'Copied!', { duration: 1000 });
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        toast.error('Failed to copy');
      });
  }, [embedContent, isPl]);

  if (!open) return null;

  const formats: { id: EmbedFormat; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'markdown', label: 'Markdown', icon: FileText },
    { id: 'html', label: 'HTML', icon: Code },
    { id: 'json', label: 'JSON', icon: Code },
  ];

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-2">
            <Code size={16} className="text-blue-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              {isPl ? 'Osadź w raporcie' : 'Embed in Report'}
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
          {/* Format selector */}
          <div className="flex items-center gap-2 mb-3">
            {formats.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${format === f.id ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800'}`}
                >
                  <Icon size={12} />
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Preview */}
          <div className="relative">
            <pre className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950/30 border border-slate-200/30 dark:border-navy-700/30 text-[10px] text-slate-600 dark:text-slate-400 overflow-auto max-h-[300px] whitespace-pre-wrap font-mono">
              {embedContent}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 dark:bg-navy-800/80 text-slate-500 hover:text-blue-600 transition-colors"
            >
              {copied ? (
                <CheckCircle2 size={14} className="text-emerald-500" />
              ) : (
                <ClipboardCopy size={14} />
              )}
            </button>
          </div>

          <p className="text-[9px] text-slate-400 mt-3 text-center">
            {isPl
              ? 'Skopiuj i wklej do raportu, prezentacji lub dokumentu.'
              : 'Copy and paste into your report, presentation, or document.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmbedInReports;
