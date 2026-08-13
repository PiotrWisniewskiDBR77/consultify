# 03 — Architektura ekranu

> **Aktualizacja 2026-08-09:** geometria lewy/prawy panel została zastąpiona
> decyzją właścicielską w [rozdziale 13](13_MIGRACJA_NAWIGACJI_2026-08-09.md).
> Ten rozdział pozostaje źródłem zakresów i zachowań warstw, ale nie rozstrzyga
> już strony panelu informacji ani raila narzędzi.

Ten rozdział ustala, z jakich warstw zbudowany jest ekran Idea Workspace, gdzie każda warstwa mieszka, czego jej wolno, a czego nie, oraz jak się zachowuje niezależnie od reprezentacji (przewijanie, stany akcji, tooltipy, puste stany). Jest wykonawczy dla layoutu — rozdział `01_MODEL_I_ZASADY.md` rozstrzyga zakresy i zasady, rozdział `07_PRAWY_PANEL.md` rozstrzyga treść i zachowanie prawego panelu. W razie sprzeczności o zakresie/zasadach wygrywa `01`, o treści prawego panelu wygrywa `07`, ten rozdział rozstrzyga wyłącznie **układ ekranu**.

## 1. Osiem warstw ekranu

Ekran Idea Workspace ma dokładnie osiem warstw. Każda ma jedną odpowiedzialność — mieszanie ich zawartości jest złamaniem tego rozdziału.

| # | Warstwa | Odpowiada za | NIE może zawierać |
|---|---|---|---|
| 1 | **Menu 1** | tożsamość całej Idei: powrót, breadcrumb, nazwa, etap, stan zapisu, Teresa, Konwertuj, kebab | akcji specyficznych dla jednej reprezentacji; ustawień zaznaczenia |
| 2 | **Menu 3** | akcje bieżącej reprezentacji: tworzenie, układ, AI (workspace/current_view), Szablony, Import, Eksport, Więcej | akcji na pojedynczym zaznaczeniu (to pasek zaznaczenia); przełącznika reprezentacji (to prawy dolny róg) |
| 3 | **Lewy rail** | szybką edycję bieżącej reprezentacji — narzędzia canvasu/danych pod ręką (patrz `06_LEWY_RAIL.md`) | przełącznika reprezentacji, Konwersji, Eksportu, historii, ustawień Idei — patrz `06` §2 |
| 4 | **Płótno / obszar roboczy** | renderowanie samej reprezentacji (mapa, tablica, proces, siatka danych) i interakcję z jej elementami | chrome'u aplikacji (paski, panele) — tylko treść Idei |
| 5 | **Prawy panel** | informację o Idei i o zaznaczeniu: Przegląd · Właściwości · Powiązania · Komentarze · Historia (pełna specyfikacja: `07_PRAWY_PANEL.md`) | akcji globalnych niezwiązanych z aktywną zakładką; przełącznika reprezentacji |
| 6 | **Pasek zaznaczenia** | akcje natychmiastowe na aktualnym zaznaczeniu, pływające nad elementem: edytuj · duplikuj · komentarz · link · AI · styl · konwertuj zaznaczone · usuń | akcji o zakresie `workspace`; nawigacji |
| 7 | **Menu kontekstowe** | te same akcje co pasek zaznaczenia/rail, dostępne z prawego kliku, wg celu: tło · element · krawędź · kontener | pozycji, których nie ma nigdzie indziej w UI (menu kontekstowe nie jest źródłem unikalnych akcji) |
| 8 | **Prawy dolny róg** | nawigację po widoku: zoom · dopasuj · minimapa · przełącznik reprezentacji (D2) | żadnej akcji zmieniającej dane Idei |

Zasada ogólna: **każda akcja w systemie ma dokładnie jedną warstwę-właściciela**. Ta sama akcja może być dostępna w drugiej warstwie tylko jako świadomy skrót do tego samego handlera (np. Eksport w Menu 1 i Menu 3 — udokumentowany duplikat, patrz `01` §3 zakaz 6 o jednoznaczności etykiety).

## 2. Układ wizualny

| Element | Układ |
|---|---|
| Menu 1 | pełna szerokość ekranu, u góry, nad wszystkim, nieruchome |
| Menu 3 | pełna szerokość ekranu, bezpośrednio pod Menu 1, nieruchome |
| Lewy rail | pionowy, wąski, wyłącznie ikony (bez etykiet tekstowych na stałe — etykieta tylko w tooltipie), pływający nad płótnem przy lewej krawędzi obszaru roboczego, pod Menu 3 |
| Płótno | wypełnia całą pozostałą przestrzeń między lewym railem a prawym panelem (gdy otwarty) albo do prawej krawędzi (gdy panel zamknięty) |
| Prawy panel | jasny komponent systemowy, **szerokość stała 384 px**, zaokrąglenie 14 px, odstęp od krawędzi ekranu i od obszaru roboczego, własny scroll wewnętrzny — pełna specyfikacja wizualna w `07_PRAWY_PANEL.md` §3 |
| Pasek zaznaczenia | pływający, przyklejony nad (lub obok, gdy brak miejsca nad) zaznaczonym elementem na płótnie |
| Menu kontekstowe | pojawia się w punkcie kliknięcia, nigdy nie przesłania trwale innej warstwy |
| Prawy dolny róg | pływający klaster w rogu obszaru roboczego, **osobno** od prawego panelu — gdy panel jest otwarty, róg zostaje w rogu płótna (nie w rogu panelu) |

**Twardy wymóg nienachodzenia:** żadna pływająca warstwa (rail, prawy dolny róg, pasek zaznaczenia) nie może się nakładać na pasek własny reprezentacji ani obcinać jego zawartości. Patrz `06_LEWY_RAIL.md` §7 — znany defekt (rail zasłaniający pasek Tabeli) i wymóg naprawy.

## 3. Przewijanie

| Warstwa | Zachowanie |
|---|---|
| Menu 1 | nieruchome — nie przewija się nigdy |
| Menu 3 | nieruchome — nie przewija się nigdy |
| Lewy rail | nieruchomy względem viewportu; nie przewija się z płótnem |
| Płótno (Mind Map / Whiteboard / Process Flow) | własna przestrzeń pan/zoom — przewijanie i skalowanie zmienia widok płótna, nie stronę |
| Płótno (Table) | scroll wewnętrzny siatki (pionowy i poziomy), niezależny od reszty ekranu; nagłówek kolumn i pierwsza kolumna mogą pozostawać przyklejone (sticky) |
| Prawy panel | **wyłącznie wewnątrz panelu** — karty nie kurczą się, gdy treść przekracza wysokość; sam panel nie przesuwa się z płótnem |
| Pasek zaznaczenia | nie przewija się — repozycjonuje względem elementu przy pan/zoom płótna |
| Menu kontekstowe | zamyka się przy scrollu/pan zamiast przewijać się razem z płótnem |
| Prawy dolny róg | nieruchomy względem viewportu |

## 4. Stany wspólne każdej akcji

Każda akcja w każdej warstwie musi umieć wystąpić w każdym z ośmiu stanów. Brak obsługi któregokolwiek stanu jest błędem (Z3).

| Stan | Co widzi użytkownik | Zasada |
|---|---|---|
| **Włączona** | pełny kolor, kursor wskazuje klikalność | domyślny stan gotowości |
| **Wyłączona z powodem** | wyszarzona, kursor `not-allowed`, tooltip **musi** podać powód | nigdy cichy `disabled` bez wyjaśnienia (Z3) |
| **Ładowanie** | spinner w miejscu ikony lub obok etykiety, akcja niedostępna do ponownego kliknięcia w trakcie | zapobiega podwójnemu wywołaniu |
| **Sukces** | krótkie potwierdzenie (toast, zmiana ikony na moment, podświetlenie efektu) | użytkownik musi wiedzieć, że coś się stało, bez czekania na inspekcję wyniku |
| **Błąd** | toast lub inline komunikat z treścią błędu, akcja wraca do stanu włączonego (możliwość ponowienia) | błąd nigdy nie ginie w ciszy |
| **Pusto** | akcja widoczna, ale kontekst, na którym miałaby działać, jest pusty (np. „Usuń zaznaczone" bez zaznaczenia) | patrz `01` §3 zakaz 3 — taka akcja **nie pokazuje się w ogóle**, zamiast disabled bez sensu |
| **Brak uprawnień** | wyszarzona lub ukryta (zależnie od polityki roli), tooltip nazywa brakujące uprawnienie | ⟦DO USTALENIA⟧ — model ról i uprawnień dla Idea Workspace nie jest opisany w żadnym dostępnym źródle (luka L7 audytu) |
| **Offline** | pasek/baner informujący o braku połączenia; akcje mutujące dane wyłączone z powodem „offline", akcje czytające (nawigacja, zoom) działają dalej | zapobiega cichej utracie zmian |

## 5. Standard tooltipów

Każdy przycisk ikonowy — bez wyjątku, w każdej z ośmiu warstw — ma tooltip. Struktura tooltipa jest stała:

```
[Nazwa akcji]
[zakres — jeśli nieoczywisty z kontekstu]
[skrót klawiszowy — jeśli istnieje]
[powód wyłączenia — tylko gdy akcja jest disabled]
```

| Pole | Kiedy obecne | Przykład |
|---|---|---|
| Nazwa | zawsze | „Dodaj węzeł" |
| Zakres | gdy nazwa sama nie precyzuje, na czym działa akcja | „Konwertuj gałąź" (nie samo „Konwertuj" — patrz `01` §3 zakaz 4) |
| Skrót | gdy akcja ma przypisany skrót | „Tab" / „⌘⇧H" |
| Powód wyłączenia | tylko w stanie disabled | „Zaznacz węzeł, aby dodać komentarz" |

Przykład pełnego tooltipa (włączony): **Dodaj gałąź-dziecko** · Tab
Przykład pełnego tooltipa (wyłączony): **Komentarze** · wymaga zaznaczonego elementu · *wyszarzone: zaznacz element, aby dodać komentarz*

⚠ **Dziś:** część przycisków icon-only (np. filtr zaawansowany w Tabeli) nie ma w ogóle atrybutu tooltipa (`_CROSSCHECK_OPENAI_VS_AUDYT_2026-07-23.md` §5 p.4). **Docelowo:** zero przycisków ikonowych bez tooltipa — egzekwowane tym samym mechanizmem co reszta Z3.

## 6. Puste stany per reprezentacja

Pusta Idea (brak elementów) nie może wyglądać jak błąd ani jak martwy ekran — musi prowadzić do pierwszej akcji.

| Reprezentacja | Co widać, gdy brak treści | Prowadzi do |
|---|---|---|
| **Mind Map** | pojedynczy węzeł root z nazwą Idei, gotowy do edycji etykiety | rail → Dodaj węzeł / Szablony (Menu 3) |
| **Whiteboard** | pusta tablica z delikatną siatką, podpowiedź „Zacznij od karteczki albo szablonu" | rail → Karteczka / Szablony |
| **Process Flow** | pojedynczy węzeł Start, gotowy do rozbudowy | rail → Task/Decyzja/Tor / Szablony |
| **Table** | siatka bez wierszy, widoczne nagłówki kolumn domyślnych + wiersz-zachęta „Dodaj pierwszy rekord" | rail (data-rail) → Nowy wiersz / Szablony |

Puste stany **nie są** tym samym co stan „Pusto" z §4 (ten dotyczy pojedynczej akcji bez kontekstu). Puste stany reprezentacji dotyczą całego płótna.

## 7. Prawy dolny róg (D2)

Decyzja właściciela D2: przełącznik czterech reprezentacji przenosi się z lewego railа (dziś: pozycje 1–4 na górze) do prawego dolnego rogu, obok zoom/dopasuj/minimapy. Rail przestaje być miejscem przełączania — patrz `06_LEWY_RAIL.md` §2.

| Element | Ikona | Zachowanie |
|---|---|---|
| **Zoom −** | minus | zmniejsza powiększenie płótna o krok |
| **Wartość zoom** | tekst procentowy | klik otwiera listę poziomów / reset do 100% |
| **Zoom +** | plus | zwiększa powiększenie o krok |
| **Dopasuj** | ikona ramki/fit | centruje i skaluje widok do całej zawartości |
| **Minimapa** | **wyłącznie ikona** (bez podpisu tekstowego) | toggle — pokazuje/chowa miniaturę całego płótna w rogu |
| **Przełącznik reprezentacji** | 4 ikony (Mind Map/Whiteboard/Process Flow/Table), ta sama ikonografia co dziś na górze raila | klik zmienia aktywną reprezentację — preferencja lokalna, patrz `01` §1 „Przełączenie reprezentacji nie jest konwersją" |

⚠ **Dziś:** w rogu jest tekst „Mini mapa" zamiast samej ikony (`_CROSSCHECK_OPENAI_VS_AUDYT_2026-07-23.md` §K2). **Docelowo:** wyłącznie ikona — to jest wprost decyzja D2, nie propozycja do przedyskutowania.

⚠ **Do potwierdzenia na prototypie przed wdrożeniem** (reguła #7 CLAUDE.md — Piotr nie jest pierwszym testerem wizualnym): przeniesienie przełącznika w róg obniża jego widoczność względem dzisiejszego stanu (4 duże ikony na górze raila). Zbudować i zweryfikować zrzutem przed pokazaniem.

Kolejność w rogu, od lewej do prawej: Zoom − · wartość · Zoom + · separator · Dopasuj · Minimapa · separator · Przełącznik reprezentacji. ⟦DO USTALENIA⟧ — kolejność nie jest potwierdzona w żadnym dostępnym źródle, przyjęta tu jako propozycja robocza zgodna z konwencją narzędzi canvasowych (Miro/Figma: nawigacja widoku po lewej, przełącznik trybu po prawej).

## 8. Co wspólne, co specyficzne — dla warstw ekranu

`01_MODEL_I_ZASADY.md` §4 ustala wspólny/specyficzny podział dla **akcji**. Ten paragraf rozszerza go dla **samej struktury warstw** — czyli co z ośmiu warstw jest identyczne piksel w piksel między reprezentacjami, a gdzie standard jawnie dopuszcza różnicę w samej obecności/rozmiarze warstwy (nie tylko w treści akcji).

| Warstwa | Wspólne między 4 reprezentacjami | Specyficzne — co się różni |
|---|---|---|
| Menu 1 | pełny układ i wszystkie pozycje, zawsze | — (brak dozwolonej różnicy) |
| Menu 3 | szkielet (tryb→tworzenie→układ→AI→Szablony \| Import→Eksport→Więcej), pozycja, wysokość | **dziś:** każda reprezentacja dokłada pod spodem WŁASNY pasek narzędzi (`IdeaWorkspaceToolbar`/`WhiteboardToolbar`/`ProcessFlowToolbar`/`TableToolbar`) — to jest jawnie dozwolona różnica (treść specyficzna danego narzędzia), pod warunkiem że nie duplikuje martwych akcji ze wspólnego szkieletu (patrz `07_DUPLICATES_AND_CONFLICTS.md` §16) |
| Lewy rail | szkielet czterowarstwowy (góra/środek/niżej/dół), pozycja, szerokość, wygląd ikon | zawartość tier „środek" (tworzenie/relacje/struktura) jest w całości specyficzna per reprezentacja — pełny opis w `06_LEWY_RAIL.md` |
| Płótno | brak — to jest z definicji warstwa w 100% specyficzna | silnik renderowania (graf-canvas dla 3 pierwszych, siatka dla Table), interakcje (pan/zoom vs scroll), jednostka operacji (węzeł/element/krok/wiersz) |
| Prawy panel | pięć zakładek, wygląd, szerokość, zachowanie przełączania | treść zakładki Właściwości (co pokazuje zależnie od typu zaznaczenia) — pełny opis `07` §5 |
| Pasek zaznaczenia | zestaw kategorii akcji (edytuj/duplikuj/komentarz/link/AI/styl/konwertuj/usuń), pozycja pływająca | dokładny zestaw ikon i akcji lokalnych (np. Whiteboard ma dodatkowo Wyrównaj/Rozłóż/Grupuj — działania geometryczne bez odpowiednika w Process Flow) |
| Menu kontekstowe | podział na tło/element/krawędź/kontener | Table nie ma pojęcia krawędzi ani kontenera — ma zamiast tego wiersz/kolumnę/komórkę (patrz `01` §3 tabela zakresów) |
| Prawy dolny róg | wszystkie 4 elementy, zawsze, w każdej reprezentacji | — (brak dozwolonej różnicy — to jedna z niewielu warstw bez wariantów) |

**Reguła rozstrzygająca spory (identyczna jak w `01` §4):** jeśli różnica w strukturze warstwy nie jest wymieniona w prawej kolumnie powyżej, warstwa musi wyglądać i zachowywać się identycznie we wszystkich czterech reprezentacjach. Nowa różnica wymaga dopisania tutaj, z uzasadnieniem.

## Kryteria odbioru

- [ ] Ekran ma dokładnie osiem warstw z tego rozdziału — żadna funkcja nie tworzy dziewiątej.
- [ ] Żadna warstwa nie zawiera treści zakazanej jej kolumną „NIE może zawierać" (§1).
- [ ] Menu 1 i Menu 3 są pełnoszerokościowe i nieruchome; lewy rail wąski, ikonowy, pływający.
- [ ] Prawy panel: 384 px, zaokrąglenie 14 px, własny scroll, zgodny z `07` §3 — sprawdzony zrzutem w jasnym i ciemnym motywie.
- [ ] Żadna pływająca warstwa nie nachodzi na pasek własny reprezentacji (§2, zob. też `06` §7).
- [ ] Każda akcja obsługuje wszystkie osiem stanów z §4, gdzie ma to zastosowanie.
- [ ] Każdy przycisk ikonowy ma tooltip w formacie z §5; disabled zawsze z powodem.
- [ ] Pusta reprezentacja pokazuje stan z §6, nie pusty/błędny ekran.
- [ ] Prawy dolny róg zawiera dokładnie cztery elementy z §7; minimapa to ikona, nie tekst.
- [ ] Przełącznik reprezentacji zniknął z lewego raila — jest wyłącznie w prawym dolnym rogu.
- [ ] Każda różnica w strukturze warstwy między reprezentacjami jest jawnie wymieniona w §8.
- [ ] Weryfikacja wzrokiem (zrzuty), oba motywy, wszystkie 4 reprezentacje — nie „testy przeszły".
