---
doc_id: dziennik-grafika
status: canonical
truth_type: event-log
established: 2026-08-30
zasada_zrodlowa: 00_ZASADY_PRACY.md reguła nr 10 (dokumentuj kontekst zdarzenia)
---

# Dziennik toru Grafika — chronologia zdarzeń i ich kontekst

**Po co ten plik.** Wynik zapisuje się sam — jest w kodzie i w commicie. Tu zapisujemy
to, czego z wyniku odtworzyć się nie da: dlaczego tak zdecydowano, co się okazało
nieprawdą, kto co zgłosił, i czym rzecz omal się nie skończyła.

Nowe wpisy **na górze**. Każdy wpis: co się stało · dlaczego to ważne · co z tego wynika.

---

## 2026-08-30, sesja wieczorna (przejęcie toru po poprzedniku)

### Z-12 · Macierz ZNALEZIONA — właściciel przysłał zrzuty z żywego produktu
**Co się stało:** po dwóch moich pudłach właściciel przysłał **zrzuty ekranu z działającej
aplikacji**. To rozstrzygnęło sprawę w dziesięć minut, po godzinach mojego szukania.

**Czym jest ta macierz** (`src/components/assessment/drd/DRDAssessmentEditor.tsx`, **2333 linie,
ŻYWA i wpięta** — `src/views/AssessmentSessionEditorView.tsx:28`, zakładka obok Formularza):
- **wiersze = poziomy** dojrzałości, od najwyższego u góry („7. Autonomous") do „1. Basic / Manual"
- **kolumny = obszary** osi (1A Sales Processes, 1B Marketing…), nagłówki obszarów w **dolnym**
  wierszu „AREA", każdy z chipem stanu (`AS 2`, `TO 4`)
- **komórka niesie treść merytoryczną**, nie kropkę: nazwę technologii/stanu dla tego poziomu
  w tym obszarze („CRM", „ERP · WMS", „MES", „AI Support", „Basic Data Registration")
- **dwa znaczniki naraz**: AS-IS (stan obecny) i TO-BE (cel) — legenda w prawym górnym rogu
- **klik w komórkę otwiera popover** z opisem poziomu, przykładem („EXAMPLE" z dowodem, jaki
  konsultant ma zebrać) i **dwoma przyciskami: „Set AS-IS" i „Set TO-BE"** — tak powstaje ocena
- przełącznik gęstości („Spacious"), tryb pełnoekranowy, `Esc` zamyka
- pod macierzą liczby zbiorcze osi (1.5 · 4.0 · 2.5 · 2/9)

**Słowa właściciela:** *„tak ma wyglądać macierz. I ona pokazuje i pozwala się poruszać po niej.
(…) Oczywiście to jest strasznie brzydkie, co tutaj masz (…) Cały ten stary ekran to jest jakby
prehistoryczny ekran, ale ta logika pracy jest najłatwiejsza. Zresztą jak zajrzysz do mojej
książki, do załączników, zobaczysz tę samą formułę."*

**Czego to uczy — trzeci raz w tej samej sprawie:**
1. Szukałem komponentu po **geometrii** (obszary × poziomy) i znalazłem `AreaMatrixTable` —
   geometria się zgadzała, ale to była prezentacja raportowa. Właściciel mówił „**narzędzie**".
2. Potem wskazał SIRI jako wzorzec — poszedłem tam i zobaczyłem macierz **transponowaną**
   (poziomy na X), więc znów nie to.
3. Rozstrzygnęły dopiero **jego zrzuty z żywej aplikacji**.

**Wniosek operacyjny:** kiedy właściciel opisuje ekran, który u siebie widzi, **najtańszym ruchem
jest poprosić o zrzut**, a nie szukać po opisie. Trzy podejścia i kilka godzin robotników
zastąpiłby jeden obrazek. Formuła: *„pokaż mi to u siebie"* przed *„poszukam w kodzie"*.

**Drugi wniosek:** macierz **nie była martwa ani pozbawiona wejścia** — była żywa cały czas.
Moje trzy poprzednie znaleziska (`AreaMatrixTable`, `EmbeddedMatrix`, `DRDMatrixSession`) to
**boczne, martwe warianty tej samej rzeczy**. Szukając „gdzie to jest", trafiałem w kopie,
bo kopii jest w tym repo więcej niż oryginałów.

**Co dalej (kolejność ustalona z właścicielem):** logika pracy zostaje nietknięta — jest,
jego słowami, „najłatwiejsza". Do zmiany jest **wyłącznie warstwa wizualna**, i to formułą
polerowania: audyt stanu zastanego → nazwanie defektów → prototyp → akcept na zrzucie →
budowa 1:1. **Nie przebudowywać 2333 linii w ciemno.**

**Do sprawdzenia:** właściciel wskazał **załączniki swojej książki** (`knowledge/DRD/*.pdf`,
appendix od `extracted_content.txt:455`) jako źródło tej samej formuły — komórki macierzy mają
odpowiadać opisom poziomów per obszar. To pozwala zweryfikować, czy treść komórek w produkcie
zgadza się z metodyką.

### Z-10 · Macierz — WSTRZYMANE przez właściciela, wzorcem jest SIRI
**Co się stało:** wyrenderowałem `AreaMatrixTable` (siatka obszary × poziomy) i pokazałem
właścicielowi. Odpowiedź: *„Stary, to nie tak ma wyglądać. Zatrzymaj się z tą pracą.
To tak nie wygląda macierz. Jak wejdziesz w [SIRI], to sobie znajdziesz."*

Zatrzymałem robotnika w trakcie (schodki + polskie poziomy + ciemny motyw) — **nie zdążył
zmienić ani jednego pliku**, zweryfikowane `git status`.

**Co pokazuje SIRI** (`dev-render/siri-workspace.html`, **wymaga `&view=matrix`** — bez tego
renderuje widok wywiadu): „Macierz na żywo" — wiersze to jednostki oceny, kolumny to poziomy
L0–L5, **komórki są klikalne**, ocena powstaje przez klikanie w siatce. Stan obecny wypełniony,
cel obramowany, po prawej `Current · Target · Gap` na wiersz. Legenda stanów: propozycja AI,
review, blocker, luka dowodowa, nieoceniony.

**Na czym polegała moja pomyłka:** zbudowałem **prezentację do raportu**, a właściciel od
początku mówił o **narzędziu**: *„macierz jest ważna, bo jest narzędziem. To nie jest tylko
prezentacja, to jest narzędzie, które sprawia, że wchodzimy w interakcję."* Miałem to zdanie
zapisane w `MAPA_UWAG_WLASCICIELA.md` (klaster K5) i **i tak zbudowałem prezentację** — bo
szukałem komponentu pasującego do opisu geometrii („obszary na dole, poziomy na Y"), zamiast
do opisu funkcji. Geometria była tylko pół specyfikacji; drugie pół brzmiało „ma być klikalna".

**Co z tego wynika:**
- Wzorzec macierzy DRD = **SIRI**, nie `AreaMatrixTable`. Potwierdzenie kierunku czeka
  na właściciela (zapytany, obiecał wrócić z odpowiedzią).
- **Nic z pracy nad macierzą nie idzie dalej bez tego potwierdzenia.** Zacommitowane zostaje
  jako dowód (ekran harnessu + zrzuty), nie jako kierunek.
- Reguła na przyszłość: **gdy właściciel opisuje rzecz dwoma zdaniami — o wyglądzie i o działaniu
  — dopasowanie do jednego z nich nie jest trafieniem.** Szukaj komponentu spełniającego oba,
  a jak nie ma takiego, powiedz to, zamiast wybierać ładniejszą połowę.

**Nierozstrzygnięte:** czy macierz SIRI ma jedną siatkę dla wszystkich jednostek, a DRD ma mieć
siedem (po jednej na oś) — właściciel mówił o „siedmiu macierzach". Nie zgadywać drugi raz.

### Z-11 · Właściciel nie może się zalogować — odmówiłem ruszania hasła
Zgłosił, że po wczorajszej wymuszonej zmianie hasła nie wpuszcza go do aplikacji. **Nie
resetowałem hasła ani nie ruszałem konta** — to jego dane i jego konto, także w bazie demo.
Zaproponowałem jedyną rzecz, która jest moją robotą: sprawdzenie, czy ścieżka „nie pamiętam
hasła" **w ogóle działa**, bo jeśli nie działa, to defekt dotykający każdego klienta.
Właściciel odłożył temat („wrócę do ciebie z tą informacją") — **zadanie otwarte, do podjęcia,
gdy wskaże środowisko.**

### Z-9 · Prawda o osiach DRD żyła w SZEŚCIU kopiach — trzecie sprostowanie tego samego dnia
**Co się stało:** naprawa liczby poziomów osi w macierzy odsłoniła, że konfiguracja
osi DRD jest w kodzie powielona **sześć razy**. Jedna kopia jest źródłem prawdy
(`src/services/drdStructure.ts`, poprawna), pięć pozostałych to odklejone duplikaty:

| miejsce | błąd | stan |
| --- | --- | --- |
| `src/components/Reports/EmbeddedMatrix.tsx` | kultura i cyber 5 zamiast 6 | **naprawione** — podłączone do źródła |
| `src/components/Reports/RadarChart.tsx` | to samo, idzie do `fullMark` wykresu | w naprawie |
| `src/components/Reports/ImportReportModal.tsx` | to samo, jako `max` pola formularza | w naprawie |
| `server/src/services/reportImportService.ts` | to samo, po stronie serwera | w naprawie |
| `server/src/services/aiAssessmentPartnerService.ts` | **inny kształt** — wymyślone opisy poziomów 6–7 dla osi mających 5 | wstrzymane, decyzja właściciela |
| `src/components/Reports/AxisReportSection.tsx` | `maxLevel = 7` na sztywno dla wszystkich osi | podejrzenie martwego kodu, weryfikowane |

**Dlaczego ważne:** to **trzecie sprostowanie moich własnych słów tego samego dnia**
w tej jednej sprawie. Kolejno mówiłem właścicielowi: (1) macierz ma dwie skale —
nieprawda, ma trzy; (2) kod ma źle — nieprawda, kod ma dobrze w źródle prawdy i źle
w jednym pliku; (3) błąd jest w jednym pliku — nieprawda, kopii jest pięć.

**Domknięcie (późniejsze tego samego wieczoru):** po przemieceniu całego repozytorium
kopii jest **osiem, nie pięć**. Doszły: `server/src/services/reportBuilderService.ts`
(fallback ustawia `maxScore: 7` **na sztywno dla wszystkich siedmiu osi** — błąd działa
w drugą stronę, zawyża zamiast zaniżać, i siedzi na ścieżce produkcyjnej generowania
raportu) oraz osierocony `server/services/ai/aiContext.ts` (bez `/src/` — plik martwy
od kwietnia, zero importerów, żywy bliźniak tego wzorca nie ma).
Naprawione: cztery. Wstrzymane do decyzji: `aiAssessmentPartnerService`. Zgłoszone
i nienaprawione: `reportBuilderService`. Martwe: `AxisReportSection`, `aiContext`.

**Wzorzec do zapamiętania:** za każdym razem myliłem się **w tę samą stronę** —
zawężałem zasięg defektu do tego, co akurat zmierzyłem. Pierwszy pomiar zawsze
pokazuje dolną granicę problemu, nigdy górną. **Nie meldować zasięgu, dopóki nie
przemieciono wszystkich miejsc, gdzie ta sama prawda może mieszkać** — a przy
duplikacji danych domyślną odpowiedzią na „ile jest kopii" jest „więcej, niż widzisz".

**Najgroźniejsza z pięciu:** `aiAssessmentPartnerService` nie ma złej liczby, tylko
**wymyśloną treść** — opisy poziomów 6 i 7 dla osi, które kończą się na 5. Skutek nie
jest wizualny: partner AI może zasugerować konsultantowi poziom dojrzałości, który
w metodyce właściciela nie istnieje. To wykracza poza tor grafiki.

**Co z tego wynika:** naprawą nie jest podmiana liczby, tylko usunięcie drugiej kopii
prawdy. W tym repo defekt załatany per-wywołanie odrósł po ośmiu tygodniach w dwunastu
plikach — dokładnie ten mechanizm.

### Z-8 · Właściciel przekazał dwie zasady pracy
Zlecanie robotnikom z doborem modelu do trudności (Sonnet gdzie wzorzec, Opus gdzie
osąd) oraz dokumentowanie **kontekstu zdarzenia**, nie tylko wyniku. Utrwalone jako
reguły 9 i 10 w `00_ZASADY_PRACY.md`, dosłownymi cytatami. Ten plik powstał w wykonaniu
reguły 10.

### Z-7 · Robotnik omal nie zniszczył pracy innego robotnika — `git stash`
**Co się stało:** robotnik naprawiający ekran predykcji schował zmiany (`git stash`),
żeby zmierzyć stan testów sprzed własnej edycji. Stos stashu jest **wspólny dla całego
repozytorium i wszystkich drzew roboczych** — zabrał więc plik `FilterableTable.tsx`
innego robotnika, który w tym samym momencie na nim pisał. `stash pop` odmówił
(konflikt), cudzy plik trzeba było odtwarzać ręcznie.

**Dlaczego ważne:** skończyło się bez szkody **wyłącznie dlatego, że robotnik to zgłosił
w sekcji „ZGŁASZAM"**. Gdyby przemilczał, strata wyszłaby dopiero u kogoś innego,
prawdopodobnie po czystym pobraniu repozytorium. To dokładnie ta klasa błędu, która
w tym projekcie raz już zepsuła harness (szerokie `git add -A`).

**Co z tego wynika:** reguła nr 8 — zakaz `git stash` u robotników. Stan odniesienia
mierzy się **przed pierwszą edycją albo wcale**; do porównania z HEAD służy
`git show HEAD:<ścieżka>` do osobnego pliku, nigdy ruszanie drzewa roboczego.
Weryfikacja po incydencie: stash pusty, plik 1647 linii, esbuild przechodzi, drugi
robotnik ostrzeżony, żeby sam sprawdził swój diff.

### Z-6 · Znaleziona książka właściciela — i sprostowanie mojej własnej rekomendacji
**Co się stało:** właściciel wskazał, że w repozytorium leży jego książka opisująca
metodykę DRD. Znaleziona: **„Digital Pathfinder", Piotr Wiśniewski PhD**, w `knowledge/DRD/`
(nie w `docs/`, gdzie szukałby każdy). Lektura obaliła to, co **sam przed chwilą
zarekomendowałem właścicielowi**: napisałem mu, że macierz ma dwie skale (5 i 7 poziomów).
Książka opisuje **trzy** — 5, 6 i 7. Kod zna dwie.

**Dlaczego ważne:** dwie osie (kompetencje/kultura, cyberbezpieczeństwo) mają w kodzie
o jeden poziom za mało. Skutek nie jest kosmetyczny — najwyższy poziom dojrzałości
jest w produkcie **nieosiągalny**, a luka do celu liczona wobec złego maksimum.
Gdybym nie sprostował, zbudowalibyśmy macierz kłamiącą w dwóch osiach z siedmiu.

**Trzy rzeczy, które książka rozstrzygnęła same z siebie:**
1. „Rozjazd 34 kontra 39 obszarów", zgłaszany w `DRD_CANON.md` jako defekt kodu,
   **defektem nie jest** — książka opisuje sześć osi (34 obszary), oś AI dopisano później.
   Kod miał rację, dokument techniczny się mylił.
2. Obszar 5A to **„Typ 1–6", nie „Poziom 1–6"** — autor przemianował skalę, bo żaden
   styl przywództwa nie jest lepszy. Macierz nie może malować go gradientem dojrzałości.
3. Nazwa osi 5 w kodzie („Kultura Transformacji") gubi kompetencje, które są połową
   jej zakresu.

**Co z tego wynika:** `DRD_KSIAZKA_KONTRA_KOD.md` + kolejność prac, w której poprawa
skal wyprzedza jakąkolwiek robotę graficzną. Oraz reguła praktyczna: **materiały
źródłowe właściciela leżą w `knowledge/`, nie w `docs/`** — `docs/` to piętro agentów.
Dokument z nagłówkiem `Autor: Claude` nigdy nie jest źródłem.

**Uzupełnienie od właściciela:** książka **nie jest ostatnią wersją** — Cyberbezpieczeństwo
dołożył już w książce, a oś AI dopiero potem; wskazał, że gdzieś przekazał nowszą
dokumentację obu. Poszukiwanie w toku. **Dopóki się nie zamknie, liczby z książki
dla osi 6 i 7 są niepewne** i nie wolno na nich niczego budować.

### Z-5 · Decyzja właściciela: macierz oceny to siedem osi
Na pytanie, którą z **pięciu** znalezionych w kodzie implementacji macierzy robimy tą
jedyną — odpowiedź: *„Tak, 7 osi."* Wybrany `EmbeddedMatrix` (zmienna liczba poziomów
per oś). Cztery pozostałe (~1900 linii) idą do odłożonych; **kod zostaje na miejscu**
zgodnie z regułą nr 5. Zapisane w `MAPA_UWAG_WLASCICIELA.md`, sekcja D-1.

### Z-4 · Właściciel miał rację co do macierzy — istnieje w pięciu wersjach
**Co się stało:** właściciel twierdził, że macierz odpowiedzi „w kodzie istnieje",
choć przejrzał wszystkie karty i nigdzie jej nie znalazł. Pomiar potwierdził: istnieje
w **pięciu niezależnych implementacjach**. Jedna żywa, cztery odcięte.

**Dlaczego ważne:** to **piąty** przypadek tego samego wzorca w tym projekcie — rzecz
zbudowana i pozbawiona wejścia. Poprzednik zanotował cztery takie w jeden dzień.
Zasada „zakładaj, że rzecz istnieje, dopóki nie udowodnisz, że jej nie ma" wygrała
piąty raz z rzędu.

**Najgroźniejszy szczegół:** harness pokazuje macierz (`?screen=assessment-matryca`),
której w aplikacji otworzyć się nie da — bo renderuje wariant martwy w produkcie.
Stanowisko pomiarowe potrafi więc kłamać także **w drugą stronę**: pokazywać jako
działające coś, co dla użytkownika nie istnieje. Do sześciu znanych sposobów kłamania
harnessu dochodzi siódmy.

**Drugi szczegół:** macierz znika z ekranu po zamrożeniu sesji — czyli dokładnie wtedy,
gdy wg metodyki ma wejść do raportu i pokazać następne kroki.

**Sprostowanie dokumentacji:** `PRZEKAZANIE_GRAFIKA.md:188` i `status.json` twierdzą,
że ekran `assessment-matryca` nie jest zarejestrowany w harnessie. **Jest** — od 11:08
tego samego dnia. Dokument przepisał nieaktualną notatkę sześć godzin po fakcie.
Lekcja: **własna dokumentacja starzeje się w godzinach, nie w dniach.**

### Z-3 · Dziewięć ekranów Finansów oceniano w pustym wariancie
**Co się stało:** właściciel oznaczył 10 ekranów Finansów jako do poprawki, przy siedmiu
nie zostawiając ani słowa. Przyczyna: każdy z nich wymaga parametru w adresie
(`&scene=`, `&mode=`, `&step=`, `&state=`), udokumentowanego **wyłącznie w komentarzu
nagłówkowym własnego pliku** — rejestr harnessu ich nie wymienia. Zrzuty zrobiono bez
nich; właściciel dostał puste plansze i karty zajmujące 15% kadru.

**Dlaczego ważne:** jego uwaga *„nic tu nie widać, nic z tego nie można wyciągnąć"*
była **trafna wobec tego, co dostał**, i niesprawiedliwa wobec produktu. Po ponownych
zrzutach z parametrami te same ekrany pokazują pełne tabele z danymi.

**Co z tego wynika:** adresy z kompletem parametrów zapisane; realny defekt graficzny
w tym klastrze był **jeden** (pasek kroków jako gołe słowa) i został naprawiony.

### Z-2 · Siedem uwag „tabela za wąska" było już naprawione — właściciel o tym nie wiedział
**Co się stało:** właściciel siedmiokrotnie zgłosił, że tabela nie jest na pełną
szerokość (10:01–11:44). Poprzednik znalazł przyczynę — sztuczne `maxWidth: 1180`
wpisane w harness, nie w produkt — i usunął ją o **14:15**. Ale **nikt nie zrobił
nowych zrzutów i nikt nie zapalił właścicielowi zielonej karty**, więc dla niego
sprawa wyglądała na otwartą przez resztę dnia.

**Dlaczego ważne:** naprawa bez dowodu nie jest naprawą. Weryfikacja zrzutem
potwierdziła: sejfy i raporty DRD czyste, wiersze w jednej linii. Przy okazji wyszły
**dwa defekty, których nikt nie zgłaszał** — dwa ekrany Oceny w całości po angielsku
i ucinana ostatnia kolumna w tabelach dwóch różnych modułów.

**Co z tego wynika:** po każdej naprawie obowiązkowo nowy zrzut **i** `odbior-poprawka.mjs`.
Oraz: ponowne oglądanie „załatwionych" ekranów opłaca się samo — znajduje defekty,
których nie szukano.

### Z-1 · Rozjazd oczekiwania właściciela z pracą — 2,5 godziny
**Co się stało:** przy przejęciu sesji właściciel powiedział: *„byłem przekonany, że
od dwóch godzin Twój poprzednik to naprawiał"*. Pomiar bazy: z 63 jego uwag ruszonych
było **8**, nietkniętych **55**. Ostatnia jego decyzja — 11:50; przez następne 2,5 h
pracowano nad prawym pasem, kartami N i dyżurami toru funkcji.

**Dlaczego ważne:** praca była wartościowa i częściowo **też** wynikała z jego uwag
(prawy pas w ideach i notatniku) — właściciel sam to sprostował i miał rację, moja
pierwsza ocena była za ostra. Ale rozjazd między tym, czego oczekiwał, a tym, co się
działo, trwał 2,5 godziny i nikt go nie zauważył.

**Co z tego wynika:** `STAN_LISTY_POPRAWEK.md` jako trwały pomiar. Zasada: **lista
właściciela jest torem numer jeden i nie ustępuje niczemu**; praca własna nadzorcy
idzie równolegle robotnikami, nigdy zamiast. I: **licz commity oraz wpisy w bazie
przed każdym meldunkiem** — meldunek „pracujemy nad tym" bez liczby jest bezwartościowy.
