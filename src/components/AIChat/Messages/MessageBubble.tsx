/**
 * MessageBubble - Enhanced chat message component with actions
 * Renders user and AI messages with hover actions, artifacts, and thinking blocks
 */

import { Bot, ChevronDown, ChevronUp, FileCode, Sparkles, User } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Artifact, ChatMessage, MessageFeedback } from '../../../types';
import { CitationList } from '../CitationList';
import { MessageActions } from './MessageActions';
import { ThinkingBlock } from './ThinkingBlock';

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
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);

  const isUser = message.role === 'user';
  const isAI = message.role === 'ai';
  const hasArtifacts = message.artifacts && message.artifacts.length > 0;
  const hasThinkingSteps = message.thinkingSteps && message.thinkingSteps.length > 0;
  const hasCitations = message.citations && message.citations.length > 0;

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar */}
      <div
        className={`
        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
        ${isUser ? 'bg-brand/10 text-brand' : 'bg-gradient-to-br from-brand to-brand-dark text-white'}
      `}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
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
              ? 'bg-brand text-white rounded-tr-sm'
              : 'bg-slate-100 dark:bg-navy-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
          }
          ${isStreaming ? 'animate-pulse' : ''}
        `}
        >
          {/* Header for AI messages */}
          {isAI && (
            <div className="flex items-center gap-2 mb-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-brand dark:text-brand-light flex items-center gap-1">
                <Sparkles size={12} />
                {t('chat.aiAssistant', 'AI Assistant')}
              </span>
              {message.focusMode && (
                <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-navy-700 rounded text-xs">
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
            ${isUser ? 'text-white' : 'prose prose-sm dark:prose-invert max-w-none'}
          `}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Custom code rendering
                  code: ({ className: codeClassName, children, ...props }: any) => {
                    const isInline = !props.node?.properties?.className?.includes('language-');
                    if (isInline) {
                      return (
                        <code className="px-1 py-0.5 bg-slate-200 dark:bg-navy-700 rounded text-brand dark:text-brand-light text-xs font-mono">
                          {children}
                        </code>
                      );
                    }
                    return (
                      <pre className="bg-slate-900 dark:bg-navy-950 text-slate-100 p-3 rounded-lg overflow-x-auto text-xs my-2">
                        <code className={codeClassName}>{children}</code>
                      </pre>
                    );
                  },
                  // Custom link rendering
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:text-brand-dark underline"
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
              className="flex items-center gap-1 mt-2 text-xs text-brand hover:text-brand-dark transition-colors"
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

          {/* Streaming indicator */}
          {isStreaming && isAI && (
            <span className="inline-flex items-center gap-1 mt-2">
              <span
                className="w-2 h-2 bg-brand rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="w-2 h-2 bg-brand rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-2 h-2 bg-brand rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
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
          flex items-center gap-2 mt-1 text-xs text-slate-400 dark:text-slate-500
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
          ${isHovered || isStreaming ? 'opacity-100' : 'opacity-0'}
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
