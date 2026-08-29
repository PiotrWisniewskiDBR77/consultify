# CODEX — DYŻUR 90 — LLM, DOWÓD PLIKIEM

Data: 2026-08-29  
Marker: `d80dd85cc7784095eed6f711b42366e5d9b7f74e`  
Gałąź: `codex/day90-llm-dowod-plikiem-20260829`  
Werdykt: **WYNIK NEGATYWNY / GEN-2 POZOSTAJE PARTIAL**

## Wynik najważniejszy

Produkcyjna ścieżka `HTTP -> ApiGateway -> verifyToken -> document-studio -> PostgreSQL -> DOCX`
utworzyła dwa pliki z tego samego wejścia. Wywołanie OpenRouter zostało potwierdzone
licznikiem na rzeczywistym endpointcie `/chat/completions`: `1 z 2` dopuszczonych.
Mimo tego warstwa tekstowa obu DOCX po normalizacji jest identyczna: `61 vs 61` słów,
`3 z 3 vs 3 z 3` pustych gniazd zastąpionych komunikatem o niepopartym twierdzeniu.
Model został wywołany, ale wynikowy dokument nie zawiera jego merytorycznej prozy.

## §0.1 — baza pracy, marker i rozjazd tipa

Wynik markera, dosłownie:

```text
efd54054af docs(day90,92,93,94): cztery instrukcje zlozone skryptem ze szkieletu
05ed8ff336 docs(day91): instrukcja odbioru wizualnego Inicjatyw (zlozona skryptem ze szkieletu)
d80dd85cc7 docs(ledger): DEC-319..322 — gitignore polknal instrukcje 89, STOP 88 z bledu pomiaru, mylacy komunikat AI, odbior 89
MARKER OK
```

Sanity worktree, dosłownie:

```text
d80dd85cc7784095eed6f711b42366e5d9b7f74e
```

Tip wyprzedza marker o `2 z 2` commitów. Lista plików rozjazdu obejmuje wyłącznie
pięć instrukcji dyżurów `90`–`94`; praca rozpoczęła się dokładnie z markera.
Wolne miejsce: `72 GiB`, wymagane minimum `5 GiB`. Porty `5970`, `4840`, `4841`:
`0 z 3` zajętych przed startem.

## Korekty wobec instrukcji

1. Pierwszy odczyt instrukcji omyłkowo wykonałem przez `git show` z `workdir`
   ustawionym na katalog właściciela. Był to odczyt bez mutacji, ale naruszył `Z5`.
   Natychmiast przerwałem tę drogę; pełny dokument przeczytałem ponownie z bare-vaulta,
   a wszystkie dalsze działania wykonałem wyłącznie w `/private/tmp/cx-day90-llm`.
2. Pierwszy start harnessu zakończył się przed importem aplikacji: `tsx` odrzucił
   top-level `await` w formacie CJS. Wywołania modelu: `0 z 2`.
3. Pierwszy realny przebieg produktu, przed synchronizacją dostawcy, rozwiązał tier
   `STANDARD` do `openai`; dwa lokalne podejścia zakończyły się brakiem klucza OpenAI.
   Ruch do OpenRouter: `0 z 2`, generowanie `HTTP 200` wyłącznie przez fallback,
   eksport `403 TRIAL_EXPORT_DISABLED` dla lokalnego seeda typu `TRIAL`.
4. Produkcyjna `LLMConfigService.initialize()` zsynchronizowała OpenRouter do lokalnej
   bazy. Organizację dowodową sklasyfikowałem w efemerycznej bazie jako `PAID`, zamiast
   włączać flagę trial-export. Pomiar eksportu draft: `HTTP 200`.
5. Instrukcja odwołuje się do `§0.4a`, lecz wydany plik przechodzi z `§0.2d` do `§0.5`
   i nie zawiera treści `§0.3` ani `§0.4a`. Zastosowałem bezpieczny odpowiednik:
   pełny istniejący pakiet `tests/unit/documentStudio`, bez selekcji przypadków.

## W1–W5 — stan wejściowy

W1: `4 z 4` miejsc zmierzonych:

```text
PresentationTemplateArchitectView.tsx:231 useState(false)
DocumentStudioTemplateArchitectView.tsx:175 useState(false)
DocumentStudioView.tsx:179 useState(true)
DocumentStudioIntakeForm.tsx:171 useState(true)
```

W2: komentarz z `2026-07-22` potwierdza, że `OFF` dawał pusty szkielet.  
W3: `if (params.useLlm)` wywołuje `generateBlockProse`; błąd jest best-effort.  
W4: konfiguracja z bazy jest rozwiązywana przed fallbackiem env.  
W5: domyślna allowlista synchronizacji env to `{openrouter}`, `1 z 1`.

Wniosek B.4: dokumentowe stany domyślne są już `ON` (`2 z 2` miejsc dokumentowych),
więc nie zmieniłem żadnego przełącznika. Kontrakt PPT pozostał nietknięty.

## B.1 — PostgreSQL i migracje

Kontener: `cx-day90-pg`, obraz `pgvector/pgvector:pg16`, wyłącznie
`127.0.0.1:5970/cx_day90`.

```text
Pierwszy przebieg: Applying migrations: 863; Postgres migrations complete
Drugi przebieg: Applying migrations: 0; Postgres migrations complete
```

Wynik: `863 z 863` zastosowanych, idempotencja `0 z 863` zmian w drugim przebiegu.
Nowe migracje o prefiksie `202617`: `0`.

## Z30 — zero wysyłki

```text
BRAK ZMIENNYCH POCZTY
settings WHERE key LIKE 'smtp%': 0 rows
Gateway.ts: 0 trafień drenaży outboxu
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## B.2 — dostawca w obu miejscach

Pomiar bazy przed synchronizacją:

```text
dbr77 | NIE
```

Pomiar środowiska po jedynej dozwolonej komendzie źródłowej:

```text
OPENROUTER_API_KEY
DOSTAWCA OBECNY
```

Pomiar bazy po produkcyjnej synchronizacji konfiguracji:

```text
openrouter | TAK
STANDARD | openrouter-01 | active | priority 3
```

W żadnym pomiarze nie wypisano wartości klucza.

## B.3 — jedno wejście, dwa pliki

Wejście, dosłownie:

```text
Tytuł: Plan poprawy terminowości wdrożeń
Opis: Firma realizuje 62% wdrożeń w terminie. Celem jest osiągnięcie 85% w ciągu dwóch kwartałów przez standaryzację odbiorów, cotygodniowy przegląd ryzyk i jednoznacznych właścicieli działań. Źródło: zatwierdzony brief operacyjny zarządu z 29 sierpnia 2026.
Typ: generic_document
Język: pl
Odbiorcy: zarząd, dyrektor operacyjny
Cel: inform
Outline: jedna sekcja „Plan działania”, poziom 1, długość medium
```

Artefakty:

- A, z modelem: `/private/tmp/cx-day90-llm-artefakty/A-z-modelem.docx`,
  SHA-256 `c880b480b095e36ee78eabcf1dbeecf4e83b1801a29abf313f3b38d45288239c`,
  `10931` bajtów.
- B, bez modelu: `/private/tmp/cx-day90-llm-artefakty/B-bez-modelu.docx`,
  SHA-256 `201c6d3927099b70eb658bd9fb273c73414481b56dd2122e26b5e92540c454da`,
  `10930` bajtów.

| Miara | Plik A — z modelem | Plik B — bez modelu |
| --- | ---: | ---: |
| Liczba słów | `61` | `61` |
| Znane frazy EN z instrukcji | `0 z 3` | `0 z 3` |
| Puste gniazda po końcowej bramce groundingu | `3 z 3` | `3 z 3` |
| Charakter zdań | szkieletowe; komunikat „Treść usunięta…” | szkieletowe; komunikat „Treść usunięta…” |

Surowe pliki mają różne sumy z powodu metadanych ZIP. Po normalizacji czasu
`word/document.xml` porównanie daje `cmp exit 0`: treść jest identyczna.
To jest dowód negatywny: realne wywołanie modelu nie poprawiło wynikowego DOCX.

Ścieżka HTTP:

```text
MODEL_CALL 1/2
GENERATE useLlm=true HTTP 200
EXPORT useLlm=true HTTP 200
GENERATE useLlm=false HTTP 200
EXPORT useLlm=false HTTP 200
DB_READBACK 2/2
MODEL_CALLS 1/2
A_WARNINGS 0
B_WARNINGS 0
```

## Pułapki Z33 dla pakietów dowodowych

- Realny harness: (a) `ENABLE_V8_GLOBAL=true`; (b)
  `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) `MOCK_DB=false`,
  `DB_TYPE=postgres`, DB identity `127.0.0.1:5970/cx_day90`; (d)
  `ENABLE_TEST_AUTH_BYPASS=false` i podpisany JWT; (e) cichy fallback został
  wyłączony jako fałszywy dowód przez niezależny licznik realnych wywołań oraz
  porównanie A/B. Wynik właśnie obala tezę, że brak warningu oznacza prozę modelu.
- `tests/unit/documentStudio`: pakiet czysto jednostkowy, `RUN_DB_TESTS=0
  MOCK_DB=true`; nie jest dowodem egzekucji HTTP/DB. Pułapki (a)–(d) nie leżą
  na tej ścieżce; (e) jest mockowana w testach generatora i nie stanowi dowodu
  dostawcy. Pakiet mierzy wyłącznie regresję logiki Document Studio.

## Pomiar testów

Komenda:

```text
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/documentStudio --retry=0 --reporter=json --outputFile=/private/tmp/cx-day90-llm-artefakty/day90-documentstudio-unit.json
```

Wynik według nazw przypadków: `35 z 35 PASS`, `10 z 10` plików, `0 z 35 FAIL`,
`0 z 35 PENDING`. Nie uruchamiałem testu DB jako substytutu realnego harnessu.

## B.5 — bramki GEN-1…GEN-4

Nie podniosłem żadnej bramki. Nowy dowód dotyczy wyłącznie `GEN-2`, ale jest
negatywny: mechaniczny eksport działa, natomiast wymiar treści pozostaje pusty.
`GEN-2` uczciwie pozostaje `PARTIAL`; `GEN-1`, `GEN-3` i `GEN-4` nie zostały
tym dyżurem zmierzone plikiem właściwego typu.

## Kryteria K1–K7

| Kryterium | Wynik |
| --- | --- |
| K1 | `4 z 4` stanów zmierzonych — PASS |
| K2 | baza + środowisko, bez wartości klucza — PASS |
| K3 | `2 z 2` DOCX ze ścieżkami i SHA-256 — PASS |
| K4 | tabela A/B `3 z 3` miar — PASS |
| K5 | `1 z 2` realnych wywołań modelu — PASS |
| K6 | skan fragmentu wartości klucza: `0` trafień w raporcie i artefaktach — PASS |
| K7 | przełącznik istnieje, pliki PPT nietknięte — PASS |

## Stan końcowy i zakres

Zmiana repozytorium: dokładnie `1` plik — ten raport. `MODULE_ACCEPTANCE.md`
pozostaje bez zmiany, ponieważ brak podstawy do podniesienia bramki. Nie zmieniono
produktu, migracji, flag, middleware, Gatewaya, kontraktu PPT ani infrastruktury testowej.
