# Odbiór na żywo 05.09 — pakiet 16 „Kanon i elementy wspólne” (11 pozycji)

## Liczby
- ZGODNY: **2**
- ROZNI_SIE: **3**
- NIE_DOTARLEM: **6**

Wyniki: `evidence/odbior-zywo-20260905/16-kanon/wyniki.json`. Zrzuty w tym samym katalogu.

## Różnice (3) — po jednym zdaniu
1. **standard-kanban-card** — realna karta kanban nie ma stopki „NASTĘPNA BRAMKA” ani cichych pigułek statusu/tagów (priorytet jest tekstem z kropką), a nazwy kolumn są po angielsku (To Do / In Progress / Blocked / Done).
2. **standard-grid-card** — realna karta siatki nie ma lewego kolorowego paska akcentu kategorii, paska postępu z procentem ani kebaba; zamiast tego ma wiersz właściciela i stopkę „Następny krok”, a pigułki statusu są po angielsku.
3. **mw-007-calendar-narrow-viewport** — przełącznik widoku ma trzy pozycje (Miesiąc/Tydzień/Dzień), a obraz miał cztery — brakuje „Lista”; lista ŹRÓDEŁ ma 3 pozycje zamiast 4 i nie używa już crimsonowych kolorów kategorii.

## Nie dotarłem (6) — z powodem
1–4. **prawy-pas-jedna-formula-*** (idea/notatka × Teresa/Artefakt) — pakiet sam mówi, że to PROTOTYP DO DECYZJI, którego „nie ma jeszcze w aplikacji”; wspólnego prawego pasa z przełącznikiem Artefakt/Teresa nie ma w żadnym module. Zrzuty pokazują najbliższe realne odpowiedniki (szyna paneli kanwy idei, prawy panel notatnika).
5. **standard-module-bar-children** — obraz to galeria wariantów komponentu z harnessu dev-render; w aplikacji nie ma ekranu pokazującego sześć wariantów obok siebie (sam pakiet rekomenduje zdjęcie tej pozycji z odbioru ekran-po-ekranie). Warianty A–E widziałem rozproszone na realnych ekranach; wariantu F (Benefits) nie sprawdzałem.
6. **rn-g3-class-l-record-shell** — w trakcie pakietu WYGASŁA zalogowana sesja automatu: każde wejście kończy się przekierowaniem na `/login` i HTTP 401 na `/api/auth/refresh`. Ekran istnieje w kodzie (`src/components/ResultsVNext/ResultsKpiRegistryPage.tsx`, trasy `/results/kpi` i `/results/kpi/:kpiId`, za flagą `kpiRegistry`) — do sprawdzenia po odnowieniu sesji.

## Zgodne (2)
- **prawy-panel-szyna-ikon** — szyna ikon jest zawsze widoczna niezależnie od zawartości panelu, aktywna ikona podświetlona; zestaw ikon jest per moduł (w kanwie idei sześć: Przegląd, Właściwości, Powiązania, AI, Aktywność, Wygląd).
- **fab-rail-kebab** — szyna narzędzi siedzi we własnym pasie przy prawej krawędzi i nie zasłania tabeli, kebab jest w każdym wierszu, a pasek akcji rekordu siedzi w panelu podglądu — czyli dokładnie tak, jak zapisał nadzorca w wyjątku.

## Znaleziska poboczne
- **Tabela inicjatyw**: przy otwartym podglądzie tekst w prawych kolumnach jest ucinany w połowie słowa („Identyfi…”, „Pewnoś…”, „Nieznar…”).
- **Język**: pigułki statusu inicjatyw (Executing/Scheduled/Draft/In Review/Approved/Tracking) i nazwy kolumn kanbanu zadań (To Do/In Progress/Blocked/Done) zostają po angielsku w polskim interfejsie.

## Ile czasu i co było trudne
Około 40 minut. Trudności: (1) siedem z jedenastu pozycji to nie ekrany produktu, tylko wzorce/galerie harnessu albo jawne prototypy — porównanie „ekran po ekranie” dla nich nie ma sensu i tak je opisałem; (2) w trakcie pracy wygasła sesja automatu, przez co ostatnia pozycja (rekord KPI) została bez pomiaru.
