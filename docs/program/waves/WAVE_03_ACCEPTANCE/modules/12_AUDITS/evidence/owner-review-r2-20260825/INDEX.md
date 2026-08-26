# Audits — owner review R2 (2026-08-25) — evidence index

DEC-2026-08-25-66 (`OWNER_CHANGE`) FIX pass. Branch `codex/audits-canon-fix-20260825`
(worktree `/private/tmp/consultify-audits-fix`, base `codex/m03-admin-20260824`).
Harness: `dev-render/screens/audyty-piec-powierzchni.tsx` (U8, real `AuditsMethodHub`)
+ `dev-render/screens/audyty-warsztat-kryterium.tsx` (W4, real `CriterionWorkspace`),
served locally on `http://localhost:4520` (`.claude/launch.json` →
`audits-block-20260825`). Captured with `dev-render/shot.mjs` (real Chromium,
`deviceScaleFactor: 2`, real console/network error capture — none beyond the
pre-existing harmless `[OrgContext] Error fetching orgs` noise every dev-render
screen prints when no real backend is mounted).

All screenshots below are from the FIXED code on this branch, not the prior
R1 evidence. Self-assessed against `docs/ui-standards/TRIADA_KANON.md` Część B.

## 1. Menu 3 reduced to canon (DEC-66 pt.1)

| File | What it shows |
|---|---|
| `01-library-light.png` / `01-library-dark.png` | Library: **ONE** Menu 3 chip row (Wszystkie·Zweryfikowane·W przeglądzie·Niezweryfikowane·Brak dowodu źródła), not two stacked rows. `Typ źródła` moved to the table's own column filter (funnel icon next to the header, same mechanism `Weryfikacja`/`Status publikacji` already used) — visible as the small chevron next to "TYP ŹRÓDŁA"/"WERYFIKACJA". |
| `01-processes-light.png` / `01-processes-dark.png` | Sessions: unchanged single-row lifecycle chips (`processesChips`), included for parity comparison — proves Library now matches this pre-existing pattern instead of the other way round. |

Self-check (Część B, pkt 1–7 Menu): ✓ pigułki h-9 ramka; ✓ CTA/segment/filtry po prawej
(brak dodatkowych, n/d dla tego huba); ✓ bez liczników w Menu 2; ✓ Menu 3 chipy h-7 z
licznikami (0 widoczne — patrz "W przeglądzie 0"); n/d bulk (brak checkboxów w tym
kontrakcie tabeli — nie było ich też przed zmianą, poza zakresem tej poprawki);
n/d karty otwartych pozycji; n/d przyciski AI (Audits nie deklaruje żadnych, jak przed
zmianą).

## 2. Reports row kebab added, real transitions (DEC-66 pt.2)

| File | What it shows |
|---|---|
| `01-reports-light.png` / `01-reports-dark.png` | Reports list now has a kebab (⋮) at the end of every row — previously **absent entirely** (`StandardTable` rendered `hideRowActions` with no `rowMenu` prop). |
| `02-reports-kebab-open-light.png` / `02-reports-kebab-open-dark.png` | Kebab open on the `draft` row: **Zatwierdź** (Approve) enabled — real call to `POST /audits/reports/:id/approve`, backend-gated (`reportService.approveReport`); **Opublikuj** (Publish) disabled with a real reason (`Wymagany status „zatwierdzony" (obecny: Szkic)`); **Otwórz podgląd** enabled; **Edytuj**/**Archiwizuj** disabled with real reasons (report is an immutable render of an Output — no such API exists); **Usuń** disabled, red, last, separated, with reason ("Raporty są nieusuwalne — ślad audytu."). Matches kanon A6 exactly: 5 blocks, real-or-disabled-with-reason, zero placebo. |
| `05-reports-approve-after-light.png` | Proof the Approve action is REAL, not decorative: same row's Status chip changed from "Szkic" to "Zatwierdzony" and "Zaktualizowano" updated to today's date, after clicking Zatwierdź in the kebab — no page reload, in-place state update from the (mocked but contract-shaped) `POST .../approve` response. |

Self-check (Część B, pkt 19–23 Kebab): ✓ otwiera się per wiersz, 2 separatory/3 strefy;
✓ blok 2 przejścia stanu (Zatwierdź/Opublikuj); ✓ blok 4 uniwersalny (Otwórz podgląd
realny, Edytuj/Archiwizuj disabled z prawdziwym powodem); ✓ blok 5 Usuń czerwony,
ostatni, oddzielony, disabled z powodem; n/d blok 3 (raporty nie mają terminów); ✓ ikony
przy każdej pozycji.

## 3. Columns added (DEC-66 pt.3 — parity with Tools/Assessment + real `/api/audits` data)

| Surface | Before → After | Evidence |
|---|---|---|
| Reports | 6 cols (Tytuł·Rodzaj·Wersja·Status·Język·Data publikacji) → **9 cols**, +Odbiorca (`audience`), +Poufność (`confidentiality`), +Zaktualizowano (`updatedAt` — field existed, was never rendered) | `01-reports-light.png` |
| Outputs | 4 cols (Tytuł·Wersja·Data finalizacji·Kto) → **6 cols**, +Status (Aktualny/Zastąpiony, derived from `supersededBy`), +Wersja pakietu (`packVersion`) | `01-outputs-light.png` |
| Processes/Sessions | 8 cols, +Start (`plannedStart` — field existed, was never rendered; `plannedEnd`/Termin already existed) | `01-processes-light.png` |
| Library | unchanged 8 cols (already at parity; `Typ źródła` moved from Menu 3 chip to column filter, net UI simplification not a column removal) | `01-library-light.png` |
| Initiatives | unchanged 5 cols (already at parity with the honest Proposal Draft data model — no additional real fields exist beyond what's already shown) | `01-initiatives-light.png` |

`audience`/`confidentiality`/`packVersion`/`supersededBy`/`supersededAt` are fields
`/api/audits/{reports,outputs}` already returns (`reportService.ts`/`outputService.ts`
row mapping) — the frontend type just never declared or rendered them. Added to
`AuditReportSummary`/`AuditOutputSummary` in `auditsMethodApi.ts`, zero backend change.

### Bonus finding while auditing "too few columns": three PHANTOM columns fixed

Investigating why the tables felt sparse surfaced a real, separate defect: three
existing columns were **wired to fields the backend never populates** — they always
rendered "—" for every row, independent of any real data:

- Processes "Pakiet" (`AuditProgramSummary.packTitle`) — `programService.ts` only
  stores `pack_id`/`pack_key`, never a title.
- Processes "Audytor wiodący" (`leadAuditorName`) — only `lead_auditor_id` exists.
- Outputs "Kto"/programName subtitle (`finalizedByName`/`programName`) —
  `outputService.ts` mapping has neither.

Fixed frontend-only (no backend/DB change, in scope for a UI FIX): `AuditsMethodHub`
already loads the full program/pack lists for Library/Processes, so it now also builds
`programNameById`/`packTitleById` maps from that data, plus one `Api.getUsers()` call
for a `userNameById` map (same pattern as `DiscoveryToolsHub.tsx`'s `authorNameById`),
and passes them down. Visible in `01-processes-light.png` ("Pakiet" shows a real title,
"Audytor wiodący" shows real names) and `01-outputs-light.png` ("Kto" shows
"Aleksandra Dąbrowska", not "—").

## 4. Preview panel (StandardPreview canon)

| File | What it shows |
|---|---|
| `03-library-preview-light.png` | Library row preview — unchanged, included to confirm Menu 3 change didn't regress it (meta pills, Details table, "Rozpocznij audyt" action). |
| `03-reports-preview-light.png` | Reports row preview — **new**, Reports had no preview panel at all before this fix. 6-property Details table incl. the new Odbiorca/Poufność fields. |

## 5. Inside the tool ("wnętrza", DEC-66 pt.4)

| File | What it shows |
|---|---|
| `04-wnetrze-warsztat-kryterium-light.png` / `-dark.png` | `CriterionWorkspace` — the real "inside" screen a Sessions/Processes row opens (program preview → criterion link → this workspace): criterion/source, audit question, expected/delivered evidence table, auditor procedure/sample/test/result fields. This is the genuine inner tool, not fabricated. |

**Honest STOP for the other three surfaces** (per DEC-66 pt.4 instruction — do not
fabricate): Library pack rows and Reports/Outputs/Initiatives rows do **not** open a
deeper artifact screen beyond the StandardPreview panel already shown in §4 above — a
Library pack's kebab only offers "Start audit" (which creates a Processes program, the
surface that DOES have an inside) and "Open preview"; Reports/Outputs/Initiatives kebabs
only offer "Open preview" for entry+view. There is no dedicated "open full report" /
"open full output" / "open full proposal" route mounted anywhere in `AppRoutes.tsx` for
the U7 kernel data (the one existing report viewer, `DRDAuditReportView`, is for the
older, separate `/api/audit` orchestrator, not this kernel). Building those views was
out of scope for this UI-canon FIX pass.

## Known pre-existing noise (not from this change)

Every screenshot's console log contains one line:
`[OrgContext] Error fetching orgs: SyntaxError: Unexpected token '<', "<!doctype "...`
— the dev-render harness has no real backend for `/api/organizations/current`, so this
fires on every dev-render screen in the repo, Audits included, before and after this
fix. Verified harmless (screens render fully anyway) and out of scope.
