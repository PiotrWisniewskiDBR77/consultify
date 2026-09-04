/**
 * CodeRenderer - Syntax highlighted code display with line numbers and copy
 */

import { Check, Copy, Hash, WrapText } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CodeRendererProps {
  content: string;
  language: string;
  className?: string;
  showLineNumbers?: boolean;
}

// Simple token-based syntax highlighting
const tokenize = (code: string, language: string): { type: string; value: string }[][] => {
  const lines = code.split('\n');

  // Language-specific patterns
  const patterns: Record<string, Array<{ pattern: RegExp; type: string }>> = {
    javascript: [
      { pattern: /\/\/.*$/gm, type: 'comment' },
      { pattern: /\/\*[\s\S]*?\*\//g, type: 'comment' },
      { pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, type: 'string' },
      {
        pattern:
          /\b(const|let|var|function|return|if|else|for|while|class|extends|import|export|from|async|await|try|catch|throw|new|this)\b/g,
        type: 'keyword',
      },
      { pattern: /\b(true|false|null|undefined|NaN|Infinity)\b/g, type: 'literal' },
      { pattern: /\b\d+\.?\d*\b/g, type: 'number' },
      { pattern: /[{}[\]();,.:]/g, type: 'punctuation' },
    ],
    typescript: [
      { pattern: /\/\/.*$/gm, type: 'comment' },
      { pattern: /\/\*[\s\S]*?\*\//g, type: 'comment' },
      { pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, type: 'string' },
      {
        pattern:
          /\b(const|let|var|function|return|if|else|for|while|class|extends|import|export|from|async|await|try|catch|throw|new|this|type|interface|enum|implements|public|private|protected|readonly|abstract)\b/g,
        type: 'keyword',
      },
      {
        pattern:
          /\b(true|false|null|undefined|NaN|Infinity|string|number|boolean|any|void|never)\b/g,
        type: 'literal',
      },
      { pattern: /\b\d+\.?\d*\b/g, type: 'number' },
      { pattern: /[{}[\]();,.:]/g, type: 'punctuation' },
    ],
    python: [
      { pattern: /#.*$/gm, type: 'comment' },
      { pattern: /"""[\s\S]*?"""|'''[\s\S]*?'''/g, type: 'string' },
      { pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, type: 'string' },
      {
        pattern:
          /\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|raise|with|lambda|yield|async|await|pass|break|continue|in|is|not|and|or)\b/g,
        type: 'keyword',
      },
      { pattern: /\b(True|False|None)\b/g, type: 'literal' },
      { pattern: /\b\d+\.?\d*\b/g, type: 'number' },
    ],
    sql: [
      { pattern: /--.*$/gm, type: 'comment' },
      { pattern: /\/\*[\s\S]*?\*\//g, type: 'comment' },
      { pattern: /'(?:[^'\\]|\\.)*'/g, type: 'string' },
      {
        pattern:
          /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|NULL|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|DISTINCT|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|VALUES|INTO|SET)\b/gi,
        type: 'keyword',
      },
      { pattern: /\b\d+\.?\d*\b/g, type: 'number' },
    ],
    json: [
      { pattern: /"(?:[^"\\]|\\.)*"(?=\s*:)/g, type: 'property' },
      { pattern: /"(?:[^"\\]|\\.)*"/g, type: 'string' },
      { pattern: /\b(true|false|null)\b/g, type: 'literal' },
      { pattern: /-?\b\d+\.?\d*\b/g, type: 'number' },
    ],
    plaintext: [],
  };

  const langPatterns = patterns[language.toLowerCase()] || patterns.plaintext;

  return lines.map((line) => {
    if (langPatterns.length === 0) {
      return [{ type: 'plain', value: line }];
    }

    // Simple tokenization - for production use a proper library like Prism or Highlight.js
    const tokens: { type: string; value: string }[] = [];
    let remaining = line;

    while (remaining.length > 0) {
      let matched = false;

      for (const { pattern, type } of langPatterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(remaining);

        if (match && match.index === 0) {
          tokens.push({ type, value: match[0] });
          remaining = remaining.slice(match[0].length);
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Add single character as plain text
        tokens.push({ type: 'plain', value: remaining[0] });
        remaining = remaining.slice(1);
      }
    }

    return tokens;
  });
};

const TOKEN_COLORS: Record<string, string> = {
  comment: 'text-slate-500 dark:text-slate-500 italic',
  string: 'text-green-600 dark:text-green-400',
  keyword: 'text-c-text-secondary dark:text-c-text-secondary',
  literal: 'text-amber-600 dark:text-amber-400',
  number: 'text-blue-600 dark:text-blue-400',
  punctuation: 'text-slate-500 dark:text-slate-400',
  property: 'text-blue-600 dark:text-blue-400',
  plain: 'text-slate-800 dark:text-slate-200',
};

export const CodeRenderer: React.FC<CodeRendererProps> = ({
  content,
  language,
  className = '',
  showLineNumbers: initialShowLines = true,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(initialShowLines);
  const [wordWrap, setWordWrap] = useState(false);

  const tokens = useMemo(() => tokenize(content, language), [content, language]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [content]);

  return (
    <div className={`bg-slate-900 dark:bg-navy-950 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 dark:bg-navy-900 border-b border-slate-700 dark:border-navy-800">
        <span className="text-xs font-mono text-slate-600 dark:text-slate-500 uppercase">
          {language}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className={`p-1.5 rounded transition-colors ${
              showLineNumbers
                ? 'text-brand bg-brand/10'
                : 'text-slate-600 dark:text-slate-500 hover:text-slate-300 hover:bg-slate-700'
            }`}
            title={t('code.toggleLineNumbers', 'Toggle line numbers')}
          >
            <Hash size={14} />
          </button>

          <button
            onClick={() => setWordWrap(!wordWrap)}
            className={`p-1.5 rounded transition-colors ${
              wordWrap
                ? 'text-brand bg-brand/10'
                : 'text-slate-600 dark:text-slate-500 hover:text-slate-300 hover:bg-slate-700'
            }`}
            title={t('code.toggleWrap', 'Toggle word wrap')}
          >
            <WrapText size={14} />
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600 dark:text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded transition-colors"
          >
            {copied ? (
              <>
                <Check size={14} className="text-green-400" />
                {t('code.copied', 'Copied!')}
              </>
            ) : (
              <>
                <Copy size={14} />
                {t('code.copy', 'Copy')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code content */}
      <div className={`overflow-x-auto ${wordWrap ? '' : 'scrollbar-thin'}`}>
        <pre className="p-4 text-sm leading-relaxed">
          <code className={wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}>
            {tokens.map((lineTokens, lineIndex) => (
              <div key={lineIndex} className="flex">
                {showLineNumbers && (
                  <span className="select-none text-slate-600 dark:text-slate-500 w-10 text-right pr-4 flex-shrink-0">
                    {lineIndex + 1}
                  </span>
                )}
                <span className="flex-1">
                  {lineTokens.map((token, tokenIndex) => (
                    <span
                      key={tokenIndex}
                      className={TOKEN_COLORS[token.type] || TOKEN_COLORS.plain}
                    >
                      {token.value}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>

      {/* Footer with stats */}
      <div className="px-4 py-1.5 bg-slate-800 dark:bg-navy-900 border-t border-slate-700 dark:border-navy-800 text-xs text-slate-500 dark:text-slate-400">
        {tokens.length} {t('code.lines', 'lines')} • {content.length}{' '}
        {t('code.characters', 'chars')}
      </div>
    </div>
  );
};

export default CodeRenderer;
