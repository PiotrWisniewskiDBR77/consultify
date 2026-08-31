---
doc_id: funkcje-inwentarz-pominiec-20260831
status: canonical
owner: piotr
truth_type: measurement
established: 2026-08-31
---

# Inwentarz pominięć testów (Z31 detektor, pozycja 2)

Mechaniczny pomiar wszystkich `describe.skip`/`it.skip`/`test.skip`/`*.skipIf(`
w repo na tipie `044d3f822f` gałęzi `codex/m03-admin-20260824` (branch roboczy
`feat/detektor-klamstw-20260831`), 2026-08-31. Cel: zamienić „ktoś kiedyś
zauważy” w mechaniczny pomiar, sklasyfikować ~600 pominięć tak, żeby dało się
nimi zarządzać, i wynieść dziesięć najgroźniejszych na wierzch.

## Metodologia — i jedna pułapka złapana we własnym pomiarze

Surowy `rg` po `(describe|it|test)\.(skip|skipIf)\(` dał **599** trafień —
bardzo blisko baseline'u nadzorcy (600). Ale zanim temu zaufałem, sonda
została zweryfikowana na znanym przypadku (zasada z 31.08: „waliduj własną
sondę, zanim jej zaufasz") — i złapała samą siebie na kłamstwie: **7 z tych
599 trafień leżało wewnątrz komentarzy**, nie w kodzie. Ten sam blok
komentarza — *„FIX-5 (odbiór dyżuru 33) — DRUGI ZAMEK, niezbędny: vitest
4.1.8 URUCHAMIA hooki beforeAll/afterAll suity oznaczonej `describe.skipIf(true)`"*
— jest wklejony w pięciu plikach `day33.*.pg.test.ts` i dosłownie **cytuje**
`describe.skipIf(true)` jako przykład w prozie. Naiwny regex to złapał jako
kod. Naprawiono: pisarz zdań stripuje `//` i `/* */` (z poszanowaniem stringów)
przed dopasowaniem, co dało **578** prawdziwych trafień w kodzie.

Dalej: pierwsza automatyczna klasyfikacja nadmiernie karała jako „zapomniane”
pozycje, które w rzeczywistości są udokumentowane — tylko nie linijka-nad-linijką:
komentarz-uzasadnienie bywa nad całym blokiem `describe` (nie nad pojedynczym
`it.skip`), bywa w treści samej nazwy testu (`'... [caboose]'`,
`'... (requires auth)'`), albo jest pierwszą linią **wewnątrz** ciała callbacku
zamiast nad nim. Klasyfikator przeszedł cztery iteracje (v1→v4) rozszerzające
wykrywanie uzasadnienia; różnica między v1 (68 „zapomnianych”) a finalną wersją
(7) została zweryfikowana ręcznie, oczami, plik po pliku — nie tylko regexem.
Kod sond: `scripts/dev/z31-skip-classifier/` (kopia w `/private/tmp/...scratchpad`,
patrz sekcja Sprzątanie).

## Wynik: A/B/C na 578 rzeczywistych pominięciach

| Kategoria | Definicja | Liczba |
|---|---|---|
| **A** — warunkowe od środowiska/runtime | `skipIf(cond)` lub Playwright `test.skip(cond, reason)` z prawdziwym warunkiem (nie `true`), bez sąsiadującego uzasadnienia | **247** |
| **B** — trwałe i NIEuzasadnione | `describe.skip('nazwa', fn)`/`it.skip(...)`/bare `test.skip()`, zero komentarza obok, zero wbudowanego powodu, nazwa testu się nie tłumaczy | **7** |
| **C** — uzasadnione (komentarzem, wbudowanym `reason`, albo samo-tłumaczącą nazwą/tagiem) | cokolwiek z widocznym „dlaczego” w promieniu kodu | **324** |
| **Razem** | | **578** |

### A — 247 warunkowych: rozbicie i pytanie o „ciche czy jawne”

- **238** warunkuje się na środowisko/dane uwierzytelniające (DB, klucz API,
  token, `RUN_DB_TESTS`/`MOCK_DB`, `hasAuth()`, `E2E_*`) — to jest właściwy
  wzorzec Z31-sąsiad: `describe.skipIf(!REAL_PG)` i podobne.
- **9** warunkuje się na coś innego (flaga funkcji, stan UI w runtime typu
  „element nie widoczny headless”, np. `!mapperExists`, `[404,503].includes(...)`.

**Czy dają jawną porażkę czy ciche exit 0, gdy warunek fałszywy?** Mechanicznie
— **wszystkie 247 dają ciche `exit 0`** (status „skipped”, nie „failed”). To
nie jest defekt pojedynczej pozycji, to jest **definicja `skipIf`/`test.skip`**:
nie istnieje wariant, który jednocześnie pomija test warunkowo I rzuca wyjątkiem,
gdy warunek nieprawdziwy — rzucenie wyjątku wewnątrz gate'u zamieniłoby go w
`assertRealPostgresTestEnvironment`-owy „fail-closed”, nie w `skipIf`.

To co RÓŻNI poszczególne pozycje to obecność **drugiej, niezależnej bramki**
(fail-closed) w środku `beforeAll`, która łapie inny, węższy przypadek (np.
zmienne są ustawione, ale połączenie mimo to jest fałszywe). Zmierzone:
spośród **261 unikalnych plików** z warunkiem środowiskowym typu A, tylko
**25** wywołuje w środku `assertRealPostgresTestEnvironment(...)` lub
`assertRealDatabase(...)` (druga, twarda bramka). **236 plików polega
WYŁĄCZNIE na warunku `skipIf`** — jeśli CI kiedykolwiek nie ustawi
`RUN_DB_TESTS=1`/`MOCK_DB=false` (literówka, regresja configu, warunek wyścigu
w setupie), wszystkie te 236 apartamentów testowych — w tym większość plików
`finance-v2`, `pmo`, `audits`, `interviewDelivery` — cicho zazieleni się jako
„skipped”, nie „failed”. To pojedynczy punkt awarii dla całej klasy testów
bezpieczeństwa/finansów/dzierżawy. Nie jest to nowy Z31 (nie pinuje NAZWY bazy),
ale jest strukturalnie tym samym ryzykiem klasy: cichy `exit 0` zamiast czerwieni.

### B — 7 trwałych i niewytłumaczonych

| plik:linia | co jest wyłączone | od kiedy (git) |
|---|---|---|
| `tests/acceptance/h31-swot-flow.e2e.test.ts:672` | `it.skip('creates one canonical generated report, reopens and exports it, deduplicates, and isolates tenants')` — **duplikat** pełnego E2E flow (utwórz→zaakceptuj→promuj→odczytaj→dedup→izolacja dzierżawcy) SWOT, który już przechodzi (zielono) kilkaset linii wyżej w tym samym pliku, w innym `it(...)`. Zero komentarza. | 2026-08-02, `d20fbac2d4` |
| `tests/e2e/i18n/rtl-arabic.spec.ts:295` | `test.describe.skip('Dropdown/Select Menus')` — cała podgrupa RTL | 2026-03-03, `bb545034c5` (od stworzenia pliku) |
| `tests/e2e/i18n/rtl-arabic.spec.ts:315` | `test.describe.skip('Breadcrumbs')` | 2026-03-03 |
| `tests/e2e/i18n/rtl-arabic.spec.ts:332` | `test.describe.skip('Progress Bars')` | 2026-03-03 |
| `tests/e2e/i18n/rtl-arabic.spec.ts:354` | `test.describe.skip('Tables')` | 2026-03-03 |
| `tests/e2e/i18n/ui-elements.spec.ts:226` | `test.describe.skip('Modal Close Button')` | 2026-03-03 |
| `tests/e2e/i18n/ui-elements.spec.ts:279` | `test.describe.skip('Toast Messages')` | 2026-03-03 |

6 z 7 to kosmetyka i18n/RTL (layout mirroring), nie dotyka bezpieczeństwa,
pieniędzy ani danych klienta. **1 z 7** (h31-swot-flow) dotyka izolacji
dzierżawców — patrz pozycja 1 na liście dziesięciu poniżej.

### C — 324 udokumentowanych: jak wygląda dobry wzorzec

Trzy uczciwe podwzorce widoczne w kodzie, warte nazwania (nie trzeba ich
naprawiać):
1. **Odsyłacz do dowodu gdzie indziej** — `tests/e2e/m06/m06-16-collab.spec.ts:72`:
   *„Cross-org WS reject verified by integration suite ideaCollabWs.orgscope.test.ts
   (6/6 PASS, L-01 CLOSED). E2E two-browser cross-org test not needed — would
   duplicate existing coverage."* — pominięcie bezpieczeństwa uzasadnione
   wskazaniem KONKRETNEGO, przechodzącego testu gdzie indziej.
2. **`[MANUAL]` z instrukcją weryfikacji** — 174 pozycje w `tests/e2e/m06/*`
   (Mind Map) i pokrewnych: `test.skip(true, '[MANUAL] ... Verify manually: ...')`.
   Zawsze pominięte (warunek `true`), ale z akapitem instrukcji, co i jak
   sprawdzić ręcznie, i czasem odsyłaczem do pliku:linii komponentu.
3. **Tag `[caboose]` w nazwie** — patrz pozycja 2/3 na liście niżej: tag
   jest realną dokumentacją (odsyła do konkretnego środowiska), ale **sam tag
   nie dowodzi, że to środowisko nadal istnieje**.

## Dziesięć najgroźniejszych (kryterium: bezpieczeństwo / pieniądze / dane klienta)

Podano mniej niż 10 pozycji o realnej wadze bezpieczeństwa/pieniędzy/danych
klienta — po ręcznym przejrzeniu WSZYSTKICH pominięć na ścieżkach
security/tenant/auth/billing/finance/confidential/admin (101 trafień) większość
to poprawny, standardowy wzorzec opt-in (`skipIf(!REAL_PG)`), nie coś
niebezpiecznego. Uczciwie: to dobra wiadomość, nie luka w pomiarze — patrz
metodologia wyżej i próbka 60 pozycji ręcznie zweryfikowanych w
`skip_inventory_final.json`. Poniżej wszystko, co faktycznie zasługuje na
uwagę, od najgroźniejszego:

1. **★★★ REALNA DZIURA, nie pominięcie testu — znaleziona PRZY OKAZJI tego
   pomiaru, NIE ŁATANA (zgodnie z poleceniem).**
   `server/src/services/aiSettingsService.ts:606-615` (`assignUserTier`) robi
   bezwarunkowy UPSERT `(organization_id, user_id, tier)` do `ai_user_tiers`
   **bez sprawdzenia, że `user_id` należy do `organization_id`**. Obie trasy,
   które to wywołują — `server/src/routes/ai-settings.routes.ts:728-763` i
   `server/src/routes/ai/ai-settings.routes.ts:769-799` — sprawdzają, że
   WOŁAJĄCY jest adminem `:orgId`, ale **nigdy nie sprawdzają, że `:userId`
   (parametr trasy) należy do `:orgId`**. Skutek: admin organizacji A może
   wywołać `PUT /api/ai-settings/org/{orgA}/users/{dowolny-userId}/tier` i
   zapisać wpis tieru AI dla userId z organizacji B (albo nieistniejącego) pod
   `organization_id=orgA`. Dokładnie to miał złapać
   `tests/unit/backend/aiSettingsService.test.ts:511`
   (`it.skip('should throw error if user does not belong to organization', ...)`,
   oczekuje `.rejects.toThrow('User does not belong to this organization')`) —
   test jest w pliku wyłączonym od 2026-01-24 (`17d7557db4`) z powodu
   niezwiązanego niedopasowania kształtu API (patrz komentarz w pliku,
   linie 95-109), więc ta konkretna, realna luka nigdy nie miała szansy się
   zaświecić na czerwono. **Nie naprawiłem. Zgłaszam do osobnego odbioru
   adwersaryjnego.**

2-4. **Bramki poufności decków bez żywej weryfikacji środowiska.**
   `tests/integration/presentations/confidentiality-controls.test.ts:116,127,138`
   — trzy testy sprawdzające wymuszanie polityki poufności prezentacji (403
   `CONFIDENTIALITY_POLICY_BLOCKED` przy eksporcie, 403
   `CONFIDENTIALITY_SHARE_REQUIRES_ADMIN` przy udostępnianiu) są otagowane
   `[caboose]` w nazwie — co samo w sobie jest dokumentacją (patrz Kategoria C),
   **ale** `tests/integration/_helpers/assertRealPostgres.ts:37` opisuje host
   `caboose.proxy.rlwy.net` jako *„Origin unresolved; retained defensively from
   a stale seed-script note"* — czyli nawet zespół nie jest pewien, że to
   środowisko istnieje. Jeśli nie istnieje, te trzy testy bezpieczeństwa
   NIGDY realnie nie biegną. Do sprawdzenia: czy `[caboose]` nadal wskazuje coś
   żywego (12 dalszych testów [caboose] w `p20-lifecycle.test.ts` i
   `p20-export-resilience.test.ts` ma tę samą wadę, niżej ryzyko bo dotyczą
   cyklu życia decka, nie poufności).

5. **Pojedynczy punkt awarii dla 236 apartamentów testowych bezpieczeństwa/
   finansów/dzierżawy** — patrz sekcja A wyżej. Nie jest to pojedyncza linia,
   to strukturalna obserwacja: `RUN_DB_TESTS`/`MOCK_DB` źle ustawione w CI ⇒
   cała ta populacja (finance-v2, pmo, audits, admin-iam, interviewDelivery,
   organizationContext...) cicho zazieleni się jako „skipped”. Warto
   zweryfikować w `.github/workflows/*.yml`, że te zmienne SĄ ustawiane na
   właściwym joba i że job kończy się niezerowym kodem, jeśli faktycznie
   zero testów DB-owych się wykonało (patrz też
   `scripts/testing/test-discovery-gate.ts` — czy sprawdza to mechanicznie).

6. **`h31-swot-flow.e2e.test.ts:672`** (patrz tabela B wyżej) — duplikat
   flow tworzenia/dedup/izolacji dzierżawcy raportu SWOT, permanentnie
   wyłączony bez komentarza. Do zweryfikowania: czy przechodzący test wyżej w
   tym samym pliku faktycznie pokrywa dedup + izolację 1:1, czy usunięto
   asercję po drodze.

Uwaga o zakresie: powyższe 6 pozycji to WSZYSTKO, co znalazłem po przejrzeniu
101 trafień security/finance/tenant-path i ręcznym audycie 578-pozycyjnego
inwentarza pod kątem tekstu nazwy/warunku/`reason`. Nie naciągałem listy do
10 pozycjami o niskiej wadze (np. i18n-owe `B`) — kryterium było
bezpieczeństwo/pieniądze/dane klienta, nie „dowolne trwałe pominięcie”.

## Dane źródłowe

Pełny, przeklasyfikowany inwentarz (578 pozycji, pole `final_category`):
`scratchpad/skip_inventory_final.json` (sesja robocza, nie w repo — patrz
Sprzątanie w raporcie końcowym). Skrypty klasyfikujące (`classify_skips_v3.py`,
`classify_skips_v4.py`, `strip_comments.py`) tamże.
