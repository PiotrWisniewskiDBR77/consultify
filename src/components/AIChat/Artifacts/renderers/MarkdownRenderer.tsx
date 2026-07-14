/**
 * MarkdownRenderer - Rich markdown display with tables, lists, code blocks
 * Uses react-markdown with custom styling
 */

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const components = useMemo(
    () => ({
      // Headings
      h1: ({ children }: any) => (
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-6 mb-4 pb-2 border-b border-slate-200 dark:border-navy-700">
          {children}
        </h1>
      ),
      h2: ({ children }: any) => (
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mt-5 mb-3">
          {children}
        </h2>
      ),
      h3: ({ children }: any) => (
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mt-4 mb-2">
          {children}
        </h3>
      ),
      h4: ({ children }: any) => (
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-3 mb-2">
          {children}
        </h4>
      ),

      // Paragraphs
      p: ({ children }: any) => (
        <p className="text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">{children}</p>
      ),

      // Lists
      ul: ({ children }: any) => (
        <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 mb-4 space-y-1.5 ml-2">
          {children}
        </ul>
      ),
      ol: ({ children }: any) => (
        <ol className="list-decimal list-inside text-slate-700 dark:text-slate-300 mb-4 space-y-1.5 ml-2">
          {children}
        </ol>
      ),
      li: ({ children }: any) => (
        <li className="text-slate-700 dark:text-slate-300 leading-relaxed">{children}</li>
      ),

      // Code
      code: ({ inline, className: codeClassName, children }: any) => {
        if (inline) {
          return (
            <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-navy-700 text-brand dark:text-brand-light rounded text-sm font-mono">
              {children}
            </code>
          );
        }
        return (
          <code
            className={`block bg-slate-900 dark:bg-navy-950 text-slate-100 p-4 rounded-lg overflow-x-auto font-mono text-sm ${codeClassName}`}
          >
            {children}
          </code>
        );
      },
      pre: ({ children }: any) => <pre className="mb-4 rounded-lg overflow-hidden">{children}</pre>,

      // Tables
      table: ({ children }: any) => (
        <div className="overflow-x-auto mb-4 rounded-lg border border-slate-200 dark:border-navy-700">
          <table
            /* §27-exempt: renderer artefaktu AI/markdown read-only, poza zakresem 1.2 */ className="min-w-full divide-y divide-slate-200 dark:divide-navy-700"
          >
            {children}
          </table>
        </div>
      ),
      thead: ({ children }: any) => (
        <thead className="bg-slate-50 dark:bg-navy-800">{children}</thead>
      ),
      tbody: ({ children }: any) => (
        <tbody className="divide-y divide-slate-200 dark:divide-navy-700">{children}</tbody>
      ),
      tr: ({ children }: any) => (
        <tr className="hover:bg-slate-50 dark:hover:bg-navy-800/50">{children}</tr>
      ),
      th: ({ children }: any) => (
        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {children}
        </th>
      ),
      td: ({ children }: any) => (
        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{children}</td>
      ),

      // Blockquote
      blockquote: ({ children }: any) => (
        <blockquote className="border-l-4 border-brand pl-4 py-2 mb-4 bg-slate-50 dark:bg-navy-800/50 text-slate-700 dark:text-slate-300 italic">
          {children}
        </blockquote>
      ),

      // Horizontal rule
      hr: () => <hr className="my-6 border-slate-200 dark:border-navy-700" />,

      // Links
      a: ({ href, children }: any) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:text-brand-dark underline"
        >
          {children}
        </a>
      ),

      // Strong & Emphasis
      strong: ({ children }: any) => (
        <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>
      ),
      em: ({ children }: any) => (
        <em className="italic text-slate-700 dark:text-slate-300">{children}</em>
      ),

      // Images
      img: ({ src, alt }: any) => (
        <img src={src} alt={alt} className="max-w-full h-auto rounded-lg shadow-md my-4" />
      ),
    }),
    []
  );

  return (
    <div className={`prose prose-slate dark:prose-invert max-w-none p-4 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
