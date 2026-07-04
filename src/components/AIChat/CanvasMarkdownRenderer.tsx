import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Lazy so the (heavy) mermaid bundle stays out of the critical document path
// and only loads when a ```mermaid fence is actually rendered.
const DiagramRenderer = React.lazy(() =>
  import('./Artifacts/renderers/DiagramRenderer').then((m) => ({ default: m.DiagramRenderer }))
);

function plainText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(plainText).join('');
  return '';
}

export function CanvasMarkdownRenderer({ text }: { text: string }) {
  return (
    <div className="canvas-document-prose text-[15px] leading-7 text-slate-800 dark:text-slate-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-5 text-3xl font-semibold tracking-[-0.025em] text-slate-950 dark:text-white">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-8 text-xl font-semibold tracking-[-0.015em] text-slate-900 dark:text-slate-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-6 text-base font-semibold text-slate-900 dark:text-slate-100">
              {children}
            </h3>
          ),
          p: ({ children }) => {
            const raw = plainText(children);
            if (/^(Area|Purpose|Decision|Owner|Date):/i.test(raw.trim())) {
              return (
                <p className="mb-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-c-border-subtle dark:bg-white/[0.03] dark:text-slate-300">
                  {children}
                </p>
              );
            }
            return <p className="mb-4 text-slate-700 dark:text-slate-300">{children}</p>;
          },
          ul: ({ children }) => (
            <ul className="mb-5 list-disc space-y-1.5 pl-6 text-slate-700 dark:text-slate-300">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-5 list-decimal space-y-1.5 pl-6 text-slate-700 dark:text-slate-300">
              {children}
            </ol>
          ),
          li: ({ children, className }) => (
            <li className={className?.includes('task-list-item') ? 'list-none' : undefined}>
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-5 border-l-4 border-slate-300 pl-4 text-slate-600 dark:border-slate-600 dark:text-slate-300">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-2xl border border-slate-200 dark:border-c-border-subtle">
              <table /* §27-exempt: renderer artefaktu AI/markdown read-only, poza zakresem 1.2 */  className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/10">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700 dark:bg-white/[0.04] dark:text-slate-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-t border-slate-200 px-4 py-3 align-top text-slate-700 dark:border-c-border-subtle dark:text-slate-300">
              {children}
            </td>
          ),
          code: ({ inline, className, children }: any) => {
            if (inline || !className) {
              return (
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800 dark:bg-white/10 dark:text-slate-100">
                  {children}
                </code>
              );
            }
            const language =
              typeof className === 'string'
                ? (className.match(/language-([\w-]+)/)?.[1] ?? '').toLowerCase()
                : '';
            if (language === 'mermaid') {
              const source = plainText(children).trim();
              return (
                <React.Suspense
                  fallback={
                    <pre className="my-5 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">
                      <code>{source}</code>
                    </pre>
                  }
                >
                  <div className="my-5">
                    <DiagramRenderer content={source} />
                  </div>
                </React.Suspense>
              );
            }
            return (
              <pre className="my-5 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">
                <code className={className}>{children}</code>
              </pre>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary-600 underline decoration-primary-300 underline-offset-4 hover:text-primary-700 dark:text-primary-300"
            >
              {children}
            </a>
          ),
          input: ({ node: _node, ref: _ref, ...props }: any) => (
            <input
              {...props}
              readOnly
              className="mr-2 h-4 w-4 rounded border-slate-300 text-primary-600"
            />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
