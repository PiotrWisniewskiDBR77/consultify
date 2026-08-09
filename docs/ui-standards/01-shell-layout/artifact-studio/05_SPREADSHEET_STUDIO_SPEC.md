# Spreadsheet Studio — specyfikacja otwartego XLSX

Status: `APPROVED_SPEC / RUNTIME_PARTIAL`
Zakres: otwarty skoroszyt XLSX w Artifact Studio
Format kanoniczny: XLSX
Warunek implementacji: żadna funkcja oznaczona `MISSING` nie może być widoczna w produkcji przed ukończeniem pełnego kontraktu wykonawczego

## 1. Cel produktu

Spreadsheet Studio jest zarządzanym środowiskiem tworzenia i korygowania modeli decyzyjnych. Łączy ręczne minimum profesjonalnego arkusza z kontekstem Consultify: źródłami, założeniami, QA, komentarzami, wersjami, approval, audytem oraz globalną Teresą.

Studio nie jest kopią Microsoft Excel. Zachowuje jednak nawyki użytkowników Office: siatkę, pasek formuły, zaznaczenia komórek i zakresów, skróty klawiaturowe, kontekstowe menu prawego przycisku, sortowanie, filtrowanie oraz przewidywalne operacje na wierszach, kolumnach i arkuszach.

## 2. Zakres

### 2.1 P0

- otwarcie i ponowne otwarcie skoroszytu;
- zmiana nazwy, autosave, jawny błąd zapisu i konflikt wersji;
- lifecycle, klasyfikacja, udostępnianie i eksport;
- zarządzanie arkuszami: dodanie, zmiana nazwy, duplikowanie, usunięcie, zmiana kolejności, ukrycie i pokazanie;
- zaznaczenie komórki, zakresu, wiersza i kolumny;
- edycja wartości i formuł oraz przeliczanie obsługiwanych zależności między arkuszami;
- cut, copy, paste, clear, undo i redo;
- dodawanie, usuwanie, ukrywanie, pokazywanie, zmiana rozmiaru i autodopasowanie wierszy oraz kolumn;
- podstawowe formatowanie liczb, dat, walut, procentów, miejsc dziesiętnych, fontu, kolorów, obramowania, wyrównania i zawijania;
- find, replace i atomowe replace all;
- sortowanie, filtrowanie i freeze panes;
- źródła i założenia z anchorami do arkusza, komórki lub zakresu;
- itemizowane QA z przejściem do problemu;
- komentarze, review, approval, wersje i bezpieczny restore;
- globalna Teresa z jawnym przekazaniem zaznaczenia;
- eksport aktualnej wersji XLSX oraz audyt operacji.

### 2.2 P1

- wykresy i ich edycja;
- eksport PDF z print area i podglądem układu;
- scalanie komórek;
- data validation;
- conditional formatting;
- named ranges;
- ochrona arkusza i zakresów;
- kontrolowany import CSV/XLSX;
- grupowanie wierszy i kolumn.

Elementy P1 są ukryte do czasu wdrożenia kompletnego modelu obiektu, persistence, recovery i testów.

### 2.3 OUT

- tworzenie i administrowanie szablonami w otwartym Studio;
- pivot tables;
- VBA i makra;
- PowerQuery;
- pełna zgodność ze wszystkimi funkcjami formuł Excela;
- niekontrolowane real-time coauthoring bez wspólnego kontraktu konfliktów.

## 3. Reguły architektury

1. Menu 1 pozostaje globalnym menu Consultify i nie jest modyfikowane przez Spreadsheet Studio.
2. Menu 2 mieści się w jednej linii i dotyczy całego skoroszytu.
3. Menu 3 jest dynamiczne i wynika z aktualnego zaznaczenia.
4. Jedna komenda ma jedno kanoniczne miejsce. Skrót klawiaturowy, menu kontekstowe i command palette są aliasami tego samego `commandId`.
5. Po lewej działa jeden panel struktury i zarządzania.
6. Prawa strona jest przeznaczona wyłącznie dla globalnej Teresy.
7. Standardowy przycisk Teresy w dolnym/globalnym pasku pozostaje bez zmian.
8. Teresa nie ma stałej grupy w Menu 3. Polecenie przekazania zaznaczenia jest wyłącznie akcją kontekstową.
9. Funkcja `MISSING` pozostaje ukryta. Disabled służy wyłącznie funkcji istniejącej, chwilowo niedostępnej, z podanym powodem.
10. Działanie wielokomórkowe jest atomowe, wersjonowane i możliwe do cofnięcia.

## 4. Anatomia ekranu

Spreadsheet Studio składa się z:

1. globalnego Menu 1;
2. jednoliniowego Menu 2;
3. kontekstowego Menu 3;
4. lewego raila i jednego rozwijanego panelu;
5. centralnego canvasu arkusza;
6. paska adresu i formuły;
7. dolnego paska stanu;
8. globalnego panelu Teresy po prawej.

Otwarcie Teresy zwęża canvas zgodnie ze wspólnym standardem aplikacji. Nie może pojawić się drugi prawy rail ani lokalny panel AI.

## 5. Menu 2

Układ od lewej:

`← Materiały | XLSX + nazwa | stan zapisu | lifecycle | klasyfikacja | Udostępnij | Eksportuj | Więcej`

| Command ID | Etykieta | Priorytet | Zachowanie |
|---|---|---:|---|
| `xlsx.nav.back` | Materiały | P0 | Wraca do biblioteki i zachowuje stan listy. Przy niezapisanych zmianach uruchamia recovery. |
| `xlsx.workbook.rename` | Nazwa skoroszytu | P0 | Inline rename. Enter zatwierdza, Escape anuluje. |
| `xlsx.save.flush` | Zapisz teraz | P0 | Stan: Zapisywanie, Zapisano, Błąd, Konflikt. `Cmd/Ctrl+S` wymusza flush lub retry. |
| `xlsx.lifecycle.change` | Draft / In review / Approved / Final | P0 | Zmiana zgodna z rolą i wspólnym lifecycle. |
| `xlsx.classification.change` | Public / Internal / Confidential / Restricted | P0 | Publiczny link jest dozwolony wyłącznie dla `Public`. |
| `xlsx.share.manage` | Udostępnij | P0 | Role imienne i organizacyjne oraz public link zgodny z klasyfikacją. |
| `xlsx.export.draft` | Pobierz roboczy XLSX | P0 | Dozwolone w Draft; plik i metadane są oznaczone jako robocze. |
| `xlsx.export.final` | Eksport finalny | P0 | Blokowany przez Critical QA lub brak wymaganego approval. |
| `xlsx.export.override` | Override blokady | P0 | Tylko rola uprzywilejowana, obowiązkowe uzasadnienie i audyt. |
| `xlsx.workbook.duplicate` | Utwórz kopię | P0 | Tworzy nowy skoroszyt z lineage. Zastępuje niejednoznaczny Remix. |
| `xlsx.link.copy` | Kopiuj link | P0 | Dostępne w `Więcej`. |
| `xlsx.code.copy` | Kopiuj kod obiektu | P0 | Dostępne w `Więcej`. |
| `xlsx.export.pdf` | Eksportuj PDF | P1 | Ukryte do czasu wdrożenia ustawień druku i render verification. |

Menu 2 nie zawiera formatowania, źródeł, komentarzy, QA, historii ani lokalnego AI.

## 6. Menu 3

Menu 3 wykorzystuje wspólny rejestr komend i przełącza się między stanami `none`, `cell`, `range`, `row` i `column`. Puste grupy nie są renderowane. Przy mniejszej szerokości mniej istotne aliasy przechodzą do overflow, ale zapis, konflikt i aktywny kontekst nie mogą zniknąć.

### 6.1 Stan `none`

Widoczne P0:

- Undo i Redo, jeśli stos nie jest pusty;
- `Wstaw > Nowy arkusz`;
- `Znajdź` i `Znajdź i zamień`;
- `Przegląd > Komentarze`, `Uruchom QA`, `Wyślij do przeglądu`;
- `Widok > Zamroź okienka`, `Linie siatki`, zoom i full screen.

Polecenia zarządzania arkuszami są aliasami komend, których kanonicznym miejscem jest lewy panel `Arkusze`.

### 6.2 Stan `cell`

Widoczne P0:

- Undo, Redo;
- format liczby i miejsca dziesiętne;
- bold, italic, underline;
- kolor tekstu, wypełnienie, obramowanie, wyrównanie i zawijanie;
- `Wstaw`: wiersz, kolumna, link i komentarz;
- `Dane`: sortowanie, filtrowanie oraz źródło;
- `Przegląd`: komentarz, źródło i problemy QA dla komórki.

Overflow P0:

- cut, copy, paste i clear;
- usunięcie wiersza lub kolumny;
- szczegółowe formatowanie komórki;
- `Przekaż Teresie` jako alias kontekstowy.

Skróty: `Cmd/Ctrl+X/C/V`, `Delete`, `Enter`, `F2`, `Escape`, `Tab`, `Cmd/Ctrl+B/I/U/K`, `Shift+F10`.

### 6.3 Stan `range`

Widoczne P0:

- Undo, Redo;
- copy, paste i clear;
- podstawowe formatowanie zakresu;
- sortowanie i filtrowanie;
- komentarz;
- źródła zaznaczenia.

Overflow P0:

- cut;
- wstawianie i usuwanie kompatybilnych wierszy lub kolumn;
- znajdowanie w zaznaczeniu;
- przekazanie zaznaczenia Teresie;
- uruchomienie QA dla zakresu.

Menu pokazuje adres, np. `B2:E6`, a dla niejednorodnego formatowania stan `mixed`. Nie wybiera arbitralnej wartości.

Wykres, merge, validation, conditional formatting i named range pozostają ukryte jako P1.

### 6.4 Stan `row`

Widoczne P0:

- wstaw wiersz wyżej lub niżej;
- usuń wiersz;
- ukryj lub pokaż;
- wysokość i autodopasowanie;
- clear, formatowanie, sortowanie i filtrowanie;
- komentarz i źródła.

Overflow P0 obejmuje cut, copy, paste, QA oraz przekazanie Teresie. Usunięcie niepustych wierszy wymaga atomowej operacji, analizy zależności i Undo.

### 6.5 Stan `column`

Widoczne P0:

- wstaw kolumnę z lewej lub prawej;
- usuń kolumnę;
- ukryj lub pokaż;
- szerokość i autodopasowanie;
- format liczby, wyrównanie i zawijanie;
- sortowanie, filtrowanie, komentarz i źródła.

Overflow P0 obejmuje cut, copy, paste, clear, QA oraz przekazanie Teresie.

### 6.6 Tabela i wykres

Stan `table` nie jest renderowany, dopóki przeglądarkowy runtime nie posiada prawdziwego modelu tabeli. Zwykły prostokątny region pozostaje stanem `range`.

Stan `chart` jest P1 i pozostaje ukryty, dopóki nie istnieje renderer, model zaznaczenia, edytor danych, persistence i Undo. Zdolność generatora XLSX do osadzenia wykresu nie jest dowodem działania edytora wykresów.

## 7. Lewy panel

Lewy rail otwiera jeden panel o szerokości zgodnej ze wspólnym shellem. Otwarty może być jeden tryb naraz.

### 7.1 Arkusze

Domyślny tryb P0:

- lista arkuszy z aktywnym stanem;
- kliknięcie przełącza arkusz;
- drag zmienia kolejność;
- podwójne kliknięcie zmienia nazwę;
- `+` dodaje arkusz;
- menu elementu: zmień nazwę, duplikuj, przenieś, ukryj, pokaż i usuń;
- badge może sygnalizować QA, komentarz albo brak źródła.

Usunięcie ostatniego widocznego arkusza jest niedozwolone. Usunięcie arkusza zawierającego dane lub referencje wymaga ostrzeżenia i Undo.

### 7.2 Źródła i założenia

- źródła skoroszytu, arkusza i zaznaczenia;
- status `VERIFIED`, `UNKNOWN` lub unresolved;
- przejście do anchoru;
- powiązanie i odpięcie źródła zgodnie z uprawnieniem;
- lista założeń i brakujących źródeł.

Brak źródła nie może być przedstawiany jako zakaz ani jako potwierdzony fakt.

### 7.3 Komentarze

- komentarze skoroszytu, arkusza, komórki i zakresu;
- add, reply, mention, resolve i reopen;
- filtry open/resolved;
- jump-to-anchor;
- zachowanie historycznego anchoru po zmianie struktury.

### 7.4 QA

- lista problemów `Critical`, `Warning` i `Info`;
- filtrowanie po arkuszu, regule i statusie;
- jump-to-cell lub jump-to-range;
- ponowne uruchomienie kontroli;
- jawny stan błędu bez utraty poprzedniego wyniku.

Sam procent jakości nie jest wystarczającym UI i zostaje usunięty.

### 7.5 Wersje

- append-only timeline;
- autor i źródło zmiany: manual, AI, import lub restore;
- podgląd diff;
- restore do nowej wersji head.

Restore tworzy safety revision przed przywróceniem. Nie nadpisuje historii i może zostać odwrócony kolejnym restore.

### 7.6 Właściwości

- metadane skoroszytu, arkusza lub zaznaczenia;
- adres, typ, liczba arkuszy, rozmiar oraz błędy formuły;
- klasyfikacja i lifecycle jako read-only aliasy prowadzące do właściciela w Menu 2.

Panel Właściwości nie zastępuje Menu 3.

## 8. Canvas i pasek formuły

Canvas zawiera wyłącznie siatkę roboczą oraz jej konieczne elementy. Nie renderuje kart Summary, Sheets, Format ani wrappera `Excele / Workspace`.

Wymagania P0:

- sticky nagłówki wierszy i kolumn;
- przewijanie w obu osiach;
- widoczne zaznaczenie i focus;
- obsługa komórki, zakresu, wiersza i kolumny;
- formula bar pokazujący surową wartość lub formułę;
- komórka pokazująca wynik formuły;
- Enter zatwierdza, Escape anuluje, Tab przechodzi w prawo;
- błąd nieobsługiwanej formuły jest jawny i nie zmienia się w ciche zero;
- przy zmianie arkusza zaznaczenie i stan widoku są zarządzane świadomie.

Pasek formuły zawiera:

- pole adresu i `Go to`;
- surową treść/formułę;
- zatwierdzenie i anulowanie edycji.

Wizard funkcji jest P1.

## 9. Bottom bar

Bottom bar zawiera:

- selector aktywnego arkusza, gdy lewy panel jest zwinięty;
- adres `A1` lub zakres `A1:D12`;
- `Suma`, `Średnia` i `Licznik` dla właściwego zaznaczenia;
- informację o aktywnym filtrze;
- gridlines i zoom;
- standardowy globalny przycisk Teresy.

Bottom bar nie zawiera eksportu, `All files`, `Preview File`, postępu generowania, lifecycle ani lokalnego AI.

## 10. Menu kontekstowe

Menu kontekstowe korzysta z tego samego rejestru komend co Menu 3. Jest dostępne przez prawy przycisk, `Shift+F10` i klawisz Menu. Escape lub kliknięcie poza menu je zamyka.

Kolejność grup jest zgodna z nawykami Office:

1. Cut, Copy, Paste;
2. Insert, Delete, Clear;
3. Format, Sort, Filter;
4. Comment, Source, QA;
5. `Przekaż Teresie`;
6. działanie destrukcyjne na końcu.

### 10.1 Komórka

`Wytnij | Kopiuj | Wklej | Wstaw | Usuń | Wyczyść | Formatuj komórki | Dodaj komentarz | Pokaż/Powiąż źródło | Przekaż Teresie`

### 10.2 Zakres

`Wytnij | Kopiuj | Wklej | Wyczyść | Wstaw | Usuń | Formatuj | Sortuj | Filtruj | Dodaj komentarz | Źródła | Przekaż Teresie`

Wykres i merge są ukryte do P1.

### 10.3 Wiersz

`Wytnij | Kopiuj | Wklej | Wstaw wyżej/niżej | Usuń | Wyczyść | Wysokość/Autodopasuj | Ukryj/Pokaż | Sortuj/Filtruj | Komentarz | Przekaż Teresie`

### 10.4 Kolumna

`Wytnij | Kopiuj | Wklej | Wstaw z lewej/prawej | Usuń | Wyczyść | Szerokość/Autodopasuj | Ukryj/Pokaż | Sortuj/Filtruj | Komentarz | Źródła | Przekaż Teresie`

### 10.5 Arkusz

`Zmień nazwę | Duplikuj | Przenieś | Ukryj/Pokaż | Komentarze | QA | Przekaż Teresie | Usuń`

Menu pierwszego poziomu powinno mieć maksymalnie około 12 pozycji. Rzadkie warianty trafiają do podmenu.

## 11. Globalna Teresa

Teresa działa dokładnie jak w pozostałych modułach:

- prowadzi jedną rozmowę niezależnie od ekranu;
- zna aktualny kontekst skoroszytu, arkusza, zaznaczenia i wersji w granicach uprawnień;
- nie jest lokalnym generatorem ani osobnym czatem XLSX;
- zachowuje rozmowę, draft i stan otwarcia przy zmianie ekranu;
- może otrzymać jawne zaznaczenie jako chip, np. `KPI Control · B2:E6 · v12`;
- chip można usunąć i można z niego wrócić do zaznaczenia;
- samo dołączenie zaznaczenia nie wysyła wiadomości automatycznie.

Zmiana zaproponowana przez Teresę przechodzi:

`proposal → diff → accept/reject → atomic apply → undo`

AI nie może wykonać cichej zmiany wielokomórkowej ani uzyskać danych szerszych niż uprawnienia użytkownika i klasyfikacja artefaktu.

## 12. Governance

### 12.1 Klasyfikacja i udostępnianie

- public link jest dostępny tylko dla `Public`;
- polityka jest egzekwowana po stronie backendu;
- zmiana klasyfikacji, utworzenie i cofnięcie linku są audytowane.

### 12.2 Eksport

- Draft XLSX jest dozwolony i oznaczony jako Draft;
- eksport finalny i publikacja są blokowane przez Critical QA lub brak approval;
- override jest dostępny tylko roli uprzywilejowanej;
- override wymaga niepustego uzasadnienia;
- override nie zmienia QA ani approval, tylko zezwala na konkretną operację;
- audit eksportu przechowuje artifact, version, lifecycle, classification, QA snapshot, approval snapshot, format i aktora.

### 12.3 Uprawnienia

Oddzielne możliwości obejmują co najmniej:

- view;
- edit;
- comment;
- resolve comment;
- manage sources;
- review;
- approve;
- restore version;
- share;
- export draft;
- export final;
- publish;
- override.

Backend działa fail-closed. Ukrycie lub disabled w UI nie zastępuje walidacji endpointu.

## 13. Fundament backendowy

P0 wymaga wspólnego kontraktu operacji na skoroszycie.

### 13.1 Tożsamość

Jeden resolver mapuje kanoniczny artifact na `generated_workbooks` albo `tp_tables`. Frontend nie może zgadywać znaczenia `artifactId` ani tworzyć pustego podglądu przy nierozpoznanym originie.

### 13.2 Batch mutation

Operacje zakresowe, strukturalne, formatowanie, sortowanie, replace all i AI apply używają transakcyjnego kontraktu:

```json
{
  "commandId": "xlsx.range.paste",
  "baseVersion": 12,
  "idempotencyKey": "uuid",
  "operations": [],
  "metadata": {}
}
```

Odpowiedź zawiera nową wersję, zmienione zakresy, wynik przeliczenia i ostrzeżenia. Stale `baseVersion` zwraca konflikt, a powtórzony `idempotencyKey` nie duplikuje operacji.

### 13.3 Wersje i Undo

- każda atomowa operacja należy do jednej rewizji;
- historia jest append-only;
- Undo wykorzystuje deterministyczną operację odwrotną albo bezpieczny restore;
- restore tworzy nowy head;
- eksport zawsze wskazuje konkretną wersję.

### 13.4 Anchor

Komentarze, źródła i QA używają stabilnego `sheetId`, zakresu i wersji. Nie wolno opierać trwałego anchoru wyłącznie na indeksie arkusza lub zmiennej nazwie.

### 13.5 Formuły

System posiada jawny rejestr wspieranych funkcji i referencji. Nieobsługiwana formuła generuje widoczny błąd i issue QA. Nie może zwracać cichego zera ani nieudokumentowanego przybliżenia.

## 14. Decyzje migracyjne

### KEEP

- `WorkbookSchema`;
- `WorkbookGeneratorService` jako headless generation engine;
- `WorkbookBuilder` i `WorkbookStyler`;
- `workbookQualityGate`;
- `workbookFormulaEngine` w granicach jawnego zakresu funkcji;
- istniejące persistence i ścieżki odczytu jako kompatybilna baza;
- generowanie, blank, clone, reopen i download po ujednoliceniu identity oraz governance.

### MOVE

- `EditableSpreadsheetGrid` do centralnego canvasu wspólnego shellu;
- tabs arkuszy do lewego panelu `Arkusze`;
- copy link i object code do `Menu 2 > Więcej`;
- download do pojedynczego `Menu 2 > Eksportuj`;
- stan błędu i retry generowania do przejściowego statusu lub historii wykonania.

### MERGE

- Remix z `Utwórz kopię` albo jawnym wariantem AI;
- oba originy reopen przez jeden identity resolver;
- quality score z itemizowanym QA;
- wszystkie przyciski download/export w jedną politykę eksportu;
- kroki pipeline z historią wykonania, ale nie z historią wersji.

### REMOVE

Po przejściu parity gate:

- XLSX wiring do `KimiWorkspaceShell`;
- `Task completed 0/8` jako stały chrome;
- Replay i Remix w topbarze;
- lokalny generator, lokalny system prompt i lokalny chat jako substytut Teresy;
- `Excele / Workspace` i zduplikowany nagłówek;
- Summary oraz karty Sheets/Format;
- zduplikowany download w preview header;
- footer `Preview File / All files`;
- `ExceleRightPanel` i `ExceleRightRail` z powierzchni XLSX;
- placeholder komentarzy i fałszywą nazwę Historia dla kroków generowania.

## 15. Status obecnego runtime

### Istnieje lub jest częściowo dostępne

- generowanie AI i deterministyczny blank;
- otwarcie i reopen części artefaktów;
- odczyt schematu;
- single-cell selection i edycja;
- formula bar w minimalnej formie;
- część przeliczania formuł;
- zapis pojedynczej komórki;
- generowanie XLSX i download;
- backend QA, ale bez pełnego itemizowanego UI;
- source metadata bez granularnego mapowania do komórek.

### MISSING — ukryte do wdrożenia

- range, row i column selection;
- batch mutation, wersje, konflikty i pełne Undo/Redo;
- zarządzanie strukturą wierszy, kolumn i arkuszy;
- ręczne formatowanie;
- sortowanie i filtrowanie;
- find/replace;
- granularne źródła;
- komentarze XLSX;
- historia wersji i restore;
- lifecycle, share i final export gating;
- jawne przekazanie zaznaczenia globalnej Teresie;
- atomowe propozycje AI z diffem.

Obecność ikony, schematu albo możliwości generatora nie oznacza gotowej funkcji otwartego Studio.

## 16. Acceptance

### 16.1 Bramka funkcjonalna

Każda widoczna komenda P0 ma:

- stabilny `commandId`;
- jedno kanoniczne miejsce;
- predykat zaznaczenia;
- predykat permission i lifecycle;
- realny komponent oraz handler;
- service lub endpoint;
- persistence i wersjonowanie;
- recovery;
- klasyfikację Undo;
- klasyfikację audytu;
- test jednostkowy, integracyjny lub E2E proporcjonalny do ryzyka.

### 16.2 Bramka runtime

Na aktualnym SHA i realDB należy udowodnić:

1. otwarcie generated workbook oraz sheet-origin;
2. zmianę wartości i formuły, przeliczenie zależności, zapis i refresh;
3. zakresowy paste i Undo;
4. zmianę struktury oraz zachowanie referencji i anchorów;
5. sortowanie i filtrowanie bez naruszenia integralności wierszy;
6. komentarz, resolve i reopen;
7. QA z jump-to-issue;
8. utworzenie i restore wersji;
9. przekazanie zaznaczenia Teresie, proposal, diff, accept i Undo;
10. eksport Draft;
11. blokadę Final przy Critical QA lub braku approval;
12. uprawniony override z uzasadnieniem i audytem;
13. odmowę public link dla klasyfikacji innej niż Public;
14. świeży XLSX zawierający najnowsze wartości, formuły, formaty i kolejność arkuszy.

### 16.3 Bramka UI/UX

- Menu 1 pozostaje bez zmian;
- Menu 2 mieści się w jednej linii;
- Menu 3 reaguje poprawnie na `none`, `cell`, `range`, `row` i `column`;
- działa jeden lewy panel;
- prawa strona zawiera wyłącznie globalną Teresę;
- standardowy bottom Teresa pozostaje;
- nie ma lokalnego AI, kart informacyjnych, footera plików ani stałego progressu;
- menu kontekstowe i skróty wywołują te same komendy co powierzchnie kanoniczne;
- funkcje `MISSING` nie są widoczne;
- interfejs jest używalny przy 1280, 1440 i 1920 px;
- kluczowe cele mają co najmniej 44 px, focus jest widoczny, a pełna ścieżka działa klawiaturą.

### 16.4 Bramka migracyjna

Wyłączenie starego XLSX shellu jest dozwolone dopiero po:

- parity gate obu originów;
- wdrożeniu flagi rolloutowej i przećwiczeniu rollbacku;
- potwierdzeniu, że nowy zapis jest czytelny oraz eksportowalny przez ścieżkę kompatybilną;
- braku odkrytych przycisków bez realnego kontraktu;
- zapisaniu evidence: SHA, realDB IDs, request/response, screenshoty, audit events oraz zweryfikowany plik XLSX.

Lokalny build, mock, sam test komponentu lub obecność wygenerowanego pliku nie stanowią pełnej akceptacji Spreadsheet Studio.
