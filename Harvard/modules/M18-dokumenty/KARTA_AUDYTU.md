# M18 — Dokumenty (Document Studio) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `d0e6c9383c`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M18 · inwentarz `Harvard/podzial/inventory/INV_E_outputs_studia_meeting.md` (sekcja DOKUMENTY, poz.1-9) · poprzednia karta `docs/audit/2026-06-02/MODULE_10_dokumenty.md` (53/100)
**Evidence:** `Harvard/modules/M18-dokumenty/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 47/100 — Tier: Alpha · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 18 | Rdzeń realny (generacja, edytor proposalowy 6 poziomów, editor-state persist, QA-gate), ale **wersje/komentarze/approvals/audit to fasada in-memory** (znikają po restarcie) + Mode3 wymusza placeholder-szkielet. |
| B. Wiring i dane | 15 | 8 | Editor-state ma realny DAO (migracja `20260603`), ale 8/~11 warstw stanu pisze do drugiej `Map` in-memory („until wave5 migration ships") — utrata po deployu. |
| C. Testy automatyczne | 15 | 9 | **889 PASS / 0 FAIL** (najlepszy wolumen), ale test persistencji MOCKUJE DAO (nie dotyka PG), bramka eksportu testowana na serwisie nie HTTP 403; zielone maskuje fasadę; nic w PR-gate. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 5 | §27 głównie N/D (edytor), ale `DocumentStudioView` NIE używa `ExecutiveModuleShell` (ręczny header), i18n de-facto EN-only, ~150 hardkodów kolorów. |
| F. Bezpieczeństwo/dostęp | 10 | 7 | Org-scope CZYSTY (4. moduł), bramka eksportu serwerowa + role-gated override, public share sanitizowany whitelist (lepiej niż M17); P2: template approve/deprecate bez roli serwerowo. |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **Faza 4 niewykonana → max 70 + „NIEPEŁNY".** BRAK cap cross-org (org-scope czysty, zweryfikowane). Suma 47 < 70. |

**Werdykt jednym akapitem:** Czwarty moduł z rzędu BEZ cross-org IDOR i z najlepszym profilem bezpieczeństwa dotąd — org-scope czysty (`getAuthContext` bierze org z tokena, nigdy z body/URL; każda operacja przez `getWave5Artifact` → `WHERE artifact_id=? AND organization_id=?`, `wave5ArtifactRuntimeService.ts:578`), **bramka eksportu egzekwowana serwerowo** dla każdego formatu (`QaBlockingError`→403, override role-gated `canOverrideQa` SUPERADMIN/OWNER/ADMIN/PM/MANAGER — lepiej niż M17), **public share sanitizowany whitelistą 5 pól** (`consumeShareLink`, NIE `{...row}` jak M17; token 256-bit HMAC, revoke+rotate). Rdzeń autoringu realny: Mode1 intake→outline→document (LLM gdy `useLlm=true`), Template Architect z persystencją (migracja 769), edytor proposalowy 6 poziomów (local/section/global/methodology/source/transformative) z approve/reject, **editor-state z realnym write-through DAO** (`documentEditorStateRegistryDao`, migracja `20260603`, `INSERT ON CONFLICT` + lazy hydration — przeżywa restart, naprawa P0 vs 06-02 POTWIERDZONA). **Główne odkrycie audytowe (sprzeczne z inwentarzem „[DZIAŁA]"): persistencja-fasada.** 8 z ~11 warstw stanu — wersje/snapshoty/rollback (poz.7), komentarze/approvals/access-history/audit/content-blocks/brand-voice (poz.8) — to funkcje `persist*`/`load*` piszące do **drugiej `Map` in-memory**, nie do DB (zweryfikowane osobiście: `documentVersionSnapshotService.ts:50,84-96` — `persistedSnapshotStore = new Map()`; nagłówki DAO literalnie „in-memory until the wave5 persistence migration ships"). Działają w cyklu życia procesu, ale **znikają po każdym deployu/restarcie**, a mylące nazewnictwo („write-through DAO") może to ukryć przed krótkim testem live i przed 889 zielonymi testami (które mockują DAO, nie dotykają PG). To wzorzec „real call, fake feature" — kandydat do sprawdzenia w siostrzanych studiach M19/M20. Pozostałe: Mode3 wymusza `useLlm:false` → treść = placeholder-szkielet (P2); template approve/deprecate bez gatingu roli serwerowo (P2); beta-lock tylko nawigacyjny (P2). Sufit oceny: niewykonane Fazy 3+4.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_E sekcja DOKUMENTY, poz.1-9.
**Scenariusze krytyczne (8):**
1. **S1** — Mode1: intake → outline → document.
2. **S2** — Mode2: Template Architect (plan/approve/deprecate + audit).
3. **S3** — Mode3: generate z zatwierdzonego szablonu (walidacja źródeł).
4. **S4** — Persistencja write-through DAO: resume po reload/restart → trwałość.
5. **S5** — Edytor proposalowy approve/reject (6 poziomów).
6. **S6** — Bramka eksportu QA 403 + qaOverride.
7. **S7** — Wersje/snapshoty + rollback.
8. **S8** — Share-linki + publiczny konsument.
**Obowiązujące kanony:** §27 — głównie **N/D** (edytor 3-szynowy; jedyna lista = szablony) · CARD_CONTENT_FORMULA: **N/D** (edytor dokumentów) · wzorzec: **MELS (ExecutiveModuleShell)** — ale View go nie używa · gating: **beta-closed** (mount BEZ `v8FeatureGate` — zawsze włączony na BE).

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Werdykty: **REALNE 5 · CZĘŚCIOWE 1 (Mode3) · ZEPSUTE-fasada 2 (poz.7, poz.8).**

### 1a. REALNE (zweryfikowane)
- Mode1 intake→outline→document (LLM gdy `useLlm=true`); Mode2 Template Architect (persystencja real, migracja 769); editor-state write-through DAO (`documentEditorStateRegistryDao`, migracja `20260603`, przeżywa restart); edytor proposalowy 6 poziomów approve/reject; QA-gate eksportu serwerowy (`documentStudioService.ts:729`→403); lista zatwierdzonych szablonów (soft-fail).

### 1b. MOCK / STUB / placeholder
- **[P2] Mode3 generate z szablonu wymusza `useLlm:false`** → treść = placeholder-szkielet, nie realna proza (kontrast z Mode1).

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE (persistencja-fasada)
- **[P1] Wersje/snapshoty/rollback (poz.7) — in-memory fasada** — `documentVersionSnapshotService.ts:50` `persistedSnapshotStore = new Map()`; `persistSnapshot` (`:84-96`) i `loadSnapshotsForOrg` (`:98-107`) operują na Mapie, nie DB → utrata po restarcie/deployu.
- **[P1] Komentarze/approvals/access-history/audit/content-blocks/brand-voice (poz.8) — in-memory fasada** — `documentCommentsService.ts:61,65` (`commentStore`/`persistedCommentStore = new Map`); nagłówki „in-memory until the wave5 persistence migration ships". API wpięte, działa w sesji, znika po deployu.

### 1d. UKRYTE / MARTWY KOD
- Brak istotnego martwego kodu w próbce; `/wordy` = redirect-only (świadome).

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela DB | Migracja | Status |
|---|---|---|---|---|
| Editor-state | `documentEditorStateRegistryDao` | 3 tabele editor-state | `20260603_*` | DZIAŁA (real, przeżywa restart) |
| Templates | template service | template tables | migracja 769 | DZIAŁA |
| Wersje/snapshoty | `documentVersionSnapshotService` | — (Map!) | brak | **ZEPSUTE-fasada (in-memory)** |
| Komentarze/approvals/audit | `documentCommentsService` + in. | — (Map!) | brak (wave5 pending) | **ZEPSUTE-fasada (in-memory)** |
| QA-gate eksportu | `documentStudioService:729` | QA state | — | DZIAŁA (serwerowo 403) |
| Share-link publiczny | `consumeShareLink` | share tokens | — | DZIAŁA (sanitizowany) |

### 1f. Flagi
| Flaga | Default | OFF → | Uwaga |
|---|---|---|---|
| (mount BE) | brak `v8FeatureGate` (`Gateway.ts:758`) | — | moduł zawsze włączony na BE (inaczej niż M17); beta-lock tylko nawigacyjny |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Status |
|---|---|---|---|
| WEJŚCIE ← | M17 Outputs | „New AI document" → `/document-studio` | DZIAŁA |
| WYJŚCIE → | M17 Outputs | rejestracja artefaktu dokumentu | DZIAŁA |
| WYJŚCIE → | pliki | eksport md/docx/pdf (za QA-gate) | DZIAŁA |
| WYJŚCIE → | public | share-link konsument (sanitizowany) | DZIAŁA |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (lokalnie @ `d0e6c9383c`):** **889 PASS / 0 FAIL / 1 SKIP (E2E env).** Najlepszy wolumen w audycie; zero znanych wzorców awarii (i18n mock, stale import, schema-drift) — suite spójny z impl.
| Grupa | Pliki | Testy | Wynik |
|---|---|---|---|
| Serwis `documentStudio/__tests__` | 74 | 855 | PASS |
| Routes (share-links, assets) + template-architect | 3 | 25 | PASS |
| FE panel + integration (org-guard, policy-order, export-trace) | 4 | 9 | PASS |
| E2E `document-studio-word-flow` | 1 | 1 | SKIP (env) |

**Pokrycie scenariuszy:**
| Scenariusz | FE | BE serwis | BE route | E2E | PR-gate | Luka |
|---|---|---|---|---|---|---|
| S1 intake→doc | częśc. | ✓ | — | skip | ✗ | — |
| S2 template architect | ✗ | ✓ | częśc. | ✗ | ✗ | — |
| S3 Mode3 | ✗ | ✓ | — | ✗ | ✗ | — |
| **S4 persistencja DAO** | ✗ | ⚠️ **tylko mock** | — | ✗ | ✗ | **brak testu realnego write-through PG** |
| S5 proposal approve/reject | ✗ | ✓ | — | ✗ | ✗ | — |
| **S6 bramka eksportu 403** | ✗ | ✓ serwis | ⚠️ **brak asercji route 403** | ✗ | ✗ | export-trace mockuje eksport |
| S7 wersje/rollback | ✗ | ✓ (na Mapie!) | — | ✗ | ✗ | testuje fasadę, nie DB |
| S8 share publiczny | ✗ | ✓ | ✓ (unauth) | ✗ | ✗ | — |

**Pułapki:** **S4 — test persistencji `vi.mock` na DAO** (weryfikuje że serwis WOŁA `persistProposal`, nie że dane lądują w PG; zero testów uderzających w realny DAO+baza → krytyczne dla „naprawy znikania"). **S6 — bramka na poziomie serwisu**, route `res.status(403)` (`document-studio.routes.ts:3386,3394`) nieasertowany (grep `qa_blocking` w testach = 0). **CI:** `test-suite.yml` tylko `[main,develop]`; default `Londyn` → żaden test M18 nie gate'uje PR (jak M17).

**Backlog testowy:** [P0] B1 integracja PG-real dla `documentEditorStateRegistryDao` (cold-start S4); [P0] B2 HTTP supertest 403 `qa_blocking`/`qa_override_unauthorized` bez mockowania eksportu (S6); [P1] B3 E2E S1 w gate, B4 FE proposal+bramka UI, B5 share cross-tenant/hasło, B7 `pull_request: [Londyn]`; [P2] B6 rollback/snapshot na PG.

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** **Kluczowe dla M18:** test cold-start — utworzyć wersję/komentarz → restart serwera (deploy) → sprawdzić czy przetrwały (oczekiwane: editor-state TAK, wersje/komentarze NIE — fasada). Smoke: generacja, editor-state resume, export 403 bez QA, share resolve. Migracje: `20260603_document_studio_editor_state.sql`, 769 (templates) zastosowane?; brak migracji dla wersji/komentarzy (wave5 pending). **Uwaga DB:** dev `.env` może wskazywać Railway PROD.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 8 scenariuszy; szczególnie **S7 trwałość wersji po reload vs po restarcie** (potwierdzić fasadę), S4 editor-state resume (potwierdzić naprawę), S6 export nieapprobowanego przez API (403), S8 odpowiedź sieciowa share (czy `organizationId` widoczny — P3), Mode3 (czy widać placeholder).
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S8 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27:** moduł = edytor 3-szynowy (Outline/Editor/QA), punkty A-S głównie **N/D**; jedyna lista (szablony, `DocumentStudioTemplateArchitectView.tsx:302`) to ad-hoc `<ul>/<li>`, nie `FilterableTable` (**P3**).
**MELS:** **[P2]** `DocumentStudioView.tsx:193-219` ma ręcznie zbudowany header+taby, NIE `ExecutiveModuleShell`; MELS użyty tylko wewnątrz `DocumentStudioDocumentPanel.tsx:1996` — niespójność z referencją.
**i18n:** **[P2]** de-facto EN-only — `useTranslation` = 0 w View/IntakeForm/DocumentPanel/Outline/TemplateArchitect; twarde EN („Generate", „Loading document…", „No templates yet."); tylko Editor/QA panel cokolwiek tłumaczą.
**UI-standards:** **[P3]** brak `EntityStatusChip`, ~150 hardkodów kolorów (sky/emerald/amber/rose).
**Stany:** loading/error/empty pokryte; drobny silent-fail listy szablonów (`refreshApprovedTemplates` swallow→`[]`, P3).
**CARD_CONTENT_FORMULA:** N/D potwierdzone.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`. **Najlepszy profil bezpieczeństwa dotąd.**
| Warstwa | Stan | Dowód |
|---|---|---|
| Org-scope (wszystkie by-id) | CZYSTY | `wave5ArtifactRuntimeService.ts:578` (`WHERE artifact_id=? AND organization_id=?`); org z tokena |
| Bramka eksportu | serwerowa, role-gated override | `documentStudioService.ts:668-686`, `documentQaService.ts:155` |
| Public share | sanitizowany whitelist 5 pól | `consumeShareLink:575-581,664` (token 256-bit HMAC, revoke+rotate) |
| Beta-lock | tylko nawigacyjny | `AppRoutes.tsx:2082` bez beta-guarda |

**Findingi:**
- **[P2] SEC-5: `templates/:id/approve` i `/deprecate` bez roli serwerowo** — `routes:616,642`→`documentTemplateService.ts:429-475`; każdy członek org zatwierdza/deprecjonuje dowolny szablon firmowy (M17 wymaga `canPublishOrgTemplate`, M18 nie). Fix: dodać gating ADMIN/OWNER.
- **[P2] SEC-1: beta-lock tylko nawigacyjny** — direct URL `/document-studio` omija plate BETA_LOCKED (API org-gated → brak wycieku).
- **[P2] SEC-4b: brak rate-limit na public `/share-links/resolve`** (+edit-session/comments) — guard to feature-flag, nie throttler.
- **[P3] SEC-4a: public consumer zwraca `organizationId`** anonimowi (drobne over-disclosure; brak FE konsumenta w repo).

**OK/czyste (nie powielać):** org-scope (brak IDOR — jak M02/M17/M25); bramka eksportu serwerowa; public share sanitizowany; approvals participant/requester-gated; editor-state persist naprawiony; sekrety/PII w logach czyste.

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P1)
1. **Migracja persystencji wave5** — wersje/snapshoty/komentarze/approvals/audit/content-blocks/brand-voice z `Map` → realne tabele DB (jak editor-state) — Weryfikacja: utworzona wersja/komentarz przeżywa restart serwera (cold-start test).
2. **Gating roli na template approve/deprecate** — ADMIN/OWNER serwerowo (jak M17 `canPublishOrgTemplate`) — Weryfikacja: członek bez roli → 403.
3. **Testy realnej persystencji + HTTP bramki** — B1 (DAO+PG cold-start) + B2 (403 `qa_blocking` przez HTTP) — Weryfikacja: zielone, dotykają DB/route, nie mocka.

### Fala 2 — Domknięcie wartości (P2)
1. **Mode3 realna treść** — pozwolić `useLlm:true` z szablonu lub jawnie oznaczyć szkielet — Weryfikacja: dokument z szablonu ma realną prozę.
2. **Beta-guard na route** `/document-studio` — Weryfikacja: direct URL → plate.
3. **Rate-limit na public share-resolve** — Weryfikacja: limit działa.
4. **`DocumentStudioView` na `ExecutiveModuleShell`** (spójność MELS) — Weryfikacja: jeden shell.

### Fala 3 — Jakość i kanony (P3)
1. **i18n** — `useTranslation` w View/IntakeForm/DocumentPanel/Outline/TemplateArchitect — Weryfikacja: PL/EN komplet.
2. **Tokeny kolorów** (~150 hardkodów) + `EntityStatusChip` — Weryfikacja: lint koloru czysty.
3. **Usuń `organizationId` z public share payload** — Weryfikacja: anonim nie widzi org.
4. **CI** — `pull_request: [Londyn]` + testy server/ w gate (systemowe) — Weryfikacja: 889 testów biegnie na PR.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (zwł. S4 realny DAO, S6 HTTP 403) zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami (w tym cold-start trwałość)
- [ ] 3. Railway: migracje (w tym wave5) zastosowane, smoke 200, czyste logi
- [ ] 4. Kanony: MELS, i18n, tokeny kolorów
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (fasada wersji/komentarzy → realne DB)
- [ ] 6. Zero cichych degradacji bez komunikatu

---
**Pozostałe do domknięcia audytu M18:** Faza 3 (Railway — zwł. cold-start trwałości) + Faza 4 (żywe 8 scenariuszy). Brak blockera bezpieczeństwa (org-scope czysty, bramka+share lepsze niż M17). Główny dług = **persistencja-fasada** dla wersji/komentarzy/approvals (utrata po deployu) — inwentarz mylnie oznacza „[DZIAŁA]", zaktualizować INV_E. Wzorzec fasady sprawdzić w M19/M20 (siostrzane studia).
