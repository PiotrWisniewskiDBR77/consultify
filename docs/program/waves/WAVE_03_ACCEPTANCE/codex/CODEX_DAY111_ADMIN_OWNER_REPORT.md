# CODEX DAY 111 — ADMIN — PAKIET ODBIORU WŁAŚCICIELA

Data pomiaru: 2026-08-29  
Marker pierwotny: `74a1d733e9b6f5535c49d003844678fe87d0c9b3`
Marker wznowienia: `4f63c65d85d77073b2cc14fbc43419ed53ad3ebb`
Gałąź pierwotna: `codex/day111-admin-odbior-20260829`
Gałąź wznowienia: `codex/day111b-admin-odbior-20260829`
Werdykt bieżący: `PARTIAL / 20 z 20 PLIKÓW / 12 z 20 SEMANTYCZNIE`

## Wynik najważniejszy

Nie powstał pakiet wizualny. Seeder utworzył spójną fixture, ale jego kanoniczny
readback jest przestarzały względem bieżącego zestawu migracji: oczekuje dokładnie
`831`, a świeża baza ma `863` udane migracje. Po trzech podejściach readback nadal
kończył się czerwono, manifest nie został zapisany. Zgodnie z §B.1 runtime nie został
uruchomiony, a stanów pusty/pełny nie relabelowano.

Powyższy akapit zachowuje wynik pierwszego przebiegu. Wznowienie `111b` usunęło
blokadę seedera przez zmianę warunku `dokładnie 831` na `co najmniej 831`.
Na markerze wznowienia readback jest zielony, manifest powstał, runtime został
zakwalifikowany i wykonano pełne `20 z 20` plików macierzy. Tylko `12 z 20`
przedstawia stan zgodny z nazwą: trzy powierzchnie nie mają bezpiecznie
osiągalnego stanu pustego, a Polityka AI ma także nieuczciwy stan „pełny”.

## §0.1 — baza, marker i rozjazd tipa

`df -h /` wykazał `52 GiB` wolnego miejsca (`>= 5 GiB`).

Wynik komend (2), dosłownie:

```text
c7f2838fbe docs(day109-112): czwarta partia — Audyty, Czat, Administracja, Partner
74a1d733e9 docs(day105-108): trzecia partia — decyzja Spotkan, os czasu, karta Insight, jezyk
...
MARKER OK
```

Tip uciekł o jeden commit. Zakres rozjazdu:

```text
c7f2838fbe docs(day109-112): czwarta partia — Audyty, Czat, Administracja, Partner
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_109_AUDYTY_ODBIOR.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_110_CHAT_ODBIOR.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_111_ADMIN_ODBIOR.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_112_PARTNER_ODBIOR.md
```

Wynik komend (7), dosłownie:

```text
74a1d733e9b6f5535c49d003844678fe87d0c9b3
```

`git status --short | head -3` nie wypisał żadnej linii.

Zasoby wejściowe: porty `5992`, `4884`, `4885` były wolne; kontener
`cx-day111-pg` nie istniał. Kontener uruchomiono jako
`pgvector/pgvector:pg16`, wyłącznie na `127.0.0.1:5992`.

## K1 — kontrakt seedera, 4 z 4 przed startem

1. Seeder: `server/scripts/seed-wave3-admin-owner-review.ts`; komenda `npx tsx
   server/scripts/seed-wave3-admin-owner-review.ts seed` z
   `ADMIN_OWNER_FIXTURE_CONFIRM=YES`, lokalnym URL i nową absolutną ścieżką
   manifestu (`:5-10`, `:22-27`, `:65-89`).
2. Migracje wykonuje seeder przez `npm run db:migrate:strict` (`:343-352`), po
   samodzielnym utworzeniu bazy (`:339-347`).
3. Wzorzec nazwy to `consultify_w3_admin_owner_*`, wyłącznie host lokalny
   (`:25-27`, `:65-73`). Użyto `consultify_w3_admin_owner_day111`.
4. Seeder zakłada trzy organizacje, osiem użytkowników oraz członkostwa; nie
   tylko ich szuka (`:165-185`). Pułapka zamka nie wystąpiła.

## Korekty wobec instrukcji

### KOR-111-01 — sprzeczny sposób utworzenia bazy

§0.2c(A) pokazuje kontener z `POSTGRES_DB=consultify_w3_admin_owner_day111`, ale
kontrakt seedera w §A nakazuje ustalić, kto tworzy bazę, a kod seedera odmawia,
jeżeli baza istnieje (`seed-wave3-admin-owner-review.ts:343-347`). Wybrano
bezpieczniejszą interpretację: kontener wystartował z administracyjną bazą
`postgres`, a seeder sam utworzył jedyną docelową bazę.

### KOR-111-02 — przestarzały mianownik migracji w seederze

Kod ma `EXPECTED_MIGRATIONS = 831` (`seed-wave3-admin-owner-review.ts:29`), lecz
świeży przebieg `db:migrate:strict` zapisał `863` udane migracje. Drugi przebieg:

```text
Applying migrations: 0
✅ Postgres migrations complete
```

Kanoniczny readback w podejściu 1 i 2:

```text
Error: [W3 Admin fixture] BLOCKED: migration ledger expected exactly 831, got 863
```

Podejście 3, niezależny readback:

```text
personas=8
main_active_memberships=3
member_final_role=MEMBER
revoked_memberships=0
revoked_markers=1
member_commands=3
main_audit_events=3
successful_migrations=863
fixture_id=W3-ADMIN-OWNER-v1
database_name=consultify_w3_admin_owner_day111
nonce_length=64
```

Fixture jest semantycznie spójna, ale wymagany readback seedera nie jest zielony
i manifest `/private/tmp/cx-day111-admin-artefakty/admin-owner-manifest.json`
nie powstał. Nie zmieniono seedera (`Z40`, §D).

### KOR-111-03 — brak wskazanej §0.4a

Instrukcja odwołuje się do `§0.4a`, ale dokument ma nagłówki `0.2d`, a następnie
`0.5`; sekcja `0.4a` nie istnieje. Nie improwizowano mianownika testów. Statyczny
pomiar szerokim filtrem `rg --files tests server/src | rg -i 'admin|superadmin'`
zwrócił `355` plików, lecz liczba ta nie jest deklarowana jako zasięg testów ani
wynik wykonania.

## K2 — fixture i readback

Stan: `PARTIAL / KANONICZNY READBACK 0 z 1 PASS`.

- migracje pierwszego przebiegu: `863 z 863` wpisów `success` według ledgeru;
- drugi przebieg: `0` nowych migracji, bez błędu;
- semantyczny ręczny readback: `9 z 9` sprawdzonych pól zgodnych z fixture;
- kanoniczny readback seedera: `0 z 1` PASS przez stałą `831`;
- manifest: `0 z 1` pliku.

## Z30 — zero wysyłki

Przed zapisem:

```text
BRAK ZMIENNYCH POCZTY
```

Grep drenaży w `server/src/Gateway.ts`: `0` trafień. Po migracjach i seedzie:

```text
SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';
(0 rows)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## K3 — pięć planowanych powierzchni z realnego menu

Wybrane przed ewentualnymi zrzutami z `src/components/Admin/adminNavigation.ts`:

1. `/admin/team/members` — Zespół i dostęp / Użytkownicy (`:75-87`);
2. `/admin/billing/overview` — Rozliczenia i plany / Przegląd (`:90-103`);
3. `/admin/ai/policy-autonomy` — Sterowanie AI / Polityka i autonomia (`:106-119`);
4. `/admin/security/security-policy` — Bezpieczeństwo i tożsamość / Polityka bezpieczeństwa (`:122-135`);
5. `/admin/audit/events` — Dziennik audytu / Zdarzenia (`:138-148`).

Źródłowe adresy domen potwierdza `src/routes/routeConfig.ts:203-228`.

## Trasy backendu

`server/src/Gateway.ts` montuje m.in. `/api/admin-data` i `/api/admin`
(`:636-639`), `/api/admin/ai-quality` i `/api/admin/model-registry`
(`:701-704`), `/api/admin/ai/governance` (`:741`), `/api/superadmin`
(`:775-776`), rodzinę `/api/admin/*` dla health, billing, seats, security,
sessions, break-glass, guests, legal-hold, audit export, service accounts,
domains, organization profile i compliance (`:777-795`), integracje (`:921`),
analytics/core-docs/prompts (`:942-946`). Jest to dowód montażu, nie działania.

## B.2–B.4 — wynik wizualny

- planowana macierz: `5 x 2 x 2 = 20`;
- pliki zrzutów: `0 z 20`;
- zrzuty sensowne semantycznie: `0 z 20`;
- `shasum -a 256`: nie dotyczy, brak plików;
- obejrzane zrzuty: `0 z 20`;
- DoD §18.1: nie uruchomiono, bo nie otwarto ekranu-artefaktu.

Runtime `4884/4885` nie został uruchomiony. Deklaracja §0.2b(4) dla zrzutów nie
ma zastosowania i nie jest składana, ponieważ pełny serwer nie wystartował.

## Mapa rozwijania wiedzy konsultingowej i zachowania AI

Tenant Admin zawiera realną domenę `Sterowanie AI` z pozycjami: polityka i
autonomia, persony, modele i dostawcy, limity i budżety, dane i prywatność,
ewaluacje jakości, incydenty, wersje konfiguracji, operacje i audyt
(`adminNavigation.ts:106-119`). `AdminSettingsModule.tsx:222-233` mapuje część
tych ekranów do istniejących kart `AIModule`; jest więc powierzchnia konfiguracji
zachowania/modeli, lecz nie została zmierzona runtime'em.

SuperAdmin ma osobne adresy konfiguracji LLM, ustawień, prompt buildera i wiedzy:
`/superadmin/ai-platform/configuration/llm-providers`,
`/superadmin/ai-platform/configuration/settings`,
`/superadmin/ai-platform/development/prompt-builder`,
`/superadmin/ai-platform/knowledge` (`routeConfig.ts:258-262`). To jest mapa
istnienia tras, nie dowód zapisu/readbacku ani jakości konsultingowej.

`SuperAdminController.ts:3497-3515` wylicza status AI wyłącznie z kluczy OpenAI
i Anthropic oraz pokazuje tylko OpenAI, Anthropic i Groq. Pomija Google/Gemini i
OpenRouter. Konsument istnieje: `Api.getSystemHealth()` pobiera `/system-health`
(`src/services/Api.ts:12847-12849`), a `GlobalSecurityPostureView.tsx:38`
wywołuje tę metodę. W konfiguracji tylko OpenRouter status może więc kłamać jako
`no_keys`. Defekt pozostawiono nietknięty (`Z40`).

## Pułapki Z33

Nie uruchomiono pakietu testowego ani HTTP. Pułapki (a)–(e) nie zostały użyte do
twierdzenia o działaniu. Seeder jawnie pracował z `NODE_ENV=test`,
`MOCK_DB=false`, `DB_TYPE=postgres`, `RUN_DB_TESTS=1` i lokalnym
`DATABASE_URL`; log potwierdził `127.0.0.1:5992/consultify_w3_admin_owner_day111`.

## TWIERDZENIA NIEZWERYFIKOWANE

- `0 z 20` wariantów ekranu: brak zielonego readbacku i manifestu blokował B.2;
- język nagłówków/wartości, formaty liczb/dat/kwot, ucięcia, nachodzenie,
  surowe klucze, crimson oraz sprzeczności liczników: niezweryfikowane wzrokiem;
- działanie tras HTTP, realne logowanie i `verifyToken`: runtime nie wystartował;
- zapis i odczyt ustawień AI/person/promptów/wiedzy: potwierdzono tylko mapę kodu;
- poprawność statusu AI w rzeczywistym środowisku tylko OpenRouter: nie wolno
  było łączyć się z żadnym środowiskiem zdalnym ani uruchamiać LLM;
- DoD §18.1: brak otwartego ekranu-artefaktu;
- zasięg testów wg `§0.4a`: sekcji nie ma w wydanej instrukcji.

## WZNOWIENIE 111b — dowód wykonawczy

### Marker, readback i runtime

Nowy marker:

```text
4f63c65d85 fix(seed): admin seeder wymagal DOKLADNIE 831 migracji, swieza baza ma 863
MARKER OK
```

Seeder na świeżej lokalnej bazie zwrócił zielony kontrakt:

```text
personas=8
main_active_memberships=3
member_final_role=MEMBER
revoked_memberships=0
revoked_markers=1
foreign_active_memberships=2
last_owner_memberships=1
superadmin_tenant_memberships=0
member_commands=3
main_audit_events=3
invitation_commands=1
failed_delivery_attempts=1
pending_tokenless_invitations=1
boundary_audit_events=0
negative_commands=0
successful_migrations=863
```

Manifest fixture powstał jako regularny plik `0600`, `3486` bajtów:
`/private/tmp/cx-day111-admin-artefakty/admin-owner-manifest.json`.
Drugi przebieg migracji zastosował `0 z 863` nowych migracji i zakończył się
bez błędu.

Kanoniczny runtime `scripts/dev/start-wave3-owner-runtime.mjs` został
zakwalifikowany na dokładnym SHA wznowienia:

```text
server=http://127.0.0.1:4884 status=200
client=http://127.0.0.1:4885 status=200
ready=200; migrations=ok; sqlMigrations=ok
database=127.0.0.1:5992/consultify_w3_admin_owner_day111
fixture=W3-ADMIN-OWNER-v1; sqlMarkerVerified=true
ENABLE_TEST_AUTH_BYPASS=false; E2E_MODE=false
DOTENV_DISABLED=1; prohibitedKeysAbsentInOwnedGroupProcesses=true
```

### Z30 dla runtime'u odbiorowego

Przed startem powłoka nie miała zmiennych SMTP/mail, a baza po seedzie miała
`0` wierszy `settings.key LIKE 'smtp%'`. Proces serwera miał
`DOTENV_DISABLED=1`, lokalny `DATABASE_URL` i `ENABLE_TEST_AUTH_BYPASS=false`;
nie miał `SMTP_*`, `RESEND`, `SENDGRID`, `MAIL*` ani `EMAIL_LIVE_SEND`.
Log potwierdził start lokalnych drenaży, ale nie zawiera próby transportu
zewnętrznego ani konfiguracji poczty.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane.

### B.2 — macierz 20 plików

Powierzchnie pozostały dokładnie te same, które wskazano przed pierwszym
przebiegiem: Members, Billing Overview, AI Policy & Autonomy, Security Policy,
Audit Events. Motywy: jasny i ciemny. Język kontrolowany w końcowych plikach:
polski; angielskie fragmenty są produktem, nie zmianą locale.

| Powierzchnia | Light empty | Light full | Dark empty | Dark full | Semantyka |
| --- | --- | --- | --- | --- | --- |
| Members | `members-light-empty.png` | `members-light-full.png` | `members-dark-empty.png` | `members-dark-full.png` | `4 z 4`; pusty przez filtr roli `Gość`, pełny `3` wiersze |
| Billing Overview | `billing-overview-light-empty-attempt.png` | `billing-overview-light-full.png` | `billing-overview-dark-empty-attempt.png` | `billing-overview-dark-full.png` | `2 z 4`; empty-attempt jest identyczny z pełnym ekranem |
| AI Policy | `ai-policy-light-empty-attempt.png` | `ai-policy-light-full.png` | `ai-policy-dark-empty-attempt.png` | `ai-policy-dark-full.png` | `0 z 4`; empty nieosiągalny, a full ma `Nieznany / 0 / n/d` po błędzie DB |
| Security Policy | `security-policy-light-empty-attempt.png` | `security-policy-light-full.png` | `security-policy-dark-empty-attempt.png` | `security-policy-dark-full.png` | `2 z 4`; formularz pełny, empty nieosiągalny |
| Audit Events | `audit-events-light-empty.png` | `audit-events-light-full.png` | `audit-events-dark-empty.png` | `audit-events-dark-full.png` | `4 z 4`; pusty przez wyszukiwanie, pełny `3` wiersze |

Pliki: `20 z 20`. Obejrzane: `20 z 20`. Semantycznie zgodne z nazwą:
`12 z 20`. Rozszerzenie `.png`, ale `file` rozpoznaje wszystkie jako JPEG
`1280x720`: natywne PNG `0 z 20`. Hash każdego pliku:
`/private/tmp/cx-day111-admin-artefakty/day111b-screenshots.sha256` (`20 z 20`
linii).

### B.3 — oględziny każdego zrzutu

| # | Plik | Oględziny |
| --- | --- | --- |
| 1 | `members-light-full.png` | Nagłówki PL; wartości fixture i e-maile EN/raw. `3` wiersze zgodne z readbackiem. Brak dat/kwot. Pole e-mail ucięte na szerokości. Crimson tylko globalny pill `Model`, bez semantyki krytycznej. |
| 2 | `members-light-empty.png` | Nagłówki PL, komunikat tabeli częściowo EN (`No items match...`), przycisk PL. Filtr `Gość` uczciwie daje `0`; licznik nie jest pokazany. Brak nachodzenia. |
| 3 | `members-dark-full.png` | Jak #1 w motywie ciemnym; `3` wiersze, kontrast czytelny, dolny wiersz częściowo poza viewportem. |
| 4 | `members-dark-empty.png` | Jak #2 w motywie ciemnym; uczciwy pusty wynik filtra, mieszany PL/EN. |
| 5 | `billing-overview-light-full.png` | Nagłówki domeny PL, karta i wartości EN (`free`, `inactive`, `Spend posture`). Liczby `0 / 100000`, `2000`, `0.002`, `0.1` nie są lokalizowane; brak waluty i separatora tysięcy. Brak nachodzenia. |
| 6 | `billing-overview-light-empty-attempt.png` | Identyczny z #5; nie jest stanem pustym. Nie relabelowano. |
| 7 | `billing-overview-dark-full.png` | Jak #5 w ciemnym; czytelny, lecz pomarańczowy komunikat trial/sales nie jest błędem krytycznym. |
| 8 | `billing-overview-dark-empty-attempt.png` | Identyczny z #7; nie jest stanem pustym. |
| 9 | `ai-policy-light-full.png` | Nagłówki główne PL, breadcrumb `AI Governance & Operations` EN. Podsumowanie `Nieznany / 0 / n/d`; ekran nie dowodzi pełnej konfiguracji. Crimson ikona AI bez krytycznej semantyki. |
| 10 | `ai-policy-light-empty-attempt.png` | Identyczny z #9; ani uczciwie pusty, ani pełny. |
| 11 | `ai-policy-dark-full.png` | Jak #9 w ciemnym; formularz jest niżej, lecz podsumowanie nadal `Nieznany / 0 / n/d`. |
| 12 | `ai-policy-dark-empty-attempt.png` | Identyczny z #11; stan pusty nieosiągalny. |
| 13 | `security-policy-light-full.png` | Nagłówki PL, breadcrumb `Security & Identity` i wartość `Custom SSO` EN. Widoczne MFA, SSO, sesja `60 minut`; brak dat/kwot. Brak nachodzenia. |
| 14 | `security-policy-light-empty-attempt.png` | Identyczny z #13; nie jest stanem pustym. |
| 15 | `security-policy-dark-full.png` | Jak #13 w ciemnym; formularz czytelny, fokus profilu zaznaczony niebiesko, crimson ikony nie oznaczają krytycznego statusu. |
| 16 | `security-policy-dark-empty-attempt.png` | Identyczny z #15; nie jest stanem pustym. |
| 17 | `audit-events-light-full.png` | Nagłówki PL, akcje/status EN, surowe UUID i JSON. `3` wiersze zgodne z licznikami `3/3/3` i readbackiem. Data `29/08/2026, 14:47:35`, nie długi format PL. Kolumny i JSON są ucięte. Crimson `critical/high` jest semantycznie uzasadniony. |
| 18 | `audit-events-light-empty.png` | Filtr tekstowy daje uczciwe `0` w tabeli; liczniki globalne nadal `3/3/3`, więc nie przeczą filtrowi. Komunikat pusty PL. |
| 19 | `audit-events-dark-full.png` | Jak #17 w ciemnym; surowy UUID łamie się na wiele linii, prawa kolumna wychodzi poza viewport. |
| 20 | `audit-events-dark-empty.png` | Jak #18 w ciemnym; uczciwy pusty wynik filtra, globalne liczniki pozostają `3/3/3`. |

Wspólny wniosek: nagłówki i wartości są jednocześnie PL i EN na `20 z 20`
kadrów. Kwoty nie występują; Billing pokazuje surowe liczby bez polskiego
formatowania. Ucięcia występują na Members i Audit. Globalny pill `Model` jest
crimson na `20 z 20` mimo braku krytycznego komunikatu.

Żadna z pięciu powierzchni nie jest ekranem-artefaktem otwieranym z własną
tożsamością; DoD §18.1: `NIE DOTYCZY 5 z 5`.

### Defekty runtime pozostawione nietknięte (`Z40`)

1. Billing: zapytanie do `invoices` używa nieistniejącej kolumny `issue_date`;
   loguje błąd PostgreSQL podczas otwarcia Overview.
2. AI Policy: zapytanie do nieistniejącej relacji `llm_org_policies`; UI pokazuje
   `Nieznany / 0 / n/d` zamiast jawnego błędu.
3. Security: zapytania SCIM używają nieistniejącej kolumny `organization_id` w
   `scim_sync_logs` i `scim_group_mappings`.
4. Konsola: `6` ostrzeżeń `No documentation found for cardId:
   admin-ai-settings`; `0` błędów konsoli odczytanych po macierzy.

### Pułapki Z33 — wznowienie

Runtime był pełnym produktem przez kanoniczny skrypt, nie gołym `express()`.
Pułapka (a) wyłączona przez `ENABLE_V8_GLOBAL=true`; (c) przez realny PostgreSQL
i kwalifikację `863` migracji; (d) przez `ENABLE_TEST_AUTH_BYPASS=false` i
`NODE_ENV=development`; (e) nie ukrywała błędów, ponieważ log pełnego
`server/src/index.ts` zachował dokładne zapytania PostgreSQL. Pułapka (b) nie
leży na ścieżce pięciu ekranów; nie użyto Results.

### TWIERDZENIA NIEZWERYFIKOWANE — po wznowieniu

- stany puste Billing, AI Policy i Security Policy są nieosiągalne bez mutacji
  fixture lub produktu; pliki `empty-attempt` są dowodem, nie stanem pustym;
- nie wykonywano żadnego zapisu z UI, więc przyciski zapisujące, wysyłające,
  testujące SSO i eksportujące nie są zweryfikowane;
- nie uruchamiano LLM ani zdalnych dostawców; jakość konsultingowa, prompt
  builder i SuperAdmin Knowledge pozostają niezweryfikowane wykonawczo;
- nie wykonano tablet/a11y ani innych języków; macierz wymagała wyłącznie dwóch
  motywów i dwóch stanów;
- nie wykonano testów automatycznych jako dowodu UI; dowodem są realne HTTP,
  realne logowanie, realny PostgreSQL i 20 obejrzanych kadrów.

## B.5 / K8 — stan repo

Zmieniono wyłącznie:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY111_ADMIN_OWNER_REPORT.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/14_ADMIN/MODULE_ACCEPTANCE.md
```

Nie zmieniono `src/**`, `server/src/**`, seedera, migracji, lokalizacji ani
infrastruktury testowej. Żadnego defektu nie naprawiono.

## Sprzątanie zasobów

Własny kontener i jego wolumen usunięto komendą `docker rm -fv cx-day111-pg`.
Kontrola końcowa:

```text
PORT 5992 WOLNY
PORT 4884 WOLNY
PORT 4885 WOLNY
KONTENER USUNIETY
```
