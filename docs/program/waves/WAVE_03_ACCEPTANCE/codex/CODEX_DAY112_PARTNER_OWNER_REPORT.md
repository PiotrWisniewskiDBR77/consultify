# Dyżur 112 — Partner — pakiet odbioru właściciela

Data pomiaru: 2026-08-29  
Marker i HEAD pomiaru: `74a1d733e9b6f5535c49d003844678fe87d0c9b3`  
Gałąź: `codex/day112-partner-odbior-20260829`  
Worktree: `/private/tmp/cx-day112-partner`  
Werdykt: **PARTIAL — 20/20 plików, 20/20 sensownych dowodowo, pakiet ujawnia defekty; bez zgody właściciela na PASS**.

## Stan wejściowy i rozbieżność tipa

Wynik markera:

```text
c7f2838fbe docs(day109-112): czwarta partia — Audyty, Czat, Administracja, Partner
...
74a1d733e9 docs(day86-88): wydaj trzy instrukcje odbioru sesji 3
MARKER OK
```

Sanity worktree:

```text
74a1d733e9b6f5535c49d003844678fe87d0c9b3
<brak wpisów status --short>
```

Tip był o jeden commit przed markerem:

```text
c7f2838fbe docs(day109-112): czwarta partia — Audyty, Czat, Administracja, Partner
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_109_AUDYTY_ODBIOR.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_110_CHAT_ODBIOR.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_111_ADMIN_ODBIOR.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_112_PARTNER_ODBIOR.md
```

Zgodnie z instrukcją pracę wykonano dokładnie z markera; scalenie tipa pozostaje nadzorcy.

## Kontrakt seedera — 4/4 przed startem

1. Seeder: `server/scripts/seed-wave3-partner-owner-review.ts`; uruchomienie przez `npx tsx ... --confirm-db=consultify_w3_partner_owner_day112` z pełnym lokalnym `DATABASE_URL` (`11–40`).
2. Migracje wykonuje operator osobno; seeder jedynie wymaga niepustego i w całości zielonego ledgera migracji (`114–122`).
3. Strażnik przyjmuje bezpieczną nazwę bazy oraz dokładne `--confirm-db`, a nie historyczny regex wskazany przez W3 (`11–40`).
4. Seeder zakłada organizacje, użytkowników i członkostwa; dowód INSERT: `164–195`. Nie tylko ich szuka.

## Baza, migracje i fixture

- Jednorazowy `pgvector/pgvector:pg16`: `cx-day112-pg`, host `127.0.0.1:5993`, DB `consultify_w3_partner_owner_day112`.
- Migracja 1: exit `0`; ledger po przebiegu: `863/863` successful, `0/863` failed.
- Migracja 2: exit `0`, `Applying migrations: 0`; idempotencja potwierdzona.
- Seeder: exit `0`; manifest `/private/tmp/cx-day112-partner-artefakty/partner-owner-manifest.json`, SHA-256 `276eb159022adc2790b6f3c1fff550533a5d55b17f327cb15f046690899fea94`.
- Readback bezpośrednio po seederze: bound partner `1`, certifications `2`, participant facts `1`, commissions `0`, payouts `0`.
- Kanoniczny runtime uzupełnił katalog certyfikacji; readback przed pełnymi zrzutami i po restore: migrations `863/863`, bound partner `1`, certifications `11`, attribution `1`, ledger `1`, settings `smtp%`: `0`.
- Stan pusty utworzono wyłącznie w lokalnej DB przez transakcję z `session_replication_role=replica`: usunięto ledger `1`, attribution `1`, certifications `11`; binding partnera zachowano `1`. Pierwsza próba bez obejścia append-only została wycofana w całości. Przed zmianą wykonano dump `/private/tmp/cx-day112-partner-artefakty/full-before-empty.dump`, SHA-256 `c6d07fc87284aff9135d898517e60ba7a63dc5fa52145015de46b5af61418f9e`, a pełny stan potem odtworzono.

Runtime pełny i pusty spełniły: health `200`, ready `200`, frontend `200`, SHA serwera i klienta zgodny z markerem, `ENABLE_TEST_AUTH_BYPASS=false`, V8 global `true`, dotenv isolation PASS. Log pełnego runtime ujawnił, że drenaże są uruchamiane bez konfiguracji transportu; nie wykonano operacji tworzącej wiadomości.

Trasy backendu ustalone greptem w `server/src/Gateway.ts`: `/api/public/partner` (`660`), `/api/public/partner-applications` (`668`), legacy `/api/partners` z nagłówkiem deprecacji do `/api/v8/partner` (`1308`), `/api/superadmin/partner-settlements` (`1309`), `/api/superadmin/partner-config` (`1310`) i `/api/superadmin/partner-outreach` (`1311`).

## Protokół Z30

Przed zapisami i runtime:

```text
env | grep ... => BRAK ZMIENNYCH POCZTY
SELECT ... FROM settings WHERE key LIKE 'smtp%'; => 0 rows
grep ... server/src/Gateway.ts => 0 trafień
```

„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.”

Powyższa deklaracja dotyczy pomiaru testowego. Dla zrzutów obowiązuje odrębna deklaracja:

„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.”

## Macierz zrzutów — K3/K4

Powierzchnie zadeklarowane przed pierwszym zrzutem: **Dashboard, Click Analytics, Commission Earnings, Organizations, Certificates — 5/5**. Każdą wykonano dla pustego i pełnego stanu oraz preferencji Light i Dark: **20/20 plików**. Wszystkie są sensowne dowodowo: **20/20**, przy czym 10/20 kadrów z wybraną preferencją Light dowodzi defektu motywu, bo produkt zachowuje ciemną paletę. Nie relabeluję ich jako poprawnego jasnego wyglądu.

| Powierzchnia / stan | Dark — obserwacja | Light — obserwacja |
| --- | --- | --- |
| Dashboard / full | Nagłówki EN, wartości PL/EN; surowe `earn`; `1/10`, attribution `1`, ledger `1`, `0,00 €`; bez kolizji po korekcie nakładki. | Preferencja Light i brak klasy `dark` potwierdzone w DOM, lecz paleta nadal ciemna; ta sama mieszana lokalizacja. |
| Dashboard / empty | Nagłówki głównie PL, wartości PL/EN; surowe `earn` i `certified`; szybkie akcje EN; `0/9`; stan pusty zamierzony. | Paleta jasna w tej sesji przeglądarki; nagłówki i wartości EN; licznik `0/9` zgodny z pustym stanem. |
| Click Analytics / full | EN; `0` clicks, `0` signups, `1 trials`, paid `0`, conversion `0%`; kod `W3PARTNER`; tabela kampanii pusta. Licznik trial nie przeczy fixture attribution `1`, ale pełny stan kampanii nie został zasiany. | Wybrano Light, render nadal ciemny; dane jak w Dark. Crimson występuje także jako akcent nawigacji/akcji, nie tylko semantyka krytyczna. |
| Click Analytics / empty | Nagłówki PL/EN, wartości `0 unique`, `0 trials`, `0 sources`, `0 tracked days` po EN; tabela pusta zgodnie z readback. | Paleta jasna; EN; zera zgodne z pustym stanem. |
| Commission Earnings / full | Kontrolowany ekran blokady `AMD-PRT-ECONOMICS-002`; brak kwot historycznych. Konsola/log: endpoint `/api/v8/partner/earnings-summary` odpowiada `500 PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER`. | Wybrano Light, render nadal ciemny; stan invariant wobec fixture. Nie jest dowodem pełnych danych ekonomicznych. |
| Commission Earnings / empty | PL z breadcrumbem EN; uczciwy stan polityki, lecz ten sam backend `500`. | Paleta jasna, komunikat EN; brak danych zgodny z policy gate. |
| Organizations / full | EN; 1 wiersz `Wave 3 Referred Participant`; StandardTable jest użyta — wcześniejsza teza Day69 obalona. Prawa kolumna jest ucięta przy viewport 1280. | Wybrano Light, render nadal ciemny; `ASSESSMEN...` i wartość `0/` ucięte. |
| Organizations / empty | PL; `Brak organizacji`; brak kolizji przy szerszym viewport. | Jasna paleta; EN; prawy nagłówek ucięty przy 1280 mimo pustej tabeli. |
| Certificates / full | EN; 1 certyfikat, data `22/08/2026` zamiast polskiego formatu słownego; surowy ID `W3-PARTNER-CERT-001`. | Wybrano Light, render nadal ciemny; te same dane. |
| Certificates / empty | PL/EN breadcrumb; uczciwe `Brak certyfikatów`. | Jasna paleta; EN; uczciwy empty state. |

Żadna z pięciu powierzchni nie jest ekranem-artefaktem otwieranym z tożsamością pojedynczego artefaktu; `DoD §18.1` = **N/A, 0/0 ekranów-artefaktów**.

## Sumy i checksumy

Pełna lista ścieżek oraz SHA-256 znajduje się w `/private/tmp/cx-day112-partner-artefakty`; kluczowe mianowniki: pliki `20/20`, obejrzane ze stylami `20/20`, sensowne dowodowo `20/20`, poprawnie renderujące odrębny jasny motyw `5/10`. Checksumy:

```text
ecbec5f9f958c7b451b1a6f0b6856176725a2312e8b6e2f076065e08696148f1  partner-dashboard-empty-dark.png
ab48c6208d0f35fdd3b495b2f1c8b64088a0a1ff85c9b2cd574f36c6214f0674  partner-dashboard-empty-light.png
7109dc006c455c30cd73408fd5f3388c88dccfd6fb1578a372afc82b1f266f20  partner-dashboard-full-dark.png
986cec56f8cb36c839b8ef76b997d84a99c279ee8d1d90f8fc396dd09af7f08b  partner-dashboard-full-light.png
574054b9765fbc7789d16346be75badbbc6ee2e23f061b0c284d7d2ea65a1e90  partner-click-analytics-empty-dark.png
858c33c6a54b04ba5a98d09122376326ebac7ee184d72250d5a4518e019a5ccd  partner-click-analytics-empty-light.png
b340a549139fcb2fb338d405df98f9a45edfc8fcbefbbbc8eedf5792fcd18567  partner-click-analytics-full-dark.png
e33a0fbad38276aa9137dbc09bd5d0f4df6998ed88eb65d9e1f182563e349d66  partner-click-analytics-full-light.png
9b51d4e33b92fb75a4e48931ac75d012736a48f81e03e9bcc9168cd22561ebb4  partner-commission-earnings-empty-dark.png
dead694500d1061643aad4fc731f64fbe60215ec34560d66287860eff0bbabcf  partner-commission-earnings-empty-light.png
2da4580fb545348c578a1fa5ecaaea30cca010b11433b5fca1cd5397d942dcfd  partner-commission-earnings-full-dark.png
b2080c3e120d62056a1ee33ee2e0d08fba4335df5a4f26f652cc86f65b519295  partner-commission-earnings-full-light.png
728c604b69f5fd01bd9605c47bc35cf1806e3cbf15d9cf6fbfdc39605654a965  partner-organizations-empty-dark.png
988a2f7e8c4a39a0352e83683fdf4e6c405000fb1d8581a6c9bdfcb3c45a3fab  partner-organizations-empty-light.png
2adafb270c02ad41170c1d11d7ddb24a39ab3975b01308dcbdf51c0c14f1ba30  partner-organizations-full-dark.png
2eb927eec6a168800438830b69a1d3fb3e1a31fef8fd7ee50b245b1b67e65c5f  partner-organizations-full-light.png
4452f788685f6cd0783a5867f8c70ec4f2606ac91da302c26f9fbf1125bf603c  partner-certificates-empty-dark.png
063681062fba1b843686c7adead4a96c8b5163f2e8edd8447e0a64cabeccdd6c  partner-certificates-empty-light.png
1dcbd63db6315eafbf9a7a296acbcd779fbd964b702ba9ab02576f97c1f073e0  partner-certificates-full-dark.png
668d5b9403c92c4d762dc0bf4e0c5a26be751febef9042881f163aa3afb241fb  partner-certificates-full-light.png
```

## Znaleziska i korekty wobec instrukcji

1. **PRT-D112-001 — LIGHT_THEME_NOT_RENDERED (PRODUCT_DEFECT).** Dla pełnego fixture kontrolka Light została kliknięta, menu zamknięte, a `document.documentElement.className` nie zawierało `dark`; mimo to wszystkie 5/5 powierzchni zachowały ciemną paletę. Bez naprawy zgodnie z Z40.
2. **PRT-D112-002 — ECONOMICS_POLICY_RETURNS_500 (PRODUCT_DEFECT / RELEASE BLOCKING FOR EARNINGS).** Kontrolowany komunikat UI maskuje HTTP `500 PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER`; teza Day69 o serwerowym `500` nadal aktualna. Bez naprawy.
3. **PRT-D112-003 — ORGANIZATIONS_RESPONSIVE_TRUNCATION (PRODUCT_DEFECT).** StandardTable jest już używana, więc tę część tezy Day69 obalono, lecz prawa kolumna nadal jest ucięta przy 1280 px. Bez naprawy.
4. **PRT-D112-004 — MIXED_LOCALIZATION_AND_RAW_VALUES (PRODUCT_DEFECT).** PL/EN miesza się w nagłówkach i wartościach; widoczne są `earn`, `certified`, angielskie liczniki i breadcrumby. Data certyfikatu `22/08/2026` i kwota `0,00 €` nie realizują w pełni formatu wymaganego przez §B.3.
5. **PRT-D112-005 — CRIMSON_NOT_CRITICAL_ONLY (VISUAL POLICY DEFECT).** Crimson jest używany w aktywnej nawigacji, ikonach i akcjach kopiowania, a nie wyłącznie dla semantyki krytycznej.
6. W3 oczekiwało grepowalnego regexu `consultify_w3_*_owner`, lecz wynik był pusty. Aktualny seeder bezpiecznie sprawdza loopback, nazwę oraz dokładne `--confirm-db`; baza Day112 została zaakceptowana. To korekta instrukcji, nie blokada.
7. Instrukcja wymaga pomiaru wg `§0.4a`, ale wydany plik nie zawiera tej sekcji; występują wyłącznie odwołania do niej. Bezpiecznym zamiennikiem jest pełny `tests/unit` z §0.2c(C), `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0`; wynik poniżej.
8. Seeder raportował certifications `2`, a uruchomienie kanonicznego runtime doprowadziło stan do `11`. W raporcie rozdzielono oba momenty pomiaru; nie przepisano liczby seedera jako stanu ekranów.

## Pomiar testów i zasięgu

Komenda zastępcza objęła cały `tests/unit`, nie wybór Partnera:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day112-partner-artefakty/day112-baseline.json
```

Wynik: exit `1`; tests `17 287/17 287`, PASS `17 069/17 287`, FAIL `22/17 287`, pending `185/17 287`, todo `11/17 287`; suite/assertion containers raportera: PASS `6 389/6 413`, FAIL `24/6 413`. JSON: `/private/tmp/cx-day112-partner-artefakty/day112-baseline.json`, SHA-256 `59c5915447f52d204fea3db74613437bc3405e0d796b6083f6b2b17d5a6abbd6`. Wszystkie 22 pełne nazwy przypadków zostały odczytane z JSON; żaden nie dotyczy pięciu powierzchni Partnera. Failures obejmują istniejące kontrakty runtime guard, stub routes, test discovery, dotenv isolation, deck layout, Finance performance, Organization domain honesty i Settings SUPERADMIN. Nie są relabelowane jako PASS i nie zostały naprawione (Z40). Pomiar nie jest dowodem realnej egzekucji DB ani HTTP; dowodem runtime są osobne health/readiness/browser/readback powyżej.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano desktop/tablet/mobile jako osobnych mianowników; pakiet mierzy wyłącznie użyte viewporty przeglądarek, bo B.2 wymagało stanów i motywów, nie pełnej macierzy responsive.
- Nie zweryfikowano wszystkich 25 sekcji modułu ani wszystkich wersji językowych; wybrano wymagane 5 powierzchni i sesje EN/PL według dostępnego runtime.
- Nie zweryfikowano realnej polityki naliczania, prowizji ani wypłat, ponieważ `AMD-PRT-ECONOMICS-002` celowo je blokuje i instrukcja zabrania tworzenia operacji ekonomicznych.
- Nie zweryfikowano dostarczenia e-maila ani powiadomienia; świadomie nie wysyłano niczego zgodnie z Z30.
- Nie zweryfikowano produkcji, demo, stagingu ani Railway; były jawnie poza zakresem i zakazane.
- Nie zweryfikowano a11y narzędziem automatycznym ani klawiaturą; wykonano wyłącznie odbiór wzrokowy wymagany w B.3.
- Nie rozstrzygnięto, dlaczego Light działał w sesjach empty, a nie w sesji full; przyczynowa diagnoza i naprawa są poza dowodowym zakresem Z40.

## Zakres zapisu

Po commicie `git diff --name-only 74a1d733e9b6f5535c49d003844678fe87d0c9b3..HEAD` ma wykazać wyłącznie ten raport i `modules/16_PARTNER/MODULE_ACCEPTANCE.md`. Zero zmian w `src/**`, `server/src/**`, migracjach, seederze i infrastrukturze testowej.
