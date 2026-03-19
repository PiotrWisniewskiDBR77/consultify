## Katalog problemów i rozwiązań (Pain Points)

### Kluczowe problemy biznesowe rozwiązywane przez Digital Twin

1. **Inwestowanie bez symulacji** – decyzje CAPEX podejmowane na podstawie szacunków, bez weryfikacji wpływu na przepustowość i OEE.
2. **Ryzyko błędnych decyzji CAPEX** – inwestycje w niewłaściwe obszary (np. maszyna niebędąca faktycznym wąskim gardłem).
3. **Brak przejrzystości przepływów** – zarząd nie widzi realnych ścieżek materiałowych, kolejek i zatorów.
4. **Ukryte wąskie gardła** – ograniczenia ujawniają się dopiero po wdrożeniu inwestycji lub przy wzroście popytu.
5. **Brak obiektywnego modelu decyzyjnego** – decyzje oparte są na opinii najbardziej wpływowych osób, a nie na danych.
6. **Trudność w uzasadnieniu ROI** – brak twardych, liczbowych argumentów dla komitetu inwestycyjnego.
7. **Fragmentaryczność danych** – dane o procesach są rozproszone między ERP, MES, Excelami, głowami pracowników.
8. **Brak spójnego „single source of truth” o procesach** – różne działy operują na innych wersjach prawdy o przepływach i zasobach.
9. **Długotrwałe analizy CAPEX** – przygotowanie wariantów i policzenie skutków trwa tygodnie lub miesiące.
10. **Ograniczona możliwość testowania wielu scenariuszy** – manualne modelowanie wariantów jest zbyt czasochłonne.
11. **Niewidoczne skutki uboczne inwestycji** – usunięcie jednego wąskiego gardła ujawnia kolejne, nieprzewidziane wcześniej.
12. **Niedopasowanie layoutu do realnych przepływów** – drogi transportu są nieefektywne, generują zbędne przemieszczenia i WIP.
13. **Niska elastyczność przy zmianach miksu produktowego** – zakład ma trudność z szybkim dostosowaniem się do nowych wymagań klientów.
14. **Zbyt wysokie poziomy zapasu i WIP** – kapitał zamrożony w produkcji w toku bez jasnego uzasadnienia.
15. **Brak szybkiej odpowiedzi „co się stanie, jeśli...”** – każda większa zmiana wymaga długiej analizy ad hoc.
16. **Ryzyko przewymiarowania inwestycji** – kupowane są zbyt duże linie/maszyny „na wszelki wypadek”.
17. **Ryzyko niedowymiarowania inwestycji** – zbyt małe inwestycje, które nie rozwiązują kluczowych problemów przepustowości.
18. **Konflikty między działami** (Produkcja, Logistyka, Sprzedaż, Finanse) – brak wspólnego języka i uzgodnionego modelu.
19. **Brak symulacji wpływu awarii i przestojów** – planowanie zakłada idealne warunki, co kończy się rozjazdem z rzeczywistością.
20. **Trudność w skalowaniu produkcji** – brak pewności, czy zakład obsłuży planowany wzrost popytu przy danej infrastrukturze i załodze.
21. **Skrócenie serii produkcyjnych i personalizacja rynku** – produkcja na zamówienie i zmienny miks produktowy utrudniają stosowanie tradycyjnych metod Lean (np. VSM dla jednego reprezentatywnego produktu).
22. **Gospodarka niedoborów i niestabilność łańcucha dostaw** – brak przewidywalności dostaw materiałów i komponentów wymusza nowe metody zarządzania zapasami i planowania.
23. **Brak ludzi do pracy i wysoka rotacja** – demografia i postindustrialna gospodarka redukują dostępność siły roboczej na liniach produkcyjnych.
24. **Postoje na stanowisku z powodu braku materiału** – najczęstsza przyczyna obniżenia efektywności pracy w wielu zakładach (wg obserwacji DBR77).

---

### Jak Digital Twin adresuje powyższe problemy

- **Obiektywny model procesu** – jeden, zweryfikowany model zakładu, akceptowany przez wszystkie kluczowe działy.
- **Symulacje „co-jeśli”** – możliwość sprawdzenia skutków planowanych inwestycji i zmian organizacyjnych przed ich wdrożeniem.
- **Szybkie tworzenie wariantów** – zmiana layoutu, parku maszynowego, obsady i parametrów pracy w środowisku wirtualnym w ciągu godzin, a nie tygodni.
- **Identyfikacja realnych wąskich gardeł** – ranking ograniczeń na podstawie wyników symulacji, a nie subiektywnych opinii.
- **Kalkulacja ROI i okresu zwrotu** – modelowanie efektów finansowych wynikających z poprawy przepustowości, OEE i redukcji WIP.
- **Transparentna komunikacja** – wspólny model i wizualizacje ułatwiają dyskusję między produkcją, finansami, zarządem.
- **Algorytmiczne wsparcie Lean 4.0** – automatyzacja identyfikacji strat, VSM digitalny, balansowanie linii i optymalizacja intralogistyki (Milkrun + Kanban) z uwzględnieniem zmienności.
- **Przewidywalność w warunkach zmienności** – symulacje z odchyleniami historycznymi pozwalają planować przy zmiennym planie sprzedaży, brakach materiałowych i rotacji kadr.

---

### Priorytetyzacja problemów według wartości biznesowej

#### Wysoki priorytet (największy wpływ na P&L i ryzyko)

1. **Ryzyko błędnych decyzji CAPEX** (2)  
2. **Inwestowanie bez symulacji** (1)  
3. **Trudność w uzasadnieniu ROI** (6)  
4. **Ukryte wąskie gardła** (4)  
5. **Niewidoczne skutki uboczne inwestycji** (11)  
6. **Ryzyko przewymiarowania / niedowymiarowania** (16, 17)  

#### Średni priorytet (istotne, ale często wtórne wobec powyższych)

7. **Brak przejrzystości przepływów** (3)  
8. **Brak obiektywnego modelu decyzyjnego** (5)  
9. **Długotrwałe analizy CAPEX** (9)  
10. **Ograniczona możliwość testowania scenariuszy** (10)  
11. **Zbyt wysokie poziomy zapasu i WIP** (14)  
12. **Trudność w skalowaniu produkcji** (20)  

#### Niższy priorytet (ważne operacyjnie, ale często wynikające z powyższych)

13. **Fragmentaryczność danych** (7)  
14. **Brak „single source of truth”** (8)  
15. **Niedopasowanie layoutu** (12)  
16. **Niska elastyczność przy zmianach miksu** (13)  
17. **Brak symulacji wpływu awarii** (19)  
18. **Brak szybkiej odpowiedzi „co się stanie, jeśli...”** (15)  
19. **Konflikty między działami** (18)  
20. **Rozjazd planów z rzeczywistością** (połączenie 13, 19, 20)  

