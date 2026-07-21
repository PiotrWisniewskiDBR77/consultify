# WERDYKT — karty N (7 sztuk), synteza trzech osi

> **Data:** 2026-07-22 · **Gałąź:** `fix/prv-mywork-preview` (baza `origin/demo`)
> **To jest werdykt, nie naprawa.** Zero zmian w kodzie.
> **Dokumenty źródłowe** (tam są dowody plik:linia i pomiary):
> `_ANALIZA_MENU1_KART_N_2026-07-22.md` · `_ANALIZA_JAKOSCI_TRESCI_KART_2026-07-22.md` ·
> `_TESTY_WYPELNIANIA_KART_2026-07-22.md`
> **Ten dokument:** tylko wnioski i konsekwencje dla pracy z klientem.

---

## 1. Werdykt w jednym zdaniu

**Tak — ale realnie tylko dwiema z siedmiu kart (Decision i Task), i to dopiero po kliknięciu
przełącznika, którego nikt nie szuka; z pozostałych pięciu trzy nie mają czym zaprosić do
działania (pusty przycisk główny), a jedna — Notification — gubi wpisaną treść, pokazując
przy tym „Zapisano".**

---

## 2. Siedem kart × trzy wymiary

Legenda: **✅ gotowe** · **⚠️ częściowo** · **❌ nie**

| Karta | Menu 1 (górny pasek) | Treść (co i jak napisać) | Wypełnianie (czy da się pracować) |
|---|---|---|---|
| **Tool** | ⚠️ Ma przycisk główny i jako jedyna używa naszego koloru statusu, ale pasek jest za wysoki i niesie tę samą ukrytą czerwień co reszta. | ✅ Jedyna karta z prawdziwą doktryną redakcyjną (co robi · czym nie jest · kiedy nie zaczynać) — pól nie ma, bo ich nie potrzebuje. | ✅ Świadomie tylko-do-odczytu; uczciwie pokazuje puste sekcje zamiast je chować. |
| **Notification** | ⚠️ Przycisk główny jest, ale kropka statusu ma zero pikseli szerokości, a kod obiektu rozpycha pasek o jedną trzecią. | ⚠️ Podpowiedzi powtarzają nazwę pola, a na ekran wychodzi surowy angielski z bazy („AI RISK DETECTED") i „1 dni temu". | ❌ Wpisana treść ginie bezpowrotnie, a pasek przez cały czas pokazuje „Zapisano". |
| **Interview** | ❌ Nie ma przycisku głównego w ogóle — slot nie istnieje w kontrakcie tej karty, więc nie „znikł", tylko go nigdy nie było. | ⚠️ Jedno pole i zero kontraktu treści; w polskim UI zostały angielskie zwroty w opisach trybów rozmowy. | ⚠️ Edytuje się wyłącznie tytuł; dwa przyciski AI nie dają widocznego efektu. |
| **Decision** | ⚠️ Przycisk główny działa i wygląda identycznie jak na innych kartach, ale kropka statusu zapada się do zera, a pasek rośnie do 77 px. | ❌ Wymogi treści dla decyzji są napisane, ale **nikt ich nie wywołuje**; pole opisu wariantu decyzyjnego — serce tej karty — podpowiada „Opis...". | ✅ Po przełączeniu na „Edycja" ma komplet: dodawanie, usuwanie, kolejność, ukrywanie sekcji i pełny pasek AI. |
| **Insight** | ⚠️ Przycisk główny jest, ale tytuł jest ucinany w połowie znaku nawet na szerokim ekranie i kropka statusu zapada się do zera. | ⚠️ Jedna z dwóch kart z pełnym kontraktem i twardą bramą — ale nasza własna karta pokazowa dostaje od niego 0/100, a dwie różne sekcje wyświetlają ten sam tekst. | ⚠️ Brak autozapisu (inaczej niż na sąsiednich kartach), sekcji nie da się usunąć, a AI regeneruje całą kartę zamiast sekcji. |
| **Task** | ❌ Każde otwarcie istniejącego zadania startuje **bez** przycisku głównego — slot jest pusty z definicji, nie z braku akcji do wykonania. | ⚠️ Najlepsze średnio podpowiedzi w systemie, ale kontrakt obejmuje pojedyncze sekcje i jest wyłącznie doradczy. | ✅ Po „Edycja" komplet zarządzania sekcjami i pasek AI; jedyna rysa to „Dowody" wepchnięte przed Akcje. |
| **Initiative** | ❌ Brak przycisku głównego (w harnessie; na żywej bazie niezweryfikowane) i przycisk AI podpięty do niczego. | ⚠️ Ma najlepszy wzorzec podpowiedzi w systemie i pełny kontrakt — ale dwa pola KPI mają angielskie etykiety, a podpowiedź do tezy uczy formatu, który brama odrzuca. | ⚠️ Dziesięć realnych pól, ale trzy pola panelu otwierają listę wyboru i po cichu wracają do poprzedniej wartości. |

**Bilans:** Menu 1 — 0 gotowych, 4 częściowo, 3 nie. Treść — 1 gotowa, 5 częściowo, 1 nie.
Wypełnianie — 3 gotowe, 3 częściowo, 1 nie.

**Żadna karta nie ma kompletu trzech ✅. Żadna nie jest gotowa w Menu 1.**
Najbliżej gotowości jest **Tool** — karta, w której najmniej się dzieje. To nie jest przypadek:
im więcej karta ma umieć, tym więcej w niej dziś nie działa.

---

## 3. ★ Co boli najbardziej

Uszeregowane wg tego, **ile kosztuje konsultanta przy realnej pracy z klientem** —
nie wg tego, ile kosztuje naprawa.

### 1. Notification zjada pracę i mówi, że zapisał
Konsultant wpisuje oczekiwaną akcję, widzi „Zapisano", zamyka kartę — treści nie ma.
Nie ma ostrzeżenia, nie ma sposobu odzyskania, nie ma nawet powodu, żeby sprawdzić.
**To jedyna wada na tej liście, po której nie da się cofnąć skutku.** Jedno wystąpienie przy
kliencie kosztuje zaufanie do całego systemu, nie do jednej karty. Wada jest w samej karcie —
nie zależy od backendu, więc na żywym demo zachowa się tak samo.

### 2. Dwie najlepiej zbudowane karty witają konsultanta jako martwe
Decision i Task są jedynymi kartami z kompletem zarządzania sekcjami i działającym AI — i obie
otwierają się w trybie Podgląd, bez pól. Task dodatkowo traci przy tym przycisk główny.
Konsultant otwiera zadanie przy kliencie i widzi ekran, na którym nie ma nic do zrobienia.
**Najmocniejsza funkcjonalność w systemie jest niewidoczna w pierwszych trzech sekundach.**
Nasz własny test przeszedł przez to samo: pierwszy przebieg orzekł „karty są martwe", zanim
ktoś kliknął przełącznik.

### 3. Nikt nie wie, ile ma napisać — próg jest niewidoczny
Doktryna treści jest dobra i realnie egzekwowana na serwerze. Ale **żadna z 63 podpowiedzi
w polach nie podaje ani jednej liczby z tej doktryny.** Konsultant pisze podsumowanie, jest
przekonany, że skończył, a brama odrzuca kartę — albo, częściej, nie odrzuca i słaba karta idzie
do klienta. Dowód, że to nie teoria: **nasza własna karta pokazowa — najładniejsza w systemie —
dostaje od własnego walidatora 0/100 i realną ścieżką zapisu zostałaby odrzucona.**
Koszt: praca do przepisania po fakcie, zawsze pod presją terminu.

### 4. Pola udają, że są edytowalne, i milczą, gdy nie są
W Initiative trzy pola panelu (Faza, Następna brama, Źródło) mają kursor „rączkę", otwierają
prawdziwą listę opcji, pozwalają wybrać — i po sekundzie wracają do starej wartości bez słowa
komentarza. Insight ma odmianę tego samego na statusie: sześć opcji do wyboru, trzy działające.
Konsultant ustawia fazę inicjatywy przy kliencie, przechodzi dalej i **pracuje na wartości,
której nigdy nie zmienił.** Cichy błąd jest tu droższy niż zablokowane pole.

### 5. Status obiektu znika i nigdzie nie jest podpisany
Stan karty niesie w górnym pasku wyłącznie kropka 12 px bez etykiety. Na laptopie (poniżej
~1200 px) kropka **zapada się do zera pikseli** na trzech kartach — element jest w kodzie,
kolor poprawny, szerokości brak. Konsultant nie ma jak odróżnić szkicu od decyzji zatwierdzonej.
Koszt: pokazanie klientowi wersji roboczej jako uzgodnionej.

> **Tuż za podium:** polszczyzna na ekranie — „AI RISK DETECTED" wersalikami, „1 dni temu",
> „Submit for review", „przyjazny dla async". Nie powoduje złych decyzji, ale każde takie miejsce
> odbiera produktowi klasę doradczą dokładnie tam, gdzie ją sprzedajemy.

---

## 4. UI/UX kontra treść — która noga jest słabsza

**Odpowiedź: słabsza jest TREŚĆ, i to wyraźnie. Ale to nie znaczy, że mamy ładne karty.**

Policzalnie, bez ocen „na oko":

| | Wygląd / powłoka | Treść |
|---|---|---|
| Fundament | **Jeden komponent na 7 kart** — naprawa jest w jednym miejscu | **2 typy z 7** mają kontrakt całej karty |
| Co już działa | Przycisk główny **identyczny co do piksela i koloru** wszędzie, gdzie jest | **1 karta z 7** (Tool) ma prawdziwą doktrynę redakcyjną |
| Główna luka | Pasek nie broni się przed ciasnotą; trzy karty mają pusty slot akcji | **0 z 63 podpowiedzi** komunikuje jakikolwiek próg |
| Najgorszy przypadek | Element jest, ma zero szerokości | Karta referencyjna (Decision) ma wymogi **napisane i nigdy niewywołane** |
| Charakter problemu | **Wykończenie** — trzy najdotkliwsze wady to poprawki jednolinijkowe | **Program** — trzeba napisać podpowiedzi i domknąć pokrycie |

Uczciwe podsumowanie dla Piotra: **szkielet mamy wspólny i prawie dobry, a treść — nie do
napisania przez człowieka, bo nie mówimy mu, czego oczekujemy.** Wygląd jest dziś zaniedbany,
ale zaniedbany *płytko*: żaden defekt wyglądu nie wymaga przebudowy, bo wszystkie siedem kart
montuje jedną powłokę. Treść jest zaniedbana *strukturalnie*: brakuje pokrycia, brakuje
komunikacji progu i brakuje spójności między tym, czego uczy pole, a tym, czego wymaga brama.

**Zastrzeżenie, żeby nie zafałszować obrazu.** Najdroższa pojedyncza wada z §3 nie należy do
żadnej z tych dwóch nóg — Notification gubiący treść to **mechanika**. Odpowiedź „treść jest
słabsza" jest prawdziwa dla kierunku programu, ale nie wyznacza kolejności najbliższych prac.

---

## 5. Do decyzji Piotra

Zebrane ze wszystkich trzech osi, bez powtórzeń. **★ = rozstrzygnięcie potrzebne, zanim
ruszy kolejna fala** — bez tego robotnicy będą zgadywać.

**Jak karta wita użytkownika**
1. ★ **Domyślny tryb: Podgląd czy Edycja?** Dziś Decision i Task otwierają się w Podglądzie,
   Insight i Initiative w Edycji. Ta sama powłoka, przeciwne domyślne. To decyduje o pierwszym
   wrażeniu: „martwa" kontra „gotowa do pisania".
2. **Status w górnym pasku: etykieta czy kropka?** Etykieta („Do przeglądu", „Zatwierdzona")
   kosztuje ~80–120 px szerokości paska, ale kropka bez podpisu nie niesie informacji.
3. **„Zapisano" — wskaźnik czy przycisk?** Dziś to klikalny przycisk, który w trakcie edycji
   zamienia się w drugi przycisk akcji obok głównego. Pytanie: pokazujemy sam stan i ufamy
   autozapisowi, czy zostawiamy ręczny „Zapisz"?
4. **Kod obiektu i permalink zostają w pasku?** Nie ma ich w kanonie, a to one rozpychają pasek
   i wnoszą ukrytą czerwień. *Rekomendacja z osi 1: zostają i dostają poprawne zachowanie* —
   „skopiuj kod obiektu" to realny nawyk doradczy, tylko dziś źle zbudowany.

**Jak uczymy pisać treść**
5. ★ **Czy progi doktryny mają być widoczne podczas pisania?** Dziś kontrakt żyje wyłącznie na
   serwerze. *Rekomendacja z osi 2: wpisać progi wprost w podpowiedzi* — najtańsze, zero nowych
   komponentów, a podpowiedzi i tak trzeba przepisać.
6. ★ **Który wzorzec podpowiedzi rozciągamy na pozostałe sześć kart?** Initiative ma
   dwupoziomowy (nagłówek sekcji + zdanie objaśniające + pytające pole) i jest najlepszy
   w systemie. *Rekomendacja: kopiujemy istniejący, nie projektujemy nowego.*
7. ★ **Jeden format tezy — „Jeśli… to… bo…" czy „Wierzymy, że… ponieważ…"?** Dziś pole uczy
   jednego, brama wymaga drugiego. Tekst napisany dokładnie według naszej podpowiedzi zostaje
   odrzucony. To decyzja o języku produktu, nie o kodzie.
8. **Czy ocena ma odróżniać kartę słabą od pustej?** Dziś dwanaście drobnych uwag daje wynik 0,
   tak samo jak karta całkowicie pusta. Nie da się zaraportować postępu ani powiedzieć klientowi
   „poprawiło się z 34 na 61".

**Ile karta ma umieć**
9. **Faza / Następna brama / Źródło w Initiative — edytowalne czy nie?** Albo dostają obsługę,
   albo przestają wyglądać jak lista wyboru. Trzeciej opcji nie ma.
10. **Czy Insight dostaje AI per sekcja?** Dziś regeneruje całą kartę — nadpisuje pracę
    konsultanta bez pytania, co jest najdroższym możliwym zachowaniem tej klasy.
11. **Tool / Notification / Interview — pełny panel pięciosekcyjny czy zostają lekkie?**
12. **Usuwanie sekcji widoczne zawsze czy dopiero po najechaniu myszą?** Dziś jest ukryte —
    funkcja istnieje i działa, ale nikt jej nie znajdzie (my sami znaleźliśmy dopiero w kodzie).

**Higiena programu**
13. ★ **Aktualizujemy SPEC-N przed kolejną falą?** Dokument opisuje stan sprzed implementacji
    („usuwanie sekcji: 0 z 8", „5 kart bez panelu") — to już nieprawda. *Rekomendacja: tak.*
    Kto zaplanuje falę na dzisiejszym SPEC-N, **każe przepisać rzeczy, które działają.**

---

## 6. Czego nie zweryfikowano

**Ograniczenia harnessu — najważniejsze, bo dotyczą zaufania do wszystkich trzech osi:**

- **Harness omija serwer w całości** (podmienia warstwę sieciową). Żaden pomiar „czy zapis
  doszedł" ani „czy brama przepuściła" nie jest z niego miarodajny. Wnioski o zapisie opieramy
  na logice komponentu.
- **Mocki potrafią zasłaniać prawdę — potwierdzone dwa razy w dwa dni.** Wczoraj mock odfiltrował
  jedyną akcję główną i slot renderował się pusty. Dziś karta pokazowa Insight wygląda wzorcowo
  i dostaje 0/100 od własnego walidatora. Harness dowodzi jakości renderu, nie jakości produktu.
- **Równoległa sesja sterowała tą samą kartą przeglądarki.** Dwie osie dostały wynik z obcego
  ekranu, zanim to wykryły; jedna przeszła na własną, izolowaną przeglądarkę. Wszystkie liczby
  w dokumentach źródłowych są związane ze zweryfikowanym adresem ekranu — ale gdyby nie to,
  raporty byłyby częściowo zmyślone.
- **Panel przeglądarki miał 894 px, nie 1280.** Szeroki ekran symulowano przez DOM, nie realnym
  oknem — więc wnioski „na szerokim znika" dotyczą zachowania układu, nie pełnego widoku desktop.

**Czego wprost nie sprawdzono:**

- **Ciemny motyw** zmierzono tylko na jednej karcie (Decision). Pozostałe sześć opieramy na tym,
  że montują tę samą powłokę.
- **Wersja angielska — nie sprawdzona wcale.** Wszystkie pomiary na polskiej. Krótsze etykiety
  mogą zmienić objawy ciasnoty paska.
- **Initiative: czy przycisk główny pojawia się na żywej bazie.** W harnessie slot jest pusty,
  bo dane przychodzą puste. **Nie wiem i nie zgaduję** — do sprawdzenia na demo. W odróżnieniu
  od Task, gdzie przyczyna jest lokalna i pewna.
- **Interview: co robią przyciski „Czat AI" i „Ocena AI".** Klik nie dał widocznego efektu; nie
  ustalono, czy brakuje obsługi, czy backendu. **Nie twierdzimy, że są zepsute.**
- **Stan żywej bazy** — ile jest realnych kart i z jakim wynikiem treści. Cała analiza treści
  jest statyczna plus harness.
- **Raport ART-016, na który powołuje się SPEC-N, nie istnieje w tej gałęzi.** Twierdzenia
  „19/19 kart Insight poniżej progu" nie mają tu źródła do sprawdzenia. Nie podważamy ich —
  sygnalizujemy, że to ta sama klasa dokumentu-widma, którą wykryliśmy wczoraj.
- **Puste stany per sekcja** oraz **przeciąganie sekcji myszą** — potwierdzono obecność
  mechanizmu, nie wykonano gestu.
- **Karty dziedziczące** (KPI · RAID · Milestone · Change Request · Stage Gate · Action Proposal)
  — poza zakresem tych siedmiu.

**Co zweryfikowano na potrzeby tej syntezy:** przeczytano trzy dokumenty osi w całości
i ponownie sprawdzono w kodzie gałęzi roboczej dziesięć twierdzeń, na których wisi werdykt
(m.in. domyślny tryb Decision i Task, blokada przycisku głównego w Task, zakleszczenie zapisu
w Notification, brak wywołania walidatora w Decision, kolizja formatu tezy, czerwień w pasku,
martwe wpięcie AI w Initiative, brak slotu akcji w Interview). **Wszystkie dziesięć się
potwierdziło.** Harness odpowiada, ale na potrzeby tego dokumentu nie renderowano ekranów
ponownie — wszystkie pomiary pochodzą z osi.

---

*Dowody techniczne — plik, linia, zmierzona wartość — w trzech dokumentach źródłowych
wymienionych na górze.*
