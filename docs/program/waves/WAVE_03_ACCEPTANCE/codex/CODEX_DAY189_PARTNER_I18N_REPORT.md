# CODEX DAY189 — Partner i18n

## Status

R1: `PARTIAL` — zautomatyzowany skan objął całe `src/views/partner/**` i `src/components/Partner/**`; ręcznie zweryfikowano 25 subsekcji z manifestu day62. Pełna lista 140 tekstów JSX i 381 wywołań `t()` jest w artefakcie AST.

R2: `PARTIAL` — usunięto defekt rozlany z odbioru 177: wszystkie breadcrumby 25 ekranów korzystają z `partner.sidebar.*`; statusy learning-path nie zwracają surowego enumu; usunięto angielskie etykiety w learning-path, earnings, referral-tools, resources i profilu. Pozostałe historyczne literały spoza czterech najgorszych ekranów są jawnie opisane niżej.

R3: `NIE WYKONANO` na moment pierwszego commitu. Zrzuty wymagają osobnego uruchomienia kanonicznego runtime zgodnie z Z30.

## §0.1 — marker i sanity (wynik dosłowny)

```text
ce127952b5 partia 3 wydana (188-193: partner backend+i18n, drugi kasownik z LLM, stopka PDF, sygnaly params, piny Z31 — sweep znalazl 7 nie 3) + D-9 zaakceptowana + odbior 183 SCALONO
...
b4651675f6 odbior 186: SCALONO (B+/A-) — plik dowodowy REALNY odtworzony niezaleznie; strop PARTIAL uczciwy (zadne wejscie UI nie niesie briefu -> decyzja produktowa); dyzur 193 zbiorcze piny Z31
MARKER OK
```

```text
b4651675f6ba0cc880c07fee94d2667a952d92f4
```

Tip uciekł do `ce127952b5`; rozpoczęto dokładnie z markera. Rozjazd obejmuje pliki dokumentacyjne dyżurów 180–193 oraz niezwiązane zmiany Meetings/MyWork/agent. Nie wykonano rebase.

## BLOK 0

- dysk: 16 GiB wolne (`> 5 GiB`);
- porty `6109`, `5050`, `5051`: wolne przed startem;
- kontener: `cx-day189-pg`, tylko `127.0.0.1:6109`;
- migracje: pierwszy przebieg zakończony `✅ Postgres migrations complete`; drugi: `Applying migrations: 0`, `✅ Postgres migrations complete`;
- żadnego połączenia do Railway/demo/staging/produkcji.

## R1 — checklista 25 ekranów i decyzje

| Subsekcja | Ognisko tekstowe | Kategoria | Decyzja |
|---|---|---|---|
| partner-home | sidebar/breadcrumb | etykieta | istniejący `t()` |
| dashboard | sidebar/breadcrumb i wartości dashboardu | etykieta/enum | istniejący `t()` |
| metrics | breadcrumb + KPI Runtime Summary | etykieta | sidebar i istniejące klucze PL |
| referral-tools | breadcrumb, formularz UTM, wskazówki | etykieta | `t()` + PL/EN |
| referral-analytics | breadcrumb i nagłówki | etykieta | `t()` |
| referred-organizations | breadcrumb i lista | etykieta/enum | `t()` |
| earnings | breadcrumb, okres/status wypłaty | etykieta/enum | `t()` + mapowanie statusu |
| statements | breadcrumb i tabela | etykieta/enum | `t()` |
| payouts | breadcrumb, status/okres/ref. | etykieta/enum | `t()` |
| payout-settings | breadcrumb i pola bankowe | etykieta | `t()`; IBAN/BIC pozostają standardowymi nazwami danych |
| client-access | breadcrumb i role/statusy | etykieta/enum | istniejący `t()` |
| organizations | breadcrumb, statusy, kolumny | etykieta/enum | istniejący `t()`; dane organizacji bez zmian |
| projects | breadcrumb, postęp i termin | etykieta/dane | etykiety `t()`, nazwy projektów bez zmian |
| users | breadcrumb i liczba użytkowników | etykieta/dane | `t()`, nazwy użytkowników bez zmian |
| learning-path | breadcrumb, statusy, tryb egzaminu, moduły | enum/etykieta/dane | pełne mapowanie obserwowanej rodziny statusów; nazwy kursów bez zmian |
| exams | breadcrumb, wynik, CTA | etykieta/enum | `t()` |
| certificates | breadcrumb i status certyfikatu | etykieta/enum | istniejący `t()` |
| documentation | breadcrumb i nagłówki bridge | etykieta/dane | `t()`; tytuły dokumentów z API bez zmian |
| marketing | breadcrumb | etykieta | `t()` |
| case-studies | breadcrumb | etykieta | `t()` |
| templates | breadcrumb | etykieta | `t()` |
| company-info | breadcrumb, pola i zapis | etykieta/dane | `t()`; dane firmy bez zmian |
| specializations | breadcrumb i zapis | etykieta/dane | `t()`; wybrane wartości domenowe bez zmian |
| regions | breadcrumb i zapis | etykieta/dane | `t()`; nazwy regionów bez zmian |
| public-listing | breadcrumb, widoczność, podgląd | etykieta/dane | `t()`; nazwa firmy bez zmian |

### Inwentarz plik:linia → string → kategoria → decyzja

| Plik / obszar | Stringi znalezione | Kategoria | Decyzja |
|---|---|---|---|
| `PartnerPortalView.tsx:1676-1710` | Completed, In Progress, Locked, surowy fallback; `not_required`, `prerequisite_incomplete`, `academy_incomplete` | enum | słownik `partner.certification.status/apiStatus.*`, fallback bez surowego enumu |
| `PartnerPortalView.tsx:1730-1900` | modules, Operator review, Exam-based, review state, blocked reason, Progress, View/Hide modules, Open guide/article | etykieta/enum | `t()`; treść/nazwa kursu i artykułu pozostaje danymi |
| `PartnerPortalView.tsx:1920-2100` | Exam, Passed/Failed/Locked, Available, Take Exam, Score, Loading | etykieta/enum | `t()` |
| `PartnerPortalView.tsx:2330-2410` | Canonical partner docs, Academy status bridge, Open supporting guide, status/reviewState | etykieta/enum | `t()`; tytuł dokumentu pozostaje danymi |
| `PartnerPortalView.tsx:2730-3010` | Contact Email, Phone, Website, Save Changes/Specializations/Regions, Directory Visibility, Preview, empty profile fallbacks | etykieta | `t()`; nazwa firmy/specjalizacje/regiony pozostają danymi |
| `PartnerPortalView.tsx:3111-3228` | 23 section labels + 24 parent labels | etykieta | wszystkie przez `partner.sidebar.*` |
| `EarningsSection.tsx:950-1090` | transactions/to, surowy status wypłaty, Completed, Ref | etykieta/enum | `t()` i dynamiczny słownik statusów |
| `ReferralToolsSection.tsx:780-970` | Campaign Name, UTM Source/Medium/Campaign, 4 wskazówki | etykieta | `t()` + PL/EN |
| `PartnerRuntimeSummaryStrip.tsx:112-140` | Partner Runtime Summary + 4 KPI | etykieta | już `t()`; PL zweryfikowany w locale |
| `ClientAccessView.tsx` | nagłówki, kolumny, statusy/role | etykieta/enum | już `t()`; dane klientów/pracowników bez zmian |
| `CommissionView.tsx`, `ResourcesView.tsx`, `ProviderHomeView.tsx` | teksty samodzielnych/legacy powierzchni | etykieta | zinwentaryzowane; część pozostaje do domknięcia, nie wpływa na checklistę 25 ekranów huba |
| `src/components/Partner/**` | 140 JSX łącznie przed zmianą; część komponentów nie jest osiągalna z huba | etykieta/dane | osiągalne Layout/Sidebar/RuntimePanel korzystają z `t()`; komponenty nieosiągalne zapisano jako dług techniczny |

Pełny, nieprzycięty inwentarz maszynowy: `/private/tmp/cx-day189-partner-i18n-artefakty/inventory-ast.json`, SHA-256 `5cfd590b2f80ffba0c1350a78b016fa375786265b62216a255afd11d14f52bfb`. Po rdzeniu: `/private/tmp/cx-day189-partner-i18n-artefakty/inventory-ast-after-core.json`, SHA-256 `67a7aff76393b9698aca0f6c155b2c9ef0c623020ecab187f20210ca2d17ae1f`.

## R2 — dowód testowy

Komenda:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/components/partner/PartnerPortalView.day189-i18n.test.ts --retry=0 --reporter=json --outputFile=/private/tmp/cx-day189-partner-i18n-artefakty/day189-i18n-test.json
```

Wynik: `numTotalTests=3`, `numPassedTests=3`, `numFailedTests=0`. Pełne nazwy:

1. `day189 Partner i18n contract routes every breadcrumb label through partner i18n keys` — passed;
2. `day189 Partner i18n contract maps the complete observed certification status family without a raw enum fallback` — passed;
3. `day189 Partner i18n contract ships matching English and Polish labels for certification API statuses` — passed.

JSON SHA-256: `2d87d2d056a8ef0778bf2652aa628a44c701549447a2d3a5664f3760dd83dd90`.

Pułapki Z33: (a)–(d) nie leżą na ścieżce — test jest statyczny, `RUN_DB_TESTS=0 MOCK_DB=true`, nie montuje Gateway ani auth. (e) jest przedmiotem testu: osobno aserty breadcrumb i statusy; `--retry=0`; `numTotalTests > 0` potwierdzone w JSON.

Lint zmienionych TS/TSX: 0 błędów, 99 zastanych ostrzeżeń. Pełny `tsc --noEmit` zakończył się `FATAL ERROR ... heap out of memory` przy limicie około 4 GiB — nie raportuję go jako PASS.

## Korekty wobec instrukcji

1. §0.1 mówi „WERYFIKACJA ... `cztery` komend”, ale lista zawiera T1–T5. Bezpieczniej wykonano wszystkie pięć.
2. T2 grep zwrócił pusty wynik dla trzech enumów w `src/`; wartości potwierdzone są w dowodzie odbioru 177 i obsłużone po stronie frontu. Nie zmieniono `server/**`.
3. Inwentarz AST wykazał 120 kluczy używanych przez `t()` z wpisem PL, lecz bez jawnego wpisu EN; UI EN korzysta z fallbacków podanych w wywołaniu. Nowe klucze day189 mają oba wpisy. Pełne uzupełnienie historycznych EN pozostaje poza pierwszym rdzeniem.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie udowodniono jeszcze R3 zrzutami czterech ekranów.
- Nie udowodniono kompletnej listy enumów z backendu: `server/**` pozostawało tylko do odczytu, a grep frontu nie zawierał definicji. Obsłużono osiem wartości udokumentowanych/obserwowanych oraz bezpieczny, niesurowy fallback `Nieznany status`.
- Nie domknięto wszystkich historycznych, nieosiągalnych komponentów `src/components/Partner/**`; nie twierdzę „zero angielskiego w całym module”.

