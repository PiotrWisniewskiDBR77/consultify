# SUPERADMIN × Settings/Admin — dowody weryfikacji (2026-08-24)

## Zakres
Weryfikacja, czy warstwa SUPERADMIN działa w całości z modułami Settings i Admin
(analiza kodu w checkoucie kanonicznym `Consultify-final-mvp-integration-20260823`
+ próba na żywym runtime w worktree `/private/tmp/consultify-m03-admin`).

## Identyfikacja runtime
- Worktree: `/private/tmp/consultify-m03-admin`, gałąź `codex/m03-admin-20260824`.
- SHA runtime: `08e2beec19a84632f0ad5e44e382fc265635b047` (widoczne w markerze klienta
  `LOCAL @08e2beec19a8` na wszystkich zrzutach; worktree jest współdzielony z inną,
  równoległą sesją, która commitowała podczas tej weryfikacji — kod serwera/klienta
  uruchomiony via `tsx`/`vite` bez etapu builda, więc runtime zawsze odzwierciedlał
  aktualny stan working tree).
- Porty: backend `127.0.0.1:4410`, frontend (Vite) `127.0.0.1:4411`. Zweryfikowano
  `lsof` przed startem — wolne. Chronione porty `{3940,3941,4363,4364}` oraz `3987`
  nietknięte.
- Baza: własny, jednorazowy kontener Docker `consultify-m03-admin-evidence-20260824`
  (obraz `pgvector/pgvector:pg16`, port hosta `127.0.0.1:45434`, dane NIE na tmpfs —
  usunięty po zakończeniu razem z kontenerem). Schemat zmigrowany od zera do
  bieżącego SHA (`db:migrate:strict`, 831→głowa, `685 already up to date` po pełnym
  boot). Dane fixtury `W3-ADMIN-OWNER-v1` skopiowane (pg_dump pełny schema+data,
  następnie forward-migrate, następnie data-only reload po naprawieniu drobnych
  różnic kolumn międzyschematowych) z istniejącego, nietkniętego, współdzielonego
  kontenera `consultify-w3-recovered-fixtures-20260823` (tylko odczyt przez
  `pg_dump`; ten kontener pozostał nienaruszony).
- Znany problem podwójnej migracji `20260412_seed_business_templates.sql` (opisany
  wcześniej przez sesję M01) wystąpił też tutaj — naprawiony ręcznym wpisem do
  `tp_migration_history` z poprawnym 16-znakowym checksumem
  (`fileChecksum()` = sha256 hex obcięty do 16 znaków, NIE pełny sha256 — to była
  pierwsza, błędna próba, poprawiona po analizie
  `server/src/services/tablePlatform/migrationIdentity.ts`).
- Hasło: fixture `W3-ADMIN-OWNER-v1` nie miało znanego hasła jawnego; na WŁASNEJ,
  jednorazowej kopii bazy nadpisano hash bcrypt (`ConsultifyM03Evidence2026!`) dla
  kont `w3.admin.superadmin@local.test`, `w3.admin.owner@local.test`,
  `w3.admin.admin@local.test`. Oryginalny, współdzielony kontener nietknięty.
- Fixture w bazie: `w3.admin.superadmin@local.test`, rola `SUPERADMIN`,
  `organization_id = 14000000-0000-4000-8000-000000000001` (org "W3 Admin Owner
  Review"), **membership: NONE** — brak wiersza w `organization_members` (potwierdzone
  zapytaniem SQL). To dokładnie scenariusz opisany w oryginalnym manifeście fixtury
  jako negatywna granica `platformSuperadminWithoutTenantMembership: CAPABILITY_REQUIRED`.

## Dowody nawigacyjne (zalogowano jako `w3.admin.superadmin@local.test`)

| Ścieżka | Wynik nawigacji | Zrzut | Błędy konsoli/sieci |
|---|---|---|---|
| `/superadmin` | Zostaje na `/superadmin` — Super Admin Console, "Tenant Command Center" z realnymi danymi (4 tenants, 5 active users) | `superadmin-light.png` | tylko `404 GET /api/system-health` (obecne na WSZYSTKICH stronach, niezależne od roli — patrz niżej) |
| `/admin` | Przekierowanie na `/superadmin/customers` | `admin-light.png` | jw. |
| `/settings` | Zostaje na `/settings/profile` (profil wypełniony danymi konta) | `settings-light.png` | brak |
| `/settings/billing` | Przekierowanie na `/superadmin/customers` | `settings-billing-light.png` | jw. |
| `/organization/members` | Przekierowanie na `/superadmin/customers` | `organization-members-light.png` | jw. |

Uwaga: `404 GET /api/system-health` występuje identycznie na `/settings` (gdzie
wszystko inne działa) i na wszystkich pozostałych stronach — to endpoint
nieistniejący niezależnie od roli/konta, NIE defekt specyficzny dla superadmina
(prawdopodobnie osierocony health-check widget). Nie badano głębiej — poza zakresem
zlecenia.

## Analiza kodu — trasy i hierarchia ról

1. **`src/routes/AppRoutes.tsx:3096`** — `/superadmin/*` chroniony
   `<ProtectedRoute requiredRole="SUPERADMIN">`, własna powłoka `SuperAdminView`
   (bez `MainLayout`).
2. **`src/components/ProtectedRoute.tsx:84-90`** — SUPERADMIN jest CELOWO
   wykluczony z dziedziczenia dostępu do `/admin/*` mimo hierarchii ról
   `SUPERADMIN(3) > ADMIN(2)` (komentarz: "Security P0 (audit ADM-RAW-P0-001):
   SUPERADMIN must NOT silently inherit tenant ADMIN access via the role
   hierarchy"). Odwiedzenie `/admin/*` jako SUPERADMIN → natychmiastowy redirect
   na `/superadmin`. **To jest świadoma decyzja projektowa, potwierdzona w
   runtime, NIE błąd.**
3. **`src/utils/roleGuards.ts`** — `isSuperAdminRole`, `isAdminOwnerOrSuperAdminRole`
   poprawnie normalizują `SUPER_ADMIN`→`SUPERADMIN`.

## Analiza kodu + runtime — PROBLEMY znalezione

### P1 — Ustawienia osobiste (Notifications, Appearance) nie zapisują się dla SUPERADMIN
**Plik:** `server/src/services/legacyCutover/requireActiveMembership.ts:14-44`
(middleware `requireActiveMembership`, świadomie: „Role claims, including
SUPERADMIN, never bypass it") zastosowany w
`server/src/routes/settings.routes.ts` na endpointach:
- `PUT /api/settings/preferences/notifications` (linia 533)
- `POST /api/settings/notifications` (linia 1035)
- `PUT /api/settings/preferences/appearance` (linia 5752)
- `POST /api/settings/export-data`, `POST/GET /api/settings/gdpr/*` (linie 2849,
  3015, 3059, 3184, 3226, 3299, 3361)

Middleware wymaga wiersza `organization_members` ze statusem `ACTIVE` dla pary
(userId, organizationId) — SUPERADMIN z definicji (patrz fixture) go nie ma.
Efekt zweryfikowany na żywo:
- `PUT /api/settings/preferences/notifications` → **403** `{"success":false,"code":"ORG_MEMBERSHIP_REVOKED"}`
- `POST /api/settings/notifications` → **403** `ORG_MEMBERSHIP_REVOKED`
- `PUT /api/settings/preferences/appearance` → **403** `ORG_MEMBERSHIP_REVOKED`
- W UI: ekran Ustawienia → Powiadomienia, zmiana przełącznika + "Zapisz zmiany" →
  czerwony baner **"Failed to save notification preferences"** + toast, zmiana
  NIE zapisana (dowód: `settings-notifications-save-fail-light.png`,
  `notifications-save-network.json`).

**Ocena:** to jest PROBLEM, nie świadoma decyzja — kod celu (komentarz w
`requireActiveMembership.ts`) chroni dane ORGANIZACJI przed edycją przez
superadmina bez nadanego membership, ale te konkretne endpointy to ustawienia
OSOBISTE konta (powiadomienia, wygląd, GDPR danych własnych), nie dane
organizacji. SUPERADMIN nie może zmienić własnego motywu ani wyłączyć/włączyć
powiadomień e-mail — regresja funkcjonalna dla własnego konta, niezależna od
zarządzania jakąkolwiek organizacją. Komunikat błędu `ORG_MEMBERSHIP_REVOKED`
jest dodatkowo mylący — sugeruje odebranie członkostwa, którego superadmin
nigdy nie miał.

### P2 — Redirecty Settings/Organization → Admin gubią intencję superadmina (drugorzędne)
**Pliki:** `src/routes/AppRoutes.tsx:3040-3097` (blok `/settings/*` → `billing/*`,
`organization/*`, `tenant-defaults/*` redirect do `ROUTES.ADMIN.*`) oraz
analogiczny blok `/organization/*` → `members/*`, `billing/*` itd. (commit
`baf89f836e`/`34080ef9f3`, "DEC-...-10").

Te redirecty są bezwarunkowe (bez sprawdzania roli) i lądują na `/admin/*`, co
dla SUPERADMIN natychmiast trafia w P0-guard z `ProtectedRoute.tsx:88-90` i
odbija na `/superadmin` (root, zakładka "Customers"), **tracąc oryginalną
intencję** (np. próba wejścia w `/settings/billing` kończy się na ogólnym
dashboardzie tenantów, nie na żadnym ekranie billingu). Zweryfikowane w runtime:
`/settings/billing` i `/organization/members` obie kończą na
`/superadmin/customers`.

**Ocena:** brak crasha, brak błędu w konsoli — zachowanie spójne z P0-guard, ale
UX jest myląca (podwójny redirect bez komunikatu wyjaśniającego, dlaczego
superadmin wylądował gdzie indziej niż oczekiwał). Traktuję jako drugorzędny
problem UX, nie blokujący.

## Endpointy server-side superadmin-only (przegląd kodu)
- `server/src/middleware/superAdmin.middleware.ts` → `verifySuperAdmin`,
  `requireSuperAdminCapability` — weryfikacja WYŁĄCZNIE przez JWT (rola +
  opcjonalne `superadminCapabilities` w tokenie) + odczyt roli z bazy; NIE
  wymaga `organization_members`. Poprawnie niezależny od tenant-membership.
- Trasy montowane z tym middleware: `server/src/routes/superadmin.routes.ts`,
  `server/src/routes/analytics-superadmin.routes.ts` — nie badano każdego
  endpointu z osobna (poza zakresem czasowym), ale mechanizm bramkujący jest
  strukturalnie odporny na brak membership (w przeciwieństwie do P1 powyżej).

## Podsumowanie checklisty

| # | Punkt | Wynik | Opis |
|---|---|---|---|
| 1 | Trasa `/superadmin/*`, rola wymagana, hierarchia z `/admin/*`, redirecty m01/m02 | **OK + adnotacja (P2)** | `/superadmin` wymaga roli SUPERADMIN i działa. SUPERADMIN świadomie NIE dziedziczy `/admin/*` (P0 security decyzja, zweryfikowana w runtime). Redirecty Settings/Organization→Admin gubią intencję superadmina (P2, drugorzędne). |
| 2 | Endpointy superadmin-only w server/src; Settings API dla konta bez organization_members | **PROBLEM (P1)** | `verifySuperAdmin` middleware poprawny i niezależny od membership. ALE zwykłe endpointy Settings (`preferences/notifications`, `preferences/appearance`, `notifications`, `gdpr/*`, `export-data`) używają `requireActiveMembership`, który 403-uje SUPERADMIN bez wiersza `organization_members` — potwierdzone fixture (`membership: NONE`) i na żywo. |
| 3 | Crash logiczny ekranu Settings/Admin dla superadmina | **PROBLEM (P1, częściowo)** | Brak crasha/białego ekranu — GET-y (odczyt) degradują się bezpiecznie do wartości domyślnych. Ale PUT/POST zapisu ustawień osobistych kończy się widocznym błędem "Failed to save notification preferences" (i analogicznie dla appearance) — funkcjonalna regresja, nie crash. |
| 4 | Runtime: zaloguj się i przejdź `/superadmin`, `/admin`, `/settings`, `/settings/billing`, `/organization/members` | **WYKONANE** | Wszystkie 5 ścieżek nawigowane, zrzuty + sieć/konsola zapisane. Zero białych ekranów, zero 500. Zachowania zgodne z analizą kodu (P0 redirect + P1 write-failure potwierdzone dodatkowym testem API/UI na zapisie notyfikacji). |

## Czy superadmin "przechodzi całość"?
**Częściowo.** Nawigacja/odczyt (GET) po całym Settings/Admin/Organization
działa bez crashy dla SUPERADMIN — wszystkie przekierowania są spójne z
zamierzoną architekturą ról (P0 decyzja: superadmin ma WŁASNY panel, nie
dziedziczy `/admin/*`). Realny, potwierdzony problem funkcjonalny: **SUPERADMIN
nie może zapisać własnych ustawień osobistych** (powiadomienia, wygląd/theme,
żądania GDPR) z powodu `requireActiveMembership` w
`server/src/routes/settings.routes.ts`, który blokuje każdego użytkownika bez
aktywnego wiersza `organization_members` — a SUPERADMIN z definicji go nie ma
(potwierdzone w fixturze `W3-ADMIN-OWNER-v1`: `membership: NONE`).

## Pliki i linie do naprawy (P1)
- `server/src/services/legacyCutover/requireActiveMembership.ts:14-44` — middleware
  zbyt szeroko zastosowany.
- `server/src/routes/settings.routes.ts:533,1035,5752,2849,3015,3059,3184,3226,3299,3361`
  — endpointy ustawień OSOBISTYCH (nie organizacyjnych) chronione tym middleware;
  wymagają odrębnej ścieżki dla kont bez tenant membership (np. SUPERADMIN,
  albo dowolny przyszły "platform-only" użytkownik) — albo middleware
  dedykowany personal-only endpointom, który nie wymaga organization_members.

## Sprzątanie
- Procesy `tsx server/src/index.ts` i `vite` (porty 4410/4411) zatrzymane
  (`kill`), zweryfikowano `lsof` — porty wolne po zamknięciu.
- Kontener Docker `consultify-m03-admin-evidence-20260824` (własny, jednorazowy)
  zatrzymany i usunięty (`docker rm -f`).
- Oryginalny, współdzielony kontener `consultify-w3-recovered-fixtures-20260823`
  — nietknięty (tylko odczyt przez `pg_dump`), nadal działa jak wcześniej.
- Port `3987` i chronione `{3940,3941,4363,4364}` — nietknięte (zweryfikowano
  `lsof` przed i po; procesy innych sesji nie ruszane).
- Pliki tymczasowe (`scratch_superadmin_capture*.mjs`) usunięte z worktree po
  zakończeniu.

---

## Powtórka po naprawach `51d78e9182` / `ba0a4759d2` (2026-08-24, wieczór)

### Zakres i metoda
Ta sama metodyka co powyżej, worktree `/private/tmp/consultify-m03-admin`
(gałąź `codex/m03-admin-20260824`, tip `345286ff56` — oba commity naprawcze
już w historii tej gałęzi, zweryfikowane `git log`). Nowy, własny, jednorazowy
kontener Postgres `consultify-m03-admin-evidence-20260824b`
(`pgvector/pgvector:pg16`, port hosta `127.0.0.1:45436`), schemat zmigrowany
od zera (`db:migrate:strict`, `CI=true` żeby przejść guard WP-A04 na hoście
lokalnym — patrz `server/src/config/databaseTargetResolver.ts`). Ten sam,
znany problem podwójnej `20260412_seed_business_templates.sql` naprawiony
identycznie jak poprzednio: ręczny wpis do `tp_migration_history` z
checksumem `fileChecksum()` (sha256 hex, 16 znaków) = `2a575df4d4cc517d`.
Fixture `W3-ADMIN-OWNER-v1` skopiowana punktowo (nie pełny `pg_dump` — schemat
źródłowego, współdzielonego kontenera `consultify-w3-recovered-fixtures-20260823`
ma dryf względem bieżącego SHA; skopiowano tylko potrzebne wiersze —
`organizations` × 3, `users` × 8 `w3.admin.*@local.test`, `organization_members`
× 6 — filtrując kolumny po przecięciu schema źródło/cel, skrypt jednorazowy
usunięty z worktree po użyciu). Hasło `ConsultifyM03Evidence2026!` nadpisane
bcrypt-hashem dla `w3.admin.superadmin@local.test`, `w3.admin.owner@local.test`,
`w3.admin.admin@local.test`, `w3.admin.foreign.owner@local.test`,
`w3.admin.foreign.admin@local.test`. Backend `127.0.0.1:4430` (`CI=true` dla
tego samego DB-host guardu), frontend Vite `127.0.0.1:4431`
(`VITE_API_TARGET=http://127.0.0.1:4430`). Porty zweryfikowane wolne przed
startem (`lsof`), chronione porty {3987,3940,3941,4363,4364,4402,4403,4420,4421}
nietknięte. Zrzuty i JSON-y dowodowe w `post-fix/`.

### Dowód 1 — SUPERADMIN zapisuje własne preferencje: **OK**
- `PUT /api/settings/preferences/notifications` (body `{"preferences":{...}}`)
  → **200** `{"success":true}`; `GET` readback zwraca dokładnie zapisane
  wartości. `PUT /api/settings/preferences/appearance` → **200**
  `{"success":true,"preferences":{"theme":"dark","density":"comfortable"}}`;
  `GET` readback zgodny (`post-fix/preferences-save-network.json`).
- Potwierdzone też przez realny UI: zalogowano się jako
  `w3.admin.superadmin@local.test`, `/settings/notifications`, przełączono
  "Aktualizacje zadań" → E-mail (OFF→ON), "Zapisz zmiany" → sieć
  `GET→PUT 200→GET`, zielony toast **"Preferencje powiadomień zapisane"**,
  ZERO czerwonego banera błędu
  (`post-fix/settings-notifications-postfix-saved-light.png`). Po pełnym
  `page.reload()` przełącznik nadal ON — wartość utrzymana
  (`post-fix/settings-notifications-postfix-reload-light.png`).
- **P1 z pierwszej weryfikacji zamknięty**: `requireActiveMembership` zdjęty z
  tych endpointów w `51d78e9182` (potwierdzone `grep` w
  `server/src/routes/settings.routes.ts` — zostało tylko na `POST
  /notifications` linia 1034, celowo, bo tam ADMIN/OWNER edytuje preferencje
  INNEGO członka i ma własny check roli).

### Dowód 2 — Redirect handoff: **OK (P0 naprawiony) + adnotacja (P2 pozostaje)**
- Zalogowano jako SUPERADMIN, twarde wejście (`page.goto`) na 4 legacy URL-e.
  `page.url()` po ustabilizowaniu (2 s, próbkowane co 250 ms) —
  wszystkie 4 lądują na `/superadmin/customers`
  (`post-fix/redirect-handoff-results.json`, zrzut jednego celu:
  `post-fix/settings-billing-handoff-postfix-light.png` — realny Tenant
  Command Center, dane żywe, zero crasha):
  | Ścieżka | Tranzytowy URL (widoczny ~250-500ms) | page.url() po ustabilizowaniu |
  |---|---|---|
  | `/settings/billing` | `/superadmin/customers/commercial/billing` | `/superadmin/customers` |
  | `/settings/organization` | `/superadmin/customers/organizations` | `/superadmin/customers` |
  | `/organization/members` | `/superadmin/customers/users` | `/superadmin/customers` |
  | `/organization/domains` | `/superadmin?from=%2Forganization%2Fdomains` | `/superadmin/customers` |
- **Rdzeń naprawy `ba0a4759d2` potwierdzony w runtime**: `RedirectWithTracking`
  poprawnie rozpoznaje SUPERADMIN i najpierw kieruje na zróżnicowany,
  dedykowany cel (`superadminTo`) — widoczne tranzytowo w `page.url()` — oraz
  fallback dla `/organization/domains` poprawnie produkuje
  `/superadmin?from=<attempted path>`. **SUPERADMIN już NIGDY nie tranzytuje
  przez `/admin/*`** (nierenderowalny dla tej roli przez P0-guard) — to był
  właściwy defekt zgłoszony w TRI-MUST-04, i jest zamknięty.
- **Nowa, drugorzędna obserwacja (NIE część zakresu TRI-MUST-04, nie otwiera
  z powrotem P0)**: `SuperAdminView.tsx:83-95` wybiera renderowaną zakładkę na
  podstawie stanu `currentView` w Zustand, nie na podstawie URL. `<Navigate
  to={superadminTo} replace>` zmienia tylko lokalizację przeglądarki, nigdy nie
  wywołuje `setCurrentView(...)`. Ponieważ `currentView` zostaje z poprzedniego
  mapowania AppView (np. `SETTINGS_BILLING`, `ORGANIZATION_PROFILE` —
  nierozpoznane jako `SUPERADMIN_*`), efekt normalizujący w `SuperAdminView`
  (istniejący wcześniej, niezwiązany z tą naprawą) odbija DRUGI raz na ogólny
  `/superadmin/customers` w ~250-500ms, gubiąc zróżnicowany cel i `?from=`.
  Efekt: użytkownik i tak ląduje na ogólnym Tenant Command Center, nie na
  konkretnej zakładce (commercial/billing, organizations, users) ani z
  zachowanym `?from=`. Brak crasha, brak białego ekranu, brak błędu konsoli
  (tylko istniejące wcześniej `[SuperAdminView] Falling back to command
  center for: ...`). Traktuję jako kontynuację P2 z pierwszej weryfikacji
  (UX, nie bezpieczeństwo) — do rozważenia: zsynchronizować `currentView` z
  URL przy montowaniu `SuperAdminView` (np. `getAppViewFromRoute(location.
  pathname)`, które istnieje w `src/routes/routeConfig.ts:636` ale nie jest
  nigdzie wołane).

### Dowód 3 — Kontrola negatywna izolacji: **OK**
- Konto `w3.admin.foreign.owner@local.test` (OWNER, organizacja
  `...002`, BEZ wiersza `organization_members` dla organizacji `...001`)
  → `GET /api/organizations/14000000-0000-4000-8000-000000000001/members`
  → **403** `{"error":"Access denied","code":"ORG_MEMBERSHIP_REQUIRED"}`.
- Kontrola pozytywna tym samym tokenem/endpointem na WŁASNEJ organizacji
  (`...002`) → **200**, zwraca 2 członków — dowód, że endpoint nie jest
  ślepo zablokowany dla każdego, tylko poprawnie liczy membership
  (`post-fix/negative-control-network.json`). Izolacja organizacyjna
  NIE osłabiona żadną z dwóch napraw.

### Sprzątanie (ta powtórka)
- Backend (`tsx server/src/index.ts`, port 4430) i frontend (`vite`, port
  4431) zatrzymane (`pkill`), `lsof` po zamknięciu — oba porty wolne.
- Kontener Docker `consultify-m03-admin-evidence-20260824b` (własny,
  jednorazowy) zatrzymany i usunięty (`docker rm -f`).
- Oryginalny, współdzielony kontener `consultify-w3-recovered-fixtures-20260823`
  — nietknięty (tylko odczyt przez zapytania SQL punktowe), nadal działa.
- Port `3987` żywy, chronione porty {3940,3941,4363,4364,4402,4403,4420,4421}
  — nietknięte (zweryfikowano `lsof` przed i po; żaden inny kontener/proces
  nie ruszany — w tym gałąź `codex/m03-admin-20260824`, na której równolegle
  pracuje Codex, pozostawiona bez zmian w kodzie: ta weryfikacja modyfikowała
  WYŁĄCZNIE pliki w `evidence-superadmin-20260824/` + ten log).
- Plik `.env.local` i pliki tymczasowe (`scratch_superadmin_postfix_capture.mjs`,
  `scratch_copy_fixture.mjs`) usunięte z worktree po zakończeniu.
