---
doc_id: funkcje-odbior-153
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# ODBIÓR 153 — mapa pokrycia poleceń kanonicznej ścieżki zapisu

**Klasyfikacja: B** — pomiar rzetelny, z nazwanymi ograniczeniami, ale **niepełny**;
nadzorca znalazł dwie operacje pominięte w inwentarzu i **jedną przyczynę źródłową**,
której raport nie nazwał.

Marker `e4ff8e21ae`, 3 commity ponad markerem, **zero zmian produktu** (jedyny zmieniony
plik to raport). Rozłączność licencji zachowana.

## Co przeliczyłem własnymi rękami — POTWIERDZONE

| Twierdzenie wykonawcy | Mój pomiar | Wynik |
|---|---|---|
| 79 literałów `commandType` | `grep -oE "commandType: '[a-z0-9.-]+'" \| wc -l` = **79**, unikalnych **79** | ✅ |
| `grep -c commandType` = 80 to zły mianownik | **80** — potwierdzone, korekta wykonawcy słuszna | ✅ |
| `decisions.routes.ts` **nie ma bramy** | `grep -n requireCanonical` → **pusto** | ✅ |
| `tasks.routes.ts:67` — brama globalna | `router.use(requireCanonicalExecutionWriter)` | ✅ |
| (b) = 18 operacji Decyzji | 21 tras mutujących − 1 alias `decide` − 2 kategorii (d) = **18** | ✅ |
| (c) = 0 | mapa 79 wierszy, **zero pustych handlerów** | ✅ |

## ★ CO OBALIŁEM — inwentarz Zadania jest niepełny

Raport wylicza **21** operacji legacy Zadania. Niezależne zliczenie daje **23** trasy
mutujące w `tasks.routes.ts` (wszystkie po linii 67, żadna przed bramą). Brakujące dwie:

- `tasks.routes.ts:90` — **`POST /` tworzenie zadania**
- `tasks.routes.ts:1154` — **`PUT /:id` edycja zadania**

Wykonawca prawdopodobnie uznał je za pokryte, bo R1 wymienia polecenia
`execution.task.create/update` (`:4189`, `:4220`). **To założenie jest fałszywe** —
i to jest najważniejsze znalezisko tego odbioru.

## ★★ PRZYCZYNA ŹRÓDŁOWA — dwa rozłączne magazyny

Prześledziłem obie ścieżki zapisu do końca:

| Ścieżka | Kod | Tabela docelowa |
|---|---|---|
| legacy `POST /api/tasks` | `TaskController.ts:1286` | **`INSERT INTO tasks`** |
| kanoniczne `execution.task.create` | `executionWork.ts` → `materialCommand.ts` → `postgresMaterialCommandUnitOfWork.ts:295` | **`INSERT INTO ie_aggregate_state`** |

`executionWork.ts` (508 linii) **nie zawiera ani jednego SQL-a** dotykającego tabeli
`tasks`. `grep -rn "INSERT INTO tasks" server/src/domain/initiatives-execution/` → **pusto**.

**To są dwa różne obiekty w dwóch różnych magazynach.** Polecenie kanoniczne nie jest
zamiennikiem operacji legacy — jest osobnym agregatem zdarzeniowym.

## ★★★ Brama nie ma flagi — odmawia bezwarunkowo

`executionSpineLegacyReadOnly.middleware.ts` przeczytany w całości. Logika:
każda metoda spoza `GET/HEAD/OPTIONS` dostaje **`409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED`**.
Jeden wyjątek: `DELETE /budget/entries/:id`. **Zero flag, zero warunków, zero env.**

Cztery warstwy dla tworzenia zadania:
1. **typ** — `CreateTaskSchema` istnieje ✅
2. **baza** — tabela `tasks` istnieje ✅
3. **endpoint + wołacz** — `Gateway.ts:903` `app.use('/api/tasks', taskRoutes)`;
   front woła `Api.post('/tasks')` z **siedmiu** miejsc, w tym `apiTyped.ts:257`,
   `useActionHandler.ts:428`, `chatActionHandler.ts:120`, `TaskDetailModal.tsx:164`
4. **czy się wykonuje** — trasa jest za bramą z `:67` → **`409`**

**Wniosek: tworzenie i edycja zadania z interfejsu odpowiadają `409`.**

## Kiedy to powstało

```
bb57239243  2026-08-19  feat(execution): retire legacy write surfaces
```

Brama weszła **11 dni temu**, w commicie o nazwie „wycofanie starych powierzchni zapisu".
Powierzchnię wycofano, **zamiennika dla tabeli `tasks` nie zbudowano**.

**To jest JEDNA przyczyna dla wszystkiego, co mierzyliśmy osobno:** dyżur 140
(komentarze Zadania → 409), 141 (RAID), 149 (Decyzja poza bramą) — i teraz
tworzenie/edycja zadania. Hipoteza „jedna przyczyna, trzy dyżury" **potwierdzona
i szersza, niż zakładałem**.

## Korekta liczb

| Kategoria | Raport | Po odbiorze |
|---|---|---|
| (a) brak polecenia, kanał zamknięty bramą | 20 | **22** |
| (b) brak polecenia, kanał otwarty (Decyzje) | 18 | 18 |
| (c) trasa bez handlera | 0 | 0 |
| (d) nieutrwalane/efekt uboczny | 3 | 3 |

## Czego NIE zweryfikowałem

- **Nie wykonałem pełnego żądania HTTP przez żywy serwer.** Wykonałem natomiast
  **empiryczny dowód na samej bramie**: `esbuild` na realnym pliku middleware,
  wywołanie funkcji z prawdziwymi parami metoda/ścieżka.

```text
POST   /                    tworzenie zadania      -> 409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED
PUT    /abc-123             edycja zadania         -> 409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED
DELETE /abc-123             kasowanie zadania      -> 409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED
POST   /abc-123/comments    komentarz (dyzur 140)  -> 409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED
GET    /                    odczyt listy           -> PRZEPUSZCZONE
DELETE /budget/entries/x1   wyjatek budzetowy      -> PRZEPUSZCZONE
```

  **Kontrola poprawności narzędzia:** wiersz komentarza odtwarza `409` zmierzony
  w dyżurze 140 na żywym serwerze. Harness zgadza się ze znanym wynikiem prawdziwym,
  więc pozostałe wiersze też są wiarygodne. Brakuje wyłącznie ostatniego ogniwa —
  potwierdzenia, że żądanie frontu dociera do tego routera na żywym serwerze
  (montaż udowodniony statycznie: `Gateway.ts:903`). **To pierwsza pozycja następnej serii.**
- Nie sprawdziłem, czy któryś z siedmiu wołaczy frontu ma własną obsługę `409`,
  która zamienia błąd w komunikat zamiast w awarię.
- `server/src/routes/pmo/index.ts` montuje `decisions` i `tasks` po raz drugi, ale
  **nie ma konsumenta** (`grep` na import → pusto). Martwy agregator, nie druga trasa.
- Nie rozstrzygnąłem, czy operacje Decyzji mają być odwzorowane 1:1, czy wycofane —
  to decyzja właściciela, nie pomiar.

## Werdykt

Raport przyjęty jako **B**. Wykonawca był uczciwy: sam sprostował trzy błędy instrukcji
(79 zamiast 74, zły mianownik T4, nieostry spór o liczbę bram) i jawnie napisał, czego
nie udowodnił. Pominięcie dwóch najbardziej podstawowych operacji wynikło z założenia
o równoważności agregatów — założenia, którego nie sprawdził.

**Do scalenia.** Klon do skasowania po scaleniu.
