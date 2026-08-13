# Case Workspace — zrzuty dowodowe z ŻYWEGO stosu (Strumień E)

**Data:** 2026-08-10 · **Stos:** frontend Vite `:3010` → proxy `/api` → **realny backend `:3001`**
→ **realny PostgreSQL** (kontener jednorazowy `case-workspace-test-pg`, `127.0.0.1:55432`).

## Czym te zrzuty NIE są

Nie pochodzą z harnessu `src/components/CaseWorkspace/podglad/`, który **podmienia
`window.fetch`** atrapami (`daneProbne.ts`). Tu nic nie jest podmienione:

- logowanie to realny `POST /api/auth/login` (bcrypt + realny podpis JWT),
- każdy odczyt idzie do realnego backendu — lista żądań w `_zadania-sieciowe.txt`,
  wszystkie **HTTP 200**,
- dane pochodzą z realnych zapisów zrobionych w tej samej sesji.

Kontrola negatywna wykonana przy tej samej konfiguracji: token z claimem `e2e: true`
i podrobionym podpisem dostaje **401**. Gdyby dostał 200, wszystkie zrzuty byłyby
bezwartościowe (serwer działałby na furtce, nie na realnej autoryzacji).

## Pliki

| Plik | Co pokazuje |
|---|---|
| `01-lista-zlecen.png` | Lista zleceń na żywych danych: liczniki, statusy, w tym zlecenie **Anulowane** i postęp „1 z 4". |
| `02-zlecenie-plan.png` | Zakładka **Plan**. Odznaka „Plan: Zatwierdzony (wersja 1)" i „Plan przeszedł sprawdzenie" — a mimo to centrum mówi **„Ten plan nie ma jeszcze kroków"**. To jest defekt DEF-01 (patrz niżej). |
| `03-zlecenie-realizacja.png` | Zakładka **Realizacja**: zaspokojony wait („Czeka na system zewnętrzny / Doczekało się"), zatwierdzona propozycja („Wrażliwa zmiana / Zatwierdzone"), oraz przebieg z wpisem `PARTIAL`. |
| `04-zlecenie-rezultaty.png` | Zakładka **Rezultaty**: pomiary wartości (w tym **częściowy** 62 000 z 150 000 PLN) i powiązane obiekty (Dowód, Dostawa dla klienta). |
| `_zadania-sieciowe.txt` | Surowa lista realnych żądań HTTP zarejestrowanych w trakcie robienia zrzutów. |

## Co widać na zrzutach, a czego nie widać w testach

**DEF-01 (P1) — opublikowany plan wygląda na pusty.** `02-zlecenie-plan.png`.
`api.ts:getPlanGraph()` jest zadeklarowany jako `Promise<CanonicalGraph>`, ale trasa
`/plan-versions/:id/graph` zwraca **kopertę** `{ graphId, graphDigest, semanticGraph }`.
`v8Get` zdejmuje tylko `{data}`, więc ekran dostaje kopertę, a `.nodes` jest `undefined`.
`CaseDetailScreen.tsx:376` najpierw ustawia POPRAWNY graf z `current.semanticGraph`,
po czym **nadpisuje** go kopertą. Atrapa (`podglad/main.tsx:85` → `GRAPHS`) zwraca
**goły** graf, dlatego defekt jest niewidoczny wszędzie poza żywym stosem.

**DEF-02 — każde zlecenie nazywa się „Zlecenie bez nazwy".** `01-lista-zlecen.png`.
`case_core` nie ma kolumny na nazwę ani cel; `goal`/`expectedOutcome` z podpisanego
przez człowieka zamówienia żyją wyłącznie w ładunku zdarzenia w outboxie.

**Obserwacja i18n** — porównaj `02` (polskie „Otwórz rezultat", „Zapisano") z `03`/`04`
(angielskie „Open result", „Saved") oraz angielskie zdania w „Przebiegu zlecenia".
Część napisów rozwiązuje się do angielskiego, zanim wczytają się tłumaczenia.

**Obserwacja układu** — w `04` tabela pomiarów jest ucięta z prawej („STAN I…",
„Potwi…", „Zmier…"): kolumna statusu nie mieści się przy 1440 px.

## Uwaga o współdzielonej bazie

Kontener jest wspólny dla równolegle pracujących agentów. Odznaka „Zablokowane"
uchwycona na jednym z ujęć była **realnym, przejściowym** stanem wywołanym przez
pause/resume innego agenta (zdarzenia `case.blocked`/`case.activated` w outboxie o
16:45 i 16:46) — nie błędem UI. Zweryfikowane SELECT-em, zanim postawiono diagnozę.

## Odtworzenie

```bash
bash scripts/dev/case-workspace-local-backend.sh          # backend :3001
VITE_API_TARGET=http://127.0.0.1:3001 VITE_API_URL= npx vite --port 3010 --strictPort
```

Zrzuty powstały skryptem Playwright logującym się realnym `POST /api/auth/login`
i wchodzącym na `/zlecenia?ff_zlecenia=1`. Pełny scenariuszowy dowód (10 scenariuszy,
każdy z żądaniem HTTP + SELECT-em + śladem w outboxie) jest w
`server/src/services/caseWorkspace/__tests__/e2e/liveStack.e2e.pg.test.ts`.
