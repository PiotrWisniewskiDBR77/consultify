# Wave 3 — Materials acceptance

ID: `MAT`
Routes: `/document-studio`, `/presentations`, `/excele`
Current gate: `TECHNICAL_BROWSER_PASS / OWNER_REVIEW_READY_WITH_FINDINGS / RESTRICTED_POLICY_CONFIRMATION_REQUIRED`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

> Recovery replay — 2026-08-23: the historical 817-migration database recorded
> below was absent at catalog revalidation. Replacement local-only database
> `consultify_w3_materials_owner_recovered_20260823` passed the exact
> 831-migration chain and independent post-restart SQL readback: two document
> versions, one deck version and one workbook revision. Its new FINAL `0600`
> receipt preserves one approved template and the separate
> `UNKNOWN_RIGHTS_QUARANTINED` template; provider/share/export remain explicitly
> unproven. Exact clean SHA `54987e405a5cdf13d7c24d5bb5178529a5d55bac`
> adopted it on server/client `4341/4342`: health/readiness/frontend
> `200/200/200`, migration ledgers `ok/ok`, client and SQL markers passed. OWNER
> login and document/deck/workbook reads returned `200`; all three anonymous
> reads returned `401`. This restores current technical API/storage readiness,
> not authenticated browser evidence, rights approval, provider capability,
> Piotr acceptance or release authority.

## Contract

Primary journey: open, edit, version, export where authorized and reopen a
governed artifact with visible provenance. Required boundaries: UNKNOWN
template quarantine, provider unavailable, revoked share, conflict/CAS,
foreign tenant and no false export success.

## G00–G20 checklist

| Gate | Mandatory outcome                                              | State                                     | Evidence/decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | -------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G00  | Scope, routes, dependencies, 82-task links and exclusions      | `RESTRICTED_POLICY_CONFIRMATION_REQUIRED` | Tasks: `MAT-POL-001`, `MAT-BVP-001`, `MAT-MVP-DOC-001`, `MAT-MVP-PPT-001`, `MAT-MVP-XLSX-001`, `MAT-MVP-EXPORT-001`, `MAT-UI-CANON-001`. Mounted UI truth is `/document-studio`, `/presentations`, `/excele` (`ff_excele=1`), not the stale `/documents` and `/workbooks` labels. Native DOCX/PPTX/XLSX and explicit presentation `text_summary` PDF are in restricted scope; new external providers and unproven template/font/image rights remain OFF.                                                         |
| G01  | Exact baseline and client/server/runtime/DB/migrations         | `PASS_EXACT_RUNTIME`                      | Materials work began at `8b5206eb007a7e91548b5a79eb2542ca7cdadf6e`. The retained owner fixture was adopted on exact browser candidate `3d61730fd8ad18d19cf9967cb5513697659003cc`, dirty fingerprint `068a77af...`, server/client `3974/3975`, with health/readiness/frontend `200`, verified build marker, SQL ledgers `ok`, `817` migrations and matching FINAL fixture marker. This is technical evidence, not owner acceptance. |
| G02  | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS`                                    | DOC: edit/checkpoint/version/rollback/cold reopen/DOCX/export receipt/share revoke. PPT: template-bound deck/CAS/history/restore/PPTX; PDF semantics explicit, never false visual parity. XLSX: create/value/formula/structural command/idempotency/revision/CAS restore/XLSX binary/share/archive. Common boundaries: provenance quarantine, provider failure without fake bytes, stale/tenant/auth/revoked-share and immutable receipt replay.                                                                 |
| G03  | Named allowed/denied personas                                  | `PASS_FOR_PREFLIGHT`                      | Same-tenant ACTIVE OWNER/ADMIN and permitted MEMBER artifact actors; independent provenance approver where required. Denied: anonymous, revoked/no membership, foreign tenant, ordinary member attempting provenance/provider approval, and any actor requesting unsupported template/provider. The stable owner persona is provisioned in the retained fixture; share/revoke and provider-negative browser actions remain pending. |
| G04  | Reproducible realistic and boundary fixtures                   | `PASS_OWNER_FIXTURE_RETAINED / OWNER_PENDING` | Fixture checkpoint `db9c4738e6`. Guarded local fixture `server/scripts/seed-wave3-materials-owner-review.ts` creates a versioned nonempty DOC, four-slide PPT with notes/alt text, formula XLSX with revision, approved template and rights-`UNKNOWN` quarantine. Retained DB `consultify_w3_materials_owner_browser_20260822` and FINAL `0600` manifest `/tmp/consultify-w3-materials-owner-browser-20260822.json` were marker-verified by the adopted runtime. Share/revoke/export and provider failure remain truthfully unrun or unavailable; policy confirmation and owner review remain open. |
| G05  | Functional preflight and cold readback                         | `PARTIAL_CURRENT_RUNTIME / HISTORICAL_TECHNICAL_PASS / OWNER_PENDING` | Core RealPG `69/69`; restricted policy `6/6`; provenance `24/24`; Workbook/Presentation route lane `114/114`; MAT-006 RealPG `13/13`; focused schema/source route `41/41`. Current integration runtime `4390` with explicit `sampleData=materials-vnext` proves the common registry. The separately preserved, isolated Materials owner runtime (`4342 -> 4341 -> consultify_w3_materials_owner_recovered_20260823`) proves all three canonical full cards by current cold readback: populated two-section Document Studio, four-slide Deck Builder, and one-sheet formula workbook in Excele. The recovered common registry projects only the Presentation row, so Document/Sheet registry projection and row-to-card navigation remain defective. Persistence mutations and exports were not executed. Evidence: `../../../../evidence/current-browser-replay/2026-08-24/materials/MANIFEST.md`. |
| G06  | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP      | `PARTIAL_BROWSER_PASS`                    | Current authenticated desktop replay confirms the canonical Menu 2 (`All`, `Documents`, `Presentations`, `Sheets`, `Template Library`) and populated standard table at runtime `4390`. The recovered owner lane additionally proves all three full cards visually at `4342`; screenshots and scope are in the current replay manifest. Tablet, PL/EN/light, full a11y, complete console/HTTP sweep and owner acceptance remain open; mobile is non-gating. |
| G07  | Piotr review card                                              | `READY_FOR_OWNER_RETEST_WITH_FINDINGS`    | Day 81 zamknął technicznie blocker `MAT-D76-004` jedną zmianą klasy i dostarczył `6 z 6` zrzutów przed/po w obu motywach oraz osobny tryb Artifact Studio. Raport: `../../codex/CODEX_DAY81_DECK_PREVIEW_REPORT.md`. Pozostałe defekty Day 76 są nadal otwarte; odbiór Piotra nie został wykonany. |
| G08  | First-impression review                                        | `EVIDENCE_COMPLETE_BLOCKER_CLOSED_SELF_QA` | Lokalna persona OWNER zalogowała się bez auth bypass. Poza Artifact Studio canvas zmienił się z `487×0` na `487×584`, a cztery slajdy są widoczne jasno i ciemno. To self-QA, nie decyzja właściciela. |
| G09  | Guided CX journey review                                       | `PASS_TECHNICAL_REPLAY / VISUAL_FIX_VERIFIED` | Runtime `4750/4751` i lokalna PG `5953` potwierdziły login, fixture/readback `10 z 10`, oba tryby i dowód mutacyjny `0px → 584px`. Owner retest pozostaje `PENDING`. |
| G10  | Alternate-state owner review                                   | `PARTIAL_DAY97_B1_INFRA_BLOCKED`          | Day 97 zakończono na B.1 po poprawce nadzorcy: brak pojedynczego zgodnego kontraktu seedera, persony, nazwy DB i manifestu Tools. Materiał PNG wykonany przed poprawką został unieważniony; nie wykonano dopuszczalnej macierzy ani oceny DoD. Raport: `../../codex/CODEX_DAY97_SPEC_A_MATRYCA_DECK_REPORT.md`. |
| G11  | Every owner observation/screenshot durably registered          | `NOT_STARTED`                             | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| G12  | Owner register reconciled and confirmed                        | `NOT_STARTED`                             | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| G13  | Solution and impact analysis                                   | `NOT_STARTED`                             | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| G14  | Remediation with finding-to-commit traceability                | `NOT_STARTED`                             | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| G15  | Integrator self-QA and impacted regression                     | `NOT_STARTED`                             | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| G16  | Before/after owner retest packet                               | `NOT_STARTED`                             | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| G17  | Owner retest decisions for every finding                       | `NOT_STARTED`                             | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| G18  | Module accepted on exact SHA and checkpointed                  | `NOT_STARTED`                             | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| G19  | Later-change regression obligations resolved                   | `NOT_STARTED`                             | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| G20  | Final 16/16 replay                                             | `NOT_STARTED`                             | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Piotr review card

| Purpose/value | Starting route        | Persona/data                                 | Guided actions                                                                                 | Conscious exclusions                   | Observation prompts                                                  |
| ------------- | --------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| DOC slice     | `/document-studio`    | ACTIVE OWNER; realistic two-version document | Open → edit → checkpoint → restore → cold reopen → authorized DOCX export and receipt          | Mobile; unapproved providers/templates | Authoring clarity, checkpoint trust, provenance and export feedback  |
| PPT slice     | `/presentations`      | ACTIVE OWNER; independent template approver  | Review 3–5 slide deck → history/restore → PPTX export → inspect notes/alt text                 | Visual-parity PDF is not claimed       | Builder flow, template trust, preview/export semantics               |
| XLSX slice    | `/excele?ff_excele=1` | ACTIVE OWNER; formula/revision workbook      | Edit value/formula → structural command → replay/readback → restore → XLSX export/share revoke | Legacy `/tabele`; mobile               | Spreadsheet usability, persistence, conflict and download confidence |

## Persona and fixture ledger

| ID                | Type                          | Purpose                                                         | Setup/reset                                                                       | Readback                                           | Expected access                                                                 | Status/evidence                  |
| ----------------- | ----------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------- |
| `MAT-TECH-CORE`   | run-scoped technical fixtures | DOC/PPT/XLSX lifecycle, mounted auth, export and handoff        | owned fresh PostgreSQL; scoped cleanup then exact DB drop                         | independent DB/binary/readback assertions          | allowed/denied matrix in G03                                                    | `69/69 PASS`; scoped residue `0` |
| `MAT-TECH-POLICY` | isolated policy/provenance    | native-format policy, template authority and immutable receipts | separate owned databases/schemas with explicit opt-ins                            | policy/provenance receipts and catalog absence     | independent approver; unsupported provider denied                               | `6/6 + 24/24 PASS`               |
| `MAT-OWNER-01`    | owner-review fixture          | three short DOC/PPT/XLSX guided slices                          | guarded seed + independent SQL readback + deterministic manifest + whole-DB reset | populated DOC/PPT/XLSX browser cold-open PASS; mutations remain pending | stable tenant owner; provider/share negative states are explicit, not simulated | `TECHNICAL_BROWSER_PASS / NOT_ACCEPTED` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
| ---------- | -------- | ---------------------- | -------- | ------------ | ---------------- | ------------------- | ------ | --------------- | ----------- | -------- | --------------- | ---------- | ------- | ------------ |
| _none_     |          |                        |          |              |                  |                     |        |                 |             |          |                 |            |         |              |

### Day 61 findings (G07–G10)

| ID | Symptom | Reproduction | File + line | Evidence | Impact |
| --- | --- | --- | --- | --- | --- |
| `MAT-D61-001` | Required local owner fixture exits before data creation because the prescribed database name is rejected. | Set the mandated `DATABASE_URL` for `consultify_day61_materials_review` and run the existing seeder with its required confirmation variables. | `server/scripts/seed-wave3-materials-owner-review.ts:21` | `/private/tmp/cx-day61-materials-review/seed.log` (`exit 1`, `Database name must match consultify_w3_materials_owner_*`) | No full state, review persona, authenticated G09 journey, or valid 32-image matrix. Owner decision is required on the single canonical database name. |
| `MAT-D61-002` | The required Materials route renders the sign-in screen instead of the module because no seeded review persona is available. | Open `/presentations` through the Day 61 minimal Gateway without bypassing authentication. | `src/routes/AppRoutes.tsx:2601`; causal fixture guard above | `/private/tmp/cx-day61-materials-review/render-attempt-presentations.png`, SHA-256 `337ce0c77b46db90e8fc4e6111c8b3668fbed0ebd2de721fbed61e2987cbced2`; redirect to `/login?redirect=%2Fpresentations` | Render-blocking STOP for G08/G10 and auth STOP for G09. |
| `MAT-D61-003` | Polski wariant modułu nadal zawiera angielskie etykiety (`New document`, `New sheet`, `Theme`, `Share`, `Comments`, `Present`, `Attention Required`) i angielskie daty w podglądzie. | Ustawić język `pl`, przejść osiem powierzchni pełnego stanu oraz otworzyć podgląd wiersza. | komponenty rejestru Materiałów, Document Studio i Deck Builder | 32 zrzuty i dwa ujęcia interakcji w `/private/tmp/cx-day61-materials-review-f87043a/` | Defekt widoczny dla użytkownika; pakiet gotowy do decyzji/naprawy G11–G20, bez relabelowania jako czysty wizualnie. |

### Day 76 evidence and findings (G07–G10)

| ID | Symptom | Evidence | State |
| --- | --- | --- | --- |
| `MAT-D76-001` | `New document` i `New sheet` mieszają się z polskimi CTA. | Day 76: pełne zrzuty Dokumentów i Arkuszy, jasny i ciemny. | `OPEN` |
| `MAT-D76-002` | FORMAT=`Unknown`; wartości `Organization` i `Tool` pozostają angielskie. | Day 76: Wszystkie/Dokumenty/Arkusze w pełnym stanie. | `OPEN` |
| `MAT-D76-003` | Puste stany mają co najmniej cztery odmienne kompozycje; Arkusze opisują implementację. | Day 76: pięć pustych powierzchni × dwa motywy. | `OPEN` |
| `MAT-D76-004` | Pełna karta prezentacji pokazywała `Karta 1 z 4`, ale jej powierzchnia była niemal pusta. Przyczyną było `h-full` na dolnym pasku poza Artifact Studio. Day 81 usunął wyłącznie tę klasę. | Raport Day 81: `../../codex/CODEX_DAY81_DECK_PREVIEW_REPORT.md`; przed `487×0`, po `487×584`, Artifact Studio `904×532`, `6 z 6` zrzutów i dowód mutacyjny. | `FIXED_SELF_QA / OWNER_RETEST_PENDING` |
| `MAT-D76-005` | Prawy CTA Biblioteki wzorców jest ucięty przez krawędź. | Day 76: pełny i pusty stan Biblioteki, oba motywy. | `OPEN` |
| `MAT-D76-006` | Karta arkusza nadal pokazuje `0/8` i `Workbook ... — 1 sheets.`. | `/private/tmp/cx-day76-artefakty/day76-defect-08-sheet-full-dark.png`, SHA-256 `5d3e2b7c9b1af358c6b5851674667eae1e5a2b82c8ee20d19f0f691618c820e2`. | `OPEN` |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
| ----------- | ---------- | ----------------- | ------ | --------------- | ---------------- | ------------- | ---------- |
| `MAT-D76-004` | `h-full` na `DeckBuilderBottomBar` zabierało pełną wysokość flex-column poza Artifact Studio. | Usunięcie wyłącznie `h-full`; pozostałe klasy i struktura bez zmian. | `7e7e160929` | `DeckBuilderBottomBar`, powłoka prezentacji | Materiały i Artifact Studio | Canvas `487×0 → 487×584`; Artifact Studio `904×532`; adapter `4/4` przed i po; frontend build PASS | `SELF_QA_PASS / OWNER_RETEST_PENDING` |

## Technical preflight findings

| ID           | Finding                                                                                                               | Classification                                | Resolution/evidence                                                                                                                                                                                                          | State            |
| ------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `MAT-PF-001` | Acceptance package named stale frontend routes `/documents` and `/workbooks`.                                         | documentation/runtime-truth drift             | canonical routes recorded as `/document-studio`, `/presentations`, `/excele`; Excele flag must be pinned for owner evidence                                                                                                  | `FIXED`          |
| `MAT-PF-002` | Workbook client still called `PATCH /:id/schema-command`, but a broad route rewrite had removed the mounted endpoint. | product compatibility regression              | endpoint restored with current org membership, strict command validation and canonical schema guard                                                                                                                          | `FIXED_VERIFIED` |
| `MAT-PF-003` | Initial restoration allowed non-atomic snapshot/update and optional CAS/idempotency.                                  | product integrity risk discovered in review   | mandatory `expectedVersion`, `commandId`, `idempotencyKey`; pinned transaction contains snapshot, CAS, revision and hard readback; one concurrent winner; foreign tenant zero-write                                          | `FIXED_VERIFIED` |
| `MAT-PF-004` | Reusing an idempotency key with another payload or after later commands could be misclassified as replay.             | product idempotency risk discovered in review | tenant-scoped durable revision identity is checked before CAS and again under row lock; same identity replays without writes, altered payload/command ID returns `409 IDEMPOTENCY_CONFLICT`; delayed A→B→A covered in RealPG | `FIXED_VERIFIED` |
| `MAT-PF-005` | Two RealPG fixtures omitted lineage/export-backfill cleanup; several Workbook mocks predated strict membership.       | test/cleanup debt                             | exact FK-order cleanup and pass-through membership mocks; exhaustive prefix scan and owned-DB catalog remainder `0`                                                                                                          | `FIXED_VERIFIED` |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: Mobile is non-gating. New external renderers/providers and any template/font/image rights without explicit authority remain OFF. Piotr must still confirm that Wave 3 accepts the restricted native-format scope rather than treating this as a blanket policy waiver.
Evidence manifest: —

---

## ★★ ZAKRES ROZSZERZONY — PIĘĆ GENERATORÓW (decyzja właściciela, 2026-08-29)

**Właściciel rozstrzygnął (`DEC-2026-08-29-303`), że moduł 11_MATERIALS NIE MOŻE
zostać odebrany, dopóki nie działa komplet pięciu generatorów.** Powód: plan
dojścia (`docs/program/system-pracy/07_PLAN_DOJSCIA.md`) **nie zawierał ani jednej
wzmianki** o generatorach dokumentów ani szablonów, a wszystkie trzy generatory
dokumentów były schowane jako zadania wewnątrz tego modułu
(`MAT-MVP-DOC-001`, `MAT-MVP-PPT-001`, `MAT-MVP-XLSX-001`). Generator szablonów
nie miał własnej pozycji nigdzie; generator szablonów Word nie występował
w planie ani razu.

### Rozróżnienie wiążące

- **Generator DOKUMENTU** — bierze treść i produkuje plik, w dwóch trybach:
  **(1) od zera** (jak Gamma) oraz **(2) z szablonu** (wypełnia zdefiniowaną formę).
- **Generator SZABLONÓW** — narzędzie, w którym użytkownik definiuje tę formę.

To są **dwa różne produkty**, nie dwa widoki tego samego.

### Bramki generatorów — `GEN-1` … `GEN-5`

| # | Generator | Stan zmierzony 2026-08-29 | Dowód | Bramka |
| --- | --- | --- | --- | --- |
| `GEN-1` | **Dokument PPT** | działa; **jakość graficzna `7 z 18`** przy wymaganym minimum `15 z 18` (`3 z 3` decków) | `DEC-300`, dyżur 78 | `FAIL` — próg rubryki niespełniony |
| `GEN-2` | **Dokument Word** | działa; pętla szablonowa domknięta end-to-end, znacznik w wygenerowanym DOCX | `DEC-299`, `DEC-327`, D-8; dyżury 77, 90, 185 | `PARTIAL` — dyżur 185 naprawił strażnika liczb: niepoparta liczba zachowuje treść i ustawia `isAssumption`, z kontraktem mutacyjnym `4/6 -> 6/6`; realny DOCX przez `HTTP -> ApiGateway -> verifyToken -> PostgreSQL -> LLM -> DOCX` pozostaje `NOT_PROVEN`, ponieważ wydane Z15 zakazuje modelu, a R2 go wymaga. Artefakt renderer-only potwierdza widoczny znacznik, lecz nie zamyka K5 ani progu `15/18`. |
| `GEN-3` | **Dokument Excel** | działa; `WorkbookBuilder` na ExcelJS produkuje realny `.xlsx`, **8 gotowych szablonów finansowych** (DCF, cashflow 12m, break-even, budżet operacyjny, amortyzacja kredytu, opłacalność projektu, benefits realization) | `DEC-303` | `NOT_ASSESSED` — nigdy nie oceniony rubryką |
| `GEN-4` | **Szablony PPT** | ★★ **PĘTLA DOMKNIĘTA 2026-08-29.** Dyżur 80 naprawił promocję cyklu życia (`403` zdjęty bez rozluźniania bramki — draft bez promocji nadal odmawia). Dyżur 83 znalazł drugą blokadę: **deck z szablonu nie zapisywał kanonicznego `deck_json`**, przez co eksport padał na `422 PPTX_CURRENT_RENDER_FAILED`. Po poprawce (`+13/-2` w `presentations.routes.ts` plus nowy test `162` linii) **eksport zwraca `200` i niepusty PPTX**. Nadzorca obejrzał wynikowy plik: znacznik `ZNACZNIK-DAY83-…` obecny w nagłówku, treści bloku i stopce; **nagłówek mieści się w pasku — naprawa tytułu z dyżuru 79 działa w praktyce**. Dowód mutacyjny w obie strony. | `DEC-311`, dyżury 77 → 80 → 83 | ★ `PARTIAL` — **pętla działa mechanicznie, ale generator w trybie szablonowym wypełnia PLACEHOLDERAMI, nie treścią**: na slajdzie widnieje angielskie `Key point 2` oraz `Signal: … · Implication: … · Action: …` i stopka `Internal decision team`. **To samo zastrzeżenie co `GEN-2`** — forma się przenosi, treści nie ma |
| `GEN-5` | **Szablony Word** | ★ **KOREKTA 2026-08-30 (nadzorca):** poprzednie brzmienie „NIE ISTNIEJE — zero kodu" było **fałszywe co do zasięgu** i wprowadziło w błąd plan dokończenia funkcji. Prawda: `TemplateBuilder` istotnie obsługuje wyłącznie prezentacje — **ale architekt szablonów dokumentu istnieje i JEST RENDEROWANY**: `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx` (62 kB), montowany w `DocumentStudioView.tsx:911-914` na zakładce `templates`, z serwisem `server/src/services/documentStudio/documentTemplateService.ts` (56 kB, cykl draft→approve→deprecate). Wersja prezentacyjna jest jego **klonem** (`PresentationTemplateArchitectView.tsx:4`) — kierunek był odwrotny. Do zmierzenia zostaje **jakość wyjścia**, nie istnienie. | `DEC-303` | `WYMAGA PONOWNEGO POMIARU` |

### Zasada odbioru — rozszerzona

★★ **Moduł 11_MATERIALS nie jest odebrany na podstawie listy artefaktów ani
macierzy zrzutów.** Macierz `20 z 20` mierzy POWŁOKĘ. Odbiór wymaga dodatkowo:

1. **`GEN-1` … `GEN-5` na `PASS`**, każdy z własnym dowodem;
2. dla generatorów dokumentu — **wygenerowany plik obejrzany przez nadzorcę
   i oceniony rubryką** `Harvard/wdrozenie-100/DELIVERABLES_QUALITY_RUBRIC.md`
   (jakość graficzna ≥ 80%, **żaden wymiar = 0**);
3. dla generatorów szablonów — **dowód pętli end-to-end**: szablon ze znacznikiem
   przechodzi przez generator i znacznik jest w wynikowym pliku.

★ Powód tej zasady jest zapisany w `DEC-2026-08-29-288`: właściciel odrzucił
pakiet odbioru Finansów słowami *„pokazujesz mi tabelę zewnętrzną"*. **Ta sama
pułapka dotyczy Materiałów i została tu zamknięta jawnie.**

### Ryzyko przyjęte świadomie

Właściciel wybrał tę opcję, znając jej koszt: **Materiały stają się najcięższym
modułem programu i mogą blokować licznik przez wiele tygodni** — `GEN-5` to
budowa od zera. Nadzorca ma obowiązek raportować postęp generatorów **osobno**
od postępu pozostałych piętnastu modułów, żeby licznik `N z 16` nie ukrywał
stanu prac nad generatorami.
