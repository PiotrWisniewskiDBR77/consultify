import React from 'react';

const starterMarkdown = `# Start a company work note

This is the first Markdown-canonical Canvas document.

## What to capture

- Zbierz myśli
- Napisz dokument
- Zrób research
- Przygotuj decyzję
- Rozpisz plan
`;

function RenderedMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-slate-800">
      {text
        .split('\n')
        .filter(Boolean)
        .map((line, index) => {
          if (line.startsWith('# ')) {
            return (
              <h1 key={`${line}-${index}`} className="text-2xl font-semibold text-slate-950">
                {line.replace(/^# /, '')}
              </h1>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h2 key={`${line}-${index}`} className="text-lg font-semibold text-slate-900">
                {line.replace(/^## /, '')}
              </h2>
            );
          }
          if (line.startsWith('- ')) {
            return (
              <div key={`${line}-${index}`} className="text-sm leading-6 text-slate-700">
                {line}
              </div>
            );
          }
          return (
            <p key={`${line}-${index}`} className="text-sm leading-6 text-slate-700">
              {line}
            </p>
          );
        })}
    </div>
  );
}

export function WorkCanvasDocumentPanel() {
  const [mode, setMode] = React.useState<'document' | 'md'>('document');

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Canvas document
            </p>
            <h2 className="mt-1 text-base font-semibold text-slate-950">
              Start a company work note
            </h2>
          </div>
          <div className="flex rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode('document')}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                mode === 'document' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
              }`}
            >
              Document
            </button>
            <button
              type="button"
              onClick={() => setMode('md')}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                mode === 'md' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
              }`}
            >
              MD
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium">
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
            Markdown canonical
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
            Projection synced
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        {mode === 'md' ? (
          <textarea
            value={starterMarkdown}
            readOnly
            data-testid="canvas-md-view"
            className="h-full min-h-[360px] w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 font-mono text-sm leading-6 text-slate-800 shadow-sm outline-none"
          />
        ) : (
          <div
            data-testid="canvas-document-view"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <RenderedMarkdown text={starterMarkdown} />
          </div>
        )}
      </div>
    </div>
  );
}

