# IRIS — Katalog Problemów i Rozwiązań (Pain Points)

Data: 2026-03-03  
Wersja: 1.0  
Cel: lista problemów biznesowych, które IRIS rozwiązuje “od ręki” lub w krótkim czasie po wdrożeniu, z priorytetyzacją wg wartości.

---

## Jak czytać priorytety

- **P1 (Najwyższa wartość)**: szybki wpływ na koszty/ciągłość/ryzyko, łatwe do uruchomienia.
- **P2 (Wysoka wartość)**: duży wpływ, ale wymaga więcej danych, zmian procesu lub integracji.
- **P3 (Średnia wartość)**: korzyści strategiczne/długoterminowe, najczęściej po ustabilizowaniu podstaw.

---

## Lista problemów (min. 20) — od najbardziej wartościowych

### P1 — Najwyższa wartość (Quick Wins)

1. **Brak jednej prawdy o operacjach (production/warehouse/quality/maintenance)**  
   - **Objaw**: wiele arkuszy, “różne liczby” na spotkaniach, spory o dane.  
   - **IRIS**: modularne źródła danych + RBAC + audit + cross-module dashboardy.  
   - **Efekt**: decyzje oparte o wspólne definicje KPI.

2. **Brak śladu decyzyjnego i odpowiedzialności (kto zatwierdził co i dlaczego)**  
   - **Objaw**: “to się wydarzyło” bez audytu, trudne post-mortem.  
   - **IRIS**: audit trail dla operacji write + workflow/approvals (etapowo).  
   - **Efekt**: compliance i bezpieczeństwo decyzji.

3. **Chaos w egzekucji działań (inicjatywy bez zadań i SLA)**  
   - **Objaw**: “ustaliliśmy” bez wykonania, brak ownerów i terminów.  
   - **IRIS**: `GEMBA_TASKS` (assignment, SLA, statusy, overdue) + linki do KPI/alertów.  
   - **Efekt**: mierzalna realizacja i eskalacje.

4. **Brak obiektywnego baseline’u dojrzałości i gotowości (DX/Industry 4.0)**  
   - **Objaw**: inwestycje “na czuja”, brak mapy drogowej.  
   - **IRIS**: assessmenty (np. SIRI/ADMA jako framework) + scoring + heatmapy + rekomendacje.  
   - **Efekt**: priorytetyzacja inwestycji i szybkie “co najpierw”.

5. **Wysokie koszty konsultantów przy braku transferu wiedzy i narzędzi**  
   - **Objaw**: raporty PDF bez operacyjnego wdrożenia.  
   - **IRIS**: proces od rekomendacji → inicjatywy → tasks → KPI, w jednym systemie.  
   - **Efekt**: mniej “slajdów”, więcej wdrożenia.

6. **Niska przewidywalność produkcji (status zleceń, postęp, zaległości)**  
   - **Objaw**: opóźnienia, gaszenie pożarów, brak wspólnego widoku.  
   - **IRIS**: MES (order lifecycle: create/start/complete), dashboardy postępu.  
   - **Efekt**: kontrola realizacji i lepsze planowanie.

7. **Brak kontroli nad przestojami i przyczynami**  
   - **Objaw**: “stoi, bo stoi”, brak kodów przyczyn i danych.  
   - **IRIS**: rejestracja przestojów (MES v1+), tasks i działania korygujące (GEMBA).  
   - **Efekt**: redukcja strat, przygotowanie pod OEE.

8. **Awarie bez systemowego procesu (zgłoszenie → zlecenie → zamknięcie)**  
   - **Objaw**: telefony, kartki, brak backlogu UR i priorytetów.  
   - **IRIS**: CMMS (assets, failure report, work orders, assign/close).  
   - **Efekt**: krótszy MTTR, lepsza kontrola backlogu.

9. **Brak “pętli jakości” (produkcja kończy, ale brak kontroli/feedbacku)**  
   - **Objaw**: reklamacje, brak inspekcji, brak traceability.  
   - **IRIS**: QMS + automatyczne inspekcje po `mes.order.completed`.  
   - **Efekt**: szybsza reakcja na problemy jakościowe.

10. **Nieprzejrzyste stany magazynowe i “niewiadome braki”**  
   - **Objaw**: przestoje z powodu materiałów, błędne wydania.  
   - **IRIS**: WMS (stock, receive, lokacje, filtrowanie) + przygotowanie pod rezerwacje.  
   - **Efekt**: mniej braków, lepsza dostępność materiałów.

11. **Brak ról i uprawnień w systemach (wszystko dla wszystkich)**  
   - **Objaw**: ryzyko wycieku i błędów, brak rozdziału obowiązków.  
   - **IRIS**: RBAC + izolacja tenantów + audit.  
   - **Efekt**: minimalizacja ryzyka i kontrola dostępu.

12. **Nieefektywne spotkania operacyjne (brak danych, brak decyzji, brak follow-up)**  
   - **Objaw**: długie daily/weekly bez wykonania.  
   - **IRIS**: cockpit KPI + lista decyzji + tasks z SLA.  
   - **Efekt**: krótsze spotkania, lepsza egzekucja.

### P2 — Wysoka wartość (po ustabilizowaniu podstaw)

13. **Brak integracji IT/OT (dane są, ale nie docierają do decydentów)**  
   - **Objaw**: dane w SCADA/PLC, ale brak operacyjnych akcji.  
   - **IRIS**: IoT ingest + mapowanie alertów do assetów/zleceń + automatyzacje (feature flags).  
   - **Efekt**: skrócenie czasu reakcji, automatyczne tworzenie work orders/tasks.

14. **Brak spójnych definicji KPI (OEE, scrap, OTIF, MTTR/MTBF)**  
   - **Objaw**: KPI liczone inaczej w każdym dziale.  
   - **IRIS**: katalog KPI + governance definicji + dashboardy.  
   - **Efekt**: porównywalność, baseline i cele.

15. **Niedojrzałe planowanie (APS/MRP) i rozjazd między planem a wykonaniem**  
   - **Objaw**: plan “na papierze”, wykonanie “na hali”.  
   - **IRIS**: kontrakty zdarzeń (MES↔APS/MRP), później integracje i optymalizacja.  
   - **Efekt**: stopniowe domykanie pętli plan→execute→learn.

16. **Za dużo ręcznych raportów (Excel) i brak automatyzacji raportowania**  
   - **Objaw**: copy-paste, błędy, brak aktualności.  
   - **IRIS**: raporty PDF/CSV + API do BI/data lake.  
   - **Efekt**: oszczędność czasu i spójność.

17. **Brak widoczności kosztu przestojów i awarii (finanse vs operacje)**  
   - **Objaw**: CFO nie ma wspólnego języka z COO.  
   - **IRIS**: powiązanie zdarzeń (MES/CMMS) z KPI i inicjatywami.  
   - **Efekt**: finansowy “case for change”.

18. **Brak systemowego zarządzania zmianą (przebudowy, robotyzacja, modernizacje)**  
   - **Objaw**: projekty bez zależności, zrywanie terminów.  
   - **IRIS**: portfel inicjatyw + tasks + audyt decyzji.  
   - **Efekt**: kontrola i priorytetyzacja.

19. **Brak “feedback loop” dla działań lean/kaizen**  
   - **Objaw**: pomysły giną, nie ma mierników efektów.  
   - **IRIS**: tasks + KPI baseline/target + raport efektów.  
   - **Efekt**: kaizen oparty o dane.

20. **Brak standardów pracy w narzędziach (każdy robi po swojemu)**  
   - **Objaw**: trudne wdrożenia nowych osób i utrzymanie jakości.  
   - **IRIS**: workflow + checklisty + audit + role.  
   - **Efekt**: standaryzacja i spójność.

### P3 — Średnia wartość (strategicznie, po zbudowaniu fundamentów)

21. **Brak predykcji (awarie, braki, jakość) — reagowanie zamiast zapobiegania**  
   - **Objaw**: “gaszenie pożarów”.  
   - **IRIS**: DATA_AI + IoT + CMMS predictive (etapowo).  
   - **Efekt**: przesunięcie z reakcji na prewencję.

22. **Brak symulacji i modelu zakładu do decyzji inwestycyjnych**  
   - **Objaw**: trudne decyzje CAPEX bez symulacji wpływu.  
   - **IRIS**: DT (digital twin) + scenariusze KPI.  
   - **Efekt**: lepsza jakość decyzji strategicznych.

23. **Brak mechanizmu skalowania najlepszych praktyk między zakładami**  
   - **Objaw**: każdy zakład “od nowa”.  
   - **IRIS**: multi-tenant governance + szablony ustawień/procesów + katalog inicjatyw.  
   - **Efekt**: skalowanie i replikacja skutecznych rozwiązań.

24. **Ryzyko zgodności (compliance) i brak przygotowania do audytów**  
   - **Objaw**: audyty wymagają ręcznego zbierania dowodów.  
   - **IRIS**: audit trail, raporty, kontrola dostępu, polityki retencji.  
   - **Efekt**: tańsze i szybsze audyty.

25. **Rozproszone narzędzia (ticketing, excel, osobne MES/WMS/CMMS)**  
   - **Objaw**: integracje “na sznurkach”, duży koszt utrzymania.  
   - **IRIS**: spójny ekosystem modułów z kontraktami i wspólnym core.  
   - **Efekt**: redukcja TCO i kosztu zmian.

---

## Podsumowanie — gdzie IRIS daje najszybszą wartość

- **Egzekucja**: `GEMBA_TASKS` + SLA + powiązanie z KPI.  
- **Widoczność**: dashboardy cross-module (APPLICATION) i spójne definicje danych.  
- **Domykanie pętli**: MES → QMS (event-driven) oraz CMMS → działania → KPI.

