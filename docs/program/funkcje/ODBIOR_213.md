# ★ SCALONE PO FIX-213 (`708010fbf5`) — 31.08.2026

Dług zasięgu bazy wiedzy spłacony. **Sejf projektowy działa: obcy nie widzi,
członek projektu widzi.**

## Co potwierdził odbiór adwersaryjny (własnymi rękami)
Migracja przechodzi **od pustej bazy** (874 migracji, drugi przebieg 0) · sejf
projektowy zamknięty na OBU torach (test własny audytora 10/10, z kontrolami
anty-tautologicznymi: przy każdym „nie widzi" dokument organizacyjny MUSI wrócić
w tym samym wywołaniu) · **sześć mutacji, sześć czerwieni** · unifikacja reguły
dowiedziona: jedna mutacja czerwieni oba tory jednocześnie · asymetria fail-open
zamknięta · regresja 210 czysta, przebieg końcowy 35/35.

## FIX-213 — cztery poprawki, każda z bramką

1. **Piąty inserter** (`demoSeedService.ts:2547-2596`), o którym karta 210 nie
   wiedziała: wiedza demonstracyjna Atelier Toys nie ustawiała zasięgu, więc trafiała
   do wartości domyślnej `'user'` z `owner_id=NULL` — czyli **demo pokazywało produkt
   bez jego rdzenia**, niewidoczny dla asystentki. Mutacja ⇒ `expected 'user' to be
   'organization'`. Przy okazji migracja `962` na kolumny istniejące dotąd wyłącznie
   jako runtime-ALTER (baza z samych migracji ich nie miała).
2. **Log „ciemnego retrievalu" znów działa.** Ostrzeżenie dodane w FIX-210 —
   po to, żeby brak kolumny nie gasił całej bazy wiedzy w ciszy — zostało przez 213
   unieważnione: kod wracał wcześniej, log był osiągalny tylko przy wyjątku. Dowód
   behawioralny: fizyczny `DROP COLUMN scope` na realnej bazie ⇒ log leci, wynik pusty.
   Usunięcie logu ⇒ czerwień.
3. **★ Sejf projektowy PRZYWRÓCONY członkom projektu.** Audytor wykrył „zamknięcie
   przez wygaszenie" — filtr poprawny, ale kontekst nie docierał, więc dokumentów
   projektowych nie widział **nikt**. Przyczyna zmierzona: `executeKBSearch` liczył
   listę projektów użytkownika, ale nie przekazywał jej dalej; drugi, redundantny
   filtr w głębi wykluczał dokument mimo obecności na liście dozwolonych. Bramka na
   REALNYM łańcuchu: członek widzi (zielone), obcy nie widzi (zielone), usunięcie
   przekazania ⇒ „członek widzi" czerwienieje.
4. **★ Stara reguła NIE była martwa — i przeciekała.** Wykonawca zmierzył ponownie
   i obalił własne wcześniejsze ustalenie: `getContext`/`getContextKeyword` są
   osiągalne przez łańcuch zapasowy (`searchRelevantChunks` → `getContext` gdy
   embeddingi zwrócą zero → `getContextKeyword` gdy embeddingi niedostępne), a mają
   realnych zewnętrznych wołaczy. Stara reguła (`scope != 'user'`) była **fail-open
   dla `scope='project'`** i bez kontroli widoczności dla AI. Obie przepięte na
   wspólny filtr. Powrót do starej reguły ⇒ oba testy czerwienią (dokument projektowy
   przecieka).

**Wniosek:** punkt 4 był realną ścieżką wycieku, znalezioną dlatego, że wykonawca
**nie zaufał własnemu pomiarowi z pierwszej rundy** („zero wołaczy") i policzył jeszcze raz.

**Pozycja otwarta:** czy demo ma kolumny widoczności dla AI — ich brak gasi całą
bazę wiedzy. Dyżurom nie wolno łączyć się z demo; pomiar należy do nadzorcy przed
promocją.

---

## Pierwotna karta odbioru adwersaryjnego

# ODBIÓR 213 — dług zasięgu w bazie wiedzy (audyt adwersaryjny)

Data audytu: 2026-08-31 · Gałąź: `codex/day213-zasieg-20260831` (6 commitów, tip `d9bdc0b767`)
Środowisko: własny kontener `cx-day213-audit-pg`, port 6321, `pgvector/pgvector:pg17` (usunięty po audycie).
Raport wykonawcy traktowany jako teza do obalenia, nie jako dowód.

## WERDYKT: SCALIĆ PO FIX · ocena **B**

Rdzeń zlecenia jest zrobiony i **udowodniony mutacyjnie**, nie deklaratywnie. Obalić się go
nie udało. Ale dyżur nie domknął własnego zakresu: znalazłem **piąty inserter**, o którym
karta nie wie, i **regresję na dowodzie dyżuru 210** (głośny log ostrzegawczy stał się
nieosiągalny). Żadne z tego nie otwiera sejfu z powrotem, więc to nie jest blokada.

## DWA PYTANIA WPROST

**(1) Czy migracja przechodzi od pustej bazy? — TAK.**

```
Applying migrations: 874        →  ✅ Postgres migrations complete   (PASS1_EXIT=0)
Applying migrations: 0          →  ✅ Postgres migrations complete   (PASS2_EXIT=0)
schema_migrations: success|874  (zero innych statusów)
961_knowledge_docs_scope.sql|success
```

Pusty kontener, pełny łańcuch, potem drugi przebieg (idempotencja) — oba zielone.
Kolumny na bazie zbudowanej WYŁĄCZNIE z migracji:
`scope text DEFAULT 'user'`, `ai_visibility text NOT NULL DEFAULT 'allowed'`,
`sensitivity text NOT NULL DEFAULT 'internal'`, `project_id`, `owner_id`.
Bramka nadrzędna z instrukcji jest spełniona — migracja 961 sortuje się PO wszystkim,
co czyta `scope`, więc łańcuch od zera się nie wywraca.

Uczciwe zastrzeżenie: `961_knowledge_docs_scope.sql` jest na świeżej bazie **no-opem**
(`ADD COLUMN IF NOT EXISTS`, kolumnę tworzy wcześniejszy baseline). Ma wartość jako
gwarancja, nie jako zmiana. Wykonawca sam to napisał (korekta T2) — potwierdzam.

**(2) Czy sejf projektowy jest dziś zamknięty na obu ścieżkach? — TAK.**

Napisałem własny test (`audit213.projectsafe.pg.test.ts`, 10 przypadków), celowo BEZ
`vi.mock` i bez `setDependencies`: ścieżkę RAG mierzę przez `bm25Search` (czyste SQL,
zero embeddingów), ścieżkę embeddingów przez podklasę. Każde „nie widzi" ma
**kontrolę anty-tautologiczną** — dokument organizacyjny, który MUSI wrócić w tym samym
wywołaniu. Bez niej „nie widzi" byłoby nieodróżnialne od „wyszukiwarka nie zwraca nic".

| | embeddingi | bm25/RAG |
| --- | --- | --- |
| kontrola: dokument org. wraca | ✓ | ✓ |
| dokument projektu bez listy projektów | NIE wraca | NIE wraca |
| dokument OBCEGO projektu, ta sama organizacja | NIE wraca | NIE wraca |
| dokument własnego projektu (dowód widoczności) | wraca | wraca |
| `ai_visibility='blocked'` / `sensitivity='confidential'` | NIE wraca | NIE wraca |

10/10 zielonych. **To jest ten scenariusz, o który pytała instrukcja: użytkownik spoza
projektu, ale z tej samej organizacji, nie widzi dokumentu projektowego — na obu torach.**

## Bramka mutacyjna — sześć mutacji, sześć czerwieni

Zakaz `git stash` respektowany (odkładanie przez `cp`). Wszystko przywrócone.

| # | Mutacja | Skutek |
| --- | --- | --- |
| M1 | `knowledgeIndexer.ts:868` — usunięty jawny `scope` (INSERT + ON CONFLICT) | 🔴 inserter-scope |
| M2 | `insightSignalBridgeService.ts:203` — jw. | 🔴 inserter-scope |
| M3 | `ai.routes.ts:599` (ingest pliku) — jw. | 🔴 route contract |
| M4 | `ai.routes.ts:868` (ingest URL) — jw. | 🔴 route contract |
| M5 | `knowledgeDocAccessFilter.ts:36` — `scope='project'` dozwolony bezwarunkowo | 🔴 **oba tory naraz** (mój A2/A3 + B2/B3; wykonawcy 3/5) |
| M6 | `knowledgeDocAccessFilter.ts:39` — usunięty warunek governance | 🔴 **oba tory naraz** (mój A5 + B5; wykonawcy 2/5) |

**Cztery insertery, cztery czerwienie — zgodnie z wymogiem. Żadna mutacja nie została zielona.**
M5/M6 to dowód UNIFIKACJI: jedna zmiana w jednej funkcji czerwieni ścieżkę embeddingów
i ścieżkę RAG jednocześnie. Teza A.2 wykonawcy się broni.

## Asymetria fail-open / fail-closed — zamknięta w torze żywym

Pomiar bezpośredni na czystej funkcji (`buildKnowledgeDocAccessFilter`):

```
RAG  komplet kolumn  => ((d.scope IS NULL OR d.scope = 'organization' OR (d.scope='user' AND d.owner_id = ?)) AND COALESCE(...)...)
RAG  brak scope      => 1 = 0            ← było: brak klauzuli (fail-OPEN)
RAG  brak governance => 1 = 0
EMB  brak scope      => NOT EXISTS (... d.id = e.document_id)
```

`ragService` nie ma już `if (hasScope)` bez `else` w torze retrievalu — jest wywołanie
wspólnej funkcji, która przy braku kolumny zwraca `1 = 0`. Asymetria z karty 210 zniknęła.

## Pułapki pomiarowe — zmierzone, nie założone

**Pułapka atrap w `beforeEach` (zadanie 6): NIE dotyczy tego dyżuru.** `vitest.config.ts`
nie ustawia `clearMocks`/`mockReset`/`restoreMocks`, więc `vi.clearAllMocks()` z
`tests/setup.ts:811` czyści historię wywołań, nie implementacje. Niezależnie od tego
test dostępu wstrzykuje przez `RagService.setDependencies` **zwykłe funkcje strzałkowe,
nie `vi.fn()`** — nie ma tam czego kasować. Dowód empiryczny mocniejszy od rozumowania:
mutacje M5/M6 czerwienią testy na pozycjach 1-3 i 4-5, a więc także te PO pierwszym;
gdyby atrapy cicho znikały, późniejsze testy nie reagowałyby na mutację. Dodatkowo mój
własny test nie używa atrap w ogóle i daje ten sam werdykt.

**Ciche pomijanie (zadanie 7): strażnik działa, ale linia podsumowania myli.**
Uruchomienie bez `RUN_DB_TESTS=1`/`DATABASE_URL`:

```
Test Files  1 failed (1)
     Tests  5 skipped (5)
EXIT_CODE=1
```

Wyjście jest niezerowe i plik jest `failed` — czyli „N skipped, exit 0" NIE występuje.
Ale linia `Tests 5 skipped` sama w sobie wygląda niewinnie. **Kto czyta tylko wiersz
`Tests`, zobaczy zieleń tam, gdzie jej nie ma — czytać wiersz `Test Files` i kod wyjścia.**

## Regresja na cudzej pracy (zadanie 8): CZYSTO

`day210.embeddingScope.pg.test.ts` → 7/7 · `day210.realchain.proof.pg.test.ts` → 2/2.
Ten drugi idzie realnym łańcuchem produkcyjnym (`executeToolCall(search_knowledge_base)`
→ `ragService.hybridSearch`) — to zarazem dowód, że nowy fail-closed **nie wygasił
retrievalu**. Pełny przebieg końcowy po przywróceniu mutacji: **35/35 zielonych**
(2+5+10+7+2+9), sekwencyjnie, `--retry=0`.

## FIX-y

**FIX-213-1 (P1) — piąty inserter, nieznaleziony przez dyżur.**
`server/src/services/demo/demoSeedService.ts:2559-2586` wstawia do `knowledge_docs`
z dynamiczną listą kolumn, w której `scope` **nie występuje nigdy**. Dokument dostaje
domyślne `'user'` przy `owner_id = NULL`, więc nowa reguła (`scope='user' AND owner_id=$1`)
nie wpuszcza go **nikomu**. Karta mówiła o czterech inserterach — jest ich pięć.
Nie jest to regresja 213 (stara reguła `scope != 'user'` też go wykluczała), ale to
dokładnie ta sama wada i zostawia **demo-owy zestaw wiedzy Atelier Toys niewidoczny dla AI**.

**FIX-213-2 (P1) — dyżur 213 unieważnił głośny log dyżuru 210.**
`server/src/services/ai/embeddingService.ts:374-388`: ostrzeżenie „scope column is missing —
retrieval is silently dark" siedzi w gałęzi `if (!hasScope)`, osiągalnej **tylko gdy
zapytanie do `information_schema` rzuci wyjątkiem**. W scenariuszu, dla którego log
powstał (zapytanie działa, kolumny po prostu nie ma) kod wraca wcześniej — linia 361 —
i zwraca filtr fail-closed **bez jednego słowa w logu**. FIX-210 dodał ten log właśnie po to,
żeby ciemny retrieval nie był cichy. Dziś znowu jest cichy.

**FIX-213-3 (P2) — stara reguła żyje w dwóch miejscach.**
`server/src/services/ragService.ts:520-521` (`getContext`) i `:606-607` (`getContextKeyword`)
nadal mają `if (hasScope)` **bez `else`** oraz `d.scope != 'user'` — czyli kształt fail-open,
przepuszczanie `scope='project'` i zero governance. Zmierzyłem zasięg: **obie funkcje nie mają
żadnego wołacza poza `ragService.ts`** (`getContext` → `getContextKeyword`, a `getContext`
nie jest wołany znikąd), więc dziś nie szkodzą. Ale teza A.2 „jedno źródło reguły" jest
prawdziwa tylko dla toru żywego. Usunąć albo przełączyć na wspólną funkcję, zanim ktoś
je ożywi.

**FIX-213-4 (P1) — bramka przed promocją na demo.**
`knowledge_docs.ai_visibility`/`sensitivity` pochodzą **wyłącznie** z
`server/migrations/20261720_day131_teresa_knowledge_boundaries.sql`; nie ma dla nich
żadnego runtime-ALTER-a. Nowy filtr przy braku tych kolumn zwraca `1 = 0`, czyli
**cała baza wiedzy gaśnie**. Przed promocją zmierzyć na demo (odczyt, nie zapis):
`SELECT column_name FROM information_schema.columns WHERE table_name='knowledge_docs'
AND column_name IN ('ai_visibility','sensitivity','scope','project_id');` — muszą być cztery.

**FIX-213-5 (P2) — dryf schematu unieważnia dowód A.1 na bazie od zera.**
Na bazie zbudowanej WYŁĄCZNIE z migracji test `day213.inserter-scope.pg.test.ts` jest
**czerwony**: `column "metadata" of relation "knowledge_docs" does not exist`.
`metadata` i `indexed_at` istnieją tylko jako runtime-ALTER w
`server/src/database/PostgresDatabase.ts:1803-1804` — w łańcuchu migracji ich NIE MA,
a piszą do nich `knowledgeIndexer.ts:868` i `insightSignalBridgeService.ts:203`.
Zieleń 2/2 z raportu wykonawcy mogła powstać wyłącznie na bazie, na której zdążył
wykonać się `initDb()`. Po dołożeniu obu kolumn ręcznie test jest 2/2 zielony i przechodzi
bramkę mutacyjną — czyli **kod dyżuru jest dobry, kłamie środowisko dowodowe**.
Wada jest zastana, nie wprowadzona przez 213. Dorobić migrację na `metadata`/`indexed_at`.

**FIX-213-6 (P2) — sejf zamknięty przez wygaszenie, nie przez wpuszczenie właściwych.**
Żaden produkcyjny wołacz nie przekazuje `projectIds` (potwierdzam pomiar wykonawcy).
Skutek: dokumenty z żywej trasy `POST /api/knowledge/documents` (`scope='project'`)
są dziś niewidoczne w retrievalu **dla wszystkich**, łącznie z członkami projektu.
Bezpiecznie — i celowo fail-closed — ale funkcjonalnie sejf jest zamknięty na głucho.
Przewleczenie `projectIds` od kontekstu rozmowy to osobny zakres; **nie wolno o nim
zapomnieć**, bo inaczej „zamknęliśmy sejf" znaczy „schowaliśmy zawartość przed właścicielem".

**FIX-213-7 (P3) — dowód dwóch tras HTTP pozostaje jednostkowy.**
`server/src/routes/__tests__/ai.routes.attachments-ingest.test.ts:155-157` i `:269-271`
sprawdzają **kształt stringa SQL** na zamockowanym routerze (`toContain('scope')`,
`toContain("'organization'")`), a nie odczyt z bazy. Mutacja je czerwieni, więc pokrycie
jest realne, ale to nie jest dowód realPG. Wykonawca sam oznaczył A.1 jako `PARTIAL` —
potwierdzam tę ocenę i nie podnoszę jej.

## Czego NIE udało się obalić (próbowałem)

- **Hipoteza: nowy filtr to lista dozwolonych, więc ukryje nieznane wartości `scope`.**
  Obalona własnym pomiarem — w całym kodzie istnieją dokładnie trzy wartości
  (`user`, `organization`, `project`), lista dozwolonych jest kompletna.
- **Hipoteza: `1 = 0` przy brakujących kolumnach wygasi retrieval na normalnej bazie.**
  Obalona — `ensureKnowledgeDocsColumns` czyta WSZYSTKIE kolumny tabeli, a na bazie od
  zera komplet istnieje. Ryzyko zostaje tylko dla środowisk bez migracji day131 → FIX-213-4.
- **Hipoteza: pułapka `beforeAll` fałszuje zieleń dyżuru.** Obalona dwoma niezależnymi
  pomiarami (konfiguracja vitest + reakcja późniejszych testów na mutację).

## Higiena

Mutacje przywrócone, `git diff --stat` pusty, drzewo czyste (jedyny ślad — mój własny
plik testowy, usunięty po audycie i odłożony do artefaktów). Kontener `cx-day213-audit-pg`
skasowany przez `docker rm -f -v`. Zero połączeń do demo, stagingu, produkcji i Railway —
wyłącznie lokalny Postgres na porcie 6321 (poza pasmami 6151-6157 i 5092-5105).
Nie pushowałem. Nie uruchamiałem pełnego `tsc` ani `vitest` na całym repo.
