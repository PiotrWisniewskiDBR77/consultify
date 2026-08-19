/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — ECONOMICS (`/api/economics`), a router with NO
 * cutover mechanism at all.
 *
 * THE FINDING THIS EXISTS FOR (docs/program/evidence/closure/codex/
 * CLAUDE-NEXT-LEGACY-CUTOVER/inventory/FINANCE.md, risk #1/#4): `economics.routes.ts`
 * is mounted at `/api/economics` behind only `betaGate` (`server/src/Gateway.ts:1159`
 * — a currently no-op gate, per the FIN-W02 finding in `registry.ts`). Per-route
 * `verifyToken` is intact, but there is no `financeLegacyCutoverGuard` equivalent
 * anywhere in this file (grep-confirmed). The inventory catalogued eleven of this
 * router's writers (`/valuations/*`, FINANCE-W072..W082) as the fourth independent
 * "approve" writer family; reading the whole file turned up THIRTY-ONE more writers
 * across `/analyses/*`, `/financial-analyses/*`, `/budgets/*` and `/finance-settings`
 * that the inventory never catalogued at all. All forty-two are registered below —
 * every POST/PUT/DELETE route this router declares.
 *
 * TABLES TOUCHED, AND WHICH ONES THE IDENTITY BRIDGE KNOWS: this file's writers
 * mutate eleven distinct legacy tables (`valuations`, `financial_analyses`,
 * `digitization_analyses`, `analysis_financials`, `analysis_financial_scenarios`,
 * `benefit_tracking`, `decisions`, `initiatives`, `budgets` + 3 budget child
 * tables, `organization_settings`). Of those, only `valuations` and
 * `financial_analyses` are in `legacyIdBridgeService.ts`'s `LEGACY_FINANCE_TABLES`
 * — those writers carry `legacyTable`/`legacyIdFromPath` so the canonical identity
 * bridge can attempt a real lookup. The rest carry neither: attaching a
 * `legacyTable` the bridge has never aliased would produce a permanent, meaningless
 * `not_migrated` result rather than an honest `not_applicable`.
 *
 * TWO CORRECTIONS TO THE INVENTORY (found while verifying handlers, not asserted
 * from the inventory's own text):
 *
 *  1. FINANCE-W080 (`POST /valuations/:id/advisory/:recommendationId/
 *     convert-to-initiative`) was flagged as a "possible split-brain pair, not
 *     confirmed". Reading `valuationService.ts:1712-1742`
 *     (`convertAdvisoryRecommendationToInitiative`) shows it does NOT write
 *     `initiatives` or `valuations` directly — a FIN-06 rewrite already routes it
 *     through `confirmValuationRecommendationCandidateHandoff`, the same shared
 *     Finance Candidate handoff seam `financeCandidateHandoffCore.ts` uses. This
 *     writer (ECO-W30) is therefore NOT split-brain today: it already writes the
 *     canonical seam, not the legacy `valuations` row, so it carries no
 *     `legacyTable` and needs no successor.
 *
 *  2. `POST /financial-analyses/:id/initiatives` (ECO-W19) already answers an
 *     unconditional 410 in the handler itself (FIN-06 direct-creation ban,
 *     `economics.routes.ts:2489-2508`) — it performs no database write regardless
 *     of what any guard decides. Registered as `observed` purely so the router's
 *     full write surface is accounted for; the guard adds telemetry in front of a
 *     door the handler already keeps shut.
 *
 * FOUR WRITE-VERB ROUTES THAT PERFORM NO DATABASE WRITE (verified by reading the
 * handler, not assumed from the verb): `calculate-metrics` and `live-preview` are
 * pure read/compute; `business-case` is an unconditional 501 stub (BUG-07);
 * `financial-analyses/:id/insights` is a stub that returns a fabricated,
 * unpersisted insight (BUG-06). Each is registered with a reason that says so.
 *
 * WORTH FLAGGING, NOT FIXED HERE: `POST /analyses/:id/create-initiative`
 * (ECO-W10) performs a raw `INSERT INTO initiatives` (economics.routes.ts:2004)
 * bypassing the canonical initiative funnel whenever `INITIATIVE_FUNNEL_ENABLED`
 * is unset (its live default) — a distinct split-brain risk with initiative
 * creation, unrelated to the Finance legacy-table bridge this lane covers.
 *
 * Wave 2 retires exactly ECO-W16/W17 after both live UI surfaces moved to the
 * canonical financial-analysis identity/BV/working-revision path. The other forty
 * writers remain observed and reachable. `POST /valuations/:id/approve` (ECO-W27)
 * is still the unrelated fourth approval writer and is intentionally not widened
 * into this tranche.
 */

import type { LegacyCutoverDomainConfig } from '../legacyCutoverKernel.js';

const idAt2 = (path: string): string => decodeURIComponent(path.split('/')[2] || '');

export const ECONOMICS_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'finance',
  rollbackEnv: 'FINANCE_LEGACY_WRITER_ROLLBACK_ENABLED',
  rollbackWritersEnv: 'FINANCE_LEGACY_ROLLBACK_WRITERS',
  disabledCode: 'FINANCE_LEGACY_WRITER_DISABLED',
  unmappedCode: 'FINANCE_LEGACY_IDENTITY_UNMAPPED',
  idBridge: '/api/v8/finance-v2/artifacts/resolve-legacy/:legacyTable/:legacyId',
  writers: [
    {
      writerId: 'ECO-W01',
      method: 'POST',
      path: /^\/analyses\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Creates a digitization_analyses row (economics.routes.ts:703, INSERT at :722). digitization_analyses is not one of the four legacy tables the identity bridge knows; no proven successor.',
    },
    {
      writerId: 'ECO-W02',
      method: 'PUT',
      path: /^\/analyses\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Updates a digitization_analyses row addressed by :id (economics.routes.ts:840, UPDATE at :917). No proven successor.',
    },
    {
      writerId: 'ECO-W03',
      method: 'POST',
      path: /^\/analyses\/[^/]+\/link-initiative\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Links an analysis to an initiative: UPDATE digitization_analyses SET initiative_id (economics.routes.ts:931, UPDATE at :954). No proven successor.',
    },
    {
      writerId: 'ECO-W04',
      method: 'PUT',
      path: /^\/analyses\/[^/]+\/financials\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Upserts an analysis_financials row for the analysis addressed by :id (economics.routes.ts:1043, INSERT/UPDATE at :1130/:1168). No proven successor.',
    },
    {
      writerId: 'ECO-W05',
      method: 'POST',
      path: /^\/analyses\/[^/]+\/scenarios\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Upserts an analysis_financial_scenarios row for the analysis addressed by :id (economics.routes.ts:1370, INSERT at :1430). No proven successor.',
    },
    {
      writerId: 'ECO-W06',
      method: 'POST',
      path: /^\/analyses\/[^/]+\/scenarios\/[^/]+\/activate\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Flips is_active on analysis_financial_scenarios rows for the analysis addressed by :id (economics.routes.ts:1463, two UPDATEs immediately following). No proven successor.',
    },
    {
      writerId: 'ECO-W07',
      method: 'PUT',
      path: /^\/analyses\/[^/]+\/benefits\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Upserts a benefit_tracking row for the initiative linked to the analysis addressed by :id (economics.routes.ts:1534). actual_* columns are append-only protected by a DB trigger (ROI-E007); the handler routes disagreements to a reconciliation record rather than overwriting. No proven successor.',
    },
    {
      writerId: 'ECO-W08',
      method: 'POST',
      path: /^\/analyses\/[^/]+\/calculate-metrics\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Verified NO database write: reads analysis_financials for the analysis addressed by :id and returns computed metrics only (economics.routes.ts:1818). Registered for completeness as a POST route on this router; performs no mutation.',
    },
    {
      writerId: 'ECO-W09',
      method: 'POST',
      path: /^\/analyses\/[^/]+\/business-case\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Verified NO database write: unconditionally answers 501 with a pointer to POST /api/v8/advisory/business-case (economics.routes.ts:1897-1926, BUG-07 fix — this used to be a stub silently claiming success). Registered for completeness; the handler already refuses to write.',
    },
    {
      writerId: 'ECO-W10',
      method: 'POST',
      path: /^\/analyses\/[^/]+\/create-initiative\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Creates an initiatives row directly (economics.routes.ts:1935, INSERT at :2004, live path when INITIATIVE_FUNNEL_ENABLED is unset) plus UPDATEs on digitization_analyses and analysis_financials. Bypasses the canonical initiative creation funnel on its default (unset) path — a distinct split-brain risk from the Finance legacy-table bridge this lane covers, flagged here but not in scope to fix. No proven successor for this specific writer.',
    },
    {
      writerId: 'ECO-W11',
      method: 'POST',
      path: /^\/analyses\/[^/]+\/decisions\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Creates a decisions row via decisionService.createDecision (economics.routes.ts:2048, decisionService.ts:234 INSERT INTO decisions). No proven successor.',
    },
    {
      writerId: 'ECO-W12',
      method: 'DELETE',
      path: /^\/analyses\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Deletes a digitization_analyses row addressed by :id (economics.routes.ts:2159, DELETE at :2172). No proven successor; irreversible delete with zero protection before this registration.',
    },
    {
      writerId: 'ECO-W13',
      method: 'POST',
      path: /^\/analyses\/[^/]+\/duplicate\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Inserts a copy of a digitization_analyses row (economics.routes.ts:2192, INSERT at :2220). No proven successor.',
    },
    {
      writerId: 'ECO-W14',
      method: 'POST',
      path: /^\/financial-analyses\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Creates a financial_analyses row via finAnalysisSvc.createAnalysis (economics.routes.ts:2301, financialAnalysisService.ts:399 INSERT INTO financial_analyses). financial_analyses is one of the four legacy tables the identity bridge knows, but this is a collection-level create with no path id yet, so legacyTable/legacyIdFromPath do not apply here. No proven successor.',
    },
    {
      writerId: 'ECO-W15',
      method: 'PUT',
      path: /^\/financial-analyses\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'financial_analyses',
      legacyIdFromPath: idAt2,
      reason:
        'Updates a financial_analyses row addressed by :id via finAnalysisSvc.updateAnalysis (economics.routes.ts:2337, financialAnalysisService.ts:470,537 UPDATE financial_analyses). financial_analyses is bridge-known, so legacyTable is set. No proven successor.',
    },
    {
      writerId: 'ECO-W16',
      method: 'POST',
      path: /^\/financial-analyses\/[^/]+\/run\/?$/,
      state: 'disabled',
      successor: '/api/v8/finance-v2/analysis/:businessVersionId/compute',
      legacyTable: 'financial_analyses',
      legacyIdFromPath: idAt2,
      reason:
        'All live callers now resolve the financial_analyses alias and invoke the canonical finance-v2 KPI compute/readiness command. The legacy ratios/insights archive remains read-only.',
    },
    {
      writerId: 'ECO-W17',
      method: 'POST',
      path: /^\/financial-analyses\/[^/]+\/approve\/?$/,
      state: 'disabled',
      successor: '/api/v8/finance-v2/models/:artifactId/approve',
      legacyTable: 'financial_analyses',
      legacyIdFromPath: idAt2,
      reason:
        'All live callers now resolve the financial_analyses alias and invoke canonical finance-v2 four-eyes approval; the legacy status writer is retired.',
    },
    {
      writerId: 'ECO-W18',
      method: 'POST',
      path: /^\/financial-analyses\/[^/]+\/insights\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Verified NO database write: BUG-06 stub returns a fabricated "generated" insight object without persisting it (economics.routes.ts:2406-2427). Registered for completeness; performs no mutation.',
    },
    {
      writerId: 'ECO-W19',
      method: 'POST',
      path: /^\/financial-analyses\/[^/]+\/initiatives\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Verified NO database write: unconditionally answers 410 DIRECT_INITIATIVE_CREATION_DISABLED (economics.routes.ts:2489-2508, FIN-06 — this used to INSERT INTO initiatives directly from financial_analysis_insights proposals, both the funnel and legacy-insert branches were removed). Registered for completeness; the handler already refuses to write.',
    },
    {
      writerId: 'ECO-W20',
      method: 'POST',
      path: /^\/financial-analyses\/live-preview\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Verified NO database write: finAnalysisSvc.computeLivePreview (economics.routes.ts:2511) computes ratios from the latest model without persisting an analysis. Registered for completeness; performs no mutation.',
    },
    {
      writerId: 'ECO-W21',
      method: 'DELETE',
      path: /^\/financial-analyses\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'financial_analyses',
      legacyIdFromPath: idAt2,
      reason:
        'Deletes a financial_analyses row and its financial_analysis_insights/financial_analysis_ratios children, addressed by :id (economics.routes.ts:2532, inline DELETEs at :2547-2549). Refuses if status=APPROVED. No proven successor.',
    },
    {
      writerId: 'ECO-W22',
      method: 'POST',
      path: /^\/valuations\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Creates a valuations row via valuationSvc.createValuation (economics.routes.ts:2637, valuationService.ts:283 INSERT INTO valuations). valuations is bridge-known, but this is a collection-level create with no path id yet, so legacyTable/legacyIdFromPath do not apply. The generic POST /api/v8/finance-v2/artifacts {artifactType:VALUATION_CASE} creates a bare shell with no domain logic seeded, so it is NOT treated as a proven equivalent successor (FINANCE.md finding #3).',
    },
    {
      writerId: 'ECO-W23',
      method: 'PUT',
      path: /^\/valuations\/[^/]+\/depth\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'valuations',
      legacyIdFromPath: idAt2,
      reason:
        'Changes the EV depth (managerial/banking) on the valuation addressed by :id: setValuationDepth delegates to updateAssumptions, UPDATE valuations (economics.routes.ts:2686, valuationDepthProfileService.ts:238, valuationService.ts:355). No proven successor.',
    },
    {
      writerId: 'ECO-W24',
      method: 'PUT',
      path: /^\/valuations\/[^/]+\/assumptions\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'valuations',
      legacyIdFromPath: idAt2,
      reason:
        'Updates assumptions on the valuation addressed by :id (economics.routes.ts:2738, valuationService.ts:355 updateAssumptions -> UPDATE valuations). No proven successor.',
    },
    {
      writerId: 'ECO-W25',
      method: 'PUT',
      path: /^\/valuations\/[^/]+\/peers\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'valuations',
      legacyIdFromPath: idAt2,
      reason:
        'Updates comparable peers on the valuation addressed by :id (economics.routes.ts:2756, valuationService.ts:417 updatePeers -> UPDATE valuations). No proven successor.',
    },
    {
      writerId: 'ECO-W26',
      method: 'POST',
      path: /^\/valuations\/[^/]+\/compute\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'valuations',
      legacyIdFromPath: idAt2,
      reason:
        'Runs the DCF/comps computation for the valuation addressed by :id: UPDATE valuations plus INSERT INTO valuation_snapshots (economics.routes.ts:2774, valuationService.ts:1008,1123). A canonical DCF compute exists at finance-v2 POST /valuation/variants/:businessVersionId/compute/dcf but the inventory explicitly notes it is not proven bit-identical, so successor stays null.',
    },
    {
      writerId: 'ECO-W27',
      method: 'POST',
      path: /^\/valuations\/[^/]+\/approve\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'valuations',
      legacyIdFromPath: idAt2,
      reason:
        'Approves the valuation addressed by :id: UPDATE valuations (economics.routes.ts:2854, valuationService.ts:1097 approveValuation). This is the writer the inventory flags as a fourth, independent "approve" writer (alongside FIN-W01/W02 model-approve and FINANCE-W071 budget-approve) with no protection at all — now observed rather than disabled, as this lane has no telemetry window for it yet. No proven successor.',
    },
    {
      writerId: 'ECO-W28',
      method: 'POST',
      path: /^\/valuations\/[^/]+\/advisory\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'valuations',
      legacyIdFromPath: idAt2,
      reason:
        'Generates and stores advisory content on the valuation addressed by :id: UPDATE valuations SET advisory (economics.routes.ts:2886, valuationService.ts:1517). No proven successor.',
    },
    {
      writerId: 'ECO-W29',
      method: 'POST',
      path: /^\/valuations\/[^/]+\/negotiation-pack\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'valuations',
      legacyIdFromPath: idAt2,
      reason:
        'Generates and stores a negotiation pack on the valuation addressed by :id: UPDATE valuations SET negotiation_pack (economics.routes.ts:2897, valuationService.ts:1687). No proven successor.',
    },
    {
      writerId: 'ECO-W30',
      method: 'POST',
      path: /^\/valuations\/[^/]+\/advisory\/[^/]+\/convert-to-initiative\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'CORRECTION to inventory (FINANCE-W080 called this a "possible split-brain pair, not confirmed"): the handler no longer writes valuations or initiatives directly. FIN-06 rewired it through confirmValuationRecommendationCandidateHandoff, the same canonical Finance Candidate handoff seam financeCandidateHandoffCore.ts uses (economics.routes.ts:2970, valuationService.ts:1712-1742 convertAdvisoryRecommendationToInitiative). It already writes the canonical destination, so it carries no legacyTable and needs no successor.',
    },
    {
      writerId: 'ECO-W31',
      method: 'POST',
      path: /^\/valuations\/[^/]+\/export\/pptx\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'valuations',
      legacyIdFromPath: idAt2,
      reason:
        'Exports a PPTX and stamps export_path/exported_at on the valuation addressed by :id: UPDATE valuations (economics.routes.ts:2998, valuationExportService.ts:280). No proven successor.',
    },
    {
      writerId: 'ECO-W32',
      method: 'DELETE',
      path: /^\/valuations\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'valuations',
      legacyIdFromPath: idAt2,
      reason:
        'Deletes the valuations row addressed by :id (economics.routes.ts:3061). No proven successor; irreversible delete with zero protection before this registration.',
    },
    {
      writerId: 'ECO-W33',
      method: 'POST',
      path: /^\/budgets\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Creates a budgets row plus its initial budget_lines and budget_scenarios rows via budgetingSvc.createBudget (economics.routes.ts:3084, budgetingService.ts:179,197,202,207). budgets is not one of the four legacy tables the identity bridge knows; no proven successor.',
    },
    {
      writerId: 'ECO-W34',
      method: 'PUT',
      path: /^\/budgets\/[^/]+\/lines\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Updates a budget_lines row for the budget/line pair addressed by :budgetId/:lineId (economics.routes.ts:3119, budgetingService.ts:282). No proven successor.',
    },
    {
      writerId: 'ECO-W35',
      method: 'POST',
      path: /^\/budgets\/[^/]+\/scenarios\/[^/]+\/project\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Writes generated projections onto a budget_scenarios row (economics.routes.ts:3132, budgetingService.ts:389 generateScenarioProjections). No proven successor.',
    },
    {
      writerId: 'ECO-W36',
      method: 'PUT',
      path: /^\/budgets\/[^/]+\/scenarios\/[^/]+\/adjustments\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Writes adjustments onto a budget_scenarios row (economics.routes.ts:3146, budgetingService.ts:406 updateScenarioAdjustments). No proven successor.',
    },
    {
      writerId: 'ECO-W37',
      method: 'POST',
      path: /^\/budgets\/[^/]+\/approve\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Approves the budget addressed by :id: INSERT INTO budget_snapshots plus UPDATE budgets SET status=APPROVED (economics.routes.ts:3163, budgetingService.ts:434,438 approveBudget). This is FINANCE-W071 in the inventory ("a THIRD independent approve writer" alongside model-approve and analysis-approve). No proven successor.',
    },
    {
      writerId: 'ECO-W38',
      method: 'DELETE',
      path: /^\/budgets\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Deletes a budgets row and its budget_lines/budget_scenarios children, addressed by :id (economics.routes.ts:3195, inline DELETEs at :3213-3215). Refuses if status=APPROVED. No proven successor.',
    },
    {
      writerId: 'ECO-W39',
      method: 'POST',
      path: /^\/budgets\/[^/]+\/import-document\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Parses free-text document content and inserts budget_lines rows for the budget addressed by :id (economics.routes.ts:3220, inline INSERT at :3311). No proven successor.',
    },
    {
      writerId: 'ECO-W40',
      method: 'POST',
      path: /^\/budgets\/[^/]+\/initiatives\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Links an initiative to the budget addressed by :id: INSERT OR IGNORE INTO budget_initiative_links (economics.routes.ts:3363, inline INSERT at :3378). No proven successor.',
    },
    {
      writerId: 'ECO-W41',
      method: 'DELETE',
      path: /^\/budgets\/[^/]+\/initiatives\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Removes a budget_initiative_links row for the budget/initiative pair addressed by :id/:initiativeId (economics.routes.ts:3399, inline DELETE at :3406). No proven successor.',
    },
    {
      writerId: 'ECO-W42',
      method: 'PUT',
      path: /^\/finance-settings\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Upserts the organization-scoped finance settings row keyed by (organization_id, setting_key=\'finance\') — a collection-level write, not addressed by a path id (economics.routes.ts:3431, valuationService.ts:210,219 setOrgFinanceSettings -> INSERT INTO organization_settings ... ON CONFLICT). No proven successor.',
    },
  ],
};

export default ECONOMICS_CUTOVER;
