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
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
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
      <div className="w-[380px] bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col rounded-l-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-white/10">
          <FileText size={16} className="text-slate-500 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white truncate flex-1">
            {branchLabel || (isPl ? 'Podsumowanie gałęzi' : 'Branch Summary')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={24} className="animate-spin text-slate-500" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isPl ? 'Generowanie podsumowania…' : 'Generating summary…'}
              </span>
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800/40 p-3 text-xs text-danger-700 dark:text-danger-300">
              {error}
            </div>
          )}
          {summary && !loading && (
            <>
              <section>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  {isPl ? 'Podsumowanie' : 'Summary'}
                </h4>
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  {summary.narrative}
                </p>
              </section>
              <BulletList
                items={summary.keyPoints}
                color="bg-navy-900"
                label={isPl ? 'Kluczowe punkty' : 'Key Points'}
              />
              <BulletList
                items={summary.recommendations}
                color="bg-emerald-500"
                label={isPl ? 'Rekomendacje' : 'Recommendations'}
              />
            </>
          )}
        </div>

        {summary && !loading && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={copyToClipboard}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-xs font-medium transition-colors"
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
