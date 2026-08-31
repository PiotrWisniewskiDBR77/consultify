---
doc_id: funkcje-odbior-169
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# ODBIÓR 169 — okna check-inu celu

**Klasyfikacja: A na czterech częściach technicznych, D na tym, o co właścicielowi
naprawdę chodziło.** Zero naruszeń licencji.

Marker `18ba1bd3cf`, 2 commity, 4 pliki: `okr.routes.ts`, `okrCheckInScheduler.ts`,
test, raport. Zero pod `kpi/**`, `workers/**`, `Scheduler.ts`. Bez migracji.
Rollup postępu nietknięty — zakaz dotrzymany.

## Co naprawiono naprawdę — i to jest dobre

**Generator jest wpięty POZA jakąkolwiek flagą.** Oba zaczepy
(`okr.routes.ts:843-865` i `:1385-1405`) uruchamiają się bezwarunkowo przy
`outcome === 'applied'`. **Nie wpadły w pułapkę `ENABLE_AI_TASKS_WORKER`**, przed
którą ostrzegała instrukcja — nie powstała druga biblioteka bez wywołania.

**Drugi błąd naprawiony w OBU kolejnościach.** Powstała nowa funkcja
`seedExistingCheckInObligationsForSet`, która uzupełnia obowiązki wobec **już
istniejących** okien — a nie tylko nowo utworzonych.

**Audytor zrobił dowód mocniejszy niż wykonawca.** Raport zmutował jedno miejsce
i sam przyznał, że nie udowodnił niezależności obu zaczepów. Audytor zmutował
**każdy osobno**:

```text
mutacja A: wylaczony zaczep aktywacji ZESTAWU  → oba testy czerwone
mutacja B: wylaczony zaczep aktywacji CYKLU    → oba testy czerwone
po przywroceniu                                → oba zielone, drzewo czyste
```

**Wymóg `cadenceOccurrenceId` NIE osłabiony** — `resultsVnextOkr.validators.ts:548`:
`z.string().uuid()`, wymagane, bez `.optional()`, `.default()` ani `.nullable()`.
Plik **nie jest w diffie**. Okno pochodzi z realnego `generateCadenceOccurrences`,
nie jest fabrykowane „teraz do teraz" — potwierdzone spójnym rollupem po check-inie
(`progress 0.5`, `objective 0.25`, `set 0.25` — matematycznie zgodne).

## ★★ D — bramka odbioru NIE jest spełniona. Wina moja.

Zapisałem bramkę jako: *„check-in BEZ ręcznego wywoływania czegokolwiek skryptem"*.
**Formalnie spełniona — skryptu nie trzeba.** Ale minęła się z tym, o co chodziło.

Front nadal **nie ma skąd wziąć identyfikatora okna**.
`OkrCheckInRecordDialog.tsx:6-20` zawiera długi, jawny komentarz w kodzie:

> *„HONEST GAP — `cadenceOccurrenceId` has no picker source... no route anywhere
> in `okr.routes.ts` exposes `okr_vnext_checkin_occurrences`... this field is
> a manually entered UUID"*

Sprawdziłem: w `okr.routes.ts` jedyne wystąpienie to `body.cadenceOccurrenceId`
w handlerze zapisu. **Zero tras `GET` listujących okna.**

**Odpowiedź na pytanie „czy zwykły użytkownik może teraz zrobić check-in": NIE.**
Może to zrobić wyłącznie ten, kto sam wywołał `/activate` i odczytał identyfikator
z surowego JSON-a odpowiedzi. Właściciel kluczowego rezultatu, robiący cotygodniowy
check-in tygodnie po aktywacji, **nadal nie ma żadnej drogi**.

### Dlaczego to nie jest wina wykonawcy

**Raport przyznaje to sam**, wprost, jako `NOT PROVEN` i „realny produktowy brak".
Nie zatajono tego.

**Co więcej — wykonawca frontu zachował się wzorowo w przeszłości:** komentarz mówi,
że odrzucono `crypto.randomUUID()` jako wypełniacz, bo serwer przyjąłby taką wartość
po cichu i **stworzył check-in wobec okna, którego nigdy nie zaplanowano** — czyli
uszkodzenie danych. Wybrano jawną lukę zamiast cichej fabrykacji. **To jest właściwy
wybór** i chcę go odnotować.

### Mój błąd, nazwany

Skupiłem instrukcję na **wpięciu generatora** i **kolejności aktywacji** — bo to
wynikało z pomiaru tora grafiki. **Nie sprawdziłem, czy front ma skąd wziąć
identyfikator**, mimo że sam wielokrotnie dziś powtarzałem, że warstw jest cztery,
a ostatnia brzmi „czy się renderuje / wykonuje".

**Zabrakło mi własnej reguły.** Bramka odbioru powinna była brzmieć: *„użytkownik
otwiera kartę celu, klika check-in, wybiera okno z listy i zapisuje"* — a nie
*„bez uruchamiania skryptu"*.

## Do zrobienia — osobna pozycja, mała

Trasa `GET` listująca dostępne okna dla kluczowego rezultatu plus podłączenie jej
jako źródła wyboru w `OkrCheckInRecordDialog.tsx`. Backend jest **gotowy** —
obowiązki są zasiewane poprawnie w obu kolejnościach. Brakuje wyłącznie odczytu.

## Czego NIE zweryfikowano

- Zachowania na demo, stagingu i produkcji — zakaz, dotrzymany po obu stronach.
- Pełnego korpusu testów repo — uruchomiono plik dyżuru plus `tsc --noEmit` (exit 0).
- Ścieżki błędu przy uszkodzonym zasiewie (gałąź `catch` przy zachowanym `200`).
- Czy `okrCheckInSummaryRepository.ts` powinien zwracać identyfikator okna — to
  ocena produktowa, nie techniczna.

## Werdykt

**Do scalenia.** Backend jest teraz poprawny i niezależny od kolejności zdarzeń,
z dowodem mutacyjnym mocniejszym niż w raporcie. Nic się nie pogorszyło.

**Ale cel właściciela nie jest osiągnięty** i nie wolno tego zapisać jako zamknięte.
Wraca jako pozycja o jawnej treści: **dać użytkownikowi listę okien do wyboru.**
