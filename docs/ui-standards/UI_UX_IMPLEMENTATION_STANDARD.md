# Consultify UI/UX — standard implementacyjny

> **Status:** obowiązująca warstwa szczegółu podległa [`CANON.md`](CANON.md).
> **Zakres:** wszystkie ekrany desktopowe Consultify: huby, listy, preview, detale, artefakty, wizardy i eksporty.
> **Właściciel decyzji:** Product Owner / CTO.
> **Reguła konfliktu:** ten dokument nie nadpisuje `CANON.md`, `TRIADA_KANON.md` ani zamrożonych układów. W konflikcie obowiązuje hierarchia z `CANON.md` §2.

## 1. Cel standardu

Standard odpowiada na pięć pytań dla każdego ekranu:

1. Gdzie użytkownik jest i jaki obiekt ogląda?
2. Co jest jego najważniejszym następnym działaniem?
3. Które dane są najważniejsze, a które pomocnicze?
4. Co się wydarzy po każdej akcji i jak użytkownik to rozpozna?
5. Czy ten sam wzorzec działa spójnie w całym produkcie, light i dark mode?

Ekran jest zgodny dopiero wtedy, gdy odpowiedzi wynikają z samego interfejsu — bez instrukcji od autora.

## 2. Zasady nadrzędne

### 2.1 Compose, do not invent

- ekran funkcjonalny składa zatwierdzone shelle i komponenty;
- lokalny wariant powstaje tylko po udokumentowanej decyzji;
- ta sama encja, akcja i status mają jeden język w całym produkcie;
- nowy wspólny wzorzec musi mieć właściciela, dokumentację, implementację referencyjną i test.

### 2.2 Honest UI

- nie pokazuj sukcesu przed potwierdzeniem backendu;
- nie ukrywaj błędu ani opóźnienia;
- loading musi mieć kontekst i recovery;
- save state i lifecycle state są osobne;
- niedostępna akcja wyjaśnia przyczynę albo jest ukryta zgodnie z regułą uprawnień;
- AI nigdy nie zmienia trwale danych bez jawnego zatwierdzenia użytkownika.

### 2.3 Information before decoration

- hierarchię budują pozycja, rozmiar, waga, odstęp i semantyka;
- kolor sygnalizuje znaczenie, nie ozdabia chrome;
- ekran roboczy nie ma marketingowego hero;
- jedna informacja i jedna akcja mają jeden kanoniczny dom;
- progressive disclosure chroni ekran przed płaskim wysypem funkcji.

### 2.4 Reference screens

- **Zadania** są referencją dla listy, preview i wnętrza karty zadania;
- **Decyzje** są referencją dla listy, preview, sekcji wnętrza i panelu akcji;
- odstępstwo od tych wzorców wymaga wskazania różnicy domenowej, nie preferencji estetycznej;
- referencje nie oznaczają kopiowania treści — oznaczają kopiowanie anatomii i zachowania.

## 3. Anatomia aplikacji

### 3.1 App shell

Kolejność pionowa:

1. App Topbar — kontekst globalny: Data, Model, inbox/tasks, Teresa, konto.
2. Module Topbar / Menu 2 — nazwa modułu, główne zakładki, primary CTA.
3. Command Row / Menu 3 — presety/scope z licznikami, bulk, otwarte karty i kontekstowe AI actions. Przełącznik widoku należy do Menu 2.
4. Content surface — lista, canvas, dokument, workspace lub dashboard.
5. Preview / context rail — tylko gdy wybrany obiekt lub tryb tego wymaga.

Nie wolno dodawać kolejnego globalnego paska. Kontrolki lokalne żyją wewnątrz powierzchni, której dotyczą.

### 3.2 App Topbar

- identyczna wysokość i kolejność elementów w każdym module;
- element aktywny i stan połączenia czytelne bez opierania się wyłącznie na kolorze;
- brak funkcji domenowych modułu;
- overflow i responsive collapse nie zmieniają znaczenia ani kolejności priorytetów.

### 3.3 Module Topbar / Menu 2

- breadcrumb lub nazwa modułu po lewej;
- zakładki modułu w stabilnej kolejności;
- maksymalnie jeden primary CTA po prawej;
- zakładki niedostępne zgodnie z flagą/rolą są ukryte lub jawnie locked — nigdy martwe;
- aktualny moduł i zakładka zawsze widoczne.

### 3.4 Command Row / Menu 3

- dokładnie jeden rząd;
- lewa strona: presety zakresu/etapu z licznikami albo — zależnie od stanu — bulk lub taby otwartych kart; tryb widoku należy do Menu 2;
- prawa strona: akcje widoku oraz AI, jeśli dotyczą całego bieżącego zbioru;
- do pięciu widocznych akcji; reszta w overflow;
- aktywny filtr ma czytelny stan i możliwość resetu;
- licznik wyniku aktualizuje się po zmianie filtra.

## 4. Fundament wizualny

### 4.1 Kolor

- wyłącznie tokeny semantyczne z [`00-foundation/color-system.md`](00-foundation/color-system.md);
- chrome jest monochromatyczny; kolor akcentu należy do CTA, stanu lub artefaktu;
- czerwony oznacza danger/error/critical, nie dekorację;
- status nigdy nie jest komunikowany samym kolorem — ma tekst lub ikonę;
- light i dark mode zachowują tę samą semantykę, nie te same surowe wartości HEX.

### 4.2 Typografia

- poziomy L1–L5, N i Q pochodzą z kodowego SSOT `src/styles/typography.ts`;
- tytuł strony jest pojedynczy i jednoznaczny;
- etykiety tabel i metadane są skanowalne, nie konkurują z treścią;
- tekst roboczy używa sentence case; uppercase tylko dla krótkich labeli systemowych;
- wielokropek oznacza skrócenie treści i musi mieć dostęp do pełnej wartości.

### 4.3 Powierzchnie, obramowania i cień

- separacja przede wszystkim przez warstwę tła i odstęp;
- border dla inputów, dividerów, zaznaczenia i kontroli wymagających konturu;
- cień wyłącznie dla obiektów unoszących się: modal, dropdown, popover;
- brak czystego `#000` i `#fff` jako powierzchni roboczej;
- aktywny/focus state musi pozostać widoczny w obu motywach.

### 4.4 Gęstość

- toolbar: maksymalnie 5 widocznych akcji;
- hub: maksymalnie 6 równorzędnych zakładek;
- primary actions: zwykle 1, maksymalnie 3 na region;
- karta/panel nie może być wielką pustą ramą dla jednego pilla;
- metadane grupujemy w kompaktowy pasek;
- długie treści rozwijamy, scrollujemy albo przenosimy do detail — nie ściskamy typografii;
- standard szczegółowy: [`DOKTRYNA_GESTOSCI.md`](DOKTRYNA_GESTOSCI.md).

## 5. Ekran listowy: Menu · Tabela · Preview

Pełne prawo: [`TRIADA_KANON.md`](TRIADA_KANON.md) i [`03-modules/TABLE_AND_PREVIEW_CANON.md`](03-modules/TABLE_AND_PREVIEW_CANON.md).

### 5.1 Tabela bazowa

- nagłówek tabeli jest sticky tam, gdzie lista przewija się pionowo;
- pierwsza kolumna identyfikuje obiekt; ostatnia mieści akcje wiersza;
- checkbox pojawia się tylko, gdy istnieją realne bulk actions;
- sortowanie ma stan: brak / rosnąco / malejąco;
- resize, widoczność i kolejność kolumn zachowują się przewidywalnie;
- liczby wyrównujemy do prawej, tekst do lewej, statusy według kontraktu chipa;
- zaznaczony wiersz ma stan niezależny od hover;
- długie wartości nie rozpychają układu bez limitu;
- pusta tabela pokazuje przyczynę i sensowny następny krok.

### 5.2 Widoki alternatywne

- grid, kanban, timeline i calendar są alternatywną prezentacją tego samego datasetu;
- przełączenie widoku zachowuje filtr, zakres i — jeśli możliwe — wybrany obiekt;
- każda karta pokazuje: identyfikację, stan, najważniejszą miarę i logiczną akcję;
- brak osobnych zakładek dla kosmetycznych wariantów tego samego datasetu.

### 5.3 Preview

- otwierane przez wybór wiersza/karty lub jawne `Otwórz podgląd`;
- nie zmienia route ani nie gubi kontekstu listy;
- zawiera: tytuł, stan, 3–6 kluczowych metadanych, streszczenie, relacje/AI i quick actions;
- primary CTA `Otwórz` prowadzi do pełnego wnętrza;
- zamknięcie preview zachowuje pozycję scrolla i filtry;
- szerokość nie może ukrywać krytycznych kolumn bez świadomego responsive behavior;
- loading/error/permission state dotyczy panelu, nie zeruje całego ekranu.

### 5.4 Kebab i prawy klik

- kebab jest odkrywalnym menu akcji rekordu;
- prawy klik może być skrótem eksperckim, nigdy jedynym wejściem;
- te same akcje mają tę samą nazwę, ikonę, kolejność i warunek dostępności;
- różnica między menu jest dozwolona tylko dla akcji kontekstowych zaznaczenia/canvasu;
- grupy: open/preview → edit/share/duplicate → automation/AI → danger;
- destrukcyjne akcje są na końcu i wymagają confirm;
- brak pozycji bez handlera.

## 6. Wnętrze obiektu / N-mode

### 6.1 Shell

- header: powrót, typ/ikona, nazwa, lifecycle status, save state, primary action, overflow;
- lewy panel: sekcje obiektu w stabilnej kolejności;
- centrum: aktywna sekcja lub artefakt;
- prawy panel: akcje, właściwości, relacje, źródła, komentarze, historia;
- sekcje mogą być konfigurowane tylko przez wspólny mechanizm `Sekcje`;
- przejście z listy zachowuje drogę powrotu i kontekst.

### 6.2 Sekcje

Każda sekcja ma:

- jednoznaczną nazwę i ikonę;
- pojedynczy cel użytkownika;
- stan edycja/podgląd, jeśli oba są potrzebne;
- empty/loading/error/locked;
- źródło/provenance dla danych generowanych lub synchronizowanych;
- akcję AI na poziomie pola/sekcji, nie globalny magiczny przycisk bez kontekstu.

### 6.3 Wzorzec referencyjny: Zadania i Decyzje

Obowiązują:

- wspólny header obiektu;
- `Sekcje` + `Edycja/Podgląd` + `Analizuj z AI` w jednym rzędzie;
- nawigacja sekcji po lewej;
- treść i edycja w centrum;
- panel właściwości i akcji po prawej;
- widoczne ostrzeżenia i brak powiązań;
- menu obiektu ograniczone do czynności technicznych (link/kod), jeśli akcje domenowe mają własny dom.

## 7. Workspace i artefakty

### 7.1 Wspólna anatomia

- maksymalna powierzchnia robocza dla canvasu/dokumentu;
- stabilna belka narzędzi lokalnych;
- panel prawy ma trzy kanoniczne role: Tools, Context, AI Suggestions;
- zoom/minimap/fit view przy dolnej lub lokalnej krawędzi canvasu;
- breadcrumb, save state i konwersja pozostają widoczne;
- skróty klawiaturowe nie zastępują widocznych wejść dla głównych akcji.

### 7.2 Tabela / arkusz

- nie udaje pełnego Excela; wspiera tylko pracę potrzebną w Consultify;
- widoczne zaznaczenie komórki/zakresu;
- menu wiersza i kolumny ma oddzielny kontekst;
- prawy klik zależy od zaznaczenia;
- dodawanie, sortowanie, filtrowanie i typ kolumny mają feedback;
- długie dane i wiele zaznaczeń nie niszczą nagłówka ani paneli.

### 7.3 Process Flow

- cały proces da się objąć wzrokiem przez fit view;
- zaznaczony node/edge ma wyraźny stan i panel właściwości;
- połączenia, bramki i lanes mają jednoznaczną semantykę;
- dodawanie kroku nie wymaga zgadywania punktu wstawienia;
- walidacja procesu wskazuje konkretny element;
- menu node, canvasu i prawego kliku nie duplikują się bez celu.

### 7.4 Mind Map

- korzeń, gałęzie i poziomy mają czytelną hierarchię;
- zaznaczony węzeł pokazuje affordance dodania dziecka/sąsiada;
- collapse/expand zachowuje strukturę i sygnalizuje ukryte potomstwo;
- AI działa na zaznaczonym węźle, gałęzi albo całej mapie — zakres jest jawny;
- panel boczny rozdziela właściwości, relacje, AI, historię i styl;
- menu canvasu i node mają różne, logiczne zakresy.

### 7.5 Whiteboard

- toolbar pozwala tworzyć tekst, notatkę, kształt, obszar i połączenie;
- zaznaczenie jednego/wielu obiektów uruchamia adekwatny toolbar;
- group/ungroup, layer, lock, duplicate i delete są dostępne kontekstowo;
- obiekty zachowują czytelność przy różnych poziomach zoom;
- minimapa/fit view i informacja o niepowiązanych elementach wspierają orientację;
- prawy klik działa na obiekcie i pustym canvasie.

### 7.6 Dokument / notatnik

- biblioteka → preview → edytor zachowuje kontekst;
- edytor ma jeden toolbar i wspólny slash menu;
- autosave pokazuje stan bez agresywnych toastów;
- inline AI pokazuje zakres, propozycję i możliwość accept/reject;
- backlinks, graf, historia i załączniki są panelami kontekstowymi;
- eksport nie jest utożsamiany z zapisem.

## 8. Wizardy i generatory

- przed startem użytkownik rozumie wynik, wymagane dane i czas;
- wizard ma numer/nazwę kroku, postęp oraz Back/Next;
- walidacja jest inline i prowadzi do pola;
- krok nie znika po błędzie sieci;
- dane użytkownika pozostają po przejściu wstecz;
- AI-generated input jest oznaczony i edytowalny;
- summary przed mutacją/uruchomieniem pokazuje zakres skutków;
- Cancel wyjaśnia, czy szkic zostanie zachowany;
- stan generowania ma postęp, możliwość bezpiecznego wyjścia i recovery;
- rezultat prowadzi do workspace, nie do ślepego toastu.

## 9. Formularze i walidacja

- label jest zawsze obecny; placeholder nie zastępuje labela;
- required/optional jest jednoznaczne;
- helper text wyjaśnia format lub skutek;
- błąd jest przy polu i w summary tylko dla długich formularzy;
- focus przechodzi do pierwszego błędu;
- disabled i read-only mają różne znaczenie wizualne i semantyczne;
- Save/Submit pozostaje aktywne zgodnie z realną walidacją, nie arbitralnie;
- data, liczby i waluty korzystają z locale i poprawnej precyzji;
- unsaved changes wymagają ochrony przed przypadkowym wyjściem.

## 10. Przyciski, akcje i feedback

### 10.1 Hierarchia

- primary: jedna główna akcja regionu;
- secondary: wspierająca akcja tekstowa/outline;
- tertiary/ghost: akcje niskiego ciężaru;
- danger: trwała destrukcja lub odrzucenie;
- icon-only wymaga tooltipa i accessible name.

### 10.2 Rezultat akcji

- optimistic update tylko gdy bezpieczny i odwracalny;
- sukces: widoczna zmiana stanu; toast tylko jako uzupełnienie;
- błąd: informacja co się nie udało i co można zrobić;
- undo dla szybkich, odwracalnych zmian;
- confirm dla nieodwracalnych i szerokich skutków;
- mutacje AI trafiają do review/diff przed zastosowaniem.

## 11. Stany systemowe

Każdy ekran i ważny region dokumentuje minimum:

| Stan | Obowiązkowa odpowiedź UI |
|---|---|
| Initial loading | skeleton odpowiadający docelowemu layoutowi |
| Background refresh | dane zostają; dyskretny wskaźnik odświeżania |
| Empty-first-use | wyjaśnienie wartości + primary CTA |
| Empty-filtered | informacja o filtrze + reset |
| Partial data | zachowaj dostępne dane + wskaż braki |
| Error recoverable | przyczyna użytkowa + retry |
| Error blocking | zachowaj kontekst + ścieżka powrotu/support ID |
| Offline/degraded | jawny tryb i zakres ograniczeń |
| No permission | powód + właściciel/prośba o dostęp, jeśli możliwe |
| Locked/read-only | widoczny stan; brak pozornie aktywnej edycji |
| Long content | truncate + full access lub kontrolowany scroll |
| Zero/unknown value | `0` tylko dla zera, `—` dla braku, `Nieznane` dla nieustalonego |

## 12. AI / Teresa

- zakres działania AI jest nazwany: pole, sekcja, rekord, zaznaczenie lub zbiór;
- użytkownik widzi źródła, założenia i poziom pewności tam, gdzie wpływają na decyzję;
- streaming nie przesuwa całego layoutu i nie pulsuje całym kontenerem;
- generowanie ma Stop/Cancel, retry i stan częściowego wyniku;
- propozycje są odróżnione od zatwierdzonych danych;
- zastosowanie wielu zmian używa review/diff;
- AI nie ukrywa manualnej ścieżki wykonania;
- audyt zapisuje kto/co/kiedy zmienił i czy była to sugestia AI.

## 13. Dostępność i sterowanie

- WCAG 2.2 AA dla kontrastu, focusu, nazw i obsługi klawiaturą;
- wszystkie funkcje dostępne bez myszy, z wyjątkiem gestów wymagających równoważnej alternatywy;
- focus order odpowiada porządkowi wizualnemu;
- focus ring nie jest usuwany;
- modal zamyka focus, po zamknięciu zwraca go do triggera;
- menu, tabs, grid, tree i dialog korzystają z właściwych semantics/ARIA;
- tooltip nie zawiera jedynej krytycznej informacji;
- `prefers-reduced-motion` usuwa ruch niekonieczny;
- target interakcji ma minimum 24×24 px, preferowane 32×32 px dla chrome desktopowego.

## 14. Responsywność

MVP jest desktop-first; brak mobile nie zwalnia z zachowania przy mniejszym desktopie.

- kanoniczny odbiór wizualny: viewport CSS 1440×900, zoom 100%;
- obowiązkowy minimalny desktop: viewport CSS 1280×720, zoom 100%;
- 1920×1080 i 1600×900 pozostają dodatkowymi kontrolami diagnostycznymi;
- przy 1280 dozwolone są jawny overflow i logiczne grupowanie, lecz nie clipping, overlap ani
  utrata funkcji;
- brak poziomego scrolla całej aplikacji; dopuszczalny wewnątrz tabeli/canvasu;
- preview może przejść w drawer, ale zachowuje pełną funkcję;
- toolbar przechodzi do overflow według priorytetu;
- tekst, CTA i menu nie nachodzą na siebie przy 125% zoom;
- krytyczne akcje nie znikają bez alternatywnego wejścia.

## 15. Motion

- czas standardowy ≤220 ms;
- zero bounce i przypadkowego spring;
- animuje się zmiana stanu, nie dekoracja;
- skeleton przechodzi w content bez flashu;
- rozwijanie, preview, modal i toast używają wspólnych tokenów;
- pełny katalog: [`02-components/MICRO_INTERACTIONS_CANON.md`](02-components/MICRO_INTERACTIONS_CANON.md).

## 16. Eksporty klientowskie

- eksport jest częścią doświadczenia produktu, nie technicznym dumpem;
- tytuł, brand, hierarchia, paginacja i metadane są spójne między PPTX/DOCX/XLSX/PDF;
- artefakt eksportowany nie może zawierać chrome aplikacji, przyciętych tabel ani surowych identyfikatorów;
- wynik ma stan przygotowania, pobrania i błędu;
- roboczy standard: [`00-foundation/BRAND_EXPORT_CANON.md`](00-foundation/BRAND_EXPORT_CANON.md), do czasu formalnej akceptacji każdy eksport wymaga review.

## 17. Treść i język

- nazwy akcji zaczynają się od czasownika;
- nazwy statusów opisują stan, nie działanie;
- unikamy żargonu technicznego i placeholderów typu `Item`, `Object`, `TBD`;
- komunikat błędu mówi: co, dlaczego (jeśli wiemy), co dalej;
- PL i EN zachowują znaczenie oraz mieszczą się w layoutach;
- daty, waluty i liczby są lokalizowane;
- AI-generated copy nie może zmieniać terminologii domenowej produktu.

## 18. Obowiązkowe ujęcia Visual QA

### 18.1 Każdy ekran listowy

1. czysta lista/tabela;
2. alternatywny widok, jeśli istnieje;
3. aktywne filtry lub ustawienia kolumn;
4. kebab;
5. prawy klik, jeśli wspierany;
6. preview;
7. pełne wnętrze;
8. empty/loading/error/locked — według dostępności;
9. reprezentatywny light i dark mode.

### 18.2 Każdy workspace

1. cały artefakt;
2. zaznaczony element;
3. menu elementu;
4. prawy klik na elemencie;
5. prawy klik canvasu;
6. panel właściwości;
7. panel kontekstu/relacji;
8. panel AI;
9. zoom/minimapa/fit view;
10. stan edycji lub tworzenia.

### 18.3 Każdy wizard

Start, każdy krok, walidacja, back navigation, summary, generating, success, failure/retry.

## 19. Definition of Ready

Przed implementacją istnieją:

- user job i zakres modułu;
- typ ekranu oraz wskazany wzorzec referencyjny;
- anatomia Menu 2/Menu 3/content/preview/detail;
- dataset, stany i uprawnienia;
- hierarchia akcji;
- wymagania AI/provenance;
- kryteria Visual QA;
- decyzja, czy potrzebny jest nowy wspólny komponent.

## 20. Definition of Done

Ekran jest `ACCEPTED`, gdy:

- składa zatwierdzone komponenty i nie tworzy lokalnego języka;
- spełnia właściwy kontrakt listy, preview, detail, workspace lub wizarda;
- działa dla realnych danych i długich treści;
- ma wszystkie stany z §11 właściwe dla przepływu;
- zachowuje kontekst nawigacji;
- działa w light i dark mode;
- przechodzi keyboard/a11y oraz 125% zoom;
- ma uczciwy feedback mutacji i AI;
- ma zestaw evidence z §18;
- ma test funkcjonalny krytycznej ścieżki;
- ma wpis w [`MODULE_UI_UX_COMPLIANCE_MATRIX.md`](MODULE_UI_UX_COMPLIANCE_MATRIX.md).

## 21. Klasyfikacja wyniku review

| Wynik | Znaczenie |
|---|---|
| `ACCEPTED` | zgodne, kompletne evidence, brak blokera |
| `ACCEPTED_WITH_CORRECTION` | wzorzec poprawny, istnieje ograniczona lista korekt |
| `NEEDS_STANDARD` | realna luka wymaga decyzji standardowej przed implementacją |
| `REJECTED` | sprzeczne z kanonem, zły wzorzec lub nieuczciwe zachowanie |
| `NOT_EVIDENCED` | brak materiału do wiarygodnej oceny |
| `OUT_OF_SCOPE` | świadomie poza bieżącą falą/MVP |

## 22. Minimalny zapis decyzji

Każda decyzja zmieniająca UI zapisuje:

- problem i user job;
- dotknięte moduły;
- użyty lub rozszerzony komponent;
- warianty odrzucone i powód;
- light/dark evidence;
- wpływ na a11y, responsive, AI i eksport;
- właściciela oraz datę akceptacji;
- link do zadania/PR i changelog kanonu, jeśli zmienia standard.
