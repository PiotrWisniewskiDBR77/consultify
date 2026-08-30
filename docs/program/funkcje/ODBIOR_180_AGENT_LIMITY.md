---
doc_id: funkcje-odbior-180
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 180 — plany z czatu pod limitami · NIE SCALAĆ (FIX-180/Opus wydany)

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
