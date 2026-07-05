/**
 * MessageBubble - Enhanced chat message component with actions
 * Renders user and AI messages with hover actions, artifacts, and thinking blocks
 */
import { Check, ChevronDown, ChevronUp, Copy, FileCode, Sparkles, User } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import remarkGfm from 'remark-gfm';

import { Artifact, ChatMessage, MessageFeedback } from '../../../types';
import { isRtlLanguage, textDirection } from '../../../utils/textDirection';
import TeresaMark from '../../shared/TeresaMark';
import { CitationList } from '../CitationList';
import { MessageActions } from './MessageActions';
import { ThinkingBlock } from './ThinkingBlock';

const MarkdownCodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const lang = (language || '').trim() || 'text';
  const trimmed = code.replace(/\n$/, '');
  const isDark =
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [trimmed]);

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-slate-200 dark:border-navy-800 bg-slate-900 dark:bg-navy-950">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 dark:bg-navy-900 border-b border-slate-700 dark:border-navy-800">
        <span className="text-[11px] font-mono text-slate-600/80 uppercase">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-slate-600/80 hover:text-slate-100 hover:bg-white/10 transition-colors"
          title={t('code.copy', 'Copy')}
        >
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          {copied ? t('code.copied', 'Copied!') : t('code.copy', 'Copy')}
        </button>
      </div>
      <SyntaxHighlighter
        language={lang === 'text' ? undefined : lang}
        style={isDark ? atomOneDark : atomOneLight}
        customStyle={{ margin: 0, padding: '0.75rem', fontSize: '0.75rem', lineHeight: '1.5' }}
        showLineNumbers={false}
        wrapLongLines={false}
      >
        {trimmed}
      </SyntaxHighlighter>
    </div>
  );
};

interface MessageBubbleProps {
  message: ChatMessage;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: MessageFeedback) => void;
  onViewArtifacts?: (artifacts: Artifact[]) => void;
  onSpeak?: (content: string) => void;
  isStreaming?: boolean;
  showThinkingSteps?: boolean;
  className?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onEdit,
  onDelete,
  onRegenerate,
  onCopy,
  onFeedback,
  onViewArtifacts,
  onSpeak,
  isStreaming = false,
  showThinkingSteps = true,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const [showFullContent, setShowFullContent] = useState(false);
  const isRtlChatLanguage = isRtlLanguage(i18n.language);

  const isUser = message.role === 'user';
  const isAI = message.role === 'ai';
  const hasArtifacts = message.artifacts && message.artifacts.length > 0;
  const hasThinkingSteps = message.thinkingSteps && message.thinkingSteps.length > 0;
  const hasCitations = message.citations && message.citations.length > 0;
  const attachments = useMemo(() => {
    const raw = (message as any)?.metadata?.attachments;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((a: any) => ({
        docId: a?.docId ? String(a.docId) : '',
        filename: a?.filename ? String(a.filename) : '',
      }))
      .filter((a: any) => a.docId || a.filename);
  }, [message]);

  // Truncate long messages
  const MAX_PREVIEW_LENGTH = 2000;
  const isLongMessage = message.content.length > MAX_PREVIEW_LENGTH;
  const displayContent =
    isLongMessage && !showFullContent
      ? message.content.slice(0, MAX_PREVIEW_LENGTH) + '...'
      : message.content;

  // Extract regeneration count badge
  const regenerateBadge = useMemo(() => {
    if (message.regenerateCount && message.regenerateCount > 0) {
      return (
        <span className="ml-2 px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-navy-700 text-slate-500 dark:text-slate-400 rounded">
          {t('chat.regenerated', 'Regenerated')} {message.regenerateCount}x
        </span>
      );
    }
    return null;
  }, [message.regenerateCount, t]);

  // Handle view artifacts
  const handleViewArtifacts = () => {
    if (onViewArtifacts && message.artifacts) {
      onViewArtifacts(message.artifacts);
    }
  };

  return (
    <div
      className={`
        group relative flex gap-3 px-4 py-3 
        ${isUser ? 'flex-row-reverse' : 'flex-row'}
        ${className}
      `}
    >
      {/* Avatar */}
      <div
        className={`
        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
        ${isUser ? 'bg-c-surface-raised border border-c-border text-c-text-secondary' : 'bg-c-surface-raised border border-c-border text-c-text-secondary'}
      `}
      >
        {isUser ? <User size={16} /> : <TeresaMark size={16} />}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Thinking Steps (for AI messages) */}
        {isAI && hasThinkingSteps && showThinkingSteps && (
          <ThinkingBlock
            steps={message.thinkingSteps!}
            isStreaming={isStreaming && message.isThinking}
          />
        )}

        {/* Message Bubble */}
        <div
          className={`
          relative rounded-xl px-4 py-3
          ${
            isUser
              ? 'bg-c-surface-raised border border-c-border text-c-text rounded-tr-sm'
              : 'bg-c-surface-raised border border-c-border text-c-text rounded-tl-sm'
          }
          ${isStreaming ? 'animate-pulse' : ''}
        `}
        >
          {/* Header for AI messages */}
          {isAI && (
            <div className="flex items-center gap-2 mb-2 text-xs text-c-text-muted">
              <span className="font-medium text-c-text-secondary flex items-center gap-1">
                <Sparkles size={12} />
                {t('chat.aiAssistant', 'AI Assistant')}
              </span>
              {message.focusMode && (
                <span className="px-1.5 py-0.5 bg-c-surface border border-c-border rounded text-xs">
                  {message.focusMode}
                </span>
              )}
              {regenerateBadge}
            </div>
          )}

          {/* Content */}
          <div
            className={`
            text-sm leading-relaxed
            ${isUser ? 'text-c-text' : 'prose prose-sm dark:prose-invert max-w-none'}
            ${isRtlChatLanguage ? 'text-right' : 'text-left'}
          `}
            dir={textDirection(i18n.language)}
          >
            {attachments.length > 0 && (
              <div
                className={`mb-2 flex flex-wrap gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {attachments.slice(0, 8).map((a: any, idx: number) => (
                  <span
                    key={`${a.docId || a.filename}-${idx}`}
                    title={a.docId ? `doc: ${a.docId}` : a.filename}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-c-surface border border-c-border text-c-text-secondary`}
                  >
                    <FileCode size={12} className="text-c-text-muted" />
                    <span className="max-w-[240px] truncate">{a.filename || 'Attachment'}</span>
                  </span>
                ))}
              </div>
            )}
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Custom code rendering
                  code: ({ inline, className: codeClassName, children }: any) => {
                    const isInline = !!inline;
                    if (isInline) {
                      return (
                        <code className="px-1 py-0.5 bg-c-surface-raised border border-c-border rounded text-c-text text-xs font-mono">
                          {children}
                        </code>
                      );
                    }
                    const match = /language-([\w-]+)/.exec(codeClassName || '');
                    const lang = match?.[1] || 'text';
                    const code = String(children ?? '');
                    return <MarkdownCodeBlock code={code} language={lang} />;
                  },
                  // Custom link rendering
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-c-accent hover:opacity-80 underline underline-offset-2"
                    >
                      {children}
                    </a>
                  ),
                  // Custom list rendering
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
                  ),
                }}
              >
                {displayContent}
              </ReactMarkdown>
            )}
          </div>

          {/* Show more/less for long messages */}
          {isLongMessage && !isUser && (
            <button
              onClick={() => setShowFullContent(!showFullContent)}
              className="flex items-center gap-1 mt-2 text-xs text-c-accent hover:opacity-80 transition-opacity"
            >
              {showFullContent ? (
                <>
                  <ChevronUp size={14} />
                  {t('chat.showLess', 'Show less')}
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  {t('chat.showMore', 'Show more')}
                </>
              )}
            </button>
          )}

          {/* Streaming indicator — inline cursor */}
          {isStreaming && isAI && (
            <span className="inline-flex items-center gap-0.5 ml-1 align-baseline">
              <span className="w-[3px] h-4 bg-current opacity-70 rounded-sm animate-pulse" />
            </span>
          )}
        </div>

        {/* Artifacts badge */}
        {hasArtifacts && (
          <button
            onClick={handleViewArtifacts}
            className="flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-brand/10 hover:bg-brand/20 text-brand rounded-lg text-xs font-medium transition-colors"
          >
            <FileCode size={14} />
            {message.artifacts!.length}{' '}
            {message.artifacts!.length === 1
              ? t('chat.artifact', 'artifact')
              : t('chat.artifacts', 'artifacts')}
          </button>
        )}

        {/* Citations */}
        {hasCitations && (
          <div className="mt-2">
            <CitationList citations={message.citations!} />
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`
          flex items-center gap-2 mt-1 text-xs text-slate-600 dark:text-slate-500
          ${isUser ? 'justify-end' : 'justify-start'}
        `}
        >
          <span>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {/* Actions - shown on hover */}
        <div
          className={`
          absolute top-2 transition-opacity duration-200
          ${isUser ? 'left-0' : 'right-0'}
          opacity-100 md:opacity-0 md:group-hover:opacity-100
        `}
        >
          {!isStreaming && (
            <div className="bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 p-1">
              <MessageActions
                message={message}
                onEdit={onEdit}
                onDelete={onDelete}
                onRegenerate={onRegenerate}
                onCopy={onCopy}
                onFeedback={onFeedback}
                onViewArtifacts={hasArtifacts ? () => handleViewArtifacts() : undefined}
                onSpeak={onSpeak}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
