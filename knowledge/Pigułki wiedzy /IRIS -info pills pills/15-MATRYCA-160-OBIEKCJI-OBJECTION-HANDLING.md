# IRIS — Matryca 160 Obiekcji (Objection Handling)

Data: 2026-03-03  
Wersja: 1.0  
Cel: gotowe, profesjonalne odpowiedzi na obiekcje dla 8 person.

Format odpowiedzi (spójny):

- **Odpowiedź**: neutralizacja obawy (bez obrony/agresji).
- **Jak to robimy w IRIS**: mechanizm produktu/procesu.
- **Next step**: pytanie domykające lub propozycja kolejnego kroku.

---

## 1) CEO — 20 obiekcji

1. **“Nie wierzę w cyfrowe doradztwo — to brzmi jak slajdy.”**  
   - **Odpowiedź**: IRIS nie kończy się na rekomendacji — domyka wykonanie i efekt w KPI.  
   - **Jak to robimy w IRIS**: inicjatywy → zadania z SLA → tracking KPI + audyt decyzji.  
   - **Next step**: Jakie 2 straty (downtime/scrap/braki) są dziś najdroższe?

2. **“Nie chcę kolejnej platformy, która będzie ‘ładna’, ale nikt jej nie użyje.”**  
   - **Odpowiedź**: startujemy od jednego procesu i mierzymy efekt w 4–8 tygodni.  
   - **Jak to robimy w IRIS**: MVP danych + operacyjne tasks + cockpit dla COO.  
   - **Next step**: Który obszar ma najwyższy koszt strat?

3. **“Transformacja trwa latami — nie mamy na to czasu.”**  
   - **Odpowiedź**: nie robimy “big bang”; robimy serię krótkich fal z ROI.  
   - **Jak to robimy w IRIS**: etapowe moduły + governance + priorytety portfela.  
   - **Next step**: Jaki horyzont na pierwszy mierzalny wynik: 4 czy 8 tygodni?

4. **“Mam obawy, że to odciągnie ludzi od produkcji.”**  
   - **Odpowiedź**: IRIS redukuje biurokrację przez automatyzację i jedno miejsce prawdy.  
   - **Jak to robimy w IRIS**: mniej Exceli, szybkie zadania, gotowe dashboardy.  
   - **Next step**: Ile godzin tygodniowo idzie na raportowanie i koordynację?

5. **“Nie chcę, żeby AI podejmowało decyzje za nas.”**  
   - **Odpowiedź**: AI w IRIS wspiera decyzje, ale decyzje i akceptacje są po Waszej stronie.  
   - **Jak to robimy w IRIS**: rekomendacje + uzasadnienie + workflow akceptacji + audyt.  
   - **Next step**: Kto dziś zatwierdza inicjatywy i na jakich danych?

6. **“Mamy swoje standardy, nie będziemy się dopasowywać do narzędzia.”**  
   - **Odpowiedź**: IRIS jest modułowy i konfigurowalny — dostosowujemy workflow i KPI.  
   - **Jak to robimy w IRIS**: SETTINGS (hierarchiczne ustawienia), RBAC, kontrakty API.  
   - **Next step**: Jakie 3 standardy muszą zostać zachowane “bez dyskusji”?

7. **“Nie chcę vendor lock-in.”**  
   - **Odpowiedź**: projektujemy integracje kontraktowo i zapewniamy eksporty danych.  
   - **Jak to robimy w IRIS**: REST API, CSV/XLSX/PDF eksport, audyt i data portability.  
   - **Next step**: Jakie dane muszą być eksportowalne (i w jakim formacie)?

8. **“Nie chcę ujawniać naszej wiedzy procesowej.”**  
   - **Odpowiedź**: IP i dane procesowe pozostają własnością klienta — technicznie i kontraktowo.  
   - **Jak to robimy w IRIS**: izolacja tenantów + RBAC + szyfrowanie + NDA/DPA.  
   - **Next step**: Jakie macie wymogi dot. regionu danych i retencji?

9. **“Mamy kilka zakładów — boję się chaosu wdrożeniowego.”**  
   - **Odpowiedź**: skalujemy falami, dopiero po proof-of-value w jednym zakładzie.  
   - **Jak to robimy w IRIS**: szablony konfiguracji + governance + rollout wave plan.  
   - **Next step**: Który zakład jest najlepszy na pilota i dlaczego?

10. **“Nie chcę ryzyka przestoju przez wdrożenie systemu.”**  
   - **Odpowiedź**: IRIS działa równolegle; start bez ingerencji w sterowanie OT.  
   - **Jak to robimy w IRIS**: web app, importy/API etapowo, brak wymogu “big cutover”.  
   - **Next step**: Jakie integracje są krytyczne, a które mogą poczekać?

11. **“To brzmi jak duży projekt IT.”**  
   - **Odpowiedź**: to przede wszystkim projekt operacyjny; IT jest enablerem, nie wąskim gardłem.  
   - **Jak to robimy w IRIS**: MVP bez integracji, potem integracje kontraktowe.  
   - **Next step**: Czy możemy zacząć od danych plikowych i 1 procesu?

12. **“Już mieliśmy kiedyś system, który się nie przyjął.”**  
   - **Odpowiedź**: zwykle brakowało egzekucji i mierników; tu jest task+SLA i KPI.  
   - **Jak to robimy w IRIS**: GEMBA_TASKS + cockpit + accountability.  
   - **Next step**: Co było przyczyną niepowodzenia poprzedniego wdrożenia?

13. **“Nie chcę nadmiernej kontroli nad ludźmi.”**  
   - **Odpowiedź**: IRIS ma wzmacniać proces, nie “inwigilować”; KPI są procesowe, nie personalne.  
   - **Jak to robimy w IRIS**: RBAC, audyt operacji systemowych, definicje KPI ustalane wspólnie.  
   - **Next step**: Jakie KPI uważacie za bezpieczne i wspierające kulturę?

14. **“Czy to jest zgodne z naszą strategią długoterminową?”**  
   - **Odpowiedź**: IRIS buduje platformę operacyjną i governance, które skalują się z firmą.  
   - **Jak to robimy w IRIS**: modularność, kontrakty API, multi-tenant readiness, observability.  
   - **Next step**: Jaki jest Wasz cel strategiczny na 12–24 mies. (koszt, jakość, capacity)?

15. **“Nie chcę, żeby dane trafiały poza UE.”**  
   - **Odpowiedź**: region danych jest wybierany kontraktowo; możliwa data residency w UE.  
   - **Jak to robimy w IRIS**: hosting w regionie UE + polityki retencji/backupów.  
   - **Next step**: Czy wymagacie konkretnego kraju/regionu (PL/DE) czy wystarczy UE?

16. **“Nie widzę, jak to daje przewagę konkurencyjną.”**  
   - **Odpowiedź**: przewaga to szybsza egzekucja i niższe straty; IRIS skraca czas od problemu do efektu.  
   - **Jak to robimy w IRIS**: rekomendacje→task→KPI, mniej ręcznych działań, audyt decyzji.  
   - **Next step**: Która strata najbardziej ogranicza Waszą zdolność dostarczania?

17. **“Czy to nie jest tylko dla produkcji? My mamy też ESG/HSE.”**  
   - **Odpowiedź**: IRIS jest platformą modułową — można rozszerzać zakres po pilocie.  
   - **Jak to robimy w IRIS**: moduły i fale wdrożenia; wspólny core (RBAC/audit/settings).  
   - **Next step**: Który obszar ma największe ryzyko reputacyjne/compliance?

18. **“Nie chcę ryzyka prawnego (dane, IP, umowy).”**  
   - **Odpowiedź**: standardem są NDA/DPA, data portability i jasne zapisy o własności danych.  
   - **Jak to robimy w IRIS**: izolacja + szyfrowanie + audyt + polityki retencji/usunięcia.  
   - **Next step**: Jakie klauzule są dla Was kluczowe (DPA, retention, audit)?

19. **“To będzie kosztować więcej niż planujemy.”**  
   - **Odpowiedź**: zakres dobieramy do ROI — zaczynamy od obszaru z najwyższą stratą.  
   - **Jak to robimy w IRIS**: MVP + proof-of-value + etapowanie modułów.  
   - **Next step**: Jaki jest budżet na pilot i jaki efekt musi dowieźć?

20. **“Nie chcę zmiany kultury organizacyjnej.”**  
   - **Odpowiedź**: IRIS nie narzuca kultury — wprowadza przejrzystość i odpowiedzialność, które wspierają dowolną kulturę wykonania.  
   - **Jak to robimy w IRIS**: governance, role, zadania, KPI — stopniowo.  
   - **Next step**: Jak wygląda dziś rozliczanie działań: spotkania, tablice, system?

---

## 2) CFO — 20 obiekcji

1. **“Nie chcę stałych kosztów OPEX.”**  
   - **Odpowiedź**: koszt wiążemy z mierzalnym ROI i etapowaniem — płacisz za wartość, nie obietnicę.  
   - **Jak to robimy w IRIS**: pilot 4–8 tyg. + tracking benefitów w KPI.  
   - **Next step**: Jaki próg ROI jest dla Ciebie akceptowalny?

2. **“Jak mam udowodnić zwrot z inwestycji?”**  
   - **Odpowiedź**: liczymy ROI na Waszych liczbach (downtime/scrap/awarie) i monitorujemy po wdrożeniu.  
   - **Jak to robimy w IRIS**: baseline KPI + target + raport efektów inicjatyw.  
   - **Next step**: Czy macie koszt 1h przestoju i scrap w PLN?

3. **“To brzmi jak koszt wdrożenia + koszt utrzymania + koszt ludzi.”**  
   - **Odpowiedź**: dlatego start jest wąski; redukujemy koszty manualne i chaos narzędziowy.  
   - **Jak to robimy w IRIS**: jeden system zamiast wielu Exceli i ręcznych raportów.  
   - **Next step**: Ile osobo-godzin tygodniowo idzie na raportowanie?

4. **“Ryzyko nietrafionego zakupu jest wysokie.”**  
   - **Odpowiedź**: pilot minimalizuje ryzyko — decyzja na danych, nie na obietnicach.  
   - **Jak to robimy w IRIS**: proof-of-value z KPI i audytem działań.  
   - **Next step**: Jakie 2 KPI mają się poprawić po pilocie?

5. **“Nie chcę CAPEX na infrastrukturę.”**  
   - **Odpowiedź**: SaaS eliminuje CAPEX; private/on-prem tylko gdy to konieczne.  
   - **Jak to robimy w IRIS**: hosting w chmurze, SLA/DR, bez lokalnych instalacji.  
   - **Next step**: Czy macie politykę “no cloud”, czy to preferencja?

6. **“Jak zabezpieczacie dane finansowe i wrażliwe?”**  
   - **Odpowiedź**: RBAC, izolacja tenantów, szyfrowanie, audyt — enterprise standard.  
   - **Jak to robimy w IRIS**: security-by-default + logi i ślad decyzji.  
   - **Next step**: Jakie macie wymogi compliance (audyt, retencja, region)?

7. **“Nie chcę, żeby koszt licencji rósł niekontrolowanie.”**  
   - **Odpowiedź**: model dobieramy do skali i pakietu; limity i metering są jawne.  
   - **Jak to robimy w IRIS**: SAAS plans/limits/metering (wspierane przez platformę).  
   - **Next step**: Jak planujecie skalować: użytkownicy, zakłady, moduły?

8. **“Mamy już BI — po co nam IRIS?”**  
   - **Odpowiedź**: BI pokazuje dane; IRIS domyka egzekucję (zadania, SLA, decyzje).  
   - **Jak to robimy w IRIS**: rekomendacje→inicjatywy→tasks→KPI; API do BI.  
   - **Next step**: Co dziś dzieje się po raporcie BI — kto i jak egzekwuje działania?

9. **“Czy koszt mogę rozliczyć jako B+R lub inwestycję?”**  
   - **Odpowiedź**: to zależy od księgowości i jurysdykcji; pomagamy przygotować opis zakresu i efektów.  
   - **Jak to robimy w IRIS**: raporty efektów, ślad decyzji, dokumentacja wdrożenia.  
   - **Next step**: Jakie macie kryteria kwalifikacji kosztów (B+R, digitalizacja)?

10. **“Nie mamy budżetu na konsultantów.”**  
   - **Odpowiedź**: IRIS ogranicza zależność od konsultantów, bo daje stały mechanizm egzekucji.  
   - **Jak to robimy w IRIS**: gotowe flow i governance, a nie jednorazowy raport.  
   - **Next step**: Czy wolicie pilot produktowy czy usługowy?

11. **“Jakie są koszty ukryte (integracje, utrzymanie)?”**  
   - **Odpowiedź**: rozbijamy koszty na pakiety; integracje są opcją, nie warunkiem startu.  
   - **Jak to robimy w IRIS**: MVP bez integracji, potem kontraktowe API etapami.  
   - **Next step**: Które integracje są “must-have” w roku 1?

12. **“Nie chcę płacić za funkcje, których nie użyjemy.”**  
   - **Odpowiedź**: modułowość pozwala kupować zakres adekwatny do problemu.  
   - **Jak to robimy w IRIS**: moduły logiczne + RBAC + plan wdrożenia falami.  
   - **Next step**: Który obszar ma najwyższy koszt strat: UR, jakość, magazyn czy produkcja?

13. **“Co jeśli po 3 miesiącach nie będzie efektu?”**  
   - **Odpowiedź**: dlatego definiujemy KPI sukcesu na start i robimy review co 2 tygodnie.  
   - **Jak to robimy w IRIS**: baseline→target→tasks→raport; eskalacje governance.  
   - **Next step**: Kto po Waszej stronie będzie ownerem KPI sukcesu?

14. **“Boję się, że ludzie będą ‘pod KPI’ manipulować danymi.”**  
   - **Odpowiedź**: audyt i spójne źródła danych redukują manipulację; KPI są procesowe, nie personalne.  
   - **Jak to robimy w IRIS**: audit trail, role, definicje KPI i kontrola zmian.  
   - **Next step**: Jakie dane muszą mieć najwyższą wiarygodność?

15. **“Czy IRIS pomoże w controllingu operacyjnym?”**  
   - **Odpowiedź**: tak — mapuje straty i działania na KPI, co ułatwia controlling.  
   - **Jak to robimy w IRIS**: dashboardy CFO/COO + raport efektów inicjatyw.  
   - **Next step**: Które koszty chcesz mieć widoczne: przestoje, awarie, scrap, logistyka?

16. **“Czy to będzie audytowalne dla inwestorów/boardu?”**  
   - **Odpowiedź**: tak — decyzje i zmiany są rejestrowane, a raporty dają spójny obraz.  
   - **Jak to robimy w IRIS**: audit trail + export PDF/CSV + ślad akceptacji.  
   - **Next step**: Jakie raporty board chce co miesiąc?

17. **“Nie chcę dodatkowego ryzyka prawnego (dane w chmurze).”**  
   - **Odpowiedź**: data residency i umowy (NDA/DPA/SLA) domykają wymogi; możliwy private/on-prem.  
   - **Jak to robimy w IRIS**: region UE, retencja, backup, szyfrowanie.  
   - **Next step**: Czy wymóg to UE, czy konkretny kraj?

18. **“A jeśli DBR77 zniknie z rynku?”**  
   - **Odpowiedź**: minimalizujemy ryzyko przez eksport danych i kontraktowe integracje.  
   - **Jak to robimy w IRIS**: data portability, standardowe API, dokumentacja.  
   - **Next step**: Jakie zapisy o escrow/portability są dla Was standardem?

19. **“To wygląda na koszt, a nie inwestycję.”**  
   - **Odpowiedź**: wybieramy obszar, gdzie każdy tydzień ma policzalną stratę — wtedy to inwestycja.  
   - **Jak to robimy w IRIS**: zaczynamy od top losses i mierzymy efekt w KPI.  
   - **Next step**: Gdzie dziś tracicie najwięcej pieniędzy “każdego tygodnia”?

20. **“Nie widzę, jak to wpłynie na EBITDA.”**  
   - **Odpowiedź**: redukcja strat + lepsza dostępność + mniej scrapu to bezpośredni wpływ na wynik.  
   - **Jak to robimy w IRIS**: łączenie działań (tasks) z KPI i raporty efektu.  
   - **Next step**: Czy priorytetem jest koszt jednostkowy, terminowość czy jakość?

---

## 3) COO — 20 obiekcji

1. **“Nie chcę zaburzyć ciągłości produkcji.”**  
   - **Odpowiedź**: IRIS uruchamiamy bez ingerencji w OT; start równoległy.  
   - **Jak to robimy w IRIS**: web app + MVP danych; integracje etapami.  
   - **Next step**: Który proces ma być pilotażem bez ryzyka operacyjnego?

2. **“Algorytm nie zrozumie specyfiki ‘żywej’ produkcji.”**  
   - **Odpowiedź**: nie opieramy się tylko na AI — najpierw standard danych, potem analityka.  
   - **Jak to robimy w IRIS**: MES/WMS/QMS/CMMS + zadania; AI etapowo (DATA_AI).  
   - **Next step**: Jakie 3 reguły operacyjne są nienegocjowalne?

3. **“Moi kierownicy nie będą mieli czasu na kolejne narzędzie.”**  
   - **Odpowiedź**: IRIS ma skrócić czas koordynacji i raportów, nie go zwiększać.  
   - **Jak to robimy w IRIS**: cockpit + tasks + gotowe raporty zmiany.  
   - **Next step**: Ile trwa dziś przygotowanie raportu zmianowego?

4. **“Mamy już tablice, spotkania, daily management.”**  
   - **Odpowiedź**: IRIS wzmacnia daily przez dane i egzekucję (SLA), a nie zastępuje rytuałów.  
   - **Jak to robimy w IRIS**: tasks + overdue + link do KPI i zdarzeń.  
   - **Next step**: Co dziś najczęściej nie domyka się po daily?

5. **“Nie chcę wojny między działami o dane.”**  
   - **Odpowiedź**: robimy wspólne definicje KPI i audit; spór znika, bo dane są wspólne.  
   - **Jak to robimy w IRIS**: governance KPI + jeden model danych + audyt zmian.  
   - **Next step**: Który KPI jest dziś najbardziej “sporny”?

6. **“To kolejny system, który nie będzie zintegrowany.”**  
   - **Odpowiedź**: integracje są kontraktowe, ale nie są warunkiem startu; zaczynamy od wartości.  
   - **Jak to robimy w IRIS**: REST API + event envelope + etapowanie integracji.  
   - **Next step**: Jakie 2 integracje mają największy wpływ na operacje?

7. **“Nie chcę mikro-zarządzania przez KPI.”**  
   - **Odpowiedź**: KPI w IRIS są procesowe i do decyzji, nie do rozliczania ludzi.  
   - **Jak to robimy w IRIS**: role, definicje KPI, dashboardy na poziomie procesu.  
   - **Next step**: Które KPI są ‘zdrowe’, a które budzą opór?

8. **“Nie chcę kolejnego ticketingu.”**  
   - **Odpowiedź**: GEMBA_TASKS to operacyjne zadania z linkiem do procesu; nie zastępuje Jira/ITSM.  
   - **Jak to robimy w IRIS**: tasks powiązane z alertem/obserwacją/KPI.  
   - **Next step**: Jakie zadania są dziś najczęstsze i gdzie giną?

9. **“Nie chcę, żeby UR i produkcja przerzucały się odpowiedzialnością.”**  
   - **Odpowiedź**: IRIS wprowadza jasne ownerstwo, SLA i audyt zmian statusów.  
   - **Jak to robimy w IRIS**: tasks + CMMS work orders + eskalacje.  
   - **Next step**: Który etap procesu awarii jest dziś najsłabszy?

10. **“Chcę efektu w tym kwartale.”**  
   - **Odpowiedź**: to realne, jeśli wybierzemy 1–2 największe straty i zrobimy pilot.  
   - **Jak to robimy w IRIS**: 4–8 tyg. proof-of-value + KPI.  
   - **Next step**: Wybierzmy razem 2 obszary o najwyższej stracie.

11. **“Nasi ludzie nie będą wpisywać danych.”**  
   - **Odpowiedź**: minimalizujemy ręczne wpisy; tam gdzie konieczne — robimy prosty workflow i korzyść dla użytkownika.  
   - **Jak to robimy w IRIS**: szybkie formularze, importy, integracje etapami.  
   - **Next step**: Jakie dane dziś już są zbierane, tylko w Excelu?

12. **“To będzie wymagało szkoleń i zmiany nawyków.”**  
   - **Odpowiedź**: tak, ale w małym zakresie; szkolimy pod role i konkretny proces.  
   - **Jak to robimy w IRIS**: role-based UX + krótkie instrukcje + powtarzalne rytuały review.  
   - **Next step**: Które role mają być pierwsze: kierownicy zmian czy liderzy UR?

13. **“Nie chcę, żeby system spowolnił pracę.”**  
   - **Odpowiedź**: system jest projektowany pod p95 wydajności i proste ścieżki; ciężkie analizy robi się w tle.  
   - **Jak to robimy w IRIS**: observability-first, metryki p95, caching etapowo.  
   - **Next step**: Które ekrany muszą być “instant” (np. status zleceń, tasks)?

14. **“Mamy różne zakłady i różne procesy.”**  
   - **Odpowiedź**: dlatego start od jednego, a potem szablony i lokalne różnice jako konfiguracja.  
   - **Jak to robimy w IRIS**: SETTINGS hierarchiczne + governance + rollout waves.  
   - **Next step**: Co jest wspólne między zakładami, a co musi być lokalne?

15. **“Nie chcę dodatkowej biurokracji w jakości.”**  
   - **Odpowiedź**: QMS w IRIS ma automatyzować i domykać pętlę, nie mnożyć papieru.  
   - **Jak to robimy w IRIS**: auto-inspekcja po MES + proste PASS/FAIL + dowody.  
   - **Next step**: Jakie 3 kontrole jakości są krytyczne “na start”?

16. **“UR już ma swój system.”**  
   - **Odpowiedź**: IRIS może działać obok i integrować się; kluczowe to spójne KPI i egzekucja.  
   - **Jak to robimy w IRIS**: CMMS w IRIS lub integracja; tasks i dashboardy cross.  
   - **Next step**: Czy celem jest zastąpienie, czy ujednolicenie widoczności i działań?

17. **“Nie chcę ryzyka błędnych rekomendacji.”**  
   - **Odpowiedź**: rekomendacje są transparentne i zatwierdzane; zaczynamy od reguł i danych.  
   - **Jak to robimy w IRIS**: uzasadnienie rekomendacji + audyt + feature flags.  
   - **Next step**: Jaką tolerancję na ryzyko ma obszar pilota?

18. **“Nie mamy czasu na długie warsztaty.”**  
   - **Odpowiedź**: robimy krótkie, konkretne warsztaty pod decyzje i dane.  
   - **Jak to robimy w IRIS**: discovery 1–2 sesje + szybki baseline.  
   - **Next step**: Kto musi być na 60-min warsztacie, żeby podjąć decyzję?

19. **“To będzie kolejny projekt, który utknie w IT.”**  
   - **Odpowiedź**: governance jest operacyjne; IT jest konsultowane, a ownerem jest biznes/operacje.  
   - **Jak to robimy w IRIS**: RACI + szybki MVP + rytuały review.  
   - **Next step**: Kto po Waszej stronie będzie accountable za efekt operacyjny?

20. **“Nie chcę tracić kontroli nad priorytetami.”**  
   - **Odpowiedź**: priorytety są Wasze; IRIS tylko je materializuje i pilnuje egzekucji.  
   - **Jak to robimy w IRIS**: portfel inicjatyw + tasks + SLA + raporty.  
   - **Next step**: Jak dziś ustalacie priorytety i gdzie to się “rozjeżdża”?

---

## 4) Kierownik Produkcji — 20 obiekcji

1. **“To dodatkowa biurokracja i papierologia.”**  
   - **Odpowiedź**: celem jest mniej ręcznej roboty i szybki dostęp do statusu, nie więcej klików.  
   - **Jak to robimy w IRIS**: MES statusy + dashboardy + proste akcje start/complete.  
   - **Next step**: Co dziś zajmuje najwięcej czasu: raporty, koordynacja, awarie?

2. **“Moi ludzie będą się bać, że wyjdą słabe wyniki.”**  
   - **Odpowiedź**: mierzymy proces, nie ludzi; dane są po to, żeby usuwać przeszkody.  
   - **Jak to robimy w IRIS**: KPI procesowe + audyt zmian + jasne definicje.  
   - **Next step**: Które wskaźniki są dziś najbardziej “wrażliwe”?

3. **“Nie mamy czasu na wprowadzanie danych.”**  
   - **Odpowiedź**: minimalizujemy ręczne wpisy; integracje i importy robimy etapowo.  
   - **Jak to robimy w IRIS**: MVP danych + proste formularze + automatyzacje.  
   - **Next step**: Jakie dane już istnieją (Excel/ERP), które możemy importować?

4. **“W produkcji liczy się szybkość, nie system.”**  
   - **Odpowiedź**: IRIS skraca czas podejmowania decyzji i usuwa “szukanie informacji”.  
   - **Jak to robimy w IRIS**: cockpit zmiany + tasks + alerty.  
   - **Next step**: W jakich momentach najczęściej brakuje informacji?

5. **“Nie chcę, żeby IT wchodziło mi w proces.”**  
   - **Odpowiedź**: ownerem procesu jest produkcja; IT tylko zapewnia bezpieczeństwo i integracje.  
   - **Jak to robimy w IRIS**: RBAC i konfiguracja per rola; brak zależności od OT.  
   - **Next step**: Kto ma być ownerem MES w Waszej organizacji?

6. **“Mamy już MES (albo ERP) — po co drugi?”**  
   - **Odpowiedź**: możemy zacząć od egzekucji i KPI, a integracje zrobić kontraktowo.  
   - **Jak to robimy w IRIS**: API/eventy; IRIS jako warstwa operacyjna i inicjatyw.  
   - **Next step**: Czy chcecie zastąpić MES, czy usprawnić egzekucję i widoczność?

7. **“Nie chcę, żeby ktoś ‘z góry’ narzucał mi działania.”**  
   - **Odpowiedź**: zadania są uzgadniane w governance; IRIS tylko pilnuje SLA i statusów.  
   - **Jak to robimy w IRIS**: GEMBA_TASKS + priorytety + audyt.  
   - **Next step**: Jak dziś ustalacie działania po spotkaniach operacyjnych?

8. **“To będzie kolejna rzecz do sprawdzania.”**  
   - **Odpowiedź**: IRIS zastępuje kilka miejsc (Excel/mail/tablice) jednym cockpit’em.  
   - **Jak to robimy w IRIS**: MyTasks/Overdue + dashboard zmiany.  
   - **Next step**: Ile narzędzi używasz dziś, żeby mieć “pełny obraz” zmiany?

9. **“Nie chcę stałych kontroli jakości, bo spowalniają.”**  
   - **Odpowiedź**: kontrola jest tam, gdzie daje efekt; automatyzujemy tworzenie i raportowanie.  
   - **Jak to robimy w IRIS**: QMS auto-inspekcje po zakończeniu zlecenia (event-driven).  
   - **Next step**: Gdzie scrap jest największy i czemu?

10. **“Zlecenia i statusy u nas są ‘w głowie’ brygadzisty.”**  
   - **Odpowiedź**: to działa do pewnej skali; IRIS daje przewidywalność i transfer wiedzy.  
   - **Jak to robimy w IRIS**: MES lifecycle + historia + raporty.  
   - **Next step**: Ile zmian/gniazd zależy od jednej osoby-klucza?

11. **“Boję się, że KPI będą źle policzone.”**  
   - **Odpowiedź**: definicje KPI ustalamy wspólnie i wersjonujemy; system liczy konsekwentnie.  
   - **Jak to robimy w IRIS**: governance KPI + audyt definicji i zmian.  
   - **Next step**: Który KPI jest dla Ciebie najważniejszy w pilocie?

12. **“Nie chcę, żeby system był skomplikowany.”**  
   - **Odpowiedź**: startujemy od minimalnej ścieżki: create → start → complete + proste widoki.  
   - **Jak to robimy w IRIS**: MVP MES + role-based UI.  
   - **Next step**: Jakie 3 ekrany byłyby dla Ciebie “must-have”?

13. **“Na hali nie ma komputerów.”**  
   - **Odpowiedź**: IRIS działa w przeglądarce — można użyć tabletów/kiosków; zakres zależy od modelu pracy.  
   - **Jak to robimy w IRIS**: web UI + konfiguracje urządzeń (SETTINGS v1+).  
   - **Next step**: Czy preferujecie kioski na gniazdach czy raportowanie przez kierowników zmian?

14. **“Nie chcę, żeby to było tylko dla zarządu.”**  
   - **Odpowiedź**: wartość jest na dole procesu: tasks, statusy, szybkie decyzje; zarząd dostaje agregację.  
   - **Jak to robimy w IRIS**: widoki rolowe + operacyjne dashboardy.  
   - **Next step**: Która rola ma najwięcej ‘walki’ o informacje?

15. **“Ludzie będą obchodzić system.”**  
   - **Odpowiedź**: jeśli system daje korzyść (mniej pracy, szybciej), adopcja rośnie; pilotaż to weryfikuje.  
   - **Jak to robimy w IRIS**: szybkie ścieżki + minimum pól + “why” w KPI.  
   - **Next step**: Co ludzie omijają dziś i dlaczego (za trudne, za wolne, bez sensu)?

16. **“Nie chcę dodatkowych spotkań.”**  
   - **Odpowiedź**: IRIS skraca spotkania, bo dane i statusy są gotowe; spotkania robią decyzje.  
   - **Jak to robimy w IRIS**: cockpit + overdue + raporty.  
   - **Next step**: Które spotkanie jest dziś najmniej efektywne?

17. **“Boje się, że wdrożenie potrwa za długo.”**  
   - **Odpowiedź**: pierwsze value jest w 4–8 tygodni, jeśli skupimy się na jednym procesie.  
   - **Jak to robimy w IRIS**: MVP + iteracje + szybkie dashboardy.  
   - **Next step**: Jaki proces jest najlepszy na pilot bez integracji?

18. **“Nie mamy dobrych kodów produktów i danych.”**  
   - **Odpowiedź**: zaczynamy od minimalnego słownika; data stewarding robimy etapami.  
   - **Jak to robimy w IRIS**: importy + walidacje + słowniki.  
   - **Next step**: Jak wygląda dziś nazewnictwo produktów/gniazd — ERP czy Excel?

19. **“Przestoje wynikają z wielu rzeczy — system tego nie rozwiąże.”**  
   - **Odpowiedź**: system nie naprawi wszystkiego, ale pozwoli zidentyfikować top przyczyny i egzekwować działania.  
   - **Jak to robimy w IRIS**: top losses + tasks + KPI efektu.  
   - **Next step**: Jakie 3 przyczyny przestojów są najczęstsze?

20. **“Nie chcę raportów ‘dla raportów’.”**  
   - **Odpowiedź**: raport jest tylko po to, żeby uruchomić działanie i zmierzyć efekt.  
   - **Jak to robimy w IRIS**: raport → inicjatywa → task → KPI.  
   - **Next step**: Jakiego raportu brakuje dziś do podjęcia decyzji?

---

## 5) IT Manager — 20 obiekcji

1. **“Nie wpuszczę danych procesowych do chmury.”**  
   - **Odpowiedź**: są opcje Private Cloud lub On-Prem; SaaS tylko jeśli spełnia Wasze polityki.  
   - **Jak to robimy w IRIS**: wybór modelu hostingu + region danych + szyfrowanie + RBAC.  
   - **Next step**: Czy wymóg to “no cloud”, czy “cloud w UE i z kontrolami”?

2. **“Integracje obciążą mój zespół.”**  
   - **Odpowiedź**: zaczynamy bez integracji; potem tylko te, które dają największą wartość.  
   - **Jak to robimy w IRIS**: importy plikowe + kontraktowe API etapami.  
   - **Next step**: Jakie 2 integracje są krytyczne w roku 1?

3. **“Nie chcę kolejnego systemu użytkowników i haseł.”**  
   - **Odpowiedź**: SSO jest możliwe (SAML/OIDC) — a jeśli startujemy szybko, przechodzimy na SSO etapowo.  
   - **Jak to robimy w IRIS**: RBAC + mapowanie ról/grup.  
   - **Next step**: Jakie IdP macie: Azure AD/Okta/inne?

4. **“Multi-tenant to ryzyko mieszania danych.”**  
   - **Odpowiedź**: izolacja tenantów jest projektowana jako wymaganie nr 1 (tenantId enforcement + RBAC + audyt).  
   - **Jak to robimy w IRIS**: security-by-default, testy izolacji, możliwość hardening (RLS).  
   - **Next step**: Czy wymagacie RLS na poziomie DB, czy wystarczy app-level isolation?

5. **“Nie wiem, jak to monitorować i diagnozować.”**  
   - **Odpowiedź**: IRIS jest observability-first — logi, metryki, correlationId.  
   - **Jak to robimy w IRIS**: standard błędów + trace/correlation + p95 metryki endpointów.  
   - **Next step**: Jakie macie narzędzia: SIEM, APM, log stack?

6. **“Nie chcę ‘czarnej skrzynki’ AI.”**  
   - **Odpowiedź**: AI jest etapowe i transparentne; rekomendacje mają uzasadnienie i są zatwierdzane.  
   - **Jak to robimy w IRIS**: feature flags, audyt, uzasadnienie rekomendacji.  
   - **Next step**: Jakie rekomendacje mogą być tylko ‘advisory’, bez automatyzacji?

7. **“Nie przejdzie nam przez security review.”**  
   - **Odpowiedź**: dostarczamy pakiet bezpieczeństwa: architektura, kontrolki, polityki, testy.  
   - **Jak to robimy w IRIS**: szyfrowanie, RBAC, audit, retencja, DR, data residency.  
   - **Next step**: Jaki jest Wasz proces security review i ile trwa?

8. **“Mamy standardy API i naming — nie będziemy się uczyć nowych.”**  
   - **Odpowiedź**: IRIS jest contract-first; dopasowujemy kontrakty i wersjonowanie.  
   - **Jak to robimy w IRIS**: `/api/v5/<module>/...` + OpenAPI + przykład payloadów.  
   - **Next step**: Jakie macie standardy: OpenAPI, error format, correlation headers?

9. **“Nie chcę dostępu z internetu do systemów OT.”**  
   - **Odpowiedź**: integracje OT robimy jednostronnie i bezpiecznie (np. pull z DMZ), albo etapowo bez OT.  
   - **Jak to robimy w IRIS**: brak wymogu OT na start, a IoT ingest jest opcją.  
   - **Next step**: Jak wygląda Wasza strefa DMZ i polityka połączeń IT/OT?

10. **“Migracje danych to koszmar.”**  
   - **Odpowiedź**: nie robimy big migration; zaczynamy od minimalnego zestawu danych i rośniemy.  
   - **Jak to robimy w IRIS**: importy CSV/XLSX + walidacje + iteracje.  
   - **Next step**: Jakie 3 tabele/obszary danych są minimalne na start?

11. **“Nie chcę nadmiaru uprawnień i ryzyka błędów.”**  
   - **Odpowiedź**: RBAC jest wbudowany; role można ograniczyć do minimum.  
   - **Jak to robimy w IRIS**: permissions per moduł + audit write operations.  
   - **Next step**: Jakie role chcecie w MVP: tylko read, czy też write?

12. **“Nie chcę, żeby użytkownicy sami konfigurowali system.”**  
   - **Odpowiedź**: konfiguracje są kontrolowane RBAC i audytem; admin-only gdzie trzeba.  
   - **Jak to robimy w IRIS**: SETTINGS + RBAC `settings.write` + audit.  
   - **Next step**: Kto ma być adminem tenantowym po Waszej stronie?

13. **“Nie chcę przechowywania dokumentów procesowych w systemie.”**  
   - **Odpowiedź**: można ograniczyć storage i trzymać tylko linki; zależnie od polityk.  
   - **Jak to robimy w IRIS**: konfiguracja retencji i zakresu danych; RBAC.  
   - **Next step**: Czy polityka dopuszcza załączniki w chmurze, czy tylko referencje?

14. **“Boję się kosztów sieci i wydajności.”**  
   - **Odpowiedź**: web app nie generuje dużego ruchu; ciężkie dane można integrować etapowo.  
   - **Jak to robimy w IRIS**: caching, paginacja, observability p95.  
   - **Next step**: Ilu użytkowników jednocześnie i jakie ekrany są krytyczne?

15. **“Nie chcę zależności od node’owego świata.”**  
   - **Odpowiedź**: ważny jest kontrakt i utrzymanie; runtime jest zarządzany po stronie dostawcy (SaaS).  
   - **Jak to robimy w IRIS**: standardy release discipline, testy, observability.  
   - **Next step**: Które wymagania technologiczne są absolutne (DB, auth, hosting)?

16. **“Nie dam Wam dostępu do naszych systemów.”**  
   - **Odpowiedź**: nie potrzebujemy dostępu admin; integracje mogą być przez eksporty lub serwisowe konta o minimalnych uprawnieniach.  
   - **Jak to robimy w IRIS**: kontraktowe API, idempotency, auditing.  
   - **Next step**: Jaki model integracji preferujecie: file drop, API, read-only DB?

17. **“Nie chcę, żeby dane były użyte do trenowania modeli.”**  
   - **Odpowiedź**: dane klienta pozostają jego własnością; użycie danych jest definiowane w umowie.  
   - **Jak to robimy w IRIS**: izolacja tenantów + zapisy kontraktowe + kontrola dostępu.  
   - **Next step**: Czy macie standardową klauzulę “no training / no reuse”?

18. **“Nie chcę kolejnych uprawnień dla konsultantów zewnętrznych.”**  
   - **Odpowiedź**: dostęp jest opcjonalny, kontrolowany, ograniczony czasowo i audytowany.  
   - **Jak to robimy w IRIS**: RBAC + audit + role tymczasowe.  
   - **Next step**: Czy przewidujecie konsultantów i jaki zakres danych jest dopuszczalny?

19. **“Nie mam zasobów na utrzymanie on-prem.”**  
   - **Odpowiedź**: dlatego preferujemy SaaS; on-prem tylko gdy to konieczne i z jasnym RACI.  
   - **Jak to robimy w IRIS**: SLA/DR w SaaS; on-prem z runbookami i observability.  
   - **Next step**: Czy wymaganie on-prem wynika z polityki czy z obawy?

20. **“Nie chcę audytu wszystkiego — to obciąży system.”**  
   - **Odpowiedź**: audyt dotyczy głównie operacji write; jest kluczowy dla bezpieczeństwa i rozliczalności.  
   - **Jak to robimy w IRIS**: audit logging jako standard enterprise + optymalizacje storage.  
   - **Next step**: Jakie zdarzenia muszą być audytowane obligatoryjnie wg Waszych polityk?

---

## 6) DX Manager — 20 obiekcji

1. **“Mamy już roadmapę transformacji — po co IRIS?”**  
   - **Odpowiedź**: IRIS nie konkuruje z roadmapą — pomaga ją dowieźć (egzekucja + KPI + audyt).  
   - **Jak to robimy w IRIS**: inicjatywy→tasks→KPI + ślad decyzji.  
   - **Next step**: Które 3 inicjatywy z roadmapy mają największe ryzyko niedowożenia?

2. **“Nie chcę kolejnego narzędzia do zarządzania projektami.”**  
   - **Odpowiedź**: to nie PM tool; to operacyjna egzekucja w procesie (Gemba), nie Gantt dla IT.  
   - **Jak to robimy w IRIS**: tasks z SLA powiązane z procesem i KPI.  
   - **Next step**: Gdzie dziś inicjatywy ‘spadają’ między działami?

3. **“Obawiam się, że to nie pasuje do naszego stacku.”**  
   - **Odpowiedź**: IRIS jest contract-first i integruje się przez API/zdarzenia; stack klienta nie musi się zmieniać.  
   - **Jak to robimy w IRIS**: REST API + event envelope + eksporty.  
   - **Next step**: Jakie systemy są ‘core’ i nie do ruszenia?

4. **“Bez danych z IoT nie ma sensu.”**  
   - **Odpowiedź**: sens jest już przy danych procesowych i egzekucji; IoT zwiększa efekt, ale nie jest warunkiem startu.  
   - **Jak to robimy w IRIS**: MVP danych + tasks + KPI; IoT etapowo.  
   - **Next step**: Czy w pilocie chcecie fokus na egzekucję czy integracje?

5. **“Zarząd chce ‘AI’, a ja chcę stabilnych fundamentów.”**  
   - **Odpowiedź**: IRIS daje oba: fundamenty platformy i etapowe AI, które nie rozwala procesu.  
   - **Jak to robimy w IRIS**: core + modularność + feature flags dla AI.  
   - **Next step**: Jakie decyzje AI mają wspierać w roku 1?

6. **“Nie chcę shadow IT poza governance.”**  
   - **Odpowiedź**: IRIS jest enterprise (RBAC/audit/tenants) i wspiera governance, nie obchodzi go.  
   - **Jak to robimy w IRIS**: role, audyt, kontrakty, policy settings.  
   - **Next step**: Jakie są Wasze minimalne standardy governance?

7. **“Transformacja jest zbyt rozproszona, żeby ją spiąć.”**  
   - **Odpowiedź**: IRIS spina przez wspólny język KPI i egzekucję zadań, nawet jeśli źródła danych są różne.  
   - **Jak to robimy w IRIS**: cockpit + tasks + integracje etapowe.  
   - **Next step**: Które 2 obszary są dziś najbardziej rozproszone?

8. **“Nie chcę konfliktu z Lean.”**  
   - **Odpowiedź**: Lean i IRIS są komplementarne: IRIS dostarcza dane i egzekucję, Lean dostarcza metody.  
   - **Jak to robimy w IRIS**: Kaizen→task→KPI; standardy pracy i audit.  
   - **Next step**: Czy Lean ma dziś problem z domykaniem działań?

9. **“Nie chcę, żeby to był tylko ‘dashboard project’.”**  
   - **Odpowiedź**: dashboard jest startem, ale wartość jest w tasks i inicjatywach z benefit tracking.  
   - **Jak to robimy w IRIS**: inicjatywy + SLA + raport efektów.  
   - **Next step**: Jakie 2 decyzje mają być łatwiejsze po wdrożeniu?

10. **“Bez pełnej standaryzacji procesów nie da się.”**  
   - **Odpowiedź**: standaryzację robi się etapami; IRIS pomaga wykryć różnice i ustalić standardy.  
   - **Jak to robimy w IRIS**: settings hierarchiczne + governance + audyt.  
   - **Next step**: Co jest dziś największą różnicą między zakładami?

11. **“Boję się, że ludzie będą sabotować transformację.”**  
   - **Odpowiedź**: dlatego zaczynamy od quick wins z widoczną korzyścią dla operacji.  
   - **Jak to robimy w IRIS**: tasks, mniej raportów ręcznych, szybsza reakcja na problemy.  
   - **Next step**: Który problem najbardziej boli kierowników zmian?

12. **“Nie chcę przeciążać organizacji kolejnym programem.”**  
   - **Odpowiedź**: IRIS redukuje liczbę inicjatyw przez priorytetyzację i domykanie efektów.  
   - **Jak to robimy w IRIS**: portfel inicjatyw + KPI + SLA, nie “lista życzeń”.  
   - **Next step**: Ile inicjatyw jest dziś aktywnych i ile realnie dowozicie?

13. **“Nie chcę wielomiesięcznych analiz.”**  
   - **Odpowiedź**: assessment jest szybki i dowodowy; wynik to konkretne działania w systemie.  
   - **Jak to robimy w IRIS**: scoring + rekomendacje → inicjatywy → tasks.  
   - **Next step**: Czy wolicie assessment 1-dniowy (light) czy 2–3 tyg. (deep)?

14. **“Nie chcę konfliktu z IT security.”**  
   - **Odpowiedź**: IRIS jest projektowany pod security review; dostarczamy wymagane materiały.  
   - **Jak to robimy w IRIS**: RBAC, audit, szyfrowanie, region danych, DR/SLA.  
   - **Next step**: Kto w security musi być właścicielem akceptacji?

15. **“To się nie skaluje do wielu zakładów.”**  
   - **Odpowiedź**: IRIS jest multi-tenant SaaS, projektowany pod skalowanie i rollout falami.  
   - **Jak to robimy w IRIS**: modularność, szablony ustawień, governance.  
   - **Next step**: Ile zakładów ma być objętych w 12 miesięcy?

16. **“Nie chcę zmiany narzędzi w środku roku.”**  
   - **Odpowiedź**: pilot może działać równolegle i nie wymaga wyłączenia obecnych narzędzi.  
   - **Jak to robimy w IRIS**: MVP bez cutover, integracje później.  
   - **Next step**: Jaki jest najbezpieczniejszy okres na pilot (miesiąc/kwartał)?

17. **“Bez budżetu na integracje to nie przejdzie.”**  
   - **Odpowiedź**: większość quick wins jest bez integracji; integracje wybiera się po ROI.  
   - **Jak to robimy w IRIS**: importy + manual events + cockpit + tasks.  
   - **Next step**: Który quick win daje ROI bez integracji?

18. **“Nie chcę, żeby platforma była ‘monolitem’.”**  
   - **Odpowiedź**: to modularny monolit deploy (jeden runtime), ale moduły są logicznie separowane kontraktami i odpowiedzialnością.  
   - **Jak to robimy w IRIS**: kontrakty API per moduł, RBAC per moduł, event envelope.  
   - **Next step**: Czy Waszym wymogiem jest microservices, czy niezależność kontraktów i zespołów?

19. **“Nie chcę, żeby transformacja sprowadziła się do narzędzia.”**  
   - **Odpowiedź**: narzędzie to tylko część; IRIS daje system operacyjny do dowożenia zmiany.  
   - **Jak to robimy w IRIS**: RACI, governance, KPI, tasks.  
   - **Next step**: Jak wygląda dziś governance transformacji (rytuały, decyzje, ownerzy)?

20. **“Wolę rozwiązanie ‘best of breed’.”**  
   - **Odpowiedź**: IRIS może integrować best-of-breed, ale daje wspólny core i egzekucję, której zwykle brakuje.  
   - **Jak to robimy w IRIS**: API/eventy + cross-module cockpit + audit.  
   - **Next step**: Jakie best-of-breed narzędzia są nie do zastąpienia?

---

## 7) Lean Manager — 20 obiekcji

1. **“Technologia nie zastąpi zdrowego rozsądku Gemba.”**  
   - **Odpowiedź**: zgoda — IRIS ma wspierać Gemba, nie zastępować; daje dane i egzekucję.  
   - **Jak to robimy w IRIS**: tasks + SLA + link do obserwacji i KPI.  
   - **Next step**: Które działania Kaizen najczęściej nie są domykane?

2. **“Nie chcę, żeby to było ‘AI first’ bez zrozumienia procesu.”**  
   - **Odpowiedź**: startujemy od procesu, standardów i pomiaru; AI tylko wzmacnia, gdy dane są gotowe.  
   - **Jak to robimy w IRIS**: baseline KPI + standardy + etapowe DATA_AI.  
   - **Next step**: Jakie 2 marnotrawstwa są dziś największe?

3. **“Nie chcę kolejnej tablicy zadań.”**  
   - **Odpowiedź**: GEMBA_TASKS jest po to, żeby domykać działania i mierzyć efekt, nie tylko wizualizować.  
   - **Jak to robimy w IRIS**: SLA/overdue + powiązanie z KPI.  
   - **Next step**: Czy dziś macie SLA dla działań Kaizen?

4. **“Ludzie nie będą aktualizować statusów.”**  
   - **Odpowiedź**: statusy muszą być minimalne i użyteczne; inaczej system nie ma sensu — dlatego startujemy od prostego workflow.  
   - **Jak to robimy w IRIS**: start/complete + automatyczne przypomnienia.  
   - **Next step**: Który status jest realny w Waszej kulturze: 3 czy 5 stanów?

5. **“Nie chcę biurokracji w 5S/Kaizen.”**  
   - **Odpowiedź**: IRIS upraszcza: mniej papieru, więcej dowiezionych działań i efektów.  
   - **Jak to robimy w IRIS**: krótkie taski + checklisty + raport efektów.  
   - **Next step**: Jak dziś dokumentujecie działania i jak mierzycie efekt?

6. **“Nie chcę, żeby lean stał się ‘KPI policing’.”**  
   - **Odpowiedź**: KPI są po to, żeby usuwać przeszkody systemowe; nie do rozliczania ludzi.  
   - **Jak to robimy w IRIS**: KPI procesowe + governance + audit definicji.  
   - **Next step**: Które KPI są ‘uczciwe’, a które ‘toksyczne’?

7. **“Mamy VSM i mapy — po co system?”**  
   - **Odpowiedź**: mapy są świetne, ale bez egzekucji i mierników szybko się dezaktualizują.  
   - **Jak to robimy w IRIS**: inicjatywy z VSM → tasks → KPI trend.  
   - **Next step**: Który etap strumienia wartości ma największe straty?

8. **“Nie chcę utraty elastyczności na hali.”**  
   - **Odpowiedź**: standardy nie zabijają elastyczności — eliminują chaos; IRIS wspiera standardy tam, gdzie to ma sens.  
   - **Jak to robimy w IRIS**: konfigurowalne workflow i role.  
   - **Next step**: Co musi zostać elastyczne, a co może być standaryzowane?

9. **“To zastąpi spotkania i rozmowy?”**  
   - **Odpowiedź**: nie — IRIS ma sprawić, że spotkania będą krótsze i o decyzjach, nie o zbieraniu danych.  
   - **Jak to robimy w IRIS**: cockpit + statusy + overdue.  
   - **Next step**: Ile czasu tygodniowo idzie na ‘szukanie prawdy’?

10. **“Lean to kultura, nie software.”**  
   - **Odpowiedź**: zgoda; IRIS to narzędzie do utrzymania dyscypliny wykonania i mierzenia efektów.  
   - **Jak to robimy w IRIS**: tasks, governance, KPI, audyt.  
   - **Next step**: Co dziś najbardziej przeszkadza w utrzymaniu kultury ciągłego doskonalenia?

11. **“Nie chcę, żeby system był trudny dla brygadzistów.”**  
   - **Odpowiedź**: UI jest rolowe i proste; zaczynamy od minimalnych ekranów.  
   - **Jak to robimy w IRIS**: role-based menu + proste akcje + MyTasks.  
   - **Next step**: Kto ma być pierwszą grupą pilotażową?

12. **“Nie chcę konfliktu z CMMS/ERP.”**  
   - **Odpowiedź**: IRIS może integrować się i nie wymaga zastępowania; ważne jest domknięcie działań.  
   - **Jak to robimy w IRIS**: linki task↔work order↔KPI.  
   - **Next step**: Czy Waszym problemem jest system, czy egzekucja i przepływ informacji?

13. **“Nie chcę, żeby ktoś ‘produkował’ zadania bez sensu.”**  
   - **Odpowiedź**: governance i priorytetyzacja ograniczają ‘task spam’; zadania muszą mieć ownera i powód.  
   - **Jak to robimy w IRIS**: priorytety + SLA + audyt.  
   - **Next step**: Kto zatwierdza zadania Kaizen dziś?

14. **“Nie chcę nadmiaru danych — ludzie się pogubią.”**  
   - **Odpowiedź**: pokazujemy tylko KPI i widoki potrzebne danej roli; reszta jest w tle.  
   - **Jak to robimy w IRIS**: role-based dashboards + filtrowanie.  
   - **Next step**: Jakie 5 metryk wystarczy do zarządzania obszarem?

15. **“Nie chcę ‘digital theatre’ — udawania transformacji.”**  
   - **Odpowiedź**: dlatego IRIS rozlicza efekt: KPI, tasks, audyt; nie da się ‘udawać’.  
   - **Jak to robimy w IRIS**: benefit tracking + overdue + ślad decyzji.  
   - **Next step**: Jak rozpoznacie, że pilot jest sukcesem?

16. **“Lean woli proste narzędzia (tablica, marker).”**  
   - **Odpowiedź**: proste jest dobre, dopóki skala nie powoduje chaosu; IRIS jest ‘tablicą’, która pamięta i liczy efekt.  
   - **Jak to robimy w IRIS**: tasks + historia + KPI trend.  
   - **Next step**: Kiedy tablice przestają działać u Was (skala, rotacja, wiele zmian)?

17. **“Nie chcę dodatkowych audytów.”**  
   - **Odpowiedź**: audit w IRIS dotyczy zmian w systemie i jest ochroną przed chaosem, nie ‘kontrolą dla kontroli’.  
   - **Jak to robimy w IRIS**: audit trail dla write operations i decyzji.  
   - **Next step**: Czy macie wymogi audytowe od klientów/ISO?

18. **“Nie chcę, żeby lean był zależny od IT.”**  
   - **Odpowiedź**: start jest bez integracji; IT jest tylko w tle dla bezpieczeństwa i dostępu.  
   - **Jak to robimy w IRIS**: SaaS + web app + proste wdrożenie.  
   - **Next step**: Czy możemy zacząć od 1 obszaru i 10–20 użytkowników?

19. **“Nie chcę, żeby KPI były liczone ‘z góry’.”**  
   - **Odpowiedź**: KPI definiujemy wspólnie; IRIS tylko zapewnia konsekwentne liczenie i wersjonowanie.  
   - **Jak to robimy w IRIS**: governance KPI + audyt definicji.  
   - **Next step**: Który KPI budzi największe spory i czemu?

20. **“To nie pomoże w eliminacji marnotrawstwa.”**  
   - **Odpowiedź**: pomoże, jeśli marnotrawstwo jest mierzone i ma działania; IRIS łączy oba elementy.  
   - **Jak to robimy w IRIS**: top losses → inicjatywy → tasks → KPI.  
   - **Next step**: Jakie 3 marnotrawstwa chcecie uderzyć w Q2/Q3?

---

## 8) Kierownik Działu Zakupów — 20 obiekcji

1. **“To za drogie w porównaniu do darmowych narzędzi.”**  
   - **Odpowiedź**: darmowe narzędzia nie dają RBAC/audytu/egzekucji i zwykle generują ukryty TCO.  
   - **Jak to robimy w IRIS**: enterprise security + SLA + benefit tracking + support.  
   - **Next step**: Co jest dziś największym kosztem ukrytym (czas ludzi, błędy, przestoje)?

2. **“Nie wiem, czy dostawca (DBR77) jest stabilny.”**  
   - **Odpowiedź**: minimalizujemy ryzyko przez kontrakty, SLA i przenoszalność danych.  
   - **Jak to robimy w IRIS**: eksporty, API, dokumentacja, audyt i runbooki.  
   - **Next step**: Jakie macie standardowe wymagania vendor risk?

3. **“Nie chcę długich umów bez możliwości wyjścia.”**  
   - **Odpowiedź**: można zacząć od pilota i krótszych okresów; warunki są negocjowalne.  
   - **Jak to robimy w IRIS**: proof-of-value + etapowanie zakresu.  
   - **Next step**: Jaki okres wypowiedzenia jest dla Was standardem?

4. **“Nie chcę niejasnego SLA.”**  
   - **Odpowiedź**: SLA definiujemy jawnie (dostępność, czasy reakcji, DR).  
   - **Jak to robimy w IRIS**: monitoring, on-call, RPO/RTO, okna serwisowe.  
   - **Next step**: Czy wymagacie 99.5, 99.9 czy 99.95?

5. **“Nie chcę kosztów wdrożenia poza kontrolą.”**  
   - **Odpowiedź**: wdrożenie jest fazowane i ma deliverables; integracje są opcjonalne.  
   - **Jak to robimy w IRIS**: zakres MVP + RACI + plan fal.  
   - **Next step**: Czy w pilocie dopuszczacie brak integracji?

6. **“Nie chcę płacić za użytkowników, którzy tylko ‘czytają’.”**  
   - **Odpowiedź**: model licencyjny może rozróżniać role (read vs write) zależnie od pakietu.  
   - **Jak to robimy w IRIS**: RBAC i role-based access, łatwe rozdzielenie typów użytkowników.  
   - **Next step**: Ile osób będzie aktywnie wykonywać zadania, a ile tylko oglądać KPI?

7. **“Obawiam się ukrytych opłat za integracje.”**  
   - **Odpowiedź**: integracje wyceniamy per kontrakt i etap; możesz je odłożyć.  
   - **Jak to robimy w IRIS**: contract-first API + priorytetyzacja integracji wg ROI.  
   - **Next step**: Która integracja daje największą wartość biznesową?

8. **“Nie chcę kolejnego dostawcy chmurowego.”**  
   - **Odpowiedź**: można wybrać region i model wdrożenia; w enterprise możliwy private cloud.  
   - **Jak to robimy w IRIS**: AWS/Azure lub środowisko klienta (uzgodnione).  
   - **Next step**: Jaka polityka chmury obowiązuje w Waszej organizacji?

9. **“Nie chcę ryzyka prawnego i DPA.”**  
   - **Odpowiedź**: DPA/NDA i zasady IP są standardem; dopasowujemy do Waszych wzorców.  
   - **Jak to robimy w IRIS**: własność danych klienta + portability + retencja/usunięcie.  
   - **Next step**: Czy macie własny wzór DPA/NDA?

10. **“Jak wygląda wsparcie techniczne i serwis?”**  
   - **Odpowiedź**: wsparcie jest częścią SLA; czasy reakcji zależą od pakietu.  
   - **Jak to robimy w IRIS**: runbooki, monitoring, eskalacje, on-call (dla premium/enterprise).  
   - **Next step**: Jakie godziny wsparcia są wymagane (8/5 czy 24/7)?

11. **“Nie chcę płacić za ‘funkcje w roadmapie’.”**  
   - **Odpowiedź**: umowa dotyczy tego, co wdrażamy w Twoim zakresie; roadmapa to opcja rozwoju.  
   - **Jak to robimy w IRIS**: SOW z deliverables i akceptacją; MVP boundaries.  
   - **Next step**: Jakie funkcje są must-have w MVP?

12. **“Boje się, że użytkownicy nie przyjmą narzędzia.”**  
   - **Odpowiedź**: dlatego pilotaż z mierzalnym efektem i małą grupą użytkowników jest standardem.  
   - **Jak to robimy w IRIS**: role-based UI + quick wins + szkolenia pod role.  
   - **Next step**: Która grupa ma być pierwsza (10–20 osób)?

13. **“Chcę porównać z innymi narzędziami.”**  
   - **Odpowiedź**: porównujcie po efektach: egzekucja, audit, multi-tenancy, integracje kontraktowe.  
   - **Jak to robimy w IRIS**: modularny monolit, RBAC, audit, SLA/DR, API.  
   - **Next step**: Jakie 5 kryteriów jest w Waszej macierzy wyboru?

14. **“Nie chcę płacić z góry.”**  
   - **Odpowiedź**: można rozbić na fazy (pilot → rollout); płatność powiązana z deliverables.  
   - **Jak to robimy w IRIS**: etapowanie i akceptacje w SOW.  
   - **Next step**: Jaki model płatności preferujecie (miesięczny/kwartalny/fazowy)?

15. **“Nie chcę długiego wdrożenia.”**  
   - **Odpowiedź**: pilot jest krótki i ma deliverables; rollout zależy od skali.  
   - **Jak to robimy w IRIS**: 4–8 tyg. proof-of-value.  
   - **Next step**: Kiedy potrzebujecie pierwszego efektu i w jakim obszarze?

16. **“Nie chcę ryzyka przerw w dostępności.”**  
   - **Odpowiedź**: SLA i DR są uzgadniane; można dobrać pakiet do krytyczności.  
   - **Jak to robimy w IRIS**: monitoring, backupy, RPO/RTO, okna serwisowe.  
   - **Next step**: Jak krytyczny jest system: informacyjny czy operacyjny?

17. **“Nie chcę niekontrolowanego wzrostu scope.”**  
   - **Odpowiedź**: zakres jest broniony przez MVP boundaries i zarządzanie zmianą.  
   - **Jak to robimy w IRIS**: kontrakty, DoD, backlog falami.  
   - **Next step**: Kto po Waszej stronie zatwierdza change requesty?

18. **“Nie chcę kosztów szkoleń i onboardingu.”**  
   - **Odpowiedź**: szkolenia są krótkie i rolami; w praktyce oszczędzają czas przez mniejsze raportowanie ręczne.  
   - **Jak to robimy w IRIS**: role-based UX + gotowe scenariusze.  
   - **Next step**: Czy wolicie szkolenia zdalne czy na miejscu?

19. **“Nie chcę problemów z RODO.”**  
   - **Odpowiedź**: zakres danych osobowych jest minimalizowany; DPA i kontrola dostępu są standardem.  
   - **Jak to robimy w IRIS**: RBAC, audyt, retencja, data residency.  
   - **Next step**: Czy IRIS ma przetwarzać dane osobowe poza kontami użytkowników?

20. **“Nie chcę, żebyście ‘sprzedali’ nasz case study.”**  
   - **Odpowiedź**: publikacje case studies tylko za zgodą; standardem jest anonimizacja lub brak publikacji.  
   - **Jak to robimy w IRIS**: zapisy w umowie + kontrola materiałów marketingowych.  
   - **Next step**: Czy dopuszczacie anonimizowane case’y, czy całkowity zakaz?

