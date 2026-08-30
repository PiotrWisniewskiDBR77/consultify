---
doc_id: funkcje-odbior-160
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# ODBIÓR 160 — potwierdzenie runtime bramy zapisu zadań

**Klasyfikacja: A na rdzeniu, B na dwóch inwentarzach.** Dowód mutacyjny przeszedł
w **niezależnym odtworzeniu** — nie na artefaktach wykonawcy.

Marker `218d020958`, 3 commity. **Zero zmian kodu produktu** — diff to wyłącznie
raport i nowy test. Licencja dotrzymana.

## Dowód HTTP jest prawdziwy — sprawdzone od zera

Cały łańcuch odtworzony na osobnym kontenerze (port 6055, nie 6048 wykonawcy),
z własną migracją od pustej bazy:

- test montuje **realny `ApiGateway`** przez `supertest`, JWT podpisany
  `config.JWT_SECRET`, realny `pg.Client` czytający stan bazy **surowym SQL
  po każdym żądaniu** — nie tylko kod odpowiedzi
- bez `RUN_DB_TESTS=1`/`MOCK_DB=false` test **pada** na
  `assertRealPostgresTestEnvironment` — **nie ma cichego mocka**
- `retry: 0` w kodzie testu — brak maskowania
- **wszystkie 9 artefaktów dowodowych istnieje fizycznie, a ich SHA-256 zgadzają się
  z raportem** — to nie są zmyślone liczby

### Wynik pomiaru

| żądanie | wynik | stan bazy |
|---|---|---|
| `POST /api/tasks` | **409** `EXECUTION_RUNTIME_V1_WRITE_REQUIRED` | `tasks 0→0` |
| `PUT`/`DELETE /api/tasks/:id` | **409** | bez zmian |
| `POST /api/tasks/:id/comments` | **409** | `comments 0→0` |
| `DELETE /api/execution-control/budget/entries/:id` | **404** | wyjątek działa — żądanie dociera do handlera |
| `POST /api/my-work/personal-tasks` | **201** | **1 wiersz utworzony** |

**Moje wcześniejsze sprostowanie potwierdzone pomiarem end-to-end:** kanoniczna
ścieżka jest zamknięta, ale produkt **ma działającą drogę tworzenia zadania**.

## Dowód mutacyjny — wykonany własnoręcznie

`res.status(409).json(...)` → `next()` w
`executionSpineLegacyReadOnly.middleware.ts` (symulacja wyłączonej bramy):

```text
1 failed | 2 passed
POST utworzyl prawdziwy wiersz (task_type: execution, kod 201)
AssertionError: expected 201 to be 409
```

Po przywróceniu: **3/3 PASS**, drzewo czyste. **Test mierzy bramę, nie udaje.**

## Liczby przeliczone niezależnie

| | raport | mój pomiar |
|---|---|---|
| trasy mutujące w `tasks.routes.ts` | 23 | **23**, pierwsza w linii 90, wszystkie po bramie z `:67` |
| `INSERT INTO tasks` w `server/src` | 28 → 26 po odjęciach | **28 → 26** ✅ |
| pliki-pisarze | „23 pliki" | **22 pliki** ❌ |
| wołacze `Api.createPersonalTask` | 6 | **6** ✅ |

**Jedyny błąd: „23 pliki" zamiast 22.** To liczba **wierszy tabeli**, nie plików —
`my-work.routes.ts` ma dwa wiersze, a trzy inne pliki łączą po dwa trafienia w jeden.
Błąd redakcyjny w podsumowaniu, **nie luka w inwentarzu**: sama lista i klasyfikacja
„za bramą / poza bramą" są kompletne i trafne wszędzie, gdzie sprawdzałem.

## ★ Cztery ciche powierzchnie — to jest do naprawy

Inwentarz obsługi `409` we froncie: **32 miejsca konsumenckie, co najmniej 4 ciche**.
Sprawdziłem punktowo trzy i wszystkie zgadzają się dosłownie:

- `useActionHandler.ts:428` — `toast.error('Failed to create task')` ✅ uczciwie
- `InitiativeTasksTab.tsx:64` — **tylko `console.error`**, zero komunikatu,
  a modal **nie zamyka się** w `catch` → użytkownik zostaje z otwartym oknem i ciszą
- `dashboard/UserTaskList.tsx:49` — `catch { setShowModal(false); }` — **okno znika
  bez słowa**, jakby się udało

**To jest gorsze niż samo `409`.** Użytkownik nie dowiaduje się, że jego praca
przepadła — widzi zamknięte okno.

## Czego NIE zweryfikowałem

- 29 z 32 pozycji inwentarza obsługi `409` (sprawdzone punktowo trzy).
- 20 plików-pisarzy sklasyfikowanych „zależy od wywołującego" — wykonawca **sam to
  przyznał** w sekcji twierdzeń niezweryfikowanych.
- Czy `automation.routes.ts` (mountStub) jest żywy na demo — zależy od flagi
  `enableStubRoutes`, nie sprawdzano.
- Nie testowano na demo, stagingu ani produkcji — zgodnie z zakazem.

## Werdykt

**Do scalenia.** Wzorowy dyżur pomiarowy: dotrzymał zakazu zmian produktu, dowód
jest prawdziwy i przeszedł niezależną mutację, artefakty mają zgodne sumy kontrolne,
a niepewności są nazwane wprost.

**Materiał do decyzji właściciela gotowy:** 22 pliki piszą do tabeli `tasks`, część
za bramą, część nie. Wybór między „zbudować polecenia kanoniczne" a „zawęzić bramę
z 19.08" ma teraz policzalną podstawę.
