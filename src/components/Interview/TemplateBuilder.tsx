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
  getAnswerTypeLabel,
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
  const { t } = useTranslation();
  const sampleOptions =
    options && options.length > 0
      ? options.slice(0, 3)
      : [
          t('interview.templateBuilder.sampleOptionA'),
          t('interview.templateBuilder.sampleOptionB'),
          t('interview.templateBuilder.sampleOptionC'),
        ];

  if (answerType === 'open') {
    return (
      <div className="h-12 rounded-md border border-dashed border-c-border-strong bg-white/60 dark:bg-c-bg/40 px-2 py-1.5 text-[11px] text-c-text-muted">
        {t('interview.templateBuilder.freeTextAnswer')}
      </div>
    );
  }
  if (answerType === 'select') {
    return (
      <div className="space-y-1">
        {sampleOptions.map((opt, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px] text-c-text-muted">
            <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full border border-c-border-strong">
              {i === 0 ? (
                <span className="h-1.5 w-1.5 rounded-full bg-c-surface dark:bg-white" />
              ) : null}
            </span>
            <span className="truncate">{opt}</span>
          </div>
        ))}
      </div>
    );
  }
  if (answerType === 'dropdown') {
    return (
      <div className="flex h-8 items-center justify-between rounded-md border border-c-border-strong bg-white/60 dark:bg-c-bg/40 px-2 text-[11px] text-c-text-muted">
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
                ? 'bg-c-surface text-white'
                : 'border border-c-border-strong text-c-text-muted'
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
        <span className="rounded-full bg-c-surface px-2.5 py-0.5 text-[11px] font-medium text-white">
          {t('interview.templateBuilder.yes')}
        </span>
        <span className="rounded-full border border-c-border-strong px-2.5 py-0.5 text-[11px] text-c-text-muted">
          {t('interview.templateBuilder.no')}
        </span>
      </div>
    );
  }
  if (answerType === 'number') {
    return (
      <div className="flex h-8 w-24 items-center rounded-md border border-c-border-strong bg-white/60 dark:bg-c-bg/40 px-2 text-[11px] text-c-text-muted">
        123
      </div>
    );
  }
  if (answerType === 'date') {
    return (
      <div className="flex h-8 w-32 items-center gap-2 rounded-md border border-c-border-strong bg-white/60 dark:bg-c-bg/40 px-2 text-[11px] text-c-text-muted">
        <CalendarDays size={12} className="opacity-60" />
        {t('interview.templateBuilder.mmDdYyyy')}
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
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-c-border bg-c-surface p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-xs font-semibold text-c-text-muted">{index + 1}.</span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium text-c-text">
            {question.questionText || t('interview.templateBuilder.untitledQuestion')}
            {question.isRequired ? <span className="ml-1 text-danger-500">*</span> : null}
          </p>
          {question.description ? (
            <p className="text-xs text-c-text-muted">{question.description}</p>
          ) : null}
          <div className="pt-1">
            <AnswerTypePreview
              answerType={question.answerType}
              options={question.answerOptions}
              isPolish={isPolish}
            />
          </div>
          {question.helpHint ? (
            <p className="text-[11px] italic text-c-text-muted">{question.helpHint}</p>
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
  const { t, i18n } = useTranslation();
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
  const [showFirstUseGuide, setShowFirstUseGuide] = useState(true);
  const reviewImportInputRef = useRef<HTMLInputElement | null>(null);
  const topicInputRef = useRef<HTMLInputElement | null>(null);

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
      setShowFirstUseGuide(true);
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
      toast.error(t('interview.templateBuilder.failedToLoadTemplate'));
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
      toast.success(t('interview.templateBuilder.templateClonedOpeningCopyFor'));
      if (onSuccess && cloned?.id) {
        onSuccess({ ...cloned, id: cloned.id } as Partial<Template> & { id: string });
      }
    } catch (error) {
      console.error('[TemplateBuilder] Clone failed:', error);
      toast.error(t('interview.templateBuilder.failedToCloneTemplate'));
    } finally {
      setIsCloning(false);
    }
  }, [templateId, isCloning, isPolish, onSuccess]);

  const allowedAnswerTypesLabel = useMemo(() => {
    if (allowedAnswerTypes.length === ANSWER_TYPES.length) {
      return t('interview.templateBuilder.allAnswerTypes');
    }
    return allowedAnswerTypes
      .map((type) => getAnswerTypeLabel(type, (k, f) => t(k, f ?? k), type))
      .join(', ');
  }, [allowedAnswerTypes, t]);

  const areaTagsLabel = useMemo(() => {
    if (areaTags.length === 0) {
      return t('interview.templateBuilder.selectAreas');
    }
    return areaTags.map((tag) => getTemplateAreaTagLabel(tag, t)).join(', ');
  }, [areaTags, isPolish, t]);

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
      newErrors.name = t('interview.templateBuilder.nameIsRequired');
    }

    if (questions.length === 0) {
      newErrors.questions = t('interview.templateBuilder.addAtLeastOneQuestion');
    }

    questions.forEach((q) => {
      if (!q.questionText?.trim()) {
        newErrors[`question_${q.id}`] = t('interview.templateBuilder.questionTextIsRequired');
        if (!firstInvalidQuestion) {
          firstInvalidQuestion = {
            id: q.id,
            message: t('interview.templateBuilder.oneOfTheQuestionsIs'),
          };
        }
      }
      if ((q.answerType === 'select' || q.answerType === 'scale') && q.answerOptions.length < 2) {
        newErrors[`options_${q.id}`] = t('interview.templateBuilder.addAtLeast2Options');
        if (!firstInvalidQuestion) {
          firstInvalidQuestion = {
            id: q.id,
            message: t('interview.templateBuilder.aSelectScaleQuestionNeeds'),
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
        t('interview.templateBuilder.fixFormErrors'),
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
          toast.error(t('interview.templateBuilder.addQuestionsToCheckQuality'));
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
          toast.error(t('interview.templateBuilder.couldNotCheckTemplateQuality'));
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
      toast.success(t('interview.templateBuilder.templateQualityLooksGreat'));
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

        // Draft saves remain editable. Publish is a separate atomic server
        // transaction that replaces questions and creates an immutable version.
        const templateData = {
          ...template,
          scope: template.scope || 'organization',
          status: 'draft',
        };

        if (!templateId) {
          createdTemplateResponse = await Api.post('/interview/templates', templateData);
          savedTemplateId = (createdTemplateResponse as any).id;
        }

        const publicationQuestions = questions.map((question) => ({
          ...(!question.isNew ? { id: question.id } : {}),
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
        }));

        if (publish && savedTemplateId) {
          await Api.post(`/interview/templates/${savedTemplateId}/publish`, {
            template: templateData,
            questions: publicationQuestions,
            expectedVersion: Number(
              templateId ? template.version || 0 : createdTemplateResponse?.version || 0
            ),
          });
        } else if (savedTemplateId) {
          if (templateId) {
            await Api.patch(`/interview/templates/${templateId}`, templateData);
          }
          for (const deletedId of deletedQuestionIds) {
            await Api.delete(`/interview/templates/${savedTemplateId}/questions/${deletedId}`);
          }

          for (const [index, question] of questions.entries()) {
            const questionData = publicationQuestions[index];
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
            ? t('interview.templateBuilder.templatePublished')
            : t('interview.templateBuilder.templateSaved')
        );

        // Non-blocking AI quality gate: surface a warning when questions are weak.
        const quality = await evaluateQuality(true);
        if (quality && (quality.averageScore < 70 || quality.totalWarnings > 0)) {
          toast(
            t('interview.templateBuilder.templateQualitySummary', {
              score: quality.averageScore,
              warnings: quality.totalWarnings,
            }),
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
        toast.error(t('interview.templateBuilder.failedToSaveTemplate'));
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
      toast.error(t('interview.templateBuilder.addABriefDescriptionOr'));
      return;
    }

    if (
      questions.length > 0 &&
      !window.confirm(t('interview.templateBuilder.aiWillReplaceTheCurrent'))
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

    const userPrompt = `Language: ${t('interview.templateBuilder.english')}
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
      toast.success(t('interview.templateBuilder.aiPreparedATemplateDraft'));
    } catch (error) {
      console.error('[TemplateBuilder] AI generation failed:', error);
      toast.error(t('interview.templateBuilder.failedToGenerateAiDraft'));
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
        toast.error(t('interview.templateBuilder.onlyTxtAndPdfAre'));
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
        toast.error(t('interview.templateBuilder.failedToImportFile'));
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
        toast.error(t('interview.templateBuilder.addQuestionsOrUploadA'));
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
            reason: t('interview.templateBuilder.shortTestPotentiallyLowQuality'),
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

        const userPrompt = `Language: ${t('interview.templateBuilder.english')}
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
          toast.success(t('interview.templateBuilder.aiBelievesTheSurveyAlready'));
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
        toast.error(t('interview.templateBuilder.failedToPrepareAiSuggestions'));
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
        t('interview.templateBuilder.confirmRemoveQuestions', { count: removeIds.size })
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
    toast.success(t('interview.templateBuilder.appliedAiSuggestions'));
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
            ? 'relative bg-c-surface border border-c-border rounded-2xl w-full h-full overflow-hidden flex flex-col'
            : 'relative bg-c-surface border border-c-border rounded-2xl shadow-2xl w-full max-w-[1080px] mx-4 max-h-[90vh] overflow-hidden flex flex-col'
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-10 border-b border-c-border/60 shrink-0 bg-c-surface-raised text-c-text">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={12} className="text-amber-600 dark:text-amber-300 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-c-text-secondary">
                {template.status === 'draft'
                  ? t('interview.templateBuilder.draft')
                  : t('interview.templateBuilder.published')}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center h-6 w-6 rounded-md text-c-text-muted hover:bg-c-surface-raised hover:text-c-text dark:hover:bg-white/10 dark:hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {isLoading ? (
          <LoadingState variant="spinner" className="flex-1 py-0" />
        ) : (
          <div className="flex-1 flex overflow-hidden bg-c-surface">
            {/* Left Panel - Template Metadata */}
            <div className="w-[300px] border-r border-c-border-strong/80 px-4 py-6 overflow-auto shrink-0">
              {/* Name */}
              <div className="mb-3">
                <label className="block text-[11px] font-medium text-c-text-muted mb-1.5">
                  {t('interview.templateBuilder.topic')} *
                </label>
                <input
                  ref={topicInputRef}
                  id="interview-template-topic"
                  type="text"
                  value={template.name || ''}
                  onChange={(e) => setTemplate((prev) => ({ ...prev, name: e.target.value }))}
                  disabled={isApplicationTemplate}
                  placeholder={t('interview.templateBuilder.eGDigitalMaturityIn')}
                  className={`w-full h-9 px-3 rounded-md bg-c-surface border text-c-text placeholder-c-text-muted focus:ring-1 transition-all ${
                    errors.name
                      ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/50'
                      : 'border-c-border-strong focus:border-c-focus focus:ring-c-focus'
                  }`}
                />
                {errors.name && <p className="text-xs text-danger-400 mt-1">{errors.name}</p>}
              </div>

              {/* Description */}
              <div className="mb-3">
                <label className="block text-[11px] font-medium text-c-text-muted mb-1.5">
                  {t('interview.templateBuilder.description')}
                </label>
                <textarea
                  value={template.description || ''}
                  onChange={(e) =>
                    setTemplate((prev) => ({ ...prev, description: e.target.value }))
                  }
                  disabled={isApplicationTemplate}
                  placeholder={t('interview.templateBuilder.describeTheSurveyGoalBusiness')}
                  rows={6}
                  className="w-full px-3 py-2 rounded-md bg-c-surface-raised border border-c-border-strong text-c-text placeholder-c-text-muted focus:border-c-focus focus:ring-1 focus:ring-c-focus transition-all resize-none"
                />
              </div>

              {isApplicationTemplate ? (
                <div className="mb-3 rounded-lg border border-c-info/20 bg-c-info/8 px-3 py-2.5">
                  <p className="text-[11px] leading-relaxed text-c-info dark:text-c-info mb-2">
                    {t('interview.templateBuilder.thisIsASystemTemplate')}
                  </p>
                  <button
                    type="button"
                    onClick={handleCloneTemplate}
                    disabled={isCloning}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold bg-c-surface text-white hover:bg-c-info transition-colors disabled:opacity-50"
                  >
                    {isCloning ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Copy size={13} />
                    )}
                    {t('interview.templateBuilder.cloneToEdit')}
                  </button>
                </div>
              ) : null}

              <div className="mb-3">
                <label className="block text-[11px] font-medium text-c-text-muted mb-1.5">
                  {t('interview.templateBuilder.library')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      id: 'private',
                      label: t('interview.templateBuilder.personal'),
                    },
                    {
                      id: 'organization',
                      label: t('interview.templateBuilder.organization'),
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
                            : 'border-c-border/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-c-text-secondary hover:bg-c-surface-raised/70 dark:hover:bg-white/[0.06]'
                        } disabled:opacity-50 disabled:pointer-events-none`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-3 relative">
                <label className="block text-[11px] font-medium text-c-text-muted mb-1.5">
                  {t('interview.templateBuilder.availableAnswerTypes')}
                </label>
                <button
                  type="button"
                  onClick={() => setIsAnswerTypeMenuOpen((prev) => !prev)}
                  disabled={isApplicationTemplate}
                  className="w-full h-10 px-3 rounded-md bg-c-surface-raised border border-c-border-strong text-c-text focus:border-c-focus focus:ring-1 focus:ring-c-focus transition-all flex items-center justify-between gap-3"
                >
                  <span className="truncate text-left text-sm">{allowedAnswerTypesLabel}</span>
                  <ChevronDown
                    size={15}
                    className={`shrink-0 transition-transform ${isAnswerTypeMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isAnswerTypeMenuOpen ? (
                  <div className="absolute z-10 mt-2 w-full rounded-xl border border-c-border dark:border-white/[0.08] bg-c-surface shadow-xl p-2 space-y-1">
                    {ANSWER_TYPES.map((type) => {
                      const checked = allowedAnswerTypes.includes(type.id);
                      return (
                        <label
                          key={type.id}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-c-text-secondary hover:bg-c-bg dark:hover:bg-white/[0.04] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAllowedAnswerType(type.id)}
                            disabled={isApplicationTemplate}
                            className="h-4 w-4 rounded border-c-border-strong text-c-info focus:ring-c-focus"
                          />
                          <span>
                            {t(
                              `interview.templateBuilder.answerTypeLabel.${type.id}`,
                              type.labelEn
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="mb-3 relative">
                <label className="block text-[11px] font-medium text-c-text-muted mb-1.5">
                  {t('interview.templateBuilder.areaTags')}
                </label>
                <button
                  type="button"
                  onClick={() => setIsAreaTagsMenuOpen((prev) => !prev)}
                  disabled={isApplicationTemplate}
                  className="w-full h-10 px-3 rounded-md bg-c-surface-raised border border-c-border-strong text-c-text focus:border-c-focus focus:ring-1 focus:ring-c-focus transition-all flex items-center justify-between gap-3"
                >
                  <span className="truncate text-left text-sm">{areaTagsLabel}</span>
                  <ChevronDown
                    size={15}
                    className={`shrink-0 transition-transform ${isAreaTagsMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isAreaTagsMenuOpen ? (
                  <div className="absolute z-10 mt-2 w-full rounded-xl border border-c-border dark:border-white/[0.08] bg-c-surface shadow-xl p-2 space-y-1 max-h-64 overflow-auto">
                    {INTERVIEW_TEMPLATE_AREA_TAG_OPTIONS.map((tag) => {
                      const checked = areaTags.includes(tag);
                      return (
                        <label
                          key={tag}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-c-text-secondary hover:bg-c-bg dark:hover:bg-white/[0.04] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAreaTag(tag)}
                            disabled={isApplicationTemplate}
                            className="h-4 w-4 rounded border-c-border-strong text-c-info focus:ring-c-focus"
                          />
                          <span>{getTemplateAreaTagLabel(tag, t)}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-medium text-c-text-muted mb-1.5">
                    {t('interview.templateBuilder.questionCount')}
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
                    className="w-full h-9 px-3 rounded-md bg-c-surface-raised border border-c-border-strong text-c-text focus:border-c-focus focus:ring-1 focus:ring-c-focus transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-c-text-muted mb-1.5">
                    {t('interview.templateBuilder.tolerance')}
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
                    className="w-full h-9 px-3 rounded-md bg-c-surface-raised border border-c-border-strong text-c-text focus:border-c-focus focus:ring-1 focus:ring-c-focus transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="mb-3">
                  <label className="block text-[11px] font-medium text-c-text-muted mb-1.5">
                    {t('interview.templateBuilder.timeMin')}
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
                    className="w-full h-9 px-3 rounded-md bg-c-surface-raised border border-c-border-strong text-c-text focus:border-c-focus focus:ring-1 focus:ring-c-focus transition-all"
                  />
                </div>

                <div className="mb-3">
                  <label className="block text-[11px] font-medium text-c-text-muted mb-1.5">
                    {t('interview.templateBuilder.runtimeMode')}
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
                    aria-label={t('interview.templateBuilder.runtimeMode')}
                    options={RUNTIME_MODE_OPTIONS.map((opt) => ({
                      value: opt.id,
                      label: t(`interview.templateBuilder.runtimeModeLabel.${opt.id}`, opt.labelEn),
                    }))}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={isAiGenerating || isApplicationTemplate}
                className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-sm font-semibold border border-c-info/40 dark:border-c-info/30 bg-c-surface text-white dark:bg-c-bg dark:text-c-text dark:hover:bg-c-surface-raised hover:bg-c-surface-raised transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {isAiGenerating ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                {t('interview.templateBuilder.createSurveyWithAi')}
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
            <div className="flex-1 flex flex-col overflow-hidden bg-c-bg/40 dark:bg-c-bg/30">
              {/* Questions Header */}
              <div className="relative px-4 h-12 border-b border-c-border-strong/80 flex items-center justify-end shrink-0">
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[11px] text-c-text-muted">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>
                    ({orderedQuestions.length} {t('interview.templateBuilder.questions')})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Eye />}
                    onClick={() => setShowRespondentPreview(true)}
                    disabled={orderedQuestions.length === 0}
                    title={t('interview.templateBuilder.seeTheFormAsA')}
                  >
                    {t('interview.templateBuilder.preview')}
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
                    {t('interview.templateBuilder.addQuestion')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Sparkles />}
                    onClick={() => void proposeQuestionImprovementsWithAI()}
                    disabled={isAiGenerating || isApplicationTemplate}
                    loading={isAiGenerating}
                    title={t('interview.templateBuilder.useAiToReviewImprove')}
                    className="text-c-info border-c-info/30 hover:bg-c-info/5 dark:hover:bg-c-info/10"
                  >
                    {t('interview.templateBuilder.improveWithAi')}
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

              {!templateId && showFirstUseGuide && (
                <section
                  aria-labelledby="template-first-use-title"
                  className="mx-3 mt-3 rounded-xl border border-c-info/25 bg-c-info/5 px-4 py-3"
                  data-testid="template-builder-first-use-guide"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3
                        id="template-first-use-title"
                        className="text-sm font-semibold text-c-text"
                      >
                        {t('interview.templateBuilder.firstUseTitle')}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-c-text-muted">
                        {t('interview.templateBuilder.firstUseDescription')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFirstUseGuide(false)}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-c-text-muted hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      aria-label={t('interview.templateBuilder.dismissFirstUseGuide')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <ol className="mt-3 grid gap-2 text-xs text-c-text-secondary md:grid-cols-3">
                    <li>
                      <span className="font-semibold text-c-text">1. </span>
                      {t('interview.templateBuilder.firstUseStepTopic')}
                    </li>
                    <li>
                      <span className="font-semibold text-c-text">2. </span>
                      {t('interview.templateBuilder.firstUseStepQuestions')}
                    </li>
                    <li>
                      <span className="font-semibold text-c-text">3. </span>
                      {t('interview.templateBuilder.firstUseStepVerify')}
                    </li>
                  </ol>
                  <button
                    type="button"
                    onClick={() => topicInputRef.current?.focus()}
                    className="mt-3 inline-flex h-8 items-center rounded-lg border border-c-info/30 bg-c-surface px-3 text-xs font-semibold text-c-info transition-colors hover:bg-c-info/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    {t('interview.templateBuilder.startWithTopic')}
                  </button>
                </section>
              )}

              {/* Questions List */}
              <div className="flex-1 overflow-auto p-3 space-y-2">
                {orderedQuestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <HelpCircle size={48} className="text-c-text-secondary mb-4" />
                    <p className="text-c-text-muted text-sm mb-4">
                      {t('interview.templateBuilder.noQuestionsInThisForm')}
                    </p>
                    <Button variant="primary" icon={<Plus />} onClick={handleAddQuestion}>
                      {t('interview.templateBuilder.addFirstQuestion')}
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
                              <Layers size={13} className="shrink-0 text-c-info dark:text-c-info" />
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
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-c-surface-raised/55 backdrop-blur-sm p-6">
            <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-c-border dark:border-white/[0.08] bg-c-surface shadow-2xl flex flex-col">
              <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-c-border">
                <div>
                  <div className="text-sm font-semibold text-c-text">
                    {t('interview.templateBuilder.aiChangeProposal')}
                  </div>
                  <p className="text-xs text-c-text-muted mt-1">
                    {aiProposal.summary || t('interview.templateBuilder.aiReviewedTheSurveyAnd')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeAiProposalModal}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-c-border/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-white/[0.08] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
                {(aiProposal.update || []).length > 0 ? (
                  <div className="rounded-xl border border-c-border dark:border-white/[0.08] bg-c-bg/80 dark:bg-white/[0.03] p-4 space-y-3">
                    <div className="text-sm font-medium text-c-text">
                      {t('interview.templateBuilder.updatesToExistingQuestions')}
                    </div>
                    {(aiProposal.update || []).map((item) => {
                      const current = orderedQuestions.find(
                        (question) => question.id === item.questionId
                      );
                      if (!current) return null;
                      return (
                        <label
                          key={item.questionId}
                          className="block rounded-lg border border-c-border dark:border-white/[0.06] bg-c-surface/40 p-3"
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
                              className="mt-1 h-4 w-4 rounded border-c-border-strong text-c-info focus:ring-c-focus"
                            />
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="text-xs text-c-text-muted">
                                {t('interview.templateBuilder.current')}
                              </div>
                              <p className="text-sm text-c-text-secondary">
                                {current.questionText}
                              </p>
                              <div className="text-xs text-c-text-muted">
                                {t('interview.templateBuilder.aiProposal')}
                              </div>
                              <p className="text-sm font-medium text-c-text">
                                {item.questionText || current.questionText}
                              </p>
                              <p className="text-xs text-c-text-muted">
                                {getAnswerTypeLabel(
                                  item.answerType
                                    ? normalizeAnswerType(item.answerType)
                                    : current.answerType,
                                  (k, f) => t(k, f ?? k),
                                  '-'
                                )}
                              </p>
                              {item.rationale ? (
                                <p className="text-xs text-c-text-muted">{item.rationale}</p>
                              ) : null}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : null}

                {(aiProposal.add || []).length > 0 ? (
                  <div className="rounded-xl border border-c-border dark:border-white/[0.08] bg-c-bg/80 dark:bg-white/[0.03] p-4 space-y-3">
                    <div className="text-sm font-medium text-c-text">
                      {t('interview.templateBuilder.newQuestionsToAdd')}
                    </div>
                    {(aiProposal.add || []).map((item, index) => (
                      <label
                        key={`${item.questionText}-${index}`}
                        className="block rounded-lg border border-c-border dark:border-white/[0.06] bg-c-surface/40 p-3"
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
                            className="mt-1 h-4 w-4 rounded border-c-border-strong text-c-info focus:ring-c-focus"
                          />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <p className="text-sm font-medium text-c-text">{item.questionText}</p>
                            <p className="text-xs text-c-text-muted">
                              {getAnswerTypeLabel(
                                normalizeAnswerType(item.answerType),
                                (k, f) => t(k, f ?? k),
                                '-'
                              )}
                            </p>
                            {item.rationale ? (
                              <p className="text-xs text-c-text-muted">{item.rationale}</p>
                            ) : null}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : null}

                {(aiProposal.remove || []).length > 0 ? (
                  <div className="rounded-xl border border-c-border dark:border-white/[0.08] bg-c-bg/80 dark:bg-white/[0.03] p-4 space-y-3">
                    <div className="text-sm font-medium text-c-text">
                      {t('interview.templateBuilder.questionsToRemove')}
                    </div>
                    {(aiProposal.remove || []).map((item) => {
                      const current = orderedQuestions.find(
                        (question) => question.id === item.questionId
                      );
                      if (!current) return null;
                      return (
                        <label
                          key={item.questionId}
                          className="block rounded-lg border border-c-border dark:border-white/[0.06] bg-c-surface/40 p-3"
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
                              className="mt-1 h-4 w-4 rounded border-c-border-strong text-c-info focus:ring-c-focus"
                            />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <p className="text-sm font-medium text-c-text">
                                {current.questionText}
                              </p>
                              <p className="text-xs text-c-text-muted">{item.reason}</p>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : null}

                {aiProposal.reorder?.order?.length ? (
                  <label className="flex items-start gap-3 rounded-xl border border-c-border dark:border-white/[0.08] bg-c-bg/80 dark:bg-white/[0.03] p-4">
                    <input
                      type="checkbox"
                      checked={applySuggestedOrder}
                      onChange={(event) => setApplySuggestedOrder(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-c-border-strong text-c-info focus:ring-c-focus"
                    />
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-c-text">
                        {t('interview.templateBuilder.applySuggestedOrder')}
                      </div>
                      <p className="text-xs text-c-text-muted">
                        {aiProposal.reorder.note ||
                          t('interview.templateBuilder.aiSuggestsABetterQuestion')}
                      </p>
                    </div>
                  </label>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-c-border">
                <div className="text-xs text-c-text-muted">
                  {t('interview.templateBuilder.removalsAreUncheckedByDefault')}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeAiProposalModal}
                    className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium border border-c-border/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-c-text-secondary hover:bg-c-surface-raised/70 dark:hover:bg-white/[0.06] transition-colors"
                  >
                    {t('interview.templateBuilder.close')}
                  </button>
                  <button
                    type="button"
                    onClick={applyAIProposal}
                    className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-full text-sm font-medium border border-c-info/40 dark:border-c-info/30 bg-c-surface text-white dark:bg-c-bg dark:text-c-text dark:hover:bg-c-surface-raised hover:bg-c-surface-raised transition-colors"
                  >
                    <Sparkles size={14} />
                    {t('interview.templateBuilder.applyAiSuggestions')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Preview as respondent — read-only, sequential render of the form */}
        {showRespondentPreview ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-c-surface-raised/55 backdrop-blur-sm p-6">
            <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-c-border dark:border-white/[0.08] bg-c-bg shadow-2xl flex flex-col">
              <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-c-border bg-c-surface">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-c-text">
                    <Eye size={15} className="text-c-info dark:text-c-info" />
                    {t('interview.templateBuilder.respondentPreview')}
                  </div>
                  <p className="text-xs text-c-text-muted mt-1">
                    {template.name || t('interview.templateBuilder.howARespondentSeesThis')}
                    {' · '}
                    {orderedQuestions.length} {t('interview.templateBuilder.questions')}
                    {template.estimatedTimeMinutes
                      ? ` · ~${template.estimatedTimeMinutes} ${t('interview.templateBuilder.min')}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRespondentPreview(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-c-border/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-white/[0.08] transition-colors"
                  aria-label={t('interview.templateBuilder.close')}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
                {template.description ? (
                  <p className="text-xs text-c-text-muted mb-1">{template.description}</p>
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

              <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-c-border bg-c-surface">
                <div className="text-xs text-c-text-muted">
                  {t('interview.templateBuilder.readOnlyPreviewAnswersAre')}
                </div>
                <button
                  type="button"
                  onClick={() => setShowRespondentPreview(false)}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium border border-c-border/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-c-text-secondary hover:bg-c-surface-raised/70 dark:hover:bg-white/[0.06] transition-colors"
                >
                  {t('interview.templateBuilder.closePreview')}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* AI quality-gate result panel */}
        {qualityResult ? (
          <div className="mx-4 mb-3 rounded-2xl border border-c-border bg-c-surface p-4 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-c-info/10 text-c-info dark:bg-c-info/15">
                  <TeresaMark size={16} />
                </span>
                <div>
                  <div className="text-sm font-semibold text-c-text">
                    {t('interview.templateBuilder.teresaReviewedYourTemplate')}
                  </div>
                  <div className="text-xs text-c-text-muted">
                    {t('interview.templateBuilder.itemsToConsider', {
                      count: qualityResult.totalWarnings,
                    })}
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
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text-secondary dark:hover:bg-white/[0.06]"
                  aria-label={t('interview.templateBuilder.dismiss')}
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
                      t('interview.templateBuilder.questionNumberFallback', { number: idx + 1 });
                    return (
                      <li
                        key={r.questionId || idx}
                        className="rounded-xl border border-c-border bg-c-bg/60 dark:bg-white/[0.03] px-3 py-2"
                      >
                        <div className="text-xs font-medium text-c-text-secondary truncate">
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
                                    : 'bg-c-surface-raised text-c-text-secondary dark:bg-white/[0.08] dark:text-c-text-muted'
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
                {t('interview.templateBuilder.noWarningsYourQuestionsLook')}
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <div className="p-4 border-t border-c-border flex items-center justify-between shrink-0">
          <div className="text-xs text-c-text-muted">
            {questions.length} {t('interview.templateBuilder.totalQuestions')}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('interview.templateBuilder.cancel')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<TeresaMark size={14} />}
              onClick={handleCheckQuality}
              disabled={isCheckingQuality || questions.length === 0}
              loading={isCheckingQuality}
              title={t('interview.templateBuilder.checkQuestionQualityAi')}
            >
              {t('interview.templateBuilder.checkQuality')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Save />}
              onClick={() => handleSave(false)}
              disabled={isSaving || isApplicationTemplate}
              loading={isSaving}
            >
              {t('interview.templateBuilder.saveDraft')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Send />}
              onClick={() => handleSave(true)}
              disabled={isSaving || isApplicationTemplate}
              loading={isSaving}
            >
              {t('interview.templateBuilder.publish')}
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
  const { t } = useTranslation();
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
            className={`p-1 rounded text-c-text-secondary hover:text-c-text-muted hover:bg-white/10 transition-colors touch-none ${
              props.readOnly
                ? 'opacity-40 cursor-not-allowed'
                : 'cursor-grab active:cursor-grabbing'
            }`}
            title={t('interview.templateBuilder.dragToReorder')}
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
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(question.isNew || false);
  const [newOption, setNewOption] = useState('');
  const [showSectionInput, setShowSectionInput] = useState(false);
  const questionTextRef = useRef<HTMLTextAreaElement | null>(null);
  const fieldClassName =
    'w-full h-10 px-3 rounded-lg bg-c-surface border border-c-border-strong text-sm text-c-text placeholder-c-text-muted dark:placeholder-c-text-muted focus:border-c-focus focus:ring-1 focus:ring-c-focus transition-all';

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
        className="flex items-center gap-2.5 px-3 h-8 cursor-pointer bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-c-surface-raised border border-c-border rounded-md transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-1.5 text-c-text-muted shrink-0">
          {dragHandle}
          <ChevronRight
            size={12}
            className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
          <span className="text-[10px] font-medium w-4 text-center">{index + 1}.</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-c-text truncate">
            {question.questionText || t('interview.templateBuilder.newQuestion')}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {question.isRequired && (
            <span className="px-1.5 py-0.5 bg-danger-500/15 text-danger-500 dark:text-danger-300 text-[10px] rounded border border-danger-500/20 leading-none">
              {t('interview.templateBuilder.required')}
            </span>
          )}
          <span className="px-1.5 py-0.5 bg-c-surface-raised/70 text-c-text-secondary text-[10px] rounded border border-c-border-strong dark:border-c-border-strong/60 leading-none">
            {getAnswerTypeLabel(question.answerType, (k, f) => t(k, f ?? k))}
          </span>
          {question.allowVoice && <Mic size={12} className="text-c-text-muted" />}
          {question.allowFileUpload && <Paperclip size={12} className="text-c-text-muted" />}
          {question.allowUrl && <Link2 size={12} className="text-c-text-muted" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditor();
            }}
            className="p-1 rounded hover:bg-c-surface-raised/50 dark:hover:bg-white/10 text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted transition-colors"
            title={t('interview.templateBuilder.editQuestion')}
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
              className="p-1 rounded hover:bg-c-surface-raised/50 dark:hover:bg-white/10 text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
              title={t('interview.templateBuilder.duplicateQuestion')}
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
            className="p-1 rounded hover:bg-c-surface-raised/50 dark:hover:bg-white/10 text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-2 p-4 border border-c-border rounded-lg bg-c-bg/70 space-y-4">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onMoveUp}
              disabled={readOnly || index === 0}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-c-border text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={readOnly || index === totalCount - 1}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-c-border text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Question Text */}
          <div>
            <label className="block text-xs font-medium text-c-text-muted mb-1.5">
              {t('interview.templateBuilder.questionTitleText')} *
            </label>
            <textarea
              ref={questionTextRef}
              value={question.questionText}
              onChange={(e) => onUpdate({ questionText: e.target.value })}
              disabled={readOnly}
              placeholder={t('interview.templateBuilder.enterTheQuestionTitleAnd')}
              rows={2}
              className={`w-full px-3 py-2 rounded-lg bg-c-surface border text-c-text placeholder-c-text-muted focus:ring-1 transition-all resize-none ${
                error
                  ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/50'
                  : 'border-c-border-strong focus:border-c-focus focus:ring-c-focus'
              }`}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-c-text-muted mb-1.5">
              {t('interview.templateBuilder.category')}
            </label>
            <Select
              value={question.category}
              onChange={(value) => onUpdate({ category: value as QuestionCategory })}
              disabled={readOnly}
              aria-label={t('interview.templateBuilder.questionCategory')}
              options={QUESTION_CATEGORIES.map((c) => ({
                value: c.id,
                label: t(`interview.templateBuilder.categoryLabel.${c.id}`, c.labelEn),
              }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Answer Type */}
            <div>
              <label className="block text-xs font-medium text-c-text-muted mb-1.5">
                {t('interview.templateBuilder.answerType')}
              </label>
              <Select
                value={question.answerType}
                onChange={(value) => onUpdate({ answerType: value as AnswerType })}
                disabled={readOnly}
                aria-label={t('interview.templateBuilder.answerType')}
                options={ANSWER_TYPES.map((type) => ({
                  value: type.id,
                  label: t(`interview.templateBuilder.answerTypeLabel.${type.id}`, type.labelEn),
                }))}
              />
              {/* Inline preview of how the chosen type renders to a respondent */}
              <div className="mt-2 rounded-lg border border-c-border bg-white/60 dark:bg-c-bg/40 px-3 py-2">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-c-text-muted">
                  {(() => {
                    const Icon = ANSWER_TYPE_ICONS[question.answerType];
                    return <Icon size={11} />;
                  })()}
                  {t('interview.templateBuilder.preview')}
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
              <label className="block text-xs font-medium text-c-text-muted mb-1.5">
                {t('interview.templateBuilder.required')}
              </label>
              <button
                onClick={() => onUpdate({ isRequired: !question.isRequired })}
                disabled={readOnly}
                className={`w-full h-10 px-3 rounded-lg border text-sm font-medium transition-all ${
                  question.isRequired
                    ? 'bg-danger-500/20 border-danger-500 text-danger-500 dark:text-danger-400'
                    : 'bg-c-surface border-c-border-strong text-c-text-muted hover:border-c-border-strong dark:hover:border-c-border-strong'
                } disabled:opacity-50 disabled:pointer-events-none`}
              >
                {question.isRequired
                  ? t('interview.templateBuilder.yesRequired')
                  : t('interview.templateBuilder.noOptional')}
              </button>
            </div>
          </div>

          {/* Answer Options (for select/scale) */}
          {(question.answerType === 'select' || question.answerType === 'scale') && (
            <div>
              <label className="block text-xs font-medium text-c-text-muted mb-1.5">
                {t('interview.templateBuilder.answerOptions')}
              </label>
              <div className="space-y-2">
                {question.answerOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-c-text-muted w-6">{idx + 1}.</span>
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
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-danger-500/20 text-c-text-secondary hover:text-danger-400 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-c-text-muted w-6">+</span>
                  <input
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                    disabled={readOnly}
                    placeholder={t('interview.templateBuilder.addOption')}
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
            <label className="block text-xs font-medium text-c-text-muted mb-1.5">
              {t('interview.templateBuilder.helpHintOptional')}
            </label>
            <input
              type="text"
              value={question.helpHint || ''}
              onChange={(e) => onUpdate({ helpHint: e.target.value })}
              disabled={readOnly}
              placeholder={t('interview.templateBuilder.additionalGuidanceForRespondent')}
              className={fieldClassName}
            />
          </div>

          {/* Guidance + example — static, author-written, shown to the respondent in the answer form (Step 2 / R3) */}
          <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised/50 p-3 space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-c-text-muted">
              <HelpCircle size={11} />
              {t('interview.templateBuilder.guidanceForRespondent')}
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-c-text-muted">
                {t('interview.templateBuilder.instructionHowToAnswer')}
              </label>
              <textarea
                value={question.guidance || ''}
                onChange={(e) => onUpdate({ guidance: e.target.value })}
                disabled={readOnly}
                rows={2}
                className="w-full rounded-xl border border-c-border bg-c-surface px-3 py-2 text-xs text-c-text-secondary resize-none focus:outline-none focus:ring-1 focus:ring-c-focus"
                placeholder={t('interview.templateBuilder.staticInstructionShownNextTo')}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-c-text-muted">
                {t('interview.templateBuilder.exampleAnswer')}
              </label>
              <textarea
                value={question.exampleAnswer || ''}
                onChange={(e) => onUpdate({ exampleAnswer: e.target.value })}
                disabled={readOnly}
                rows={2}
                className="w-full rounded-xl border border-c-border bg-c-surface px-3 py-2 text-xs text-c-text-secondary resize-none focus:outline-none focus:ring-1 focus:ring-c-focus"
                placeholder={t('interview.templateBuilder.eGIn2023Oee')}
              />
            </div>
          </div>

          {/* Description / helper text */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-c-text-secondary">
              {t('interview.templateBuilder.descriptionHelperText')}
            </label>
            <textarea
              value={question.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              disabled={readOnly}
              rows={2}
              className="w-full rounded-xl border border-c-border bg-c-surface px-3 py-2 text-xs text-c-text-secondary resize-none focus:outline-none focus:ring-1 focus:ring-c-focus"
              placeholder={t('interview.templateBuilder.additionalContextShownBelowThe')}
            />
          </div>

          {/* Evidence prompt */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-c-text-secondary">
              {t('interview.templateBuilder.evidencePrompt')}
            </label>
            <input
              type="text"
              value={question.evidencePrompt || ''}
              onChange={(e) => onUpdate({ evidencePrompt: e.target.value })}
              disabled={readOnly}
              className="w-full rounded-xl border border-c-border bg-c-surface px-3 py-2 text-xs text-c-text-secondary focus:outline-none focus:ring-1 focus:ring-c-focus"
              placeholder={t('interview.templateBuilder.eGAttachAReport')}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-c-text-muted mb-1.5">
              {t('interview.templateBuilder.expectedAnswerShape')}
            </label>
            <input
              type="text"
              value={question.expectedAnswerShape || ''}
              onChange={(e) => onUpdate({ expectedAnswerShape: e.target.value })}
              disabled={readOnly}
              placeholder={t('interview.templateBuilder.eGShortFactualAnswer')}
              className={fieldClassName}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-c-text-muted mb-2">
              {t('interview.templateBuilder.additionalAnswerModalities')}
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                {
                  key: 'allowVoice',
                  label: t('interview.templateBuilder.voiceAnswer'),
                  icon: Mic,
                  value: !!question.allowVoice,
                },
                {
                  key: 'allowFileUpload',
                  label: t('interview.templateBuilder.attachments'),
                  icon: Paperclip,
                  value: !!question.allowFileUpload,
                },
                {
                  key: 'allowUrl',
                  label: t('interview.templateBuilder.links'),
                  icon: Link2,
                  value: !!question.allowUrl,
                },
                {
                  key: 'allowContextNote',
                  label: t('interview.templateBuilder.contextNote'),
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
                        : 'bg-c-surface-raised/80 dark:bg-white/[0.03] border border-c-border/80 dark:border-white/[0.06] text-c-text-secondary hover:bg-c-surface-raised/70 dark:hover:bg-white/[0.06]'
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
            <div className="border-t border-c-border pt-3">
              {question.sectionTitle || showSectionInput ? (
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-c-text-muted">
                    <Layers size={12} />
                    {t('interview.templateBuilder.sectionHeaderStartsAGroup')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={question.sectionTitle || ''}
                      onChange={(e) => onSetSection(e.target.value)}
                      disabled={readOnly}
                      autoFocus={showSectionInput && !question.sectionTitle}
                      placeholder={t('interview.templateBuilder.eGStrategyVision')}
                      className={`flex-1 ${fieldClassName}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onSetSection(undefined);
                        setShowSectionInput(false);
                      }}
                      disabled={readOnly}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-danger-500/20 text-c-text-secondary hover:text-danger-400 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      title={t('interview.templateBuilder.removeSectionHeader')}
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
                  {t('interview.templateBuilder.addSectionHeaderAboveThis')}
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
