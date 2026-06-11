# M04 — Notatnik (Notebook) — Karta dowodowa FAZA 5 (KANON) + FAZA 6 (BEZPIECZEŃSTWO)

Agent: KANON+SEC. Branch: feat/deliverables-light. Data: 2026-06-11.

## Topologia routingu (kluczowa dla SEC)

Trzy mount-pointy BE (Gateway.ts):
- `/api/my-work` → `server/src/routes/my-work/notebook.routes.ts` (1695 l.) — **LIVE**, główny CRUD notatników/stron/załączników/capture-upload/AI inline. To używa FE (`src/services/api/v8/my-work.ts` → `/my-work/notebook/...`).
- `/api/v8/notebook` → `server/src/routes/v8/notebook.routes.ts` — search + handoff (radar/inicjatywy/teresa) + preview/resolve/content. Używane przez FE `NotebookContent.tsx:1651/1667` (handoff radar+inicjatywy).
- `/api/notebook` (DEPRECATED, deprecationHeader) → `server/src/routes/notebook.routes.ts` — connectory Capture (web-clip/email/import), semantic search, AI proposals.

---

# FAZA 5 — KANONY

## §27 — Biblioteka notatników L1 (`NotebookLibraryContent.tsx`)
Tabela L1 jest **wzorcowa**. Checklist A–S:
- **A/B (App Table / kolumny):** ResizableTable + ColumnDef (Notatnik/Typ/Kontekst/Notatki/Zmieniono/akcje). `:60-127`. OK.
- **C (filtry):** scope „Wszystkie/Osobiste/Zespołowe" w Menu 3 (Command Row) + header-filter `context` (multiselect prywatny/org). Liczniki `onScopeCountsChange` (all/personal/team) `:178-183`. OK — zgodne z poz.1.
- **D (liczniki):** kolumna „Notatki" = `pageCount`, align right (canon §3.3) `:96-105,386-391`. OK.
- **E (wyrównanie):** daty left, liczby right — komentarze cytują canon §3.3. OK.
- **F (RowActionsMenu):** Menu 1/2/3 — context (Otwórz), manage (podgląd/Edytuj/Archiwizuj), danger (Usuń). `:239-302`. OK.
- **G (Fixed Bottom Manifest §9.2):** Archive = disabled slot z opisem „Wkrótce (backend)" (nie milcząco pominięty) `:274-280`. Delay N/A (brak due_date) — udokumentowane `:236-238`. OK.
- **H (RBAC w wierszu):** Edytuj/Usuń disabled/ukryte gdy `nb.ownerUserId !== currentUserId` `:241,270,284`. OK.
- **I (stany):** loading/error(+Retry)/empty(+filtered-empty) `:307-336`. OK.
- **Select column:** `showSelectColumn={false}` — brak bulk-select (świadome, L1 to lekka biblioteka). Akceptowalne.
- **EntityStatusChip:** brak — notatnik nie ma statusu lifecycle na L1 (status jest na poziomie strony L3). N/D.

**Werdykt §27:** zgodna, ~A-tier. Jedyny dług: brak twardego endpointu Archive (slot zaślepiony, nie błąd).

## Wzorzec hubowy (My Work)
Zgodny: L1 biblioteka → L2 strona, CTA „Nowy notatnik" w Menu 2 (MyWorkHub), nie w body. Modal create/edit z typologią personal/team + flagą `contextSharing` (private/org_context). `:411-631`. Zgodne z NOTEBOOK_STRUCTURE_SSOT + programem notebook overhaul.

## Korupcja codemodu „rose" (FLAGA POTWIERDZONA)
`src/components/MyWork/notebook/AIChatInlinePanel.tsx` — **18 hardkodów palety** Tailwind zamiast tokenów:
- `:97-99` mature = `blue-400/blue-500`, `:92-94` growing = `emerald`, `:102-104` actionable = `amber`, `:87-89` seed = `slate`.
- `:392` `text-rose-500 dark:text-rose-400`, `:442` `bg-rose-500/[0.06] text-rose-500/70`, `:565` rose chip, `:614/618` recording = `bg-rose-500/15`.
`NotebookContent.tsx` także hardkoduje: `:173-176` `bg-blue-500`/`text-blue-600`, `:402` callout critical `#f43f5e`+gradient, `:1972` `bg-blue-400`, `:2107` `text-blue-500`, `:2352` `hover:text-rose-500`.
**Charakter:** dług tokenizacji (UI-standards) — nie-themeable, nie respektuje primary/semantic tokenów. NIE jest błędem funkcjonalnym. Severity P3.

## i18n PL/EN
Wzorzec **M19/M21 (`isPl`/`isPolish` ternary)** — pełne dwujęzyczne pokrycie, **0× EN-only** w głównych ścieżkach.
- `NotebookLibraryContent.tsx`: `pl` z i18n.language, wszystkie stringi PL/EN `:46-630`.
- `NotebookContent.tsx`: `isPolish` `:613`, 86 ternarów; część toastów przez `t()` (`:841,1002,1102`).
- **Mikro-braki:** `NotebookContent.tsx:903` `toast.error('Failed to pin')` i `:912` `'Failed to update status')` — hardcoded EN-only. P3.
- BE AI-inline (extract-actions/suggest-topics) honoruje `language` z body, prompty PL/EN `:1444-1446,1532-1552`. OK.

## Stany / edytor TipTap / degradacja AI
- empty/loading/error: L1 OK (wyżej); L2 fetch errors → toast `:839-841,860-862`.
- TipTap: autosave z catch `:999-1002`, create z catch `:1099-1102`.
- **Degradacja AI:** extract-actions SSE BE ma `try/catch` → `emit('error')` + `res.end()` `:1469-1473`. suggest-topics ma **fallback heurystyczny** gdy LLM pada (`catch` buduje tematy z tytułu/tagów) `:1574-1600`. Solidne. OK.

## CARD_CONTENT_FORMULA
**N/D potwierdzone** — notatki to dokumenty TipTap (notebook_pages), nie karty insight/initiative. Formuła nie ma zastosowania. (Handoff do inicjatyw → tam obowiązuje INITIATIVE_FORMULA, poza M04.)

---

# FAZA 6 — BEZPIECZEŃSTWO

## SEC-1 — Gating osobiste vs zespołowe (container L1) — CZYSTE
`notebookContainerService.ts:canAccessNotebook` `:74-88`: hard org-bound + owner-always + team-member (gdy scope='team' i team_id), przez `team_members`. `canMutateNotebook` `:91-99` = owner-only. Lista `/notebooks` `:195-206` filtruje `organization_id = ?` AND (`owner_user_id = ?` OR (scope='team' AND team_id IN team_members usera)). **Notatnik osobisty usera A NIE jest dostępny dla usera B tej samej org; zespołowy widoczny tylko dla członków zespołu.** Brak cross-org/cross-user IDOR na poziomie kontenera.

## SEC-2 — IDOR na stronach (notebook_pages) — CZYSTE w LIVE
Live route `my-work/notebook.routes.ts`:
- GET `/notebook/pages/:id` `:776-837` → `canAccessNotebookRow` `:86-117`: org-match + (owner OR (visibility='project' AND project_members)). 404/403 gdy brak. OK.
- PUT/DELETE/pin/status `:1094-1322` → org-match + **owner-only** (`owner_user_id !== userId` → 403). OK.
- Lista `/notebook/pages` `:394-510` filtruje `organization_id` + per-wiersz `canAccessNotebookRow` `:472-477`. OK.
- Systemowy cross-org IDOR (flaga z core) — **NIE występuje** w live route M04; każdy handler robi `organization_id` check + owner/project gating. M04 dołącza do listy CZYSTYCH.

⚠ **Uwaga architektoniczna (nie luka):** dostęp do strony używa `visibility`(private/project)+`project_members`, a NIE scope/team kontenera L1. Czyli strona w notatniku zespołowym NIE jest czytelna dla członków zespołu, chyba że sama strona ma `visibility='project'`. Niespójność modelu (team-notebook ≠ team-pages), ale po stronie bezpieczeństwa to fail-closed (nadmiernie restrykcyjne) — bez wycieku. P3 (spójność produktu).

## SEC-3 — Załączniki — CZYSTE (z drobną asymetrią)
`notebookAttachmentService.ts`:
- **Upload guard:** memoryStorage, limit 25MB + `files:10` (multer `:174-177`), BLOCKED_EXTENSIONS (exe/bat/sh/ps1/…) `:19-34`, `validateNotebookAttachment` `:270-302`, path-traversal guard (`resolveAttachmentAbsolutePath` odrzuca absolute/`..`) `:84-89`. Storage org+page-scoped (`uploads/notebook-attachments/{org}/{page}/...`) `:338-345`. OK.
- POST attach `:879-926`: org-match + **owner-only** `:900-903`. OK.
- DELETE attach `:1002-1023`: org-match + **owner-only**. OK.
- **GET download** `:970-1000`: org-match + `canAccessNotebookRow` (czyli owner LUB team/project) — **świadomie szerszy** (czytelnicy mogą pobrać), spójne z dostępem do strony. Brak wycieku cudzego załącznika po id (resolve sprawdza, że attachmentId należy do tej strony) `:992`. OK.
- source-file download `:839-877`: org + `canAccessNotebookRow` + tylko gdy captureSource='upload'. OK.

## SEC-4 — Capture API (web-clip/email/import — spoza huba) — CZYSTE
`server/src/routes/notebook.routes.ts` (deprecated `/api/notebook`):
- `router.use(verifyToken)` `:20` — **wszystkie capture endpointy wymagają auth**. Brak anonimowego ingest.
- org/user z `requireUser` `:22-34`: bierze `req.user.organizationId` lub fallback `x-organization-id`/`?organizationId`. **Fallback bezpieczny:** `auth.middleware.ts:620-636` waliduje `x-organization-id` względem ACTIVE `organization_members` ZANIM ustawi `req.organizationId`; user NIE może wstrzyknąć org, do której nie należy. **Brak cross-org capture-injection.**
- `notebookService.capture` `:144-215` zapisuje z przekazanym org/user i **wymusza `visibility='private'`** w ingest `:262`. Nawet jeśli capture poda obcy `projectId`, strona jest private (projectId nie nadaje cross-project read). OK.
- Schematy zod (web-clip url+content≤500k, email, import) `:45-155` — walidacja wejścia. OK.
- **Brak osobnego inbound webhooka email/clip bez auth** — wszystko za JWT. Nie ma drogi „wstrzyknąć capture do cudzego notatnika".

## SEC-5 — AI inline (extract-actions/suggest-topics/convert) — CZYSTE
- extract-actions `:1388-1475`: org-match + **owner-only** `:1403-1406`. suggest-topics `:1481-1604`: owner-only `:1496-1499`. classify `:1610-1692`: `WHERE owner_user_id=? AND organization_id=?` `:1623`. OK.
- **Prompt injection:** treść strony (`content_text.slice(0,3000)`) trafia do promptu LLM `:1445`; output parsowany jako JSON array i używany tylko do propozycji tasków, które user zatwierdza. Brak auto-egzekucji, brak eskalacji uprawnień. Bounded — P3.
- **Konwersja** `notebookConversionService.ts:172-187`: org-match + **owner-only** przed create task/decision/initiative; nowe encje zapisywane z `organization_id=orgId` + `created_by=userId`. Org-scoped. OK.

## SEC-6 — Sekrety/PII w logach — CZYSTE
Logi BE używają tylko id/liczników (`note_id`, `linkedCount`, `attachmentCount` w handoff `:419-424`; `pageId` w upload-warn). **Treść notatki nie jest logowana.** FE: `console.error` loguje obiekt błędu, nie treść. PII-safe.

---

## SEC FINDINGS — luki (severity)

### [P2] USER-SCOPE leak — v8 search ujawnia notatki `visibility='project'` bez sprawdzenia członkostwa w projekcie
`server/src/services/v8/notebookSearchService.ts:188-196` `buildVisibilityWhere`:
```
(lower(np.visibility) = 'private' AND np.owner_user_id = ?)
OR (lower(np.visibility) = 'project' AND np.project_id IS NOT NULL)
```
Dla gałęzi `project` **NIE ma warunku `project_members`** — dowolny user tej samej org dostaje w wynikach `/api/v8/notebook/search` każdą notatkę z visibility='project' (tytuł, snippet, tagi), nawet jeśli NIE jest członkiem tego projektu. Live route (`canAccessNotebookRow` `:112-116`) dla tej samej notatki sprawdza `project_members` — **niespójność, search jest luźniejszy**. Granica: w obrębie org (brak cross-org). Wektor: wyciek treści/tytułów projektowych notatek między zespołami w tej samej organizacji.
Dowód: `notebookSearchService.ts:192` vs `my-work/notebook.routes.ts:110-116`.
Fix: dodać do gałęzi 'project' `AND EXISTS (SELECT 1 FROM project_members WHERE project_id=np.project_id AND user_id=?)`.

### [P2] USER-SCOPE leak — v8 handoff (radar/inicjatywy/teresa) buduje payload z PEŁNĄ treścią cudzej prywatnej notatki (org-scope tylko, brak owner-check)
`server/src/routes/v8/notebook.routes.ts:119-174` — endpointy `/handoff/radar|inicjatywy|teresa` biorą `noteId` z body, wołają `notebookHandoffService.build*Handoff(noteId, organizationId, ...)`. Serwis `notebookHandoffService.ts:322` ładuje wiersz `WHERE id=? AND organization_id=?` — **tylko org, BEZ owner/visibility/project check**. `buildSummaryLines` `:177-194` zwraca do 5 akapitów `content_text` + tagi + załączniki + linked_artifacts.
Skutek: dowolny zalogowany user org może podać `noteId` cudzej **prywatnej** notatki i otrzymać 201 z jej streszczeniem/treścią (i download_ref do załączników). Cross-user wyciek treści w obrębie org.
Dowód: `v8/notebook.routes.ts:129-133` (brak userId-check) + `notebookHandoffService.ts:311-325,177-194`.
Fix: w handoff weryfikować dostęp jak `canAccessNotebookRow` (owner / project_members / team), nie sam org.

### [P3] v8 `/handoff/validate` — brak jakiejkolwiek autoryzacji obiektu
`v8/notebook.routes.ts:176-192` waliduje tylko kształt payloadu z body (nie czyta DB). Niski impact (czysta walidacja struktury), ale brak org/owner — ujęte dla kompletności. P3.

### [P3] Spójność team-notebook vs page-visibility (SEC-2 uwaga) — fail-closed, nie wyciek. P3.

### [P3] Korupcja tokenów (rose/blue/emerald/amber hardkody) — AIChatInlinePanel + NotebookContent. P3.

### [P3] Mikro-braki i18n — `NotebookContent.tsx:903,912` EN-only toasty. P3.

### [P3] Prompt-injection przez treść notatki w extract-actions/suggest-topics — bounded (output=propozycje za zgodą usera, org-scoped). P3.

---

## Podsumowanie
- **§27 L1 biblioteka:** wzorcowa (A-tier), jedyny dług = Archive bez backendu (slot zaślepiony).
- **Hub/i18n:** zgodne; i18n M19/M21-style, 0× EN-only w ścieżkach głównych, 2 mikro-toasty EN.
- **Korupcja rose:** POTWIERDZONA, 18+ hardkodów w AIChatInlinePanel + dalsze w NotebookContent (P3, kosmetyka/tokenizacja).
- **Core IDOR (live route):** CZYSTE — M04 dołącza do listy czystych modułów.
- **NAJWAŻNIEJSZE (Capture API):** CZYSTE — wszystkie connectory za JWT, org zwalidowany w middleware, visibility wymuszone private. Brak injection do cudzego notatnika.
- **Dwie realne luki user-scope w warstwie v8** (search visibility='project' bez project_members [P2]; handoff bez owner-check ujawnia treść prywatnej notatki [P2]). Oba bounded do org (nie cross-org), oba do naprawy.
