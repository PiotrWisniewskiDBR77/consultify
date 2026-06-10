/**
 * CodeExecutionBlock Component
 *
 * Displays code with execution output including charts, tables, and console output.
 * Part of the Code Interpreter feature.
 *
 * FLOW-AI-CODE: Code execution display
 */

import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileCode,
  Image,
  Loader2,
  Play,
  RefreshCw,
  Table,
  Terminal,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// ==========================================
// TYPES
// ==========================================

export interface ExecutionOutput {
  type: 'text' | 'image' | 'table' | 'chart' | 'error' | 'html';
  data: any;
  mimeType?: string;
}

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  outputs: ExecutionOutput[];
  executionTime: number;
  error?: string;
}

interface CodeExecutionBlockProps {
  code: string;
  language: 'python' | 'javascript';
  result?: ExecutionResult;
  isExecuting?: boolean;
  onExecute?: () => void;
  onRerun?: () => void;
  onCopy?: (code: string) => void;
  title?: string;
  className?: string;
  isDark?: boolean;
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

const OutputRenderer: React.FC<{ output: ExecutionOutput }> = ({ output }) => {
  switch (output.type) {
    case 'text':
      return (
        <pre className="text-sm font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
          {output.data}
        </pre>
      );

    case 'error':
      return (
        <div className="flex items-start gap-2 text-rose-600 dark:text-rose-400">
          <XCircle size={16} className="flex-shrink-0 mt-0.5" />
          <pre className="text-sm font-mono whitespace-pre-wrap">{output.data}</pre>
        </div>
      );

    case 'image':
      return (
        <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-navy-700">
          <img
            src={
              output.data.startsWith('data:') ? output.data : `data:image/png;base64,${output.data}`
            }
            alt="Output visualization"
            className="max-w-full h-auto"
          />
        </div>
      );

    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 dark:bg-navy-800">
              <tr>
                {output.data.columns?.map((col: string, i: number) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
              {output.data.rows?.slice(0, 10).map((row: any[], rowIdx: number) => (
                <tr key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-3 py-2 text-slate-600 dark:text-slate-400">
                      {typeof cell === 'number' ? cell.toFixed(2) : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {output.data.rows?.length > 10 && (
            <p className="text-xs text-slate-600 px-3 py-2">
              Showing 10 of {output.data.rows.length} rows
            </p>
          )}
        </div>
      );

    case 'chart':
      return (
        <div className="flex items-center justify-center p-8 bg-slate-50 dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-navy-700">
          <div className="text-center text-slate-500">
            <BarChart2 size={32} className="mx-auto mb-2" />
            <p className="text-sm">Chart visualization</p>
            {output.data.message && <p className="text-xs mt-1">{output.data.message}</p>}
          </div>
        </div>
      );

    case 'html':
      return (
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: output.data }}
        />
      );

    default:
      return (
        <pre className="text-sm font-mono text-slate-600 dark:text-slate-400">
          {JSON.stringify(output.data, null, 2)}
        </pre>
      );
  }
};

const OutputIcon: React.FC<{ type: ExecutionOutput['type'] }> = ({ type }) => {
  const icons = {
    text: Terminal,
    error: AlertTriangle,
    image: Image,
    table: Table,
    chart: BarChart2,
    html: FileCode,
  };
  const Icon = icons[type] || Terminal;
  return <Icon size={14} />;
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const CodeExecutionBlock: React.FC<CodeExecutionBlockProps> = ({
  code,
  language,
  result,
  isExecuting = false,
  onExecute,
  onRerun,
  onCopy,
  title,
  className = '',
  isDark = false,
}) => {
  const { t } = useTranslation();
  const [isCodeExpanded, setIsCodeExpanded] = useState(true);
  const [isOutputExpanded, setIsOutputExpanded] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    onCopy?.(code);
  }, [code, onCopy]);

  const languageDisplay = {
    python: { name: 'Python', icon: '🐍' },
    javascript: { name: 'JavaScript', icon: '⚡' },
  };

  const hasOutput = result && (result.stdout || result.outputs.length > 0 || result.stderr);

  return (
    <div
      className={`rounded-xl overflow-hidden border border-slate-200 dark:border-navy-700 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">{languageDisplay[language].icon}</span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {title || languageDisplay[language].name}
          </span>
          {result && (
            <span
              className={`flex items-center gap-1 text-xs ${result.success ? 'text-green-600' : 'text-rose-600'}`}
            >
              {result.success ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {result.executionTime}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyCode}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-navy-700 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            title={t('code.copy', 'Copy code')}
          >
            {copiedCode ? (
              <CheckCircle2 size={14} className="text-green-500" />
            ) : (
              <Copy size={14} />
            )}
          </button>

          {(onExecute || onRerun) && (
            <button
              onClick={result ? onRerun : onExecute}
              disabled={isExecuting}
              className={`
                flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors
                ${
                  isExecuting
                    ? 'bg-slate-200 dark:bg-navy-700 text-slate-600 cursor-wait'
                    : 'bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400'
                }
              `}
            >
              {isExecuting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : result ? (
                <RefreshCw size={12} />
              ) : (
                <Play size={12} />
              )}
              {isExecuting
                ? t('code.running', 'Running...')
                : result
                  ? t('code.rerun', 'Rerun')
                  : t('code.run', 'Run')}
            </button>
          )}

          <button
            onClick={() => setIsCodeExpanded(!isCodeExpanded)}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-navy-700 rounded text-slate-500 transition-colors"
          >
            {isCodeExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Code */}
      {isCodeExpanded && (
        <div className="max-h-80 overflow-auto">
          <SyntaxHighlighter
            language={language}
            style={isDark ? atomOneDark : atomOneLight}
            customStyle={{
              margin: 0,
              padding: '1rem',
              fontSize: '0.8125rem',
              lineHeight: '1.5',
            }}
            showLineNumbers
          >
            {code}
          </SyntaxHighlighter>
        </div>
      )}

      {/* Output */}
      {hasOutput && (
        <div className="border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={() => setIsOutputExpanded(!isOutputExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-navy-850 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm">
              <Terminal size={14} className="text-slate-500" />
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {t('code.output', 'Output')}
              </span>
              {result && result.outputs.length > 0 && (
                <span className="text-xs text-slate-600">
                  ({result.outputs.length} {result.outputs.length === 1 ? 'item' : 'items'})
                </span>
              )}
            </div>
            {isOutputExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {isOutputExpanded && (
            <div className="px-4 py-3 space-y-3 bg-white dark:bg-navy-900">
              {result?.stdout && (
                <div className="p-3 bg-slate-50 dark:bg-navy-800 rounded-lg font-mono text-sm">
                  <pre className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                    {result.stdout}
                  </pre>
                </div>
              )}

              {result?.outputs.map((output, index) => (
                <div key={index} className="p-3 bg-slate-50 dark:bg-navy-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
                    <OutputIcon type={output.type} />
                    <span className="capitalize">{output.type}</span>
                  </div>
                  <OutputRenderer output={output} />
                </div>
              ))}

              {result?.stderr && (
                <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2 text-xs text-rose-600 dark:text-rose-400">
                    <AlertTriangle size={14} />
                    <span>{t('code.error', 'Error')}</span>
                  </div>
                  <pre className="text-sm font-mono text-rose-700 dark:text-rose-300 whitespace-pre-wrap">
                    {result.stderr}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isExecuting && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
            <Loader2 size={16} className="animate-spin" />
            <span>{t('code.executing', 'Executing code...')}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeExecutionBlock;
