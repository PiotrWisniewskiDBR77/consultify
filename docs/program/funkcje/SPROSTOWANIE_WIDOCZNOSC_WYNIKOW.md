---
doc_id: funkcje-sprostowanie-widocznosc-wynikow
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# SPROSTOWANIE nadzorcy: powiedziałem właścicielowi, że OKR i ROI są niewidoczne na demo. To było FAŁSZ

## Co powiedziałem (1.09, przy wydawaniu dyżuru 234)
> „OKR i ROI są domyślnie niewidoczne — też na demo. Z 33 elementów około 22 nikt nie
> zobaczy bez ręcznego ustawienia flagi."

**Obie części tego zdania były nieprawdziwe.**

## Jak jest naprawdę
1. **Na realnym `demo.consultify.ai` te ekrany SĄ widoczne.** Zmienna środowiskowa
   `VITE_DEMO_ACCEPTANCE` jest tam **ustawiona** — potwierdził to **sam właściciel**,
   otwierając panel Railway 28.08 (decyzja `DEC-2026-08-28-216`). Ta zmienna działa jako
   **wczesny `return true`**, który omija całą logikę flag poniżej.
2. **Liczba też była zła.** Na gołym kodzie, bez zmiennej, nieosiągalne są **24 z 33**
   elementów, nie „około 22". Na realnym demo: **0 z 33**.

## Skąd wziął się mój błąd — i dlaczego jest pouczający
Przeczytałem **wartości domyślne flag w kodzie** i uznałem je za stan produktu.
Ale **dwa `return true`** stojące **wyżej w tej samej funkcji** przechwytują sterowanie,
zanim którakolwiek z tych wartości domyślnych zostanie w ogóle sprawdzona.

> **„Flaga wyłączona w kodzie" ≠ „wyłączone na demo".**
> Wartość domyślna flagi jest twierdzeniem o kodzie, nie o działającym systemie.

To jest **ta sama pułapka**, przed którą sam ostrzegam wykonawców w każdej instrukcji:
*weryfikuj realny runtime, nie kod i nie flagi*. Zastosowałem tę regułę do cudzej pracy
i **nie zastosowałem jej do własnego zdania**.

## Rzecz poważniejsza od mojej pomyłki
Poprzednia sesja nadzorcza **zmierzyła i zapisała** zasięg tej zmiennej już 28.08, i jest on
**większy niż w tym module**. `isDemoAcceptanceProfileEnabled` jest czytane jako wczesny
`return true` przez **sześć rodzin flag**: Wyniki (KPI+ROI+OKR naraz) oraz pięć rodzin
w obszarze pomysłów i studia artefaktów.

**Czyli na demo jest dziś włączone znacznie więcej, niż wynika z flag w kodzie — i nic z tego
nie przeszło akceptu właściciela na zrzutach.** To jest formalne złamanie reguły 7
(*właściciel nigdy nie jest pierwszym testerem wizualnym*) oraz zakazu masowego włączania
flag — ale przez **konfigurację środowiska, nie przez kod**, dlatego **żaden bezpiecznik
repozytorium nie mógł tego wykryć**.

**Okoliczność łagodząca:** koperta widoczności wpuszcza wyłącznie aktywnego właściciela
i administratora, więc **konsultant tych ekranów nie widzi** — widzi je właściciel.

**Właściciel zdecydował 28.08 (`DEC-2026-08-28-227`): demo NIETKNIĘTE.** Nadzorca tej
zmiennej nie rusza (`Z28` + środowisko właściciela).

## Co z tego wynika dla programu
1. **Każdy audyt flag musi obejmować konfigurację środowiska, nie tylko kod.**
   Sama tabela wartości domyślnych jest **niekompletna z definicji**.
2. **Instrukcja dyżuru 234 i raport wykonawcy nie zacytowały tych decyzji ani razu**,
   mimo że oba cytowały **dokładnie ten sam plik i te same linie**. Rejestr decyzji
   właściciela jest źródłem prawdy (`Z14`) — jeżeli nikt do niego nie zagląda, to nim nie jest.
3. **Pomiar „13 z 13 testów przeszło" nie był dowodem na nic w tej sprawie** — ani jeden
   z tych testów nie dotyka ścieżki `isDemoAcceptanceProfileEnabled`, czyli tej jedynej,
   która jest produkcyjnie aktywna na demo. **Zielony zestaw testów pokrywał wszystko poza
   tym, co działa naprawdę.**

## Zadania
- Dopisać stan `VITE_DEMO_ACCEPTANCE` i jego wpływ do karty modułu Wyników.
- Dodać do pakietu testów flag przypadek pokrywający tę ścieżkę — dziś ma **zero pokrycia**,
  będąc jednocześnie **jedyną aktywną na demo**.
- Rozstrzygnąć kanoniczny mianownik pokrycia: **130 / 146 / 152** — trzy metody, trzy liczby,
  wszystkie odtwarzalne. **Liczba `135` nie jest odtwarzalna żadną z nich** i należy ją
  wycofać z obiegu. Wybór należy do nadzorcy, nie do wykonawcy.
