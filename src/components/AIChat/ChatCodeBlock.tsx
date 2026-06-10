/**
 * ChatCodeBlock — production-grade fenced-code rendering for chat messages.
 *
 * Chat audit P1-2 closure. The chat's MessageRenderer was emitting bare
 * `<pre><code>` blocks — no language label, no copy button, no Mermaid
 * support, no syntax highlight. Canvas already had Mermaid via the lazy
 * DiagramRenderer; this brings the chat to parity and adds a Copy CTA on
 * hover (ChatGPT/Claude/Grok pattern). Syntax highlighting is intentionally
 * NOT bundled here (react-syntax-highlighter is heavy and chat messages
 * are streamed character-by-character — repeat highlight churn is
 * expensive). The rendered fences still carry the `language-<x>` class so
 * a downstream theme can target them.
 */

import { Check, Copy } from 'lucide-react';
import React, { Suspense, useState } from 'react';

const DiagramRenderer = React.lazy(() =>
  import('./Artifacts/renderers/DiagramRenderer').then((m) => ({ default: m.DiagramRenderer }))
);

function plainTextOf(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(plainTextOf).join('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (children && typeof children === 'object' && (children as any).props?.children) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return plainTextOf((children as any).props.children);
  }
  return '';
}

interface ChatCodeBlockProps {
  className?: string;
  children: React.ReactNode;
}

export const ChatCodeBlock: React.FC<ChatCodeBlockProps> = ({ className, children }) => {
  const language =
    typeof className === 'string'
      ? (className.match(/language-([\w-]+)/)?.[1] ?? '').toLowerCase()
      : '';
  const source = plainTextOf(children);

  if (language === 'mermaid') {
    return (
      <Suspense
        fallback={
          <pre className="my-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
            <code>{source}</code>
          </pre>
        }
      >
        <div className="my-3">
          <DiagramRenderer content={source.trim()} />
        </div>
      </Suspense>
    );
  }

  return (
    <CopyableCodeBlock language={language} source={source} className={className}>
      {children}
    </CopyableCodeBlock>
  );
};

interface CopyableCodeBlockProps {
  language: string;
  source: string;
  className?: string;
  children: React.ReactNode;
}

const CopyableCodeBlock: React.FC<CopyableCodeBlockProps> = ({
  language,
  source,
  className,
  children,
}) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — non-fatal */
    }
  };

  return (
    <div className="group relative my-3">
      {language && (
        <div className="absolute left-3 top-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">
          {language}
        </div>
      )}
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy code'}
        title={copied ? 'Copied' : 'Copy code'}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-slate-800/80 px-1.5 py-1 text-[11px] font-medium text-slate-200 opacity-0 transition-opacity hover:bg-slate-700 group-hover:opacity-100 focus-visible:opacity-100"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
      </button>
      <pre className="overflow-x-auto rounded-lg bg-slate-950 px-3 pb-3 pt-7 text-xs leading-5 text-slate-100">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
};

export default ChatCodeBlock;
