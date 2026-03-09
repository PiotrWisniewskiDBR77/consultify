import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  FileText,
  Link2,
  Loader2,
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
  readOnly?: boolean;
}

type DraftInputMode = 'text_answer' | 'voice_answer';

const QUESTION_INPUT_TYPES = {
  longText: new Set(['open', 'text', 'textarea', 'long_text']),
  shortText: new Set(['short_text', 'short-answer', 'short_answer']),
  number: new Set(['number', 'numeric', 'currency']),
  singleChoice: new Set(['single_choice', 'single-select', 'select', 'dropdown', 'choice']),
  yesNo: new Set(['yes_no', 'boolean', 'bool']),
  rating: new Set(['rating', 'scale', 'score']),
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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

  const navigateToQuestion = useCallback(
    async (question: InterviewQuestion | null) => {
      if (!question) return;
      const ok = await persistCurrentQuestion();
      if (!ok) return;
      if (question.category !== activeCategory) {
        onCategoryChange(question.category);
      }
      setCurrentQuestionId(question.id);
    },
    [activeCategory, onCategoryChange, persistCurrentQuestion]
  );

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

  const renderInput = () => {
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
            ? 'Wpisz odpowiedz albo nagraj ja ponizej...'
            : 'Write the answer or record it below...'
        }
      />
    );
  };

  if (!currentQuestion) {
    return (
      <div className="rounded-[28px] border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/80 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-navy-800">
          <FileText size={24} className="text-slate-400" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Brak pytan w tej sekcji.'
            : 'No questions are available in this section.'}
        </p>
      </div>
    );
  }

  const activeCategoryConfig = CATEGORY_CONFIG[currentQuestion.category];
  const answeredCount = orderedQuestions.filter((question) => question.status === 'answered').length;
  const categoryPosition =
    categoryQuestions.findIndex((question) => question.id === currentQuestion.id) + 1;
  const isLastQuestion = !nextQuestion;

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl p-5 shadow-lg shadow-slate-200/40 dark:shadow-navy-950/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${activeCategoryConfig.bgColor} ${activeCategoryConfig.color}`}>
                {isPolish ? activeCategoryConfig.labelPl : activeCategoryConfig.labelEn}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {currentIndex + 1}/{orderedQuestions.length}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isPolish
                ? `Pytanie ${categoryPosition} z ${categoryQuestions.length} w tej sekcji`
                : `Question ${categoryPosition} of ${categoryQuestions.length} in this section`}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 dark:border-navy-700/70 bg-slate-50/80 dark:bg-navy-950/60 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              {isPolish ? 'Postep' : 'Progress'}
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {answeredCount}/{orderedQuestions.length}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-200/70 dark:border-navy-700/70 bg-gradient-to-br from-white via-white to-slate-50 dark:from-navy-900 dark:via-navy-900 dark:to-navy-950 p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-navy-950/50">
        <div className="max-w-4xl space-y-6">
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
          </div>

          <div className="space-y-4">
            {renderInput()}

            {(inputMode === 'voice_answer' || isTranscribing) && (
              <div className="rounded-2xl border border-violet-200/70 dark:border-violet-500/20 bg-violet-50/70 dark:bg-violet-500/10 px-4 py-3 text-sm text-violet-700 dark:text-violet-300">
                {isTranscribing ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    {isPolish ? 'Trwa transkrypcja nagrania...' : 'Transcribing recording...'}
                  </span>
                ) : (
                  <span>
                    {isPolish
                      ? 'To pole zostanie zapisane jako odpowiedz glosowa po zatwierdzeniu.'
                      : 'This answer will be saved as a voice response after approval.'}
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
                      ? 'Dodatkowy komentarz, niuans albo wyjasnienie do odpowiedzi'
                      : 'Optional nuance, comment, or clarification'
                  }
                />
              </div>
            )}
          </div>

          {!readOnly && (
            <div className="space-y-3 rounded-3xl border border-slate-200/70 dark:border-navy-700/70 bg-slate-50/70 dark:bg-navy-950/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                {currentQuestion.allowVoice && (
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isTranscribing}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all ${
                      isRecording
                        ? 'bg-rose-500 text-white'
                        : 'bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {isRecording ? <PauseCircle size={16} /> : <Mic size={16} />}
                    {isRecording
                      ? isPolish
                        ? 'Zakoncz nagranie'
                        : 'Stop recording'
                      : isPolish
                        ? 'Nagraj odpowiedz'
                        : 'Record answer'}
                  </button>
                )}

                {currentQuestion.allowFileUpload && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFilePicked}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200"
                    >
                      <Paperclip size={16} />
                      {isPolish ? 'Dodaj zalacznik' : 'Add attachment'}
                    </button>
                  </>
                )}

                {currentQuestion.allowUrl && (
                  <button
                    type="button"
                    onClick={() => setShowLinkForm((prev) => !prev)}
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
                    className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder={isPolish ? 'Nazwa linku' : 'Link title'}
                  />
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="https://"
                  />
                  <input
                    type="text"
                    value={linkDescription}
                    onChange={(event) => setLinkDescription(event.target.value)}
                    className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 md:col-span-2"
                    placeholder={isPolish ? 'Opis opcjonalny' : 'Optional description'}
                  />
                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddLink}
                      disabled={!linkName.trim() || !linkUrl.trim()}
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

      <div className="rounded-[28px] border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            {hasUnsavedChanges ? (
              <>
                <Loader2 size={14} className={isPersisting ? 'animate-spin' : ''} />
                {isPolish ? 'Masz niezapisane zmiany' : 'You have unsaved changes'}
              </>
            ) : (
              <>
                <Check size={14} />
                {isPolish ? 'Wszystko zapisane lokalnie' : 'Ready to save'}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigateToQuestion(previousQuestion)}
              disabled={!previousQuestion || isPersisting}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-navy-700 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 disabled:opacity-50"
            >
              <ArrowLeft size={16} />
              {isPolish ? 'Poprzednie' : 'Previous'}
            </button>

            {!readOnly && (
              <button
                type="button"
                onClick={() => void persistCurrentQuestion()}
                disabled={isPersisting}
                className="inline-flex items-center gap-2 rounded-2xl border border-primary-500/30 bg-primary-500/10 px-4 py-2.5 text-sm font-medium text-primary-600 dark:text-primary-400 disabled:opacity-50"
              >
                {isPersisting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {isPolish ? 'Zatwierdz odpowiedz' : 'Approve answer'}
              </button>
            )}

            {isLastQuestion ? (
              <button
                type="button"
                onClick={() => void onSubmitSession()}
                disabled={readOnly || isPersisting}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                <Check size={16} />
                {isPolish ? 'Zakoncz i wyslij' : 'Finish and submit'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigateToQuestion(nextQuestion)}
                disabled={!nextQuestion || isPersisting}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 dark:bg-white px-4 py-2.5 text-sm font-medium text-white dark:text-slate-900 disabled:opacity-50"
              >
                {isPolish ? 'Nastepne pytanie' : 'Next question'}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewSingleQuestionRuntime;
