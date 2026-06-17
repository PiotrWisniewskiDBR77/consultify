# TESTY — M23 Organizacja (workspace organizacji)

> **Moduł:** M23 Organizacja (`/organization/*`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`, inwentarz `Harvard/podzial/inventory/INV_F_ai-os_organizacja.md`
> **Zakres tej paczki:** pełen workspace organizacji — 14 pozycji sidebara: Profil firmy, Goals, Challenges, Strategy, Megatrends, Knowledge Graph, baner Teresy (ORGANIZATION) + Members, Competencies, Billing, Limits, Domains, Branding, OrgContext switch (ADMINISTRATION).
> **Cel:** dogłębne sprawdzenie E2E każdej funkcji, ze szczególnym uwzględnieniem czterech znanych pułapek architektonicznych: (1) Goals/Challenges/Strategy = zustand store z `useOrgContextSync` (sync backend), (2) podwójna implementacja sekcji admin (redirect vs lokalny panel), (3) Billing/Limits CTA = wyłącznie `trackFunnelEvent` (ślepe), (4) route `/organization/*` = `requireAuth` bez `requiredRole` (brak role-gatingu na poziomie routera).
> **Bazuje na:** `Harvard/wdrozenie-100/M23-organizacja.md` · `Harvard/modules/M23-organizacja/KARTA_AUDYTU.md` · kod `src/views/OrganizationView.tsx`, `src/hooks/useOrgContextSync.ts`, `src/store/useContextBuilderStore.ts`, `src/components/Organization/OrganizationAdminPanel.tsx`, `server/src/routes/organization-context-store.routes.ts`, `server/src/routes/competency.routes.ts`, `server/src/routes/organization/organization-data.routes.ts`
> **Legenda:** `[MANUAL]` = wymaga ręcznej weryfikacji (incognito / drag / DevTools); `[FLAG]` = zależne od roli/capability; `[DB]` = dowód obejmuje wiersz w bazie; `[SEC]` = test bezpieczeństwa — wykonywać ostrożnie (read-only curl na staging/dev).
> **Data:** 2026-06-16

---

## 0. Kontekst architektoniczny (przeczytaj przed testami)

### 0.1 Mapa komponentów i plików

| Sekcja | Komponent/plik | Stan/store | Uwagi |
|---|---|---|---|
| Router | `src/routes/AppRoutes.tsx:2213-2226` | — | `ProtectedRoute requireAuth={true}` — BRAK `requiredRole` |
| Główny widok | `src/views/OrganizationView.tsx` | `useAppStore`, `useOrgContextSync` | Obsługuje redirect admin + renderuje zawartość |
| Sidebar | `src/components/Organization/OrganizationSidebar.tsx` | — | Widoczny dla admin/owner/superadmin w sidebarze głównym |
| Profil firmy | `src/views/ContextBuilder/modules/OrganizationProfileModule.tsx` (~1592 l.) | backend `/api/organization-profiles/:orgId` | GET/PUT, org-scoped + role-gated PUT |
| Goals | `src/views/ContextBuilder/modules/GoalsExpectationsModule.tsx` | **zustand `useContextBuilderStore`** (localStorage + sync W11) | Sync przez `useOrgContextSync` → `/api/organization-context-store` |
| Challenges | `src/views/ContextBuilder/modules/ChallengeMapModule.tsx` | **zustand `useContextBuilderStore`** (localStorage + sync W11) | j.w. |
| Strategy | `src/views/ContextBuilder/modules/StrategicSynthesisModule.tsx` | **zustand `useContextBuilderStore`** (localStorage + sync W11) | j.w. |
| Megatrends | `OrganizationView.tsx:136` | — | Natychmiastowy redirect → `/discovery-tools/...` |
| Knowledge Graph | `src/components/Organization/KnowledgeGraphExplorer.tsx` | `/api/knowledge-graph` | React Flow + dagre |
| Baner Teresy | `src/components/Organization/OrgContextSummaryBanner.tsx` | Socket.IO `/org-context` | Rebuild admin-only |
| Admin-sekcje | `src/components/Organization/OrganizationAdminPanel.tsx` (~932 l.) | backend per-sekcja | Renderowany TYLKO gdy URL bezpośredni i `isOrgAdmin===true` |
| Redirect admin (klik) | `OrganizationView.tsx:38-45,159-165` | `ADMIN_REDIRECTS` | members→`/admin/people`, competencies/domains/branding→`/admin/operations`, billing/limits→`/admin/billing` |
| Competencies backend | `server/src/routes/competency.routes.ts` | `verifyToken` + `requireRole('admin','owner')` na write | Naprawione w `fd8707c5b2` |
| Org-data export | `server/src/routes/organization/organization-data.routes.ts:212,351` | `requireRole('admin','owner')` | Naprawione w `fd8707c5b2` |
| Context store backend | `server/src/routes/organization-context-store.routes.ts` | `verifyToken`, `organization_context_store` tabela | W11 — dwie-drogi sync |

### 0.2 Architektura Goals/Challenges/Strategy (KRYTYCZNE)

**W11 (commit `d013ab7c4c`) zaimplementował backend store** — dane nie są już wyłącznie localStorage-only. Dokładny flow:

1. `OrganizationView` montuje `useOrgContextSync(isAuthenticated)` — wywołuje `GET /api/organization-context-store` i hydratuje zustand store.
2. Moduły (Goals, Challenges, Strategy) czytają/zapisują do `useContextBuilderStore` (zustand persist z localStorage jako cache offline).
3. `useOrgContextSync` subskrybuje zmiany store → debounce 1500 ms → `PUT /api/organization-context-store` → tabela `organization_context_store` w DB.
4. localStorage klucz: **`consultify-context-builder`** (typ JSON, pola: `goals`, `challenges`, `synthesis`, `companyProfile`).

**Luka pierwotna (`fasada localStorage`) jest NAPRAWIONA** — ale sync jest jednostronny (load on mount + debounce save). Teraz testy weryfikują poprawność tego przepływu.

**Klucze localStorage do sprawdzenia w DevTools → Application → Local Storage:**
- Klucz: `consultify-context-builder`
- Wartość: JSON z polami `state.goals`, `state.challenges`, `state.synthesis`

### 0.3 Podwójna implementacja admin

- **Ścieżka kliknięcia (sidebar):** `handleSectionChange` → `ADMIN_REDIRECTS[section]` → `navigate(adminRedirect)` → wychodzi z `/organization/*`, ląduje w `/admin/*` (M24).
- **Ścieżka URL bezpośrednia:** `useEffect` w `OrganizationView` → sprawdza `ADMIN_REDIRECTS[section]` → jeśli match — `navigate(adminRedirect, { replace: true })`. Oznacza to, że **REDIRECT DZIAŁA RÓWNIEŻ PRZY BEZPOŚREDNIM URL** (fixnięto względem karty audytu — zweryfikuj żywo).
- **Fallback (zabezpieczenie FE):** gdy `isOrgAdmin===false` → `renderContent` zwraca `null` dla sekcji admin.

### 0.4 Ślepe CTA (Billing/Limits)

- `OrganizationAdminPanel.tsx:293` — przycisk „Upgrade": `onClick={() => trackFunnelEvent('org_admin_cta_clicked', { action: 'billing_activate' })}` — brak navigacji.
- `OrganizationAdminPanel.tsx:475` — przycisk „View Plans": `onClick={() => trackFunnelEvent('org_admin_cta_clicked', { action: 'limits_view' })}` — brak navigacji.
- **Widoczność Billing CTA:** tylko gdy `isTrialPlan === true` (sprawdź `snapshot?.plan?.type`).
- Decyzja DP-11: Billing = label „zarządzane przez DBR77" — sekcja billing/limits są w M24 Admin, nie M23. Redirect jest na `/admin/billing`.

### 0.5 Brak role-gatingu na routerze

- `AppRoutes.tsx:2216`: `<ProtectedRoute requireAuth={true}>` — jedyny warunek = zalogowanie.
- `AdminView` (M24) `AppRoutes.tsx:2232`: `<ProtectedRoute requiredRole="ADMIN">` — dla porównania.
- Konsekwencja: zwykły member wchodzący na `/organization/*` widzi widok (NIE jest odrzucony przez router). Ochrona zależy od `isOrgAdmin` w `renderContent()` + API-level gates.

### 0.6 Zasada weryfikacji E2E

Każde zapisanie danych MUSI być potwierdzone w Network (DevTools → Network). Sam widok w UI bez żądania sieciowego = potencjalny optimistic update bez persystencji. Po zapisie: reload strony i weryfikacja, że dane przeżyły.

---

## Setup środowiska testowego

```
1. Dev server: frontend :3000, backend :3001
2. Logowanie jako OWNER org DBR77 (pełne uprawnienia admin)
3. Drugie konto: zwykły MEMBER tej samej org (do testów bezpieczeństwa/roli)
4. DevTools otwarte przez całą sesję:
   - Network (filtr: /api/organization → /api/competency → /api/invitations → /api/organization-context-store)
   - Application → Local Storage → http://localhost:3000 (klucz: consultify-context-builder)
   - Console (zero błędów = wymóg)
5. Przeglądarka 1: zalogowany OWNER
6. Przeglądarka 2 / incognito: zalogowany MEMBER (lub niezalogowany)
7. Dane testowe: org z wypełnionym profilem, min. 2 members, plik logo (PNG, JPEG, SVG)
8. curl lub Postman: do testów bezpieczeństwa (sec)
```

---

## §1 — Profil firmy (OrganizationProfileModule)

**Mapowanie:** EPIK 1 (S1), INV poz. 1 · Endpoint: `GET/PUT /api/organization-profiles/:orgId`

### 1.1 Wyświetlenie profilu

- Wejdź na `/organization/profile` jako OWNER.
- **Asercja:** strona ładuje się bez błędów, skeleton wyświetla się podczas ładowania.
- W Network: `GET /api/organization-profiles/<orgId>` → 200, payload zawiera pola profilu (nazwa, opis, branża itp.).
- Dane w UI odpowiadają odpowiedzi API.
- Wskaźnik gotowości profilu (%) wyświetla się i odpowiada faktycznie wypełnionym polom.

### 1.2 Edycja profilu — happy path [DB]

- Zmień nazwę firmy, opis i branżę → klik Save/Zapisz.
- **Asercja:** w Network → `PUT /api/organization-profiles/<orgId>` z nową wartością w body → 200.
- Odśwież stronę (F5) → dane przeżyły (wczytane z backendu).
- W DB: tabela `organization_profiles`, kolumna `name`/`description`/`industry` = nowa wartość. [DB]

### 1.3 Edycja profilu — walidacje

- Spróbuj zapisać pusty wymagany field (jeśli jest walidacja) → komunikat błędu w UI, brak żądania PUT.
- Zbyt długa wartość (np. 1000 znaków w polu nazwy) → odnotuj zachowanie (trim? błąd? save?).

### 1.4 Ekstrakcja AI z dokumentu

- Klik „Wyodrębnij z dokumentu" (Extract from document) → upload PDF/DOCX testowego.
- W Network: `POST /ai/extract-org-context` z form-data → 200.
- **Asercja:** propozycje AI wyświetlają się jako overlay do zatwierdzenia — NIE nadpisują bezpośrednio.
- Zatwierdź propozycje → `PUT /api/organization-profiles` z wypełnionymi polami.
- Odrzuć propozycje → brak zmian w profilu.

### 1.5 Multi-tenant izolacja [SEC]

- Zaloguj się jako OWNER org A, wejdź na `/organization/profile`.
- Spróbuj ręcznie podmienić `orgId` w URL na `orgId` innej org (można sprawdzić w DevTools response dla profilu).
- **Asercja:** `GET /api/organization-profiles/<innaOrgId>` → 403 (`userOrgId!==orgId`, walidowane na `:189`).
- `PUT /api/organization-profiles/<innaOrgId>` → 403. [SEC]

---

## §2 — Goals/Challenges/Strategy (KRYTYCZNE — sync localStorage/backend)

**Mapowanie:** EPIK 2 (S2, L-01 naprawiony W11), INV poz. 2-4
**localStorage klucz:** `consultify-context-builder` · **Backend:** `PUT/GET /api/organization-context-store`

### 2.1 Zapis Goals i weryfikacja Network [MANUAL]

- Wejdź na `/organization/goals`.
- Otwórz DevTools → Network (filtr `organization-context-store`) + Application → Local Storage.
- Wpisz nowy cel w polu (np. „Cel testowy 2026") i potwierdź (button / blur).
- **Odczekaj 1500 ms** (debounce `useOrgContextSync`).
- **Asercja 1 — Network:** pojawia się `PUT /api/organization-context-store` z body `{ goals: {...}, ... }` → 200 `{ ok: true }`.
- **Asercja 2 — localStorage:** w Application → Local Storage, klucz `consultify-context-builder` → wartość JSON zawiera `state.goals` z nowym celem.
- **Asercja 3 — brak GET profilu:** żadne żądanie do `/api/organization-profiles` NIE jest wysyłane przy zapisie Goals (Goals używa osobnego store).

### 2.2 Persistencja Goals po reloadzie [MANUAL]

- Po zapisaniu Goals (§2.1) — przeładuj stronę (F5).
- **Asercja:** w Network pojawia się `GET /api/organization-context-store` → 200 z `goals` zawierającym wcześniej zapisany cel.
- W UI: nowy cel jest widoczny po przeładowaniu.
- **Asercja dodatkowa:** dzięki W11 dane przeżywają zmianę przeglądarki (nie tylko reload).

### 2.3 Zapis Challenges — analogicznie [MANUAL]

- Wejdź na `/organization/challenges`.
- Dodaj nowe wyzwanie → odczekaj debounce → sprawdź Network (`PUT /api/organization-context-store` z `challenges` w body).
- Reload → dane przeżyły. [DB]

### 2.4 Zapis Strategy — analogicznie [MANUAL]

- Wejdź na `/organization/strategy`.
- Uruchom generowanie syntezy strategicznej (AI) → wynik zapisuje się przez `setSynthesis` → debounce → Network.
- **Asercja:** `PUT /api/organization-context-store` z `synthesis` w body → 200.
- Reload → synteza widoczna.

### 2.5 Cross-browser persistencja (kluczowa luka W11) [MANUAL]

- Zaloguj się w przeglądarce A (Chrome) jako OWNER → wejdź na `/organization/goals` → zapisz cel „CEL-CROSSBROWSER".
- Odczekaj debounce → zweryfikuj `PUT /api/organization-context-store` → 200.
- Otwórz przeglądarkę B (Safari lub Firefox) → zaloguj się na to samo konto → wejdź na `/organization/goals`.
- **Asercja:** „CEL-CROSSBROWSER" jest widoczny (pochodzi z backendu, nie z localStorage przeglądarki A).
- Jeśli FAIL → oznacza, że W11 nie działa poprawnie end-to-end.

### 2.6 Clear localStorage → UI reaguje [MANUAL]

- Otwórz Application → Local Storage → skasuj klucz `consultify-context-builder` (Delete).
- Przeładuj stronę.
- **Asercja:** dane nadal widoczne (wczytane z backendu przez `GET /api/organization-context-store` w `useOrgContextSync`).
- Jeśli cele/wyzwania znikają po skasowaniu localStorage → luka: backend sync nie hydratuje poprawnie.

### 2.7 Izolacja per-org (Goals NIE wyciekają między orgs) [MANUAL][FLAG]

- W org A zapisz cel „CEL-ORG-A".
- Przełącz na org B (org-switch) → wejdź na `/organization/goals`.
- **Asercja:** „CEL-ORG-A" NIE jest widoczny (backend store jest per-org, klucz = `organization_id`).
- Klucz zustand localStorage `consultify-context-builder` NIE zawiera `orgId` — po org-switch może pokazywać stare dane z cache do momentu hydratacji z backendu → zanotuj zachowanie.

### 2.8 Teresa AI NIE widzi Goals z localStorage (weryfikacja luki historycznej) [MANUAL]

> **Uwaga:** W11 naprawił backend store. Ten test weryfikuje, czy nowe dane (zapisane przez W11) rzeczywiście zasilają Teresę.

- Zapisz specyficzny cel w Goals (np. „WZROST SPRZEDAŻY O 40% W Q3 2026").
- Poczekaj na `PUT /api/organization-context-store` → 200.
- Wejdź na `/chat` → wyślij wiadomość: „Jakie są główne cele mojej organizacji na Q3?".
- **Asercja sukcesu (W11 działa):** Teresa odpowiada odwołując się do „WZROST SPRZEDAŻY O 40% W Q3 2026".
- **Asercja porażki (W11 nie zasila Teresy):** Teresa odpowiada ogólnikowo, bez znajomości konkretnego celu.
- Odnotuj wynik — to jest kluczowy test wartości biznesowej całego W11.

### 2.9 Goals AI-sugestie (onRefine no-op) [FLAG]

- W sekcji Goals: znajdź przycisk AI-sugestii / „Refine" (jeśli widoczny).
- Klik → **Asercja:** albo brak reakcji (no-op, DP-5 = stub za flagą), albo label „wkrótce".
- W Network: **brak żądania do AI** — sugestie Goals są mockowane.
- Odnotuj jeśli przycisk jest ukryty (DP-5 zakłada flagę `onRefine` → hidden). Jeśli widoczny i nic nie robi → FAIL (misleading UX).

---

## §3 — Megatrends (redirect)

**Mapowanie:** INV poz. 5

### 3.1 Redirect do Discovery Tools

- Wejdź na `/organization/megatrends` (bezpośredni URL).
- **Asercja:** natychmiastowy redirect do `/discovery-tools/strategic-megatrends` (lub analogicznej ścieżki).
- W Network: brak żądania do API dla megatrendów — redirect czysto frontendowy.
- Klik „Megatrends" w sidebarze → ten sam redirect.
- Sprawdź w konsoli: brak błędów React.

---

## §4 — Knowledge Graph

**Mapowanie:** INV poz. 6, S3 · Endpoint: `/api/knowledge-graph`

### 4.1 Ładowanie grafu

- Wejdź na `/organization/knowledge-graph`.
- **Asercja:** `GET /api/knowledge-graph/...` (statystyki / encje) → 200.
- React Flow renderuje węzły i połączenia bez błędów.
- Spinner/skeleton podczas ładowania.

### 4.2 Wyszukiwanie encji

- Wpisz frazę w polu wyszukiwania.
- **Asercja:** `GET /api/knowledge-graph/entities?query=<fraza>&orgId=<id>` → 200, lista encji.
- Wyniki pojawiają się w grafie lub liście.

### 4.3 Tworzenie encji [DB]

- Klik „Dodaj encję" (jeśli dostępny dla admina).
- Wypełnij pola → Zapisz.
- **Asercja:** `POST /api/knowledge-graph/entities` → 201, body z `id`.
- Encja pojawia się w grafie. [DB]

### 4.4 Relacje między encjami [DB]

- Utwórz relację między dwiema istniejącymi encjami.
- **Asercja:** `POST /api/knowledge-graph/relations` → 201.
- Relacja renderuje się jako krawędź w grafie. [DB]

### 4.5 Org-scope izolacji [SEC]

- Sprawdź, że encje i relacje należą do aktualnej org (przez `orgId` z tokenu JWT, nie z query/headerów).
- Jeśli istnieje fallback z `req.organizationId` lub `x-organization-id` header → odnotuj (L-09 risk).

### 4.6 Audit log i proweniencja

- Klik na encję → sprawdź czy dostępna proweniencja (source, confidence, audit trail).

---

## §5 — Baner kontekstu Teresy (OrgContextSummaryBanner)

**Mapowanie:** INV poz. 7

### 5.1 Wyświetlenie banera

- Wejdź na dowolną podstronę `/organization/*`.
- **Asercja:** baner widoczny ze statystykami (liczba claimów, data ostatniego rebuildu).
- Socket.IO: baner aktualizuje się live (sprawdź zakładkę Network → WS frame `org-context`).

### 5.2 Rebuild kontekstu (admin-only) [FLAG]

- Jako OWNER: przycisk „Rebuild" widoczny → klik.
- **Asercja:** request do backendu → przebudowanie kontekstu → baner aktualizuje liczbę claimów.
- Jako MEMBER: przycisk „Rebuild" NIE jest widoczny lub jest disabled.

---

## §6 — Members (zarządzanie członkami)

**Mapowanie:** EPIK 1/Story 1.1, INV poz. 8 · Endpointy: `GET/POST /api/invitations`, `GET /api/organizations/:orgId/members`

### 6.1 Wyświetlenie listy członków

- Klik „Members" w sidebarze — **co się dzieje?** [MANUAL]
  - **Ścieżka A (klik sidebar):** `handleSectionChange('members')` → `navigate(ROUTES.ADMIN.PEOPLE)` → redirect do `/admin/people` (M24 Admin).
  - **Ścieżka B (bezpośredni URL):** wejdź na `/organization/members` — useEffect sprawdza `ADMIN_REDIRECTS['members']` → redirect do `/admin/people`.
  - **Asercja:** obie ścieżki lądują w tym samym miejscu (`/admin/people`).
- Przy redirect sprawdź: URL w pasku = `/admin/people`, NIE `/organization/members`.

### 6.2 Lista members w Admin (weryfikacja panelu M24) [FLAG]

- W `/admin/people`: lista wyświetlona z `GET /api/organizations/:orgId/members` lub `/api/users` → 200.
- Dane: email, imię, rola, data dołączenia.

### 6.3 Zaproszenie nowego użytkownika (z OrganizationAdminPanel) [DB]

> Uwaga: ten panel jest dostępny jako lokalny `OrganizationAdminPanel` przy URL bezpośrednim `/organization/members` — TYLKO jeśli redirect nie działa. Zweryfikuj czy redirect działa (§6.1). Jeśli redirect aktywny, test §6.3 dotyczy panelu Admin M24.

- Wpisz email nowego użytkownika, wybierz rolę (MEMBER lub Admin).
- Klik „Invite/Zaproś".
- **Asercja:** `POST /api/invitations` z `{ email, role }` → 200/201.
- Toast: „Invitation sent" / „Zaproszenie wysłane".
- W tabeli invitations widoczne nowe zaproszenie ze statusem PENDING. [DB]
- Walidacja: pusty email → brak żądania, przycisk disabled. Niepoprawny email → błąd UI.

### 6.4 i18n opcji ról [MANUAL]

- Przełącz język na PL.
- W dropdown ról (MEMBER/Admin): **Asercja:** wartości przetłumaczone (nie gołe `MEMBER`/`Admin` po angielsku).
- Plik `OrganizationAdminPanel.tsx:179` — `<option>` ról — weryfikacja `t()` zamiast `isPl`.
- Jeśli opcje nie są przetłumaczone → FAIL (L-06 otwarta).

---

## §7 — Competencies (katalog kompetencji)

**Mapowanie:** EPIK 1/Story 1.1, INV poz. 9 · Endpointy: `/api/competency/*` · Plik: `src/components/Organization/CompetencyCatalog.tsx`

### 7.1 Dostęp do sekcji — redirect [MANUAL]

- Klik „Competencies" w sidebarze → redirect do `/admin/operations` (M24).
- Bezpośredni URL `/organization/competencies` → `useEffect` w OrganizationView → redirect do `/admin/operations`.
- **Asercja:** nie widać lokalnego `CompetencyCatalog.tsx` przez podwójny panel — renderuje się panel M24.

> Jeśli redirect nie działa (bug L-04 variant) → lokalny `OrganizationAdminPanel` z `CompetencyCatalog.tsx` renderuje się. Kontynuuj test poniżej w tym przypadku.

### 7.2 Wyświetlenie katalog u kompetencji

- Panel kompetencji: lista kategorii + kompetencje + poziomy.
- `GET /api/competency/categories` → 200, lista.
- `GET /api/competency/capabilities` → 200.

### 7.3 Tworzenie kategorii kompetencji [DB][SEC]

- Klik „Dodaj kategorię" → wpisz nazwę → Zapisz.
- **Asercja Network:** `POST /api/competency/categories` z tokenem JWT → 200/201.
- Tabela: nowa kategoria widoczna.
- [DB] W DB: nowy wiersz w tabeli `competency_categories` z poprawnym `org_id`.

### 7.4 Edycja i usuwanie kategorii [DB]

- Edytuj nazwę kategorii → `PUT /api/competency/categories/:id` → 200.
- Usuń kategorię → `DELETE /api/competency/categories/:id` → 200/204.

### 7.5 Seed defaults

- Klik „Seed defaults" (seed domyślnych kompetencji) → `POST /api/competency/seed-defaults` → 200.
- Kategorie domyślne pojawiają się w liście.

### 7.6 Auth: niezalogowany NIE może zapisywać [SEC]

> Test na dev lub staging — nie na prod.

```bash
# Bez tokenu
curl -X POST http://localhost:3001/api/competency/categories \
  -H "Content-Type: application/json" \
  -d '{"name":"hack"}' -v
```
- **Asercja:** 401 Unauthorized (router `verifyToken` na `:10` z `fd8707c5b2`).

### 7.7 Role-gate: MEMBER nie może zapisywać [SEC]

```bash
# Z tokenem MEMBER
curl -X POST http://localhost:3001/api/competency/categories \
  -H "Authorization: Bearer <member-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"hack"}' -v
```
- **Asercja:** 403 Forbidden (`requireRole('admin','owner')` na `:14`).

### 7.8 i18n w CompetencyCatalog [MANUAL]

- Przełącz na PL → `CompetencyCatalog.tsx:51` używa `isPolish` zamiast `t()` → sprawdź czy etykiety są przetłumaczone.
- Jeśli nie → FAIL (L-06 otwarta).

---

## §8 — Billing & Tokens (ślepe CTA)

**Mapowanie:** EPIK 4 (S4.1, L-05, DP-11), INV poz. 10

### 8.1 Dostęp — redirect [MANUAL]

- Klik „Billing" w sidebarze → redirect do `/admin/billing`.
- Bezpośredni URL `/organization/billing` → useEffect → redirect do `/admin/billing`.
- Cały test Billing odbywa się w M24 Admin przy redirectcie.

> Jeśli redirect nie działa (bug), lokalny `BillingSection` w `OrganizationAdminPanel.tsx:91` renderuje się. Kontynuuj poniżej.

### 8.2 Wyświetlenie danych billingowych

- Panel Billing widoczny: plan (aktywny/trial), saldo tokenów, pasek użycia.
- `GET /api/organization/policy-snapshot` → 200, dane `plan`, `tokens`, `limits`.
- Pasek użycia: `usagePercent` obliczony poprawnie (czerwony > 95%, amber > 80%).

### 8.3 CTA „Upgrade" — weryfikacja ślepoty [MANUAL]

- Upewnij się, że org jest na planie TRIAL (warunek `isTrialPlan === true`).
- Klik przycisk „Upgrade" (`OrganizationAdminPanel.tsx:291-299`).
- **Asercja:**
  - BRAK nawigacji do jakiejkolwiek strony checkout/płatności.
  - BRAK żądania HTTP w Network.
  - Jedyna akcja: `trackFunnelEvent('org_admin_cta_clicked', { action: 'billing_activate' })` (analityka).
  - **Status dokumentacyjny:** FAIL (design) — DP-11 zakłada label „zarządzane przez DBR77". CTA powinno wyświetlać informację zamiast wyglądać jak aktywny przycisk. Odnotuj jako znany dług.
- Sprawdź że nie ma błędu 500 ani crash-u.

### 8.4 Komunikat „zarządzane przez DBR77" (cel DP-11)

- **Asercja:** jeśli CTA nie naviguje — sprawdź czy jest jakiś label wyjaśniający, że billing zarządza DBR77.
- Jeśli brak takiego label i jest tylko ślepe CTA → FAIL (DP-11 niezaimplementowane na FE).

---

## §9 — Limits & Usage (ślepe CTA)

**Mapowanie:** EPIK 4 (L-05, DP-11), INV poz. 11

### 9.1 Dostęp — redirect

- Klik „Limits" w sidebarze → redirect do `/admin/billing` (j.w. jak Billing).
- Bezpośredni URL `/organization/limits` → redirect.

### 9.2 Wyświetlenie limitów

- Panel Limits: lista limitów (members, projects, tokens itd.) z wartościami max/current.
- `GET /api/organization/policy-snapshot` → 200, `limits` zawiera `maxUsers`, `maxProjects` itd.
- Progress bary dla każdego limitu.

### 9.3 CTA „View Plans" — weryfikacja ślepoty [MANUAL]

- Klik przycisk „View Plans" (`OrganizationAdminPanel.tsx:474-480`).
- **Asercja:** analogicznie do §8.3 — wyłącznie `trackFunnelEvent`, brak nawigacji, brak HTTP, brak crash.
- Odnotuj jako znany dług DP-11.

---

## §10 — Domains (custom domain + approved domains)

**Mapowanie:** INV poz. 12 · Endpointy: `PATCH /api/branding/:orgId`, `GET/POST/DELETE /api/organizations/:orgId/approved-domains`

### 10.1 Dostęp — redirect

- Klik „Domains" w sidebarze → redirect do `/admin/operations`.
- Bezpośredni URL `/organization/domains` → redirect do `/admin/operations`.

### 10.2 Custom domain — ustawienie

- Jeśli panel Domains w admin widoczny: wpisz `test.dbr77.com` → Zapisz.
- **Asercja:** `PATCH /api/branding/:orgId` z `customDomain` → 200.
- Status: „Pending verification" lub „Verified" (DNS krok operatora).

### 10.3 Approved email domains — CRUD [DB]

- Dodaj domain `testcorp.com` → `POST /api/organizations/:orgId/approved-domains` → 201.
- Usuń domain → `DELETE /api/organizations/:orgId/approved-domains/:id` → 200.
- Lista: `GET /api/organizations/:orgId/approved-domains` → 200, zaktualizowana lista. [DB]

---

## §11 — Branding (logo, kolory, regional)

**Mapowanie:** INV poz. 13 · Endpointy: `PATCH /api/branding/:orgId`, `POST upload`

### 11.1 Dostęp — redirect

- Klik „Branding" w sidebarze → redirect do `/admin/operations`.
- Bezpośredni URL `/organization/branding` → redirect.

### 11.2 Upload logo — happy path [DB]

- Klik upload logo → wybierz plik PNG (< 5 MB).
- **Asercja:** `POST /api/upload` z form-data → 200, response z `url`.
- Następnie: `PATCH /api/branding/:orgId` z `{ logoLightUrl: url }` → 200.
- Logo wyświetla się po uploadzie.

### 11.3 Upload logo — walidacja formatów [MANUAL]

- Plik SVG: przyjęty (`accept="image/svg+xml"` w input).
- Plik EXE lub JS: **Asercja:** odrzucony (FE `accept=` + BE mimetype check).
- Plik SVG z `<script>` (malicious): **Asercja:** przechodzi przez FE ale backend POWINIEN sanityzować (L-09 — sprawdź czy brak sanityzacji na BE).
  - Jeśli brak sanityzacji SVG na serwerze → FAIL (L-09 stored-XSS open).

### 11.4 Kolor brandu — live preview

- Zmień kolor brandu (color picker) → `PATCH /api/branding/:orgId` z `{ primaryColor: '#...' }` → 200.
- Kolor aktualizuje się w UI (live preview).

### 11.5 Sekcja Regional — tylko do odczytu

- Pola timezone, language, currency: tylko do odczytu (brak edycji).
- **Asercja:** brak przycisków Save dla regional sekcji.

---

## §12 — Org-Switch (przełączanie organizacji)

**Mapowanie:** INV poz. 14, S7 · Endpoint: `POST /auth/switch-organization`

### 12.1 Przełączenie org — happy path [DB]

- Użytkownik należy do min. 2 organizacji (ACTIVE membership).
- Klik na nazwę org w sidebarze/navbar → wybierz drugą org.
- **Asercja:** `POST /auth/switch-organization` z `{ organizationId }` → 200, nowy token JWT.
- Hard reload po przełączeniu (fix deep-linków).
- URL: kontekst org zmienia się, dane wyświetlane należą do nowej org.

### 12.2 Próba przełączenia na org bez membership [SEC]

```bash
curl -X POST http://localhost:3001/api/auth/switch-organization \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"<org-bez-membership-id>"}' -v
```
- **Asercja:** 403 (walidacja `organization_members` ACTIVE, `auth.routes.ts:707-750`). [SEC]

### 12.3 Sync między kartami [MANUAL]

- Otwórz dwie karty w przeglądarce z tą samą sesją.
- Przełącz org w zakładce 1.
- **Asercja:** zakładka 2 aktualizuje się (org-switch sync).

---

## §13 — Podwójna implementacja admin (KRYTYCZNE — weryfikacja architektury)

**Mapowanie:** EPIK 3 (L-04, D-02), §0.3 niniejszego dokumentu

### 13.1 Ścieżka kliknięcia — redirect [MANUAL]

Dla każdej z 6 sekcji admin sprawdź ścieżkę kliknięcia w sidebarze:

| Sekcja | Oczekiwany redirect | Sprawdź URL po kliknięciu |
|---|---|---|
| Members | `/admin/people` | |
| Competencies | `/admin/operations` | |
| Billing | `/admin/billing` | |
| Limits | `/admin/billing` | |
| Domains | `/admin/operations` | |
| Branding | `/admin/operations` | |

- **Asercja:** każde kliknięcie wychodzi z `/organization/*` i ląduje w `/admin/*`.

### 13.2 Ścieżka URL bezpośrednia — redirect [MANUAL]

Wejdź bezpośrednio na każdy URL:

- `/organization/members` → sprawdź URL w pasku
- `/organization/competencies` → j.w.
- `/organization/billing` → j.w.
- `/organization/limits` → j.w.
- `/organization/domains` → j.w.
- `/organization/branding` → j.w.

- **Asercja (naprawa):** `useEffect` w OrganizationView wykrywa sekcję admin → `navigate(ADMIN_REDIRECTS[section], { replace: true })` → redirect do M24.
- Jeśli redirect NIE działa przy URL bezpośrednim → FAIL (L-04 wariant — lokalny panel renderuje się zamiast M24).

### 13.3 Spójność danych między ścieżkami

- Dodaj członka przez M24 Admin (`/admin/people`) → wróć do `/organization/members` (przez URL bezpośredni, obserwuj co się renderuje).
- **Asercja:** jeśli lokalny panel nadal widoczny — dane są spójne (ten sam endpoint `GET /api/organizations/:orgId/members`).
- Odnotuj: jeśli obie ścieżki renderują inne panele z tymi samymi danymi = podwójna implementacja wciąż istnieje (drift D-02 otwarty).

---

## §14 — Route bez role-gatingu (BEZPIECZEŃSTWO)

**Mapowanie:** EPIK 3 (L-04), §0.5 niniejszego dokumentu · `AppRoutes.tsx:2216`

### 14.1 MEMBER wchodzi na `/organization/*` bezpośrednim URL [SEC][MANUAL]

- Zaloguj się jako MEMBER (NIE admin/owner).
- Wejdź na `/organization/profile`.
- **Asercja 1 — router przepuszcza:** router NIE odrzuca (tylko `requireAuth`), strona ładuje się.
- **Asercja 2 — profil widoczny:** MEMBER widzi profil firmy (is read, nie write).
- **Asercja 3 — sekcje admin ukryte:** wejdź na `/organization/members` jako MEMBER.
  - `useEffect` → redirect do `/admin/people`.
  - W `/admin/people`: `<ProtectedRoute requiredRole="ADMIN">` → MEMBER odrzucony (redirect do login lub 403 strona).
  - **ALBO:** jeśli redirect nie działa, `renderContent()` zwraca `null` dla `isOrgAdmin===false`.
- Odnotuj: czy MEMBER widzi cokolwiek na sekcjach admin, czy dostaje czysty null/empty state. Null bez komunikatu to też UX problem.

### 14.2 Niezalogowany użytkownik [MANUAL]

- Wyloguj się (lub incognito) → wejdź na `/organization/profile`.
- **Asercja:** redirect do `/login` lub strona logowania.
- `ProtectedRoute requireAuth={true}` powinien obsłużyć.

### 14.3 Sidebar — widoczność dla MEMBER [MANUAL]

- Zaloguj jako MEMBER → sprawdź sidebar główny (NModeLayout).
- **Asercja:** pozycja „Organization" NIE jest widoczna dla MEMBER (sidebar główny filtruje po roli admin/owner).
- Jeśli widoczna → FAIL (member mógłby klicać i widzieć dane org).

---

## §15 — Testy E2E org-data export [SEC]

**Mapowanie:** EPIK 1/Story 1.2 (L-03 naprawiony)

### 15.1 Export jako ADMIN — happy path [DB]

- Jako OWNER/ADMIN: wywołaj (np. przez dev panel lub Postman):
  - `POST /api/organization-data/export/all` z tokenem ADMIN.
  - **Asercja:** 200, response zawiera dane org (users/projects/tasks).
- `POST /api/organization-data/export/:category` z `category=activity_log` → 200.

### 15.2 Export jako MEMBER — zablokowany [SEC]

```bash
curl -X POST http://localhost:3001/api/organization-data/export/all \
  -H "Authorization: Bearer <member-token>" \
  -H "Content-Type: application/json" -v
```
- **Asercja:** 403 Forbidden (`requireRole('admin','owner')` na `:212`/`:351`).
- Jeśli 200 → FAIL krytyczny (L-03 nie naprawiony — insider exfiltration).

### 15.3 Export bez tokenu [SEC]

```bash
curl -X POST http://localhost:3001/api/organization-data/export/all \
  -H "Content-Type: application/json" -v
```
- **Asercja:** 401 Unauthorized.

---

## §ŚCIEŻKI CROSS-MODULE

### CM-1: M23 → M01 Czat (kontekst org w Teresie)

- Sprawdź że Goals/Challenges/Strategy zapisane w `/organization/*` pojawiają się w kontekście Teresy (§2.8).
- Profil firmy → Teresa zna nazwę firmy, branżę, opis.
- **Asercja E2E:** wyślij wiadomość „Kim jesteś i dla jakiej firmy pracujesz?" → Teresa odpowiada z danymi profilu aktualnej org.
- Test `OrgContextSummaryBanner` → liczba claimów rośnie po rebuild → Teresa ma więcej kontekstu.

### CM-2: M23 → M24 Admin (redirect sekcji ADMINISTRATION)

- Zweryfikuj §13 — redirect jest spójny.
- Dane zarządzane w M24 (members, competencies, billing) są synchronizowane z M23 (jeśli kiedykolwiek renderuje lokalny panel).

### CM-3: M23 → M27 SuperAdmin (billing — ślepe CTA)

- CTA Billing w M23 nie prowadzi do M27 ani żadnego panelu zarządzania subskrypcją.
- Decyzja DP-11: billing zarządzany przez DBR77 (M27 SuperAdmin), nie przez sam M23.
- **Asercja:** klik Upgrade w M23 NIE nawiguje do `/superadmin/*`.

---

## §MAPA EPIKÓW → SEKCJE (pełne pokrycie)

| Epik | Story | Pokrycie w teście |
|---|---|---|
| EPIK 1 — Bezpieczeństwo | Story 1.1 (competency-auth) | §7.6, §7.7 |
| EPIK 1 | Story 1.2 (export role-gate) | §15.2, §15.3 |
| EPIK 1 | Story 1.3 (multi-tenant isolation) | §1.5, §7.5 |
| EPIK 2 — Kontekst org realny | Story 2.1 (Goals cross-browser) | §2.1–§2.8 |
| EPIK 3 — Koniec driftu admin | Story 3.1 (member deep-link) | §13.1–§13.3, §14.1 |
| EPIK 4 — Honest billing | Story 4.1 (CTA komunikat) | §8.3, §8.4, §9.3 |
| EPIK 5 — Szlif kanonu | Story 5.1 (§27 tabele) | §przekrojowe A11y |
| EPIK 5 | Story 5.2 (i18n) | §6.4, §7.8, §przekrojowe |
| EPIK 5 | Story 5.3 (SVG sanityzacja) | §11.3 |
| INV poz. 1 Profil | — | §1 |
| INV poz. 2 Goals | — | §2.1–§2.9 |
| INV poz. 3 Challenges | — | §2.3 |
| INV poz. 4 Strategy | — | §2.4 |
| INV poz. 5 Megatrends | — | §3 |
| INV poz. 6 KG | — | §4 |
| INV poz. 7 Baner Teresy | — | §5 |
| INV poz. 8 Members | — | §6 |
| INV poz. 9 Competencies | — | §7 |
| INV poz. 10 Billing | — | §8 |
| INV poz. 11 Limits | — | §9 |
| INV poz. 12 Domains | — | §10 |
| INV poz. 13 Branding | — | §11 |
| INV poz. 14 OrgContext switch | — | §12 |

---

## §PRZEKROJOWE

### P-1: localStorage luka — dokumentacja stanu bieżącego

> Uwaga: W11 (`d013ab7c4c`) naprawił fasadę localStorage. Poniższe testy weryfikują poprawność naprawy.

- Klucz localStorage: `consultify-context-builder` — nadal UŻYWANY jako cache offline.
- Backend: `organization_context_store` tabela — SSOT per-org.
- `useOrgContextSync` — hydratuje zustand ze store na mount, debounce-save na każdą zmianę.
- **Pytanie do zweryfikowania:** czy `useOrgContextSync` jest wołany TYLKO z `OrganizationView`? Jeśli moduły Goals/Challenges/Strategy są embedded gdzie indziej (bez `OrganizationView`), sync może nie działać.

```bash
grep -rn "useOrgContextSync" src/
```

- Jeśli tylko w `OrganizationView.tsx` → poprawne. Jeśli gdzie indziej też → sprawdź czy sync działa.

### P-2: Podwójny admin — spis stanu po redirectach

| URL | Oczekiwane zachowanie | Faktyczne (PASS/FAIL) |
|---|---|---|
| `/organization/members` | redirect → `/admin/people` | |
| `/organization/competencies` | redirect → `/admin/operations` | |
| `/organization/billing` | redirect → `/admin/billing` | |
| `/organization/limits` | redirect → `/admin/billing` | |
| `/organization/domains` | redirect → `/admin/operations` | |
| `/organization/branding` | redirect → `/admin/operations` | |

### P-3: i18n (PL ↔ EN)

- Sprawdź każdą sekcję organizacji po przełączeniu na PL i EN.
- Kluczowe miejsca ryzyka: `CompetencyCatalog.tsx:51` (isPolish), `OrganizationAdminPanel.tsx:179` (<option> roles).
- **Asercja:** zero gołych fallbacków widocznych w języku docelowym.
- `sectionMeta` w `OrganizationView.tsx` używa `t(key, fallback)` — sprawdź czy tłumaczenia istnieją w plikach i18n.

### P-4: Dark mode

- Przełącz dark mode → sprawdź czytelność wszystkich sekcji:
  - Profil firmy (pola formularza, badges)
  - Goals/Challenges/Strategy (textarea, lista items)
  - Knowledge Graph (węzły React Flow na ciemnym tle)
  - Billing (pasek tokenów, status)
  - Members (tabela)
- Sprawdź hex tokeny w `OrganizationAdminPanel.tsx` — 15 hardcoded hex (L-08: DP-8 palety legalne, ale weryfikacja).

### P-5: Accessibility (A11y)

- `OrganizationSidebar`: pozycje mają `aria-label`, focus widoczny, Tab/Enter/Esc.
- Formularze: `label` dla każdego input, `aria-describedby` dla błędów.
- KG: `aria-label` dla węzłów grafu.
- Baner Teresy: przycisk Rebuild dostępny klawiaturowo.
- Mobilny sidebar (hamburger `Menu` icon): `aria-label="Open navigation"`, focus trap.

### P-6: Zero błędów konsoli

- Podczas całej sesji testowej (wszystkie §1–§14): zero `console.error`, zero `Uncaught` w konsoli.
- Szczególnie: React 18 Strict Mode double-invocation + unmount/remount `useOrgContextSync` (sprawdź czy timer debounce jest czyścony w cleanup).

### P-7: Testy automatyczne do uruchomienia

```bash
# Istniejące testy org:
npx jest tests/integration/organization-management.workflow.test.js
npx jest tests/unit/backend/routes/organizations.routes.test.js
npx jest tests/unit/backend/services/organizationContextService.test.ts
npx jest tests/unit/backend/services/competencyTaxonomy.test.ts
npx jest tests/integration/routes/organizationData.no-stubs.test.ts

# Multi-tenant isolation (45 SKIP — wymaga PG):
RUN_DB_TESTS=1 npx jest tests/unit/backend/middleware/orgContext.middleware.test.ts
# (oczekiwane: odblokowanie z RUN_DB_TESTS=1 uruchamia testy izolacji cross-org)

# Testy bezpieczeństwa (orgContext safety):
npx jest tests/unit/backend/middleware/orgContext.safety.test.ts

# Switch organization:
npx jest tests/unit/backend/routes/auth.routes.switch-organization-status.test.ts
```

- Oczekiwane wyniki po W11: `organizationData.no-stubs.test.ts` może mieć stale (oczekuje 503, dostaje 200) → L-07.
- `orgContext.middleware.test.ts` → 45 SKIP bez PG → uruchom z `RUN_DB_TESTS=1` jeśli dostępna DB.

---

## §REGRESJA (znane problemy)

| # | Opis | Plik:linia | Status |
|---|---|---|---|
| R-1 | Goals/Challenges localStorage-only (fasada) | `useContextBuilderStore.ts:414` | NAPRAWIONE W11 — zweryfikuj §2.5 |
| R-2 | `/api/competency/*` bez auth | `competency.routes.ts:10` | NAPRAWIONE `fd8707c5b2` — zweryfikuj §7.6 |
| R-3 | org-data export bez role-gate | `organization-data.routes.ts:212,351` | NAPRAWIONE `fd8707c5b2` — zweryfikuj §15.2 |
| R-4 | Billing/Limits CTA ślepe | `OrganizationAdminPanel.tsx:293,475` | OTWARTE DP-11 — dokumentuj §8.3/9.3 |
| R-5 | Route `/organization/*` bez role-gate | `AppRoutes.tsx:2216` | OTWARTE L-04 — dokumentuj §14 |
| R-6 | SVG branding XSS | branding upload server | OTWARTE L-09 — dokumentuj §11.3 |
| R-7 | `orgContext.middleware.test.ts` 45 SKIP | `orgContext.middleware.test.ts` | OTWARTE L-07 — uruchom z PG |
| R-8 | KG orgId fallback z header | `knowledge-graph.routes.ts:22` | OTWARTE L-09 — dokumentuj §4.5 |

---

## Format raportu i Definition of Done

### Format wyniku każdego testu

```
§X.Y — Nazwa testu
Kroki: [numerowane]
Oczekiwane: [asercja]
Faktyczne: [obserwacja]
Status: PASS | FAIL | SKIP | INFO
Dowód: [screenshot / payload Network / wartość localStorage / curl output]
[Jeśli FAIL:] Plik:linia, opis przyczyny, propozycja fixu
```

### Definition of Done

- [ ] 1. Wszystkie §1–§12 zakończone PASS (lub świadome INFO dla znanych długów DP-11/L-04/L-06/L-07/L-09)
- [ ] 2. §2.5 (cross-browser Goals persistencja) = PASS — W11 działa end-to-end
- [ ] 3. §2.8 (Teresa widzi Goals) = PASS — kontekst org zasila AI
- [ ] 4. §7.6/7.7 (competency auth) = PASS — naprawa `fd8707c5b2` potwierdzona żywo
- [ ] 5. §15.2 (export role-gate) = PASS — naprawa `fd8707c5b2` potwierdzona żywo
- [ ] 6. §13.1/13.2 (redirect admin) = PASS lub FAIL (jeśli FAIL → L-04 otwarta, odnotuj)
- [ ] 7. §8.3/9.3 (ślepe CTA) = INFO z opisem (znany dług DP-11)
- [ ] 8. §14 (role-gating) = INFO (znany brak, nie bloker, opisany)
- [ ] 9. Zero `console.error` przez całą sesję
- [ ] 10. Testy automatyczne: `organizationData.no-stubs` + `orgContext.safety` = PASS; `orgContext.middleware` z PG = PASS (odblokowane 45 SKIP)
- [ ] 11. i18n PL+EN zweryfikowane dla wszystkich sekcji
- [ ] 12. Dark mode — brak nieczytelnych elementów

**Otwarte znane długi (NIE blokują DoD):** DP-11 (billing label), L-04 (route role-gate), L-06 (i18n isPl→t()), L-07 (45 SKIP), L-09 (SVG XSS, KG fallback). Są udokumentowane jako INFO/FAIL z opisem.

---

*Specyfikacja oparta na: karta audytu 2026-06-11 (re-audit), teczka M23 2026-06-13, weryfikacja kodu 2026-06-13/16, commit `d013ab7c4c` (W11), `fd8707c5b2` (auth). Ocena modułu: 52/100 Alpha — Fazy 3+4 niewykonane żywym testem.*
