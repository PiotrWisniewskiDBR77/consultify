import { Copy, Download, FileText, RefreshCw, X } from 'lucide-react';
import React from 'react';

import { CanvasMarkdownRenderer } from './CanvasMarkdownRenderer';

type CanvasMode = 'document' | 'md';
type StarterId = 'thoughts' | 'document' | 'research' | 'decision' | 'plan';

interface StarterTemplate {
  id: StarterId;
  label: string;
  title: string;
  description: string;
  markdown: string;
}

interface WorkCanvasDocumentPanelProps {
  onClose?: () => void;
}

const starterTemplates: StarterTemplate[] = [
  {
    id: 'thoughts',
    label: 'Zbierz myśli',
    title: 'Working Notes',
    description: 'Capture raw ideas and sort them into usable business structure.',
    markdown: `# Working Notes

Area: Business exploration
Purpose: Capture rough thinking before it becomes a decision, plan, or deliverable.

## Raw Thoughts

- 
- 
- 

## Patterns Emerging

| Theme | Evidence | Next Question |
|---|---|---|
|  |  |  |

> Use this space freely. Teresa can help turn it into a brief, decision memo, or research plan.`,
  },
  {
    id: 'document',
    label: 'Napisz dokument',
    title: 'Company Work Note',
    description: 'A clean Markdown-canonical document for business work.',
    markdown: `# Company Work Note

Area: Operating workspace
Purpose: Shape a business output with Teresa on the left and the document on the right.

## Context

Write the situation, goal, constraints, and audience here.

## Working Draft

- [ ] Define the business question.
- [ ] Capture assumptions.
- [ ] List open decisions.
- [ ] Decide the next action.

## Notes

> This is Markdown canonical. The document view and MD view read from the same source.`,
  },
  {
    id: 'research',
    label: 'Zrób research',
    title: 'Market Research Brief',
    description: 'Start a structured research brief before turning on deep search.',
    markdown: `# Market Research Brief

Area: Market research
Purpose: Define what Teresa should investigate before evidence gathering starts.

## Research Question

What do we need to know, and what decision will this research support?

## Scope

| Dimension | Definition |
|---|---|
| Market | TBD |
| Segment | TBD |
| Geography | TBD |
| Competitors | TBD |

## Evidence Needed

- Reliable sources
- Customer signals
- Competitor positioning
- Risks and assumptions`,
  },
  {
    id: 'decision',
    label: 'Przygotuj decyzję',
    title: 'Decision Memo',
    description: 'Frame options, trade-offs, risks, and the recommended choice.',
    markdown: `# Decision Memo

Decision: TBD
Owner: TBD
Date: TBD

## Recommendation

State the recommended option in one clear paragraph.

## Options

| Option | Upside | Risk | Confidence |
|---|---|---|---|
| A |  |  |  |
| B |  |  |  |

## Assumptions

- 

## Decision Log

- [ ] Approved
- [ ] Needs more evidence`,
  },
  {
    id: 'plan',
    label: 'Rozpisz plan',
    title: 'Execution Plan',
    description: 'Turn the conversation into clear workstreams and next steps.',
    markdown: `# Execution Plan

Purpose: Convert the business idea into accountable execution.

## Workstreams

| Workstream | Owner | Outcome | Status |
|---|---|---|---|
| Strategy | TBD |  | Not started |
| Research | TBD |  | Not started |
| Delivery | TBD |  | Not started |

## Next Steps

- [ ] Confirm scope.
- [ ] Assign owners.
- [ ] Define first milestone.
- [ ] Review risks with Teresa.`,
  },
];

function downloadMarkdown(title: string, markdown: string) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'canvas-document'}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

export function WorkCanvasDocumentPanel({ onClose }: WorkCanvasDocumentPanelProps) {
  const [mode, setMode] = React.useState<CanvasMode>('document');
  const [activeTemplateId, setActiveTemplateId] = React.useState<StarterId>('document');
  const activeTemplate =
    starterTemplates.find((template) => template.id === activeTemplateId) || starterTemplates[1];
  const [markdown, setMarkdown] = React.useState(activeTemplate.markdown);

  const selectTemplate = (template: StarterTemplate) => {
    setActiveTemplateId(template.id);
    setMarkdown(template.markdown);
    setMode('document');
  };

  const copyMarkdown = async () => {
    await navigator.clipboard?.writeText(markdown);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100 text-slate-950 dark:bg-[#111319] dark:text-slate-100">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-5 py-3 dark:border-white/10 dark:bg-[#17191f]/95">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <FileText size={13} strokeWidth={1.8} />
            Canvas work area
          </div>
          <h2 className="mt-1 truncate text-[15px] font-semibold text-slate-950 dark:text-white">
            {activeTemplate.title}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 sm:inline-flex">
            Saved
          </span>
          <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300 sm:inline-flex">
            Draft
          </span>
          <div className="flex rounded-full bg-slate-100 p-1 dark:bg-white/10">
            <button
              type="button"
              onClick={() => setMode('document')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                mode === 'document'
                  ? 'bg-white text-slate-950 shadow-sm dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              Document
            </button>
            <button
              type="button"
              onClick={() => setMode('md')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                mode === 'md'
                  ? 'bg-white text-slate-950 shadow-sm dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              MD
            </button>
          </div>
          <button
            type="button"
            onClick={() => void copyMarkdown()}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white"
            aria-label="Copy Markdown"
            title="Copy Markdown"
          >
            <Copy size={15} />
          </button>
          <button
            type="button"
            onClick={() => downloadMarkdown(activeTemplate.title, markdown)}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white"
            aria-label="Download Markdown"
            title="Download Markdown"
          >
            <Download size={15} />
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white"
              aria-label="Close Canvas"
              title="Close Canvas"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-52 shrink-0 border-r border-slate-200/70 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-black/10 xl:block">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Start pracy
          </div>
          <div className="space-y-1.5">
            {starterTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => selectTemplate(template)}
                className={`w-full rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                  activeTemplateId === template.id
                    ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200 dark:bg-white/10 dark:text-white dark:ring-white/10'
                    : 'text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                }`}
              >
                <div className="font-semibold">{template.label}</div>
                <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 opacity-75">
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-[860px] px-5 py-8 lg:px-8">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-medium">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                Markdown canonical
              </span>
              <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                Projection synced
              </span>
              <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                Document and MD share one source
              </span>
              <button
                type="button"
                onClick={() => setMarkdown(activeTemplate.markdown)}
                className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <RefreshCw size={12} />
                Reset
              </button>
            </div>

            {mode === 'md' ? (
              <textarea
                value={markdown}
                onChange={(event) => setMarkdown(event.target.value)}
                data-testid="canvas-md-view"
                className="min-h-[640px] w-full resize-y rounded-2xl border border-slate-200 bg-white p-6 font-mono text-sm leading-6 text-slate-800 shadow-[0_24px_80px_rgba(15,23,42,0.08)] outline-none transition-colors focus:border-primary-300 dark:border-white/10 dark:bg-[#0f1117] dark:text-slate-100"
                spellCheck={false}
              />
            ) : (
              <article
                data-testid="canvas-document-view"
                className="min-h-[640px] rounded-2xl border border-slate-200 bg-white px-8 py-9 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#1b1d24] dark:shadow-none md:px-12"
              >
                <CanvasMarkdownRenderer text={markdown} />
              </article>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

