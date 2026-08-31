---
doc_id: funkcje-odbior-164
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# ODBIÓR 164 — agent tworzy plan i go nie wykonuje

**Klasyfikacja: A na dowodzie defektu, B na mapie i inwentarzu ryzyka.**
**Odpowiedź na pytanie właściciela: NIE WŁĄCZAĆ flagi.**

Marker `23bc57aaf3`, 2 commity, **2 pliki, 300 insercji, zero usunięć**:
raport + test. **Zero zmian kodu produktu** — zakaz dotrzymany.
`ENABLE_AI_TASKS_WORKER` nie zmieniona nigdzie w repo.

## ★★★ PRZYCZYNA ŹRÓDŁOWA — znaleziona, potwierdzona własnym okiem

Agent melduje sukces, gdy zatrzymał się na bramce zgody. Mechanizm:

`agentPlannerService.ts` przy bramce checkpointu **wraca NORMALNIE, nie wyjątkiem**:
```ts
step.status = 'awaiting_approval';
plan.status = 'awaiting_approval';
return plan;
```

A `aiWorker.ts:111` po normalnym powrocie robi **bezwarunkowo**:
```ts
result = await agentPlannerService.executeBackgroundPlan(payload);
await finishAgentTask(receiptId, workerId, true);   // ← ZAWSZE 'true'
```

**Pokwitowanie dostaje `SUCCEEDED`, mimo że nie wykonano ani jednego kroku.**

## ★★ Łańcuch pięciu ogniw — plan utyka bez ratunku

Audyt złożył to, czego nie widział ani wykonawca, ani ja:

| # | ogniwo | skutek |
|---|---|---|
| 1 | `aiWorker.ts:111` — `finishAgentTask(..., true)` bezwarunkowo | pokwitowanie **`SUCCEEDED`** mimo zera pracy |
| 2 | `dispatchKey = route:${planId}` — zależy tylko od planu | kolejne uruchomienie trafia w to pokwitowanie |
| 3 | `SUCCEEDED` → `REPLAY` **przed** blokiem kolejkowania | do kolejki **nie trafia nic** |
| 4 | `agent-plan.routes.ts:188` — `REPLAY` → `'enqueued'` | **API kłamie drugi raz** |
| 5 | `redriveAgentTask` odmawia dla `SUCCEEDED` (`AGENT_DISPATCH_NOT_REDRIVABLE`) | **mechanizm ratunkowy operatora zamknięty** |

Do tego front gubi pole `dispatch` **na obu ścieżkach** — `AgentPlanPanel.tsx:369`
(uruchomienie) i **`:419` (zatwierdzenie kroku)**, czyli dokładnie tam, gdzie
użytkownik kliknie po zobaczeniu „czeka na zgodę".

**Wniosek: po wystąpieniu defektu plan utyka trwale, bez żadnego widocznego sygnału
i bez ścieżki naprawy.** To jest cięższy werdykt niż postawił sam wykonawca.

## Dowód — odtworzony niezależnie, z mutacją

Test **nie jest** chorobą `readFileSync`+`toContain`. To realny test integracyjny:
prawdziwy `ApiGateway`, prawdziwy Postgres, prawdziwy Redis i worker BullMQ.

Odtworzenie na własnym środowisku (Postgres 6052, Redis 6399) dało **identyczny
wynik**: `POST create` → 201, `POST run` → 200 `dispatch=enqueued`, worker
przetworzył zadanie, pokwitowanie **`SUCCEEDED`**, a plan `awaiting_approval`,
`completed_steps=0`, `result_json=null`.

**Dowód mutacyjny:** podmiana `aiWorker.ts:111` na warunkowe zamknięcie
(`isTerminal` liczone z `result.status`) → test **zzieleniał**, a pokwitowanie
dostało uczciwe `FAILED` zamiast fałszywego `SUCCEEDED`. Test dyskryminuje realne
zachowanie. Zmiana cofnięta, drzewo czyste.

## Inwentarz ryzyka — dwa blokery potwierdzone

| pytanie | odpowiedź |
|---|---|
| czy da się zatrzymać w locie? | **NIE** — `cancelPlan` robi wyłącznie `UPDATE` statusów, **zero dotknięcia zadania w kolejce ani sygnału przerwania** |
| czy ma limity? | częściowo — `MAX_STEPS_PER_PLAN=12`, retry 3; ale `estimatedCostUsd: 0`, czyli **brak limitu kosztu** |
| czy wysyła pocztę? | nie w tej ścieżce — `meetingInvitationService` nie jest importowany w definicjach narzędzi; realna bramka to `MEETING_INVITES_LIVE` + `SMTP_HOST` + `SMTP_USER` |
| co przy porażce w połowie? | retry działa; **cofania nie ma** |

**Brak możliwości zatrzymania i brak limitu kosztu to dwa twarde blokery.**

## ★ ODPOWIEDŹ NA PYTANIE WŁAŚCICIELA

**Nie włączać `ENABLE_AI_TASKS_WORKER`.** Nie dlatego, że agent nie działa — on
**działa i realnie wykonuje pracę**. Dlatego, że w obecnym stanie:
- melduje sukces, gdy nic nie zrobił,
- po tym meldunku **nie da się go wznowić ani naprawić**,
- **nie da się go zatrzymać** po uruchomieniu,
- nie ma limitu kosztu.

Decyzja o włączeniu wraca do Ciebie **po dyżurze 165**, który naprawia ogniwa 1–4.
Zatrzymywanie i limit kosztu to osobna pozycja.

## Rozbieżność do sprostowania

Flaga frontu `agentPlanFlag.ts:42-44` jest domyślnie **WŁĄCZONA**
(`return parsed === null ? true : parsed;`), a komentarz w `routeConfig.ts:62`
twierdzi „default OFF". **Komentarz kłamie.** Do naprawy przy okazji.

## Czego NIE zweryfikowano

- Realnego renderu panelu po zalogowaniu — brak poświadczeń, zgodnie z zakazem.
- Narzędzi wołających realnego dostawcę modelu — zakaz palenia budżetu.
- Górnej granicy wywołań dostawcy przy pełnej kombinatoryce retry i redrive.
- Anulowania w trakcie realnego efektu ubocznego — wyłącznie analiza statyczna.
- Idempotencji i cofania pozostałych dziesięciu narzędzi.

## Werdykt

**Do scalenia.** Wzorowy dyżur pomiarowy: zero zmian produktu, realny test
integracyjny z dowodem mutacyjnym, uczciwa sekcja twierdzeń niezweryfikowanych
i **rekomendacja negatywna, która okazała się nie dość surowa** — audyt pogłębił
ją o łańcuch trwałego zablokowania.
