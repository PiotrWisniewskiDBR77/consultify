# ODPOWIEDZI FOUNDERA — CZĘŚĆ 1  
## P1–P24: Fundamenty architektury, bezpieczeństwa, produktu i walidacji rynku

> Dokument roboczy dla Claude’a.  
> Źródło pytań: `PYTANIA_DO_ZALOZYCIELA.md`.
>
> **Zasada wykonawcza dla Claude’a:**  
> Każdą poniższą odpowiedź należy traktować zgodnie z jej statusem:
>
> - `ZATWIERDZONE` — decyzja wiążąca, należy aktualizować dokumentację.
> - `HIPOTEZA MVP` — decyzja obowiązuje tymczasowo do wskazanego checkpointu.
> - `ODŁOŻONE` — nie podejmować teraz; utworzyć jawny punkt decyzyjny na właściwą fazę.
> - `WYMAGA WERYFIKACJI` — nie przedstawiać jako fakt; utworzyć zadanie badawcze lub prawne.
>
> Claude nie może zamieniać hipotez i punktów wymagających weryfikacji w trwałe decyzje architektoniczne bez aktualizacji ADR.

---

## P1 — Komunikacja o przechowywaniu kluczy dostawców

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Nie będziemy używać komunikatu „nigdy nie przechowujemy Twoich kluczy”, ponieważ jest on nieprawdziwy dla części integracji. Komunikacja ma być uczciwa i precyzyjna:

> Platforma przechowuje wyłącznie te poświadczenia i tokeny dostawców, które są niezbędne do wykonania uzgodnionych operacji. Dane te są szyfrowane, odseparowane per klient i dostępne wyłącznie dla autoryzowanych procesów.

Nie musimy eksponować technicznego szczegółu „trzy rodzaje kluczy” w głównym nagłówku marketingowym. Liczba rodzajów kluczy może się zmienić. Powinna zostać opisana w dokumentacji bezpieczeństwa i ekranie zgody integracji.

### Uzasadnienie

Prosty, ale nieprawdziwy slogan tworzy większe ryzyko niż bardziej precyzyjny komunikat. Zaufanie ma być elementem przewagi produktu, dlatego komunikacja nie może opierać się na absolutach, których architektura nie spełnia.

### Instrukcja dla Claude’a

1. Usuń ze wszystkich dokumentów i materiałów zdanie „nigdy nie przechowujemy Twoich kluczy”.
2. Zastąp je spójnym opisem modelu limited custody.
3. Dodaj do architektury bezpieczeństwa tabelę:
   - rodzaj sekretu,
   - cel,
   - zakres dostępu,
   - okres retencji,
   - sposób usunięcia,
   - odpowiedzialny komponent.
4. Utwórz wpis ADR dotyczący komunikacji o custody sekretów.

---

## P2 — Silnik workflow: Temporal czy kolejka PostgreSQL

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

Na MVP wybieramy prostszą kolejkę i stan workflow oparty na PostgreSQL. Temporal pozostaje opcją skalowania, ale nie jest wdrażany przed udowodnieniem, że prostsze rozwiązanie nie wystarcza.

### Zakres obowiązywania

Decyzja obowiązuje do wystąpienia co najmniej jednego z poniższych warunków:

- workflow trwające wiele godzin lub dni,
- konieczność trwałego wznawiania po awarii,
- wysoka liczba zależnych kroków i kompensacji,
- powtarzające się błędy wynikające z ręcznej orkiestracji,
- co najmniej 100 aktywnych ventures albo równoważne obciążenie.

### Uzasadnienie

Temporal może być właściwym rozwiązaniem docelowym, ale na etapie walidacji zwiększa złożoność, koszt operacyjny i czas wdrożenia. PostgreSQL już będzie elementem platformy i pozwala ograniczyć liczbę systemów.

### Instrukcja dla Claude’a

1. Zapisz decyzję jako ADR z oznaczeniem `MVP`.
2. Nie projektuj abstrakcji wyłącznie pod Temporal.
3. Zaprojektuj interfejs workflow tak, by migracja była możliwa bez przebudowy logiki domenowej.
4. Dodaj wymienione wyżej triggery ponownej oceny.

---

## P3 — Dostawca sandboxów wykonawczych

**Status:** HIPOTEZA MVP + WYMAGA TECHNICZNEGO SPIKE’A

### Odpowiedź foundera

Obowiązuje zasada buy-not-build. Nie budujemy własnego systemu sandboxów na bazie Firecracker w MVP. Pierwszym kandydatem jest dostawca klasy E2B, ale wybór nie jest ostateczny bez krótkiego testu technicznego i kosztowego.

### Kryteria wyboru

Dostawca musi zapewniać:

- izolację per zadanie i per tenant,
- kontrolę sieci wychodzącej,
- limity CPU, RAM, czasu i kosztu,
- automatyczne niszczenie środowiska,
- audytowalne logi,
- możliwość pracy z repozytorium bez ujawniania sekretów,
- akceptowalne DPA i warunki komercyjnego użycia.

### Instrukcja dla Claude’a

1. Utwórz zadanie spike porównujące co najmniej E2B i jedną alternatywę.
2. Nie wpisuj E2B jako zatwierdzonego dostawcy produkcyjnego.
3. Przygotuj macierz: bezpieczeństwo, funkcjonalność, koszt, lock-in, DPA, ograniczenia.
4. Decyzję końcową zapisz jako ADR przed rozpoczęciem Fazy 4.

---

## P4 — Regulamin Expo i tokeny robot-user

**Status:** WYMAGA WERYFIKACJI PRAWNEJ

### Odpowiedź foundera

Tak, należy zlecić formalną weryfikację prawną regulaminu Expo i warunków użycia tokenów robot-user przed komercyjnym wdrożeniem connectora. To nie powinno blokować wywiadów ani prototypowania bez danych klienta, ale musi zostać zamknięte przed pierwszym użyciem na rzecz płacącego klienta.

### Zakres opinii

Prawnik powinien ocenić:

- czy token może być przechowywany i używany przez platformę trzecią,
- czy model działania jest zgodny z warunkami konta klienta,
- odpowiedzialność za działania automatyczne,
- możliwość delegowania operacji build i release,
- wymagane ujawnienia i zgody.

### Instrukcja dla Claude’a

1. Dodaj blokadę fazową przed produkcyjnym connector-em Expo.
2. Oznacz wszystkie twierdzenia o dozwolonym użyciu jako `UNVERIFIED`.
3. Przygotuj brief dla prawnika z konkretnymi pytaniami i opisem architektury.
4. Nie interpretuj regulaminu samodzielnie jako ostatecznej opinii prawnej.

---

## P5 — Nieznana ekonomika jednostkowa

**Status:** ZATWIERDZONE JAKO KONTROLOWANE RYZYKO

### Odpowiedź foundera

Akceptuję, że dokładny koszt venture/miesiąc jest dziś nieznany. Nie akceptuję jednak budowania produktu bez telemetrii kosztowej. Od pierwszego środowiska działającego na prawdziwych zadaniach musimy mierzyć koszt per:

- agent run,
- zadanie,
- venture,
- model,
- dostawca,
- etap workflow,
- wynik zakończony sukcesem i błędem.

### Warunek biznesowy

Brak dokładnej wartości przed telemetrią jest akceptowalny. Brak zdolności pomiaru nie jest akceptowalny.

### Instrukcja dla Claude’a

1. Wprowadź telemetrię kosztową jako wymaganie MVP infrastruktury.
2. Nie wpisuj do modelu finansowego jednej wartości jako faktu.
3. Stosuj zakresy scenariuszowe: niski, bazowy, wysoki.
4. Ustal checkpoint po pierwszych 100–300 realnych zadaniach.

---

## P6 — Zakres trzech ról klienckich

**Status:** ZATWIERDZONE

### Odpowiedź foundera

MVP obejmuje trzy role widoczne dla klienta:

1. AI Product Owner,
2. AI CTO,
3. AI Launch Manager.

Nie dodajemy Revenue Lead ani Growth Lead do pierwszej wersji produktu. Funkcje growth i revenue mogą być wykonywane jako wewnętrzne kompetencje lub zadania, ale nie jako osobne role w interfejsie.

### Uzasadnienie

Trzy role pokrywają najważniejszy ciąg wartości: zdefiniowanie produktu, doprowadzenie techniczne i uruchomienie. Dodanie kolejnych ról zwiększyłoby złożoność interfejsu i obietnicę produktu przed walidacją.

### Instrukcja dla Claude’a

1. Ujednolić nazwy trzech ról we wszystkich dokumentach.
2. Oznaczyć dodatkowe role jako `POST-MVP`.
3. Nie budować osobnych person, dashboardów ani workflow dla Revenue/Growth w MVP.
4. Zapisać możliwość ponownej oceny po pierwszych pięciu płacących klientach.

---

## P7 — Rozbudowana infrastruktura agentowa przed walidacją rynku

**Status:** ZATWIERDZONA ZASADA DOCUMENTATION-FIRST, ALE IMPLEMENTATION-JUST-IN-TIME

### Odpowiedź foundera

Dokumentowanie architektury z wyprzedzeniem jest celowe, ale nie oznacza zgody na budowę całej opisanej infrastruktury przed walidacją rynku. Dokumentacja ma służyć spójności kierunku i identyfikacji ryzyk. Implementacja ma następować zgodnie z fazami i tylko wtedy, gdy dana funkcja jest potrzebna w najbliższym użyciu produktu.

### Granica

Można dokumentować:

- zasady bezpieczeństwa,
- interfejsy,
- decyzje trudne do odwrócenia,
- zależności i ryzyka.

Nie należy szczegółowo projektować:

- rozbudowanych rejestrów,
- rainbow deployments,
- dużych zestawów ewaluacyjnych,
- zaawansowanego controllingu,
- rozwiązań dla skali, której jeszcze nie ma.

### Instrukcja dla Claude’a

1. Oznacz dokumenty jako `target architecture`, jeśli nie są implementowane.
2. Dodaj pola `required_phase` i `implementation_trigger`.
3. Usuń domniemanie, że cały opisany zakres ma powstać w jednej fazie.
4. Stwórz minimalistyczną wersję implementacyjną dla każdej funkcji.

---

## P8 — Drabinka autonomii i zgody foundera

**Status:** ZATWIERDZONE Z OGRANICZENIAMI

### Odpowiedź foundera

Akceptuję, że szkice, analizy, rekomendacje i propozycje zmian mogą być generowane bez uprzedniej zgody. Muszą jednak być widoczne i audytowalne.

Następujące działania zawsze wymagają jawnej zgody człowieka:

- publikacja w sklepie,
- produkcyjne wdrożenie,
- płatność lub zobowiązanie finansowe,
- zmiana uprawnień,
- użycie sekretów klienta poza zatwierdzonym workflow,
- wysłanie komunikacji zewnętrznej w imieniu klienta,
- usunięcie danych,
- zmiana polityki bezpieczeństwa.

Founder nie powinien pozostać jedynym recenzentem na stałe. To akceptowalne tylko w fazie początkowej.

### Instrukcja dla Claude’a

1. Doprecyzuj macierz działań, nie tylko poziomów.
2. Nie stosuj automatycznej promocji autonomii dla działań nieodwracalnych.
3. Dodaj trigger delegowania roli approval reviewer.
4. Zapewnij pełny audit trail.

---

## P9 — H-COGS agentów

**Status:** ZATWIERDZONE JAKO RYZYKO DO POMIARU

### Odpowiedź foundera

Koszt agentów może być znacząco wyższy niż koszt zwykłego czatu i nie należy go ukrywać w modelu finansowym. Traktujemy to jako jedną z głównych hipotez biznesowych produktu.

Nie przyjmujemy jednak bez dowodu sztywnego mnożnika 4–15x. Zakres może być używany wyłącznie jako scenariusz planistyczny.

### Checkpoint

Po pierwszych realnych zadaniach należy policzyć:

- koszt brutto zadania,
- marżę po koszcie modeli i narzędzi,
- koszt błędów i powtórzeń,
- koszt obsługi ludzkiej,
- koszt na venture/miesiąc,
- udział kosztu AI w przychodzie.

### Instrukcja dla Claude’a

1. Oznacz mnożniki jako hipotezę, nie fakt.
2. Wymuś raport kosztowy przed finalizacją cennika.
3. Dodaj limity budżetowe i alerty.
4. Nie buduj modelu biznesowego na ukrywaniu kosztów w abonamencie.

---

## P10 — GitHub App i sejf sekretów jako formalne ADR

**Status:** ZATWIERDZONE KIERUNKOWO; WYMAGA FORMALIZACJI

### Odpowiedź foundera

Model integracji przez GitHub App oraz sejf sekretów szyfrowany per klient są zatwierdzonym kierunkiem architektonicznym. Muszą zostać formalnie zapisane jako ADR przed implementacją produkcyjną.

### Minimalne wymagania

- least privilege,
- instalacja per organizacja/repozytorium,
- możliwość natychmiastowego odwołania,
- separacja tenantów,
- klucze szyfrujące per klient lub równoważna izolacja,
- logowanie użycia sekretów,
- procedura rotacji i usunięcia.

### Instrukcja dla Claude’a

1. Utwórz dwa odrębne ADR-y.
2. Dodaj alternatywy rozważane i powody odrzucenia.
3. Nie oznaczaj implementacji jako gotowej tylko dlatego, że kierunek jest przyjęty.
4. Połącz ADR-y z threat modelem.

---

## P11 — Poziomy A0–A3 i progresywna autonomia

**Status:** HIPOTEZA MVP DO KOREKTY

### Odpowiedź foundera

Akceptuję cztery poziomy zatwierdzania jako model startowy. Nie akceptuję automatycznego awansu zadania z A2 do A1 wyłącznie po trzech udanych wykonaniach.

Awans może nastąpić dopiero po spełnieniu łącznie:

- minimalnej liczby poprawnych wykonań,
- braku incydentów,
- stabilnego typu zadania,
- pokrycia ewaluacyjnego,
- istniejącej ścieżki rollback,
- ręcznego zatwierdzenia zmiany poziomu autonomii.

Liczba „3” jest zbyt mała dla decyzji o realnym zwiększeniu autonomii.

### Instrukcja dla Claude’a

1. Usuń automatyczny awans po trzech wykonaniach.
2. Wprowadź ręcznie zatwierdzaną zmianę klasy autonomii.
3. Zachowaj osobne reguły dla typu działania, klienta i środowiska.
4. Dodaj możliwość natychmiastowego cofnięcia autonomii.

---

## P12 — Obietnica „nie trenujemy na Twoich danych”

**Status:** ZATWIERDZONE OGRANICZENIE MARKETINGOWE

### Odpowiedź foundera

Nie publikujemy obietnicy „nie trenujemy na Twoich danych” jako absolutnego stwierdzenia, dopóki nie zweryfikujemy warunków każdego dostawcy modeli i narzędzi.

Do czasu weryfikacji możemy komunikować wyłącznie to, co kontrolujemy bezpośrednio:

> Nie wykorzystujemy danych klientów do trenowania własnych modeli bez ich wyraźnej zgody.

Nie wolno przenosić tej deklaracji automatycznie na dostawców zewnętrznych.

### Instrukcja dla Claude’a

1. Przejrzyj wszystkie publiczne obietnice dotyczące danych.
2. Rozdziel zobowiązania platformy od polityk dostawców.
3. Utwórz rejestr DPA i status weryfikacji per dostawca.
4. Dodaj bramkę prawną przed publikacją szerszej deklaracji.

---

## P13 — SOC 2 Type 1

**Status:** ZATWIERDZONE: PLANOWANIE TERAZ, WYDATEK PÓŹNIEJ

### Odpowiedź foundera

Nie rozpoczynamy pełnego programu SOC 2 Type 1 teraz. Zbieramy jednak orientacyjne wyceny i wymagania, aby znać budżet, lead time i zakres przygotowań.

Uruchomienie programu następuje po jednym z triggerów:

- realna transakcja blokowana przez procurement,
- wejście do segmentu enterprise, w którym SOC 2 jest standardem,
- istotny klient amerykański wymagający raportu,
- finansowanie, które uzasadnia inwestycję.

### Instrukcja dla Claude’a

1. Oddziel „wycenę i readiness assessment” od „realizacji certyfikacji”.
2. Dodaj orientacyjny budżet i czas jako zakres, nie fakt.
3. Nie wpisuj SOC 2 jako zobowiązania przed triggerem.
4. Zachowaj praktyki bezpieczeństwa niezależnie od certyfikacji.

---

## P14 — Zakres uprawnień GitHub App

**Status:** WYMAGA PRZEGLĄDU PRZED WDROŻENIEM

### Odpowiedź foundera

Zakres uprawnień GitHub App musi być minimalny, zrozumiały i uzasadniony osobno dla każdej permission. Klient powinien widzieć, co aplikacja może zrobić, dlaczego tego potrzebuje i czy uprawnienie jest tylko do odczytu, czy do zapisu.

Nie zatwierdzam obecnej listy w ciemno. Musi zostać przygotowana do osobnego przeglądu founderskiego i security review.

### Instrukcja dla Claude’a

1. Przygotuj tabelę wszystkich permissions.
2. Dla każdej dodaj:
   - cel,
   - ryzyko,
   - możliwość ograniczenia,
   - moment użycia,
   - uzasadnienie dla klienta.
3. Preferuj instalację na wybranych repozytoriach, nie na całej organizacji.
4. Nie wdrażaj permission bez konkretnego use case.

---

## P15 — Konsultacja prawna: RODO, ToS, E&O

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Konsultacja prawna musi odbyć się przed komercyjnym launch-em, ale nie musi blokować Fazy 1 i prototypowania.

Zakres konsultacji:

- regulamin i umowy z klientami,
- DPA i lista subprocesorów,
- RODO i transfery danych,
- odpowiedzialność za działania agentów,
- przechowywanie sekretów,
- delegowanie kont Apple/Google/Expo,
- zakres potrzebnego E&O/cyber insurance.

### Instrukcja dla Claude’a

1. Utwórz checklistę legal readiness.
2. Przypisz ownera: founder, zewnętrzny prawnik jako wykonawca.
3. Dodaj budżet jako `TBD`.
4. Ustaw bramkę przed pierwszym płatnym wdrożeniem produkcyjnym.

---

## P16 — Zakres Revenue Readiness

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Na start Revenue Readiness ma oceniać gotowość do Launch, czyli poziom 2. Nie rozszerzamy teraz modelu na Operate, Grow i Scale.

### Uzasadnienie

Produkt musi najpierw udowodnić, że potrafi doprowadzić venture do bezpiecznego uruchomienia. Dodanie dalszych etapów przed walidacją rozmyłoby kryteria i zwiększyło zakres.

### Instrukcja dla Claude’a

1. Zachowaj obecny zakres Launch.
2. Oznacz Operate/Grow/Scale jako roadmapę.
3. Nie twórz szczegółowych scoringów dalszych poziomów.
4. Dodaj trigger rozszerzenia po udanych launch-ach pierwszej kohorty.

---

## P17 — Domyślna geografia: USA czy UE

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

Domyślną ścieżką produktową dla MVP jest rynek USA. UE nie jest wykluczona, ale uruchomienie europejskie wymaga świadomego wyboru i dodatkowego sprawdzenia wymagań prawnych, prywatności oraz rezydencji danych.

Nie stosujemy komunikatu „odłóż UE, chyba że masz dowód”. Stosujemy bardziej neutralną zasadę:

> Start w USA jest domyślną ścieżką MVP. UE jest wspierana po przejściu dodatkowej checklisty zgodności.

### Instrukcja dla Claude’a

1. Zmień D-3 na powyższą politykę.
2. Nie przedstawiaj UE jako rynku niepożądanego.
3. Dodaj osobną checklistę EU launch.
4. Oznacz decyzję jako hipotezę do walidacji rynkowej.

---

## P18 — Wagi domen w Launch Readiness Score

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

Akceptuję zaproponowane wagi jako punkt startowy:

- płatności, dystrybucja, prywatność, legal: ×1,5,
- architektura, tożsamość, niezawodność: ×1,25,
- pozostałe: ×1,0.

Wagi nie są prawdą obiektywną. Mają zostać skalibrowane na danych z pierwszych wdrożeń.

### Zasada nadrzędna

Krytyczne braki prawne, prywatności, bezpieczeństwa, płatności lub dystrybucji nie mogą zostać „przykryte” wysokim wynikiem w innych domenach. Muszą istnieć hard blockers niezależne od score.

### Instrukcja dla Claude’a

1. Zachowaj wagi jako konfigurowalne.
2. Dodaj listę blockerów zero-jedynkowych.
3. Zaplanuj kalibrację po pierwszych 5–10 launch-ach.
4. Nie używaj wyniku jako jedynej podstawy decyzji go-live.

---

## P19 — Zarządzana pula testerów Google Play

**Status:** ODŁOŻONE DO ROADMAPY

### Odpowiedź foundera

Funkcja ma wejść na roadmapę, ale nie do MVP. Nie budujemy puli testerów, dopóki ręczna rekrutacja testerów nie stanie się powtarzalnym problemem dla wielu klientów.

### Trigger

Rozpocząć discovery tej funkcji, gdy:

- co najmniej trzech klientów wskaże testy jako istotną blokadę,
- proces wydłuża launch w sposób mierzalny,
- znamy model prawny, operacyjny i kosztowy zarządzania testerami.

### Instrukcja dla Claude’a

1. Zachowaj jako roadmap item.
2. Nie tworzyć teraz procesu operacyjnego ani systemu.
3. Dodać wymagania do zebrania z pierwszych launch-y.
4. Nie obiecywać funkcji w sprzedaży.

---

## P20 — Próg automatyzacji poniżej 40%

**Status:** ZATWIERDZONE JAKO CHECKPOINT, NIE AUTOMATYCZNY KILL-SWITCH

### Odpowiedź foundera

Pokrycie automatyczne poniżej 40% jest poważnym sygnałem ostrzegawczym dla modelu self-service. Nie jest jednak automatycznym zamknięciem projektu.

W takim przypadku należy ocenić:

- które kroki pozostają ręczne,
- czy są to kroki jednorazowe czy powtarzalne,
- jaki jest ich koszt,
- czy klient może wykonać je sam,
- czy produkt nadal ma atrakcyjną ekonomię,
- czy model powinien być managed service zamiast self-service.

### Instrukcja dla Claude’a

1. Zmień H3 z prostego kill-switcha na formalny review gate.
2. Wymagaj raportu przyczyn.
3. Pozostaw trzy możliwe decyzje: continue, pivot model, stop.
4. Nie ukrywaj pracy ręcznej jako „automatyzacji”.

---

## P21 — Priorytet V1 i V2 w walidacji

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Pierwszym priorytetem Fazy 1 jest potwierdzenie:

1. czy problem jest wystarczająco bolesny,
2. czy grupa docelowa jest gotowa zapłacić,
3. czy segment jest wystarczająco duży i osiągalny.

Wielkość rynku bez willingness-to-pay nie jest wystarczającym dowodem. Dlatego V1 i V2 pozostają na początku, ale badanie rynku musi być połączone z realnymi rozmowami, próbą sprzedaży i testem cenowym.

### Instrukcja dla Claude’a

1. Ustaw kolejność walidacji: problem → płatność → segment → kanał.
2. Nie traktuj deklaracji zainteresowania jako gotowości do zapłaty.
3. Wymagaj co najmniej jednej formy commitment.
4. Zaktualizuj MV-003 i MV-008.

---

## P22 — Model cenowy do testowania

**Status:** ZATWIERDZONE JAKO TEST WIELOWARIANTOWY

### Odpowiedź foundera

Testujemy model hybrydowy:

- jednorazowa opłata za audyt, przygotowanie lub launch,
- miesięczna opłata za dalsze działanie platformy.

Nie ograniczamy testu do jednego wariantu. Należy porównać co najmniej:

1. tylko jednorazowy pakiet,
2. jednorazowy pakiet + subskrypcja,
3. niższy setup + wyższa subskrypcja.

Zakres 1,5–5 tys. USD oraz 49–99 USD/mies. jest jedynie hipotezą i może być zbyt niski w zależności od faktycznego zakresu odpowiedzialności.

### Instrukcja dla Claude’a

1. Nie wpisuj zakresów jako finalnego cennika.
2. Przygotuj test cenowy z różnymi poziomami wartości.
3. Mierz nie tylko kliknięcia, ale gotowość do wpłaty.
4. Oddziel cenę audytu, wdrożenia i operacji.

---

## P23 — Delegowalność kont Apple/Google

**Status:** WYMAGA WERYFIKACJI PRAWNEJ I OPERACYJNEJ

### Odpowiedź foundera

Tak, należy przygotować dodatkowy brief dotyczący delegowania obsługi kont Apple Developer i Google Play. To jest warunek wykonalności oferty launchowej.

Brief ma rozdzielić:

- co może zrobić właściciel konta,
- co może zrobić zaproszony użytkownik,
- co może zrobić API,
- jakie kroki pozostają ręczne,
- jakie działania mogą naruszać regulaminy,
- jak wygląda odpowiedzialność przy automatyzacji.

### Instrukcja dla Claude’a

1. Utwórz osobny research brief.
2. Korzystaj z aktualnych źródeł pierwotnych Apple i Google.
3. Oznacz wszystkie niepotwierdzone możliwości jako hipotezy.
4. Nie obiecuj pełnej automatyzacji przed zakończeniem briefu.

---

## P24 — Zakaz używania niepotwierdzonych statystyk

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Nie używamy w marketingu, sprzedaży, materiałach inwestorskich ani dokumentacji strategicznej żadnej statystyki, której nie da się powiązać z wiarygodnym źródłem i właściwym kontekstem.

Dotyczy to szczególnie liczb budujących strach lub autorytet, np. procentów podatności kodu AI, skali błędów, wskaźników automatyzacji lub oszczędności.

### Standard dowodowy

Każda liczba musi mieć:

- źródło,
- datę,
- metodę lub kontekst,
- zakres zastosowania,
- oznaczenie, czy jest faktem, estymacją czy hipotezą.

### Instrukcja dla Claude’a

1. Usuń lub oznacz wszystkie niezweryfikowane statystyki.
2. Wprowadź etykiety: `FACT`, `ESTIMATE`, `HYPOTHESIS`.
3. Nie cytuj wtórnego dokumentu, jeśli pierwotne źródło jest dostępne.
4. Dodaj tę zasadę do standardów marketingowych i dokumentacyjnych.

---

# Instrukcja końcowa dla Claude’a

Po zastosowaniu decyzji P1–P24:

1. Utwórz listę wszystkich zmienionych dokumentów.
2. Wskaż konflikty między dotychczasowymi zapisami a decyzjami foundera.
3. Utwórz lub zaktualizuj wymagane ADR-y.
4. Nie promuj automatycznie wszystkich dokumentów do statusu `accepted`.
5. Dla punktów prawnych i badawczych utwórz backlog z ownerem, fazą i warunkiem zamknięcia.
6. Przygotuj krótkie podsumowanie:
   - decyzje zatwierdzone,
   - hipotezy MVP,
   - decyzje odłożone,
   - punkty wymagające weryfikacji.
