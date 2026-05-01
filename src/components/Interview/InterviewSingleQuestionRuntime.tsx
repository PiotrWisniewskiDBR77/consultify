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
  Link2,
  Loader2,
  LogOut,
  Mic,
  Paperclip,
  PauseCircle,
  Sparkles,
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

function getAnswerTypeLabel(
  answerType?: string,
  isPolish = false
): { label: string; icon: 'text' | 'hash' | 'check' | 'calendar' } {
  const normalized = normalizeAnswerType(answerType);
  if (QUESTION_INPUT_TYPES.longText.has(normalized))
    return { label: isPolish ? 'Tekst' : 'Text', icon: 'text' };
  if (QUESTION_INPUT_TYPES.shortText.has(normalized))
    return { label: isPolish ? 'Krótki tekst' : 'Short text', icon: 'text' };
  if (QUESTION_INPUT_TYPES.number.has(normalized))
    return { label: isPolish ? 'Liczba' : 'Number', icon: 'hash' };
  if (QUESTION_INPUT_TYPES.singleChoice.has(normalized))
    return { label: isPolish ? 'Wybór' : 'Choice', icon: 'check' };
  if (QUESTION_INPUT_TYPES.multiChoice.has(normalized))
    return { label: isPolish ? 'Wielokrotny' : 'Multi', icon: 'check' };
  if (QUESTION_INPUT_TYPES.yesNo.has(normalized))
    return { label: isPolish ? 'Tak/Nie' : 'Yes/No', icon: 'check' };
  if (QUESTION_INPUT_TYPES.rating.has(normalized))
    return { label: isPolish ? 'Skala' : 'Scale', icon: 'hash' };
  if (QUESTION_INPUT_TYPES.dropdown.has(normalized))
    return { label: isPolish ? 'Lista' : 'Dropdown', icon: 'check' };
  if (QUESTION_INPUT_TYPES.date.has(normalized))
    return { label: isPolish ? 'Data' : 'Date', icon: 'calendar' };
  return { label: isPolish ? 'Tekst' : 'Text', icon: 'text' };
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
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');

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
  const [isFinalizingSubmit, setIsFinalizingSubmit] = useState(false);
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef('');
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

  const currentQuestionOptions = useMemo(
    () => (currentQuestion ? buildDefaultOptions(currentQuestion, isPolish) : []),
    [currentQuestion, isPolish]
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

  const voiceNeedsApproval =
    inputMode === 'voice_answer' &&
    voiceTranscriptDraft &&
    currentQuestion?.voiceTranscriptStatus === 'draft';

  const submitBusy = isSubmitting || isFinalizingSubmit;

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
      toast.success(isPolish ? `Powiązano: ${ref.title}` : `Linked: ${ref.title}`);
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
        toast.error(isPolish ? 'Nie udało się ulepszyć odpowiedzi' : 'Failed to improve answer');
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
      toast.error(isPolish ? 'Nie udało się wyjaśnić pytania' : 'Failed to explain question');
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

      const SpeechRecognitionAPI =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.lang = isPolish ? 'pl-PL' : 'en-US';
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.onresult = (e: any) => {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
              liveTranscriptRef.current += e.results[i][0].transcript + ' ';
            }
          }
        };
        recognition.onerror = () => {};
        recognition.onend = () => {
          speechRecognitionRef.current = null;
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
          const browserTranscript = liveTranscriptRef.current.trim();

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

            setInputMode('voice_answer');
            setVoiceTranscriptDraft(finalText);
            setAnswerDraft(finalText);

            const created = await onAddVoiceEvidence(
              audioFile,
              finalText,
              currentQuestion.category,
              currentQuestion.id
            );
            await onUpdateQuestion(currentQuestion.id, {
              answerMode: 'voice_answer',
              voiceTranscript: finalText,
              voiceTranscriptStatus: 'draft',
              voiceAudioEvidenceId: created?.id,
              status: 'in_progress',
            });

            toast.success(
              isPolish
                ? `Transkrypcja gotowa${!serverText && browserTranscript ? ' (przeglądarka)' : ''}. Sprawdź tekst i zatwierdź.`
                : `Transcript ready${!serverText && browserTranscript ? ' (browser)' : ''}. Review and approve.`
            );
          } catch (error) {
            if (browserTranscript) {
              setInputMode('voice_answer');
              setVoiceTranscriptDraft(browserTranscript);
              setAnswerDraft(browserTranscript);
              await onUpdateQuestion(currentQuestion.id, {
                answerMode: 'voice_answer',
                voiceTranscript: browserTranscript,
                voiceTranscriptStatus: 'draft',
                status: 'in_progress',
              });
              toast.success(
                isPolish
                  ? 'Transkrypcja (przeglądarka). Sprawdź tekst i zatwierdź.'
                  : 'Transcript (browser). Review and approve.'
              );
            } else {
              console.error('[InterviewSingleQuestionRuntime] Voice transcription failed:', error);
              toast.error(
                isPolish ? 'Nie udało się przetworzyć nagrania.' : 'Failed to process recording.'
              );
            }
          } finally {
            setIsTranscribing(false);
          }
        };

        recorder.start();
      }

      setIsRecording(true);
    } catch (error) {
      toast.error(
        isPolish
          ? 'Brak dostępu do mikrofonu lub nagrywanie jest niedostępne.'
          : 'Microphone access is unavailable.'
      );
      console.error('[InterviewSingleQuestionRuntime] Recording failed:', error);
    }
  }, [
    currentQuestion,
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
                className={`w-12 h-12 rounded-xl border text-sm font-semibold transition-all ${
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
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-4 py-3 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <span className={answerDraft ? '' : 'text-slate-400 dark:text-slate-500'}>
              {answerDraft || (isPolish ? 'Wybierz opcję...' : 'Select an option...')}
            </span>
            <ChevronDown
              size={16}
              className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {dropdownOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 shadow-xl max-h-60 overflow-y-auto">
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
            className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-4 py-3 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-4 py-3 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
        rows={QUESTION_INPUT_TYPES.shortText.has(normalizedType) ? 2 : immersive ? 5 : 7}
        className={`w-full rounded-xl border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 ${
          immersive
            ? 'border-white/[0.06] bg-white/[0.03] dark:bg-white/[0.02] text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-500'
            : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white'
        }`}
        placeholder={
          isPolish
            ? 'Wpisz odpowiedź albo nagraj ją poniżej...'
            : 'Write the answer or record it below...'
        }
      />
    );
  }, [currentQuestion, currentQuestionOptions, answerDraft, readOnly, isPolish, dropdownOpen]);

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
      <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/80 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 dark:bg-navy-800">
          <FileText size={24} className="text-slate-400" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish ? 'Brak pytań w tej sekcji.' : 'No questions are available in this section.'}
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
        <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Przegląd przed wysłaniem' : 'Review before submitting'}
              </h2>
              <div className="flex items-center gap-3 mt-2">
                <div className="w-32 h-1.5 rounded-full bg-slate-200 dark:bg-navy-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${completionPct === 100 ? 'bg-emerald-500' : 'bg-primary-500'}`}
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
                <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
                  {answeredCount}/{orderedQuestions.length} ({completionPct}%)
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRuntimeView('answering')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-navy-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <ArrowLeft size={14} />
              {isPolish ? 'Wróć do pytań' : 'Back to questions'}
            </button>
          </div>

          {requiredMissing.length > 0 && (
            <div className="mb-4 rounded-xl border border-rose-200/70 dark:border-rose-500/20 bg-rose-50/70 dark:bg-rose-500/10 px-4 py-3">
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                <CircleAlert size={14} className="inline mr-1.5 -mt-0.5" />
                {isPolish
                  ? `${requiredMissing.length} wymaganych pytań bez odpowiedzi`
                  : `${requiredMissing.length} required questions unanswered`}
              </p>
            </div>
          )}

          <div className="space-y-1">
            {immersive ? (
              /* Flat question list for immersive mode */
              <div className="rounded-xl border border-slate-200 dark:border-navy-800 overflow-hidden divide-y divide-slate-200 dark:divide-navy-800">
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
                      className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-navy-900/50 transition-colors"
                    >
                      <span
                        className={`shrink-0 mt-0.5 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold ${
                          answered
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : q.isRequired
                              ? 'bg-rose-500/10 text-rose-500'
                              : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-500'
                        }`}
                      >
                        {answered ? <Check size={10} /> : idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                          {q.questionText}
                        </p>
                        {snippet && (
                          <p className="text-xs text-slate-600 dark:text-slate-500 truncate mt-0.5">
                            {snippet}
                          </p>
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
                  <div
                    key={cat}
                    className="rounded-xl border border-slate-200 dark:border-navy-800 overflow-hidden"
                  >
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50/60 dark:bg-navy-950/40">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${catConfig.bgColor} ${catConfig.color}`}
                      >
                        <catConfig.icon size={11} />
                        {isPolish ? catConfig.labelPl : catConfig.labelEn}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-500">
                        {catInfo.answered}/{catInfo.total}
                      </span>
                      {catInfo.answered === catInfo.total && catInfo.total > 0 && (
                        <Check size={12} className="text-emerald-500" />
                      )}
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-navy-800">
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
                                <p className="text-xs text-slate-600 dark:text-slate-500 truncate mt-0.5">
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

        <div className="sticky bottom-0 z-20 -mx-6 px-6 pb-4 pt-3 bg-gradient-to-t from-white via-white dark:from-navy-950 dark:via-navy-950 to-transparent">
          <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/70 bg-white/90 dark:bg-navy-900/90 backdrop-blur-xl p-4 shadow-xl shadow-slate-200/40 dark:shadow-navy-950/60">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRuntimeView('answering')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-navy-700 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
              >
                <ArrowLeft size={16} />
                {isPolish ? 'Wróć do pytań' : 'Back to questions'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    if (submitBusy) return;
                    setIsFinalizingSubmit(true);
                    // Always flush the latest answer before final submit.
                    // This prevents a race where autosave keeps the button inert.
                    const persistOutcome = await Promise.race<
                      { type: 'done'; ok: boolean } | { type: 'timeout' }
                    >([
                      persistCurrentQuestion().then((ok) => ({ type: 'done' as const, ok })),
                      new Promise<{ type: 'timeout' }>((resolve) =>
                        setTimeout(() => resolve({ type: 'timeout' }), 8000)
                      ),
                    ]);
                    if (persistOutcome.type === 'done' && !persistOutcome.ok) {
                      toast.error(
                        isPolish
                          ? 'Najpierw zapisz odpowiedzi przed wysłaniem.'
                          : 'Save answers first before submitting.'
                      );
                      setIsFinalizingSubmit(false);
                      return;
                    }
                    if (persistOutcome.type === 'timeout') {
                      toast(
                        isPolish
                          ? 'Zapis trwa zbyt długo. Próbuję wysłać na podstawie ostatniego zapisu...'
                          : 'Save is taking too long. Submitting from the last saved state...',
                        { icon: 'ℹ️' }
                      );
                    }
                    try {
                      await onSubmitSession();
                    } finally {
                      setIsFinalizingSubmit(false);
                    }
                  })();
                }}
                disabled={readOnly || submitBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50 shadow-lg shadow-emerald-500/25 transition-colors"
              >
                {submitBusy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {submitBusy
                  ? isPolish
                    ? 'Wysyłanie...'
                    : 'Submitting...'
                  : isPolish
                    ? 'Zatwierdź i wyślij'
                    : 'Submit'}
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
          aria-label={isPolish ? 'Nawigacja pytań' : 'Question navigation'}
        >
          {/* Header with progress */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-500">
                {isPolish ? 'Pytania' : 'Questions'}
              </p>
              <span
                className={`text-[10px] font-semibold tabular-nums ${
                  answeredCount === orderedQuestions.length
                    ? 'text-emerald-500'
                    : 'text-slate-600 dark:text-slate-500'
                }`}
              >
                {answeredCount}/{orderedQuestions.length}
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${answeredCount === orderedQuestions.length ? 'bg-emerald-500' : 'bg-primary-500'}`}
                style={{
                  width: `${orderedQuestions.length > 0 ? (answeredCount / orderedQuestions.length) * 100 : 0}%`,
                }}
              />
            </div>
            {answeredCount < orderedQuestions.length && (
              <p className="text-[10px] text-slate-600 dark:text-slate-500 mt-1.5">
                {orderedQuestions.length - answeredCount}{' '}
                {isPolish ? 'do uzupełnienia' : 'remaining'}
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
                      ? 'bg-primary-500/10 dark:bg-primary-500/15 ring-1 ring-primary-500/20'
                      : isAnswered
                        ? 'opacity-50 hover:opacity-80'
                        : 'hover:bg-slate-50 dark:hover:bg-navy-900/50'
                  }`}
                >
                  <span
                    className={`shrink-0 mt-0.5 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold ${
                      isCurrent
                        ? 'bg-primary-500 text-white'
                        : isAnswered
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200/80 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isAnswered ? <Check size={10} /> : idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`text-[11px] leading-snug line-clamp-2 block ${
                        isCurrent
                          ? 'text-primary-700 dark:text-primary-300 font-medium'
                          : isAnswered
                            ? 'text-slate-500 dark:text-slate-500 line-through decoration-slate-300 dark:decoration-navy-600'
                            : 'text-slate-700 dark:text-slate-200 font-medium'
                      }`}
                    >
                      {q.questionText}
                    </span>
                    {isAnswered && q.answerText && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-500 truncate block mt-0.5">
                        {q.answerText.length > 50 ? q.answerText.slice(0, 50) + '…' : q.answerText}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom actions */}
          <div className="shrink-0 border-t border-slate-100 dark:border-navy-800 px-3 py-2.5 space-y-0.5">
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
      ) : (
        /* ── Non-immersive: category-based nav (legacy) ── */
        <nav
          className="hidden md:flex flex-col w-48 shrink-0 space-y-1"
          role="navigation"
          aria-label={isPolish ? 'Nawigacja kategorii' : 'Category navigation'}
        >
          {sessionName && (
            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-500 truncate">
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
                    ? 'bg-primary-500/10 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 font-medium'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-900/50'
                }`}
              >
                <span className="truncate">{isPolish ? catConfig.labelPl : catConfig.labelEn}</span>
                <span
                  className={`text-[10px] tabular-nums shrink-0 ${isDone ? 'text-emerald-500' : ''}`}
                >
                  {catInfo.answered}/{catInfo.total}
                </span>
              </button>
            );
          })}
          <div className="!mt-auto border-t border-slate-100 dark:border-navy-800 pt-3">
            <button
              type="button"
              onClick={() => {
                void persistCurrentQuestion();
                setRuntimeView('review');
              }}
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
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-900/50 w-full text-left transition-colors"
              >
                <LogOut size={13} />
                {isPolish ? 'Zapisz i wyjdź' : 'Save & Exit'}
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
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isPolish ? catConfig.labelPl : catConfig.labelEn}
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
                {isPolish ? activeCategoryConfig.labelPl : activeCategoryConfig.labelEn}
              </span>
            )}
            <span className="text-xs tabular-nums text-slate-600 dark:text-slate-500">
              {currentIndex + 1} / {orderedQuestions.length}
            </span>
            <div className="flex-1 h-1 rounded-full bg-slate-100 dark:bg-navy-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500/60 transition-all duration-300"
                style={{
                  width: `${orderedQuestions.length > 0 ? (answeredCount / orderedQuestions.length) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-xs tabular-nums text-slate-600 dark:text-slate-500">
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
                  ? 'bg-white/[0.03] dark:bg-white/[0.02] border border-white/[0.04] dark:border-white/[0.03] rounded-2xl backdrop-blur-sm p-6 md:p-8 lg:p-10'
                  : 'rounded-2xl border border-slate-200/70 dark:border-navy-700/70 bg-gradient-to-br from-white via-white to-slate-50 dark:from-navy-900 dark:via-navy-900 dark:to-navy-950 p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-navy-950/50'
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
                            ? 'bg-primary-500/15 text-primary-400 ring-1 ring-primary-500/20'
                            : 'bg-primary-500/10 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400'
                        }`}
                      >
                        {currentIndex + 1}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-500 tabular-nums">
                        {isPolish ? 'z' : 'of'} {orderedQuestions.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const typeInfo = getAnswerTypeLabel(currentQuestion.answerType, isPolish);
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
                                ? 'bg-white/[0.04] text-slate-400 ring-1 ring-white/[0.06]'
                                : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
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
                              ? 'bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/15'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          <CircleAlert size={10} />
                          {isPolish ? 'Wymagane' : 'Required'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question text — adaptive size for long descriptive questions */}
                  <h2
                    className={`font-semibold leading-snug text-slate-900 dark:text-white ${
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
                                {isPolish ? 'Wskazówka' : 'Hint'}
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
                                {isPolish ? 'Czego szukamy' : 'What we look for'}
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
                          ? 'bg-primary-500/[0.06] border-primary-500/10'
                          : 'bg-primary-50 dark:bg-primary-500/10 border-primary-200/80 dark:border-primary-500/15 shadow-sm shadow-primary-500/5'
                      }`}
                    >
                      <Sparkles
                        size={13}
                        className="shrink-0 text-primary-600 dark:text-primary-400"
                      />
                      <span className="text-xs text-primary-900 dark:text-primary-300">
                        {isPolish ? 'Oczekiwany format:' : 'Expected format:'}{' '}
                        <span className="font-medium">{currentQuestion.expectedAnswerShape}</span>
                      </span>
                    </div>
                  )}

                  {/* AI Explain question */}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={handleAiExplain}
                      disabled={aiExplaining}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                        aiExplainResult
                          ? 'text-violet-600 dark:text-violet-400'
                          : 'text-slate-600 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-400'
                      }`}
                    >
                      {aiExplaining ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <HelpCircle size={12} />
                      )}
                      {aiExplaining
                        ? isPolish
                          ? 'Analizuję...'
                          : 'Analyzing...'
                        : aiExplainResult
                          ? isPolish
                            ? 'Ukryj wyjaśnienie'
                            : 'Hide explanation'
                          : isPolish
                            ? 'Wyjaśnij to pytanie'
                            : 'Explain this question'}
                    </button>
                  )}

                  {/* AI Explain result */}
                  {aiExplainResult && (
                    <div className="rounded-xl border border-violet-200/50 dark:border-violet-500/15 bg-violet-50/50 dark:bg-violet-500/5 p-4 space-y-3">
                      <p className="text-sm text-violet-800 dark:text-violet-200 leading-relaxed">
                        {aiExplainResult.explanation}
                      </p>
                      {aiExplainResult.exampleAnswers.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-500 dark:text-violet-400">
                            {isPolish ? 'Przykładowe odpowiedzi' : 'Example answers'}
                          </p>
                          {aiExplainResult.exampleAnswers.map((ex, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-xs text-violet-700 dark:text-violet-300"
                            >
                              <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-violet-500/10 flex items-center justify-center text-[9px] font-semibold text-violet-500">
                                {i + 1}
                              </span>
                              <span className="leading-relaxed italic">&ldquo;{ex}&rdquo;</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-violet-600/70 dark:text-violet-400/70 leading-relaxed">
                        <Sparkles size={10} className="inline mr-1 -mt-0.5" />
                        {aiExplainResult.whyItMatters}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {renderedInput}

                  {/* ── Answer toolbar: Record + AI dropdown (chip standard) ── */}
                  {!readOnly && (
                    <div className="flex items-center gap-1.5">
                      {/* Record voice answer */}
                      <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isTranscribing}
                        className={`inline-flex items-center gap-1.5 h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] ${
                          isRecording
                            ? 'border-rose-500/40 bg-rose-500/15 text-rose-500 animate-pulse'
                            : immersive
                              ? 'border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                              : 'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        {isRecording ? <PauseCircle size={11} /> : <Mic size={11} />}
                        {isRecording ? 'Stop' : isPolish ? 'Nagraj' : 'Record'}
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
                                  ? 'border-primary-500/20 bg-primary-500/10 text-primary-400'
                                  : 'border-primary-500/30 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                                : immersive
                                  ? 'border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-primary-300'
                                  : 'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
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
                                  ? 'bg-navy-900/95 border-white/[0.08] backdrop-blur-xl'
                                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700'
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
                                      ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
                                  }`}
                                >
                                  <span className="text-xs">{item.icon}</span>
                                  {isPolish ? item.labelPl : item.labelEn}
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
                          {isPolish ? 'Ulepszona wersja' : 'Improved version'}
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
                              isPolish ? 'Zastosowano ulepszoną wersję' : 'Applied improved version'
                            );
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 transition-colors"
                        >
                          <Check size={12} />
                          {isPolish ? 'Zastosuj' : 'Apply'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiImproveResult(null)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            immersive
                              ? 'border-white/[0.08] text-slate-400 hover:text-slate-200'
                              : 'border-slate-200/70 dark:border-navy-700/70 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-900'
                          }`}
                        >
                          {isPolish ? 'Odrzuć' : 'Dismiss'}
                        </button>
                      </div>
                    </div>
                  )}

                  {voiceNeedsApproval && (
                    <div className="rounded-xl border border-amber-200/70 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/10 px-4 py-3 space-y-2">
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
                            toast.success(
                              isPolish ? 'Transkrypcja odrzucona.' : 'Transcript discarded.'
                            );
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                            immersive
                              ? 'border-white/[0.08] text-slate-400 hover:text-slate-200'
                              : 'border-slate-200/70 dark:border-navy-700/70 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-900'
                          }`}
                        >
                          <X size={12} />
                          {isPolish ? 'Odrzuć i ponów' : 'Discard & retry'}
                        </button>
                        <button
                          type="button"
                          onClick={handleApproveTranscript}
                          aria-label={isPolish ? 'Zatwierdź transkrypcję' : 'Approve transcript'}
                          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white"
                        >
                          <Check size={14} />
                          {isPolish ? 'Zatwierdź' : 'Approve'}
                        </button>
                      </div>
                    </div>
                  )}

                  {(inputMode === 'voice_answer' || isTranscribing) && !voiceNeedsApproval && (
                    <div className="rounded-xl border border-violet-200/70 dark:border-violet-500/20 bg-violet-50/70 dark:bg-violet-500/10 px-4 py-3 text-sm text-violet-700 dark:text-violet-300">
                      {isTranscribing ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin" />
                          {isPolish ? 'Trwa transkrypcja nagrania...' : 'Transcribing recording...'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <Check size={14} className="text-emerald-500" />
                          {isPolish ? 'Transkrypcja zatwierdzona.' : 'Transcript approved.'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Evidence prompt is now shown above the answer in the guidance block */}
                </div>

                {/* ── Context capture section (always visible) ── */}
                <div
                  className={`space-y-3 pt-3 border-t ${
                    immersive
                      ? 'border-white/[0.06]'
                      : 'border-slate-200/40 dark:border-navy-700/40'
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Dodatkowy kontekst' : 'Additional context'}
                  </p>

                  {/* Context note (always visible) */}
                  <textarea
                    value={contextDraft}
                    onChange={(event) => setContextDraft(event.target.value)}
                    disabled={readOnly}
                    rows={1}
                    className={`w-full rounded-xl border px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                      immersive
                        ? 'border-white/[0.06] bg-white/[0.03] text-slate-700 dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-500'
                        : 'border-slate-200/70 dark:border-navy-700/70 bg-white dark:bg-navy-950 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500'
                    }`}
                    placeholder={
                      isPolish
                        ? 'Komentarz, niuans, wyjaśnienie do odpowiedzi...'
                        : 'Comment, nuance, clarification for this answer...'
                    }
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
                        onClick={() => fileInputRef.current?.click()}
                        className={`inline-flex items-center gap-1.5 h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] ${
                          immersive
                            ? 'border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                            : 'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <Paperclip size={11} />
                        {isPolish ? 'Plik' : 'File'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowLinkForm((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] ${
                          showLinkForm
                            ? 'border-primary-500/30 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                            : immersive
                              ? 'border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                              : 'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
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
                            ? 'border-white/[0.06] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-violet-300'
                            : 'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <Waypoints size={11} />
                        {isPolish ? 'Artefakt' : 'Artifact'}
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
                        className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder={isPolish ? 'Nazwa linku' : 'Link title'}
                      />
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(event) => setLinkUrl(event.target.value)}
                        className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="https://"
                      />
                      <div className="md:col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={handleAddLink}
                          disabled={!linkName.trim() || !linkUrl.trim()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          <Check size={12} />
                          {isPolish ? 'Dodaj' : 'Add'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Attached evidence chips */}
                  {currentEvidence.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {currentEvidence.map((item) => {
                        const isArtifact =
                          item.evidenceType === 'link' &&
                          (item.url || '').startsWith('artifact://');
                        const EvidIcon = isArtifact
                          ? Waypoints
                          : item.evidenceType === 'link'
                            ? Link2
                            : item.evidenceType === 'audio'
                              ? Mic
                              : Paperclip;
                        return (
                          <span
                            key={item.id}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] ${
                              isArtifact
                                ? 'border-violet-200/70 dark:border-violet-500/20 bg-violet-50/50 dark:bg-violet-500/5 text-violet-600 dark:text-violet-300'
                                : 'border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/80 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <EvidIcon size={10} />
                            <span className="truncate max-w-[140px]">
                              {item.title || item.name}
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
              : 'rounded-xl border border-slate-200/70 dark:border-navy-700/70 bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl p-4'
          }`}
        >
          <div
            className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between ${immersive ? 'max-w-4xl mx-auto' : ''}`}
          >
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              {hasUnsavedChanges ? (
                <>
                  <Loader2 size={14} className={isPersisting ? 'animate-spin' : ''} />
                  {isPersisting
                    ? isPolish
                      ? 'Zapisuję...'
                      : 'Saving...'
                    : isPolish
                      ? 'Niezapisane zmiany'
                      : 'Unsaved changes'}
                </>
              ) : autoSaved ? (
                <>
                  <Check size={14} className="text-emerald-500" />
                  <span className="text-emerald-500">
                    {isPolish ? 'Auto-zapisano' : 'Auto-saved'}
                  </span>
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
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${
                  immersive
                    ? 'border-white/[0.08] text-slate-400 hover:text-slate-200 hover:border-white/[0.15]'
                    : 'border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200'
                }`}
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
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${
                    immersive
                      ? 'border-primary-500/20 bg-primary-500/10 text-primary-400 hover:bg-primary-500/15'
                      : 'border-primary-500/30 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                  }`}
                >
                  {isPersisting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
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
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 shadow-lg shadow-emerald-500/20"
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
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                    immersive
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600'
                      : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  }`}
                >
                  {isPolish ? 'Następne' : 'Next'}
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
