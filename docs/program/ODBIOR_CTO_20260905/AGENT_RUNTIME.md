# Odbiór CTO 05.09 — Agent („Uruchom agenta”) — pomiar działania end-to-end

Inspektor: agent CTO-odbiorca. Środowisko: `http://localhost:3000` (kod linii
`m03`, backend i dane **stagingu**), sesja właściciela (`ODBIOR_AUTH_STATE`),
motyw jasny, 1440×900. Zero zmian w kodzie produktu — tylko pomiar. Skrypty
Playwright użyte do pomiaru: `scripts/dev/odbior-cto-20260905/{explore,klik,
run-agent,click-run,teresa-handoff,check-status}.mjs` (nowe, tylko do tego
pomiaru — nie dotykają `src/`). Cały ruch sieciowy i zrzuty:
`evidence/odbior-cto-20260905/agent/`.

**Werdykt w jednym zdaniu:** Agent URUCHAMIA SIĘ (ekran działa, tworzy prawdziwe
rekordy w bazie stagingu przez prawdziwe API), ale **żaden utworzony plan nigdy
nie zaczyna faktycznie wykonywać kroków** — winny jest brakujący serwerowy
przełącznik `ENABLE_AI_TASKS_WORKER` na stagingu, więc z punktu widzenia
właściciela agent klika, „startuje” i potem nic się nie dzieje, bez żadnego
komunikatu o błędzie.

---

## (a) Gdzie zamontowany Agent i jakie flagi go bramkują

### Wejście dla użytkownika
- Menu: **Moja Praca → „Uruchom agenta”** (zakładka `My Work Menu 2`, ikona
  `Bot`, etykieta i18n `sidebar.agentPlan` = „Uruchom agenta” PL /
  „Run agent” EN — `public/locales/pl/translation.json:1943`).
- Trasa: `/my-work?tab=agent` (stary bezpośredni URL `/agent-plan` istnieje
  tylko jako przekierowanie wsteczne — `src/routes/AppRoutes.tsx:1696-1700` —
  „AGT-003 relokacja 2026-07-23”; `/agent-plan` **zawsze** przekierowuje do
  `/my-work?tab=agent`, nigdy nie renderuje własnej strony).
- Bramka widoczności zakładki: `isAgentPlanEnabled()` w
  `src/utils/agentPlanFlag.ts` (`src/components/MyWork/MyWorkHub.tsx:1823`)
  — czysto kliencki (`ff.agent_plan` w localStorage → `?ff_agentPlan=` w URL →
  `VITE_AGENT_PLAN` w buildzie → **domyślnie ON**, bo `VITE_AGENT_PLAN` nie
  jest ustawione nigdzie (`.env.local` grep = 0 trafień)).
- Powłoka ekranu: `AgentHubShell.tsx` (1801 linii) — sześć pod-zakładek:
  **Archiwum procesów** (lista planów, `GET /api/ai/agent-plan`), **Start i
  szablony** (katalog: 2 „Procesy” — Klasyczny konsulting 5 faz / DRD 4 kroki
  — + 19 „Gotowe analizy” z katalogu Discovery Tools), **Governance
  szablonów**, **Sprawy, akceptacje i wyniki**, **Akceptacje wyników**,
  **Operacje i odzyskiwanie**. Otwarcie planu = karta w Menu 3
  (`AgentPlanWorkspace.tsx`), nie osobna strona.

### Serwer — trasy (wszystkie zamontowane BEZWARUNKOWO pod `/api/ai/*` w
`server/src/routes/ai/index.ts:73,76,81`, żadna nie stoi za flagą modułu):

| Trasa | Plik | Rola |
|---|---|---|
| `POST/GET /api/ai/agent-plan` | `agent-plan.routes.ts` | tworzenie/lista planów |
| `GET /api/ai/agent-plan/:id` | j.w. | status planu |
| `PATCH /api/ai/agent-plan/:id/steps` | j.w. | zapis schematu (draft) |
| `POST /api/ai/agent-plan/:id/run` | j.w. | jawne „Uruchom” |
| `POST /api/ai/agent-plan/:id/approve-step` | j.w. | akceptacja kroku |
| `POST /api/ai/agent-plan/:id/cancel` | j.w. | anulowanie |
| `GET /api/ai/agent-plan/processes`, `/folders` | j.w. | biblioteka procesów, foldery |
| `/api/ai/agent-manifests` | `agent-manifests.routes.ts` | katalog 31 gotowych analiz |
| `/api/ai/agent-audit` | `agent-audit.routes.ts` | log audytowy |

(Poza zasięgiem tego ekranu, ale istnieją w repo pod nazwą „agent”: `v8/
agent-operations.routes.ts`, `v8/agent-process-templates.routes.ts`, `v8/
agent-quality.routes.ts`, `v8/agent-proposals.routes.ts`, `v8/multi-agent.
routes.ts`, `my-work/agent-materialization.routes.ts`, `wave8-agents.routes.
ts`, `agents.routes.ts` — żaden z nich nie jest wołany przez `AgentHubShell`/
`agentPlan.api.ts`; nie badane dalej, bo poza zakresem zlecenia.)

### Flagi — wartości NA ŻYWO (05.09, po południu)

| Flaga | Strona | Gdzie w kodzie | `.env.local` (lokalnie) | Railway `staging` | Efekt |
|---|---|---|---|---|---|
| `VITE_AGENT_PLAN` (`ff.agent_plan`/`?ff_agentPlan=`) | klient | `src/utils/agentPlanFlag.ts` | brak (0 wpisów) → domyślnie **ON** | brak w Railway (to zmienna VITE_*, wypiekana w froncie, nie serwerowa) | Zakładka „Uruchom agenta” WIDOCZNA (potwierdzone zrzutem) |
| `ENABLE_AI_TASKS_WORKER` | serwer | `server/src/services/ai/agentTaskDispatchService.ts:6`, `server/src/workers/aiWorkerRuntime.ts:5` | brak | **brak (nieustawiona → `!== 'true'`)** | **Worker BullMQ `ai-tasks` NIGDY się nie uruchamia** (kod: `"[BullMQ] ai-tasks worker disabled; set ENABLE_AI_TASKS_WORKER=true after owner approval"`) → `dispatchAgentTask` zwraca `DISABLED` → `tryDispatchBackgroundExecution` zwraca `unavailable` przy KAŻDYM tworzeniu/uruchomieniu planu |
| `AGENT_SCHEDULE_CRON_ENABLED` | serwer | `server/src/cron/Scheduler.ts:914`, `server/src/jobs/agentPlanSchedulerJob.ts:72` | brak | **`false`** | Harmonogram („Zaplanuj na termin”) też nie odpala planów o czasie |
| `MOCK_REDIS` | serwer | `agentTaskDispatchService.ts` (rzuca błąd, gdyby worker mimo wszystko wystartował) | brak | **nieustawione** (prawdziwy Redis skonfigurowany — `REDIS_HOST=redis.railway.internal`) | Redis NIE jest przyczyną — jest prawdziwy i osiągalny; problem to WYŁĄCZNIE brak `ENABLE_AI_TASKS_WORKER=true` |

Uwaga bezpieczeństwa: podczas sprawdzania zmiennych Redis przypadkiem
wypisałem `REDIS_URL`/`REDIS_PASSWORD` w terminalu (nie agent-related, nie
powinienem był ich pobierać szerokim grepem) — **te wartości NIE trafiły do
żadnego pliku ani do tego raportu**, tylko do jednorazowego outputu komendy.
Zalecenie: rozważyć rotację tego hasła Redis jako higienę, nie z powodu
realnego wycieku na zewnątrz.

---

## (b) Zmierzony przebieg — krok po kroku

1. **Otwarcie ekranu** (`/my-work?tab=agent`) — 200, render poprawny, zero
   błędów konsoli. Zrzut: `01-before-agent-tab.png`. Domyślna pod-zakładka:
   „Sprawy, akceptacje i wyniki” — 1 istniejący rekord („Mandat transformacji”,
   status „Anulowany”, v5, 15 etapów) — a więc moduł MA już historię użycia,
   to nie jest pusty ekran demo.
2. **„Start i szablony”** — lista 21 szablonów (2 procesy + 19 gotowych analiz
   Discovery Tools) ładuje się poprawnie, `GET /api/ai/agent-plan/processes`
   i `/folders` → 200. Zrzut: `02-start-i-szablony.png`.
3. **Wybór realnego zadania**: kliknięcie wiersza „Siły Rynkowe (5 Sił
   Portera)” (gotowa analiza, 3 kroki) otwiera PREVIEW z przyciskiem „Użyj
   szablonu”. Zrzut: `03-preview-porter.png`.
4. **START**: klik „Użyj szablonu” → `POST /api/ai/agent-plan` → **201**,
   plan utworzony naprawdę w bazie (`id=a775ea54-431e-4bb4-b2a8-ea088fc4b428`,
   3 kroki: `search_knowledge_base` → `compare_benchmarks` →
   `generate_report_section`), **ale odpowiedź niesie `"dispatch":
   "unavailable"`**. UI otwiera kartę z canvasem procesu, panel „Postęp”
   pokazuje „0/3 · 0%” i „Proces jeszcze nie wystartował”. Zrzut:
   `11-during-just-after-click.png`. Sieć: `RUN_network.json`.
5. **Odpytywanie statusu przez 3 minuty** (co 15 s, bezpośrednio
   `GET /api/ai/agent-plan/:id`, dokładnie jak zażądano w zleceniu) —
   **każdy z 12 odczytów: `status:"planning"`, `completedSteps:0`,
   `totalSteps:3`**. Zero zmiany przez cały czas. Log:
   `RUN_poll.json`, `RUN_stdout.log`.
6. **Jawne „Uruchom”**: po odświeżeniu, otwarcie planu z „Archiwum procesów” i
   kliknięcie przycisku **„Uruchom proces”** wprost → `POST /api/ai/agent-plan/
   :id/run` → **200**, `success:true`, ALE `status` w odpowiedzi nadal
   `"planning"`. UI zmienia napis na „Plan już wystartował — schemat jest
   zamrożony” w JEDNYM panelu, a w SĄSIEDNIM panelu na tym samym ekranie
   nadal widnieje „Schemat w edycji 0/3 · 0%” / „Proces jeszcze nie
   wystartował” — **sprzeczne komunikaty na tym samym ekranie, zero
   widocznego błędu**. Zrzut: `16-after-uruchom-click.png`. Sieć:
   `RUN2_network.json`.
7. **Sprawdzenie systemowe (nie tylko mój test)**: zakładka „Archiwum
   procesów” pokazuje ŁĄCZNIE 8 planów (mój + 7 wcześniejszych z poprzednich
   sesji, w tym „Klasyczny konsulting” ×2, „New consulting process” ×4,
   „Agent: Growth Paths (Ansoff)”) — **wszystkie 8, bez wyjątku, w statusie
   „Planowanie”, 0 postępu, „—” w kolumnie „Ostatnie uruchomienie”**. To NIE
   jest awaria jednego mojego testu — **żaden plan agenta nigdy nie
   ukończył ani jednego kroku na tym środowisku**. Zrzut:
   `13-archiwum-procesow.png`.
8. **Test DEC-2026-09-05-396 (Teresa rozpoznaje nową sprawę)**: jedna
   wiadomość w `/chat` („Chcę rozpocząć nową sprawę dla klienta: redukcja
   kosztów produkcji o 15% w ciągu 6 miesięcy…”). Teresa odpowiada PROZĄ,
   proponuje utworzenie **Inicjatywy** (nie „Sprawy”/Case) i pyta „Czy mam
   utworzyć tę inicjatywę w systemie?” — **żadnej karty propozycji
   (`CaseIntakeConfirmCard`/`case_intake_proposal`), żadnego przycisku
   potwierdzenia, żadnego przekazania do Agenta**. Nic nie kliknięto dalej
   (zgodnie z zakazem akceptowania propozycji). Zrzut:
   `22-chat-after-wait.png`, tekst: `22-chat-after-wait.png.text.txt`. Dwa
   błędy konsoli 404 na `/api/ai/stream/partial/:id` (odpytywanie streamingu
   po zakończeniu odpowiedzi — kosmetyczne, nie blokuje rozmowy).

---

## (c) Co działa / co nie działa / co jest zagejtowane

**DZIAŁA** (dowód: zrzuty + realne kody HTTP):
- Menu, routing, powłoka `AgentHubShell` z 6 pod-zakładkami — renderuje się
  bez błędów, PL/i18n poprawne w większości miejsc. `01-before-agent-tab.png`,
  `02-start-i-szablony.png`.
- Katalog 21 szablonów (procesy + gotowe analizy) ładuje się z prawdziwego
  backendu. `02-start-i-szablony.png.net.json`.
- Tworzenie planu (`POST /api/ai/agent-plan`) — prawdziwy zapis do
  PostgreSQL stagingu, 201, poprawny schemat kroków wygenerowany z manifestu.
  `RUN_network.json`.
- Canvas edycji planu (przestawianie kroków, paleta klocków) — renderuje się,
  11 modułów/AI-Teresa/dane/automaty/kontrola/integracje widoczne w palecie.
  `11-during-just-after-click.png`.

**NIE DZIAŁA** (rdzeń zlecenia — „czy Agent naprawdę coś robi”):
- **Żaden plan nigdy nie wykonuje ani jednego kroku.** Przyczyna
  zlokalizowana z pewnością: `ENABLE_AI_TASKS_WORKER` nieustawione na
  stagingu → worker BullMQ nigdy nie startuje →
  `server/src/services/ai/agentTaskDispatchService.ts:62` zwraca
  `{status:'DISABLED'}` → trasa mapuje to na `dispatch:'unavailable'` →
  plan zamraża się w `planning` na zawsze. Dowód: `RUN_network.json`
  (`dispatch:"unavailable"` w odpowiedzi tworzenia), `RUN_poll.json` (12×
  bez zmiany w 3 minuty), `13-archiwum-procesow.png` (8/8 planów
  historycznych w tym samym stanie).
- **Zero komunikatu o błędzie dla użytkownika.** Zarówno tworzenie (201), jak
  i jawne „Uruchom” (200, `success:true`) zwracają sukces HTTP mimo że
  wykonanie się nie odbyło — właściciel nie ma żadnego sygnału, że coś jest
  nie tak; ekran wygląda, jakby proces „w każdej chwili” miał ruszyć.
  `RUN2_network.json`.
- **Sprzeczne stany UI na jednym ekranie** po „Uruchom proces” — jeden panel
  mówi „już wystartował, zamrożony”, drugi „jeszcze nie wystartował, 0%”.
  `16-after-uruchom-click.png`.
- **Harmonogram** (`AGENT_SCHEDULE_CRON_ENABLED=false`) — dodatkowa, osobna
  blokada dla ścieżki „Zaplanuj na termin”, niezależna od powyższej.

**ZAGEJTOWANE / ŚWIADOMIE NIEZBUDOWANE**:
- **DEC-2026-08-25-23**: cała praca architektoniczna nad Agentem/Teresą
  formalnie zepchnięta na koniec programu jako „Moduł 17” — obecny stan to
  fundament (HP-4), nie ukończony produkt; to wyjaśnia, DLACZEGO worker nigdy
  nie dostał flagi ON (świadoma decyzja właściciela z 25.08, nie przeoczenie
  pojedynczego dyżuru).
- **DEC-2026-09-05-396** (05.09, „tak” właściciela): Teresa ma SAMA
  rozpoznawać nową sprawę z rozmowy i proponować kartę potwierdzenia.
  Backend (`caseIntakeService.proposeConversationWorkOrder`) i karta
  (`CaseIntakeConfirmCard.tsx`) ISTNIEJĄ i są realne, ale **producent —
  krok w orkiestracji czatu, który faktycznie wywołuje tę funkcję po zwykłej
  wiadomości — nie istnieje**. Zlecony jako dyżur 378
  (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/
  INSTRUKCJA_DYZUR_378_CASE_INTAKE_PRODUCER.md`), ale **nie ma raportu
  wykonania ani nowej flagi w `FeatureFlags.ts`/`useFeatureFlags.tsx`** —
  dyżur wydany, niewykonany. Mój live-test w kroku 8 powyżej to potwierdza
  1:1: Teresa odpowiada zwykłym tekstem, nie kartą.

---

## (d) Podsumowanie dla właściciela (3 zdania)

Agent w aplikacji **da się uruchomić** — menu, ekran, katalog 21 gotowych
zadań i tworzenie planu w bazie wszystko działa naprawdę — ale **żaden
uruchomiony plan nigdy nie zaczyna faktycznie pracować**, bo na serwerze
stagingu brakuje jednego przełącznika (`ENABLE_AI_TASKS_WORKER`), a aplikacja
o tym milczy: pokazuje sukces zamiast błędu, więc wygląda, jakby coś się
zawiesiło bez przyczyny. To nie jest awaria mojego jednego testu — sprawdziłem
archiwum i wszystkie 8 dotychczasowych prób (moja i 7 wcześniejszych) utknęło
identycznie w statusie „Planowanie” na zero procent. Osobno: obietnica, że
Teresa sama rozpozna nową sprawę w rozmowie (Twoja zgoda z dzisiaj,
DEC-396), jeszcze nie ma wykonawcy w kodzie — dziś Teresa tylko pyta tekstem,
bez żadnej karty do potwierdzenia.
