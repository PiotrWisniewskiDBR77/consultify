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
