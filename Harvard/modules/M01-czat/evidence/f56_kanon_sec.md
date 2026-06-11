# M01 CZAT — Fazy 5 (Kanony) + 6 (Bezpieczeństwo) — Raport KANON+SEC

**Moduł:** M01 Czat (AI_CHAT) — Protokół Audytu V1
**Branch:** `feat/deliverables-light` · **Data:** 2026-06-11 · **Tryb:** READ-ONLY
**Zakres wejściowy:** `Harvard/podzial/inventory/INV_A_czat_canvas.md` (sekcja MODUŁ: CZAT)
**Checklisty źródłowe:** `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` §27 (A–S), `docs/ui-standards/`, `Harvard/protokol/MODULE_AUDIT_PROTOCOL_V1.md`

> Uwaga zakresowa: ten raport pokrywa Czat (UnifiedChatPanel + sidebar historii + endpointy `conversations`/`ai`/`share`). Canvas (split-view) ma osobny inwentarz i jest tu dotknięty tylko przez współdzielony zasób publiczny `/public/artifacts/:token`.

---

## SEKCJA A — KANONY I STANDARDY GRAFICZNE (Faza 5)

### A.0 Czy Czat podlega §27 (tabele list + preview)?

**Werdykt: NIE — Czat nie ma klasycznych tabel listowych w rozumieniu §1.1 kanonu.**

Definicja przedmiotu kanonu (§1.1, `TABLE_AND_PREVIEW_CANON.md:45`): „Tabela listowa = przeglądalna kolekcja encji org‑scoped z akcjami (select, filter, sort, resize, row actions, preview)". Reguła rozstrzygająca (§1.2, `:55`): jeśli to nawigacja / drzewo / treść artefaktu → poza kanonem.

Główna powierzchnia „listowa" Czatu to **sidebar historii rozmów** (`src/components/AIChat/ChatHistorySidebar.tsx`), który jest:
- **pływającym overlayem nawigacyjnym** (docstring `ChatHistorySidebar.tsx:1-19`: „FLOATING overlay sidebar … When closed, completely disappears except for a floating toggle button"),
- **drzewem folderów + grupowaniem czasowym rozmów** (`ChatHistorySidebar.tsx:7-18`, `groupConversations` z `useConversationStore`), nie tabelą kolumnową,
- bez maszynerii tabeli: brak `TableWithPreviewLayout`/`FilterableTable`, brak resize kolumn, sort kolumn, sticky header, popovera widoczności kolumn, paska bulk (`grep` — komponent renderuje `ConversationList`/`ConversationItem`/`FolderSection`, nie renderer tabeli).

Wobec tego **§27 A0–S NIE ma zastosowania** do sidebara historii (analogicznie do wyłączenia §1.2 dla nawigacji i rendererów artefaktów AI). Zapisuję to jawnie zgodnie z poleceniem fazy. Tabela powierzchnia × A–S byłaby sztuczna i wprowadzałaby fałszywe FAIL-e (np. „brak filtrów kolumn") na surface, który z definicji nie jest tabelą encji.

| Powierzchnia | Typ | §27 dotyczy? | Uzasadnienie (plik:linia) |
|---|---|---|---|
| Sidebar historii rozmów | overlay nawigacyjny + drzewo folderów | **NIE** | `ChatHistorySidebar.tsx:1-19, 50-56`; §1.2 reguła rozstrzygająca |
| Mini-historia w ChatMenu | lista skrótów | **NIE** | `ChatMenu.tsx` — popover, nie tabela encji |
| Transkrypt wiadomości | strumień bąbelków | **NIE** | renderer treści, §1.2 |
| Dock sesji badawczych | UKRYTE (internal) | **N/A** | `INV` poz. 39 — rola+domena dbr77 |

### A.1 Wzorzec shellowy (split vs full)

Czat ma **własny shell `UnifiedChatPanel`** (5897 LOC, `src/components/AIChat/UnifiedChatPanel.tsx`), montowany w dwóch trybach:
- `mode="full"` na `/chat` (`AppRoutes.tsx`),
- `mode="split"` jako lewy panel na każdym module (`MainLayout.tsx:356`).

To **nie jest** ModuleHub ani MELS — i słusznie (Czat to konwersacyjny shell, nie indeks encji). Nie podlega więc audytowi „wzorca hubowego". Spójność split↔full opiera się na jednym komponencie z parametrem `mode`, co jest właściwym SSOT (jeden renderer, brak rozjazdu duplikatów). Pełna weryfikacja parytetu wizualnego split vs full = **Faza 4 (żywa)**, poza zakresem KANON+SEC.

### A.2 Stany standardowe (empty / loading / error)

| Stan | Wzorzec aplikacji użyty? | Dowód |
|---|---|---|
| Empty (brak rozmów) | TAK — `EmptyState` (komponent współdzielony) | `ChatHistorySidebar.tsx:50` import `EmptyState` z `../ui/composed/EmptyState` |
| Loading | TAK — `LoadingState` (prymityw) | `ChatHistorySidebar.tsx:51` import `LoadingState` z `../ui/primitives` |
| Error / przerwany stream | Częściowo — partial-recovery streamingu jest (`ai.routes.ts:5341` `/stream/partial/:sessionId`); UI błędu strumienia = do potwierdzenia żywo (Faza 4) | `INV` poz. 22 (partial recovery) |

Sidebar używa współdzielonych komponentów stanów (nie gołego „No data") — zgodne z wzorcem. **Odstępstwo: brak** na poziomie kodu; potwierdzenie wizualne błędu strumienia odłożone do Fazy 4.

### A.3 i18n PL/EN

- **Pokrycie:** 94 z 157 plików `.tsx` w `src/components/AIChat/` używa `useTranslation` (`grep -rln useTranslation`). Kluczowe surface'y pokryte: `UnifiedChatPanel.tsx` (278 wywołań `t(`), `ConversationActions.tsx` (29), `ChatMenu.tsx` (18), `ChatHistorySidebar.tsx` (wzorzec `t('aiChat.*', 'fallback')`).
- **Wzorzec:** `t('klucz', 'EN fallback')` — klucze PL zweryfikowane jako istniejące w `public/locales/pl/translation.json` (sprawdzone: `aiChat.folderName`, `aiChat.openFolder`, `aiChat.actions.rename`, `aiChat.members.manage`, `aiChat.moveToFolderShort`, `aiChat.noTargetFolders`, `common.add`, `common.delete` — wszystkie PL=True i EN=True). Blok `aiChat` obecny w obu lokalizacjach.
- **Korupcja codemod „rose"/„roseuction":** NIE wykryto. Trafienia `rose` w `InputCharCounter.tsx:61-87`, `InputSoftLimitToast.tsx`, `EnhancedChatInput.tsx:1224` to **legalny ton koloru Tailwind `rose`** dla licznika znaków (slate→amber→rose), nie zepsuty string. Brak ani jednego `roseuction`.

**Odstępstwo i18n:** brak P0/P1 na zbadanej próbce. P2/nice-to-have: 63 pliki bez `useTranslation` — część to czysta logika/hooki bez UI-stringów; pełny audyt hardcoded-stringów na 157 plikach = backlog (Faza 8).

### A.4 Lista odstępstw KANONÓW z priorytetem

| # | Odstępstwo | Priorytet | Dowód |
|---|---|---|---|
| K-1 | Brak — sidebar historii poprawnie poza §27 (nawigacja, nie tabela encji) | — (info) | `ChatHistorySidebar.tsx:1-19`; §1.2 |
| K-2 | UI błędu przerwanego strumienia niezweryfikowany na poziomie wizualnym (kod partial-recovery istnieje) | P2 | `ai.routes.ts:5341`; do Fazy 4 |
| K-3 | Pełny audyt hardcoded-stringów na 63 plikach bez `useTranslation` nie wykonany (próbka czysta) | P2 | `grep useTranslation` 94/157 |

**Brak odstępstw P0/P1 w warstwie kanonów graficznych.** Czat nie produkuje kart Insight/Initiative (CARD_CONTENT_FORMULA N/A) i nie podlega ModuleHub/§27.

---

## SEKCJA B — BEZPIECZEŃSTWO I DOSTĘP (Faza 6)

### B.1 Trzy warstwy gatingu (nawigacja / route / API)

Czat = **CORE (otwarty)** — brak beta-locka, dostępny dla każdego zalogowanego.

| Warstwa | Mechanizm | Stan | Dowód |
|---|---|---|---|
| Nawigacja (sidebar) | brak beta-badge/locka — Czat zawsze widoczny | OK (zamierzone) | `INV` poz. „CORE (otwarty)"; brak wpisu w `betaAccess.ts` |
| Route (`/chat`, `/chat/:id`) | w drzewie zalogowanym; redirect landing → AI_CHAT | OK | `AppRoutes.tsx:535,581,631,648-650` |
| Route publiczny (`/share/:token`, `/public/artifacts/:token`) | TOP-LEVEL, **poza** ProtectedRoute (zamierzone, read-only) | OK | `App.tsx:449-478` (oba poza layoutem chronionym) |
| API (`/api/conversations`) | `gatewayVerifyToken` + `orgMembershipGuard` + per-route `verifyToken` | OK (podwójny) | `Gateway.ts:474` |
| API (`/api/ai`) | `verifyToken` per-route | OK | `Gateway.ts:397`; każdy handler ma `verifyToken` |

**Werdykt:** brak dziury między warstwami dla Czatu. Zasoby publiczne są jawnie i intencjonalnie poza auth (read-only viewery), z własnym tokenowym gatingiem (sekcja B.3). **Brak findingu P0/P1 w gatingu nawigacja/route.**

### B.2 Org-scope na endpointach (lista + wynik)

#### `conversations.routes.ts` (mount `/api/conversations`, `Gateway.ts:474`)

SSOT scopingu: helper **`findAccessibleConversation(id, userId, organizationId)`** (`conversations.routes.ts:92-130`) — sprawdza personal ownership (`user_id` + `organization_id` OR NULL) ALBO team-membership (`chat_projects.scope='team' AND organization_id=?`). Komentarz `:97-103` dokumentuje fix feedbacku 79802ad8 (resume rozmowy po przełączeniu org).

| Endpoint | Org/user scope? | Dowód |
|---|---|---|
| GET `/` (lista) | TAK — `user_id` + `(organization_id=? OR NULL)` + team perm P34 | `:256-298, 302` |
| POST `/` (create) | TAK — insert z `user_id`/`org`; raw SELECT po create = własny wiersz | `:473` |
| GET `/:id` | TAK — `findAccessibleConversation` | `:496` |
| PATCH `/:id` | TAK | `:580` |
| DELETE `/:id` | TAK | `:688+` (helper) |
| POST `/:id/messages` | TAK | `:805` |
| POST `/:id/messages/:mid/save-to-context` | TAK | `:981` |
| POST `/:id/truncate` | TAK | `:1071` |
| POST `/:id/title/generate` | TAK | `:1195` |
| POST `/bulk` | TAK — `WHERE id IN (...) AND user_id=?` | `:1325` |
| POST `/:id/summarize` | TAK | `:1513` |
| GET `/search` | TAK — `WHERE (c.user_id=? OR team org)` | `:1668-1672` |
| attachments (POST/GET/DELETE `/:id/messages/:mid/attachments[/:aid]`) | TAK — `message_id`+`conversation_id`+helper | `:1829,1919` (+ helper na :id) |
| GET/POST `/:id/sessions` | TAK | `:1942,1984` |
| GET `/:id/export` | TAK | `:2047` |
| POST `/auto-archive` | TAK — `WHERE user_id=?` | `:2174` |
| POST `/:id/branch` | TAK — `WHERE id=? AND (user_id=? OR org=?)` | `:2232` |

**Wynik conversations: 21 endpointów sprawdzonych, 21 z org/user-scope, 0 dziur.** Router czysty.

#### `ai.routes.ts` (mount `/api/ai`, `Gateway.ts:397`) — surface'y dotykające danych org

Plik ma ~110 endpointów; zaudytowano endpointy operujące na danych org-scoped (pamięć AI, proposals, conversation-scoped). Endpointy stateless (generacja tekstu, refine, narrate, monte-carlo itp.) nie czytają cudzych danych i są pominięte jako N/A dla org-scope.

| Endpoint | Org-scope? | Dowód / werdykt |
|---|---|---|
| GET `/memory/org` | TAK — `req.organizationId!` (server-derived) | `ai.routes.ts:5839` BEZPIECZNE |
| PATCH `/memory/org` | TAK — `req.organizationId!` + `can('edit_organization_settings')` | `:5854,5860` BEZPIECZNE |
| DELETE `/memory/org` | TAK — `req.organizationId!` + admin cap | `:5872+` BEZPIECZNE |
| GET `/memory/user` | TAK — `req.userId!` | `:5789` BEZPIECZNE |
| PATCH `/memory/user` | TAK — `req.userId!` | `:5804` BEZPIECZNE |
| **GET `/memory/project/:projectId`** | **NIE** — `projectId` z URL bez weryfikacji org | `:5744-5751` → **F-1 (P1)** |
| **POST `/memory/project/:projectId/decision`** | **NIE** — zapis do cudzego projektu możliwy | `:5758-5780` → **F-1 (P1)** |
| **DELETE `/memory/project/:projectId`** | **NIE** — cap sprawdzany w kontekście CALLERA, nie własności projektu | `:5812-5829` → **F-2 (P1)** |
| GET `/conversations/:id/proposals` | TAK — przekazuje `req.organizationId` do serwisu | `:6138-6141` (zależne od serwisu — patrz nota) |

**Wynik ai.routes (org-scoped surface): 9 endpointów sprawdzonych, 6 z org-scope, 3 BEZ org-scope (memory/project/*).**

### B.3 Zasoby publiczne (share / public artifacts)

#### `/share/:token` — publiczny viewer rozmowy (`share.routes.ts`, mount `/api`, `Gateway.ts:480`)

| Aspekt | Stan | Dowód |
|---|---|---|
| Tworzenie share (POST `/conversations/:id/share`) | org-scoped + RBAC: team-conv wymaga `create_share_link` (admin), fail-closed | `share.routes.ts:242-277` |
| Token entropy | 16 bajtów losowych base64url (128-bit) — brak enumeracji | `:84-86` |
| Revoke (DELETE) | `is_active=0`; viewer zwraca **410** „Share has been revoked" | `:648-651, 458-460` |
| Expiry | 410 gdy `expires_at < now` | `:462-464` |
| Hasło | scrypt+salt (POST `/share/:token/unlock`), cookie podpisany HMAC, rate-limit per (token,IP), legacy SHA-256 auto-upgrade | `:133-156, 391-441, 466-499` |
| Over-exposure | viewer zwraca tylko `role/content/message_type/metadata/created_at`; anonymize ukrywa autora | `:509-553` |

**Finding F-3 (P2):** publiczny viewer zwraca **`metadata` wiadomości verbatim** (`share.routes.ts:541` `JSON.parse(m.metadata)`). `metadata` może zawierać pola wewnętrzne (tool_calls, source UUID-y, kontekst org, model_used) — potencjalny wyciek danych ponad potrzebę do anonimowego odbiorcy. Public-artifacts viewer (niżej) świadomie NIE zwraca provenance; share-conversation jest niespójny z tym wzorcem.

**Finding F-4 (P1, korelacja bug+bezpieczeństwo):** PATCH `/conversations/:id/share` przy ustawianiu hasła wywołuje **`hashPasscode(...)` (`share.routes.ts:592`)** — funkcja **nigdzie nie zdefiniowana ani nie importowana** w pliku (zdefiniowane są tylko `scryptHash`/`scryptVerify`/`verifyPasscode`). To `ReferenceError`/błąd kompilacji: edycja share z nowym hasłem przez PATCH **wyłoży się runtime**, a gdyby istniała (legacy), użyłaby słabszego, niesalt­owanego hash niż POST (`scryptHash`). Niespójność z fixem P0-2.

#### `/public/artifacts/:token` — publiczny viewer artefaktu Canvas (`public-artifacts.routes.ts`)

| Aspekt | Stan | Dowód |
|---|---|---|
| Token shape | strict `^[0-9a-f]{32}$` PRZED dotknięciem DB — blokuje wildcard injection do LIKE | `public-artifacts.routes.ts:50,117` |
| Rate-limit | 30 req/IP/min | `:41-47` |
| Revoke | usunięcie obiektu `share` z provenance → 404 (nieodróżnialne od nieznanego) | `:141-145` |
| Expiry | 410 `CANVAS_SHARE_EXPIRED` | `:148-153` |
| Over-exposure | payload sanitarny: tylko `title/kind/contentMd/updatedAt/orgBranding` — BEZ ID/autora/org/provenance | `:157-164` |

**Werdykt:** `/public/artifacts/:token` to **wzorzec referencyjny** — pełna higiena. `/share/:token` jest słabszy (F-3, F-4).

### B.4 WS / realtime

Czat używa **SSE (Server-Sent Events) przez `POST /api/ai/chat/stream`** (`ai.routes.ts:1423`), nie WebSocket — strumień idzie pod `verifyToken` jak każdy POST, autoryzacja per-request. `useChatProjectsRealtime.ts` (folder-realtime) = warstwa store; jeśli korzysta z kanału WS, autoryzacja zasobu = do potwierdzenia (poza tym audytem SSE jest dominującą ścieżką i jest auth'owany). **Brak findingu P0/P1** dla realtime w Czacie (brak `/ws/collab`-stylowego upgrade'u bez auth zasobu na ścieżce czatu).

### B.5 Capabilities egzekwowane serwerowo

- Share team-conv: `checkChatPermission(... 'create_share_link')` serwerowo, fail-closed (`share.routes.ts:258-276`).
- Memory org write/delete: `req.can('edit_organization_settings')` serwerowo (`ai.routes.ts:5854,5872`).
- Read rozmów zespołowych: `checkChatPermission(... 'read')` (`conversations.routes.ts:257`).

Egzekucja serwerowa OBECNA. **Ale** (F-2): DELETE `/memory/project/:projectId` sprawdza `edit_project_settings` w kontekście CALLERA, nie weryfikując że projekt należy do org callera — capability jest egzekwowana, lecz na niewłaściwym zasobie.

### B.6 Sekrety / PII w logach

- 0 `console.log` w `ai.routes.ts`.
- Logi to `logger.warn/debug` z `err?.message` — brak logowania pełnej treści wiadomości, kluczy API, haseł.
- Jedno trafienie: `ai.routes.ts:3390` loguje `query` (string zapytania web-search) na poziomie `debug`. Niskie ryzyko (derived query, debug-level). **F-5 (P3).**

### B.7 Findingi bezpieczeństwa — podsumowanie z severity

| ID | Severity | Finding | Dowód | Rekomendacja |
|---|---|---|---|---|
| **F-1** | **P1** | Cross-org IDOR READ/WRITE pamięci projektu: GET/POST `/memory/project/:projectId` przyjmują `projectId` z URL bez sprawdzenia org. `getProjectMemory` = `SELECT * FROM ai_project_memory WHERE project_id = ?` (brak `organization_id`). Użytkownik org A znający UUID projektu org B czyta jego decyzje/rekomendacje AI i może dopisać decyzję. | `ai.routes.ts:5744-5780`; `services/aiMemoryManager.ts:244-294` (getProjectMemory bez org) | Dodać weryfikację `project.organization_id == req.organizationId` przed wywołaniem managera; lub przekazać `organizationId` do query. |
| **F-2** | **P1** | Cross-org IDOR DELETE: DELETE `/memory/project/:projectId` → `clearProjectMemory` = `DELETE FROM ai_project_memory WHERE project_id = ?` (brak org). Cap `edit_project_settings` egzekwowana w kontekście callera, nie własności projektu → destrukcja danych cudzej org po UUID. | `ai.routes.ts:5812-5829`; `services/aiMemoryManager.ts:623-626` | Jak F-1 + scope DELETE po `organization_id`. |
| **F-4** | **P1** | PATCH share hasła wywołuje niezdefiniowane `hashPasscode` (`share.routes.ts:592`) — runtime ReferenceError / niespójność z `scryptHash` POST. Aktualizacja hasła share = crash. | `share.routes.ts:592` vs `:133` (tylko scryptHash zdefiniowany) | Zamienić na `await scryptHash(String(passcode))`. |
| **F-3** | **P2** | Public viewer rozmowy zwraca `metadata` wiadomości verbatim — ryzyko wycieku pól wewnętrznych (tool_calls/source UUID/model) anonimowemu odbiorcy. | `share.routes.ts:541` | Whitelist pól metadata dla widoku publicznego (wzorzec public-artifacts). |
| **F-5** | **P3** | Debug-log query web-search (treść derived) | `ai.routes.ts:3390` | Zredukować/zhashować w debug. |
| (nota infra) | P3 | `aiMemoryManager.ts:644` używa SQLite-izmu `datetime('now', ...)` — pada na Postgresie (cleanup pamięci). Poza zakresem Fazy 6, do Fazy 3. | `services/aiMemoryManager.ts:644` | Przepisać na PG-compatible. |

> Hard-cap rubryki (Faza 7): F-1/F-2 = **cross-org leak + brak właściwego scope na zapisie/odczycie** → wskazany cap ≤50 dla wymiaru F i finding klasy P0-adjacent dla całości, choć projectId jest UUID (nie trywialnie enumerowalny), co łagodzi praktyczną eksploatowalność. Synteza/ocena = Claude main (Faza 7).

---

## Podsumowanie werdyktów

- **KANONY:** Czat NIE podlega §27 (brak tabel encji; sidebar = nawigacja, §1.2). Shell `UnifiedChatPanel` (split/full z jednego SSOT) — nie ModuleHub, poprawnie. Stany empty/loading przez współdzielone komponenty. i18n PL/EN solidne, klucze PL istnieją, **brak korupcji „roseuction"**. Odstępstwa tylko P2 (UI błędu strumienia + pełny audyt hardcoded — do Faz 4/8). **Zero P0/P1 kanonów.**
- **BEZPIECZEŃSTWO:** Trzy warstwy gatingu spójne. `conversations.routes.ts` = 21/21 endpointów org-scoped (czysty). `ai.routes.ts` = **3 endpointy `/memory/project/*` bez org-scope (F-1, F-2 — cross-org IDOR P1)**. Zasoby publiczne: `/public/artifacts/:token` wzorcowy; `/share/:token` revoke/expiry/hasło OK, ale F-3 (metadata leak P2) i **F-4 (PATCH hasła crash — niezdefiniowane `hashPasscode`, P1)**. Logi czyste (F-5 P3).
