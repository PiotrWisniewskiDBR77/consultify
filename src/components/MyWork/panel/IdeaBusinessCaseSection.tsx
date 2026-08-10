/**
 * IdeaBusinessCaseSection — "Karta biznesowa" / "Business case", Program D /
 * epic E08.
 *
 * SSOT: docs/qa/ideas-manual-audit-2026-08-09/09_IDEAS_COMPLETE_TRANSFORMATION_PROGRAM_FOR_CLAUDE.md
 * §6.2 + 11_IDEAS_EPICS_DOD_AND_FINAL_ACCEPTANCE_PROTOCOL.md epic E08.
 *
 * PLACEMENT: embedded inside the Przegląd tab of `IdeaWorkspaceTools.tsx`
 * (07_PRAWY_PANEL.md §4 — "Czym jest ten obiekt jako całość?"). The business
 * case answers exactly that question at greater depth than the existing
 * Problem/Status cards, so it lives as one more collapsible card in the SAME
 * tab rather than a sixth top-level tab — chapter 07's five-tab contract
 * (Przegląd · Właściwości · Powiązania · Komentarze · Historia) is fixed and
 * this program has no mandate to add a sixth. See task report for the
 * explicit placement argument.
 *
 * Gated by `isIdeaBusinessCaseEnabled()` — default OFF (CLAUDE.md rule #7,
 * Piotr is never the first visual tester).
 *
 * EVIDENCE SECTION REUSE: the "evidence, assumptions and evidence gaps"
 * §6.2 bullet is rendered by embedding the EXISTING `EvidencePanelSection`
 * (artifactType 'canvas', artifactId = ideaId) — the same envelope the panel
 * already surfaces via `IdeaRightPanel`'s `evidenceArtifactId` prop. Nothing
 * about evidence storage is duplicated here.
 *
 * UNSUPPORTED CLAIMS: every section's claim list requires a `status` — a
 * claim marked `evidence_gap` or `unsupported` always renders as
 * "Potrzebne dowody" / "Evidence needed" (never the claim text presented as
 * settled fact) per master program §8.2 ("Missing evidence should produce
 * `Evidence needed`, not fabricated specificity").
 *
 * NO AI GENERATION WIRED: this task builds the schema, storage and
 * inspection/editing surface. Nothing here calls an LLM to draft section
 * content — `meta.authoredBy` and the claim-status model exist so that a
 * future AI-drafting feature has somewhere honest to put its output (marked
 * `ai_draft`, citing sources via `lineage`, flagging gaps via `claims`), but
 * wiring an actual generator is out of this task's scope (see report).
 */
import { AlertTriangle, Link2, Plus, Save, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EvidencePanelSection } from '@/components/standard/EvidencePanelSection';
import {
  BUSINESS_CASE_SECTION_ORDER,
  type BusinessCaseAlternative,
  type BusinessCaseClaim,
  type BusinessCaseClaimStatus,
  type BusinessCaseCostItem,
  type BusinessCaseKpi,
  type BusinessCaseMilestone,
  type BusinessCaseRisk,
  type BusinessCaseSourceRef,
  type BusinessCaseStakeholder,
  type IdeaBusinessCaseSections,
} from '@/types/ideaBusinessCase';

import type { CanvasToolType, IdeaWorkspaceSelection } from '../ideaSelectionTypes';
import { isSectionFilled, useIdeaBusinessCase } from './useIdeaBusinessCase';

const INPUT_CLASS =
  'w-full h-8 px-2.5 rounded-md text-[11px] bg-c-surface border border-c-border-subtle text-c-text placeholder:text-c-text-muted focus:outline-none focus:border-c-focus transition-colors';
const TEXTAREA_CLASS =
  'w-full px-2.5 py-2 rounded-md text-[11px] bg-c-surface border border-c-border-subtle text-c-text placeholder:text-c-text-muted focus:outline-none focus:border-c-focus transition-colors resize-none';
const LABEL_CLASS = 'text-[9.5px] font-bold uppercase tracking-wide text-c-text-muted mb-1 block';

const CLAIM_STATUS_LABEL: Record<BusinessCaseClaimStatus, { pl: string; en: string }> = {
  fact: { pl: 'Fakt', en: 'Fact' },
  assumption: { pl: 'Założenie', en: 'Assumption' },
  evidence_gap: { pl: 'Potrzebne dowody', en: 'Evidence needed' },
  unsupported: { pl: 'Niepotwierdzone', en: 'Unsupported' },
};

const CLAIM_STATUS_CLASS: Record<BusinessCaseClaimStatus, string> = {
  fact: 'bg-c-success/10 text-c-success',
  assumption: 'bg-c-tag-4 text-c-tag-foreground',
  evidence_gap: 'bg-c-surface-raised text-c-text-muted border border-c-border-subtle',
  unsupported: 'bg-c-warning/10 text-c-warning',
};

// ─────────────────────────── shared small pieces ───────────────────────────

const SubCard: React.FC<{
  title: string;
  complete: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, complete, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-[10px] border border-c-border-subtle bg-c-surface overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-c-surface-raised transition-colors"
      >
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${complete ? 'bg-c-success' : 'bg-c-border-subtle'}`}
          aria-hidden
        />
        <span className="flex-1 text-[11px] font-semibold text-c-text truncate">{title}</span>
        <span className="text-[10px] text-c-text-muted">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-2.5">{children}</div>}
    </div>
  );
};

const SaveRow: React.FC<{
  isPolish: boolean;
  saving: boolean;
  savedFlash: boolean;
  onSave: () => void;
}> = ({ isPolish, saving, savedFlash, onSave }) => (
  <div className="flex items-center gap-2 pt-1">
    <button
      onClick={onSave}
      disabled={saving}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-c-text text-c-surface hover:opacity-90 disabled:opacity-40 transition-opacity"
    >
      <Save size={11} />
      {saving
        ? isPolish
          ? 'Zapisywanie…'
          : 'Saving…'
        : isPolish
          ? 'Zapisz sekcję'
          : 'Save section'}
    </button>
    {savedFlash && (
      <span className="text-[10px] text-c-success">{isPolish ? 'Zapisano' : 'Saved'}</span>
    )}
  </div>
);

function nodeLabel(node: any): string {
  return node?.data?.label || node?.label || String(node?.id || '');
}

/**
 * Builds the shared `ActionContext` for the two lineage-editor registry
 * entries (`idea.workspace.business_case_lineage_add`/`_remove`) — same
 * shape as `IdeaBusinessCaseSection`'s own `save()` (surface 'panel',
 * source 'ui', `params.run` carries the real mutation). Section identity is
 * NOT threaded through (the widget is shared across 13 sections, patched
 * generically by the caller's `onAdd`/`onRemove` closure) — see the registry
 * entries' comments for why that stays UI-only for now.
 */
function buildLineageActionContext(
  ideaId: string,
  tool: CanvasToolType,
  selection: IdeaWorkspaceSelection,
  isPolish: boolean,
  run: () => void
): ActionContext {
  return {
    ideaId,
    tool,
    selection,
    surface: 'panel',
    source: 'ui',
    language: isPolish ? 'pl' : 'en',
    params: { run },
  };
}

/** Picker for linking a section/claim to a real node in the current graph — real lineage, not a fake id. */
const NodeRefPicker: React.FC<{
  ideaId: string;
  tool: CanvasToolType;
  selection: IdeaWorkspaceSelection;
  graphNodes: any[];
  isPolish: boolean;
  onAdd: (ref: BusinessCaseSourceRef) => void;
}> = ({ ideaId, tool, selection, graphNodes, isPolish, onAdd }) => {
  const [selected, setSelected] = useState('');
  if (!graphNodes.length) return null;
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className={`${INPUT_CLASS} flex-1`}
      >
        <option value="">
          {isPolish ? '— wybierz element do powiązania —' : '— pick an element to link —'}
        </option>
        {graphNodes.map((n) => (
          <option key={String(n.id)} value={String(n.id)}>
            {nodeLabel(n)}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selected}
        onClick={() => {
          void runIdeaAction(
            'idea.workspace.business_case_lineage_add',
            buildLineageActionContext(ideaId, tool, selection, isPolish, () => {
              const node = graphNodes.find((n) => String(n.id) === selected);
              if (!node) return;
              onAdd({ kind: 'node', refId: selected, label: nodeLabel(node) });
              setSelected('');
            })
          );
        }}
        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-c-surface-raised text-c-text-muted hover:text-c-text disabled:opacity-30 transition-colors"
        title={isPolish ? 'Powiąż' : 'Link'}
      >
        <Link2 size={12} />
      </button>
    </div>
  );
};

const LineageChips: React.FC<{
  ideaId: string;
  tool: CanvasToolType;
  selection: IdeaWorkspaceSelection;
  lineage: BusinessCaseSourceRef[];
  isPolish: boolean;
  onRemove: (idx: number) => void;
}> = ({ ideaId, tool, selection, lineage, isPolish, onRemove }) => {
  if (!lineage.length) {
    return (
      <p className="text-[10px] italic text-c-text-muted">
        {isPolish
          ? 'Brak powiązania z elementem Idei.'
          : 'Not linked to an idea element yet.'}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {lineage.map((ref, idx) => (
        <span
          key={`${ref.kind}-${ref.refId}-${idx}`}
          className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-medium bg-c-tag-2 text-c-tag-foreground"
          title={`${ref.kind}: ${ref.refId}`}
        >
          <Link2 size={9} />
          <span className="truncate max-w-[120px]">{ref.label || ref.refId}</span>
          <button
            type="button"
            onClick={() => {
              void runIdeaAction(
                'idea.workspace.business_case_lineage_remove',
                buildLineageActionContext(ideaId, tool, selection, isPolish, () => onRemove(idx))
              );
            }}
            className="opacity-70 hover:opacity-100"
            aria-label={isPolish ? 'Usuń powiązanie' : 'Remove link'}
          >
            <X size={9} />
          </button>
        </span>
      ))}
    </div>
  );
};

/** Section-level lineage editor — the "links back to originating elements" requirement, made concrete. */
const LineageEditor: React.FC<{
  ideaId: string;
  tool: CanvasToolType;
  selection: IdeaWorkspaceSelection;
  lineage: BusinessCaseSourceRef[];
  graphNodes: any[];
  isPolish: boolean;
  onChange: (next: BusinessCaseSourceRef[]) => void;
}> = ({ ideaId, tool, selection, lineage, graphNodes, isPolish, onChange }) => (
  <div className="space-y-1.5">
    <span className={LABEL_CLASS}>
      {isPolish ? 'Powiązane elementy Idei' : 'Linked idea elements'}
    </span>
    <LineageChips
      ideaId={ideaId}
      tool={tool}
      selection={selection}
      lineage={lineage}
      isPolish={isPolish}
      onRemove={(idx) => onChange(lineage.filter((_, i) => i !== idx))}
    />
    <NodeRefPicker
      ideaId={ideaId}
      tool={tool}
      selection={selection}
      graphNodes={graphNodes}
      isPolish={isPolish}
      onAdd={(ref) => onChange([...lineage, ref])}
    />
  </div>
);

/** Fact/assumption/evidence-gap/unsupported claim list — keeps the four distinct (doc 11 §3.5). */
const ClaimsEditor: React.FC<{
  claims: BusinessCaseClaim[];
  graphNodes: any[];
  isPolish: boolean;
  onChange: (next: BusinessCaseClaim[]) => void;
}> = ({ claims, graphNodes, isPolish, onChange }) => {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<BusinessCaseClaimStatus>('fact');
  const [refId, setRefId] = useState('');

  const add = () => {
    if (!text.trim()) return;
    const node = graphNodes.find((n) => String(n.id) === refId);
    const lineage: BusinessCaseSourceRef[] = node
      ? [{ kind: 'node', refId, label: nodeLabel(node) }]
      : [];
    const next: BusinessCaseClaim = {
      id: `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: text.trim(),
      status,
      lineage,
      unsupportedReason:
        status === 'unsupported'
          ? isPolish
            ? 'Dodane ręcznie bez powiązanego dowodu.'
            : 'Added manually without a linked source.'
          : undefined,
    };
    onChange([...claims, next]);
    setText('');
    setRefId('');
  };

  return (
    <div className="space-y-2">
      <span className={LABEL_CLASS}>{isPolish ? 'Twierdzenia' : 'Claims'}</span>
      {claims.length > 0 && (
        <div className="space-y-1.5">
          {claims.map((c, idx) => (
            <div
              key={c.id}
              className="flex items-start gap-2 rounded-md border border-c-border-subtle bg-c-surface px-2 py-1.5"
            >
              <span
                className={`shrink-0 inline-flex items-center h-5 px-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${CLAIM_STATUS_CLASS[c.status]}`}
              >
                {isPolish ? CLAIM_STATUS_LABEL[c.status].pl : CLAIM_STATUS_LABEL[c.status].en}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-c-text break-words">
                  {c.status === 'evidence_gap' || c.status === 'unsupported' ? (
                    <span className="italic text-c-text-muted">
                      {isPolish ? 'Potrzebne dowody: ' : 'Evidence needed: '}
                      {c.text}
                    </span>
                  ) : (
                    c.text
                  )}
                </p>
                {c.lineage.length > 0 && (
                  <span className="text-[9.5px] text-c-text-muted">
                    ↳ {c.lineage.map((r) => r.label || r.refId).join(', ')}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onChange(claims.filter((_, i) => i !== idx))}
                className="shrink-0 text-c-text-muted hover:text-c-danger"
                aria-label={isPolish ? 'Usuń' : 'Remove'}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1.5 rounded-md border border-dashed border-c-border-subtle p-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isPolish ? 'Treść twierdzenia…' : 'Claim text…'}
          rows={2}
          className={TEXTAREA_CLASS}
        />
        <div className="flex items-center gap-1.5">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BusinessCaseClaimStatus)}
            className={`${INPUT_CLASS} flex-1`}
          >
            {(Object.keys(CLAIM_STATUS_LABEL) as BusinessCaseClaimStatus[]).map((s) => (
              <option key={s} value={s}>
                {isPolish ? CLAIM_STATUS_LABEL[s].pl : CLAIM_STATUS_LABEL[s].en}
              </option>
            ))}
          </select>
          {graphNodes.length > 0 && (
            <select
              value={refId}
              onChange={(e) => setRefId(e.target.value)}
              className={`${INPUT_CLASS} flex-1`}
            >
              <option value="">{isPolish ? '— źródło (opcjonalnie) —' : '— source (optional) —'}</option>
              {graphNodes.map((n) => (
                <option key={String(n.id)} value={String(n.id)}>
                  {nodeLabel(n)}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={add}
            disabled={!text.trim()}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-semibold bg-c-surface-raised text-c-text hover:bg-c-border-subtle disabled:opacity-30 transition-colors shrink-0"
          >
            <Plus size={11} />
            {isPolish ? 'Dodaj' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Small "+ row / remove row" list editor, reused for all §6.2 repeated-row sections. */
function RowList<T>({
  rows,
  onChange,
  newRow,
  renderRow,
  addLabel,
}: {
  rows: T[];
  onChange: (next: T[]) => void;
  // NoInfer keeps `rows: T[]` as the ONLY inference site for T. Without it,
  // a `newRow` whose literal happens to be structurally compatible in both
  // directions with the full row type (e.g. `{ metric: '' }` vs
  // `BusinessCaseBaselineMetric`, where every other field is optional) lets
  // TS pick that narrower fresh-literal shape for T instead of the full row
  // type — silently dropping 'value'/'unit'/'source'/'impact' from every
  // `update()` call's accepted patch shape (see
  // __tests__/IdeaBusinessCaseSection.roundtrip.test.tsx for the round-trip
  // coverage guarding this).
  newRow: () => NoInfer<T>;
  renderRow: (row: T, update: (patch: Partial<T>) => void) => React.ReactNode;
  addLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      {rows.map((row, idx) => (
        <div
          key={idx}
          className="flex items-start gap-1.5 rounded-md border border-c-border-subtle bg-c-surface p-2"
        >
          <div className="flex-1 min-w-0 grid grid-cols-2 gap-1.5">
            {renderRow(row, (patch) => {
              const next = rows.slice();
              next[idx] = { ...row, ...patch };
              onChange(next);
            })}
          </div>
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, i) => i !== idx))}
            className="shrink-0 mt-0.5 text-c-text-muted hover:text-c-danger"
          >
            <Trash2 size={11} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, newRow()])}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors"
      >
        <Plus size={11} />
        {addLabel}
      </button>
    </div>
  );
}

// ─────────────────────────── main component ───────────────────────────

export interface IdeaBusinessCaseSectionProps {
  ideaId: string;
  tool: CanvasToolType;
  selection: IdeaWorkspaceSelection;
  graphNodes: any[];
  isPolish: boolean;
}

export const IdeaBusinessCaseSection: React.FC<IdeaBusinessCaseSectionProps> = ({
  ideaId,
  tool,
  selection,
  graphNodes,
  isPolish,
}) => {
  const { businessCase, loading, saving, loadError, filledSectionCount, saveSection } =
    useIdeaBusinessCase(ideaId, true);
  const [savedFlashKey, setSavedFlashKey] = useState<string | null>(null);

  // Local editable draft per section, seeded from the loaded case. Kept as
  // one state object keyed by section so switching cards doesn't lose edits.
  const [draft, setDraft] = useState(businessCase.sections);
  const draftRef = React.useRef(draft);
  draftRef.current = draft;

  React.useEffect(() => {
    setDraft(businessCase.sections);
  }, [businessCase.updatedAt]);

  const patchSection = <K extends keyof IdeaBusinessCaseSections>(
    key: K,
    updater: (
      section: IdeaBusinessCaseSections[K]
    ) => IdeaBusinessCaseSections[K]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: updater(prev[key]) }));
  };

  const save = async <K extends keyof IdeaBusinessCaseSections>(key: K) => {
    const section = draftRef.current[key];
    const ctx: ActionContext = {
      ideaId,
      tool,
      selection,
      surface: 'panel',
      source: 'ui',
      language: isPolish ? 'pl' : 'en',
      params: {
        run: async () => {
          await saveSection(key, {
            content: section.content,
            lineage: section.lineage,
            claims: section.claims,
          });
        },
      },
    };
    await runIdeaAction('idea.workspace.business_case_save', ctx);
    setSavedFlashKey(String(key));
    window.setTimeout(() => setSavedFlashKey((k) => (k === String(key) ? null : k)), 2000);
  };

  const progressLabel = isPolish
    ? `${filledSectionCount} z ${BUSINESS_CASE_SECTION_ORDER.length} sekcji rozpoczętych`
    : `${filledSectionCount} of ${BUSINESS_CASE_SECTION_ORDER.length} sections started`;

  if (loading) {
    return (
      <p className="text-[11px] text-c-text-muted italic">
        {isPolish ? 'Wczytywanie karty biznesowej…' : 'Loading business case…'}
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-c-text-muted">{progressLabel}</span>
        {loadError && (
          <span className="inline-flex items-center gap-1 text-[10px] text-c-warning">
            <AlertTriangle size={10} />
            {isPolish ? 'Nie udało się wczytać — pokazano pusty szkic.' : "Couldn't load — showing an empty draft."}
          </span>
        )}
      </div>

      {/* 1. Problem & baseline */}
      <SubCard
        title={isPolish ? '1. Problem i punkt odniesienia' : '1. Problem & baseline'}
        complete={isSectionFilled('problemBaseline', draft.problemBaseline.content)}
      >
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Opis problemu' : 'Problem statement'}</span>
          <textarea
            value={draft.problemBaseline.content.problemStatement}
            onChange={(e) =>
              patchSection('problemBaseline', (s) => ({
                ...s,
                content: { ...s.content, problemStatement: e.target.value },
              }))
            }
            rows={3}
            className={TEXTAREA_CLASS}
          />
        </label>
        <div>
          <span className={LABEL_CLASS}>{isPolish ? 'Punkt odniesienia' : 'Baseline'}</span>
          <RowList
            rows={draft.problemBaseline.content.baseline}
            addLabel={isPolish ? 'Dodaj miernik' : 'Add metric'}
            newRow={() => ({ metric: '' })}
            onChange={(rows) =>
              patchSection('problemBaseline', (s) => ({
                ...s,
                content: { ...s.content, baseline: rows },
              }))
            }
            renderRow={(row, update) => (
              <>
                <input
                  className={INPUT_CLASS}
                  placeholder={isPolish ? 'Miernik' : 'Metric'}
                  value={row.metric}
                  onChange={(e) => update({ metric: e.target.value })}
                />
                <input
                  className={INPUT_CLASS}
                  placeholder={isPolish ? 'Wartość' : 'Value'}
                  value={row.value || ''}
                  onChange={(e) => update({ value: e.target.value })}
                />
                <input
                  className={INPUT_CLASS}
                  placeholder={isPolish ? 'Jednostka' : 'Unit'}
                  value={row.unit || ''}
                  onChange={(e) => update({ unit: e.target.value })}
                />
                <input
                  className={INPUT_CLASS}
                  placeholder={isPolish ? 'Źródło' : 'Source'}
                  value={row.source || ''}
                  onChange={(e) => update({ source: e.target.value })}
                />
              </>
            )}
          />
        </div>
        <LineageEditor
          ideaId={ideaId}
          tool={tool}
          selection={selection}
          lineage={draft.problemBaseline.lineage}
          graphNodes={graphNodes}
          isPolish={isPolish}
          onChange={(lineage) => patchSection('problemBaseline', (s) => ({ ...s, lineage }))}
        />
        <ClaimsEditor
          claims={draft.problemBaseline.claims}
          graphNodes={graphNodes}
          isPolish={isPolish}
          onChange={(claims) => patchSection('problemBaseline', (s) => ({ ...s, claims }))}
        />
        <SaveRow
          isPolish={isPolish}
          saving={saving}
          savedFlash={savedFlashKey === 'problemBaseline'}
          onSave={() => void save('problemBaseline')}
        />
      </SubCard>

      {/* 2. Strategic objective & expected outcome */}
      <SubCard
        title={isPolish ? '2. Cel strategiczny i oczekiwany rezultat' : '2. Strategic objective & outcome'}
        complete={isSectionFilled('strategicObjective', draft.strategicObjective.content)}
      >
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Cel' : 'Objective'}</span>
          <textarea
            value={draft.strategicObjective.content.objective}
            onChange={(e) =>
              patchSection('strategicObjective', (s) => ({
                ...s,
                content: { ...s.content, objective: e.target.value },
              }))
            }
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </label>
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Oczekiwany rezultat' : 'Expected outcome'}</span>
          <textarea
            value={draft.strategicObjective.content.expectedOutcome}
            onChange={(e) =>
              patchSection('strategicObjective', (s) => ({
                ...s,
                content: { ...s.content, expectedOutcome: e.target.value },
              }))
            }
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </label>
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Horyzont' : 'Horizon'}</span>
          <input
            className={INPUT_CLASS}
            value={draft.strategicObjective.content.horizon || ''}
            onChange={(e) =>
              patchSection('strategicObjective', (s) => ({
                ...s,
                content: { ...s.content, horizon: e.target.value },
              }))
            }
          />
        </label>
        <LineageEditor
          ideaId={ideaId}
          tool={tool}
          selection={selection}
          lineage={draft.strategicObjective.lineage}
          graphNodes={graphNodes}
          isPolish={isPolish}
          onChange={(lineage) => patchSection('strategicObjective', (s) => ({ ...s, lineage }))}
        />
        <SaveRow
          isPolish={isPolish}
          saving={saving}
          savedFlash={savedFlashKey === 'strategicObjective'}
          onSave={() => void save('strategicObjective')}
        />
      </SubCard>

      {/* 3. Stakeholders & affected processes */}
      <SubCard
        title={isPolish ? '3. Interesariusze i procesy' : '3. Stakeholders & processes'}
        complete={isSectionFilled('stakeholdersProcesses', draft.stakeholdersProcesses.content)}
      >
        <span className={LABEL_CLASS}>{isPolish ? 'Interesariusze' : 'Stakeholders'}</span>
        <RowList
          rows={draft.stakeholdersProcesses.content.stakeholders}
          addLabel={isPolish ? 'Dodaj interesariusza' : 'Add stakeholder'}
          newRow={(): BusinessCaseStakeholder => ({ name: '', stance: 'unknown' })}
          onChange={(rows) =>
            patchSection('stakeholdersProcesses', (s) => ({
              ...s,
              content: { ...s.content, stakeholders: rows },
            }))
          }
          renderRow={(row, update) => (
            <>
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Nazwa' : 'Name'}
                value={row.name}
                onChange={(e) => update({ name: e.target.value })}
              />
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Rola' : 'Role'}
                value={row.role || ''}
                onChange={(e) => update({ role: e.target.value })}
              />
              <select
                className={`${INPUT_CLASS} col-span-2`}
                value={row.stance}
                onChange={(e) => update({ stance: e.target.value as BusinessCaseStakeholder['stance'] })}
              >
                {(['sponsor', 'supportive', 'neutral', 'resistant', 'unknown'] as const).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </>
          )}
        />
        <span className={LABEL_CLASS}>{isPolish ? 'Dotknięte procesy' : 'Affected processes'}</span>
        <RowList
          rows={draft.stakeholdersProcesses.content.affectedProcesses}
          addLabel={isPolish ? 'Dodaj proces' : 'Add process'}
          newRow={() => ({ name: '' })}
          onChange={(rows) =>
            patchSection('stakeholdersProcesses', (s) => ({
              ...s,
              content: { ...s.content, affectedProcesses: rows },
            }))
          }
          renderRow={(row, update) => (
            <>
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Proces' : 'Process'}
                value={row.name}
                onChange={(e) => update({ name: e.target.value })}
              />
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Wpływ' : 'Impact'}
                value={row.impact || ''}
                onChange={(e) => update({ impact: e.target.value })}
              />
            </>
          )}
        />
        <LineageEditor
          ideaId={ideaId}
          tool={tool}
          selection={selection}
          lineage={draft.stakeholdersProcesses.lineage}
          graphNodes={graphNodes}
          isPolish={isPolish}
          onChange={(lineage) => patchSection('stakeholdersProcesses', (s) => ({ ...s, lineage }))}
        />
        <SaveRow
          isPolish={isPolish}
          saving={saving}
          savedFlash={savedFlashKey === 'stakeholdersProcesses'}
          onSave={() => void save('stakeholdersProcesses')}
        />
      </SubCard>

      {/* 4. Evidence, assumptions & evidence gaps — BY REFERENCE, real reuse */}
      <SubCard
        title={isPolish ? '4. Dowody, założenia i luki dowodowe' : '4. Evidence, assumptions & gaps'}
        complete={isSectionFilled('evidenceAssumptionsGaps', draft.evidenceAssumptionsGaps.content)}
      >
        <p className="text-[10.5px] text-c-text-muted">
          {isPolish
            ? 'Ta sekcja NIE duplikuje magazynu dowodów — pokazuje ten sam „Evidence Envelope", który Idea już ma (zakładka Powiązania → Źródła i założenia).'
            : "This section doesn't duplicate the evidence store — it shows the same Evidence Envelope the idea already has (Relations tab → Sources & assumptions)."}
        </p>
        <EvidencePanelSection artifactType="canvas" artifactId={ideaId} isPolish={isPolish} />
        <label>
          <span className={LABEL_CLASS}>
            {isPolish ? 'Dodatkowa notatka (specyficzna dla karty biznesowej)' : 'Extra note (business-case specific)'}
          </span>
          <textarea
            value={draft.evidenceAssumptionsGaps.content.note || ''}
            onChange={(e) =>
              patchSection('evidenceAssumptionsGaps', (s) => ({
                ...s,
                content: { ...s.content, note: e.target.value },
              }))
            }
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </label>
        <SaveRow
          isPolish={isPolish}
          saving={saving}
          savedFlash={savedFlashKey === 'evidenceAssumptionsGaps'}
          onSave={() => void save('evidenceAssumptionsGaps')}
        />
      </SubCard>

      {/* 5. Alternatives (incl. do nothing) */}
      <SubCard
        title={isPolish ? '5. Alternatywy (w tym „nic nie rób")' : '5. Alternatives (incl. "do nothing")'}
        complete={isSectionFilled('alternatives', draft.alternatives.content)}
      >
        <RowList
          rows={draft.alternatives.content.alternatives}
          addLabel={isPolish ? 'Dodaj alternatywę' : 'Add alternative'}
          newRow={(): BusinessCaseAlternative => ({
            id: `alt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            label: '',
            description: '',
            isDoNothing: false,
            pros: [],
            cons: [],
          })}
          onChange={(rows) =>
            patchSection('alternatives', (s) => ({ ...s, content: { alternatives: rows } }))
          }
          renderRow={(row, update) => (
            <>
              <input
                className={`${INPUT_CLASS} col-span-2`}
                placeholder={isPolish ? 'Nazwa' : 'Label'}
                value={row.label}
                onChange={(e) => update({ label: e.target.value })}
              />
              <textarea
                className={`${TEXTAREA_CLASS} col-span-2`}
                rows={2}
                placeholder={isPolish ? 'Opis' : 'Description'}
                value={row.description}
                onChange={(e) => update({ description: e.target.value })}
              />
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Szac. koszt' : 'Cost estimate'}
                value={row.costEstimate || ''}
                onChange={(e) => update({ costEstimate: e.target.value })}
              />
              <label className="flex items-center gap-1.5 text-[10.5px] text-c-text-muted">
                <input
                  type="checkbox"
                  checked={row.isDoNothing}
                  onChange={(e) => update({ isDoNothing: e.target.checked })}
                />
                {isPolish ? '„Nic nie rób"' : '"Do nothing"'}
              </label>
            </>
          )}
        />
        <SaveRow
          isPolish={isPolish}
          saving={saving}
          savedFlash={savedFlashKey === 'alternatives'}
          onSave={() => void save('alternatives')}
        />
      </SubCard>

      {/* 6. Recommendation & rationale */}
      <SubCard
        title={isPolish ? '6. Rekomendacja i uzasadnienie' : '6. Recommendation & rationale'}
        complete={isSectionFilled('recommendation', draft.recommendation.content)}
      >
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Wybrana alternatywa' : 'Chosen alternative'}</span>
          <select
            className={INPUT_CLASS}
            value={draft.recommendation.content.chosenAlternativeId || ''}
            onChange={(e) =>
              patchSection('recommendation', (s) => ({
                ...s,
                content: { ...s.content, chosenAlternativeId: e.target.value || null },
              }))
            }
          >
            <option value="">{isPolish ? '— nie wybrano —' : '— undecided —'}</option>
            {draft.alternatives.content.alternatives.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label || a.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Uzasadnienie' : 'Rationale'}</span>
          <textarea
            className={TEXTAREA_CLASS}
            rows={3}
            value={draft.recommendation.content.rationale}
            onChange={(e) =>
              patchSection('recommendation', (s) => ({
                ...s,
                content: { ...s.content, rationale: e.target.value },
              }))
            }
          />
        </label>
        <ClaimsEditor
          claims={draft.recommendation.claims}
          graphNodes={graphNodes}
          isPolish={isPolish}
          onChange={(claims) => patchSection('recommendation', (s) => ({ ...s, claims }))}
        />
        <SaveRow
          isPolish={isPolish}
          saving={saving}
          savedFlash={savedFlashKey === 'recommendation'}
          onSave={() => void save('recommendation')}
        />
      </SubCard>

      {/* 7. Benefits & disbenefits */}
      <SubCard
        title={isPolish ? '7. Korzyści i utracone korzyści' : '7. Benefits & disbenefits'}
        complete={isSectionFilled('benefitsDisbenefits', draft.benefitsDisbenefits.content)}
      >
        <span className={LABEL_CLASS}>{isPolish ? 'Korzyści' : 'Benefits'}</span>
        <RowList
          rows={draft.benefitsDisbenefits.content.benefits}
          addLabel={isPolish ? 'Dodaj korzyść' : 'Add benefit'}
          newRow={() => ({ description: '', type: 'qualitative' as const })}
          onChange={(rows) =>
            patchSection('benefitsDisbenefits', (s) => ({
              ...s,
              content: { ...s.content, benefits: rows },
            }))
          }
          renderRow={(row, update) => (
            <>
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Opis' : 'Description'}
                value={row.description}
                onChange={(e) => update({ description: e.target.value })}
              />
              <select
                className={INPUT_CLASS}
                value={row.type}
                onChange={(e) => update({ type: e.target.value as any })}
              >
                {(['financial', 'strategic', 'operational', 'qualitative'] as const).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                className={`${INPUT_CLASS} col-span-2`}
                placeholder={isPolish ? 'Wartość' : 'Value'}
                value={row.value || ''}
                onChange={(e) => update({ value: e.target.value })}
              />
            </>
          )}
        />
        <span className={LABEL_CLASS}>{isPolish ? 'Utracone korzyści' : 'Disbenefits'}</span>
        <RowList
          rows={draft.benefitsDisbenefits.content.disbenefits}
          addLabel={isPolish ? 'Dodaj' : 'Add'}
          newRow={() => ({ description: '' })}
          onChange={(rows) =>
            patchSection('benefitsDisbenefits', (s) => ({
              ...s,
              content: { ...s.content, disbenefits: rows },
            }))
          }
          renderRow={(row, update) => (
            <>
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Opis' : 'Description'}
                value={row.description}
                onChange={(e) => update({ description: e.target.value })}
              />
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Wartość' : 'Value'}
                value={row.value || ''}
                onChange={(e) => update({ value: e.target.value })}
              />
            </>
          )}
        />
        <SaveRow
          isPolish={isPolish}
          saving={saving}
          savedFlash={savedFlashKey === 'benefitsDisbenefits'}
          onSave={() => void save('benefitsDisbenefits')}
        />
      </SubCard>

      {/* 8. Costs & resource needs */}
      <SubCard
        title={isPolish ? '8. Koszty i potrzebne zasoby' : '8. Costs & resource needs'}
        complete={isSectionFilled('costsResources', draft.costsResources.content)}
      >
        <RowList
          rows={draft.costsResources.content.items}
          addLabel={isPolish ? 'Dodaj pozycję' : 'Add item'}
          newRow={(): BusinessCaseCostItem => ({ category: 'one_time', description: '' })}
          onChange={(rows) =>
            patchSection('costsResources', (s) => ({ ...s, content: { items: rows } }))
          }
          renderRow={(row, update) => (
            <>
              <select
                className={INPUT_CLASS}
                value={row.category}
                onChange={(e) => update({ category: e.target.value as any })}
              >
                {(['one_time', 'recurring', 'headcount', 'other'] as const).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Opis' : 'Description'}
                value={row.description}
                onChange={(e) => update({ description: e.target.value })}
              />
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Kwota' : 'Amount'}
                value={row.amount || ''}
                onChange={(e) => update({ amount: e.target.value })}
              />
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Waluta' : 'Currency'}
                value={row.currency || ''}
                onChange={(e) => update({ currency: e.target.value })}
              />
            </>
          )}
        />
        <SaveRow
          isPolish={isPolish}
          saving={saving}
          savedFlash={savedFlashKey === 'costsResources'}
          onSave={() => void save('costsResources')}
        />
      </SubCard>

      {/* 9. Operational impact & process changes */}
      <SubCard
        title={isPolish ? '9. Wpływ operacyjny i zmiany procesów' : '9. Operational impact & process changes'}
        complete={isSectionFilled('operationalImpact', draft.operationalImpact.content)}
      >
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Zmiany procesów' : 'Process changes'}</span>
          <textarea
            className={TEXTAREA_CLASS}
            rows={3}
            value={draft.operationalImpact.content.processChanges}
            onChange={(e) =>
              patchSection('operationalImpact', (s) => ({
                ...s,
                content: { ...s.content, processChanges: e.target.value },
              }))
            }
          />
        </label>
        <label>
          <span className={LABEL_CLASS}>
            {isPolish ? 'Systemy pod wpływem (po przecinku)' : 'Impacted systems (comma-separated)'}
          </span>
          <input
            className={INPUT_CLASS}
            value={draft.operationalImpact.content.impactedSystems.join(', ')}
            onChange={(e) =>
              patchSection('operationalImpact', (s) => ({
                ...s,
                content: {
                  ...s.content,
                  impactedSystems: e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
                },
              }))
            }
          />
        </label>
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Potrzeby szkoleniowe' : 'Training needs'}</span>
          <textarea
            className={TEXTAREA_CLASS}
            rows={2}
            value={draft.operationalImpact.content.trainingNeeds || ''}
            onChange={(e) =>
              patchSection('operationalImpact', (s) => ({
                ...s,
                content: { ...s.content, trainingNeeds: e.target.value },
              }))
            }
          />
        </label>
        <SaveRow
          isPolish={isPolish}
          saving={saving}
          savedFlash={savedFlashKey === 'operationalImpact'}
          onSave={() => void save('operationalImpact')}
        />
      </SubCard>

      {/* 10. Risks, controls, dependencies & constraints */}
      <SubCard
        title={isPolish ? '10. Ryzyka, kontrole, zależności i ograniczenia' : '10. Risks, controls, dependencies & constraints'}
        complete={isSectionFilled('risksControls', draft.risksControls.content)}
      >
        <span className={LABEL_CLASS}>{isPolish ? 'Ryzyka' : 'Risks'}</span>
        <RowList
          rows={draft.risksControls.content.risks}
          addLabel={isPolish ? 'Dodaj ryzyko' : 'Add risk'}
          newRow={(): BusinessCaseRisk => ({ description: '' })}
          onChange={(rows) =>
            patchSection('risksControls', (s) => ({
              ...s,
              content: { ...s.content, risks: rows },
            }))
          }
          renderRow={(row, update) => (
            <>
              <input
                className={`${INPUT_CLASS} col-span-2`}
                placeholder={isPolish ? 'Opis' : 'Description'}
                value={row.description}
                onChange={(e) => update({ description: e.target.value })}
              />
              <select
                className={INPUT_CLASS}
                value={row.likelihood || ''}
                onChange={(e) => update({ likelihood: (e.target.value || undefined) as any })}
              >
                <option value="">{isPolish ? 'Prawdopodobieństwo' : 'Likelihood'}</option>
                {(['low', 'medium', 'high'] as const).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                className={INPUT_CLASS}
                value={row.impact || ''}
                onChange={(e) => update({ impact: (e.target.value || undefined) as any })}
              >
                <option value="">{isPolish ? 'Wpływ' : 'Impact'}</option>
                {(['low', 'medium', 'high'] as const).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Kontrola' : 'Control'}
                value={row.control || ''}
                onChange={(e) => update({ control: e.target.value })}
              />
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Właściciel' : 'Owner'}
                value={row.owner || ''}
                onChange={(e) => update({ owner: e.target.value })}
              />
            </>
          )}
        />
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Zależności (po przecinku)' : 'Dependencies (comma-separated)'}</span>
          <input
            className={INPUT_CLASS}
            value={draft.risksControls.content.dependencies.join(', ')}
            onChange={(e) =>
              patchSection('risksControls', (s) => ({
                ...s,
                content: {
                  ...s.content,
                  dependencies: e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                },
              }))
            }
          />
        </label>
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Ograniczenia (po przecinku)' : 'Constraints (comma-separated)'}</span>
          <input
            className={INPUT_CLASS}
            value={draft.risksControls.content.constraints.join(', ')}
            onChange={(e) =>
              patchSection('risksControls', (s) => ({
                ...s,
                content: {
                  ...s.content,
                  constraints: e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                },
              }))
            }
          />
        </label>
        <SaveRow
          isPolish={isPolish}
          saving={saving}
          savedFlash={savedFlashKey === 'risksControls'}
          onSave={() => void save('risksControls')}
        />
      </SubCard>

      {/* 11. Implementation horizon & milestones */}
      <SubCard
        title={isPolish ? '11. Horyzont wdrożenia i kamienie milowe' : '11. Implementation horizon & milestones'}
        complete={isSectionFilled('implementationHorizon', draft.implementationHorizon.content)}
      >
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Podsumowanie horyzontu' : 'Horizon summary'}</span>
          <input
            className={INPUT_CLASS}
            value={draft.implementationHorizon.content.horizonSummary || ''}
            onChange={(e) =>
              patchSection('implementationHorizon', (s) => ({
                ...s,
                content: { ...s.content, horizonSummary: e.target.value },
              }))
            }
          />
        </label>
        <RowList
          rows={draft.implementationHorizon.content.milestones}
          addLabel={isPolish ? 'Dodaj kamień milowy' : 'Add milestone'}
          newRow={(): BusinessCaseMilestone => ({ label: '', status: 'planned' })}
          onChange={(rows) =>
            patchSection('implementationHorizon', (s) => ({
              ...s,
              content: { ...s.content, milestones: rows },
            }))
          }
          renderRow={(row, update) => (
            <>
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Nazwa' : 'Label'}
                value={row.label}
                onChange={(e) => update({ label: e.target.value })}
              />
              <input
                type="date"
                className={INPUT_CLASS}
                value={row.targetDate || ''}
                onChange={(e) => update({ targetDate: e.target.value })}
              />
              <select
                className={`${INPUT_CLASS} col-span-2`}
                value={row.status}
                onChange={(e) => update({ status: e.target.value as any })}
              >
                {(['planned', 'in_progress', 'done', 'at_risk'] as const).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </>
          )}
        />
        <SaveRow
          isPolish={isPolish}
          saving={saving}
          savedFlash={savedFlashKey === 'implementationHorizon'}
          onSave={() => void save('implementationHorizon')}
        />
      </SubCard>

      {/* 12. KPIs — baseline, target, owner, measurement source */}
      <SubCard
        title={isPolish ? '12. KPI (punkt odniesienia, cel, właściciel, źródło)' : '12. KPIs (baseline, target, owner, source)'}
        complete={isSectionFilled('kpis', draft.kpis.content)}
      >
        <RowList
          rows={draft.kpis.content.kpis}
          addLabel={isPolish ? 'Dodaj KPI' : 'Add KPI'}
          newRow={(): BusinessCaseKpi => ({
            id: `kpi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: '',
          })}
          onChange={(rows) => patchSection('kpis', (s) => ({ ...s, content: { kpis: rows } }))}
          renderRow={(row, update) => (
            <>
              <input
                className={`${INPUT_CLASS} col-span-2`}
                placeholder={isPolish ? 'Nazwa KPI' : 'KPI name'}
                value={row.name}
                onChange={(e) => update({ name: e.target.value })}
              />
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Punkt odniesienia' : 'Baseline'}
                value={row.baseline || ''}
                onChange={(e) => update({ baseline: e.target.value })}
              />
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Cel' : 'Target'}
                value={row.target || ''}
                onChange={(e) => update({ target: e.target.value })}
              />
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Właściciel' : 'Owner'}
                value={row.owner || ''}
                onChange={(e) => update({ owner: e.target.value })}
              />
              <input
                className={INPUT_CLASS}
                placeholder={isPolish ? 'Źródło pomiaru' : 'Measurement source'}
                value={row.measurementSource || ''}
                onChange={(e) => update({ measurementSource: e.target.value })}
              />
            </>
          )}
        />
        <LineageEditor
          ideaId={ideaId}
          tool={tool}
          selection={selection}
          lineage={draft.kpis.lineage}
          graphNodes={graphNodes}
          isPolish={isPolish}
          onChange={(lineage) => patchSection('kpis', (s) => ({ ...s, lineage }))}
        />
        <SaveRow
          isPolish={isPolish}
          saving={saving}
          savedFlash={savedFlashKey === 'kpis'}
          onSave={() => void save('kpis')}
        />
      </SubCard>

      {/* 13. Confidence & readiness */}
      <SubCard
        title={isPolish ? '13. Pewność i gotowość' : '13. Confidence & readiness'}
        complete={isSectionFilled('confidenceReadiness', draft.confidenceReadiness.content)}
      >
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Poziom pewności' : 'Confidence level'}</span>
          <select
            className={INPUT_CLASS}
            value={draft.confidenceReadiness.content.confidenceLevel}
            onChange={(e) =>
              patchSection('confidenceReadiness', (s) => ({
                ...s,
                content: { ...s.content, confidenceLevel: e.target.value as any },
              }))
            }
          >
            {(['low', 'medium', 'high'] as const).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Etap gotowości' : 'Readiness stage'}</span>
          <input
            className={INPUT_CLASS}
            value={draft.confidenceReadiness.content.readinessStage || ''}
            onChange={(e) =>
              patchSection('confidenceReadiness', (s) => ({
                ...s,
                content: { ...s.content, readinessStage: e.target.value },
              }))
            }
          />
        </label>
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Notatki' : 'Notes'}</span>
          <textarea
            className={TEXTAREA_CLASS}
            rows={2}
            value={draft.confidenceReadiness.content.notes || ''}
            onChange={(e) =>
              patchSection('confidenceReadiness', (s) => ({
                ...s,
                content: { ...s.content, notes: e.target.value },
              }))
            }
          />
        </label>
        <SaveRow
          isPolish={isPolish}
          saving={saving}
          savedFlash={savedFlashKey === 'confidenceReadiness'}
          onSave={() => void save('confidenceReadiness')}
        />
      </SubCard>

      {/* 14. Decision requested & deadline */}
      <SubCard
        title={isPolish ? '14. Wnioskowana decyzja i termin' : '14. Decision requested & deadline'}
        complete={isSectionFilled('decisionRequested', draft.decisionRequested.content)}
      >
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Pytanie decyzyjne' : 'Decision question'}</span>
          <textarea
            className={TEXTAREA_CLASS}
            rows={2}
            value={draft.decisionRequested.content.question}
            onChange={(e) =>
              patchSection('decisionRequested', (s) => ({
                ...s,
                content: { ...s.content, question: e.target.value },
              }))
            }
          />
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <label>
            <span className={LABEL_CLASS}>{isPolish ? 'Termin' : 'Deadline'}</span>
            <input
              type="date"
              className={INPUT_CLASS}
              value={draft.decisionRequested.content.deadline || ''}
              onChange={(e) =>
                patchSection('decisionRequested', (s) => ({
                  ...s,
                  content: { ...s.content, deadline: e.target.value },
                }))
              }
            />
          </label>
          <label>
            <span className={LABEL_CLASS}>{isPolish ? 'Zatwierdzający' : 'Approver'}</span>
            <input
              className={INPUT_CLASS}
              value={draft.decisionRequested.content.requestedApprover || ''}
              onChange={(e) =>
                patchSection('decisionRequested', (s) => ({
                  ...s,
                  content: { ...s.content, requestedApprover: e.target.value },
                }))
              }
            />
          </label>
        </div>
        <label>
          <span className={LABEL_CLASS}>{isPolish ? 'Wynik' : 'Outcome'}</span>
          <select
            className={INPUT_CLASS}
            value={draft.decisionRequested.content.outcome}
            onChange={(e) =>
              patchSection('decisionRequested', (s) => ({
                ...s,
                content: { ...s.content, outcome: e.target.value as any },
              }))
            }
          >
            {(['pending', 'approved', 'rejected', 'return_for_evidence', 'deferred'] as const).map(
              (v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              )
            )}
          </select>
        </label>
        <p className="text-[10px] text-c-text-muted italic">
          {isPolish
            ? 'Ta karta nie blokuje jeszcze zatwierdzenia przy brakujących dowodach ani nie tworzy osobnych wersji przy ponownym otwarciu decyzji — patrz raport zadania.'
            : "This card doesn't yet block approval on missing evidence or version reopened decisions — see task report."}
        </p>
        <SaveRow
          isPolish={isPolish}
          saving={saving}
          savedFlash={savedFlashKey === 'decisionRequested'}
          onSave={() => void save('decisionRequested')}
        />
      </SubCard>
    </div>
  );
};

export default IdeaBusinessCaseSection;
