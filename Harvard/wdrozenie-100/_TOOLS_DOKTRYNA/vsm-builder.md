# vsm-builder — DOKTRYNA NARZĘDZIA (Value Stream Mapping)

> Narzędzie z rodziny Lean Operations / Toyota Production System, w wersji BCG/McKinsey-grade
> dla doradztwa. W Consultify narzędzie NIE jest „edytorem diagramów przepływu" — jest strukturą
> zbierania faktów o przepływie pracy, która wymusza policzenie **Process Cycle Efficiency**,
> zlokalizowanie **jednego ograniczenia (constraint)** i wyprodukowanie **konkretnych, policzalnych
> insightów o tym, gdzie i dlaczego organizacja traci czas/pieniądze/jakość** — nie ładnej mapy.

---

## 1. CEL

VSM odpowiada na jedno pytanie sponsora: **„Dlaczego to, co robimy, trwa tak długo / kosztuje
tak dużo / ma tyle błędów — i co dokładnie z tego zmienić w pierwszej kolejności?"**

Problem, który rozwiązuje:
- Organizacje **znają swój proces z dokumentacji, nie z rzeczywistości**. VSM zastępuje opis
  „jak powinno być" pomiarem „jak faktycznie jest" — z zegarkiem, nie z pamięci uczestników.
- Większość strat czasu (**lead time**) nie siedzi w pracy, tylko **między krokami pracy**
  (kolejki, oczekiwanie na decyzję, przekazania między działami/systemami). VSM jest jedynym
  narzędziem lean, które to *widzi* — bo mapuje przepływ end-to-end, a nie pojedynczy krok.
- Kończy debatę „gdzie inwestować usprawnienia" dowodem liczbowym: **Process Cycle Efficiency**
  (PCE) pokazuje, jaki % lead time to praca dodająca wartość, a analiza wąskiego gardła pokazuje
  **który jeden krok** ogranicza przepustowość całego strumienia.

Decyzja, którą wspiera: **gdzie skierować pierwszy dolar/tydzień pracy usprawnieniowej** —
i jak duży jest potencjał (ile dni/godzin/PLN można odzyskać), zanim ktokolwiek zacznie wdrażać
rozwiązanie. VSM to narzędzie **diagnostyczne**, nie wykonawcze — dostarcza fakty i priorytet,
plan wdrożenia (kaizen) to osobny, następny krok.

---

## 2. KIEDY UŻYWAĆ

Sytuacje wyzwalające:
- Proces ma **wielu uczestników/działów** i nikt pojedynczy nie widzi go end-to-end (klasyczny
  sygnał: „nie wiem co się dzieje z tym zanim trafi do mnie" / „nie wiem co się dzieje po tym jak
  to wyślę dalej").
- Skarga klienta/biznesu brzmi: „to trwa za długo", „mamy zaległości", „nie wiadomo gdzie utyka
  praca", **ale nikt nie potrafi wskazać konkretnego kroku winnego**.
- Przed inwestycją w automatyzację/IT — żeby nie zautomatyzować marnotrawstwa (klasyczny błąd:
  digitalizacja kroku, który w ogóle nie powinien istnieć).
- Skalowanie/wzrost wolumenu grozi przeciążeniem procesu — trzeba wiedzieć, który krok pęknie
  pierwszy (constraint dziś ≠ constraint po 2x wolumenu).
- Fuzja/integracja dwóch procesów (post-M&A, konsolidacja zespołów) — trzeba zmapować oba,
  zanim zaprojektuje się jeden.
- Powtarzalny proces transakcyjny/administracyjny (nie tylko fabryka): onboarding klienta,
  obsługa reklamacji, cykl zamówienie-do-gotówki (O2C), rekrutacja, zamknięcie miesiąca
  księgowego, proces zatwierdzania budżetu. VSM przeniesione z produkcji do procesów biurowych
  (**office/transactional VSM**) jest dziś standardem BCG/McKinsey w Lean Ops poza fabryką.

Kiedy NIE używać: proces jednorazowy/projektowy bez powtarzalności (użyj innego narzędzia —
np. mapowania procesu decyzyjnego), albo gdy problem jest jakościowy/kompetencyjny, nie
przepływowy (np. brak umiejętności, nie brak przepływu).

---

## 3. INPUTY

VSM jest tak dobre, jak dane u jego podstawy. Zbierz z **gemba** (miejsca, gdzie praca faktycznie
się dzieje — obserwacja + rozmowa z wykonawcami), nie z procedur:

**3.1. Szkielet przepływu**
- Lista kroków procesu w kolejności, od trigera klienta/biznesu do dostarczenia wartości
  (np. „zamówienie złożone" → „faktura opłacona").
- Dla każdego kroku: kto wykonuje (rola/dział), jakim systemem/narzędziem, na wejściu i wyjściu.
- Kierunek i forma przepływu informacji (kto komu mówi „zrób to teraz" — push czy pull; e-mail,
  system, spotkanie, telefon).

**3.2. Dane per krok (process data box)**
- **Cycle Time (C/T)** — czas faktycznej pracy nad jedną jednostką, gdy ktoś nad nią pracuje.
- **Lead Time (L/T)** — czas od wejścia jednostki do kroku do jej wyjścia, WŁĄCZAJĄC oczekiwanie
  w kolejce. To L/T sumuje się w lead time całego strumienia, nie C/T.
- **Changeover Time / Setup (C/O)** — czas przezbrojenia między różnymi typami pracy (w procesach
  biurowych: przełączenie kontekstu, np. czas wejścia w sprawę po przerwaniu).
- **Uptime / dostępność** — % czasu, gdy zasób (osoba/system/maszyna) jest faktycznie dostępny
  do pracy nad tym krokiem (nie zajęty innymi zadaniami, nie w awarii).
- **% Complete & Accurate (%C&A)** — % jednostek, które przechodzą do następnego kroku BEZ
  konieczności poprawek, uzupełnień, wyjaśnień. To najczęściej pomijana metryka — a najbardziej
  ujawniająca ukrytą fabrykę przeróbek (rework).
- **Liczba osób/FTE** przypisanych do kroku, wielkość partii (batch size).
- **Zapasy/kolejka między krokami** (WIP — work in progress): ile jednostek czeka między krokiem
  A i B, w dniach lub sztukach. W procesach biurowych: liczba spraw w kolejce/skrzynce.

**3.3. Dane ramujące**
- **Popyt klienta** w okresie (żeby policzyć takt time = dostępny czas pracy / popyt).
- Godziny dostępne do pracy (zmiana, dzień roboczy).
- Aktualne SLA/obietnice wobec klienta (jeśli są) — punkt odniesienia dla „dość dobre".

**Pułapka na starcie:** zbieranie danych z procedur/systemów raportowych zamiast z obserwacji
na miejscu. Systemy ERP/ticketing pokazują status, nie rzeczywisty czas oczekiwania i przyczyny.
Partner idzie na gemba, mierzy stoperem/logami, pyta „co się dzieje POTEM, zanim ktoś to
podejmie" — to pytanie ujawnia najwięcej lead time.

---

## 4. METODA KROK PO KROKU

**Krok 0 — Wybór strumienia i granic.** Jedna rodzina produktu/usługi na raz (nie „wszystkie
procesy firmy"). Granica: od konkretnego triggera klienta do konkretnego momentu dostarczenia
wartości. Partner pyta: „dla kogo to jest wartość i kiedy klient ją dostaje?" — to definiuje
punkt końcowy.

**Krok 1 — Current-State Map (mapa stanu obecnego).** Zespół (cross-funkcyjny, właściciele
kroków w pokoju, nie tylko menedżerowie) idzie „w górę strumienia" od dostarczenia do klienta
z powrotem do triggera, rysując:
- process box na każdy krok + process data box pod nim (C/T, L/T, C/O, uptime, %C&A, FTE),
- strzałki informacji (kto komu każe co zrobić — push/pull, harmonogram/ad-hoc),
- trójkąty zapasu/kolejki między krokami z ilością i czasem oczekiwania,
- oś czasu (timeline) na dole: naprzemiennie L/T (nad linią) i C/T (pod linią) dla każdego kroku.

Zasada partnera prowadzącego: **mapujemy to, co JEST, nie to, co powinno być** — opór zespołu
(„ale zwykle robimy to inaczej") jest sygnałem diagnostycznym, nie przeszkodą.

**Krok 2 — Analiza: value-add vs waste, 7 muda.** Dla każdego kroku zespół klasyfikuje czas jako:
- **Value-Added (VA)** — klient zapłaciłby za to wprost, gdyby widział, i zmienia formę/funkcję.
- **Non-Value-Added, ale konieczne (Business/Type-1 NVA)** — regulacyjne, kontraktowe, ryzyka
  (np. wymagana kontrola jakości, zgodność).
- **Pure Waste (Type-2 NVA / muda)** — do eliminacji. Klasyfikacja wg 7 (+1) muda TPS:
  1. **Nadprodukcja** (overproduction) — robienie więcej/wcześniej niż potrzeba (najgorsza,
     bo generuje pozostałe 6).
  2. **Oczekiwanie** (waiting) — praca/osoba czeka na wejście, decyzję, zasób.
  3. **Transport** — przemieszczanie pracy/materiału bez dodawania wartości (w biurze: przekazania
     między systemami/działami).
  4. **Nadmierne przetwarzanie** (over-processing) — więcej pracy/precyzji niż klient potrzebuje
     (podwójne zatwierdzenia, raporty których nikt nie czyta).
  5. **Zapas** (inventory) — WIP czekający w kolejce (kapitał zamrożony, ukrywa problemy).
  6. **Ruch** (motion) — zbędne przemieszczanie się ludzi/kliknięcia/przełączanie systemów.
  7. **Wady/przeróbki** (defects) — praca robiona ponownie z powodu błędu (widoczna w niskim %C&A).
  8. **(+1) Niewykorzystany potencjał ludzi** — pomijanie wiedzy wykonawców w projektowaniu procesu.

**Krok 3 — Future-State Map.** Zespół projektuje docelowy przepływ eliminując/redukując muda,
stosując zasady: przepływ ciągły tam gdzie możliwy, **pull** zamiast push (kolejny krok
„ciągnie" pracę, gdy ma zdolność, zamiast poprzedni „pchać" ją niezależnie od obciążenia),
wyrównanie obciążenia (heijunka), jeden **pacemaker** (punkt, który ustawia rytm całego
strumienia wg takt time), redukcja wielkości partii, przeniesienie kontroli jakości bliżej
źródła błędu. Future-state to KONKRETNA, policzalna mapa — z nowymi wartościami C/T, L/T, PCE —
nie hasło „usprawnimy przepływ".

**Krok 4 — Plan kaizen (transformation plan).** Rozbicie różnicy current→future na dyskretne
**kaizen bursts** (ikona „wybuchu" na mapie w konkretnym miejscu) — każdy z właścicielem,
terminem, miarą sukcesu. Sekwencja: **najpierw ograniczenie (constraint)**, potem kroki niżej
w priorytecie wg efektu na PCE/lead time całego strumienia. Partner pilnuje kadencji przeglądu
(np. tygodniowy) i re-mapowania po wdrożeniu (VSM to cykl, nie zdarzenie jednorazowe).

**Jak partner to prowadzi (mechanika warsztatu):**
- Format: 1-dniowy warsztat na miejscu (gemba), zespół 6-10 osób z rzeczywistymi wykonawcami
  kroków (nie tylko kierownicy) + jeden facylitator zewnętrzny.
- Papier/flipchart lub whiteboard cyfrowy — celowo NIE gotowe firmowe szablony na starcie
  (odręczna mapa wymusza dyskusję, nie kopiowanie procedury).
- Reguła „follow one piece" — zespół śledzi los JEDNEJ konkretnej jednostki (zamówienia,
  wniosku, sprawy) przez cały strumień, zbierając realne czasy, nie średnie z pamięci.
- Walidacja na gemba: po narysowaniu wstępnej mapy, zespół idzie sprawdzić na miejscu, czy to
  się zgadza (nie ufa własnej pamięci z sali warsztatowej).

---

## 5. JAK SIĘ WNIOSKUJE (reguły interpretacji)

**5.1. Process Cycle Efficiency (PCE) — metryka nadrzędna.**

```
PCE = (suma Value-Added Time) / (całkowity Lead Time) × 100%
```

Progi branżowe (Lean Six Sigma, szeroko cytowane):
- **< 10%** — typowy proces nietransformowany (nawet w dojrzałych firmach większość procesów tu jest).
- **10–25%** — dobrze zarządzany proces tradycyjny.
- **> 25%** — próg uznawany za „lean" (wartość dodana przeważa nad odpadem).
- **> 40%** — world-class (rzadkie, zwykle po wielu cyklach kaizen).

Interpretacja dla klienta: PCE 3-8% (typowe dla procesów biurowych: zatwierdzenia, onboarding,
obsługa reklamacji) oznacza, że **92-97% czasu klient/sprawa nie robi nic wartościowego — czeka**.
To jest najsilniejszy, najbardziej przekonujący insight VSM, bo brzmi kontrintuicyjnie i jest
policzalny.

**5.2. Lokalizacja ograniczenia (constraint / bottleneck).**
Ograniczenie to krok, który **ogranicza przepustowość całego strumienia** — nie ten, który
wygląda na najbardziej zajęty. Sygnały:
- Największa kolejka/WIP **przed** krokiem (praca się piętrzy czekając na wejście) — to
  najpewniejszy sygnał wizualny na mapie.
- Krok, przed którym inne kroki mają nadmiarową zdolność, a za nim — głodują (brak pracy).
- **Uptime** najniższy względem wymaganego C/T — zasób jest niedostępny częściej niż inne.
- W teorii ograniczeń (Goldratt, TOC — komplementarna do VSM): zysk z usprawnienia
  NIE-ograniczenia jest **iluzoryczny** — przepustowość całego strumienia i tak wyznacza
  ograniczenie. To najczęstsza pułapka klientów: optymalizują krok, który już ma nadmiar
  zdolności, bo jest „widoczny"/„łatwy", a ograniczenie gdzie indziej się nie zmienia.
- Ograniczenie **przesuwa się** po każdej interwencji — re-mapuj po każdym cyklu kaizen
  (klasyczny błąd: rozwiązać ograniczenie A, ogłosić sukces, nie zauważyć że B jest teraz
  nowym ograniczeniem i pochłania cały zysk).

**5.3. Push vs pull — sygnał systemowy.**
Jeśli informacja płynie w formie harmonogramów/prognoz „z góry" niezależnie od realnej zdolności
kolejnego kroku (push) — generuje nadprodukcję i zapasy. Jeśli krok pobiera pracę dopiero gdy ma
zdolność (pull/kanban) — WIP jest samoregulujący. Diagnoza: policz WIP w każdej kolejce; rosnący
trend = push bez sprzężenia zwrotnego.

**5.4. Ukryta fabryka przeróbek (hidden factory).**
%C&A < 100% w danym kroku oznacza, że część pracy „wraca" — ale to rzadko widać w standardowych
raportach, bo systemy liczą tylko throughput na wyjściu, nie zawrócone jednostki. Pomnóż
(1 - %C&A) przez wolumen i C/T kroku, żeby policzyć realny, ukryty koszt przeróbek — to zwykle
jeden z największych, najmniej widocznych insightów sesji.

**5.5. Progi i pułapki.**
- **Mapowanie bez danych** — rysowanie ładnej mapy z szacunkami „na oko" zamiast zmierzonych
  C/T i L/T. Bez liczb VSM to tylko ilustracja, nie diagnostyka — nie da PCE ani lokalizacji
  ograniczenia z wiarygodnością.
- **Optymalizacja nie-ograniczenia** (patrz 5.2) — najdroższy błąd, bo generuje pozorny sukces
  lokalny bez zmiany wyniku end-to-end.
- **Mylenie C/T z L/T** — porównywanie czasu pracy między krokami zamiast czasu przepływu;
  krok może mieć krótki C/T i ogromny L/T (bo czeka w kolejce) — to właśnie ten krok trzeba
  zaadresować, nie ten z długim C/T.
- **Mapowanie średniej, nie wariancji** — proces może mieć akceptowalną średnią L/T, ale
  ogromny rozrzut (część spraw czeka 1 dzień, część 3 tygodnie); klient odczuwa ogon rozkładu,
  nie średnią.
- **Brak follow-up** — future-state map bez kadencji przeglądu staje się martwym dokumentem;
  ograniczenie i tak się przesunie.

---

## 6. INSIGHTY JAKIE PRODUKUJE (rdzeń narzędzia)

To jest **cel istnienia** narzędzia w Consultify — nie diagram, tylko te zdania, gotowe do
wpięcia w inicjatywę/kartę insightu:

1. **„X% lead time to czekanie, nie praca."** (z PCE) — twardy, policzalny dowód skali
   marnotrawstwa, punkt otwarcia dla sponsora, który uważa że proces „działa dobrze".
2. **„80% lead time siedzi w N z M kroków — konkretnie w [krok]."** — lokalizacja, nie ogólnik;
   pozwala skierować budżet/uwagę zarządu w jedno miejsce zamiast rozproszonego programu.
3. **„Ograniczenie to [krok], nie [krok który wygląda na winowajcę]."** — koryguje błędną
   intuicję organizacji (często najgłośniejszy/najbardziej widoczny krok NIE jest ograniczeniem).
4. **„Ukryta fabryka przeróbek: N% pracy w [krok] wraca do poprawki, co kosztuje ~Y FTE-dni/mies."**
   — ujawnia koszt niewidoczny w standardowych raportach KPI (bo raportują tylko output, nie rework).
5. **„Ograniczenie przesunęło się z A do B po wdrożeniu [poprzednia inicjatywa]."** — sygnał do
   zarządu, że punktowe usprawnienia bez re-mapowania tracą efekt; uzasadnia kadencję przeglądu.
6. **„Krok [X] to push bez sprzężenia zwrotnego — generuje WIP rosnący o N%/miesiąc."** —
   przechodzi z diagnozy przepływu do rekomendacji strukturalnej (wdrożyć pull/kanban).
7. **„Zmienność lead time (nie średnia) jest prawdziwym problemem klienta — ogon rozkładu sięga
   Nx średniej."** — przesuwa rozmowę z „poprawmy średnią" na „ustabilizujmy proces", co często
   wymaga innej interwencji (standaryzacja pracy, nie tylko przyspieszenie).
8. **„N% kroków to czysty non-value-add możliwy do eliminacji bez ryzyka regulacyjnego."** —
   konkretna, obronialna lista kandydatów do kaizen, posortowana wg wpływu na PCE.

**Przełożenie na transformację organizacji:** każdy insight powyżej ma naturalne przełożenie na
**inicjatywę** w Consultify (krok/ograniczenie → właściciel + cel liczbowy + termin), a suma
insightów z jednego VSM zwykle definiuje **jeden temat transformacyjny** (np. „skrócenie cyklu
onboardingu klienta z 21 do 7 dni") z wbudowanym uzasadnieniem finansowym (koszt marnotrawstwa
× wolumen rocznie). To odróżnia VSM od zwykłego „mapowania procesu" — VSM zawsze kończy się
liczbą do odzyskania i miejscem, gdzie tę liczbę odzyskać.

---

## 7. WORKED EXAMPLE

**Kontekst:** firma logistyczno-produkcyjna, proces „przyjęcie zamówienia klienta → wysyłka
gotowego elementu" (typowy dla środkowej wielkości producenta B2B).

**Current-state (zmierzone na gemba, jeden dzień obserwacji + follow-one-piece):**

| Krok | C/T | L/T (z kolejką) | Uptime | %C&A | WIP przed krokiem |
|---|---|---|---|---|---|
| 1. Wprowadzenie zamówienia do systemu | 15 min | 4 godz. | 95% | 92% | — |
| 2. Weryfikacja kredytowa/akceptacja | 10 min | 1 dzień | 90% | 88% | 12 zamówień |
| 3. Planowanie produkcji | 20 min | 2 dni | 85% | 95% | 18 zamówień |
| 4. Produkcja (obróbka) | 45 min | 1,5 dnia | 78% | 91% | 6 partii |
| 5. Kontrola jakości | 12 min | 6 godz. | 97% | 96% | 3 partie |
| 6. Pakowanie i wysyłka | 18 min | 8 godz. | 93% | 99% | 4 partie |

**Sumy:** VA time (C/T) = 15+10+20+45+12+18 = **120 minut (2 godz.)**.
Total Lead Time = 4h + 24h + 48h + 36h + 6h + 8h = **126 godzin (~5,25 dnia roboczego)**.

**PCE = 2h / 126h × 100% ≈ 1,6%.**

**Wniosek (insight #1):** 98,4% czasu zamówienie NIE jest obrabiane — czeka. To zdanie samo w
sobie zmienia rozmowę z zarządem z „produkcja jest wolna" na „produkcja NIE jest problemem —
problem jest w kolejkach między krokami administracyjnymi".

**Lokalizacja ograniczenia (insight #2/#3):** największy WIP przed krokiem 3 (Planowanie
produkcji, 18 zamówień w kolejce) i najniższy uptime w kroku 4 (Produkcja, 78% — częste przezbrojenia
i mikroprzestoje). Krok 4 wygląda jak „winowajca" (najdłuższy C/T, najniższy uptime) — ale
analiza kolejki pokazuje, że **krok 3 (Planowanie) jest realnym ograniczeniem**: zamówienia
piętrzą się PRZED planowaniem, nie przed produkcją; produkcja ma nadmiarową zdolność względem
tego, co dostaje w porę. Zespół chciał inwestować w drugą linię produkcyjną (adresując krok 4)
— VSM pokazuje, że to byłaby optymalizacja nie-ograniczenia: koszt bez efektu na lead time
całości, dopóki krok 3 nie zostanie rozwiązany.

**Ukryta fabryka przeróbek (insight #4):** krok 2 (Weryfikacja kredytowa) ma %C&A = 88% — 12%
zamówień wraca do sprzedaży po brakujące dane. Przy 200 zamówień/miesiąc to 24 zamówienia/mies.
przechodzące dodatkową pętlę ~1 dzień każde = **24 dni-lead-time/miesiąc ukrytego kosztu**,
niewidocznego w żadnym standardowym raporcie sprzedaży.

**Future-state (projekt):** przenieść planowanie produkcji na pull z sygnałem kanban z produkcji
(zamiast batch raz dziennie), dodać pole walidacji danych kredytowych na etapie wprowadzania
zamówienia (przesunięcie kontroli jakości do źródła — eliminacja pętli zwrotnej kroku 2),
konsolidacja kroków 5-6 (jeden operator, nie przekazanie między działami). Projektowany
Lead Time: **126h → ~48h**, PCE: **1,6% → ~4,2%** (wciąż niski wg benchmarku, ale >2,5x poprawa
i największa dźwignia bez inwestycji kapitałowej).

**Plan kaizen:** 3 kaizen bursts — (1) pull-sygnał krok 3→4 [właściciel: kierownik planowania,
4 tyg.], (2) walidacja danych przy wprowadzaniu zamówienia [właściciel: IT+sprzedaż, 6 tyg.],
(3) konsolidacja pakowania/wysyłki [właściciel: kierownik magazynu, 2 tyg.]. Re-mapowanie
zaplanowane na +90 dni, żeby sprawdzić, gdzie przesunęło się ograniczenie.

---

## 8. ŹRÓDŁA

- Rother, M. & Shook, J., *Learning to See: Value-Stream Mapping to Create Value and Eliminate
  Muda*, Lean Enterprise Institute, 1999 — kanoniczny podręcznik metody, definicje process box/
  data box/timeline. [Learning to See — fragment](https://www.lean.org/wp-content/uploads/2021/01/Learning-to-See-part1.pdf)
- Lean Enterprise Institute — *Value Stream Mapping Overview* (definicja, lexicon).
  [lean.org/lexicon-terms/value-stream-mapping](https://www.lean.org/lexicon-terms/value-stream-mapping/)
- Lean Enterprise Institute — *Understanding the Fundamentals of Value-Stream Mapping* (struktura
  mapy: information flow, process boxes, data boxes, timeline; C/T, D/T, uptime, C/O, %C&A, L/T).
  [lean.org — fundamentals](https://www.lean.org/the-lean-post/articles/understanding-the-fundamentals-of-value-stream-mapping/)
- Lean Enterprise Institute — *What Too Many Value Stream Maps Completely Miss* (pułapka
  mapowania bez działania/kadencji przeglądu).
  [lean.org — what VSM misses](https://www.lean.org/the-lean-post/articles/what-too-many-value-stream-maps-completely-miss/)
- Lean Enterprise Institute — *What is the Theory of Constraints, and How Does it Compare to
  Lean Thinking?* (komplementarność VSM + TOC, lokalizacja ograniczenia).
  [lean.org — TOC vs Lean](https://www.lean.org/the-lean-post/articles/what-is-the-theory-of-constraints-and-how-does-it-compare-to-lean-thinking/)
- McKinsey & Company — *Lever four: Lean management* (VSM jako narzędzie „breakthrough
  bottlenecks", integracja z innymi dźwigniami operacyjnymi).
  [mckinsey.com — lever-four-lean-management](https://www.mckinsey.com/capabilities/operations/our-insights/lever-four-lean-management)
- McKinsey & Company — *A leaner public sector* (VSM przeniesione poza produkcję, do procesów
  administracyjnych/transakcyjnych). [mckinsey.com — leaner public sector](https://www.mckinsey.com/industries/public-sector/our-insights/a-leaner-public-sector)
- KAIZEN Institute — *Value Stream Mapping in Lean Manufacturing* oraz *Map flow end-to-end:
  Value Stream Mapping* (bottleneck/capacity framing, praktyka konsultingowa).
  [kaizen.com — guide-vsm](https://kaizen.com/insights/guide-vsm-lean-manufacturing/) ·
  [kaizen.com — bottleneck-capacity](https://kaizen.com/insights/value-stream-mapping-bottleneck-capacity/)
- iSixSigma / SixSigma.us / Lean 6 Sigma Hub — *Process Cycle Efficiency* (formuła PCE, progi
  branżowe 10%/25%/40%). [isixsigma.com — PCE](https://www.isixsigma.com/dictionary/process-cycle-efficiency-pce/) ·
  [6sigma.us — PCE](https://www.6sigma.us/business-process-management-articles/process-cycle-efficiency/)
- ISM / businessmap.io / TXM — *7 Wastes of Lean* (definicje muda, Toyota Production System).
  [ism.ws — wastes-muda](https://www.ism.ws/logistics/wastes-muda-in-lean/) ·
  [businessmap.io — 7-wastes](https://businessmap.io/lean-management/value-waste/7-wastes-of-lean)
- Case studies (worked-example benchmark liczb realnych wdrożeń VSM w przemyśle): Springer —
  *Process improvement through Lean-Kaizen using value stream map: a case study in India*.
  [link.springer.com](https://link.springer.com/content/pdf/10.1007/s00170-018-1684-8.pdf)

---

*Doktryna sporządzona 2026-07-08 na potrzeby narzędzia `vsm-builder` w Consultify. Zasada
nadrzędna: narzędzie istnieje po to, by wyprodukować sekcję 6 (insighty) — reszta dokumentu to
rusztowanie metodologiczne, które ma tę sekcję uwiarygodnić i sparametryzować.*
