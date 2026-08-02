-- EXE-09 — adversarial-review fix: DB-level dedup backstop for the no-KPI
-- "expected_roi fallback" closure benefit (executionResultsBridge.ts
-- `handoffFromInitiativeFallback`).
--
-- Migration 783 added a partial unique index on `initiative_benefits`
-- covering the KPI-backed closure-handoff row shape
-- `(initiative_id, kpi_id, source_tag) WHERE source_tag = 'M14_CLOSURE_HANDOFF'`
-- — but that index only applies `WHERE kpi_id` participates in the key
-- implicitly via NOT being excluded; in Postgres a UNIQUE index treats NULL
-- as distinct from every other NULL, so two rows with the SAME
-- (initiative_id, source_tag) and BOTH kpi_id IS NULL (the fallback shape)
-- do NOT violate that index — confirmed by reading
-- `handoffFromInitiativeFallback`'s own doc comment: "guarded here at the
-- application level" (SELECT-then-INSERT, no DB backstop). Two concurrent
-- delivery attempts for the same closure (now normally prevented by
-- closureDeliveryReceiptService.ts's `claimLeg` atomic claim, added in the
-- same review round) could otherwise both pass that SELECT and both INSERT.
--
-- This index is the same "additive, IF NOT EXISTS" convention as every other
-- migration in this lineage and does not modify migration 783 or
-- executionResultsBridge.ts's application-level check (defense in depth,
-- not a replacement for it).

CREATE UNIQUE INDEX IF NOT EXISTS idx_initiative_benefits_closure_fallback_dedup
  ON initiative_benefits (initiative_id, source_tag)
  WHERE kpi_id IS NULL AND source_tag = 'M14_CLOSURE_HANDOFF';
