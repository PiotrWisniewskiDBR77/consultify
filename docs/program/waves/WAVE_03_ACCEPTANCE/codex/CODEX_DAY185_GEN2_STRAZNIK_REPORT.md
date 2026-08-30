# CODEX — DYŻUR 185 — GEN-2, STRAŻNIK LICZB

Data: 2026-08-30  
Marker: `18661cc6a0`  
Gałąź: `codex/day185-gen2-straznik-20260830`  
Werdykt: **R1 ZROBIONE / R2 NOT PROVEN / GEN-2 POZOSTAJE PARTIAL**

## Wynik najważniejszy

Strażnik nie kasuje już zdania tylko dlatego, że zawiera liczbę nieobecną w briefie.
Oryginalna treść zostaje, a `changed: true` nadal ustawia blok jako `isAssumption: true`.
Ta sama zasada obejmuje surowe wartości `number`: klucz i wartość nie znikają, blok jest
oznaczony. Reguła B dla akronimów, jej stała i allowlista pozostały nietknięte.

Nie zamykam R2. Wydana instrukcja zawiera konflikt: `Z15` zakazuje jakiegokolwiek
wywołania modelu, a R2 wymaga realnego LLM. Środowisko nie zawierało także żadnej nazwy
zmiennej dostawcy. Zgodnie z regułą bezpieczniejszej interpretacji nie źródłowałem sekretów,
nie uruchomiłem modelu i nie nazwałem fallbacku dowodem. Utworzony DOCX jest wyłącznie
dowodem renderera znacznika, nie dowodem pełnej ścieżki R2.

## §0.1 — baza, marker i rozjazd tipa

Wolne miejsce przed startem: `14 GiB` (minimum `5 GiB`). Porty `6094`, `5040`, `5041`:
`0 z 3` zajętych. Kontener: `cx-day185-pg`, obraz `pgvector/pgvector:pg16`, wyłącznie
`127.0.0.1:6094/cx185`.

Wynik komend (2), dosłownie:

```text
2ec857243a docs(codex): dyzury 180 i 184 wydane + zaostrzenie K6: kazdy plan produktu ma canonical_run_id=NULL — dowody limitow 174 dotycza sciezki nieuzywanej
b48a94dfc8 docs(codex): dyzury 181-183 wydane — otwarcie bety Spotkan (D-1), producent sygnalow ON (D-2), kalendarz ON z weryfikacja przyczyny rewertu (D-6)
dbadef184a docs(codex): dyzury 185-187 wydane — GEN-2 straznik z oznaczaniem zalozen, GEN-4 tresc w szablonowym PPT, eksport PDF audytu
ea68789d72 odbior 178: SCALONO (A/A, mutacja niezalezna) + szkielet: sekcja §0.4a NAPRAWIONA (A.1-TER, pomiar zasiegu pelnymi nazwami) — zglaszana przez 5 dyzurow
0144ced436 merge: dyzur 178 (sourceType nie nadpisywany frameworkiem — zakladka Inicjatywy Oceny widzi rekordy; empty-state Library uczciwy) — odbior A/A, mutacja niezalezna
bb88969b69 odbior 177-przejazd: SCALONO (B) — 50/50 zrzutow, PRT-D62-005/006 potwierdzone (dyzur 188), i18n rozlany na 25 ekranach (dyzur 189); wpis do koordynacji
c561d0f7dc merge: dyzur 177 przejazd G08 (25 sekcji x2 motywy, 17 render/7 blokada/1 nierozstrzygniete; PRT-D62-005/006 POTWIERDZONE; zadna bramka nie podniesiona) — odbior B
424c6638d1 odbior 179: SCALONO — 19/19 kluczy (obalona liczba z instrukcji), mutacja w obie strony, zrzut obejrzany
b06fb6df03 merge: dyzur 179 (19 kluczy PL governed handoff — kompletnosc A, dowod mutacyjny 0/4->4/4, zrzut realnego runtime po polsku) — odbior adwersaryjny
37790d554f arkusz: warsztat wlaczony TYLKO dla arkusza (Word i prezentacja nietkniete, z testem-bezpiecznikiem), prawy panel odzyskany, narzedzia widoczne bez zaznaczenia, cicha porazka zapisu zastapiona jawnym alarmem — gorna czesc ekranu 38,8 na 16,9 proc
b4e4a93842 podglady: rozjazd byl w DWOCH wspolnych komponentach, nie w ekranach — jeden naglowek, szerokosc z kanonu zamiast wpisanej w ekran, brakujacy wariant primary; dwa crimsony usuniete
9bedd4b1bf docs(day177): record authenticated partner portal replay
49dbd3198a odbior 174: FIX-174 wykonany (cennik 20 narzedzi, okno a2 domkniete z M4 czerwonym, pin day164 zdjety); K6 zostaje: dyzur 180 + decyzja fail-open + monitoring
a5251e1d06 rejestr: usuniety duplikat wpisu macierzy — moj wlasny blad przy odtwarzaniu formatu
18661cc6a0 Merge branch 'codex/m03-admin-20260824' of https://github.com/PiotrWisniewskiDBR77/consultify-recovery-private-20260820 into codex/m03-admin-20260824
336c234e6f rejestr: PROSTUJE wlasny blad — poprzedni commit przeformatowal caly plik (2629 linii zamiast 20); przywrocony format oryginalu
d70c067b71 docs(day174): errata — 7 total (5 pass, 2 pending), not 5/5
97187267a0 fix(day164): unpin Z31 DATABASE_URL assertion to any local Postgres
880e46f51f test(day174): unknown-tool-cost case for the exhaustive cost table
5dbdf5f178 test(day174): cancel-during-last-step (okno a2) — M4 mutation guard
3832e637bb fix(day174): close okno a2 — cancel-during-last-step no longer leaks lease
ad3008f50a merge: dyzur 175 + FIX-175 (regresje 163 usuniete; PUT ryzyk tylko przy edycji; izolacja najemcy mutacyjnie)
2ad9d1469b fix(day174): exhaustive tool cost table, no silent `?? 0` catch-all
6f8f299831 rejestr: macierz oceny DRD wchodzi do odbioru jako B — trzy braki wypisane PRZED spojrzeniem wlasciciela
620008967c odbior 175: SCALONO po FIX-175 (warunkowy PUT, izolacja najemcy mutacyjnie)
MARKER OK
```

Wynik komend (7), dosłownie:

```text
18661cc6a007769dd419060ff3089860f1163afc
```

Tip wyprzedza marker. Rozjazd zmierzono komendami z instrukcji; obejmuje wydanie
dyżurów 180–187 oraz wcześniejsze scalenia 174–179 i ich pliki. Pracę rozpocząłem
dokładnie z markera; nie wykonywałem rebase.

## Migracje i Z30

Pierwszy przebieg migracji zakończył się `Postgres migrations complete`; tabela
`schema_migrations` zawiera `870` wpisów. Drugi przebieg: `Applying migrations: 0`,
`Postgres migrations complete`.

```text
BRAK ZMIENNYCH POCZTY
settings WHERE key LIKE 'smtp%': 0 rows
Gateway.ts: 0 trafień drenaży outboxu
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## R1 — decyzje implementacyjne

1. Oznaczenie pozostaje na poziomie całego bloku. Jest to świadomy minimalny wybór:
   kanoniczny kontrakt i renderery DOCX/PDF obsługują `isAssumption` na bloku; oznaczenie
   pojedynczego tokenu wymagałoby niedozwolonej zmiany rendererów i schematu.
2. `unsupportedClaimInString` zwraca teraz powód `number | acronym | null`. Dla `number`
   treść zostaje i `changed=true`; dla ewentualnie ponownie egzekwowanego `acronym`
   zachowanie defensywne nadal prowadzi do placeholdera. Stała, allowlista i kod wykrywania
   reguły B nie zostały zmienione.
3. Surowy `typeof value === 'number'` zostaje w payloadzie i ustawia `changed=true`.
   Normalizator KPI konwertuje `value` do stringa, ale liczby występują w innych strukturach;
   nie ma już cichej utraty klucza.
4. T3 obalone w brzmieniu „osobna implementacja”: `documentContentGenerator.ts` importuje
   i wywołuje tę samą `enforceBlockGrounding`. Nie ma drugiej kopii `QUANT_TOKEN_RE` ani
   `unsupportedClaimInString`, więc poprawka obejmuje obie ścieżki wywołujące funkcję.
5. `groundingPlaceholder()` staje się domyślnie nieosiągalny dla liczb, lecz pozostaje
   defensywnie osiągalny po przywróceniu `GROUNDING_ACRONYM_RULE='enforced'`.
6. Nie wprowadzono flagi. To zmiana logiki backendowej wykorzystująca istniejący,
   produkcyjny kontrakt `isAssumption`; rozumowanie Z10 potwierdzone.

Commit R1: `1e852c9fae17771cdb85ea540b43e27d1fdd5b6a`, wypchnięty na
`github-backup/codex/day185-gen2-straznik-20260830` bezpośrednio po commicie.

## Testy i dowód mutacyjny

Targetowany pakiet, `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0`:

- poprawka: `6/6 PASS`, `0 FAIL`;
- mutacja przywracająca placeholder dla liczby: `4/6 PASS`, `2 FAIL`;
- po odtworzeniu: `6/6 PASS`, `0 FAIL`;
- porównanie pliku po odtworzeniu z kopią zieloną: `cmp exit 0`.

Czerwone pełne nazwy po mutacji:

- `... zachowuje zdanie z niepopartą liczbą i oznacza blok jako założenie`;
- `... zachowuje zdanie łączące dozwolony skrót z niepopartą liczbą i oznacza blok`.

Pełny istniejący pakiet `tests/unit/documentStudio`: `35/35 PASS`, `10/10` plików,
`0 FAIL`, `0 PENDING`.

Pełny pakiet `server/src/services/documentStudio/__tests__` nie jest zielony:

| Stan | Razem | PASS | FAIL | PENDING |
| --- | ---: | ---: | ---: | ---: |
| Marker | 984 | 928 | 45 | 11 |
| R1 | 985 | 928 | 46 | 11 |

Porównanie po pełnych nazwach wskazuje jeden dodatkowy czerwony kontrakt:
`generateBlockProse removes unsupported claims introduced by the prose enrichment pass`.
Test oczekuje starego placeholdera dla `Reach 85% by entering DACH with 8 initiatives.`;
to jest sprzeczne z D-8 dla liczb, ale plik testu nie jest objęty licencją zapisu.
Nie osłabiłem ani nie zmieniłem asercji. Pozostałe `45` FAIL są wspólne dla markera i R1.

Pułapki Z33: oba pakiety są czysto jednostkowe, z `RUN_DB_TESTS=0 MOCK_DB=true`;
nie dowodzą HTTP, JWT ani PostgreSQL. Pułapki (a)–(d) nie leżą na ich ścieżce.
Pułapka (e) jest istotą testu: dwie ścieżki wywołują wspólną funkcję, a nowy kontrakt
liczb jest świadomie inny od starej asercji generatora prozy.

Artefakty JSON:

- `/private/tmp/cx-day185-gen2-straznik-artefakty/day185-grounding-targeted.json`,
  SHA-256 `3f1612caed4f714ede6f40a8426b66751c8576636a2afb1348b440c8f09cf852`;
- `/private/tmp/cx-day185-gen2-straznik-artefakty/day185-grounding-mutated-red.json`,
  SHA-256 `5280e25b939c3f0215c3d1dd61e035970808d484c67e290c451a64c54ca47e9b`;
- `/private/tmp/cx-day185-gen2-straznik-artefakty/day185-grounding-restored-green.json`,
  SHA-256 `aa8acb769466e0dd2bbaf9a10a2240865742fd541ca6cf8e39b1a13e1af19b53`;
- `/private/tmp/cx-day185-gen2-straznik-artefakty/day185-documentstudio-unit.json`,
  SHA-256 `9557c4c8026a98d0a409f80ad516c5fd2a56ee47b5c8a5a3298f4b79f682dfdf`;
- pełny pakiet marker/R1: SHA-256 odpowiednio
  `8a6c891e5eb86c2c9a8f573359daff004362a35905649139a607acb7ced9b08a` i
  `fd60ff31f226cf2feaa72afff30a302cd2a419c1537afc6ed8afe7e8ec4ee3fd`.

## STOP — R2, realny DOCX przez LLM

Rodzaj: MERYTORYCZNY  
Powód: wydane Z15 zakazuje modelu, R2 wymaga realnego LLM, a środowisko nie zawiera
nazwy żadnej zmiennej dostawcy.  
Licencja, którą sprawdziłem: tabela licencji pozwala zapisać generator i dwa wskazane
testy, ale nie pozwala zmieniać konfiguracji dostawcy; Z15 mówi „Zero modelu językowego
w tym dyżurze”.  
Dowód: `env | cut -d= -f1 | grep -E 'OPENAI|OPENROUTER|GEMINI|GOOGLE_AI|ANTHROPIC'`
zwrócił `0` trafień; cytaty konfliktu są w sekcji „Korekty wobec instrukcji”.  
Co dostarczyłem ZAMIAST zmiany: targetowany kontrakt R1, mutację w obie strony oraz realny
DOCX z produkcyjnego renderera pokazujący widoczny znacznik założenia; jawnie nie jest to
dowód HTTP/LLM/DB.  
Co zrobiłbym, gdyby zapadła decyzja X: po usunięciu konfliktu Z15 i kontrolowanym udostępnieniu
dostawcy przeszedłbym `HTTP -> ApiGateway -> verifyToken -> PostgreSQL -> DOCX`, z licznikiem
`LLM call success`, podpisanym JWT i porównaniem PRZED/PO z jednego wejścia.  
Rekomendacja dla nadzorcy: wydać erratę rozstrzygającą Z15 oraz osobno licencjonować kontrolowaną
synchronizację dostawcy bez ujawniania wartości; następnie wykonać R2 na zachowanej gałęzi.  
Stan: zacommitowano częściowo w `1e852c9fae` (R1); R2 nie zacommitowano.  
Czy kontynuowałem pozostałe pozycje: TAK — wykonałem artefakt renderer-only, wizualną QA,
rubrykę R3 i raport.

## Artefakt zastępczy renderera — NIE jest dowodem R2

Plik: `/private/tmp/cx-day185-gen2-straznik-artefakty/day185-renderer-substitute.docx`  
SHA-256: `b32b3f2538a23ae69e7cd15d9f1b03df424cfad6b40f62d6bd69771fe38486f7`  
Typ: `Microsoft Word 2007+`; otwarty przez LibreOffice i wyrenderowany do `2` PNG.

Obie strony obejrzano w 100%: brak clippingu, overlapu, brakujących glifów i złamanej
geometrii. `word/document.xml` zawiera `ZNACZNIK-DAY185-GEN2`, pełne zdanie z `2` i
`85%`, styl `AssumptionBody` oraz widoczny tekst `[Assumption — needs source]`; nie zawiera
`Treść usunięta` ani `awaiting content`.

Tabela PRZED/PO wymagana przez R2: **NOT PROVEN** — bez realnego LLM nie powstały dwa
porównywalne pliki pełnej ścieżki. Nie podstawiam artefaktu renderer-only pod tę tabelę.

## R3 — rubryka K1–K6 zaprojektowana w dyżurze 185

Rubryka ocenia plik zastępczy tylko w granicach tego, co rzeczywiście mierzy. Wynik nie
podnosi GEN-2.

| # | Kryterium | Wynik | Dowód |
| --- | --- | --- | --- |
| K1 | Każda sekcja ma pełną prozę | `PASS_RENDERER_ONLY` | Jedna sekcja, trzy pełne akapity; zero placeholderów. Nie dowodzi prozy LLM. |
| K2 | Liczby-założenia oznaczone i zachowane | `PASS_RENDERER_ONLY` | `2`, `85%` oraz widoczny `[Assumption — needs source]`. |
| K3 | Zero angielskich fraz-widmo w polskiej treści | `PARTIAL` | Brak `awaiting content`; angielski znacznik założenia jest kanonicznym, świadomie istniejącym UI, nie frazą-widmo. |
| K4 | Znacznik dyżuru obecny | `PASS` | `ZNACZNIK-DAY185-GEN2` widoczny na stronie 2 i w XML. |
| K5 | Długość/gęstość adekwatna | `NOT_PROVEN` | Artefakt ma celowo krótki fixture renderera, nie odpowiedź LLM na brief. |
| K6 | Plik otwiera się bez błędu | `PASS` | LibreOffice wyrenderował 2/2 strony; obie obejrzane. |

Rubryka nie osiąga warunku właścicielskiego `15/18`, ponieważ K5 i dowód pełnej ścieżki
są `NOT_PROVEN`.

## Korekty wobec instrukcji

1. `§0.2 Z15`: „Zero modelu językowego w tym dyżurze”. `§3 R2`: „z REALNYM
   wywołaniem LLM”. To konflikt bezpośredni. Wybrałem bezpieczniejsze Z15, nie uruchomiłem
   modelu i opisałem R2 jako `NOT_PROVEN`.
2. Instrukcja odwołuje się do `§0.4a`, lecz wydany plik przechodzi z `§0.2d` do `§0.5`
   i nie zawiera `§0.3` ani `§0.4a`. Zastosowałem precedens dnia 90: pełny pakiet
   `tests/unit/documentStudio`, a dodatkowo pełny pakiet serwisowy z porównaniem nazw marker/R1.
3. T3 mówi o „drugiej, osobnej implementacji groundingu” w `documentContentGenerator.ts`.
   Pomiar wykazał import wspólnej `enforceBlockGrounding`; tezę obalono, bez zmiany tego pliku.
4. Pełny pakiet ujawnił starą asercję generatora prozy oczekującą kasowania liczby. Plik nie
   jest w licencji zapisu; nie zmieniłem go i nie przedstawiam pełnego pakietu jako zielonego.
5. Pierwszy odczyt instrukcji z vaulta został ucięty przez limit wyświetlania. Przed wykonaniem
   dyżuru odczytałem ten sam blob ponownie w całości, w numerowanych fragmentach `1–826`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Pełna ścieżka `HTTP -> ApiGateway -> verifyToken -> PostgreSQL -> DOCX`: `NOT_PROVEN`.
- Realne `LLM call success`, tokeny i czas: `NOT_PROVEN / NIE URUCHAMIANO`.
- Porównanie DOCX PRZED/PO z jednego realnego wejścia: `NOT_PROVEN`.
- Persystencja `sections[].blocks[].isAssumption` po realnym HTTP i readback: `NOT_PROVEN`.
- Akceptacja jakości przez właściciela i próg `15/18`: `NOT_PROVEN`.

## Stan końcowy i zakres

Pliki zmienione względem markera przed raportem: dokładnie dwa pliki R1. Po raporcie dochodzą
wyłącznie ten raport oraz wiersz `GEN-2` w 11_MATERIALS. Nie zmieniono rendererów, frontu,
middleware, Gatewaya, flag, konfiguracji dostawców, migracji ani infrastruktury testowej.

