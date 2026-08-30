# CODEX DAY 133 — kontrakt mutacji w widżetach Mojej pracy

Stan: **PARTIAL / EVIDENCE_MISSING — czerwony kontrakt dostarczony; zmiana produktu wstrzymana z powodu nierozwiązywalnego konfliktu licencji i W-C.**

## Stan wejściowy

Sanity `§0.1-BIS`:

```text
64d3de306c docs(funkcje): zrodlo 11 bramek znalezione i wskazane; nowe otwarcie — kanon bramek sam jest szkicem (OD-02)
codex/day133-zapis-mojej-pracy-20260830
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 06:50 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
Filesystem        Size    Used   Avail Capacity iused ifree %iused Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    30Gi    29%    459k  310M    0% /
```

`git status --short` nie zwrócił żadnej linii. Porty `6016`, `4932`, `4933` oraz nazwa `cx-day133-pg` były wolne.

Pięć pomiarów wejściowych:

```text
T1: 6 plików: po 3 w MyWork/shared i Initiatives/sections.
T2 AttachmentsSection -> TaskDetailView.tsx, plik definicji, NotebookAttachmentsSection.tsx
T2 CommentsSection -> TaskDetailView.tsx, plik definicji, DecisionDetailView.tsx
T2 LinkedItemsSection -> TaskDetailView.tsx, plik definicji
T3 TaskDetailView.tsx:23; DecisionDetailView.tsx:24
T4 Attachments: onUpload/onDelete Promise<void>; Comments: onAdd/onDelete/onLike/onGenerateAI Promise<void>; LinkedItems: onAdd/onRemove Promise<void>
T5 NotebookAttachmentsSection.tsx:61 i :121 wywołują Api.downloadNotebookAttachment(...)
```

## Korekty wobec instrukcji

1. `§1` wymaga odczytu raportu z refa `github-backup/codex/day130-utrata-danych-20260829`, lecz lokalny vault nie zawiera tego refa (`git branch -a --list '*day130*'` i `git show-ref | rg day130` — zero wyników), a `§0.1-BIS` nakazuje pominąć fetch. Zastosowałem bezpieczniejszą interpretację: nie wykonałem fetchu i użyłem kompletnej specyfikacji wyniku dyskryminowanego powtórzonej w `§3 R1`.
2. `§0.1 Z34a` mówi „PO PIERWSZYM COMMICIE ROBISZ PUSH”, natomiast ostatnie zdanie `§8` mówi „Nie pushujesz”. Zastosowałem późniejsze i bezpieczniejsze polecenie: **nie pushuję**.
3. Teza T2 nie potwierdziła się w podanym kształcie. `DecisionDetailView` konsumuje tylko `CommentsSection`; `AttachmentsSection` i `LinkedItemsSection` konsumuje `TaskDetailView`, a notatnik konsumuje tylko `AttachmentsSection`.
4. BLOK 0 został wykonany po T1–T5, choć `Z20` mówi „przed jakimkolwiek pomiarem”. T1–T5 były wyłącznie odczytem plików i nie dotknęły bazy; mimo to kolejność raportuję jako odchylenie proceduralne, bez podnoszenia statusu dowodu bazodanowego.
5. `Z24` odsyła do `§0.4a`, ale instrukcja nie zawiera sekcji `§0.4a` (wyszukiwanie `rg -n "0\\.4a|Pomiar zasięgu"` znajduje tylko odwołania). Nie wymyśliłem mianownika. Raportuję pełną nazwę jedynego dodanego przypadku i stan 0/1 PASS.

## R1 — czerwony kontrakt i konflikt granicy

Dodano behawioralny test renderujący `CommentsSection`. Callback kończy się bez pozytywnego wyniku; kontrakt wymaga wtedy błędu i zakazuje sukcesu. Test nie czyta tekstu pliku produkcyjnego.

Przebieg RED (`RUN_DB_TESTS=0 MOCK_DB=true npx vitest run ... --retry=0 --reporter=json`):

```text
success=false; numTotalTests=1; numPassedTests=0; numFailedTests=1
fullName: MyWork mutation result contract (red contract) does not announce comment success when the mutation has no positive result
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
```

Artefakt: `/private/tmp/cx-day133-zapis-mojej-pracy-artefakty/day133-red-contract.json`, SHA-256 `dc5871d1addb1debf222e4a556fb097c42ee83589c2f35f0c727aff0afc628fa`.

Pełnej zmiany produktu nie wprowadzono. Powód jest typowy i reprodukowalny:

- W-C wymaga, aby `async () => setState(...)`, czyli `Promise<void>`, był błędem kompilacji dla callbacku mutacyjnego `AttachmentsSection`.
- `NotebookAttachmentsSection.tsx` jest objęty Z40 (twardy zakaz zapisu), a jego publiczne propsy deklarują `onUpload` i `onDelete` jako `Promise<void>` i przekazują je bez adaptera do `AttachmentsSection`.
- Po zmianie `AttachmentsSection` na `Promise<MutationResult>` niezmieniony notatnik nie kompiluje się. Dopuszczenie `Promise<void>` przez union, overload, `unknown` albo rozpoznanie po `onDownload` byłoby obejściem W-C, nie wdrożeniem kontraktu.

Minimalna reprodukcja kompilatora, uruchomiona lokalnym TypeScriptem bez sieci:

```text
day133-notebook-contract-conflict.ts(3,7): error TS2322: Type '(files: FileList) => Promise<void>' is not assignable to type '(files: FileList) => Promise<MutationResult>'.
  Type 'Promise<void>' is not assignable to type 'Promise<MutationResult>'.
    Type 'void' is not assignable to type 'MutationResult'.
```

Artefakt: `/private/tmp/cx-day133-zapis-mojej-pracy-artefakty/day133-type-conflict.txt`, SHA-256 `71eef63eb7beb2f5a59a40bfac60f33e0210ed5264c4b072b92cfced77109ac8`.

Brief dla nadzorcy: potrzebna jest imienna licencja na wąską zmianę dwóch typów callbacków i adapterów w `NotebookAttachmentsSection.tsx` (lub decyzja, że ścieżka notatnika otrzymuje wynik dyskryminowany od swojego hosta). Dopiero potem można atomowo zmienić trzy widżety i wszystkich konsumentów bez luki kompatybilności.

## R2 — notatnik

Plik notatnika pozostał niezmieniony. Test przechodzący przez notatnik po zmianie kontraktu nie może zostać uczciwie dostarczony, ponieważ sama wymagana zmiana kontraktu powodowałaby błąd typów na jego niezmienionych `Promise<void>`. Nie użyto castu ani adaptera ukrywającego porażkę.

## R3 — hosty

Nie zmieniono hostów. Ich callbacki komentarzy, załączników i powiązań wykonują lokalne `setState` i zwracają `Promise<void>`. Usunięcie toastów hosta bez wdrożenia atomowego kontraktu R1 nie zamknęłoby ścieżki sukcesu i stworzyłoby częściową, mylącą implementację.

## R4 — czy komentarz dochodzi do serwera

Pomiar źródła (nie dowód runtime) wykazał:

- Zadanie: `handleAddComment` w `TaskDetailView.tsx` tworzy obiekt i wykonuje wyłącznie `setComments`; delete i like również tylko zmieniają stan lokalny.
- Decyzja: `handleAddComment` w `DecisionDetailView.tsx` wykonuje `setComments` i lokalny `addActivityLogEntry`; delete i like również tylko zmieniają stan lokalny.
- W żadnym z tych handlerów nie ma wywołania `V8MyWorkApi`, `fetch`, `Api` ani `axios`. Istnienie tras `server/src/routes/v8/my-work.routes.ts` nie dowodzi ich użycia przez te handlery.

Werdykt R4: **NOT_PROVEN runtime; statycznie wskazana ścieżka komentarzy jest wyłącznie lokalna i nie ma połączenia mutacyjnego z serwerem.** Nie naprawiano tras ani hostów poza licencją R4.

## PostgreSQL i Z30

Uruchomiono wyłącznie `cx-day133-pg` (`pgvector/pgvector:pg16`) na `127.0.0.1:6016`. Pierwszy przebieg migracji zakończył się `Postgres migrations complete`; drugi podał `Applying migrations: 0` i zakończył się poprawnie.

```text
BRAK ZMIENNYCH POCZTY
SELECT ... FROM settings WHERE key LIKE 'smtp%': (0 rows)
grep drenów w server/src/Gateway.ts: 0 trafień
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Pułapki (a)–(e)

Pakiet czerwonego kontraktu jest czysto komponentowy (`RUN_DB_TESTS=0 MOCK_DB=true`) i nie montuje `ApiGateway`, middleware wyników ani auth, więc (a)–(d) nie leżą na jego ścieżce. Pułapka (e) dotyczy zakresu: test importuje wyłącznie `MyWork/shared/CommentsSection`; `git diff --name-only` jest dowodem, że nie dotknięto `Initiatives/**` ani notatnika.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano działania komentarzy przez realny HTTP/ApiGateway/JWT/PG, ponieważ pomiar statyczny nie znalazł wywołania sieciowego z handlerów, a R4 zabrania naprawy.
- Nie zweryfikowano zgodności notatnika po nowym kontrakcie, bo kontraktu nie można atomowo wdrożyć bez zmiany pliku objętego Z40.
- Nie zweryfikowano liczb `35` miejsc ani `28` gospodarzy z dyżuru 130 i nie użyto ich jako faktu.
- Nie zweryfikowano pełnego zasięgu testów przed/po według nazw `fullName`; czerwony kontrakt pozostaje zamierzonym dowodem defektu, nie zieloną bramką odbioru.
- Nie wykonano pary RED→GREEN z W-A: GREEN wymagałby nielicencjonowanej zmiany notatnika albo obejścia W-C. Status nie został podniesiony.

## Granica rozłączności

Dosłowny wynik `git diff --name-only 64d3de306c..HEAD`:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY133_ZAPIS_MOJEJ_PRACY_REPORT.md
src/components/MyWork/shared/__tests__/MutationResult.redContract.test.tsx
```

Commit pozycji: `2c89cdc9ba test(my-work): document blocked mutation result contract`. Nie zmieniono `src/components/Initiatives/**`, `NotebookAttachmentsSection.tsx`, tras, migracji, flag ani infrastruktury testowej.
