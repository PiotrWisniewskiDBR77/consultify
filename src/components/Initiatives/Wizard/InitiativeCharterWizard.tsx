/**
 * InitiativeCharterWizard — "Single initiative" (Tryb A) charter-lite wizard.
 *
 * First version of the consulting-grade initiative wizard (see
 * ~/.claude/plans plan "Wizard Inicjatyw"). Built on the canonical <WizardModal>
 * shell. Captures the MINIMUM VIABLE CHARTER needed for a Go/No-Go triage —
 * everything else is deferred to the initiative detail's 19 sections, filled
 * progressively as the initiative passes gates.
 *
 * Governance discipline ("bramkowanie"): this wizard ALWAYS creates a DRAFT.
 * It never promotes. The Govern step shows the next gate + who can pass it.
 *
 * Standalone & additive: it does NOT touch the existing InitiativeWizardModal
 * (portfolio / Tryb B) or any hub file — wiring a launch point is a one-liner the
 * host adds (`<InitiativeCharterWizard isOpen .. onClose .. source=.. />`).
 */
import { ArrowRight, ChevronDown, Lock, ShieldCheck } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Select } from '@/components/shared/forms';
import { WizardModal } from '@/components/shared/WizardModal';
import type { WizardStep } from '@/components/shared/WizardModal/types';
import { Api } from '@/services/api';
import { type CardValidationIssue, validateCard } from '@/services/api/cardValidators';
import { checkSimilarInitiatives, type SimilarInitiative } from '@/services/api/initiativeSimilar';
import { createInitiativeWriteTruth } from '@/services/initiativeWriteTruth';

import { ProposedCardsPanel } from './ProposedCardsPanel';
import { useProposeCards } from './useProposeCards';

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

type Lever = 'cost' | 'growth' | 'risk' | 'capability' | 'compliance';
type Band = 'low' | 'medium' | 'high' | 'very_high';
type Effort = 'S' | 'M' | 'L';

/** Lineage prefill, e.g. from an insight "Create initiative from finding" handoff. */
export interface InitiativeCharterSource {
  sourceType?: string; // e.g. 'interview_insight'
  sourceId?: string | null;
  evidenceRefs?: string[];
  title?: string; // prefill title
  thesis?: string; // prefill thesis/problem
  label?: string; // display chip text
}

export interface InitiativeCharterWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (result: { createdId: string | null; created: unknown }) => void;
  projectId?: string;
  source?: InitiativeCharterSource;
  isPolish?: boolean;
}

interface UserOption {
  id: string;
  name: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Domain helpers
// ──────────────────────────────────────────────────────────────────────────

const LEVER_TO_AXIS: Record<Lever, string> = {
  cost: 'operational',
  growth: 'strategic',
  risk: 'operational',
  capability: 'transformational',
  compliance: 'compliance',
};

const IMPACT_RANK: Record<Band, number> = { low: 1, medium: 2, high: 3, very_high: 4 };

/** Impact × Effort 2×2 → quadrant + suggested priority (the live decision aid). */
function deriveQuadrant(impact: Band, effort: Effort) {
  const impactHigh = IMPACT_RANK[impact] >= 3;
  const effortHigh = effort === 'L';
  if (impactHigh && !effortHigh)
    return { key: 'quick_win', pl: 'Quick win', en: 'Quick win', priority: 'critical' as const };
  if (impactHigh && effortHigh)
    return { key: 'big_bet', pl: 'Duży zakład', en: 'Big bet', priority: 'high' as const };
  if (!impactHigh && !effortHigh)
    return { key: 'fill_in', pl: 'Uzupełnienie', en: 'Fill-in', priority: 'medium' as const };
  return { key: 'reconsider', pl: 'Do rozważenia', en: 'Reconsider', priority: 'low' as const };
}

const splitLines = (v: string): string[] =>
  v
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

// ──────────────────────────────────────────────────────────────────────────
// Small presentational primitives (self-contained, mirror the insight wizard)
// ──────────────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-[var(--c-info)] focus:outline-none focus:ring-1 focus:ring-c-info/30 dark:border-navy-600 dark:bg-navy-800 dark:text-slate-100 dark:placeholder-slate-500';
const labelCls = 'mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300';

const Disclosure: React.FC<{
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, count, open, onToggle, children }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/70 dark:border-navy-700/60 dark:bg-navy-950/30">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
    >
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</span>
      {typeof count === 'number' && count > 0 && (
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-navy-900 px-1.5 text-[11px] font-semibold text-white">
          {count}
        </span>
      )}
      <ChevronDown
        size={16}
        className={`ml-auto shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
      />
    </button>
    {open && (
      <div className="space-y-4 border-t border-slate-200/70 px-3.5 py-3.5 dark:border-navy-700/50">
        {children}
      </div>
    )}
  </div>
);

/** Live impact×effort 2×2 with the active quadrant highlighted. */
const QuadrantMatrix: React.FC<{ impact: Band; effort: Effort; isPolish: boolean }> = ({
  impact,
  effort,
}) => {
  const { t } = useTranslation();
  const active = deriveQuadrant(impact, effort).key;
  const impactHigh = IMPACT_RANK[impact] >= 3;
  const effortHigh = effort === 'L';
  const cell = (key: string, label: string) => (
    <div
      className={`flex h-12 items-center justify-center rounded-lg border text-[11px] font-semibold transition-all ${
        active === key
          ? 'border-[var(--c-info)] bg-slate-100 text-[var(--c-info)] ring-1 ring-c-info/30 dark:bg-white/[0.08] dark:text-[var(--c-info)]'
          : 'border-slate-200 bg-white text-slate-400 dark:border-navy-700/60 dark:bg-navy-800/40'
      }`}
    >
      {label}
    </div>
  );
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex flex-col justify-between py-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        <span>{t('initiatives.initiativeCharterWizard.highImpact')}</span>
        <span>{t('initiatives.initiativeCharterWizard.lowImpact')}</span>
      </div>
      <div className="flex-1">
        <div className="grid grid-cols-2 gap-2">
          {cell('quick_win', 'Quick win')}
          {cell('big_bet', t('initiatives.initiativeCharterWizard.bigBet'))}
          {cell('fill_in', t('initiatives.initiativeCharterWizard.fillIn'))}
          {cell('reconsider', t('initiatives.initiativeCharterWizard.reconsider'))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-medium uppercase tracking-wide text-slate-400">
          <span>{t('initiatives.initiativeCharterWizard.lowEffort')}</span>
          <span>{t('initiatives.initiativeCharterWizard.highEffort')}</span>
        </div>
      </div>
      <span className="sr-only">
        {impactHigh ? 'high impact' : 'low impact'}, {effortHigh ? 'high effort' : 'low effort'}
      </span>
    </div>
  );
};

const SegmentedRow = <T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
          value === o.value
            ? 'border-[var(--c-info)] bg-slate-100 text-[var(--c-info)] dark:bg-white/[0.08] dark:text-[var(--c-info)]'
            : 'border-slate-200 bg-white text-slate-600 hover:border-c-info/40 dark:border-navy-700/60 dark:bg-navy-800/40 dark:text-slate-300'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

// ──────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────

export const InitiativeCharterWizard: React.FC<InitiativeCharterWizardProps> = ({
  isOpen,
  onClose,
  onCreated,
  projectId,
  source,
  isPolish: isPolishProp,
}) => {
  const { i18n } = useTranslation();
  const isPolish = isPolishProp ?? i18n.language === 'pl';
  const tr = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);

  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);

  // Define
  const [title, setTitle] = useState('');
  const [thesis, setThesis] = useState('');
  const [lever, setLever] = useState<Lever>('cost');

  // M13 Depth · C1 — portfolio-aware dedup: debounced check against existing
  // org initiatives as the user names the new one (advisory, never blocks).
  const [similarInitiatives, setSimilarInitiatives] = useState<SimilarInitiative[]>([]);
  useEffect(() => {
    const q = title.trim();
    if (q.length < 4) {
      setSimilarInitiatives([]);
      return;
    }
    const h = setTimeout(() => {
      void checkSimilarInitiatives(q, thesis).then(setSimilarInitiatives);
    }, 500);
    return () => clearTimeout(h);
  }, [title, thesis]);

  // AI-proposed cards (R6) — surface the deterministic card proposal for the
  // chosen lever/type and let the user opt extra cards in. Selection is held in
  // wizard state (rendered below); persisting it further is out of scope here.
  const {
    core: proposedCore,
    proposed: proposedExtra,
    loading: proposalLoading,
    fetchProposal,
  } = useProposeCards();
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const toggleSelectedCard = useCallback((key: string) => {
    setSelectedCards((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);
  // Re-propose whenever the lever (the closest "type" signal) changes.
  useEffect(() => {
    if (!isOpen) return;
    void fetchProposal({ type: lever, sourceType: source?.sourceType, brief: thesis });
    // brief/title intentionally excluded from deps — the proposal keys off type;
    // refetching on every keystroke would be noisy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lever, source?.sourceType, fetchProposal]);

  // M13 Depth · K1 — debounced §B3 quality hints on the thesis/hypothesis field.
  const [cardIssues, setCardIssues] = useState<CardValidationIssue[]>([]);
  useEffect(() => {
    const q = thesis.trim();
    if (q.length < 8) {
      setCardIssues([]);
      return;
    }
    const h = setTimeout(() => {
      void validateCard(q, ['lang_pl', 'no_filler', 'hypothesis_format']).then(setCardIssues);
    }, 600);
    return () => clearTimeout(h);
  }, [thesis]);

  // Case
  const [users, setUsers] = useState<UserOption[]>([]);
  const [ownerId, setOwnerId] = useState('');
  const [sponsorId, setSponsorId] = useState('');
  const [impact, setImpact] = useState<Band>('high');
  const [confidence, setConfidence] = useState<Band>('medium');
  const [effort, setEffort] = useState<Effort>('M');
  const [kpiName, setKpiName] = useState('');
  const [kpiBaseline, setKpiBaseline] = useState('');
  const [kpiTarget, setKpiTarget] = useState('');

  // Govern
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tags, setTags] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [scopeIn, setScopeIn] = useState('');
  const [scopeOut, setScopeOut] = useState('');
  const [killCriteria, setKillCriteria] = useState('');
  const [keyRisks, setKeyRisks] = useState('');

  // Reset + prefill on open
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setCreating(false);
    setTitle(source?.title ?? '');
    setThesis(source?.thesis ?? '');
    setLever('cost');
    setSelectedCards([]);
    setOwnerId('');
    setSponsorId('');
    setImpact('high');
    setConfidence('medium');
    setEffort('M');
    setKpiName('');
    setKpiBaseline('');
    setKpiTarget('');
    setStartDate('');
    setEndDate('');
    setTags('');
    setAdvancedOpen(false);
    setScopeIn('');
    setScopeOut('');
    setKillCriteria('');
    setKeyRisks('');
  }, [isOpen, source]);

  // Load users for owner/sponsor selects
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await Api.get('/users');
        const raw: Array<Record<string, unknown>> = Array.isArray(data?.users)
          ? data.users
          : Array.isArray(data)
            ? data
            : [];
        const str = (v: unknown): string => (typeof v === 'string' ? v : '');
        const seen = new Set<string>();
        const mapped: UserOption[] = [];
        for (const u of raw) {
          const id = str(u.id);
          if (!id || seen.has(id)) continue; // dedupe — /users may repeat ids
          seen.add(id);
          mapped.push({
            id,
            name:
              str(u.name) ||
              `${str(u.firstName)} ${str(u.lastName)}`.trim() ||
              str(u.email) ||
              'Unknown',
          });
        }
        if (!cancelled) setUsers(mapped);
      } catch {
        if (!cancelled) setUsers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const quadrant = useMemo(() => deriveQuadrant(impact, effort), [impact, effort]);

  const advancedCount =
    (splitLines(scopeIn).length ? 1 : 0) +
    (splitLines(scopeOut).length ? 1 : 0) +
    (splitLines(killCriteria).length ? 1 : 0) +
    (splitLines(keyRisks).length ? 1 : 0);

  // Validation gates — the "minimum viable charter".
  const stepValid = [title.trim().length > 0, Boolean(ownerId) && kpiName.trim().length > 0, true];
  const nextDisabled = !stepValid[step];

  const userOptions = useMemo(() => users.map((u) => ({ value: u.id, label: u.name })), [users]);
  const bandOptions = (kind: 'impact' | 'confidence') => [
    { value: 'low' as Band, label: tr('Niski', 'Low') },
    { value: 'medium' as Band, label: tr('Średni', 'Medium') },
    { value: 'high' as Band, label: tr('Wysoki', 'High') },
    {
      value: 'very_high' as Band,
      label:
        kind === 'confidence' ? tr('Bardzo wysoka', 'Very high') : tr('Bardzo wysoki', 'Very high'),
    },
  ];

  const handleCreate = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const hasSource = Boolean(source?.sourceId);
      const successCriteria: string[] = [];
      if (kpiName.trim()) {
        const kpiLine = `${kpiName.trim()}: ${kpiBaseline.trim() || '—'} → ${kpiTarget.trim() || '—'}`;
        successCriteria.push(kpiLine);
      }
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: thesis.trim() || undefined,
        axis: LEVER_TO_AXIS[lever],
        status: 'DRAFT',
        priority: quadrant.priority,
        ownerId,
        sponsorId: sponsorId || undefined,
        confidenceLevel: confidence,
        successCriteria,
        scopeIn: splitLines(scopeIn),
        scopeOut: splitLines(scopeOut),
        killCriteria: splitLines(killCriteria),
        keyRisks: splitLines(keyRisks),
        plannedStartDate: startDate || undefined,
        plannedEndDate: endDate || undefined,
        projectId: projectId || undefined,
        tags: [
          ...splitLines(tags.replace(/,/g, '\n')),
          `lever:${lever}`,
          `impact:${impact}`,
          `effort:${effort}`,
          `quadrant:${quadrant.key}`,
        ],
        sourceType: hasSource ? source?.sourceType || 'tool' : 'manual',
        sourceId: hasSource ? source?.sourceId : undefined,
        evidenceRefs: source?.evidenceRefs?.length ? source.evidenceRefs : undefined,
      };

      const result = await createInitiativeWriteTruth(payload);
      toast.success(tr('Utworzono draft inicjatywy', 'Initiative draft created'));
      onCreated?.({ createdId: result.createdId, created: result.created });
      onClose();
    } catch (err) {
      const e = err as { response?: { data?: { error?: unknown } }; message?: string };
      const msg =
        e?.response?.data?.error || e?.message || tr('Nie udało się utworzyć', 'Create failed');
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setCreating(false);
    }
  }, [
    creating,
    source,
    kpiName,
    kpiBaseline,
    kpiTarget,
    title,
    thesis,
    lever,
    quadrant,
    ownerId,
    sponsorId,
    confidence,
    scopeIn,
    scopeOut,
    killCriteria,
    keyRisks,
    startDate,
    endDate,
    projectId,
    tags,
    impact,
    effort,
    onCreated,
    onClose,
    tr,
  ]);

  // ── Step bodies ──────────────────────────────────────────────────────────

  const defineBody = (
    <div className="space-y-5">
      {source?.label && (
        <div className="flex items-center gap-2 rounded-xl border border-c-info/30 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-c-info/20 dark:bg-white/[0.05] dark:text-slate-300">
          <ShieldCheck size={14} className="shrink-0 text-[var(--c-info)]" />
          <span className="font-medium">{tr('Źródło:', 'Source:')}</span>
          <span className="truncate">{source.label}</span>
        </div>
      )}
      <div>
        <label className={labelCls}>{tr('Tytuł inicjatywy', 'Initiative title')} *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tr(
            'np. Standaryzacja procesu przekazań',
            'e.g. Standardize handoff process'
          )}
          className={inputCls}
        />
        {similarInitiatives.length > 0 && (
          <div className="mt-2 rounded-lg border border-amber-300/60 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 px-3 py-2">
            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mb-1">
              {tr(
                'Podobne inicjatywy już istnieją — sprawdź, czy nie duplikujesz:',
                'Similar initiatives already exist — check you are not duplicating:'
              )}
            </div>
            <ul className="space-y-0.5">
              {similarInitiatives.map((s) => (
                <li
                  key={s.id}
                  className="text-xs text-slate-700 dark:text-slate-200 flex items-center gap-2"
                >
                  <span className="truncate">{s.name}</span>
                  {s.status && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                      {s.status}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div>
        <label className={labelCls}>{tr('Teza / hipoteza', 'Thesis / hypothesis')}</label>
        <textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          rows={3}
          placeholder={tr(
            'Jeśli zrobimy X, oczekujemy Y, ponieważ Z.',
            'If we do X, we expect Y, because Z.'
          )}
          className={`${inputCls} resize-none`}
        />
        {cardIssues.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {cardIssues.map((iss) => (
              <li
                key={iss.rule}
                className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300"
              >
                <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                <span>{iss.message}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {tr(
            'Falsyfikowalna teza — co zrobimy, jaki efekt i dlaczego.',
            'A falsifiable thesis — what we do, the expected effect, and why.'
          )}
        </p>
      </div>
      <div>
        <label className={labelCls}>{tr('Dźwignia / typ', 'Lever / type')}</label>
        <SegmentedRow<Lever>
          value={lever}
          onChange={setLever}
          options={[
            { value: 'cost', label: tr('Redukcja kosztów', 'Cost reduction') },
            { value: 'growth', label: tr('Wzrost', 'Growth') },
            { value: 'risk', label: tr('Mitygacja ryzyka', 'Risk mitigation') },
            { value: 'capability', label: tr('Zdolność', 'Capability') },
            { value: 'compliance', label: tr('Compliance', 'Compliance') },
          ]}
        />
      </div>
      {(proposedCore.length > 0 || proposedExtra.length > 0) && (
        <div>
          <label className={labelCls}>
            {tr('Karty inicjatywy (propozycja AI)', 'Initiative cards (AI proposal)')}
          </label>
          <ProposedCardsPanel
            core={proposedCore}
            proposed={proposedExtra}
            selected={selectedCards}
            onToggle={toggleSelectedCard}
            loading={proposalLoading}
          />
        </div>
      )}
    </div>
  );

  const caseBody = (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{tr('Owner', 'Owner')} *</label>
          <Select
            value={ownerId}
            onChange={setOwnerId}
            options={userOptions}
            placeholder={tr('Wybierz odpowiedzialnego…', 'Select owner…')}
            aria-label={tr('Owner', 'Owner')}
          />
        </div>
        <div>
          <label className={labelCls}>{tr('Sponsor', 'Sponsor')}</label>
          <Select
            value={sponsorId}
            onChange={setSponsorId}
            options={userOptions}
            placeholder={tr('Opcjonalnie…', 'Optional…')}
            aria-label={tr('Sponsor', 'Sponsor')}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-navy-700/60 dark:bg-navy-950/30">
        <div className="mb-3 grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{tr('Wpływ (impact)', 'Impact')}</label>
            <SegmentedRow<Band>
              value={impact}
              onChange={setImpact}
              options={bandOptions('impact')}
            />
          </div>
          <div>
            <label className={labelCls}>{tr('Wysiłek (effort)', 'Effort')}</label>
            <SegmentedRow<Effort>
              value={effort}
              onChange={setEffort}
              options={[
                { value: 'S', label: tr('Mały', 'Small') },
                { value: 'M', label: tr('Średni', 'Medium') },
                { value: 'L', label: tr('Duży', 'Large') },
              ]}
            />
          </div>
        </div>
        <QuadrantMatrix impact={impact} effort={effort} isPolish={isPolish} />
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            {tr('Sugestia:', 'Suggestion:')}
          </span>
          <span className="rounded-md bg-navy-900 px-2 py-0.5 text-xs font-semibold text-white">
            {isPolish ? quadrant.pl : quadrant.en}
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {tr('priorytet', 'priority')}: {quadrant.priority}
          </span>
        </div>
      </div>

      <div>
        <label className={labelCls}>{tr('Pewność (confidence)', 'Confidence')}</label>
        <SegmentedRow<Band>
          value={confidence}
          onChange={setConfidence}
          options={bandOptions('confidence')}
        />
      </div>

      <div className="rounded-xl border border-c-info/30 bg-slate-50 p-3.5 dark:border-c-info/20 dark:bg-white/[0.05]">
        <label className={labelCls}>
          {tr('KPI #1 — miara sukcesu', 'KPI #1 — success metric')} *
        </label>
        <input
          type="text"
          value={kpiName}
          onChange={(e) => setKpiName(e.target.value)}
          placeholder={tr('np. Czas przekazania między działami', 'e.g. Cross-team handoff time')}
          className={`${inputCls} mb-2 bg-white dark:bg-navy-900`}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={kpiBaseline}
            onChange={(e) => setKpiBaseline(e.target.value)}
            placeholder={tr('Baseline (np. 45 min)', 'Baseline (e.g. 45 min)')}
            className={`${inputCls} bg-white dark:bg-navy-900`}
          />
          <input
            type="text"
            value={kpiTarget}
            onChange={(e) => setKpiTarget(e.target.value)}
            placeholder={tr('Cel (np. 15 min)', 'Target (e.g. 15 min)')}
            className={`${inputCls} bg-white dark:bg-navy-900`}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {tr(
            'Bez mierzalnego celu to życzenie, nie inicjatywa.',
            'Without a measurable target it is a wish, not an initiative.'
          )}
        </p>
      </div>
    </div>
  );

  const governBody = (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/50 bg-amber-50/70 px-3.5 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
        <Lock size={16} className="mt-0.5 shrink-0 text-amber-500" />
        <div className="text-sm">
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {tr('Tworzysz DRAFT', 'You are creating a DRAFT')}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <span className="rounded bg-slate-200/70 px-1.5 py-0.5 font-mono text-[11px] dark:bg-navy-800">
              DRAFT
            </span>
            <ArrowRight size={12} className="text-slate-400" />
            <span>{tr('Wyślij do review', 'Submit for review')}</span>
            <ArrowRight size={12} className="text-slate-400" />
            <span className="rounded bg-slate-200/70 px-1.5 py-0.5 font-mono text-[11px] dark:bg-navy-800">
              PENDING_REVIEW
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {tr(
              'Do modułu Inicjatyw (REVIEW) promuje PM / Lead / PMO — nie konsultant.',
              'Promotion to Initiatives (REVIEW) is done by PM / Lead / PMO — not the consultant.'
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{tr('Start (planowany)', 'Planned start')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{tr('Koniec (planowany)', 'Planned end')}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>{tr('Tagi', 'Tags')}</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={tr('rozdziel przecinkami', 'comma-separated')}
          className={inputCls}
        />
      </div>

      <Disclosure
        title={tr('Zaawansowane', 'Advanced')}
        count={advancedCount}
        open={advancedOpen}
        onToggle={() => setAdvancedOpen((v) => !v)}
      >
        <div>
          <label className={labelCls}>{tr('Zakres — w (scope in)', 'Scope — in')}</label>
          <textarea
            value={scopeIn}
            onChange={(e) => setScopeIn(e.target.value)}
            rows={2}
            placeholder={tr('jeden punkt na linię', 'one item per line')}
            className={`${inputCls} resize-none`}
          />
        </div>
        <div>
          <label className={labelCls}>{tr('Zakres — poza (scope out)', 'Scope — out')}</label>
          <textarea
            value={scopeOut}
            onChange={(e) => setScopeOut(e.target.value)}
            rows={2}
            placeholder={tr('jeden punkt na linię', 'one item per line')}
            className={`${inputCls} resize-none`}
          />
        </div>
        <div>
          <label className={labelCls}>
            {tr('Kryteria zatrzymania (kill criteria)', 'Kill criteria')}
          </label>
          <textarea
            value={killCriteria}
            onChange={(e) => setKillCriteria(e.target.value)}
            rows={2}
            placeholder={tr('jeden punkt na linię', 'one item per line')}
            className={`${inputCls} resize-none`}
          />
        </div>
        <div>
          <label className={labelCls}>{tr('Kluczowe ryzyka (RAID)', 'Key risks (RAID)')}</label>
          <textarea
            value={keyRisks}
            onChange={(e) => setKeyRisks(e.target.value)}
            rows={2}
            placeholder={tr('jeden punkt na linię', 'one item per line')}
            className={`${inputCls} resize-none`}
          />
        </div>
      </Disclosure>
    </div>
  );

  const steps: WizardStep[] = [
    {
      id: 'define',
      label: { pl: 'Definicja', en: 'Define' },
      hint: { pl: 'Co i z czego', en: 'What & from what' },
      status: step === 0 ? 'ready' : stepValid[0] ? 'complete' : 'empty',
      content: defineBody,
    },
    {
      id: 'case',
      label: { pl: 'Uzasadnij', en: 'Make the case' },
      hint: { pl: 'Wartość, wysiłek, KPI', en: 'Value, effort, KPI' },
      status: step === 1 ? 'ready' : step > 1 && stepValid[1] ? 'complete' : 'empty',
      content: caseBody,
    },
    {
      id: 'govern',
      label: { pl: 'Zarządź', en: 'Govern' },
      hint: { pl: 'Draft + bramka', en: 'Draft + gate' },
      optional: true,
      status: step === 2 ? 'ready' : 'empty',
      content: governBody,
    },
  ];

  return (
    <WizardModal
      open={isOpen}
      onClose={onClose}
      title={{ pl: 'Nowa inicjatywa', en: 'New initiative' }}
      steps={steps}
      activeStepIndex={step}
      onStepChange={setStep}
      onComplete={handleCreate}
      completing={creating}
      nextDisabled={nextDisabled}
      isPolish={isPolish}
      accentColor="rgb(99 102 241)"
    />
  );
};

export default InitiativeCharterWizard;
