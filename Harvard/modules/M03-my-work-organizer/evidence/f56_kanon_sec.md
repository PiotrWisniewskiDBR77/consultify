# M03 — Moja Praca (organizer) · FAZA 5 (KANON) + FAZA 6 (BEZPIECZEŃSTWO)

Agent KANON+SEC · Protokół Harvard V1 · READ-ONLY · branch `feat/deliverables-light` · 2026-06-11
Zakres: organizer (INV_B sekcje 1,3,4,5,6,7,8,9,10). Notatnik (sekcja 2 = M04) i Ideas — POZA zakresem.
Dowody: `plik:linia`.

Powierzchnie tabel listowych M03:
- **Zadania** — `src/components/MyWork/MyTasksListContent.tsx` (2483 l.)
- **Decyzje** — `src/components/MyWork/DecisionsPanelContent.tsx` (2267 l.)
- **Inbox** — `src/components/MyWork/InboxContent.tsx` (3357 l.)

Wszystkie trzy: ręczny `<table className="w-full table-fixed">` na prymitywach `ui/ResizableTable` (ColumnResizer, FilterDropdown, TableSettingsPopover) — dopuszczalne wg §2.2 KANONU pod warunkiem spełnienia §3–§7 wizualnie. Zadania/Decyzje opakowane w `TableWithPreviewLayout`; Inbox ma własny ręczny preview pane.

---

# SEKCJA KANONY (§27)

## Tabela 1 — ZADANIA (`MyTasksListContent.tsx`)

| Pkt | Kryterium | Wynik | Dowód / uwaga |
|---|---|---|---|
| A0 Preview | Boczny preview, single-click | PASS | `TableWithPreviewLayout<Task>` :1929; `setPreviewTaskId` :2435 |
| A0 Filtry kolumn | FilterDropdown na status/priority | PASS | :2238, :2277 (status, priority) |
| A0 Sort | klik nagłówka + ikona | PASS | `handleSort` :2207; `TaskSortIcon` :2211 |
| A0 Resize | ColumnResizer zero-sum | PASS | :2213, :2249 + `handleColumnResize` :1467 |
| A0 Sticky header | `sticky top-0 z-10` | **WARN** | `sticky top-0 z-10` JEST :2176, ALE rodzic ma `overflow-hidden` :2173 → RC-4 (łamie sticky) |
| A0 Popover kolumn | portalowy TableSettingsPopover | PASS | :2348 |
| A0 Kebab | 3 strefy, dół ≥2 | PASS | context/fixed/danger :843-973; Open·Edit·Archive·Delay :905-957; Delete danger :960 |
| A0 Bulk bar | przyciski w Menu 3 | PASS | `onBulkBarChange` (bulk w command row huba) |
| A0 Stany | empty/loading/error | PASS | ErrorState+retry :1913-1919; empty :2150-2171; loading skeleton |
| E nagłówek typografia | `text-[11px] uppercase` slate-500/400 | PASS | :2202, :2224 itd. |
| E wyrównanie wg roli | tytuł left / status left+chip / akcje right | PASS | status left :2222; priority left :2261; akcje right :2344 |
| F Status chip | EntityStatusChip | PASS | :688 |
| F Due | jeden DueChip (nie DUE+OVERDUE) | PASS | :770 `DueChip` z `deriveDueRisk` |
| F Progress | ProgressCell | N/A | zadania nie pokazują % progresu w tabeli |
| F Assignee | graceful „Unassigned" | PASS | :822 italic „Unassigned" |
| F Puste komórki | `—`/italic placeholder | PASS | due bez daty :766 |
| G selekcja | bg-primary-500/8 + 4px akcent | PASS (do potw. wizualnie) | checkbox h-3.5 :2182 |
| O persist szerokości | localStorage `persistKey` | **FAIL** | `handleColumnResize` :1467 tylko `setColumnWidths` (state), brak `localStorage.setItem(width)`; persistowana TYLKO widoczność :2390 + row-desc :149. Szerokości GINĄ po reloadzie (dokładnie luka §5). |
| R i18n | `t()` bez hardcode | **WARN** | 30× `isPolish ? 'PL' : 'EN'` inline zamiast `t()`; obie wersje obecne (smell, nie brak pokrycia) |
| P RC-8 | brak ad-hoc `max-w-[…]` na komórce | **WARN** | `max-w-[760px]` na sub-linii opisu :668 (RC-8, drobne) |

## Tabela 2 — DECYZJE (`DecisionsPanelContent.tsx`)

| Pkt | Kryterium | Wynik | Dowód / uwaga |
|---|---|---|---|
| A0 Preview | TableWithPreviewLayout | PASS | :1762 |
| A0 Filtry | FilterDropdown | PASS | :1945, :1979 |
| A0 Sort | klik + ikona | PASS | nagłówki sortowalne :1903+ |
| A0 Resize | ColumnResizer | PASS | tableMinWidth :1874 |
| A0 Sticky | `sticky top-0 z-10` | **WARN** | sticky JEST :1876; rodzic `overflow-hidden` :1873 → RC-4 |
| A0 Kebab 3 strefy | context/fixed/danger | PASS | Remind·Escalate (context) :695; Open·Edit·Archive·Delay (fixed) :717-757; danger Delete |
| A0 Stany | loading/empty | PASS | loading :1734; EmptyState :1744 |
| E wyrównanie | wszystko text-left/right wg roli | PASS | type/status/priority/date/project = left :568-609; akcje right :624 |
| F Status | EntityStatusChip | PASS | :579, :852, :908 |
| F Due | jeden DueChip | PASS | :597, :868 (risk overdue→none) |
| H kebab Archive | działający endpoint | **FAIL** | Archive `disabled: true` „Wkrótce (backend)" :737-738; Delay submenu też disabled :752 — §14 cyklu życia NIE zaimplementowany dla Decyzji |
| O persist szerokości | localStorage | **FAIL** | jak Zadania — persistowana tylko widoczność/row-desc :346,:368; brak szerokości |
| R i18n | t() | **WARN** | 56× `isPolish ?` inline |

## Tabela 3 — INBOX (`InboxContent.tsx`)

| Pkt | Kryterium | Wynik | Dowód / uwaga |
|---|---|---|---|
| A0 Preview | boczny panel | PASS | ręczny PreviewPane `clamp(340px,28%,480px)` :3322-3353 (spełnia §7.2 wymiar), NIE przez TableWithPreviewLayout |
| A0 Filtry | FilterDropdown | PASS | :2846 |
| A0 Popover | TableSettingsPopover | PASS | :2874 |
| A0 Kebab | RowActionsMenu | PASS | :2748, :3051 |
| A0 Sticky | sticky top-0 z-10 | **WARN** | sticky :2763 (`thead`), ALE wrapper `overflow-hidden` :3316 → RC-4 |
| A0 Stany | loading/empty/error 3-warianty | PASS (z brakiem) | loading :3266; ErrorState+retry :3272; empty per-tab done/saved/default :3273-3314 — ALE brak rozróżnienia „brak dla filtra" + brak CTA (§10/§22 częściowo) |
| F Status | EntityStatusChip | PASS | :2918 `renderStatusPill` |
| F Due | jeden DueChip | PASS | :2639 |
| R i18n | t() | **WARN** | 107× `isPolish ?` inline (największe nasilenie) |

### Wzorzec korupcji „rose"/„roseuction"
**BRAK korupcji** w tabelach M03. Wszystkie wystąpienia `rose-*` to legalne klasy Tailwind (`bg-rose-500`, `text-rose-700` itp. — `MyTasksListContent.tsx:163,234`; `MyWorkHub.tsx:548,1509`), nie artefakt codemodu. (Korupcja „rose" dotyczy Notebook/Mind Map = poza zakresem M03 organizer.)

### Wzorzec hubowy — `MyWorkHub.tsx`
Menu 1/2/3, dynamic tabs dokumentów (sessionStorage), breadcrumbs, kontekstowy czat AI per tab — zgodny z ModuleHub (INV_B sekcja 9). Bulk bary tabel delegowane do command row huba (`onBulkBarChange`) — poprawny wzorzec formuły 2.

---

## NAJWIĘKSZE ODSTĘPSTWA §27

**P1:**
- **RC-4 na WSZYSTKICH 3 tabelach** — wrapper `rounded-xl overflow-hidden` bezpośrednio nad sticky `<thead>` (`MyTasksListContent.tsx:2173`, `DecisionsPanelContent.tsx:1873`, `InboxContent.tsx:3316`). To dokładny root-cause RC-4 z §20 — `overflow-hidden` rodzica łamie `position:sticky`. Sticky deklarowany jest na thead, ale realnie może nie działać przy scrollu. Wymaga weryfikacji wizualnej (computed-style + scroll), ale kod = jednoznaczne odstępstwo. Fix: zdjąć `overflow-hidden` z karty (clip rogów inną drogą).

**P2:**
- **Brak persistencji szerokości kolumn** (Zadania + Decyzje) — §5/§O. Resize żyje tylko w stanie React; po reloadzie szerokości wracają do default. Persistowana jest tylko widoczność kolumn i toggle opisu. To dokładnie luka, którą §5 KANONU nazywa wprost.
- **Archive/Delay niezaimplementowane dla Decyzji** (kebab `disabled` „Wkrótce backend", `DecisionsPanelContent.tsx:737,752`) — §14 cyklu życia. Dla Zadań Archive zależy od opcjonalnego `onTriageArchive` (też może być disabled). Zgodne z notą inwentarza o odroczonym backlogu lifecycle.

**P3:**
- **i18n inline `isPolish ?`** zamiast `t()` — 30/56/107 wystąpień (Zadania/Decyzje/Inbox). Pokrycie PL/EN jest pełne, ale to dług utrzymaniowy vs §R.
- **Inbox empty-state** bez wariantu „brak dla filtra" i bez CTA (§10/§22).
- **RC-8** drobne `max-w-[760px]` na sub-linii opisu zadania (`MyTasksListContent.tsx:668`).

---

# SEKCJA BEZPIECZEŃSTWO (FAZA 6)

## 1. Trzy warstwy gatingu (Manager za rolą admin/manager/superadmin)

| Warstwa | Stan | Dowód |
|---|---|---|
| Nawigacja (sidebar) | Menu pokazuje MY_WORK wszystkim; brak per-tab role w menuConfig | `src/components/navigation/Sidebar/menuConfig.ts:58` |
| UI tab Manager | gating klienta: `canViewManager = isAdmin\|\|isManager\|\|isSuperAdmin`; blok nawigacji | `MyWorkHub.tsx:602`, blok :1151 |
| Route | Brak osobnej trasy/guarda — tab wewnątrz huba | `parseMyWorkPathIntent` :510 |
| **API (serwer)** | **BRAK** server-side role-gate dla danych Managera | patrz F-SEC-1 |

**Gating Managera serwerowo: NIE.** W całym monolicie `my-work.routes.ts` (13k l., 93 endpointy) **zero** `requireRole`/`isManager`/`403`-role (jedyne trafienie „admin" :8423 to label danych, nie auth). Zob. F-SEC-1.

## 2. Org-scope — przegląd CRUD tasks/decisions/inbox/calendar + `:id`

Auth bazowy: `my-work.routes.ts` ma `router.use(verifyToken)` :74 + `apiAuthRateLimiter` :73 — wszystkie endpointy wymagają uwierzytelnienia. `requireOrgAccess()` (na `/api/decisions`) waliduje TYLKO że user ma ważny org-token, **nie** że zasób należy do org (`rbac.middleware.ts:211-225`).

**Sprawdzone endpointy CRUD (12) + wynik scope:**

| Endpoint | Plik:linia | Org-scope | User-scope | Werdykt |
|---|---|---|---|---|
| `GET /personal-tasks/:id` | my-work.routes.ts:1265 | ✅ `organization_id=?` :1293 | ✅ ownerScope | OK |
| `PUT /personal-tasks/:id` | :1309 | ✅ :1328,:1391,:1403 | ✅ ownerScope | OK |
| `DELETE /personal-tasks/:id` | :1432 | ✅ ownerScope+org | ✅ | OK |
| `GET /personal-tasks` (list) | :1046 | ✅ orgId | ✅ | OK |
| `GET /decisions` (my-work list) | my-work/decisions.routes.ts:41 | ✅ `d.organization_id=?` :92 | ✅ userId :99 | OK |
| `POST /decisions/:id/snooze` | decisions.routes.ts:275 | ✅ `AND d.organization_id=?` :302 | ✅ :306 | OK |
| `DELETE …decision snooze` | :329 | ✅ org+user :341 | ✅ | OK |
| `PATCH /api/decisions/:id/decide` | DecisionController.ts:946 | **❌ BRAK** `SELECT…WHERE id=?` :985, `UPDATE…WHERE id=?` :1010 | częściowo (decision_maker_id LUB admin) :994 | **F-SEC-2** |
| `POST /api/my-work/inbox/canonical/:id/snooze` | my-work.routes.ts:2332 → inboxService.triageItem | **❌ BRAK** `WHERE id=?` (inboxService.ts:332) | ❌ | **F-SEC-3** |
| `PATCH …/inbox/canonical/:id/sla` | :2355 → triageItem | ❌ BRAK | ❌ | F-SEC-3 |
| `POST …/inbox/canonical/:id/delegate` | :2308 → delegateItem | **❌ BRAK** `WHERE id=?` (inboxService.ts:351) | actor only | F-SEC-3 |
| `POST /inbox/:id/triage` (legacy) | :2118 | n/d (per-user `my_work_inbox_triage`, `user_id=?`) | ✅ user_id | OK (klucz per-user) |
| `POST /inbox/bulk-triage` | :2155 | per-user `user_id=?` :88 | ✅ | OK |
| `GET /executive-analytics` (Manager) | :7832 | ✅ orgId :7842-7874 | **brak role-gate** | **F-SEC-1** |

**Wynik org-scope: sprawdzono 14 endpointów; 11 poprawnie scoped, 3 BEZ scope zasobu** (decide, canonical inbox snooze/sla/delegate liczone jako 1 rodzina F-SEC-3 → de facto 4 trasy bez scope). Wzorzec personal-tasks i my-work/decisions = wzorcowy (org + owner). Słabe punkty to ścieżki delegujące do serwisów (`inboxService`, `DecisionController`), które przyjmują surowe `id` z URL bez org.

## 3. Capabilities serwerowo (approve/reject, manager actions)

- **Decyzja approve/reject** (`/decide`) — capability gate JEST: tylko `decision_maker_id===userId` LUB rola ADMIN/SUPERADMIN (`DecisionController.ts:994-1001`). ALE bez org-scope (F-SEC-2) — admin org A może zatwierdzić decyzję org B.
- **Top-level `/api/decisions` PUT `/:id`** (`decisions.routes.ts:259`) — wzorcowy: `decisionMakerId!==userId → 403` + org-scope (`organizationId!==orgId → 404` :255). (Uwaga: to inny router niż zamontowany `pmo/decisions` — panel używa pmo/decide.)
- **Manager actions / executive-analytics** — brak jakiegokolwiek capability/role po stronie serwera (F-SEC-1).

## 4. PII / sekrety w logach
- `my-work.routes.ts:619` — `logger.error('[MyWork] resolveCanonical error', { error, email })` loguje email użytkownika. Niska wrażliwość, ale do redakcji (P3-SEC). Brak tokenów/haseł/sekretów w logach M03.

---

## TOP FINDINGI SEC (severity)

**F-SEC-1 · P1 · Broken Access Control (Manager tylko UI).** `GET /api/my-work/executive-analytics` (`my-work.routes.ts:7832`) zwraca dane portfela całej organizacji — capacity overview, **overload alerts z imionami i godzinami per-pracownik** (:7909-7916), breakdown inicjatyw — KAŻDEMU uwierzytelnionemu użytkownikowi org. Brak `requireRole`. Gating Managera istnieje wyłącznie w UI (`MyWorkHub.tsx:602,1151`). Niezarządzający członek org może odpytać endpoint bezpośrednio i odczytać dane wydajności zespołu. Fix: serwerowy gate roli admin/manager/superadmin na endpointach executive/work-patterns/delegation/capacity.

**F-SEC-2 · P1 · Cross-org IDOR na zatwierdzaniu decyzji.** `DecisionController.decide` (`DecisionController.ts:946`) ładuje `SELECT * FROM decisions WHERE id=?` (:985) i `UPDATE decisions … WHERE id=?` (:1010) **bez `organization_id`**. Capability-check (:994) przepuszcza każdego ADMIN/SUPERADMIN niezależnie od org. → admin org A może approve/reject/deferred decyzję org B znając jej `id`. `requireOrgAccess()` tego nie chroni (waliduje usera, nie zasób). Fix: po `SELECT` sprawdzić `decision.organization_id === req.user.organizationId` (404 w przeciwnym razie) i dodać `AND organization_id=?` w UPDATE + history INSERT.

**F-SEC-3 · P1 · Cross-org IDOR na canonical inbox.** `inboxService.triageItem` (`inboxService.ts:305`, `SELECT/UPDATE … WHERE id=?` :332,:336) i `delegateItem` (:342, `WHERE id=?` :351,:360) operują na surowym `id` bez `organization_id`/`user_id`. Trasy `my-work.routes.ts:2308/2332/2355` (delegate/snooze/sla) nie przekazują org. → dowolny user może snooze/zmienić-SLA/oddelegować dowolny element inboxa dowolnej org. `delegateItem` dodatkowo klonuje element do arbitralnego `toUserId` (:367-373) — wektor wycieku cross-org. Fix: parametr `organizationId` (+ owner) w serwisie i `AND organization_id=?` w zapytaniach.

**P2-SEC — różnica routerów decyzji.** W repo są 3 routery decyzji (`decisions.routes.ts` org-bezpieczny, `pmo/decisions.routes.ts` zamontowany na `/api/decisions` → `DecisionController` z F-SEC-2, `my-work/decisions.routes.ts` org-bezpieczny). Panel M03 używa pmo/decide (podatnego). Ryzyko rozjazdu/regresji — warto skonsolidować.

**P3-SEC — email w logu** `my-work.routes.ts:619`.

---

## PODSUMOWANIE
- §27 największe odstępstwa: **P1 RC-4 (overflow-hidden nad sticky thead) na 3/3 tabelach**; **P1 brak persistencji szerokości kolumn** (Zadania+Decyzje, dokładna luka §5). Reszta KANONU (preview, filtry, sort, kebab 3-strefy, EntityStatusChip, jeden DueChip, wyrównanie wg roli, stany) — zasadniczo zgodna.
- Org-scope: **14 sprawdzonych, 3 rodziny endpointów bez scope zasobu** (decide + canonical inbox snooze/sla/delegate). Wzorzec personal-tasks/my-work-decisions = wzorcowy (org+owner).
- **Gating Managera serwerowo: NIE** (tylko UI) → F-SEC-1.
- TOP sec: F-SEC-1 (P1 Manager UI-only), F-SEC-2 (P1 cross-org decide IDOR), F-SEC-3 (P1 cross-org inbox IDOR).
- Ścieżka pliku: `Harvard/modules/M03-my-work-organizer/evidence/f56_kanon_sec.md`
