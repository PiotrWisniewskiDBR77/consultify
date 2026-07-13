/**
 * TemplateBuilder - BCG Enterprise Level Template Editor
 *
 * Features:
 * - Create and edit interview templates
 * - 5 Categories: Strategy, Operations, Digital, People, Finance
 * - Drag & drop question reordering
 * - Multiple question types: open, select, scale, boolean
 * - Answer options editor for closed questions
 * - Template metadata (name, description, category, visibility)
 * - Publish workflow (draft → approved)
 * - Clone from existing template
 *
 * @see wdrozenia/modules/interview/
 */

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Copy,
  Eye,
  FileText,
  GripVertical,
  Hash,
  HelpCircle,
  Layers,
  Link2,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Send,
  Sparkles,
  ToggleLeft,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Select } from '@/components/shared/forms';
import { TeresaMark } from '@/components/shared/TeresaMark';
import { Button, LoadingState } from '@/components/ui/primitives';
import { sendMessageToAI } from '@/services/ai/gemini';
import { Api } from '@/services/api';

import { createInterviewDemoDataset, isInterviewDemoId } from './interviewDemoData';
import {
  getTemplateAreaTagLabel,
  INTERVIEW_TEMPLATE_AREA_TAG_OPTIONS,
  normalizeInterviewTemplateAreaTags,
  type TemplateScope,
} from './templateLibraryMeta';

// Types
interface TemplateQuestion {
  id: string;
  templateId: string;
  category: QuestionCategory;
  questionText: string;
  sortOrder: number;
  answerType: AnswerType;
  isRequired: boolean;
  helpHint?: string;
  answerOptions: string[];
  expectedAnswerShape?: string;
  allowVoice?: boolean;
  allowFileUpload?: boolean;
  allowUrl?: boolean;
  allowContextNote?: boolean;
  description?: string;
  evidencePrompt?: string;
  /** Static, author-written instruction shown to the respondent in the answer form (Step 2 / R3). */
  guidance?: string;
  /** Static example answer shown to the respondent in the answer form (Step 2 / R3). */
  exampleAnswer?: string;
  /**
   * Optional section/group header that this question opens.
   * Persisted: the `section_title` column on
   * interview_library_template_questions round-trips through the POST/PATCH
   * question handlers and the GET mapper, so section headers survive reload.
   */
  sectionTitle?: string;
  // UI state
  isNew?: boolean;
  isEditing?: boolean;
}

interface Template {
  id: string;
  organizationId?: string;
  scope?: TemplateScope;
  name: string;
  description: string;
  category: TemplateCategory;
  status: 'draft' | 'approved';
  visibility: 'global' | 'org' | 'role_based' | 'admin_only';
  isDefault: boolean;
  version: number;
  audience?: string;
  estimatedTimeMinutes?: number;
  runtimeModeDefault?: RuntimeModeDefault;
  answerDesignGuide?: string;
  areaTags?: string[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

type QuestionCategory = 'strategy' | 'operations' | 'digital' | 'people' | 'finance';
const QUESTION_CATEGORIES: ReadonlyArray<{
  id: QuestionCategory;
  labelEn: string;
  labelPl: string;
}> = [
  { id: 'strategy', labelEn: 'Strategy', labelPl: 'Strategia' },
  { id: 'operations', labelEn: 'Operations', labelPl: 'Operacje' },
  { id: 'digital', labelEn: 'Digital', labelPl: 'Cyfryzacja' },
  { id: 'people', labelEn: 'People', labelPl: 'Ludzie' },
  { id: 'finance', labelEn: 'Finance', labelPl: 'Finanse' },
];
type AnswerType = 'open' | 'select' | 'scale' | 'boolean' | 'number' | 'date' | 'dropdown';
type TemplateCategory =
  | 'DIGITAL'
  | 'OPERATIONAL'
  | 'COST'
  | 'DATA'
  | 'STANDARD'
  | 'QUICK'
  | 'CUSTOM';
type RuntimeModeDefault = 'task_list' | 'one_question_per_screen';
type AiDraftPayload = {
  template?: Partial<Template>;
  questions?: Array<Partial<TemplateQuestion>>;
};
type AiQuestionProposal = {
  summary?: string;
  add?: Array<Partial<TemplateQuestion> & { rationale?: string }>;
  update?: Array<
    Partial<TemplateQuestion> & {
      questionId: string;
      rationale?: string;
    }
  >;
  remove?: Array<{ questionId: string; reason: string }>;
  reorder?: { order: string[]; note?: string };
};

// AI quality-gate response shape (matches InterviewController.evaluateTemplateQuality)
interface QualityWarning {
  rule?: string;
  severity: 'error' | 'warning' | 'info';
  message: { en: string; pl: string };
}
interface QualityQuestionResult {
  questionId?: string;
  score: number;
  warnings: QualityWarning[];
}
interface TemplateQualityResult {
  results: QualityQuestionResult[];
  averageScore: number;
  totalWarnings: number;
}

// Constants
const ANSWER_TYPES: { id: AnswerType; labelPl: string; labelEn: string }[] = [
  { id: 'open', labelPl: 'Otwarte', labelEn: 'Open text' },
  { id: 'select', labelPl: 'Wybór', labelEn: 'Select' },
  { id: 'scale', labelPl: 'Skala', labelEn: 'Scale' },
  { id: 'boolean', labelPl: 'Tak/Nie', labelEn: 'Yes/No' },
  { id: 'number', labelPl: 'Liczba', labelEn: 'Number' },
  { id: 'date', labelPl: 'Data', labelEn: 'Date' },
  { id: 'dropdown', labelPl: 'Lista rozwijana', labelEn: 'Dropdown' },
];

// Small visual hint for how each answer type renders to a respondent.
const ANSWER_TYPE_ICONS: Record<
  AnswerType,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  open: Type,
  select: CircleDot,
  scale: Layers,
  boolean: ToggleLeft,
  number: Hash,
  date: CalendarDays,
  dropdown: ChevronDown,
};

/**
 * AnswerTypePreview — a tiny, non-interactive preview of how a given answer
 * type renders for a respondent. Used as a visual hint next to the type picker.
 */
const AnswerTypePreview: React.FC<{
  answerType: AnswerType;
  options?: string[];
  isPolish: boolean;
}> = ({ answerType, options, isPolish }) => {
  const sampleOptions =
    options && options.length > 0
      ? options.slice(0, 3)
      : isPolish
        ? ['Opcja A', 'Opcja B', 'Opcja C']
        : ['Option A', 'Option B', 'Option C'];

  if (answerType === 'open') {
    return (
      <div className="h-12 rounded-md border border-dashed border-slate-300 dark:border-navy-600 bg-white/60 dark:bg-navy-950/40 px-2 py-1.5 text-[11px] text-slate-400 dark:text-slate-500">
        {isPolish ? 'Pole tekstowe na odpowiedź…' : 'Free text answer…'}
      </div>
    );
  }
  if (answerType === 'select') {
    return (
      <div className="space-y-1">
        {sampleOptions.map((opt, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400"
          >
            <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full border border-slate-400 dark:border-slate-500">
              {i === 0 ? <span className="h-1.5 w-1.5 rounded-full bg-navy-900 dark:bg-white" /> : null}
            </span>
            <span className="truncate">{opt}</span>
          </div>
        ))}
      </div>
    );
  }
  if (answerType === 'dropdown') {
    return (
      <div className="flex h-8 items-center justify-between rounded-md border border-slate-300 dark:border-navy-600 bg-white/60 dark:bg-navy-950/40 px-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="truncate">{sampleOptions[0]}</span>
        <ChevronDown size={12} className="shrink-0 opacity-60" />
      </div>
    );
  }
  if (answerType === 'scale') {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-medium ${
              n === 3
                ? 'bg-navy-900 text-white'
                : 'border border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400'
            }`}
          >
            {n}
          </span>
        ))}
      </div>
    );
  }
  if (answerType === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-navy-900 px-2.5 py-0.5 text-[11px] font-medium text-white">
          {isPolish ? 'Tak' : 'Yes'}
        </span>
        <span className="rounded-full border border-slate-300 dark:border-navy-600 px-2.5 py-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          {isPolish ? 'Nie' : 'No'}
        </span>
      </div>
    );
  }
  if (answerType === 'number') {
    return (
      <div className="flex h-8 w-24 items-center rounded-md border border-slate-300 dark:border-navy-600 bg-white/60 dark:bg-navy-950/40 px-2 text-[11px] text-slate-400 dark:text-slate-500">
        123
      </div>
    );
  }
  if (answerType === 'date') {
    return (
      <div className="flex h-8 w-32 items-center gap-2 rounded-md border border-slate-300 dark:border-navy-600 bg-white/60 dark:bg-navy-950/40 px-2 text-[11px] text-slate-400 dark:text-slate-500">
        <CalendarDays size={12} className="opacity-60" />
        {isPolish ? 'DD.MM.RRRR' : 'MM/DD/YYYY'}
      </div>
    );
  }
  return null;
};

/**
 * RespondentQuestionPreview — read-only render of a question the way a
 * respondent would experience it (used in the "Preview as respondent" panel).
 */
const RespondentQuestionPreview: React.FC<{
  question: TemplateQuestion;
  index: number;
  isPolish: boolean;
}> = ({ question, index, isPolish }) => {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-xs font-semibold text-slate-400 dark:text-slate-500">
          {index + 1}.
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {question.questionText || (isPolish ? '(Pytanie bez treści)' : '(Untitled question)')}
            {question.isRequired ? <span className="ml-1 text-danger-500">*</span> : null}
          </p>
          {question.description ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{question.description}</p>
          ) : null}
          <div className="pt-1">
            <AnswerTypePreview
              answerType={question.answerType}
              options={question.answerOptions}
              isPolish={isPolish}
            />
          </div>
          {question.helpHint ? (
            <p className="text-[11px] italic text-slate-400 dark:text-slate-500">
              {question.helpHint}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const RUNTIME_MODE_OPTIONS: { id: RuntimeModeDefault; labelPl: string; labelEn: string }[] = [
  {
    id: 'one_question_per_screen',
    labelPl: 'Jedno pytanie na ekran',
    labelEn: 'One question per screen',
  },
  { id: 'task_list', labelPl: 'Lista pytań', labelEn: 'Question list' },
];

const normalizeAnswerType = (value: unknown): AnswerType => {
  const raw = String(value || 'open')
    .trim()
    .toLowerCase();
  return ['open', 'select', 'scale', 'boolean', 'number', 'date', 'dropdown'].includes(raw)
    ? (raw as AnswerType)
    : 'open';
};

const parseAiJsonPayload = (raw: string): any | null => {
  const text = String(raw || '').trim();
  if (!text) return null;
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```([\s\S]*?)```/);
  const payload = (jsonMatch?.[1] || text).trim();
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

const DEFAULT_ALLOWED_ANSWER_TYPES: AnswerType[] = ANSWER_TYPES.map((item) => item.id);

const parseAllowedAnswerTypes = (value?: string): AnswerType[] => {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_ALLOWED_ANSWER_TYPES;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const normalized = parsed
        .map((item) => normalizeAnswerType(item))
        .filter((item, index, array) => array.indexOf(item) === index);
      return normalized.length > 0 ? normalized : DEFAULT_ALLOWED_ANSWER_TYPES;
    }
  } catch {
    // Ignore legacy non-JSON values and fall back to default.
  }
  return DEFAULT_ALLOWED_ANSWER_TYPES;
};

const serializeAllowedAnswerTypes = (types: AnswerType[]): string =>
  JSON.stringify(
    types
      .filter((item, index, array) => array.indexOf(item) === index)
      .sort(
        (a, b) => DEFAULT_ALLOWED_ANSWER_TYPES.indexOf(a) - DEFAULT_ALLOWED_ANSWER_TYPES.indexOf(b)
      )
  );

interface TemplateBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  templateId?: string | null;
  onSuccess?: (template?: Partial<Template> & { id?: string }) => void;
  presentation?: 'modal' | 'document';
}

export const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  isOpen,
  onClose,
  templateId,
  onSuccess,
  presentation = 'modal',
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const interviewDemoData = useMemo(() => createInterviewDemoDataset(), []);

  // Template metadata state
  const [template, setTemplate] = useState<Partial<Template>>({
    name: '',
    description: '',
    scope: 'private',
    category: 'CUSTOM',
    status: 'draft',
    visibility: 'org',
    isDefault: false,
    version: 1,
    audience: '',
    estimatedTimeMinutes: 10,
    runtimeModeDefault: 'one_question_per_screen',
    answerDesignGuide: '',
    areaTags: [],
  });

  // Questions state
  const [questions, setQuestions] = useState<TemplateQuestion[]>([]);
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<string[]>([]);
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);
  const [targetQuestionCount, setTargetQuestionCount] = useState(12);
  const [questionCountTolerance, setQuestionCountTolerance] = useState(2);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isImportingSource, setIsImportingSource] = useState(false);
  const [importedSourceName, setImportedSourceName] = useState('');
  const [importedSourceText, setImportedSourceText] = useState('');
  const [aiProposal, setAiProposal] = useState<AiQuestionProposal | null>(null);
  const [showAiProposalModal, setShowAiProposalModal] = useState(false);
  const [selectedAddIdx, setSelectedAddIdx] = useState<Record<number, boolean>>({});
  const [selectedUpdateIds, setSelectedUpdateIds] = useState<Record<string, boolean>>({});
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<Record<string, boolean>>({});
  const [applySuggestedOrder, setApplySuggestedOrder] = useState(false);
  const [isAnswerTypeMenuOpen, setIsAnswerTypeMenuOpen] = useState(false);
  const [isAreaTagsMenuOpen, setIsAreaTagsMenuOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showRespondentPreview, setShowRespondentPreview] = useState(false);
  const reviewImportInputRef = useRef<HTMLInputElement | null>(null);

  // AI quality gate (V6-B04) — POST /interview/templates/evaluate-quality
  const [isCheckingQuality, setIsCheckingQuality] = useState(false);
  const [qualityResult, setQualityResult] = useState<TemplateQualityResult | null>(null);

  // Load existing template
  useEffect(() => {
    if (!isOpen) return;

    if (templateId) {
      loadTemplate(templateId);
    } else {
      // Reset for new template
      setTemplate({
        name: '',
        description: '',
        scope: 'private',
        category: 'CUSTOM',
        status: 'draft',
        visibility: 'org',
        isDefault: false,
        version: 1,
        audience: '',
        estimatedTimeMinutes: 10,
        runtimeModeDefault: 'one_question_per_screen',
        answerDesignGuide: '',
        areaTags: [],
      });
      setQuestions([]);
      setDeletedQuestionIds([]);
      setTargetQuestionCount(12);
      setQuestionCountTolerance(2);
      setImportedSourceName('');
      setImportedSourceText('');
      setAiProposal(null);
      setShowAiProposalModal(false);
      setIsAnswerTypeMenuOpen(false);
      setIsAreaTagsMenuOpen(false);
    }
  }, [isOpen, templateId]);

  const loadTemplate = async (id: string) => {
    setIsLoading(true);
    try {
      if (isInterviewDemoId(id)) {
        const demoTemplate = interviewDemoData.templates.find((item) => item.id === id);
        const demoQuestions = interviewDemoData.templateQuestionsById[id] || [];
        if (demoTemplate) {
          const demoTemplateRecord: Template = {
            ...(demoTemplate as unknown as Template),
            visibility: 'org',
            version: 1,
            status: 'approved',
          };
          setTemplate({
            ...demoTemplateRecord,
            scope: (demoTemplateRecord.scope || 'private') as TemplateScope,
            areaTags: normalizeInterviewTemplateAreaTags(demoTemplateRecord.areaTags),
          });
          setDeletedQuestionIds([]);
          setTargetQuestionCount(Math.max(demoQuestions.length || 0, 1));
          setQuestions(demoQuestions as TemplateQuestion[]);
          return;
        }
      }

      const [templateRes, questionsRes] = await Promise.all([
        Api.get(`/interview/templates/${id}`).catch(() => null),
        Api.get(`/interview/templates/${id}/questions`).catch(() => []),
      ]);

      if (!templateRes) {
        const demoTemplate = interviewDemoData.templates.find((item) => item.id === id);
        const demoQuestions = interviewDemoData.templateQuestionsById[id] || [];
        if (demoTemplate) {
          const demoTemplateRecord: Template = {
            ...(demoTemplate as unknown as Template),
            visibility: 'org',
            version: 1,
            status: 'approved',
          };
          setTemplate({
            ...demoTemplateRecord,
            scope: (demoTemplateRecord.scope || 'private') as TemplateScope,
            areaTags: normalizeInterviewTemplateAreaTags(demoTemplateRecord.areaTags),
          });
          setDeletedQuestionIds([]);
          setTargetQuestionCount(Math.max(demoQuestions.length || 0, 1));
          setQuestions(demoQuestions as TemplateQuestion[]);
          return;
        }
        throw new Error('Template not found');
      }

      setTemplate({
        ...(templateRes as Template),
        scope: ((templateRes as Template)?.scope || 'private') as TemplateScope,
        areaTags: normalizeInterviewTemplateAreaTags((templateRes as Template)?.areaTags),
      });
      setDeletedQuestionIds([]);
      const loadedQuestions = Array.isArray(questionsRes) ? questionsRes : [];
      setTargetQuestionCount(Math.max(loadedQuestions.length || 0, 1));
      setQuestionCountTolerance(2);
      setImportedSourceName('');
      setImportedSourceText('');
      setAiProposal(null);
      setShowAiProposalModal(false);
      setIsAnswerTypeMenuOpen(false);
      setIsAreaTagsMenuOpen(false);
      setQuestions(
        loadedQuestions.map((q: any) => ({
          id: q.id,
          templateId: q.templateId || q.template_id,
          category: q.category,
          questionText: q.questionText || q.question_text,
          sortOrder: q.sortOrder || q.sort_order || 0,
          answerType: q.answerType || q.answer_type || 'open',
          isRequired: q.isRequired || q.is_required || false,
          helpHint: q.helpHint || q.help_hint || '',
          answerOptions:
            q.answerOptions || q.answer_options
              ? typeof (q.answerOptions || q.answer_options) === 'string'
                ? JSON.parse(q.answerOptions || q.answer_options)
                : q.answerOptions || q.answer_options
              : [],
          expectedAnswerShape: q.expectedAnswerShape || q.expected_answer_shape || '',
          allowVoice:
            q.allowVoice !== undefined || q.allow_voice !== undefined
              ? Boolean(q.allowVoice ?? q.allow_voice)
              : true,
          allowFileUpload:
            q.allowFileUpload !== undefined || q.allow_file_upload !== undefined
              ? Boolean(q.allowFileUpload ?? q.allow_file_upload)
              : true,
          allowUrl:
            q.allowUrl !== undefined || q.allow_url !== undefined
              ? Boolean(q.allowUrl ?? q.allow_url)
              : true,
          allowContextNote:
            q.allowContextNote !== undefined || q.allow_context_note !== undefined
              ? Boolean(q.allowContextNote ?? q.allow_context_note)
              : true,
          description: q.description || '',
          evidencePrompt: q.evidencePrompt || q.evidence_prompt || '',
          guidance: q.guidance || '',
          exampleAnswer: q.exampleAnswer || q.example_answer || '',
          sectionTitle: q.sectionTitle || q.section_title || undefined,
        }))
      );
    } catch (error) {
      console.error('[TemplateBuilder] Failed to load template:', error);
      toast.error(isPolish ? 'Nie udało się załadować szablonu' : 'Failed to load template');
    } finally {
      setIsLoading(false);
    }
  };

  const orderedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.sortOrder - b.sortOrder),
    [questions]
  );
  const dragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const allowedAnswerTypes = useMemo(
    () => parseAllowedAnswerTypes(template.answerDesignGuide),
    [template.answerDesignGuide]
  );
  const areaTags = useMemo(
    () => normalizeInterviewTemplateAreaTags(template.areaTags),
    [template.areaTags]
  );
  const isApplicationTemplate = Boolean(templateId) && template.scope === 'system';

  const handleCloneTemplate = useCallback(async () => {
    if (!templateId || isCloning) return;
    setIsCloning(true);
    try {
      const cloned = await Api.post(`/interview/templates/${templateId}/clone`, {
        scope: 'private',
      });
      toast.success(
        isPolish
          ? 'Szablon sklonowany — otwieramy kopię do edycji'
          : 'Template cloned — opening copy for editing'
      );
      if (onSuccess && cloned?.id) {
        onSuccess({ ...cloned, id: cloned.id } as Partial<Template> & { id: string });
      }
    } catch (error) {
      console.error('[TemplateBuilder] Clone failed:', error);
      toast.error(isPolish ? 'Nie udało się sklonować szablonu' : 'Failed to clone template');
    } finally {
      setIsCloning(false);
    }
  }, [templateId, isCloning, isPolish, onSuccess]);

  const allowedAnswerTypesLabel = useMemo(() => {
    if (allowedAnswerTypes.length === ANSWER_TYPES.length) {
      return isPolish ? 'Wszystkie formy odpowiedzi' : 'All answer types';
    }
    return allowedAnswerTypes
      .map(
        (type) =>
          ANSWER_TYPES.find((item) => item.id === type)?.[isPolish ? 'labelPl' : 'labelEn'] || type
      )
      .join(', ');
  }, [allowedAnswerTypes, isPolish]);

  const areaTagsLabel = useMemo(() => {
    if (areaTags.length === 0) {
      return isPolish ? 'Wybierz obszary' : 'Select areas';
    }
    return areaTags.map((tag) => getTemplateAreaTagLabel(tag, isPolish)).join(', ');
  }, [areaTags, isPolish]);

  const toggleAllowedAnswerType = useCallback((type: AnswerType) => {
    setTemplate((prev) => {
      const current = parseAllowedAnswerTypes(prev.answerDesignGuide);
      const next = current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type];
      const normalized = next.length > 0 ? next : DEFAULT_ALLOWED_ANSWER_TYPES;
      return {
        ...prev,
        answerDesignGuide: serializeAllowedAnswerTypes(normalized),
      };
    });
  }, []);

  const toggleAreaTag = useCallback((tag: string) => {
    setTemplate((prev) => {
      const current = normalizeInterviewTemplateAreaTags(prev.areaTags);
      const next = current.includes(tag as any)
        ? current.filter((item) => item !== tag)
        : [...current, tag as any];
      return {
        ...prev,
        areaTags: normalizeInterviewTemplateAreaTags(next),
      };
    });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setQuestions((prev) => {
      const ordered = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const oldIndex = ordered.findIndex((question) => question.id === String(active.id));
      const newIndex = ordered.findIndex((question) => question.id === String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;

      return arrayMove(ordered, oldIndex, newIndex).map((question, index) => ({
        ...question,
        sortOrder: (index + 1) * 10,
      }));
    });
  }, []);

  // Validation
  const validate = useCallback((): {
    isValid: boolean;
    errors: Record<string, string>;
    firstInvalidQuestion: { id: string; message: string } | null;
    firstMessage: string;
  } => {
    const newErrors: Record<string, string> = {};
    let firstInvalidQuestion: { id: string; message: string } | null = null;

    if (!template.name?.trim()) {
      newErrors.name = isPolish ? 'Nazwa jest wymagana' : 'Name is required';
    }

    if (questions.length === 0) {
      newErrors.questions = isPolish
        ? 'Dodaj przynajmniej jedno pytanie'
        : 'Add at least one question';
    }

    questions.forEach((q) => {
      if (!q.questionText?.trim()) {
        newErrors[`question_${q.id}`] = isPolish
          ? 'Treść pytania jest wymagana'
          : 'Question text is required';
        if (!firstInvalidQuestion) {
          firstInvalidQuestion = {
            id: q.id,
            message: isPolish
              ? 'Jedno z pytań nie ma tytułu / treści'
              : 'One of the questions is missing title/text',
          };
        }
      }
      if ((q.answerType === 'select' || q.answerType === 'scale') && q.answerOptions.length < 2) {
        newErrors[`options_${q.id}`] = isPolish
          ? 'Dodaj przynajmniej 2 opcje'
          : 'Add at least 2 options';
        if (!firstInvalidQuestion) {
          firstInvalidQuestion = {
            id: q.id,
            message: isPolish
              ? 'Pytanie typu wybór / skala musi mieć co najmniej 2 opcje'
              : 'A select/scale question needs at least 2 options',
          };
        }
      }
    });

    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors,
      firstInvalidQuestion,
      firstMessage:
        (firstInvalidQuestion as { id: string; message: string } | null)?.message ||
        newErrors.name ||
        newErrors.questions ||
        (isPolish ? 'Popraw błędy w formularzu' : 'Fix form errors'),
    };
  }, [template, questions, isPolish]);

  // Add new question
  const handleAddQuestion = useCallback(() => {
    const maxOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.sortOrder)) : 0;

    const newQuestion: TemplateQuestion = {
      id: `new_${Date.now()}`,
      templateId: templateId || '',
      category: 'strategy',
      questionText: '',
      sortOrder: maxOrder + 10,
      answerType: 'open',
      isRequired: false,
      helpHint: '',
      answerOptions: [],
      expectedAnswerShape: '',
      allowVoice: true,
      allowFileUpload: true,
      allowUrl: true,
      allowContextNote: true,
      description: '',
      evidencePrompt: '',
      guidance: '',
      exampleAnswer: '',
      isNew: true,
      isEditing: true,
    };

    setQuestions((prev) => [...prev, newQuestion]);
  }, [questions, templateId]);

  // Update question
  const handleUpdateQuestion = useCallback((id: string, updates: Partial<TemplateQuestion>) => {
    setFocusedQuestionId((current) => (current === id ? null : current));
    setErrors((prev) => {
      if (!prev[`question_${id}`] && !prev[`options_${id}`]) return prev;
      const next = { ...prev };
      delete next[`question_${id}`];
      delete next[`options_${id}`];
      return next;
    });
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  }, []);

  // Delete question
  const handleDeleteQuestion = useCallback((id: string) => {
    setQuestions((prev) => {
      const questionToDelete = prev.find((q) => q.id === id);
      if (questionToDelete && !questionToDelete.isNew) {
        setDeletedQuestionIds((current) => (current.includes(id) ? current : [...current, id]));
      }
      return prev.filter((q) => q.id !== id);
    });
  }, []);

  // Duplicate question — clone with a fresh id, inserted right after the source.
  const handleDuplicateQuestion = useCallback((id: string) => {
    setQuestions((prev) => {
      const ordered = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = ordered.findIndex((q) => q.id === id);
      if (idx === -1) return prev;

      const source = ordered[idx];
      const clone: TemplateQuestion = {
        ...source,
        id: `dup_${Date.now()}`,
        // A duplicate is always a new record on the backend.
        isNew: true,
        isEditing: false,
        // Copy options/modalities by value, drop any section header so it does
        // not split the group it was duplicated into.
        answerOptions: [...source.answerOptions],
        sectionTitle: undefined,
      };

      // Insert right after the source, then renumber to keep ordering stable.
      const next = [...ordered.slice(0, idx + 1), clone, ...ordered.slice(idx + 1)];
      return next.map((q, i) => ({ ...q, sortOrder: (i + 1) * 10 }));
    });
  }, []);

  // Toggle / set a section header that this question opens (UI-only state).
  const handleSetSectionTitle = useCallback((id: string, sectionTitle: string | undefined) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, sectionTitle: sectionTitle && sectionTitle.trim() ? sectionTitle : undefined }
          : q
      )
    );
  }, []);

  // Move question up/down
  const handleMoveQuestion = useCallback((id: string, direction: 'up' | 'down') => {
    setQuestions((prev) => {
      const ordered = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);

      const idx = ordered.findIndex((q) => q.id === id);
      if (idx === -1) return prev;

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= ordered.length) return prev;

      const temp = ordered[idx].sortOrder;
      ordered[idx] = {
        ...ordered[idx],
        sortOrder: ordered[swapIdx].sortOrder,
      };
      ordered[swapIdx] = { ...ordered[swapIdx], sortOrder: temp };

      return ordered;
    });
  }, []);

  // Evaluate template question quality via the AI quality-gate endpoint.
  // Returns the result (and stores it) so callers can react to a weak score.
  const evaluateQuality = useCallback(
    async (silent = false): Promise<TemplateQualityResult | null> => {
      const ordered = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);
      if (ordered.length === 0) {
        if (!silent) {
          toast.error(
            isPolish ? 'Dodaj pytania, aby sprawdzić jakość' : 'Add questions to check quality'
          );
        }
        return null;
      }
      try {
        const payload = ordered.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          answerType: q.answerType,
          answerOptions: q.answerOptions,
          isRequired: q.isRequired,
          helpHint: q.helpHint || '',
        }));
        const result = (await Api.post('/interview/templates/evaluate-quality', {
          questions: payload,
        })) as TemplateQualityResult;
        if (result && Array.isArray(result.results)) {
          setQualityResult(result);
          return result;
        }
        return null;
      } catch (error) {
        console.error('[TemplateBuilder] Quality check failed:', error);
        if (!silent) {
          toast.error(
            isPolish ? 'Nie udało się sprawdzić jakości' : 'Could not check template quality'
          );
        }
        return null;
      }
    },
    [questions, isPolish]
  );

  const handleCheckQuality = useCallback(async () => {
    setIsCheckingQuality(true);
    const result = await evaluateQuality(false);
    setIsCheckingQuality(false);
    if (!result) return;
    if (result.averageScore >= 70 && result.totalWarnings === 0) {
      toast.success(
        isPolish ? 'Jakość szablonu wygląda świetnie!' : 'Template quality looks great!'
      );
    }
  }, [evaluateQuality, isPolish]);

  // Save template
  const handleSave = useCallback(
    async (publish: boolean = false) => {
      const validation = validate();
      if (!validation.isValid) {
        setErrors(validation.errors);
        if (validation.firstInvalidQuestion) {
          setFocusedQuestionId(validation.firstInvalidQuestion.id);
        } else {
          setFocusedQuestionId(null);
        }
        toast.error(validation.firstMessage);
        return;
      }

      setErrors({});
      setFocusedQuestionId(null);

      setIsSaving(true);
      try {
        let savedTemplateId = templateId;
        let createdTemplateResponse: any = null;

        // Save template metadata
        const templateData = {
          ...template,
          scope: template.scope || 'organization',
          status: publish ? 'approved' : 'draft',
        };

        if (templateId) {
          await Api.patch(`/interview/templates/${templateId}`, templateData);
        } else {
          createdTemplateResponse = await Api.post('/interview/templates', templateData);
          savedTemplateId = (createdTemplateResponse as any).id;
        }

        // Save questions
        if (savedTemplateId) {
          for (const deletedId of deletedQuestionIds) {
            await Api.delete(`/interview/templates/${savedTemplateId}/questions/${deletedId}`);
          }

          // Add/update questions
          for (const question of questions) {
            const questionData = {
              category: question.category,
              questionText: question.questionText,
              sortOrder: question.sortOrder,
              answerType: question.answerType,
              isRequired: question.isRequired,
              helpHint: question.helpHint || '',
              answerOptions: question.answerOptions,
              expectedAnswerShape: question.expectedAnswerShape || '',
              allowVoice: !!question.allowVoice,
              allowFileUpload: !!question.allowFileUpload,
              allowUrl: !!question.allowUrl,
              allowContextNote: question.allowContextNote !== false,
              description: question.description || '',
              evidencePrompt: question.evidencePrompt || '',
              guidance: question.guidance || '',
              exampleAnswer: question.exampleAnswer || '',
              sectionTitle: question.sectionTitle || '',
            };

            if (question.isNew) {
              await Api.post(`/interview/templates/${savedTemplateId}/questions`, questionData);
            } else {
              await Api.patch(
                `/interview/templates/${savedTemplateId}/questions/${question.id}`,
                questionData
              );
            }
          }
        }

        setDeletedQuestionIds([]);

        toast.success(
          publish
            ? isPolish
              ? 'Szablon opublikowany!'
              : 'Template published!'
            : isPolish
              ? 'Szablon zapisany!'
              : 'Template saved!'
        );

        // Non-blocking AI quality gate: surface a warning when questions are weak.
        const quality = await evaluateQuality(true);
        if (quality && (quality.averageScore < 70 || quality.totalWarnings > 0)) {
          toast(
            isPolish
              ? `Jakość szablonu: ${quality.averageScore}/100 — ${quality.totalWarnings} ostrzeżenie(a). Sprawdź przed publikacją.`
              : `Template quality: ${quality.averageScore}/100 — ${quality.totalWarnings} warning(s). Review before publishing.`,
            { icon: '⚠️', duration: 6000 }
          );
        }

        const savedTemplate =
          savedTemplateId != null
            ? ((templateId
                ? await Api.get(`/interview/templates/${savedTemplateId}`).catch(() => null)
                : createdTemplateResponse) as any)
            : null;

        onSuccess?.(savedTemplate || undefined);
        if (presentation === 'modal') {
          onClose();
        }
      } catch (error) {
        console.error('[TemplateBuilder] Failed to save:', error);
        toast.error(isPolish ? 'Nie udało się zapisać szablonu' : 'Failed to save template');
      } finally {
        setIsSaving(false);
      }
    },
    [
      deletedQuestionIds,
      template,
      questions,
      templateId,
      validate,
      isPolish,
      onSuccess,
      onClose,
      presentation,
      evaluateQuality,
    ]
  );

  const handleGenerateWithAI = useCallback(async () => {
    if (!template.description?.trim() && !importedSourceText.trim()) {
      toast.error(
        isPolish
          ? 'Dodaj opis briefu albo zaimportuj plik TXT/PDF'
          : 'Add a brief description or import a TXT/PDF file'
      );
      return;
    }

    if (
      questions.length > 0 &&
      !window.confirm(
        isPolish
          ? 'AI zastąpi bieżącą listę pytań nowym draftem. Kontynuować?'
          : 'AI will replace the current question list with a new draft. Continue?'
      )
    ) {
      return;
    }

    const systemPrompt = `You are a senior management consultant designing premium interview templates for organizational diagnostics.

Return JSON only. No prose, no markdown fences.

JSON schema:
{
  "template": {
    "name": "string",
    "description": "string",
    "estimatedTimeMinutes": 10,
    "runtimeModeDefault": "one_question_per_screen"
  },
  "questions": [
    {
      "category": "strategy|operations|digital|people|finance",
      "questionText": "string",
      "answerType": "open|select|scale|boolean|number|date|dropdown",
      "isRequired": true,
      "helpHint": "string",
      "expectedAnswerShape": "string",
      "answerOptions": ["string"],
      "allowVoice": true,
      "allowFileUpload": true,
      "allowUrl": true,
      "allowContextNote": true,
      "description": "string",
      "evidencePrompt": "string",
      "exampleAnswer": "string"
    }
  ]
}

Rules:
- Build a practical executive-quality interview sheet.
- Prefer concise, clear, answerable questions.
- Default all modalities to true unless there is a strong reason not to.
- Use only the allowed answer types provided in context unless there is a compelling reason to stay within a smaller subset.
- For select or scale questions, provide answerOptions.
- exampleAnswer: write one short, concrete, plausible sample answer (1-3 sentences, or a short list for select/scale) that shows the respondent the level of specificity expected. Never invent real company facts — keep it generic/illustrative.
- Return ${Math.max(1, targetQuestionCount - questionCountTolerance)} to ${targetQuestionCount + questionCountTolerance} questions.`;

    const userPrompt = `Language: ${isPolish ? 'Polish' : 'English'}
Topic: ${template.name || ''}
Description: ${template.description || ''}
Area tags: ${areaTags.join(', ') || '(none)'}
Allowed answer types: ${allowedAnswerTypes.join(', ')}
Target question count: ${targetQuestionCount}
Allowed tolerance: +/- ${questionCountTolerance}

Create an interview template draft from this brief:
${template.description || ''}

Imported source material:
${importedSourceText.trim() || '(none)'}`;

    setIsAiGenerating(true);
    try {
      const response = await sendMessageToAI(
        [],
        userPrompt,
        systemPrompt,
        'interview_template_builder'
      );
      const parsed = parseAiJsonPayload(response) as AiDraftPayload | null;
      if (!parsed) {
        throw new Error('AI returned invalid JSON');
      }
      const nextTemplate = parsed.template || {};
      const nextQuestionsRaw = Array.isArray(parsed.questions) ? parsed.questions : [];

      if (nextQuestionsRaw.length === 0) {
        throw new Error('AI returned no questions');
      }

      setTemplate((prev) => ({
        ...prev,
        name: String(nextTemplate.name || prev.name || ''),
        description: String(nextTemplate.description || prev.description || ''),
        estimatedTimeMinutes: Math.max(
          1,
          Number(nextTemplate.estimatedTimeMinutes || prev.estimatedTimeMinutes || 10)
        ),
        runtimeModeDefault: String(
          nextTemplate.runtimeModeDefault || prev.runtimeModeDefault || 'one_question_per_screen'
        )
          .toLowerCase()
          .includes('task')
          ? 'task_list'
          : 'one_question_per_screen',
      }));

      const normalizedQuestions: TemplateQuestion[] = nextQuestionsRaw.map((item, index) => {
        return {
          id: `ai_${Date.now()}_${index}`,
          templateId: templateId || '',
          category: 'strategy',
          questionText: String(item.questionText || '').trim(),
          sortOrder: (index + 1) * 10,
          answerType: normalizeAnswerType(item.answerType),
          isRequired: item.isRequired !== false,
          helpHint: String(item.helpHint || '').trim(),
          answerOptions: Array.isArray(item.answerOptions)
            ? item.answerOptions.map((option) => String(option).trim()).filter(Boolean)
            : [],
          expectedAnswerShape: String(item.expectedAnswerShape || '').trim(),
          allowVoice: item.allowVoice !== false,
          allowFileUpload: item.allowFileUpload !== false,
          allowUrl: item.allowUrl !== false,
          allowContextNote: item.allowContextNote !== false,
          description: String(item.description || '').trim(),
          evidencePrompt: String(item.evidencePrompt || '').trim(),
          // #47a2 — AI-generated sample answer, same field the author can edit
          // manually in the question panel; stored as-is (fail-soft: empty if
          // the model omitted it, never blocks the rest of the draft).
          exampleAnswer: String(item.exampleAnswer || '').trim(),
          isNew: true,
          isEditing: false,
        };
      });

      setDeletedQuestionIds((current) =>
        Array.from(
          new Set([
            ...current,
            ...questions.filter((question) => !question.isNew).map((question) => question.id),
          ])
        )
      );
      setQuestions(normalizedQuestions);
      toast.success(
        isPolish ? 'AI przygotowało draft arkusza pytań' : 'AI prepared a template draft'
      );
    } catch (error) {
      console.error('[TemplateBuilder] AI generation failed:', error);
      toast.error(isPolish ? 'Nie udało się wygenerować draftu AI' : 'Failed to generate AI draft');
    } finally {
      setIsAiGenerating(false);
    }
  }, [
    importedSourceText,
    isPolish,
    questionCountTolerance,
    questions,
    targetQuestionCount,
    template,
    templateId,
  ]);

  const closeAiProposalModal = useCallback(() => {
    setShowAiProposalModal(false);
    setAiProposal(null);
    setSelectedAddIdx({});
    setSelectedUpdateIds({});
    setSelectedRemoveIds({});
    setApplySuggestedOrder(false);
  }, []);

  const importSourceFile = useCallback(
    async (file: File): Promise<{ fileName: string; text: string } | null> => {
      const lowerName = file.name.toLowerCase();
      const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
      const isTxt =
        file.type.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md');

      if (!isPdf && !isTxt) {
        toast.error(
          isPolish ? 'Obsługiwane są tylko pliki TXT i PDF' : 'Only TXT and PDF are supported'
        );
        return null;
      }

      const formData = new FormData();
      formData.append('file', file);

      setIsImportingSource(true);
      try {
        const response = await Api.postMultipart('/interview/templates/import-source', formData);
        const payload = response?.data || response;
        const text = String(payload?.text || '').trim();
        if (!text) {
          throw new Error('No text extracted');
        }
        return {
          fileName: String(payload?.fileName || file.name),
          text,
        };
      } catch (error) {
        console.error('[TemplateBuilder] Failed to import source:', error);
        toast.error(isPolish ? 'Nie udało się zaimportować pliku' : 'Failed to import file');
        return null;
      } finally {
        setIsImportingSource(false);
      }
    },
    [isPolish]
  );

  const proposeQuestionImprovementsWithAI = useCallback(
    async (importedSurveyText?: string) => {
      const sourceText = String(importedSurveyText ?? importedSourceText ?? '').trim();
      if (orderedQuestions.length === 0 && !sourceText) {
        toast.error(
          isPolish
            ? 'Dodaj pytania albo wrzuć ankietę do analizy'
            : 'Add questions or upload a survey to review'
        );
        return;
      }

      setIsAiGenerating(true);
      try {
        const existingIds = new Set(orderedQuestions.map((question) => String(question.id)));
        const existingQuestionsCompact = orderedQuestions.map((question) => ({
          id: String(question.id),
          questionText: String(question.questionText || ''),
          answerType: question.answerType,
          isRequired: !!question.isRequired,
          helpHint: String(question.helpHint || ''),
          expectedAnswerShape: String(question.expectedAnswerShape || ''),
          answerOptions: Array.isArray(question.answerOptions) ? question.answerOptions : [],
          description: String(question.description || ''),
          evidencePrompt: String(question.evidencePrompt || ''),
          modalities: {
            voice: question.allowVoice !== false,
            attachments: question.allowFileUpload !== false,
            links: question.allowUrl !== false,
            contextNote: question.allowContextNote !== false,
          },
        }));

        const removalCandidates = orderedQuestions
          .filter((question) => {
            const text = String(question.questionText || '').trim();
            return !text || text.length < 8 || /^(test|tmp|sample)/i.test(text);
          })
          .map((question) => ({
            questionId: String(question.id),
            questionText: String(question.questionText || ''),
            reason: isPolish
              ? 'Krótka / testowa / potencjalnie niskiej jakości pozycja'
              : 'Short / test / potentially low-quality entry',
          }))
          .slice(0, 8);

        const systemPrompt = `You are a senior management consultant and survey methodologist.

Return JSON only. No prose, no markdown fences.

Your goal is to review an interview template and propose targeted improvements so it becomes a world-class executive survey.

Rules:
- Keep the survey lean, clear, non-duplicative, and high signal.
- Respect the template topic, description, target question count, allowed answer types, and imported source material.
- "add" should include only missing high-value questions.
- "update" should use existing questionId values only and propose better wording, better answer type, better help, better expected answer shape, or better answer options.
- "remove" should use existing questionId values only and focus on duplicates, weak wording, placeholders, or low-value questions.
- It is OK to return no add/remove/update if the questionnaire is already strong; in that case return reorder only or an empty response.
- Do not invent business facts not present in the brief/source.
- Default all modalities to true unless there is a strong reason not to.
- For select or scale questions, provide answerOptions.
- For "add" items, include a short illustrative exampleAnswer (1-3 sentences, generic, no invented facts).

Schema:
{
  "summary": "string",
  "add": [
    {
      "questionText": "string",
      "answerType": "open|select|scale|boolean|number|date|dropdown",
      "isRequired": true,
      "helpHint": "string",
      "expectedAnswerShape": "string",
      "answerOptions": ["string"],
      "allowVoice": true,
      "allowFileUpload": true,
      "allowUrl": true,
      "allowContextNote": true,
      "description": "string",
      "evidencePrompt": "string",
      "exampleAnswer": "string",
      "rationale": "string"
    }
  ],
  "update": [
    {
      "questionId": "string",
      "questionText": "string",
      "answerType": "open|select|scale|boolean|number|date|dropdown",
      "isRequired": true,
      "helpHint": "string",
      "expectedAnswerShape": "string",
      "answerOptions": ["string"],
      "allowVoice": true,
      "allowFileUpload": true,
      "allowUrl": true,
      "allowContextNote": true,
      "description": "string",
      "evidencePrompt": "string",
      "rationale": "string"
    }
  ],
  "remove": [
    {
      "questionId": "string",
      "reason": "string"
    }
  ],
  "reorder": {
    "order": ["string"],
    "note": "string"
  }
}`;

        const userPrompt = `Language: ${isPolish ? 'Polish' : 'English'}
Topic: ${template.name || ''}
Description: ${template.description || ''}
Area tags: ${areaTags.join(', ') || '(none)'}
Allowed answer types: ${allowedAnswerTypes.join(', ')}
Target question count: ${targetQuestionCount}
Allowed tolerance: +/- ${questionCountTolerance}

[CURRENT QUESTIONS]
${JSON.stringify(existingQuestionsCompact, null, 2)}

[REMOVAL CANDIDATES]
${JSON.stringify(removalCandidates, null, 2)}

[IMPORTED SURVEY SOURCE]
${sourceText || '(none)'}`;

        const response = await sendMessageToAI(
          [],
          userPrompt,
          systemPrompt,
          'interview_template_review'
        );
        const parsed = parseAiJsonPayload(response) as AiQuestionProposal | null;
        if (!parsed) {
          throw new Error('AI returned invalid JSON');
        }

        const existingQuestionTexts = new Set(
          orderedQuestions
            .map((question) =>
              String(question.questionText || '')
                .trim()
                .toLowerCase()
            )
            .filter(Boolean)
        );

        const normalizedAdd = (Array.isArray(parsed.add) ? parsed.add : [])
          .map((item) => ({
            questionText: String(item.questionText || '').trim(),
            answerType: normalizeAnswerType(item.answerType),
            isRequired: item.isRequired !== false,
            helpHint: String(item.helpHint || '').trim(),
            expectedAnswerShape: String(item.expectedAnswerShape || '').trim(),
            answerOptions: Array.isArray(item.answerOptions)
              ? item.answerOptions.map((option) => String(option).trim()).filter(Boolean)
              : [],
            allowVoice: item.allowVoice !== false,
            allowFileUpload: item.allowFileUpload !== false,
            allowUrl: item.allowUrl !== false,
            allowContextNote: item.allowContextNote !== false,
            description: String(item.description || '').trim(),
            evidencePrompt: String(item.evidencePrompt || '').trim(),
            // #47a2 — AI-suggested sample answer for a newly proposed question.
            exampleAnswer: String(item.exampleAnswer || '').trim(),
            rationale: String(item.rationale || '').trim(),
          }))
          .filter((item) => item.questionText.length > 0)
          .filter((item, index, array) => {
            const key = item.questionText.toLowerCase();
            if (existingQuestionTexts.has(key)) return false;
            return (
              array.findIndex((candidate) => candidate.questionText.toLowerCase() === key) === index
            );
          })
          .slice(0, 10);

        const normalizedUpdate = (Array.isArray(parsed.update) ? parsed.update : [])
          .map((item) => {
            const answerOptions = Array.isArray(item.answerOptions)
              ? item.answerOptions.map((option) => String(option).trim()).filter(Boolean)
              : undefined;
            return {
              questionId: String(item.questionId || '').trim(),
              questionText:
                item.questionText !== undefined
                  ? String(item.questionText || '').trim()
                  : undefined,
              answerType:
                item.answerType !== undefined ? normalizeAnswerType(item.answerType) : undefined,
              isRequired: item.isRequired !== undefined ? item.isRequired !== false : undefined,
              helpHint:
                item.helpHint !== undefined ? String(item.helpHint || '').trim() : undefined,
              expectedAnswerShape:
                item.expectedAnswerShape !== undefined
                  ? String(item.expectedAnswerShape || '').trim()
                  : undefined,
              answerOptions,
              allowVoice: item.allowVoice !== undefined ? item.allowVoice !== false : undefined,
              allowFileUpload:
                item.allowFileUpload !== undefined ? item.allowFileUpload !== false : undefined,
              allowUrl: item.allowUrl !== undefined ? item.allowUrl !== false : undefined,
              allowContextNote:
                item.allowContextNote !== undefined ? item.allowContextNote !== false : undefined,
              description:
                item.description !== undefined ? String(item.description || '').trim() : undefined,
              evidencePrompt:
                item.evidencePrompt !== undefined
                  ? String(item.evidencePrompt || '').trim()
                  : undefined,
              rationale: String(item.rationale || '').trim(),
            };
          })
          .filter((item) => existingIds.has(item.questionId))
          .filter((item) =>
            [
              item.questionText,
              item.answerType,
              item.isRequired,
              item.helpHint,
              item.expectedAnswerShape,
              item.answerOptions,
              item.allowVoice,
              item.allowFileUpload,
              item.allowUrl,
              item.allowContextNote,
              item.description,
              item.evidencePrompt,
            ].some((value) => value !== undefined)
          )
          .slice(0, 12);

        const normalizedRemove = (Array.isArray(parsed.remove) ? parsed.remove : [])
          .map((item) => ({
            questionId: String(item.questionId || '').trim(),
            reason: String(item.reason || '').trim(),
          }))
          .filter(
            (item) =>
              item.questionId.length > 0 &&
              item.reason.length > 0 &&
              existingIds.has(item.questionId)
          )
          .slice(0, 10);

        let normalizedReorder: AiQuestionProposal['reorder'];
        if (parsed.reorder?.order?.length) {
          const uniqueOrder: string[] = [];
          const seen = new Set<string>();
          for (const id of parsed.reorder.order) {
            const normalizedId = String(id || '').trim();
            if (!existingIds.has(normalizedId) || seen.has(normalizedId)) continue;
            seen.add(normalizedId);
            uniqueOrder.push(normalizedId);
          }
          if (uniqueOrder.length > 0) {
            normalizedReorder = {
              order: uniqueOrder,
              note: String(parsed.reorder.note || '').trim(),
            };
          }
        }

        const proposal: AiQuestionProposal = {
          summary: String(parsed.summary || '').trim(),
          add: normalizedAdd,
          update: normalizedUpdate,
          remove: normalizedRemove,
          reorder: normalizedReorder,
        };

        const hasAny =
          (proposal.add?.length || 0) > 0 ||
          (proposal.update?.length || 0) > 0 ||
          (proposal.remove?.length || 0) > 0 ||
          (proposal.reorder?.order?.length || 0) > 0;

        if (!hasAny) {
          toast.success(
            isPolish
              ? 'AI uznało, że ankieta wygląda już bardzo dobrze'
              : 'AI believes the survey already looks strong'
          );
          return;
        }

        setAiProposal(proposal);
        setSelectedAddIdx(
          Object.fromEntries((proposal.add || []).map((_, index) => [index, true])) as Record<
            number,
            boolean
          >
        );
        setSelectedUpdateIds(
          Object.fromEntries(
            (proposal.update || []).map((item) => [String(item.questionId), true])
          ) as Record<string, boolean>
        );
        setSelectedRemoveIds(
          Object.fromEntries(
            (proposal.remove || []).map((item) => [String(item.questionId), false])
          ) as Record<string, boolean>
        );
        setApplySuggestedOrder(
          !!proposal.reorder?.order?.length &&
            (proposal.add?.length || 0) === 0 &&
            (proposal.update?.length || 0) === 0 &&
            (proposal.remove?.length || 0) === 0
        );
        setShowAiProposalModal(true);
      } catch (error) {
        console.error('[TemplateBuilder] AI proposal failed:', error);
        toast.error(
          isPolish ? 'Nie udało się przygotować sugestii AI' : 'Failed to prepare AI suggestions'
        );
      } finally {
        setIsAiGenerating(false);
      }
    },
    [
      importedSourceText,
      isPolish,
      orderedQuestions,
      areaTags,
      questionCountTolerance,
      targetQuestionCount,
      allowedAnswerTypes,
      template.description,
      template.name,
    ]
  );

  const handleUploadAndReview = useCallback(
    async (file: File) => {
      const imported = await importSourceFile(file);
      if (reviewImportInputRef.current) {
        reviewImportInputRef.current.value = '';
      }
      if (!imported) return;
      setImportedSourceName(imported.fileName);
      setImportedSourceText(imported.text);
      await proposeQuestionImprovementsWithAI(imported.text);
    },
    [importSourceFile, proposeQuestionImprovementsWithAI]
  );

  const applyAIProposal = useCallback(() => {
    if (!aiProposal) return;

    const removeIds = new Set(
      (aiProposal.remove || [])
        .filter((item) => !!selectedRemoveIds[String(item.questionId)])
        .map((item) => String(item.questionId))
    );
    const updateMap = new Map(
      (aiProposal.update || [])
        .filter((item) => !!selectedUpdateIds[String(item.questionId)])
        .map((item) => [String(item.questionId), item] as const)
    );
    const additions = (aiProposal.add || []).filter((_, index) => !!selectedAddIdx[index]);

    if (removeIds.size > 0) {
      const shouldContinue = window.confirm(
        isPolish
          ? `Usunąć ${removeIds.size} pytanie/pytania z ankiety?`
          : `Remove ${removeIds.size} question(s) from the survey?`
      );
      if (!shouldContinue) return;
    }

    setQuestions((prev) => {
      const removedExistingIds = prev
        .filter((question) => removeIds.has(question.id) && !question.isNew)
        .map((question) => question.id);
      if (removedExistingIds.length > 0) {
        setDeletedQuestionIds((current) =>
          Array.from(new Set([...current, ...removedExistingIds]))
        );
      }

      let next = prev
        .filter((question) => !removeIds.has(question.id))
        .map((question) => {
          const proposedUpdate = updateMap.get(question.id);
          if (!proposedUpdate) return question;
          return {
            ...question,
            ...(proposedUpdate.questionText !== undefined
              ? { questionText: proposedUpdate.questionText }
              : {}),
            ...(proposedUpdate.answerType !== undefined
              ? { answerType: normalizeAnswerType(proposedUpdate.answerType) }
              : {}),
            ...(proposedUpdate.isRequired !== undefined
              ? { isRequired: proposedUpdate.isRequired !== false }
              : {}),
            ...(proposedUpdate.helpHint !== undefined ? { helpHint: proposedUpdate.helpHint } : {}),
            ...(proposedUpdate.expectedAnswerShape !== undefined
              ? { expectedAnswerShape: proposedUpdate.expectedAnswerShape }
              : {}),
            ...(proposedUpdate.answerOptions !== undefined
              ? {
                  answerOptions: Array.isArray(proposedUpdate.answerOptions)
                    ? proposedUpdate.answerOptions
                    : question.answerOptions,
                }
              : {}),
            ...(proposedUpdate.allowVoice !== undefined
              ? { allowVoice: proposedUpdate.allowVoice !== false }
              : {}),
            ...(proposedUpdate.allowFileUpload !== undefined
              ? { allowFileUpload: proposedUpdate.allowFileUpload !== false }
              : {}),
            ...(proposedUpdate.allowUrl !== undefined
              ? { allowUrl: proposedUpdate.allowUrl !== false }
              : {}),
            ...(proposedUpdate.allowContextNote !== undefined
              ? { allowContextNote: proposedUpdate.allowContextNote !== false }
              : {}),
            ...(proposedUpdate.description !== undefined
              ? { description: proposedUpdate.description }
              : {}),
            ...(proposedUpdate.evidencePrompt !== undefined
              ? { evidencePrompt: proposedUpdate.evidencePrompt }
              : {}),
          };
        });

      let maxOrder = next.length > 0 ? Math.max(...next.map((question) => question.sortOrder)) : 0;
      const createdQuestions: TemplateQuestion[] = additions.map((item, index) => ({
        id: `ai_add_${Date.now()}_${index}`,
        templateId: templateId || '',
        category: 'strategy',
        questionText: String(item.questionText || '').trim(),
        sortOrder: (maxOrder += 10),
        answerType: normalizeAnswerType(item.answerType),
        isRequired: item.isRequired !== false,
        helpHint: String(item.helpHint || '').trim(),
        answerOptions: Array.isArray(item.answerOptions)
          ? item.answerOptions.map((option) => String(option).trim()).filter(Boolean)
          : [],
        expectedAnswerShape: String(item.expectedAnswerShape || '').trim(),
        allowVoice: item.allowVoice !== false,
        allowFileUpload: item.allowFileUpload !== false,
        allowUrl: item.allowUrl !== false,
        allowContextNote: item.allowContextNote !== false,
        description: String(item.description || '').trim(),
        evidencePrompt: String(item.evidencePrompt || '').trim(),
        // #47a2 — carry the AI-suggested sample answer through to the applied question.
        exampleAnswer: String(item.exampleAnswer || '').trim(),
        isNew: true,
        isEditing: false,
      }));

      next = [...next, ...createdQuestions];

      if (applySuggestedOrder && aiProposal.reorder?.order?.length) {
        const orderIndex = new Map<string, number>();
        aiProposal.reorder.order.forEach((id, index) => {
          orderIndex.set(String(id), index);
        });
        const missingIds = next
          .filter((question) => !orderIndex.has(String(question.id)))
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((question) => String(question.id));
        missingIds.forEach((id, index) => {
          orderIndex.set(id, aiProposal.reorder!.order.length + index);
        });
        next = [...next]
          .sort((a, b) => (orderIndex.get(String(a.id)) || 0) - (orderIndex.get(String(b.id)) || 0))
          .map((question, index) => ({ ...question, sortOrder: (index + 1) * 10 }));
      }

      return next;
    });

    closeAiProposalModal();
    toast.success(isPolish ? 'Zastosowano sugestie AI' : 'Applied AI suggestions');
  }, [
    aiProposal,
    applySuggestedOrder,
    closeAiProposalModal,
    isPolish,
    selectedAddIdx,
    selectedRemoveIds,
    selectedUpdateIds,
    templateId,
  ]);

  if (!isOpen) return null;

  const isDocumentMode = presentation === 'document';

  return (
    <div
      className={
        isDocumentMode
          ? 'h-full w-full p-6'
          : 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'
      }
    >
      <div
        className={
          isDocumentMode
            ? 'relative bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl w-full h-full overflow-hidden flex flex-col'
            : 'relative bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl w-full max-w-[1080px] mx-4 max-h-[90vh] overflow-hidden flex flex-col'
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-10 border-b border-slate-200/60 dark:border-navy-700 shrink-0 bg-slate-100 dark:bg-navy-800 text-slate-800 dark:text-white">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={12} className="text-amber-600 dark:text-amber-300 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-600 dark:text-slate-200">
                {template.status === 'draft'
                  ? isPolish
                    ? 'Draft'
                    : 'Draft'
                  : isPolish
                    ? 'Published'
                    : 'Published'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center h-6 w-6 rounded-md text-slate-500 dark:text-slate-300 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {isLoading ? (
          <LoadingState variant="spinner" className="flex-1 py-0" />
        ) : (
          <div className="flex-1 flex overflow-hidden bg-white dark:bg-navy-900">
            {/* Left Panel - Template Metadata */}
            <div className="w-[300px] border-r border-slate-300/80 dark:border-navy-700 px-4 py-6 overflow-auto shrink-0">
              {/* Name */}
              <div className="mb-3">
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  {isPolish ? 'Topic' : 'Topic'} *
                </label>
                <input
                  type="text"
                  value={template.name || ''}
                  onChange={(e) => setTemplate((prev) => ({ ...prev, name: e.target.value }))}
                  disabled={isApplicationTemplate}
                  placeholder={
                    isPolish
                      ? 'np. Digital maturity w produkcji'
                      : 'e.g. Digital maturity in manufacturing'
                  }
                  className={`w-full h-9 px-3 rounded-md bg-white dark:bg-navy-950 border text-slate-900 dark:text-white placeholder-slate-400 focus:ring-1 transition-all ${
                    errors.name
                      ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/50'
                      : 'border-slate-300 dark:border-navy-700 focus:border-c-focus focus:ring-c-focus'
                  }`}
                />
                {errors.name && <p className="text-xs text-danger-400 mt-1">{errors.name}</p>}
              </div>

              {/* Description */}
              <div className="mb-3">
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  {isPolish ? 'Opis' : 'Description'}
                </label>
                <textarea
                  value={template.description || ''}
                  onChange={(e) =>
                    setTemplate((prev) => ({ ...prev, description: e.target.value }))
                  }
                  disabled={isApplicationTemplate}
                  placeholder={
                    isPolish
                      ? 'Opisz cel ankiety, kontekst biznesowy, dokładność odpowiedzi i czego AI ma pilnować przy budowie pytań...'
                      : 'Describe the survey goal, business context, expected answer precision, and what AI should optimize in the questions...'
                  }
                  rows={6}
                  className="w-full px-3 py-2 rounded-md bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white placeholder-slate-500 focus:border-c-focus focus:ring-1 focus:ring-c-focus transition-all resize-none"
                />
              </div>

              {isApplicationTemplate ? (
                <div className="mb-3 rounded-lg border border-c-info/20 bg-c-info/8 px-3 py-2.5">
                  <p className="text-[11px] leading-relaxed text-c-info dark:text-c-info mb-2">
                    {isPolish
                      ? 'To jest szablon systemowy (tylko do odczytu). Sklonuj go, aby edytować własną kopię.'
                      : 'This is a system template (read-only). Clone it to edit your own copy.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleCloneTemplate}
                    disabled={isCloning}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold bg-navy-900 text-white hover:bg-c-info transition-colors disabled:opacity-50"
                  >
                    {isCloning ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Copy size={13} />
                    )}
                    {isPolish ? 'Klonuj do edycji' : 'Clone to edit'}
                  </button>
                </div>
              ) : null}

              <div className="mb-3">
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  {isPolish ? 'Biblioteka' : 'Library'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      id: 'private',
                      label: isPolish ? 'Personal' : 'Personal',
                    },
                    {
                      id: 'organization',
                      label: isPolish ? 'Organization' : 'Organization',
                    },
                  ].map((option) => {
                    const isActive = (template.scope || 'private') === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={isApplicationTemplate}
                        onClick={() =>
                          setTemplate((prev) => ({
                            ...prev,
                            scope: option.id as TemplateScope,
                          }))
                        }
                        className={`inline-flex items-center justify-center h-9 rounded-full text-xs font-medium border transition-colors ${
                          isActive
                            ? 'border-c-text bg-c-text text-c-bg'
                            : 'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]'
                        } disabled:opacity-50 disabled:pointer-events-none`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-3 relative">
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  {isPolish ? 'Dostępne formy odpowiedzi' : 'Available answer types'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsAnswerTypeMenuOpen((prev) => !prev)}
                  disabled={isApplicationTemplate}
                  className="w-full h-10 px-3 rounded-md bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white focus:border-c-focus focus:ring-1 focus:ring-c-focus transition-all flex items-center justify-between gap-3"
                >
                  <span className="truncate text-left text-sm">{allowedAnswerTypesLabel}</span>
                  <ChevronDown
                    size={15}
                    className={`shrink-0 transition-transform ${isAnswerTypeMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isAnswerTypeMenuOpen ? (
                  <div className="absolute z-10 mt-2 w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-xl p-2 space-y-1">
                    {ANSWER_TYPES.map((type) => {
                      const checked = allowedAnswerTypes.includes(type.id);
                      return (
                        <label
                          key={type.id}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAllowedAnswerType(type.id)}
                            disabled={isApplicationTemplate}
                            className="h-4 w-4 rounded border-slate-300 text-c-info focus:ring-c-focus"
                          />
                          <span>{isPolish ? type.labelPl : type.labelEn}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="mb-3 relative">
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  {isPolish ? 'Obszary' : 'Area tags'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsAreaTagsMenuOpen((prev) => !prev)}
                  disabled={isApplicationTemplate}
                  className="w-full h-10 px-3 rounded-md bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white focus:border-c-focus focus:ring-1 focus:ring-c-focus transition-all flex items-center justify-between gap-3"
                >
                  <span className="truncate text-left text-sm">{areaTagsLabel}</span>
                  <ChevronDown
                    size={15}
                    className={`shrink-0 transition-transform ${isAreaTagsMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isAreaTagsMenuOpen ? (
                  <div className="absolute z-10 mt-2 w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-xl p-2 space-y-1 max-h-64 overflow-auto">
                    {INTERVIEW_TEMPLATE_AREA_TAG_OPTIONS.map((tag) => {
                      const checked = areaTags.includes(tag);
                      return (
                        <label
                          key={tag}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAreaTag(tag)}
                            disabled={isApplicationTemplate}
                            className="h-4 w-4 rounded border-slate-300 text-c-info focus:ring-c-focus"
                          />
                          <span>{getTemplateAreaTagLabel(tag, isPolish)}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    {isPolish ? 'Liczba pytań' : 'Question count'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={targetQuestionCount}
                    onChange={(e) =>
                      setTargetQuestionCount(Math.max(1, Number(e.target.value) || 1))
                    }
                    disabled={isApplicationTemplate}
                    className="w-full h-9 px-3 rounded-md bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white focus:border-c-focus focus:ring-1 focus:ring-c-focus transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    {isPolish ? 'Dokładność +/-' : 'Tolerance +/-'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={questionCountTolerance}
                    onChange={(e) =>
                      setQuestionCountTolerance(Math.max(0, Number(e.target.value) || 0))
                    }
                    disabled={isApplicationTemplate}
                    className="w-full h-9 px-3 rounded-md bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white focus:border-c-focus focus:ring-1 focus:ring-c-focus transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="mb-3">
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    {isPolish ? 'Czas (min)' : 'Time (min)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={template.estimatedTimeMinutes || 10}
                    onChange={(e) =>
                      setTemplate((prev) => ({
                        ...prev,
                        estimatedTimeMinutes: Math.max(1, Number(e.target.value) || 10),
                      }))
                    }
                    disabled={isApplicationTemplate}
                    className="w-full h-9 px-3 rounded-md bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white focus:border-c-focus focus:ring-1 focus:ring-c-focus transition-all"
                  />
                </div>

                <div className="mb-3">
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    {isPolish ? 'Tryb runtime' : 'Runtime mode'}
                  </label>
                  <Select
                    value={template.runtimeModeDefault || 'one_question_per_screen'}
                    onChange={(value) =>
                      setTemplate((prev) => ({
                        ...prev,
                        runtimeModeDefault: value as RuntimeModeDefault,
                      }))
                    }
                    disabled={isApplicationTemplate}
                    aria-label={isPolish ? 'Tryb runtime' : 'Runtime mode'}
                    options={RUNTIME_MODE_OPTIONS.map((opt) => ({
                      value: opt.id,
                      label: isPolish ? opt.labelPl : opt.labelEn,
                    }))}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={isAiGenerating || isApplicationTemplate}
                className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-sm font-semibold border border-c-info/40 dark:border-c-info/30 bg-navy-900 text-white dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {isAiGenerating ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                {isPolish ? 'Stwórz ankietę z AI' : 'Create survey with AI'}
              </button>

              {errors.questions && (
                <div className="mt-4 p-3 bg-danger-500/10 border border-danger-500/30 rounded-lg">
                  <p className="text-xs text-danger-400 flex items-center gap-2">
                    <AlertCircle size={14} />
                    {errors.questions}
                  </p>
                </div>
              )}
            </div>

            {/* Right Panel - Questions Editor */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/40 dark:bg-navy-950/30">
              {/* Questions Header */}
              <div className="relative px-4 h-12 border-b border-slate-300/80 dark:border-navy-700 flex items-center justify-end shrink-0">
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>
                    ({orderedQuestions.length} {isPolish ? 'pytań' : 'questions'})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Eye />}
                    onClick={() => setShowRespondentPreview(true)}
                    disabled={orderedQuestions.length === 0}
                    title={
                      isPolish
                        ? 'Zobacz formularz oczami respondenta'
                        : 'See the form as a respondent would'
                    }
                  >
                    {isPolish ? 'Podgląd' : 'Preview'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Upload />}
                    onClick={() => reviewImportInputRef.current?.click()}
                    disabled={isImportingSource || isApplicationTemplate}
                    loading={isImportingSource}
                  >
                    Upload
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Plus />}
                    onClick={handleAddQuestion}
                    disabled={isApplicationTemplate}
                  >
                    {isPolish ? 'Dodaj pytanie' : 'Add Question'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Sparkles />}
                    onClick={() => void proposeQuestionImprovementsWithAI()}
                    disabled={isAiGenerating || isApplicationTemplate}
                    loading={isAiGenerating}
                    title={
                      isPolish
                        ? 'Użyj AI, aby przejrzeć i poprawić istniejące pytania (to NIE tworzy ankiety od zera — od tego jest „Stwórz ankietę z AI")'
                        : 'Use AI to review & improve the existing questions (this does NOT create a survey from scratch — use "Create survey with AI" for that)'
                    }
                    className="text-c-accent border-c-accent/30 hover:bg-c-accent/5 dark:hover:bg-c-accent/10"
                  >
                    {isPolish ? 'Popraw z AI' : 'Improve with AI'}
                  </Button>
                </div>
              </div>

              <input
                ref={reviewImportInputRef}
                type="file"
                accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleUploadAndReview(file);
                }}
              />

              {/* Questions List */}
              <div className="flex-1 overflow-auto p-3 space-y-2">
                {orderedQuestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <HelpCircle size={48} className="text-slate-600 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                      {isPolish ? 'Brak pytań w formularzu' : 'No questions in this form'}
                    </p>
                    <Button variant="primary" icon={<Plus />} onClick={handleAddQuestion}>
                      {isPolish ? 'Dodaj pierwsze pytanie' : 'Add first question'}
                    </Button>
                  </div>
                ) : (
                  <DndContext
                    sensors={dragSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={orderedQuestions.map((question) => question.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {orderedQuestions.map((question, idx) => (
                        <React.Fragment key={question.id}>
                          {question.sectionTitle ? (
                            <div className="flex items-center gap-2 pt-2 pb-1 first:pt-0">
                              <Layers
                                size={13}
                                className="shrink-0 text-c-info dark:text-c-info"
                              />
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-c-info dark:text-c-info">
                                {question.sectionTitle}
                              </span>
                              <span className="h-px flex-1 bg-c-info/20" />
                            </div>
                          ) : null}
                          <SortableQuestionCard
                            question={question}
                            index={idx}
                            totalCount={orderedQuestions.length}
                            isPolish={isPolish}
                            error={
                              errors[`question_${question.id}`] || errors[`options_${question.id}`]
                            }
                            forceExpand={focusedQuestionId === question.id}
                            readOnly={isApplicationTemplate}
                            onUpdate={(updates) => handleUpdateQuestion(question.id, updates)}
                            onDelete={() => handleDeleteQuestion(question.id)}
                            onDuplicate={() => handleDuplicateQuestion(question.id)}
                            onSetSection={(title) => handleSetSectionTitle(question.id, title)}
                            onMoveUp={() => handleMoveQuestion(question.id, 'up')}
                            onMoveDown={() => handleMoveQuestion(question.id, 'down')}
                          />
                        </React.Fragment>
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          </div>
        )}

        {showAiProposalModal && aiProposal ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-6">
            <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-2xl flex flex-col">
              <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-navy-700">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {isPolish ? 'Propozycje zmian od AI' : 'AI change proposal'}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {aiProposal.summary ||
                      (isPolish
                        ? 'AI przejrzało ankietę i przygotowało zmiany do zatwierdzenia.'
                        : 'AI reviewed the survey and prepared changes for approval.')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeAiProposalModal}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
                {(aiProposal.update || []).length > 0 ? (
                  <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.03] p-4 space-y-3">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {isPolish
                        ? 'Zmiany w istniejących pytaniach'
                        : 'Updates to existing questions'}
                    </div>
                    {(aiProposal.update || []).map((item) => {
                      const current = orderedQuestions.find(
                        (question) => question.id === item.questionId
                      );
                      if (!current) return null;
                      return (
                        <label
                          key={item.questionId}
                          className="block rounded-lg border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-navy-950/40 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={!!selectedUpdateIds[String(item.questionId)]}
                              onChange={(event) =>
                                setSelectedUpdateIds((prev) => ({
                                  ...prev,
                                  [String(item.questionId)]: event.target.checked,
                                }))
                              }
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-c-info focus:ring-c-focus"
                            />
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {isPolish ? 'Teraz' : 'Current'}
                              </div>
                              <p className="text-sm text-slate-700 dark:text-slate-200">
                                {current.questionText}
                              </p>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {isPolish ? 'Propozycja AI' : 'AI proposal'}
                              </div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">
                                {item.questionText || current.questionText}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {(item.answerType
                                  ? ANSWER_TYPES.find(
                                      (type) => type.id === normalizeAnswerType(item.answerType)
                                    )
                                  : ANSWER_TYPES.find((type) => type.id === current.answerType))?.[
                                  isPolish ? 'labelPl' : 'labelEn'
                                ] || '-'}
                              </p>
                              {item.rationale ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {item.rationale}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : null}

                {(aiProposal.add || []).length > 0 ? (
                  <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.03] p-4 space-y-3">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {isPolish ? 'Nowe pytania do dodania' : 'New questions to add'}
                    </div>
                    {(aiProposal.add || []).map((item, index) => (
                      <label
                        key={`${item.questionText}-${index}`}
                        className="block rounded-lg border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-navy-950/40 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={!!selectedAddIdx[index]}
                            onChange={(event) =>
                              setSelectedAddIdx((prev) => ({
                                ...prev,
                                [index]: event.target.checked,
                              }))
                            }
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-c-info focus:ring-c-focus"
                          />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {item.questionText}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {ANSWER_TYPES.find(
                                (type) => type.id === normalizeAnswerType(item.answerType)
                              )?.[isPolish ? 'labelPl' : 'labelEn'] || '-'}
                            </p>
                            {item.rationale ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {item.rationale}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : null}

                {(aiProposal.remove || []).length > 0 ? (
                  <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.03] p-4 space-y-3">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {isPolish ? 'Pytania do usunięcia' : 'Questions to remove'}
                    </div>
                    {(aiProposal.remove || []).map((item) => {
                      const current = orderedQuestions.find(
                        (question) => question.id === item.questionId
                      );
                      if (!current) return null;
                      return (
                        <label
                          key={item.questionId}
                          className="block rounded-lg border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-navy-950/40 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={!!selectedRemoveIds[String(item.questionId)]}
                              onChange={(event) =>
                                setSelectedRemoveIds((prev) => ({
                                  ...prev,
                                  [String(item.questionId)]: event.target.checked,
                                }))
                              }
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-c-info focus:ring-c-focus"
                            />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <p className="text-sm font-medium text-slate-900 dark:text-white">
                                {current.questionText}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {item.reason}
                              </p>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : null}

                {aiProposal.reorder?.order?.length ? (
                  <label className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.03] p-4">
                    <input
                      type="checkbox"
                      checked={applySuggestedOrder}
                      onChange={(event) => setApplySuggestedOrder(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-c-info focus:ring-c-focus"
                    />
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {isPolish ? 'Zastosuj sugerowaną kolejność' : 'Apply suggested order'}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {aiProposal.reorder.note ||
                          (isPolish
                            ? 'AI proponuje lepszą sekwencję pytań.'
                            : 'AI suggests a better question sequence.')}
                      </p>
                    </div>
                  </label>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-200 dark:border-navy-700">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isPolish
                    ? 'Usunięcia są domyślnie odznaczone.'
                    : 'Removals are unchecked by default.'}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeAiProposalModal}
                    className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                  >
                    {isPolish ? 'Zamknij' : 'Close'}
                  </button>
                  <button
                    type="button"
                    onClick={applyAIProposal}
                    className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-full text-sm font-medium border border-c-info/40 dark:border-c-info/30 bg-navy-900 text-white dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 hover:bg-navy-800 transition-colors"
                  >
                    <Sparkles size={14} />
                    {isPolish ? 'Zastosuj sugestie AI' : 'Apply AI suggestions'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Preview as respondent — read-only, sequential render of the form */}
        {showRespondentPreview ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-6">
            <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-navy-950 shadow-2xl flex flex-col">
              <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Eye size={15} className="text-c-info dark:text-c-info" />
                    {isPolish ? 'Podgląd respondenta' : 'Respondent preview'}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {template.name ||
                      (isPolish
                        ? 'Tak respondent widzi ten formularz'
                        : 'How a respondent sees this form')}
                    {' · '}
                    {orderedQuestions.length} {isPolish ? 'pytań' : 'questions'}
                    {template.estimatedTimeMinutes
                      ? ` · ~${template.estimatedTimeMinutes} ${isPolish ? 'min' : 'min'}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRespondentPreview(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
                  aria-label={isPolish ? 'Zamknij' : 'Close'}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
                {template.description ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                    {template.description}
                  </p>
                ) : null}
                {orderedQuestions.map((question, idx) => (
                  <React.Fragment key={question.id}>
                    {question.sectionTitle ? (
                      <div className="flex items-center gap-2 pt-3 pb-1 first:pt-0">
                        <span className="text-xs font-semibold uppercase tracking-wide text-c-info dark:text-c-info">
                          {question.sectionTitle}
                        </span>
                        <span className="h-px flex-1 bg-c-info/20" />
                      </div>
                    ) : null}
                    <RespondentQuestionPreview
                      question={question}
                      index={idx}
                      isPolish={isPolish}
                    />
                  </React.Fragment>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isPolish
                    ? 'Podgląd tylko do odczytu — odpowiedzi nie są zapisywane.'
                    : 'Read-only preview — answers are not recorded.'}
                </div>
                <button
                  type="button"
                  onClick={() => setShowRespondentPreview(false)}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                >
                  {isPolish ? 'Zamknij podgląd' : 'Close preview'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* AI quality-gate result panel */}
        {qualityResult ? (
          <div className="mx-4 mb-3 rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-crimson-50 text-crimson-700 dark:bg-crimson-500/15 dark:text-crimson-300">
                  <TeresaMark size={16} />
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {isPolish ? 'Teresa sprawdziła Twój szablon' : 'Teresa reviewed your template'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isPolish
                      ? `${qualityResult.totalWarnings} uwag(a) do rozważenia`
                      : `${qualityResult.totalWarnings} item(s) to consider`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    qualityResult.averageScore >= 85
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                      : qualityResult.averageScore >= 70
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
                  }`}
                >
                  {qualityResult.averageScore}/100
                </span>
                <button
                  type="button"
                  onClick={() => setQualityResult(null)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06]"
                  aria-label={isPolish ? 'Zamknij' : 'Dismiss'}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {qualityResult.results.some((r) => r.warnings.length > 0) ? (
              <ul className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                {qualityResult.results
                  .filter((r) => r.warnings.length > 0)
                  .map((r, idx) => {
                    const q = questions.find((qq) => qq.id === r.questionId);
                    const label =
                      q?.questionText?.slice(0, 60) ||
                      (isPolish ? `Pytanie ${idx + 1}` : `Question ${idx + 1}`);
                    return (
                      <li
                        key={r.questionId || idx}
                        className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50/60 dark:bg-white/[0.03] px-3 py-2"
                      >
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                          {label}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {r.warnings.map((w, wi) => (
                            <span
                              key={wi}
                              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                w.severity === 'error'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
                                  : w.severity === 'warning'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                                    : 'bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-300'
                              }`}
                            >
                              {isPolish ? w.message.pl : w.message.en}
                            </span>
                          ))}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <div className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">
                {isPolish
                  ? 'Brak ostrzeżeń — pytania wyglądają dobrze.'
                  : 'No warnings — your questions look solid.'}
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {questions.length} {isPolish ? 'pytań łącznie' : 'total questions'}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {isPolish ? 'Anuluj' : 'Cancel'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<TeresaMark size={14} />}
              onClick={handleCheckQuality}
              disabled={isCheckingQuality || questions.length === 0}
              loading={isCheckingQuality}
              title={isPolish ? 'Sprawdź jakość pytań (AI)' : 'Check question quality (AI)'}
            >
              {isPolish ? 'Sprawdź jakość' : 'Check quality'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Save />}
              onClick={() => handleSave(false)}
              disabled={isSaving || isApplicationTemplate}
              loading={isSaving}
            >
              {isPolish ? 'Zapisz wersję roboczą' : 'Save Draft'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Send />}
              onClick={() => handleSave(true)}
              disabled={isSaving || isApplicationTemplate}
              loading={isSaving}
            >
              {isPolish ? 'Opublikuj' : 'Publish'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Question Card Component
interface QuestionCardProps {
  question: TemplateQuestion;
  index: number;
  totalCount: number;
  isPolish: boolean;
  error?: string;
  forceExpand?: boolean;
  dragHandle?: React.ReactNode;
  isDragging?: boolean;
  readOnly?: boolean;
  onUpdate: (updates: Partial<TemplateQuestion>) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onSetSection?: (title: string | undefined) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const SortableQuestionCard: React.FC<QuestionCardProps> = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.question.id,
    disabled: props.readOnly,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'z-10 relative' : undefined}>
      <QuestionCard
        {...props}
        isDragging={isDragging}
        dragHandle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(event) => event.stopPropagation()}
            className={`p-1 rounded text-slate-600 hover:text-slate-200 hover:bg-white/10 transition-colors touch-none ${
              props.readOnly
                ? 'opacity-40 cursor-not-allowed'
                : 'cursor-grab active:cursor-grabbing'
            }`}
            title={props.isPolish ? 'Przeciągnij aby zmienić kolejność' : 'Drag to reorder'}
          >
            <GripVertical size={12} />
          </button>
        }
      />
    </div>
  );
};

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  totalCount,
  isPolish,
  error,
  forceExpand = false,
  dragHandle,
  isDragging = false,
  readOnly = false,
  onUpdate,
  onDelete,
  onDuplicate,
  onSetSection,
  onMoveUp,
  onMoveDown,
}) => {
  const [isExpanded, setIsExpanded] = useState(question.isNew || false);
  const [newOption, setNewOption] = useState('');
  const [showSectionInput, setShowSectionInput] = useState(false);
  const questionTextRef = useRef<HTMLTextAreaElement | null>(null);
  const fieldClassName =
    'w-full h-10 px-3 rounded-lg bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-600 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-c-focus focus:ring-1 focus:ring-c-focus transition-all';

  const handleAddOption = () => {
    if (!newOption.trim()) return;
    onUpdate({ answerOptions: [...question.answerOptions, newOption.trim()] });
    setNewOption('');
  };

  const handleRemoveOption = (idx: number) => {
    onUpdate({ answerOptions: question.answerOptions.filter((_, i) => i !== idx) });
  };

  const openEditor = useCallback(() => {
    setIsExpanded(true);
    requestAnimationFrame(() => {
      questionTextRef.current?.focus();
      const length = questionTextRef.current?.value.length || 0;
      questionTextRef.current?.setSelectionRange(length, length);
    });
  }, []);

  useEffect(() => {
    if (forceExpand) {
      openEditor();
    }
  }, [forceExpand, openEditor]);

  return (
    <div
      className={`rounded-lg overflow-hidden transition-all ${
        error ? 'ring-1 ring-danger-500/40' : ''
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3 h-8 cursor-pointer bg-slate-100 dark:bg-navy-900 hover:bg-slate-200 dark:hover:bg-navy-800 border border-slate-200 dark:border-slate-800/70 rounded-md transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 shrink-0">
          {dragHandle}
          <ChevronRight
            size={12}
            className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
          <span className="text-[10px] font-medium w-4 text-center">{index + 1}.</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-slate-800 dark:text-slate-100 truncate">
            {question.questionText || (isPolish ? '(Nowe pytanie)' : '(New question)')}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {question.isRequired && (
            <span className="px-1.5 py-0.5 bg-danger-500/15 text-danger-500 dark:text-danger-300 text-[10px] rounded border border-danger-500/20 leading-none">
              {isPolish ? 'Wymagane' : 'Required'}
            </span>
          )}
          <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700/70 text-slate-600 dark:text-slate-200 text-[10px] rounded border border-slate-300 dark:border-slate-600/60 leading-none">
            {
              ANSWER_TYPES.find((t) => t.id === question.answerType)?.[
                isPolish ? 'labelPl' : 'labelEn'
              ]
            }
          </span>
          {question.allowVoice && <Mic size={12} className="text-slate-500 dark:text-slate-400" />}
          {question.allowFileUpload && (
            <Paperclip size={12} className="text-slate-500 dark:text-slate-400" />
          )}
          {question.allowUrl && <Link2 size={12} className="text-slate-500 dark:text-slate-400" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditor();
            }}
            className="p-1 rounded hover:bg-slate-300/50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title={isPolish ? 'Edytuj pytanie' : 'Edit question'}
          >
            <Pencil size={12} />
          </button>
          {onDuplicate ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (readOnly) return;
                onDuplicate();
              }}
              disabled={readOnly}
              className="p-1 rounded hover:bg-slate-300/50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              title={isPolish ? 'Duplikuj pytanie' : 'Duplicate question'}
            >
              <Copy size={12} />
            </button>
          ) : null}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (readOnly) return;
              onDelete();
            }}
            disabled={readOnly}
            className="p-1 rounded hover:bg-slate-300/50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-2 p-4 border border-slate-200 dark:border-navy-700 rounded-lg bg-slate-50 dark:bg-navy-900/70 space-y-4">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onMoveUp}
              disabled={readOnly || index === 0}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={readOnly || index === totalCount - 1}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Question Text */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {isPolish ? 'Tytuł / treść pytania' : 'Question title / text'} *
            </label>
            <textarea
              ref={questionTextRef}
              value={question.questionText}
              onChange={(e) => onUpdate({ questionText: e.target.value })}
              disabled={readOnly}
              placeholder={
                isPolish ? 'Wpisz nazwę i treść pytania...' : 'Enter the question title and text...'
              }
              rows={2}
              className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-900 border text-slate-900 dark:text-white placeholder-slate-500 focus:ring-1 transition-all resize-none ${
                error
                  ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/50'
                  : 'border-slate-300 dark:border-navy-600 focus:border-c-focus focus:ring-c-focus'
              }`}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {isPolish ? 'Kategoria' : 'Category'}
            </label>
            <Select
              value={question.category}
              onChange={(value) => onUpdate({ category: value as QuestionCategory })}
              disabled={readOnly}
              aria-label={isPolish ? 'Kategoria pytania' : 'Question category'}
              options={QUESTION_CATEGORIES.map((c) => ({
                value: c.id,
                label: isPolish ? c.labelPl : c.labelEn,
              }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Answer Type */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                {isPolish ? 'Typ odpowiedzi' : 'Answer Type'}
              </label>
              <Select
                value={question.answerType}
                onChange={(value) => onUpdate({ answerType: value as AnswerType })}
                disabled={readOnly}
                aria-label={isPolish ? 'Typ odpowiedzi' : 'Answer Type'}
                options={ANSWER_TYPES.map((type) => ({
                  value: type.id,
                  label: isPolish ? type.labelPl : type.labelEn,
                }))}
              />
              {/* Inline preview of how the chosen type renders to a respondent */}
              <div className="mt-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-950/40 px-3 py-2">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {(() => {
                    const Icon = ANSWER_TYPE_ICONS[question.answerType];
                    return <Icon size={11} />;
                  })()}
                  {isPolish ? 'Podgląd' : 'Preview'}
                </div>
                <AnswerTypePreview
                  answerType={question.answerType}
                  options={question.answerOptions}
                  isPolish={isPolish}
                />
              </div>
            </div>

            {/* Required */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                {isPolish ? 'Wymagane' : 'Required'}
              </label>
              <button
                onClick={() => onUpdate({ isRequired: !question.isRequired })}
                disabled={readOnly}
                className={`w-full h-10 px-3 rounded-lg border text-sm font-medium transition-all ${
                  question.isRequired
                    ? 'bg-danger-500/20 border-danger-500 text-danger-500 dark:text-danger-400'
                    : 'bg-white dark:bg-navy-900 border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
                } disabled:opacity-50 disabled:pointer-events-none`}
              >
                {question.isRequired
                  ? isPolish
                    ? 'Tak, wymagane'
                    : 'Yes, required'
                  : isPolish
                    ? 'Nie, opcjonalne'
                    : 'No, optional'}
              </button>
            </div>
          </div>

          {/* Answer Options (for select/scale) */}
          {(question.answerType === 'select' || question.answerType === 'scale') && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                {isPolish ? 'Opcje odpowiedzi' : 'Answer Options'}
              </label>
              <div className="space-y-2">
                {question.answerOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-6">{idx + 1}.</span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOptions = [...question.answerOptions];
                        newOptions[idx] = e.target.value;
                        onUpdate({ answerOptions: newOptions });
                      }}
                      disabled={readOnly}
                      className={`flex-1 ${fieldClassName}`}
                    />
                    <button
                      onClick={() => handleRemoveOption(idx)}
                      disabled={readOnly}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-danger-500/20 text-slate-600 hover:text-danger-400 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-6">+</span>
                  <input
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                    disabled={readOnly}
                    placeholder={isPolish ? 'Dodaj opcję...' : 'Add option...'}
                    className={`flex-1 ${fieldClassName}`}
                  />
                  <button
                    onClick={handleAddOption}
                    disabled={readOnly}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-c-info/20 text-c-info hover:bg-c-info/30 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              {error && error.includes('opcje') && (
                <p className="text-xs text-danger-400 mt-1">{error}</p>
              )}
            </div>
          )}

          {/* Help Hint */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {isPolish ? 'Podpowiedź (opcjonalnie)' : 'Help Hint (optional)'}
            </label>
            <input
              type="text"
              value={question.helpHint || ''}
              onChange={(e) => onUpdate({ helpHint: e.target.value })}
              disabled={readOnly}
              placeholder={
                isPolish
                  ? 'Dodatkowe wskazówki dla respondenta...'
                  : 'Additional guidance for respondent...'
              }
              className={fieldClassName}
            />
          </div>

          {/* Guidance + example — static, author-written, shown to the respondent in the answer form (Step 2 / R3) */}
          <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised/50 p-3 space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-c-text-muted">
              <HelpCircle size={11} />
              {isPolish ? 'Wskazówka dla respondenta' : 'Guidance for respondent'}
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                {isPolish ? 'Instrukcja — jak odpowiadać' : 'Instruction — how to answer'}
              </label>
              <textarea
                value={question.guidance || ''}
                onChange={(e) => onUpdate({ guidance: e.target.value })}
                disabled={readOnly}
                rows={2}
                className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-c-focus"
                placeholder={
                  isPolish
                    ? 'Statyczna instrukcja widoczna przy pytaniu w formularzu odpowiedzi...'
                    : 'Static instruction shown next to the question in the answer form...'
                }
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                {isPolish ? 'Przykładowa odpowiedź' : 'Example answer'}
              </label>
              <textarea
                value={question.exampleAnswer || ''}
                onChange={(e) => onUpdate({ exampleAnswer: e.target.value })}
                disabled={readOnly}
                rows={2}
                className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-c-focus"
                placeholder={
                  isPolish
                    ? 'np. „W 2023 OEE wyniosło 72%, głównie przez przestoje linii 3."'
                    : 'e.g. "In 2023 OEE was 72%, mainly due to Line 3 downtime."'
                }
              />
            </div>
          </div>

          {/* Description / helper text */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-500">
              {isPolish ? 'Opis / tekst pomocniczy' : 'Description / helper text'}
            </label>
            <textarea
              value={question.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              disabled={readOnly}
              rows={2}
              className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-c-focus"
              placeholder={
                isPolish
                  ? 'Dodatkowy kontekst wyświetlany pod pytaniem...'
                  : 'Additional context shown below the question...'
              }
            />
          </div>

          {/* Evidence prompt */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-500">
              {isPolish ? 'Zachęta do dowodów' : 'Evidence prompt'}
            </label>
            <input
              type="text"
              value={question.evidencePrompt || ''}
              onChange={(e) => onUpdate({ evidencePrompt: e.target.value })}
              disabled={readOnly}
              className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-c-focus"
              placeholder={
                isPolish
                  ? 'np. Załącz raport lub link do dokumentacji'
                  : 'e.g. Attach a report or link to documentation'
              }
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {isPolish ? 'Oczekiwana forma odpowiedzi' : 'Expected answer shape'}
            </label>
            <input
              type="text"
              value={question.expectedAnswerShape || ''}
              onChange={(e) => onUpdate({ expectedAnswerShape: e.target.value })}
              disabled={readOnly}
              placeholder={
                isPolish
                  ? 'np. Krótka odpowiedź z przykładem i liczbą'
                  : 'e.g. Short factual answer with one example and a number'
              }
              className={fieldClassName}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              {isPolish ? 'Dodatkowe modality odpowiedzi' : 'Additional answer modalities'}
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                {
                  key: 'allowVoice',
                  label: isPolish ? 'Nagranie głosowe' : 'Voice answer',
                  icon: Mic,
                  value: !!question.allowVoice,
                },
                {
                  key: 'allowFileUpload',
                  label: isPolish ? 'Załączniki' : 'Attachments',
                  icon: Paperclip,
                  value: !!question.allowFileUpload,
                },
                {
                  key: 'allowUrl',
                  label: isPolish ? 'Linki' : 'Links',
                  icon: Link2,
                  value: !!question.allowUrl,
                },
                {
                  key: 'allowContextNote',
                  label: isPolish ? 'Nota kontekstowa' : 'Context note',
                  icon: MessageSquare,
                  value: question.allowContextNote !== false,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      onUpdate({ [item.key]: !item.value } as Partial<TemplateQuestion>)
                    }
                    disabled={readOnly}
                    className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-sm transition-all ${
                      item.value
                        ? 'bg-c-info/12 border border-c-info/25 text-c-info dark:text-c-info'
                        : 'bg-slate-100/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.06]'
                    } disabled:opacity-50 disabled:pointer-events-none`}
                  >
                    <Icon size={14} />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section / group header for this question (persisted via the `section_title` column, round-tripped through create/update/get) */}
          {onSetSection ? (
            <div className="border-t border-slate-200 dark:border-navy-700 pt-3">
              {question.sectionTitle || showSectionInput ? (
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <Layers size={12} />
                    {isPolish
                      ? 'Nagłówek sekcji (zaczyna grupę)'
                      : 'Section header (starts a group)'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={question.sectionTitle || ''}
                      onChange={(e) => onSetSection(e.target.value)}
                      disabled={readOnly}
                      autoFocus={showSectionInput && !question.sectionTitle}
                      placeholder={isPolish ? 'np. Strategia i wizja' : 'e.g. Strategy & vision'}
                      className={`flex-1 ${fieldClassName}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onSetSection(undefined);
                        setShowSectionInput(false);
                      }}
                      disabled={readOnly}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-danger-500/20 text-slate-600 hover:text-danger-400 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      title={isPolish ? 'Usuń nagłówek sekcji' : 'Remove section header'}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSectionInput(true)}
                  disabled={readOnly}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-c-info dark:text-c-info hover:text-c-info dark:hover:text-c-info transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Plus size={12} />
                  {isPolish
                    ? 'Dodaj nagłówek sekcji nad tym pytaniem'
                    : 'Add section header above this question'}
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default TemplateBuilder;
