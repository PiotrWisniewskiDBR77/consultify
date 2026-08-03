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
  Hash,
  HelpCircle,
  History,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  Loader2,
  LogOut,
  Mic,
  Paperclip,
  PauseCircle,
  Sparkles,
  Trash2,
  Type,
  Waypoints,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api, API_URL, getHeaders } from '@/services/api';
import type { ArtifactType } from '@/utils/artifactLinks';
import { buildArtifactCode, getArtifactLabel } from '@/utils/artifactLinks';

import {
  ArtifactAttachPopover,
  type ArtifactSearchResult,
} from '../shared/NModeBlocks/ArtifactAttachPopover';
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
  isSubmitting?: boolean;
  immersive?: boolean;
  /**
   * #48B — previous-version snapshots per question, taken on send-back
   * (interview_answer_history via GET /interview/assignments/:id/answer-history).
   * Optional: when absent/empty the "poprzednia wersja" disclosure simply
   * doesn't render (fail-open, zero behavior change for existing callers).
   */
  answerHistoryByQuestionId?: Record<
    string,
    Array<{ id: string; answerText: string | null; savedAt: string }>
  >;
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

function buildDefaultOptions(question: InterviewQuestion, t: (key: string) => string): string[] {
  const normalized = normalizeAnswerType(question.answerType);
  if (Array.isArray(question.answerOptions) && question.answerOptions.length > 0) {
    return question.answerOptions;
  }
  if (QUESTION_INPUT_TYPES.yesNo.has(normalized)) {
    return [t('interview.singleQuestionRuntime.yes'), t('interview.singleQuestionRuntime.no')];
  }
  if (QUESTION_INPUT_TYPES.rating.has(normalized)) {
    return ['1', '2', '3', '4', '5'];
  }
  return [];
}

function getAnswerTypeLabel(
  answerType: string | undefined,
  t: (key: string) => string
): { label: string; icon: 'text' | 'hash' | 'check' | 'calendar' } {
  const normalized = normalizeAnswerType(answerType);
  if (QUESTION_INPUT_TYPES.longText.has(normalized))
    return { label: t('interview.singleQuestionRuntime.answerTypeText'), icon: 'text' };
  if (QUESTION_INPUT_TYPES.shortText.has(normalized))
    return { label: t('interview.singleQuestionRuntime.answerTypeShortText'), icon: 'text' };
  if (QUESTION_INPUT_TYPES.number.has(normalized))
    return { label: t('interview.singleQuestionRuntime.answerTypeNumber'), icon: 'hash' };
  if (QUESTION_INPUT_TYPES.singleChoice.has(normalized))
    return { label: t('interview.singleQuestionRuntime.answerTypeChoice'), icon: 'check' };
  if (QUESTION_INPUT_TYPES.multiChoice.has(normalized))
    return { label: t('interview.singleQuestionRuntime.answerTypeMulti'), icon: 'check' };
  if (QUESTION_INPUT_TYPES.yesNo.has(normalized))
    return { label: t('interview.singleQuestionRuntime.answerTypeYesNo'), icon: 'check' };
  if (QUESTION_INPUT_TYPES.rating.has(normalized))
    return { label: t('interview.singleQuestionRuntime.answerTypeScale'), icon: 'hash' };
  if (QUESTION_INPUT_TYPES.dropdown.has(normalized))
    return { label: t('interview.singleQuestionRuntime.answerTypeDropdown'), icon: 'check' };
  if (QUESTION_INPUT_TYPES.date.has(normalized))
    return { label: t('interview.singleQuestionRuntime.answerTypeDate'), icon: 'calendar' };
  return { label: t('interview.singleQuestionRuntime.answerTypeText'), icon: 'text' };
}

// Demo seed data tags evidence/linked items with raw ids like `seed_iq_…` that leak
// into chip labels (e.g. "Answer – Q seed_iq…"). Detect them so we can hide or clean up.
function isSeedEvidence(item: { id?: string; title?: string; name?: string }): boolean {
  const id = String(item.id || '');
  const title = String(item.title || '');
  const name = String(item.name || '');
  return /(^|[\s_])seed_/i.test(id) || /seed_[a-z0-9]/i.test(title) || /seed_[a-z0-9]/i.test(name);
}

// Produce a clean, human label for an evidence chip — never expose a raw `seed_…` id.
function cleanEvidenceLabel(item: { title?: string; name?: string }, fallback: string): string {
  const raw = String(item.title || item.name || '').trim();
  if (!raw) return fallback;
  // Strip any raw seed token (e.g. "Answer – Q seed_iq_123") and tidy trailing separators.
  const cleaned = raw
    .replace(/seed_[a-z0-9_]+/gi, '')
    .replace(/[–\-•·:]\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || fallback;
}

function parseMultiChoiceValue(answerDraft: string): Set<string> {
  try {
    const parsed = JSON.parse(answerDraft);
    if (Array.isArray(parsed)) return new Set(parsed);
  } catch {
    /* not JSON */
  }
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
  isSubmitting = false,
  immersive = false,
  answerHistoryByQuestionId,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');

  // #48B — "poprzednia wersja" disclosure toggle, keyed by question id so only
  // one history panel is open at a time (mirrors the guidance disclosure).
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);

  const orderedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => {
      const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
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
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveInterim, setLiveInterim] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidanceSeen, setGuidanceSeen] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [runtimeView, setRuntimeView] = useState<RuntimeView>('answering');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [artifactPopoverOpen, setArtifactPopoverOpen] = useState(false);
  const [artifactSearchResults, setArtifactSearchResults] = useState<ArtifactSearchResult[]>([]);
  const [aiImproving, setAiImproving] = useState(false);
  const [aiImproveResult, setAiImproveResult] = useState<{
    improvedText: string;
    changesSummary: string;
  } | null>(null);
  const [aiDropdownOpen, setAiDropdownOpen] = useState(false);
  const aiDropdownRef = useRef<HTMLDivElement>(null);
  const [aiExplaining, setAiExplaining] = useState(false);
  const [aiExplainResult, setAiExplainResult] = useState<{
    explanation: string;
    exampleAnswers: string[];
    whyItMatters: string;
  } | null>(null);
  const artifactCacheRef = useRef<ArtifactSearchResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const answerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef('');
  // Holds the latest INTERIM (not-yet-final) Web Speech result. The visible live
  // text is interim; SpeechRecognition often keeps the tail interim until it
  // finalizes, which can land AFTER MediaRecorder.onstop reads the buffer. We
  // capture interim here so Stop never loses the text the user already saw.
  const liveInterimRef = useRef('');
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
    const pool = immersive ? orderedQuestions : categoryQuestions;
    if (!pool.length) {
      setCurrentQuestionId(null);
      return;
    }

    const stillVisible = pool.some((question) => question.id === currentQuestionId);
    if (stillVisible) return;

    const preferred = pool.find((question) => question.status !== 'answered') || pool[0];
    setCurrentQuestionId(preferred?.id || null);
  }, [categoryQuestions, currentQuestionId, immersive, orderedQuestions]);

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
      speechRecognitionRef.current?.stop();
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

  // Recording elapsed-time ticker (inline "● 0:12" indicator).
  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return;
    }
    setRecordingSeconds(0);
    const interval = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Per-question guidance: reset open state, and remember if the hint was already opened
  // (so the pulse stops nudging the same question twice).
  const guidanceStorageKey = currentQuestion ? `iv_guidance_seen_${currentQuestion.id}` : null;
  useEffect(() => {
    setGuidanceOpen(false);
    if (!guidanceStorageKey) {
      setGuidanceSeen(false);
      return;
    }
    try {
      setGuidanceSeen(localStorage.getItem(guidanceStorageKey) === '1');
    } catch {
      setGuidanceSeen(false);
    }
  }, [guidanceStorageKey]);

  // Static guidance pulled from the question's own template fields (deterministic, no fetch).
  const questionGuidance = useMemo(() => {
    if (!currentQuestion) return null;
    const q = currentQuestion as InterviewQuestion & {
      helpHint?: string;
      guidance?: string;
      instruction?: string;
      exampleAnswer?: string;
      example?: string;
    };
    const instruction =
      q.guidance || q.instruction || q.description || q.helpHint || q.evidencePrompt || '';
    const example = q.exampleAnswer || q.example || '';
    const expected = q.expectedAnswerShape || '';
    return { instruction, example, expected };
  }, [currentQuestion]);

  // Insert text at the answer textarea cursor (append with a separator otherwise).
  const insertIntoAnswer = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInputMode('voice_answer');
    setAnswerDraft((prev) => {
      const el = answerTextareaRef.current;
      if (el && document.activeElement === el) {
        const start = el.selectionStart ?? prev.length;
        const end = el.selectionEnd ?? prev.length;
        const before = prev.slice(0, start);
        const after = prev.slice(end);
        const sep = before && !/\s$/.test(before) ? ' ' : '';
        return `${before}${sep}${trimmed}${after}`;
      }
      if (!prev) return trimmed;
      const sep = /\s$/.test(prev) ? '' : ' ';
      return `${prev}${sep}${trimmed}`;
    });
  }, []);

  const currentQuestionOptions = useMemo(
    () => (currentQuestion ? buildDefaultOptions(currentQuestion, t) : []),
    [currentQuestion, t]
  );

  const hasUnsavedChanges =
    !!currentQuestion &&
    (answerDraft !== (currentQuestion.answerText || '') ||
      contextDraft !== (currentQuestion.contextNote || currentQuestion.notes || '') ||
      inputMode !==
        (currentQuestion.answerMode === 'voice_answer' ? 'voice_answer' : 'text_answer') ||
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
        voiceTranscript:
          inputMode === 'voice_answer' ? voiceTranscriptDraft || normalizedAnswer : '',
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

  // Debounced auto-save: persist after 5s of inactivity
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoSaved, setAutoSaved] = useState(false);

  useEffect(() => {
    if (!hasUnsavedChanges || readOnly || isPersisting) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaved(false);
    autoSaveTimerRef.current = setTimeout(() => {
      void persistCurrentQuestion().then((ok) => {
        if (ok) setAutoSaved(true);
      });
    }, 5000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerDraft, contextDraft, hasUnsavedChanges, readOnly, isPersisting]);

  // Clear auto-saved indicator after 3s
  useEffect(() => {
    if (!autoSaved) return;
    const t = setTimeout(() => setAutoSaved(false), 3000);
    return () => clearTimeout(t);
  }, [autoSaved]);

  // Only show the separate amber "review transcript" box when the draft transcript is
  // genuinely DIFFERENT from what's already in the answer field. Otherwise it just echoes
  // the same text twice (the duplicated-"No stress" bug from legacy/seed draft transcripts).
  const voiceNeedsApproval =
    inputMode === 'voice_answer' &&
    !!voiceTranscriptDraft &&
    currentQuestion?.voiceTranscriptStatus === 'draft' &&
    voiceTranscriptDraft.trim() !== answerDraft.trim();

  const handleApproveTranscript = useCallback(async () => {
    if (!currentQuestion) return;
    await onUpdateQuestion(currentQuestion.id, {
      voiceTranscript: voiceTranscriptDraft.trim(),
      voiceTranscriptStatus: 'approved',
      answerText: voiceTranscriptDraft.trim(),
      status: 'answered',
    });
    toast.success(t('interview.singleQuestionRuntime.transcriptApproved'));
  }, [currentQuestion, isPolish, onUpdateQuestion, voiceTranscriptDraft]);

  const navigateToQuestion = useCallback(
    async (question: InterviewQuestion | null) => {
      if (!question) return;
      if (voiceNeedsApproval) {
        toast.error(t('interview.singleQuestionRuntime.pleaseApproveTheTranscriptBefore'));
        return;
      }
      const ok = await persistCurrentQuestion();
      if (!ok) return;
      if (question.category !== activeCategory) {
        onCategoryChange(question.category);
      }
      setCurrentQuestionId(question.id);
      setAiImproveResult(null);
      setAiExplainResult(null);
      setAiDropdownOpen(false);
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
        const options = buildDefaultOptions(currentQuestion, t);
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
  }, [
    currentQuestion,
    isPolish,
    navigateToQuestion,
    nextQuestion,
    persistCurrentQuestion,
    previousQuestion,
    readOnly,
  ]);

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

  // Shared inline-attachment uploader used by the Image button, clipboard paste and drag&drop.
  const uploadAttachments = useCallback(
    async (files: File[]) => {
      if (!currentQuestion || readOnly || files.length === 0) return;
      setIsUploadingAttachment(true);
      try {
        for (const file of files) {
          await onUploadFile(file, currentQuestion.category, currentQuestion.id);
        }
      } catch {
        toast.error(t('interview.singleQuestionRuntime.failedToAddAttachment'));
      } finally {
        setIsUploadingAttachment(false);
      }
    },
    [currentQuestion, isPolish, onUploadFile, readOnly]
  );

  const handleImagePicked = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      try {
        await uploadAttachments(files);
      } finally {
        event.target.value = '';
      }
    },
    [uploadAttachments]
  );

  // Paste an image straight from the clipboard into the answer field.
  const handleAnswerPaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;
      const imageFiles = Array.from(event.clipboardData?.files || []).filter((f) =>
        f.type.startsWith('image/')
      );
      if (imageFiles.length === 0) return;
      event.preventDefault();
      void uploadAttachments(imageFiles);
    },
    [readOnly, uploadAttachments]
  );

  // Drag & drop files/images directly onto the answer composer.
  const handleAnswerDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDraggingFile(false);
      if (readOnly) return;
      const files = Array.from(event.dataTransfer?.files || []);
      if (files.length > 0) void uploadAttachments(files);
    },
    [readOnly, uploadAttachments]
  );

  const openGuidance = useCallback(() => {
    setGuidanceOpen((prev) => {
      const next = !prev;
      if (next && !guidanceSeen) {
        setGuidanceSeen(true);
        if (guidanceStorageKey) {
          try {
            localStorage.setItem(guidanceStorageKey, '1');
          } catch {
            /* ignore quota / privacy mode */
          }
        }
      }
      return next;
    });
  }, [guidanceSeen, guidanceStorageKey]);

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

  const handleArtifactSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setArtifactSearchResults([]);
      return;
    }
    let cache = artifactCacheRef.current;
    if (!cache) {
      const all: ArtifactSearchResult[] = [];
      const [tasks, initiatives, decisions, assessments] = await Promise.allSettled([
        Api.get('/tasks?limit=50').catch(() => []),
        Api.get('/initiatives?limit=50').catch(() => []),
        Api.get('/decisions?limit=50').catch(() => []),
        Api.get('/assessments?limit=50').catch(() => []),
      ]);
      const push = (type: ArtifactType, id: unknown, title: unknown, status?: unknown) => {
        const sid = String(id || '').trim();
        const stitle = String(title || '').trim();
        if (!sid || !stitle) return;
        all.push({ type, id: sid, title: stitle, status: status ? String(status) : undefined });
      };
      if (tasks.status === 'fulfilled') {
        const arr = Array.isArray(tasks.value) ? tasks.value : (tasks.value as any)?.tasks || [];
        arr.forEach((t: any) => push('task', t.id, t.title || t.name, t.status));
      }
      if (initiatives.status === 'fulfilled' && Array.isArray(initiatives.value)) {
        initiatives.value.forEach((i: any) =>
          push('initiative', i.id, i.title || i.name, i.status)
        );
      }
      if (decisions.status === 'fulfilled' && Array.isArray(decisions.value)) {
        decisions.value.forEach((d: any) => push('decision', d.id, d.title || d.name, d.status));
      }
      if (assessments.status === 'fulfilled' && Array.isArray(assessments.value)) {
        assessments.value.forEach((a: any) =>
          push('assessment', a.id, a.name || a.title, a.status)
        );
      }
      artifactCacheRef.current = all;
      cache = all;
    }
    const q = query.toLowerCase();
    setArtifactSearchResults(
      cache
        .filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.type.toLowerCase().includes(q) ||
            buildArtifactCode(r.type, r.id).toLowerCase().includes(q)
        )
        .slice(0, 12)
    );
  }, []);

  const handleArtifactAttach = useCallback(
    async (ref: { type: ArtifactType; id: string; title: string }) => {
      if (!currentQuestion) return;
      const label = getArtifactLabel(ref.type, isPolish ? 'pl' : 'en');
      const code = buildArtifactCode(ref.type, ref.id);
      await onAddLink(
        `${label}: ${ref.title}`,
        `artifact://${ref.type}/${ref.id}`,
        `${code} — ${ref.title}`,
        currentQuestion.category,
        currentQuestion.id
      );
      setArtifactPopoverOpen(false);
      toast.success(t('interview.singleQuestionRuntime.linkedColon', { title: ref.title }));
    },
    [currentQuestion, isPolish, onAddLink]
  );

  const handleAiImprove = useCallback(
    async (mode: string = 'improve') => {
      if (!currentQuestion || !answerDraft.trim() || aiImproving) return;
      setAiImproving(true);
      setAiImproveResult(null);
      setAiDropdownOpen(false);
      try {
        const res = await fetch(`${API_URL}/interview/questions/${currentQuestion.id}/ai-improve`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            answerText: answerDraft.trim(),
            language: isPolish ? 'pl' : 'en',
            mode,
          }),
        });
        if (!res.ok) throw new Error('AI improve failed');
        const data = await res.json();
        if (data.improvedText) {
          setAiImproveResult(data);
        }
      } catch {
        toast.error(t('interview.singleQuestionRuntime.failedToImproveAnswer'));
      } finally {
        setAiImproving(false);
      }
    },
    [currentQuestion, answerDraft, aiImproving, isPolish]
  );

  const handleAiExplain = useCallback(async () => {
    if (!currentQuestion || aiExplaining) return;
    if (aiExplainResult) {
      setAiExplainResult(null);
      return;
    }
    setAiExplaining(true);
    try {
      const res = await fetch(`${API_URL}/interview/questions/${currentQuestion.id}/ai-explain`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ language: isPolish ? 'pl' : 'en' }),
      });
      if (!res.ok) throw new Error('AI explain failed');
      const data = await res.json();
      if (data.explanation) {
        setAiExplainResult(data);
      }
    } catch {
      toast.error(t('interview.singleQuestionRuntime.failedToExplainQuestion'));
    } finally {
      setAiExplaining(false);
    }
  }, [currentQuestion, aiExplaining, aiExplainResult, isPolish]);

  const stopRecording = useCallback(() => {
    speechRecognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (!currentQuestion || isRecording || isTranscribing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      liveTranscriptRef.current = '';
      liveInterimRef.current = '';

      const SpeechRecognitionAPI =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.lang = t('interview.singleQuestionRuntime.enUs');
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (e: any) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
              liveTranscriptRef.current += e.results[i][0].transcript + ' ';
            } else {
              interim += e.results[i][0].transcript;
            }
          }
          // Keep interim mirrored in a ref so Stop can flush it (see liveInterimRef).
          liveInterimRef.current = interim;
          setLiveInterim(interim);
        };
        recognition.onerror = () => {};
        recognition.onend = () => {
          speechRecognitionRef.current = null;
          setLiveInterim('');
        };
        recognition.start();
        speechRecognitionRef.current = recognition;
      }

      if (typeof MediaRecorder !== 'undefined') {
        const pickSupportedMimeType = (): string | undefined => {
          const candidates = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg',
            // Safari often supports MediaRecorder only as audio/mp4.
            'audio/mp4',
          ];
          for (const c of candidates) {
            try {
              if ((MediaRecorder as any).isTypeSupported?.(c)) return c;
            } catch {
              // ignore
            }
          }
          return undefined;
        };

        const mimeHint = pickSupportedMimeType();
        const recorder = new MediaRecorder(stream, mimeHint ? { mimeType: mimeHint } : undefined);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };

        recorder.onstop = async () => {
          setIsRecording(false);
          setLiveInterim('');
          mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
          if (!currentQuestion) return;

          const mimeType = recorder.mimeType || mimeHint || 'audio/webm';
          const extensionForMime = (mt: string): string => {
            const m = String(mt || '').toLowerCase();
            if (m.includes('audio/mp4') || m.includes('video/mp4') || m.includes('mp4'))
              return 'm4a';
            if (m.includes('ogg')) return 'ogg';
            if (m.includes('webm')) return 'webm';
            return 'webm';
          };
          const ext = extensionForMime(mimeType);
          const audioBlob = new Blob(chunksRef.current, { type: mimeType });
          const audioFile = new File([audioBlob], `interview-answer-${currentQuestion.id}.${ext}`, {
            type: mimeType,
          });
          // Merge any not-yet-final interim tail — otherwise the text the user
          // saw on screen is silently dropped when STT also fails (the "ładnie
          // się napisało, a nie wkleiło" prod bug).
          const browserTranscript = `${liveTranscriptRef.current} ${liveInterimRef.current || ''}`
            .replace(/\s+/g, ' ')
            .trim();

          setIsTranscribing(true);
          try {
            const formData = new FormData();
            formData.append('audio', audioFile);
            formData.append('language', isPolish ? 'pl' : 'en');
            const hdrs = { ...getHeaders() };
            delete hdrs['Content-Type'];

            const response = await fetch(`${API_URL}/voice/stt`, {
              method: 'POST',
              headers: hdrs,
              body: formData,
            });
            const data = await response.json();

            const serverText = response.ok && data?.text ? String(data.text).trim() : '';
            const finalText = serverText || browserTranscript;

            if (!finalText) throw new Error('No transcript produced');

            // Insert inline at the cursor (append, never overwrite) — the main answer field
            // IS the review surface, so no separate approval window is opened.
            insertIntoAnswer(finalText);
            setVoiceTranscriptDraft(finalText);

            const created = await onAddVoiceEvidence(
              audioFile,
              finalText,
              currentQuestion.category,
              currentQuestion.id
            );
            await onUpdateQuestion(currentQuestion.id, {
              answerMode: 'voice_answer',
              voiceTranscript: finalText,
              voiceTranscriptStatus: 'approved',
              voiceAudioEvidenceId: created?.id,
              status: 'in_progress',
            });

            toast.success(
              t(
                !serverText && browserTranscript
                  ? 'interview.singleQuestionRuntime.transcriptAddedBrowser'
                  : 'interview.singleQuestionRuntime.transcriptAdded'
              )
            );
          } catch (error) {
            if (browserTranscript) {
              insertIntoAnswer(browserTranscript);
              setVoiceTranscriptDraft(browserTranscript);
              await onUpdateQuestion(currentQuestion.id, {
                answerMode: 'voice_answer',
                voiceTranscript: browserTranscript,
                voiceTranscriptStatus: 'approved',
                status: 'in_progress',
              });
              toast.success(t('interview.singleQuestionRuntime.transcriptAddedBrowser'));
            } else {
              // Nothing to save: server STT failed AND the browser produced no
              // transcript (no speech captured, or Web Speech unsupported). No
              // data is lost here — there simply was no text. Tell the user
              // plainly so they type the answer instead of assuming it vanished.
              console.error('[InterviewSingleQuestionRuntime] Voice transcription failed:', error);
              toast.error(t('interview.singleQuestionRuntime.noSpeechWasRecognisedType'));
            }
          } finally {
            setIsTranscribing(false);
          }
        };

        recorder.start();
      }

      setIsRecording(true);
    } catch (error) {
      toast.error(t('interview.singleQuestionRuntime.microphoneAccessIsUnavailable'));
      console.error('[InterviewSingleQuestionRuntime] Recording failed:', error);
    }
  }, [
    currentQuestion,
    insertIntoAnswer,
    isPolish,
    isRecording,
    isTranscribing,
    onAddVoiceEvidence,
    onUpdateQuestion,
  ]);

  const renderedInput = useMemo(() => {
    if (!currentQuestion) return null;

    const normalizedType = normalizeAnswerType(currentQuestion.answerType);

    if (
      QUESTION_INPUT_TYPES.yesNo.has(normalizedType) ||
      QUESTION_INPUT_TYPES.singleChoice.has(normalizedType)
    ) {
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
                    ? 'bg-c-surface text-white border-c-info'
                    : 'bg-c-surface border-c-border text-c-text-secondary hover:border-c-info'
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
                    ? 'bg-c-surface text-white border-c-info'
                    : 'bg-c-surface border-c-border text-c-text-secondary hover:border-c-info'
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
                className={`w-12 h-12 rounded-xl border text-sm font-semibold transition-all ${
                  selected
                    ? 'bg-c-surface text-white border-c-info'
                    : 'bg-c-surface border-c-border text-c-text-secondary hover:border-c-info'
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
            className="w-full flex items-center justify-between rounded-xl border border-c-border bg-c-surface px-4 py-3 text-base text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            <span className={answerDraft ? '' : 'text-c-text-secondary'}>
              {answerDraft || t('interview.singleQuestionRuntime.selectAnOption')}
            </span>
            <ChevronDown
              size={16}
              className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {dropdownOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-c-border bg-c-surface shadow-xl max-h-60 overflow-y-auto">
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
                      ? 'bg-c-info/10 dark:bg-c-info/10 text-c-info dark:text-c-info font-medium'
                      : 'text-c-text-secondary hover:bg-c-bg dark:hover:bg-c-surface'
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
          <Calendar size={18} className="text-c-text-secondary shrink-0" />
          <input
            type="date"
            value={answerDraft}
            onChange={(event) => {
              setInputMode('text_answer');
              setAnswerDraft(event.target.value);
            }}
            disabled={readOnly}
            className="w-full rounded-xl border border-c-border bg-c-surface px-4 py-3 text-base text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
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
          className="w-full rounded-xl border border-c-border bg-c-surface px-4 py-3 text-base text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          placeholder={t('interview.singleQuestionRuntime.enterAValue')}
        />
      );
    }

    return (
      <textarea
        ref={answerTextareaRef}
        value={answerDraft}
        onChange={(event) => {
          setInputMode('text_answer');
          setAnswerDraft(event.target.value);
        }}
        onPaste={handleAnswerPaste}
        disabled={readOnly}
        rows={QUESTION_INPUT_TYPES.shortText.has(normalizedType) ? 2 : immersive ? 5 : 7}
        className={`w-full rounded-xl border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-c-focus ${
          immersive
            ? 'border-c-border-strong bg-c-bg dark:border-white/[0.06] dark:bg-white/[0.02] text-c-text placeholder:text-c-text-muted dark:placeholder:text-c-text-muted'
            : 'border-c-border bg-c-surface text-c-text'
        }`}
        placeholder={t('interview.singleQuestionRuntime.writeTheAnswerOrRecord')}
      />
    );
  }, [
    currentQuestion,
    currentQuestionOptions,
    answerDraft,
    readOnly,
    isPolish,
    dropdownOpen,
    immersive,
    handleAnswerPaste,
  ]);

  const activeCategoryConfig = currentQuestion
    ? CATEGORY_CONFIG[currentQuestion.category] || CATEGORY_CONFIG.general
    : undefined;
  const answeredCount = orderedQuestions.filter(
    (question) => question.status === 'answered'
  ).length;
  const categoryPosition = currentQuestion
    ? categoryQuestions.findIndex((question) => question.id === currentQuestion.id) + 1
    : 0;
  const isLastQuestion = !nextQuestion;
  const requiredMissing = orderedQuestions.filter((q) => q.isRequired && q.status !== 'answered');
  const navRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll active question into view in nav.
  useEffect(() => {
    if (!immersive || !navRef.current || !currentQuestionId) return;
    const el = navRef.current.querySelector(`[data-qid="${currentQuestionId}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentQuestionId, immersive]);

  // Close AI dropdown on click outside
  useEffect(() => {
    if (!aiDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (aiDropdownRef.current && !aiDropdownRef.current.contains(e.target as Node)) {
        setAiDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aiDropdownOpen]);

  if (!currentQuestion && runtimeView !== 'review') {
    return (
      <div className="rounded-xl border border-c-border/70 bg-white/80 dark:bg-c-surface/80 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-c-surface-raised">
          <FileText size={24} className="text-c-text-secondary" />
        </div>
        <p className="text-sm text-c-text-muted">
          {t('interview.singleQuestionRuntime.noQuestionsAreAvailableIn')}
        </p>
      </div>
    );
  }

  // ---- Review screen ----
  if (runtimeView === 'review') {
    const completionPct =
      orderedQuestions.length > 0 ? Math.round((answeredCount / orderedQuestions.length) * 100) : 0;
    return (
      <div className={`space-y-4 ${immersive ? 'max-w-3xl mx-auto px-6 py-8' : ''}`}>
        <div className="rounded-xl border border-c-border/70 bg-white/80 dark:bg-c-surface/80 backdrop-blur-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-c-text">
                {t('interview.singleQuestionRuntime.reviewBeforeSubmitting')}
              </h2>
              <div className="flex items-center gap-3 mt-2">
                <div className="w-32 h-1.5 rounded-full bg-c-surface-raised overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${completionPct === 100 ? 'bg-emerald-500' : 'bg-c-surface'}`}
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
                <span className="text-sm tabular-nums text-c-text-muted">
                  {answeredCount}/{orderedQuestions.length} ({completionPct}%)
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRuntimeView('answering')}
              className="inline-flex items-center gap-2 rounded-xl border border-c-border px-4 py-2 text-sm font-medium text-c-text-secondary"
            >
              <ArrowLeft size={14} />
              {t('interview.singleQuestionRuntime.backToQuestions')}
            </button>
          </div>

          {requiredMissing.length > 0 && (
            <div className="mb-4 rounded-xl border border-danger-200/70 dark:border-danger-500/20 bg-danger-50/70 dark:bg-danger-500/10 px-4 py-3">
              <p className="text-sm font-medium text-danger-600 dark:text-danger-400">
                <CircleAlert size={14} className="inline mr-1.5 -mt-0.5" />
                {t('interview.singleQuestionRuntime.requiredQuestionsUnanswered', {
                  count: requiredMissing.length,
                })}
              </p>
            </div>
          )}

          <div className="space-y-1">
            {immersive ? (
              /* Flat question list for immersive mode */
              <div className="rounded-xl border border-c-border overflow-hidden divide-y divide-c-border dark:divide-c-border">
                {orderedQuestions.map((q, idx) => {
                  const answered = q.status === 'answered';
                  const snippet = q.answerText
                    ? q.answerText.length > 80
                      ? q.answerText.slice(0, 80) + '…'
                      : q.answerText
                    : '';
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setRuntimeView('answering');
                        setCurrentQuestionId(q.id);
                      }}
                      className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-c-bg dark:hover:bg-c-surface/50 transition-colors"
                    >
                      <span
                        className={`shrink-0 mt-0.5 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold ${
                          answered
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : q.isRequired
                              ? 'bg-danger-500/10 text-danger-500'
                              : 'bg-c-surface-raised text-c-text-secondary'
                        }`}
                      >
                        {answered ? <Check size={10} /> : idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-c-text-secondary truncate">{q.questionText}</p>
                        {snippet && (
                          <p className="text-xs text-c-text-secondary truncate mt-0.5">{snippet}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Category-grouped list for non-immersive mode */
              CATEGORY_ORDER.map((cat) => {
                const catInfo = categorySummary.get(cat);
                if (!catInfo) return null;
                const catConfig = CATEGORY_CONFIG[cat];
                const catQs = orderedQuestions.filter((q) => q.category === cat);
                return (
                  <div key={cat} className="rounded-xl border border-c-border overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-c-bg/60 dark:bg-c-bg/40">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${catConfig.bgColor} ${catConfig.color}`}
                      >
                        <catConfig.icon size={11} />
                        {t(`interview.workspace.categoryLabel.${cat}`, catConfig.labelEn)}
                      </span>
                      <span className="text-xs text-c-text-secondary">
                        {catInfo.answered}/{catInfo.total}
                      </span>
                      {catInfo.answered === catInfo.total && catInfo.total > 0 && (
                        <Check size={12} className="text-emerald-500" />
                      )}
                    </div>
                    <div className="divide-y divide-c-border dark:divide-c-border">
                      {catQs.map((q) => {
                        const answered = q.status === 'answered';
                        const snippet = q.answerText
                          ? q.answerText.length > 80
                            ? q.answerText.slice(0, 80) + '…'
                            : q.answerText
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
                            className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-c-bg dark:hover:bg-c-surface/50 transition-colors"
                          >
                            <div className="mt-0.5 shrink-0">
                              {answered ? (
                                <Check size={14} className="text-emerald-500" />
                              ) : q.isRequired ? (
                                <CircleAlert size={14} className="text-danger-400" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border-2 border-c-border-strong" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-c-text-secondary truncate">
                                {q.questionText}
                              </p>
                              {snippet && (
                                <p className="text-xs text-c-text-secondary truncate mt-0.5">
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
              })
            )}
          </div>
        </div>

        <div className="sticky bottom-0 z-20 -mx-6 px-6 pb-4 pt-3 bg-gradient-to-t from-white via-white dark:from-c-bg dark:via-c-bg to-transparent">
          <div className="rounded-xl border border-c-border/70 bg-white/90 dark:bg-c-surface/90 backdrop-blur-xl p-4 shadow-xl shadow-c-border-strong/40">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRuntimeView('answering')}
                className="inline-flex items-center gap-2 rounded-xl border border-c-border px-4 py-2.5 text-sm font-medium text-c-text-secondary hover:bg-c-bg dark:hover:bg-c-surface-raised transition-colors"
              >
                <ArrowLeft size={16} />
                {t('interview.singleQuestionRuntime.backToQuestions')}
              </button>
              <button
                type="button"
                onClick={() => void onSubmitSession()}
                disabled={readOnly || isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50 shadow-lg shadow-emerald-500/25 transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {isSubmitting
                  ? t('interview.singleQuestionRuntime.submitting')
                  : t('interview.singleQuestionRuntime.submit')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  // ---- Main answering view ----
  return (
    <div className={`flex ${immersive ? 'h-full' : 'gap-4'}`} ref={mainContentRef}>
      {/* Left navigation */}
      {immersive ? (
        /* ── Immersive: flat question list nav ── */
        <nav
          ref={navRef}
          className="hidden md:flex flex-col w-72 shrink-0 border-r border-white/[0.06] bg-white/[0.02] dark:bg-white/[0.01]"
          role="navigation"
          aria-label={t('interview.singleQuestionRuntime.questionNavigation')}
        >
          {/* Header with progress */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-c-text-secondary">
                {t('interview.singleQuestionRuntime.questions')}
              </p>
              <span
                className={`text-[10px] font-semibold tabular-nums ${
                  answeredCount === orderedQuestions.length
                    ? 'text-emerald-500'
                    : 'text-c-text-secondary'
                }`}
              >
                {answeredCount}/{orderedQuestions.length}
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${answeredCount === orderedQuestions.length ? 'bg-emerald-500' : 'bg-c-surface'}`}
                style={{
                  width: `${orderedQuestions.length > 0 ? (answeredCount / orderedQuestions.length) * 100 : 0}%`,
                }}
              />
            </div>
            {answeredCount < orderedQuestions.length && (
              <p className="text-[10px] text-c-text-secondary mt-1.5">
                {orderedQuestions.length - answeredCount}{' '}
                {t('interview.singleQuestionRuntime.remaining')}
              </p>
            )}
          </div>

          {/* Question list */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {orderedQuestions.map((q, idx) => {
              const isCurrent = q.id === currentQuestionId;
              const isAnswered = q.status === 'answered';
              return (
                <button
                  key={q.id}
                  type="button"
                  data-qid={q.id}
                  onClick={() => navigateToQuestion(q)}
                  className={`w-full flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all ${
                    isCurrent
                      ? 'bg-c-info/10 dark:bg-c-info/15 ring-1 ring-c-focus'
                      : isAnswered
                        ? 'opacity-50 hover:opacity-80'
                        : 'hover:bg-c-bg dark:hover:bg-c-surface/50'
                  }`}
                >
                  <span
                    className={`shrink-0 mt-0.5 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold ${
                      isCurrent
                        ? 'bg-c-surface text-white'
                        : isAnswered
                          ? 'bg-emerald-500 text-white'
                          : 'bg-c-surface-raised/80 dark:bg-c-surface-raised text-c-text-muted'
                    }`}
                  >
                    {isAnswered ? <Check size={10} /> : idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`text-[11px] leading-snug line-clamp-2 block ${
                        isCurrent
                          ? 'text-c-info dark:text-c-info font-medium'
                          : isAnswered
                            ? 'text-c-text-muted line-through decoration-c-border-strong dark:decoration-c-border-strong'
                            : 'text-c-text-secondary font-medium'
                      }`}
                    >
                      {q.questionText}
                    </span>
                    {isAnswered && q.answerText && (
                      <span className="text-[10px] text-c-text-muted truncate block mt-0.5">
                        {q.answerText.length > 50 ? q.answerText.slice(0, 50) + '…' : q.answerText}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom actions */}
          <div className="shrink-0 border-t border-c-border px-3 py-2.5 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                void persistCurrentQuestion();
                setRuntimeView('review');
              }}
              aria-label={t('interview.singleQuestionRuntime.goToReview')}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-c-text-muted hover:bg-c-bg dark:hover:bg-c-surface/50 w-full text-left transition-colors"
            >
              <ClipboardList size={13} />
              {t('interview.singleQuestionRuntime.review')}
            </button>
            {onSaveAndExit && (
              <button
                type="button"
                onClick={() => {
                  void persistCurrentQuestion().then(() => onSaveAndExit?.());
                }}
                aria-label={t('interview.singleQuestionRuntime.saveAndExit')}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-c-text-muted hover:bg-c-bg dark:hover:bg-c-surface/50 w-full text-left transition-colors"
              >
                <LogOut size={13} />
                {t('interview.singleQuestionRuntime.saveExit')}
              </button>
            )}
          </div>
        </nav>
      ) : (
        /* ── Non-immersive: category-based nav (legacy) ── */
        <nav
          className="hidden md:flex flex-col w-48 shrink-0 space-y-1"
          role="navigation"
          aria-label={t('interview.singleQuestionRuntime.categoryNavigation')}
        >
          {sessionName && (
            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-c-text-secondary truncate">
              {sessionName}
            </p>
          )}
          {CATEGORY_ORDER.map((cat) => {
            const catInfo = categorySummary.get(cat);
            if (!catInfo) return null;
            const catConfig = CATEGORY_CONFIG[cat];
            const isActive = cat === activeCategory;
            const isDone = catInfo.answered === catInfo.total && catInfo.total > 0;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                aria-current={isActive ? 'step' : undefined}
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition-all ${
                  isActive
                    ? 'bg-c-info/10 dark:bg-c-info/15 text-c-info dark:text-c-info font-medium'
                    : 'text-c-text-muted hover:bg-c-bg dark:hover:bg-c-surface/50'
                }`}
              >
                <span className="truncate">
                  {t(`interview.workspace.categoryLabel.${cat}`, catConfig.labelEn)}
                </span>
                <span
                  className={`text-[10px] tabular-nums shrink-0 ${isDone ? 'text-emerald-500' : ''}`}
                >
                  {catInfo.answered}/{catInfo.total}
                </span>
              </button>
            );
          })}
          <div className="!mt-auto border-t border-c-border pt-3">
            <button
              type="button"
              onClick={() => {
                void persistCurrentQuestion();
                setRuntimeView('review');
              }}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-c-text-muted hover:bg-c-bg dark:hover:bg-c-surface/50 w-full text-left transition-colors"
            >
              <ClipboardList size={13} />
              {t('interview.singleQuestionRuntime.review')}
            </button>
            {onSaveAndExit && (
              <button
                type="button"
                onClick={() => {
                  void persistCurrentQuestion().then(() => onSaveAndExit?.());
                }}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-c-text-muted hover:bg-c-bg dark:hover:bg-c-surface/50 w-full text-left transition-colors"
              >
                <LogOut size={13} />
                {t('interview.singleQuestionRuntime.saveExit')}
              </button>
            )}
          </div>
        </nav>
      )}

      {/* Mobile: horizontal question pills (immersive) or category pills (legacy) */}
      {!immersive && (
        <div
          className="md:hidden absolute left-0 right-0 -mt-2 mb-2"
          style={{ position: 'relative' }}
        >
          <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-hide" role="navigation">
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
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
                    isActive
                      ? `${catConfig.bgColor} ${catConfig.color} ring-1 ring-current/20`
                      : 'bg-c-surface-raised text-c-text-muted'
                  }`}
                >
                  {t(`interview.workspace.categoryLabel.${cat}`, catConfig.labelEn)}
                  <span
                    className={`text-[10px] tabular-nums ${catInfo.answered === catInfo.total && catInfo.total > 0 ? 'text-emerald-500' : ''}`}
                  >
                    {catInfo.answered}/{catInfo.total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Center content */}
      <div
        className={`flex-1 min-w-0 flex flex-col ${immersive ? 'overflow-hidden' : 'space-y-4'}`}
      >
        {/* Progress indicator */}
        {!immersive && (
          <div className="flex items-center gap-3">
            {activeCategoryConfig && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${activeCategoryConfig.bgColor} ${activeCategoryConfig.color}`}
              >
                {t(
                  `interview.workspace.categoryLabel.${currentQuestion?.category}`,
                  activeCategoryConfig.labelEn
                )}
              </span>
            )}
            <span className="text-xs tabular-nums text-c-text-secondary">
              {currentIndex + 1} / {orderedQuestions.length}
            </span>
            <div className="flex-1 h-1 rounded-full bg-c-surface-raised overflow-hidden">
              <div
                className="h-full rounded-full bg-c-info/60 transition-all duration-300"
                style={{
                  width: `${orderedQuestions.length > 0 ? (answeredCount / orderedQuestions.length) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-xs tabular-nums text-c-text-secondary">
              {answeredCount}/{orderedQuestions.length}
            </span>
          </div>
        )}

        {/* Question card — scrollable area, bottom bar stays fixed */}
        <div className={immersive ? 'flex-1 min-h-0 overflow-y-auto' : ''}>
          <div
            className={
              immersive ? 'flex justify-center px-8 py-6 md:px-16 lg:px-24 min-h-full' : ''
            }
          >
            <div
              key={currentQuestion.id}
              className={`w-full ${immersive ? 'max-w-4xl' : 'max-w-3xl'} ${
                immersive
                  ? 'bg-white dark:bg-white/[0.02] border border-c-border dark:border-white/[0.03] rounded-2xl shadow-sm shadow-c-border-strong/50 dark:shadow-none backdrop-blur-sm p-6 md:p-8 lg:p-10'
                  : 'rounded-2xl border border-c-border/70 bg-gradient-to-br from-white via-white to-c-bg dark:from-c-surface dark:via-c-surface dark:to-c-bg p-6 md:p-8 shadow-xl shadow-c-border-strong/50'
              }`}
            >
              <div className={immersive ? 'max-w-2xl mx-auto space-y-5' : 'space-y-5'}>
                {/* Question header */}
                <div className="space-y-4">
                  {/* Top meta row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold tabular-nums ${
                          immersive
                            ? 'bg-c-info/15 text-c-info ring-1 ring-c-focus'
                            : 'bg-c-info/10 dark:bg-c-info/15 text-c-info dark:text-c-info'
                        }`}
                      >
                        {currentIndex + 1}
                      </span>
                      <span className="text-xs text-c-text-secondary tabular-nums">
                        {t('interview.singleQuestionRuntime.of')} {orderedQuestions.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const typeInfo = getAnswerTypeLabel(currentQuestion.answerType, t);
                        const TypeIcon =
                          typeInfo.icon === 'hash'
                            ? Hash
                            : typeInfo.icon === 'check'
                              ? Check
                              : typeInfo.icon === 'calendar'
                                ? Calendar
                                : Type;
                        return (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                              immersive
                                ? 'bg-white/[0.04] text-c-text-secondary ring-1 ring-white/[0.06]'
                                : 'bg-c-surface-raised text-c-text-muted'
                            }`}
                          >
                            <TypeIcon size={10} />
                            {typeInfo.label}
                          </span>
                        );
                      })()}
                      {currentQuestion.isRequired && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            immersive
                              ? 'bg-danger-500/10 text-danger-400 ring-1 ring-danger-500/15'
                              : 'bg-danger-500/10 text-danger-600 dark:text-danger-400'
                          }`}
                        >
                          <CircleAlert size={10} />
                          {t('interview.singleQuestionRuntime.required')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question text — adaptive size for long descriptive questions */}
                  <div className="flex items-start gap-2.5">
                    <h2
                      className={`flex-1 font-semibold leading-snug text-c-text ${
                        currentQuestion.questionText.length > 120
                          ? immersive
                            ? 'text-lg md:text-xl'
                            : 'text-lg md:text-xl'
                          : immersive
                            ? 'text-2xl md:text-[28px]'
                            : 'text-2xl md:text-3xl'
                      }`}
                    >
                      {currentQuestion.questionText}
                    </h2>

                    {/* Pulsing guidance affordance — "press me" hint icon */}
                    <button
                      type="button"
                      onClick={openGuidance}
                      title={t('interview.singleQuestionRuntime.howToAnswer')}
                      aria-label={t('interview.singleQuestionRuntime.showGuidanceAndExample')}
                      aria-expanded={guidanceOpen}
                      className={`relative shrink-0 mt-1 inline-flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${
                        guidanceOpen
                          ? 'border-amber-400/50 bg-amber-400/15 text-amber-500 dark:text-amber-300'
                          : immersive
                            ? 'border-white/[0.08] bg-white/[0.04] text-amber-400/80 hover:bg-white/[0.08]'
                            : 'border-amber-200/70 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/15'
                      }`}
                    >
                      {!guidanceSeen && !guidanceOpen && (
                        <span className="absolute inset-0 rounded-full ring-2 ring-amber-400/50 animate-ping" />
                      )}
                      <Lightbulb
                        size={15}
                        className={!guidanceSeen && !guidanceOpen ? 'animate-pulse' : ''}
                      />
                    </button>
                  </div>

                  {/* #48B — "poprzednia wersja": previous answer snapshot(s) from
                      before a send-back, so a reviewer can see what changed on
                      re-submit. `answerHistoryByQuestionId` is only populated by
                      the parent in reviewer mode (see InterviewWorkspace.tsx), so
                      this is effectively reviewer-facing without needing its own
                      `readOnly` gate — and it no-ops whenever the assignment was
                      never sent back (no history rows for this question). */}
                  {(() => {
                    const history = answerHistoryByQuestionId?.[currentQuestion.id];
                    if (!history || history.length === 0) return null;
                    const isOpen = historyOpenId === currentQuestion.id;
                    return (
                      <div>
                        <button
                          type="button"
                          onClick={() => setHistoryOpenId(isOpen ? null : currentQuestion.id)}
                          aria-expanded={isOpen}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted transition-colors"
                          title={t('interview.singleQuestionRuntime.answerContentSavedBeforeIt')}
                        >
                          <History size={12} />
                          {t('interview.singleQuestionRuntime.previousVersionCount', {
                            count: history.length,
                          })}
                          <ChevronDown
                            size={12}
                            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          />
                        </button>
                        {isOpen && (
                          <div className="mt-2 space-y-2 rounded-xl border border-c-border bg-c-bg/60 p-3">
                            {history.map((entry) => (
                              <div key={entry.id} className="space-y-1">
                                <div className="text-[10px] uppercase tracking-wide text-c-text-muted">
                                  {new Date(entry.savedAt).toLocaleString(
                                    t('interview.singleQuestionRuntime.enUs')
                                  )}
                                </div>
                                <p className="text-xs leading-relaxed text-c-text-secondary whitespace-pre-wrap">
                                  {entry.answerText?.trim() ||
                                    t('interview.singleQuestionRuntime.noAnswer')}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Guidance reveal — static instruction + example, with AI deep-dive fallback */}
                  {guidanceOpen && (
                    <div
                      className={`rounded-xl border p-4 space-y-3 ${
                        immersive
                          ? 'border-amber-500/15 bg-amber-500/[0.06]'
                          : 'border-amber-200/70 dark:border-amber-500/15 bg-amber-50/70 dark:bg-amber-500/[0.06]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
                          <Lightbulb size={11} />
                          {t('interview.singleQuestionRuntime.howToAnswer2')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setGuidanceOpen(false)}
                          aria-label={t('interview.singleQuestionRuntime.close')}
                          className="text-amber-500/70 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
                        >
                          <X size={13} />
                        </button>
                      </div>

                      <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100/90">
                        {questionGuidance?.instruction ||
                          t('interview.singleQuestionRuntime.answerSpecificallyInYourOwn')}
                      </p>

                      {questionGuidance?.expected && (
                        <p className="text-xs text-amber-700/90 dark:text-amber-300/80">
                          {t('interview.singleQuestionRuntime.expectedFormat')}
                          <span className="font-medium">{questionGuidance.expected}</span>
                        </p>
                      )}

                      {questionGuidance?.example && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-500 dark:text-amber-400">
                            {t('interview.singleQuestionRuntime.example')}
                          </p>
                          <p className="text-xs leading-relaxed italic text-amber-800 dark:text-amber-200/80">
                            &ldquo;{questionGuidance.example}&rdquo;
                          </p>
                        </div>
                      )}

                      {!readOnly && (
                        <button
                          type="button"
                          onClick={handleAiExplain}
                          disabled={aiExplaining}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors disabled:opacity-60"
                        >
                          {aiExplaining ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Sparkles size={11} />
                          )}
                          {aiExplaining
                            ? t('interview.singleQuestionRuntime.analyzing')
                            : aiExplainResult
                              ? t('interview.singleQuestionRuntime.hideAiDeepDive')
                              : t('interview.singleQuestionRuntime.expandWithAiGiveExamples')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Guidance block — hint + evidence grouped before answer */}
                  {(currentQuestion.description ||
                    (currentQuestion as any).helpHint ||
                    currentQuestion.evidencePrompt) && (
                    <div className="space-y-2.5">
                      {(currentQuestion.description || (currentQuestion as any).helpHint) && (
                        <div
                          className={`rounded-xl px-4 py-3 border ${
                            immersive
                              ? 'bg-amber-500/[0.06] border-amber-500/10'
                              : 'bg-amber-50 dark:bg-amber-500/[0.06] border-amber-200/80 dark:border-amber-500/10 shadow-sm shadow-amber-100/40'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <HelpCircle
                              size={15}
                              className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400"
                            />
                            <div className="space-y-1 min-w-0">
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                  immersive
                                    ? 'text-amber-400/70'
                                    : 'text-amber-700 dark:text-amber-400/70'
                                }`}
                              >
                                {t('interview.singleQuestionRuntime.hint')}
                              </span>
                              <p
                                className={`text-sm leading-relaxed ${
                                  immersive
                                    ? 'text-amber-200/90'
                                    : 'text-amber-950 dark:text-amber-200/90'
                                }`}
                              >
                                {currentQuestion.description || (currentQuestion as any).helpHint}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {currentQuestion.evidencePrompt && (
                        <div
                          className={`rounded-xl px-4 py-3 border ${
                            immersive
                              ? 'bg-sky-500/[0.06] border-sky-500/10'
                              : 'bg-sky-50 dark:bg-sky-500/[0.06] border-sky-200/80 dark:border-sky-500/10 shadow-sm shadow-sky-100/40'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <Paperclip
                              size={14}
                              className="mt-0.5 shrink-0 text-sky-500 dark:text-sky-400"
                            />
                            <div className="space-y-1 min-w-0">
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                  immersive
                                    ? 'text-sky-400/70'
                                    : 'text-sky-700 dark:text-sky-400/70'
                                }`}
                              >
                                {t('interview.singleQuestionRuntime.whatWeLookFor')}
                              </span>
                              <p
                                className={`text-sm leading-relaxed ${
                                  immersive
                                    ? 'text-sky-200/90'
                                    : 'text-sky-950 dark:text-sky-200/90'
                                }`}
                              >
                                {currentQuestion.evidencePrompt}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expected answer shape */}
                  {currentQuestion.expectedAnswerShape && (
                    <div
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${
                        immersive
                          ? 'bg-c-info/[0.06] border-c-info/10'
                          : 'bg-c-info/10 dark:bg-c-info/10 border-c-info/80 dark:border-c-info/15 shadow-sm shadow-c-info/5'
                      }`}
                    >
                      <Sparkles size={13} className="shrink-0 text-c-info dark:text-c-info" />
                      <span className="text-xs text-c-info dark:text-c-info">
                        {t('interview.singleQuestionRuntime.expectedFormat2')}{' '}
                        <span className="font-medium">{currentQuestion.expectedAnswerShape}</span>
                      </span>
                    </div>
                  )}

                  {/* AI Explain result (triggered from the guidance panel) */}
                  {aiExplainResult && (
                    <div className="rounded-xl border border-c-info/50 dark:border-c-info/15 bg-c-info/50 dark:bg-c-info/5 p-4 space-y-3">
                      <p className="text-sm text-c-info dark:text-c-info leading-relaxed">
                        {aiExplainResult.explanation}
                      </p>
                      {aiExplainResult.exampleAnswers.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-c-info dark:text-c-info">
                            {t('interview.singleQuestionRuntime.exampleAnswers')}
                          </p>
                          {aiExplainResult.exampleAnswers.map((ex, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-xs text-c-info dark:text-c-info"
                            >
                              <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-c-info/10 flex items-center justify-center text-[9px] font-semibold text-c-info">
                                {i + 1}
                              </span>
                              <span className="leading-relaxed italic">&ldquo;{ex}&rdquo;</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-c-info/70 dark:text-c-info/70 leading-relaxed">
                        <Sparkles size={10} className="inline mr-1 -mt-0.5" />
                        {aiExplainResult.whyItMatters}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Answer composer — supports drag & drop of files/images onto the field */}
                  <div
                    className="relative"
                    onDragOver={(e) => {
                      if (readOnly) return;
                      e.preventDefault();
                      if (!isDraggingFile) setIsDraggingFile(true);
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      setIsDraggingFile(false);
                    }}
                    onDrop={handleAnswerDrop}
                  >
                    {renderedInput}

                    {/* Inline recording indicator (no separate window) */}
                    {isRecording && (
                      <div className="pointer-events-none absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-danger-500/15 border border-danger-500/40 px-2 py-0.5 text-[11px] font-medium text-danger-500 tabular-nums">
                        <span className="w-1.5 h-1.5 rounded-full bg-danger-500 animate-pulse" />
                        {Math.floor(recordingSeconds / 60)}:
                        {String(recordingSeconds % 60).padStart(2, '0')}
                      </div>
                    )}

                    {/* Live interim transcript preview while dictating */}
                    {isRecording && liveInterim && (
                      <p className="mt-1.5 text-xs italic text-c-text-muted">{liveInterim}</p>
                    )}

                    {/* Drag overlay */}
                    {isDraggingFile && !readOnly && (
                      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-c-info bg-c-info/10 backdrop-blur-[1px]">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-c-info dark:text-c-info">
                          <Paperclip size={14} />
                          {t('interview.singleQuestionRuntime.dropToAttach')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* #11c — Per-question instant feedback. Non-blocking inline hint when a
                      free-text answer looks too short. Lets the respondent jump straight
                      into AI Improve. Skipped for choice/rating/number/date inputs. */}
                  {(() => {
                    if (readOnly) return null;
                    // REALNY BUG (fix przy zerowaniu type-checka): lokalne `t`
                    // przesłaniało i18n-owe `t` — dwa t('interview…') niżej
                    // wywoływały STRING jak funkcję → TypeError w runtime,
                    // gdy tylko hint „za krótka odpowiedź" miał się pokazać.
                    const answerTypeNorm = normalizeAnswerType(currentQuestion.answerType);
                    const isFreeText =
                      !QUESTION_INPUT_TYPES.yesNo.has(answerTypeNorm) &&
                      !QUESTION_INPUT_TYPES.singleChoice.has(answerTypeNorm) &&
                      !QUESTION_INPUT_TYPES.multiChoice.has(answerTypeNorm) &&
                      !QUESTION_INPUT_TYPES.rating.has(answerTypeNorm) &&
                      !QUESTION_INPUT_TYPES.dropdown.has(answerTypeNorm) &&
                      !QUESTION_INPUT_TYPES.date.has(answerTypeNorm) &&
                      !QUESTION_INPUT_TYPES.number.has(answerTypeNorm);
                    const trimmed = answerDraft.trim();
                    const tooShort =
                      isFreeText && trimmed.length > 0 && trimmed.length < 20 && !aiImproveResult;
                    if (!tooShort) return null;
                    return (
                      <div className="flex items-start gap-2 rounded-lg border-l-4 border-l-amber-500 border border-amber-300/50 dark:border-amber-500/20 bg-amber-100 dark:bg-amber-500/[0.07] px-3 py-2">
                        <Sparkles
                          size={13}
                          className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400"
                        />
                        <div className="min-w-0 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                          <span>
                            {t('interview.singleQuestionRuntime.thisLooksShortTryAdding')}
                          </span>
                          {trimmed.length >= 3 && (
                            <button
                              type="button"
                              onClick={() => setAiDropdownOpen(true)}
                              className="ml-1.5 font-semibold underline decoration-dotted underline-offset-2 hover:text-amber-800 dark:hover:text-amber-200"
                            >
                              {t('interview.singleQuestionRuntime.useAiToExpand')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Answer toolbar: Record + attachments + AI dropdown (chip standard) ── */}
                  {!readOnly && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImagePicked}
                      />
                      {/* Record voice answer (inline) */}
                      <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isTranscribing}
                        className={`inline-flex items-center gap-1.5 h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] ${
                          isRecording
                            ? 'border-danger-500/40 bg-danger-500/15 text-danger-500 animate-pulse'
                            : immersive
                              ? 'border-c-border bg-white text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-c-text-secondary dark:hover:bg-white/[0.08] dark:hover:text-c-text-muted'
                              : 'border-c-border/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        {isRecording ? <PauseCircle size={11} /> : <Mic size={11} />}
                        {isRecording
                          ? t('interview.singleQuestionRuntime.stop')
                          : t('interview.singleQuestionRuntime.record')}
                      </button>

                      {/* Attach file (inline) */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAttachment}
                        className={`inline-flex items-center gap-1.5 h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] disabled:opacity-60 ${
                          immersive
                            ? 'border-c-border bg-white text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-c-text-secondary dark:hover:bg-white/[0.08] dark:hover:text-c-text-muted'
                            : 'border-c-border/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <Paperclip size={11} />
                        {t('interview.singleQuestionRuntime.file')}
                      </button>

                      {/* Attach image (inline) */}
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={isUploadingAttachment}
                        className={`inline-flex items-center gap-1.5 h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] disabled:opacity-60 ${
                          immersive
                            ? 'border-c-border bg-white text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-c-text-secondary dark:hover:bg-white/[0.08] dark:hover:text-c-text-muted'
                            : 'border-c-border/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        {isUploadingAttachment ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <ImageIcon size={11} />
                        )}
                        {t('interview.singleQuestionRuntime.image')}
                      </button>

                      {/* AI Improve dropdown */}
                      {answerDraft.trim().length >= 3 && !aiImproveResult && (
                        <div className="relative" ref={aiDropdownRef}>
                          <button
                            type="button"
                            onClick={() => setAiDropdownOpen((prev) => !prev)}
                            disabled={aiImproving}
                            className={`inline-flex items-center gap-1.5 h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] ${
                              aiImproving
                                ? immersive
                                  ? 'border-c-info/20 bg-c-info/10 text-c-info'
                                  : 'border-c-info/30 bg-c-info/10 text-c-info dark:text-c-info'
                                : immersive
                                  ? 'border-c-border bg-white text-c-text-secondary hover:bg-c-surface-raised hover:text-c-info dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-c-text-secondary dark:hover:bg-white/[0.08] dark:hover:text-c-info'
                                  : 'border-c-border/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-white/[0.06]'
                            }`}
                          >
                            {aiImproving ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Sparkles size={11} />
                            )}
                            AI
                            {!aiImproving && (
                              <ChevronDown
                                size={10}
                                className={`transition-transform ${aiDropdownOpen ? 'rotate-180' : ''}`}
                              />
                            )}
                          </button>

                          {aiDropdownOpen && !aiImproving && (
                            <div
                              className={`absolute left-0 bottom-full mb-1.5 z-50 w-48 rounded-xl border p-1 shadow-xl ${
                                immersive
                                  ? 'bg-c-surface/95 border-white/[0.08] backdrop-blur-xl'
                                  : 'bg-c-surface border-c-border'
                              }`}
                            >
                              {(
                                [
                                  {
                                    mode: 'improve',
                                    labelPl: 'Popraw i ulepsz',
                                    labelEn: 'Improve & polish',
                                    icon: '✨',
                                  },
                                  {
                                    mode: 'fix_grammar',
                                    labelPl: 'Popraw gramatykę',
                                    labelEn: 'Fix grammar',
                                    icon: '📝',
                                  },
                                  {
                                    mode: 'shorten',
                                    labelPl: 'Skróć',
                                    labelEn: 'Make shorter',
                                    icon: '✂️',
                                  },
                                  {
                                    mode: 'expand',
                                    labelPl: 'Rozwiń',
                                    labelEn: 'Expand & elaborate',
                                    icon: '📖',
                                  },
                                  {
                                    mode: 'formal',
                                    labelPl: 'Ton formalny',
                                    labelEn: 'Formal tone',
                                    icon: '👔',
                                  },
                                ] as const
                              ).map((item) => (
                                <button
                                  key={item.mode}
                                  type="button"
                                  onClick={() => handleAiImprove(item.mode)}
                                  className={`w-full text-left flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] transition-colors ${
                                    immersive
                                      ? 'text-c-text-secondary hover:bg-white/[0.06] hover:text-white'
                                      : 'text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
                                  }`}
                                >
                                  <span className="text-xs">{item.icon}</span>
                                  {t(
                                    `interview.singleQuestionRuntime.aiImproveMode.${item.mode}`,
                                    item.labelEn
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Improve result */}
                  {aiImproveResult && (
                    <div
                      className={`rounded-xl border p-4 space-y-3 ${
                        immersive
                          ? 'border-emerald-500/15 bg-emerald-500/[0.06]'
                          : 'border-emerald-200/50 dark:border-emerald-500/15 bg-emerald-50/50 dark:bg-emerald-500/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
                          {t('interview.singleQuestionRuntime.improvedVersion')}
                        </p>
                        <span className="text-[10px] text-emerald-500/70 dark:text-emerald-400/60">
                          <Sparkles size={9} className="inline mr-0.5 -mt-0.5" />
                          AI
                        </span>
                      </div>
                      <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed whitespace-pre-wrap">
                        {aiImproveResult.improvedText}
                      </p>
                      <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/60 italic">
                        {aiImproveResult.changesSummary}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setAnswerDraft(aiImproveResult.improvedText);
                            setAiImproveResult(null);
                            toast.success(
                              t('interview.singleQuestionRuntime.appliedImprovedVersion')
                            );
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 transition-colors"
                        >
                          <Check size={12} />
                          {t('interview.singleQuestionRuntime.apply')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiImproveResult(null)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            immersive
                              ? 'border-white/[0.08] text-c-text-secondary hover:text-c-text-muted'
                              : 'border-c-border/70 text-c-text-muted hover:bg-c-bg dark:hover:bg-c-surface'
                          }`}
                        >
                          {t('interview.singleQuestionRuntime.dismiss')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline attachments — thumbnails for images, chips for files/audio.
                      Demo seed items (raw `seed_…` ids) are hidden so they don't look tacky. */}
                  {currentEvidence.some(
                    (e) => ['file', 'audio'].includes(e.evidenceType) && !isSeedEvidence(e)
                  ) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {currentEvidence
                        .filter(
                          (e) => ['file', 'audio'].includes(e.evidenceType) && !isSeedEvidence(e)
                        )
                        .map((item) => {
                          const isImage =
                            item.evidenceType === 'file' &&
                            (item.mimeType?.startsWith('image/') ||
                              (item.fileType || '').startsWith('image/'));
                          const isAudio = item.evidenceType === 'audio';
                          if (isImage && item.url) {
                            return (
                              <div
                                key={item.id}
                                className="group relative w-20 h-20 rounded-xl overflow-hidden border border-c-border/70 bg-c-bg"
                              >
                                <img
                                  src={item.url}
                                  alt={item.title || item.name}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  disabled
                                  title={t(
                                    'interview.singleQuestionRuntime.removeFromTheEvidencePanel'
                                  )}
                                  className="absolute top-1 right-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/50 text-white/90 opacity-0 group-hover:opacity-100 transition-opacity cursor-not-allowed"
                                  aria-label={t('interview.singleQuestionRuntime.remove')}
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            );
                          }
                          return (
                            <span
                              key={item.id}
                              className="group inline-flex items-center gap-1.5 rounded-lg border border-c-border/70 bg-white/80 dark:bg-c-surface/80 px-2.5 py-1.5 text-[11px] text-c-text-secondary"
                            >
                              {isAudio ? <Mic size={11} /> : <Paperclip size={11} />}
                              <span className="truncate max-w-[160px]">
                                {cleanEvidenceLabel(
                                  item,
                                  isAudio
                                    ? t('interview.singleQuestionRuntime.recording')
                                    : t('interview.singleQuestionRuntime.attachment')
                                )}
                              </span>
                              <button
                                type="button"
                                disabled
                                title={t(
                                  'interview.singleQuestionRuntime.removeFromTheEvidencePanel'
                                )}
                                className="inline-flex items-center justify-center text-c-text-muted cursor-not-allowed"
                                aria-label={t('interview.singleQuestionRuntime.remove')}
                              >
                                <Trash2 size={11} />
                              </button>
                            </span>
                          );
                        })}
                    </div>
                  )}

                  {voiceNeedsApproval && (
                    <div className="rounded-xl border-l-4 border-l-amber-500 border border-amber-300/50 dark:border-amber-500/20 bg-amber-100 dark:bg-amber-500/10 px-4 py-3 space-y-2">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        {t('interview.singleQuestionRuntime.reviewTheTranscriptAndApprove')}
                      </p>
                      <textarea
                        value={voiceTranscriptDraft}
                        onChange={(e) => setVoiceTranscriptDraft(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-amber-200 dark:border-amber-500/30 bg-c-surface px-3 py-2 text-sm text-c-text-secondary resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setVoiceTranscriptDraft('');
                            setAnswerDraft(currentQuestion?.answerText || '');
                            setInputMode('text_answer');
                            if (currentQuestion) {
                              void onUpdateQuestion(currentQuestion.id, {
                                voiceTranscript: '',
                                voiceTranscriptStatus: 'none',
                                answerMode: 'text_answer',
                                status: currentQuestion.answerText ? 'answered' : 'in_progress',
                              });
                            }
                            toast.success(t('interview.singleQuestionRuntime.transcriptDiscarded'));
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                            immersive
                              ? 'border-white/[0.08] text-c-text-secondary hover:text-c-text-muted'
                              : 'border-c-border/70 text-c-text-muted hover:bg-c-bg dark:hover:bg-c-surface'
                          }`}
                        >
                          <X size={12} />
                          {t('interview.singleQuestionRuntime.discardRetry')}
                        </button>
                        <button
                          type="button"
                          onClick={handleApproveTranscript}
                          aria-label={t('interview.singleQuestionRuntime.approveTranscript')}
                          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white"
                        >
                          <Check size={14} />
                          {t('interview.singleQuestionRuntime.approve')}
                        </button>
                      </div>
                    </div>
                  )}

                  {(inputMode === 'voice_answer' || isTranscribing) && !voiceNeedsApproval && (
                    <div className="rounded-xl border border-c-info/70 dark:border-c-info/20 bg-c-info/70 dark:bg-c-info/10 px-4 py-3 text-sm text-c-info dark:text-c-info">
                      {isTranscribing ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin" />
                          {t('interview.singleQuestionRuntime.transcribingRecording')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <Check size={14} className="text-emerald-500" />
                          {t('interview.singleQuestionRuntime.transcriptApproved')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Evidence prompt is now shown above the answer in the guidance block */}
                </div>

                {/* ── Context capture section (always visible) ── */}
                <div
                  className={`space-y-3 pt-3 border-t ${
                    immersive ? 'border-c-border dark:border-white/[0.06]' : 'border-c-border/40'
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-c-text-secondary">
                    {t('interview.singleQuestionRuntime.additionalContext')}
                  </p>

                  {/* Context note (always visible) */}
                  <textarea
                    value={contextDraft}
                    onChange={(event) => setContextDraft(event.target.value)}
                    disabled={readOnly}
                    rows={1}
                    className={`w-full rounded-xl border px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-c-focus ${
                      immersive
                        ? 'border-c-border-strong bg-c-bg dark:border-white/[0.06] dark:bg-white/[0.03] text-c-text-secondary placeholder:text-c-text-muted dark:placeholder:text-c-text-muted'
                        : 'border-c-border/70 bg-c-surface text-c-text-secondary placeholder:text-c-text-muted dark:placeholder:text-c-text-muted'
                    }`}
                    placeholder={t(
                      'interview.singleQuestionRuntime.commentNuanceClarificationForThis'
                    )}
                  />

                  {/* Action buttons row — platform chip standard (h-8 rounded-full) */}
                  {!readOnly && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFilePicked}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLinkForm((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] ${
                          showLinkForm
                            ? 'border-c-info/30 bg-c-info/10 text-c-info dark:text-c-info'
                            : immersive
                              ? 'border-c-border bg-white text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-c-text-secondary dark:hover:bg-white/[0.08] dark:hover:text-c-text-muted'
                              : 'border-c-border/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <Link2 size={11} />
                        Link
                      </button>

                      <button
                        type="button"
                        onClick={() => setArtifactPopoverOpen(true)}
                        className={`inline-flex items-center gap-1.5 h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] ${
                          immersive
                            ? 'border-c-border bg-white text-c-text-secondary hover:bg-c-surface-raised hover:text-c-info dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-c-text-secondary dark:hover:bg-white/[0.08] dark:hover:text-c-info'
                            : 'border-c-border/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <Waypoints size={11} />
                        {t('interview.singleQuestionRuntime.artifact')}
                      </button>
                    </div>
                  )}

                  {/* Link form (expandable) */}
                  {showLinkForm && !readOnly && (
                    <div className="grid gap-2 md:grid-cols-2 pt-1">
                      <input
                        type="text"
                        value={linkName}
                        onChange={(event) => setLinkName(event.target.value)}
                        className="rounded-xl border border-c-border bg-c-surface px-3 py-2 text-xs text-c-text-secondary focus:outline-none focus:ring-1 focus:ring-c-focus"
                        placeholder={t('interview.singleQuestionRuntime.linkTitle')}
                      />
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(event) => setLinkUrl(event.target.value)}
                        className="rounded-xl border border-c-border bg-c-surface px-3 py-2 text-xs text-c-text-secondary focus:outline-none focus:ring-1 focus:ring-c-focus"
                        placeholder="https://"
                      />
                      <div className="md:col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={handleAddLink}
                          disabled={!linkName.trim() || !linkUrl.trim()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-c-surface px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          <Check size={12} />
                          {t('interview.singleQuestionRuntime.add')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Attached link/artifact chips (files & audio render inline above).
                      Seed demo items (raw `seed_…` ids) are filtered out. */}
                  {currentEvidence.some((e) => e.evidenceType === 'link' && !isSeedEvidence(e)) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {currentEvidence
                        .filter((e) => e.evidenceType === 'link' && !isSeedEvidence(e))
                        .map((item) => {
                          const isArtifact =
                            item.evidenceType === 'link' &&
                            (item.url || '').startsWith('artifact://');
                          const EvidIcon = isArtifact ? Waypoints : Link2;
                          return (
                            <span
                              key={item.id}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] ${
                                isArtifact
                                  ? 'border-c-info/70 dark:border-c-info/20 bg-c-info/50 dark:bg-c-info/5 text-c-info dark:text-c-info'
                                  : 'border-c-border/70 bg-white/80 dark:bg-c-surface/80 text-c-text-secondary'
                              }`}
                            >
                              <EvidIcon size={10} />
                              <span className="truncate max-w-[140px]">
                                {cleanEvidenceLabel(
                                  item,
                                  isArtifact
                                    ? t('interview.singleQuestionRuntime.artifact')
                                    : 'Link'
                                )}
                              </span>
                            </span>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom action row */}
        <div
          className={`shrink-0 ${
            immersive
              ? 'border-t border-white/[0.06] bg-white/[0.02] dark:bg-white/[0.01] backdrop-blur-xl px-8 py-3 md:px-16 lg:px-24'
              : 'rounded-xl border border-c-border/70 bg-white/80 dark:bg-c-surface/80 backdrop-blur-xl p-4'
          }`}
        >
          <div
            className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between ${immersive ? 'max-w-4xl mx-auto' : ''}`}
          >
            <div className="flex items-center gap-2 text-sm text-c-text-muted">
              {hasUnsavedChanges ? (
                <>
                  <Loader2 size={14} className={isPersisting ? 'animate-spin' : ''} />
                  {isPersisting
                    ? t('interview.singleQuestionRuntime.saving')
                    : t('interview.singleQuestionRuntime.unsavedChanges')}
                </>
              ) : autoSaved ? (
                <>
                  <Check size={14} className="text-emerald-500" />
                  <span className="text-emerald-500">
                    {t('interview.singleQuestionRuntime.autoSaved')}
                  </span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  {t('interview.singleQuestionRuntime.saved')}
                </>
              )}
              <span className="text-c-text-secondary dark:text-c-text-secondary mx-1">|</span>
              <span className="text-[11px] text-c-text-secondary">
                Esc={t('interview.singleQuestionRuntime.save')} · Enter=
                {t('interview.singleQuestionRuntime.next')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigateToQuestion(previousQuestion)}
                disabled={!previousQuestion || isPersisting}
                aria-label={t('interview.singleQuestionRuntime.previousQuestion')}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${
                  immersive
                    ? 'border-white/[0.08] text-c-text-secondary hover:text-c-text-muted hover:border-white/[0.15]'
                    : 'border-c-border text-c-text-secondary'
                }`}
              >
                <ArrowLeft size={16} />
                {t('interview.singleQuestionRuntime.back')}
              </button>

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => void persistCurrentQuestion()}
                  disabled={isPersisting}
                  aria-label={t('interview.singleQuestionRuntime.saveAnswer')}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${
                    immersive
                      ? 'border-c-info/20 bg-c-info/10 text-c-info hover:bg-c-info/15'
                      : 'border-c-info/30 bg-c-info/10 text-c-info dark:text-c-info'
                  }`}
                >
                  {isPersisting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  {t('interview.singleQuestionRuntime.save2')}
                </button>
              )}

              {isLastQuestion ? (
                <button
                  type="button"
                  onClick={() => {
                    void persistCurrentQuestion().then(() => setRuntimeView('review'));
                  }}
                  disabled={readOnly || isPersisting}
                  aria-label={t('interview.singleQuestionRuntime.reviewAndSubmit')}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  <ClipboardList size={16} />
                  {t('interview.singleQuestionRuntime.reviewSubmit')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateToQuestion(nextQuestion)}
                  disabled={!nextQuestion || isPersisting}
                  aria-label={t('interview.singleQuestionRuntime.nextQuestion')}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                    immersive
                      ? 'bg-c-surface text-white shadow-lg shadow-c-info/20 hover:bg-c-info'
                      : 'bg-c-surface-raised dark:bg-white text-white dark:text-c-text'
                  }`}
                >
                  {t('interview.singleQuestionRuntime.next2')}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ArtifactAttachPopover
        open={artifactPopoverOpen}
        onClose={() => setArtifactPopoverOpen(false)}
        onAttach={handleArtifactAttach}
        searchResults={artifactSearchResults}
        onSearch={handleArtifactSearch}
        isPl={isPolish}
      />
    </div>
  );
};

export default InterviewSingleQuestionRuntime;
