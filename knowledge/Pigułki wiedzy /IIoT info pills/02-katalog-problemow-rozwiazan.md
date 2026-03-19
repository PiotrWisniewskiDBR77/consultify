# DBR77 IIoT — Katalog Problemów i Rozwiązań (Pain Points)

## Priorytetyzacja według wartości biznesowej (od najwyższej)

| # | Problem | Rozwiązanie DBR77 IIoT |
|---|---------|------------------------|
| 1 | Przestoje bez zarejestrowanej przyczyny | Status Deck — deklaracja stanu w ~2 s; realne powody strat |
| 2 | OEE liczone „po fakcie”, bez wiarygodnych danych | Dane w czasie zbliżonym do rzeczywistego; sygnały + deklaracje |
| 3 | Złe dane trafiają do systemów i zniekształcają analitykę | Walidacja sygnałów na edge przed transmisją |
| 4 | Brak informacji o przyczynach przestojów | Alerty, eskalacje, szybka reakcja bez ręcznego raportowania |
| 5 | Stare maszyny bez PLC/OPC-UA | Status Deck + Data Hub — retrofit bez wymiany infrastruktury |
| 6 | Różne protokoły, brak jednej magistrali | MQTT/Modbus/RS485/LoRaWAN/Wi‑Fi/SIM w jednym strumieniu |
| 7 | Operator nie widzi zadań i alertów na hali | Aplikacje Mobile & Tablet — zadania, checklisty, powiadomienia |
| 8 | Brak obiektywnego monitoringu mediów (energia, woda, gaz) | Czujniki i integracje; koszt per linia/maszyna |
| 9 | Niska produktywność operatorów, brak powiązań | Workforce module — zadania, powiązanie z maszynami |
| 10 | Brak BHP/QA w czasie rzeczywistym | Vision AI (Edge) — PPE, defekty, anomalie |
| 11 | Chaotyczne zbieranie danych z wielu źródeł | Jedna platforma: PLC, czujniki, deklaracje, wizja |
| 12 | Ryzyko wysyłania danych poza zakład | Przetwarzanie na edge; mniejsza ekspozycja danych |
| 13 | Brak zdalnej obsługi urządzeń | Zarządzanie czujnikami w chmurze, aktualizacje firmware |
| 14 | Brak elastyczności zasilania i transmisji | Zasilanie: sieć, bateria; transmisja: Wi‑Fi, LoRaWAN, SIM |
| 15 | Brak certyfikacji i audytowalności | CE, ISO 27001 |
| 16 | Wymagana integracja z istniejącym MES/ERP | API, integracja z IRIS i systemami partnerskimi |
| 17 | Długi czas wdrożenia i wysokie ryzyko | Pilotaż 1–3 stanowisk; raport z wnioskami; skalowanie krok po kroku |
| 18 | Lock-in na jednego dostawcę | Własny hardware + ekosystem partnerów |
| 19 | Kosztowna infrastruktura IT dla edge | Edge-first; możliwość pracy lokalnie i synchronizacji |
| 20 | Brak spójnej wizji „od sygnału do działania” | The Loop — zamknięta pętla: dane → decyzja → akcja na hali |
