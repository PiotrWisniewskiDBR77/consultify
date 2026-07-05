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
  tags: string[];
  sortOrder: number;
  isTemplate: boolean;
}

export interface QuestionsListProps {
  questions: InterviewQuestion[];
  category: InterviewCategory | undefined;
  runtimeMode?: 'single_question' | 'task_list' | 'conversational';
  onUpdateQuestion: (questionId: string, updates: Partial<InterviewQuestion>) => Promise<void>;
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
    color: 'text-slate-600',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
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
    color: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
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
  const { i18n } = useTranslation();
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
        setSaveError(
          isPolish
            ? 'Nie udało się zapisać. Spróbuj ponownie.'
            : 'Failed to save. Please try again.'
        );
      } finally {
        setSavingId(null);
      }
    },
    [editValue, editNotes, onUpdateQuestion, categoryQuestions, isPolish]
  );

  // Cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditValue('');
    setEditNotes('');
    setSaveError(null);
  }, []);

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
        const result = await Api.post(`/interview/questions/${question.id}/ai-suggest`, {});
        const answerText = (result as any)?.answerText;
        if (typeof answerText === 'string' && answerText.trim().length > 0) {
          // Ensure we're in edit mode and prefill the suggestion (human-in-the-loop)
          setEditingId(question.id);
          setExpandedId(question.id);
          setEditValue(answerText.trim());
        }
      } catch (err) {
        // Silent fail (avoid UX noise); console for debugging
        console.error('[QuestionsList] AI suggest failed:', err);
      } finally {
        setAiLoadingId(null);
      }
    },
    [aiLoadingId, readOnly]
  );

  const openChatForQuestion = useCallback(
    (question: InterviewQuestion) => {
      if (readOnly) return;
      setChatQuestion(question);
      const categoryLabel = category || 'General';
      const existingAnswer = question.answerText
        ? `\n\n${isPolish ? 'Dotychczasowa odpowiedź:' : 'Current answer:'} ${question.answerText}`
        : '';
      const existingNotes = question.notes
        ? `\n${isPolish ? 'Notatki:' : 'Notes:'} ${question.notes}`
        : '';
      setChatMessages([
        {
          role: 'ai',
          content:
            (isPolish
              ? `Jestem asystentem AI dla sekcji "${categoryLabel}". Opisz krótko kontekst i fakty. Ja pomogę ułożyć odpowiedź i potem możesz ją wstawić do pytania.`
              : `I'm the AI assistant for the "${categoryLabel}" section. Describe the context and facts briefly. I will help draft the answer, and you can insert it into the question.`) +
            `\n\n${isPolish ? 'Pytanie:' : 'Question:'} ${question.questionText}${existingAnswer}${existingNotes}`,
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
          content: isPolish
            ? 'Wystąpił błąd. Spróbuj ponownie.'
            : 'An error occurred. Please try again.',
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
              : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
          } ${readOnly ? 'cursor-default' : 'hover:scale-110'}`}
          title={`${isPolish ? 'Pewność' : 'Confidence'}: ${score}/5`}
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
      <div className="absolute top-full left-0 mt-1 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1 z-20 min-w-[160px]">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={status}
              onClick={() => handleStatusChange(question.id, status as QuestionStatus)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-800 ${
                question.status === status ? 'bg-slate-50 dark:bg-navy-800' : ''
              }`}
            >
              <Icon size={14} className={config.color} />
              <span className="text-slate-700 dark:text-slate-300">
                {isPolish ? config.labelPl : config.labelEn}
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
      <div className="absolute top-full right-0 mt-1 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1 z-20 min-w-[140px]">
        {TAG_OPTIONS.map((tag) => (
          <button
            key={tag.value}
            onClick={() => handleToggleTag(question.id, tag.value, question.tags)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-800`}
          >
            <span className={`px-2 py-0.5 rounded text-xs ${tag.color}`}>
              {isPolish ? tag.labelPl : tag.labelEn}
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
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>{isPolish ? 'Postęp w tej sekcji' : 'Progress in this section'}</span>
            <span className="tabular-nums">
              {answeredCount}/{totalCount} · {percent}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200/70 dark:bg-navy-800/70 overflow-hidden">
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
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200/60 dark:border-navy-700/60 bg-white/60 dark:bg-navy-900/40 text-slate-700 dark:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            nextMissing
              ? isPolish
                ? 'Otwórz następne brakujące pytanie w tej sekcji'
                : 'Open next missing question in this section'
              : isPolish
                ? 'Wszystkie pytania uzupełnione'
                : 'All questions answered'
          }
        >
          <ChevronRight size={14} />
          {isPolish ? 'Następne brakujące' : 'Next missing'}
          {missingCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-slate-200/80 dark:bg-navy-700/80 text-slate-500 dark:text-slate-400">
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
            {isPolish
              ? 'Zacznij od następnego brakującego pytania'
              : 'Start with the next missing question'}
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
                  label: isPolish ? statusConfig.labelPl : statusConfig.labelEn,
                  className: `${statusConfig.bgColor} ${statusConfig.color}`,
                  icon: StatusIcon,
                },
                {
                  label: `${item.confidenceScore || 0}/5`,
                  className:
                    'border border-slate-200/70 dark:border-white/[0.08] text-slate-600 dark:text-slate-300',
                  icon: Star,
                },
                ...item.tags.map((tag) => {
                  const tagConfig = TAG_OPTIONS.find((t) => t.value === tag);
                  return {
                    label: tagConfig ? (isPolish ? tagConfig.labelPl : tagConfig.labelEn) : tag,
                    className: tagConfig?.color || 'bg-slate-100 text-slate-600',
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
                              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                              {isPolish ? 'Zmień status' : 'Change status'}
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
                              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                              <Tag size={12} />
                              {isPolish ? 'Tagi' : 'Tags'}
                            </button>
                            {renderTagMenu(item)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {isPolish ? 'Poziom pewności' : 'Confidence level'}
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
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Odpowiedź' : 'Answer'}
                      </span>
                      {!readOnly && !isEditing && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAISuggest(item)}
                            disabled={aiLoadingId === item.id}
                            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-500 disabled:opacity-50"
                          >
                            <Sparkles size={12} />
                            {aiLoadingId === item.id ? 'AI...' : 'AI'}
                          </button>
                          <button
                            onClick={() => openChatForQuestion(item)}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            <MessageSquare size={12} />
                            {isPolish ? 'Czat' : 'Chat'}
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full p-3 text-sm border border-slate-200 dark:border-navy-700 rounded-xl bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[140px]"
                          rows={6}
                          placeholder={isPolish ? 'Wpisz odpowiedź...' : 'Type your answer...'}
                          autoFocus
                        />

                        <div>
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {isPolish ? 'Notatki (opcjonalne)' : 'Notes (optional)'}
                          </label>
                          <textarea
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="w-full p-3 text-sm border border-slate-200 dark:border-navy-700 rounded-xl bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none min-h-[72px]"
                            rows={3}
                            placeholder={
                              isPolish
                                ? 'Dodatkowe notatki, kontekst...'
                                : 'Additional notes, context...'
                            }
                          />
                        </div>

                        {saveError && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 text-danger-600 dark:text-danger-400 text-xs">
                            <AlertTriangle size={14} />
                            {saveError}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Sparkles size={12} />
                          <span>
                            {isPolish
                              ? 'Użyj AI lub czatu, aby szybciej dopracować odpowiedź.'
                              : 'Use AI or chat to refine the answer faster.'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`p-4 rounded-xl text-sm transition-all ${
                          item.answerText
                            ? 'bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white border border-slate-200 dark:border-navy-700'
                            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-700 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30'
                        }`}
                        onClick={() => !readOnly && !item.answerText && handleStartEdit(item)}
                      >
                        {item.answerText ? (
                          <div>
                            <div className="whitespace-pre-wrap">{item.answerText}</div>
                            {item.notes && (
                              <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-navy-700/50">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-500">
                                  {isPolish ? 'Notatki' : 'Notes'}
                                </span>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">
                                  {item.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 py-6">
                            <Plus size={16} />
                            <span className="font-medium">
                              {isPolish ? 'Kliknij, aby dodać odpowiedź' : 'Click to add an answer'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {item.answeredBy && item.answeredAt && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-500">
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
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {item.answerText
                      ? isPolish
                        ? 'Odpowiedź zapisana.'
                        : 'Answer saved.'
                      : isPolish
                        ? 'Brak odpowiedzi.'
                        : 'No answer yet.'}
                  </div>
                );
              }

              if (isEditing) {
                const editRows: ActionRow[] = [
                  {
                    buttons: [
                      {
                        label: isPolish ? 'Anuluj' : 'Cancel',
                        onClick: handleCancelEdit,
                        colorScheme: 'neutral',
                        shortcut: 'Esc',
                      },
                      {
                        label: isPolish ? 'Zapisz' : 'Save',
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
                        ? isPolish
                          ? 'Edytuj odpowiedź'
                          : 'Edit answer'
                        : isPolish
                          ? 'Dodaj odpowiedź'
                          : 'Add answer',
                      icon: Edit3,
                      onClick: () => handleStartEdit(item),
                      colorScheme: 'neutral',
                      shortcut: 'E',
                    },
                    {
                      label: isPolish ? 'Czat AI' : 'AI chat',
                      icon: MessageSquare,
                      onClick: () => openChatForQuestion(item),
                      colorScheme: 'neutral',
                      shortcut: 'C',
                    },
                    {
                      label: isPolish ? 'Wstępna propozycja AI' : 'Draft with AI',
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
            <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/50 bg-white/60 dark:bg-navy-900/35 overflow-hidden">
              <div className="overflow-x-auto">
                {/* §27-exempt: deeply embedded in TableWithPreviewLayout; row selection
                    drives the preview pane, and cells contain rich interactive elements
                    (inline status dropdown, star confidence selector, tag menu, AI actions)
                    that are coupled to local state. Cannot migrate to FilterableTable
                    without re-architecting the entire QuestionsListpreview flow. */}
                <table className="w-full min-w-[760px] table-fixed">
                  <thead>
                    <tr className="border-b border-slate-200/60 dark:border-navy-700/50 bg-slate-50/80 dark:bg-navy-950/50">
                      <th className="w-[84px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Status' : 'Status'}
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Pytanie' : 'Question'}
                      </th>
                      <th className="w-[104px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Pewność' : 'Confidence'}
                      </th>
                      <th className="w-[160px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Tagi' : 'Tags'}
                      </th>
                      <th className="w-[220px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Odpowiedź' : 'Answer'}
                      </th>
                      <th className="w-[124px] px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Akcje' : 'Actions'}
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
                          className={`border-b border-slate-200/50 dark:border-navy-700/50 last:border-0 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary-50 dark:bg-primary-500/10'
                              : 'hover:bg-slate-50/80 dark:hover:bg-navy-800/40'
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
                                title={isPolish ? statusConfig.labelPl : statusConfig.labelEn}
                              >
                                <StatusIcon size={16} className={statusConfig.color} />
                              </button>
                              {renderStatusMenu(question)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-navy-900 dark:text-white truncate">
                                {question.questionText}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                                {question.answerText
                                  ? isPolish
                                    ? 'Kliknij, aby podejrzeć lub edytować odpowiedź'
                                    : 'Click to review or edit the answer'
                                  : isPolish
                                    ? 'Brak odpowiedzi'
                                    : 'No answer yet'}
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
                                      : 'text-slate-600 dark:text-slate-400'
                                  }
                                />
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {question.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {question.tags.slice(0, 2).map((tag) => {
                                  const tagConfig = TAG_OPTIONS.find((t) => t.value === tag);
                                  return tagConfig ? (
                                    <span
                                      key={tag}
                                      className={`px-1.5 py-0.5 rounded text-[11px] ${tagConfig.color}`}
                                    >
                                      {isPolish ? tagConfig.labelPl : tagConfig.labelEn}
                                    </span>
                                  ) : null;
                                })}
                                {question.tags.length > 2 && (
                                  <span className="text-[11px] text-slate-600">
                                    +{question.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-600 dark:text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                              {question.answerText ||
                                (isPolish ? 'Brak odpowiedzi' : 'No answer yet')}
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
                                  className="p-1.5 rounded hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                                  title={
                                    isPolish
                                      ? 'Czat AI do tego pytania'
                                      : 'AI chat for this question'
                                  }
                                >
                                  <Sparkles size={14} className="text-primary-400" />
                                </button>
                              )}
                              <div className="relative">
                                <button
                                  onClick={() =>
                                    !readOnly &&
                                    setShowTagMenu(showTagMenu === question.id ? null : question.id)
                                  }
                                  disabled={readOnly}
                                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
                                  title={isPolish ? 'Tagi' : 'Tags'}
                                >
                                  <Tag size={14} className="text-slate-600" />
                                </button>
                                {renderTagMenu(question)}
                              </div>
                              <button
                                onClick={() => setExpandedId(question.id)}
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
                                title={isPolish ? 'Pokaż szczegóły' : 'Show details'}
                              >
                                <ChevronRight
                                  size={16}
                                  className={`text-slate-600 transition-transform ${
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
        <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50/50 dark:bg-navy-950/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-navy-700">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center mb-4">
            <MessageSquare className="w-7 h-7 text-slate-600 dark:text-slate-500" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
            {isPolish ? 'Brak pytań w tej kategorii' : 'No questions in this category'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-500 mb-4 max-w-xs">
            {isPolish
              ? "Pytania pojawią się po przypisaniu template'u lub możesz dodać własne pytania"
              : 'Questions will appear after assigning a template, or you can add custom questions'}
          </p>
          {!readOnly && (
            <button
              onClick={() => setShowNewQuestion(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors"
            >
              <Plus size={16} />
              {isPolish ? 'Dodaj pytanie' : 'Add question'}
            </button>
          )}
        </div>
      )}

      {/* Add New Question */}
      {!readOnly && (
        <div className="mt-3">
          {showNewQuestion ? (
            <div className="bg-white dark:bg-navy-900 rounded-lg border border-blue-300 dark:border-blue-500/50 p-3 space-y-2">
              <input
                type="text"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                className="w-full p-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={isPolish ? 'Wpisz treść pytania...' : 'Enter question text...'}
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
                  className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400"
                >
                  {isPolish ? 'Anuluj' : 'Cancel'}
                </button>
                <button
                  onClick={handleAddQuestion}
                  disabled={!newQuestionText.trim()}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-lg"
                >
                  {isPolish ? 'Dodaj' : 'Add'}
                </button>
              </div>
            </div>
          ) : (
            categoryQuestions.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNewQuestion(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-slate-500 hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-navy-800 rounded-lg border border-dashed border-slate-200 dark:border-navy-700"
                >
                  <Plus size={16} />
                  {isPolish ? 'Dodaj pytanie' : 'Add question'}
                </button>
                {/* E5.1: AI proposes next questions */}
                <button
                  onClick={async () => {
                    if (!category) return;
                    const categoryLabel = typeof category === 'string' ? category : category;
                    const existingQs = categoryQuestions.map((q) => q.questionText).join('\n- ');
                    const prompt = isPolish
                      ? `Na podstawie istniejących pytań w kategorii "${categoryLabel}":\n- ${existingQs}\n\nZaproponuj 3 nowe, uzupełniające pytania do wywiadu, które pomogą uzyskać pełniejszy obraz.`
                      : `Based on existing questions in category "${categoryLabel}":\n- ${existingQs}\n\nPropose 3 new, complementary interview questions that will help get a fuller picture.`;
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
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg border border-dashed border-primary-300 dark:border-primary-700 transition-colors"
                  title={
                    isPolish ? 'AI zaproponuje kolejne pytania' : 'AI will propose next questions'
                  }
                >
                  <Lightbulb size={14} />
                  {isPolish ? 'Zaproponuj pytania' : 'Propose questions'}
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* Chat Modal (minimal, no layout changes outside overlay) */}
      {chatQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-navy-900 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-navy-700 flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="p-4 bg-white dark:bg-navy-900 flex justify-between items-center text-slate-900 dark:text-white border-b border-slate-200 dark:border-navy-700">
              <div className="flex items-center gap-2">
                <TeresaMark size={18} />
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {isPolish ? 'Czat do pytania' : 'Chat for question'}
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 truncate">
                    {chatQuestion.questionText}
                  </div>
                </div>
              </div>
              <button
                onClick={closeChat}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-navy-950">
              {chatMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      m.role === 'user' ? 'bg-slate-200 dark:bg-slate-700' : 'bg-navy-900'
                    }`}
                  >
                    {m.role === 'user' ? (
                      <User size={12} className="text-slate-600 dark:text-slate-300" />
                    ) : (
                      <TeresaMark size={12} className="text-white" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                      m.role === 'user'
                        ? 'bg-white border border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-200'
                        : 'bg-primary-50 dark:bg-primary-900/20 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-navy-900 flex items-center justify-center shrink-0">
                    <TeresaMark size={12} className="text-white" />
                  </div>
                  <div className="px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-sm text-slate-600">
                    {isPolish ? 'Piszę...' : 'Typing...'}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white dark:bg-navy-900 border-t border-slate-200 dark:border-navy-700 space-y-3">
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-slate-100 dark:bg-navy-950 border border-transparent focus:border-primary-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500/30 transition-all dark:text-white text-sm"
                  placeholder={isPolish ? 'Wpisz odpowiedź...' : 'Type your response...'}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                  disabled={chatLoading}
                />
                <button
                  onClick={handleChatSend}
                  disabled={!chatInput.trim() || chatLoading}
                  className="bg-c-text hover:bg-c-text-secondary disabled:bg-slate-300 text-c-bg p-3 rounded-xl transition-colors"
                  title={isPolish ? 'Wyślij' : 'Send'}
                >
                  <Send size={18} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={closeChat} className="text-sm text-slate-500 hover:text-slate-300">
                  {isPolish ? 'Zamknij' : 'Close'}
                </button>
                <button
                  onClick={handleApplyChatToQuestion}
                  disabled={applyLoading || chatMessages.length < 2}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                  title={
                    isPolish
                      ? 'Wstaw propozycję do pola (human-in-the-loop)'
                      : 'Insert draft into field (human-in-the-loop)'
                  }
                >
                  {applyLoading
                    ? isPolish
                      ? 'Wstawiam...'
                      : 'Applying...'
                    : isPolish
                      ? 'Wstaw do pytania'
                      : 'Insert to question'}
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
