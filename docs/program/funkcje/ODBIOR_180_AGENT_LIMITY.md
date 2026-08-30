---
doc_id: funkcje-odbior-180
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 180 — plany z czatu pod limitami · SCALONO PO FIX-180

★ FIX-180 wykonany (5 commitów, `fa38aaf298..a3a70b2878`), wszystkie 4 wady
domknięte z mutacjami czerwonymi niezależnie: F3 krok terminalny po cancel ·
F4 NaN-guard na obu env · happy-path + licznik odmów (`[AgentResource] admission
denied` — metryka stagingu) · **F1/F2 rozwiązane projektowo bez migracji**:
odmowa przeliczana opt-in tylko dla plannera (kontrakt A09/wave8 nietknięty,
test asertuje obie połowy), klucz per próba z bajtowo-stabilną próbą 1 (dedup
redelivery zachowany — robotnik słusznie ODRZUCIŁ licznik w bazie z briefu FIX).
Sprostowanie: „zastany czerwony" day165 to brak JWT_SECRET w powłoce, nie defekt.

## ★ K6 — STAN KOŃCOWY MECHANIKI: DOMKNIĘTA
Wszystkie warunki twarde (1-5, 8) + F1-F4 zamknięte. Do włączenia
`ENABLE_AI_TASKS_WORKER` na STAGINGU zostały wyłącznie:
1. **Decyzja właściciela (6):** fail-open leniwego INSERT-u polityk obejmuje też
   wave8/multiAgent/adapter (wcześniej fail-closed) — zaakceptować czy zawęzić?
2. Ustawienie env przy deployu kandydata na staging (K5) + obserwacja licznika odmów.

Oceny: R1 **C** · R2 **B** (najlepszy dowód okna (b) w partii: spy na realnym
renewExecutionLease) · R3 **B** · uczciwość raportu **B+** (korekta T6 = realna
falsyfikacja tezy zlecenia). Mutacje M-a/M-b/M-c odtworzone niezależnie; Z37
domknięte przez odbiór: 2 czerwone u sąsiadów są ZASTANE (identyczne na markerze).

## Cztery wady z sond odbioru (żadnej nie było w raporcie)
- **F1 ★ BLOKUJĄCA — odmowa współbieżności TRWAŁA:** klucz idempotencji stabilny
  per krok → po chwilowym szczycie (`resource_concurrency_limit_exceeded`) krok
  jest martwy NA ZAWSZE (retry i wznowienie 165 reużywają klucz; sonda: 0 aktywnych
  rezerwacji, nadal denied). Wariant B (jeden klucz na organizację, limit 4) =
  piąty równoległy plan z czatu ginie bezpowrotnie.
- **F2:** próba 2/3 retry nie wykonuje narzędzia (`released` → replay denied),
  `step.error_message` = kod wewnętrzny zamiast realnej przyczyny (zastane na
  ścieżce kanonicznej — 180 przenosi na żywą).
- **F3:** krok w locie zostaje `running`/„W toku" po anulowaniu (cancelPlan skippuje
  tylko pending/awaiting; front AgentPlanCanvas:162 pokazuje to użytkownikowi).
- **F4:** zero walidacji NaN na OBU nowych env (literówka → warn na każdym kroku;
  `setInterval(NaN)`=1ms → UPDATE bazy co milisekundę).
Plus: brak testu happy-path (plan z czatu KOŃCZY się pod polityką), brak metryki
odmów `resource_*_limit_exceeded` (jedyna warta obserwacji po tej zmianie).

## FIX-180 (Opus): F3+F4+happy-path+licznik odmów (proste) · F1/F2 = projekt
semantyki idempotencji per próba (z zachowaniem dedupu redelivery BullMQ) —
jeśli rozwiązanie nieoczywiste, propozycja+STOP zamiast improwizacji.

## K6 po 180: TAK-Z-RESZTĄ-WARUNKÓW (staging)
Warunki (3) i (8) mechanicznie domknięte. Zostają: FIX-180 (F1-F4) ·
**decyzja właściciela (6): fail-open leniwego INSERT-u polityk dla wave8/
multiAgent/adapter** · monitoring = licznik odmów (w FIX-180) · F6-timeout
świadomie poza zakresem. Pułapka do wiedzy: vitest --config server/... Z KORZENIA
= „No test files found" (uruchamiać z server/).
