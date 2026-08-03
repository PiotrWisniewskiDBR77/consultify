/**
 * ResourcesSection - Four separate tables:
 *   1. Budget (CAPEX / OPEX line items)
 *   2. Team / FTE Allocation (people)
 *   3. Tools & Infrastructure (software, hardware, cloud)
 *   4. Licenses, Training & Intangible Assets (IP, certifications, knowledge)
 *
 * Each table has a "+ Add item" button next to the title (N-mode pattern)
 * and an AI sparkle icon in the last column header for AI analysis.
 * Data is persisted via InitiativeContext CRUD handlers.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Briefcase,
  Check,
  DollarSign,
  GraduationCap,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Api } from '@/services/api';

import { useInitiativeContext } from './InitiativeContext';
import type { BudgetItem, IntangibleAssetItem, ResourceItem, ToolItem } from './types';

// ==========================================
// CONFIGS
// ==========================================

const ROLE_OPTIONS = [
  { value: 'lead', labelEn: 'Lead', labelPl: 'Lead' },
  { value: 'member', labelEn: 'Member', labelPl: 'Członek' },
  { value: 'consultant', labelEn: 'Consultant', labelPl: 'Konsultant' },
  { value: 'stakeholder', labelEn: 'Stakeholder', labelPl: 'Interesariusz' },
];

const BUDGET_CATEGORIES = [
  { value: 'personnel', labelEn: 'Personnel', labelPl: 'Personel' },
  { value: 'technology', labelEn: 'Technology', labelPl: 'Technologia' },
  { value: 'consulting', labelEn: 'Consulting', labelPl: 'Konsulting' },
  { value: 'training', labelEn: 'Training', labelPl: 'Szkolenia' },
  { value: 'infrastructure', labelEn: 'Infrastructure', labelPl: 'Infrastruktura' },
  { value: 'licenses', labelEn: 'Licenses', labelPl: 'Licencje' },
  { value: 'other', labelEn: 'Other', labelPl: 'Inne' },
];

const TOOL_CATEGORIES = [
  { value: 'software', labelEn: 'Software', labelPl: 'Oprogramowanie' },
  { value: 'hardware', labelEn: 'Hardware', labelPl: 'Sprzęt' },
  { value: 'cloud', labelEn: 'Cloud', labelPl: 'Chmura' },
  { value: 'platform', labelEn: 'Platform', labelPl: 'Platforma' },
  { value: 'other', labelEn: 'Other', labelPl: 'Inne' },
];

const TOOL_STATUS_OPTIONS = [
  { value: 'planned', labelEn: 'Planned', labelPl: 'Planowane' },
  { value: 'active', labelEn: 'Active', labelPl: 'Aktywne' },
  { value: 'deprecated', labelEn: 'Deprecated', labelPl: 'Wycofane' },
];

const LICENSE_TYPE_OPTIONS = [
  { value: 'subscription', labelEn: 'Subscription', labelPl: 'Subskrypcja' },
  { value: 'perpetual', labelEn: 'Perpetual', labelPl: 'Wieczysta' },
  { value: 'open_source', labelEn: 'Open Source', labelPl: 'Open Source' },
  { value: 'internal', labelEn: 'Internal', labelPl: 'Wewnętrzna' },
];

const INTANGIBLE_TYPE_OPTIONS = [
  { value: 'license', labelEn: 'License', labelPl: 'Licencja' },
  { value: 'training', labelEn: 'Training', labelPl: 'Szkolenie' },
  { value: 'certification', labelEn: 'Certification', labelPl: 'Certyfikat' },
  { value: 'knowledge', labelEn: 'Knowledge', labelPl: 'Wiedza' },
  { value: 'ip', labelEn: 'IP / Patent', labelPl: 'IP / Patent' },
  { value: 'legal_right', labelEn: 'Legal Right', labelPl: 'Prawo majątkowe' },
  { value: 'other', labelEn: 'Other', labelPl: 'Inne' },
];

const INTANGIBLE_STATUS_OPTIONS = [
  { value: 'planned', labelEn: 'Planned', labelPl: 'Planowane' },
  { value: 'active', labelEn: 'Active', labelPl: 'Aktywne' },
  { value: 'expired', labelEn: 'Expired', labelPl: 'Wygasłe' },
  { value: 'renewed', labelEn: 'Renewed', labelPl: 'Odnowione' },
];

type ResourcesTableKey = 'budget' | 'fte' | 'tools' | 'intangibles' | 'all';

type BudgetDraft = Omit<BudgetItem, 'id'> & { rationale?: string };
type FteDraft = Omit<ResourceItem, 'id'> & { rationale?: string };
type ToolDraft = Omit<ToolItem, 'id'> & { rationale?: string };
type IntangibleDraft = Omit<IntangibleAssetItem, 'id'> & { rationale?: string };

type ResourcesAiProposal = {
  scope: ResourcesTableKey;
  note?: string;
  budgetAdd: BudgetDraft[];
  fteAdd: FteDraft[];
  toolsAdd: ToolDraft[];
  intangibleAdd: IntangibleDraft[];
};

const ResourcesAiProposalSchema = z.object({
  scope: z.enum(['budget', 'fte', 'tools', 'intangibles', 'all']),
  note: z.string().optional(),
  budgetAdd: z.array(z.any()),
  fteAdd: z.array(z.any()),
  toolsAdd: z.array(z.any()),
  intangibleAdd: z.array(z.any()),
});

const safeJsonParse = (raw: string): any | null => {
  const text = String(raw || '').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced?.[1] || text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

type TableAIMenuAction = {
  id: 'addOne' | 'analyze';
  label: { en: string; pl: string };
  onClick: () => void;
};

const TableAIMenu: React.FC<{
  isPolish: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  actions: TableAIMenuAction[];
  busy?: boolean;
}> = ({ isPolish, isOpen, onToggle, onClose, actions, busy = false }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onDoc = () => onClose();
    const t = setTimeout(() => document.addEventListener('click', onDoc), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onDoc);
    };
  }, [isOpen, onClose]);

  return (
    <div className="relative inline-flex">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (busy) return;
          onToggle();
        }}
        disabled={busy}
        className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors"
        title="AI"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
      </button>
      {isOpen && (
        <div
          className="absolute right-0 top-7 z-30 w-48 rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700/70 bg-c-surface p-1.5 shadow-xl shadow-slate-900/10 dark:shadow-black/30"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                onClose();
                a.onClick();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-c-text-secondary hover:bg-c-surface-raised transition-colors whitespace-nowrap"
            >
              {isPolish ? a.label.pl : a.label.en}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ==========================================
// Shared: inline-add row input classes
// ==========================================

const INLINE_INPUT_CLS =
  'w-full px-2 py-1.5 rounded-md bg-c-surface border border-c-border text-xs text-c-text focus:outline-none focus:ring-1 focus:ring-c-focus';

const INLINE_SELECT_CLS =
  'w-full px-1.5 py-1.5 rounded-md bg-c-surface border border-c-border text-xs text-c-text focus:outline-none focus:ring-1 focus:ring-c-focus';

// ==========================================
// Shared helpers
// ==========================================

/** canon §4.2 — status pill shell is always neutral; colour lives in the signal dot. */
const STATUS_BADGE_SHELL =
  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border border-slate-200/70 dark:border-white/[0.08] bg-c-bg dark:bg-white/[0.04] text-c-text-secondary';

/** Signal-tone dot for embedded resource-status pills (no hardcoded shell fills). */
const statusDotClass = (status: string): string => {
  const map: Record<string, string> = {
    planned: 'bg-slate-400 dark:bg-slate-500',
    active: 'bg-c-success',
    deprecated: 'bg-c-danger',
    expired: 'bg-c-warning',
    renewed: 'bg-c-info',
  };
  return map[status] || map.planned;
};

const fmtCurrency = (amount: number, currency: string, isPolish: boolean) =>
  new Intl.NumberFormat(isPolish ? 'pl-PL' : 'en-US', {
    style: 'currency',
    currency: currency || 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

// ==========================================
// MAIN COMPONENT
// ==========================================

export const ResourcesSection: React.FC = () => {
  const { t } = useTranslation();
  const {
    isPolish,
    initiative,
    initiativeId,
    tasks,
    decisions,
    raidItems,
    resourceItems,
    budgetItems,
    toolItems,
    intangibleAssets,
    handleAddResource,
    handleUpdateResource,
    handleDeleteResource,
    handleAddBudgetItem,
    handleUpdateBudgetItem,
    handleDeleteBudgetItem,
    handleAddTool,
    handleUpdateTool,
    handleDeleteTool,
    handleAddIntangibleAsset,
    handleUpdateIntangibleAsset,
    handleDeleteIntangibleAsset,
    resourcesAiRequest,
    clearResourcesAiRequest,
  } = useInitiativeContext();

  const aiLanguage = isPolish ? 'pl' : 'en';
  const targetLanguageName = t('initiatives.resourcesSection.english');

  const [aiBusy, setAiBusy] = useState(false);
  const [aiProposal, setAiProposal] = useState<ResourcesAiProposal | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedBudgetIdx, setSelectedBudgetIdx] = useState<Record<number, boolean>>({});
  const [selectedFteIdx, setSelectedFteIdx] = useState<Record<number, boolean>>({});
  const [selectedToolsIdx, setSelectedToolsIdx] = useState<Record<number, boolean>>({});
  const [selectedIntangibleIdx, setSelectedIntangibleIdx] = useState<Record<number, boolean>>({});

  const closeAIModal = useCallback(() => {
    setShowAIModal(false);
    setAiProposal(null);
    setSelectedBudgetIdx({});
    setSelectedFteIdx({});
    setSelectedToolsIdx({});
    setSelectedIntangibleIdx({});
  }, []);

  const normalizeCurrency = useCallback((v: any): string => {
    const s = String(v || '')
      .trim()
      .toUpperCase();
    if (s === 'PLN' || s === 'EUR' || s === 'USD' || s === 'GBP') return s;
    return 'PLN';
  }, []);

  const normalizeBudgetCategory = useCallback((v: any): string => {
    const s = String(v || '')
      .trim()
      .toLowerCase();
    const allowed = new Set(BUDGET_CATEGORIES.map((c) => c.value));
    return allowed.has(s) ? s : 'other';
  }, []);

  const normalizeToolCategory = useCallback((v: any): string => {
    const s = String(v || '')
      .trim()
      .toLowerCase();
    const allowed = new Set(TOOL_CATEGORIES.map((c) => c.value));
    return allowed.has(s) ? s : 'other';
  }, []);

  const normalizeToolStatus = useCallback((v: any): string => {
    const s = String(v || '')
      .trim()
      .toLowerCase();
    const allowed = new Set(TOOL_STATUS_OPTIONS.map((c) => c.value));
    return allowed.has(s) ? s : 'planned';
  }, []);

  const normalizeLicenseType = useCallback((v: any): string => {
    const s = String(v || '')
      .trim()
      .toLowerCase();
    const allowed = new Set(LICENSE_TYPE_OPTIONS.map((c) => c.value));
    return allowed.has(s) ? s : 'subscription';
  }, []);

  const normalizeIntangibleType = useCallback((v: any): string => {
    const s = String(v || '')
      .trim()
      .toLowerCase();
    const allowed = new Set(INTANGIBLE_TYPE_OPTIONS.map((c) => c.value));
    return allowed.has(s) ? s : 'other';
  }, []);

  const normalizeIntangibleStatus = useCallback((v: any): string => {
    const s = String(v || '')
      .trim()
      .toLowerCase();
    const allowed = new Set(INTANGIBLE_STATUS_OPTIONS.map((c) => c.value));
    return allowed.has(s) ? s : 'planned';
  }, []);

  const normalizeFteRole = useCallback((v: any): string => {
    const s = String(v || '')
      .trim()
      .toLowerCase();
    const allowed = new Set(ROLE_OPTIONS.map((c) => c.value));
    return allowed.has(s) ? s : 'member';
  }, []);

  const normalizeIsoDate = useCallback((v: any): string | undefined => {
    const s = String(v || '').trim();
    if (!s) return undefined;
    // Accept ISO 8601 date prefix (YYYY-MM-DD) and drop any time part.
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m?.[1] || undefined;
  }, []);

  const buildCommonContext = useCallback((): string => {
    const tasksCompact = (tasks || []).slice(0, 25).map((t: any) => ({
      id: String(t?.id),
      title: String(t?.title || ''),
      status: String(t?.status || ''),
      owner: t?.assigneeName || null,
    }));
    const decisionsCompact = (decisions || []).slice(0, 20).map((d: any) => ({
      id: String(d?.id),
      title: String(d?.title || ''),
      type: String(d?.type || ''),
      status: String(d?.status || ''),
    }));
    const raidCompact = (raidItems || []).slice(0, 20).map((r: any) => ({
      id: String(r?.id),
      type: String(r?.type || ''),
      title: String(r?.title || ''),
      severity: String(r?.severity || ''),
      status: String(r?.status || ''),
    }));

    return [
      `[INITIATIVE CONTEXT]`,
      `Initiative name: ${initiative?.name || ''}`,
      `Status: ${initiative?.status || ''}`,
      `Priority: ${initiative?.priority || ''}`,
      `Summary: ${(initiative?.summary || initiative?.description || '').toString()}`,
      ``,
      `[TASKS SNAPSHOT]`,
      JSON.stringify(tasksCompact, null, 2),
      ``,
      `[DECISIONS SNAPSHOT]`,
      JSON.stringify(decisionsCompact, null, 2),
      ``,
      `[RAID SNAPSHOT]`,
      JSON.stringify(raidCompact, null, 2),
    ].join('\n');
  }, [decisions, initiative, raidItems, tasks]);

  const callAi = useCallback(
    async (input: { fieldLabel: string; systemInstruction: string; contextText: string }) => {
      const artifactContext = {
        title: initiative?.name || '',
        status: initiative?.status || '',
        priority: initiative?.priority || '',
        type: 'initiative',
      };

      const runOnce = async (payload: { text: string; systemInstruction: string }) => {
        const res = await Api.post('/ai/refine-text', {
          text: payload.text,
          mode: 'generate',
          systemInstruction: payload.systemInstruction,
          fieldLabel: input.fieldLabel,
          artifactContext,
          language: aiLanguage,
        });
        const raw = String(res?.text || '');
        const parsed = safeJsonParse(raw);
        return { raw, parsed };
      };

      // 1) First attempt
      const first = await runOnce({
        text: input.contextText,
        systemInstruction: input.systemInstruction,
      });
      if (first.parsed && typeof first.parsed === 'object' && !Array.isArray(first.parsed))
        return first.parsed;

      // 2) Auto-repair attempt (strict JSON only)
      const repairSystemInstruction = [
        input.systemInstruction,
        ``,
        `REPAIR MODE:`,
        `You previously returned an invalid response (not valid JSON / wrong shape).`,
        `Your job is to REPAIR it into VALID JSON matching the schema already provided above.`,
        `Rules:`,
        `- Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
        `- Do NOT add extra keys beyond the schema.`,
        `- If you are unsure, return the minimal valid structure with empty "add" arrays.`,
      ].join('\n');

      const repairText = [input.contextText, ``, `[MODEL OUTPUT TO REPAIR]`, first.raw].join('\n');

      const second = await runOnce({
        text: repairText,
        systemInstruction: repairSystemInstruction,
      });
      if (second.parsed && typeof second.parsed === 'object' && !Array.isArray(second.parsed))
        return second.parsed;

      return null;
    },
    [aiLanguage, initiative]
  );

  const openProposal = useCallback((proposal: ResourcesAiProposal) => {
    setAiProposal(proposal);
    setSelectedBudgetIdx(Object.fromEntries(proposal.budgetAdd.map((_, idx) => [idx, true])));
    setSelectedFteIdx(Object.fromEntries(proposal.fteAdd.map((_, idx) => [idx, true])));
    setSelectedToolsIdx(Object.fromEntries(proposal.toolsAdd.map((_, idx) => [idx, true])));
    setSelectedIntangibleIdx(
      Object.fromEntries(proposal.intangibleAdd.map((_, idx) => [idx, true]))
    );
    setShowAIModal(true);
  }, []);

  const buildBudgetAddOneInstruction = useCallback((): string => {
    return [
      `You are a senior PMO / finance partner.`,
      `Propose exactly ONE additional Budget line item for this initiative.`,
      ``,
      `You will receive initiative context and existing rows in the user message. Use that context; do not guess.`,
      ``,
      `OUTPUT LANGUAGE: ${targetLanguageName} only. Translate as needed.`,
      ``,
      `Rules:`,
      `- Do NOT invent numbers. Use numeric amounts ONLY if clearly present in context.`,
      `- If amount is unknown, set amount = 0 and explain assumptions in description using "[confirm]" placeholders.`,
      `- Avoid duplicates of existing budget items (same intent/category/description).`,
      `- Keep description short but specific (1–2 sentences; bullets if needed).`,
      `- Choose category from: personnel | technology | consulting | training | infrastructure | licenses | other`,
      `- costType must be CAPEX or OPEX.`,
      `- currency must be one of: PLN | EUR | USD | GBP`,
      ``,
      `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
      `Schema: { "category": string, "costType": "CAPEX"|"OPEX", "amount": number, "currency": "PLN"|"EUR"|"USD"|"GBP", "description"?: string }`,
    ].join('\n');
  }, [targetLanguageName]);

  const buildBudgetAnalyzeInstruction = useCallback(
    (isEmpty: boolean): string => {
      return [
        `You are a senior PMO / finance partner.`,
        `Review the existing Budget table and propose ADDITIONS ONLY (no removals).`,
        isEmpty
          ? `The table is empty. Propose an initial complete set (5–10 items) that likely applies to this initiative.`
          : `The table has existing rows. Propose 0–6 additional items ONLY if truly missing.`,
        ``,
        `You will receive initiative context and existing rows in the user message. Use that context; do not guess.`,
        ``,
        `OUTPUT LANGUAGE: ${targetLanguageName} only. Translate as needed.`,
        ``,
        `Rules:`,
        `- Never remove or edit existing rows. Only propose additions.`,
        `- Do NOT invent numbers. Use numeric amounts ONLY if clearly present in context.`,
        `- If amount is unknown, set amount = 0 and add "[confirm]" placeholders in description.`,
        `- Avoid duplicates of existing items (same intent).`,
        `- category must be one of: personnel | technology | consulting | training | infrastructure | licenses | other`,
        `- costType must be CAPEX or OPEX.`,
        `- currency must be one of: PLN | EUR | USD | GBP (prefer the existing table currency if present; otherwise PLN).`,
        ``,
        `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
        `If nothing is missing, return { "add": [] } (optional "note").`,
        `Schema: { "add": [{ "category": string, "costType": "CAPEX"|"OPEX", "amount": number, "currency": "PLN"|"EUR"|"USD"|"GBP", "description"?: string, "rationale"?: string }], "note"?: string }`,
      ].join('\n');
    },
    [targetLanguageName]
  );

  const buildFteAddOneInstruction = useCallback((): string => {
    return [
      `You are a senior PMO delivery lead.`,
      `Propose exactly ONE additional Team/FTE allocation row for this initiative.`,
      ``,
      `You will receive initiative context and existing rows in the user message. Use that context; do not guess.`,
      ``,
      `OUTPUT LANGUAGE: ${targetLanguageName} only. Translate as needed.`,
      ``,
      `Rules:`,
      `- Do NOT invent real people if they are not in context. If uncertain, use a role placeholder name like "Process SME (TBD)".`,
      `- allocationPercentage must be an integer 10–100.`,
      `- role must be one of: lead | member | consultant | stakeholder`,
      `- startDate/endDate: include only if present in context; otherwise omit. If provided, use ISO 8601 format "YYYY-MM-DD".`,
      `- Avoid duplicates of existing rows.`,
      ``,
      `Return ONLY valid JSON.`,
      `Schema: { "name": string, "role": "lead"|"member"|"consultant"|"stakeholder", "allocationPercentage": number, "startDate"?: "YYYY-MM-DD", "endDate"?: "YYYY-MM-DD", "notes"?: string }`,
    ].join('\n');
  }, [targetLanguageName]);

  const buildFteAnalyzeInstruction = useCallback(
    (isEmpty: boolean): string => {
      return [
        `You are a senior PMO delivery lead.`,
        `Review the existing Team/FTE table and propose ADDITIONS ONLY (no removals).`,
        isEmpty
          ? `The table is empty. Propose an initial lean allocation plan (4–8 rows).`
          : `The table has existing rows. Propose 0–6 additional rows only if key capabilities are missing.`,
        ``,
        `You will receive initiative context and existing rows in the user message. Use that context; do not guess.`,
        ``,
        `OUTPUT LANGUAGE: ${targetLanguageName} only. Translate as needed.`,
        ``,
        `Rules:`,
        `- Never remove or edit existing rows. Only additions.`,
        `- Do NOT invent real people if not in context; use "TBD" placeholders.`,
        `- allocationPercentage must be an integer 10–100.`,
        `- role must be one of: lead | member | consultant | stakeholder`,
        `- startDate/endDate: include only if present in context; otherwise omit. If provided, use ISO 8601 format "YYYY-MM-DD".`,
        `- Avoid duplicates.`,
        ``,
        `Return ONLY valid JSON.`,
        `If nothing is missing, return { "add": [] } (optional "note").`,
        `Schema: { "add": [{ "name": string, "role": "lead"|"member"|"consultant"|"stakeholder", "allocationPercentage": number, "startDate"?: string, "endDate"?: string, "notes"?: string, "rationale"?: string }], "note"?: string }`,
      ].join('\n');
    },
    [targetLanguageName]
  );

  const buildToolsAddOneInstruction = useCallback((): string => {
    return [
      `You are a senior technical delivery lead.`,
      `Propose exactly ONE additional tool/infrastructure item needed for this initiative.`,
      ``,
      `You will receive initiative context and existing rows in the user message. Use that context; do not guess.`,
      ``,
      `OUTPUT LANGUAGE: ${targetLanguageName} only. Translate as needed.`,
      ``,
      `Rules:`,
      `- Do NOT invent vendor names or costs unless present in context.`,
      `- If licenseCost is unknown, set licenseCost = 0 and use notes with "[confirm]" placeholders.`,
      `- category must be one of: software | hardware | cloud | platform | other`,
      `- licenseType must be one of: subscription | perpetual | open_source | internal`,
      `- status must be one of: planned | active | deprecated`,
      `- Avoid duplicates.`,
      ``,
      `Return ONLY valid JSON.`,
      `Schema: { "name": string, "category": "software"|"hardware"|"cloud"|"platform"|"other", "vendor"?: string, "licenseCost": number, "licenseType": "subscription"|"perpetual"|"open_source"|"internal", "status": "planned"|"active"|"deprecated", "notes"?: string }`,
    ].join('\n');
  }, [targetLanguageName]);

  const buildToolsAnalyzeInstruction = useCallback(
    (isEmpty: boolean): string => {
      return [
        `You are a senior technical delivery lead.`,
        `Review the existing Tools & Infrastructure table and propose ADDITIONS ONLY (no removals).`,
        isEmpty
          ? `The table is empty. Propose an initial set (3–8 items).`
          : `The table has existing rows. Propose 0–5 additions only if clearly missing.`,
        ``,
        `You will receive initiative context and existing rows in the user message. Use that context; do not guess.`,
        ``,
        `OUTPUT LANGUAGE: ${targetLanguageName} only. Translate as needed.`,
        ``,
        `Rules:`,
        `- Never remove or edit existing rows. Only additions.`,
        `- Do NOT invent costs/vendors unless present.`,
        `- If cost unknown, set licenseCost = 0 and include "[confirm]" placeholders in notes.`,
        `- category must be one of: software | hardware | cloud | platform | other`,
        `- licenseType must be one of: subscription | perpetual | open_source | internal`,
        `- status must be one of: planned | active | deprecated`,
        `- Avoid duplicates.`,
        ``,
        `Return ONLY valid JSON.`,
        `If nothing is missing, return { "add": [] } (optional "note").`,
        `Schema: { "add": [{ "name": string, "category": "software"|"hardware"|"cloud"|"platform"|"other", "vendor"?: string, "licenseCost": number, "licenseType": "subscription"|"perpetual"|"open_source"|"internal", "status": "planned"|"active"|"deprecated", "notes"?: string, "rationale"?: string }], "note"?: string }`,
      ].join('\n');
    },
    [targetLanguageName]
  );

  const buildIntangibleAddOneInstruction = useCallback((): string => {
    return [
      `You are a senior PMO / enablement lead.`,
      `Propose exactly ONE additional intangible asset item (license/training/certification/knowledge/IP) for this initiative.`,
      ``,
      `You will receive initiative context and existing rows in the user message. Use that context; do not guess.`,
      ``,
      `OUTPUT LANGUAGE: ${targetLanguageName} only. Translate as needed.`,
      ``,
      `Rules:`,
      `- Do NOT invent providers or costs unless present in context.`,
      `- If cost is unknown, set cost = 0 and use notes with "[confirm]" placeholders.`,
      `- assetType must be one of: license | training | certification | knowledge | ip | legal_right | other`,
      `- status must be one of: planned | active | expired | renewed`,
      `- validFrom/validUntil: include only if present in context; otherwise omit. If provided, use ISO 8601 format "YYYY-MM-DD".`,
      `- Avoid duplicates.`,
      ``,
      `Return ONLY valid JSON.`,
      `Schema: { "assetType": "license"|"training"|"certification"|"knowledge"|"ip"|"legal_right"|"other", "name": string, "provider"?: string, "cost": number, "currency": "PLN"|"EUR"|"USD"|"GBP", "validFrom"?: "YYYY-MM-DD", "validUntil"?: "YYYY-MM-DD", "status": "planned"|"active"|"expired"|"renewed", "beneficiaries"?: string, "notes"?: string }`,
    ].join('\n');
  }, [targetLanguageName]);

  const buildIntangibleAnalyzeInstruction = useCallback(
    (isEmpty: boolean): string => {
      return [
        `You are a senior PMO / enablement lead.`,
        `Review the existing Intangibles table and propose ADDITIONS ONLY (no removals).`,
        isEmpty
          ? `The table is empty. Propose an initial set (2–6 items).`
          : `The table has existing rows. Propose 0–4 additions only if clearly missing.`,
        ``,
        `You will receive initiative context and existing rows in the user message. Use that context; do not guess.`,
        ``,
        `OUTPUT LANGUAGE: ${targetLanguageName} only. Translate as needed.`,
        ``,
        `Rules:`,
        `- Never remove or edit existing rows. Only additions.`,
        `- Do NOT invent providers/costs/dates unless present in context.`,
        `- If cost unknown, set cost = 0 and include "[confirm]" placeholders.`,
        `- assetType must be one of: license | training | certification | knowledge | ip | legal_right | other`,
        `- status must be one of: planned | active | expired | renewed`,
        `- validFrom/validUntil: include only if present in context; otherwise omit. If provided, use ISO 8601 format "YYYY-MM-DD".`,
        `- Avoid duplicates.`,
        ``,
        `Return ONLY valid JSON.`,
        `If nothing is missing, return { "add": [] } (optional "note").`,
        `Schema: { "add": [{ "assetType": "license"|"training"|"certification"|"knowledge"|"ip"|"legal_right"|"other", "name": string, "provider"?: string, "cost": number, "currency": "PLN"|"EUR"|"USD"|"GBP", "validFrom"?: "YYYY-MM-DD", "validUntil"?: "YYYY-MM-DD", "status": "planned"|"active"|"expired"|"renewed", "beneficiaries"?: string, "notes"?: string, "rationale"?: string }], "note"?: string }`,
      ].join('\n');
    },
    [targetLanguageName]
  );

  const analyzeAllInstruction = useCallback(
    (flags: {
      budgetEmpty: boolean;
      fteEmpty: boolean;
      toolsEmpty: boolean;
      intangibleEmpty: boolean;
    }) => {
      const allEmpty =
        flags.budgetEmpty && flags.fteEmpty && flags.toolsEmpty && flags.intangibleEmpty;
      return [
        `You are a senior PMO + delivery lead.`,
        `Propose additions for ALL Resources tables: Budget, Team/FTE, Tools, Intangibles.`,
        ``,
        allEmpty
          ? `All tables are empty. Generate a full initial fill for each table within the limits.`
          : `Some tables already have rows. For each table propose ADDITIONS ONLY if truly missing; never remove anything.`,
        ``,
        `You will receive initiative context and existing rows in the user message. Use that context; do not guess.`,
        ``,
        `OUTPUT LANGUAGE: ${targetLanguageName} only. Translate as needed.`,
        ``,
        `Rules:`,
        `- Never remove or edit existing rows; propose additions only.`,
        `- Do NOT invent numbers/providers/vendors/dates unless present in context.`,
        `- If a numeric field is unknown, set it to 0 and add "[confirm]" placeholders in description/notes.`,
        `- Avoid duplicates vs the existing rows provided.`,
        `- Dates (startDate/endDate/validFrom/validUntil) must be ISO 8601 "YYYY-MM-DD" if provided.`,
        `- Output MUST NOT contain "remove", "reorder", "update", or any edit instructions. Additions only.`,
        `- Output MUST contain ONLY these keys: budget, teamFte, tools, intangibles, note (optional). No extra keys.`,
        ``,
        `Limits:`,
        `- Budget add: ${flags.budgetEmpty ? '5–10' : '0–6'}`,
        `- Team/FTE add: ${flags.fteEmpty ? '4–8' : '0–6'}`,
        `- Tools add: ${flags.toolsEmpty ? '3–8' : '0–5'}`,
        `- Intangibles add: ${flags.intangibleEmpty ? '2–6' : '0–4'}`,
        ``,
        `Return ONLY valid JSON.`,
        `If nothing is missing, return: { "budget": { "add": [] }, "teamFte": { "add": [] }, "tools": { "add": [] }, "intangibles": { "add": [] } }`,
        `Schema: {`,
        `"budget": { "add": [{ "category": "personnel"|"technology"|"consulting"|"training"|"infrastructure"|"licenses"|"other", "costType": "CAPEX"|"OPEX", "amount": number, "currency": "PLN"|"EUR"|"USD"|"GBP", "description"?: string, "rationale"?: string }] },`,
        `"teamFte": { "add": [{ "name": string, "role": "lead"|"member"|"consultant"|"stakeholder", "allocationPercentage": number, "startDate"?: "YYYY-MM-DD", "endDate"?: "YYYY-MM-DD", "notes"?: string, "rationale"?: string }] },`,
        `"tools": { "add": [{ "name": string, "category": "software"|"hardware"|"cloud"|"platform"|"other", "vendor"?: string, "licenseCost": number, "licenseType": "subscription"|"perpetual"|"open_source"|"internal", "status": "planned"|"active"|"deprecated", "notes"?: string, "rationale"?: string }] },`,
        `"intangibles": { "add": [{ "assetType": "license"|"training"|"certification"|"knowledge"|"ip"|"legal_right"|"other", "name": string, "provider"?: string, "cost": number, "currency": "PLN"|"EUR"|"USD"|"GBP", "validFrom"?: "YYYY-MM-DD", "validUntil"?: "YYYY-MM-DD", "status": "planned"|"active"|"expired"|"renewed", "beneficiaries"?: string, "notes"?: string, "rationale"?: string }] },`,
        `"note"?: string`,
        `}`,
      ].join('\n');
    },
    [targetLanguageName]
  );

  const proposeForTable = useCallback(
    async (table: Exclude<ResourcesTableKey, 'all'>, mode: 'addOne' | 'analyze') => {
      if (aiBusy) return;
      setAiBusy(true);
      try {
        const common = buildCommonContext();
        let systemInstruction = '';
        let contextText = common;
        let fieldLabel = '';

        if (table === 'budget') {
          const existing = budgetItems.map((b) => ({
            category: b.category,
            costType: b.costType,
            amount: b.amount,
            currency: b.currency,
            description: b.description || '',
          }));
          contextText = [
            common,
            ``,
            `[EXISTING BUDGET ITEMS]`,
            JSON.stringify(existing, null, 2),
          ].join('\n');
          fieldLabel =
            mode === 'addOne' ? 'Resources: budget add one' : 'Resources: budget analyze';
          systemInstruction =
            mode === 'addOne'
              ? buildBudgetAddOneInstruction()
              : buildBudgetAnalyzeInstruction(budgetItems.length === 0);
        } else if (table === 'fte') {
          const existing = resourceItems.map((r) => ({
            name: r.name,
            role: r.role,
            allocationPercentage: r.allocationPercentage,
            startDate: r.startDate || null,
            endDate: r.endDate || null,
            notes: r.notes || '',
          }));
          contextText = [
            common,
            ``,
            `[EXISTING TEAM / FTE]`,
            JSON.stringify(existing, null, 2),
          ].join('\n');
          fieldLabel = mode === 'addOne' ? 'Resources: FTE add one' : 'Resources: FTE analyze';
          systemInstruction =
            mode === 'addOne'
              ? buildFteAddOneInstruction()
              : buildFteAnalyzeInstruction(resourceItems.length === 0);
        } else if (table === 'tools') {
          const existing = toolItems.map((t) => ({
            name: t.name,
            category: t.category,
            vendor: t.vendor || null,
            licenseCost: t.licenseCost,
            licenseType: t.licenseType,
            status: t.status,
            notes: t.notes || '',
          }));
          contextText = [common, ``, `[EXISTING TOOLS]`, JSON.stringify(existing, null, 2)].join(
            '\n'
          );
          fieldLabel = mode === 'addOne' ? 'Resources: tools add one' : 'Resources: tools analyze';
          systemInstruction =
            mode === 'addOne'
              ? buildToolsAddOneInstruction()
              : buildToolsAnalyzeInstruction(toolItems.length === 0);
        } else if (table === 'intangibles') {
          const existing = intangibleAssets.map((a) => ({
            assetType: a.assetType,
            name: a.name,
            provider: a.provider || null,
            cost: a.cost,
            currency: a.currency,
            validFrom: a.validFrom || null,
            validUntil: a.validUntil || null,
            status: a.status,
            beneficiaries: a.beneficiaries || null,
            notes: a.notes || '',
          }));
          contextText = [
            common,
            ``,
            `[EXISTING INTANGIBLES]`,
            JSON.stringify(existing, null, 2),
          ].join('\n');
          fieldLabel =
            mode === 'addOne' ? 'Resources: intangibles add one' : 'Resources: intangibles analyze';
          systemInstruction =
            mode === 'addOne'
              ? buildIntangibleAddOneInstruction()
              : buildIntangibleAnalyzeInstruction(intangibleAssets.length === 0);
        }

        const parsed = await callAi({ fieldLabel, systemInstruction, contextText });
        if (!parsed) return;

        const proposal: ResourcesAiProposal = {
          scope: table,
          note: parsed?.note ? String(parsed.note) : undefined,
          budgetAdd: [],
          fteAdd: [],
          toolsAdd: [],
          intangibleAdd: [],
        };

        if (table === 'budget') {
          const addRaw =
            mode === 'addOne' ? [parsed] : Array.isArray(parsed?.add) ? parsed.add : [];
          proposal.budgetAdd = addRaw
            .map((x: any) => ({
              category: normalizeBudgetCategory(x?.category),
              costType:
                String(x?.costType || 'OPEX').toUpperCase() === 'CAPEX'
                  ? ('CAPEX' as const)
                  : ('OPEX' as const),
              amount: Number(x?.amount) || 0,
              currency: normalizeCurrency(x?.currency),
              description: x?.description ? String(x.description).trim() : undefined,
              rationale: x?.rationale ? String(x.rationale).trim() : undefined,
            }))
            .filter((x: any) => x.category && x.costType);
        }

        if (table === 'fte') {
          const addRaw =
            mode === 'addOne' ? [parsed] : Array.isArray(parsed?.add) ? parsed.add : [];
          proposal.fteAdd = addRaw
            .map((x: any) => ({
              name: String(x?.name || '').trim(),
              role: normalizeFteRole(x?.role),
              allocationPercentage: Math.max(
                10,
                Math.min(100, Math.round(Number(x?.allocationPercentage) || 50))
              ),
              startDate: normalizeIsoDate(x?.startDate),
              endDate: normalizeIsoDate(x?.endDate),
              notes: x?.notes ? String(x.notes).trim() : undefined,
              rationale: x?.rationale ? String(x.rationale).trim() : undefined,
            }))
            .filter((x: any) => x.name);
        }

        if (table === 'tools') {
          const addRaw =
            mode === 'addOne' ? [parsed] : Array.isArray(parsed?.add) ? parsed.add : [];
          proposal.toolsAdd = addRaw
            .map((x: any) => ({
              name: String(x?.name || '').trim(),
              category: normalizeToolCategory(x?.category),
              vendor: x?.vendor ? String(x.vendor).trim() : undefined,
              licenseCost: Number(x?.licenseCost) || 0,
              licenseType: normalizeLicenseType(x?.licenseType),
              status: normalizeToolStatus(x?.status),
              notes: x?.notes ? String(x.notes).trim() : undefined,
              rationale: x?.rationale ? String(x.rationale).trim() : undefined,
            }))
            .filter((x: any) => x.name);
        }

        if (table === 'intangibles') {
          const addRaw =
            mode === 'addOne' ? [parsed] : Array.isArray(parsed?.add) ? parsed.add : [];
          proposal.intangibleAdd = addRaw
            .map((x: any) => ({
              assetType: normalizeIntangibleType(x?.assetType || x?.type),
              name: String(x?.name || '').trim(),
              provider: x?.provider ? String(x.provider).trim() : undefined,
              cost: Number(x?.cost) || 0,
              currency: normalizeCurrency(x?.currency),
              validFrom: normalizeIsoDate(x?.validFrom),
              validUntil: normalizeIsoDate(x?.validUntil),
              status: normalizeIntangibleStatus(x?.status),
              beneficiaries: x?.beneficiaries ? String(x.beneficiaries).trim() : undefined,
              notes: x?.notes ? String(x.notes).trim() : undefined,
              rationale: x?.rationale ? String(x.rationale).trim() : undefined,
            }))
            .filter((x: any) => x.name);
        }

        const hasAny =
          proposal.budgetAdd.length > 0 ||
          proposal.fteAdd.length > 0 ||
          proposal.toolsAdd.length > 0 ||
          proposal.intangibleAdd.length > 0;

        if (!hasAny) {
          toast(t('initiatives.resourcesSection.noAdditionsForTable'));
          return;
        }
        const check = ResourcesAiProposalSchema.safeParse(proposal);
        if (!check.success) {
          toast.error(t('initiatives.resourcesSection.invalidAiFormat'));
          return;
        }
        openProposal(proposal);
      } finally {
        setAiBusy(false);
      }
    },
    [
      aiBusy,
      budgetItems,
      buildBudgetAddOneInstruction,
      buildBudgetAnalyzeInstruction,
      buildCommonContext,
      buildFteAddOneInstruction,
      buildFteAnalyzeInstruction,
      buildIntangibleAddOneInstruction,
      buildIntangibleAnalyzeInstruction,
      buildToolsAddOneInstruction,
      buildToolsAnalyzeInstruction,
      callAi,
      intangibleAssets,
      normalizeBudgetCategory,
      normalizeCurrency,
      normalizeFteRole,
      normalizeIsoDate,
      normalizeIntangibleStatus,
      normalizeIntangibleType,
      normalizeLicenseType,
      normalizeToolCategory,
      normalizeToolStatus,
      openProposal,
      resourceItems,
      t,
      toolItems,
    ]
  );

  const proposeAllTables = useCallback(async () => {
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const common = buildCommonContext();
      const flags = {
        budgetEmpty: budgetItems.length === 0,
        fteEmpty: resourceItems.length === 0,
        toolsEmpty: toolItems.length === 0,
        intangibleEmpty: intangibleAssets.length === 0,
      };
      const systemInstruction = analyzeAllInstruction(flags);
      const contextText = [
        common,
        ``,
        `[EXISTING BUDGET ITEMS]`,
        JSON.stringify(
          budgetItems.map((b) => ({
            category: b.category,
            costType: b.costType,
            amount: b.amount,
            currency: b.currency,
            description: b.description || '',
          })),
          null,
          2
        ),
        ``,
        `[EXISTING TEAM / FTE]`,
        JSON.stringify(
          resourceItems.map((r) => ({
            name: r.name,
            role: r.role,
            allocationPercentage: r.allocationPercentage,
            startDate: r.startDate || null,
            endDate: r.endDate || null,
            notes: r.notes || '',
          })),
          null,
          2
        ),
        ``,
        `[EXISTING TOOLS]`,
        JSON.stringify(
          toolItems.map((t) => ({
            name: t.name,
            category: t.category,
            vendor: t.vendor || null,
            licenseCost: t.licenseCost,
            licenseType: t.licenseType,
            status: t.status,
            notes: t.notes || '',
          })),
          null,
          2
        ),
        ``,
        `[EXISTING INTANGIBLES]`,
        JSON.stringify(
          intangibleAssets.map((a) => ({
            assetType: a.assetType,
            name: a.name,
            provider: a.provider || null,
            cost: a.cost,
            currency: a.currency,
            validFrom: a.validFrom || null,
            validUntil: a.validUntil || null,
            status: a.status,
            beneficiaries: a.beneficiaries || null,
            notes: a.notes || '',
          })),
          null,
          2
        ),
      ].join('\n');

      const parsed = await callAi({
        fieldLabel: 'Resources: fill all tables',
        systemInstruction,
        contextText,
      });
      if (!parsed) return;

      const proposal: ResourcesAiProposal = {
        scope: 'all',
        note: parsed?.note ? String(parsed.note) : undefined,
        budgetAdd: Array.isArray(parsed?.budget?.add) ? parsed.budget.add : [],
        fteAdd: Array.isArray(parsed?.teamFte?.add) ? parsed.teamFte.add : [],
        toolsAdd: Array.isArray(parsed?.tools?.add) ? parsed.tools.add : [],
        intangibleAdd: Array.isArray(parsed?.intangibles?.add) ? parsed.intangibles.add : [],
      };

      proposal.budgetAdd = proposal.budgetAdd
        .map((x: any) => ({
          category: normalizeBudgetCategory(x?.category),
          costType:
            String(x?.costType || 'OPEX').toUpperCase() === 'CAPEX'
              ? ('CAPEX' as const)
              : ('OPEX' as const),
          amount: Number(x?.amount) || 0,
          currency: normalizeCurrency(x?.currency),
          description: x?.description ? String(x.description).trim() : undefined,
          rationale: x?.rationale ? String(x.rationale).trim() : undefined,
        }))
        .filter((x: any) => x.category);

      proposal.fteAdd = proposal.fteAdd
        .map((x: any) => ({
          name: String(x?.name || '').trim(),
          role: normalizeFteRole(x?.role),
          allocationPercentage: Math.max(
            10,
            Math.min(100, Math.round(Number(x?.allocationPercentage) || 50))
          ),
          startDate: normalizeIsoDate(x?.startDate),
          endDate: normalizeIsoDate(x?.endDate),
          notes: x?.notes ? String(x.notes).trim() : undefined,
          rationale: x?.rationale ? String(x.rationale).trim() : undefined,
        }))
        .filter((x: any) => x.name);

      proposal.toolsAdd = proposal.toolsAdd
        .map((x: any) => ({
          name: String(x?.name || '').trim(),
          category: normalizeToolCategory(x?.category),
          vendor: x?.vendor ? String(x.vendor).trim() : undefined,
          licenseCost: Number(x?.licenseCost) || 0,
          licenseType: normalizeLicenseType(x?.licenseType),
          status: normalizeToolStatus(x?.status),
          notes: x?.notes ? String(x.notes).trim() : undefined,
          rationale: x?.rationale ? String(x.rationale).trim() : undefined,
        }))
        .filter((x: any) => x.name);

      proposal.intangibleAdd = proposal.intangibleAdd
        .map((x: any) => ({
          assetType: normalizeIntangibleType(x?.assetType || x?.type),
          name: String(x?.name || '').trim(),
          provider: x?.provider ? String(x.provider).trim() : undefined,
          cost: Number(x?.cost) || 0,
          currency: normalizeCurrency(x?.currency),
          validFrom: normalizeIsoDate(x?.validFrom),
          validUntil: normalizeIsoDate(x?.validUntil),
          status: normalizeIntangibleStatus(x?.status),
          beneficiaries: x?.beneficiaries ? String(x.beneficiaries).trim() : undefined,
          notes: x?.notes ? String(x.notes).trim() : undefined,
          rationale: x?.rationale ? String(x.rationale).trim() : undefined,
        }))
        .filter((x: any) => x.name);

      // Deduplicate vs existing rows — CTA should propose only what to ADD.
      const existingBudgetKeys = new Set(
        budgetItems.map((b) =>
          [
            String(b.category || '')
              .trim()
              .toLowerCase(),
            String(b.costType || '')
              .trim()
              .toUpperCase(),
            String(b.description || '')
              .trim()
              .toLowerCase(),
          ].join('|')
        )
      );
      const existingFteKeys = new Set(
        resourceItems.map((r) =>
          [
            String(r.name || '')
              .trim()
              .toLowerCase(),
            String(r.role || '')
              .trim()
              .toLowerCase(),
          ].join('|')
        )
      );
      const existingToolKeys = new Set(
        toolItems.map((t) =>
          [
            String(t.name || '')
              .trim()
              .toLowerCase(),
            String(t.category || '')
              .trim()
              .toLowerCase(),
          ].join('|')
        )
      );
      const existingIntangibleKeys = new Set(
        intangibleAssets.map((a) =>
          [
            String(a.assetType || '')
              .trim()
              .toLowerCase(),
            String(a.name || '')
              .trim()
              .toLowerCase(),
          ].join('|')
        )
      );

      proposal.budgetAdd = proposal.budgetAdd.filter((b) => {
        const key = [
          String(b.category || '')
            .trim()
            .toLowerCase(),
          String(b.costType || '')
            .trim()
            .toUpperCase(),
          String(b.description || '')
            .trim()
            .toLowerCase(),
        ].join('|');
        return !existingBudgetKeys.has(key);
      });
      proposal.fteAdd = proposal.fteAdd.filter((r) => {
        const key = [
          String(r.name || '')
            .trim()
            .toLowerCase(),
          String(r.role || '')
            .trim()
            .toLowerCase(),
        ].join('|');
        return !existingFteKeys.has(key);
      });
      proposal.toolsAdd = proposal.toolsAdd.filter((t) => {
        const key = [
          String(t.name || '')
            .trim()
            .toLowerCase(),
          String(t.category || '')
            .trim()
            .toLowerCase(),
        ].join('|');
        return !existingToolKeys.has(key);
      });
      proposal.intangibleAdd = proposal.intangibleAdd.filter((a) => {
        const key = [
          String(a.assetType || '')
            .trim()
            .toLowerCase(),
          String(a.name || '')
            .trim()
            .toLowerCase(),
        ].join('|');
        return !existingIntangibleKeys.has(key);
      });

      const hasAny =
        proposal.budgetAdd.length > 0 ||
        proposal.fteAdd.length > 0 ||
        proposal.toolsAdd.length > 0 ||
        proposal.intangibleAdd.length > 0;
      if (!hasAny) {
        toast(t('initiatives.resourcesSection.noMissingResources'));
        return;
      }
      const check = ResourcesAiProposalSchema.safeParse(proposal);
      if (!check.success) {
        toast.error(t('initiatives.resourcesSection.invalidAiFormat'));
        return;
      }
      openProposal(proposal);
    } finally {
      setAiBusy(false);
    }
  }, [
    aiBusy,
    analyzeAllInstruction,
    budgetItems,
    buildCommonContext,
    callAi,
    intangibleAssets,
    normalizeBudgetCategory,
    normalizeCurrency,
    normalizeFteRole,
    normalizeIsoDate,
    normalizeIntangibleStatus,
    normalizeIntangibleType,
    normalizeLicenseType,
    normalizeToolCategory,
    normalizeToolStatus,
    openProposal,
    resourceItems,
    t,
    toolItems,
  ]);

  const applyProposal = useCallback(async () => {
    if (!aiProposal) return;
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const budgetToAdd = aiProposal.budgetAdd.filter((_, idx) => !!selectedBudgetIdx[idx]);
      const fteToAdd = aiProposal.fteAdd.filter((_, idx) => !!selectedFteIdx[idx]);
      const toolsToAdd = aiProposal.toolsAdd.filter((_, idx) => !!selectedToolsIdx[idx]);
      const intangibleToAdd = aiProposal.intangibleAdd.filter(
        (_, idx) => !!selectedIntangibleIdx[idx]
      );

      for (const b of budgetToAdd) {
        await handleAddBudgetItem({
          category: normalizeBudgetCategory(b.category),
          costType: b.costType === 'CAPEX' ? 'CAPEX' : 'OPEX',
          amount: Number(b.amount) || 0,
          currency: normalizeCurrency(b.currency),
          description: b.description || undefined,
          source: 'ai',
        });
      }
      for (const r of fteToAdd) {
        await handleAddResource({
          name: String(r.name || '').trim(),
          role: normalizeFteRole(r.role),
          allocationPercentage: Math.max(
            10,
            Math.min(100, Math.round(Number(r.allocationPercentage) || 50))
          ),
          startDate: r.startDate || undefined,
          endDate: r.endDate || undefined,
          notes: r.notes || undefined,
          source: 'ai',
        });
      }
      for (const t of toolsToAdd) {
        await handleAddTool({
          name: String(t.name || '').trim(),
          category: normalizeToolCategory(t.category),
          vendor: t.vendor || undefined,
          licenseCost: Number(t.licenseCost) || 0,
          licenseType: normalizeLicenseType(t.licenseType),
          status: normalizeToolStatus(t.status),
          notes: t.notes || undefined,
          source: 'ai',
        });
      }
      for (const a of intangibleToAdd) {
        await handleAddIntangibleAsset({
          assetType: normalizeIntangibleType(a.assetType),
          name: String(a.name || '').trim(),
          provider: a.provider || undefined,
          cost: Number(a.cost) || 0,
          currency: normalizeCurrency(a.currency),
          validFrom: a.validFrom || undefined,
          validUntil: a.validUntil || undefined,
          status: normalizeIntangibleStatus(a.status),
          beneficiaries: a.beneficiaries || undefined,
          notes: a.notes || undefined,
          source: 'ai',
        });
      }

      // Audit (single summary entry) — best-effort, never block UX
      try {
        await Api.post(`/initiatives/${initiativeId}/resources/ai-apply-log`, {
          scope: aiProposal.scope,
          budgetAdded: budgetToAdd.length,
          fteAdded: fteToAdd.length,
          toolsAdded: toolsToAdd.length,
          intangiblesAdded: intangibleToAdd.length,
          note: aiProposal.note || null,
        });
      } catch {
        // ignore
      }

      closeAIModal();
    } finally {
      setAiBusy(false);
    }
  }, [
    aiBusy,
    aiProposal,
    closeAIModal,
    handleAddBudgetItem,
    handleAddIntangibleAsset,
    handleAddResource,
    handleAddTool,
    normalizeBudgetCategory,
    normalizeCurrency,
    normalizeFteRole,
    normalizeIntangibleStatus,
    normalizeIntangibleType,
    normalizeLicenseType,
    normalizeToolCategory,
    normalizeToolStatus,
    initiativeId,
    selectedBudgetIdx,
    selectedFteIdx,
    selectedIntangibleIdx,
    selectedToolsIdx,
  ]);

  const hasAnyAdd = useMemo(() => {
    if (!aiProposal) return false;
    return (
      aiProposal.budgetAdd.length > 0 ||
      aiProposal.fteAdd.length > 0 ||
      aiProposal.toolsAdd.length > 0 ||
      aiProposal.intangibleAdd.length > 0
    );
  }, [aiProposal]);

  const proposalQuality = useMemo(() => {
    if (!aiProposal) {
      return { confirmPlaceholders: 0, zeroAmounts: 0, missingVendors: 0, missingProviders: 0 };
    }

    const includesConfirm = (s: unknown) =>
      String(s || '')
        .toLowerCase()
        .includes('[confirm]');

    let confirmPlaceholders = 0;
    let zeroAmounts = 0;
    let missingVendors = 0;
    let missingProviders = 0;

    for (const b of aiProposal.budgetAdd) {
      if (Number(b.amount) === 0) zeroAmounts++;
      if (includesConfirm(b.description)) confirmPlaceholders++;
    }
    for (const t of aiProposal.toolsAdd) {
      if (!String(t.vendor || '').trim()) missingVendors++;
      if (Number(t.licenseCost) === 0) zeroAmounts++;
      if (includesConfirm(t.notes)) confirmPlaceholders++;
    }
    for (const a of aiProposal.intangibleAdd) {
      if (!String(a.provider || '').trim()) missingProviders++;
      if (Number(a.cost) === 0) zeroAmounts++;
      if (includesConfirm(a.notes)) confirmPlaceholders++;
    }

    return { confirmPlaceholders, zeroAmounts, missingVendors, missingProviders };
  }, [aiProposal]);

  useEffect(() => {
    if (!resourcesAiRequest) return;
    const run = async () => {
      try {
        await proposeAllTables();
      } finally {
        // Keep CTA-bar spinner visible until AI finishes.
        clearResourcesAiRequest?.();
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourcesAiRequest?.nonce]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* AI Proposal Modal (shared across all tables + CTA) */}
      {showAIModal && aiProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-4xl rounded-2xl border border-c-border dark:border-navy-700/60 bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
              <div>
                <h3 className="text-sm font-semibold text-c-text dark:text-white">
                  {t('initiatives.resourcesSection.proposedResourcesAi')}
                </h3>
                <p className="text-[11px] text-c-text-muted mt-0.5">
                  {t('initiatives.resourcesSection.selectItemsToAdd')}
                </p>
                {aiProposal.note ? (
                  <p className="text-[11px] text-c-text-muted mt-1">{aiProposal.note}</p>
                ) : null}
                {(proposalQuality.confirmPlaceholders > 0 ||
                  proposalQuality.zeroAmounts > 0 ||
                  proposalQuality.missingVendors > 0 ||
                  proposalQuality.missingProviders > 0) && (
                  <div className="mt-2 rounded-xl border border-amber-200/60 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/10 px-3 py-2">
                    <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                      {t('initiatives.resourcesSection.qualityChecks')}
                    </div>
                    <div className="mt-0.5 text-[11px] text-amber-700/90 dark:text-amber-200/80 space-y-0.5">
                      {proposalQuality.zeroAmounts > 0 ? (
                        <div>
                          {t('initiatives.resourcesSection.qualityZeroCost', {
                            count: proposalQuality.zeroAmounts,
                          })}
                        </div>
                      ) : null}
                      {proposalQuality.confirmPlaceholders > 0 ? (
                        <div>
                          {t('initiatives.resourcesSection.qualityConfirmPlaceholders', {
                            count: proposalQuality.confirmPlaceholders,
                          })}
                        </div>
                      ) : null}
                      {proposalQuality.missingVendors > 0 ? (
                        <div>
                          {t('initiatives.resourcesSection.qualityMissingVendors', {
                            count: proposalQuality.missingVendors,
                          })}
                        </div>
                      ) : null}
                      {proposalQuality.missingProviders > 0 ? (
                        <div>
                          {t('initiatives.resourcesSection.qualityMissingProviders', {
                            count: proposalQuality.missingProviders,
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={closeAIModal}
                className="p-2 rounded-lg text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                title={t('initiatives.resourcesSection.close')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
              {aiProposal.budgetAdd.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-c-text">
                      {t('initiatives.resourcesSection.budgetToAdd')} ({aiProposal.budgetAdd.length}
                      )
                    </span>
                    <button
                      onClick={() =>
                        setSelectedBudgetIdx(
                          Object.fromEntries(aiProposal.budgetAdd.map((_, idx) => [idx, true]))
                        )
                      }
                      className="text-[11px] text-c-text-muted hover:text-c-text-secondary"
                    >
                      {t('initiatives.resourcesSection.selectAll')}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {aiProposal.budgetAdd.map((b, idx) => (
                      <label
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded-xl border border-slate-200/60 dark:border-navy-700/50 bg-slate-50/40 dark:bg-navy-800/20 hover:bg-slate-50/70 dark:hover:bg-navy-800/30 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedBudgetIdx[idx]}
                          onChange={(e) =>
                            setSelectedBudgetIdx((p) => ({ ...p, [idx]: e.target.checked }))
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-c-text dark:text-white">
                              {String(b.costType || '').toUpperCase()} · {b.category}
                            </span>
                            <span className="text-[11px] text-c-text-muted">
                              {fmtCurrency(Number(b.amount) || 0, b.currency || 'PLN', isPolish)}
                            </span>
                          </div>
                          {b.description ? (
                            <p className="text-xs text-c-text-secondary mt-0.5 whitespace-pre-wrap">
                              {b.description}
                            </p>
                          ) : null}
                          {b.rationale ? (
                            <p className="text-[11px] text-c-text-muted mt-1">{b.rationale}</p>
                          ) : null}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {aiProposal.fteAdd.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-c-text">
                      {t('initiatives.resourcesSection.fteToAdd')} ({aiProposal.fteAdd.length})
                    </span>
                    <button
                      onClick={() =>
                        setSelectedFteIdx(
                          Object.fromEntries(aiProposal.fteAdd.map((_, idx) => [idx, true]))
                        )
                      }
                      className="text-[11px] text-c-text-muted hover:text-c-text-secondary"
                    >
                      {t('initiatives.resourcesSection.selectAll')}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {aiProposal.fteAdd.map((r, idx) => (
                      <label
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded-xl border border-slate-200/60 dark:border-navy-700/50 bg-slate-50/40 dark:bg-navy-800/20 hover:bg-slate-50/70 dark:hover:bg-navy-800/30 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedFteIdx[idx]}
                          onChange={(e) =>
                            setSelectedFteIdx((p) => ({ ...p, [idx]: e.target.checked }))
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-c-text dark:text-white">
                              {r.name}
                            </span>
                            <span className="text-[11px] text-c-text-muted">
                              {r.role} · {r.allocationPercentage}%
                            </span>
                          </div>
                          {r.notes ? (
                            <p className="text-xs text-c-text-secondary mt-0.5 whitespace-pre-wrap">
                              {r.notes}
                            </p>
                          ) : null}
                          {r.rationale ? (
                            <p className="text-[11px] text-c-text-muted mt-1">{r.rationale}</p>
                          ) : null}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {aiProposal.toolsAdd.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-c-text">
                      {t('initiatives.resourcesSection.toolsToAdd')} ({aiProposal.toolsAdd.length})
                    </span>
                    <button
                      onClick={() =>
                        setSelectedToolsIdx(
                          Object.fromEntries(aiProposal.toolsAdd.map((_, idx) => [idx, true]))
                        )
                      }
                      className="text-[11px] text-c-text-muted hover:text-c-text-secondary"
                    >
                      {t('initiatives.resourcesSection.selectAll')}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {aiProposal.toolsAdd.map((tool, idx) => (
                      <label
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded-xl border border-slate-200/60 dark:border-navy-700/50 bg-slate-50/40 dark:bg-navy-800/20 hover:bg-slate-50/70 dark:hover:bg-navy-800/30 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedToolsIdx[idx]}
                          onChange={(e) =>
                            setSelectedToolsIdx((p) => ({ ...p, [idx]: e.target.checked }))
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-c-text dark:text-white">
                              {tool.name}
                            </span>
                            <span className="text-[11px] text-c-text-muted">
                              {tool.category} · {tool.status}
                            </span>
                          </div>
                          {tool.vendor ? (
                            <p className="text-[11px] text-c-text-muted mt-0.5">
                              {t('initiatives.resourcesSection.vendor')}: {tool.vendor}
                            </p>
                          ) : null}
                          {tool.notes ? (
                            <p className="text-xs text-c-text-secondary mt-0.5 whitespace-pre-wrap">
                              {tool.notes}
                            </p>
                          ) : null}
                          {tool.rationale ? (
                            <p className="text-[11px] text-c-text-muted mt-1">{tool.rationale}</p>
                          ) : null}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {aiProposal.intangibleAdd.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-c-text">
                      {t('initiatives.resourcesSection.intangiblesToAdd')} (
                      {aiProposal.intangibleAdd.length})
                    </span>
                    <button
                      onClick={() =>
                        setSelectedIntangibleIdx(
                          Object.fromEntries(aiProposal.intangibleAdd.map((_, idx) => [idx, true]))
                        )
                      }
                      className="text-[11px] text-c-text-muted hover:text-c-text-secondary"
                    >
                      {t('initiatives.resourcesSection.selectAll')}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {aiProposal.intangibleAdd.map((a, idx) => (
                      <label
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded-xl border border-slate-200/60 dark:border-navy-700/50 bg-slate-50/40 dark:bg-navy-800/20 hover:bg-slate-50/70 dark:hover:bg-navy-800/30 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedIntangibleIdx[idx]}
                          onChange={(e) =>
                            setSelectedIntangibleIdx((p) => ({ ...p, [idx]: e.target.checked }))
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-c-text dark:text-white">
                              {a.name}
                            </span>
                            <span className="text-[11px] text-c-text-muted">
                              {a.assetType} · {a.status}
                            </span>
                          </div>
                          {a.provider ? (
                            <p className="text-[11px] text-c-text-muted mt-0.5">
                              {t('initiatives.resourcesSection.provider')}: {a.provider}
                            </p>
                          ) : null}
                          {a.notes ? (
                            <p className="text-xs text-c-text-secondary mt-0.5 whitespace-pre-wrap">
                              {a.notes}
                            </p>
                          ) : null}
                          {a.rationale ? (
                            <p className="text-[11px] text-c-text-muted mt-1">{a.rationale}</p>
                          ) : null}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center justify-end gap-2">
              <button
                onClick={closeAIModal}
                disabled={aiBusy}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-c-border text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-50"
              >
                {t('initiatives.resourcesSection.cancel')}
              </button>
              <button
                onClick={() => void applyProposal()}
                disabled={aiBusy || !hasAnyAdd}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised transition-colors disabled:opacity-50"
              >
                {aiBusy ? <Loader2 size={13} className="animate-spin" /> : null}
                {t('initiatives.resourcesSection.apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. BUDGET */}
      <BudgetTable
        isPolish={isPolish}
        items={budgetItems}
        aiBusy={aiBusy}
        onAiAddOne={() => void proposeForTable('budget', 'addOne')}
        onAiAnalyze={() => void proposeForTable('budget', 'analyze')}
        onAdd={handleAddBudgetItem}
        onUpdate={handleUpdateBudgetItem}
        onDelete={handleDeleteBudgetItem}
      />

      {/* 2. TEAM / FTE */}
      <TeamTable
        isPolish={isPolish}
        items={resourceItems}
        aiBusy={aiBusy}
        onAiAddOne={() => void proposeForTable('fte', 'addOne')}
        onAiAnalyze={() => void proposeForTable('fte', 'analyze')}
        onAdd={handleAddResource}
        onUpdate={handleUpdateResource}
        onDelete={handleDeleteResource}
      />

      {/* 3. TOOLS */}
      <ToolsTable
        isPolish={isPolish}
        items={toolItems}
        aiBusy={aiBusy}
        onAiAddOne={() => void proposeForTable('tools', 'addOne')}
        onAiAnalyze={() => void proposeForTable('tools', 'analyze')}
        onAdd={handleAddTool}
        onUpdate={handleUpdateTool}
        onDelete={handleDeleteTool}
      />

      {/* 4. INTANGIBLE ASSETS */}
      <IntangibleAssetsTable
        isPolish={isPolish}
        items={intangibleAssets}
        aiBusy={aiBusy}
        onAiAddOne={() => void proposeForTable('intangibles', 'addOne')}
        onAiAnalyze={() => void proposeForTable('intangibles', 'analyze')}
        onAdd={handleAddIntangibleAsset}
        onUpdate={handleUpdateIntangibleAsset}
        onDelete={handleDeleteIntangibleAsset}
      />
    </motion.div>
  );
};

// ==========================================
// TABLE 1: BUDGET
// ==========================================

interface BudgetTableProps {
  isPolish: boolean;
  items: BudgetItem[];
  aiBusy: boolean;
  onAiAddOne: () => void;
  onAiAnalyze: () => void;
  onAdd: (data: Omit<BudgetItem, 'id'>) => Promise<void>;
  onUpdate: (id: string, data: Partial<BudgetItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const BudgetTable: React.FC<BudgetTableProps> = ({
  isPolish,
  items,
  aiBusy,
  onAiAddOne,
  onAiAnalyze,
  onAdd,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('other');
  const [newCostType, setNewCostType] = useState<'CAPEX' | 'OPEX'>('OPEX');
  const [newAmount, setNewAmount] = useState('');
  const [newCurrency, setNewCurrency] = useState('PLN');
  const [newDesc, setNewDesc] = useState('');

  const totalBudget = items.reduce((acc, b) => acc + (b.amount || 0), 0);
  const totalCapex = items
    .filter((b) => b.costType === 'CAPEX')
    .reduce((acc, b) => acc + (b.amount || 0), 0);
  const totalOpex = items
    .filter((b) => b.costType === 'OPEX')
    .reduce((acc, b) => acc + (b.amount || 0), 0);
  const cur = items[0]?.currency || 'PLN';

  const handleSubmit = useCallback(async () => {
    if (!newAmount) return;
    await onAdd({
      category: newCategory,
      costType: newCostType,
      amount: parseFloat(newAmount) || 0,
      currency: newCurrency,
      description: newDesc || undefined,
    });
    setNewCategory('other');
    setNewCostType('OPEX');
    setNewAmount('');
    setNewDesc('');
    setShowAdd(false);
  }, [newCategory, newCostType, newAmount, newCurrency, newDesc, onAdd]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <DollarSign size={16} className="text-emerald-500" />
          <h3 className="text-sm font-semibold text-c-text dark:text-white">
            {t('initiatives.resourcesSection.budget')}
          </h3>
          {items.length > 0 && (
            <span className="text-[10px] font-medium text-c-text-muted bg-c-surface-raised px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
          {items.length > 0 && (
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {fmtCurrency(totalBudget, cur, isPolish)}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-c-text-muted hover:text-c-text transition-colors"
        >
          <Plus size={12} />
          {t('initiatives.resourcesSection.addItem')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-c-border dark:border-navy-700/40">
        <table
          /* §27-exempt: sub-tabela w widoku szczegolow, nie samodzielna lista */ className="w-full text-sm table-fixed"
        >
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '27%' }} />
            <col style={{ width: '4%' }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="text-[10px] uppercase tracking-wider font-semibold text-c-text-muted bg-c-bg border-b border-c-border dark:border-navy-700/40">
              <th className="text-right py-2.5 pl-3 pr-2">#</th>
              <th className="text-left py-2.5 pl-3 pr-2">
                {t('initiatives.resourcesSection.category')}
              </th>
              <th className="text-left py-2.5 pr-2">{t('initiatives.resourcesSection.type')}</th>
              <th className="text-right py-2.5 pr-2">{t('initiatives.resourcesSection.amount')}</th>
              <th className="text-left py-2.5 pr-2">
                {t('initiatives.resourcesSection.currency')}
              </th>
              <th className="text-left py-2.5 pr-2">
                {t('initiatives.resourcesSection.description')}
              </th>
              <th className="py-2.5 pr-3 text-right">
                <TableAIMenu
                  isPolish={isPolish}
                  isOpen={aiMenuOpen}
                  onToggle={() => setAiMenuOpen((v) => !v)}
                  onClose={() => setAiMenuOpen(false)}
                  busy={aiBusy}
                  actions={[
                    {
                      id: 'addOne',
                      label: { en: 'Add by AI', pl: 'Dodaj przez AI' },
                      onClick: onAiAddOne,
                    },
                    {
                      id: 'analyze',
                      label: { en: 'Analyze with AI', pl: 'Analizuj z AI' },
                      onClick: onAiAnalyze,
                    },
                  ]}
                />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
            <AnimatePresence mode="popLayout">
              {items.map((item, idx) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group hover:bg-slate-50/50 dark:hover:bg-navy-800/20 transition-colors"
                >
                  <td className="py-2.5 pl-3 pr-2 text-xs text-right text-c-text-muted">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 pl-3 pr-2 text-c-text truncate">
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase size={12} className="text-c-text-secondary flex-shrink-0" />
                      {BUDGET_CATEGORIES.find((c) => c.value === item.category)?.[
                        isPolish ? 'labelPl' : 'labelEn'
                      ] || item.category}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${item.costType === 'CAPEX' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}
                    >
                      {item.costType}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 text-right text-xs font-medium text-c-text">
                    {fmtCurrency(item.amount, item.currency, isPolish)}
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-c-text-muted">
                    {item.currency || 'PLN'}
                  </td>
                  <td
                    className="py-2.5 pr-2 text-xs text-c-text-muted truncate"
                    title={item.description || ''}
                  >
                    {item.description || '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-right relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId((p) => (p === item.id ? null : item.id));
                      }}
                      className="p-1 rounded-md text-c-text-secondary hover:text-c-text transition-colors"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {menuId === item.id && (
                      <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700/70 bg-c-surface p-1.5 shadow-xl">
                        <button
                          onClick={() => {
                            setMenuId(null);
                            void onDelete(item.id);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10"
                        >
                          <Trash2 size={13} />
                          {t('initiatives.resourcesSection.delete')}
                        </button>
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {showAdd && (
              <motion.tr
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50/30 dark:bg-emerald-500/5"
              >
                <td className="py-2 pl-3 pr-2 text-xs text-right text-c-text-secondary">
                  {items.length + 1}
                </td>
                <td className="py-2 pl-3 pr-2">
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className={INLINE_SELECT_CLS}
                    autoFocus
                  >
                    {BUDGET_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {isPolish ? c.labelPl : c.labelEn}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={newCostType}
                    onChange={(e) => setNewCostType(e.target.value as 'CAPEX' | 'OPEX')}
                    className={INLINE_SELECT_CLS}
                  >
                    <option value="CAPEX">CAPEX</option>
                    <option value="OPEX">OPEX</option>
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSubmit();
                      if (e.key === 'Escape') setShowAdd(false);
                    }}
                    placeholder={t('initiatives.resourcesSection.amount')}
                    className={INLINE_INPUT_CLS + ' text-right'}
                  />
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className={INLINE_SELECT_CLS}
                  >
                    <option value="PLN">PLN</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSubmit();
                      if (e.key === 'Escape') setShowAdd(false);
                    }}
                    placeholder={t('initiatives.resourcesSection.description')}
                    className={INLINE_INPUT_CLS}
                  />
                </td>
                <td className="py-2 pr-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={handleSubmit}
                      disabled={!newAmount}
                      className="p-1 rounded-md text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-30 transition-colors"
                      title={t('initiatives.resourcesSection.save')}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setShowAdd(false)}
                      className="p-1 rounded-md text-c-text-secondary hover:bg-slate-500/10 transition-colors"
                      title={t('initiatives.resourcesSection.cancel')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            )}
            {items.length === 0 && !showAdd && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-c-text-secondary">
                  {t('initiatives.resourcesSection.noBudgetItems')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && (
        <div className="mt-2 flex items-center justify-end gap-4 text-xs text-c-text-muted">
          <span>
            CAPEX:{' '}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {fmtCurrency(totalCapex, cur, isPolish)}
            </span>
          </span>
          <span>
            OPEX:{' '}
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {fmtCurrency(totalOpex, cur, isPolish)}
            </span>
          </span>
          <span>
            {t('initiatives.resourcesSection.total')}:{' '}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {fmtCurrency(totalBudget, cur, isPolish)}
            </span>
          </span>
        </div>
      )}
    </div>
  );
};

// ==========================================
// TABLE 2: TEAM / FTE ALLOCATION
// ==========================================

interface TeamTableProps {
  isPolish: boolean;
  items: ResourceItem[];
  aiBusy: boolean;
  onAiAddOne: () => void;
  onAiAnalyze: () => void;
  onAdd: (data: Omit<ResourceItem, 'id'>) => Promise<void>;
  onUpdate: (id: string, data: Partial<ResourceItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const TeamTable: React.FC<TeamTableProps> = ({
  isPolish,
  items,
  aiBusy,
  onAiAddOne,
  onAiAnalyze,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [newAlloc, setNewAlloc] = useState('100');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // INI-05: `onUpdate` was declared in this table's props and passed by the
  // parent (ResourcesSection -> handleUpdateResource, the CAS/version-aware
  // handler this packet hardened) but never read here — editing an existing
  // resource had no UI path at all, only add + delete. Mirrors the existing
  // "add row" inline-edit pattern below.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('member');
  const [editAlloc, setEditAlloc] = useState('100');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const totalFTE = items.reduce((acc, r) => acc + (r.allocationPercentage || 0), 0) / 100;

  const handleSubmit = useCallback(async () => {
    if (!newName.trim()) return;
    await onAdd({
      name: newName.trim(),
      role: newRole,
      allocationPercentage: parseInt(newAlloc) || 100,
      startDate: newStart || undefined,
      endDate: newEnd || undefined,
      notes: newNotes || undefined,
    });
    setNewName('');
    setNewRole('member');
    setNewAlloc('100');
    setNewStart('');
    setNewEnd('');
    setNewNotes('');
    setShowAdd(false);
  }, [newName, newRole, newAlloc, newStart, newEnd, newNotes, onAdd]);

  const handleStartEdit = useCallback((item: ResourceItem) => {
    setEditingId(item.id);
    setEditName(item.name || '');
    setEditRole(item.role || 'member');
    setEditAlloc(String(item.allocationPercentage ?? 100));
    setEditStart(item.startDate || '');
    setEditEnd(item.endDate || '');
    setEditNotes(item.notes || '');
  }, []);

  const handleCancelEdit = useCallback(() => setEditingId(null), []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editName.trim()) return;
    setIsSavingEdit(true);
    try {
      await onUpdate(editingId, {
        name: editName.trim(),
        role: editRole,
        allocationPercentage: parseInt(editAlloc) || 100,
        startDate: editStart || undefined,
        endDate: editEnd || undefined,
        notes: editNotes || undefined,
      });
      setEditingId(null);
    } finally {
      setIsSavingEdit(false);
    }
  }, [editingId, editName, editRole, editAlloc, editStart, editEnd, editNotes, onUpdate]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <Users size={16} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-c-text dark:text-white">
            {t('initiatives.resourcesSection.teamFteAllocation')}
          </h3>
          {items.length > 0 && (
            <span className="text-[10px] font-medium text-c-text-muted bg-c-surface-raised px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
          {items.length > 0 && (
            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full">
              {totalFTE.toFixed(1)} FTE
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-c-text-muted hover:text-c-text transition-colors"
        >
          <Plus size={12} />
          {t('initiatives.resourcesSection.addItem')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-c-border dark:border-navy-700/40">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '4%' }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="text-[10px] uppercase tracking-wider font-semibold text-c-text-muted bg-c-bg border-b border-c-border dark:border-navy-700/40">
              <th className="text-right py-2.5 pl-3 pr-2">#</th>
              <th className="text-left py-2.5 pl-3 pr-2">
                {t('initiatives.resourcesSection.name')}
              </th>
              <th className="text-left py-2.5 pr-2">{t('initiatives.resourcesSection.role')}</th>
              <th className="text-left py-2.5 pr-2">
                {t('initiatives.resourcesSection.allocation')}
              </th>
              <th className="text-left py-2.5 pr-2">Start</th>
              <th className="text-left py-2.5 pr-2">{t('initiatives.resourcesSection.end')}</th>
              <th className="text-left py-2.5 pr-2">{t('initiatives.resourcesSection.notes')}</th>
              <th className="py-2.5 pr-3 text-right">
                <TableAIMenu
                  isPolish={isPolish}
                  isOpen={aiMenuOpen}
                  onToggle={() => setAiMenuOpen((v) => !v)}
                  onClose={() => setAiMenuOpen(false)}
                  busy={aiBusy}
                  actions={[
                    {
                      id: 'addOne',
                      label: { en: 'Add by AI', pl: 'Dodaj przez AI' },
                      onClick: onAiAddOne,
                    },
                    {
                      id: 'analyze',
                      label: { en: 'Analyze with AI', pl: 'Analizuj z AI' },
                      onClick: onAiAnalyze,
                    },
                  ]}
                />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
            <AnimatePresence mode="popLayout">
              {items.map((item, idx) =>
                editingId === item.id ? (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-blue-50/30 dark:bg-blue-500/5"
                  >
                    <td className="py-2 pl-3 pr-2 text-xs text-right text-c-text-secondary">
                      {idx + 1}
                    </td>
                    <td className="py-2 pl-3 pr-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className={INLINE_INPUT_CLS}
                        autoFocus
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className={INLINE_SELECT_CLS}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {isPolish ? r.labelPl : r.labelEn}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        value={editAlloc}
                        onChange={(e) => setEditAlloc(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        min="0"
                        max="100"
                        className={INLINE_INPUT_CLS + ' text-center'}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="date"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className={INLINE_INPUT_CLS}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="date"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className={INLINE_INPUT_CLS}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className={INLINE_INPUT_CLS}
                      />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={handleSaveEdit}
                          disabled={!editName.trim() || isSavingEdit}
                          className="p-1 rounded-md text-blue-500 hover:bg-blue-500/10 disabled:opacity-30 transition-colors"
                          title={t('initiatives.resourcesSection.save')}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={isSavingEdit}
                          className="p-1 rounded-md text-c-text-secondary hover:bg-slate-500/10 transition-colors"
                          title={t('initiatives.resourcesSection.cancel')}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ) : (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group hover:bg-slate-50/50 dark:hover:bg-navy-800/20 transition-colors"
                  >
                    <td className="py-2.5 pl-3 pr-2 text-xs text-right text-c-text-muted">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 pl-3 pr-2 text-c-text truncate">
                      {item.name ||
                        (item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : '—')}
                    </td>
                    <td className="py-2.5 pr-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300">
                        {ROLE_OPTIONS.find((r) => r.value === item.role)?.[
                          isPolish ? 'labelPl' : 'labelEn'
                        ] ||
                          item.role ||
                          '—'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-c-surface-raised text-c-text-secondary font-medium">
                        {item.allocationPercentage || 0}%
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-xs text-c-text-muted">
                      {item.startDate ? new Date(item.startDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2.5 pr-2 text-xs text-c-text-muted">
                      {item.endDate ? new Date(item.endDate).toLocaleDateString() : '—'}
                    </td>
                    <td
                      className="py-2.5 pr-2 text-xs text-c-text-muted truncate"
                      title={item.notes || ''}
                    >
                      {item.notes || '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-right relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuId((p) => (p === item.id ? null : item.id));
                        }}
                        className="p-1 rounded-md text-c-text-secondary hover:text-c-text transition-colors"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {menuId === item.id && (
                        <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700/70 bg-c-surface p-1.5 shadow-xl">
                          <button
                            onClick={() => {
                              setMenuId(null);
                              handleStartEdit(item);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-c-text hover:bg-c-surface-raised"
                          >
                            <Pencil size={13} />
                            {t('initiatives.resourcesSection.edit', 'Edit')}
                          </button>
                          <button
                            onClick={() => {
                              setMenuId(null);
                              void onDelete(item.id);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10"
                          >
                            <Trash2 size={13} />
                            {t('initiatives.resourcesSection.delete')}
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                )
              )}
            </AnimatePresence>
            {showAdd && (
              <motion.tr
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-blue-50/30 dark:bg-blue-500/5"
              >
                <td className="py-2 pl-3 pr-2 text-xs text-right text-c-text-secondary">
                  {items.length + 1}
                </td>
                <td className="py-2 pl-3 pr-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSubmit();
                      if (e.key === 'Escape') setShowAdd(false);
                    }}
                    placeholder={t('initiatives.resourcesSection.namePosition')}
                    className={INLINE_INPUT_CLS}
                    autoFocus
                  />
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className={INLINE_SELECT_CLS}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {isPolish ? r.labelPl : r.labelEn}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    value={newAlloc}
                    onChange={(e) => setNewAlloc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSubmit();
                      if (e.key === 'Escape') setShowAdd(false);
                    }}
                    placeholder="%"
                    min="0"
                    max="100"
                    className={INLINE_INPUT_CLS + ' text-center'}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="date"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className={INLINE_INPUT_CLS}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="date"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className={INLINE_INPUT_CLS}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSubmit();
                      if (e.key === 'Escape') setShowAdd(false);
                    }}
                    placeholder={t('initiatives.resourcesSection.notes')}
                    className={INLINE_INPUT_CLS}
                  />
                </td>
                <td className="py-2 pr-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={handleSubmit}
                      disabled={!newName.trim()}
                      className="p-1 rounded-md text-blue-500 hover:bg-blue-500/10 disabled:opacity-30 transition-colors"
                      title={t('initiatives.resourcesSection.save')}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setShowAdd(false)}
                      className="p-1 rounded-md text-c-text-secondary hover:bg-slate-500/10 transition-colors"
                      title={t('initiatives.resourcesSection.cancel')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            )}
            {items.length === 0 && !showAdd && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-c-text-secondary">
                  {t('initiatives.resourcesSection.noTeamMembers')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && (
        <div className="mt-2 flex items-center justify-end text-xs text-c-text-muted">
          {t('initiatives.resourcesSection.totalFte')}:{' '}
          <span className="ml-1 font-semibold text-blue-600 dark:text-blue-400">
            {totalFTE.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
};

// ==========================================
// TABLE 3: TOOLS & INFRASTRUCTURE
// ==========================================

interface ToolsTableProps {
  isPolish: boolean;
  items: ToolItem[];
  aiBusy: boolean;
  onAiAddOne: () => void;
  onAiAnalyze: () => void;
  onAdd: (data: Omit<ToolItem, 'id'>) => Promise<void>;
  onUpdate: (id: string, data: Partial<ToolItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const ToolsTable: React.FC<ToolsTableProps> = ({
  isPolish,
  items,
  aiBusy,
  onAiAddOne,
  onAiAnalyze,
  onAdd,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('software');
  const [newVendor, setNewVendor] = useState('');
  const [newLicenseCost, setNewLicenseCost] = useState('');
  const [newLicenseType, setNewLicenseType] = useState('subscription');
  const [newStatus, setNewStatus] = useState('planned');
  const [newNotes, setNewNotes] = useState('');

  const totalCost = items.reduce((acc, t) => acc + (t.licenseCost || 0), 0);

  const handleSubmit = useCallback(async () => {
    if (!newName.trim()) return;
    await onAdd({
      name: newName.trim(),
      category: newCategory,
      vendor: newVendor || undefined,
      licenseCost: parseFloat(newLicenseCost) || 0,
      licenseType: newLicenseType,
      status: newStatus,
      notes: newNotes || undefined,
    });
    setNewName('');
    setNewCategory('software');
    setNewVendor('');
    setNewLicenseCost('');
    setNewLicenseType('subscription');
    setNewStatus('planned');
    setNewNotes('');
    setShowAdd(false);
  }, [newName, newCategory, newVendor, newLicenseCost, newLicenseType, newStatus, newNotes, onAdd]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <Wrench size={16} className="text-indigo-500" />
          <h3 className="text-sm font-semibold text-c-text dark:text-white">
            {t('initiatives.resourcesSection.toolsInfrastructure')}
          </h3>
          {items.length > 0 && (
            <span className="text-[10px] font-medium text-c-text-muted bg-c-surface-raised px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-c-text-muted hover:text-c-text transition-colors"
        >
          <Plus size={12} />
          {t('initiatives.resourcesSection.addItem')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-c-border dark:border-navy-700/40">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '4%' }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="text-[10px] uppercase tracking-wider font-semibold text-c-text-muted bg-c-bg border-b border-c-border dark:border-navy-700/40">
              <th className="text-right py-2.5 pl-3 pr-2">#</th>
              <th className="text-left py-2.5 pl-3 pr-2">
                {t('initiatives.resourcesSection.name')}
              </th>
              <th className="text-left py-2.5 pr-2">
                {t('initiatives.resourcesSection.category')}
              </th>
              <th className="text-left py-2.5 pr-2">{t('initiatives.resourcesSection.vendor')}</th>
              <th className="text-right py-2.5 pr-2">{t('initiatives.resourcesSection.cost')}</th>
              <th className="text-left py-2.5 pr-2">{t('initiatives.resourcesSection.license')}</th>
              <th className="text-left py-2.5 pr-2">Status</th>
              <th className="py-2.5 pr-3 text-right">
                <TableAIMenu
                  isPolish={isPolish}
                  isOpen={aiMenuOpen}
                  onToggle={() => setAiMenuOpen((v) => !v)}
                  onClose={() => setAiMenuOpen(false)}
                  busy={aiBusy}
                  actions={[
                    {
                      id: 'addOne',
                      label: { en: 'Add by AI', pl: 'Dodaj przez AI' },
                      onClick: onAiAddOne,
                    },
                    {
                      id: 'analyze',
                      label: { en: 'Analyze with AI', pl: 'Analizuj z AI' },
                      onClick: onAiAnalyze,
                    },
                  ]}
                />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
            <AnimatePresence mode="popLayout">
              {items.map((item, idx) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group hover:bg-slate-50/50 dark:hover:bg-navy-800/20 transition-colors"
                >
                  <td className="py-2.5 pl-3 pr-2 text-xs text-right text-c-text-muted">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 pl-3 pr-2 text-c-text truncate">{item.name || '—'}</td>
                  <td className="py-2.5 pr-2 text-xs text-c-text-muted">
                    {TOOL_CATEGORIES.find((c) => c.value === item.category)?.[
                      isPolish ? 'labelPl' : 'labelEn'
                    ] || item.category}
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-c-text-muted truncate">
                    {item.vendor || '—'}
                  </td>
                  <td className="py-2.5 pr-2 text-right text-xs font-medium text-c-text">
                    {item.licenseCost ? fmtCurrency(item.licenseCost, 'PLN', isPolish) : '—'}
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-c-text-muted">
                    {LICENSE_TYPE_OPTIONS.find((l) => l.value === item.licenseType)?.[
                      isPolish ? 'labelPl' : 'labelEn'
                    ] ||
                      item.licenseType ||
                      '—'}
                  </td>
                  <td className="py-2.5 pr-2">
                    <span className={STATUS_BADGE_SHELL}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(item.status)}`} />
                      {TOOL_STATUS_OPTIONS.find((s) => s.value === item.status)?.[
                        isPolish ? 'labelPl' : 'labelEn'
                      ] || item.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId((p) => (p === item.id ? null : item.id));
                      }}
                      className="p-1 rounded-md text-c-text-secondary hover:text-c-text transition-colors"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {menuId === item.id && (
                      <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700/70 bg-c-surface p-1.5 shadow-xl">
                        <button
                          onClick={() => {
                            setMenuId(null);
                            void onDelete(item.id);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10"
                        >
                          <Trash2 size={13} />
                          {t('initiatives.resourcesSection.delete')}
                        </button>
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {showAdd && (
              <motion.tr
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-indigo-50/30 dark:bg-indigo-500/5"
              >
                <td className="py-2 pl-3 pr-2 text-xs text-right text-c-text-secondary">
                  {items.length + 1}
                </td>
                <td className="py-2 pl-3 pr-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSubmit();
                      if (e.key === 'Escape') setShowAdd(false);
                    }}
                    placeholder={t('initiatives.resourcesSection.name')}
                    className={INLINE_INPUT_CLS}
                    autoFocus
                  />
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className={INLINE_SELECT_CLS}
                  >
                    {TOOL_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {isPolish ? c.labelPl : c.labelEn}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input
                    value={newVendor}
                    onChange={(e) => setNewVendor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSubmit();
                      if (e.key === 'Escape') setShowAdd(false);
                    }}
                    placeholder={t('initiatives.resourcesSection.vendor')}
                    className={INLINE_INPUT_CLS}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    value={newLicenseCost}
                    onChange={(e) => setNewLicenseCost(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSubmit();
                      if (e.key === 'Escape') setShowAdd(false);
                    }}
                    placeholder={t('initiatives.resourcesSection.cost')}
                    className={INLINE_INPUT_CLS + ' text-right'}
                  />
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={newLicenseType}
                    onChange={(e) => setNewLicenseType(e.target.value)}
                    className={INLINE_SELECT_CLS}
                  >
                    {LICENSE_TYPE_OPTIONS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {isPolish ? l.labelPl : l.labelEn}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className={INLINE_SELECT_CLS}
                  >
                    {TOOL_STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {isPolish ? s.labelPl : s.labelEn}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={handleSubmit}
                      disabled={!newName.trim()}
                      className="p-1 rounded-md text-indigo-500 hover:bg-indigo-500/10 disabled:opacity-30 transition-colors"
                      title={t('initiatives.resourcesSection.save')}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setShowAdd(false)}
                      className="p-1 rounded-md text-c-text-secondary hover:bg-slate-500/10 transition-colors"
                      title={t('initiatives.resourcesSection.cancel')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            )}
            {items.length === 0 && !showAdd && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-c-text-secondary">
                  {t('initiatives.resourcesSection.noTools')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && totalCost > 0 && (
        <div className="mt-2 flex items-center justify-end text-xs text-c-text-muted">
          {t('initiatives.resourcesSection.totalLicenseCost')}:{' '}
          <span className="ml-1 font-semibold text-indigo-600 dark:text-indigo-400">
            {fmtCurrency(totalCost, 'PLN', isPolish)}
          </span>
        </div>
      )}
    </div>
  );
};

// ==========================================
// TABLE 4: LICENSES, TRAINING & INTANGIBLE ASSETS
// ==========================================

interface IntangibleAssetsTableProps {
  isPolish: boolean;
  items: IntangibleAssetItem[];
  aiBusy: boolean;
  onAiAddOne: () => void;
  onAiAnalyze: () => void;
  onAdd: (data: Omit<IntangibleAssetItem, 'id'>) => Promise<void>;
  onUpdate: (id: string, data: Partial<IntangibleAssetItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const IntangibleAssetsTable: React.FC<IntangibleAssetsTableProps> = ({
  isPolish,
  items,
  aiBusy,
  onAiAddOne,
  onAiAnalyze,
  onAdd,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [newType, setNewType] = useState('license');
  const [newName, setNewName] = useState('');
  const [newProvider, setNewProvider] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newCurrency, setNewCurrency] = useState('PLN');
  const [newValidFrom, setNewValidFrom] = useState('');
  const [newValidUntil, setNewValidUntil] = useState('');
  const [newStatus, setNewStatus] = useState('planned');
  const [newBeneficiaries, setNewBeneficiaries] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const totalCost = items.reduce((acc, a) => acc + (a.cost || 0), 0);
  const cur = items[0]?.currency || 'PLN';

  const handleSubmit = useCallback(async () => {
    if (!newName.trim()) return;
    await onAdd({
      assetType: newType,
      name: newName.trim(),
      provider: newProvider || undefined,
      cost: parseFloat(newCost) || 0,
      currency: newCurrency,
      validFrom: newValidFrom || undefined,
      validUntil: newValidUntil || undefined,
      status: newStatus,
      beneficiaries: newBeneficiaries || undefined,
      notes: newNotes || undefined,
    });
    setNewType('license');
    setNewName('');
    setNewProvider('');
    setNewCost('');
    setNewValidFrom('');
    setNewValidUntil('');
    setNewStatus('planned');
    setNewBeneficiaries('');
    setNewNotes('');
    setShowAdd(false);
  }, [
    newType,
    newName,
    newProvider,
    newCost,
    newCurrency,
    newValidFrom,
    newValidUntil,
    newStatus,
    newBeneficiaries,
    newNotes,
    onAdd,
  ]);

  const typeIcon = (assetType: string) => {
    switch (assetType) {
      case 'training':
        return <GraduationCap size={12} className="text-c-info flex-shrink-0" />;
      case 'certification':
        return <BookOpen size={12} className="text-blue-400 flex-shrink-0" />;
      case 'knowledge':
        return <BookOpen size={12} className="text-amber-400 flex-shrink-0" />;
      default:
        return <Briefcase size={12} className="text-c-text-secondary flex-shrink-0" />;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <GraduationCap size={16} className="text-c-info" />
          <h3 className="text-sm font-semibold text-c-text dark:text-white">
            {t('initiatives.resourcesSection.licensesTrainingIntangibles')}
          </h3>
          {items.length > 0 && (
            <span className="text-[10px] font-medium text-c-text-muted bg-c-surface-raised px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
          {items.length > 0 && totalCost > 0 && (
            <span className="text-[10px] font-medium text-c-info bg-c-surface-raised px-2 py-0.5 rounded-full">
              {fmtCurrency(totalCost, cur, isPolish)}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-c-text-muted hover:text-c-text transition-colors"
        >
          <Plus size={12} />
          {t('initiatives.resourcesSection.addItem')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-c-border dark:border-navy-700/40">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: '4%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '4%' }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="text-[10px] uppercase tracking-wider font-semibold text-c-text-muted bg-c-bg border-b border-c-border dark:border-navy-700/40">
              <th className="text-right py-2.5 pl-3 pr-2">#</th>
              <th className="text-left py-2.5 pr-2">{t('initiatives.resourcesSection.type')}</th>
              <th className="text-left py-2.5 pr-2">{t('initiatives.resourcesSection.name')}</th>
              <th className="text-left py-2.5 pr-2">
                {t('initiatives.resourcesSection.provider')}
              </th>
              <th className="text-right py-2.5 pr-2">{t('initiatives.resourcesSection.cost')}</th>
              <th className="text-left py-2.5 pr-2">
                {t('initiatives.resourcesSection.validFrom')}
              </th>
              <th className="text-left py-2.5 pr-2">
                {t('initiatives.resourcesSection.validUntil')}
              </th>
              <th className="text-left py-2.5 pr-2">Status</th>
              <th className="py-2.5 pr-3 text-right">
                <TableAIMenu
                  isPolish={isPolish}
                  isOpen={aiMenuOpen}
                  onToggle={() => setAiMenuOpen((v) => !v)}
                  onClose={() => setAiMenuOpen(false)}
                  busy={aiBusy}
                  actions={[
                    {
                      id: 'addOne',
                      label: { en: 'Add by AI', pl: 'Dodaj przez AI' },
                      onClick: onAiAddOne,
                    },
                    {
                      id: 'analyze',
                      label: { en: 'Analyze with AI', pl: 'Analizuj z AI' },
                      onClick: onAiAnalyze,
                    },
                  ]}
                />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
            <AnimatePresence mode="popLayout">
              {items.map((item, idx) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group hover:bg-slate-50/50 dark:hover:bg-navy-800/20 transition-colors"
                >
                  <td className="py-2.5 pl-3 pr-2 text-xs text-right text-c-text-muted">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 pr-2">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      {typeIcon(item.assetType)}
                      <span className="text-c-text-secondary">
                        {INTANGIBLE_TYPE_OPTIONS.find((t) => t.value === item.assetType)?.[
                          isPolish ? 'labelPl' : 'labelEn'
                        ] || item.assetType}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 text-c-text truncate">{item.name}</td>
                  <td className="py-2.5 pr-2 text-xs text-c-text-muted truncate">
                    {item.provider || '—'}
                  </td>
                  <td className="py-2.5 pr-2 text-right text-xs font-medium text-c-text">
                    {item.cost ? fmtCurrency(item.cost, item.currency, isPolish) : '—'}
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-c-text-muted">
                    {item.validFrom ? new Date(item.validFrom).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-c-text-muted">
                    {item.validUntil ? new Date(item.validUntil).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2.5 pr-2">
                    <span className={STATUS_BADGE_SHELL}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(item.status)}`} />
                      {INTANGIBLE_STATUS_OPTIONS.find((s) => s.value === item.status)?.[
                        isPolish ? 'labelPl' : 'labelEn'
                      ] || item.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId((p) => (p === item.id ? null : item.id));
                      }}
                      className="p-1 rounded-md text-c-text-secondary hover:text-c-text transition-colors"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {menuId === item.id && (
                      <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700/70 bg-c-surface p-1.5 shadow-xl">
                        <button
                          onClick={() => {
                            setMenuId(null);
                            void onDelete(item.id);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10"
                        >
                          <Trash2 size={13} />
                          {t('initiatives.resourcesSection.delete')}
                        </button>
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {showAdd && (
              <motion.tr
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-c-surface-raised"
              >
                <td className="py-2 pl-3 pr-2 text-xs text-right text-c-text-secondary">
                  {items.length + 1}
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className={INLINE_SELECT_CLS}
                  >
                    {INTANGIBLE_TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {isPolish ? t.labelPl : t.labelEn}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSubmit();
                      if (e.key === 'Escape') setShowAdd(false);
                    }}
                    placeholder={t('initiatives.resourcesSection.name')}
                    className={INLINE_INPUT_CLS}
                    autoFocus
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    value={newProvider}
                    onChange={(e) => setNewProvider(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSubmit();
                      if (e.key === 'Escape') setShowAdd(false);
                    }}
                    placeholder={t('initiatives.resourcesSection.provider')}
                    className={INLINE_INPUT_CLS}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSubmit();
                      if (e.key === 'Escape') setShowAdd(false);
                    }}
                    placeholder={t('initiatives.resourcesSection.cost')}
                    className={INLINE_INPUT_CLS + ' text-right'}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="date"
                    value={newValidFrom}
                    onChange={(e) => setNewValidFrom(e.target.value)}
                    className={INLINE_INPUT_CLS}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="date"
                    value={newValidUntil}
                    onChange={(e) => setNewValidUntil(e.target.value)}
                    className={INLINE_INPUT_CLS}
                  />
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className={INLINE_SELECT_CLS}
                  >
                    {INTANGIBLE_STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {isPolish ? s.labelPl : s.labelEn}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={handleSubmit}
                      disabled={!newName.trim()}
                      className="p-1 rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised disabled:opacity-30 transition-colors"
                      title={t('initiatives.resourcesSection.save')}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setShowAdd(false)}
                      className="p-1 rounded-md text-c-text-secondary hover:bg-slate-500/10 transition-colors"
                      title={t('initiatives.resourcesSection.cancel')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            )}
            {items.length === 0 && !showAdd && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-sm text-c-text-secondary">
                  {t('initiatives.resourcesSection.noIntangibles')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && totalCost > 0 && (
        <div className="mt-2 flex items-center justify-end text-xs text-c-text-muted">
          {t('initiatives.resourcesSection.totalCost')}:{' '}
          <span className="ml-1 font-semibold text-c-text">
            {fmtCurrency(totalCost, cur, isPolish)}
          </span>
        </div>
      )}
    </div>
  );
};
