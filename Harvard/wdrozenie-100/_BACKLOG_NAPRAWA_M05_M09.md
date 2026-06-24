# BACKLOG NAPRAWCZY — błędy M05–M09 (do zostawienia czerwone + naprawy)

> 2026-06-24. Cel: oddzielić **realne błędy** od honest-skipów, zostawić błędy widoczne (NIE maskować), przygotować repro+root-cause+plan naprawy. Kontekst: `_RAPORT_NOCNY_M05_M09_2026-06-23.md`.

## Zasada
Test ≠ zielony może znaczyć trzy rzeczy — TYLKO pierwsza to „błąd do naprawy":
1. **FAIL (czerwony)** = realny błąd (produkt lub test-infra) → naprawiamy.
2. **HONEST-SKIP** = scenariusz genuinie niesterowalny headless (mikrofon, drag uchwytów, schowek, realtime <1s, perf 200 węzłów) — funkcja DZIAŁA (zweryfikowana code/curl), test świadomie pominięty. NIE błąd.
3. **AI-FLAKY** = provider 500 (deepseek bez środków) — nie błąd kodu, sprawa billingowa.

---

## A. REALNE BŁĘDY (czerwone — zostają do naprawy)

### ✅ BUG-1 [NAPRAWIONE 2026-06-24, commit `72a063f54d`] M07 reload-race — utrata węzłów po reloadzie (MC-07-01)
**Fix (2 źródła):** (1) `IdeaProcessFlowTool.hydrate` retry'uje GET /map 3× z backoffem zanim zrobi `setNodes([])` — pojedynczy timeout pod load nie blankuje już kanwy (dane SĄ na serwerze). (2) `useIdeaMapSync` beforeunload/visibilitychange piszą draft do localStorage SYNCHRONICZNIE przed keepalive — edycje <800ms przed F5 odzyskiwane na następnym mount. Testy: +2 regresji (`tests/components/MyWork/ideaMapSync.reload-race`) + naprawiony pre-existing error-state test; 19/19 zielonych; FE build OK. Poniżej oryginalna diagnoza:


- **Objaw:** `MC-07-01` po dodaniu kształtów + reload → `REAL_NODE` count = **0** (oczekiwane ≥5). MC-07-30 (ten sam wzorzec persist+reload) bywa zielony, MC-07-01 solo bywa zielony → **flaky race**, nie deterministyczny.
- **Root cause (znany, [[finding_ideas_m5_m9_closure_2026-06-21]]):** autosave-race Process Flow — 2× równoległy `POST /map/sync` → drugi dostaje **409** (wersja) → po reloadzie hydrate czyta stan sprzed zapisu → węzły giną. To **REALNY bug prod** (potwierdzony na prod-build w czerwcu).
- **Pliki:** `IdeaProcessFlowTool.tsx` (autosave + hydrate-on-reload), `useIdeaMapSync`/`useProcessFlowCRUD`, endpoint `PUT/POST /map/sync` (409 handling + wersjonowanie).
- **Repro (manualne):** otwórz process_flow → dodaj 5 kształtów szybko → reload (F5) → węzły znikają (czasem).
- **Kierunek naprawy:** serializacja zapisów (kolejka/debounce single-flight zamiast 2× równoległy POST) + retry-on-409 z re-read wersji PRZED zapisem; hydrate-on-reload czeka na flush pending-save. (Helper E2E ma już `addShape` anti-drop recheck — to maskuje w teście, ale produkt dalej ma race.)
- **Charakterystyka (zweryfikowana 2026-06-24):** MC-07-01 solo ×5 = **5/5 PASS** (zero `received 0`). Bug jest **LOAD-ZALEŻNY** — okno wyścigu 409 otwiera się tylko pod obciążeniem (pełny suite + kontencja + latencja caboose), nie solo. Stąd flaky w pełnych przebiegach, zielony solo. To NIE znaczy „nie ma buga" — to potwierdza że race istnieje i jest czasowy. Repro deterministyczne wymaga wymuszenia podwójnego równoległego zapisu (test regresji powinien to robić jawnie, nie polegać na load).
- **Status testu:** zostaje czerwony / flaky — NIE honest-skipować.

### 🟠 BUG-2 [P2, BILLING/INFRA — nie kod] AI Expand 500 (MC-09-17, + M06 REAL-AI sporadycznie)
- **Objaw:** `MC-09-17` (Context menu → AI Expand) FAIL; M06 MC-06-11/12 czasem skip (AI nie wystartował).
- **Root cause:** `[AI:CircuitBreaker] deepseek "Insufficient Balance"` — niefundowany provider w rotacji 500-tkuje, zanim failover przełączy na openrouter. **Nie bug kodu** — `modelRouter` używa deepseek intencjonalnie (reasoning + tani model).
- **Decyzja:** zasilić konto deepseek (zachowuje reasoning/cheap) ALBO świadomie usunąć z rotacji (`aiRoutingBootstrapService.ts:116,133` candidates/preferredOrder) — utrata reasoning-chat. **Wybór właściciela klucza.** Opcjonalna mitygacja kodowa: wykryć „Insufficient Balance" → natychmiast otworzyć breaker (skip bez 500).
- **Status:** zostaje czerwony do decyzji billingowej.

---

## B. HONEST-SKIPY — LEGIT (funkcja działa, headless niesterowalny — NIE błędy)
| Case | Powód | Jak zrobić sterowalnym (opcjonalnie) |
|---|---|---|
| MC-06-05, MC-08-30 | Voice / Web-Speech (mikrofon) | mock `SpeechRecognition` w init-script |
| MC-06-27 | Duża mapa 200+ węzłów (perf MANUAL) | seed 200 węzłów przez API + asercja simplified-mode |
| MC-06-28, MC-06-29 | Multiplayer realtime (<1s broadcast) | 2 konteksty Playwright + asercja graph_patch |
| MC-09-06, MC-09-07 | Schowek / drop obrazu | synthetic clipboard/drop event lub API |
| MC-09-30 | Export menu (code-verified) | hover-gated menu — driveable w realnej przeglądarce |

> Te NIE są błędami. Do podniesienia pokrycia headless można je „odkleić" (kolumna 3), ale to osobny, niższy priorytet — nie blokują odbioru.

---

## C. PLAN (kolejność)
1. **BUG-1 M07 reload-race** — P1, realna utrata danych użytkownika. Naprawić w produkcie (single-flight autosave + 409-retry + hydrate-after-flush) z testem regresji. → chip-task.
2. **BUG-2 deepseek** — decyzja billingowa Piotra (zasilić/usunąć). Opcjonalnie mitygacja breakera.
3. **B (honest-skipy)** — opcjonalne odklejanie, gdy P1/P2 zamknięte.

**Stan testów: błędy ZOSTAJĄ czerwone** (nie maskuję honest-skipem) — zgodnie z poleceniem. Reszta puli (M06 26/30, M08 29/30, M09 28/30, M07 29-30/31) = zielona/legit-skip.
