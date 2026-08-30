# CODEX DAY 195 — DOKUMENT POKAZYWALNY

Data: 2026-08-31  
Gałąź: `codex/day195-dokument-20260831`  
Baza: marker `6894f3da05` (bez rebase), vault `github-backup/codex/m03-admin-20260824`  
Werdykt: **PARTIAL / EVIDENCE_MISSING dla realnego pliku**

## 0. Wejście i zasoby

Wynik markera, dosłownie:

```text
6894f3da05 odbior 189: SCALONO po FIX-189
MARKER OK
```

Sanity worktree, dosłownie:

```text
6894f3da05375672bca0207c98dcd2f3e241f2a5
```

Tip wyprzedzał marker; `git log 6894f3da05..github-backup/codex/m03-admin-20260824`
pokazał m.in. instrukcje 194–196 oraz poprawki innych modułów. `git diff --name-only`
nie pokazał zmian w licencjonowanych plikach Studia Dokumentów. Pracę rozpocząłem
dokładnie z markera, zgodnie z DEC-95.

Wolne miejsce: `22 GiB` (>5 GiB). Porty `6122`, `5064`, `5065`: `3 z 3 WOLNE`;
Docker nie miał ich zmapowanych. Kontener: `cx-day195-pg`, obraz
`pgvector/pgvector:pg16`, mapowanie wyłącznie `127.0.0.1:6122`. Pierwszy przebieg
migracji zakończył się `Postgres migrations complete`; drugi: `Applying migrations: 0`.

## 1. Arytmetyka R1 / DEC-317

Wybrano domyślny chunking, bez `options.maxTokens`, aby nie odtwarzać timeoutu DOC-1.

| Element outline'u | Typ bloku | Cel prozy | Partia |
|---|---|---:|---:|
| Diagnoza gotowości organizacyjnej | `paragraph` | tak | 1 |
| Rekomendowany model realizacji | `paragraph` | tak | 1 |
| **SUMA** |  | **N=2** | **`ceil(2/2)=1` wywołanie** |

Tabela jest kompletna dla przesłanego outline'u. Prompt wymaga 4–6 akapitów i
350–450 słów na cel; podział następuje po odpowiedzi modelu. Budżet odpowiedzi dla
dwóch celów został podniesiony z 1400 do 2400 tokenów (cap nadal 4096), ponieważ
1400 jest niespójne z zamówioną długością. Ta korekta jest zielona deterministycznie,
ale **nie została ponownie sprawdzona na providerze** z powodu limitu DEC-317.

## 2. Dostarczone zmiany

- R1/R2: odpowiedź wieloakapitowa dla `paragraph` jest dzielona po pustych liniach,
  po deep-clone i przed finalnym przypisaniem; każdy akapit przechodzi osobne
  `enforceBlockGrounding`. Pierwszy zachowuje `blockId`, kolejne dostają stabilny sufiks.
  `callout`, `bullet_list`, `numbered_list` nie są dzielone — zachowują semantykę swoich
  wyspecjalizowanych bloków. TipTap mapuje kolejne bloki `paragraph` 1:1, więc nie wymaga zmiany.
- F1: sygnał tytułu/celu sekcji nie kontaminuje już wszystkich bloków. Trafia do
  `evidence.toVerify`; własna treść bloku nadal rozstrzyga `isAssumption`.
- F2: tytuł dokumentu jest sprawdzany bez mutowania i w obie strony testowany w
  `evidence.toVerify`.
- R3: lekki parser (bez `marked`) obsługuje `**bold**` i linie `- `/`1. ` przez
  istniejące referencje numbering. GFM table pozostaje literalna, zgodnie z N-9;
  nie jest błędnie rozbijana. Dodano polskie etykiety realnie użytego `board_report`,
  wszystkie cztery gęstości oraz polski znacznik `[Założenie — wymaga źródła]`.
- R4: skomitowany harness `day195.real-llm-docx-probe.pg.test.ts` montuje realny
  `ApiGateway`, podpisuje JWT, używa realnego PG, woła `/generate` i `/export/docx`,
  czyta bazę i nie ma fallbacku uznawanego za dowód. Brak klucza zgłasza jawnie.

`renderCalloutBlock` potwierdzono odczytem: nie renderuje znacznika assumption. Nie
zmieniono go, bo granulacja R2 dotyczy tylko `paragraph`; luka pozostaje jawna.
Trzeci kasownik tabel nie dotyczy outline'u: brak `table`/`risk_table` i kolumny
`initiative`/`inicjatywa`.

## 3. Testy i mutacja

Deterministyczny pakiet końcowy: `23/23 PASS`, `--retry=0`, porównanie po `fullName`.
Obejmuje EPSILON, SIGMA, F1, F2 w obie strony, granulację oraz XML DOCX: bold,
`w:numPr`, brak surowych `**`/`- `, polską okładkę i polski znacznik.

Pełny pomiar `server/src/services/documentStudio/__tests__`: `994 total`, `933 PASS`,
`49 FAIL`, `12 SKIP`, więc **pełna suita jest czerwona**. Cztery pełne nazwy związane
bezpośrednio z DOCX to: `Day 32 — legacy DOCX renderer parity keeps document.xml and
styles.xml byte-identical without the DRD profile` oraz trzy warianty `pins three XML
parts` (`day34-rich-pl-document`, `day34-rich-en-document`,
`day34-rich-technical-document`). Nowy render celowo zmienia XML, ale te testy nie są
w tabeli licencji zapisu; nie aktualizowałem snapshotów. Dostarczony czerwony kontrakt
i brief: nadzorca powinien osobno rozstrzygnąć aktualizację zaakceptowanych snapshotów
po wizualnym odbiorze DOCX. Pozostałe porażki pełnej suity dotyczą m.in. PDF,
persistence/rollback i są poza zakresem; nie zostały zdiagnozowane do przyczyny.

Mutacja F1 na tej samej implementacji:

```text
STARA kontaminacja przywrócona: 4 total, 3 passed, 1 failed
failed | day190 ... R1 preserves a Polish title, heading and sentence containing Plan and marks the signal
Kod odtworzony przez cp: 4 total, 4 passed, 0 failed
MUTATION RESTORE DIFF PUSTY
```

## 4. Realny przebieg R1/R4 — wynik negatywny

Klucz został wczytany wyłącznie przez `set -a; . ~/.consultify-openrouter; set +a`;
wartości nie wypisano. Jedyny przebieg harnessu wykonał HTTP generate, ale asercja
zatrzymała go na `generationWarnings`: otrzymano tablicę długości `1`, oczekiwano `[]`.
Test: `0/1`, pełna nazwa:

```text
Day 195 real HTTP -> LLM -> PostgreSQL -> DOCX probe generates one two-target batch,
proves granular assumptions, reads back and exports DOCX
```

Harness przerwał przed readbackiem i eksportem, a cleanup usunął artefakt. Nie ma
więc realnego DOCX dnia 195, liczby słów, hash pliku ani dowodu wizualnego. Ostrzeżenie
wskazuje degradację prozy, ale reporter JSON nie zachował kodu ostrzeżenia ani stdout;
przy `MAX_BATCH_ATTEMPTS=2` nie da się uczciwie dowieść, czy provider zużył jedno czy
dwa wywołania. Przyjąłem bezpiecznie, że budżet dwóch wywołań mógł zostać wyczerpany,
więc **nie ponawiałem**. Harness po tym wyniku zapisuje diagnostykę fazy generate przed
asercją; zmiana nie została uruchomiona live w tym dyżurze.

W konsekwencji K1–K4 i K6 realnego pliku są `NOT_MEASURED`, K5 jest `NOT_PROVEN`.
Deterministyczne XML dowodzi mechanizmu renderera, nie jakości pliku produkcyjnego.
Status `GEN-2` pozostaje `PARTIAL`; wcześniejszy realny dowód dnia 190 pozostaje
obowiązujący, a jego K5 `FAIL` nie może zostać zastąpiony bez nowego pliku.

## 5. Z30 — brak wysyłki

Przed zapisem: `BRAK ZMIENNYCH POCZTY`; po migracjach zapytanie `settings WHERE key
LIKE 'smtp%'` zwróciło `0 rows`; grep Gateway nie znalazł drenów. Nie ustawiłem żadnej
zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP.
Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani
zaproszenie kalendarzowe nie zostało wysłane.

## 6. Artefakty poza repo

```text
962a5f6981ddf3d395edba32a7d92895d6485f389055a8427cf4b5f15aeea6b6  day195-focused-final.json
0cb6875c80517225bb1a4acb2d8f1578de7d8ebbf5fd0cd220e45eeaab94f239  day195-real-llm.json
2da8a53e03a221726bd8ba8c996d9c772577bb7fffc9d1357655323fcb7058ab  day195-mutation-red.json
5c524b8e16e045ca170db93ee68fa698c2fe52337e79ab07358a5243e9ef7dee  day195-mutation-green.json
e606b4d7539dc260a87edb65257a1c1c608ee388763c9a714bb0fd2dbac0bb2d  day195-documentstudio-full.json
```

Katalog: `/private/tmp/cx-day195-dokument-artefakty`.

## 7. Korekty wobec instrukcji

1. Tip bazowy uciekł do przodu; zgodnie z DEC-95 nie był to STOP.
2. Komentarz przy batchingu mówi „run sequentially”, lecz implementacja używa
   `runWithConcurrency(..., BATCH_CONCURRENCY=4)`; pomiar kodu jest wiążący.
3. Realny przebieg nie dostarczył `LLM call success`/DOCX i nie spełnił ukończenia
   R1–R4. Nie zaokrąglam wyniku do sukcesu.
4. Pełna suita Studia Dokumentów jest czerwona; cztery snapshoty DOCX wymagają
   właścicielskiej/nadzorczej akceptacji nowego XML przed aktualizacją poza licencją.

## 8. TWIERDZENIA NIEZWERYFIKOWANE

- Tabela arytmetyki jest kompletna dla użytego outline'u.
- Liczba słów **nie została zmierzona**; nie ma realnego pliku dnia 195.
- Granulacja obejmuje tylko `paragraph`, nie wszystkie typy prozy.
- `renderCalloutBlock` sprawdzono w kodzie; realnego renderu callout nie mierzono.
- Trzeci kasownik tabel nie dotyczył przebiegu (outline bez tabel).
- Próg graficzny D-8 `15/18` **nie został zmierzony**.
- Budżet 2400 tokenów jest zielony w teście jednostkowym, ale jego skuteczność na
  realnym providerze pozostaje `NOT_PROVEN`.
- Przyczyny 45 pozostałych porażek pełnego katalogu (poza czterema parity DOCX) nie
  zostały rozstrzygnięte; są poza licencją i nie wolno ich uznać za regresje ani dług zastany.

## 9. Commity i pliki

Commity: `ee2daa490f`, `9cef9b07ed`, `213fbbaa57` — każdy wypchnięty wyłącznie na
`github-backup/codex/day195-dokument-20260831`.

Pliki względem markera przed raportem: generator prozy, finalna granica groundingu,
renderer DOCX, trzy testy istniejące/nowe oraz repozytoryjny probe dnia 195. Nie
zmieniono frontu, `documentBlockContentGenerator.ts`, globalnej infrastruktury testów,
trzeciego kasownika ani innych modułów akceptacji.
