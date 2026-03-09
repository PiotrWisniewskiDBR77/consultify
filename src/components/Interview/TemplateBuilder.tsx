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
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  HelpCircle,
  Link2,
  Loader2,
  MessageSquare,
  Mic,
  Pencil,
  Paperclip,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { sendMessageToAI } from '@/services/ai/gemini';
import { Api } from '@/services/api';

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
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

type QuestionCategory = 'strategy' | 'operations' | 'digital' | 'people' | 'finance';
type AnswerType = 'open' | 'select' | 'scale' | 'boolean' | 'number';
type TemplateCategory =
  | 'DIGITAL'
  | 'OPERATIONAL'
  | 'COST'
  | 'DATA'
  | 'STANDARD'
  | 'QUICK'
  | 'CUSTOM';
type TemplateScope = 'system' | 'organization' | 'private';
type RuntimeModeDefault = 'task_list' | 'one_question_per_screen';
type AiDraftPayload = {
  template?: Partial<Template>;
  questions?: Array<Partial<TemplateQuestion>>;
};

// Constants
const ANSWER_TYPES: { id: AnswerType; labelPl: string; labelEn: string }[] = [
  { id: 'open', labelPl: 'Otwarte', labelEn: 'Open text' },
  { id: 'select', labelPl: 'Wybór', labelEn: 'Select' },
  { id: 'scale', labelPl: 'Skala', labelEn: 'Scale' },
  { id: 'boolean', labelPl: 'Tak/Nie', labelEn: 'Yes/No' },
  { id: 'number', labelPl: 'Liczba', labelEn: 'Number' },
];

const RUNTIME_MODE_OPTIONS: { id: RuntimeModeDefault; labelPl: string; labelEn: string }[] = [
  {
    id: 'one_question_per_screen',
    labelPl: 'Jedno pytanie na ekran',
    labelEn: 'One question per screen',
  },
  { id: 'task_list', labelPl: 'Lista pytań', labelEn: 'Question list' },
];

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

  // Template metadata state
  const [template, setTemplate] = useState<Partial<Template>>({
    name: '',
    description: '',
    scope: 'organization',
    category: 'CUSTOM',
    status: 'draft',
    visibility: 'org',
    isDefault: false,
    version: 1,
    audience: '',
    estimatedTimeMinutes: 10,
    runtimeModeDefault: 'one_question_per_screen',
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
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isImportingSource, setIsImportingSource] = useState(false);
  const [aiBrief, setAiBrief] = useState('');
  const [importedSourceName, setImportedSourceName] = useState('');
  const [importedSourceText, setImportedSourceText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const importInputRef = useRef<HTMLInputElement | null>(null);

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
        scope: 'organization',
        category: 'CUSTOM',
        status: 'draft',
        visibility: 'org',
        isDefault: false,
        version: 1,
        audience: '',
        estimatedTimeMinutes: 10,
        runtimeModeDefault: 'one_question_per_screen',
      });
      setQuestions([]);
      setDeletedQuestionIds([]);
      setTargetQuestionCount(12);
      setQuestionCountTolerance(2);
      setImportedSourceName('');
      setImportedSourceText('');
    }
  }, [isOpen, templateId]);

  const loadTemplate = async (id: string) => {
    setIsLoading(true);
    try {
      const [templateRes, questionsRes] = await Promise.all([
        Api.get(`/interview/templates/${id}`),
        Api.get(`/interview/templates/${id}/questions`),
      ]);

      setTemplate(templateRes as Template);
      setDeletedQuestionIds([]);
      const loadedQuestions = Array.isArray(questionsRes) ? questionsRes : [];
      setTargetQuestionCount(Math.max(loadedQuestions.length || 0, 1));
      setQuestionCountTolerance(2);
      setImportedSourceName('');
      setImportedSourceText('');
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

  // Validation
  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};
    let firstInvalidQuestion:
      | { id: string; message: string }
      | null = null;

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
        firstInvalidQuestion?.message ||
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
        setDeletedQuestionIds((current) =>
          current.includes(id) ? current : [...current, id]
        );
      }
      return prev.filter((q) => q.id !== id);
    });
  }, []);

  // Move question up/down
  const handleMoveQuestion = useCallback(
    (id: string, direction: 'up' | 'down') => {
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
    },
    []
  );

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
    ]
  );

  const handleGenerateWithAI = useCallback(async () => {
    if (!aiBrief.trim() && !importedSourceText.trim()) {
      toast.error(
        isPolish
          ? 'Dodaj brief albo zaimportuj plik TXT/PDF'
          : 'Add a brief or import a TXT/PDF file'
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
      "answerType": "open|select|scale|boolean|number",
      "isRequired": true,
      "helpHint": "string",
      "expectedAnswerShape": "string",
      "answerOptions": ["string"],
      "allowVoice": true,
      "allowFileUpload": true,
      "allowUrl": true,
      "allowContextNote": true
    }
  ]
}

Rules:
- Build a practical executive-quality interview sheet.
- Prefer concise, clear, answerable questions.
- Default all modalities to true unless there is a strong reason not to.
- For select or scale questions, provide answerOptions.
- Return ${Math.max(1, targetQuestionCount - questionCountTolerance)} to ${targetQuestionCount + questionCountTolerance} questions.`;

    const userPrompt = `Language: ${isPolish ? 'Polish' : 'English'}
Topic: ${template.name || ''}
Description: ${template.description || ''}
Target question count: ${targetQuestionCount}
Allowed tolerance: +/- ${questionCountTolerance}

Create an interview template draft from this brief:
${aiBrief.trim()}

Imported source material:
${importedSourceText.trim() || '(none)'}`;

    setIsAiGenerating(true);
    try {
      const response = await sendMessageToAI([], userPrompt, systemPrompt, 'interview_template_builder');
      const jsonMatch = response.match(/```json\s*([\s\S]*?)```/i) || response.match(/```([\s\S]*?)```/);
      const rawJson = (jsonMatch?.[1] || response).trim();
      const parsed = JSON.parse(rawJson) as AiDraftPayload;
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
        runtimeModeDefault:
          String(nextTemplate.runtimeModeDefault || prev.runtimeModeDefault || 'one_question_per_screen')
            .toLowerCase()
            .includes('task')
            ? 'task_list'
            : 'one_question_per_screen',
      }));

      const normalizedQuestions: TemplateQuestion[] = nextQuestionsRaw.map((item, index) => {
        const rawAnswerType = String(item.answerType || 'open').trim().toLowerCase();
        const answerType = (
          ['open', 'select', 'scale', 'boolean', 'number'].includes(rawAnswerType)
            ? rawAnswerType
            : 'open'
        ) as AnswerType;

        return {
          id: `ai_${Date.now()}_${index}`,
          templateId: templateId || '',
          category: 'strategy',
          questionText: String(item.questionText || '').trim(),
          sortOrder: (index + 1) * 10,
          answerType,
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
      setIsAiPanelOpen(false);
      toast.success(
        isPolish ? 'AI przygotowało draft arkusza pytań' : 'AI prepared a template draft'
      );
    } catch (error) {
      console.error('[TemplateBuilder] AI generation failed:', error);
      toast.error(
        isPolish ? 'Nie udało się wygenerować draftu AI' : 'Failed to generate AI draft'
      );
    } finally {
      setIsAiGenerating(false);
    }
  }, [
    aiBrief,
    importedSourceText,
    isPolish,
    questionCountTolerance,
    questions,
    targetQuestionCount,
    template,
    templateId,
  ]);

  const handleImportSource = useCallback(
    async (file: File) => {
      const lowerName = file.name.toLowerCase();
      const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
      const isTxt =
        file.type.startsWith('text/') ||
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.md');

      if (!isPdf && !isTxt) {
        toast.error(isPolish ? 'Obsługiwane są tylko pliki TXT i PDF' : 'Only TXT and PDF are supported');
        return;
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
        setImportedSourceName(String(payload?.fileName || file.name));
        setImportedSourceText(text);
        toast.success(
          isPolish ? 'Plik został zaimportowany do buildera AI' : 'File imported into AI builder'
        );
      } catch (error) {
        console.error('[TemplateBuilder] Failed to import source:', error);
        toast.error(
          isPolish ? 'Nie udało się zaimportować pliku' : 'Failed to import file'
        );
      } finally {
        setIsImportingSource(false);
        if (importInputRef.current) {
          importInputRef.current.value = '';
        }
      }
    },
    [isPolish]
  );

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
            ? 'bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl w-full h-full overflow-hidden flex flex-col'
            : 'bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl w-full max-w-[1080px] mx-4 max-h-[90vh] overflow-hidden flex flex-col'
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-10 border-b border-slate-200/60 dark:border-navy-700 shrink-0 bg-[#1b2440] text-white">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={12} className="text-amber-300 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-200">
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
            className="inline-flex items-center justify-center h-6 w-6 rounded-sm text-slate-300 hover:bg-white/10 transition-colors"
          >
            <X size={12} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
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
                  placeholder={
                    isPolish ? 'np. Digital maturity w produkcji' : 'e.g. Digital maturity in manufacturing'
                  }
                  className={`w-full h-9 px-3 rounded-md bg-[#08122b] dark:bg-navy-950 border text-white placeholder-slate-400 focus:ring-1 transition-all ${
                    errors.name
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50'
                      : 'border-navy-700 focus:border-primary-500 focus:ring-primary-500/50'
                  }`}
                />
                {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
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
                  placeholder={
                    isPolish
                      ? 'Opisz cel ankiety, kontekst biznesowy, dokładność odpowiedzi i czego AI ma pilnować przy budowie pytań...'
                      : 'Describe the survey goal, business context, expected answer precision, and what AI should optimize in the questions...'
                  }
                  rows={6}
                  className="w-full px-3 py-2 rounded-md bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all resize-none"
                />
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
                    onChange={(e) => setTargetQuestionCount(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full h-9 px-3 rounded-md bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
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
                    className="w-full h-9 px-3 rounded-md bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                  />
                </div>
              </div>

              <p className="mb-4 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {isPolish
                  ? `AI przygotuje około ${targetQuestionCount} pytań z tolerancją +/- ${questionCountTolerance}.`
                  : `AI will prepare around ${targetQuestionCount} questions with a tolerance of +/- ${questionCountTolerance}.`}
              </p>

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
                    className="w-full h-9 px-3 rounded-md bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                  />
                </div>

                <div className="mb-3">
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    {isPolish ? 'Tryb runtime' : 'Runtime mode'}
                  </label>
                  <select
                    value={template.runtimeModeDefault || 'one_question_per_screen'}
                    onChange={(e) =>
                      setTemplate((prev) => ({
                        ...prev,
                        runtimeModeDefault: e.target.value as RuntimeModeDefault,
                      }))
                    }
                    className="w-full h-9 px-3 rounded-md bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
                  >
                    {RUNTIME_MODE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {isPolish ? opt.labelPl : opt.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {errors.questions && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-xs text-red-400 flex items-center gap-2">
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
                  <button
                    onClick={() => setIsAiPanelOpen((prev) => !prev)}
                    className={`inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
                      isAiPanelOpen
                        ? 'border-primary-500/30 bg-primary-500/10 text-primary-600 dark:text-primary-300'
                        : 'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]'
                    }`}
                    title={isPolish ? 'AI przygotuje draft arkusza' : 'AI drafts the sheet'}
                  >
                    <Sparkles size={13} />
                    AI
                  </button>
                  <button
                    onClick={handleAddQuestion}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-primary-500/20 bg-white dark:bg-navy-900 text-primary-500 hover:bg-primary-500/5 transition-colors text-xs"
                  >
                    <Plus size={14} />
                    {isPolish ? 'Dodaj pytanie' : 'Add Question'}
                  </button>
                </div>
              </div>

              {isAiPanelOpen ? (
                <div className="px-4 py-3 border-b border-slate-200/70 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02]">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary-500/20 bg-primary-500/10 text-primary-600 dark:text-primary-300">
                      <Sparkles size={14} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {isPolish ? 'AI Builder' : 'AI Builder'}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {isPolish
                            ? 'Opisz cel audytu, odbiorców i oczekiwane odpowiedzi. AI przygotuje draft całego arkusza.'
                            : 'Describe the audit goal, audience, and expected answers. AI will draft the whole sheet.'}
                        </p>
                      </div>
                      <textarea
                        value={aiBrief}
                        onChange={(event) => setAiBrief(event.target.value)}
                        rows={3}
                        placeholder={
                          isPolish
                            ? 'Np. Przygotuj arkusz do audytu transformacji cyfrowej dla COO i liderów operacyjnych. Pytania mają być krótkie, konkretne i częściowo skalowane.'
                            : 'E.g. Build a digital transformation interview sheet for COO and operations leaders. Keep questions concise, concrete, and partly scaled.'
                        }
                        className="w-full rounded-lg border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-navy-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all resize-none"
                      />
                      <input
                        ref={importInputRef}
                        type="file"
                        accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleImportSource(file);
                        }}
                      />
                      <div className="rounded-lg border border-slate-200/80 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                              {isPolish ? 'Import listy pytań / formularza' : 'Import question list / form'}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {importedSourceName
                                ? `${importedSourceName} • ${importedSourceText.length} ${isPolish ? 'znaków' : 'chars'}`
                                : isPolish
                                  ? 'Wrzuć TXT albo PDF, a AI użyje treści jako materiału źródłowego.'
                                  : 'Drop a TXT or PDF and AI will use it as source material.'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => importInputRef.current?.click()}
                            disabled={isImportingSource}
                            className="inline-flex items-center justify-center gap-2 h-8 px-3 rounded-full text-xs font-medium border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50 disabled:pointer-events-none"
                          >
                            {isImportingSource ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Upload size={13} />
                            )}
                            {isPolish ? 'Import TXT/PDF' : 'Import TXT/PDF'}
                          </button>
                        </div>
                        {importedSourceText ? (
                          <div className="mt-3 rounded-lg border border-slate-200/70 dark:border-white/[0.06] bg-slate-50 dark:bg-navy-950/60 px-3 py-2">
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                              {isPolish ? 'Podgląd źródła' : 'Source preview'}
                            </div>
                            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap line-clamp-6">
                              {importedSourceText.slice(0, 800)}
                            </p>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAiPanelOpen(false)}
                          className="inline-flex items-center justify-center h-8 px-3 rounded-full text-xs font-medium border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                        >
                          {isPolish ? 'Zamknij' : 'Close'}
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateWithAI}
                          disabled={isAiGenerating}
                          className="inline-flex items-center justify-center gap-2 h-8 px-3 rounded-full text-xs font-medium border border-primary-500/40 dark:border-primary-500/30 bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {isAiGenerating ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Sparkles size={13} />
                          )}
                          {isPolish ? 'Wygeneruj draft' : 'Generate draft'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Questions List */}
              <div className="flex-1 overflow-auto p-3 space-y-2">
                {orderedQuestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <HelpCircle size={48} className="text-slate-600 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                      {isPolish ? 'Brak pytań w formularzu' : 'No questions in this form'}
                    </p>
                    <button
                      onClick={handleAddQuestion}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
                    >
                      <Plus size={16} />
                      {isPolish ? 'Dodaj pierwsze pytanie' : 'Add first question'}
                    </button>
                  </div>
                ) : (
                  orderedQuestions.map((question, idx) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      index={idx}
                      totalCount={orderedQuestions.length}
                      isPolish={isPolish}
                      error={errors[`question_${question.id}`] || errors[`options_${question.id}`]}
                      forceExpand={focusedQuestionId === question.id}
                      onUpdate={(updates) => handleUpdateQuestion(question.id, updates)}
                      onDelete={() => handleDeleteQuestion(question.id)}
                      onMoveUp={() => handleMoveQuestion(question.id, 'up')}
                      onMoveDown={() => handleMoveQuestion(question.id, 'down')}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {questions.length} {isPolish ? 'pytań łącznie' : 'total questions'}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
            >
              {isPolish ? 'Anuluj' : 'Cancel'}
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-full text-sm font-medium border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isPolish ? 'Zapisz wersję roboczą' : 'Save Draft'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-full text-sm font-medium border border-primary-500/40 dark:border-primary-500/30 bg-primary-600 text-white hover:bg-primary-700 transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {isPolish ? 'Opublikuj' : 'Publish'}
            </button>
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
  onUpdate: (updates: Partial<TemplateQuestion>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  totalCount,
  isPolish,
  error,
  forceExpand = false,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const [isExpanded, setIsExpanded] = useState(question.isNew || false);
  const [newOption, setNewOption] = useState('');
  const questionTextRef = useRef<HTMLTextAreaElement | null>(null);
  const fieldClassName =
    'w-full h-10 px-3 rounded-lg bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-600 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all';

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
        error ? 'ring-1 ring-red-500/40' : ''
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3 h-8 cursor-pointer bg-[#0b1530] dark:bg-[#0b1324] hover:bg-[#122041] dark:hover:bg-[#111b31] border border-slate-800/70 rounded-md transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
          <ChevronRight
            size={12}
            className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
          <span className="text-[10px] font-medium w-4 text-center">{index + 1}.</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-slate-100 truncate">
            {question.questionText || (isPolish ? '(Nowe pytanie)' : '(New question)')}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {question.isRequired && (
            <span className="px-1.5 py-0.5 bg-red-500/15 text-red-300 text-[10px] rounded border border-red-500/20 leading-none">
              {isPolish ? 'Wymagane' : 'Required'}
            </span>
          )}
          <span className="px-1.5 py-0.5 bg-slate-700/70 text-slate-200 text-[10px] rounded border border-slate-600/60 leading-none">
            {
              ANSWER_TYPES.find((t) => t.id === question.answerType)?.[
                isPolish ? 'labelPl' : 'labelEn'
              ]
            }
          </span>
          {question.allowVoice && <Mic size={12} className="text-slate-400" />}
          {question.allowFileUpload && <Paperclip size={12} className="text-slate-400" />}
          {question.allowUrl && <Link2 size={12} className="text-slate-400" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditor();
            }}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
            title={isPolish ? 'Edytuj pytanie' : 'Edit question'}
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
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
              disabled={index === 0}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={index === totalCount - 1}
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
              placeholder={
                isPolish ? 'Wpisz nazwę i treść pytania...' : 'Enter the question title and text...'
              }
              rows={2}
              className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-900 border text-slate-900 dark:text-white placeholder-slate-500 focus:ring-1 transition-all resize-none ${
                error
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50'
                  : 'border-navy-600 focus:border-primary-500 focus:ring-primary-500/50'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Answer Type */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                {isPolish ? 'Typ odpowiedzi' : 'Answer Type'}
              </label>
              <select
                value={question.answerType}
                onChange={(e) => onUpdate({ answerType: e.target.value as AnswerType })}
                className={fieldClassName}
              >
                {ANSWER_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {isPolish ? type.labelPl : type.labelEn}
                  </option>
                ))}
              </select>
            </div>

            {/* Required */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                {isPolish ? 'Wymagane' : 'Required'}
              </label>
              <button
                onClick={() => onUpdate({ isRequired: !question.isRequired })}
                className={`w-full h-10 px-3 rounded-lg border text-sm font-medium transition-all ${
                  question.isRequired
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'bg-white dark:bg-navy-900 border-navy-600 text-slate-400 hover:border-slate-500'
                }`}
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
                      className={`flex-1 ${fieldClassName}`}
                    />
                    <button
                      onClick={() => handleRemoveOption(idx)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
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
                    placeholder={isPolish ? 'Dodaj opcję...' : 'Add option...'}
                    className={`flex-1 ${fieldClassName}`}
                  />
                  <button
                    onClick={handleAddOption}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              {error && error.includes('opcje') && (
                <p className="text-xs text-red-400 mt-1">{error}</p>
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
              placeholder={
                isPolish
                  ? 'Dodatkowe wskazówki dla respondenta...'
                  : 'Additional guidance for respondent...'
              }
              className={fieldClassName}
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
                    className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-sm transition-all ${
                      item.value
                        ? 'bg-primary-500/12 border border-primary-500/25 text-primary-700 dark:text-primary-300'
                        : 'bg-slate-100/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateBuilder;
