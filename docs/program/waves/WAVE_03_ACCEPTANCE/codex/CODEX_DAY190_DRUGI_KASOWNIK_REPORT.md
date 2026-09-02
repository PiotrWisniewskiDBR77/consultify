# CODEX — DYŻUR 190 — DRUGI KASOWNIK TREŚCI GEN-2

Data: 2026-08-30  
Marker: `b4651675f6`  
Gałąź: `codex/day190-drugi-kasownik-20260831`  
Werdykt: **R1 VERIFIED, R2 PROVEN MECHANICZNIE / JAKOŚĆ PARTIAL, R3 VERIFIED; GEN-2 POZOSTAJE PARTIAL**

## Wynik najważniejszy

`obviousEnglish` nie zastępuje już całej wartości komunikatem `Treść usunięta`.
W polskim dokumencie wykryta angielszczyzna lub homograf pozostaje w treści, a sygnał
`changed` płynie do `block.isAssumption`. Tytuł dokumentu, tytuł sekcji, cel sekcji i
nagłówek nie są kasowane. Kontrakt dla angielszczyzny w polskim dokumencie brzmi:
**treść zostaje i jest oznaczana jako założenie do weryfikacji, zamiast znikać**.

Realna ścieżka `HTTP -> ApiGateway -> verifyToken -> POST /generate (useLlm=true) ->
OpenRouter -> enforceDocumentSchemaGrounding -> PostgreSQL -> GET /export/docx` utworzyła
DOCX. Model wykonał dokładnie `1 z 2` dozwolonych wywołań. Mutacja tej samej odpowiedzi
modelu przy starej heurystyce zmienia liczbę wystąpień `Treść usunięta` z `0 z 5` na
`5 z 5`, w tym kasuje tytuł sekcji.

Plik ma pełną polską prozę, oryginalny nagłówek, znacznik dyżuru i widoczny znacznik
`[Assumption — needs source]`. Ma jednak tylko `269` słów (zamiast celu około `610`) oraz
renderuje surowe `**` i listy jako zwarty akapit. To nie jest jakość uprawniająca do
podniesienia całego `GEN-2` na `PASS`.

## §0.1 — baza, marker, rozjazd i zasoby

Wynik markera, dosłownie:

```text
b4651675f6 odbior 186: SCALONO (B+/A-) — plik dowodowy REALNY odtworzony niezaleznie; strop PARTIAL uczciwy (zadne wejscie UI nie niesie briefu -> decyzja produktowa); dyzur 193 zbiorcze piny Z31
MARKER OK
```

Sanity worktree, dosłownie:

```text
b4651675f6ba0cc880c07fee94d2667a952d92f4
```

Wolne miejsce przed startem: `13 GiB`, minimum `5 GiB`. Porty `6110`, `5052`, `5053`:
`0 z 3` zajętych. Kontener: `cx-day190-pg`, obraz `pgvector/pgvector:pg16`, wyłącznie
`127.0.0.1:6110/cx190`.

Tip `github-backup/codex/m03-admin-20260824` wyprzedzał marker. Pomiar rozjazdu nie wykazał
zmian w `documentContentGenerator.ts` ani jego licencjonowanym teście; praca wystartowała
dokładnie z markera, bez rebase.

## Korekty wobec instrukcji

1. Pierwszy `git show` z vaulta został uruchomiony z procesowym `cwd` ustawionym na katalog
   właściciela, choć sama komenda odczytywała wyłącznie bare-vault. To proceduralne
   naruszenie Z5 bez odczytu lub zapisu plików checkoutu. Pełny dokument doczytałem z
   `/private/tmp`; wszystkie dalsze działania wykonano wyłącznie w worktree dyżuru.
2. Pierwszy odczyt instrukcji został ucięty na `1019` liniach przez limit wyjścia. Nie
   rozpocząłem dyżuru na skróconym wyniku; odczytałem ponownie wszystkie zakresy z vaulta.
3. T5 z niecytowanym `--include=*.ts` został rozwinięty przez `zsh` i dał `no matches
   found`. Powtórzenie z cytowanym globem dało dokładnie definicję `:102`, import `:70`
   i jednego wołacza `:1024`.
4. Lista `obviousEnglish` ma **36**, nie 37 alternatyw. Pomiar: rozdzielenie treści regexu
   po `|`; warianty z `?` liczone jako jedna alternatywa. Tabela poniżej ma `36 z 36`.
5. Instrukcja wskazuje R2 przez `documentBlockContentGenerator.ts:693-730` i „jedno
   wywołanie na sekcję”. Na markerze realny wołacz `documentStudioService.ts:1015` używa
   `documentBlockProseGenerator.ts`, który dzieli bloki prozowe na partie po dwa i ma
   maksymalnie dwie próby. Dla przygotowanego outline'u deterministyczny pomiar dał
   `1 z 1` blok prozowy, więc sukces pierwszej próby zużył dokładnie jedno wywołanie.
6. Pierwszy start serverowego Vitest z katalogu root dał `No test files found`; model nie
   został zaimportowany ani wywołany (`0 z 2`). Poprawny przebieg uruchomiono z katalogu
   `server`, z `--config vitest.config.ts` i `--retry=0`.
7. Skrypt pierwszej mutacji testowej użył zastrzeżonej zmiennej `status` w zsh i przerwał
   się po zapisaniu czerwonego JSON-a, przed automatycznym odtworzeniem. Natychmiast
   przywróciłem plik z kopii poza repo; SHA-256 kopii i pliku były identyczne.
8. Pełny katalog `server/src/services/documentStudio/__tests__` uruchomiony z
   `RUN_DB_TESTS=0 MOCK_DB=true` nie jest w całości pakietem jednostkowym: wynik to
   `933/989 PASS`, `45 FAIL`, `11 PENDING`. Awarie dotyczą m.in. testów rendererów i
   integracji oczekujących innego środowiska. Nie przedstawiam tego przebiegu jako zielonej
   bramki ani jako regresji R1; skupiony pakiet R1/R3 ma `11/11 PASS` po pełnych nazwach.

## Stan wejściowy T1–T7

- T1: regex ma `36` alternatyw; zawiera `portfolio`, `total`, `plan`, `medium`.
- T2: cztery zastane przypisania kasujące potwierdzone. Po zmianie żadne nie przypisuje
  `removed`; pola metadanych pozostają zachowane.
- T3: potwierdzono łańcuch `section.title -> block heading`; test R1 sprawdza oba pola.
- T4: wynik: pierwsze cztery przykłady `KASUJE`, ostatnie dwa `zostają`.
- T5: definicja + import + dokładnie jeden wołacz granicy po warstwie prozy.
- T6: EPSILON i SIGMA przeczytane przed zmianą. Ich oczekiwania pochodzą z
  `POLISH_HEADER_TRANSLATIONS` i `plCanonical`, nie z destrukcyjnego kasowania; nie wymagały
  zmiany i pozostały zielone.
- T7: liczby w `enforceBlockGrounding` pozostają w treści z `changed=true`; plik
  `documentBlockContentGenerator.ts` nie został zmieniony.

T2 dla R3 został zmierzony, nie założony: trzy wywołania `localizePolishValue` leżą pod
`language === 'pl'`. Test EN jest uczciwie **potwierdzeniem rozłączności**, nie dowodem
ochrony zapewnianej wcześniej przez tę heurystykę.

## R1 — kompletna tabela tokenów `36 z 36`

Wariant naprawy: nieusuwający sygnał. Wszystkie tokeny pozostają w heurystyce jako sygnał;
żaden nie ma już prawa kasować wartości. `changed=true` jest propagowane do
`block.isAssumption` również wtedy, gdy tekst zostaje.

| Token | Czy jest słowem polskim? | Dowód / przykład | Decyzja |
| --- | --- | --- | --- |
| `the` | nie | angielski rodzajnik | zostaje jako sygnał |
| `and` | nie | angielskie „i” | zostaje jako sygnał |
| `for` | nie | angielskie „dla” | zostaje jako sygnał |
| `with` | nie | angielskie „z” | zostaje jako sygnał |
| `without` | nie | angielskie „bez” | zostaje jako sygnał |
| `required` | nie | angielskie „wymagane” | zostaje jako sygnał |
| `information` | nie | po polsku „informacja” | zostaje jako sygnał |
| `portfolio` | tak | „portfolio projektów” | zostaje, niedestrukcyjnie |
| `financial` | nie | po polsku „finansowy” | zostaje jako sygnał |
| `constraints?` | nie | `constraint/constraints`; po polsku „ograniczenie” | zostaje jako sygnał |
| `optimized` | nie | po polsku „zoptymalizowany” | zostaje jako sygnał |
| `resource` | nie | po polsku „zasób” | zostaje jako sygnał |
| `allocation` | nie | po polsku „alokacja” | zostaje jako sygnał |
| `executive` | nie | po polsku „zarządczy” | zostaje jako sygnał |
| `summary` | nie | po polsku „podsumowanie” | zostaje jako sygnał |
| `decisions?` | nie | `decision/decisions`; po polsku „decyzja” | zostaje jako sygnał |
| `risks?` | nie | `risk/risks`; po polsku „ryzyko” | zostaje jako sygnał |
| `next` | nie | angielskie „następny” | zostaje jako sygnał |
| `steps?` | nie | `step/steps`; po polsku „krok” | zostaje jako sygnał |
| `budget` | nie | polska forma to „budżet” | zostaje jako sygnał |
| `overrun` | nie | angielskie „przekroczenie” | zostaje jako sygnał |
| `severity` | nie | angielskie „dotkliwość/waga” | zostaje jako sygnał |
| `likelihood` | nie | angielskie „prawdopodobieństwo” | zostaje jako sygnał |
| `impact` | nie | angielskie „wpływ” | zostaje jako sygnał |
| `owner` | nie | biznesowy anglicyzm, polskie „właściciel” | zostaje jako sygnał |
| `mitigation` | nie | angielskie „mitygacja” | zostaje jako sygnał |
| `total` | tak | użycie polskie: „gra w total” | zostaje, niedestrukcyjnie |
| `plan` | tak | „plan działania” | zostaje, niedestrukcyjnie |
| `realization` | nie | po polsku „realizacja” | zostaje jako sygnał |
| `milestones?` | nie | `milestone/milestones`; po polsku „kamień milowy” | zostaje jako sygnał |
| `completed` | nie | angielskie „ukończone” | zostaje jako sygnał |
| `high` | nie | angielskie „wysokie” | zostaje jako sygnał |
| `medium` | tak | „medium komunikacyjne” | zostaje, niedestrukcyjnie |
| `low` | nie | angielskie „niskie” | zostaje jako sygnał |
| `scope` | nie | angielskie „zakres” | zostaje jako sygnał |
| `timing` | nie | anglicyzm używany branżowo, nie potrzebny do uznania zdania za EN | zostaje jako sygnał |

`removed` pozostaje technicznie osiągalny wyłącznie jako fallback `guardText`, gdy
`enforceBlockGrounding` nie zwróci tekstu; destrukcyjna ścieżka `obviousEnglish` już go nie
zwraca. Tytuł dokumentu nie ma pola `isAssumption`, więc zostaje bez kasowania; sygnał
tytułu/celu sekcji jest propagowany do bloków sekcji.

## R1/R3 — testy i mutacja

Skupiony wynik po pełnych nazwach: `11 z 11 PASS`, `0 FAIL`, `--retry=0`.

- R1: zachowuje tytuł `Plan działania`, cel, akapit i lustrzany heading; oba bloki mają
  `isAssumption=true`.
- R3a: dokument EN przechodzi bez zmian; to potwierdzenie rozłączności.
- R3b: angielski wyciek w dokumencie PL zostaje i jest oznaczany.
- EPSILON i SIGMA: wszystkie zastane asercje zielone bez osłabienia.

Mutant (`obviousEnglish -> removed`): `1/3 PASS`, `2/3 FAIL`; padają dokładnie R1 i R3b,
R3a pozostaje zielony. Po odtworzeniu: `11/11 PASS`. SHA-256 odtworzonego pliku i kopii:
`4e37fddaca1f14d617386ba5e34df2d46892d05e7ccad01ad048db11b9d27085`.

## R2 — dostawca, wejście i realna ścieżka

Przed synchronizacją baza:

```text
dbr77 | NIE
```

Po jedynej dozwolonej komendzie źródłowej środowisko:

```text
OPENROUTER_API_KEY
DOSTAWCA OBECNY
```

Po produkcyjnym `llmConfigService.initialize() -> syncDatabaseWithEnv()` baza:

```text
openrouter | TAK | STANDARD | active | priority 3
```

Wartość klucza nie została wypisana. Brief, dosłownie, jedno zdanie:

```text
Przygotuj szczegółowy, około 700-słowny plan wdrożenia ZNACZNIK-DAY190-DRUGI-KASOWNIK w trzech falach, z mierzalnymi rezultatami i jawnym oznaczeniem wszystkich niepotwierdzonych liczb jako założeń.
```

Outline: jedna sekcja `Plan działania ZNACZNIK-DAY190-DRUGI-KASOWNIK`, `long`, bez
`POST /plan`, bez cytowań, `useLlm=true`. Wynik:

```text
DAY190_PROVIDER database=openrouter key=TAK
LLM call success for openrouter: durationMs=5098, tokens=1440, promptTokens=777, completionTokens=663
DAY190_GENERATE status=200
DB_READBACK 1/1
DAY190_EXPORT status=200
MODEL_CALLS 1/2
```

Pułapki Z33: (a) `ENABLE_V8_GLOBAL=true`; (b)
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) `MOCK_DB=false`,
`DB_TYPE=postgres`, log `DB_IDENTITY 127.0.0.1:6110/cx190`; (d)
`ENABLE_TEST_AUTH_BYPASS=false` i podpisany JWT; (e) fallback wyklucza pojedynczy log
`LLM call success` z tokenami i czasem. Test woła `assertRealPostgresTestEnvironment()` bez
argumentów; nie pinuje hosta, portu ani nazwy bazy.

## DOCX — pomiary i rubryka K1–K6 zaprojektowana w dyżurze

Artefakt: `/private/tmp/cx-day190-drugi-kasownik-artefakty/day190-real-llm-plan.docx`  
SHA-256: `3cf5749e2aea1f2e43f433808a668a2bfefcde1c733ddc1f9f8d009e2314c6ac`  
Rozmiar: zapisany w `day190-real-llm-result.json`; ZIP `testzip=None`.

Metoda słów: tekst wszystkich akapitów przez `python-docx`, tokeny regexem alfanumerycznym
z polskimi diakrytykami i łącznikiem wewnętrznym. Wynik: **269 słów**. To `4,41x` wyniku
dnia 90 (`61`), a nie oczekiwany rząd wielkości (`~610`).

| # | Kryterium | Wynik | Dowód |
| --- | --- | --- | --- |
| K1 | Każda sekcja ma pełną polską prozę | PASS | `1/1` sekcja, `1/1` blok prozowy |
| K2 | Zero kasowników i fraz-widmo | PASS | `0` dla 5 zakazanych wzorców |
| K3 | Oryginalny nagłówek i znacznik dyżuru | PASS | nagłówek zachowany; marker `5` razy w DOCX |
| K4 | Liczby-założenia widocznie oznaczone | PASS | `1/1` blok assumption; marker widoczny `1` raz |
| K5 | Długość, gęstość i struktura adekwatna | FAIL | `269` słów; surowe `**`, lista w jednym akapicie |
| K6 | Plik otwiera się i renderuje bez błędu | PASS | LibreOffice, `2/2` PNG, brak clippingu/overlapu |

Render został obejrzany strona po stronie. Techniczny układ jest czysty, lecz strona 2
jest ścianą tekstu z surowym Markdown. Rubryka K1–K6 nie zastępuje progu graficznego D-8
`15/18`; tego progu nie mierzono.

## Mutacja R2 na tym samym schemacie

Ten sam `responseSchema` z jedynego przebiegu modelu został ponownie przepuszczony przez
granicę. Bez drugiej generacji:

```text
MUTANT_REMOVED=5 SECTIONS=1 BLOCKS=1 TITLE_REMOVED=true
FIXED_REMOVED=0 SECTIONS=1 BLOCKS=1 TITLE_REMOVED=false
```

Mianownik `5` to pięć serializowanych miejsc dotkniętych przez starą heurystykę w tym
schemacie. Log: `/private/tmp/cx-day190-drugi-kasownik-artefakty/day190-boundary-mutation.log`.

## Z30 — zero wysyłki

```text
BRAK ZMIENNYCH POCZTY
settings WHERE key LIKE 'smtp%': 0 rows
Gateway.ts: 0 trafień drenaży outboxu
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera
wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu
outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Migracje i artefakty dowodowe

Pierwszy przebieg migracji: `870/870`, drugi: `0/870`, oba zakończone
`Postgres migrations complete`.

- wynik HTTP/DB/schema: `day190-real-llm-result.json`, SHA-256
  `9a21cba5415996ed5b6bd02ba2856b060576e5bff22371d852851547e718cdef`
- log realnego modelu: `day190-real-llm-run.log`, SHA-256
  `6a7e55a55d8831b8eb23414ae9fabb30eb3db08829b364ff92f9f573d3bfaec9`
- mutacja schematu: `day190-boundary-mutation.log`, SHA-256
  `475e16514b7b6598d66022aeb6fdf213c223558c8baf60bccdb218e8b49b9452`
- mutant testu: `day190-r1-r3-mutant-red.json`, SHA-256
  `569b6c71a89969177c3aa6d12fef86da9c27dca0fc0bbc60fe4d84ccb328e6b2`
- finalny skupiony test: `day190-r1-r3-final-green.json`, SHA-256
  `f72be6944a073ee0dd3be7bbfadc9e6c6e45b0a8b5fd4e3232d30750f3a3e99d`
- pełny katalog testów: `day190-documentstudio-full-unit.json`, SHA-256
  `a16bb3cfb65b254d66587b26c916e3e8b7c5aa375a16e367372fd22364730126`

## Zasięg zmian i stan GEN-2

Zmiany repo ograniczają się do licencjonowanych plików:

1. `server/src/services/documentStudio/documentContentGenerator.ts`;
2. `server/src/services/documentStudio/__tests__/day190.obviousEnglish-grounding.test.ts`;
3. ten raport;
4. wyłącznie wiersz `GEN-2` w `11_MATERIALS/MODULE_ACCEPTANCE.md`.

Pierwszy commit i push po R1/R3: `34dc6435a4`. `documentBlockContentGenerator.ts`, front,
renderery, middleware, flagi i globalna infrastruktura testowa pozostały nietknięte.

`GEN-2` pozostaje `PARTIAL`: realna ścieżka LLM->DOCX jest teraz `PROVEN`, lecz K5 jest
`FAIL`, próg `15/18` nie został zmierzony, a surowy Markdown wskazuje następny defekt
jakości renderowania. Nie wykryto trzeciego **kasownika treści**: `1/1` gniazdo prozowe
przeżyło granicę, ale wykryto niezależny defekt prezentacji treści.

## TWIERDZENIA NIEZWERYFIKOWANE

- Tabela tokenów jest kompletna: `36/36`, nie skrócona.
- T2 zmierzono w kodzie i testem EN; nie jest założeniem.
- Liczba `269` pochodzi z pomiaru `python-docx`, nie z oszacowania.
- Nie wykonano rubryki graficznej D-8 `15/18`; K1–K6 jej nie zastępuje.
- Nie przeprowadzono odbioru w Microsoft Word; K6 potwierdza LibreOffice i render PNG.
- Nie udowodniono, że surowy Markdown występuje dla każdego modelu lub każdego typu
  dokumentu; jest udowodniony dla tego jednego realnego przebiegu.
- Nie znaleziono trzeciego kasownika w tej ścieżce, ale nie dowodzi to nieistnienia go we
  wszystkich typach dokumentów i konfiguracjach.
- Pełny katalog testów nie jest zielony; 45 awarii nie zostało przypisanych tej zmianie
  ani naprawionych poza zakresem.
