# CODEX DAY 133 — kontrakt mutacji w widżetach Mojej pracy

Stan: **GOTOWE DO ODBIORU — R1–R3 wdrożone z RED → GREEN; R4 pozostaje pomiarem bez naprawy.**

## Stan wejściowy i wznowienie

Pierwsze sanity `§0.1-BIS` było poprawne na markerze `64d3de306c`. Po commitach dyżuru wznowienie nastąpiło z decyzji nadzorcy na `29079c23b7`; obowiązująca kontrola dała:

```text
$ git merge-base --is-ancestor 64d3de306c HEAD && echo "BAZA OK"
BAZA OK
```

Gałąź: `codex/day133-zapis-mojej-pracy-20260830`. Drzewo przy wznowieniu było czyste. Nie wykonano fetchu, rebase, resetu ani pushu.

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

1. Nadzorca rozstrzygnął, że po commitach sanity sprawdza przodka markera, nie równość HEAD z markerem. `64d3de306c` jest przodkiem HEAD.
2. `Z34a` kontra `§8`: obowiązuje `§8`; **nie pushuję**.
3. Martwe odwołanie `Z24` do nieistniejącego `§0.4a` zostało pominięte. Poniżej podaję pełne nazwy faktycznie uruchomionych przypadków.
4. Raportu dyżuru 130 nie ma w klonie; zgodnie z decyzją nadzorcy użyto kompletnej specyfikacji z `§3 R1`.
5. Teza T2 potwierdziła się tylko częściowo: `DecisionDetailView` konsumuje `CommentsSection`; `TaskDetailView` konsumuje trzy widżety; notatnik konsumuje `AttachmentsSection`.
6. Teza T3 w brzmieniu opartym na `grep -c toast.success` nie potwierdziła przyczyny dla badanych handlerów. Dodatnie liczby obejmują inne operacje hostów. Lokalne handlery trzech widżetów nie miały własnych toastów sukcesu; ich defektem było zwracanie `Promise<void>`, po którym widżet bezwarunkowo ogłaszał sukces. Nie usuwano toastów niezwiązanych z R3.
7. Nadzorca rozszerzył licencję `NotebookAttachmentsSection.tsx` wyłącznie na typy/adaptację. Adapter jest fail-closed względem wyjątku: spełniona mutacja daje `{ ok: true }`, odrzucona daje `{ ok: false, error }`; nie zwraca zawsze sukcesu. `Api.downloadNotebookAttachment` i zachowanie UI pozostały nietknięte.

## R1 — wynik dyskryminowany w trzech widżetach

Wprowadzono kontrakt `{ ok: true, value? } | { ok: false, error }`. `AttachmentsSection`, `CommentsSection` i `LinkedItemsSection` wymagają go dla callbacków mutacyjnych. Upload/delete, add/reply/delete/like oraz add/remove/external-link nie ogłaszają sukcesu bez `ok: true`; `ok: false` daje komunikat błędu. Sygnatury callbacków mutacyjnych nie zawierają `Promise<void>`.

## R2 — żywa ścieżka notatnika

`NotebookAttachmentsSection` nadal renderuje wspólny `AttachmentsSection`. Wąski adapter zachowuje oba wyniki rzeczywistego callbacku: resolve → `ok:true`, reject → `ok:false`. Test przechodzi przez `NotebookAttachmentsSection` dla sukcesu i porażki. Nie zmieniono układu, tekstów, pobierania ani `Api.downloadNotebookAttachment`.

Przyjęty przez nadzorcę RED kompilacyjny W-C:

```text
day133-notebook-contract-conflict.ts(3,7): error TS2322: Type '(files: FileList) => Promise<void>' is not assignable to type '(files: FileList) => Promise<MutationResult>'.
  Type 'Promise<void>' is not assignable to type 'Promise<MutationResult>'.
    Type 'void' is not assignable to type 'MutationResult'.
```

Artefakt: `/private/tmp/cx-day133-zapis-mojej-pracy-artefakty/day133-type-conflict.accepted.txt`, SHA-256 `71eef63eb7beb2f5a59a40bfac60f33e0210ed5264c4b072b92cfced77109ac8`.

Po zmianie `npx tsc --noEmit --pretty false` zakończył się bez komunikatu i kodem 0.

## R3 — host zna i zwraca wynik

Licencjonowane handlery `TaskDetailView` oraz komentarzy `DecisionDetailView` zwracają jawne `{ok:true}` dopiero po zmianie stanu. Blokada decyzji i próba duplikatu zwracają `{ok:false,error}`. Toast wyniku należy do widżetu, który rozróżnia wynik. Test wykazuje brak sukcesu i jeden błąd dla `ok:false`, a dokładnie jeden sukces dla `ok:true`.

## R4 — czy komentarz dochodzi do serwera

Znalezienie zostało przyjęte przez nadzorcę i nie było naprawiane:

- Zadanie: add/delete/like zmieniają wyłącznie lokalny `comments` przez `setComments`.
- Decyzja: add/delete/like zmieniają lokalny stan; add dopisuje też lokalny activity log.
- Handlery nie wywołują `V8MyWorkApi`, `fetch`, `Api` ani `axios`. Istnienie `server/src/routes/v8/my-work.routes.ts` nie dowodzi użycia trasy.

Werdykt: **NOT_PROVEN runtime; statycznie ścieżka komentarzy Zadania i Decyzji jest wyłącznie lokalna.** Osobna pozycja musi dostarczyć backend/persistence; ten dyżur jej nie dopisuje.

## W-A/W-B — ten sam pakiet RED → GREEN

Komenda obu przebiegów:

```text
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/components/MyWork/shared/__tests__/MutationResult.redContract.test.tsx --retry=0 --reporter=json --outputFile=<artefakt>
```

RED po `git checkout 64d3de306c --` trzech widżetów, przy zachowaniu tego samego testu: `success=false`, 8 razem, 4 PASS, 4 FAIL. Czerwone pełne nazwy:

```text
MyWork mutation result contract (red contract) does not announce comment success when the mutation has no positive result
MyWork mutation result contract (red contract) preserves notebook upload failure instead of adapting it to success
MyWork mutation result contract (red contract) announces attachment upload 'failure' from its mutation result
MyWork mutation result contract (red contract) announces linked-item removal 'failure' from its mutation result
```

Artefakt RED: `/private/tmp/cx-day133-zapis-mojej-pracy-artefakty/day133-red-full-contract.json`, SHA-256 `2643db99e2d52e8d5ec9116dc1173d6c4580eafce1152dcd0279436e00b3fceb`.

GREEN po odtworzeniu przez `cp` ze scratch: `success=true`, 8 razem, 8 PASS, 0 FAIL. Pełne nazwy:

```text
MyWork mutation result contract (red contract) does not announce comment success when the mutation has no positive result
MyWork mutation result contract (red contract) announces comment success exactly once after a positive mutation result
MyWork mutation result contract (red contract) preserves notebook upload success through the typed adapter
MyWork mutation result contract (red contract) preserves notebook upload failure instead of adapting it to success
MyWork mutation result contract (red contract) announces attachment upload 'failure' from its mutation result
MyWork mutation result contract (red contract) announces attachment upload 'success' from its mutation result
MyWork mutation result contract (red contract) announces linked-item removal 'failure' from its mutation result
MyWork mutation result contract (red contract) announces linked-item removal 'success' from its mutation result
```

Artefakt GREEN: `/private/tmp/cx-day133-zapis-mojej-pracy-artefakty/day133-green-contract.json`, SHA-256 `9bdcd1e65c60a54867793efcd789188b2f16f61529617a7dcd925d5acce1935b`.

Testy renderują komponenty i klikają/zmieniają inputy. Nie używają `readFileSync` ani asercji na tekście źródła.

## Pułapki (a)–(e)

Pakiet jest czysto komponentowy: `RUN_DB_TESTS=0 MOCK_DB=true`; nie montuje `ApiGateway`, auth, V8 gate ani results beta middleware. Pułapki (a)–(d) nie leżą na jego ścieżce. Pułapka (e) jest kontrolowana listą diffu: brak `src/components/Initiatives/**`. Notatnik jest zmieniony wyłącznie w ramach imiennej decyzji nadzorcy.

## PostgreSQL i Z30

W poprzedniej części dyżuru uruchomiono wyłącznie `cx-day133-pg` (`pgvector/pgvector:pg16`) na `127.0.0.1:6016`; drugi przebieg migracji podał `Applying migrations: 0`.

```text
BRAK ZMIENNYCH POCZTY
SELECT ... FROM settings WHERE key LIKE 'smtp%': (0 rows)
grep drenów w server/src/Gateway.ts: 0 trafień
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano komentarzy przez realny HTTP/ApiGateway/JWT/PG, ponieważ hosty nie mają wywołania sieciowego, a R4 zabrania naprawy.
- Nie zweryfikowano liczb `35` miejsc ani `28` gospodarzy i nie użyto ich jako faktu.
- Nie wykonano runtime UI ani zrzutów; dowód jest komponentowy i kompilacyjny.
- ESLint pełnych hostów nie jest zielony: raportuje zastane problemy poza wąskim diffem. Nie uruchomiono autofix na hostach. `tsc`, test dowodowy i `git diff --check` są zielone.

## Granica rozłączności i commity

Commit implementacji: `85ebaf10fa fix(my-work): require explicit mutation results`.

Lista zmieniona względem markera po finalnym commicie ma obejmować wyłącznie:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY133_ZAPIS_MOJEJ_PRACY_REPORT.md
src/components/MyWork/DecisionDetailView.tsx
src/components/MyWork/TaskDetailView.tsx
src/components/MyWork/notebook/NotebookAttachmentsSection.tsx
src/components/MyWork/shared/AttachmentsSection.tsx
src/components/MyWork/shared/CommentsSection.tsx
src/components/MyWork/shared/LinkedItemsSection.tsx
src/components/MyWork/shared/__tests__/MutationResult.redContract.test.tsx
```

Brak `src/components/Initiatives/**`, tras, migracji, flag i infrastruktury testowej. Nie wykonano pushu.
