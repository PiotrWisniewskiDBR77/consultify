# WP M18 — Dokumenty (Document Studio) · dokończenie do 100%

**Pula:** beta · **Karta:** `Harvard/modules/M18-dokumenty/KARTA_AUDYTU.md` (ocena 54/100) · **Rozmiar:** M-L (2–4 dni) · **Żywy bloker:** P1 persistencja (do re-weryfikacji — patrz niżej)
**Faza programu:** FAZA 1 (weryfikacja trwałości) → FAZA 3 (szlif) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Czwarty moduł z rzędu BEZ cross-org IDOR — org-scope czysty (`getAuthContext` bierze org z tokena, `getWave5Artifact`→`WHERE artifact_id=? AND organization_id=?`, `wave5ArtifactRuntimeService.ts:578`), bramka eksportu egzekwowana serwerowo dla każdego formatu (`QaBlockingError`→403, override role-gated `canOverrideQa`), public share sanitizowany whitelistą 5 pól (`consumeShareLink`, token 256-bit HMAC, revoke+rotate — lepiej niż M17). Rdzeń autoringu realny: Mode1 intake→outline→document (LLM), Template Architect (migracja 769), edytor proposalowy 6 poziomów approve/reject, editor-state z realnym write-through DAO (`documentEditorStateRegistryDao`, migracja `20260603`). 889 PASS / 0 FAIL (najlepszy wolumen w audycie). **Sufit oceny = niewykonane Fazy 3/4 (D=0, G=0), NIE bloker bezpieczeństwa.**

> **UWAGA — sprzeczność w karcie do rozstrzygnięcia w FAZIE 1.** Re-audit (karta, nagłówek + wiersze A/B) twierdzi, że W5 potwierdziło realny write-through dla wersji/komentarzy (migracja 776), a sekcja 1c trzyma to jako P1 fasada-in-memory. **Weryfikacja kodu 2026-06-13 potwierdza wersję re-audytu:** migracja `server/migrations/776_document_studio_wave5_persistence.sql` tworzy `document_version_snapshots` + `document_comments`; DAO `documentVersionSnapshotRegistryDao.ts:102` robi realny `INSERT INTO document_version_snapshots`; serwisy `documentVersionSnapshotService.ts:38,87` i `documentCommentsService.ts:26,92` mają write-through `daoPersist*` + idempotentną hydrację z DB (`hydratedOrgs`/`hydrationInflight`). `Map` (`snapshotStore`/`commentStore`) = cache w procesie hydrowany z DB, **nie źródło prawdy**. **Wniosek: P1 data-loss jest najpewniej STALE — wersje/komentarze przeżywają restart.** Mimo to MASTER §2 nadal listuje to jako żywy bloker; dlatego krok 1 FAZY 1 = **dowód cold-start** (utwórz wersję/komentarz → restart serwera → sprawdź trwałość), zanim skreślimy P1. Pozostałe 6 warstw poz.8 (approvals/access-history/audit/content-blocks/brand-voice) mają DAO (`documentApprovalRegistryDao.ts` itd.) — potwierdzić, że wszystkie idą write-through, nie tylko 2 sprawdzone.

## 2. Luki do DoD

### (a) BACKEND / API — integralność (FAZA 1)
- **[P1→do re-weryfikacji] Trwałość wersji/komentarzy/approvals.** Karta 1c (`documentVersionSnapshotService.ts:53`, `documentCommentsService.ts:65`) opisuje `new Map()` jako fasadę; kod pokazuje write-through DAO + migrację 776. **Akcja: cold-start proof (S4/S7), nie ślepa migracja.** Jeśli proof PASS → skreślić P1 (zaktualizować INV_E „[DZIAŁA]" — tym razem słusznie). Jeśli którakolwiek z 6 pozostałych warstw poz.8 NIE pisze do DB → dopiąć DAO jak editor-state.
- **[P2] Mode3 generate z szablonu wymusza `useLlm:false`** → treść = placeholder-szkielet, nie proza (`documentStudioService`, kontrast z Mode1). Decyzja: pozwolić `useLlm:true` lub jawnie oznaczyć szkielet w UI.

### (b) BACKEND — bezpieczeństwo (FAZA 3)
- **[P2] `templates/:id/approve` i `/deprecate` bez roli serwerowo** — `document-studio.routes.ts:616,642`→`documentTemplateService.ts:429-475`; każdy członek org zatwierdza/deprecjonuje szablon firmowy (M17 wymaga `canPublishOrgTemplate`). Fix: gating ADMIN/OWNER.
- **[P2] beta-lock tylko nawigacyjny** — `AppRoutes.tsx:2082` bez beta-guarda; direct URL `/document-studio` omija plate (API org-gated → brak wycieku). Fix: beta-guard na route.
- **[P2] brak rate-limit na public `/share-links/resolve`** (+edit-session/comments) — guard to feature-flag, nie throttler. Fix: throttler jak na `/api/public/artifacts` (30/min).
- **[P3] public consumer zwraca `organizationId`** anonimowi — drobne over-disclosure; brak FE konsumenta w repo. Fix: usunąć org z payloadu share.

### (c) FRONTEND / UX — kanony (FAZA 3/4)
- **[P2] `DocumentStudioView.tsx:193-219` NIE używa `ExecutiveModuleShell`** — ręczny header+taby; MELS użyty tylko wewnątrz `DocumentStudioDocumentPanel.tsx:1996`. Fix: ujednolicić na MELS.
- **[P2] i18n de-facto EN-only** — `useTranslation`=0 w View/IntakeForm/DocumentPanel/Outline/TemplateArchitect; twarde EN. Fix: `t()` (sweep FAZA 4).
- **[P3] ~150 hardkodów kolorów** (sky/emerald/amber/rose) + brak `EntityStatusChip`. Fix: tokeny (sweep FAZA 4).
- **[P3] lista szablonów** (`DocumentStudioTemplateArchitectView.tsx:302`) = ad-hoc `<ul>/<li>`, nie `FilterableTable`; `refreshApprovedTemplates` swallow→`[]` (silent-fail).

### (d) INTEGRACJA / TESTY E2E (FAZA 1 + 4)
- **[P0 testowy] S4 persistencja MOCKUJE DAO** (`vi.mock`) — weryfikuje, że serwis WOŁA `persistProposal`, nie że dane lądują w PG. Dodać integrację na realnej DB (cold-start round-trip).
- **[P0 testowy] S6 bramka eksportu na poziomie serwisu, nie route** — `document-studio.routes.ts:3386,3394` (`res.status(403)`) nieasertowany (grep `qa_blocking` w testach = 0). Dodać HTTP supertest 403 `qa_blocking`/`qa_override_unauthorized` bez mockowania eksportu.
- CI: `test-suite.yml` tylko `[main,develop]`; default `Londyn` → żaden test M18 (889) nie gate'uje PR. Dodać `pull_request:[Londyn]` (sweep FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 1, P1)** Cold-start proof S4/S7: utwórz wersję+komentarz na realnej PG → restart serwera → sprawdź trwałość. Potwierdzić write-through dla WSZYSTKICH 8 warstw poz.7+8 (snapshots, comments, approvals, access-history, audit, content-blocks, brand-voice). Skreślić P1 lub dopiąć brakujące DAO. Zaktualizować INV_E.
2. **(FAZA 1)** Test realnej persystencji (B1: DAO+PG cold-start) + HTTP bramki eksportu (B2: 403 `qa_blocking` przez route, bez mocka eksportu).
3. **(FAZA 3)** Gating roli na template approve/deprecate (ADMIN/OWNER, jak M17). Test 403 dla członka bez roli.
4. **(FAZA 3)** Mode3: `useLlm:true` z szablonu LUB jawne oznaczenie szkieletu w UI.
5. **(FAZA 3)** beta-guard na `/document-studio`; rate-limit na public share-resolve; usunąć `organizationId` z payloadu share.
6. **(FAZA 3/4)** `DocumentStudioView` na `ExecutiveModuleShell`; i18n `t()`; tokeny kolorów + `EntityStatusChip`; lista szablonów → FilterableTable; CI `Londyn`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** wersje/komentarze/approvals przeżywają restart (cold-start proof); Mode3 realna proza lub jawny szkielet; zero martwych przepływów.
2. **Bezpieczeństwo:** template approve/deprecate role-gated (403 bez roli); beta-guard na route; rate-limit na share; org-scope (już czysty).
3. **i18n:** `t()` pełne (koniec EN-only).
4. **Tokeny:** Visual Standard (koniec ~150 hardkodów); `EntityStatusChip`.
5. **§27:** lista szablonów przez FilterableTable; `DocumentStudioView` na MELS.
6. **E2E w PR-gate:** S4 (realny DAO+PG), S6 (route 403) zielone na `Londyn`.

## 5. Weryfikacja
- **Cold-start (kluczowe):** wersja/komentarz utworzone → restart serwera (deploy) → nadal obecne (real DB). To rozstrzyga sprzeczność karty.
- Mode3: dokument z szablonu ma realną prozę lub jawnie oznaczony szkielet.
- Bramka eksportu: export `draft`/bez-QA przez API → 403; member bez roli zatwierdza szablon → 403.
- Share: payload anonima bez `organizationId`; rate-limit działa.
- Migracje `776` (wersje/komentarze) + `20260603` (editor-state) + 769 (szablony) zastosowane na staging.
- Uwaga DB: dev `.env` może wskazywać Railway PROD.

## 6. Zależności
- **M17 Outputs zależy od M18:** approval-gate Outputs czyta stan wersji/publish dokumentu — domknąć trwałość M18 (krok 1) PRZED szlifem M17 (kolejność z MASTER §5).
- Public-viewer fix współdzielony z M17/M19 (`1b67579d7a`) — sanityzacja już zrobiona.
- Wzorzec write-through DAO (editor-state) = referencja dla ew. brakujących warstw poz.8.
