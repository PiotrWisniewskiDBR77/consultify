/**
 * EmbedInReports — Generates an embeddable summary of the mind map
 * that can be inserted into reports and presentations.
 */
import { CheckCircle2, ClipboardCopy, Code, FileText, Image, X } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

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
  const { t } = useTranslation();
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
        toast.success(t('ideas.mindmap.copied', 'Copied!'), { duration: 1000 });
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        toast.error('Failed to copy');
      });
  }, [embedContent]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  const formats: { id: EmbedFormat; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'markdown', label: 'Markdown', icon: FileText },
    { id: 'html', label: 'HTML', icon: Code },
    { id: 'json', label: 'JSON', icon: Code },
  ];

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="embed-in-reports-modal-heading"
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div className="flex items-center gap-2">
            <Code size={16} className="text-c-info" />
            <h3 className="text-sm font-bold text-c-text dark:text-c-text" id="embed-in-reports-modal-heading">
              {t('ideas.mindmap.embedReport', 'Embed in Report')}
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
          {/* Format selector */}
          <div className="flex items-center gap-2 mb-3">
            {formats.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${format === f.id ? 'bg-c-surface-raised text-c-info dark:text-c-info' : 'text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface'}`}
                >
                  <Icon size={12} />
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Preview */}
          <div className="relative">
            <pre className="p-3 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle text-[10px] text-c-text-secondary dark:text-c-text-muted overflow-auto max-h-[300px] whitespace-pre-wrap font-mono">
              {embedContent}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-c-surface-raised dark:bg-c-surface text-c-text-secondary hover:text-c-info transition-colors"
            >
              {copied ? (
                <CheckCircle2 size={14} className="text-c-success" />
              ) : (
                <ClipboardCopy size={14} />
              )}
            </button>
          </div>

          <p className="text-[9px] text-c-text-secondary mt-3 text-center">
            {t(
              'ideas.mindmap.copyPasteIntoYourReportPresentation',
              'Copy and paste into your report, presentation, or document.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmbedInReports;
