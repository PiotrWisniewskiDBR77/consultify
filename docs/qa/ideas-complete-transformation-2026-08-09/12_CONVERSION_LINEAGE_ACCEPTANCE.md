# E11 — Conversion, import, export and templates acceptance

Candidate: HEAD `deb103fcde`, base `origin/demo` @ `9d17cac114`. Canon:
`docs/standards/idea-workspace/10_KONWERSJA_EKSPORT_IMPORT_SZABLONY.md`. DoD: doc 11 §4 E11 ("one
conversion pipeline, explicit source scope, append-only lineage/backlinks, file-only Export and
safe imports/templates" / "Initiative/Tasks/Decision/Report/Presentation contain meaningful data/
backlinks; Finance target status consistent; repeated conversions coexist; exports are real/openable
files; import recovery passes; ambiguous labels/dead conversion code removed").

## 1. Four-state summary

| State | Result |
|---|---|
| Code exists | Yes — `ConversionPreviewDialog.tsx`, per-node convert actions, `mappingVersion`/`source_link` schema |
| Mounted in a real consumer | Yes, verified this session — `ConversionPreviewDialog` is imported and rendered twice in `IdeaMapWorkspace.tsx` (lines 4036, 4567), not a dangling component |
| Executed at runtime | NOT VERIFIED |
| Persisted and read back | NOT VERIFIED — `mappingVersion` column lives in an **unapplied** migration (see `03B_DATA_AND_MIGRATION_REPORT.md`) |

## 2. Evidence from this program's git history and this session's own re-check

- Wave 5 (`111868e07a`) commit body: a mandatory preview dialog now gates every conversion entry
  point (scope, target, included elements, field mapping, warnings, prior-conversion count);
  lineage gained `mappingVersion` and a populated `source_link`; scope is sent explicitly instead of
  guessed from `nodeIds.length`; Mind Map's single-node Convert no longer cascades to all
  descendants. This session confirmed the dialog is genuinely mounted (§1) and confirmed the
  migration file itself documents the exact shape it adds (`createdAt, createdBy, mappingVersion,
  sourceLink` — `source_link` already existed pre-migration; only `mappingVersion` was new, per the
  migration's own header comment read directly this session).
- **A stale claim in the program's own ledger was found and corrected by the agents, not by this
  task** — Wave 5's commit body: "a stale claim in our own ledger was DISPROVED by the agent — the
  'unconditional whole-Idea promoted overwrite' was already fixed on 2026-07-23; the misleading
  in-repo comment asserting otherwise was corrected." Cited here because it is exactly the kind of
  self-correcting behavior this program's house rules ask for, and it means the delivery package's
  earlier documents may still contain other stale claims about E11 that this task did not have
  scope to re-audit line by line.
- Convert-to-Process-Flow was relabelled, not faked: per the same commit body, it creates no
  cross-module record, so it was moved under a "Generate" flyout instead of masquerading as a
  conversion — an honesty fix (mislabeling a generation as a conversion would itself be a doc-11
  hard-FAIL-adjacent issue: a control that claims to do one thing while doing another).
- Mind Map's `idea.node.mm_convert_initiative`/`_decision`/`_tasks` actions (cross-referenced from
  `05_MIND_MAP_ACCEPTANCE.md`, re-verified directly in the registry this session): each carries
  `requiresPreview: true` and `undo.kind: 'manual_delete'` with an honest evidence string ("brak
  automatycznego cofnięcia" — no automatic undo) rather than fabricating an undo mechanism that
  doesn't exist.

## 3. Explicitly NOT VERIFIED

- The `mappingVersion` column does not exist on any real database — the migration that adds it is
  unapplied (confirmed directly this session, see `03B_DATA_AND_MIGRATION_REPORT.md`). Any code
  path that reads or writes `mappingVersion` today is running against a schema without that column;
  its actual behavior on an unmigrated database (fail-open, error, or silent undefined) was **not
  specifically checked by this task** — this is a real gap this report is naming rather than
  glossing over, distinct from E12's confidentiality migration, which does have an explicit
  column-absent contract test.
- No end-to-end conversion (Idea → Initiative/Task/Decision/Report/Presentation) has been observed
  writing a real backlink and being read back, in this program's history.
- Doc-11's "exports are real/openable files" and "import recovery passes" requirements have not
  been runtime-tested by this program.

## 4. Verdict

**PARTIAL** — unchanged from `00_PROGRAM_STATUS_AND_VERSION.md`'s Program G / E11 row. The
mandatory-preview and honest-relabeling work is real, mounted, and grounded in a self-correcting
finding (the disproved stale ledger claim); the schema change it depends on for full lineage
completeness (`mappingVersion`) is unapplied, so read-back correctness for that specific field is
not just unverified — it is untestable against a real database until the migration lands.

---

**Re-verified at `6fec03f7a0` (stream S11-DOCS, 2026-08-12):** the
"unapplied migration" this verdict names is STALE — `20260810_idea_conversion_mapping_version.sql`
was applied to the isolated local ephemeral Postgres before this wave started
(RISK-04, RESOLVED — see `16_OPEN_RISKS_AND_LIMITATIONS.csv`), and `mapping_version`
read-back is now proven under Gate 3. Worth noting alongside this closure: the
column carries a Postgres `DEFAULT 'v1'`, so an omission-style test assertion
against it is vacuous by construction — RISK-23 documents the trap and its
mitigation (the assertion was rewritten to sabotage the written constant, not
the write path). No E11-specific change landed in this wave beyond that
prior-wave migration closure. Corrected verdict: **PARTIAL; the `mappingVersion`
schema dependency is now applied and read-back-proven on isolated local DB
only — never run against demo/prod/dev.**
