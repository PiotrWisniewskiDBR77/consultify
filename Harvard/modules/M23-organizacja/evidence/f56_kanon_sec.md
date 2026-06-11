# M23 — Organizacja: Faza 6 (Bezpieczeństwo) + Faza 5 (Kanony)

Branch: `feat/deliverables-light`. Agent: KANON+SEC. Data: 2026-06-11.

Trasa FE: `/organization/*` → `OrganizationView` przez `<ProtectedRoute requireAuth={true}>` **BEZ `requiredRole`** (`src/routes/AppRoutes.tsx:2180-2191`). Dla porównania `/admin/*` ma `requiredRole="ADMIN"` (`AppRoutes.tsx:2196`). Potwierdzona czerwona flaga: route bez role-gate.

---

## FAZA 6 — BEZPIECZEŃSTWO

### Trzy warstwy gatingu (nawigacja / route / API)

1. **Nawigacja (sidebar)** — sekcje admina (`members, competencies, billing, limits, domains, branding`) zdefiniowane jako `ADMIN_SECTIONS` (`OrganizationView.tsx:28-35`). Klik w sidebarze robi `ADMIN_REDIRECTS` → przekierowanie na `/admin/*` (role-gated). OK dla ścieżki klików.
2. **Route** — `requireAuth` BEZ roli. Member wchodzi deep-linkiem `/organization/members` itd.
3. **KRYTYCZNE**: `ADMIN_REDIRECTS` odpala się TYLKO w `handleSectionChange` (klik), **nie** przy bezpośrednim wejściu z URL. `renderContent()` renderuje `<OrganizationAdminPanel section={activeSection}/>` gdy `ADMIN_SECTIONS.includes(activeSection)` (`OrganizationView.tsx:176-177`), `activeSection` pochodzi z URL (`:140-147`). → **Member deep-linkujący `/organization/members|billing|branding|competencies|limits|domains` dostaje pełny shell panelu admina bez redirectu i bez role-gate** (`OrganizationAdminPanel.tsx` — brak jakiegokolwiek sprawdzenia roli/redirectu, 932 linie). Cała obrona spada na API.

**Wniosek**: gating FE dla sekcji admina jest dziurawy przy deep-linku → API musi kompensować KAŻDY endpoint. Poniżej enumeracja.

### Enumeracja WSZYSTKICH routerów org (sprawdzone)

Montowanie w `server/src/Gateway.ts`. Uwaga: w tej aplikacji **NIE ma globalnego `app.use(verifyToken)`** — auth jest per-mount. Część routerów org montowana **bez** `gatewayVerifyToken` na poziomie mount → muszą mieć własny `verifyToken`.

| Router | Mount (Gateway.ts) | verifyToken | Org-scope | Role-gate na write | Werdykt |
|---|---|---|---|---|---|
| `organizations.routes` (controller) | `:677` (po `gatewayVerifyToken :673`) | tak | membership-based (`getMembers(orgId)` + `isMember`) | `requireRole`/OWNER-ADMIN | OK |
| `ownership.routes` | `:678` | dziedziczy | — | — | (patrz niżej) |
| `approved-domains.routes` | `:679` | własny `:18` | `userOrgId!==orgId→403` | admin-role na POST/PUT/DELETE | OK (ale feature dead, P3) |
| `invitation.routes` | `:694` | warunkowy (publiczne `/accept`,`/validate`) | — | — | poza M23 core |
| `organization-context.routes` | `:698` | własny `:26` | orgId z tokena | admin na rebuild `:66` | OK |
| `organization-profiles.routes` | `:699` | własny `:175` | `userOrgId!==orgId→403` (każdy endpoint) | admin na PUT `:382-387`, audit `:757` | OK |
| `organization-data.routes` | `:700` | własny `:14` | orgId z tokena | **BRAK** | **P1 — full export bez roli** |
| `organization-limits.routes` (`/api/organization`) | `:701` | własny `:15` | orgId z tokena | read-only | OK |
| `branding.routes` (`/api/branding`) | `:737` (+`gatewayVerifyToken`) | własny `verifyToken`+guard | `requesterOrgId===targetOrgId` + `organization_members` admin | `ensureBrandingWriteAccess` | OK |
| `competency.routes` (`/api/competency`) | `:644` (BEZ `gatewayVerifyToken`) | **BRAK** | orgId z tokena (gdy jest) | **BRAK** | **P1 — całkowicie bez auth** |
| `knowledge-graph.routes` | `:628` (BEZ `gatewayVerifyToken`) | własny `:35` | orgId z tokena (priorytet) | brak (read/write member) | P2 (fallback header/query org) |

### Findingi SEC

**[P1] `/api/competency/*` — całkowity brak uwierzytelnienia.**
`competency.routes.ts` nie importuje ani nie używa `verifyToken` (`grep verifyToken` = 0 trafień; jest tylko `import type AuthRequest`). Montowany `app.use('/api/competency', competencyRoutes)` (`Gateway.ts:644`) **bez** `gatewayVerifyToken` (porównaj sąsiednie mounty które go mają). Brak globalnego auth w aplikacji (potwierdzone — `app.use(verifyToken)` nie istnieje). orgId = `req.organizationId || req.user?.organizationId || ''` (`:16` itd.) → dla niezalogowanego request: `''`.
- Odczyty (`GET /categories`, `/levels`, `/competencies`) z `''` zwrócą puste (zapytania scoped `WHERE organization_id = $1`, `competencyTaxonomyService.ts:182`), więc **nie ma cross-org wycieku danych**, ale endpoint jest otwarty publicznie.
- **Zapisy** (`POST /categories`, `/categories/seed-defaults`, `/levels/seed-defaults`, `PUT/DELETE :id`) są wykonywalne **bez tokena** — niezalogowany może wstawiać/seedować taksonomię (śmieci z `organization_id=''`), DoS zapisu, zaśmiecanie. Dowód: `competency.routes.ts:22-160` (brak middleware), `Gateway.ts:644`.
- Mitygacja IDOR po `:id`: serwis scope'uje `WHERE id=$1 AND organization_id=$2` (`competencyTaxonomyService.ts:190,234,242`) → cross-org edycja realnych rekordów zablokowana, ale problem to brak auth jako taki.
**Fix**: dodać `gatewayVerifyToken` przy mount lub `router.use(verifyToken)` + role-gate na write (admin).

**[P1] `/api/organization-data/export/*` — pełny eksport danych org bez role-gate.**
`organization-data.routes.ts` ma `verifyToken` (`:14`) i orgId z tokena (OK org-scope), ale **zero sprawdzeń roli** (`grep role|admin|403` = 0). Każdy zalogowany **member** może wywołać:
- `POST /api/organization-data/export/:category` (`:210`) — eksport users/projects/tasks/decisions/documents/attachments/audit_log/activity_log;
- `POST /api/organization-data/export-all` (full-export, `:348`) — kompletny zrzut org (users, projects, tasks, documents, **audit_log, activity_log**).
To eksfiltracja całej bazy organizacji przez zwykłego członka. Dane wrażliwe (lista użytkowników, dokumenty, logi audytu). Dowód: `organization-data.routes.ts:210-378`, brak role-gate.
**Fix**: wymóg roli ADMIN/OWNER (np. `requireRole`) na endpointach export/*.

**[P2] knowledge-graph — fallback orgId z nagłówka/query (defense-in-depth).**
`requireUser` (`knowledge-graph.routes.ts:20-32`) buduje orgId jako `req.user?.organizationId || req.organizationId || req.headers['x-organization-id'] || req.query.organizationId`. Dla zalogowanego usera token-org ma priorytet (pierwszy w `||`), więc **nie jest eksploatowalne** przy obecnym `verifyToken` (`:35`). Ale wzorzec niebezpieczny: gdyby token kiedyś nie niósł org (np. service token), atakujący nadpisuje org nagłówkiem/query → cross-org claims/encje. Wszystkie wywołania serwisu używają `orgId` (`searchEntities/getEntityById/storeEntity/getProvenance` — `:56,89,131,272`), więc scope zależy w 100% od tej wartości.
**Fix**: usunąć fallbacki `x-organization-id`/`query.organizationId`; brać org wyłącznie z tokena.

**[P2] Knowledge Graph — brak role-gate na write członka.** `storeEntity`/`storeRelation`/`redactEntity` (`:118,197,293`) dostępne dla każdego member tej samej org (org-scope OK, ale brak rozróżnienia member vs admin). Proweniencja scoped per-org (`getProvenance(orgId,...)` `:272`) — **brak cross-org wycieku proweniencji**. Severity P2 bo within-org.

**[OK/P3] Org switch (wymiana tokenu) — BEZPIECZNY (najważniejszy flow).**
`POST /api/auth/switch-organization` (`auth.routes.ts:707`): `verifyToken`, następnie **wymóg ACTIVE membership** w `organization_members` dla docelowej org (`:729-750`, `WHERE m.user_id=? AND m.organization_id=?`; `!membership || status!==ACTIVE → 403 ORG_ACCESS_DENIED`). Sprawdza też `org_status==active` (`:752`). Dopiero potem `UPDATE users.organization_id` i `generateTokenPair` z nową org (`:766,775`). Log do `organization_switch_log` (`:805`). **User nie może przełączyć się na org, której nie jest aktywnym członkiem.** Brak luki.

**[OK] organization-profiles (profil firmy = strategia/cele) — org-scope poprawny.**
Każdy endpoint sprawdza `userOrgId !== orgId → 403` (`:189, 378, 622, 642, 678, 724, 753, 801`). GET profilu czytelny dla membera tej org; **cross-org czytanie/zapis profilu org B zablokowane**. PUT i `/audit` dodatkowo wymagają admin-roli (`:382-387, 757`). `/trust` PUT zablokowany (ownership boundary `:701-712`). Brak endpointu uploadu dokumentu do AI-ekstrakcji w tym routerze (`/logo` i `/verify-domain` zwracają 503 `notConfigured` `:627,659`).

**[P3] FE `POST /organization-profiles/:orgId/analyze` — martwy przycisk.**
`OrganizationProfileForm.tsx:411` woła `/organization-profiles/:orgId/analyze`, ale **brak takiej trasy w backendzie** (`grep analyze` w routerze = 0) → 404. Przycisk „Analyze" zawsze faila. Nie jest to wektor wycieku (brak uploadu), ale dead UX.

**[P3] approved-domains (auto-join) — feature niedokończony, brak konsumenta.**
Tabela `approved_domains` jest **tylko** zapisywana/czytana w `approved-domains.routes.ts`; brak konsumenta przy rejestracji/logowaniu (`grep approved_domains` po `server/src` = 1 plik). Domeny dodawane z `verified=false` (`:161`). Auto-join nie działa → **brak żywego wektora przejęcia użytkowników**, ale gdyby konsumenta dodano bez wymogu `verified=1`, admin org mógłby przejmować przyszłe rejestracje z dowolnej domeny. Write-path poprawnie gated (admin + org-scope). Severity P3 (gap funkcjonalny / przyszłe ryzyko).

**[P3] Branding — SVG upload dozwolony.**
`brandingUpload.fileFilter` akceptuje `image/svg+xml` (`branding.routes.ts:46`). SVG serwowany inline (`/uploads/branding/:orgId/...`) niesie ryzyko stored-XSS. Kolejność middleware jest poprawna (`verifyToken → ensureBrandingWriteAccess → multer` `:213-216`), więc cross-org zapis katalogu zablokowany ZANIM multer utworzy dir z `req.params.orgId`. Filename = `uuid+ext`, brak path-traversal z nazwy. Tylko SVG-content to ryzyko.

**[P3] Sekrety/PII w logach.** `organization-profiles` loguje tylko `orgId`/`userId` (`:602`), org switch loguje IP/UA do dedykowanej tabeli (akceptowalne, audit). Nie znaleziono logowania tokenów/treści profilu. Brak findingu P0/P1.

---

## FAZA 5 — KANONY

### §27 (tabele: członkowie / competencies / domains)
- **Stany**: `OrganizationAdminPanel` ma `LoadingState`/`ErrorState`/empty primitives (`:82-83`, members empty `:221`, limits error `:426`). CompetencyCatalog ma loading/error + toasty (`CompetencyCatalog.tsx:56,82`). Baseline §27 spełniony dla loading/empty/error.
- **Menu 1/2/3 i pełna checklista A–S**: nie audytowano per-kolumna w tym przebiegu (poza zakresem SEC); zalecane domknięcie w osobnym przebiegu KANON tabel.

### Wzorzec OrganizationView + OrganizationSidebar / drift admina
- **Podwójna implementacja admina (drift)**: sekcje admina istnieją w DWÓCH miejscach — lokalny `OrganizationAdminPanel` (renderowany przy deep-linku) ORAZ redirect do `/admin/*` (przy kliku). Niespójność: klik → AdminView (role-gated), URL → lokalny panel (bez gate). To źródło dziury SEC P1 powyżej i drift architektoniczny. **Rekomendacja**: albo wszystkie `ADMIN_SECTIONS` redirectować także przy montowaniu z URL, albo dodać `requiredRole` na samym route org dla pod-ścieżek admina.

### i18n PL/EN
- `CompetencyCatalog.tsx:51` używa `const isPl = i18n.language === 'pl'` — odejście od wzorca M15 (0× isPolish). Smell, do ujednolicenia na `t()`/klucze.
- Twarde, nieprzetłumaczone etykiety ról w `<option>`: `MEMBER`/`Admin` (`OrganizationAdminPanel.tsx:179-180`), fallback `'Member'` (`:237`). Brak `t()`.

### Hardkody kolorów
- `OrganizationAdminPanel.tsx:767,778,790,795,816` — `#6366f1` jako default brand color. To wartość-dana (kolor marki), nie chrome UI; akceptowalne, ale lepiej przez stałą/tokeny.

---

## PODSUMOWANIE SEVERITY
- **P1 ×2**: (1) `/api/competency/*` bez auth (write publiczny); (2) `/api/organization-data/export*` bez role-gate (full eksport org przez membera).
- **P2 ×2**: KG fallback orgId z nagłówka/query; KG write bez rozróżnienia member/admin.
- **P3 ×5**: martwy `/analyze`, approved-domains dead/feature-gap, SVG branding upload, PII/log (clean), i18n/kolory drobne.
- **OK (potwierdzone bezpieczne)**: org switch (membership-gated), organization-profiles (cross-org 403 + admin write), organizations.routes/controller (membership IDOR guard), branding (admin + org-match + kolejność middleware), organization-context, organization-limits.

Route bez role-gate **JEST** częściowo skompensowany przez API dla większości endpointów (profil, members, billing/limits, branding, switch), ale **NIE** dla competency (brak auth) i organization-data (brak roli) — to realne dziury wynikające z braku globalnego gate.
