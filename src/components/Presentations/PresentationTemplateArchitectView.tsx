/**
 * Consultify Presentation Studio — Deck Template Architect view (Epic C2/C4).
 *
 * Klon wzorca `DocumentStudio/DocumentStudioTemplateArchitectView.tsx`
 * dostosowany do decka. Implements the AI Deck Template Architect workflow:
 *   - Draft a new template outline from a free-text brief
 *     (`POST /api/presentations/templates/plan` →
 *     `presentationTemplateDraftService.draftPresentationTemplateAsync`).
 *   - Review + manually edit the outline (rename / reorder / add / remove
 *     slides) before saving.
 *   - Save via `PUT /api/presentations/templates/:id` — this is the FE
 *     caller Epic C4 was missing (route existed, no one called it; see
 *     `src/services/presentationTemplateArchitect.ts`).
 *
 * Governance (approve/deprecate/lineage/audit) is a separate, existing
 * SuperAdmin surface (`src/views/superadmin/PresentationTemplateGovernanceView.tsx`)
 * — this view only owns drafting + manual outline editing. Server-side
 * invariant: only `draft`-lifecycle templates may be edited in place
 * (`assertEditableLifecycle`, presentations.routes.ts:1147); this view
 * disables outline editing and offers "Clone as new draft" once approved
 * or deprecated.
 */

import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SlideSilhouette } from '@/components/Presentations/SlideSilhouette';
import { ColorPatternPicker } from '@/components/shared/colorPatterns/ColorPatternPicker';
import { useBrandKitColors } from '@/components/shared/colorPatterns/useBrandKitColors';
import {
  FilterableTable,
  type FilterChip,
  type TableColumn,
  type TableRow,
} from '@/components/shared/ModuleHub';
import Button from '@/components/ui/primitives/Button';
import {
  fetchTemplateLineage,
  type ClientTemplateLineageNode,
} from '@/services/presentationTemplateGovernance';
import {
  approvePresentationTemplate,
  clonePresentationTemplate,
  deprecatePresentationTemplate,
  getPresentationTemplate,
  listPresentationTemplates,
  planPresentationTemplate,
  PRESENTATION_SLIDE_INTENTS,
  type PresentationSlideIntent,
  type PresentationTemplate,
  type PresentationCustomTemplateDefinition,
  type PresentationTemplateDraftInput,
  type PresentationTemplateLifecycleState,
  type PresentationTemplateOutlineItem,
  updatePresentationTemplate,
} from '@/services/presentationTemplateArchitect';

const DECK_TYPE_OPTIONS: { value: string; labelKey: string; fallback: string }[] = [
  {
    value: 'steering_committee',
    labelKey: 'presentations.templateArchitect.deckType.steeringCommittee',
    fallback: 'Steering Committee Deck',
  },
  {
    value: 'board_decision_deck',
    labelKey: 'presentations.templateArchitect.deckType.boardDecision',
    fallback: 'Board Decision Deck',
  },
  {
    value: 'assessment_summary',
    labelKey: 'presentations.templateArchitect.deckType.assessmentSummary',
    fallback: 'DRD Diagnostic Deck',
  },
  {
    value: 'tool_workshop',
    labelKey: 'presentations.templateArchitect.deckType.toolWorkshop',
    fallback: 'Initiative Kickoff Deck',
  },
  {
    value: 'digital_transformation_read_deck',
    labelKey: 'presentations.templateArchitect.deckType.transformationRead',
    fallback: 'Digital Transformation Read Deck',
  },
];

const AUDIENCE_OPTIONS: { value: string; labelKey: string; fallback: string }[] = [
  {
    value: 'executive',
    labelKey: 'presentations.templates.audience.executive',
    fallback: 'Executive',
  },
  { value: 'sponsor', labelKey: 'presentations.templates.audience.sponsor', fallback: 'Sponsor' },
  {
    value: 'investor',
    labelKey: 'presentations.templates.audience.investor',
    fallback: 'Investor / VC',
  },
  {
    value: 'internal',
    labelKey: 'presentations.templates.audience.internal',
    fallback: 'Internal Team',
  },
];

const GOAL_OPTIONS: { value: string; labelKey: string; fallback: string }[] = [
  { value: 'inform', labelKey: 'presentations.templates.goal.inform', fallback: 'Inform' },
  { value: 'decide', labelKey: 'presentations.templates.goal.decide', fallback: 'Decide' },
  { value: 'sell', labelKey: 'presentations.templates.goal.sell', fallback: 'Sell' },
  { value: 'align', labelKey: 'presentations.templates.goal.align', fallback: 'Align' },
];

const THEME_OPTIONS: { value: 'corporate' | 'minimal' | 'modern'; fallback: string }[] = [
  { value: 'corporate', fallback: 'Corporate' },
  { value: 'minimal', fallback: 'Minimal' },
  { value: 'modern', fallback: 'Modern' },
];

const DEFAULT_CUSTOM_TEMPLATE: PresentationCustomTemplateDefinition = {
  version: 1,
  theme: {
    titleFont: 'Inter',
    bodyFont: 'Inter',
    primaryColor: '123B5D',
    backgroundColor: 'FFFFFF',
    surfaceColor: 'F3F6F8',
    textColor: '172B3A',
    accentColor: '00A67E',
  },
  layouts: Object.fromEntries(
    ['cover', 'content', 'kpi', 'table', 'decision'].map((role) => [
      role,
      { masterName: `Consultify ${role}` },
    ])
  ),
  layoutMapping: {
    cover: 'cover',
    content: 'content',
    kpi: 'kpi',
    table: 'table',
    decision: 'decision',
  },
};

const INTENT_FALLBACK_LABELS: Record<PresentationSlideIntent, string> = {
  cover: 'Cover',
  executive_summary: 'Executive summary',
  section_intro: 'Section intro',
  key_messages: 'Key messages',
  performance_overview: 'Performance overview',
  single_insight: 'Single insight',
  comparison: 'Comparison',
  assessment: 'Assessment',
  root_cause: 'Root cause',
  recommendation_single: 'Recommendation (single)',
  recommendation_portfolio: 'Recommendation (portfolio)',
  initiative_portfolio: 'Initiative portfolio',
  prioritization_matrix: 'Prioritization matrix',
  roadmap: 'Roadmap',
  risk_management: 'Risk management',
  next_steps: 'Next steps',
  appendix: 'Appendix',
};

function useIntentLabel(t: (key: string, def: string) => string) {
  return (intent: PresentationSlideIntent | string) => {
    const known = INTENT_FALLBACK_LABELS[intent as PresentationSlideIntent];
    return t(`presentations.templateArchitect.intent.${intent}`, known || intent);
  };
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export interface PresentationTemplateArchitectViewProps {
  onTemplateSaved?: (template: PresentationTemplate) => void;
}

/** Approved records stay immutable but must remain governable from this surface. */
export const canDeprecatePublishedPresentationTemplate = (
  lifecycleState: PresentationTemplateLifecycleState
): boolean => lifecycleState === 'approved';

export const PresentationTemplateArchitectView: React.FC<
  PresentationTemplateArchitectViewProps
> = ({ onTemplateSaved }) => {
  const { t } = useTranslation();
  const intentLabel = useIntentLabel(t);

  const [templates, setTemplates] = useState<PresentationTemplate[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [deprecatingId, setDeprecatingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [savingOutline, setSavingOutline] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [lineage, setLineage] = useState<ClientTemplateLineageNode[]>([]);
  const [versionComparison, setVersionComparison] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);

  // Brief form.
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [deckType, setDeckType] = useState(DECK_TYPE_OPTIONS[0].value);
  const [audience, setAudience] = useState(AUDIENCE_OPTIONS[0].value);
  const [goal, setGoal] = useState(GOAL_OPTIONS[0].value);
  const [language, setLanguage] = useState<'pl' | 'en'>('pl');
  const [theme, setTheme] = useState<'corporate' | 'minimal' | 'modern'>('corporate');
  const [useLlm, setUseLlm] = useState(false);
  const [lastDraftRefined, setLastDraftRefined] = useState<boolean | null>(null);

  // Outline editor (local, dirty-until-saved copy of the selected template).
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAudience, setEditAudience] = useState('');
  const [editGoal, setEditGoal] = useState('');
  const [editTheme, setEditTheme] = useState('corporate');
  const [editOutline, setEditOutline] = useState<PresentationTemplateOutlineItem[]>([]);
  const [addIntent, setAddIntent] = useState<string>(PRESENTATION_SLIDE_INTENTS[0]);
  // Fala 1 (2026-07-28) — "wzorzec kolorów" (N31), the same gallery the
  // Wizard's `SetupStep` already uses, now savable ON the template itself
  // (`layout_policy_json.colorTemplateId`) instead of only chosen at
  // generation time. Independent of the outline — a template can carry
  // colors, structure, or both (see `ColorPatternPicker`).
  const [editColorTemplateId, setEditColorTemplateId] = useState('');
  const [editCustomTemplate, setEditCustomTemplate] =
    useState<PresentationCustomTemplateDefinition>(DEFAULT_CUSTOM_TEMPLATE);
  const brandKitColors = useBrandKitColors();

  const selectedTemplate = useMemo(
    () => templates.find((tpl) => tpl.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const lifecycleState = selectedTemplate?.lifecycle_state ?? 'draft';
  const isEditable = lifecycleState === 'draft';

  useEffect(() => {
    if (!selectedTemplate) return;
    setEditName(selectedTemplate.name || '');
    setEditDescription(selectedTemplate.description || '');
    setEditAudience(selectedTemplate.audience || '');
    setEditGoal(selectedTemplate.goal || '');
    setEditTheme(selectedTemplate.theme || 'corporate');
    setEditOutline(selectedTemplate.outline_json ? [...selectedTemplate.outline_json] : []);
    setEditColorTemplateId(selectedTemplate.color_template_id || '');
    setEditCustomTemplate(selectedTemplate.custom_template || DEFAULT_CUSTOM_TEMPLATE);
  }, [selectedTemplate]);

  const tableColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'name',
        label: t('presentations.templateArchitect.colTemplate', 'Template'),
        width: '260px',
      },
      { id: 'deckType', label: t('presentations.templateArchitect.colType', 'Type') },
      {
        id: 'meta',
        label: t('presentations.templateArchitect.colSlides', 'Slides'),
        align: 'right',
        width: '100px',
      },
      {
        id: 'status',
        label: t('presentations.templateArchitect.colStatus', 'Status'),
        width: '140px',
        filterable: true,
        filterOptions: [
          { value: 'draft', label: t('presentations.templateArchitect.statusDraft', 'Draft') },
          {
            value: 'approved',
            label: t('presentations.templateArchitect.statusApproved', 'Approved'),
          },
          {
            value: 'deprecated',
            label: t('presentations.templateArchitect.statusDeprecated', 'Deprecated'),
          },
        ],
      },
    ],
    [t]
  );

  const tableRows = useMemo<TableRow[]>(
    () =>
      templates.map((template) => ({
        id: template.id,
        name: template.name,
        deckType: String(template.deck_type || '').replace(/_/g, ' '),
        meta: String(template.outline_json?.length ?? 0),
        status: template.lifecycle_state ?? 'draft',
      })),
    [templates]
  );

  const refresh = async (): Promise<void> => {
    setLoadingList(true);
    setError(null);
    try {
      const list = await listPresentationTemplates();
      setTemplates(list);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('presentations.templateArchitect.errLoadTemplates', 'Failed to load templates')
      );
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedTemplateId) {
      setLineage([]);
      setVersionComparison(null);
      return;
    }
    void fetchTemplateLineage(selectedTemplateId).then((result) => {
      setLineage(result.status === 'ok' ? result.chain : []);
    });
  }, [selectedTemplateId]);

  const handleDraft = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (purpose.trim().length < 8) return;
    setDrafting(true);
    setError(null);
    setLastDraftRefined(null);
    try {
      const input: PresentationTemplateDraftInput = {
        name: name.trim() || undefined,
        purpose: purpose.trim(),
        deckType,
        audience,
        goal,
        language,
        theme,
        customTemplate: DEFAULT_CUSTOM_TEMPLATE,
      };
      const result = await planPresentationTemplate(input, { useLlm });
      setName('');
      setPurpose('');
      setSelectedTemplateId(result.template.id);
      setLastDraftRefined(useLlm ? result.llmRefined : null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('presentations.templateArchitect.errDraftTemplate', 'Failed to draft template')
      );
    } finally {
      setDrafting(false);
    }
  };

  const handleSelectRow = async (row: TableRow): Promise<void> => {
    setSelectedTemplateId(row.id);
    // The list payload already carries `outline_json`, but re-fetch the
    // single record so a stale/partial row (e.g. mid-clone) never shows a
    // half outline in the editor.
    try {
      const fresh = await getPresentationTemplate(row.id);
      setTemplates((prev) => prev.map((tpl) => (tpl.id === fresh.id ? fresh : tpl)));
    } catch {
      // Non-fatal — the row we already have from the list refresh is used.
    }
  };

  const handleOutlineTitleChange = (index: number, title: string): void => {
    setEditOutline((prev) => prev.map((item, i) => (i === index ? { ...item, title } : item)));
  };

  const handleOutlineIntentChange = (index: number, intent: string): void => {
    setEditOutline((prev) => prev.map((item, i) => (i === index ? { ...item, intent } : item)));
  };

  const handleOutlineHintsChange = (index: number, rawText: string): void => {
    const hints = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    setEditOutline((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, contentHints: hints.length > 0 ? hints : undefined } : item
      )
    );
  };

  const handleOutlineKeyMessageChange = (index: number, value: string): void => {
    const trimmed = value.trim();
    setEditOutline((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, keyMessage: trimmed.length > 0 ? trimmed : undefined } : item
      )
    );
  };

  const handleOutlineDataNeededChange = (index: number, rawText: string): void => {
    const items = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    setEditOutline((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, dataNeeded: items.length > 0 ? items : undefined } : item
      )
    );
  };

  const handleOutlineSuggestedVisualChange = (index: number, value: string): void => {
    const trimmed = value.trim();
    setEditOutline((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, suggestedVisual: trimmed.length > 0 ? trimmed : undefined } : item
      )
    );
  };

  const handleOutlineMove = (index: number, direction: -1 | 1): void => {
    setEditOutline((prev) => moveItem(prev, index, index + direction));
  };

  const handleOutlineRemove = (index: number): void => {
    setEditOutline((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOutlineAdd = (): void => {
    setEditOutline((prev) => [
      ...prev,
      { intent: addIntent, title: t('presentations.templateArchitect.newSlideTitle', 'New slide') },
    ]);
  };

  const addTemplateVariable = (): void => {
    setEditCustomTemplate((current) => ({
      ...current,
      variables: [
        ...(current.variables ?? []),
        {
          key: `field_${(current.variables?.length ?? 0) + 1}`,
          label: 'New field',
          type: 'text',
          required: false,
        },
      ],
    }));
  };

  const updateTemplateVariable = (
    index: number,
    patch: Partial<NonNullable<PresentationCustomTemplateDefinition['variables']>[number]>
  ): void => {
    setEditCustomTemplate((current) => ({
      ...current,
      variables: (current.variables ?? []).map((variable, i) =>
        i === index ? { ...variable, ...patch } : variable
      ),
    }));
  };

  const handleSave = async (): Promise<void> => {
    if (!selectedTemplate) return;
    setSavingOutline(true);
    setError(null);
    try {
      await updatePresentationTemplate(selectedTemplate.id, {
        name: editName.trim() || undefined,
        description: editDescription.trim() || undefined,
        audience: editAudience.trim() || undefined,
        goal: editGoal.trim() || undefined,
        theme: editTheme.trim() || undefined,
        outlineJson: editOutline,
        // '' means "no color pattern chosen" — send null so the server can
        // tell "leave unchanged" (undefined, never sent) apart from
        // "explicitly cleared" (null) once a value existed.
        colorTemplateId: editColorTemplateId || null,
        customTemplate: editCustomTemplate,
      });
      const fresh = await getPresentationTemplate(selectedTemplate.id);
      setTemplates((prev) => prev.map((tpl) => (tpl.id === fresh.id ? fresh : tpl)));
      onTemplateSaved?.(fresh);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('presentations.templateArchitect.errSaveTemplate', 'Failed to save template')
      );
    } finally {
      setSavingOutline(false);
    }
  };

  const handleCloneAsDraft = async (): Promise<void> => {
    if (!selectedTemplate) return;
    setCloningId(selectedTemplate.id);
    setError(null);
    try {
      const cloned = await clonePresentationTemplate(
        selectedTemplate.id,
        `${selectedTemplate.name} (Copy)`
      );
      await refresh();
      setSelectedTemplateId(cloned.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('presentations.templateArchitect.errCloneTemplate', 'Failed to clone template')
      );
    } finally {
      setCloningId(null);
    }
  };

  const handleRestoreVersionAsDraft = async (version: ClientTemplateLineageNode): Promise<void> => {
    setCloningId(version.id);
    setError(null);
    try {
      const result = await clonePresentationTemplate(
        version.id,
        `${version.name} — restored v${version.lineageVersion}`
      );
      await refresh();
      setSelectedTemplateId(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore version as a new draft');
    } finally {
      setCloningId(null);
    }
  };

  const handleCompareVersion = async (version: ClientTemplateLineageNode): Promise<void> => {
    if (!selectedTemplate) return;
    try {
      const candidate = await getPresentationTemplate(version.id);
      const currentTitles = selectedTemplate.outline_json.map((item) => item.title);
      const candidateTitles = candidate.outline_json.map((item) => item.title);
      const changed =
        Math.max(currentTitles.length, candidateTitles.length) -
        currentTitles.filter((title, index) => title === candidateTitles[index]).length;
      setVersionComparison(
        `v${version.lineageVersion} vs v${selectedTemplate.lineage_version || 1}: ${candidateTitles.length} → ${currentTitles.length} slides; ${Math.max(0, changed)} position(s) changed.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare template versions');
    }
  };

  const handleApprove = async (): Promise<void> => {
    if (!selectedTemplate || selectedTemplate.lifecycle_state !== 'draft') return;
    const issues = validateCurrentTemplate();
    setValidationIssues(issues);
    if (issues.length > 0) return;
    setApprovingId(selectedTemplate.id);
    setError(null);
    try {
      await approvePresentationTemplate(selectedTemplate.id);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'presentations.templateArchitect.errApproveTemplate',
              'Failed to approve and publish template'
            )
      );
    } finally {
      setApprovingId(null);
    }
  };

  const validateCurrentTemplate = (): string[] => {
    const issues: string[] = [];
    if (editName.trim().length < 3)
      issues.push('Template name must contain at least 3 characters.');
    if (editDescription.trim().length < 8)
      issues.push('Description must explain the template purpose.');
    if (editOutline.length < 2) issues.push('Add at least two slides.');
    editOutline.forEach((slide, index) => {
      if (!slide.title.trim()) issues.push(`Slide ${index + 1} needs a title.`);
    });
    for (const intent of selectedTemplate?.must_have_intents ?? []) {
      if (!editOutline.some((slide) => slide.intent === intent)) {
        issues.push(`Add the mandatory “${intentLabel(intent)}” slide.`);
      }
    }
    if (!editCustomTemplate.theme.titleFont.trim() || !editCustomTemplate.theme.bodyFont.trim()) {
      issues.push('Choose both title and body fonts.');
    }
    const variableKeys = new Set<string>();
    (editCustomTemplate.variables ?? []).forEach((variable, index) => {
      const key = variable.key.trim();
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key))
        issues.push(`Variable ${index + 1} needs a valid key.`);
      if (variableKeys.has(key)) issues.push(`Variable key “${key}” is duplicated.`);
      variableKeys.add(key);
      if (!variable.label.trim()) issues.push(`Variable ${index + 1} needs a label.`);
      if (variable.type === 'enum' && (variable.options ?? []).length === 0)
        issues.push(`Enum variable “${key}” needs options.`);
    });
    return issues;
  };

  const handleDeprecate = async (): Promise<void> => {
    if (!selectedTemplate) return;
    const isDraft = selectedTemplate.lifecycle_state === 'draft';
    const reason = window.prompt(
      t(
        'presentations.templateArchitect.deprecateReasonPrompt',
        isDraft
          ? 'Why are you withdrawing this draft? (required)'
          : 'Why are you deprecating this published template? (required)'
      ),
      ''
    );
    if (reason === null) return; // user cancelled
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError(
        t(
          'presentations.templateArchitect.errDeprecateReasonRequired',
          'A reason is required to withdraw a template.'
        )
      );
      return;
    }
    setDeprecatingId(selectedTemplate.id);
    setError(null);
    try {
      await deprecatePresentationTemplate(selectedTemplate.id, trimmedReason);
      setSelectedTemplateId(null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('presentations.templateArchitect.errDeprecateTemplate', 'Failed to withdraw template')
      );
    } finally {
      setDeprecatingId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-6">
      <header>
        <h2 className="text-lg font-semibold text-c-text">
          {t('presentations.templateArchitect.heading', 'Deck Template Architect')}
        </h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t(
            'presentations.templateArchitect.subheading',
            'Design a reusable, governed deck template. Approval/deprecation lives in the SuperAdmin governance registry.'
          )}
        </p>
      </header>

      <section className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-c-text">
          {t('presentations.templateArchitect.draftHeading', 'Draft a new template')}
        </h3>
        <form onSubmit={handleDraft} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-c-text">
              {t('presentations.templateArchitect.templateName', 'Template name')}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(
                'presentations.templateArchitect.templateNamePlaceholder',
                'e.g., Quarterly Steering Committee template'
              )}
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-c-text">
              {t('presentations.templateArchitect.deckTypeLabel', 'Deck type')}
            </span>
            <select
              value={deckType}
              onChange={(e) => setDeckType(e.target.value)}
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
            >
              {DECK_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey, opt.fallback)}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-1 flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-c-text">
              {t('presentations.templateArchitect.purpose', 'Purpose')}{' '}
              <span className="text-danger-500">*</span>
            </span>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={3}
              placeholder={t(
                'presentations.templateArchitect.purposePlaceholder',
                'What is this deck template for, and who reads it?'
              )}
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
              minLength={8}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-c-text">
              {t('presentations.templateArchitect.audienceLabel', 'Audience')}
            </span>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
            >
              {AUDIENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey, opt.fallback)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-c-text">
              {t('presentations.templateArchitect.goalLabel', 'Goal')}
            </span>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
            >
              {GOAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey, opt.fallback)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-c-text">
              {t('presentations.templateArchitect.language', 'Language')}
            </span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'pl' | 'en')}
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
            >
              <option value="pl">
                {t('presentations.templateArchitect.langPolish', 'Polish')}
              </option>
              <option value="en">
                {t('presentations.templateArchitect.langEnglish', 'English')}
              </option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-c-text">
              {t('presentations.templateArchitect.themeLabel', 'Theme')}
            </span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'corporate' | 'minimal' | 'modern')}
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
            >
              {THEME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.fallback}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-1 flex items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={useLlm}
              onChange={(e) => setUseLlm(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-c-border-subtle text-c-focus-solid focus:ring-c-focus"
            />
            <span>
              <span className="font-medium text-c-text">
                {t(
                  'presentations.templateArchitect.refineWithAi',
                  'Refine with AI Template Architect (optional)'
                )}
              </span>
              <span className="block text-xs text-c-text-secondary">
                {t(
                  'presentations.templateArchitect.refineWithAiHint',
                  'Allows AI to rewrite slide titles and propose a refined template name/description. Falls back silently to the deterministic outline if AI is unavailable. Slide intents, order, and count are never changed by AI.'
                )}
              </span>
            </span>
          </label>
          <div className="col-span-1 flex items-center justify-between gap-3 sm:col-span-2">
            <div className="text-xs text-c-text-secondary">
              {lastDraftRefined === true
                ? t('presentations.templateArchitect.refinedByAi', 'Last draft was refined by AI.')
                : lastDraftRefined === false
                  ? t(
                      'presentations.templateArchitect.refinedNoChanges',
                      'Last AI refinement returned no changes; deterministic draft used.'
                    )
                  : null}
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={drafting || purpose.trim().length < 8}
            >
              {drafting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />{' '}
                  {t('presentations.templateArchitect.drafting', 'Drafting…')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />{' '}
                  {t('presentations.templateArchitect.draftTemplate', 'Draft template')}
                </span>
              )}
            </Button>
          </div>
        </form>
      </section>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-700 dark:text-danger-400"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-c-text">
            {t('presentations.templateArchitect.registryHeading', 'Template registry')}
          </h3>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void refresh()}
            disabled={loadingList}
          >
            {loadingList
              ? t('presentations.templateArchitect.refreshing', 'Refreshing…')
              : t('presentations.templateArchitect.refresh', 'Refresh')}
          </Button>
        </div>
        <FilterableTable
          columns={tableColumns}
          data={tableRows}
          selectedRowId={selectedTemplateId}
          onRowClick={(row) => void handleSelectRow(row)}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          emptyMessage={
            loadingList
              ? t('presentations.templateArchitect.loadingTemplates', 'Loading templates…')
              : t('presentations.templateArchitect.noTemplatesYet', 'No templates yet.')
          }
          canvasClassName="mt-3"
          density="compact"
          persistKey="presentations.templates.architect"
        />

        {selectedTemplate ? (
          <div className="mt-4 rounded-lg border border-c-border-subtle bg-c-surface-raised p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-c-text">
                {t('presentations.templateArchitect.outlineEditor', 'Outline editor')} —{' '}
                {selectedTemplate.name}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isEditable ? (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => void handleDeprecate()}
                    disabled={deprecatingId === selectedTemplate.id}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {deprecatingId === selectedTemplate.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      {t(
                        'presentations.templateArchitect.deprecateTemplate',
                        'Withdraw / delete draft'
                      )}
                    </span>
                  </Button>
                ) : (
                  <>
                    {canDeprecatePublishedPresentationTemplate(lifecycleState) ? (
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => void handleDeprecate()}
                        disabled={deprecatingId === selectedTemplate.id}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {deprecatingId === selectedTemplate.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          {t(
                            'presentations.templateArchitect.deprecatePublishedTemplate',
                            'Deprecate published template'
                          )}
                        </span>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleCloneAsDraft()}
                      disabled={cloningId === selectedTemplate.id}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {cloningId === selectedTemplate.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {t('presentations.templateArchitect.cloneAsDraft', 'Clone as new draft')}
                      </span>
                    </Button>
                  </>
                )}
              </div>
            </div>

            {!isEditable ? (
              <p className="mt-2 text-xs text-c-text-secondary">
                {t(
                  'presentations.templateArchitect.lockedNotice',
                  'This template is {{state}}; clone it to a new draft before editing.',
                  { state: lifecycleState }
                )}
              </p>
            ) : null}

            <section
              className="mt-3 rounded-lg border border-c-border-subtle bg-c-surface p-3"
              aria-label="Template version history"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-c-text">Version history</h4>
                <span className="text-[10px] text-c-text-secondary">
                  {lineage.length} version(s)
                </span>
              </div>
              {lineage.length === 0 ? (
                <p className="mt-2 text-[11px] text-c-text-secondary">
                  No lineage versions available.
                </p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {lineage.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-c-border-subtle px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-c-text">
                          v{version.lineageVersion} · {version.name}
                        </p>
                        <p className="text-[10px] text-c-text-secondary">
                          {version.lifecycleState}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => void handleCompareVersion(version)}
                        >
                          Compare
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={cloningId === version.id}
                          onClick={() => void handleRestoreVersionAsDraft(version)}
                        >
                          Restore as draft
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {versionComparison ? (
                <p role="status" className="mt-2 text-[11px] text-c-text-secondary">
                  {versionComparison}
                </p>
              ) : null}
            </section>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-c-text">
                  {t('presentations.templateArchitect.templateName', 'Template name')}
                </span>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={!isEditable}
                  className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus disabled:opacity-60"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-c-text">
                  {t('presentations.templateArchitect.audienceLabel', 'Audience')}
                </span>
                <select
                  value={editAudience}
                  onChange={(e) => setEditAudience(e.target.value)}
                  disabled={!isEditable}
                  className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus disabled:opacity-60"
                >
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.labelKey, opt.fallback)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-c-text">
                  {t('presentations.templateArchitect.goalLabel', 'Goal')}
                </span>
                <select
                  value={editGoal}
                  onChange={(e) => setEditGoal(e.target.value)}
                  disabled={!isEditable}
                  className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus disabled:opacity-60"
                >
                  {GOAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.labelKey, opt.fallback)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-c-text">
                  {t('presentations.templateArchitect.themeLabel', 'Theme')}
                </span>
                <select
                  value={editTheme}
                  onChange={(e) => setEditTheme(e.target.value)}
                  disabled={!isEditable}
                  className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus disabled:opacity-60"
                >
                  {THEME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.fallback}
                    </option>
                  ))}
                </select>
              </label>
              <div className="col-span-1 sm:col-span-2">
                <span className="font-medium text-c-text text-xs">
                  {t('presentations.templateArchitect.colorPatternLabel', 'Wzorzec kolorów')}
                </span>
                <p className="mb-2 text-[11px] text-c-text-secondary">
                  {t(
                    'presentations.templateArchitect.colorPatternHint',
                    'Niezależny od treści — możesz zapisać sam kolor, samą strukturę, albo oba naraz.'
                  )}
                </p>
                <div className={!isEditable ? 'pointer-events-none opacity-60' : undefined}>
                  <ColorPatternPicker
                    value={editColorTemplateId}
                    onChange={setEditColorTemplateId}
                    brandKitColors={brandKitColors}
                    hideLabel
                  />
                </div>
              </div>
              <div className="col-span-1 rounded-lg border border-c-border-subtle bg-c-surface-raised p-3 sm:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-c-text-secondary">
                  {t(
                    'presentations.templateArchitect.customMasterTheme',
                    'Custom PowerPoint theme and masters'
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(['titleFont', 'bodyFont'] as const).map((key) => (
                    <label
                      key={key}
                      className="flex flex-col gap-1 text-[11px] text-c-text-secondary"
                    >
                      {key}
                      <input
                        value={editCustomTemplate.theme[key]}
                        disabled={!isEditable}
                        onChange={(e) =>
                          setEditCustomTemplate((current) => ({
                            ...current,
                            theme: { ...current.theme, [key]: e.target.value },
                          }))
                        }
                        className="rounded border border-c-border-subtle bg-c-surface px-2 py-1.5 text-xs text-c-text"
                      />
                    </label>
                  ))}
                  {(
                    [
                      'primaryColor',
                      'backgroundColor',
                      'surfaceColor',
                      'textColor',
                      'accentColor',
                    ] as const
                  ).map((key) => (
                    <label
                      key={key}
                      className="flex flex-col gap-1 text-[11px] text-c-text-secondary"
                    >
                      {key}
                      <input
                        value={editCustomTemplate.theme[key]}
                        disabled={!isEditable}
                        onChange={(e) =>
                          setEditCustomTemplate((current) => ({
                            ...current,
                            theme: { ...current.theme, [key]: e.target.value.replace('#', '') },
                          }))
                        }
                        className="rounded border border-c-border-subtle bg-c-surface px-2 py-1.5 font-mono text-xs text-c-text"
                      />
                    </label>
                  ))}
                  <label className="col-span-2 flex flex-col gap-1 text-[11px] text-c-text-secondary">
                    logoDataUri (optional)
                    <input
                      value={editCustomTemplate.theme.logoDataUri || ''}
                      disabled={!isEditable}
                      onChange={(e) =>
                        setEditCustomTemplate((current) => ({
                          ...current,
                          theme: { ...current.theme, logoDataUri: e.target.value || undefined },
                        }))
                      }
                      placeholder="data:image/png;base64,…"
                      className="rounded border border-c-border-subtle bg-c-surface px-2 py-1.5 text-xs text-c-text"
                    />
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
                  {(
                    Object.keys(editCustomTemplate.layoutMapping) as Array<
                      keyof typeof editCustomTemplate.layoutMapping
                    >
                  ).map((role) => {
                    const layoutId = editCustomTemplate.layoutMapping[role];
                    return (
                      <label
                        key={role}
                        className="flex flex-col gap-1 text-[11px] text-c-text-secondary"
                      >
                        {role} master
                        <input
                          value={editCustomTemplate.layouts[layoutId]?.masterName || ''}
                          disabled={!isEditable}
                          onChange={(e) =>
                            setEditCustomTemplate((current) => ({
                              ...current,
                              layouts: {
                                ...current.layouts,
                                [layoutId]: {
                                  ...current.layouts[layoutId],
                                  masterName: e.target.value,
                                },
                              },
                            }))
                          }
                          className="rounded border border-c-border-subtle bg-c-surface px-2 py-1.5 text-xs text-c-text"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="col-span-1 rounded-lg border border-c-border-subtle bg-c-surface-raised p-3 sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-c-text-secondary">
                      Template variables
                    </div>
                    <p className="text-[11px] text-c-text-secondary">
                      Typed fields are persisted in the template schema and become the
                      deck-generation data requirements.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!isEditable}
                    onClick={addTemplateVariable}
                  >
                    Add variable
                  </Button>
                </div>
                <div className="mt-2 space-y-2">
                  {(editCustomTemplate.variables ?? []).map((variable, index) => (
                    <div
                      key={`${variable.key}-${index}`}
                      className="grid grid-cols-1 gap-2 rounded-md border border-c-border-subtle p-2 sm:grid-cols-6"
                    >
                      <input
                        aria-label={`Variable ${index + 1} key`}
                        value={variable.key}
                        disabled={!isEditable}
                        onChange={(event) =>
                          updateTemplateVariable(index, { key: event.target.value })
                        }
                        placeholder="key"
                        className="rounded border border-c-border-subtle bg-c-surface px-2 py-1 text-xs"
                      />
                      <input
                        aria-label={`Variable ${index + 1} label`}
                        value={variable.label}
                        disabled={!isEditable}
                        onChange={(event) =>
                          updateTemplateVariable(index, { label: event.target.value })
                        }
                        placeholder="Label"
                        className="rounded border border-c-border-subtle bg-c-surface px-2 py-1 text-xs"
                      />
                      <select
                        aria-label={`Variable ${index + 1} type`}
                        value={variable.type}
                        disabled={!isEditable}
                        onChange={(event) =>
                          updateTemplateVariable(index, {
                            type: event.target.value as typeof variable.type,
                          })
                        }
                        className="rounded border border-c-border-subtle bg-c-surface px-2 py-1 text-xs"
                      >
                        {['text', 'number', 'date', 'boolean', 'enum'].map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={`Variable ${index + 1} default`}
                        value={String(variable.defaultValue ?? '')}
                        disabled={!isEditable}
                        onChange={(event) =>
                          updateTemplateVariable(index, { defaultValue: event.target.value })
                        }
                        placeholder="Default"
                        className="rounded border border-c-border-subtle bg-c-surface px-2 py-1 text-xs"
                      />
                      <label className="flex items-center gap-1 text-xs text-c-text-secondary">
                        <input
                          type="checkbox"
                          checked={variable.required}
                          disabled={!isEditable}
                          onChange={(event) =>
                            updateTemplateVariable(index, { required: event.target.checked })
                          }
                        />
                        Required
                      </label>
                      <button
                        type="button"
                        disabled={!isEditable}
                        onClick={() =>
                          setEditCustomTemplate((current) => ({
                            ...current,
                            variables: (current.variables ?? []).filter((_, i) => i !== index),
                          }))
                        }
                        className="text-xs text-danger-600 disabled:opacity-40"
                      >
                        Remove
                      </button>
                      <input
                        aria-label={`Variable ${index + 1} description`}
                        value={variable.description ?? ''}
                        disabled={!isEditable}
                        onChange={(event) =>
                          updateTemplateVariable(index, { description: event.target.value })
                        }
                        placeholder="Description"
                        className="rounded border border-c-border-subtle bg-c-surface px-2 py-1 text-xs sm:col-span-3"
                      />
                      {variable.type === 'enum' ? (
                        <input
                          aria-label={`Variable ${index + 1} options`}
                          value={(variable.options ?? []).join(', ')}
                          disabled={!isEditable}
                          onChange={(event) =>
                            updateTemplateVariable(index, {
                              options: event.target.value
                                .split(',')
                                .map((item) => item.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Options, comma separated"
                          className="rounded border border-c-border-subtle bg-c-surface px-2 py-1 text-xs sm:col-span-3"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              <label className="col-span-1 flex flex-col gap-1 text-xs sm:col-span-2">
                <span className="font-medium text-c-text">
                  {t('presentations.templateArchitect.descriptionLabel', 'Description')}
                </span>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={!isEditable}
                  rows={2}
                  className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus disabled:opacity-60"
                />
              </label>
            </div>

            {(selectedTemplate.recommended_visuals?.length ?? 0) > 0 ||
            (selectedTemplate.must_have_intents?.length ?? 0) > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(selectedTemplate.recommended_visuals?.length ?? 0) > 0 ? (
                  <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-c-text-secondary">
                      {t(
                        'presentations.templateArchitect.recommendedVisuals',
                        'Suggested visualizations'
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedTemplate.recommended_visuals.map((visual, i) => (
                        <span
                          key={`${visual}-${i}`}
                          className="rounded-full border border-c-border-subtle bg-c-surface px-2.5 py-1 text-xs text-c-text-secondary"
                        >
                          {visual}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {(selectedTemplate.must_have_intents?.length ?? 0) > 0 ? (
                  <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-c-text-secondary">
                      {t('presentations.templateArchitect.mustHaveIntents', 'Mandatory slides')}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedTemplate.must_have_intents.map((intent, i) => (
                        <span
                          key={`${intent}-${i}`}
                          className="rounded-full border border-c-border-subtle bg-c-surface px-2.5 py-1 text-xs text-c-text-secondary"
                        >
                          {intentLabel(intent)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-c-text-secondary">
                {t('presentations.templateArchitect.slidesHeading', 'Slides')} ({editOutline.length}
                )
              </div>
              <ol className="mt-2 space-y-2">
                {editOutline.map((slide, idx) => (
                  <li
                    key={`${selectedTemplate.id}-slide-${idx}`}
                    className="rounded-lg border border-c-border-subtle bg-c-surface px-2 py-1.5"
                  >
                    <div className="flex items-start gap-2">
                      <SlideSilhouette intent={slide.intent} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 shrink-0 text-xs text-c-text-muted">{idx + 1}</span>
                          <input
                            type="text"
                            value={slide.title}
                            onChange={(e) => handleOutlineTitleChange(idx, e.target.value)}
                            disabled={!isEditable}
                            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-c-text focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus disabled:opacity-60"
                          />
                          <select
                            value={slide.intent}
                            onChange={(e) => handleOutlineIntentChange(idx, e.target.value)}
                            disabled={!isEditable}
                            className="w-44 shrink-0 rounded-md border border-c-border-subtle bg-c-surface px-1.5 py-1 text-xs text-c-text-secondary focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus disabled:opacity-60"
                          >
                            {PRESENTATION_SLIDE_INTENTS.map((intent) => (
                              <option key={intent} value={intent}>
                                {intentLabel(intent)}
                              </option>
                            ))}
                          </select>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleOutlineMove(idx, -1)}
                              disabled={!isEditable || idx === 0}
                              title={t('presentations.templateArchitect.moveUp', 'Move up')}
                              className="rounded p-1 text-c-text-muted hover:bg-state-hover hover:text-c-text disabled:opacity-30"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOutlineMove(idx, 1)}
                              disabled={!isEditable || idx === editOutline.length - 1}
                              title={t('presentations.templateArchitect.moveDown', 'Move down')}
                              className="rounded p-1 text-c-text-muted hover:bg-state-hover hover:text-c-text disabled:opacity-30"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOutlineRemove(idx)}
                              disabled={!isEditable}
                              title={t(
                                'presentations.templateArchitect.removeSlide',
                                'Remove slide'
                              )}
                              className="rounded p-1 text-danger-600 hover:bg-danger-500/10 disabled:opacity-30 dark:text-danger-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-1.5 pl-7">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                            {t('presentations.templateArchitect.contentHints', 'Content guidance')}
                          </span>
                          <textarea
                            value={(slide.contentHints ?? []).join('\n')}
                            onChange={(e) => handleOutlineHintsChange(idx, e.target.value)}
                            disabled={!isEditable}
                            rows={Math.max(2, (slide.contentHints ?? []).length)}
                            placeholder={t(
                              'presentations.templateArchitect.contentHintsPlaceholder',
                              'One guidance phrase per line — what this slide should cover (no invented facts). Use "Refine with AI" on a new draft to auto-suggest.'
                            )}
                            className="mt-0.5 w-full rounded-md border border-c-border-subtle bg-c-surface-raised px-1.5 py-1 text-xs text-c-text-secondary focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus disabled:opacity-60"
                          />
                        </div>
                        {isEditable ? (
                          <div className="mt-1.5 space-y-1.5 pl-7">
                            <label className="block">
                              <span className="text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                                {t('presentations.templateArchitect.keyMessage', 'Teza')}
                              </span>
                              <input
                                type="text"
                                value={slide.keyMessage ?? ''}
                                onChange={(e) => handleOutlineKeyMessageChange(idx, e.target.value)}
                                placeholder={t(
                                  'presentations.templateArchitect.keyMessagePlaceholder',
                                  'Jednozdaniowa teza tego slajdu (bez wymyślonych faktów).'
                                )}
                                className="mt-0.5 w-full rounded-md border border-c-border-subtle bg-c-surface-raised px-1.5 py-1 text-xs text-c-text-secondary focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                                {t(
                                  'presentations.templateArchitect.dataNeeded',
                                  'Dane do zebrania'
                                )}
                              </span>
                              <textarea
                                value={(slide.dataNeeded ?? []).join('\n')}
                                onChange={(e) => handleOutlineDataNeededChange(idx, e.target.value)}
                                rows={Math.max(2, (slide.dataNeeded ?? []).length)}
                                placeholder={t(
                                  'presentations.templateArchitect.dataNeededPlaceholder',
                                  'Jedna pozycja na linię — nazwy danych do zebrania, nie wartości.'
                                )}
                                className="mt-0.5 w-full rounded-md border border-c-border-subtle bg-c-surface-raised px-1.5 py-1 text-xs text-c-text-secondary focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                                {t(
                                  'presentations.templateArchitect.suggestedVisual',
                                  'Sugerowana wizualizacja'
                                )}
                              </span>
                              <input
                                type="text"
                                value={slide.suggestedVisual ?? ''}
                                onChange={(e) =>
                                  handleOutlineSuggestedVisualChange(idx, e.target.value)
                                }
                                placeholder={t(
                                  'presentations.templateArchitect.suggestedVisualPlaceholder',
                                  'Np. wykres słupkowy, macierz priorytetów, oś czasu.'
                                )}
                                className="mt-0.5 w-full rounded-md border border-c-border-subtle bg-c-surface-raised px-1.5 py-1 text-xs text-c-text-secondary focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
                              />
                            </label>
                          </div>
                        ) : slide.keyMessage ||
                          slide.dataNeeded?.length ||
                          slide.suggestedVisual ? (
                          <div className="mt-1.5 space-y-1 pl-7">
                            {slide.keyMessage ? (
                              <div>
                                <span className="text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                                  {t('presentations.templateArchitect.keyMessage', 'Teza')}
                                </span>
                                <p className="mt-0.5 text-xs text-c-text-secondary">
                                  {slide.keyMessage}
                                </p>
                              </div>
                            ) : null}
                            {slide.dataNeeded && slide.dataNeeded.length > 0 ? (
                              <div>
                                <span className="text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                                  {t(
                                    'presentations.templateArchitect.dataNeeded',
                                    'Dane do zebrania'
                                  )}
                                </span>
                                <ul className="mt-0.5 list-inside list-disc text-xs text-c-text-secondary">
                                  {slide.dataNeeded.map((item, i) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {slide.suggestedVisual ? (
                              <div>
                                <span className="text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                                  {t(
                                    'presentations.templateArchitect.suggestedVisual',
                                    'Sugerowana wizualizacja'
                                  )}
                                </span>
                                <p className="mt-0.5 text-xs text-c-text-secondary">
                                  {slide.suggestedVisual}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-3 flex items-center gap-2">
                <select
                  value={addIntent}
                  onChange={(e) => setAddIntent(e.target.value)}
                  disabled={!isEditable}
                  className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1.5 text-xs text-c-text-secondary focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus disabled:opacity-60"
                >
                  {PRESENTATION_SLIDE_INTENTS.map((intent) => (
                    <option key={intent} value={intent}>
                      {intentLabel(intent)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleOutlineAdd}
                  disabled={!isEditable}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    {t('presentations.templateArchitect.addSlide', 'Add slide')}
                  </span>
                </Button>
              </div>
            </div>

            {validationIssues ? (
              <div
                role="status"
                className={`mt-3 rounded-lg border p-3 text-xs ${validationIssues.length === 0 ? 'border-success-500/30 bg-success-500/10 text-success-700' : 'border-danger-500/30 bg-danger-500/10 text-danger-700'}`}
              >
                {validationIssues.length === 0 ? (
                  <p className="font-medium">Validation passed. This draft is ready to publish.</p>
                ) : (
                  <>
                    <p className="font-medium">
                      Resolve {validationIssues.length} issue(s) before publishing:
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {validationIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              {selectedTemplate.lifecycle_state === 'draft' ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setValidationIssues(validateCurrentTemplate())}
                  >
                    Validate
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleApprove()}
                    disabled={savingOutline || approvingId === selectedTemplate.id}
                  >
                    {approvingId === selectedTemplate.id ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('presentations.templateArchitect.approving', 'Publishing…')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {t(
                          'presentations.templateArchitect.approveAndPublish',
                          'Approve & publish'
                        )}
                      </span>
                    )}
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleSave()}
                disabled={!isEditable || savingOutline}
              >
                {savingOutline ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('presentations.templateArchitect.saving', 'Saving…')}
                  </span>
                ) : (
                  t('presentations.templateArchitect.save', 'Save template')
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default PresentationTemplateArchitectView;
