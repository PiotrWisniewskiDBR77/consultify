import { Clipboard, FileText, Loader2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { Edge, Node } from 'reactflow';

import { Api } from '@/services/api';

interface BranchSummaryPanelProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  ideaTitle: string;
  branchNodeId: string;
  branchLabel: string;
  nodes: Node[];
  edges: Edge[];
}

interface BranchSummary {
  narrative: string;
  keyPoints: string[];
  recommendations: string[];
}

function collectDescendants(rootId: string, nodes: Node[], edges: Edge[]): Node[] {
  const childMap = new Map<string, string[]>();
  for (const e of edges) {
    const list = childMap.get(e.source) || [];
    list.push(e.target);
    childMap.set(e.source, list);
  }
  const visited = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const child of childMap.get(id) || []) queue.push(child);
  }
  visited.delete(rootId);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return [...visited].map((id) => nodeMap.get(id)).filter(Boolean) as Node[];
}

function parseSummary(raw: string): BranchSummary {
  const sections = raw.split(/\n(?=##?\s|Key\s*Points|Recommendations|Kluczowe|Rekomendacje)/i);
  let narrative = '';
  const keyPoints: string[] = [];
  const recommendations: string[] = [];
  for (const section of sections) {
    const lower = section.toLowerCase();
    const bullets = section
      .split('\n')
      .filter((l) => /^[\s]*[-*•]\s/.test(l))
      .map((l) => l.replace(/^[\s]*[-*•]\s*/, '').trim());
    if (lower.includes('key point') || lower.includes('kluczow')) keyPoints.push(...bullets);
    else if (lower.includes('recommend') || lower.includes('rekomend'))
      recommendations.push(...bullets);
    else if (!narrative) {
      narrative = section
        .split('\n')
        .filter((l) => l.trim() && !/^#/.test(l.trim()))
        .join(' ')
        .trim();
    }
  }
  if (!narrative) narrative = raw.trim();
  return { narrative, keyPoints, recommendations };
}

const BulletList: React.FC<{ items: string[]; color: string; label: string }> = ({
  items,
  color,
  label,
}) =>
  items.length > 0 ? (
    <section>
      <h4 className="text-xs font-semibold text-c-text-secondary dark:text-c-text-muted uppercase tracking-wider mb-1.5">
        {label}
      </h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-c-text-secondary dark:text-c-text"
          >
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${color} shrink-0`} />
            {item}
          </li>
        ))}
      </ul>
    </section>
  ) : null;

export const BranchSummaryPanel: React.FC<BranchSummaryPanelProps> = ({
  open,
  onClose,
  ideaId,
  ideaTitle,
  branchNodeId,
  branchLabel,
  nodes,
  edges,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BranchSummary | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!branchNodeId) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const descendants = collectDescendants(branchNodeId, nodes, edges);
      const labels = descendants.map((n) => n.data?.label).filter(Boolean);
      const prompt = isPl
        ? `Podsumuj tę gałąź mapy myśli. Gałąź: ${branchLabel}. Węzły: ${labels.join(', ')}. Zwróć podsumowanie narracyjne, kluczowe punkty i rekomendacje.`
        : `Summarize this branch of a mind map. Branch: ${branchLabel}. Nodes: ${labels.join(', ')}. Return a narrative summary, key points, and recommendations.`;
      const res = await Api.getMyIdeaAISuggestions(ideaId, {
        seedText: `${prompt}\n\n${labels.join(', ')}`,
        mapNodes: descendants.map((n) => ({ id: n.id, label: n.data?.label, type: n.type })),
        activeTool: 'mindmap',
        language: i18n.language || 'en',
      });
      const raw =
        typeof res === 'string'
          ? res
          : res?.summary || res?.text || res?.narrative || JSON.stringify(res);
      setSummary(parseSummary(raw));
    } catch (err: any) {
      setError(
        err?.message || (isPl ? 'Nie udało się pobrać podsumowania' : 'Failed to fetch summary')
      );
    } finally {
      setLoading(false);
    }
  }, [branchNodeId, branchLabel, nodes, edges, ideaId, i18n.language, isPl]);

  useEffect(() => {
    if (open && branchNodeId) fetchSummary();
  }, [open, branchNodeId, fetchSummary]);

  const copyToClipboard = useCallback(() => {
    if (!summary) return;
    const md = [
      `## ${branchLabel}`,
      '',
      summary.narrative,
      '',
      ...(summary.keyPoints.length
        ? [
            `### ${isPl ? 'Kluczowe punkty' : 'Key Points'}`,
            ...summary.keyPoints.map((p) => `- ${p}`),
            '',
          ]
        : []),
      ...(summary.recommendations.length
        ? [
            `### ${isPl ? 'Rekomendacje' : 'Recommendations'}`,
            ...summary.recommendations.map((r) => `- ${r}`),
          ]
        : []),
    ].join('\n');
    navigator.clipboard
      .writeText(md)
      .then(() => toast.success(isPl ? 'Skopiowano do schowka' : 'Copied to clipboard'));
  }, [summary, branchLabel, isPl]);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-overlay flex">
      <div className="w-[380px] bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border-l border-c-border-subtle dark:border-c-border-subtle shadow-2xl flex flex-col rounded-l-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
          <FileText size={16} className="text-c-text-secondary shrink-0" />
          <h3 className="text-sm font-semibold text-c-text dark:text-c-text truncate flex-1">
            {branchLabel || (isPl ? 'Podsumowanie gałęzi' : 'Branch Summary')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
          >
            <X size={16} className="text-c-text-secondary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={24} className="animate-spin text-c-text-secondary" />
              <span className="text-xs text-c-text-secondary dark:text-c-text-muted">
                {isPl ? 'Generowanie podsumowania…' : 'Generating summary…'}
              </span>
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-danger dark:border-c-danger p-3 text-xs text-c-danger dark:text-c-danger">
              {error}
            </div>
          )}
          {summary && !loading && (
            <>
              <section>
                <h4 className="text-xs font-semibold text-c-text-secondary dark:text-c-text-muted uppercase tracking-wider mb-1.5">
                  {isPl ? 'Podsumowanie' : 'Summary'}
                </h4>
                <p className="text-sm text-c-text-secondary dark:text-c-text leading-relaxed">
                  {summary.narrative}
                </p>
              </section>
              <BulletList
                items={summary.keyPoints}
                color="bg-c-surface"
                label={isPl ? 'Kluczowe punkty' : 'Key Points'}
              />
              <BulletList
                items={summary.recommendations}
                color="bg-c-success"
                label={isPl ? 'Rekomendacje' : 'Recommendations'}
              />
            </>
          )}
        </div>

        {summary && !loading && (
          <div className="px-4 py-3 border-t border-c-border-subtle dark:border-c-border-subtle">
            <button
              type="button"
              onClick={copyToClipboard}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-c-surface hover:bg-c-surface text-c-text dark:bg-c-surface-raised dark:text-c-text dark:hover:bg-c-surface-raised text-xs font-medium transition-colors"
            >
              <Clipboard size={14} />
              {isPl ? 'Kopiuj do schowka' : 'Copy to clipboard'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
