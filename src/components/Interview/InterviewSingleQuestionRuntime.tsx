import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  FileText,
  HelpCircle,
  Link2,
  Loader2,
  LogOut,
  Mic,
  Paperclip,
  PauseCircle,
  Sparkles,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { API_URL, getHeaders } from '@/services/api';

import { CATEGORY_CONFIG, CATEGORY_ORDER, type InterviewCategory } from './CategorySidebar';
import type { InterviewEvidence } from './EvidencePanel';
import type { InterviewQuestion } from './QuestionsList';

interface InterviewSingleQuestionRuntimeProps {
  questions: InterviewQuestion[];
  evidence: InterviewEvidence[];
  activeCategory: InterviewCategory;
  onCategoryChange: (category: InterviewCategory) => void;
  onUpdateQuestion: (questionId: string, updates: Partial<InterviewQuestion>) => Promise<void>;
  onUploadFile: (
    file: File,
    category?: InterviewCategory,
    questionId?: string
  ) => Promise<InterviewEvidence | void>;
  onAddLink: (
    name: string,
    url: string,
    description?: string,
    category?: InterviewCategory,
    questionId?: string
  ) => Promise<InterviewEvidence | void>;
  onAddVoiceEvidence: (
    file: File,
    transcriptText: string,
    category?: InterviewCategory,
    questionId?: string
  ) => Promise<InterviewEvidence | void>;
  onSubmitSession: () => Promise<void>;
  onSaveAndExit?: () => void;
  sessionName?: string;
  readOnly?: boolean;
}

type DraftInputMode = 'text_answer' | 'voice_answer';
type RuntimeView = 'answering' | 'review';

const QUESTION_INPUT_TYPES = {
  longText: new Set(['open', 'text', 'textarea', 'long_text']),
  shortText: new Set(['short_text', 'short-answer', 'short_answer']),
  number: new Set(['number', 'numeric', 'currency']),
  singleChoice: new Set(['single_choice', 'single-select', 'select', 'choice']),
  multiChoice: new Set(['multi_choice', 'multi-select', 'multi_select', 'checkbox', 'checkboxes']),
  yesNo: new Set(['yes_no', 'boolean', 'bool']),
  rating: new Set(['rating', 'scale', 'score']),
  dropdown: new Set(['dropdown', 'select_dropdown']),
  date: new Set(['date', 'date_picker']),
};

function normalizeAnswerType(answerType?: string): string {
  return String(answerType || 'open')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function buildDefaultOptions(question: InterviewQuestion, isPolish: boolean): string[] {
  const normalized = normalizeAnswerType(question.answerType);
  if (Array.isArray(question.answerOptions) && question.answerOptions.length > 0) {
    return question.answerOptions;
  }
  if (QUESTION_INPUT_TYPES.yesNo.has(normalized)) {
    return isPolish ? ['Tak', 'Nie'] : ['Yes', 'No'];
  }
  if (QUESTION_INPUT_TYPES.rating.has(normalized)) {
    return ['1', '2', '3', '4', '5'];
  }
  return [];
}

function parseMultiChoiceValue(answerDraft: string): Set<string> {
  try {
    const parsed = JSON.parse(answerDraft);
    if (Array.isArray(parsed)) return new Set(parsed);
  } catch { /* not JSON */ }
  if (!answerDraft) return new Set();
  return new Set(answerDraft.split('|||'));
}

function serializeMultiChoice(selected: Set<string>): string {
  return JSON.stringify([...selected]);
}

export const InterviewSingleQuestionRuntime: React.FC<InterviewSingleQuestionRuntimeProps> = ({
  questions,
  evidence,
  activeCategory,
  onCategoryChange,
  onUpdateQuestion,
  onUploadFile,
  onAddLink,
  onAddVoiceEvidence,
  onSubmitSession,
  onSaveAndExit,
  sessionName,
  readOnly = false,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const orderedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => {
      const categoryDiff =
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
      if (categoryDiff !== 0) return categoryDiff;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }, [questions]);

  const categoryQuestions = useMemo(
    () => orderedQuestions.filter((question) => question.category === activeCategory),
    [activeCategory, orderedQuestions]
  );

  const categorySummary = useMemo(() => {
    const map = new Map<InterviewCategory, { total: number; answered: number }>();
    for (const cat of CATEGORY_ORDER) {
      const catQ = orderedQuestions.filter((q) => q.category === cat);
      if (catQ.length > 0) {
        map.set(cat, {
          total: catQ.length,
          answered: catQ.filter((q) => q.status === 'answered').length,
        });
      }
    }
    return map;
  }, [orderedQuestions]);

  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [contextDraft, setContextDraft] = useState('');
  const [inputMode, setInputMode] = useState<DraftInputMode>('text_answer');
  const [voiceTranscriptDraft, setVoiceTranscriptDraft] = useState('');
  const [isPersisting, setIsPersisting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [runtimeView, setRuntimeView] = useState<RuntimeView>('answering');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mainContentRef = useRef<HTMLDivElement | null>(null);

  const currentQuestion = useMemo(
    () => orderedQuestions.find((question) => question.id === currentQuestionId) || null,
    [currentQuestionId, orderedQuestions]
  );

  const currentIndex = currentQuestion
    ? orderedQuestions.findIndex((question) => question.id === currentQuestion.id)
    : -1;
  const previousQuestion = currentIndex > 0 ? orderedQuestions[currentIndex - 1] : null;
  const nextQuestion =
    currentIndex >= 0 && currentIndex < orderedQuestions.length - 1
      ? orderedQuestions[currentIndex + 1]
      : null;

  useEffect(() => {
    if (!categoryQuestions.length) {
      setCurrentQuestionId(null);
      return;
    }

    const stillVisible = categoryQuestions.some((question) => question.id === currentQuestionId);
    if (stillVisible) return;

    const preferred =
      categoryQuestions.find((question) => question.status !== 'answered') || categoryQuestions[0];
    setCurrentQuestionId(preferred?.id || null);
  }, [categoryQuestions, currentQuestionId]);

  useEffect(() => {
    if (!currentQuestion) {
      setAnswerDraft('');
      setContextDraft('');
      setVoiceTranscriptDraft('');
      setInputMode('text_answer');
      return;
    }

    setAnswerDraft(currentQuestion.answerText || '');
    setContextDraft(currentQuestion.contextNote || currentQuestion.notes || '');
    setVoiceTranscriptDraft(currentQuestion.voiceTranscript || '');
    setInputMode(currentQuestion.answerMode === 'voice_answer' ? 'voice_answer' : 'text_answer');
    setShowLinkForm(false);
    setLinkName('');
    setLinkUrl('');
    setLinkDescription('');
  }, [currentQuestion]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const currentEvidence = useMemo(() => {
    if (!currentQuestion) return [];
    return evidence.filter((item) => item.questionId === currentQuestion.id);
  }, [currentQuestion, evidence]);

  const currentQuestionOptions = useMemo(
    () => (currentQuestion ? buildDefaultOptions(currentQuestion, isPolish) : []),
    [currentQuestion, isPolish]
  );

  const hasUnsavedChanges =
    !!currentQuestion &&
    (answerDraft !== (currentQuestion.answerText || '') ||
      contextDraft !== (currentQuestion.contextNote || currentQuestion.notes || '') ||
      inputMode !== (currentQuestion.answerMode === 'voice_answer' ? 'voice_answer' : 'text_answer') ||
      voiceTranscriptDraft !== (currentQuestion.voiceTranscript || ''));

  const persistCurrentQuestion = useCallback(async () => {
    if (!currentQuestion || readOnly) return true;
    if (!hasUnsavedChanges) return true;

    setIsPersisting(true);
    try {
      const normalizedAnswer = answerDraft.trim();
      const normalizedContext = contextDraft.trim();
      const normalizedType = normalizeAnswerType(currentQuestion.answerType);
      const payload =
        normalizedAnswer && !QUESTION_INPUT_TYPES.longText.has(normalizedType)
          ? {
              type: normalizedType,
              value: normalizedAnswer,
            }
          : null;

      await onUpdateQuestion(currentQuestion.id, {
        answerText: normalizedAnswer,
        answerMode: inputMode,
        answerPayload: payload,
        contextNote: normalizedContext || undefined,
        notes: normalizedContext || undefined,
        voiceTranscript: inputMode === 'voice_answer' ? voiceTranscriptDraft || normalizedAnswer : '',
        voiceTranscriptStatus:
          inputMode === 'voice_answer' && (voiceTranscriptDraft || normalizedAnswer)
            ? 'approved'
            : 'none',
        status: normalizedAnswer ? 'answered' : 'in_progress',
      });
      return true;
    } catch {
      return false;
    } finally {
      setIsPersisting(false);
    }
  }, [
    answerDraft,
    contextDraft,
    currentQuestion,
    hasUnsavedChanges,
    inputMode,
    onUpdateQuestion,
    readOnly,
    voiceTranscriptDraft,
  ]);

  const voiceNeedsApproval =
    inputMode === 'voice_answer' &&
    voiceTranscriptDraft &&
    currentQuestion?.voiceTranscriptStatus === 'draft';

  const handleApproveTranscript = useCallback(async () => {
    if (!currentQuestion) return;
    await onUpdateQuestion(currentQuestion.id, {
      voiceTranscript: voiceTranscriptDraft.trim(),
      voiceTranscriptStatus: 'approved',
      answerText: voiceTranscriptDraft.trim(),
      status: 'answered',
    });
    toast.success(isPolish ? 'Transkrypcja zatwierdzona.' : 'Transcript approved.');
  }, [currentQuestion, isPolish, onUpdateQuestion, voiceTranscriptDraft]);

  const navigateToQuestion = useCallback(
    async (question: InterviewQuestion | null) => {
      if (!question) return;
      if (voiceNeedsApproval) {
        toast.error(
          isPolish
            ? 'Zatwierdź transkrypcję przed przejściem dalej.'
            : 'Please approve the transcript before continuing.'
        );
        return;
      }
      const ok = await persistCurrentQuestion();
      if (!ok) return;
      if (question.category !== activeCategory) {
        onCategoryChange(question.category);
      }
      setCurrentQuestionId(question.id);
    },
    [activeCategory, isPolish, onCategoryChange, persistCurrentQuestion, voiceNeedsApproval]
  );

  // Keyboard shortcuts: Enter→Next, Shift+Enter→newline (handled natively), Esc→Save, 1-9→quick select
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (readOnly || !currentQuestion) return;
      const target = e.target as HTMLElement;
      const isTextInput = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
      const normalizedType = normalizeAnswerType(currentQuestion.answerType);
      const isChoiceType =
        QUESTION_INPUT_TYPES.yesNo.has(normalizedType) ||
        QUESTION_INPUT_TYPES.singleChoice.has(normalizedType) ||
        QUESTION_INPUT_TYPES.rating.has(normalizedType) ||
        QUESTION_INPUT_TYPES.dropdown.has(normalizedType);

      if (e.key === 'Escape') {
        e.preventDefault();
        void persistCurrentQuestion();
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey && (!isTextInput || isChoiceType)) {
        e.preventDefault();
        if (nextQuestion) {
          void navigateToQuestion(nextQuestion);
        }
        return;
      }

      if (isChoiceType && !isTextInput && /^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const options = buildDefaultOptions(currentQuestion, isPolish);
        if (idx < options.length) {
          e.preventDefault();
          setInputMode('text_answer');
          setAnswerDraft(options[idx]);
        }
        return;
      }

      if (!isTextInput && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (previousQuestion) void navigateToQuestion(previousQuestion);
        return;
      }
      if (!isTextInput && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) {
        e.preventDefault();
        if (nextQuestion) void navigateToQuestion(nextQuestion);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentQuestion, isPolish, navigateToQuestion, nextQuestion, persistCurrentQuestion, previousQuestion, readOnly]);

  const handleFilePicked = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !currentQuestion) return;
      try {
        await onUploadFile(file, currentQuestion.category, currentQuestion.id);
      } finally {
        event.target.value = '';
      }
    },
    [currentQuestion, onUploadFile]
  );

  const handleAddLink = useCallback(async () => {
    if (!currentQuestion) return;
    if (!linkName.trim() || !linkUrl.trim()) return;

    await onAddLink(
      linkName.trim(),
      linkUrl.trim(),
      linkDescription.trim() || undefined,
      currentQuestion.category,
      currentQuestion.id
    );
    setLinkName('');
    setLinkUrl('');
    setLinkDescription('');
    setShowLinkForm(false);
  }, [currentQuestion, linkDescription, linkName, linkUrl, onAddLink]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (!currentQuestion || isRecording || isTranscribing) return;
    if (typeof MediaRecorder === 'undefined') {
      toast.error(
        isPolish ? 'Nagrywanie nie jest wspierane w tej przegladarce.' : 'Recording is not supported in this browser.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        if (!currentQuestion) return;

        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const audioFile = new File(
          [audioBlob],
          `interview-answer-${currentQuestion.id}.webm`,
          { type: audioBlob.type || 'audio/webm' }
        );

        const formData = new FormData();
        formData.append('audio', audioFile);
        formData.append('language', isPolish ? 'pl' : 'en');

        setIsTranscribing(true);
        try {
          const headers = { ...getHeaders() };
          delete headers['Content-Type'];

          const response = await fetch(`${API_URL}/voice/stt`, {
            method: 'POST',
            headers,
            body: formData,
          });

          const data = await response.json();
          if (!response.ok || !data?.text) {
            throw new Error(data?.error || 'Transcription failed');
          }

          setInputMode('voice_answer');
          setVoiceTranscriptDraft(String(data.text).trim());
          setAnswerDraft(String(data.text).trim());

          const created = await onAddVoiceEvidence(
            audioFile,
            String(data.text).trim(),
            currentQuestion.category,
            currentQuestion.id
          );

          await onUpdateQuestion(currentQuestion.id, {
            answerMode: 'voice_answer',
            voiceTranscript: String(data.text).trim(),
            voiceTranscriptStatus: 'draft',
            voiceAudioEvidenceId: created?.id,
            status: 'in_progress',
          });

          toast.success(
            isPolish
              ? 'Transkrypcja gotowa. Sprawdź tekst i zatwierdź.'
              : 'Transcript ready. Review the text and approve it.'
          );
        } catch (error) {
          toast.error(
            isPolish
              ? 'Nie udało się przetworzyć nagrania.'
              : 'Failed to process the recording.'
          );
          console.error('[InterviewSingleQuestionRuntime] Voice transcription failed:', error);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      toast.error(
        isPolish
          ? 'Brak dostępu do mikrofonu lub nagrywanie jest niedostępne.'
          : 'Microphone access is unavailable.'
      );
      console.error('[InterviewSingleQuestionRuntime] Recording failed:', error);
    }
  }, [currentQuestion, isPolish, isRecording, isTranscribing, onAddVoiceEvidence, onUpdateQuestion]);

  const renderedInput = useMemo(() => {
    if (!currentQuestion) return null;

    const normalizedType = normalizeAnswerType(currentQuestion.answerType);

    if (QUESTION_INPUT_TYPES.yesNo.has(normalizedType) || QUESTION_INPUT_TYPES.singleChoice.has(normalizedType)) {
      return (
        <div className="flex flex-wrap gap-2">
          {currentQuestionOptions.map((option) => {
            const selected = answerDraft === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setInputMode('text_answer');
                  setAnswerDraft(option);
                }}
                disabled={readOnly}
                className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  selected
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:border-primary-300'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    }

    if (QUESTION_INPUT_TYPES.multiChoice.has(normalizedType)) {
      const selectedSet = parseMultiChoiceValue(answerDraft);
      return (
        <div className="flex flex-wrap gap-2">
          {currentQuestionOptions.map((option) => {
            const isSelected = selectedSet.has(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  const next = new Set(selectedSet);
                  if (isSelected) next.delete(option);
                  else next.add(option);
                  setInputMode('text_answer');
                  setAnswerDraft(serializeMultiChoice(next));
                }}
                disabled={readOnly}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:border-primary-300'
                }`}
              >
                <CheckSquare size={14} className={isSelected ? 'opacity-100' : 'opacity-30'} />
                {option}
              </button>
            );
          })}
        </div>
      );
    }

    if (QUESTION_INPUT_TYPES.rating.has(normalizedType)) {
      return (
        <div className="flex flex-wrap gap-2">
          {currentQuestionOptions.map((option) => {
            const selected = answerDraft === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setInputMode('text_answer');
                  setAnswerDraft(option);
                }}
                disabled={readOnly}
                className={`w-12 h-12 rounded-2xl border text-sm font-semibold transition-all ${
                  selected
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:border-primary-300'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    }

    if (QUESTION_INPUT_TYPES.dropdown.has(normalizedType)) {
      return (
        <div className="relative">
          <button
            type="button"
            onClick={() => !readOnly && setDropdownOpen((p) => !p)}
            disabled={readOnly}
            className="w-full flex items-center justify-between rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-4 py-3 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <span className={answerDraft ? '' : 'text-slate-400 dark:text-slate-500'}>
              {answerDraft || (isPolish ? 'Wybierz opcję...' : 'Select an option...')}
            </span>
            <ChevronDown size={16} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {dropdownOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 shadow-xl max-h-60 overflow-y-auto">
              {currentQuestionOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setInputMode('text_answer');
                    setAnswerDraft(option);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    answerDraft === option
                      ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 font-medium'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (QUESTION_INPUT_TYPES.date.has(normalizedType)) {
      return (
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            type="date"
            value={answerDraft}
            onChange={(event) => {
              setInputMode('text_answer');
              setAnswerDraft(event.target.value);
            }}
            disabled={readOnly}
            className="w-full rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-4 py-3 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      );
    }

    if (QUESTION_INPUT_TYPES.number.has(normalizedType)) {
      return (
        <input
          type="number"
          value={answerDraft}
          onChange={(event) => {
            setInputMode('text_answer');
            setAnswerDraft(event.target.value);
          }}
          disabled={readOnly}
          className="w-full rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-4 py-3 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder={isPolish ? 'Wpisz wartość' : 'Enter a value'}
        />
      );
    }

    return (
      <textarea
        value={answerDraft}
        onChange={(event) => {
          setInputMode('text_answer');
          setAnswerDraft(event.target.value);
        }}
        disabled={readOnly}
        rows={QUESTION_INPUT_TYPES.shortText.has(normalizedType) ? 3 : 7}
        className="w-full rounded-3xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-5 py-4 text-base text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
        placeholder={
          isPolish
            ? 'Wpisz odpowiedź albo nagraj ją poniżej...'
            : 'Write the answer or record it below...'
        }
      />
    );
  }, [currentQuestion, currentQuestionOptions, answerDraft, readOnly, isPolish, dropdownOpen]);

  if (!currentQuestion && runtimeView !== 'review') {
    return (
      <div className="rounded-[28px] border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/80 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-navy-800">
          <FileText size={24} className="text-slate-400" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Brak pytań w tej sekcji.'
            : 'No questions are available in this section.'}
        </p>
      </div>
    );
  }

  const activeCategoryConfig = currentQuestion ? CATEGORY_CONFIG[currentQuestion.category] : undefined;
  const answeredCount = orderedQuestions.filter((question) => question.status === 'answered').length;
  const categoryPosition = currentQuestion
    ? categoryQuestions.findIndex((question) => question.id === currentQuestion.id) + 1
    : 0;
  const isLastQuestion = !nextQuestion;
  const requiredMissing = orderedQuestions.filter(
    (q) => q.isRequired && q.status !== 'answered'
  );

  // ---- Review screen ----
  if (runtimeView === 'review') {
    return (
      <div className="space-y-4">
        <div className="rounded-[28px] border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Przegląd przed wysłaniem' : 'Review before submitting'}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {isPolish
                  ? `${answeredCount} z ${orderedQuestions.length} pytań odpowiedzianych`
                  : `${answeredCount} of ${orderedQuestions.length} questions answered`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRuntimeView('answering')}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-navy-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <ArrowLeft size={14} />
              {isPolish ? 'Wróć do pytań' : 'Back to questions'}
            </button>
          </div>

          {requiredMissing.length > 0 && (
            <div className="mb-4 rounded-2xl border border-rose-200/70 dark:border-rose-500/20 bg-rose-50/70 dark:bg-rose-500/10 px-4 py-3">
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                <CircleAlert size={14} className="inline mr-1.5 -mt-0.5" />
                {isPolish
                  ? `${requiredMissing.length} wymaganych pytań bez odpowiedzi`
                  : `${requiredMissing.length} required questions unanswered`}
              </p>
            </div>
          )}

          <div className="space-y-1">
            {CATEGORY_ORDER.map((cat) => {
              const catInfo = categorySummary.get(cat);
              if (!catInfo) return null;
              const catConfig = CATEGORY_CONFIG[cat];
              const catQuestions = orderedQuestions.filter((q) => q.category === cat);

              return (
                <div key={cat} className="rounded-2xl border border-slate-100 dark:border-navy-800 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50/60 dark:bg-navy-950/40">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${catConfig.bgColor} ${catConfig.color}`}>
                      {isPolish ? catConfig.labelPl : catConfig.labelEn}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {catInfo.answered}/{catInfo.total}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-navy-800">
                    {catQuestions.map((q) => {
                      const answered = q.status === 'answered';
                      const snippet = q.answerText
                        ? q.answerText.length > 80 ? q.answerText.slice(0, 80) + '…' : q.answerText
                        : '';
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            setRuntimeView('answering');
                            if (q.category !== activeCategory) onCategoryChange(q.category);
                            setCurrentQuestionId(q.id);
                          }}
                          className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-navy-900/50 transition-colors"
                        >
                          <div className="mt-0.5 shrink-0">
                            {answered ? (
                              <Check size={14} className="text-emerald-500" />
                            ) : q.isRequired ? (
                              <CircleAlert size={14} className="text-rose-400" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-navy-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                              {q.questionText}
                            </p>
                            {snippet && (
                              <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                {snippet}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl p-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setRuntimeView('answering')}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-navy-700 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <ArrowLeft size={16} />
              {isPolish ? 'Wróć do pytań' : 'Back to questions'}
            </button>
            <button
              type="button"
              onClick={() => void onSubmitSession()}
              disabled={readOnly || isPersisting}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              <Check size={16} />
              {isPolish ? 'Zatwierdź i wyślij' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  // ---- Main answering view with left mini rail ----
  return (
    <div className="flex gap-4" ref={mainContentRef}>
      {/* Left mini rail (desktop) */}
      <nav
        className="hidden md:flex flex-col w-48 shrink-0 space-y-1"
        role="navigation"
        aria-label={isPolish ? 'Nawigacja kategorii' : 'Category navigation'}
      >
        {sessionName && (
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 truncate">
            {sessionName}
          </p>
        )}
        {CATEGORY_ORDER.map((cat) => {
          const catInfo = categorySummary.get(cat);
          if (!catInfo) return null;
          const catConfig = CATEGORY_CONFIG[cat];
          const isActive = cat === activeCategory;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`${isPolish ? catConfig.labelPl : catConfig.labelEn} — ${catInfo.answered}/${catInfo.total}`}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition-all ${
                isActive
                  ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white font-medium'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-900/50'
              }`}
            >
              <span className="truncate">{isPolish ? catConfig.labelPl : catConfig.labelEn}</span>
              <span className={`text-[10px] tabular-nums shrink-0 ${
                catInfo.answered === catInfo.total && catInfo.total > 0
                  ? 'text-emerald-500'
                  : ''
              }`}>
                {catInfo.answered}/{catInfo.total}
              </span>
            </button>
          );
        })}

        <div className="!mt-3 border-t border-slate-100 dark:border-navy-800 pt-3">
          <button
            type="button"
            onClick={() => {
              void persistCurrentQuestion();
              setRuntimeView('review');
            }}
            aria-label={isPolish ? 'Przejdź do przeglądu' : 'Go to review'}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-900/50 w-full text-left transition-colors"
          >
            <ClipboardList size={13} />
            {isPolish ? 'Przegląd' : 'Review'}
          </button>
          {onSaveAndExit && (
            <button
              type="button"
              onClick={() => {
                void persistCurrentQuestion().then(() => onSaveAndExit?.());
              }}
              aria-label={isPolish ? 'Zapisz i wyjdź' : 'Save and exit'}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-900/50 w-full text-left transition-colors"
            >
              <LogOut size={13} />
              {isPolish ? 'Zapisz i wyjdź' : 'Save & Exit'}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile category switcher (horizontal scroll pills) */}
      <div className="md:hidden absolute left-0 right-0 -mt-2 mb-2" style={{ position: 'relative' }}>
        <div
          className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-hide"
          role="navigation"
          aria-label={isPolish ? 'Nawigacja kategorii' : 'Category navigation'}
        >
          {CATEGORY_ORDER.map((cat) => {
            const catInfo = categorySummary.get(cat);
            if (!catInfo) return null;
            const catConfig = CATEGORY_CONFIG[cat];
            const isActive = cat === activeCategory;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${isPolish ? catConfig.labelPl : catConfig.labelEn} — ${catInfo.answered}/${catInfo.total}`}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
                  isActive
                    ? `${catConfig.bgColor} ${catConfig.color} ring-1 ring-current/20`
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {isPolish ? catConfig.labelPl : catConfig.labelEn}
                <span className={`text-[10px] tabular-nums ${
                  catInfo.answered === catInfo.total && catInfo.total > 0
                    ? 'text-emerald-500'
                    : ''
                }`}>
                  {catInfo.answered}/{catInfo.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Center content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Progress bar - lightweight */}
        <div className="flex items-center gap-3">
          {activeCategoryConfig && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${activeCategoryConfig.bgColor} ${activeCategoryConfig.color}`}>
              {isPolish ? activeCategoryConfig.labelPl : activeCategoryConfig.labelEn}
            </span>
          )}
          <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
            {currentIndex + 1} / {orderedQuestions.length}
          </span>
          <div className="flex-1 h-1 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary-500/60 transition-all duration-300"
              style={{ width: `${orderedQuestions.length > 0 ? (answeredCount / orderedQuestions.length) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
            {answeredCount}/{orderedQuestions.length}
          </span>
        </div>

        {/* Question card — key forces clean re-mount on question switch */}
        <div
          key={currentQuestion.id}
          className="rounded-[32px] border border-slate-200/70 dark:border-navy-700/70 bg-gradient-to-br from-white via-white to-slate-50 dark:from-navy-900 dark:via-navy-900 dark:to-navy-950 p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-navy-950/50"
        >
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {currentQuestion.isRequired && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <CircleAlert size={12} />
                    {isPolish ? 'Wymagane' : 'Required'}
                  </span>
                )}
                {currentQuestion.expectedAnswerShape && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-navy-800 px-3 py-1 text-xs text-slate-500 dark:text-slate-400">
                    <Sparkles size={12} />
                    {currentQuestion.expectedAnswerShape}
                  </span>
                )}
              </div>

              <h2 className="text-2xl md:text-3xl font-semibold leading-tight text-slate-900 dark:text-white">
                {currentQuestion.questionText}
              </h2>

              {/* Helper text / description */}
              {currentQuestion.description && (
                <p className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  <HelpCircle size={14} className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" />
                  {currentQuestion.description}
                </p>
              )}
            </div>

            <div className="space-y-4">
              {renderedInput}

              {/* Voice transcript approval gate */}
              {voiceNeedsApproval && (
                <div className="rounded-2xl border border-amber-200/70 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/10 px-4 py-3 space-y-2">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {isPolish
                      ? 'Sprawdź transkrypcję i zatwierdź przed kontynuacją:'
                      : 'Review the transcript and approve before continuing:'}
                  </p>
                  <textarea
                    value={voiceTranscriptDraft}
                    onChange={(e) => setVoiceTranscriptDraft(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-navy-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleApproveTranscript}
                      aria-label={isPolish ? 'Zatwierdź transkrypcję' : 'Approve transcript'}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white"
                    >
                      <Check size={14} />
                      {isPolish ? 'Zatwierdź transkrypcję' : 'Approve transcript'}
                    </button>
                  </div>
                </div>
              )}

              {(inputMode === 'voice_answer' || isTranscribing) && !voiceNeedsApproval && (
                <div className="rounded-2xl border border-violet-200/70 dark:border-violet-500/20 bg-violet-50/70 dark:bg-violet-500/10 px-4 py-3 text-sm text-violet-700 dark:text-violet-300">
                  {isTranscribing ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      {isPolish ? 'Trwa transkrypcja nagrania...' : 'Transcribing recording...'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-500" />
                      {isPolish
                        ? 'Transkrypcja zatwierdzona.'
                        : 'Transcript approved.'}
                    </span>
                  )}
                </div>
              )}

              {currentQuestion.allowContextNote && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Kontekst dodatkowy' : 'Context note'}
                  </label>
                  <textarea
                    value={contextDraft}
                    onChange={(event) => setContextDraft(event.target.value)}
                    disabled={readOnly}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder={
                      isPolish
                        ? 'Dodatkowy komentarz, niuans albo wyjaśnienie do odpowiedzi'
                        : 'Optional nuance, comment, or clarification'
                    }
                  />
                </div>
              )}

              {/* Evidence prompt */}
              {currentQuestion.evidencePrompt && (
                <div className="rounded-2xl border border-sky-200/50 dark:border-sky-500/15 bg-sky-50/50 dark:bg-sky-500/5 px-4 py-3 text-sm text-sky-700 dark:text-sky-300">
                  <Paperclip size={13} className="inline mr-1.5 -mt-0.5" />
                  {currentQuestion.evidencePrompt}
                </div>
              )}
            </div>

            {/* Supporting materials */}
            {!readOnly && (
              <div className="space-y-3 rounded-3xl border border-slate-200/70 dark:border-navy-700/70 bg-slate-50/70 dark:bg-navy-950/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {currentQuestion.allowVoice && (
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isTranscribing}
                      aria-label={
                        isRecording
                          ? isPolish ? 'Zakończ nagranie' : 'Stop recording'
                          : isPolish ? 'Nagraj odpowiedź' : 'Record answer'
                      }
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all ${
                        isRecording
                          ? 'bg-rose-500 text-white'
                          : 'bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {isRecording ? <PauseCircle size={16} /> : <Mic size={16} />}
                      {isRecording
                        ? isPolish ? 'Zakończ nagranie' : 'Stop recording'
                        : isPolish ? 'Nagraj odpowiedź' : 'Record answer'}
                    </button>
                  )}

                  {currentQuestion.allowFileUpload && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFilePicked}
                        aria-label={isPolish ? 'Wybierz plik' : 'Choose file'}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label={isPolish ? 'Dodaj załącznik' : 'Add attachment'}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200"
                      >
                        <Paperclip size={16} />
                        {isPolish ? 'Dodaj załącznik' : 'Add attachment'}
                      </button>
                    </>
                  )}

                  {currentQuestion.allowUrl && (
                    <button
                      type="button"
                      onClick={() => setShowLinkForm((prev) => !prev)}
                      aria-label={isPolish ? 'Dodaj link' : 'Add link'}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200"
                    >
                      <Link2 size={16} />
                      {isPolish ? 'Dodaj link' : 'Add link'}
                    </button>
                  )}
                </div>

                {showLinkForm && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      value={linkName}
                      onChange={(event) => setLinkName(event.target.value)}
                      aria-label={isPolish ? 'Nazwa linku' : 'Link title'}
                      className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder={isPolish ? 'Nazwa linku' : 'Link title'}
                    />
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(event) => setLinkUrl(event.target.value)}
                      aria-label={isPolish ? 'Adres URL' : 'URL address'}
                      className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="https://"
                    />
                    <input
                      type="text"
                      value={linkDescription}
                      onChange={(event) => setLinkDescription(event.target.value)}
                      aria-label={isPolish ? 'Opis linku' : 'Link description'}
                      className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 md:col-span-2"
                      placeholder={isPolish ? 'Opis opcjonalny' : 'Optional description'}
                    />
                    <div className="md:col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddLink}
                        disabled={!linkName.trim() || !linkUrl.trim()}
                        aria-label={isPolish ? 'Zapisz link' : 'Save link'}
                        className="inline-flex items-center gap-2 rounded-2xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        <Check size={16} />
                        {isPolish ? 'Zapisz link' : 'Save link'}
                      </button>
                    </div>
                  </div>
                )}

                {currentEvidence.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {currentEvidence.slice(0, 6).map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/80 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300"
                      >
                        {item.evidenceType === 'link' ? <Link2 size={12} /> : <Paperclip size={12} />}
                        {item.title || item.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom action row */}
        <div className="rounded-[28px] border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              {hasUnsavedChanges ? (
                <>
                  <Loader2 size={14} className={isPersisting ? 'animate-spin' : ''} />
                  {isPolish ? 'Niezapisane zmiany' : 'Unsaved changes'}
                </>
              ) : (
                <>
                  <Check size={14} />
                  {isPolish ? 'Zapisano' : 'Saved'}
                </>
              )}
              <span className="text-slate-300 dark:text-navy-700 mx-1">|</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Esc={isPolish ? 'zapisz' : 'save'} · Enter={isPolish ? 'dalej' : 'next'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigateToQuestion(previousQuestion)}
                disabled={!previousQuestion || isPersisting}
                aria-label={isPolish ? 'Poprzednie pytanie' : 'Previous question'}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-navy-700 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 disabled:opacity-50"
              >
                <ArrowLeft size={16} />
                {isPolish ? 'Wstecz' : 'Back'}
              </button>

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => void persistCurrentQuestion()}
                  disabled={isPersisting}
                  aria-label={isPolish ? 'Zapisz odpowiedź' : 'Save answer'}
                  className="inline-flex items-center gap-2 rounded-2xl border border-primary-500/30 bg-primary-500/10 px-4 py-2.5 text-sm font-medium text-primary-600 dark:text-primary-400 disabled:opacity-50"
                >
                  {isPersisting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {isPolish ? 'Zapisz' : 'Save'}
                </button>
              )}

              {isLastQuestion ? (
                <button
                  type="button"
                  onClick={() => {
                    void persistCurrentQuestion().then(() => setRuntimeView('review'));
                  }}
                  disabled={readOnly || isPersisting}
                  aria-label={isPolish ? 'Przejrzyj i wyślij' : 'Review and submit'}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  <ClipboardList size={16} />
                  {isPolish ? 'Przejrzyj i wyślij' : 'Review & Submit'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateToQuestion(nextQuestion)}
                  disabled={!nextQuestion || isPersisting}
                  aria-label={isPolish ? 'Następne pytanie' : 'Next question'}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 dark:bg-white px-4 py-2.5 text-sm font-medium text-white dark:text-slate-900 disabled:opacity-50"
                >
                  {isPolish ? 'Następne' : 'Next'}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewSingleQuestionRuntime;
