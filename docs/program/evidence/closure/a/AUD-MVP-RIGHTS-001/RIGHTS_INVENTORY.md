# AUD-MVP-RIGHTS-001 — Rights/Provenance Inventory

Status: **evidence complete**. Scope, method, and every hit are below; no hit
was excluded because it was inconvenient.

## Scope and method

The owner decision bounding this work is: *Audit MVP uses an INTERNAL,
unlicensed transformation pack only; named EXTERNAL standards remain OFF
without rights.* That decision is about the **Audits kernel's pack/preset/
criteria content** — the data a consultant can select and hand to a client as
an audit deliverable. It is not a claim about every place the string "ISO" or
"audit" appears in a 1,600-table product.

So the sweep below is reported in two tiers:

1. **In-scope**: content that is, or feeds, an Audits-kernel pack, preset, or
   criterion (`audit_packs`, `audit_pack_criteria`, `audit_norm_sources`, and
   the frontend `AuditPreset` data that seeds the legacy wizard). This is
   where every hit is classified (i)/(ii)/(iii) below.
2. **Adjacent, out of scope, noted for honesty**: a repo-wide regex sweep
   turned up ~1,125 lines mentioning ISO/SOC2/NIST/CMMI/HIPAA/PCI-DSS/etc.
   across the whole product. The overwhelming majority are a *different*
   system — the multi-framework **Assessment** module (DRD/SIRI/ADMA/CMMI/
   LEAN, `src/services/frameworkRegistry.ts`, `src/services/cmmiStructure.ts`),
   GDPR/compliance routes, financial statement migrations, and generic
   comments. That module already carries its own `legalNotice` /
   `legalNoticeType: 'educational'` disclaimers per framework (e.g. CMMI:
   *"CMMI jest znakiem towarowym ISACA... Implementacja w Consultify służy
   celom edukacyjnym"*, SIRI: explicit EDB/TÜV SÜD attribution) and its own
   availability gate (`isFrameworkAvailable` — CMMI/LEAN are `coming_soon`,
   not startable). It is **not** an Audits-kernel pack, is **not** covered by
   this decision packet's fail-closed default, and I did not re-litigate it.
   Flagging its existence here so nobody later claims the sweep missed it.

### Reproducible commands

```bash
# Broad repo sweep (what turned up the 1,125-line adjacent-system noise)
cd /Users/piotrwisniewski/Developer/consultify-closure-claude-a
grep -rnE '\b(ISO[ /-]?[0-9]{4,5}|IATF[ ]?16949|VDA[ ]?6\.[0-9]|SOC[ ]?2|NIST([ ]?(800-53|800-171|CSF))?|COBIT|ITIL|HIPAA|GDPR|PCI[ -]?DSS|CMMI)\b' \
  --include='*.ts' --include='*.tsx' --include='*.sql' --include='*.js' --include='*.json' --include='*.md' \
  src server server/migrations 2>/dev/null \
  | grep -viE 'node_modules|__tests__|\.test\.|\.spec\.|_backup'

# Narrowed, in-scope sweep (Audits kernel only)
grep -rniE '\b(ISO[ /-]?[0-9]{3,5}|IATF|VDA|SOC[ ]?2|NIST|COBIT|ITIL|HIPAA|PCI[ -]?DSS|CMMI)\b' \
  server/src/services/audits server/src/routes/audits src/components/Audit \
  server/migrations/20260813_audits_method_core.sql \
  server/migrations/20260813b_audits_source_classification_split.sql \
  2>/dev/null | grep -v "__tests__"

# Confirm no other seed/fixture writes audit_packs / audit_pack_criteria content
grep -rln "INSERT INTO audit_packs\|audit_pack_criteria" server/migrations server/scripts server/src 2>/dev/null \
  | grep -v __tests__ | grep -v _backup

# Confirm the ISO preset has exactly one producer and two consumers
grep -rln "AuditPreset\|auditPresets\|ISO_27001_PRESET" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
```

## In-scope hits (Audits kernel: pack/preset/criteria content)

| # | File:line | Classification | Note |
|---|---|---|---|
| 1 | `src/components/Audit/auditPresets.ts:47-145` (`ISO_27001_PRESET`) | **(ii) standard NAME/numbering used as product content** | 14 Annex A control-area labels (A.5–A.18), each with a suggested owning role, plus the strings "ISO 27001 readiness audit" / "ISO/IEC 27001" / "Załącznika A normy ISO/IEC 27001" as the preset's `label`/`description`/`objective`. This IS selectable, user-facing content — clicking it pre-populates a live wizard. It does not carry an `audit_norm_sources` row, no `rights_status`, no classification, and is not reachable through `packValidator`/`packService` at all — see Gap 2 below. |
| 2 | `src/components/Audit/AuditsHub.tsx:791,795` | (ii), consumer | "New ISO 27001 audit" launcher button (`openWizard('iso27001')`), rendered by default because `MODULE_AUDITS: 'open'` (`src/utils/betaAccess.ts:48`) — no flag gates this specific preset. |
| 3 | `src/components/Audit/AuditOrchestratorWizard.tsx:10,56` | (ii), consumer | Wizard prop/comment referencing the ISO 27001 preset entry point. No new content, just wiring. |
| 4 | `src/components/Audit/index.ts:5` | (iii) incidental mention | Barrel-file comment listing what the module exports ("...built-in presets (ISO 27001 + new-company heuristic)"). Documentation, not content. |
| 5 | `server/src/services/audits/packValidator.ts:446` (`/\b(ISO\|IATF\|VDA\|SOC\s?2\|HIPAA)\b/i`) | (iii) incidental — this is the **enforcement** regex | Exists specifically to *block* a pack title implying one of these standards (`PACK_TITLE_IMPLIES_NORMATIVE`). Naming the standards here is defensive, not a content reproduction. |
| 6 | `server/src/services/audits/packSeed.ts:10` | (iii) incidental | Comment explaining why the demo pack's title deliberately excludes ISO/IATF/VDA/SOC2/HIPAA. Documentation of an absence, not content. |
| 7 | `server/src/services/audits/types.ts:267` | (iii) incidental | Doc-comment example of what a `sourceReference` string *could* look like: `„ISO 19011:2018, 6.4.7"`. Not stored data — no row in the live schema uses this example. |
| 8 | `server/migrations/20260813_audits_method_core.sql:74` | (iii) incidental | Column comment giving `'iso-19011'` as an *example* `source_key` value. No seed/fixture in the repo actually inserts a source with this key. |

**Reproduced normative text (i): zero hits.** No file in the Audits kernel
contains ISO/IATF/VDA/SOC2/HIPAA/NIST clause text, numbered requirement
language, or anything resembling a copy of a standard's body. `audit_pack_
criteria.requirement_text` and `.source_reference` are documented in the
schema itself as own-wording (`server/migrations/20260813_audits_method_
core.sql:162-165`), and the one seeded pack (`packSeed.ts`) is verifiably
own-wording throughout (verified by reading all 9 demo criteria).

## Summary counts

- (i) reproduced normative text: **0**
- (ii) standard name/numbering used as content: **3** (1 producer + 2 direct consumers — all the same ISO 27001 preset)
- (iii) incidental mention only: **5**

**Most serious finding**: hit #1, `ISO_27001_PRESET` in
`src/components/Audit/auditPresets.ts`. It is the only place in the product
where a named external standard is offered to a user as selectable,
launchable audit content — outside the rights kernel, with no
`audit_norm_sources` row and no `rights_status`. See Gap 2 in the decision
packet for the exact mechanism and the minimal fix.

## Verdict on the ISO 27001 preset: reproduced text, or standard-naming-as-content?

**Standard-naming-as-content — not reproduced normative text.** What I
actually read in `auditPresets.ts:47-145`:

- The 14 entries are Annex A **domain titles only** ("Cryptography", "Supplier
  relationships", "Business continuity management", ...) — one short phrase
  per area plus a heuristic "suggested owning role" (e.g. CISO, IT Lead).
  ISO/IEC 27001's actual Annex A text runs to specific, numbered control
  *objectives and controls* (e.g. control 5.1 with its defined implementation
  guidance) — none of that granular, copyrightable clause language appears
  here. What's copied is the **taxonomy** (14 domain names, A.5–A.18
  numbering) and the **standard's name/branding**, not its body text.
- That distinction matters legally (naming a standard and organizing content
  by its public taxonomy is a different exposure than reproducing its
  copyrighted clauses) but it does **not** make this MVP-safe by itself: the
  preset still brands a deliverable "ISO 27001 readiness audit" / "Audyt
  gotowości ISO 27001" and hands it to a client, without any rights
  verification, license reference, or the fail-closed gate that the real
  Audits kernel enforces for exactly this claim (`PACK_TITLE_IMPLIES_
  NORMATIVE`). It bypasses that gate entirely because it isn't a pack — it's
  static frontend data feeding a *different*, legacy write path
  (`AuditOrchestratorWizard` → `audit_programs.config`, not `audit_packs`).
