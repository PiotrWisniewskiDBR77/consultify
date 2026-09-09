import { Check, Loader2, Sparkles, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatPlanSolverReason } from '../planSolverReason';

export type PlanGenerationMode = 'DEPENDENCIES' | 'CAPACITY' | 'MIXED';

/** Inicjatywa MODUŁU kwalifikująca się do planowania (kwalifikację liczy serwer). */
export interface GeneratorInitiative {
  id: string;
  name: string;
  status: 'APPROVED' | 'PENDING_APPROVAL';
  conditional: boolean;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
}
export interface GeneratorPlanInput {
  initiativeIds: string[];
  allowConditional: boolean;
  start: string;
  periods: number;
  unit: 'WEEK' | 'MONTH';
  mode: PlanGenerationMode;
}
/** Wiersz propozycji solvera pokazywany PRZED „Zatwierdź" (P15 §4.0 D5). */
export interface GeneratorProposalRow {
  initiativeId: string;
  name: string;
  from: string;
  to: string;
  rationale: string;
  conflict: string | null;
}

/**
 * GENERATOR PLANU — P15-K2 (DEC-421), decyzje D1' i D5.
 *
 * POMIAR 07.09: krok 2 pokazywał WSZYSTKIE 72 inicjatywy modułu, a `PlanCard.tsx:38`
 * wyrzucał wybór i horyzont (`onGenerate={(input) => onAnalyze(input.mode)}`) — solver
 * dostawał zawsze okna z seedu. Krok 5 renderował „Zatwierdź/Odrzuć" bez ani jednego
 * wiersza propozycji, więc człowiek zatwierdzał coś, czego nie widział.
 *
 * Teraz: krok 1 nazywa ŹRÓDŁO liczbami, krok 2 daje do zaznaczenia WYŁĄCZNIE
 * kwalifikujące się inicjatywy, krok 4 wysyła wybór i parametry, a krok 5 odsłania
 * się dopiero pod tabelą propozycji.
 */
export function GeneratorPlanuModal({
  open,
  plannable,
  busy,
  proposal,
  proposalConflicts,
  resolveName,
  savedLabel,
  onClose,
  onGenerate,
  onReview,
  capacityModesBlockedReason = null,
}: {
  open: boolean;
  plannable: GeneratorInitiative[];
  busy?: boolean;
  /**
   * P15-K7 pkt 2 (DEC-421): powód, dla którego tryby zależne od MOCY są
   * niedostępne. Do K5 wybór „Według obciążenia ról" bez powiązanej
   * opublikowanej analizy przechodził po cichu w tryb zależności — plan
   * układał się BEZ mocy, a użytkownik o tym nie wiedział. Powód widać
   * ZANIM się kliknie, a serwer i tak odmawia regułą CAPACITY_SCENARIO_REQUIRED.
   */
  capacityModesBlockedReason?: string | null;
  proposal?: GeneratorProposalRow[] | null;
  proposalConflicts?: string[];
  /**
   * Zamienia identyfikator inicjatywy na jej nazwę wewnątrz uzasadnień solvera
   * (np. ścieżka cyklu zależności) — TEN SAM `nameOf`, który karta planu buduje
   * z `initiatives` + `plannable` (patrz `PlanCard.tsx`). Bez propa spada na
   * identity (surowy UUID zamiast nazwy — defekt K28, nie brak tłumaczenia).
   */
  resolveName?: (initiativeId: string) => string;
  /** „Zapisano hh:mm" — znacznik z ODPOWIEDZI serwera po zatwierdzeniu propozycji. */
  savedLabel?: string | null;
  onClose: () => void;
  onGenerate: (input: GeneratorPlanInput) => void;
  onReview: (outcome: 'ACCEPT' | 'REJECT') => void;
}) {
  const { t } = useTranslation();
  const nameOf = resolveName ?? ((id: string) => id);
  const [allowConditional, setAllowConditional] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [periods, setPeriods] = useState(12);
  const [unit, setUnit] = useState<'WEEK' | 'MONTH'>('WEEK');
  const [mode, setMode] = useState<PlanGenerationMode>('DEPENDENCIES');
  // Tryb zablokowany nie może zostać wybrany „z pamięci" po zmianie stanu planu.
  useEffect(() => {
    if (capacityModesBlockedReason && mode !== 'DEPENDENCIES') setMode('DEPENDENCIES');
  }, [capacityModesBlockedReason, mode]);
  const approved = useMemo(() => plannable.filter((item) => !item.conditional), [plannable]);
  const conditional = useMemo(() => plannable.filter((item) => item.conditional), [plannable]);
  const visible = allowConditional ? plannable : approved;
  useEffect(() => {
    if (allowConditional) return;
    setSelected((current) => {
      const allowed = new Set(approved.map((item) => item.id));
      const next = new Set([...current].filter((id) => allowed.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [allowConditional, approved]);
  if (!open) return null;
  const stepClass = 'rounded-xl border border-c-border-subtle bg-c-surface p-4';
  const buttonClass =
    'inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50';
  const statusLabel = (item: GeneratorInitiative) =>
    item.conditional
      ? t('initiatives.planGenerator.statusPending', 'Pending approval')
      : t('initiatives.planGenerator.statusApproved', 'Approved');
  // ZMIERZONE 07.09 (evidence/p15-k2/przeplyw/06-…): `bg-c-overlay/60` i
  // `bg-c-background` NIE ISTNIEJĄ w skali tokenów (tailwind.config.js `c:` ma
  // `bg`/`surface`/`surface-raised`, nie `overlay`/`background`), więc okno
  // generatora było PRZEZROCZYSTE — treść strony przebijała przez sekcje.
  // Ta sama zasłona, co dialog publikacji planu w `PlanScenarioSurface`.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('initiatives.planGenerator.title', 'Plan generator')}
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-6"
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl border border-c-border bg-c-surface p-5 text-c-text shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t('initiatives.planGenerator.title', 'Plan generator')}
          </h2>
          <button
            className="rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-3">
          <section className={stepClass}>
            <h3 className="font-semibold">
              {t('initiatives.planGenerator.step1', '1. Source')}
            </h3>
            <p className="text-sm text-c-text-muted">
              {t('initiatives.planGenerator.sourceApproved', {
                defaultValue: 'Zatwierdzone inicjatywy ({{n}})',
                n: approved.length,
              })}
            </p>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowConditional}
                onChange={(event) => setAllowConditional(event.target.checked)}
              />
              {t('initiatives.planGenerator.sourceConditional', {
                defaultValue: '+ do zatwierdzenia ({{n}})',
                n: conditional.length,
              })}
            </label>
          </section>
          <section className={stepClass}>
            <h3 className="font-semibold">{t('initiatives.planGenerator.step2', '2. Selection')}</h3>
            {visible.length ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {visible.map((item) => (
                  <label key={item.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={(event) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(item.id);
                          else next.delete(item.id);
                          return next;
                        })
                      }
                    />
                    <span>
                      {item.name}
                      <span className="ml-1 text-c-text-muted">· {statusLabel(item)}</span>
                      {item.conditional && (
                        <span className="ml-2 rounded-full border border-c-border px-2 py-0.5 text-xs">
                          {t('initiatives.planGenerator.conditionalChip', 'conditional')}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-c-text-muted">
                {t(
                  'initiatives.planGenerator.noneEligible',
                  'No initiative qualifies for planning.'
                )}
              </p>
            )}
          </section>
          <section className={stepClass}>
            <h3 className="font-semibold">
              {t('initiatives.planGenerator.step3', '3. Parameters')}
            </h3>
            <div className="mt-2 flex flex-wrap gap-3">
              <input
                aria-label={t('initiatives.planGenerator.startAria', 'Horizon start')}
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
              <input
                aria-label={t('initiatives.planGenerator.periodsAria', 'Number of periods')}
                type="number"
                min={1}
                max={104}
                value={periods}
                onChange={(event) => setPeriods(Number(event.target.value))}
              />
              <select
                aria-label={t('initiatives.planGenerator.unitAria', 'Unit')}
                value={unit}
                onChange={(event) => setUnit(event.target.value as 'WEEK' | 'MONTH')}
              >
                <option value="WEEK">{t('initiatives.planScenario.form.weekOption')}</option>
                <option value="MONTH">{t('initiatives.planScenario.form.monthOption')}</option>
              </select>
              <select
                aria-label={t('initiatives.planGenerator.modeAria', 'Analysis mode')}
                value={mode}
                onChange={(event) => setMode(event.target.value as PlanGenerationMode)}
              >
                <option value="DEPENDENCIES">
                  {t('initiatives.planGenerator.modeDependencies', 'By dependencies')}
                </option>
                <option value="CAPACITY" disabled={Boolean(capacityModesBlockedReason)}>
                  {t('initiatives.planGenerator.modeCapacity', 'By role capacity')}
                </option>
                <option value="MIXED" disabled={Boolean(capacityModesBlockedReason)}>
                  {t('initiatives.planGenerator.modeMixed', 'Mixed')}
                </option>
              </select>
            </div>
            {capacityModesBlockedReason && (
              <p role="status" className="mt-2 text-sm text-c-text-muted">
                {capacityModesBlockedReason}
              </p>
            )}
          </section>
          <section className={stepClass}>
            <h3 className="font-semibold">{t('initiatives.planGenerator.step4', '4. Generate')}</h3>
            <button
              disabled={busy || !selected.size}
              className={`mt-2 ${buttonClass}`}
              onClick={() =>
                onGenerate({
                  initiativeIds: [...selected],
                  allowConditional,
                  start,
                  periods,
                  unit,
                  mode,
                })
              }
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {t('initiatives.planGenerator.generate', 'Generate proposal')}
            </button>
            {proposal && proposal.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table /* §27-exempt: read-only podglad propozycji w oknie decyzji (4 kolumny, bez sortowania/filtrow/kebaba) — nie jest przegladana lista encji, ktora kanon TRIADA oddaje StandardTable */ className="w-full text-sm" aria-label={t('initiatives.planGenerator.proposalAria', 'Proposed sequence')}>
                  <thead>
                    <tr className="text-left text-c-text-muted">
                      <th className="py-1 pr-3">
                        {t('initiatives.planGenerator.columnInitiative', 'Initiative')}
                      </th>
                      <th className="py-1 pr-3">
                        {t('initiatives.planGenerator.columnWindow', 'Window from–to')}
                      </th>
                      <th className="py-1 pr-3">
                        {t('initiatives.planGenerator.columnRationale', 'Justification')}
                      </th>
                      <th className="py-1">
                        {t('initiatives.planGenerator.columnConflict', 'Conflict')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposal.map((row) => (
                      <tr key={row.initiativeId} className="border-t border-c-border-subtle align-top">
                        <td className="py-1 pr-3">{row.name}</td>
                        <td className="py-1 pr-3 whitespace-nowrap">
                          {row.from} – {row.to}
                        </td>
                        <td className="py-1 pr-3">{formatPlanSolverReason(row.rationale, t, nameOf)}</td>
                        <td className="py-1">
                          {row.conflict
                            ? formatPlanSolverReason(row.conflict, t, nameOf)
                            : t('common.none', 'none')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(proposalConflicts ?? []).length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-sm">
                    {(proposalConflicts ?? []).map((conflict) => (
                      <li key={conflict}>{formatPlanSolverReason(conflict, t, nameOf)}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {proposal && proposal.length === 0 && (
              <p className="mt-3 text-sm text-c-text-muted">
                {t(
                  'initiatives.planGenerator.emptyProposal',
                  'The solver proposed no window change.'
                )}
              </p>
            )}
          </section>
          <section className={stepClass}>
            <h3 className="font-semibold">
              {t('initiatives.planGenerator.step5', '5. Approve')}
            </h3>
            <p className="text-sm text-c-text-muted">
              {t(
                'initiatives.planGenerator.reviewHint',
                'A proposal never changes the plan without a human decision.'
              )}
            </p>
            {proposal && (
              <div className="mt-2 flex gap-2">
                <button className={buttonClass} disabled={busy} onClick={() => onReview('ACCEPT')}>
                  <Check size={16} />
                  {t('initiatives.planGenerator.accept', 'Approve')}
                </button>
                <button className={buttonClass} disabled={busy} onClick={() => onReview('REJECT')}>
                  {t('initiatives.planGenerator.reject', 'Reject')}
                </button>
              </div>
            )}
            {savedLabel && (
              <p className="mt-2 text-sm" role="status">
                {savedLabel}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
