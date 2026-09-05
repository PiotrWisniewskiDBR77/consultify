# Naprawa 4 defektów Administracja/Ustawienia — 05.09.2026

Robotnik: agent w worktree `/private/tmp/ag-admin-ustawienia`, gałąź
`agent/admin-ustawienia-defekty-20260905`, baza `m03` (tip `a3af36b61b`).

Źródło zlecenia: `/private/tmp/m03/evidence/odbior-zywo-20260905/13-administracja/RAPORT.md`
+ `wyniki.json` oraz `/private/tmp/m03/evidence/odbior-zywo-20260905/18-ustawienia/RAPORT.md`
(odbiór na żywo, konto Owner DBR77, staging).

## Podsumowanie werdyktu

| # | Defekt zgłoszony w odbiorze | Werdykt | Naprawa | Commit |
|---|---|---|---|---|
| 1 | `admin-ai-personas` — baner „Failed to fetch system prompts", lista pusta | **Potwierdzony, prawdziwy bug** (404 realny + i18n) | Kod (backend + frontend) | `4275234262` |
| 2 | `admin-billing-seats-licences` — Łącznie 0 / Zajęte 8 / Wolne 0 / Wykorzystanie 0% | **Potwierdzony, prawdziwy bug** | Kod (backend + frontend) | `257e946cf0` |
| 3 | `admin-health-dependencies`/`admin-health-incident-history` — podtytuł i breadcrumb „Health" po angielsku | **Potwierdzony** — klucz i18n nie istniał wcale | i18n (2 brakujące klucze) | `1b20a863e0` |
| 4 | `ustawienia-integracje` — 8/8 nawigacji ląduje losowo w 3 różnych miejscach | **Potwierdzony, prawdziwy bug** (dwuetapowy wyścig przekierowań) | Kod (routing) | `6d60f0f6ae` |

Dla każdego defektu: nowy/zmieniony test jednostkowy + **dowód mutacyjny**
(test uruchomiony na `git stash` cofniętej poprawce — czerwony bez fixu,
zielony z fixem — pokazane w transkrypcie sesji, nie tylko zadeklarowane).

---

## Defekt 1 — `admin-ai-personas`: 404 + angielski komunikat błędu

**Przyczyna (realna, nie zgadywana).** `grep` na `server/src/Gateway.ts`
pokazał, że `/api/ai-prompts` (i jego legacy alias `/api/ai/prompts`) były
zamontowane za `requireInternalToolsAccess` — bramką „narzędzi
wewnętrznych" domyślnie WYŁĄCZONĄ wszędzie poza `NODE_ENV=development|test`
(`server/src/middleware/internalTools.middleware.ts:105-108`). Ekran
„Persony" w Menu Admina → AI to jednak zwykła, klientocentryczna funkcja
(edycja promptów systemowych), a nie narzędzie inżynierskie — jej własny
router (`ai-prompts.routes.ts`) już ma poprawne `verifyToken` +
`requireRole('super_admin','admin')` per endpoint (Owner mapuje się na
`superadmin` w `rbac.middleware.ts:113-119`, więc przeszedłby tę bramkę bez
problemu). Efekt: każda organizacja na każdym środowisku poza
dev/test (staging, demo — bo `INTERNAL_TOOLS_ENABLED` tam nie jest
ustawione) dostawała twardy 404 na całą listę person.

Drugi, niezależny błąd w `PersonasPanel.tsx`: `catch (e) { setError(e
instanceof Error ? e.message : t(...)) }` — realny `Error` rzucony przez
`Api.aiGetSystemPrompts()` (`throw new Error('Failed to fetch system
prompts')`) leciał SUROWY, PO ANGIELSKU, prosto do banera, z pominięciem
i18n całkowicie.

**Kod:**
- `server/src/Gateway.ts` — usunięte dwie linie `app.use('/api/ai-prompts',
  ...internalToolsGuard)` / `app.use('/api/ai/prompts',
  ...internalToolsGuard)`; router poniżej i tak ma własne RBAC.
- `src/components/Admin/AI/PersonasPanel.tsx` — `catch` zawsze pokazuje
  `t('admin.ai.personas.errors.load')`, nigdy surowego `e.message`.

**Test + dowód mutacyjny:**
- `server/src/middleware/__tests__/internalTools.aiPromptsGate.test.ts`
  (nowy) — 3 asercje na PRAWDZIWYCH eksportowanych middleware'ach
  (`requireInternalToolsAccess`, `requireRole`) + regresja na źródle
  `Gateway.ts`; `git stash` cofnięcie `Gateway.ts` → 1/3 testów czerwony.
- `src/components/Admin/__tests__/PersonasPanel.test.tsx` — przypadek
  „renders an API error" zastąpiony przypadkiem asercjonującym polski
  tekst i BRAK angielskiego stringa; `git stash` cofnięcie
  `PersonasPanel.tsx` → czerwony.

**Zrzut PO:** `evidence/admin-ustawienia-20260905/admin-ai-personas-PO.png`
— baner „Nie udało się pobrać person." (był: angielski). Backend nadal
zwraca 404 na zrzucie, bo zrzut idzie przez REALNY staging (kod tej
gałęzi nie jest tam wdrożony) — to oczekiwane, patrz sekcja „Co widać na
żywo, co nie" niżej.

---

## Defekt 2 — `admin-billing-seats-licences`: sprzeczne liczby

**Przyczyna.** `seatManagementService.getSeatConfiguration()` liczył
`total_seats_available = base_seats_included + additional_seats_purchased`.
`base_seats_included` jest ZAMROŻONE w bazie w momencie
`initializeSeatConfiguration()` i domyślnie `0`, gdy organizacja nie miała
wtedy żadnego planu (`organization_billing`/`subscription_plans`) — DBR77
jako organizacja wewnętrzna nigdy takiego planu nie dostała. Efekt: „0
total" (zamrożone przy braku planu) i „8 zajętych" (prawdziwa liczba
aktywnych członków, aktualizowana osobno) współistniały jako jedna liczba,
dając matematycznie niemożliwe „8 z 0 to 0%".

**Kod:**
- `server/src/services/seatManagementService.ts` — nowy honest sygnał
  `seats_limit_configured` liczony z `sp.seats_included` (BIEŻĄCY plan,
  przez `LEFT JOIN subscription_plans`), NIE z zamrożonej kolumny. Gdy
  `false`, `seats_remaining`/`utilization_percent` nie są w ogóle liczone.
- `src/components/Admin/AdminSeatsLicencesPanel.tsx` — gdy
  `seats_limit_configured === false`, karty Łącznie/Wolne/Wykorzystanie
  pokazują „Brak ustawionego limitu" + linijkę wyjaśnienia; „Zajęte" nadal
  pokazuje prawdziwą liczbę.
- Nowe klucze i18n (PL+EN):
  `admin.billing.seats-licences.summary.notConfigured` /
  `notConfiguredHint`.

**Test + dowód mutacyjny:** `AdminSeatsLicencesPanel.test.tsx` — nowy
przypadek z `seats_limit_configured: false, seats_used: 8` asercjonuje 3×
„Brak ustawionego limitu" i BRAK „0%"; `git stash` cofnięcie serwisu +
panelu → czerwony.

**Zrzut PO:** `evidence/admin-ustawienia-20260905/admin-billing-seats-licences-PO.png`
— nadal pokazuje stare liczby (0/8/0/0%), bo staging serwuje STARY backend
bez pola `seats_limit_configured` (frontend domyślnie zakłada
skonfigurowany limit, gdy pole w ogóle nie przyszło — bezpieczny fallback
wstecz-kompatybilny). Wymaga wdrożenia backendu na staging/demo, żeby
zrzut pokazał naprawę — poza mandatem robotnika (`consultify-promocja-demo`,
nadzorca).

---

## Defekt 3 — `admin-health-*`: „Health" po angielsku

**Przyczyna.** `AdminSettingsModule.tsx`'s `SECTION_META['health']`
rozwiązuje breadcrumb (2. okruszek) i podtytuł strony przez
`t('admin.section.health.title'/'subtitle', {defaultValue: ...})` —
dokładnie jak 6 sąsiednich sekcji (people/billing/ai/security/audit/
command). Tamte sześć MA prawdziwe klucze PL/EN w `translation.json`;
`admin.section.health.*` NIE ISTNIAŁO WCALE w żadnym języku — to nie jest
przypadek „klucz istnieje ≠ przetłumaczony", tylko brakujący klucz od
zawsze, więc i18next zawsze spadał na angielski `defaultValue` z miejsca
wywołania, w każdym języku.

**Kod:** dodane `admin.section.health.title`/`subtitle` w
`public/locales/pl/translation.json` („Stan systemu" + polskie zdanie) i
`public/locales/en/translation.json` (parytet z pozostałymi sekcjami).

**Test + dowód mutacyjny:**
`src/views/admin/__tests__/AdminSettingsModule.healthSectionI18n.test.ts`
(nowy) — czyta PRAWDZIWY `translation.json`, asercjonuje że PL title/
subtitle istnieją i NIE są angielskim defaultem; `git stash` cofnięcie
JSON-ów → 3/3 czerwone.

**Zrzuty PO:**
`evidence/admin-ustawienia-20260905/admin-health-dependencies-PO.png` i
`admin-health-incident-history-PO.png` — breadcrumb „Panel administratora
› Stan systemu › Zależności/Historia incydentów" i podtytuł „Sondy
potwierdzające działanie systemu…" w pełni po polsku. Ten fix jest CZYSTO
frontendowy (i18n JSON), więc zrzut na żywo pokazuje naprawę OD RAZU mimo
że backend stagingu się nie zmienił.

---

## Defekt 4 — `ustawienia-integracje`: wyścig przekierowań

**Przyczyna (śledzona krok po kroku, nie zgadywana).**
1. `syncEntryResolver.resolveLegacySyncSettingsEntry()` wysyłał
   admin/owner/superadmin z legacy `/settings/integrations` do
   `ROUTES.ADMIN.INTEGRATIONS` (`/admin/integrations`).
2. Ta trasa NIE MA żadnej domeny/ekranu w taksonomii
   `AdminSettingsModule` — `adminNavigation.ts` nie definiuje żadnego
   `'integrations'` i nigdzie w repo nie ma komponentu
   `AdminIntegrationsPanel`. To była martwa trasa-cel, nigdy realny ekran.
3. `AdminSettingsModule.resolveAdminState()`'s ogólna tabela aliasów
   (`SECTION_ALIASES.integrations = 'security'`, niezwiązana z tą funkcją)
   po cichu zinterpretowała nierozpoznany segment 'integrations' jako
   domenę 'security', domyślny ekran 'security-policy', po czym WŁASNY
   efekt kanonizujący URL (linie 278-281) zrobił DRUGIE
   `navigate(replace)` na `/admin/security/security-policy`.
4. Ponieważ stan `currentView` (Zustand, aktualizowany przez `RouterSync`)
   i `location.pathname` (React Router) aktualizują się w osobnych
   przebiegach efektów, to, który z tych trzech „przystanków" złapie
   zrzut ekranu/użytkownik, zależy od timingu — stąd pozorna losowość
   (3× `/admin/integrations` z treścią „Przegląd ustawień", 3×
   `/admin/security/security-policy`, 2× puste).

**Kod:** `src/views/settings/syncEntryResolver.ts` —
`resolveLegacySyncSettingsEntry`'s case `ROUTES.SETTINGS.INTEGRATIONS`
teraz zwraca `${ROUTES.SETTINGS.ROOT}/connected-apps` dla KAŻDEJ roli
(usunięta gałąź `isAdminOwnerOrSuperAdminRole(role) ? ROUTES.ADMIN.INTEGRATIONS
: ...`) — jedna trasa, jeden ekran, bez drugiego przeskoku.

**Test + dowód mutacyjny:**
`src/views/settings/__tests__/syncEntryResolver.test.ts` — stary przypadek
kodujący STARE (błędne) zachowanie zastąpiony pętlą po 6 rolach
asercjonującą JEDEN cel; `git stash` cofnięcie resolvera → czerwony.

**Zrzut PO:** 3× niezależne wywołanie `--url=/settings/integrations` →
3/3 wylądowało deterministycznie na `/settings/connected-apps` z realną
treścią „Połączone aplikacje" (Gmail/Outlook/Slack/Teams/…) —
`evidence/admin-ustawienia-20260905/ustawienia-integracje-PO-try{1,2,3}.png`.
To jest CZYSTO frontendowy routing fix, więc naprawa jest w pełni widoczna
na żywo już teraz.

---

## Co widać na żywo teraz, co nie (i dlaczego)

Zrzuty PO robione własnym `vite --port 3011` (kopia
`/private/tmp/m03/.env.local`, `VITE_API_TARGET=https://staging.consultify.ai`
— frontend to KOD TEJ GAŁĘZI, backend to PRAWDZIWY staging, niezmieniony).

- **Defekt 3 (i18n) i 4 (routing frontendowy)** — w pełni widoczne na
  żywo już teraz, bo poprawka jest wyłącznie w kodzie frontendu
  serwowanym przez mój lokalny vite.
- **Defekt 1 (backend gate) i 2 (backend seat config)** — poprawka jest
  po stronie `server/src/*`; realny staging nadal serwuje STARY kod
  backendu, więc zrzut na żywo nadal pokazuje 404 (defekt 1) i stare
  liczby 0/8/0/0% (defekt 2). Dowód dla tych dwóch defektów to test
  jednostkowy + mutacja (pokazane wyżej), NIE zrzut na żywo — zrzut na
  żywo pokaże naprawę dopiero po wdrożeniu backendu na staging/demo
  (`consultify-promocja-demo`, poza mandatem robotnika).
  Frontendowa POŁOWA defektu 1 (lokalizacja komunikatu błędu) JEST
  widoczna na żywo już teraz (baner po polsku, mimo że treść wciąż 404).

## Commity (kolejność chronologiczna, jeden per defekt)

```
4275234262 fix(admin-ai-personas): stop 404ing the Personas screen for every org
257e946cf0 fix(admin-billing-seats-licences): stop showing a self-contradictory 0/0/0% summary
1b20a863e0 fix(admin-health): add missing admin.section.health i18n keys (breadcrumb/subtitle stuck in English)
6d60f0f6ae fix(ustawienia-integracje): stop the two-hop redirect race to a dead /admin/integrations alias
```

## Czas i uwagi metodyczne

- Worktree `git worktree add` na współdzielonym `m03` chwilę trwał
  (>120s, poszedł w tło) — pierwszy `git status` złapany W TRAKCIE
  checkoutu pokazał tysiące „deleted:" (fałszywy alarm, race z samym
  checkoutem, nie realny stan); po dokończeniu (`bx556fnpb` completed)
  worktree był czysty i pełny.
- Dysk `/` na hoście chwilowo spadł do 117Mi (ENOSPC przy próbie
  integracyjnego testu Vitest) i sam się odzyskał do 4.5Gi kilka sekund
  później (inny współbieżny proces/agent zwolnił miejsce) — nie moja
  akcja, nie wymagało interwencji.
- Test integracyjny `tests/integration/routes/ai-prompts.test.js`
  (503 zamiast 401, dwa przypadki) — zweryfikowany jako WCZEŚNIEJSZY,
  niezwiązany z moją zmianą defekt środowiska testowego (ten sam wynik
  na `git stash` cofniętej gałęzi) — nie naprawiany (poza zakresem
  zlecenia).
- `AdminDay2I18n.test.ts` (1 test o `defaultValue` w
  `AccessReviewsPanel.tsx`) i `AdminSeatsLicencesPanel.test.tsx`'s
  istniejące przypadki „invite"/StandardTable — potwierdzone jako
  WCZEŚNIEJSZE, niezwiązane flaki (ten sam wynik bez moich zmian) — nie
  naprawiane.
