# 01 — Model produktu i zasady nadrzędne

Ten rozdział ustala, czym jest Idea, jak rozumiemy cztery reprezentacje i jakie cztery zasady obowiązują w całym standardzie. Wszystkie kolejne rozdziały muszą być z nim zgodne — w razie sprzeczności wygrywa ten rozdział.

## 1. Czym jest Idea

**Idea to jeden obiekt danych.** Nie cztery dokumenty, nie cztery narzędzia — jeden graf z metadanymi, oglądany w czterech reprezentacjach.

| Reprezentacja | Do czego służy |
|---|---|
| **Mind Map** | rozbicie problemu na gałęzie, hipotezy, zależności — myślenie strukturalne |
| **Whiteboard** | praca warsztatowa, klastrowanie, facylitacja, głosowanie, przekazanie |
| **Process Flow** | przebieg procesu, decyzje, odpowiedzialność (tory), walidacja |
| **Table** | dane, właściwości, widoki, filtry, scoring, rekordy |

Użytkownik nie ma czuć, że przechodzi między czterema aplikacjami. Ma czuć, że pracuje nad **jedną Ideą** i wybiera najlepszy sposób jej pokazania.

> **Zasada fundamentalna:** jedna Idea · jeden model danych · cztery reprezentacje · jeden spójny system menu.

**Przełączenie reprezentacji nie jest konwersją.** Nie tworzy nowego obiektu, nie zmienia danych, nie przełącza ekranu innym użytkownikom. Jest lokalną preferencją widoku.

### Model danych
Idea: `ideaId` · nazwa · opis problemu (brief) · etap · stan zapisu · właściciel · elementy · relacje · komentarze · powiązania · źródła i załączniki · historia · metadane AI · ustawienia reprezentacji.

Element: `elementId` · typ · etykieta · opis · status · priorytet · właściciel (jeśli dotyczy) · pozycja (jeśli płótno) · właściwości specyficzne dla reprezentacji · relacje · komentarze · załączniki · historia zmian.

## 2. Cztery zasady nadrzędne

| # | Zasada | Co znaczy operacyjnie |
|---|---|---|
| **Z1** | **Analogiczność** | Ta sama akcja ma tę samą nazwę, ikonę, miejsce, skrót i zachowanie we wszystkich czterech reprezentacjach. Różnice istnieją **wyłącznie** tam, gdzie standard je jawnie wymienia (§4). |
| **Z2** | **Wygląd systemowy** | Powierzchnie wyglądają jak elementy jednego systemu, nie jak techniczne panele doklejone do płótna. Wzorzec: zaakceptowany prototyp prawego panelu. |
| **Z3** | **Zero placeholderów** | Żadnej akcji bez handlera, żadnego „wkrótce" bez podanego powodu, żadnego martwego eventu ani endpointu. Egzekwowane maszynowo (§02 — rejestr akcji), nie obietnicą. |
| **Z4** | **Teresa steruje wszystkim** | Każda akcja dostępna w interfejsie musi dać się wywołać rozmową z Teresą. Bez wyjątków. |

Te zasady nie są aspiracją — są **kryterium odbioru**. Rozdział, który je łamie, jest błędny.

## 3. Zakres akcji (scope)

Każda akcja ma **dokładnie jeden** zakres podstawowy. Zakres decyduje, gdzie akcja może mieszkać.

| Zakres | Znaczenie | Gdzie akcja może mieszkać |
|---|---|---|
| `workspace` | cała Idea | Menu 1, Teresa, prawy panel → Przegląd |
| `current_view` | aktualna reprezentacja | Menu 3, „Więcej" widoku, prawy dolny róg |
| `selected_items` | wiele zaznaczonych elementów | pasek zaznaczenia, menu zaznaczenia, Właściwości |
| `single_item` | jeden element | Właściwości, menu elementu, pasek zaznaczenia |
| `edge` | krawędź / połączenie | menu krawędzi, Właściwości |
| `lane_frame` | tor, ramka, obszar, sekcja | menu kontenera, Właściwości |
| `table_row` | jeden rekord | menu wiersza, Właściwości |
| `table_column` | pole / kolumna | menu nagłówka, zarządzanie polami |
| `table_cell` | pojedyncza komórka | menu komórki, edytor inline |
| `external_artifact` | inicjatywa, zadanie, decyzja, dokument | Powiązania, Konwersja |

### Twarde zakazy zakresu
1. Akcja o zakresie `workspace` **nie mieszka** w lewym railu.
2. Akcja o zakresie zaznaczenia **nie mieszka** w globalnym „Więcej".
3. „Usuń zaznaczone" **nie pokazuje się**, gdy nic nie jest zaznaczone.
4. Konwersja całej Idei **nie wygląda tak samo** jak konwersja zaznaczenia — etykieta musi nazywać zakres.
5. Eksport **nie tworzy** trwałego artefaktu w systemie.
6. Jedna etykieta **nie oznacza** jednocześnie przełączenia widoku, konwersji i otwarcia panelu.
7. Funkcja bez wywołania modelu językowego **nie nazywa się** „AI".
8. Akcja widoczna w interfejsie **nie może** być cichym brakiem reakcji.

## 4. Co wspólne, a co specyficzne (realizacja Z1)

To jest wymagana przez Z1 klarowność. **Wszystko poniżej jako „wspólne" musi działać identycznie w czterech reprezentacjach.**

### Wspólne — identyczne wszędzie
| Obszar | Zakres wspólności |
|---|---|
| Menu 1 | pełny układ: powrót · breadcrumb · nazwa · etap · stan zapisu · Teresa · Konwertuj · kebab |
| Prawy panel | pięć zakładek: Przegląd · Właściwości · Powiązania · Komentarze · Historia |
| Prawy dolny róg | zoom · dopasuj · minimapa · przełącznik reprezentacji |
| Menu 3 — szkielet | lewa: tryb → tworzenie → układ → AI → Szablony; prawa: Import → Eksport → Więcej |
| Lewy rail — szkielet | góra: zaznaczanie/przesuwanie · środek: tworzenie/relacje · niżej: komentarz/link/AI · dół: Więcej/Cofnij/Ponów |
| Menu kontekstowe — szkielet | tło · element · krawędź · kontener |
| Pasek zaznaczenia | edytuj · duplikuj · komentarz · link · AI · styl · konwertuj zaznaczone · usuń |
| Stany akcji | włączona · wyłączona z podanym powodem · ładowanie · sukces · błąd · pusto · brak uprawnień · offline |
| Skróty | te same akcje = te same skróty |
| Model AI | propozycja → podgląd → akceptuj/odrzuć → historia → cofnij |
| Teresa | dostęp do wszystkich akcji przez rejestr |

### Specyficzne — jawnie dozwolone różnice
| Reprezentacja | Co ma własnego | Dlaczego |
|---|---|---|
| **Mind Map** | poziomy widoczności (zwiń/rozwiń), gałąź jako jednostka operacji, auto-układ drzewa | hierarchia to istota mapy |
| **Whiteboard** | tryb warsztatowy (rola · fazy · timer · głosowanie · podążanie), rysowanie odręczne, sceny/zapisany widok | facylitacja to istota tablicy |
| **Process Flow** | typ przepływu (Klasyczny/Automatyzacja/Strumień wartości), semantyka BPMN (Start·Koniec·Aktywność·Decyzja·Tor·Split), walidacja procesu | proces ma semantykę, nie tylko prostokąty |
| **Table** | widoki (Grid·Kanban·Timeline·Kalendarz·Matryca·Galeria), pola i typy, filtr/sort/grupowanie, menu wiersza/kolumny/komórki | dane to nie płótno — brak Ręki, Połącz, minimapy |

> **Reguła rozstrzygająca spory:** jeśli funkcji nie ma w tabeli „specyficzne", musi zachowywać się identycznie we wszystkich reprezentacjach. Wprowadzenie nowej różnicy wymaga dopisania jej do tej tabeli **wraz z uzasadnieniem**.

## 5. Poza zakresem tego standardu

**Mapowanie semantyczne między reprezentacjami** (decyzja D3) — czyli automatyczne pokazanie węzła mapy jako kroku procesu z właściwym kształtem albo jako wiersza z kolumnami. Dziś graf jest wspólny, więc elementy są widoczne wszędzie, ale ich **semantyka nie jest tłumaczona automatycznie**. To osobny projekt produktowy, nie poprawka. Standard zapisuje to jako cel kierunkowy, żeby nie wpadło jako „drobiazg" do jednej z faz naprawczych.

## Kryteria odbioru

- [ ] Każda akcja w systemie ma przypisany dokładnie jeden zakres z listy w §3.
- [ ] Żadna akcja nie łamie ośmiu zakazów zakresu.
- [ ] Funkcja spoza tabeli „specyficzne" zachowuje się identycznie w czterech reprezentacjach.
- [ ] Nowa różnica między reprezentacjami jest dopisana do tabeli §4 z uzasadnieniem.
- [ ] Przełączenie reprezentacji nie zmienia danych i nie wpływa na ekran innych użytkowników.
- [ ] Mapowanie semantyczne jest opisane jako osobny projekt, nie ukryte w backlogu naprawczym.
