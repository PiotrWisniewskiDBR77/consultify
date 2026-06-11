# M18 — Dokumenty (Document Studio) — FAZA 1: Prawda kodu

Branch: `feat/deliverables-light`. Zakres: INV_E sekcja DOKUMENTY (9 pozycji).
BE: `server/src/routes/document-studio.routes.ts` (4332 l., ~95 endpointów) + `server/src/services/documentStudio/*` (43 pliki serwisowe).
FE: `src/components/DocumentStudio/*`, routing `src/routes/AppRoutes.tsx:2080-2118`.

Metoda: czytany kod runtime od montażu (Gateway) → handler → serwis → DAO → SQL/migracja. Nie polegano na skanach.

---

## WERDYKTY PER POZYCJA

| # | Pozycja | Werdykt | Dowód |
|---|---------|---------|-------|
| 1 | Mode 1: Intake→Outline→Document | **REALNE (z zastrzeżeniem)** | `routes:395 /plan`, `:426 /generate` → `materializeDocumentArtifact`; prawdziwy LLM tylko gdy `useLlm=true` |
| 2 | Mode 2: Template Architect (plan/approve/deprecate+audit) | **REALNE** | `routes:544 /templates/plan`, `:602 approve`, `:628 deprecate`, `:653 audit`; serwis `documentTemplateService.ts:429/465`; **persystencja real** (`documentTemplateRegistryDao.ts`, migracja 769) |
| 3 | Mode 3: Generate z zatwierdzonego szablonu + walidacja źródeł | **REALNE, ale placeholder-prose** | `routes:499 MissingRequiredSourceError`→400 z `missing[]`; serwis `documentStudioService.ts:382`; ALE Mode-3 wymusza `useLlm:false` (`IntakeForm.tsx:122`) ⇒ treść = deterministyczny szkielet placeholder |
| 4 | Persistencja write-through editor state | **REALNE (NAPRAWIONE — potwierdzone)** | DAO `documentEditorStateRegistryDao.ts` + migracja `20260603_*`; write-through `service:245-258, 877`; lazy hydration `:212-242`; resume `getDocumentArtifact:561-567` woła hydrate. **Przeżywa restart.** |
| 5 | Edytor proposalowy (6 scope'ów, approve/reject) | **REALNE** | FE `DocumentStudioEditorPanel.tsx:61` (scope local), 6 endpointów `routes:3279-3645`; approve/reject `:3613/:3644`; persystencja proposali = real (poz.4) |
| 6 | QA report + bramka eksportu 403 + qaOverride | **REALNE (egzekwowane serwerowo)** | `routes:3355 export/:format`; serwis `documentStudioService.ts:668-763`; 403 z `QaBlockingError`/`QaOverrideUnauthorizedError`; `canOverrideQa` = capability rolowa `documentQaService.ts:155-168` |
| 7 | Wersje/snapshoty + rollback | **ZEPSUTE (in-memory facade — utrata po restart)** | `documentVersionSnapshotService.ts:84-107` — `persistSnapshot` zapisuje do **innej Mapy** (`persistedSnapshotStore`), `loadSnapshotsForOrg` czyta z tej samej Mapy. Brak DB. |
| 8 | Komentarze/share/approvals/access/audit/warianty/content-blocks/brand-voice | **CZĘŚCIOWO ZEPSUTE (większość in-memory facade)** | Patrz tabela 1e. Share, content-blocks, brand-voice, approvals, audience-profiles, source-packs, **komentarze** = in-memory only (utrata po restart). API wpięte i działa w sesji. |
| 9 | Lista zatwierdzonych szablonów w tabie Generate (soft-fail) | **REALNE** | `routes:522 GET /templates`; templates persystowane (migracja 769); FE `DocumentStudioView.tsx` tab 'templates' |

---

## KLUCZOWE WERYFIKACJE (zlecone)

### poz.4 — Persistencja write-through: ✅ POTWIERDZONA REALNA
- DAO `documentEditorStateRegistryDao.ts` ma PRAWDZIWY SQL (`dbRun`/`dbAll`/`dbGet`, `INSERT ... ON CONFLICT`) na 3 tabelach z migracji `20260603_document_studio_editor_state.sql` (proposals, audit, schema_overlay).
- Write-through: `service:247` (`void daoPersistProposal`), `:257` (overlay), `:877` (audit). Cache synchroniczny + persist async best-effort.
- Lazy hydration `ensureEditorStateHydrated:212-242` — REALNIE czyta z DB (`daoLoadProposalsForArtifact` itd.), wołane przed serwowaniem w `getDocumentArtifact:567`, ścieżkach approve/reject `:1741/:1837`, async audit `:2048`.
- **Dane przeżywają restart serwera.** Wzorzec P0-1 z Canvasa NIE występuje dla editor-state. To jedyna prawdziwie naprawiona warstwa persystencji modułu.

### poz.6 — Bramka eksportu 403: ✅ EGZEKWOWANA SERWEROWO
- Handler `routes:3373` woła `exportDocumentArtifact(..., {userId, userRole, qaOverride})`.
- Serwis `:668 requiresApprovalForExport(documentType)` → `:699 runDocumentQa` → `:729 if(anyBlocking && !qaOverride) throw QaBlockingError` ⇒ **403 `qa_blocking`** (`routes:3393`). To jest blokada SERWEROWA, nie UI.
- qaOverride: `:672 if(qaOverride && !canOverrideQa(userRole)) throw QaOverrideUnauthorizedError` ⇒ **403 `qa_override_unauthorized`**. `canOverrideQa` (`documentQaService.ts:155-168`) = zbiór ról SUPERADMIN/OWNER/ADMIN/PROJECT_MANAGER/MANAGER. Team/viewer/guest/client NIE mogą. Próba nieuprawniona logowana jako `qa_override_denied` przed QA.
- Anti-placeholder gate: QA banuje frazy `placeholder`/`lorem ipsum`/`as an ai` (`documentQaService.ts:188+`).

### poz.8 — Share-link publiczny konsument: ✅ BEZ over-disclosure (lepiej niż M17), ⚠️ ale exposuje organizationId
- Public router `documentShareLinkPublicRoutes` (`routes:4181`) montowany PRZED authed routerem (`Gateway.ts:757`). Tylko 4 POST: `/share-links/resolve`, `/edit-session`, `/comments`, `/comments/:id/reply`. **Brak publicznego endpointu treści dokumentu.**
- `consumeShareLink` (`documentShareLinkService.ts:664-670`) zwraca **JAWNĄ allowlistę**: `{artifactId, organizationId, accessScope, shareLinkId, consumeCount}`. NIE `{...row}`. Brak wycieku treści/`confidentiality`/tytułu. **Błąd M17 (`/presentations/shared/:token` → `{...row}`) NIE występuje tutaj.**
- ⚠️ Zastrzeżenie: payload zawiera `organizationId` (tenant-id) ujawniony anonimowemu posiadaczowi ważnego tokenu — potrzebny do edit-session, ale to ekspozycja id najemcy. Niska waga (brak treści/PII), do SEC jako „minor over-disclosure tenant-id".
- 404-jednolity na missing/revoked/expired (`routes:4197`) — brak enumeracji tokenów.

### poz.1-3 — Generacja: REALNA TYLKO przy useLlm=true; default Mode-3 = placeholder
- Bazowy generator `documentContentGenerator.ts:196 buildSectionBlocks` = deterministyczny szkielet z prozą-placeholder ("Key message ... go here").
- Prawdziwa proza: `documentBlockProseGenerator.ts:169 generateBlockProse` → `aiService.generateChatResponse` (Teresa, REALNY LLM, grounded na intake+źródłach, fail-soft do placeholdera). Wołane TYLKO gdy `useLlm` (`service:490`).
- Default FE: View Mode-1 `useLlm=true` (`DocumentStudioView.tsx:43`) ⇒ realna treść; **IntakeForm `useLlm=false` (`:83`) i Mode-3 wymusza `false` (`:122`)** ⇒ generacja z szablonu produkuje SZKIELET PLACEHOLDER, nie treść. Rozjazd default-ów = ryzyko że użytkownik dostanie pusty szkielet.

---

## TABELA 1a — REALNE (działa runtime)

| Funkcja | Dowód |
|---------|-------|
| Mode 1 plan/generate (z LLM) | `routes:395/426`, `service materializeDocumentArtifact`, prose przez Teresa |
| Mode 2 template lifecycle | `routes:544-709`, `documentTemplateService.ts`, persyst. migracja 769 |
| Mode 3 walidacja źródeł | `routes:499`, `service:382 MissingRequiredSourceError` |
| Editor state persistence | `documentEditorStateRegistryDao.ts` + migracja 20260603 (write-through + hydration) |
| 6 scope'ów proposali + approve/reject | `routes:3279-3645`, FE EditorPanel |
| QA gate eksportu 403 (server) | `service:668-763`, `documentQaService.ts:118-168` |
| Outputs registry wiring (G5) | `routes:469-493 registerArtifactOrigin` |
| Base artifact persist (wave5) | `wave5ArtifactRuntimeService.ts:486` INSERT, org-scoped read |

## TABELA 1b — MOCK-STUB / facade persystencji (działa w sesji, ZNIKA po restart)

| Funkcja | Dowód | Rekomendacja |
|---------|-------|--------------|
| Share-links (create/revoke/rotate/audit/consume) | `documentShareLinkRegistryDao.ts:19-50` — Mapy `linkStore`/`tokenIndex`; nagłówek: "in-memory until the wave5 persistence migration ships" | Dodać DAO+migrację; inaczej link share znika po deployu |
| Komentarze | `documentCommentsService.ts:90-107` — `persistComment` pisze do `persistedCommentStore` (Mapa), nie DB | DAO+migracja |
| Wersje/snapshoty + rollback | `documentVersionSnapshotService.ts:84-107` — `persistedSnapshotStore` Mapa | DAO+migracja (P1 — rollback iluzoryczny po restart) |
| Content blocks | `documentContentBlockRegistryDao.ts:20-31` "in-memory only" | DAO+migracja |
| Brand voice profiles | `documentBrandVoiceRegistryDao.ts:19-28` "in-memory until wave5" | DAO+migracja |
| Approvals | `documentApprovalRegistryDao.ts:21-29` "in-memory only" | DAO+migracja |
| Audience profiles | `documentAudienceProfileRegistryDao.ts:23-31` "in-memory only" | DAO+migracja |
| Source packs | `documentSourcePackRegistryDao.ts:19+` "in-memory until wave5" | DAO+migracja |

## TABELA 1c — ZEPSUTE

| Co | Charakter | Dowód |
|----|-----------|-------|
| poz.7 snapshoty/rollback | Persystencja-fasada: nazwy `persist*`/`load*` sugerują DB, faktycznie 2 Mapy in-memory | `documentVersionSnapshotService.ts:84-107` |
| poz.8 komentarze | jw. — `persistComment`→Mapa | `documentCommentsService.ts:90-99` |
| Mode-3 generacja treści | Default placeholder (useLlm wymuszony false) — użytkownik może dostać szkielet zamiast dokumentu | `IntakeForm.tsx:122` |

## TABELA 1d — MARTWE / UKRYTE

| Co | Status | Dowód |
|----|--------|-------|
| (brak martwych endpointów) | wszystkie 95 endpointów osiągalne (router montowany bezwarunkowo) | `Gateway.ts:758-763` |
| Publiczny viewer treści dokumentu | NIE ISTNIEJE — public share daje tylko metadane+komentarze, brak route w `App.tsx` | `routes:4181-4330`, `App.tsx` (brak `/shared/document`) |

---

## TABELA 1e — WIRING (funkcja → endpoint → tabela DB → migracja → status)

| Funkcja | Endpoint | Tabela DB | Migracja | Status |
|---------|----------|-----------|----------|--------|
| Editor proposals | POST `/:id/editor/proposals/*` | `document_studio_editor_proposals` | 20260603 | ✅ PERSYST |
| Editor audit ledger | (write-through) | `document_studio_editor_audit` | 20260603 | ✅ PERSYST |
| Schema overlay (rollback/insert) | (write-through) | `document_studio_schema_overlay` | 20260603 | ✅ PERSYST |
| Templates (Mode 2) | `/templates*` | `document_studio_templates` (+product fields) | 769, 770 | ✅ PERSYST |
| Base artifact (generate/export) | `/generate`, `/:id`, `/export` | `wave5_artifacts` + `wave5_artifact_versions` | wave5 (ensureTable runtime) | ✅ PERSYST |
| Wersje/snapshoty | `/:id/snapshots*`, `/rollback` | — (Mapa) | BRAK | ❌ IN-MEM |
| Share-links | `/:id/share-links*`, `/share-links/:id/*` | — (Mapa) | BRAK | ❌ IN-MEM |
| Komentarze | `/:id/comments*` | — (Mapa) | BRAK | ❌ IN-MEM |
| Approvals | `/:id/approvals*` | — (Mapa) | BRAK | ❌ IN-MEM |
| Content blocks | `/content-blocks*` | — (Mapa) | BRAK | ❌ IN-MEM |
| Brand voice | `/brand-voice/*` | — (Mapa) | BRAK | ❌ IN-MEM |
| Audience profiles | `/audience-profiles*` | — (Mapa) | BRAK | ❌ IN-MEM |
| Source packs | `/source-packs*` | — (Mapa) | BRAK | ❌ IN-MEM |
| Access history | `/:id/access-history` | (serwis `documentAccessHistoryService`) | — | do potw. (prawdop. in-mem) |

---

## TABELA 1f — FLAGI

| Flaga | Wartość/efekt | Dowód |
|-------|---------------|-------|
| Mount routera | BEZWARUNKOWY (brak `v8FeatureGate`!) — w przeciwieństwie do `/api/artifacts` które ma `v8FeatureGate` | `Gateway.ts:758-763` |
| `highRiskSurfaceGuard` | aktywny: categories `['upload','export','public_share']` | `Gateway.ts:760` |
| Beta gating (`betaAccess.ts`) | **BRAK** — Document Studio nie jest w liście beta-gated; tylko `ProtectedRoute requireAuth` | `src/utils/betaAccess.ts` (brak wpisu), `AppRoutes.tsx:2082` |
| `useLlm` (generacja) | request-level; default rozjazd: View=true, IntakeForm/Mode3=false | `DocumentStudioView.tsx:43`, `IntakeForm.tsx:83,122` |
| Public share router | montowany PRZED authed (by token-resolve nie trafił na verifyToken) | `Gateway.ts:757` |

---

## TABELA 1g — POŁĄCZENIA

### WEJŚCIA (→ /document-studio | /wordy)
| Źródło | plik:linia | Cel |
|--------|-----------|-----|
| Outputs / Reports&Presentations hub („New") | `ReportsAndPresentationsHub.tsx:905` | `navigate('/document-studio')` |
| Execution Hub (z raportu) | `ExecutionHub.tsx:4378` | `/wordy?sourceType=execution_report&sourceId=...` |
| Chat / Teresa (intent dokumentu) | `UnifiedChatPanel.tsx:2584` | `navigateToRoute('/wordy')`; intent: `documentTeresaIntent.ts` (558 l., realny) |
| Kimi Workspace / ArtifactModuleHome | `ArtifactModuleHome.tsx:47` | `route:'/wordy'` |
| RouterSync alias | `RouterSync.tsx:110` | `/wordy` → kanonicznie `/document-studio` (`routeConfig.ts:36-37`) |

### WYJŚCIA
| Cel | plik:linia |
|-----|-----------|
| Eksport markdown/docx/pdf | `routes:3355` (+ `recordCompletedExport` do reports-pres model `:3379`) |
| Rejestr Outputs (G5) | `routes:469-493 artifactRegistryService.registerArtifactOrigin` (outputType='report', family='document') |
| Share publiczny | `routes:4183 /share-links/resolve` (metadane only) |

---

## SYGNAŁY DLA SEC

### Cross-org IDOR — WERDYKT: **CZYSTY** (jak M02/M17/M25, NIE jak M01/M03/M10/M13/M14)
Próbka 6 endpointów z `:artifactId`/`:id` z URL — wszystkie biorą `organizationId` z **auth context** (nie z URL) i przekazują do serwisu, który skanuje DB z `organization_id` w WHERE:

| Endpoint | plik:linia | org z auth? | SQL/serwis org-scoped? |
|----------|-----------|-------------|------------------------|
| GET `/:artifactId` | `routes:3335,3345` | ✅ | `getDocumentArtifact(id, org)` → `wave5:7 WHERE artifact_id=? AND organization_id=?` |
| GET `/:artifactId/snapshots` | `routes:2719,2730` | ✅ | `listDocumentVersionSnapshots(id, org)` (Mapa key org::id) |
| POST `/:artifactId/snapshots` | `routes:2738,2753` | ✅ | `createDocumentSnapshot({org,...})` |
| POST `/:artifactId/share-links` | `routes:3964,3984` | ✅ | `createShareLink({org,...})` |
| POST `/share-links/:shareLinkId/revoke` | `routes:4067,4079` | ✅ | `revokeShareLink({shareLinkId, org})` — org-stamp mimo id z URL |
| GET `/:artifactId/export/:format` | `routes:3357,3373` | ✅ | `exportDocumentArtifact(id, org, ...)` |

Wniosek: **brak wzorca `WHERE id=?` bez `organization_id`**. Editor-state DAO i wave5 mają org w każdym WHERE. Share-DAO org-scoped (key `org::shareLinkId`), wyjątek `loadShareLinkByToken` świadomy (token=sekret, public-resolve).

### Public share over-disclosure — WERDYKT: **MINOR** (nie M17-grade)
- `/share-links/resolve` zwraca jawną allowlistę 5 pól, BEZ treści/confidentiality/tytułu. Błąd M17 (`{...row}`) NIE występuje.
- ⚠️ Jedyna ekspozycja: `organizationId` (tenant-id) w payloadzie do anonima z ważnym tokenem. Zgłaszam jako minor — rozważyć usunięcie z public payloadu albo zastąpienie opaque session-id.

### Drugorzędne dla SEC/QA
- **Mount bez `v8FeatureGate`** (`Gateway.ts:758`) — moduł zawsze włączony na prod, w odróżnieniu od `/api/artifacts`. Zamierzone (SSOT), ale do potwierdzenia względem beta-gatingu reszty.
- **Persystencja-fasada** (snapshots, komentarze, share, approvals, content-blocks, brand-voice, audience, source-packs): funkcje `persist*`/`load*` udają DB ale piszą do Map. Ryzyko utraty danych przy każdym deployu/restarcie. NIE jest to cichy `catch→[]`, ale jest to MOCK persystencji z mylącym nazewnictwem — ryzyko, że audyt funkcjonalny (live, krótka sesja) tego nie wykryje.

---

## PODSUMOWANIE
- **Naprawione i solidne:** editor-state persistence (poz.4) ✅, QA-gate eksportu serwerowy (poz.6) ✅, IDOR czysty ✅, share over-disclosure minor (lepiej niż M17) ✅, templates+wave5 persyst ✅.
- **Główny problem systemowy:** 8 z ~11 warstw stanu modułu to **in-memory facade bez migracji** — w tym wersje/rollback (poz.7) i połowa panelu (poz.8). Działają w sesji, znikają po restarcie/deployu. Persystencja NAPRAWIONA jest TYLKO dla editor-state, nie dla reszty.
- **Generacja:** realna (LLM/Teresa) tylko przy `useLlm=true`; Mode-3 z szablonu domyślnie produkuje szkielet placeholder (rozjazd default-ów FE).
