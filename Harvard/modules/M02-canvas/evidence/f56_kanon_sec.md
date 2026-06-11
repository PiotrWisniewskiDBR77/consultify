# M02 Canvas — Faza 6 (Bezpieczeństwo) + Faza 5 (Kanony) — karta dowodów

> Agent KANON+SEC. Branch `feat/deliverables-light`. Data: 2026-06-11.
> Metoda: skan statyczny kodu (route+service+FE). Weryfikacja niezależna — teza
> briefu §3 traktowana jako do-obalenia, nie jako dana.
> Pliki bazowe: `server/src/routes/{work-canvas,deliverablesGenerations,public-artifacts}.routes.ts`,
> `server/src/services/{canvasMaterialize,effectiveAccessService,workCanvasService}.ts`,
> `server/src/services/deliverables/{deliverablesGenerationService,docGenerationRuntime}.ts`,
> `src/components/AIChat/{WorkCanvasDocumentPanel,CanvasEditor/*,CanvasArtifactSwitcher}.tsx`,
> `src/views/PublicArtifactView.tsx`, `src/routes/WorkCanvasRedirect.tsx`, `server/src/Gateway.ts`.

---

## FAZA 6 — BEZPIECZEŃSTWO

### 6.1 Org-scope per endpoint — WERDYKT: teza briefu POTWIERDZONA. Brak systemowego cross-org IDOR.

W odróżnieniu od M01/M03/M10/M13/M14 (gdzie endpointy `WHERE id=?` z `:id`
z URL nie filtrowały org), **M02 NIE ma surowych zapytań `WHERE id=?` bez org**.
Wszystkie endpointy z `:draftId` przechodzą przez jeden loader:

- `ownedDraft(req, draftId)` — `work-canvas.routes.ts:2064-2078`:
  `SELECT * FROM work_canvas_drafts WHERE id = ? AND organization_id = ?`
  (2068), a dodatkowo własność/widoczność: `visibility==='project'` **lub**
  `createdBy===userId` **lub** `ownerId===userId`, inaczej `null` → 404.

Inwentaryzacja DB-access w handlerach (`work-canvas.routes.ts`, linie 2639–4690):
każdy handler z `:draftId` woła `ownedDraft` i robi `if (!draft) return 404`
(potwierdzone: 2768, 2774, 2780, 2824, 2889, 3055, 3132, 3204, 3222, 3243,
3284, 3483, 3534, 3605, 3728, 3741, 3848, 3916, 3944, 3994, 4090, 4155, 4271,
4425, 4516, 4616). Zapytania pochodne też scope'ują:
- version list: `WHERE draft_id = ?` (3733) — poprzedzone `ownedDraft` (3728).
- version restore: `WHERE id = ? AND draft_id = ?` (3856) — poprzedzone
  `ownedDraft` (3848); UPDATE `WHERE id=? AND organization_id=?` (3891).
- proposals by id: `WHERE id = ? AND organization_id = ?` (3542 reject, 3577
  approve) + double-check `proposal.organizationId !== org → 404` (3547, 3582).

**deliverablesGenerations.routes.ts** (POST `/`, POST `/:id/generate`, GET
`/metrics`, GET `/:id`): wszystkie przekazują `organizationId` do serwisu, a
serwis filtruje w DB:
- deck: `getDeckRow(id, org)` → `SELECT … FROM presentation_decks WHERE id = ?
  AND organization_id = ?` (`deliverablesGenerationService.ts:107-111`), wołane
  w `start` (239) i `status` (321).
- doc/sheet: `getDocDraft(id, org)` → `getDraft({organizationId, draftId})` →
  `SELECT * FROM work_canvas_drafts WHERE id = ? AND organization_id = ?`
  (`workCanvasService.ts:394-396`), wołane w `startDoc`/`startSheet`/`statusDoc`
  (`docGenerationRuntime.ts:444, 827, 1018`).
- metrics: rola ADMIN/OWNER/SUPERADMIN + `getDeliverableMetrics(org, …)`
  (`deliverablesMetricsService.ts:77 WHERE organization_id = ?`).

→ **Żadnej dziury org-scope nie znaleziono.** Teza briefu o naprawie
(P0-1/P0-2 oraz org-scoping) — w warstwie odczytu draftów i generacji
**potwierdzona niezależnie**.

### 6.2 Guard CANVAS_CROSS_ORG_REFERENCE — POTWIERDZONY, na obu ścieżkach.

`canvasMaterialize.ts`:
- `assertOrgScopedReferences(input)` (87-114): waliduje `projectId`
  (`SELECT id FROM projects WHERE id=? AND organization_id=?`, 92), oraz
  `ownerId`/`taskAssigneeId` (`SELECT id FROM users WHERE id=? AND
  organization_id=?`, 108); brak → `crossOrgReferenceError` z `statusCode:403,
  code:'CANVAS_CROSS_ORG_REFERENCE'` (75-85).
- Wołany w `materializeWorkspaceTarget` **linia 141** — jedyny funnel zapisu.
- Obie ścieżki przez niego przechodzą:
  - **save-to-workspace**: route 4017 → `createWorkspaceResource` (2121-2156) →
    `materializeOrThrow` → `materializeWorkspaceTarget`.
  - **accept propozycji**: route 3611 → `createWorkspaceResource` (ta sama
    funkcja), a 403 cross-org jest przepuszczony jako realne 403 (3666-3674).
- Sama materializacja zapisuje zawsze z `organization_id: organizationId`
  aktora (152, 191, 243, 292) → zapis cross-org niemożliwy.

→ **Potwierdzone.** Guard realny i pokrywa save + accept.

### 6.3 Capabilities canvas.* serwerowo — CZĘŚCIOWO. Egzekwowane TYLKO na share.

- `requireCanvasCapability` (effectiveAccess SSOT, 493-514) jest wołane
  **wyłącznie** na share POST (3915) i share DELETE (3943), oba z `canvas.share`.
  → teza briefu „share POST+DELETE wymagają canvas.share" **potwierdzona**.
- `effectiveAccessService.ts`: `CANVAS_MEMBER_CAPABILITIES` = 9 caps
  (`canvas.output.*`, `canvas.convert.*`, `canvas.share`, 377-386); baseline
  `USER: [...CANVAS_MEMBER_CAPABILITIES]` (394); OWNER/ADMIN/SUPERADMIN → `'*'`;
  GUEST → brak wpisu. `hasEffectiveCapability` honoruje `*`/exact (685).
  → teza briefu „USER baseline / GUEST brak / admin wildcard" **potwierdzona na
  poziomie modelu**.
- **ALE** (finding poniżej): pozostałe 8 capabilities (`canvas.convert.*`,
  `canvas.output.*`) **nie są egzekwowane na żadnym endpoincie**. POST `/drafts`
  (create), PUT `/drafts/:id`, `/operations`, `/save-to-workspace`,
  `/create-output`, `/register-in-outputs`, `/send-to-*-studio`,
  `/save-as-artifact`, `/export` — gating tylko przez `ownedDraft` (auth+org+
  własność). `/proposals/:id/approve` używa `canUseWorkCanvasCapability`
  (legacy req.can/rola, 478-484), nie SSOT effectiveAccess.

### 6.4 Public viewer /api/public/artifacts/:token — POTWIERDZONY w całości.

`public-artifacts.routes.ts`:
- entropia: token = `randomUUID().replace(/-/g,'')` (share, work-canvas:3918) =
  32 znaki hex (UUIDv4, ~122 bity). Regex `SHARE_TOKEN_PATTERN=/^[0-9a-f]{32}$/`
  (50) **przed** jakimkolwiek DB-access (117) — blokuje wildcardy `%`/`_` w LIKE.
- rate-limit: `express-rate-limit` 30 req / IP / min (41-47).
- 404 dla nieznanego/revoked (118, 124, 144) — nieodróżnialne celowo (143);
  410 dla wygasłego (148-153).
- payload sanitizowany: tylko `{title, kind, contentMd, updatedAt, orgBranding?}`
  (158-164). BEZ draftId/orgId/authorId/email/provenance/sourceRefs.
- revoke (DELETE `/share`, 3941-3952): usuwa `provenance.share` (`{share:null}`)
  → `parseShare` zwraca null → token resolve'uje 404. **Realnie unieważnia.**
- Brak enumeracji: stała odpowiedź 404 dla zły-format / nieznany / revoked.

Legacy auth `GET /shared/:token` (3954-3991) — org-scoped (`organization_id=?`,
3961), zwraca draftId, ale tylko same-org+auth. Minor: token nie jest tu
shape-walidowany przed LIKE — ale org-scope + exact-match `sharedDraftPayload`
ogranicza ryzyko do własnej org. **P3.**

### 6.5 Trzy warstwy gatingu — SPÓJNE.

- `/api/work-canvas` mount: `Gateway.ts:382` — **NIE** za `internalToolsGuard`
  (w odróżnieniu od sąsiednich `/api/ai-*`, `/api/research`, `/api/artifacts`,
  372-385). Auth zapewnia router sam: `router.use(verifyToken)` w
  `work-canvas.routes.ts:2637` (przed wszystkimi route'ami od 2639). → brak
  dostępu anonimowego; rozjazd z internal-tools jest **zamierzony** (Canvas to
  funkcja member-facing, nie internal-only). Defensywnie OK, ale odnotowane.
- `/api/public/artifacts`: `Gateway.ts:450`, bez auth, z własnym rate-limit
  i token-gate (6.4).
- `/ai/work-canvas` standalone: to **FE-route** (`WorkCanvasRedirect.tsx`) —
  `<Navigate replace>` do `/chat?workPanel=1`. **Nie istnieje** żaden osiągalny
  standalone BE-route Canvasa. → nie ma „obejścia" splitu czatu. Spójne.

### 6.6 Sekrety/PII w logach — CZYSTO.

Logi `deliverablesGenerationService` / `docGenerationRuntime` referują
`generationId`, `slideCount`, `durationMs`, `message` błędu — **nie** loggują
raw `contentMd`/`intent`/`setup`/kluczy. `trackDeliverableEvent` /
`deliverablesMetricsService` persystują liczniki/czasy/`language`/`groundingMode`,
nie treść. **Brak findingu.**

---

## FINDINGI SEC

| ID | Sev | Tytuł | Dowód |
|----|-----|-------|-------|
| SEC-M02-1 | **P2** | Model capabilities `canvas.*` egzekwowany tylko dla `canvas.share`; 8 pozostałych caps martwe serwerowo | `work-canvas.routes.ts`: `requireCanvasCapability` tylko 3915/3943; POST `/drafts` (2668) bez capability; `/save-to-workspace` (3993) bez `canvas.convert.*`; `/create-output` bez `canvas.output.*`. Cf. `effectiveAccessService.ts:377-394` (9 caps zdefiniowanych). |
| SEC-M02-2 | **P2** | GUEST de facto może tworzyć/edytować/materializować Canvas (sprzeczne z briefem „GUEST=brak") | POST `/drafts` (2668) i `/save-to-workspace` (3993) nie sprawdzają żadnej `canvas.*`; tylko `verifyToken`+org. GUEST bez caps przechodzi (`ownedDraft` sprawdza własność, nie capability). |
| SEC-M02-3 | **P3** | `/proposals/:id/approve` używa legacy `canUseWorkCanvasCapability` (req.can/rola) zamiast SSOT effectiveAccess — rozjazd z resztą RBAC | `work-canvas.routes.ts:3585` vs `requireCanvasCapability` (493). Może rozjeżdżać się z UI-gate, który czyta `/api/access/effective`. |
| SEC-M02-4 | **P3** | Legacy `GET /shared/:token` bez shape-walidacji tokenu przed LIKE (`%token%`) | `work-canvas.routes.ts:3957-3963`. Ograniczone org-scope + exact-match; brak realnej eskalacji. |

**Brak P0/P1.** Org-scope, guard cross-org, public-viewer i share-enforcement
realne. Findingi to luki kompletności RBAC (P2) i higiena (P3) — **nie** IDOR.

P0-1 (utrata danych) i P0-2 (admin-only) — **nie powielam**: P0-2 obalony jako
zamknięty na poziomie modelu (USER baseline istnieje), z zastrzeżeniem SEC-M02-1/2
(model jest, ale egzekucja niepełna).

---

## FAZA 5 — KANONY

### 5.1 §27 TABLE_AND_PREVIEW_CANON — **N/D (uzasadnione).**

Canvas nie ma klasycznych tabel-list z preview+Menu 1/2/3. Trzy „listy"
renderowane jako ad-hoc `.map` w div/button, nie `<table>`:
- `CanvasVersionHistory.tsx:89` (timeline wersji),
- `CanvasArtifactSwitcher.tsx:184/213` (chipy artefaktów),
- lista propozycji w panelu (brak `<table>` w `WorkCanvasDocumentPanel.tsx`).
To kontekstowe listy lekkie (oś czasu / przełącznik), poza zakresem kanonu list-
tabel. **§27 nie aplikuje.**

### 5.2 UI-standards — **P3** (drift tokenów kolorów).

~61 surowych utili Tailwine'owej palety (`emerald/amber/rose/blue-*`) w
`CanvasEditor/*` + `WorkCanvasDocumentPanel.tsx` zamiast tokenów designu
(np. panel 587/590/596 status save; 4003-4013 banner info blue; floating menu
`bg-emerald-500` 490). Zgodne z systemowym wzorcem drift'u kolorów w innych
modułach. Spójność z TipTap toolbar zachowana (wspólny `CanvasEditorToolbar`).

### 5.3 i18n PL/EN — **P2** (mieszanka języków w głównym panelu).

`WorkCanvasDocumentPanel.tsx` (główny panel, ~4000 linii) **nie importuje**
`useTranslation`/i18n. Stringi są hardkodowane literałami i **mieszają języki**:
PL „Edytuj Markdown ręcznie" (3097), „Wróć do widoku dokumentu" (3105) obok EN
„Save Markdown" (3292), „Download CSV/PDF/Word/Excel/PowerPoint" (3310-3409),
„Coming soon" (2539). 59 linii z PL-diakrytykami + 31 hardkodowanych EN-atrybutów
współistnieją. Panel nie reaguje na ustawienie języka. (Dla kontrastu
`CanvasAIFloatingMenu.tsx`/`CanvasRichEditor.tsx` **używają** `useTranslation`.)

Deck-szkielet (Faza 5.3, teza „PL-only dla EN"): outline generowany przez
`generateOutline()` (LLM, respektuje `setup.language` enum pl/en przekazane z
`deliverablesGenerations.routes.ts:95`). W ścieżce L1 **nie znaleziono** statycznego
PL-only szkieletu — language jest LLM-driven. Teza briefu o PL-only szkielecie
**nie odtworzona w tej ścieżce** (możliwy fallback w legacy generatorze — poza
zakresem skanu, odnotowane jako niezweryfikowane).

### 5.4 Stany / cicha degradacja — **P3.**

- Flaga FE off (`VITE_ENABLE_DELIVERABLES_LIGHT`): legacy redirecty verbatim
  (brief §5) — nieme. `/ai/work-canvas` → `<Navigate replace>` do `/chat`
  (`WorkCanvasRedirect.tsx:28`) **bez komunikatu** dla usera. Akceptowalne dla
  deep-link compat-shim, ale to cicha degradacja (user nie wie, że trafił z
  legacy route do splitu).
- Empty/loading/error panelu: obecne (status save emerald/amber/rose 587-596),
  szczegółowa weryfikacja wizualna = poza zakresem skanu statycznego.

### 5.5 CARD_CONTENT_FORMULA — **N/D — POTWIERDZONE.**

Canvas to edytor artefaktów (deck/doc/sheet), nie produkuje kart insight/
inicjatyw. CARD_CONTENT_FORMULA nie aplikuje.

---

## WERDYKT SYNTETYCZNY

- **Org-scope per endpoint: teza briefu POTWIERDZONA.** Brak cross-org IDOR.
  M02 nie powiela systemowego wzorca M01/M03/M10/M13/M14 — `ownedDraft`
  (org+własność) i `getDraft`/`getDeckRow` (org) gate'ują 100% odczytów/zapisów
  z `:id`. **0 dziur org-scope.**
- **Guard cross-org materializacji: REALNY**, na obu ścieżkach (save + accept).
- **Public viewer: solidny** (32-hex regex pre-DB, rate-limit 30/min, 404/410,
  sanityzacja, revoke unieważnia). **Share POST/DELETE: `canvas.share` realnie.**
- **Luka: model capabilities `canvas.*` egzekwowany tylko dla `canvas.share`**
  (SEC-M02-1/2, **P2**) — pozostałe 8 caps i tryb read-only GUEST nie są
  wymuszane serwerowo; sprzeczne z tezą briefu „GUEST=brak". To **luka
  kompletności RBAC, nie IDOR** (wszystko org-scoped).
- **Odstępstwa kanonów:** §27 **N/D** (brak tabel-list, uzasadnione); i18n **P2**
  (główny panel miesza hardkodowane PL i EN, brak `useTranslation`); kolory
  **P3** (~61 surowych utili palety); cicha degradacja legacy-redirect **P3**.
- **Findingi SEC:** 0×P0, 0×P1, 2×P2 (RBAC), 2×P3 (higiena). Sekrety/PII w
  logach: czysto.
