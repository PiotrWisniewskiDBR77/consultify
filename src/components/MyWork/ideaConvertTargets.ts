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
 * 6-item allowlist above), so they were REMOVED from the registry entirely.
 *
 * E11 UPDATE (2026-08-10, docs/qa/ideas-manual-audit-2026-08-09/09_*, §9 —
 * required target list explicitly includes Financial Model and Budget): the
 * 2026-07-24 removal read Z3 as "never show a soon item"; re-reading it
 * against docs/standards/idea-workspace/10_KONWERSJA_EKSPORT_IMPORT_SZABLONY.md
 * §7 ("Analiza"/"Model finansowy"/"Budżet"/"Wycena" → `status:'soon'`,
 * disabled, consistent status everywhere) and §9's own instruction ("for
 * targets not yet supported end-to-end, show one consistent soon/disabled
 * state with a reason") — Z3 forbids a placeholder WITHOUT a reason, not a
 * disabled item WITH one. `financial_model`/`budget` are reinstated below as
 * `soon` with an honest, checked reason (E09 engine exists but unwired — see
 * their entries). `action_plan`/`raid_log`/`valuation`/`analysis` stay
 * removed — they are outside this task's required target list and were not
 * re-audited here. The `IdeaConvertTarget` type union below still carries all
 * of their ids — intentionally NOT pruned — because IdeaWorkspaceTools.tsx
 * keys an exhaustive `Record<IdeaConvertTarget, …>` (CONVERT_VISUALS) off
 * this union and that file is owned by another workstream (do not touch);
 * narrowing the union would make that Record ill-typed. The array below (the
 * actual runtime/UI-facing list) is the source of truth for what renders.
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
    // E11 fix (2026-08-10) — corrected: checked server/src/routes/
    // my-work.routes.ts's Presentation branch before writing this. It creates
    // ONE draft `presentations` row (title + a text description built from
    // body/AI-expansion) — it does NOT read branches/nodes or generate slides.
    // The prior copy ("Generuj slajdy z gałęzi"/"Generate slides from
    // branches") described a feature that does not exist; that is exactly the
    // kind of promise this file's own header note (Z3, next block) says must
    // not ship as a placeholder — except this one wasn't a placeholder, it
    // was a LIVE item with a false description. Fixed here, not building
    // real slide generation (separate, larger scope).
    descPl: 'Tworzy prezentację roboczą (tytuł + opis z treści Idei)',
    descEn: 'Creates a draft presentation (title + description from the Idea content)',
  },
  // Z3 audit (2026-07-24): action_plan / raid_log / valuation / analysis were
  // REMOVED here — each checked against the server convert allowlist
  // (my-work.routes.ts LIVE_CONVERT_TARGETS) and none has a handler. Standard
  // rozdz. 02 Z3: no "wkrótce" without a real, funded plan — an idle
  // placeholder in a live convert panel is a silent non-action.
  //
  // E11 UPDATE (2026-08-10): `financial_model`/`budget` are back as explicit
  // `soon` entries — per master program §9 they are REQUIRED targets in the
  // Convert menu (not absent), shown disabled WITH A REASON, never as an
  // empty/fabricated artifact (Z3). Reason checked against real code: E09
  // (financial engine, src/services/ideaFinance/) exists but per
  // RESUME_HANDOFF.md is uncommitted and has NEVER been wired to any UI — a
  // conversion to Financial Model/Budget today would either 400 (no server
  // handler in LIVE_CONVERT_TARGETS) or, via the OTHER conversion pipeline
  // (conversionService.ts's `/financial-modeling/models` / `/economics/
  // budgets`), create a content-free record carrying only a title — no Idea
  // data, failing E11's "meaningful data" DoD. Disabled here until E09 lands
  // and is wired, rather than either fabricating a placeholder record or
  // silently hiding the option the canon requires to be visible.
  {
    id: 'financial_model',
    status: 'soon',
    group: 'models',
    labelPl: 'Model finansowy',
    labelEn: 'Financial Model',
    descPl: 'Wkrótce — silnik finansowy (E09) jeszcze nie podłączony do Idei',
    descEn: 'Soon — the financial engine (E09) is not wired to Ideas yet',
  },
  {
    id: 'budget',
    status: 'soon',
    group: 'models',
    labelPl: 'Budżet',
    labelEn: 'Budget',
    descPl: 'Wkrótce — silnik finansowy (E09) jeszcze nie podłączony do Idei',
    descEn: 'Soon — the financial engine (E09) is not wired to Ideas yet',
  },
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
