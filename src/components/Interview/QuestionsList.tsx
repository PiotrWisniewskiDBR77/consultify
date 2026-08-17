/**
 * QuestionsList - Task-list style questions component
 *
 * ClickUp-like interface with:
 * - Inline edit for answers
 * - Status per question (Not started, In progress, Answered, Needs follow-up)
 * - Confidence score (1-5) per question
 * - Tags (risk, opportunity)
 * - Owner (who answered)
 */
import {
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronRight,
  Circle,
  Clock,
  Edit3,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Tag,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewMetaCard,
} from '@/components/shared/PreviewPane';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { LoadingState } from '@/components/ui/primitives';
import { sendMessageToAI } from '@/services/ai/gemini';
import { Api } from '@/services/api';
import { stripInternalTextSuffix } from '@/utils/stripInternalTextSuffix';

import TeresaMark from '../shared/TeresaMark';
import type { InterviewCategory } from './CategorySidebar';

// Types
export type QuestionStatus = 'not_started' | 'in_progress' | 'answered' | 'needs_follow_up';

export interface InterviewQuestion {
  id: string;
  sessionId: string;
  category: InterviewCategory;
  questionText: string;
  answerText: string;
  isRequired?: boolean;
  answerType?: string;
  answerOptions?: string[];
  expectedAnswerShape?: string;
  answerMode?: string;
  answerPayload?: Record<string, unknown> | null;
  contextNote?: string;
  notes?: string;
  description?: string;
  evidencePrompt?: string;
  voiceTranscript?: string;
  voiceTranscriptStatus?: 'none' | 'draft' | 'approved';
  voiceAudioEvidenceId?: string;
  allowVoice?: boolean;
  allowFileUpload?: boolean;
  allowUrl?: boolean;
  allowContextNote?: boolean;
  status: QuestionStatus;
  confidenceScore: number;
  answeredBy?: string;
  answeredAt?: string;
  /** Optimistic-concurrency token required by the governed answer writer. */
  updatedAt?: string;
  tags: string[];
  sortOrder: number;
  isTemplate: boolean;
}

export interface QuestionsListProps {
  questions: InterviewQuestion[];
  category: InterviewCategory | undefined;
  runtimeMode?: 'single_question' | 'task_list' | 'conversational';
  onUpdateQuestion: (
    questionId: string,
    updates: Partial<InterviewQuestion> & { aiSuggestionId?: string }
  ) => Promise<void>;
  onAddQuestion: (category: InterviewCategory, questionText: string) => Promise<void>;
  isLoading?: boolean;
  readOnly?: boolean;
}

// Status configuration
const STATUS_CONFIG: Record<
  QuestionStatus,
  {
    labelEn: string;
    labelPl: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    bgColor: string;
  }
> = {
  not_started: {
    labelEn: 'Not started',
    labelPl: 'Nie rozpoczęte',
    icon: Circle,
    color: 'text-c-text-secondary',
    bgColor: 'bg-c-surface-raised',
  },
  in_progress: {
    labelEn: 'In progress',
    labelPl: 'W trakcie',
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  answered: {
    labelEn: 'Answered',
    labelPl: 'Odpowiedziane',
    icon: CheckCircle,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  needs_follow_up: {
    labelEn: 'Needs follow-up',
    labelPl: 'Wymaga uzupełnienia',
    icon: RefreshCw,
    color: 'text-amber-500',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
};

// Tag configuration
const TAG_OPTIONS = [
  {
    value: 'risk',
    labelEn: 'Risk',
    labelPl: 'Ryzyko',
    color: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
  },
  {
    value: 'opportunity',
    labelEn: 'Opportunity',
    labelPl: 'Szansa',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  {
    value: 'constraint',
    labelEn: 'Constraint',
    labelPl: 'Ograniczenie',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  {
    value: 'priority',
    labelEn: 'Priority',
    labelPl: 'Priorytet',
    color: 'bg-c-info/10 text-c-info dark:bg-c-info/30 dark:text-c-info',
  },
];

export const QuestionsList: React.FC<QuestionsListProps> = ({
  questions,
  category,
  runtimeMode = 'task_list',
  onUpdateQuestion,
  onAddQuestion,
  isLoading = false,
  readOnly = false,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // Filter questions for current category
  const categoryQuestions = useMemo(
    () => (category ? questions.filter((q) => q.category === category) : []),
    [category, questions]
  );
  const answeredCount = categoryQuestions.filter((q) => q.status === 'answered').length;
  const totalCount = categoryQuestions.length;
  const missingCount = totalCount - answeredCount;
  const percent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  const nextMissing = categoryQuestions.find((q) => q.status !== 'answered');

  // Wszystkie pytania domyślnie zamknięte dla czytelności
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null);
  const [showTagMenu, setShowTagMenu] = useState<string | null>(null);
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [pendingAiSuggestionIds, setPendingAiSuggestionIds] = useState<Record<string, string>>({});

  // Chat → field insert (human-in-the-loop)
  const [chatQuestion, setChatQuestion] = useState<InterviewQuestion | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'ai'; content: string }>>(
    []
  );
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);

  const singleQuestion =
    (expandedId ? categoryQuestions.find((q) => q.id === expandedId) : undefined) ||
    nextMissing ||
    categoryQuestions[0];
  const visibleQuestions =
    runtimeMode === 'single_question'
      ? singleQuestion
        ? [singleQuestion]
        : []
      : categoryQuestions;
  const selectedQuestion = categoryQuestions.find((q) => q.id === expandedId) || null;

  useEffect(() => {
    if (runtimeMode === 'single_question' && singleQuestion && !expandedId) {
      setExpandedId(singleQuestion.id);
    }
  }, [runtimeMode, singleQuestion, expandedId]);

  useEffect(() => {
    if (expandedId && !categoryQuestions.some((q) => q.id === expandedId)) {
      setExpandedId(null);
    }
  }, [expandedId, categoryQuestions]);

  // Start editing answer
  const handleStartEdit = useCallback((question: InterviewQuestion) => {
    setEditingId(question.id);
    setEditValue(question.answerText || '');
    setEditNotes(question.notes || '');
    setExpandedId(question.id);
    setSaveError(null);
  }, []);

  // Save answer and move to next unanswered question
  const handleSaveAnswer = useCallback(
    async (questionId: string) => {
      if (!editValue.trim()) return;

      setSavingId(questionId);
      setSaveError(null);
      try {
        await onUpdateQuestion(questionId, {
          answerText: editValue.trim(),
          notes: editNotes.trim() || undefined,
          status: 'answered',
          ...(pendingAiSuggestionIds[questionId]
            ? { aiSuggestionId: pendingAiSuggestionIds[questionId] }
            : {}),
        });
        setPendingAiSuggestionIds((current) => {
          const next = { ...current };
          delete next[questionId];
          return next;
        });
        setEditingId(null);
        setEditValue('');
        setEditNotes('');

        // Find next unanswered question and expand it
        const currentIndex = categoryQuestions.findIndex((q) => q.id === questionId);
        const nextUnanswered = categoryQuestions
          .slice(currentIndex + 1)
          .find((q) => q.status !== 'answered');
        if (nextUnanswered) {
          setExpandedId(nextUnanswered.id);
        } else {
          setExpandedId(null);
        }
      } catch (error) {
        console.error('[QuestionsList] Failed to save answer:', error);
        setSaveError(t('interview.questionsList.failedToSavePleaseTry'));
      } finally {
        setSavingId(null);
      }
    },
    [editValue, editNotes, onUpdateQuestion, categoryQuestions, isPolish, pendingAiSuggestionIds]
  );

  // Cancel edit
  const handleCancelEdit = useCallback(async () => {
    const questionId = editingId;
    const suggestionId = questionId ? pendingAiSuggestionIds[questionId] : undefined;
    if (questionId && suggestionId) {
      try {
        await Api.post(
          `/interview/questions/${questionId}/ai-suggestions/${suggestionId}/reject`,
          {}
        );
      } catch (error) {
        console.error('[QuestionsList] Failed to reject AI suggestion:', error);
        setSaveError(t('interview.questionsList.failedToSavePleaseTry'));
        return;
      }
      setPendingAiSuggestionIds((current) => {
        const next = { ...current };
        delete next[questionId];
        return next;
      });
    }
    setEditingId(null);
    setEditValue('');
    setEditNotes('');
    setSaveError(null);
  }, [editingId, pendingAiSuggestionIds, t]);

  // Update status
  const handleStatusChange = useCallback(
    async (questionId: string, status: QuestionStatus) => {
      try {
        await onUpdateQuestion(questionId, { status });
      } catch (error) {
        console.error('[QuestionsList] Failed to update status:', error);
      } finally {
        setShowStatusMenu(null);
      }
    },
    [onUpdateQuestion]
  );

  // Update confidence
  const handleConfidenceChange = useCallback(
    async (questionId: string, score: number) => {
      try {
        await onUpdateQuestion(questionId, { confidenceScore: score });
      } catch (error) {
        console.error('[QuestionsList] Failed to update confidence:', error);
      }
    },
    [onUpdateQuestion]
  );

  // Toggle tag
  const handleToggleTag = useCallback(
    async (questionId: string, tag: string, currentTags: string[]) => {
      const newTags = currentTags.includes(tag)
        ? currentTags.filter((t) => t !== tag)
        : [...currentTags, tag];
      try {
        await onUpdateQuestion(questionId, { tags: newTags });
      } catch (error) {
        console.error('[QuestionsList] Failed to update tags:', error);
      }
    },
    [onUpdateQuestion]
  );

  // Add new question
  const handleAddQuestion = useCallback(async () => {
    if (!newQuestionText.trim()) return;
    if (!category) return;
    await onAddQuestion(category, newQuestionText.trim());
    setNewQuestionText('');
    setShowNewQuestion(false);
  }, [newQuestionText, category, onAddQuestion]);

  const handleAISuggest = useCallback(
    async (question: InterviewQuestion) => {
      if (readOnly) return;
      if (aiLoadingId) return;

      setAiLoadingId(question.id);
      try {
        const previousSuggestionId = pendingAiSuggestionIds[question.id];
        if (previousSuggestionId) {
          await Api.post(
            `/interview/questions/${question.id}/ai-suggestions/${previousSuggestionId}/reject`,
            {}
          );
        }
        const result = await Api.post(`/interview/questions/${question.id}/ai-suggest`, {});
        const answerText = (result as any)?.answerText;
        const suggestionId = (result as any)?.suggestionId;
        if (typeof answerText === 'string' && answerText.trim().length > 0) {
          // Ensure we're in edit mode and prefill the suggestion (human-in-the-loop)
          setEditingId(question.id);
          setExpandedId(question.id);
          setEditValue(answerText.trim());
          if (typeof suggestionId === 'string' && suggestionId) {
            setPendingAiSuggestionIds((current) => ({
              ...current,
              [question.id]: suggestionId,
            }));
          }
        }
      } catch (err) {
        // Silent fail (avoid UX noise); console for debugging
        console.error('[QuestionsList] AI suggest failed:', err);
      } finally {
        setAiLoadingId(null);
      }
    },
    [aiLoadingId, readOnly, pendingAiSuggestionIds]
  );

  const openChatForQuestion = useCallback(
    (question: InterviewQuestion) => {
      if (readOnly) return;
      setChatQuestion(question);
      const categoryLabel = category || 'General';
      const existingAnswer = question.answerText
        ? `\n\n${t('interview.questionsList.currentAnswer')} ${question.answerText}`
        : '';
      const existingNotes = question.notes
        ? `\n${t('interview.questionsList.notes')} ${question.notes}`
        : '';
      setChatMessages([
        {
          role: 'ai',
          content:
            t('interview.questionsList.aiAssistantForSectionIntro', { section: categoryLabel }) +
            `\n\n${t('interview.questionsList.question')} ${question.questionText}${existingAnswer}${existingNotes}`,
        },
      ]);
      setChatInput('');
    },
    [isPolish, readOnly, category]
  );

  const closeChat = useCallback(() => {
    setChatQuestion(null);
    setChatMessages([]);
    setChatInput('');
    setChatLoading(false);
    setApplyLoading(false);
  }, []);

  const handleChatSend = useCallback(async () => {
    if (!chatQuestion) return;
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const history = chatMessages.map((m) => ({
        role: m.role === 'ai' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.content }],
      }));

      const systemInstruction = `
You are a senior manufacturing transformation consultant helping complete an interview.
Category/Section: ${category || 'General'}
Question being discussed: ${chatQuestion.questionText}
Rules:
- Facts only. No recommendations or action plans.
- Ask clarifying questions if needed.
- Keep it concise and structured.
- Help the user formulate a clear, evidence-based answer.
- When the user provides enough context, suggest a draft answer they can insert.
`;

      const aiResponse = await sendMessageToAI(history, userMsg, systemInstruction);
      setChatMessages((prev) => [...prev, { role: 'ai', content: aiResponse }]);
    } catch (err) {
      console.error('[QuestionsList] Chat send failed:', err);
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: t('interview.questionsList.anErrorOccurredPleaseTry'),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [category, chatInput, chatLoading, chatMessages, chatQuestion, isPolish]);

  const handleApplyChatToQuestion = useCallback(async () => {
    if (!chatQuestion) return;
    if (applyLoading) return;

    setApplyLoading(true);
    try {
      const transcript = chatMessages
        .map((m) => `${m.role === 'ai' ? 'AI' : 'USER'}: ${m.content}`)
        .join('\n');

      const result = await Api.post(`/interview/sessions/${chatQuestion.sessionId}/ai-parse`, {
        text: transcript,
        questionIds: [chatQuestion.id],
      });

      const answers = (result as any)?.answers;
      const match = Array.isArray(answers)
        ? answers.find((a: any) => a?.questionId === chatQuestion.id)
        : null;

      if (match?.answerText && typeof match.answerText === 'string') {
        setEditingId(chatQuestion.id);
        setExpandedId(chatQuestion.id);
        setEditValue(match.answerText.trim());
      }
    } catch (err) {
      console.error('[QuestionsList] Apply chat to question failed:', err);
    } finally {
      setApplyLoading(false);
    }
  }, [applyLoading, chatMessages, chatQuestion]);

  // Render confidence selector
  const renderConfidenceSelector = (questionId: string, currentScore: number) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          onClick={() => !readOnly && handleConfidenceChange(questionId, score)}
          disabled={readOnly}
          className={`w-6 h-6 rounded text-xs font-medium transition-all ${
            currentScore >= score
              ? 'bg-amber-400 text-white'
              : 'bg-c-surface-raised text-c-text-muted'
          } ${readOnly ? 'cursor-default' : 'hover:scale-110'}`}
          title={`${t('interview.questionsList.confidence')}: ${score}/5`}
        >
          {score}
        </button>
      ))}
    </div>
  );

  // Render status dropdown
  const renderStatusMenu = (question: InterviewQuestion) => {
    if (showStatusMenu !== question.id) return null;

    return (
      <div className="absolute top-full left-0 mt-1 bg-c-surface rounded-lg shadow-lg border border-c-border py-1 z-20 min-w-[160px]">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={status}
              onClick={() => handleStatusChange(question.id, status as QuestionStatus)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-c-bg dark:hover:bg-c-surface-raised ${
                question.status === status ? 'bg-c-surface-raised' : ''
              }`}
            >
              <Icon size={14} className={config.color} />
              <span className="text-c-text-secondary">
                {t(`interview.questionsList.statusLabel.${status}`, config.labelEn)}
              </span>
              {question.status === status && (
                <Check size={14} className="ml-auto text-emerald-500" />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // Render tag menu
  const renderTagMenu = (question: InterviewQuestion) => {
    if (showTagMenu !== question.id) return null;

    return (
      <div className="absolute top-full right-0 mt-1 bg-c-surface rounded-lg shadow-lg border border-c-border py-1 z-20 min-w-[140px]">
        {TAG_OPTIONS.map((tag) => (
          <button
            key={tag.value}
            onClick={() => handleToggleTag(question.id, tag.value, question.tags)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-c-bg dark:hover:bg-c-surface-raised`}
          >
            <span className={`px-2 py-0.5 rounded text-xs ${tag.color}`}>
              {t(`interview.questionsList.tagLabel.${tag.value}`, tag.labelEn)}
            </span>
            {question.tags.includes(tag.value) && (
              <Check size={14} className="ml-auto text-emerald-500" />
            )}
          </button>
        ))}
      </div>
    );
  };

  // Jeśli nie ma kategorii, nie renderuj nic
  if (!category) {
    return null;
  }

  if (isLoading) {
    return <LoadingState variant="spinner" className="h-48 py-0" />;
  }

  return (
    <div className="space-y-3">
      {/* Category progress (quiet) */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs text-c-text-muted mb-1">
            <span>{t('interview.questionsList.progressInThisSection')}</span>
            <span className="tabular-nums">
              {answeredCount}/{totalCount} · {percent}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-c-surface-raised/70 dark:bg-c-surface-raised/70 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => nextMissing && setExpandedId(nextMissing.id)}
          disabled={!nextMissing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-c-border/60 bg-white/60 dark:bg-c-surface/40 text-c-text-secondary hover:bg-c-bg/80 dark:hover:bg-c-surface-raised/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            nextMissing
              ? t('interview.questionsList.openNextMissingQuestionIn')
              : t('interview.questionsList.allQuestionsAnswered')
          }
        >
          <ChevronRight size={14} />
          {t('interview.questionsList.nextMissing')}
          {missingCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-c-surface-raised/80 dark:bg-c-surface-raised/80 text-c-text-muted">
              {missingCount}
            </span>
          )}
        </button>
      </div>

      {/* Gentle "start here" hint when nothing expanded */}
      {!expandedId && nextMissing && (
        <button
          onClick={() => setExpandedId(nextMissing.id)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sparkles size={14} />
            {t('interview.questionsList.startWithTheNextMissing')}
          </span>
          <ChevronRight size={16} />
        </button>
      )}

      {categoryQuestions.length > 0 && (
        <div className="min-h-[360px]">
          <TableWithPreviewLayout<InterviewQuestion & { title: string }>
            selectedId={selectedQuestion?.id || null}
            selectedItem={
              selectedQuestion
                ? { ...selectedQuestion, title: selectedQuestion.questionText }
                : null
            }
            onSelect={(id) => setExpandedId(id)}
            itemIds={visibleQuestions.map((q) => q.id)}
            getItemById={(id) => {
              const q = visibleQuestions.find((x) => x.id === id);
              return q ? { ...q, title: q.questionText } : null;
            }}
            renderPreview={(item) => {
              const statusConfig = STATUS_CONFIG[item.status];
              const StatusIcon = statusConfig.icon;
              const isEditing = editingId === item.id;

              const metaPills: MetaPill[] = [
                {
                  label: t(
                    `interview.questionsList.statusLabel.${item.status}`,
                    statusConfig.labelEn
                  ),
                  className: `${statusConfig.bgColor} ${statusConfig.color}`,
                  icon: StatusIcon,
                },
                {
                  label: `${item.confidenceScore || 0}/5`,
                  className:
                    'border border-c-border/70 dark:border-white/[0.08] text-c-text-secondary',
                  icon: Star,
                },
                ...item.tags.map((tag) => {
                  const tagConfig = TAG_OPTIONS.find((tg) => tg.value === tag);
                  return {
                    label: tagConfig
                      ? t(`interview.questionsList.tagLabel.${tag}`, tagConfig.labelEn)
                      : tag,
                    className: tagConfig?.color || 'bg-c-surface-raised text-c-text-secondary',
                  };
                }),
              ];

              return (
                <div className="space-y-4">
                  <PreviewMetaCard pills={metaPills}>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        {!readOnly && (
                          <div className="relative">
                            <button
                              onClick={() =>
                                !readOnly &&
                                setShowStatusMenu(showStatusMenu === item.id ? null : item.id)
                              }
                              className="text-xs text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted transition-colors"
                            >
                              {t('interview.questionsList.changeStatus')}
                            </button>
                            {renderStatusMenu(item)}
                          </div>
                        )}
                        {!readOnly && (
                          <div className="relative">
                            <button
                              onClick={() =>
                                setShowTagMenu(showTagMenu === item.id ? null : item.id)
                              }
                              className="inline-flex items-center gap-1.5 text-xs text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted transition-colors"
                            >
                              <Tag size={12} />
                              {t('interview.questionsList.tags')}
                            </button>
                            {renderTagMenu(item)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-c-text-muted">
                          {t('interview.questionsList.confidenceLevel')}
                        </span>
                        {renderConfidenceSelector(item.id, item.confidenceScore)}
                      </div>
                    </div>
                  </PreviewMetaCard>

                  {/* Guidance: hint + evidence prompt */}
                  {(item.description || item.evidencePrompt) && (
                    <div className="space-y-2">
                      {item.description && (
                        <div className="rounded-lg border-l-4 border-l-amber-500 border border-amber-300/50 dark:border-amber-500/10 bg-amber-100 dark:bg-amber-500/[0.06] px-3 py-2">
                          <div className="flex items-start gap-2">
                            <HelpCircle
                              size={13}
                              className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400"
                            />
                            <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      )}
                      {item.evidencePrompt && (
                        <div className="rounded-lg bg-sky-50/70 dark:bg-sky-500/[0.06] border border-sky-200/50 dark:border-sky-500/10 px-3 py-2">
                          <div className="flex items-start gap-2">
                            <Paperclip
                              size={12}
                              className="mt-0.5 shrink-0 text-sky-500 dark:text-sky-400"
                            />
                            <p className="text-xs text-sky-800/80 dark:text-sky-200/80 leading-relaxed">
                              {item.evidencePrompt}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-c-text-muted">
                        {t('interview.questionsList.answer')}
                      </span>
                      {!readOnly && !isEditing && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAISuggest(item)}
                            disabled={aiLoadingId === item.id}
                            className="flex items-center gap-1 text-xs text-c-info hover:text-c-info disabled:opacity-50"
                          >
                            <Sparkles size={12} />
                            {aiLoadingId === item.id ? 'AI...' : 'AI'}
                          </button>
                          <button
                            onClick={() => openChatForQuestion(item)}
                            className="flex items-center gap-1 text-xs text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted"
                          >
                            <MessageSquare size={12} />
                            {t('interview.questionsList.chat')}
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full p-3 text-sm border border-c-border rounded-xl bg-c-bg text-c-text dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[140px]"
                          rows={6}
                          placeholder={t('interview.questionsList.typeYourAnswer')}
                          autoFocus
                        />

                        <div>
                          <label className="block text-xs font-medium text-c-text-muted mb-1">
                            {t('interview.questionsList.notesOptional')}
                          </label>
                          <textarea
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="w-full p-3 text-sm border border-c-border rounded-xl bg-c-bg text-c-text dark:text-white focus:outline-none focus:ring-2 focus:ring-c-focus resize-none min-h-[72px]"
                            rows={3}
                            placeholder={t('interview.questionsList.additionalNotesContext')}
                          />
                        </div>

                        {saveError && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 text-danger-600 dark:text-danger-400 text-xs">
                            <AlertTriangle size={14} />
                            {saveError}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-c-text-secondary">
                          <Sparkles size={12} />
                          <span>{t('interview.questionsList.useAiOrChatTo')}</span>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`p-4 rounded-xl text-sm transition-all ${
                          item.answerText
                            ? 'bg-c-bg text-c-text dark:text-white border border-c-border'
                            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-700 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30'
                        }`}
                        onClick={() => !readOnly && !item.answerText && handleStartEdit(item)}
                      >
                        {item.answerText ? (
                          <div>
                            <div className="whitespace-pre-wrap">{item.answerText}</div>
                            {item.notes && (
                              <div className="mt-3 pt-3 border-t border-c-border/50">
                                <span className="text-xs font-medium text-c-text-secondary">
                                  {t('interview.questionsList.notes2')}
                                </span>
                                <p className="text-xs text-c-text-muted mt-1 whitespace-pre-wrap">
                                  {item.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 py-6">
                            <Plus size={16} />
                            <span className="font-medium">
                              {t('interview.questionsList.clickToAddAnAnswer')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {item.answeredBy && item.answeredAt && (
                    <div className="flex items-center gap-2 text-xs text-c-text-secondary">
                      <User size={12} />
                      <span>{item.answeredBy}</span>
                      <span>•</span>
                      <span>{new Date(item.answeredAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              );
            }}
            renderPreviewFooter={(item) => {
              const isEditing = editingId === item.id;

              if (readOnly) {
                return (
                  <div className="text-xs text-c-text-muted">
                    {item.answerText
                      ? t('interview.questionsList.answerSaved')
                      : t('interview.questionsList.noAnswerYet')}
                  </div>
                );
              }

              if (isEditing) {
                const editRows: ActionRow[] = [
                  {
                    buttons: [
                      {
                        label: t('interview.questionsList.cancel'),
                        onClick: handleCancelEdit,
                        colorScheme: 'neutral',
                        shortcut: 'Esc',
                      },
                      {
                        label: t('interview.questionsList.save'),
                        icon: savingId === item.id ? RefreshCw : Check,
                        onClick: () => handleSaveAnswer(item.id),
                        colorScheme: 'primary',
                        disabled: savingId === item.id,
                        shortcut: '⌘S',
                      },
                    ],
                  },
                ];
                return <PreviewActionBar rows={editRows} />;
              }

              const defaultRows: ActionRow[] = [
                {
                  buttons: [
                    {
                      label: item.answerText
                        ? t('interview.questionsList.editAnswer')
                        : t('interview.questionsList.addAnswer'),
                      icon: Edit3,
                      onClick: () => handleStartEdit(item),
                      colorScheme: 'neutral',
                      shortcut: 'E',
                    },
                    {
                      label: t('interview.questionsList.aiChat'),
                      icon: MessageSquare,
                      onClick: () => openChatForQuestion(item),
                      colorScheme: 'neutral',
                      shortcut: 'C',
                    },
                    {
                      label: t('interview.questionsList.draftWithAi'),
                      icon: Sparkles,
                      onClick: () => handleAISuggest(item),
                      colorScheme: 'purple',
                      disabled: aiLoadingId === item.id,
                      shortcut: 'A',
                    },
                  ],
                },
              ];
              return <PreviewActionBar rows={defaultRows} />;
            }}
          >
            <div className="rounded-xl border border-c-border/60 bg-white/60 dark:bg-c-surface/35 overflow-hidden">
              <div className="overflow-x-auto">
                {/* §27-exempt: deeply embedded in TableWithPreviewLayout; row selection
                    drives the preview pane, and cells contain rich interactive elements
                    (inline status dropdown, star confidence selector, tag menu, AI actions)
                    that are coupled to local state. Cannot migrate to FilterableTable
                    without re-architecting the entire QuestionsListpreview flow. */}
                <table className="w-full min-w-[760px] table-fixed">
                  <thead>
                    <tr className="border-b border-c-border/60 bg-c-bg/80 dark:bg-c-bg/50">
                      <th className="w-[84px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                        {t('interview.questionsList.status')}
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                        {t('interview.questionsList.question2')}
                      </th>
                      <th className="w-[104px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                        {t('interview.questionsList.confidence')}
                      </th>
                      <th className="w-[160px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                        {t('interview.questionsList.tags')}
                      </th>
                      <th className="w-[220px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                        {t('interview.questionsList.answer')}
                      </th>
                      <th className="w-[124px] px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                        {t('interview.questionsList.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleQuestions.map((question) => {
                      const statusConfig = STATUS_CONFIG[question.status];
                      const StatusIcon = statusConfig.icon;
                      const isSelected = expandedId === question.id;

                      return (
                        <tr
                          key={question.id}
                          onClick={() => setExpandedId(question.id)}
                          onDoubleClick={() => !readOnly && handleStartEdit(question)}
                          className={`border-b border-c-border/50 last:border-0 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-c-info/10 dark:bg-c-info/10'
                              : 'hover:bg-c-bg/80 dark:hover:bg-c-surface-raised/40'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!readOnly) {
                                    setShowStatusMenu(
                                      showStatusMenu === question.id ? null : question.id
                                    );
                                  }
                                }}
                                disabled={readOnly}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusConfig.bgColor} ${readOnly ? 'cursor-default' : 'hover:opacity-80'}`}
                                title={t(
                                  `interview.questionsList.statusLabel.${question.status}`,
                                  statusConfig.labelEn
                                )}
                              >
                                <StatusIcon size={16} className={statusConfig.color} />
                              </button>
                              {renderStatusMenu(question)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-c-text dark:text-white truncate">
                                {stripInternalTextSuffix(question.questionText)}
                              </div>
                              <div className="mt-1 text-xs text-c-text-muted truncate">
                                {question.answerText
                                  ? t('interview.questionsList.clickToReviewOrEdit')
                                  : t('interview.questionsList.noAnswerYet2')}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((score) => (
                                <Star
                                  key={score}
                                  size={12}
                                  className={
                                    question.confidenceScore >= score
                                      ? 'text-amber-400 fill-amber-400'
                                      : 'text-c-text-secondary'
                                  }
                                />
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {question.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {question.tags.slice(0, 2).map((tag) => {
                                  const tagConfig = TAG_OPTIONS.find((tg) => tg.value === tag);
                                  return tagConfig ? (
                                    <span
                                      key={tag}
                                      className={`px-1.5 py-0.5 rounded text-[11px] ${tagConfig.color}`}
                                    >
                                      {t(
                                        `interview.questionsList.tagLabel.${tag}`,
                                        tagConfig.labelEn
                                      )}
                                    </span>
                                  ) : null;
                                })}
                                {question.tags.length > 2 && (
                                  <span className="text-[11px] text-c-text-secondary">
                                    +{question.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-c-text-secondary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-c-text-muted line-clamp-2">
                              {question.answerText || t('interview.questionsList.noAnswerYet2')}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {!readOnly && (
                                <button
                                  onClick={() => openChatForQuestion(question)}
                                  className="p-1.5 rounded hover:bg-c-info/10 dark:hover:bg-c-info/30 transition-colors"
                                  title={t('interview.questionsList.aiChatForThisQuestion')}
                                >
                                  <Sparkles size={14} className="text-c-info" />
                                </button>
                              )}
                              <div className="relative">
                                <button
                                  onClick={() =>
                                    !readOnly &&
                                    setShowTagMenu(showTagMenu === question.id ? null : question.id)
                                  }
                                  disabled={readOnly}
                                  className="p-1.5 rounded hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
                                  title={t('interview.questionsList.tags')}
                                >
                                  <Tag size={14} className="text-c-text-secondary" />
                                </button>
                                {renderTagMenu(question)}
                              </div>
                              <button
                                onClick={() => setExpandedId(question.id)}
                                className="p-1.5 rounded hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
                                title={t('interview.questionsList.showDetails')}
                              >
                                <ChevronRight
                                  size={16}
                                  className={`text-c-text-secondary transition-transform ${
                                    isSelected ? 'rotate-90' : ''
                                  }`}
                                />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TableWithPreviewLayout>
        </div>
      )}

      {/* Empty State */}
      {categoryQuestions.length === 0 && !showNewQuestion && (
        <div className="flex flex-col items-center justify-center py-8 text-center bg-c-bg/50 dark:bg-c-bg/50 rounded-xl border-2 border-dashed border-c-border">
          <div className="w-14 h-14 rounded-full bg-c-surface-raised flex items-center justify-center mb-4">
            <MessageSquare className="w-7 h-7 text-c-text-secondary" />
          </div>
          <p className="text-sm font-medium text-c-text-secondary mb-1">
            {t('interview.questionsList.noQuestionsInThisCategory')}
          </p>
          <p className="text-xs text-c-text-secondary mb-4 max-w-xs">
            {t('interview.questionsList.questionsWillAppearAfterAssigning')}
          </p>
          {!readOnly && (
            <button
              onClick={() => setShowNewQuestion(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors"
            >
              <Plus size={16} />
              {t('interview.questionsList.addQuestion')}
            </button>
          )}
        </div>
      )}

      {/* Add New Question */}
      {!readOnly && (
        <div className="mt-3">
          {showNewQuestion ? (
            <div className="bg-c-surface rounded-lg border border-blue-300 dark:border-blue-500/50 p-3 space-y-2">
              <input
                type="text"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                className="w-full p-2 text-sm border border-c-border rounded-lg bg-c-bg text-c-text dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('interview.questionsList.enterQuestionText')}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddQuestion();
                  if (e.key === 'Escape') setShowNewQuestion(false);
                }}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowNewQuestion(false);
                    setNewQuestionText('');
                  }}
                  className="px-3 py-1.5 text-sm text-c-text-secondary hover:text-c-text-secondary"
                >
                  {t('interview.questionsList.cancel')}
                </button>
                <button
                  onClick={handleAddQuestion}
                  disabled={!newQuestionText.trim()}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-c-surface-raised text-white rounded-lg"
                >
                  {t('interview.questionsList.add')}
                </button>
              </div>
            </div>
          ) : (
            categoryQuestions.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNewQuestion(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-c-text-muted hover:text-blue-600 hover:bg-c-bg dark:hover:bg-c-surface-raised rounded-lg border border-dashed border-c-border"
                >
                  <Plus size={16} />
                  {t('interview.questionsList.addQuestion')}
                </button>
                {/* E5.1: AI proposes next questions */}
                <button
                  onClick={async () => {
                    if (!category) return;
                    const categoryLabel = typeof category === 'string' ? category : category;
                    const existingQs = categoryQuestions.map((q) => q.questionText).join('\n- ');
                    const prompt = t('interview.questionsList.proposeNewQuestionsPrompt', {
                      category: categoryLabel,
                      existing: existingQs,
                    });
                    try {
                      const response = await sendMessageToAI([], prompt);
                      if (response) {
                        setChatQuestion(categoryQuestions[0] || null);
                        setChatMessages([{ role: 'ai' as const, content: response }]);
                      }
                    } catch {
                      // fallback: open chat with prompt
                      setChatQuestion(categoryQuestions[0] || null);
                      setChatMessages([{ role: 'user' as const, content: prompt }]);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-c-info dark:text-c-info hover:bg-c-info/10 dark:hover:bg-c-info/20 rounded-lg border border-dashed border-c-info dark:border-c-info transition-colors"
                  title={t('interview.questionsList.aiWillProposeNextQuestions')}
                >
                  <Lightbulb size={14} />
                  {t('interview.questionsList.proposeQuestions')}
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* Chat Modal (minimal, no layout changes outside overlay) */}
      {chatQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-c-surface w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-c-border flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="p-4 bg-c-surface flex justify-between items-center text-c-text border-b border-c-border">
              <div className="flex items-center gap-2">
                <TeresaMark size={18} />
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {t('interview.questionsList.chatForQuestion')}
                  </div>
                  <div className="text-xs text-c-text-secondary truncate">
                    {stripInternalTextSuffix(chatQuestion.questionText)}
                  </div>
                </div>
              </div>
              <button
                onClick={closeChat}
                className="p-1 rounded hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-c-bg">
              {chatMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      m.role === 'user' ? 'bg-c-surface-raised' : 'bg-c-surface'
                    }`}
                  >
                    {m.role === 'user' ? (
                      <User size={12} className="text-c-text-secondary" />
                    ) : (
                      <TeresaMark size={12} className="text-white" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                      m.role === 'user'
                        ? 'bg-white border border-c-border text-c-text-secondary'
                        : 'bg-c-info/10 dark:bg-c-info/20 text-c-text-secondary'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-c-surface flex items-center justify-center shrink-0">
                    <TeresaMark size={12} className="text-white" />
                  </div>
                  <div className="px-3 py-2 bg-c-info/10 dark:bg-c-info/20 rounded-lg text-sm text-c-text-secondary">
                    {t('interview.questionsList.typing')}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-c-surface border-t border-c-border space-y-3">
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-c-bg border border-transparent focus:border-c-focus rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-c-focus transition-all dark:text-white text-sm"
                  placeholder={t('interview.questionsList.typeYourResponse')}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                  disabled={chatLoading}
                />
                <button
                  onClick={handleChatSend}
                  disabled={!chatInput.trim() || chatLoading}
                  className="bg-c-text hover:bg-c-text-secondary disabled:bg-c-surface-raised text-c-bg p-3 rounded-xl transition-colors"
                  title={t('interview.questionsList.send')}
                >
                  <Send size={18} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={closeChat}
                  className="text-sm text-c-text-muted hover:text-c-text-muted"
                >
                  {t('interview.questionsList.close')}
                </button>
                <button
                  onClick={handleApplyChatToQuestion}
                  disabled={applyLoading || chatMessages.length < 2}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-c-surface-raised text-white rounded-lg text-sm font-medium transition-colors"
                  title={t('interview.questionsList.insertDraftIntoFieldHuman')}
                >
                  {applyLoading
                    ? t('interview.questionsList.applying')
                    : t('interview.questionsList.insertToQuestion')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionsList;
