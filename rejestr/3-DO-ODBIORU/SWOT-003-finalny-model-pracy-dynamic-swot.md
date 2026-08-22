---
id: SWOT-003
tytul: Dynamic SWOT — finalny model pracy konsultanta, syntezy i odbioru
typ: rekomendacja-produktowa
waga: krytyczna
obszar: Tools
narzedzie: Dynamic SWOT
stan: gotowe-do-planowania
wlasciciel: Piotr Wiśniewski
blokuje: []
zablokowane_przez: []
zrodlo: "rozmowa właścicielska Automatyzacja narzędzi konsultingowych (2026-08-19), wcześniejsza dyskusja o modelu pracy Dynamic SWOT oraz późniejszy odbiór SWOT A–K"
utworzone: 2026-08-22
---

# Dynamic SWOT — finalny model pracy

## 1. Status i granice dokumentu

Ten dokument zamyka ustalenia produktowe dotyczące sposobu pracy w Dynamic SWOT. Łączy:

1. model pracy konsultanta omawiany podczas budowy SWOT,
2. uniwersalny model wnioskowania dla wszystkich narzędzi konsultingowych,
3. wymagania dotyczące interfejsu sesji SWOT,
4. późniejszą macierz odbioru A–K.

Jest to **specyfikacja końcowa do zaplanowania i wdrożenia**, a nie dowód wdrożenia. Dokument nie
oznacza, że wymagania są już zaimplementowane, przetestowane albo zaakceptowane w runtime.

## 2. Rola Dynamic SWOT

Dynamic SWOT nie jest elektroniczną tabelą do wpisania czterech list. Jest prowadzonym przez AI,
ale kontrolowanym przez konsultanta procesem, który przekształca rozproszony materiał w obronioną
diagnozę i materiał do decyzji.

Docelowy łańcuch pracy:

`kontekst biznesowy → materiał źródłowy → fakty i hipotezy → propozycje SWOT → napięcia i wzorce → implikacje → wnioski → opcje decyzyjne → rekomendacja konsultanta → decyzja zarządcza`

Dopiero po decyzji zarządczej może rozpocząć się osobny proces projektowania inicjatywy:

`rekomendacja → decyzja zarządcza → projektowanie inicjatywy`

### Twarda granica

- Wynik narzędzia nie jest inicjatywą.
- Wniosek nie jest inicjatywą.
- Rekomendacja nie jest inicjatywą.
- System nie tworzy inicjatywy automatycznie jako skutku ukończenia SWOT.
- Wybrana rekomendacja może zostać później rozwinięta w inicjatywę, dalszą analizę albo materiał
  decyzyjny — zawsze jako jawna, osobna czynność użytkownika.

Należy usunąć komunikaty w rodzaju: „Każda rekomendacja może stać się inicjatywą”. Właściwa treść:

> Rekomendacje opisują możliwe kierunki wynikające z analizy. Wybrane rekomendacje mogą zostać
> później rozwinięte w inicjatywy, dalsze analizy lub materiały decyzyjne.

## 3. Model pracy konsultanta w sesji SWOT

### Etap 1 — Misja i kontekst

Konsultant definiuje problem biznesowy, pytanie strategiczne, zakres, horyzont, kryterium sukcesu,
ograniczenia oraz oczekiwany rodzaj decyzji. System pokazuje, czego brakuje, i nie udaje kompletności.

### Etap 2 — Materiał i eksploracja

Źródłem mogą być dane, dokumenty, obserwacje, odpowiedzi z wywiadów i jawnie oznaczone hipotezy.
AI proponuje kandydatów do czterech obszarów SWOT, ale konsultant każdą propozycję:

- akceptuje,
- odrzuca lub pomija,
- komentuje,
- pogłębia,
- poprawia na podstawie dowodu.

Każdy punkt zawiera co najmniej: tezę, wyjaśnienie, rodzaj i odnośnik dowodu, poziom pewności,
status walidacji i historię decyzji konsultanta. AI nie może samodzielnie uznać hipotezy za fakt.

### Etap 3 — Budowa SWOT

System porządkuje zaakceptowane punkty w czterech obszarach, wykrywa powtórzenia, sprzeczności,
braki i relacje. Macierz jest etapem pośrednim, nie końcowym rezultatem narzędzia.

### Etap 4 — Synteza i insighty

Konsultant analizuje łącznie materiał, a nie cztery niezależne listy. System pomaga wykrywać:

- wzorce i powtarzające się sygnały,
- zależności i związki przyczynowe,
- sprzeczności między źródłami,
- czynniki wzajemnie się wzmacniające,
- objawy i potencjalne przyczyny źródłowe,
- napięcia pomiędzy elementami wewnętrznymi i zewnętrznymi,
- trade-offy oraz odrzucone kierunki.

Logika specyficzna dla SWOT pozostaje wewnątrz narzędzia. Uniwersalna karta syntezy nie używa
sekcji „synteza wewnętrzna” i „synteza zewnętrzna”, ponieważ ma działać również dla Portera,
PESTEL, Value Chain i kolejnych narzędzi.

### Etap 5 — Rekomendacje, jakość i zatwierdzenie wyniku

Sesja kończy się obronionym, wersjonowanym rezultatem konsultingowym, a nie samą macierzą ani
zestawem skrótów do innych modułów. Konsultant zatwierdza rekomendacje, sprawdza `Results &
Readiness` i przekazuje wynik do review. Po zatwierdzeniu natywny output staje się kwalifikowanym
źródłem widocznym w osobnych kreatorach Insights, Reports i Initiatives. W samej sesji nie tworzymy
raportu, prezentacji ani inicjatywy.

## 4. Kanoniczna karta „Consulting Synthesis Sheet”

Każde narzędzie konsultingowe, w tym SWOT, kończy się tą samą kartą syntezy. Metodyka narzędzia
wpływa na sposób dochodzenia do wyniku, ale nie zmienia końcowej architektury wnioskowania.

### 4.1 Executive Answer

Odpowiedź na pierwotne pytanie biznesowe w 2–4 zdaniach. Tekst answer-first, możliwy do przeczytania
zarządowi bez znajomości narzędzia.

### 4.2 Key Findings

Od 3 do 7 najważniejszych ustaleń. Każde ma:

- tezę,
- dowód,
- skalę lub znaczenie,
- poziom pewności,
- odnośnik do źródła.

Formuła: `ustalenie → dowód → znaczenie biznesowe`.

### 4.3 Key Insights

Nieoczywiste znaczenie łączne: mechanizmy przyczynowe, wzajemne wzmocnienia, sprzeczności,
ukryte bariery, przyczyny źródłowe i wyjaśnienie, dlaczego obserwowane zjawisko występuje.

### 4.4 Business Implications

Konsekwencje dla finansów, klientów, rynku, operacji, ryzyka, zdolności organizacyjnych, czasu oraz
kosztu działania i zaniechania. Każda implikacja wskazuje, jakie założenie lub decyzję zarząd powinien
ponownie ocenić.

### 4.5 Conclusions

Od 3 do 5 konkretnych, możliwie rozłącznych i obronionych tez. Każda otrzymuje status:

- Proposed by AI,
- Validated by consultant,
- Requires validation,
- Rejected.

### 4.6 Decision Options

Realistyczne warianty działania wraz z oczekiwanym efektem, korzyściami, ryzykami, wymaganiami,
trade-offami, horyzontem i pilnością. Opcje nie mogą udawać jednej z góry przesądzonej odpowiedzi.

### 4.7 Consultant Recommendation

Preferowany kierunek, uzasadnienie, warunki obowiązywania rekomendacji, najważniejsze trade-offy
oraz jawnie opisane kierunki, których konsultant nie rekomenduje.

### 4.8 Risks, Assumptions & Uncertainties

Braki danych, założenia, hipotezy niepotwierdzone, konflikty źródeł, ograniczenia metodyki, ryzyka
rekomendacji i ogólny poziom pewności. Niepewności nie wolno wygładzać.

### 4.9 Questions Requiring Management Decision

Decyzje sponsora lub zarządu: wybór trade-offu, akceptacja ryzyka, poziom ambicji, zakres oraz zgoda
na dalszą pracę.

Podsumowanie logiki:

`co znaleźliśmy → co to znaczy → co to zmienia → jakie istnieją wybory → co rekomendujemy → co musi zdecydować zarząd`

## 5. Zasady jakości i prawdy

1. Liczby pochodzą wyłącznie ze źródeł lub deterministycznego silnika; model ich nie wymyśla.
2. Każda teza wskazuje dowód. Brak dowodu oznacza hipotezę i obniżony poziom pewności.
3. Inne dane musiałyby prowadzić do innego wniosku — ogólnik pasujący do każdej firmy jest błędem.
4. Pierwsze zdanie zawiera konkluzję, nie opis metody.
5. Rekomendacja musi pokazywać trade-off i kierunek odrzucony.
6. AI proponuje; konsultant waliduje. Status walidacji jest widoczny i audytowalny.
7. Materiał niekompletny kończy się listą braków i pytań, nie sztucznym wynikiem „complete”.
8. Język, terminologia i encje pozostają spójne w całej sesji i jej rezultatach.
9. Zapis, ponowne otwarcie i przejście do rezultatu zachowują lineage oraz decyzje konsultanta.

## 6. Docelowa organizacja interfejsu

### 6.1 Przed rozpoczęciem sesji

- Jeden skonsolidowany nagłówek zamiast kilku pasków ułożonych jeden pod drugim.
- Ograniczona liczba elementów górnego chrome.
- Przyciski nagłówka mają wspólny rozmiar i neutralny styl.
- `Start Session` jest jedyną kolorową akcją główną.
- Widoczny prawy panel właściwości, zgodny konstrukcyjnie z panelem w Bibliotece narzędzi.

### 6.2 Po rozpoczęciu sesji

- Stały, czytelny nagłówek sesji.
- Lewa nawigacja grupuje etapy: Session, Analysis, Outputs, Collaboration.
- Centrum pokazuje jeden aktualny etap pracy, jego cel, postęp, dowody i decyzje.
- Prawy rail zawiera akcje, właściwości, relacje, źródła i założenia, wyniki, komentarze i historię.
- Panel prawy nie dubluje centrum i nie zasłania nawigacji ani treści.
- Akcje AI są wsparciem konsultanta, nie autonomicznym zatwierdzeniem wyniku.

### 6.3 Stan i postęp

System osobno pokazuje:

- postęp wypełnienia,
- liczbę zaakceptowanych punktów,
- liczbę potwierdzonych obszarów,
- aktywne dialogi lub braki,
- poziom pewności,
- etap konsultingowy,
- stan recenzji i zatwierdzenia.

Sto procent wypełnienia nie oznacza automatycznie zatwierdzenia merytorycznego.

### 6.4 Bez podwójnej nawigacji po obszarach SWOT

Wewnątrz centralnej karty `Input & Exploration` należy usunąć lewą, pionową listę:

- Strengths,
- Weaknesses,
- Opportunities,
- Threats.

Lista dubluje poziome zakładki tych samych czterech obszarów umieszczone nad treścią. Poziome
zakładki są jedyną nawigacją pomiędzy obszarami SWOT i pokazują licznik zaakceptowanych punktów,
np. `Strengths 0/5`.

Usunięcie dotyczy wyłącznie wewnętrznej pionowej listy czterech obszarów. Nie dotyczy głównej lewej
nawigacji etapów sesji (`Mission & Context`, `Input & Exploration`, `SWOT Build`,
`Synthesis & Insights`, `Outputs & Actions`). Zwolnione miejsce powiększa obszar roboczy aktualnej
zakładki.

### 6.5 Bez zdublowanego rzędu liczników

Z widoku `Input & Exploration` należy usunąć cały rząd czterech dużych kafli:

- `Accepted Points`,
- `Confirmed Areas`,
- `Active Dialogues`,
- `Maximum Target`.

Informacja o liczbie przyjętych punktów i limicie jest już dostępna w zakładkach S/W/O/T nad
treścią, np. `Strengths 0/5`. Nie należy powtarzać jej w osobnej linii dużych komponentów.
Informacje o kompletności obszaru lub aktywnym dialogu powinny być komunikowane kontekstowo w
zakładce i w aktualnie otwartej karcie, tylko wtedy, gdy wpływają na następną czynność użytkownika.
Usunięcie rzędu ma skrócić początek widoku i natychmiast przybliżyć właściwą treść pracy.

### 6.6 `Current AI Proposal` jako główny komponent roboczy

Karta `Current AI Proposal` jest najważniejszym elementem etapu `Input & Exploration`. Należy ją
przenieść bezpośrednio pod poziome zakładki S/W/O/T, przed:

- listę zaakceptowanych punktów dla obszaru,
- komunikat pustego stanu tej listy,
- pole ręcznego dodawania punktu.

Karta otrzymuje pierwszy fokus wzrokowy i operacyjny. Musi bez przewijania pokazywać tezę AI,
uzasadnienie oraz komplet podstawowych decyzji konsultanta: `Accept this point`, `Another proposal`,
`Comment`, `Think deeper`. Lista już zaakceptowanych punktów i ręczne dodawanie pozostają dostępne
niżej jako kontekst i ścieżka alternatywna, ale nie mogą spychać aktualnej propozycji poza pierwszy
ekran roboczy.

### 6.7 Kompaktowy stan zaakceptowanych punktów

W karcie obszaru należy usunąć chipy `Accepted: 0/5` oraz `Attempts: 1`. Liczba zaakceptowanych
punktów jest już widoczna w poziomej zakładce danego obszaru i nie może być powtarzana.

Jeżeli obszar ma zero zaakceptowanych punktów, nie należy renderować osobnej karty pustego stanu ani
zdania `You do not have any accepted points in this area yet`. Brak elementów jest wystarczająco
jednoznaczny. Sekcja zaakceptowanych punktów pojawia się dopiero po zaakceptowaniu pierwszego punktu.

Liczba prób nie jest podstawową informacją potrzebną konsultantowi w tym miejscu. Jeżeli jest
potrzebna audytowo, pozostaje w historii lub metadanych, a nie jako chip w głównym obszarze pracy.

### 6.8 Ręczne dodawanie uruchamiane przyciskiem

Pole tekstowe do samodzielnego wpisania punktu przez konsultanta nie może być stale widoczne.
W stanie podstawowym użytkownik widzi kompaktowy przycisk `Add your own` / `Dodaj własny punkt`.
Dopiero jego kliknięcie rozwija pole tekstowe wraz z akcjami zapisania i anulowania.

Po zapisaniu pole ponownie się zwija, a nowy punkt trafia do listy zaakceptowanych punktów z jawnym
oznaczeniem źródła `manual`. Anulowanie nie zapisuje pustego rekordu. Przycisk pozostaje dostępny
obok głównego przebiegu propozycji AI, ale nie konkuruje wizualnie z `Current AI Proposal`.

### 6.9 Jeden ekran budowania listy — maksymalnie pięć punktów

Każdy obszar SWOT jest budowany na jednym ekranie jako sekwencja propozycji. Lista docelowa zawiera
maksymalnie pięć zaakceptowanych punktów. Po zaakceptowaniu aktualnej propozycji:

1. punkt natychmiast trafia do kompaktowej listy zaakceptowanych,
2. licznik w zakładce obszaru zwiększa się, np. z `Strengths 1/5` do `Strengths 2/5`,
3. `Current AI Proposal` ładuje następną propozycję bez opuszczania ekranu,
4. fokus pozostaje w miejscu pracy nad propozycją.

Karta aktualnej propozycji udostępnia cztery jednoznaczne decyzje:

- **Accept** — dodaj do listy, jeżeli limit nie został osiągnięty,
- **Another proposal / Reject** — odrzuć tę propozycję i pokaż następną; odrzucenie zapisuje się
  w historii, ale nie w aktywnej liście,
- **Later** — odłóż propozycję do kolejki `Deferred`, aby można było do niej wrócić,
- **Think deeper / Comment** — doprecyzuj lub przetwórz propozycję przed decyzją.

Każdy zaakceptowany punkt ma własne menu kontekstowe:

- edytuj,
- usuń z listy,
- odłóż na później,
- zastąp nową propozycją AI,
- pokaż źródła i historię.

Usunięcie lub odłożenie przyjętego punktu zwalnia miejsce w limicie. Operacja nie kasuje śladu
audytowego: punkt zmienia status na `Removed` albo `Deferred` i pozostaje w historii.

Po osiągnięciu `5/5` system nie pozwala dodać szóstego aktywnego punktu. Zamiast martwego przycisku
wyjaśnia limit i daje dwie bezpośrednie możliwości:

- `Review accepted points` — wybierz punkt do usunięcia, odłożenia lub zastąpienia,
- `Save for later` — zachowaj bieżącą propozycję w kolejce `Deferred`.

Nie otwieramy osobnego kreatora ani drugiego ekranu. Aktualna propozycja, kompaktowa lista przyjętych
punktów, dostęp do odłożonych propozycji oraz operacje na punktach należą do jednego widoku obszaru.

### 6.10 Kolorystyka `SWOT Build` zgodna z aktywnym motywem

W jasnym motywie obszar `SWOT Build` nie może być renderowany jako granatowa lub prawie czarna
wyspa osadzona w jasnym ekranie. Główna powierzchnia, karty, zakładki, pola oraz obramowania używają
jasnych tokenów tego samego systemu co pozostałe etapy sesji.

Kolory Strengths, Weaknesses, Opportunities i Threats pozostają delikatnymi akcentami semantycznymi:
obramowaniem, znacznikiem, etykietą lub subtelnym tłem. Nie mogą tworzyć czterech ciężkich,
konkurujących powierzchni ani obniżać kontrastu tekstu.

Ciemnogranatowe powierzchnie są dopuszczalne wyłącznie w dark mode i również muszą korzystać z
kanonicznych tokenów motywu, a nie z kolorów zapisanych na sztywno. Przełączenie light/dark nie może
pozostawiać fragmentów przeciwnego motywu.

### 6.11 Bez górnego bloku instrukcyjnego w `SWOT Build`

Należy usunąć cały callout otwierający etap `SWOT Build`, zawierający opis klasycznej macierzy oraz
wyjaśnienie, że zaakceptowana propozycja trafia do ćwiartki lub zastępuje wybrany punkt.

Ekran ma rozpoczynać się bezpośrednio od właściwej powierzchni roboczej SWOT. Mechanika akcji ma być
zrozumiała z etykiet przycisków i informacji kontekstowych pojawiających się dokładnie w momencie
wyboru. Stała instrukcja nie może zajmować pierwszego planu ani powtarzać działania interfejsu.

### 6.12 Przejście z pełnych opisów do zdań w macierzy 2×2

`Input & Exploration` pozostaje miejscem pełnych opisów: tezy, uzasadnienia, dowodów, komentarzy,
poziomu pewności i historii decyzji. `SWOT Build` nie kopiuje tych opisów w całości. Dla każdego
zaakceptowanego punktu AI przygotowuje krótkie, jednozdaniowe sformułowanie przeznaczone do macierzy
2×2.

Kontrakt transformacji:

1. Wejściem jest zaakceptowany punkt z `Input & Exploration` wraz z pełnym lineage.
2. AI proponuje jedno krótkie zdanie zachowujące sens, podmiot i najważniejszą konsekwencję.
3. Zdanie nie dodaje nowych faktów, liczb ani pewności, których nie ma w pełnym opisie.
4. Konsultant widzi proponowane zdanie i może je zaakceptować, edytować ręcznie, wygenerować ponownie,
   odrzucić albo przenieść do innej ćwiartki.
5. Dopiero zaakceptowana przez człowieka wersja trafia do macierzy 2×2.
6. Krótkie zdanie zachowuje dwukierunkowe powiązanie z pełnym opisem, dowodami i historią źródłową.

Domyślny limit zdania w macierzy: jedna myśl, maksymalnie około 14 słów. To action-title lub teza,
nie urwany opis i nie pojedyncze ogólne hasło. Pełną treść można otworzyć z punktu bez opuszczania
etapu `SWOT Build`.

Konsultant może również dodać własne krótkie zdanie. Ręcznie utworzony punkt wymaga przypisania
ćwiartki i otrzymuje lineage `manual`; system może poprosić o rozwinięcie lub dowód, ale nie blokuje
samej redakcji.

Lista w `SWOT Build` pokazuje punkty gotowe do macierzy oraz propozycje wymagające decyzji. Nie
pokazuje pustego komunikatu `No points in this quadrant yet`, jeśli lista jest pusta. Ręczne dodawanie
pozostaje pod kompaktowym przyciskiem, zgodnie z §6.8.

### 6.13 Macierz 2×2 jako finalny artefakt konsultingowy

Górna macierz 2×2 nie jest panelem liczników. Jest finalną, prezentacyjną wersją rezultatu SWOT.
Każda ćwiartka pokazuje krótkie, zatwierdzone zdania powstałe w procesie opisanym w §6.12, a nie
samą liczbę punktów.

Wymagania wizualne:

- hierarchia typograficzna wyraźnie rozdziela nazwę ćwiartki, tezy i informacje pomocnicze,
- krój, rozmiar, interlinia i odstępy zapewniają szybkie skanowanie kilku zdań,
- Strengths, Weaknesses, Opportunities i Threats mają spójną, spokojną kolorystykę semantyczną,
- kolor wspiera orientację, ale nie konkuruje z tekstem i nie tworzy efektu czterech przypadkowych
  kafli,
- wszystkie ćwiartki mają wspólną geometrię, rytm, padding i sposób prezentacji punktów,
- dłuższy tekst nie psuje siatki; układ reaguje kontrolowanie na liczbę punktów i szerokość ekranu,
- light i dark mode zachowują tę samą hierarchię, kontrast i znaczenie kolorów,
- stan finalny nie pokazuje pól edycji, przycisków technicznych, placeholderów ani pustych komunikatów.

Macierz musi nadawać się bez dodatkowego projektowania do pokazania sponsorowi, użycia w preview,
raporcie i prezentacji. Interakcja z punktem może otwierać pełny opis i lineage, ale nie obciąża
widoku finalnego.

To jest wzorzec przekrojowy: każde narzędzie konsultingowe ma własny finalny artefakt zgodny ze swoją
metodyką — np. macierz, mapa, łańcuch lub portfolio — lecz wszystkie używają wspólnych zasad
typografii, koloru, gęstości, lineage, trybu finalnego i gotowości do eksportu. Nie wolno sprowadzać
wszystkich narzędzi do identycznej tabeli; standaryzujemy jakość i zachowanie, a nie metodologiczną
formę rezultatu.

### 6.14 `Synthesis & Insights` — wynik analizy w dziewięciu częściach

Dziewięć części `Consulting Synthesis Sheet` opisanych w §4 stanowi właściwy rezultat etapu
`Synthesis & Insights`. Nie jest to pusty formularz do ręcznego wypełnienia ani dziewięć równorzędnych
placeholderów. System generuje roboczą syntezę z zatwierdzonego materiału, a konsultant ją recenzuje,
poprawia i zatwierdza.

#### Wejście do analizy

Analiza korzysta wyłącznie z:

- pełnych opisów i dowodów zaakceptowanych w `Input & Exploration`,
- zatwierdzonych krótkich tez z macierzy `SWOT Build`,
- komentarzy i zmian konsultanta,
- kontekstu misji, zakresu, horyzontu i pytania biznesowego,
- jawnych braków, hipotez, odrzuceń, propozycji odłożonych i konfliktów źródeł.

Odrzucona propozycja nie staje się ustaleniem. Może służyć wyłącznie jako ślad kontrargumentu lub
odrzuconej opcji, z wyraźnym statusem. Brak danych nie może być uzupełniany wiedzą modelu bez jawnie
autoryzowanego źródła.

#### Wynik per sekcja

| # | Sekcja | Co system ma wytworzyć | Minimalna forma widoczna |
|---|---|---|---|
| 1 | Executive Answer | Bezpośrednią odpowiedź na pytanie biznesowe, obejmującą najważniejszy werdykt i poziom pewności. | 2–4 zdania, answer-first; pierwsze zdanie może stanowić nagłówek rezultatu. |
| 2 | Key Findings | Najważniejsze potwierdzone ustalenia wynikające bezpośrednio z materiału. | 3–7 ustaleń; każde: teza, dowód, znaczenie, confidence i source refs. |
| 3 | Key Insights | Nieoczywiste znaczenie łączne: mechanizm, zależność, napięcie, sprzeczność lub przyczyna źródłowa. | 2–5 insightów; każdy łączy co najmniej dwa findings albo wyjaśnia jeden silnym mechanizmem. |
| 4 | Business Implications | Co ustalenia zmieniają dla wyniku firmy, klientów, operacji, ryzyka, zdolności i czasu. | 3–6 implikacji w formule `ponieważ X → zarząd powinien ponownie ocenić Y`. |
| 5 | Conclusions | Zwięzłe, obronione tezy zamykające analizę, bez powtarzania findings. | 3–5 tez ze statusem walidacji i odnośnikami do findings/insights. |
| 6 | Decision Options | Realne warianty wyboru wynikające z conclusions. | 2–4 opcje; efekt, korzyści, ryzyko, wymagania, horyzont i trade-off. |
| 7 | Consultant Recommendation | Preferowany kierunek i argument, dlaczego przewyższa pozostałe opcje. | Jedna rekomendacja; rationale, warunki ważności, trade-off oraz `not recommended`. |
| 8 | Risks, Assumptions & Uncertainties | Granice wiarygodności wyniku i ryzyka podjęcia decyzji. | Jawne listy: risks, assumptions, uncertainties, missing evidence i overall confidence. |
| 9 | Questions Requiring Management Decision | Kwestie, których AI ani konsultant nie może rozstrzygnąć bez sponsora. | 1–5 konkretnych pytań decyzyjnych wraz z konsekwencją odroczenia. |

`Key Findings` odpowiada na pytanie **co wiemy**, a `Key Insights` — **co wynika z połączenia tego,
co wiemy**. System nie może kopiować tych samych zdań do obu sekcji.

#### Sposób prezentacji

- Na górze widoku znajduje się `Executive Answer` jako dominujący blok wynikowy.
- Pozostałe osiem sekcji jest pokazanych w logicznej kolejności, nie jako długa lista pustych kart.
- Wygenerowana sekcja pokazuje tytuł-tezę, właściwą treść, confidence oraz kompaktowe odnośniki do
  dowodów. Kliknięcie dowodu otwiera supporting analysis bez utraty miejsca w syntezie.
- `Needs evidence` pojawia się tylko przy konkretnej tezie wymagającej dowodu, z informacją czego
  brakuje i jak to zweryfikować. Nie jest domyślną etykietą wszystkich pustych sekcji.
- Pusta sekcja nie pokazuje znaku `—`. Pokazuje stan zadaniowy: brak wystarczającego materiału,
  konkretne braki i akcję `Complete evidence` albo `Generate draft`, jeśli bramka wejściowa pozwala.
- Każda sekcja ma spójne działania: `Edit`, `Regenerate`, `View evidence`, `Approve` oraz `Return for
  revision`. AI nie zatwierdza własnego tekstu.
- Status sekcji jest jawny: `Not generated`, `Draft by AI`, `Needs evidence`, `Validated by
  consultant`, `Requires management decision` albo `Rejected`.
- `Supporting analysis` jest warstwą drugorzędną i domyślnie zwiniętą. Zawiera per-area observations,
  relacje, konflikty, źródła i tok dojścia do syntezy, ale nie zastępuje dziewięciu wyników.

#### Kolejność generacji i zależności

Generacja odbywa się warstwowo:

`Findings → Insights → Implications → Conclusions → Decision Options → Consultant Recommendation`

`Executive Answer` powstaje na końcu z całej zatwierdzonej syntezy, mimo że jest prezentowane jako
pierwsze. `Risks, Assumptions & Uncertainties` oraz `Questions Requiring Management Decision` są
aktualizowane na każdym etapie. Zmiana wcześniejszej warstwy oznacza status `Needs review` dla
zależnych sekcji; system nie pozostawia po cichu starej rekomendacji.

#### Bramka ukończenia

Etap jest gotowy do zatwierdzenia dopiero, gdy wszystkie dziewięć sekcji ma treść albo jawne,
zaakceptowane uzasadnienie braku, każda istotna teza ma lineage, a konsultant zatwierdził syntezę.
Zatwierdzenie zamraża wersję wyniku używaną w preview, raporcie i dalszych materiałach. Późniejsza
zmiana tworzy nową wersję i wymaga ponownej walidacji sekcji zależnych.

### 6.15 Osobny etap `Recommendations` zamiast eksponowania `Supporting analysis`

W lewej nawigacji sesji, bezpośrednio po `Synthesis & Insights`, należy dodać osobną pozycję
`Recommendations`. Nie jest to dziesiąty pusty blok syntezy ani kopia wyników. Jest to docelowy widok
decyzyjny, który składa w jedną historię rekomendacje wynikające z całej pracy wykonanej w narzędziu.

Obecne rozwinięcie `Show supporting analysis` nie powinno być głównym sposobem odkrywania rezultatu.
Sekcje takie jak `Per-area observations`, `Internal synthesis`, `External synthesis` i `Strategic
insights` pozostają zapleczem analitycznym oraz źródłem lineage. System wykorzystuje je do budowy
rekomendacji, ale użytkownik nie musi przeglądać długiej technicznej listy, aby znaleźć zalecany
kierunek działania.

#### Zakres widoku `Recommendations`

Widok ma zawierać:

1. `Recommended direction` — jedną nadrzędną rekomendację konsultanta, wynikającą z zatwierdzonej
   syntezy, wraz z krótkim uzasadnieniem i poziomem pewności.
2. `Supporting recommendations` — pozostałe rekomendacje tematyczne lub etapowe, które pomagają
   zrealizować kierunek główny albo zabezpieczyć jego warunki powodzenia.
3. `Decision alternatives` — realne warianty rozważone w analizie, ich zalety, ograniczenia,
   trade-offy i informację, dlaczego nie są kierunkiem preferowanym.
4. `Recommended actions` — konkretne kolejne działania, proponowaną kolejność, właściciela albo rolę,
   horyzont oraz oczekiwany rezultat. Nie są one automatycznie zadaniami ani inicjatywami.
5. `Conditions and guardrails` — założenia, zależności, ograniczenia i sygnały, przy których
   rekomendację trzeba ponownie ocenić.
6. `Management decisions required` — decyzje wymagające sponsora wraz z konsekwencją ich odroczenia.
7. `Recommendation story` — zwięzłą narrację pokazującą tok: pytanie biznesowe → dowody → findings
   → insights → implikacje → opcje → rekomendowany kierunek → następne działania.

`Recommendation story` ma opowiadać całą istotną historię odkrytą przez narzędzie, ale nie może być
surowym zrzutem wszystkich kart analitycznych. Każde zdanie wynikowe musi mieć możliwość otwarcia
powiązanych findings, insightów, punktów SWOT i dowodów. Pełne materiały techniczne pozostają dostępne
przez akcję `View supporting analysis` przy konkretnej rekomendacji.

#### Relacja z dziewięcioma wynikami syntezy

Dziewięć części z §6.14 nadal stanowi kompletny kontrakt analizy. `Recommendations` jest osobnym
widokiem złożonym na podstawie tych samych wersjonowanych danych — przede wszystkim `Decision
Options`, `Consultant Recommendation`, `Risks, Assumptions & Uncertainties` oraz `Questions Requiring
Management Decision`. Nie wolno utrzymywać dwóch niezależnych kopii tych treści. Zmiana zatwierdzonej
syntezy unieważnia zależne rekomendacje i ustawia je w stanie `Needs review`.

#### Sterowanie i odpowiedzialność

- AI może przygotować szkic rekomendacji, wariantów i narracji, lecz konsultant może je edytować,
  odrzucić, uzupełnić i uporządkować.
- Rekomendacja główna wymaga jawnego zatwierdzenia konsultanta; system nie wybiera jej samodzielnie.
- Każda rekomendacja ma status: `Draft by AI`, `Needs evidence`, `Needs review`, `Validated by
  consultant`, `Requires management decision`, `Rejected` albo `Superseded`.
- Widok pozwala dodać rekomendację ręcznie oraz zachować uzasadnienie odrzucenia lub zastąpienia.
- Zatwierdzenie rekomendacji nie tworzy automatycznie inicjatywy, zadania ani decyzji. Przekazanie do
  dalszego obiektu jest osobną, jawną akcją użytkownika z zachowaniem lineage.

### 6.16 Ostatni etap `Results & Readiness` — wyłącznie ocena jakości wykonanej pracy

Obecny widok `Outputs & Actions` należy radykalnie uprościć i zmienić jego znaczenie. Nie jest to
miejsce do generowania dokumentów, raportów, prezentacji, inicjatyw ani innych obiektów. Te operacje
mają własne, dedykowane generatory i nie powinny być powtarzane wewnątrz sesji narzędzia.

Rekomendowana nazwa ostatniej pozycji w lewej nawigacji to `Results & Readiness` (alternatywnie
`Output Health`, jeśli taki termin zostanie przyjęty globalnie). Widok ma odpowiadać wyłącznie na
pytanie: **czy praca wykonana w tym narzędziu jest wystarczająco dobra, kompletna i wiarygodna, aby
zakończyć sesję i udostępnić jej wynik dalszym procesom?**

#### Usuwane elementy

Z ostatniego etapu usunąć:

- `Open Report Generator`,
- `Open Candidate Inbox`,
- `Vault` i `Attach file`,
- przyciski wysyłania do dokumentu, raportu, prezentacji, inicjatywy, zadania lub decyzji,
- tekst sugerujący, że etap służy tworzeniu deliverables,
- warunek `Initiatives defined`, ponieważ inicjatywa nie jest częścią ukończenia SWOT.

Brak tych przycisków nie usuwa możliwości dalszego wykorzystania wyniku. Zatwierdzona, wersjonowana
sesja staje się źródłem dostępnym w odpowiednich generatorach, gdzie użytkownik jawnie wybiera ją jako
kontekst.

#### Zawartość `Results & Readiness`

Widok ma być krótkim podsumowaniem zdrowia rezultatu i zawierać:

1. `Overall readiness` — status `Not ready`, `Ready with reservations` albo `Ready for consultant
   approval`.
2. `AI quality estimate` — pomocniczą ocenę jakości rezultatu wraz z uzasadnieniem, a nie samą liczbę.
3. `Completion` — informację, czy wymagane etapy, obszary i wyniki zostały ukończone.
4. `Evidence coverage` — udział istotnych tez posiadających zweryfikowane źródła oraz listę
   najważniejszych luk dowodowych.
5. `Logical consistency` — wykryte sprzeczności pomiędzy punktami SWOT, findings, insights,
   rekomendacjami i pytaniem biznesowym.
6. `Method quality` — zgodność z regułami danej metodyki, w tym limity, klasyfikacja, kompletność i
   poprawność przejścia między etapami.
7. `Decision usefulness` — ocena, czy wynik prowadzi do jasnej odpowiedzi, opcji i rekomendowanego
   kierunku, zamiast jedynie opisywać materiał.
8. `Open blockers` — krótka lista konkretnych elementów wymagających poprawy przed zatwierdzeniem.
9. `Final result summary` — zwięzłe podsumowanie tego, co zostało osiągnięte i z jakimi
   zastrzeżeniami wynik może być dalej używany.

#### Ocena AI

Ocena AI może być pokazana jako wynik procentowy lub poziom jakości, ale zawsze musi ujawniać:

- oceniane wymiary i ich wynik cząstkowy,
- podstawę oceny oraz wykryte braki,
- rozróżnienie między brakiem danych a niską jakością,
- rekomendowane poprawki prowadzące do wyższego poziomu gotowości,
- informację, że jest to `AI estimate`, a nie zatwierdzenie konsultanta.

Nie należy tworzyć pozornej precyzji przez jedną nieobjaśnioną liczbę. Wynik AI nie może samodzielnie
oznaczyć sesji jako ukończonej ani zastąpić bramki konsultanta. Końcowe działanie to `Submit for
review` lub `Approve result` zależnie od roli i stanu procesu; `Finish` jest dostępne dopiero po
spełnieniu wymaganych bramek albo po jawnym zaakceptowaniu wskazanych zastrzeżeń.

### 6.17 Wspólny łańcuch `Outputs → Insights → Reports → Initiatives` dla Tools i Interview

Końcowe doprecyzowanie zachowuje cztery odrębne klasy obiektów. Wcześniejsze uproszczenie polegające
na zastąpieniu `Outputs` przez `Insights` zostaje wycofane. Po zatwierdzeniu sesji użytkownik pracuje z:

1. `Outputs` — natywnymi, ustrukturyzowanymi rezultatami metodyki danego narzędzia, np. zatwierdzoną
   macierzą SWOT, mapą, scoringiem, listą tez lub portfolio.
2. `Insights` — interpretacją jednego lub wielu zatwierdzonych outputs: ustaleniami, mechanizmami,
   napięciami i znaczeniem biznesowym.
3. `Reports` — publikowalnymi dokumentami tworzonymi na podstawie wybranych outputs, insightów i
   dowodów.
4. `Initiatives` — propozycjami działań transformacyjnych tworzonymi na podstawie outputs,
   insightów, raportów lub ich zatwierdzonego zestawu.

Nie należy traktować tych zakładek jako różnych nazw dla tego samego rekordu. Każda ma własny cykl
życia, właściciela, status, lineage i bramkę zatwierdzenia. Output nie jest insightem, insight nie jest
raportem, a raport nie staje się inicjatywą bez jawnej decyzji użytkownika.

#### Jeden standard kreatorów

Tworzenie lub publikowanie `Output`, `Insight`, `Report` i `Initiative` odbywa się przez kreatory o wspólnym standardzie
graficznym i nawigacyjnym, wypracowanym dla modułu Interview. Kreatory korzystają z jednego shellu:

- ten sam standard rozmiaru i responsywności okna,
- ten sam nagłówek, stepper, obszar treści i stałą stopkę akcji,
- jeden model przycisków `Cancel`, `Back`, `Next` oraz końcowej akcji,
- widoczny wybór źródeł, podsumowanie zaznaczenia i możliwość powrotu bez utraty danych,
- wspólne stany walidacji, generowania, błędu, braku danych i zapisu szkicu,
- spójne nazewnictwo, gęstość, typografię oraz zachowanie przewijania,
- jawne lineage pokazujące, z których zatwierdzonych obiektów powstaje rezultat.

Wspólny shell nie oznacza identycznych pól. `Output Review` finalizuje natywny rezultat metodyki,
`Insight Creator` interpretuje materiał, `Report Creator` buduje publikowalny dokument, a `Initiative
Creator` tworzy propozycję działania i governance.

#### `Reports` także w module Interview

Do modułu Interview należy dodać osobną zakładkę `Reports`, zgodną z tą samą architekturą. Pozwala
ona tworzyć raporty na podstawie zatwierdzonych sesji i insightów z Interview, w szczególności:

- dokument tekstowy / Word,
- prezentację / PowerPoint,
- inne wspierane formaty dopiero po zdefiniowaniu ich kontraktu.

Raport powstaje w dedykowanym `Report Creator`, a nie wewnątrz karty sesji, preview ani ekranu
`Results & Readiness`. Kreator pozwala wybrać źródła, typ dokumentu, szablon lub tryb bez szablonu,
zakres, odbiorcę, język i poziom szczegółowości. Wygenerowany raport zachowuje lineage do sesji,
insightów, wykorzystanych wersji i dowodów oraz przechodzi osobną recenzję przed oznaczeniem jako
gotowy.

Ta sama zakładka i ten sam `Report Creator` powinny być współdzielonym wzorcem platformowym dla
Interview i Tools; różni się dostępny koszyk źródeł, nie mechanika tworzenia raportu.

### 6.18 Kanoniczna instrukcja organizacji każdego narzędzia konsultingowego

Każde obecne i przyszłe narzędzie w module Tools musi być implementowane jako wariant jednego modelu
pracy konsultingowej, a nie jako niezależna miniaplikacja. Metodyka zmienia treść kroków i finalny
artefakt, ale nie zmienia kontraktu sesji, nawigacji, decyzji człowieka, dowodów ani dalszego
przetwarzania wyników.

#### A. Warstwy systemu

Każde narzędzie składa się z sześciu warstw:

1. `Library definition` — opis celu, zastosowania, ograniczeń, wymaganych wejść, kroków, outputs i
   przykładów. To definicja metodyki, nie sesja użytkownika.
2. `Session` — wersjonowany przebieg zastosowania narzędzia do konkretnego pytania biznesowego.
3. `Native output` — zatwierdzony rezultat właściwy dla metodyki, zachowujący jej najlepszą formę
   wizualną.
4. `Insights` — interpretacja znaczenia jednego lub wielu outputs.
5. `Reports` — publikowalne dokumenty dla wskazanego odbiorcy.
6. `Initiatives` — proponowane działania, które dopiero po osobnym zatwierdzeniu mogą przejść do
   realizacji.

#### B. Obowiązkowy przebieg sesji

Każda sesja przechodzi przez ten sam logiczny kręgosłup:

`Mission & Context → Input & Exploration → Method Build → Synthesis & Insights → Recommendations → Results & Readiness → Review`

- `Mission & Context` definiuje pytanie biznesowe, zakres, horyzont, sponsora, kryterium sukcesu i
  granice analizy.
- `Input & Exploration` zbiera pełne opisy, materiały, źródła, propozycje AI i decyzje konsultanta.
- `Method Build` przekłada zaakceptowany materiał na strukturę właściwą dla metodyki.
- `Synthesis & Insights` generuje uporządkowane findings, insights, implikacje, wnioski i opcje.
- `Recommendations` składa pełną historię rekomendacyjną i wskazuje preferowany kierunek.
- `Results & Readiness` ocenia jakość, kompletność, dowody, spójność i gotowość wyniku.
- `Review` daje uprawnionej osobie możliwość zatwierdzenia albo odesłania z komentarzem.

Narzędzie może nazwać `Method Build` zgodnie z metodą, np. `SWOT Build`, ale nie może pomijać
odpowiedzialności pozostałych etapów. Każdy krok zapisuje stan i daje się ponownie otworzyć przez deep
link bez utraty decyzji.

#### C. Model współpracy AI z konsultantem

AI proponuje, porządkuje, porównuje, skraca i wskazuje luki. Konsultant:

- akceptuje, edytuje, odrzuca, odkłada albo zastępuje propozycję,
- może dodać materiał ręcznie,
- widzi źródła, poziom pewności i uzasadnienie,
- zatwierdza interpretację oraz rekomendację,
- odpowiada za finalny wynik.

Żadna propozycja AI nie staje się zatwierdzonym outputem, insightem, rekomendacją, raportem ani
inicjatywą bez jawnej bramki człowieka. Wiedza modelu nie może wypełniać luk dowodowych bez
autoryzowanego źródła.

#### D. Kontrakt danych i lineage

Każdy rekord wynikowy przechowuje co najmniej:

- identyfikator organizacji, narzędzia, sesji i wersji,
- typ obiektu: output, insight, report albo initiative,
- status i właściciela,
- źródła wejściowe wraz z ich wersjami,
- relację do tez, dowodów i decyzji konsultanta,
- autora: AI, człowiek lub materiał importowany,
- confidence, braki i zastrzeżenia,
- historię zmian, zatwierdzeń, odesłań i zastąpień.

Zmiana źródła po zatwierdzeniu nie nadpisuje historii. Tworzy nową wersję i oznacza zależne obiekty
jako `Needs review`. Rekord bez lineage nie może uzyskać statusu finalnego.

#### E. Cztery katalogi wynikowe i ich kreatory

| Obiekt | Co zawiera | Dozwolone źródła | Końcowa bramka |
|---|---|---|---|
| Output | Finalny artefakt metodyki i jego dane strukturalne. | Jedna zatwierdzona sesja narzędzia. | `Output approved`. |
| Insight | Ustalenie lub interpretację o znaczeniu biznesowym. | Zatwierdzone outputs, sesje i dowody. | `Insight validated`. |
| Report | Dokument lub prezentację dla określonego odbiorcy. | Zatwierdzone outputs, insights i wybrane źródła. | `Report approved for use`. |
| Initiative | Propozycję działania z celem, zakresem, KPI, właścicielem, ryzykiem i governance. | Zatwierdzone outputs, insights i reports. | `Initiative proposed`; uruchomienie wymaga osobnej decyzji. |

Wszystkie kreatory wykorzystują jeden kanoniczny shell zaczerpnięty ze standardu `Insight Creator`:

1. `Define` — cel, nazwa, typ i oczekiwany rezultat.
2. `Sources` — jawny wybór wyłącznie kwalifikowanych źródeł.
3. `Configure` — ustawienia właściwe dla typu obiektu.
4. `Generate / Compose` — utworzenie wersji roboczej z czytelnym stanem postępu i błędów.
5. `Review` — podgląd, edycja, dowody, zastrzeżenia i kontrola jakości.
6. `Approve / Save draft` — jawne zakończenie odpowiednie do roli użytkownika.

Kreator ma duże, responsywne okno, widoczny stepper, pojedynczy obszar przewijania, stałą stopkę,
jedną akcję główną i brak ukrytych obowiązkowych pól poniżej niewidocznego folda. Zamknięcie lub krok
wstecz nie może usuwać danych bez ostrzeżenia.

#### F. Statusy i bramki

Wspólny minimalny model stanów to:

`Draft → In progress → Submitted for review → Approved / Sent back → Superseded / Archived`

Obiekty specjalistyczne mogą mieć dodatkowe stany, ale nie mogą omijać review. `Sent back` wymaga
komentarza i ponownie otwiera edycję. `Approved` zapisuje osobę, czas, wersję i zakres zatwierdzenia.
Status sesji nie jest automatycznie statusem jej insightów, raportów ani inicjatyw.

#### G. Standard widoków katalogowych i preview

Każdy katalog `Outputs`, `Insights`, `Reports` i `Initiatives` stosuje:

- wspólny kształt tabeli, filtrowanie, sortowanie, zaznaczenie i stany puste,
- menu prawego przycisku i kebaba z tym samym zestawem akcji dla tego samego typu oraz stanu,
- preview o wspólnej strukturze: tożsamość, status, kluczowe podsumowanie, jakość, źródła, relacje,
  historia i działania właściwe dla stanu,
- jeden standard primary/secondary/destructive actions,
- brak funkcji przypadkowych lub niedostępnych w danym kontekście.

Preview ma pomagać zrozumieć rezultat bez otwierania pełnego dokumentu. Nie może być tylko pustym
panelem właściwości ani kopią wiersza tabeli.

#### H. Warunki dopuszczenia nowego narzędzia

Nowe narzędzie nie jest gotowe do biblioteki, dopóki nie ma:

1. opisanej metodyki, zastosowań i ograniczeń,
2. kontraktu wejść, etapów i natywnego outputu,
3. mapowania pełnego dialogu AI i decyzji człowieka,
4. definicji syntezy, rekomendacji oraz jakości wyniku,
5. wspólnego lineage i wersjonowania,
6. integracji z katalogami Outputs, Insights, Reports i Initiatives,
7. preview, menu, stanów pustych, błędów i accessibility zgodnych ze standardem,
8. testu zapisu, ponownego otwarcia, review, send-back i approval,
9. dowodów dla light/dark oraz desktop/tablet/mobile,
10. ręcznej akceptacji właściciela produktu.

Ten rozdział jest wzorcem obowiązującym wszystkie narzędzia konsultingowe. Odstępstwo metodologiczne
jest dozwolone tylko wtedy, gdy zostało jawnie opisane; odstępstwo od governance, lineage, review lub
standardu kreatora wymaga osobnej decyzji platformowej.

## 7. Macierz odbioru A–K

| ID | Warunek akceptacji |
|---|---|
| A | Realne logowanie i ścieżka Biblioteka → Dynamic SWOT → Open działają na wskazanym środowisku. |
| B | Stan przed startem ma jeden nagłówek, jeden primary CTA, ograniczony chrome i prawy panel właściwości. |
| C | Aktywna sesja ma spójny nagłówek, lewą nawigację etapów, centrum pracy i prawy rail. |
| D | Ukończenie, ponowne otwarcie, zapis i deep link zachowują dane oraz decyzje konsultanta. |
| E | Widoki 1440, 768 i 390 px nie tracą treści, akcji ani nawigacji i nie mają niedozwolonego overflow. |
| F | Wersje PL i EN nie mieszają etykiet, terminów ani encji. |
| G | Jasny i ciemny motyw zachowują czytelność oraz hierarchię. |
| H | Klawiatura, fokus, Enter i Space działają bez pułapek i niewidocznych akcji. |
| I | Cold reload i deep link odtwarzają prawidłowy stan każdego etapu. |
| J | Brak błędów konsoli i odpowiedzi HTTP ≥400 w ścieżce odbiorowej. |
| K | Istnieje komplet dowodów ekranowych, a Piotr przeprowadził ręczną akceptację wizualną i użytkową. |

Brak dowodu dla któregokolwiek punktu oznacza `NOT_TESTED` lub `EVIDENCE_MISSING`, nie `PASS`.

## 8. Rekomendacje wdrożeniowe

### R1 — Wspólny kontrakt sesji narzędzia

Zdefiniować wspólną strukturę stanu, dowodów, walidacji i postępu dla SWOT oraz kolejnych narzędzi.
Logika metodyki jest rozszerzeniem kontraktu, nie osobną aplikacją.

### R2 — Prowadzony dialog AI z decyzją konsultanta

Każda propozycja AI musi obsługiwać: zaakceptuj, kolejna propozycja, komentarz, pogłębienie,
edycję, źródło i historię. Żadna propozycja nie może przejść do wyniku bez jawnego statusu.

### R3 — Uniwersalna karta syntezy

Wdrożyć dziewięciosekcyjną `Consulting Synthesis Sheet` jako wspólny rezultat tooli. Renderery,
raporty i prezentacje korzystają z tego samego modelu danych oraz lineage.

### R4 — Bramka decyzji przed inicjatywą

Oddzielić technicznie i językowo rezultat analizy, rekomendację, decyzję zarządczą i inicjatywę.
Konwersja do inicjatywy jest osobnym kreatorem uruchamianym świadomie przez użytkownika.

### R5 — Jedna powłoka sesji

Ujednolicić nagłówek, lewą nawigację, centrum oraz prawy rail na podstawie zaakceptowanego kierunku
Dynamic SWOT i Biblioteki. Nie przenosić mechanicznie wszystkich pól; zachować role poszczególnych
obszarów ekranu.

### R6 — Walidacja i dowody odbioru

Zautomatyzować walidatory jakości wniosku, persistence/readback i macierz A–J. Punkt K pozostaje
bramką właścicielską. Test techniczny nie zastępuje akceptacji właściciela.

### R7 — Usunięcie zdublowanej listy S/W/O/T

Usunąć wewnętrzną pionową listę czterech obszarów z `Input & Exploration`. Zachować wyłącznie
poziome zakładki S/W/O/T wraz z licznikami i wykorzystać odzyskaną szerokość na właściwą treść
pracy konsultanta.

### R8 — Usunięcie czterech kafli podsumowujących

Usunąć rząd `Accepted Points / Confirmed Areas / Active Dialogues / Maximum Target`. Zachować
liczniki w poziomych zakładkach S/W/O/T, a komunikaty wymagające działania pokazywać wyłącznie
kontekstowo.

### R9 — Podniesienie karty aktualnej propozycji AI

Przenieść `Current AI Proposal` bezpośrednio pod zakładki S/W/O/T i uczynić z niej główny komponent
etapu. Sekcję zaakceptowanych punktów oraz ręczne dodawanie umieścić poniżej.

### R10 — Usunięcie pustego stanu i powtórzonych chipów

Nie renderować sekcji zaakceptowanych punktów, dopóki jej licznik wynosi zero. Usunąć komunikat
o braku punktów oraz chipy `Accepted` i `Attempts`; licznik zaakceptowanych punktów pozostaje w
zakładce S/W/O/T, a próby wyłącznie w metadanych lub historii.

### R11 — Ręczny punkt pod przyciskiem

Zastąpić stale widoczne pole ręcznego wpisywania przyciskiem `Add your own`. Kliknięcie rozwija
edycję inline z akcjami zapisu i anulowania; zapisany punkt otrzymuje lineage `manual`.

### R12 — Pętla propozycji AI i zarządzanie limitem pięciu punktów

Zbudować jednoekranową pętlę: propozycja AI → decyzja konsultanta → aktualizacja listy → następna
propozycja. Dodać statusy `Accepted`, `Rejected`, `Deferred`, `Removed` oraz działania edycji,
usunięcia, odłożenia i zastąpienia. Przy `5/5` zablokować szósty aktywny punkt i zaoferować przegląd
listy albo odłożenie propozycji.

### R13 — Naprawa powierzchni i kolorów `SWOT Build`

Usunąć ciemnogranatowe tło `SWOT Build` z light mode. Przepiąć cały etap na tokeny aktywnego motywu,
pozostawiając barwy S/W/O/T jako oszczędne akcenty semantyczne. Zweryfikować pełny widok w light i
dark mode.

### R14 — Usunięcie calloutu instrukcyjnego

Usunąć górny blok tekstowy z `SWOT Build`. Po wejściu w etap użytkownik od razu widzi macierz i
narzędzia pracy; ewentualne objaśnienia są krótkie i kontekstowe.

### R15 — AI skraca pełne opisy do macierzy, człowiek zatwierdza

Zbudować transformację zaakceptowanych opisów z `Input & Exploration` na krótkie zdania w
`SWOT Build`. Każda propozycja wymaga decyzji konsultanta i obsługuje ręczną edycję, regenerację,
odrzucenie oraz zmianę ćwiartki. Zachować link do pełnego opisu, dowodów i historii.

### R16 — Prezentacyjny standard finalnych artefaktów tooli

Przebudować macierz SWOT 2×2 tak, aby prezentowała zatwierdzone krótkie zdania jako gotowy materiał
konsultingowy. Zdefiniować wspólne tokeny typografii, kolorów, odstępów, responsywności i trybu
finalnego dla rezultatów wszystkich tooli, zachowując właściwą wizualizację każdej metodyki.

### R17 — Pełny kontrakt dziewięciu wyników syntezy

Wdrożyć generację, prezentację, statusy, lineage i recenzję dziewięciu części `Synthesis & Insights`
zgodnie z §6.14. Egzekwować zależności pomiędzy warstwami, odróżnić findings od insights i wymagać
zatwierdzenia konsultanta przed zamrożeniem wersji wynikowej.

### R18 — Osobny widok `Recommendations` i pełna historia rekomendacyjna

Dodać pozycję `Recommendations` w lewej nawigacji sesji. Zbudować ją jako wersjonowany widok
decyzyjny korzystający z wyników `Synthesis & Insights`, a nie jako osobny magazyn duplikowanych
treści. Pokazać rekomendację główną, rekomendacje wspierające, alternatywy, działania, warunki,
decyzje zarządcze i pełną narrację prowadzącą od dowodów do zalecanego kierunku. `Supporting
analysis` udostępniać kontekstowo jako dowód i lineage, nie jako główny rezultat dla użytkownika.

### R19 — Uproszczenie końca sesji do `Results & Readiness`

Zastąpić `Outputs & Actions` krótkim widokiem oceny jakości, kompletności, pokrycia dowodami,
spójności, zgodności metodologicznej i użyteczności decyzyjnej. Usunąć wszystkie skróty do generatorów,
Vault i tworzenia obiektów downstream. Dodać wyjaśnioną ocenę AI, listę blokad, podsumowanie wyniku
oraz jawną bramkę recenzji konsultanta. Zatwierdzona sesja ma być wybierana później jako źródło w
dedykowanych generatorach.

### R20 — Platformowy standard `Outputs`, `Insights`, `Reports`, `Initiatives` i ich kreatorów

Zachować cztery osobne katalogi wynikowe: `Outputs`, `Insights`, `Reports` i `Initiatives`. Dla każdej
klasy obiektu wdrożyć kreator korzystający ze wspólnego shellu oraz wzorca nawigacji z `Insight
Creator` i Interview. Dodać `Reports` również do modułu Interview i użyć tego samego `Report Creator`
do tworzenia dokumentów oraz prezentacji z zatwierdzonych sesji, outputs i insightów. Zachować
odrębne cykle życia, approval i pełne lineage; nie umieszczać generatorów wewnątrz sesji narzędzia.

### R21 — Obowiązkowy blueprint dla wszystkich narzędzi konsultingowych

Wdrożyć kontrakt z §6.18 jako platformowy wzorzec tworzenia każdego narzędzia. Współdzielić strukturę
sesji, odpowiedzialność AI i konsultanta, model danych, wersjonowanie, katalogi wynikowe, kreatory,
statusy, review, preview, menu i bramki jakości. Metodyka może zmieniać treść `Method Build` oraz formę
natywnego outputu, lecz nie może tworzyć własnego, sprzecznego systemu pracy ani omijać lineage i
zatwierdzenia człowieka.

## 9. Definition of Done tej przebudowy

Przebudowa jest zamknięta dopiero, gdy:

1. konsultant może przejść cały proces bez ręcznego omijania etapów,
2. każda teza ma lineage, status i poziom pewności,
3. rezultat odpowiada na pytanie biznesowe, a nie tylko prezentuje macierz,
4. karta syntezy zawiera wszystkie dziewięć sekcji lub jawne uzasadnienie braku,
5. system nie tworzy inicjatywy bez osobnej decyzji,
6. zapis i ponowne otwarcie zachowują komplet danych i decyzji,
7. wszystkie bramki A–J mają dowód PASS,
8. Piotr nadał punktowi K status `ACCEPTED`.

Lewy panel sesji zawiera osobny etap `Recommendations` po `Synthesis & Insights`. Widok pokazuje
pełną, zatwierdzalną historię rekomendacyjną i nie duplikuje danych syntezy. Każda rekomendacja ma
status, źródła, confidence i lineage, a zmiana jej podstawy wymusza ponowną recenzję. Supporting
analysis pozostaje dostępne kontekstowo, lecz nie zastępuje rekomendacji ani ich narracji.

Ostatni etap nie zawiera generatorów, Vault ani akcji tworzenia obiektów downstream. Pokazuje tylko
zdrowie rezultatu, ocenę AI z uzasadnieniem, pokrycie dowodami, spójność, kompletność, blokady i
podsumowanie. AI nie może samodzielnie zatwierdzić sesji, a gotowy wynik pojawia się jako źródło w
dedykowanych generatorach dopiero po przejściu bramki konsultanta.

Moduł Tools ma cztery niezależne katalogi: `Outputs`, `Insights`, `Reports` i `Initiatives`. Wszystkie
klasy mają kreatory o jednym standardzie interakcji i zachowują rozdzielne rekordy, statusy oraz
lineage. Moduł Interview ma dodatkową zakładkę `Reports`, która korzysta z tego samego `Report
Creator` i potrafi utworzyć co najmniej dokument oraz prezentację z zatwierdzonych źródeł. Żaden
insight, raport ani inicjatywa nie powstaje automatycznie po zakończeniu sesji.

Każde nowe narzędzie przechodzi pełny blueprint z §6.18: definicję biblioteczną, wersjonowaną sesję,
natywny output, syntezę, rekomendacje, ocenę gotowości, review oraz integrację z czterema katalogami.
Nie zostaje dopuszczone do biblioteki bez testu persistence/readback, approval/send-back, lineage,
preview, menu, responsywności, obu motywów i ręcznej akceptacji właściciela.

Dodatkowo widok `Input & Exploration` nie zawiera równocześnie pionowej i poziomej nawigacji
S/W/O/T; jedynym selektorem obszaru są poziome zakładki.

Widok nie zawiera również osobnego rzędu czterech kafli licznikowych. Po zakładkach S/W/O/T
użytkownik przechodzi bezpośrednio do treści wybranego obszaru.

Pierwszym elementem tej treści jest kompletna karta `Current AI Proposal`; jest widoczna wraz ze
wszystkimi czterema akcjami konsultanta bez konieczności przewijania przy standardowej wysokości
ekranu odbiorowego.

Przy zerowym wyniku nie występuje pusta karta zaakceptowanych punktów, komunikat o ich braku ani
chipy `Accepted` i `Attempts`. Po zaakceptowaniu punktu lista pojawia się w kompaktowej formie pod
aktualną propozycją AI.

Pole ręcznego wpisywania jest domyślnie zwinięte. Otwiera je jawny przycisk, zapis tworzy punkt ze
źródłem `manual`, a anulowanie przywraca zwinięty stan bez utworzenia rekordu.

Po każdej akceptacji licznik rośnie, zaakceptowany punkt pojawia się na liście, a AI proponuje kolejny
bez zmiany ekranu. Przy `5/5` nie da się utworzyć szóstego aktywnego punktu; użytkownik może usunąć,
odłożyć lub zastąpić istniejący punkt albo zachować nową propozycję na później. Wszystkie zmiany
statusu zachowują historię i lineage.

W light mode cały `SWOT Build` jest jasny i spójny z powłoką sesji; w dark mode jest spójny z
kanoniczną ciemną paletą. Żaden fragment nie zachowuje kolorów przeciwnego motywu, a oznaczenia
S/W/O/T pozostają czytelne i drugorzędne wobec treści.

Widok `SWOT Build` nie zawiera górnego calloutu opisującego działanie etapu; właściwa powierzchnia
robocza zaczyna się bezpośrednio po nagłówku lub nawigacji etapu.

Każdy zaakceptowany opis wejściowy może zostać przekształcony w krótkie zdanie do macierzy. AI nie
zmienia sensu ani nie dodaje faktów; człowiek zatwierdza lub redaguje wersję końcową. Z punktu 2×2
można odczytać pełny opis i lineage, a zapis oraz ponowne otwarcie zachowują obie wersje treści.

Finalna macierz 2×2 pokazuje rzeczywiste zatwierdzone zdania, nie wyłącznie liczniki. Jest czytelna
w light/dark oraz na szerokościach z bramki E, nie zawiera elementów edycyjnych i może zostać użyta
w preview, raporcie i prezentacji bez ręcznego przeprojektowania. Analogiczny test obowiązuje finalny
artefakt każdego kolejnego narzędzia.

Etap `Synthesis & Insights` generuje wszystkie dziewięć wyników z zatwierdzonego materiału. Każda
sekcja ma treść zgodną z kontraktem, jawny status, confidence i lineage albo zaakceptowane
uzasadnienie braku. Findings i insights nie dublują się, zmiana warstwy wcześniejszej unieważnia
zależne wyniki, a zatwierdzona wersja jest identycznie odczytywana po ponownym otwarciu i w preview.

## 10. Źródła prawdy wykorzystane do konsolidacji

- Rozmowa właścicielska „Automatyzacja narzędzi konsultingowych”, 2026-08-19 — trzy pełne tury
  dotyczące automatyzacji tooli, uniwersalnej karty syntezy i standardu pracy konsultanta.
- Wcześniejsza warstwa ustaleń o Dynamic SWOT, odtworzona z zachowanych wypowiedzi, ekranów i
  późniejszego odbioru — model sesji, akceptowanie i pogłębianie propozycji AI, układ etapów oraz
  rola konsultanta. Nie zidentyfikowano jej jako osobnego, jednoznacznie zatytułowanego zadania.
- Późniejszy odbiór „SWOT — SSOT odbioru A–K” — wymagania interfejsu i macierz dowodowa.
- `docs/standards/CONCLUSION_LAYER_STANDARD.md` — kanon K1–K4 i wariant W2 dla outputu toola.
- `docs/standards/CARD_CONTENT_FORMULA.md` — lineage, jakość kart i separacja wniosku od inicjatywy.

W razie konfliktu pierwszeństwo mają jawne decyzje właściciela zapisane w tym dokumencie, następnie
kanony SSOT. Istniejący kod, fixture, zrzut albo historyczny commit nie są samodzielnie źródłem
prawdy produktowej.
