/**
 * Idea → output convert/promotion — SINGLE SOURCE OF TRUTH (FE side).
 *
 * SSOT for "what an idea can be converted/promoted into" across the whole Ideas suite
 * (M05 list + M06–M09 workspace tools). Before this file there were FOUR divergent
 * definitions (IdeaMapWorkspace 12, IdeaWorkspaceTools 8, IdeasTableContent 4, server 6),
 * and the menu surfaced `action_plan`/`raid_log` which the server rejects with a raw 400 —
 * a CANON §4 violation (dead path / raw backend error).
 *
 * Doctrine: docs/product/IDEA_WORKSPACE_UNIFICATION_ACTIVATION.md §1.1
 *
 * Rule:
 *   - `status: 'live'` = a handler exists in server/src/routes/my-work.routes.ts convert switch.
 *     MUST stay in lock-step with the server allowlist (initiative, task_set, decision,
 *     team_chat, report, presentation). A vitest contract test enforces FE-live ⊆ server.
 *   - `status: 'soon'` = roadmap; surfaced DISABLED with an honest "coming soon" affordance.
 *     NEVER sent to the server, NEVER produces a 400.
 *
 * Z3 audit (2026-07-24, docs standard rozdz. 01 §3 zakaz 8 / rozdz. 02 Z3 — zero
 * placeholderów "wkrótce" bez powodu): the 6 `soon` targets that used to live here
 * (action_plan, raid_log, financial_model, budget, valuation, analysis) were checked
 * one by one against server/src/routes/my-work.routes.ts's `LIVE_CONVERT_TARGETS`
 * allowlist — NONE has a convert handler (the route 400s on anything outside the
 * 6-item allowlist above), so they were REMOVED from the registry rather than kept
 * as "soon". The `IdeaConvertTarget` type union below still carries their ids —
 * intentionally NOT pruned — because IdeaWorkspaceTools.tsx keys an exhaustive
 * `Record<IdeaConvertTarget, …>` (CONVERT_VISUALS) off this union and that file is
 * owned by another workstream (do not touch); narrowing the union would make that
 * Record ill-typed. The array below (the actual runtime/UI-facing list) is the
 * source of truth for what renders — it now only contains `live` entries.
 */

export type IdeaConvertTarget =
  | 'initiative'
  | 'task_set'
  | 'decision'
  | 'team_chat'
  | 'report'
  | 'presentation'
  | 'action_plan'
  | 'raid_log'
  | 'financial_model'
  | 'budget'
  | 'valuation'
  | 'analysis';

export type IdeaConvertStatus = 'live' | 'soon';

/**
 * Display grouping for the Convert panel (UI-L9). Splits a flat list of 12 outputs into
 * three legible clusters so the panel reads as "one big idea", not "many small ideas":
 *   - `work`   → Akcje robocze (things that create working artifacts in the app)
 *   - `docs`   → Generatory dokumentów (report / deck generators)
 *   - `models` → AI-artefakty (financial/analysis models — mostly roadmap)
 */
export type IdeaConvertGroup = 'work' | 'docs' | 'models';

export interface IdeaConvertTargetMeta {
  id: IdeaConvertTarget;
  status: IdeaConvertStatus;
  group: IdeaConvertGroup;
  labelPl: string;
  labelEn: string;
  descPl: string;
  descEn: string;
}

export const IDEA_CONVERT_GROUP_LABELS: Record<IdeaConvertGroup, { en: string; pl: string }> = {
  work: { en: 'Working actions', pl: 'Akcje robocze' },
  docs: { en: 'Document generators', pl: 'Generatory dokumentów' },
  models: { en: 'AI artifacts', pl: 'AI-artefakty' },
};

/** Canonical group order for rendering. */
export const IDEA_CONVERT_GROUP_ORDER: IdeaConvertGroup[] = ['work', 'docs', 'models'];

/**
 * Canonical registry. Order here is the canonical display order.
 * Keep `live` entries in sync with the server allowlist in my-work.routes.ts.
 */
export const IDEA_CONVERT_TARGETS: IdeaConvertTargetMeta[] = [
  {
    id: 'initiative',
    status: 'live',
    group: 'work',
    labelPl: 'Inicjatywa',
    labelEn: 'Initiative',
    descPl: 'Utwórz w PMO',
    descEn: 'Create in PMO',
  },
  {
    id: 'task_set',
    status: 'live',
    group: 'work',
    labelPl: 'Taski',
    labelEn: 'Tasks',
    descPl: 'Z next steps',
    descEn: 'From next steps',
  },
  {
    id: 'decision',
    status: 'live',
    group: 'work',
    labelPl: 'Decyzja',
    labelEn: 'Decision',
    descPl: 'Artefakt decyzyjny',
    descEn: 'Decision artifact',
  },
  {
    id: 'team_chat',
    status: 'live',
    group: 'work',
    labelPl: 'Team Chat',
    labelEn: 'Team Chat',
    descPl: 'Wątek do omówienia',
    descEn: 'Discussion thread',
  },
  {
    id: 'report',
    status: 'live',
    group: 'docs',
    labelPl: 'Raport',
    labelEn: 'Report',
    descPl: 'Generuj raport z mapy',
    descEn: 'Generate report from map',
  },
  {
    id: 'presentation',
    status: 'live',
    group: 'docs',
    labelPl: 'Prezentacja',
    labelEn: 'Presentation',
    descPl: 'Generuj slajdy z gałęzi',
    descEn: 'Generate slides from branches',
  },
  // Z3 audit (2026-07-24): action_plan / raid_log / financial_model / budget /
  // valuation / analysis were REMOVED here — each checked against the server
  // convert allowlist (my-work.routes.ts LIVE_CONVERT_TARGETS) and none has a
  // handler. Standard rozdz. 02 Z3: no "wkrótce" without a real, funded plan —
  // an idle placeholder in a live convert panel is a silent non-action. See the
  // file-header Z3 audit note above for the full rationale and what stays intact
  // (the IdeaConvertTarget type union, kept for a file this task must not touch).
];

/** Server-backed targets (handler exists). Derived — do not hand-edit the membership. */
export const LIVE_CONVERT_TARGETS: IdeaConvertTarget[] = IDEA_CONVERT_TARGETS.filter(
  (t) => t.status === 'live'
).map((t) => t.id);

const LIVE_SET = new Set<IdeaConvertTarget>(LIVE_CONVERT_TARGETS);

export function isLiveConvertTarget(target: string): target is IdeaConvertTarget {
  return LIVE_SET.has(target as IdeaConvertTarget);
}

export function getConvertTargetMeta(target: string): IdeaConvertTargetMeta | undefined {
  return IDEA_CONVERT_TARGETS.find((t) => t.id === target);
}
