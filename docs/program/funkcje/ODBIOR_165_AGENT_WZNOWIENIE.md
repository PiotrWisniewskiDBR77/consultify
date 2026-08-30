---
doc_id: funkcje-odbior-165
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# ODBIÓR 165 — wznowienie agenta po zatwierdzeniu kroku

**Klasyfikacja: A na czterech częściach rdzenia, C na zasięgu pakietu testów.**
**Zero naruszeń licencji.**

Marker `22124537f7`, 1 commit, **dokładnie 5 plików z licencji**.
`AgentPlanPanel.tsx` — **zero zmian `className` i `style`**, wyłącznie odczyt pola
i jeden komunikat. `FeatureFlags.ts`, `Scheduler.ts`, `agentPlannerService.ts`
i pliki dyżuru 163 — **bez diffu**.

## ★★ AGENT WZNAWIA. Potwierdzone niezależnie na realnym Postgresie i Redisie.

Cztery ogniwa łańcucha naprawione:

**R0 — przyczyna źródłowa.** `aiWorker.ts:111` zamyka zadanie jako `SUCCEEDED`
**wyłącznie** dla `result.status ∈ {completed, completed_with_errors}`. Plan na bramce
zgody **przestał dostawać fałszywy sukces**. Ścieżka `catch` niezmieniona.

★ **Obawa o pętlę ponowień okazała się bezpodstawna** — i to sprawdzone dwiema
drogami: brak `throw` sprawia, że BullMQ oznacza zadanie jako ukończone, więc retry
nie startuje. Potwierdzone czytaniem kodu **i** empirycznie.

**R2 — klucz idempotencji.** `route:<planId>:approval:<approvalCount>` — stały przy
podwójnym kliknięciu tego samego stanu, rośnie po akceptacji.

★ **Wymóg „nie otworzyć drogi na dublowanie" spełniony i sprawdzony własnym testem
audytora:** dwa równoległe `POST /run`, **z kluczem i bez klucza** idempotencji —
za każdym razem **jedno pokwitowanie, jedno zadanie**. Chroni to deterministyczny
`bullJobId = hash(org|dispatchKey)` plus blokada doradcza w transakcji.

**R3 — `REPLAY` przestał udawać `enqueued`.** API zwraca `'replayed'` dla powtórzenia
i `'enqueued'` tylko dla realnego zakolejkowania. Front czyta `dispatch` **na obu
ścieżkach** — uruchomienia **i zatwierdzenia**. Ta druga to dokładnie ta, która ma
znaczenie.

## Dwa dowody mutacyjne — odtworzone osobno, każdy z osobna

```text
klucz → route:${planId}              → 2/2 FAIL: expected 'replayed' to be 'enqueued'
R0 → bezwarunkowe finishAgentTask    → 2/2 FAIL: expected 'SUCCEEDED' not to be 'SUCCEEDED'
po przywroceniu obu                  → 2/2 PASS, drzewo czyste
```

Test uruchomiony niezależnie na własnym Postgresie (`6067`) i **prawdziwym Redisie**
(`6391`) — nie na atrapie. Pełny scenariusz: utwórz → uruchom → bramka zgody →
zatwierdź → **wznów** → krok się wykonuje.

## C — jeden zastany test świeci na czerwono

`agentTaskDispatchService.pg.redis.test.ts` daje teraz **6/7**. Czerwony przypadek
używa atrapy `planner.mockResolvedValue({ id: planId })` **bez pola `status`** — więc
po naprawie R0 taki wynik słusznie nie zamyka pokwitowania jako `SUCCEEDED`.

**Test pinuje stare, nieprawdziwe zachowanie.** Plik był **poza licencją**, wykonawca
go nie tknął i **zgłosił to jako `PARTIAL`**. Tak ma być. **Wchodzi do kolejki
razem z dwoma innymi testami tej samej klasy.**

## ★ Nowa luka, nieujawniona wprost — anulowanie

Warunek R0 obejmuje `completed` i `completed_with_errors`. **Nie obejmuje
`cancelled`.** A `executePlan:489` krótko spina się dla planów w stanie końcowym
i zwraca plan bez wykonania.

**Skutek:** plan anulowany w chwili, gdy jego zadanie już jest w kolejce, **nigdy nie
wywoła `finishAgentTask`** → pokwitowanie **zawisa trwale w `RUNNING`**.

To ta sama klasa co stan `awaiting_approval`, który wykonawca **opisał uczciwie**
(„brak stanu `CHECKPOINTED`") — ale scenariusza anulowania nie wymienił.
**Niedopowiedzenie, nie fałsz.** Do kolejki.

## Obalone: „`git diff --check`: PASS" jest nieścisłe

Własny przebieg audytora: **exit 2**, cztery ostrzeżenia — wszystkie w samym pliku
raportu (`.md`), konwencja Markdown. **Zero w kodzie.** Ale zdanie „PASS" jest ściśle
rzecz biorąc nieprawdziwe i powinno brzmieć „PASS poza formatowaniem raportu".

## Obserwacja jakościowa — komunikat bywa za surowy

Komunikat „Nie zakolejkowano nowego wykonania planu." pokazuje się dla **każdego**
`dispatch !== 'enqueued'` — także dla `'idempotent-replay'` (żądanie zdublowane, ten
sam bieg już trwa, czyli **de facto sukces**) i `'deferred'` (świadomy szkic).
Mieści się w licencji, ale w łagodnych przypadkach może mylić. Do dopracowania.

## ★★★ ODPOWIEDŹ NA DECYZJĘ WŁAŚCICIELA

**Łańcuch pięciu ogniw z dyżuru 164 jest zamknięty.** Agent wznawia po zatwierdzeniu,
API nie kłamie, front pokazuje prawdę, podwójne kliknięcie nie dubluje zadań.

**Ale `ENABLE_AI_TASKS_WORKER` nadal NIE nadaje się do włączenia.** Dwa blokery
z dyżuru 164 są **nietknięte** — `agentPlannerService.ts` nie jest w tym diffie:

1. **Nie da się zatrzymać uruchomionego planu.** `cancelPlan` (`:827-834`) robi
   wyłącznie `UPDATE` statusów planu i kroków — **zero dotknięcia zadania w kolejce**.
   ★ **Po tej łatce jest gorzej:** anulowanie może dodatkowo **zamrozić pokwitowanie
   w `RUNNING` na stałe** (luka opisana wyżej).
2. **Brak limitu kosztu.** `estimatedCostUsd: 0` na sztywno w **dwóch** miejscach
   (`:157`, `:1058`).

**Rekomendacja bez zmian: nie włączać.** Agent działa poprawnie, ale **nie da się go
zatrzymać ani ograniczyć kosztowo** — a to są dwie rzeczy, których brak boli dopiero
wtedy, gdy jest już za późno.

**Do włączenia potrzebny jeszcze jeden dyżur:** zatrzymywanie planu w locie
(z anulowaniem zadania w kolejce i domknięciem pokwitowania) plus limit kosztu.

## Czego NIE zweryfikowano

- Realnego wykonania `create_task` na produkcyjnym wykonawcy — test używa
  deterministycznego lokalnego; **wykonawca oznaczył to jako `NOT_PROVEN`**.
- Zachowania interfejsu na żywo — zmiana statyczna, bez zrzutu.
- `resumeWaitStep` (auto-wznowienie przez cron) pod kątem R0 — mechanizm identyczny,
  analiza się przenosi, ale nie testowano osobno.
- Zachowania przy realnej awarii Redisa w trakcie kolejkowania.

## Werdykt

**Do scalenia.** Rdzeń naprawiony i broniony dwiema niezależnymi mutacjami; wymóg
niedublowania zadań sprawdzony osobnym testem audytora; licencja dotrzymana co do joty.
