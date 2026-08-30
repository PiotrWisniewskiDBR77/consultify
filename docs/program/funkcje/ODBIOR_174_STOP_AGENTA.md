---
doc_id: funkcje-odbior-174
status: canonical
truth_type: acceptance
established: 2026-08-30
---

# ODBIÓR 174 — stop agenta · SCALONO Z ERRATĄ · agent: TAK-Z-WARUNKAMI (staging)

★ **FIX-174 WYKONANY** (merge `18661cc6a0`): cennik wyczerpujący dla 20 narzędzi,
2 płatne wycenione (0.01/0.05 z uzasadnieniem), nieznane narzędzie RZUCA
`unknown_tool_cost`; okno a2 domknięte (finalizePlan przy cancelled czyści dzierżawę
i zwraca spokojnie — mutacja M4 teraz CZERWONA bez warunku statusu); pin day164
zdjęty (strażnik pokwitowań żyje na dowolnej bazie); errata w raporcie.
**Warunki K6 pozostałe:** (3) ścieżka planów z czatu poza limitami → dyżur 180;
(6) decyzja właściciela o fail-open polityk dla 3 serwisów; (7) monitoring czasu
kroku przy włączeniu; (8) pomiar przypadku (b) → dyżur 180.

Gałąź `codex/day174-stop-agenta-20260830` (2 commity nad `d3d36cd5f5`). Odbiór:
własne kontenery PG 6081 + Redis 6406, day161 od pustej bazy PASS, **4 mutacje
niezależne czerwone** (M1 aiWorker-cancelled · M2 pętla-status · M3 cennik ·
MR3 leniwy INSERT). Oceny: R1 **B** · R2 **C** · R3 **B**. Raport wykonawcy uczciwy
(PARTIAL zasadny), z trzema nieścisłościami — errata niżej.

## ERRATA NADZORCY (obowiązująca wykładnia scalenia)
1. **Okno a2 (anulowanie w trakcie ostatniego kroku):** `finalizePlan` z warunkiem
   `status='executing'` NIE MA żadnej asercji (mutacja M4 zielona) i w tym oknie
   `executePlan` RZUCA `AgentExecutionLeaseLostError`, zostawiając **przeciekniętą
   dzierżawę ~5 min** i pokwitowanie FAILED z kłamliwą przyczyną.
2. **Cennik fikcyjnie zeruje 2 realnie płatne narzędzia:** `search_knowledge_base`
   (→ generateEmbedding, płatny model) i `search_enterprise_connector` (zewnętrzne
   wywołanie). Plus catch-all `?? 0` — nowe narzędzie cicho kosztuje zero.
3. **Fail-open poza flagą:** leniwy INSERT polityki auto-provisionuje limity także
   dla wave8/multiAgent/adapter (3 serwisy nietykalne, wcześniej uczciwy fail-closed
   `resource_policy_not_found`). Promień rażenia niezmierzony.
4. **Pin Z31 CZWARTY raz:** `day164.agent-dispatch-map.test.ts:80` przypięty do
   `cx164:6052` — jedyny strażnik semantyki pokwitowania martwy poza maszyną 164.
5. Sprostowanie raportu: „5/5 PASS, 0 pending" → realnie **7 total: 5 pass, 2 PENDING**
   (i to dokładnie te 2, które strzegą zmienionej linii).

## ★ ODPOWIEDŹ K6: włączyć `ENABLE_AI_TASKS_WORKER`?
**TAK-Z-WARUNKAMI — wyłącznie staging, nie demo.** Trzy blokery zamknięte
(pokwitowanie RUNNING · nadpisanie cancelled→completed między krokami ·
policy_not_found). Warunki twarde przed flagą:
(1) wycena 2 płatnych narzędzi + (2) wyczerpująca mapa bez catch-all → **FIX-174**;
(4) domknięcie/akcept okna a2 + asercja M4 → **FIX-174**;
(5) odpięcie pinu day164 → **FIX-174**;
(3) **ścieżka bez `canonicalRunId` (plany z czatu!) poza rezerwacją/limitem** —
dyżur 180; (6) decyzja właściciela o fail-open dla 3 serwisów; (7) brak timeoutu
kroku (F6, świadomie poza zakresem — włączać tylko z monitoringiem); (8) pomiar
przypadku (b) krok>60s — dyżur 180.
