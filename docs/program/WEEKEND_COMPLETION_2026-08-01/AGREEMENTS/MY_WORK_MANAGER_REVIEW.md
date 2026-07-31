---
document_id: MY-WORK-MANAGER-REVIEW
module: My Work
function: Manager
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# My Work — Manager

## 1. Decyzja produktowa

Manager jest osobistym centrum sterowania dla osób odpowiadających za wynik,
portfolio, projekty i ludzi. Nie jest ekranem BI ani zbiorem dekoracyjnych KPI.
Ma w krótkim czasie odpowiedzieć na pięć pytań:

1. Czy dowozimy oczekiwane rezultaty?
2. Co odchyla się od planu i dlaczego?
3. Gdzie trzeba podjąć decyzję albo usunąć blokadę?
4. Czy ludzie, czas i budżet pozwalają wykonać plan?
5. Jaką interwencję rekomenduje Teresa i na jakich dowodach?

Zasadą jest **management by exception**: najpierw wyjątki wymagające działania,
potem diagnoza i dopiero pełny obraz. Zielone elementy nie mogą zagłuszać
problemów.

## 2. Użytkownicy i zakres

### 2.1 Dwie niezależne decyzje dostępu

Dostęp do Managera składa się z dwóch osobnych reguł:

1. **Module access — kto widzi Managera:** funkcja jest dostępna wyłącznie dla
   osób, którym nadano rolę lub capability menedżerską. Pozostali użytkownicy
   nie widzą zakładki, nie mogą wejść deep linkiem i nie mogą odczytać jej API.
2. **Management scope — czyją pracę widzi manager:** samo wejście do modułu nie
   oznacza dostępu do całej organizacji. Osobno definiuje się dozwolone zespoły,
   projekty, programy, jednostki organizacyjne i relacje raportowania.

Obie reguły będą konfigurowane w Admin Panelu. Manager jest powierzchnią
wykonującą politykę, a nie miejscem samodzielnego nadawania dostępu. Zmiana
uprawnień wymaga audytu: kto, komu, jaki scope, od kiedy i z jakiego powodu.

Domyślna zasada to `deny by default` i najmniejszy potrzebny zakres. Nowo
utworzony manager nie widzi pracy innych osób, dopóki nie otrzyma jawnego
management scope. Wyjątkiem może być owner organizacji, jeśli polityka tenantu
przyznaje mu pełny mandat.

| Użytkownik | Potrzeba | Domyślny zakres |
| --- | --- | --- |
| owner / executive | wynik całej organizacji, ryzyka i decyzje strategiczne | organizacja |
| admin z mandatem zarządczym | jakość danych, konfiguracja i nadzór | organizacja |
| portfolio / program manager | zależności, priorytety, zasoby, korzyści | portfolio/program |
| project manager | plan, zespół, budżet, blokady i decyzje | przypisane projekty |
| team manager | obciążenie, ryzyka personalne i zobowiązania zespołu | przypisane zespoły |
| consultant | doradztwo w dopuszczonym zakresie klienta | jawnie udostępniony scope |

Samo posiadanie roli aplikacyjnej nie daje automatycznie dostępu do wszystkich
projektów. Widoczność jest przecięciem capability `manager.view`, przypisanego
management scope, ACL danych i mandatu projektowego. Jeżeli którykolwiek z tych
warunków ogranicza zakres, obowiązuje zakres węższy.

### 2.2 Docelowe warianty scope

| Scope | Widoczna praca | Typowe zastosowanie |
| --- | --- | --- |
| organization | wszystkie dozwolone jednostki i projekty organizacji | owner/executive |
| business unit | osoby, zespoły i projekty jednostki | dyrektor funkcji |
| portfolio/program | elementy przypisane do portfela/programu | portfolio manager |
| project | członkowie i obiekty konkretnego projektu | project manager |
| team | praca przypisanych członków zespołu | team manager |
| direct reports | praca osób w jawnej relacji raportowania | line manager |
| custom | jawnie wybrane projekty/zespoły bez szerszego dostępu | konsultant lub wyjątek |

Zakresy mogą się sumować, lecz nigdy nie rozszerzają dostępu do dokumentów,
wynagrodzeń, ocen lub danych wrażliwych chronionych osobną polityką. Agregaty nie
mogą ujawniać danych, których użytkownik nie mógłby zobaczyć w drill-downie.

## 3. Miejsce w systemie

Manager czyta projekcje danych z Initiatives, Execution, Results/KPI, Finance,
Tasks, Decisions, Calendar, Inbox i Organization. Kanoniczne rekordy pozostają
w modułach źródłowych. Karta Managera zawsze prowadzi deep linkiem do rekordu,
z którego pochodzi sygnał.

Manager może zainicjować komendę, lecz zapis odbywa się przez kontrakt modułu
właściciela: `proposal -> uprawnienie -> preview/diff -> potwierdzenie -> write
-> read-back`. Nie wolno utrzymywać drugiej, rozbieżnej wersji decyzji, zadania,
inicjatywy ani KPI.

## 4. Docelowa architektura informacji

### 4.1 Brief / Wymaga uwagi

Domyślny ekran dnia pracy. Zawiera uporządkowaną listę interwencji, nie ogólny
feed:

- decyzje czekające na użytkownika i zbliżające się SLA;
- inicjatywy `at risk`, `off track` i zablokowane;
- KPI poza progiem z brakującym planem naprawczym;
- przekroczenia budżetu, terminu lub zatwierdzonego capacity;
- konflikty zależności i spiętrzenia pracy;
- aktualizacje nieświeże albo brakujące;
- zobowiązania bez właściciela;
- propozycje interwencji Teresy.

Każda pozycja ma: istotność, zakres, właściciela, przyczynę, dowód, czas
oczekiwania, rekomendację, możliwe działanie i deep link.

### 4.2 Portfolio

Widok merytoryczny projektów i inicjatyw: cel, owner, etap, health, postęp,
termin, koszt, oczekiwana i zrealizowana korzyść, ryzyko, zależności oraz
świeżość statusu. Obsługuje grupowanie po projekcie, programie, celu,
jednostce, ownerze i statusie. Nie zastępuje szczegółowej karty Initiative.

### 4.3 People & Capacity

Pokazuje zapotrzebowanie i dostępność w konkretnym przedziale czasu, zespół,
role krytyczne, przeciążenia, wolną pojemność, konflikty przydziału i braki
kompetencyjne. Capacity bez horyzontu czasu jest nieważne. Użytkownik może
symulować przesunięcie pracy, ale realokacja wymaga potwierdzenia i zapisu u
właściciela planu.

### 4.4 Decisions & Approvals

Kolejka decyzji obejmuje: czego dotyczy decyzja, kto decyduje, rekomendację,
alternatywy, konsekwencje, dowody, deadline/SLA, blokowane elementy i historię.
Manager pozwala otworzyć pełny decision brief. Szybkie zatwierdzenie jest
dopuszczalne tylko wtedy, gdy użytkownik widział obowiązkowe minimum i operacja
wykonuje kanoniczny kontrakt Decisions.

### 4.5 Goals, KPI & Benefits

Łączy cel/OKR z inicjatywami, KPI, rezultatem i korzyścią finansową. Pokazuje
trend, target, forecast, confidence, ownera, źródło, świeżość i działania
naprawcze. Po wdrożeniu inicjatywy nadal śledzi, czy obiecane ROI/NPV i efekt
operacyjny zostały osiągnięte.

### 4.6 Updates & Reports

Statusy okresowe, historia zmian, raporty zarządcze i paczki dla interesariuszy.
Teresa może przygotować draft aktualizacji z danych systemu, wskazać luki i
sprzeczności. Człowiek zatwierdza komunikat, odbiorców i publikację.

## 5. Wspólny model karty zarządczej

Każda karta lub wiersz odpowiada temu samemu kontraktowi:

1. **Co** — jednoznaczny obiekt i jego typ.
2. **Stan** — status oraz health rozdzielone od procentu postępu.
3. **Dlaczego** — przyczyna i czynniki wpływu.
4. **Wpływ** — wynik, czas, budżet, ryzyko, ludzie i zależności.
5. **Odpowiedzialność** — owner, approver i osoby konsultowane.
6. **Dowody** — źródła, timestamp, wersja i confidence.
7. **Następny ruch** — rekomendowana interwencja lub deep link.

`80% complete` nie oznacza `on track`. Health jest jawną oceną opartą na
terminie, scope, ryzyku, budżecie, zależnościach i spodziewanym wyniku.

## 6. Teresa w Managerze

Teresa działa jako chief-of-staff i konsultant zarządczy. Może:

- przygotować codzienny/tygodniowy brief;
- wykryć odchylenia, zależności, brak ownera i nieświeże statusy;
- wyjaśnić, skąd pochodzi sygnał;
- zaproponować priorytety i warianty interwencji;
- zasymulować wpływ zmiany terminu, budżetu lub alokacji;
- przygotować draft decyzji, zadania, eskalacji, status update i planu
  naprawczego;
- prowadzić rozmowę „co się stanie, jeśli…”.

Teresa nie może bez osobnej polityki i potwierdzenia:

- zatwierdzić inwestycji, budżetu, decyzji go/no-go ani oceny pracownika;
- zmienić ownera, terminu, priorytetu lub przydziału zasobów;
- ukryć problemu, zmienić źródłowego KPI albo opublikować raportu;
- przedstawiać estymacji jako faktu;
- oceniać człowieka wyłącznie z aktywności systemowej.

Każda rekomendacja AI pokazuje przesłanki, dane użyte i pominięte, poziom
pewności, założenia, alternatywy oraz przewidywany wpływ. Użytkownik może ją
zaakceptować, edytować, odrzucić albo otworzyć źródła.

## 7. Nawigacja i standard wizualny

- górny pasek: zakres organizacja/portfolio/projekt/zespół, okres, zapisany
  widok i świeżość danych;
- pierwszy ekran: Brief z krytycznymi wyjątkami;
- wspólne filtry zachowują się przy przechodzeniu między sekcjami;
- kliknięcie metryki pokazuje definicję i rekordy składowe;
- kolor nigdy nie jest jedynym nośnikiem statusu;
- czerwony oznacza wymagane działanie, nie „niski procent”;
- wykres pojawia się tylko, gdy relacja lub trend jest czytelniejszy niż tabela;
- prawy panel Teresy zachowuje scope i źródła aktualnego widoku;
- każdy drill-down ma breadcrumb i bezpieczny powrót do tego samego filtra.

## 8. Golden flow

1. Manager otwiera Brief w swoim dozwolonym zakresie.
2. System pokazuje świeżość i jawne braki danych.
3. Teresa porządkuje wyjątki według wpływu i pilności.
4. Użytkownik otwiera sygnał i widzi przyczynę oraz źródła.
5. System pokazuje zależności i możliwe interwencje.
6. Użytkownik wybiera wariant albo formułuje własny.
7. Powstaje preview/diff komendy w module właściciela.
8. Uprawniona osoba zatwierdza.
9. System wykonuje zapis, odczytuje wynik i aktualizuje projekcję Managera.
10. Interwencja, owner, termin i rezultat trafiają do audytu oraz kolejnego
    status update.

## 9. Definition of Done MVP

- role i scope nie ujawniają danych spoza mandatu;
- użytkownik bez capability menedżerskiej nie widzi zakładki, nie otwiera jej
  deep linkiem i nie pobiera danych przez API;
- manager widzi wyłącznie pracę osób, zespołów i projektów przypisanych mu w
  Admin Panelu, a każda zmiana scope pozostaje audytowalna;
- Brief pokazuje prawdziwe decyzje, blokady, ryzyka i przeterminowane działania;
- każda liczba ma definicję, zakres czasu, źródło i świeżość;
- capacity jest liczone w tym samym przedziale czasu po obu stronach równania;
- wszystkie karty prowadzą do kanonicznych rekordów;
- działania zapisują się przez owner-module i mają read-back;
- Teresa tworzy rekomendacje z dowodami i nie wykonuje działań zastrzeżonych;
- brak danych jest odróżniony od zera, a estymacja od faktu;
- test obejmuje pełną interwencję od sygnału do potwierdzonego rezultatu.

## 10. Pytania do wspólnego rozstrzygnięcia

1. Czy Manager ma mieć jeden domyślny Brief, czy osobne warianty Executive,
   Portfolio Manager i Team Manager?
2. Które komendy mogą być wykonywane bez opuszczania Managera?
3. Kto może zmieniać health nadany ręcznie i kiedy AI może go rekomendować?
4. Jaki jest domyślny rytm status update: tygodniowy, zależny od projektu czy
   konfigurowalny?
5. Czy ocena capacity w MVP obejmuje godziny, FTE, role/skills czy tylko dwa
   pierwsze wymiary?
6. Czy dziedziczenie scope ma wynikać z Organization Structure, zespołów
   projektowych, relacji direct reports, czy z kombinacji tych mechanizmów?
7. Czy manager może widzieć indywidualne dane osób, czy w części obszarów tylko
   agregaty zespołu po spełnieniu minimalnej liczebności?
