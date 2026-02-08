# Value Stream Mapping (VSM) — intro script (45–60s)

## Metadata

- **Tool**: Value Stream Mapping (VSM)
- **Slug**: `value-stream-mapping-vsm`
- **Length**: 45–60s

## VO (PL)

„Jeśli Twoje dostawy są wolne, a wszyscy są „zajęci”, problemem zwykle nie jest praca — tylko czekanie. Value Stream Mapping pokazuje, gdzie dokładnie znika czas od zgłoszenia do dostarczenia.

W narzędziu ustawiasz zakres: start, koniec i jednostkę przepływu — na przykład zamówienie. Potem wpisujesz kroki procesu i dla każdego dodajesz liczby: czas cyklu, czas oczekiwania i WIP. System liczy lead time oraz udział pracy wartościowej kontra straty, a największe kolejki podświetla jako hot‑spoty.

Następnie projektujesz future state: zasady pull, limity WIP, pacemaker i prosty plan wdrożenia. Na końcu generujesz inicjatywy przypięte do konkretnych hot‑spotów i eksportujesz raport.”

## VO (EN)

“If delivery is slow and everyone is ‘busy’, the problem is usually not work—it’s waiting. Value Stream Mapping shows exactly where time disappears from request to delivery.

In the tool you set the scope—start, end, and the flow unit, like one order. Then you capture the process steps and add facts for each one: cycle time, waiting time, and WIP. The system calculates lead time and the share of value‑added work versus waste, highlighting the biggest queues as hot spots.

Next you design a future state with clear operating rules—pull, WIP limits, a pacemaker step, and an implementation plan. Finally, you generate initiatives linked to each hot spot and export a consultant‑ready report.”

## On-screen (PL)

- „Lead time = głównie czekanie”
- „Krok → CT / wait / WIP”
- „Hot‑spoty i straty”
- „Future state: pull + WIP”
- „Inicjatywy + eksport”

## On-screen (EN)

- “Lead time is mostly waiting”
- “Step → CT / wait / WIP”
- “Hot spots & waste”
- “Future state: pull + WIP”
- “Initiatives + export”

## Shot list

1. Scope setup (start/end/flow unit)
2. Step table with CT/wait/WIP
3. Timeline (VA vs wait) + hot-spot highlight
4. Future-state rules (WIP limit, pull, pacemaker)
5. Initiatives list + Export PDF

## Implementacja (1–2 zdania)

Model: `steps[]` z CT/wait/WIP + `futureState.rules[]`; inicjatywy mają traceability do `stepId/hotSpotId`; eksport PDF zawiera current state, future state, metryki i roadmapę.
