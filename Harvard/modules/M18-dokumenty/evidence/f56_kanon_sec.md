# M18 — Dokumenty (Document Studio) — Karta audytu F5 KANON + F6 BEZPIECZEŃSTWO

Agent: KANON+SEC · Repo: consultify @ feat/deliverables-light · Data: 2026-06-11
View: `DocumentStudioView` (`src/components/DocumentStudio/DocumentStudioView.tsx`)
Backend: `server/src/routes/document-studio.routes.ts` (4332 l.) + publiczny sub-router `documentShareLinkPublicRoutes`
Trasy FE: `/document-studio`, `/document-studio/:artifactId` (`AppRoutes.tsx:2099-2118`)
Beta: `MODULE_DOCUMENT_STUDIO: 'closed'` (`betaAccess.ts:43`)

---

## FAZA 5 — KANONY

### 1. §27 TABLE_AND_PREVIEW_CANON — **w większości N/D (moduł to edytor, nie tabela listowa)**

Document Studio to **edytor dokumentów 3-szynowy** (Outline/Editor/QA panel w `DocumentStudioDocumentPanel`),
nie hub tabelowy. Główne powierzchnie: intake form → outline → document panel (MELS).
Brak tabel listowych z preview-pane w UI modułu. Jedyna powierzchnia listowa:

| Powierzchnia | Komponent | §27 |
|---|---|---|
| Lista szablonów (Mode 2) | `DocumentStudioTemplateArchitectView.tsx:302-308` — surowy `<ul>/<li>` | **ODSTĘPSTWO** — nie `FilterableTable`/`TableWithPreviewLayout`; brak preview, sortu, filtrów, resize, persistKey. To prosta lista wyboru, nie tabela kanonu. P3 |
| Lista wersji / snapshotów | API istnieje (`/snapshots`), ale brak dedykowanej tabeli §27 w UI | N/D — renderowane jako historia w panelu, nie tabela listowa |
| Access-history / audit trail | API `/access-history`, `/*/audit` istnieje; brak tabeli §27 w UI modułu | N/D — backend-only / panel boczny |

**Werdykt §27:** Moduł **nie ma kanonicznej tabeli listowej**. Punkty A–S **N/D** dla
powierzchni edytorowych (intake, outline, document panel, QA). Jedyne odstępstwo:
lista szablonów to ad-hoc `<ul>` zamiast kanonu (P3, niski wpływ — to picker, nie rejestr).

### 2. Wzorzec MELS (ExecutiveModuleShell)

- `DocumentStudioView` (shell modułu) **NIE używa** `ExecutiveModuleShell` — ma
  **ręcznie zbudowany header + taby** (`DocumentStudioView.tsx:193-219`): własny
  `<header>`, `<nav>` z 2 tabami (Generate / Plan template), `tabClass()` inline.
- MELS jest użyty **tylko wewnątrz** `DocumentStudioDocumentPanel.tsx:1996`
  (`ExecutiveModuleShell` z `@/components/shared/ExecutiveModuleShell`) — czyli na
  poziomie panelu dokumentu, nie na poziomie View.
- **Odstępstwo:** shell View jest custom, nie zgodny z referencyjną implementacją MELS
  (brak kanonicznego topbara/Menu, breadcrumbs idą z `AppRoutes`, nagłówek hardkodowany).
  **P2** — niespójność z resztą aplikacji na poziomie głównego widoku modułu.

### 3. UI-standards (kolory / chipy)

- **Brak `EntityStatusChip`/`StatusChip`** w całym module (grep = 0 trafień).
- **Hardkody kolorów** zamiast tokenów HBS — w `*.tsx` modułu m.in.: `bg-emerald-500`(11×),
  `text-emerald-300`(10×), `bg-sky-500`(9×), `bg-amber-500`(7×), `border-amber-400`(6×),
  `text-sky-300`/`text-amber-300`, `bg-sky-50`/`bg-amber-50` itd. (sumarycznie ~150 trafień
  raw sky/emerald/amber/rose). Niezgodne z §27 P / golden standard. **P3** (estetyka/spójność).
- 3-szynowy edytor (`DocumentStudioOutlinePanel` / `DocumentStudioEditorPanel` /
  `DocumentStudioQaPanel`) — spójny wewnętrznie, ale poza systemem chipów/tokenów.

### 4. i18n PL/EN — **ISTOTNY BRAK**

- `useTranslation`: **0** w `DocumentStudioView`, `DocumentStudioIntakeForm`,
  `DocumentStudioDocumentPanel` (2033 l.!), `DocumentStudioOutlinePanel`,
  `DocumentStudioTemplateArchitectView`. Tylko `DocumentStudioEditorPanel` (2×) i
  `DocumentStudioQaPanel` (3×) cokolwiek tłumaczą.
- **Stringi twardo po angielsku** w View: "Consultify Document Studio",
  "AI Document Artifact Engine · Modes 1, 2, 3 · Word/PDF artifact runtime", "Generate",
  "Plan template", "Loading document…", "No document loaded.", komunikaty błędów
  ("Failed to plan document outline", "Failed to generate…") — `DocumentStudioView.tsx:197-256`.
- "No templates yet." (`DocumentStudioTemplateArchitectView.tsx:302`).
- Mieszany wzorzec M17 (`isPolish ? :`) — 4× tylko w `DocumentStudioEditorPanel.tsx`.
- **Werdykt:** moduł jest **de facto EN-only**, niezlokalizowany. **P2** (UX dla PL klientów;
  to powierzchnia produktowa pokazywana klientom — deliverable).

### 5. Stany — empty / loading / error

- **Loading:** OK — `LoadingState variant="spinner"` przy ładowaniu artefaktu
  (`DocumentStudioView.tsx:228-229`); per-faza `planning`/`generating` flagi.
- **Error:** OK — `error` state renderowany per faza (`:234,243,254`), z fallbackiem
  "No document loaded." Brak cichej białej pustki — degradacja jawna.
- **Empty:** lista szablonów ma "No templates yet." (`TemplateArchitectView:302`);
  `refreshApprovedTemplates` swallow-uje błąd do `[]` (`:57-60`) — **cicha degradacja**:
  awaria listy szablonów → pusta lista bez komunikatu "nie udało się załadować". P3 łagodne.
- **Werdykt:** stany pokryte (lepiej niż nieme pustki w innych modułach); drobny silent-fail na liście szablonów.

### 6. CARD_CONTENT_FORMULA — **N/D potwierdzone**

Document Studio to edytor dokumentów (Word/PDF artifact runtime), nie produkuje kart
Insight/Initiative. Formuła nie dotyczy.

---

## FAZA 6 — BEZPIECZEŃSTWO

### SEC-1 [P2] Beta-lock TYLKO nawigacyjny — direct URL omija plate (wzorzec M17)

`MODULE_DOCUMENT_STUDIO: 'closed'` (`betaAccess.ts:43`). Lock aplikowany **wyłącznie w
Sidebarze**: `lockClosedBetaModules(...)` (`Sidebar.tsx:156`, menu item
`menuConfig.ts:145`). Trasy `/document-studio` i `/document-studio/:artifactId`
(`AppRoutes.tsx:2082-2118`) opakowane są tylko `ProtectedRoute requireAuth={true}` —
**bez bramki beta-closed na trasie**.
→ Użytkownik nie-admin wpisując bezpośrednio `/document-studio` w URL **omija plate
BETA_LOCKED** i wchodzi do edytora. API nadal egzekwuje `verifyToken` +
`requireOrgAccess` + org-scope (dane org-gated), więc to **nie wyciek danych** —
luka obrony-w-głąb / governance UX. **Identyczny wzorzec jak M17 SEC-1.**
**Dowód:** `betaAccess.ts:43`; `Sidebar.tsx:154-156`; `AppRoutes.tsx:2082-2118`. **Severity P2.**

### SEC-2 [OK] ORG-SCOPE document-studio.routes.ts — **CZYSTY** (brak cross-org IDOR)

W przeciwieństwie do M01/M03/M10/M13/M14 — **wszystkie** endpointy z `:artifactId`/`:id`
z URL są org-scoped. Wzorzec jak M02/M17/M25.

- **Bramka file-level:** `router.use(verifyToken)` + `router.use(requireOrgAccess())`
  (`document-studio.routes.ts:379-380`).
- **`getAuthContext`** czyta `organizationId` **z tokenu** (`req.user.organizationId`),
  **nigdy z body/query/params** (`:382-393`). Grep `body.organizationId`/`query.organizationId`/
  `params.organizationId` = **0 trafień**. 98 wywołań `getAuthContext` na 96 handlerów.
- **Fundamentalna bramka artefaktu** (gate dla całej reszty): każda operacja
  artefaktowa najpierw woła `getDocumentArtifact(artifactId, organizationId)` →
  `getWave5Artifact` → SQL `SELECT * FROM wave5_artifacts WHERE artifact_id = ? AND
  organization_id = ?` (`wave5ArtifactRuntimeService.ts:578-580`). Cross-org → `null` → 404.
  Wersje/mutacje też filtrowane org (`:598`).
- **Editor GET:** `/:artifactId` → `getDocumentArtifact(artifactId, organizationId)`
  (`routes:3345`), 404 jeśli null.
- **Export:** `/:artifactId/export/:format` → `exportDocumentArtifact(artifactId,
  organizationId, ...)` → `getWave5Artifact(..., organizationId)` (`service:641`).
- **Snapshots / rollback / diff / lifecycle / status / comments / approvals /
  variants / content-block insert / access-history / qa / editor proposals:** wszystkie
  przekazują `organizationId` z auth-context do warstwy serwisowej; rejestry in-memory
  kluczowane per-org (np. `getDocumentArtifact(params.artifactId, params.organizationId)`
  w `service:1746,1924,2120,2225` itd.; `access-history` poprzedzony `getDocumentArtifact`
  gate `routes:3718`).
- **Share-links:** `getShareLink(shareLinkId, organizationId)` →
  `registryStore.get(linkKey(organizationId, shareLinkId))` (`documentShareLinkService.ts:511-517`)
  — cross-org → null → 404. `listShareLinks` filtruje po prefiksie `org::` (`:532-537`).
  Revoke/audit/rotate analogicznie org-scoped (`routes:4079-4119`).
- **Templates / brand-voice / audience / content-blocks:** wszystkie `*(id, organizationId)`.

→ Artefakt/zasób org B **nieosiągalny** po ID z kontekstu org A (404).
**Werdykt: CZYSTY.** Brak systemowego cross-org IDOR.

### SEC-3 [OK ✅ — NAJWAŻNIEJSZE] Bramka EKSPORTU egzekwowana SERWEROWO

Bramka QA-eksportu jest egzekwowana **w warstwie serwisowej**, nie tylko w UI:
- `exportDocumentArtifact` → `if (requiresApprovalForExport(schema.documentType))`
  (`documentStudioService.ts:668`) — dla typów approval-gated (decision_memo,
  board_report, client_final_report, business_case, due_diligence_note).
- `runDocumentQa(schema, ...)`; jeśli `report.anyBlocking && !qaOverride` →
  **`throw new QaBlockingError(report)`** → handler zwraca **403 `qa_blocking`**
  (`service:729-744`; `routes:3393-3400`).
- **Override role-gated SERWEROWO:** `if (options.qaOverride && !canOverrideQa(userRole))`
  → **`throw QaOverrideUnauthorizedError`** → **403 `qa_override_unauthorized`**
  (`service:672-686`; `routes:3385-3391`). `canOverrideQa` dopuszcza tylko
  SUPERADMIN/OWNER/ADMIN/PROJECT_MANAGER/MANAGER (`documentQaService.ts:155-168`) —
  **NIE każdy zalogowany**; team/viewer/guest/client odrzuceni.
- **Anti-bypass:** bramka biegnie dla **każdego formatu (w tym markdown)**, więc nie
  można jej obejść zmianą formatu (`service:651-654` komentarz + kod). `userRole`
  pobierany z auth-context (`routes:3370`), nie z body.
→ **Werdykt: bramka eksportu egzekwowana serwerowo + override autoryzowany rolą.**
Lepiej niż M17 (gdzie governance publish-approval był tylko UI). **CZYSTY.**

### SEC-4 [P3] PUBLIC SHARE CONSUMER — sanitizowany whitelist (NIE wyciek całego wiersza jak M17), drobne over-disclosure org_id

Publiczny konsument: `POST /api/document-studio/share-links/resolve` (sub-router
`documentShareLinkPublicRoutes`, montowany **przed** authed routerem w
`Gateway.ts:757`, bez `verifyToken` — poprawnie). Handler `routes:4183-4202`.

- **BRAK wycieku całego wiersza [pozytyw]:** w przeciwieństwie do M17 (`{...row}` z
  `organization_id`/`confidentiality`/`created_by`), `consumeShareLink` zwraca
  **kontrolowany whitelist** `ConsumeShareLinkResult` = **tylko 5 pól**:
  `{ artifactId, organizationId, accessScope, shareLinkId, consumeCount }`
  (`documentShareLinkService.ts:575-581, 664-670`). **Brak** wycieku `created_by`,
  `confidentiality`, treści, `tokenHash`, dat wewnętrznych. **To poprawny wzorzec
  (kontrast wobec M17 SEC-4a).**
- **Drobne over-disclosure [P3]:** payload zawiera `organizationId` zwracane
  **nieuwierzytelnionemu** klientowi (`:666`). To opaque identyfikator tenanta — niska
  wartość, ale formalnie ujawnienie wewnętrznego ID anonimowemu konsumentowi. Brak FE
  konsumującego ten endpoint w repo (grep `share-links/resolve` w `src/` = 0) — viewer
  jeszcze niezbudowany, więc obecnie ID nie trafia do żadnego UI. **Severity P3** (hardening).
- **Token — entropia OK:** `randomBytes(32).toString('base64url')` = **256 bitów**
  (`:132-133`), hashowany w spoczynku HMAC (`hashToken`, `:143`), nieenumerowalny.
- **404 jednolite (OK):** missing/revoked/expired → jeden 404
  `share_link_invalid_or_expired` (`routes:4194-4198`; `service:608,620,636`) — nie
  ujawnia, który token kiedyś istniał (lepiej niż enumeracja). (Brak rozróżnienia 410 dla
  expired — drobne, zgodne z deny-by-default.)
- **Revoke ISTNIEJE [pozytyw]:** `POST /share-links/:shareLinkId/revoke` (`routes:4064-4096`,
  org-scoped) + `POST /share-links/:shareLinkId/rotate` (`:4128`). W M17 brakowało revoke.
- **BRAK RATE-LIMIT [P2]:** publiczny sub-router `documentShareLinkPublicRoutes` montowany
  **przed** `highRiskSurfaceGuard` (`Gateway.ts:757` vs `758-762`), a sam guard to
  feature-flag entitlement (`PUBLIC_SHARE_ENABLED`), **NIE** rate-limiter
  (`highRiskSurfaceGuard.middleware.ts:27-43`). Grep `rateLimit` w
  `document-studio.routes.ts` = **0**. `/share-links/resolve` + `/edit-session` +
  `/comments` otwarte na bruteforce/abuse (token 256-bit jest praktycznie
  niezgadywalny, ale brak throttlingu = wektor DoS / abuse komentarzy). **Severity P2.**

### SEC-5 [P2] Template approve/deprecate — **BRAK roli serwerowo** (każdy członek org może)

`POST /templates/:templateId/approve` (`routes:601-625`) i `/deprecate` (`:627-650`)
przekazują `{ templateId, organizationId, userId }` do `approveTemplate`/`deprecateTemplate`,
ale **żadnej weryfikacji roli nie ma** — ani w handlerze (brak `canPublishOrgTemplate`/
`requireRole`/ADMIN/OWNER), ani w serwisie (`documentTemplateService.ts:429,465` —
grep `userRole|role|ADMIN|OWNER|permission` = 0). 
→ **Każdy uwierzytelniony członek organizacji** może zatwierdzić lub zdeprecjonować
**dowolny szablon firmowy** (w obrębie swojej org — cross-org nadal blokowany).
Kontrast: M17 review/publish wymaga `canPublishOrgTemplate` (ADMIN/OWNER), M18 nie.
**Dowód:** `routes:616,642`; `documentTemplateService.ts:429-475` (brak gate roli). **Severity P2.**

### SEC-6 [OK] Approvals (multi-reviewer) — autoryzacja egzekwowana

Workflow approvalu **gatuje poprawnie**: reviewer spoza listy uczestników → błąd
`reviewer_not_participant` (`documentApprovalService.ts:42-43,89`); decyzje liczone
tylko od wymaganych uczestników (`:291-305`); cancel ograniczony do requestera
(doc + `requestedBy` `:378`). Komentarze przez share-link edit-session wymagają
`authorizeShareLinkEditSession` (token + editSessionToken + fingerprint,
scope `edit`, `routes:4251-4255`; `service:696-707`). **Werdykt: CZYSTY.**

### SEC-7 [P3] Sekrety / PII w logach

`logger.warn/error` w `document-studio.routes.ts` logują **tylko `message`** stringi
(`:415,490,498,572,890,1077,1229,2710,2770,2878`) — brak tokenów/maili/haseł.
`documentShareLinkService.ts` nie loguje tokenów (grep `logger`+`token` = 0). Audit
rows niosą `consumerFingerprint`/IDs, nie sekrety. **Severity P3 (informacyjne).**

---

## PODSUMOWANIE FINDINGÓW SEC

| ID | Severity | Tytuł | Dowód |
|---|---|---|---|
| SEC-5 | **P2** | Template approve/deprecate BEZ roli serwerowo — każdy członek org zatwierdza/deprecjonuje cudzy szablon | routes:616,642; documentTemplateService.ts:429-475 |
| SEC-1 | **P2** | Beta-lock tylko nawigacyjny — direct URL `/document-studio` omija plate | betaAccess.ts:43; Sidebar.tsx:156; AppRoutes.tsx:2082-2118 |
| SEC-4b | **P2** | Brak rate-limit na publicznym `/share-links/resolve` (+edit-session/comments) | Gateway.ts:757-762; document-studio.routes.ts (rateLimit=0) |
| SEC-4a | **P3** | Public consumer zwraca `organizationId` anonimowi (drobne over-disclosure; whitelist, NIE cały wiersz) | documentShareLinkService.ts:575-581,664-670 |
| SEC-7 | P3 | Logi: tylko message, brak tokenów/PII | document-studio.routes.ts:415-2878 |
| SEC-2 | **OK** | Org-scope CZYSTY (brak cross-org IDOR) — gate `WHERE org_id=?` na każdym artefakcie | wave5ArtifactRuntimeService.ts:578-580; routes:3345,3718,4052 |
| SEC-3 | **OK ✅** | Bramka eksportu egzekwowana SERWEROWO + override role-gated (canOverrideQa) | documentStudioService.ts:668-686,729-744; documentQaService.ts:155-168 |
| SEC-6 | **OK** | Approvals — reviewer/participant + requester-cancel gating | documentApprovalService.ts:42-43,291-305 |

## PODSUMOWANIE KANON

- **§27:** moduł edytorowy — A–S w większości **N/D**. Jedyne odstępstwo: lista
  szablonów to ad-hoc `<ul>` zamiast `FilterableTable` (P3).
- **MELS:** `DocumentStudioView` ma **custom header/taby**, NIE `ExecutiveModuleShell`
  (MELS tylko wewnątrz `DocumentStudioDocumentPanel`). Niespójność z referencją — **P2**.
- **i18n:** moduł **de facto EN-only** — `useTranslation` brak w View/IntakeForm/
  DocumentPanel(2033 l.)/Outline/TemplateArchitect; twarde stringi EN. **P2**.
- **UI-standards:** brak `EntityStatusChip`, ~150 hardkodów kolorów (sky/emerald/amber/rose). **P3**.
- **Stany:** loading/error/empty pokryte; drobny silent-fail na liście szablonów (P3).
- **CARD_CONTENT_FORMULA:** N/D (edytor dokumentów) — potwierdzone.

**Najważniejsze (zgodnie z priorytetem zadania):**
1. **Org-scope = CZYSTY** (gate `WHERE org_id=?` na fundamencie artefaktu — żaden endpoint nie wycieka cross-org).
2. **Bramka eksportu = egzekwowana SERWEROWO** + override role-gated (NIE tylko UI).
3. **Public share = sanitizowany whitelist** (NIE wyciek całego wiersza jak M17); jedyne drobne to org_id i brak rate-limit.
