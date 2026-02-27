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
  Bot,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Edit3,
  Lightbulb,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { sendMessageToAI } from '@/services/ai/gemini';
import { Api } from '@/services/api';

import type { InterviewCategory } from './CategorySidebar';

// Types
export type QuestionStatus = 'not_started' | 'in_progress' | 'answered' | 'needs_follow_up';

export interface InterviewQuestion {
  id: string;
  sessionId: string;
  category: InterviewCategory;
  questionText: string;
  answerText: string;
  notes?: string; // E2.1: per-question notes field
  status: QuestionStatus;
  confidenceScore: number; // 1-5
  answeredBy?: string;
  answeredAt?: string;
  tags: string[];
  sortOrder: number;
  isTemplate: boolean;
}

export interface QuestionsListProps {
  questions: InterviewQuestion[];
  category: InterviewCategory | undefined;
  runtimeMode?: 'single_question' | 'task_list';
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
    color: 'text-slate-400',
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
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
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
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
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
  const categoryQuestions = category ? questions.filter((q) => q.category === category) : [];
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

  // Save notes only (without changing status)
  const handleSaveNotesOnly = useCallback(
    async (questionId: string) => {
      setSavingId(questionId);
      setSaveError(null);
      try {
        await onUpdateQuestion(questionId, {
          notes: editNotes.trim() || undefined,
        });
      } catch (error) {
        console.error('[QuestionsList] Failed to save notes:', error);
        setSaveError(isPolish ? 'Nie udało się zapisać notatki.' : 'Failed to save notes.');
      } finally {
        setSavingId(null);
      }
    },
    [editNotes, onUpdateQuestion, isPolish]
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
  }, [chatInput, chatLoading, chatMessages, chatQuestion, isPolish]);

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
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full" />
      </div>
    );
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

      {/* Questions List */}
      {visibleQuestions.map((question) => {
        const statusConfig = STATUS_CONFIG[question.status];
        const StatusIcon = statusConfig.icon;
        const isExpanded = expandedId === question.id;
        const isEditing = editingId === question.id;

        return (
          <div
            key={question.id}
            className={`rounded-xl border transition-colors ${
              isExpanded
                ? 'border-primary-500/30 bg-white/70 dark:bg-navy-900/55'
                : 'border-slate-200/60 dark:border-navy-700/50 bg-white/55 dark:bg-navy-900/35'
            }`}
          >
            {/* Question Header */}
            <div className="flex items-start gap-3 p-3">
              {/* Status Button */}
              <div className="relative">
                <button
                  onClick={() =>
                    !readOnly &&
                    setShowStatusMenu(showStatusMenu === question.id ? null : question.id)
                  }
                  disabled={readOnly}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusConfig.bgColor} ${readOnly ? 'cursor-default' : 'hover:opacity-80'}`}
                  title={isPolish ? statusConfig.labelPl : statusConfig.labelEn}
                >
                  <StatusIcon size={16} className={statusConfig.color} />
                </button>
                {renderStatusMenu(question)}
              </div>

              {/* Question Content */}
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : question.id)}
                  className="w-full text-left"
                >
                  <p className="text-sm font-medium text-navy-900 dark:text-white">
                    {question.questionText}
                  </p>
                </button>

                {/* Tags */}
                {question.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {question.tags.map((tag) => {
                      const tagConfig = TAG_OPTIONS.find((t) => t.value === tag);
                      return tagConfig ? (
                        <span
                          key={tag}
                          className={`px-1.5 py-0.5 rounded text-xs ${tagConfig.color}`}
                        >
                          {isPolish ? tagConfig.labelPl : tagConfig.labelEn}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Answer Preview (collapsed) */}
                {!isExpanded && question.answerText && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                    {question.answerText}
                  </p>
                )}
              </div>

              {/* Right side: Confidence + Chat + Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Confidence */}
                <div className="hidden sm:flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <Star
                      key={score}
                      size={12}
                      className={
                        question.confidenceScore >= score
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }
                    />
                  ))}
                </div>

                {/* E2.4: Chat-assist button (visible in header for quick access) */}
                {!readOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openChatForQuestion(question);
                    }}
                    className="p-1.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group"
                    title={isPolish ? 'Czat AI do tego pytania' : 'AI Chat for this question'}
                  >
                    <Sparkles size={14} className="text-purple-400 group-hover:text-purple-500" />
                  </button>
                )}

                {/* Tag Button */}
                <div className="relative">
                  <button
                    onClick={() =>
                      !readOnly && setShowTagMenu(showTagMenu === question.id ? null : question.id)
                    }
                    disabled={readOnly}
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
                    title={isPolish ? 'Tagi' : 'Tags'}
                  >
                    <Tag size={14} className="text-slate-400" />
                  </button>
                  {renderTagMenu(question)}
                </div>

                {/* Expand/Collapse */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : question.id)}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
                >
                  <ChevronRight
                    size={16}
                    className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </button>
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="px-3 pb-3 border-t border-slate-100 dark:border-navy-800 pt-3">
                {/* Confidence Selector */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Poziom pewności:' : 'Confidence level:'}
                  </span>
                  {renderConfidenceSelector(question.id, question.confidenceScore)}
                </div>

                {/* Answer Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {isPolish ? 'Odpowiedź:' : 'Answer:'}
                    </span>
                    {!readOnly && (
                      <div className="flex items-center gap-2">
                        {/* AI assist (human-in-the-loop) */}
                        <button
                          onClick={() => handleAISuggest(question)}
                          disabled={aiLoadingId === question.id}
                          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-500 disabled:opacity-50"
                          title={
                            isPolish
                              ? 'Pomóż AI (wstępna propozycja)'
                              : 'AI assist (draft suggestion)'
                          }
                        >
                          <Sparkles size={12} />
                          {aiLoadingId === question.id
                            ? isPolish
                              ? 'AI...'
                              : 'AI...'
                            : isPolish
                              ? 'AI'
                              : 'AI'}
                        </button>

                        {/* Chat → field insert */}
                        <button
                          onClick={() => openChatForQuestion(question)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
                          title={isPolish ? 'Czat → wstaw do pola' : 'Chat → insert into field'}
                        >
                          <MessageSquare size={12} />
                          {isPolish ? 'Czat' : 'Chat'}
                        </button>

                        {!isEditing && (
                          <button
                            onClick={() => handleStartEdit(question)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                          >
                            <Edit3 size={12} />
                            {isPolish ? 'Edytuj' : 'Edit'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      {/* Answer textarea */}
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full p-3 text-sm border border-slate-200 dark:border-navy-700 rounded-xl bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[120px]"
                        rows={5}
                        placeholder={isPolish ? 'Wpisz odpowiedź...' : 'Type your answer...'}
                        autoFocus
                      />

                      {/* Notes textarea (E2.1) */}
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                          {isPolish ? 'Notatki (opcjonalne):' : 'Notes (optional):'}
                        </label>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="w-full p-3 text-sm border border-slate-200 dark:border-navy-700 rounded-xl bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none min-h-[60px]"
                          rows={2}
                          placeholder={
                            isPolish
                              ? 'Dodatkowe notatki, kontekst...'
                              : 'Additional notes, context...'
                          }
                        />
                      </div>

                      {/* Save error message */}
                      {saveError && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs">
                          <AlertTriangle size={14} />
                          {saveError}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Sparkles size={12} />
                          <span>
                            {isPolish
                              ? 'Tip: Użyj AI lub Czat aby pomóc sformułować odpowiedź'
                              : 'Tip: Use AI or Chat to help draft your answer'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                          >
                            {isPolish ? 'Anuluj' : 'Cancel'}
                          </button>
                          <button
                            onClick={() => handleSaveAnswer(question.id)}
                            disabled={savingId === question.id}
                            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 disabled:cursor-wait text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                          >
                            {savingId === question.id ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <Check size={14} />
                            )}
                            {isPolish ? 'Zapisz' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`p-4 rounded-xl text-sm transition-all ${
                        question.answerText
                          ? 'bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white border border-slate-200 dark:border-navy-700'
                          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-2 border-dashed border-blue-300 dark:border-blue-700 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30'
                      }`}
                      onClick={() => !readOnly && !question.answerText && handleStartEdit(question)}
                    >
                      {question.answerText ? (
                        <div>
                          <div className="whitespace-pre-wrap">{question.answerText}</div>
                          {/* Show notes if present */}
                          {question.notes && (
                            <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-navy-700/50">
                              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                                {isPolish ? 'Notatki:' : 'Notes:'}
                              </span>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 whitespace-pre-wrap">
                                {question.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 py-4">
                          <Plus size={16} />
                          <span className="font-medium">
                            {isPolish
                              ? 'Kliknij, aby dodać odpowiedź...'
                              : 'Click to add your answer...'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Answered By */}
                {question.answeredBy && question.answeredAt && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 dark:text-slate-500">
                    <User size={12} />
                    <span>{question.answeredBy}</span>
                    <span>•</span>
                    <span>{new Date(question.answeredAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Empty State */}
      {categoryQuestions.length === 0 && !showNewQuestion && (
        <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50/50 dark:bg-navy-950/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-navy-700">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center mb-4">
            <MessageSquare className="w-7 h-7 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
            {isPolish ? 'Brak pytań w tej kategorii' : 'No questions in this category'}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 max-w-xs">
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
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg border border-dashed border-purple-300 dark:border-purple-700 transition-colors"
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
                <Bot size={18} />
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
                      m.role === 'user' ? 'bg-slate-200 dark:bg-slate-700' : 'bg-purple-500'
                    }`}
                  >
                    {m.role === 'user' ? (
                      <User size={12} className="text-slate-600 dark:text-slate-300" />
                    ) : (
                      <Bot size={12} className="text-white" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                      m.role === 'user'
                        ? 'bg-white border border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-200'
                        : 'bg-purple-50 dark:bg-purple-900/20 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
                    <Bot size={12} className="text-white" />
                  </div>
                  <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-sm text-slate-400">
                    {isPolish ? 'Piszę...' : 'Typing...'}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white dark:bg-navy-900 border-t border-slate-200 dark:border-navy-700 space-y-3">
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-slate-100 dark:bg-navy-950 border border-transparent focus:border-purple-500 rounded-xl px-4 py-3 outline-none transition-all dark:text-white text-sm"
                  placeholder={isPolish ? 'Wpisz odpowiedź...' : 'Type your response...'}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                  disabled={chatLoading}
                />
                <button
                  onClick={handleChatSend}
                  disabled={!chatInput.trim() || chatLoading}
                  className="bg-purple-500 hover:bg-purple-600 disabled:bg-slate-300 text-white p-3 rounded-xl transition-colors"
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
