/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — MATERIALS domain, presentations mount only.
 *
 * STRUCTURAL FACT: there is no `/api/materials` router (`rg -n "'/api/materials"
 * server/src/Gateway.ts server/src/index.ts` -> 0 matches). "Materials" in the
 * product is really four routers — `document-studio.routes.ts`,
 * `workbook.routes.ts`, `presentations.routes.ts`, `documents.routes.ts` — each
 * with its own split-brain shape. This file covers ONLY
 * `server/src/routes/presentations.routes.ts`, mounted at `/api/presentations`
 * (`server/src/Gateway.ts:1158`), which is the mount with the domain's clearest
 * live dual-write. Workbook/Document-Studio/Documents writers from the
 * `MATERIALS.json` inventory (MATERIALS-W01, W12-W16) are NOT registered here —
 * they need their own guard mount and were out of scope for this pass.
 *
 * THE FINDING THIS EXISTS FOR — verified directly against the running handlers,
 * not just the service's own header comment:
 *
 *   `presentationExportReceiptService.ts:3-20` says presentations.routes.ts has
 *   "THREE export paths (PPTX download, PDF export, PNG/zip export) that each
 *   independently wrote only to `presentation_export_records`" and that "the
 *   existing... write below is kept as-is" alongside the new governed
 *   `artifact_export_receipts` receipt (`handoffSpineService.ts:778`, deduped by
 *   the partial unique index `idx_export_receipt_org_idem` on
 *   `(organization_id, idempotency_key)` — `20260912_claude_c_handoff_spine.sql:188-190`).
 *   `presentation_export_records` itself has no hash and no idempotency column
 *   at all (`20260719_baseline_gap.sql:7722-7738`), so a retried request there
 *   simply inserts a second untrustworthy row while the canonical receipt
 *   replays the same one.
 *
 *   Reading the three handlers line by line surfaces something the service
 *   header does not say: the dual-write is NOT uniform.
 *     - PPTX (`GET /decks/:id/download`, MATERIALS-W06) only calls the legacy
 *       `recordPresentationExportRecord()` (`presentations.routes.ts:478-511`)
 *       on the quality-blocked (:2490), render-failed (:2533), limit-exceeded
 *       (:2571) and post-render (:2648) FAILURE branches. On the success path
 *       (:2596-2634) it calls ONLY `completePresentationExport()` (:2603) — the
 *       canonical write. There is no `recordPresentationExportRecord()` call
 *       anywhere between :2603 and the `res.sendFile` at :2634. So for PPTX,
 *       "every call writes both tables" is false; only failed/blocked exports
 *       do, successful ones are canonical-only already.
 *     - PDF (`GET /decks/:deckId/export/pdf`, MATERIALS-W07) DOES dual-write
 *       unconditionally: `completePresentationExport()` (:2876) is immediately
 *       followed by `recordPresentationExportRecord({status:'completed'})`
 *       (:2892) on success, and `failPresentationExport()` (:2913) by
 *       `recordPresentationExportRecord({status:'failed'})` (:2929) on failure.
 *     - PNG (`POST /decks/:deckId/export/png`, MATERIALS-W08) dual-writes the
 *       same unconditional way: :7596/:7604 on success, :7615/:7622 on failure.
 *
 *   A FOURTH export path exists that the service header does not mention at
 *   all: `POST /decks/:deckId/export/html` (:3445, MATERIALS-W17). It writes
 *   `recordPresentationExportRecord()` on blocked (:3511) and completed (:3547)
 *   — but never calls `beginPresentationExport`/`completePresentationExport` at
 *   all. HTML export is legacy-only; it was never wired to the governed spine,
 *   so unlike W06/W07/W08 there is no dual-write to retire here, only a gap to
 *   close later.
 *
 *   None of the four export routes has a SEPARATE successor endpoint a client
 *   could call instead — `beginPresentationExport`/`completePresentationExport`
 *   run inside the SAME handler as a side effect of the same GET/POST. Per the
 *   lane rule, `successor` is therefore `null` for all of them: there is no
 *   route to redirect a caller to, only an INSERT to eventually delete from
 *   inside the handler once a telemetry window proves the legacy rows are
 *   unread.
 *
 * SECOND FINDING, VERIFIED, NOT REGISTERED HERE (no guard needed — these are
 * reported for the record, per the brief, not built into this config):
 * `presentation_templates` has two independent, unsynchronized writers.
 *   - MATERIALS-W09 (`POST /templates/plan`, :1258-1355) INSERTs (:1291) with
 *     NO canonical registration call anywhere in the handler (confirmed: zero
 *     `registerArtifactOrigin` hits in that line range).
 *   - `POST /api/deliverables/templates` -> `deliverableTemplateService.ts`'s
 *     `type==='deck'` branch INSERTs `presentation_templates` (:997), then
 *     calls `registerBuilderTemplateArtifactBestEffort()` (:1006 call site,
 *     :738 definition) inside a `try { ... } catch (err) { logger.warn(...) }`
 *     (try at :751, catch at :887-891) that explicitly logs and swallows any
 *     `registerArtifactOrigin` failure with "template row still saved" — so
 *     the inventory's "best effort, can silently fail leaving an orphan row"
 *     characterization is confirmed exactly as claimed. These two writers use
 *     different column sets and neither is aware of the other.
 * This domain has no entry in `DOMAIN_IDENTITY_REGISTRIES`
 * (`canonicalIdentityBridge.ts`), so every writer below always resolves
 * `identity_status = 'not_applicable'` with an honest "no alias registry"
 * reason — never a fabricated `resolved`.
 *
 * Per the lane rule, NOTHING here is `disabled`: none of these writers has a
 * telemetry window yet, and the export writers have no separate route to
 * redirect to even if they did.
 */

import type { LegacyCutoverDomainConfig } from '../legacyCutoverKernel.js';

/** `/decks/:x/...` router-local paths carry the deck/template id at segment
 * index 2 (`['', 'decks', id, ...]`). Used only for the informational
 * `legacy_id` telemetry column; `materials` has no identity registry so it
 * never drives a block decision. */
const deckIdFromPath = (path: string): string => decodeURIComponent(path.split('/')[2] || '');

export const MATERIALS_PRESENTATIONS_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'materials',
  rollbackEnv: 'MATERIALS_LEGACY_WRITER_ROLLBACK_ENABLED',
  rollbackWritersEnv: 'MATERIALS_LEGACY_ROLLBACK_WRITERS',
  disabledCode: 'MATERIALS_LEGACY_WRITER_DISABLED',
  unmappedCode: 'MATERIALS_LEGACY_IDENTITY_UNMAPPED',
  writers: [
    {
      writerId: 'MATERIALS-W02',
      method: 'POST',
      path: /^\/decks\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'presentation_decks',
      reason:
        'POST /decks (presentations.routes.ts:1886) INSERTs INTO presentation_decks (:2024) and ' +
        'presentation_cards (:2050) — the only store for deck content (title/deck_json/slides). It also ' +
        'calls syncArtifactRegistryForDeck() (:2067, defined :792) -> registerArtifactOrigin() (:803), which ' +
        'writes a v8_output_artifacts origin-link pointer (title + summary metadata only), not the deck ' +
        'content itself. A pointer is not an equivalent canonical content write, so there is nothing to ' +
        'redirect callers to; observed, not disabled, pending a telemetry window.',
    },
    {
      writerId: 'MATERIALS-W03',
      method: 'PUT',
      path: /^\/decks\/[^/]+\/autosave\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'presentation_decks',
      legacyIdFromPath: deckIdFromPath,
      reason:
        'PUT /decks/:deckId/autosave (:3703) INSERTs a snapshot INTO presentation_deck_versions (:3758) and ' +
        'UPDATEs presentation_decks.title/deck_json/version (:3777) on every autosave tick; no canonical ' +
        '(v8_output_artifacts / wave5_artifacts) content write accompanies either statement. No successor exists.',
    },
    {
      writerId: 'MATERIALS-W04',
      method: 'POST',
      path: /^\/decks\/[^/]+\/agent-edit\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'presentation_ai_operations',
      legacyIdFromPath: deckIdFromPath,
      reason:
        'POST /decks/:deckId/agent-edit (:3799-3923) journals the AI-proposed edit only via saveAiOperation() ' +
        '(call site :3864, INSERT INTO presentation_ai_operations at :859); this route itself never touches ' +
        'presentation_decks or presentation_deck_versions — that write belongs to the separate ' +
        'POST /decks/:deckId/agent-edit/:operationId/accept route (:3923 onward), a distinct handler this ' +
        'entry does not cover. No canonical equivalent for presentation_ai_operations exists; no successor.',
    },
    {
      writerId: 'MATERIALS-W05',
      method: 'DELETE',
      path: /^\/decks\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'presentation_decks',
      legacyIdFromPath: deckIdFromPath,
      reason:
        'DELETE /decks/:id (:2943) deletes the legacy content row directly (DELETE FROM presentation_decks ' +
        'at :2960); whether a paired v8_output_artifacts pointer is archived or deleted alongside it was not ' +
        'traced this pass (open unknown carried over from the inventory). No successor confirmed.',
    },
    {
      writerId: 'MATERIALS-W06',
      method: 'GET',
      path: /^\/decks\/[^/]+\/download\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'presentation_export_records',
      legacyIdFromPath: deckIdFromPath,
      reason:
        'GET /decks/:id/download (:2399, PPTX) opens a governed artifact_export_receipts receipt via ' +
        'beginPresentationExport() (:2506) on every call, but the legacy recordPresentationExportRecord() ' +
        '(:478-511) write fires ONLY on the quality-blocked (:2490), render-failed (:2533), limit-exceeded ' +
        '(:2571) and post-render (:2648) FAILURE branches — verified there is no such call on the success ' +
        'path (:2596-2634), which calls only completePresentationExport() (:2603, canonical). Unlike PDF/PNG ' +
        'below, successful PPTX downloads are already canonical-only today. The canonical write is a side ' +
        'effect of this same GET handler, not a separate route a client could call instead, so successor is ' +
        'null: cutting this over means deleting the failure-path legacy INSERTs, not redirecting traffic.',
    },
    {
      writerId: 'MATERIALS-W07',
      method: 'GET',
      path: /^\/decks\/[^/]+\/export\/pdf\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'presentation_export_records',
      legacyIdFromPath: deckIdFromPath,
      reason:
        'GET /decks/:deckId/export/pdf (:2662) dual-writes unconditionally on BOTH outcomes: success calls ' +
        'completePresentationExport() (:2876) then recordPresentationExportRecord({status:"completed"}) ' +
        '(:2892); failure calls failPresentationExport() (:2913) then recordPresentationExportRecord' +
        '({status:"failed"}) (:2929). presentationExportReceiptService.ts:3-20 documents this pair as the ' +
        '"kept as-is" legacy write alongside the additive spine receipt. Same-endpoint side effect with no ' +
        'separate successor route -> successor null.',
    },
    {
      writerId: 'MATERIALS-W08',
      method: 'POST',
      path: /^\/decks\/[^/]+\/export\/png\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'presentation_export_records',
      legacyIdFromPath: deckIdFromPath,
      reason:
        'POST /decks/:deckId/export/png (:7452) dual-writes unconditionally the same way as PDF: ' +
        'completePresentationExport() (:7596) then recordPresentationExportRecord({status:"completed"}) ' +
        '(:7604) on success; failPresentationExport() (:7615) then recordPresentationExportRecord' +
        '({status:"failed"}) (:7622) on failure. Same-endpoint side effect with no separate successor route ' +
        '-> successor null.',
    },
    {
      writerId: 'MATERIALS-W17',
      method: 'POST',
      path: /^\/decks\/[^/]+\/export\/html\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'presentation_export_records',
      legacyIdFromPath: deckIdFromPath,
      reason:
        'NOT in the MATERIALS.json inventory or in presentationExportReceiptService.ts\'s header (which ' +
        'claims only "THREE export paths" for this table) — found by reading the router directly. ' +
        'POST /decks/:deckId/export/html (:3445) writes recordPresentationExportRecord() on the ' +
        'quality-blocked (:3511) and completed (:3547) paths but never calls beginPresentationExport / ' +
        'completePresentationExport / failPresentationExport at all: HTML export was never wired to the ' +
        'governed artifact_export_receipts spine. Unlike W06/W07/W08 this is not a dual-write to retire — ' +
        'it is a legacy-only writer with a genuine coverage gap and no canonical counterpart, so successor ' +
        'is null for a different reason than its siblings.',
    },
    {
      writerId: 'MATERIALS-W09',
      method: 'POST',
      path: /^\/templates\/plan\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'presentation_templates',
      reason:
        'POST /templates/plan (:1258-1355) INSERTs INTO presentation_templates (:1291) with zero calls to ' +
        'registerArtifactOrigin anywhere in the handler (confirmed by direct read of :1258-1355) — no ' +
        'canonical pointer at all, let alone a full mirror. A second, independent writer into the same table ' +
        'exists at deliverableTemplateService.ts:997 (reached via POST /api/deliverables/templates, a ' +
        'different router) using a different column set and a best-effort registerArtifactOrigin try/catch ' +
        '(deliverableTemplateService.ts:751-891) that this writer does not share — the two are unsynchronized, ' +
        'confirming the inventory\'s split-brain claim. That second writer is out of scope for this file (it ' +
        'is not in presentations.routes.ts) and is reported, not registered, per the brief.',
    },
    {
      writerId: 'MATERIALS-W10',
      method: 'PUT',
      path: /^\/templates\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'presentation_templates',
      legacyIdFromPath: deckIdFromPath,
      reason:
        'PUT /templates/:id (:1447) UPDATEs presentation_templates (:1497) directly; same table as ' +
        'MATERIALS-W09, no canonical mirror found for the update path either.',
    },
    {
      writerId: 'MATERIALS-W11',
      method: 'PUT',
      path: /^\/brand-kit\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'brand_kits',
      reason:
        'PUT /brand-kit (:1754) INSERTs/upserts brand_kits (:1778, ON CONFLICT(organization_id) DO UPDATE); ' +
        'organization brand kit is a standalone legacy table with no artifact-schema equivalent found in ' +
        'this domain.',
    },
  ],
};
