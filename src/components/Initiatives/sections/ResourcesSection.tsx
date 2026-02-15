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
  Plus,
  Sparkles,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

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
        className="p-1 rounded-md text-violet-500 dark:text-violet-400 hover:bg-violet-500/10 transition-colors"
        title={isPolish ? 'AI' : 'AI'}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
      </button>
      {isOpen && (
        <div
          className="absolute right-0 top-7 z-30 w-40 rounded-xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 p-1.5 shadow-xl shadow-slate-900/10 dark:shadow-black/30"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                onClose();
                a.onClick();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
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
  'w-full px-2 py-1.5 rounded-md bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500';

const INLINE_SELECT_CLS =
  'w-full px-1.5 py-1.5 rounded-md bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500';

// ==========================================
// Shared helpers
// ==========================================

const statusBadgeClass = (status: string): string => {
  const map: Record<string, string> = {
    planned: 'bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400',
    active: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300',
    deprecated: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    expired: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
    renewed: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300',
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
  const {
    isPolish,
    initiative,
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
      const res = await Api.post('/ai/refine-text', {
        text: input.contextText,
        mode: 'generate',
        systemInstruction: input.systemInstruction,
        fieldLabel: input.fieldLabel,
        artifactContext: {
          title: initiative?.name || '',
          status: initiative?.status || '',
          priority: initiative?.priority || '',
          type: 'initiative',
        },
        language: 'en',
      });
      return safeJsonParse(String(res?.text || ''));
    },
    [initiative]
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
      `OUTPUT LANGUAGE: English only. Translate any non-English context to English.`,
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
  }, []);

  const buildBudgetAnalyzeInstruction = useCallback((isEmpty: boolean): string => {
    return [
      `You are a senior PMO / finance partner.`,
      `Review the existing Budget table and propose ADDITIONS ONLY (no removals).`,
      isEmpty
        ? `The table is empty. Propose an initial complete set (5–10 items) that likely applies to this initiative.`
        : `The table has existing rows. Propose 0–6 additional items ONLY if truly missing.`,
      ``,
      `OUTPUT LANGUAGE: English only. Translate any non-English context to English.`,
      ``,
      `Rules:`,
      `- Never remove or edit existing rows. Only propose additions.`,
      `- Do NOT invent numbers. Use numeric amounts ONLY if clearly present in context.`,
      `- If amount is unknown, set amount = 0 and add "[confirm]" placeholders in description.`,
      `- Avoid duplicates of existing items (same intent).`,
      ``,
      `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
      `Schema: { "add": [{ "category": string, "costType": "CAPEX"|"OPEX", "amount": number, "currency": "PLN"|"EUR"|"USD"|"GBP", "description"?: string, "rationale"?: string }], "note"?: string }`,
    ].join('\n');
  }, []);

  const buildFteAddOneInstruction = useCallback((): string => {
    return [
      `You are a senior PMO delivery lead.`,
      `Propose exactly ONE additional Team/FTE allocation row for this initiative.`,
      ``,
      `OUTPUT LANGUAGE: English only. Translate any non-English context to English.`,
      ``,
      `Rules:`,
      `- Do NOT invent real people if they are not in context. If uncertain, use a role placeholder name like "Process SME (TBD)".`,
      `- allocationPercentage must be an integer 10–100.`,
      `- role must be one of: lead | member | consultant | stakeholder`,
      `- startDate/endDate: only include if present in context, otherwise omit.`,
      `- Avoid duplicates of existing rows.`,
      ``,
      `Return ONLY valid JSON.`,
      `Schema: { "name": string, "role": "lead"|"member"|"consultant"|"stakeholder", "allocationPercentage": number, "startDate"?: string, "endDate"?: string, "notes"?: string }`,
    ].join('\n');
  }, []);

  const buildFteAnalyzeInstruction = useCallback((isEmpty: boolean): string => {
    return [
      `You are a senior PMO delivery lead.`,
      `Review the existing Team/FTE table and propose ADDITIONS ONLY (no removals).`,
      isEmpty
        ? `The table is empty. Propose an initial lean allocation plan (4–8 rows).`
        : `The table has existing rows. Propose 0–6 additional rows only if key capabilities are missing.`,
      ``,
      `OUTPUT LANGUAGE: English only. Translate any non-English context to English.`,
      ``,
      `Rules:`,
      `- Never remove or edit existing rows. Only additions.`,
      `- Do NOT invent real people if not in context; use "TBD" placeholders.`,
      `- allocationPercentage must be an integer 10–100.`,
      `- role must be one of: lead | member | consultant | stakeholder`,
      `- Avoid duplicates.`,
      ``,
      `Return ONLY valid JSON.`,
      `Schema: { "add": [{ "name": string, "role": "lead"|"member"|"consultant"|"stakeholder", "allocationPercentage": number, "startDate"?: string, "endDate"?: string, "notes"?: string, "rationale"?: string }], "note"?: string }`,
    ].join('\n');
  }, []);

  const buildToolsAddOneInstruction = useCallback((): string => {
    return [
      `You are a senior technical delivery lead.`,
      `Propose exactly ONE additional tool/infrastructure item needed for this initiative.`,
      ``,
      `OUTPUT LANGUAGE: English only. Translate any non-English context to English.`,
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
      `Schema: { "name": string, "category": string, "vendor"?: string, "licenseCost": number, "licenseType": string, "status": string, "notes"?: string }`,
    ].join('\n');
  }, []);

  const buildToolsAnalyzeInstruction = useCallback((isEmpty: boolean): string => {
    return [
      `You are a senior technical delivery lead.`,
      `Review the existing Tools & Infrastructure table and propose ADDITIONS ONLY (no removals).`,
      isEmpty
        ? `The table is empty. Propose an initial set (3–8 items).`
        : `The table has existing rows. Propose 0–5 additions only if clearly missing.`,
      ``,
      `OUTPUT LANGUAGE: English only. Translate any non-English context to English.`,
      ``,
      `Rules:`,
      `- Never remove or edit existing rows. Only additions.`,
      `- Do NOT invent costs/vendors unless present.`,
      `- If cost unknown, set licenseCost = 0 and include "[confirm]" placeholders in notes.`,
      `- Avoid duplicates.`,
      ``,
      `Return ONLY valid JSON.`,
      `Schema: { "add": [{ "name": string, "category": string, "vendor"?: string, "licenseCost": number, "licenseType": string, "status": string, "notes"?: string, "rationale"?: string }], "note"?: string }`,
    ].join('\n');
  }, []);

  const buildIntangibleAddOneInstruction = useCallback((): string => {
    return [
      `You are a senior PMO / enablement lead.`,
      `Propose exactly ONE additional intangible asset item (license/training/certification/knowledge/IP) for this initiative.`,
      ``,
      `OUTPUT LANGUAGE: English only. Translate any non-English context to English.`,
      ``,
      `Rules:`,
      `- Do NOT invent providers or costs unless present in context.`,
      `- If cost is unknown, set cost = 0 and use notes with "[confirm]" placeholders.`,
      `- assetType must be one of: license | training | certification | knowledge | ip | legal_right | other`,
      `- status must be one of: planned | active | expired | renewed`,
      `- validFrom/validUntil only if present in context; otherwise omit.`,
      `- Avoid duplicates.`,
      ``,
      `Return ONLY valid JSON.`,
      `Schema: { "assetType": string, "name": string, "provider"?: string, "cost": number, "currency": "PLN"|"EUR"|"USD"|"GBP", "validFrom"?: string, "validUntil"?: string, "status": string, "beneficiaries"?: string, "notes"?: string }`,
    ].join('\n');
  }, []);

  const buildIntangibleAnalyzeInstruction = useCallback((isEmpty: boolean): string => {
    return [
      `You are a senior PMO / enablement lead.`,
      `Review the existing Intangibles table and propose ADDITIONS ONLY (no removals).`,
      isEmpty
        ? `The table is empty. Propose an initial set (2–6 items).`
        : `The table has existing rows. Propose 0–4 additions only if clearly missing.`,
      ``,
      `OUTPUT LANGUAGE: English only. Translate any non-English context to English.`,
      ``,
      `Rules:`,
      `- Never remove or edit existing rows. Only additions.`,
      `- Do NOT invent providers/costs/dates unless present in context.`,
      `- If cost unknown, set cost = 0 and include "[confirm]" placeholders.`,
      `- Avoid duplicates.`,
      ``,
      `Return ONLY valid JSON.`,
      `Schema: { "add": [{ "assetType": string, "name": string, "provider"?: string, "cost": number, "currency": "PLN"|"EUR"|"USD"|"GBP", "validFrom"?: string, "validUntil"?: string, "status": string, "beneficiaries"?: string, "notes"?: string, "rationale"?: string }], "note"?: string }`,
    ].join('\n');
  }, []);

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
        `OUTPUT LANGUAGE: English only. Translate any non-English context to English.`,
        ``,
        `Rules:`,
        `- Never remove or edit existing rows; propose additions only.`,
        `- Do NOT invent numbers/providers/vendors/dates unless present in context.`,
        `- If a numeric field is unknown, set it to 0 and add "[confirm]" placeholders in description/notes.`,
        `- Avoid duplicates vs the existing rows provided.`,
        ``,
        `Limits:`,
        `- Budget add: ${flags.budgetEmpty ? '5–10' : '0–6'}`,
        `- Team/FTE add: ${flags.fteEmpty ? '4–8' : '0–6'}`,
        `- Tools add: ${flags.toolsEmpty ? '3–8' : '0–5'}`,
        `- Intangibles add: ${flags.intangibleEmpty ? '2–6' : '0–4'}`,
        ``,
        `Return ONLY valid JSON.`,
        `Schema: {`,
        `  "budget": { "add": [{ "category": string, "costType": "CAPEX"|"OPEX", "amount": number, "currency": "PLN"|"EUR"|"USD"|"GBP", "description"?: string, "rationale"?: string }] },`,
        `  "teamFte": { "add": [{ "name": string, "role": "lead"|"member"|"consultant"|"stakeholder", "allocationPercentage": number, "startDate"?: string, "endDate"?: string, "notes"?: string, "rationale"?: string }] },`,
        `  "tools": { "add": [{ "name": string, "category": string, "vendor"?: string, "licenseCost": number, "licenseType": string, "status": string, "notes"?: string, "rationale"?: string }] },`,
        `  "intangibles": { "add": [{ "assetType": string, "name": string, "provider"?: string, "cost": number, "currency": "PLN"|"EUR"|"USD"|"GBP", "validFrom"?: string, "validUntil"?: string, "status": string, "beneficiaries"?: string, "notes"?: string, "rationale"?: string }] },`,
        `  "note"?: string`,
        `}`,
      ].join('\n');
    },
    []
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
              costType: String(x?.costType || 'OPEX').toUpperCase() === 'CAPEX' ? 'CAPEX' : 'OPEX',
              amount: Number(x?.amount) || 0,
              currency: normalizeCurrency(x?.currency),
              description: x?.description ? String(x.description).trim() : undefined,
              rationale: x?.rationale ? String(x.rationale).trim() : undefined,
            }))
            .filter((x) => x.category && x.costType);
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
              startDate: x?.startDate ? String(x.startDate).trim() : undefined,
              endDate: x?.endDate ? String(x.endDate).trim() : undefined,
              notes: x?.notes ? String(x.notes).trim() : undefined,
              rationale: x?.rationale ? String(x.rationale).trim() : undefined,
            }))
            .filter((x) => x.name);
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
            .filter((x) => x.name);
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
              validFrom: x?.validFrom ? String(x.validFrom).trim() : undefined,
              validUntil: x?.validUntil ? String(x.validUntil).trim() : undefined,
              status: normalizeIntangibleStatus(x?.status),
              beneficiaries: x?.beneficiaries ? String(x.beneficiaries).trim() : undefined,
              notes: x?.notes ? String(x.notes).trim() : undefined,
              rationale: x?.rationale ? String(x.rationale).trim() : undefined,
            }))
            .filter((x) => x.name);
        }

        const hasAny =
          proposal.budgetAdd.length > 0 ||
          proposal.fteAdd.length > 0 ||
          proposal.toolsAdd.length > 0 ||
          proposal.intangibleAdd.length > 0;

        if (!hasAny) return;
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
      normalizeIntangibleStatus,
      normalizeIntangibleType,
      normalizeLicenseType,
      normalizeToolCategory,
      normalizeToolStatus,
      openProposal,
      resourceItems,
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
          costType: String(x?.costType || 'OPEX').toUpperCase() === 'CAPEX' ? 'CAPEX' : 'OPEX',
          amount: Number(x?.amount) || 0,
          currency: normalizeCurrency(x?.currency),
          description: x?.description ? String(x.description).trim() : undefined,
          rationale: x?.rationale ? String(x.rationale).trim() : undefined,
        }))
        .filter((x) => x.category);

      proposal.fteAdd = proposal.fteAdd
        .map((x: any) => ({
          name: String(x?.name || '').trim(),
          role: normalizeFteRole(x?.role),
          allocationPercentage: Math.max(
            10,
            Math.min(100, Math.round(Number(x?.allocationPercentage) || 50))
          ),
          startDate: x?.startDate ? String(x.startDate).trim() : undefined,
          endDate: x?.endDate ? String(x.endDate).trim() : undefined,
          notes: x?.notes ? String(x.notes).trim() : undefined,
          rationale: x?.rationale ? String(x.rationale).trim() : undefined,
        }))
        .filter((x) => x.name);

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
        .filter((x) => x.name);

      proposal.intangibleAdd = proposal.intangibleAdd
        .map((x: any) => ({
          assetType: normalizeIntangibleType(x?.assetType || x?.type),
          name: String(x?.name || '').trim(),
          provider: x?.provider ? String(x.provider).trim() : undefined,
          cost: Number(x?.cost) || 0,
          currency: normalizeCurrency(x?.currency),
          validFrom: x?.validFrom ? String(x.validFrom).trim() : undefined,
          validUntil: x?.validUntil ? String(x.validUntil).trim() : undefined,
          status: normalizeIntangibleStatus(x?.status),
          beneficiaries: x?.beneficiaries ? String(x.beneficiaries).trim() : undefined,
          notes: x?.notes ? String(x.notes).trim() : undefined,
          rationale: x?.rationale ? String(x.rationale).trim() : undefined,
        }))
        .filter((x) => x.name);

      const hasAny =
        proposal.budgetAdd.length > 0 ||
        proposal.fteAdd.length > 0 ||
        proposal.toolsAdd.length > 0 ||
        proposal.intangibleAdd.length > 0;
      if (!hasAny) return;
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
    normalizeIntangibleStatus,
    normalizeIntangibleType,
    normalizeLicenseType,
    normalizeToolCategory,
    normalizeToolStatus,
    openProposal,
    resourceItems,
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
        });
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
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-navy-700/60 bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Propozycje zasobów (AI)' : 'Proposed resources (AI)'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isPolish
                    ? 'Zaznacz elementy do dodania, a następnie kliknij „Zastosuj”. (AI nie usuwa pozycji w zasobach)'
                    : 'Select items to add, then click “Apply”. (AI never removes resource rows)'}
                </p>
                {aiProposal.note ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {aiProposal.note}
                  </p>
                ) : null}
              </div>
              <button
                onClick={closeAIModal}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                title={isPolish ? 'Zamknij' : 'Close'}
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
              {aiProposal.budgetAdd.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {isPolish ? 'Budżet — do dodania' : 'Budget — to add'} (
                      {aiProposal.budgetAdd.length})
                    </span>
                    <button
                      onClick={() =>
                        setSelectedBudgetIdx(
                          Object.fromEntries(aiProposal.budgetAdd.map((_, idx) => [idx, true]))
                        )
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {isPolish ? 'Zaznacz wszystko' : 'Select all'}
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
                            <span className="text-sm font-medium text-slate-800 dark:text-white">
                              {String(b.costType || '').toUpperCase()} · {b.category}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {fmtCurrency(Number(b.amount) || 0, b.currency || 'PLN', isPolish)}
                            </span>
                          </div>
                          {b.description ? (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">
                              {b.description}
                            </p>
                          ) : null}
                          {b.rationale ? (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {b.rationale}
                            </p>
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
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {isPolish ? 'FTE — do dodania' : 'Team / FTE — to add'} (
                      {aiProposal.fteAdd.length})
                    </span>
                    <button
                      onClick={() =>
                        setSelectedFteIdx(
                          Object.fromEntries(aiProposal.fteAdd.map((_, idx) => [idx, true]))
                        )
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {isPolish ? 'Zaznacz wszystko' : 'Select all'}
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
                            <span className="text-sm font-medium text-slate-800 dark:text-white">
                              {r.name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {r.role} · {r.allocationPercentage}%
                            </span>
                          </div>
                          {r.notes ? (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">
                              {r.notes}
                            </p>
                          ) : null}
                          {r.rationale ? (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {r.rationale}
                            </p>
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
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {isPolish ? 'Narzędzia — do dodania' : 'Tools — to add'} (
                      {aiProposal.toolsAdd.length})
                    </span>
                    <button
                      onClick={() =>
                        setSelectedToolsIdx(
                          Object.fromEntries(aiProposal.toolsAdd.map((_, idx) => [idx, true]))
                        )
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {isPolish ? 'Zaznacz wszystko' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {aiProposal.toolsAdd.map((t, idx) => (
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
                            <span className="text-sm font-medium text-slate-800 dark:text-white">
                              {t.name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {t.category} · {t.status}
                            </span>
                          </div>
                          {t.vendor ? (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {isPolish ? 'Dostawca' : 'Vendor'}: {t.vendor}
                            </p>
                          ) : null}
                          {t.notes ? (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">
                              {t.notes}
                            </p>
                          ) : null}
                          {t.rationale ? (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {t.rationale}
                            </p>
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
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {isPolish ? 'Licencje/szkolenia — do dodania' : 'Intangibles — to add'} (
                      {aiProposal.intangibleAdd.length})
                    </span>
                    <button
                      onClick={() =>
                        setSelectedIntangibleIdx(
                          Object.fromEntries(aiProposal.intangibleAdd.map((_, idx) => [idx, true]))
                        )
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {isPolish ? 'Zaznacz wszystko' : 'Select all'}
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
                            <span className="text-sm font-medium text-slate-800 dark:text-white">
                              {a.name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {a.assetType} · {a.status}
                            </span>
                          </div>
                          {a.provider ? (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {isPolish ? 'Dostawca' : 'Provider'}: {a.provider}
                            </p>
                          ) : null}
                          {a.notes ? (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">
                              {a.notes}
                            </p>
                          ) : null}
                          {a.rationale ? (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {a.rationale}
                            </p>
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
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors disabled:opacity-50"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={() => void applyProposal()}
                disabled={aiBusy || !hasAnyAdd}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
              >
                {aiBusy ? <Loader2 size={13} className="animate-spin" /> : null}
                {isPolish ? 'Zastosuj' : 'Apply'}
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
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            {isPolish ? 'Budżet' : 'Budget'}
          </h3>
          {items.length > 0 && (
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
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
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <Plus size={12} />
          {isPolish ? 'Dodaj' : 'Add item'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-navy-700/40">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '27%' }} />
            <col style={{ width: '4%' }} />
          </colgroup>
          <thead>
            <tr className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-navy-800/30 border-b border-slate-200 dark:border-navy-700/40">
              <th className="text-right py-2.5 pl-3 pr-2">#</th>
              <th className="text-left py-2.5 pl-3 pr-2">{isPolish ? 'Kategoria' : 'Category'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Typ' : 'Type'}</th>
              <th className="text-right py-2.5 pr-2">{isPolish ? 'Kwota' : 'Amount'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Waluta' : 'Currency'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Opis' : 'Description'}</th>
              <th className="py-2.5 pr-3 text-right">
                <TableAIMenu
                  isPolish={isPolish}
                  isOpen={aiMenuOpen}
                  onToggle={() => setAiMenuOpen((v) => !v)}
                  onClose={() => setAiMenuOpen(false)}
                  busy={aiBusy}
                  actions={[
                    { id: 'addOne', label: { en: 'Add', pl: 'Dodaj' }, onClick: onAiAddOne },
                    {
                      id: 'analyze',
                      label: { en: 'Analyze', pl: 'Analizuj' },
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
                  <td className="py-2.5 pl-3 pr-2 text-xs text-right text-slate-500">{idx + 1}</td>
                  <td className="py-2.5 pl-3 pr-2 text-slate-700 dark:text-slate-200 truncate">
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase size={12} className="text-slate-400 flex-shrink-0" />
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
                  <td className="py-2.5 pr-2 text-right text-xs font-medium text-slate-700 dark:text-slate-200">
                    {fmtCurrency(item.amount, item.currency, isPolish)}
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-slate-500">{item.currency || 'PLN'}</td>
                  <td
                    className="py-2.5 pr-2 text-xs text-slate-500 truncate"
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
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {menuId === item.id && (
                      <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 p-1.5 shadow-xl">
                        <button
                          onClick={() => {
                            setMenuId(null);
                            void onDelete(item.id);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <Trash2 size={13} />
                          {isPolish ? 'Usuń' : 'Delete'}
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
                <td className="py-2 pl-3 pr-2 text-xs text-right text-slate-400">
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
                    placeholder={isPolish ? 'Kwota' : 'Amount'}
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
                    placeholder={isPolish ? 'Opis' : 'Description'}
                    className={INLINE_INPUT_CLS}
                  />
                </td>
                <td className="py-2 pr-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={handleSubmit}
                      disabled={!newAmount}
                      className="p-1 rounded-md text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-30 transition-colors"
                      title={isPolish ? 'Zapisz' : 'Save'}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setShowAdd(false)}
                      className="p-1 rounded-md text-slate-400 hover:bg-slate-500/10 transition-colors"
                      title={isPolish ? 'Anuluj' : 'Cancel'}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            )}
            {items.length === 0 && !showAdd && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                  {isPolish ? 'Brak pozycji budżetowych' : 'No budget items yet'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && (
        <div className="mt-2 flex items-center justify-end gap-4 text-xs text-slate-500 dark:text-slate-400">
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
            {isPolish ? 'Razem' : 'Total'}:{' '}
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
  onDelete,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [newAlloc, setNewAlloc] = useState('100');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newNotes, setNewNotes] = useState('');

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

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <Users size={16} className="text-teal-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            {isPolish ? 'Zespół / Alokacja FTE' : 'Team / FTE Allocation'}
          </h3>
          {items.length > 0 && (
            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
          {items.length > 0 && (
            <span className="text-[10px] font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-2 py-0.5 rounded-full">
              {totalFTE.toFixed(1)} FTE
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <Plus size={12} />
          {isPolish ? 'Dodaj' : 'Add item'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-navy-700/40">
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
          <thead>
            <tr className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-navy-800/30 border-b border-slate-200 dark:border-navy-700/40">
              <th className="text-right py-2.5 pl-3 pr-2">#</th>
              <th className="text-left py-2.5 pl-3 pr-2">{isPolish ? 'Nazwa' : 'Name'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Rola' : 'Role'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Alokacja' : 'Alloc.'}</th>
              <th className="text-left py-2.5 pr-2">Start</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Koniec' : 'End'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Notatki' : 'Notes'}</th>
              <th className="py-2.5 pr-3 text-right">
                <TableAIMenu
                  isPolish={isPolish}
                  isOpen={aiMenuOpen}
                  onToggle={() => setAiMenuOpen((v) => !v)}
                  onClose={() => setAiMenuOpen(false)}
                  busy={aiBusy}
                  actions={[
                    { id: 'addOne', label: { en: 'Add', pl: 'Dodaj' }, onClick: onAiAddOne },
                    {
                      id: 'analyze',
                      label: { en: 'Analyze', pl: 'Analizuj' },
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
                  <td className="py-2.5 pl-3 pr-2 text-xs text-right text-slate-500">{idx + 1}</td>
                  <td className="py-2.5 pl-3 pr-2 text-slate-700 dark:text-slate-200 truncate">
                    {item.name ||
                      (item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : '—')}
                  </td>
                  <td className="py-2.5 pr-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300">
                      {ROLE_OPTIONS.find((r) => r.value === item.role)?.[
                        isPolish ? 'labelPl' : 'labelEn'
                      ] ||
                        item.role ||
                        '—'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 text-xs">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 font-medium">
                      {item.allocationPercentage || 0}%
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-slate-500">
                    {item.startDate ? new Date(item.startDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-slate-500">
                    {item.endDate ? new Date(item.endDate).toLocaleDateString() : '—'}
                  </td>
                  <td
                    className="py-2.5 pr-2 text-xs text-slate-500 truncate"
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
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {menuId === item.id && (
                      <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 p-1.5 shadow-xl">
                        <button
                          onClick={() => {
                            setMenuId(null);
                            void onDelete(item.id);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <Trash2 size={13} />
                          {isPolish ? 'Usuń' : 'Delete'}
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
                className="bg-teal-50/30 dark:bg-teal-500/5"
              >
                <td className="py-2 pl-3 pr-2 text-xs text-right text-slate-400">
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
                    placeholder={isPolish ? 'Imię / Stanowisko' : 'Name / Position'}
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
                    placeholder={isPolish ? 'Notatki' : 'Notes'}
                    className={INLINE_INPUT_CLS}
                  />
                </td>
                <td className="py-2 pr-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={handleSubmit}
                      disabled={!newName.trim()}
                      className="p-1 rounded-md text-teal-500 hover:bg-teal-500/10 disabled:opacity-30 transition-colors"
                      title={isPolish ? 'Zapisz' : 'Save'}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setShowAdd(false)}
                      className="p-1 rounded-md text-slate-400 hover:bg-slate-500/10 transition-colors"
                      title={isPolish ? 'Anuluj' : 'Cancel'}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            )}
            {items.length === 0 && !showAdd && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-slate-400">
                  {isPolish ? 'Brak przypisanych zasobów' : 'No team members assigned'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && (
        <div className="mt-2 flex items-center justify-end text-xs text-slate-500">
          {isPolish ? 'Łączne FTE' : 'Total FTE'}:{' '}
          <span className="ml-1 font-semibold text-teal-600 dark:text-teal-400">
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
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            {isPolish ? 'Narzędzia i infrastruktura' : 'Tools & Infrastructure'}
          </h3>
          {items.length > 0 && (
            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <Plus size={12} />
          {isPolish ? 'Dodaj' : 'Add item'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-navy-700/40">
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
          <thead>
            <tr className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-navy-800/30 border-b border-slate-200 dark:border-navy-700/40">
              <th className="text-right py-2.5 pl-3 pr-2">#</th>
              <th className="text-left py-2.5 pl-3 pr-2">{isPolish ? 'Nazwa' : 'Name'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Kategoria' : 'Category'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Dostawca' : 'Vendor'}</th>
              <th className="text-right py-2.5 pr-2">{isPolish ? 'Koszt' : 'Cost'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Licencja' : 'License'}</th>
              <th className="text-left py-2.5 pr-2">Status</th>
              <th className="py-2.5 pr-3 text-right">
                <TableAIMenu
                  isPolish={isPolish}
                  isOpen={aiMenuOpen}
                  onToggle={() => setAiMenuOpen((v) => !v)}
                  onClose={() => setAiMenuOpen(false)}
                  busy={aiBusy}
                  actions={[
                    { id: 'addOne', label: { en: 'Add', pl: 'Dodaj' }, onClick: onAiAddOne },
                    {
                      id: 'analyze',
                      label: { en: 'Analyze', pl: 'Analizuj' },
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
                  <td className="py-2.5 pl-3 pr-2 text-xs text-right text-slate-500">{idx + 1}</td>
                  <td className="py-2.5 pl-3 pr-2 text-slate-700 dark:text-slate-200 truncate">
                    {item.name || '—'}
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-slate-500">
                    {TOOL_CATEGORIES.find((c) => c.value === item.category)?.[
                      isPolish ? 'labelPl' : 'labelEn'
                    ] || item.category}
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-slate-500 truncate">
                    {item.vendor || '—'}
                  </td>
                  <td className="py-2.5 pr-2 text-right text-xs font-medium text-slate-700 dark:text-slate-200">
                    {item.licenseCost ? fmtCurrency(item.licenseCost, 'PLN', isPolish) : '—'}
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-slate-500">
                    {LICENSE_TYPE_OPTIONS.find((l) => l.value === item.licenseType)?.[
                      isPolish ? 'labelPl' : 'labelEn'
                    ] ||
                      item.licenseType ||
                      '—'}
                  </td>
                  <td className="py-2.5 pr-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ${statusBadgeClass(item.status)}`}
                    >
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
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {menuId === item.id && (
                      <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 p-1.5 shadow-xl">
                        <button
                          onClick={() => {
                            setMenuId(null);
                            void onDelete(item.id);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <Trash2 size={13} />
                          {isPolish ? 'Usuń' : 'Delete'}
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
                <td className="py-2 pl-3 pr-2 text-xs text-right text-slate-400">
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
                    placeholder={isPolish ? 'Nazwa' : 'Name'}
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
                    placeholder={isPolish ? 'Dostawca' : 'Vendor'}
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
                    placeholder={isPolish ? 'Koszt' : 'Cost'}
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
                      title={isPolish ? 'Zapisz' : 'Save'}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setShowAdd(false)}
                      className="p-1 rounded-md text-slate-400 hover:bg-slate-500/10 transition-colors"
                      title={isPolish ? 'Anuluj' : 'Cancel'}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            )}
            {items.length === 0 && !showAdd && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-slate-400">
                  {isPolish ? 'Brak narzędzi' : 'No tools added yet'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && totalCost > 0 && (
        <div className="mt-2 flex items-center justify-end text-xs text-slate-500">
          {isPolish ? 'Łączny koszt licencji' : 'Total license cost'}:{' '}
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
        return <GraduationCap size={12} className="text-purple-400 flex-shrink-0" />;
      case 'certification':
        return <BookOpen size={12} className="text-blue-400 flex-shrink-0" />;
      case 'knowledge':
        return <BookOpen size={12} className="text-amber-400 flex-shrink-0" />;
      default:
        return <Briefcase size={12} className="text-slate-400 flex-shrink-0" />;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <GraduationCap size={16} className="text-purple-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            {isPolish
              ? 'Licencje, szkolenia i wartości niematerialne'
              : 'Licenses, Training & Intangible Assets'}
          </h3>
          {items.length > 0 && (
            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
          {items.length > 0 && totalCost > 0 && (
            <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 rounded-full">
              {fmtCurrency(totalCost, cur, isPolish)}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <Plus size={12} />
          {isPolish ? 'Dodaj' : 'Add item'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-navy-700/40">
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
          <thead>
            <tr className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-navy-800/30 border-b border-slate-200 dark:border-navy-700/40">
              <th className="text-right py-2.5 pl-3 pr-2">#</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Typ' : 'Type'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Nazwa' : 'Name'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Dostawca' : 'Provider'}</th>
              <th className="text-right py-2.5 pr-2">{isPolish ? 'Koszt' : 'Cost'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Ważne od' : 'Valid from'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Ważne do' : 'Valid until'}</th>
              <th className="text-left py-2.5 pr-2">Status</th>
              <th className="py-2.5 pr-3 text-right">
                <TableAIMenu
                  isPolish={isPolish}
                  isOpen={aiMenuOpen}
                  onToggle={() => setAiMenuOpen((v) => !v)}
                  onClose={() => setAiMenuOpen(false)}
                  busy={aiBusy}
                  actions={[
                    { id: 'addOne', label: { en: 'Add', pl: 'Dodaj' }, onClick: onAiAddOne },
                    {
                      id: 'analyze',
                      label: { en: 'Analyze', pl: 'Analizuj' },
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
                  <td className="py-2.5 pl-3 pr-2 text-xs text-right text-slate-500">{idx + 1}</td>
                  <td className="py-2.5 pr-2">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      {typeIcon(item.assetType)}
                      <span className="text-slate-600 dark:text-slate-300">
                        {INTANGIBLE_TYPE_OPTIONS.find((t) => t.value === item.assetType)?.[
                          isPolish ? 'labelPl' : 'labelEn'
                        ] || item.assetType}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 text-slate-700 dark:text-slate-200 truncate">
                    {item.name}
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-slate-500 truncate">
                    {item.provider || '—'}
                  </td>
                  <td className="py-2.5 pr-2 text-right text-xs font-medium text-slate-700 dark:text-slate-200">
                    {item.cost ? fmtCurrency(item.cost, item.currency, isPolish) : '—'}
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-slate-500">
                    {item.validFrom ? new Date(item.validFrom).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-slate-500">
                    {item.validUntil ? new Date(item.validUntil).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2.5 pr-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ${statusBadgeClass(item.status)}`}
                    >
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
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {menuId === item.id && (
                      <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 p-1.5 shadow-xl">
                        <button
                          onClick={() => {
                            setMenuId(null);
                            void onDelete(item.id);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <Trash2 size={13} />
                          {isPolish ? 'Usuń' : 'Delete'}
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
                className="bg-purple-50/30 dark:bg-purple-500/5"
              >
                <td className="py-2 pl-3 pr-2 text-xs text-right text-slate-400">
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
                    placeholder={isPolish ? 'Nazwa' : 'Name'}
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
                    placeholder={isPolish ? 'Dostawca' : 'Provider'}
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
                    placeholder={isPolish ? 'Koszt' : 'Cost'}
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
                      className="p-1 rounded-md text-purple-500 hover:bg-purple-500/10 disabled:opacity-30 transition-colors"
                      title={isPolish ? 'Zapisz' : 'Save'}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setShowAdd(false)}
                      className="p-1 rounded-md text-slate-400 hover:bg-slate-500/10 transition-colors"
                      title={isPolish ? 'Anuluj' : 'Cancel'}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            )}
            {items.length === 0 && !showAdd && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-sm text-slate-400">
                  {isPolish ? 'Brak wartości niematerialnych' : 'No intangible assets yet'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && totalCost > 0 && (
        <div className="mt-2 flex items-center justify-end text-xs text-slate-500">
          {isPolish ? 'Łączny koszt' : 'Total cost'}:{' '}
          <span className="ml-1 font-semibold text-purple-600 dark:text-purple-400">
            {fmtCurrency(totalCost, cur, isPolish)}
          </span>
        </div>
      )}
    </div>
  );
};
