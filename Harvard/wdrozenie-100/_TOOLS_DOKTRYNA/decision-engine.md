# Narzędzie: Decision Engine (analiza jakości decyzji)

> Rama źródłowa: Decision Quality Chain — Strategic Decisions Group (SDG, Ron Howard/Carl Spetzler,
> lata 80. Stanford Decision Analysis) + korpus McKinsey o debiasingu decyzji zarządczych.
> To NIE jest narzędzie do "zbierania opinii" — to narzędzie do **testowania decyzji na pęknięcie**
> zanim padnie i zanim kosztuje.

---

## 1. Cel

Ustrukturyzować ważną decyzję strategiczną tak, żeby:
- ujawnić i zneutralizować typowe biasy poznawcze (potwierdzenia, zakotwiczenia, eskalacji
  zaangażowania, nadmiernej pewności),
- rozbić fałszywe binarności ("tak/nie", "A czy B") na realny zestaw alternatyw,
- oddzielić **fakty i niepewność** od **wartości i preferencji** — te dwa porządki nieustannie się
  mieszają w dyskusjach zarządów i to jest źródło większości słabych decyzji,
- wygenerować rekomendację, która jest nie tylko trafna analitycznie, ale **wykonalna** —
  ma właściciela, zasoby i realne zaangażowanie zespołu, który ją wdroży.

Efekt końcowy nie jest "raportem o decyzji" — jest **testem szóstego ogniwa**: czy ta decyzja,
jeśli ją podejmiemy, faktycznie się wydarzy w organizacji, czy utknie w wykonaniu.

## 2. Kiedy używać

Decision Engine włącza się, gdy spełniony jest przynajmniej jeden warunek:
- **Wysoka stawka** — decyzja wiąże istotny kapitał, czas kierownictwa lub reputację (np. wejście
  na nowy rynek, restrukturyzacja, duża inwestycja, zmiana modelu biznesowego).
- **Wysoka nieodwracalność** — trudno/kosztowno się wycofać po fakcie (fuzja, zwolnienie kluczowego
  zespołu, zamknięcie linii produktowej, wieloletni kontrakt).
- **Wysoka niepewność** — dane są niepełne, prognozy rozjeżdżają się, przyszłość zależy od czynników
  poza kontrolą organizacji (popyt, regulacje, konkurencja).
- **Spór w zespole** — kierownictwo jest podzielone, dyskusja kręci się w kółko, każda strona ma
  "swoje dane" (to jest sygnał confirmation bias, nie brak informacji).
- **Decyzja przez inercję** — organizacja "jakoś" zmierza w jedną stronę bez świadomego aktu wyboru
  (najgroźniejszy przypadek — nikt formalnie nie zdecydował, ale zasoby już płyną).

Nie używać do decyzji rutynowych, odwracalnych, niskiej stawki — tam formalizm Decision Quality
jest przeciążeniem procesu (young Bezos: "decyzje jednodrzwiowe" vs "dwudrzwiowe" — to narzędzie
jest do dwudrzwiowych, gdzie drzwi się nie otwierają z powrotem).

## 3. Inputy

Zanim silnik zacznie generować analizę, potrzebuje od użytkownika (lub musi je wydobyć z rozmowy/
dokumentów wejściowych):

1. **Ramowanie problemu (frame)** — jakie jest właściwe pytanie decyzyjne? Kto jest decydentem?
   Jaki jest horyzont czasowy i zakres (co jest "w grze", a co poza)?
2. **Alternatywy** — zestaw opcji **MECE** (rozłącznych i wyczerpujących), minimum 3. Jeśli
   użytkownik przynosi tylko 2 opcje ("robić X czy nie robić X"), narzędzie ma obowiązek
   wygenerować przynajmniej jedną trzecią, hybrydową lub odroczoną opcję — żeby przetestować,
   czy problem nie jest fałszywą binarnością.
3. **Kryteria / wartości** — na czym decydentowi naprawdę zależy (wzrost, ryzyko, czas do efektu,
   koszt reputacyjny, zgodność ze strategią, morale zespołu) i ich względna waga.
4. **Informacje i niepewności** — co wiadomo na pewno, co jest szacunkiem, co jest czystą
   niewiadomą. Dla kluczowych niewiadomych: zakres (niski/bazowy/wysoki), nie punktowa liczba.
5. **Założenia** — ukryte przesłanki, na których stoi każda alternatywa (np. "zakładamy, że
   konkurent nie zareaguje przez 12 miesięcy") — muszą być nazwane wprost, bo to one najczęściej
   przewracają rekomendację.

## 4. Metoda

### 4.1 Sześć ogniw Decision Quality (SDG)

Rama traktuje decyzję jako **łańcuch** — jest tak dobra, jak jej najsłabsze ogniwo:

1. **Odpowiednia rama (frame)** — właściwe pytanie, właściwy zakres, właściwe perspektywy przy
   stole. Błąd tu unieważnia wszystko poniżej (dobra odpowiedź na złe pytanie).
2. **Kreatywne, wykonalne alternatywy** — prawdziwe opcje, nie fałszywa binarność ani "słomiana
   opcja" wstawiona tylko po to, by przegrać z faworytem.
3. **Znaczące, wiarygodne informacje** — fakty, niepewności i ich zakresy — nie pojedyncze liczby
   udające pewność.
4. **Jasne wartości i trade-offy** — czym decydent gotów jest zapłacić za co (ryzyko za wzrost,
   czas za pewność) — jawnie, nie domyślnie.
5. **Solidne rozumowanie** — poprawna logika łącząca 2-4 w rekomendację (drzewo decyzyjne, macierz,
   oczekiwana wartość) — bez skrótów myślowych.
6. **Zaangażowanie do działania (commitment)** — czy ci, którzy będą wdrażać, naprawdę się zgadzają
   i mają zasoby, czy tylko "zgodzili się w sali", a wrócą do starych nawyków.

### 4.2 Narzędzia analityczne

- **Macierz alternatywy × kryteria** — punktacja ważona; ujawnia, która opcja wygrywa przy jakim
  zestawie wag (nie jedna "słuszna" waga, tylko rozkład).
- **Drzewo decyzyjne** — dla decyzji sekwencyjnych/warunkowych (jeśli zdarzenie A, to opcja B) —
  z prawdopodobieństwami i wartościami oczekiwanymi w węzłach.
- **Analiza wrażliwości / tornado diagram** — dla każdej kluczowej niepewności: o ile zmienia się
  wynik, gdy zmienna idzie z low do high przy stałych pozostałych. Ranking zmiennych wg rozpiętości
  wpływu (największy "pas" na górze wykresu = to, co naprawdę determinuje decyzję).
- **Pre-mortem** (Gary Klein, uznany przez Kahnemana za jedną z najskuteczniejszych technik
  debiasingu): zespół zakłada, że decyzja **już** zawiodła za 12 miesięcy, i pisze wstecz, dlaczego.
  Przesunięcie z trybu warunkowego ("co może pójść źle") na dokonany ("dlaczego już poszło źle")
  odblokowuje ~30% więcej trafnych zastrzeżeń niż standardowy przegląd ryzyka — bo omija optymizm
  organizacyjny i pozwala bez utraty twarzy powiedzieć rzeczy, których nikt nie powie wprost w sali.
- **Typologia biasów do aktywnego wypatrywania**:
  - *Potwierdzenia* — przeważanie danych zgodnych z tym, co i tak już chcieliśmy zrobić.
  - *Zakotwiczenia* — pierwsza liczba na stole (budżet z zeszłego roku, propozycja szefa) zniekształca
    cały późniejszy zakres dyskusji.
  - *Eskalacji zaangażowania* — dokładanie zasobów do decyzji, bo już w nią zainwestowaliśmy
    (sunk cost), a nie dlatego, że dziś jest to najlepsza opcja.
  - *Nadmiernej pewności* — szacunki punktowe zamiast zakresów; brak testu "co musiałoby być
    prawdą, żeby to się nie udało".
  - Techniki przeciwdziałania z korpusu McKinsey: *devil's advocate*, *red team/blue team*,
    checklisty procesowe, *outside view* (klasa referencyjna podobnych decyzji/projektów zamiast
    wyłącznie wewnętrznej prognozy).

## 5. Jak się wnioskuje

- **Ważenie kryteriów**: wagi nie są ustalane arbitralnie przez silnik — są wydobywane z
  wypowiedzi decydenta (co wymienia jako pierwsze, co obrania najdłużej, gdzie jest gotów ustąpić).
  Jeśli wagi są sporne w zespole, narzędzie **nie uśrednia po cichu** — pokazuje rekomendację przy
  2-3 różnych profilach wag, żeby ujawnić, czy spór jest o fakty czy o wartości (to często dwa różne
  spory pomylone w jeden).
- **Czytanie wrażliwości**: rekomendacja jest "solidna", jeśli wygrywa w całym rozsądnym zakresie
  kluczowych niepewności. Jest "krucha", jeśli zmienia się przy realistycznym ruchu jednej zmiennej —
  to jest dokładnie ta zmienna, którą trzeba domierzyć/przetestować PRZED decyzją, a nie po niej.
  Zmienna, która przełącza rekomendację, to prawdziwy "decision driver" — reszta analizy wokół niej
  jest często kosmetyką.
- **Kiedy decyzja jest "gotowa"**: gdy wszystkie sześć ogniw są solidne LUB świadomie zaakceptowane
  jako słabe (np. "informacja jest niepełna, ale czekanie kosztuje więcej niż błąd") — nie gdy
  "przedyskutowaliśmy wystarczająco długo". Czas dyskusji nie jest proxy jakości.
- **Rozpoznanie fałszywej binarności**: sygnał ostrzegawczy — gdy na stole są tylko 2 opcje i jedna
  z nich jest oczywistym "status quo, które nikomu się nie podoba" (słomiany człowiek), to nie jest
  prawdziwy wybór, tylko rytualne zatwierdzenie preferowanej opcji. Test: czy istnieje wersja
  hybrydowa, odroczona w czasie, lub ograniczona pilotażowo, której nikt nie rozważył?

## 6. Insighty — rdzeń narzędzia

To jest właściwy produkt Decision Engine. Nie tabela z wagami — **zdania**, które zmieniają sposób,
w jaki organizacja myśli o wyborze. Wzorce insightów, jakie silnik ma aktywnie poszukiwać i
formułować:

- **Ujawnienie prawdziwego trade-offu.** Zespół dyskutuje "czy X", ale realny spór to "X vs Y"
  (np. pozornie debata o wejściu na nowy rynek jest naprawdę debatą "szybkość vs kontrola jakości") —
  nazwanie tego kończy jałowe rundy dyskusji, bo ludzie zaczynają mówić o tym samym.
- **Punkt odwrócenia rekomendacji.** "Rekomendacja X jest słuszna, chyba że założenie Z (np. tempo
  reakcji konkurencji, dostępność talentu) jest błędne — wtedy wygrywa Y." To zamienia decyzję
  jednorazową w **decyzję warunkową z checkpointem** — dużo bezpieczniejszą niż twarde postawienie
  na jedną kartę.
- **To nie jest decyzja 0-1, to sekwencja opcji.** Często "wielka decyzja" rozpada się na: mały,
  tani krok diagnostyczny teraz + właściwa decyzja odroczona do momentu, gdy kluczowa niepewność
  się rozstrzygnie (opcja realna / real option). Insight: "nie musisz dziś wybierać A czy B — możesz
  kupić informację za ułamek kosztu i wybrać za 60 dni".
- **Ukryte kryterium.** Zespół deklaruje kryteria formalne (ROI, ryzyko), ale rzeczywiste wybory w
  dyskusji zdradzają inne, niewypowiedziane kryterium (np. unikanie porażki widocznej publicznie,
  lojalność wobec autora poprzedniej decyzji). Nazwanie tego wprost jest często najbardziej
  wartościowym momentem całej sesji — bo dopiero wtedy dyskusja przestaje kręcić się w kółko.
- **Diagnoza, które ogniwo jest słabe.** Nie "decyzja jest zła", tylko precyzyjnie: "ramowanie jest
  OK, alternatywy OK, ale ogniwo 6 (commitment) jest puste — nikt z linii operacyjnej nie był przy
  stole, więc to i tak nie zostanie wykonane". To zmienia następny krok z "przemyśl jeszcze raz" na
  konkretne działanie naprawcze.
- **Fałszywy spór o fakty, prawdziwy spór o wartości** — gdy analiza pokazuje, że obie strony sporu
  patrzą na te same dane, ale różnią się tolerancją ryzyka lub horyzontem czasowym — to nie
  potrzebuje więcej danych, potrzebuje jawnej rozmowy o wartościach.
- **Efekt transformacyjny w organizacji**: powtarzalne stosowanie tej ramy uczy zespół zadawać
  pytanie "które ogniwo jest tu najsłabsze?" zamiast "kto ma rację" — to przesuwa kulturę decyzyjną
  z political/anecdotal na disciplined, i to jest miara sukcesu narzędzia w czasie (mniej odwróconych
  decyzji, mniej "zombie-projektów" ciągniętych przez eskalację zaangażowania).

## 7. Worked example

**Sytuacja**: firma B2B SaaS (60 osób) rozważa: czy uruchomić lokalny oddział sprzedaży w Niemczech.

**Frame**: pytanie postawione jako "czy wejść do Niemiec w Q3" — silnik przeramowuje na: "jak
najlepiej przyspieszyć wzrost przychodu z DACH w ciągu 18 miesięcy, przy ograniczonym kapitale
na ekspansję" (szersza rama ujawnia, że "oddział w Niemczech" to jedna z kilku opcji, nie jedyna).

**Alternatywy (MECE, wygenerowane 4, nie 2)**:
A. Pełny lokalny oddział (biuro, zespół sprzedaży, prawny byt) — wysoki koszt, wysoka kontrola.
B. Partner/reseller lokalny — niski koszt, niska kontrola, szybki start.
C. Zdalny zespół sprzedaży (bez biura) celujący w DACH z istniejącej centrali — średni koszt,
   test rynku bez zaangażowania nieodwracalnego.
D. Odroczenie 6 miesięcy + pilotaż z 2 klientami referencyjnymi przez obecny zespół, decyzja o
   skali później (opcja realna).

**Kryteria i wagi** (wydobyte z rozmowy z zarządem): tempo wzrostu przychodu (35%), ryzyko
kapitałowe (30%), zgodność ze strategią produktową (20%), wpływ na morale istniejącego zespołu (15%).

**Kluczowe niepewności**: (1) czy niemieccy klienci B2B kupują SaaS bez lokalnej obecności prawnej —
zakres: tak w 70% przypadków / niepewne / wymagane w regulowanych branżach; (2) tempo reakcji
głównego konkurenta (już ma biuro w Monachium).

**Analiza wrażliwości**: opcja A (pełny oddział) wygrywa tylko jeśli tempo wzrostu jest ważone
>45% I konkurent nie zareaguje cenowo w 12 miesięcy. Poza tym zakresem wygrywa C lub D.
→ **Tornado**: zmienna "reakcja cenowa konkurenta" ma największy wpływ na wynik — to jest prawdziwy
decision driver, nie struktura kosztowa oddziału, o której zarząd dyskutował najdłużej.

**Pre-mortem**: "Jest lipiec 2027, oddział w Niemczech zamknięty po stracie 1,2 mln." Najczęstsze
przyczyny wygenerowane przez zespół: (1) zatrudniono lokalnego dyrektora przed potwierdzeniem
product-market fit, (2) centrala nie dała lokalnemu zespołowi autonomii cenowej, (3) sprzedaż
zajęła 2x dłużej niż zakładano, bo cykl decyzyjny niemieckich klientów korporacyjnych jest dłuższy
niż w DACH-benchmarku użytym do prognozy.

**Rekomendacja silnika**: opcja D (pilotaż 6 miesięcy, zdalny zespół, 2 klientów referencyjnych),
z jawnym checkpointem: po 6 miesiącach, jeśli ≥1 klient referencyjny podpisany i cykl sprzedaży
<40% dłuższy niż benchmark → przejście do opcji C; jeśli konkurent zareaguje cenowo w tym czasie →
przejście do opcji B (partner) zamiast A.

**Insighty wygenerowane**:
1. *Prawdziwy trade-off* nie brzmiał "oddział czy nie", tylko "szybkość zdobycia rynku vs
   ekspozycja kapitałowa przy niepotwierdzonym PMF" — nazwanie tego skróciło dyskusję zarządu
   z 3 spotkań do 1.
2. *Punkt odwrócenia*: rekomendacja D→A odwraca się wyłącznie na zmiennej "reakcja cenowa
   konkurenta", nie na strukturze kosztów, którą zarząd analizował najdłużej — to przesunęło
   następny krok organizacji na monitoring konkurencji, nie na dalsze cięcie budżetu oddziału.
3. *Sekwencja, nie decyzja 0-1*: "pełny oddział" nie zniknął z listy — został odroczony do
   momentu, gdy kluczowa niepewność (PMF, cykl sprzedaży) się rozstrzygnie tanim pilotażem.
4. *Ukryte kryterium* ujawnione w pre-mortem: prawdziwą obawą części zarządu nie było ryzyko
   finansowe, tylko obawa przed powtórką nieudanej ekspansji do Francji sprzed 2 lat (nigdy
   nie wypowiedziana wprost na poprzednich spotkaniach) — nazwanie tego pozwoliło oddzielić
   racjonalną ocenę ryzyka od resztkowej traumy organizacyjnej.

## 8. Źródła

- [6 Elements of High-Quality Decisions — SDG](https://sdg.com/infographic/6-elements-of-high-quality-decisions/)
- [Decision Quality — Strategic Decisions Group](https://sdg.com/decision-quality/)
- [Decision Quality Chain Explained — Umbrex](https://umbrex.com/resources/frameworks/strategy-frameworks/decision-quality-chain/)
- [Six Attributes of Decision Quality — Leading Projects](https://leading-projects.com/news-resources/six-attributes-of-decision-quality/)
- [Decision Quality: Value Creation from Better Business Decisions (Spetzler, Winter, Meyer) — Amazon](https://www.amazon.com/Decision-Quality-Creation-Business-Decisions/dp/1119144671)
- [The business logic in debiasing — McKinsey](https://www.mckinsey.com/capabilities/risk-and-resilience/our-insights/the-business-logic-in-debiasing)
- [Are you ready to decide? — McKinsey](https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/are-you-ready-to-decide)
- [Biases in decision-making: A guide for CFOs — McKinsey](https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/biases-in-decision-making-a-guide-for-cfos)
- [Tornado Diagram Sensitivity Analysis — TreeAge](https://www.treeage.com/tornado-diagram-sensitivity-analysis/)
- [Tornado diagram — Wikipedia](https://en.wikipedia.org/wiki/Tornado_diagram)
- [The Pre-Mortem Technique — Gary Klein / Psychology Today](https://www.psychologytoday.com/us/blog/seeing-what-others-dont/202101/the-pre-mortem-method)
- [Daniel Kahneman's Approach For Making Better Decisions — Farnam Street](https://fs.blog/kahneman-better-decisions/)
