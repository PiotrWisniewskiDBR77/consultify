# PLAN WYKONAWCZY — Re-skin do keynote (Vegas)
**Data:** 2026-07-01 | **Autor:** Harvard Strateg (rola: MP odpowiedzialny za scenę)
**Wchodzi z:** [ARTIFACT_ANATOMY_STANDARD](ARTIFACT_ANATOMY_STANDARD.md) (spec) + [RESKIN_AUDIT](RESKIN_AUDIT_2026-06-30.md) (fale) + [RAPORT_UIUX_WALKTHROUGH](RAPORT_UIUX_WALKTHROUGH_2026-06-30.md) (bugi)
**Zasada nadrzędna:** nie skinujemy 200 ekranów. Doprowadzamy do perfekcji JEDEN przepływ demo, resztę po Vegas.

---

## 0. Jedyny brakujący input
**Data keynote.** Cała priorytetyzacja jest wstecz od niej. Plan poniżej działa w **tygodniach względnych (T-n)**; podaj datę → zamienię na kalendarz. Domyślnie zakładam **T = 12 tygodni** (typowy horyzont); jeśli mniej — tniemy zakres golden-path, nie jakość.

## 0a. Definicja „Vegas-ready" (kryterium końca)
Golden Path (8 ekranów) działa end-to-end na demo, w trybie sceny (dark), bez śmieci testowych, bez błędów ładowania, z jedną sygnaturą wizualną „do screenshotu", perf < próg, przećwiczony na projektorze. Reszta aplikacji NIE musi być gotowa.

---

## FAZA 1 — Pewność (T-12 → T-11) · właściciel: Strateg + Piotr
Cel: usunąć niepewność zanim ktokolwiek dotknie 200 plików.

1. **Zdefiniować Vegas Golden Path — 8 ekranów.** Rekomendacja (pokrywa wszystkie typy powierzchni):
   | # | Ekran | Powierzchnia | Typ |
   |---|-------|--------------|-----|
   | 1 | Czat z Teresą | Konwersacja | SPEC-K |
   | 2 | Ideas — Mind Map | Artefakt-Canvas | A |
   | 3 | Assessment — macierz DRD | Artefakt-Matryca | D |
   | 4 | Tool detail (np. Ansoff) | Artefakt-Canvas | A |
   | 5 | Inicjatywa | Artefakt-Rekord | C-L |
   | 6 | Wdrożenie (Execution) | Instrument (gantt/kanban) | I |
   | 7 | Rezultaty (Results) | Instrument (dashboard) | I |
   | 8 | Materiały — deck | Artefakt-Deck | E |
   → **8 ekranów = jednocześnie wizualny wzorzec dla KAŻDEGO typu powierzchni.** Bonus: to jest złota ścieżka konsultanta (spójna HISTORIA na scenie).
2. **Wybrać tryb sceny = dark.** Light dopinamy po Vegas. (usuwa podwójne QA przed deadlinem)
3. **Zdefiniować sygnaturę wizualną** — jeden moment „wow do screenshotu" (kandydat: przejście Assessment-matryca → wygenerowany premium deck, albo AI komponujący slajd na żywo). Decyzja Piotra.
4. **Uczciwy status specu → v0.9** („struktura kompletna; wizualizacja + weryfikacja pending"). Koniec overclaimu.
5. **Bramka G1:** Piotr akceptuje 8 ekranów + tryb + sygnaturę. Bez tego nie ruszamy.

## FAZA 2 — Wizualny wzorzec (T-11 → T-9) · właściciel: Cloud, odbiór Piotr
Cel: PIERWSZY raz zobaczyć jak to wygląda. Bez tego cały spec to wiara.

6. **Zbudować 4 ekrany referencyjne w realnym kodzie** (po jednym na typ powierzchni z golden-path): Lista (użyj MyWork jako bazy — najniższe ryzyko), Artefakt (Inicjatywa), Instrument (Results dashboard), Chat. Pełna zgodność ze specem, tryb dark.
7. **Piotr odbiera WYRENDEROWANE ekrany** (nie tabele) → runda uwag → poprawki.
8. **Zamrozić je jako wizualny SOT** — od teraz spec ma dowód, nie obietnicę.
9. **Bramka G2:** Piotr podpisuje wygląd 4 wzorców. To jest moment „tak wygląda aplikacja warta miliardy" — albo wracamy do §9/§11.

## FAZA 3 — Fundament współdzielony (T-9 → T-7) · właściciel: Cloud
Cel: to co promieniuje na wszystko. Robione RAZ.

10. **Fala 0 — bramka tokenów** (ESLint: zakaz navy/slate/hex w nowym kodzie). Dług zablokowany.
11. **Fala 1 — 40 elementów jako komponenty współdzielone** (§9), priorytetyzowane wg golden-path (najpierw te, których 8 ekranów używa).
12. **Fixy systemowe (radiują):** multi-select (A-1), Menu 2 pill (A-2), Edit Columns (A-4), selection=neutral/blue (SYS-1), chipy Menu 3 w ramkach (A-3).
13. **STAGE-BLOCKER P0: wyczyścić dane testowe** (E2E/DEMO/Debug), naprawić „Failed to load", raporty Assessment. Bez tego demo się pali.
14. **Poprawki wyborów z review:** limit palety wykresów (≤5 serii, ramy sekwencyjne); przemianować Menu 1/2/3 → AppBar/ModuleTabs/CommandRow; zwalidować próg S/L na Decyzji.
15. **Bramka G3:** 4 wzorce nadal wyglądają dobrze po podmianie na komponenty współdzielone (regresja = stop).

## FAZA 4 — Golden Path, ekran po ekranie (T-7 → T-4) · właściciel: Cloud, odbiór Pilot+Piotr
Cel: 8 ekranów do perfekcji. Kolejność wg ryzyka (najpewniejsze pierwsze).

16. Kolejność: **Lista/tabele → Rekord (Inicjatywa) → Matryca (Assessment) → Canvas (Ideas, Tool) → Instrument (Execution, Results) → Deck (Materiały) → Chat.**
17. Każdy ekran: build wg spec → **Piotr przechodzi przeskinowany ekran** (Twój loop: koduj→przejdź→popraw) → runda 2.
18. **Problemy produktowe, nie skóry** (jeśli na golden-path): M15 IA (4 koncepty→hierarchia), Assessment reports podłączyć DRD, Tool detail zaprojektować od zera. To NIE reskin — to redesign; osobne mini-specy.
19. **Bramka G4:** każdy z 8 ekranów odebrany zielony na demo.

## FAZA 5 — Hartowanie sceniczne (T-4 → T-1) · właściciel: Strateg+Cloud+Piotr
Cel: żeby na żywo, na projektorze, nie pękło.

20. **Budżet perf** — próg latencji interakcji + czas ładowania golden-path; zmierzyć, dociąć.
21. **Copy pustych stanów + błędów** napisane dla 8 ekranów (pierwsze co widzi prospect).
22. **Sygnatura dopolerowana** — moment wow działa niezawodnie.
23. **Próba generalna na realnym buildzie + test projektora** (kontrast, kolory w dark na dużym ekranie, tempo).
24. **Plan B** — nagrany fallback każdego kroku (gdyby sieć/live padł).
25. **Bramka G5 (T-1):** pełny przebieg golden-path bez zająknięcia, 2× z rzędu.

## FAZA 6 — Po Vegas (T+1 →) · właściciel: Cloud
26. Reszta powierzchni (fale 2-5 RESKIN_AUDIT), light mode, decyzje D-NAV (8 sierot), pełny sweep app-wide, edytory (sync D-I).

---

## Mapa bramek (go/no-go)
| Bramka | Kiedy | Warunek | Kto decyduje |
|--------|-------|---------|--------------|
| G1 | T-11 | golden-path + tryb + sygnatura zaakceptowane | Piotr |
| G2 | T-9 | 4 wzorce wizualne podpisane | Piotr |
| G3 | T-7 | brak regresji po komponentach współdzielonych | Strateg |
| G4 | T-4 | 8 ekranów zielone na demo | Piotr+Pilot |
| G5 | T-1 | próba generalna czysta 2× | Piotr |

## Role (architektura 3 agentów)
- **Strateg (ja):** plan, koordynacja, mini-specy produktowe (#18), bramki, spięcie z falami.
- **Cloud:** cały kod (fazy 2-6), demo-first, PROD nietknięty bez zgody, branch-race rules.
- **Pilot:** prowadzi Piotra przez odbiory (G4/G5).
- **Piotr:** decyzje na bramkach, odbiory przeskinowanych ekranów.

## Zasady twarde (niezmienne)
Demo/stage only; PROD (centerbeam) tylko za jawną zgodą; `vite build` lokalnie przed deployem FE; testy w `tests/` (`-f`); branch współdzielony → fetch+log przed reset, commity per ścieżka, nigdy `-A`; każda zmiana UI → preview+screenshot (nie „tsc przeszło").

## Co odblokowuje gate Cloud
Gate Cloud (dziś ZAMKNIĘTY na re-skin) otwiera się **na Fazę 2** po bramce G1. Nie wcześniej — bo bez golden-path Cloud skinowałby ślepo 200 ekranów.

---

## Pierwsze 3 ruchy (jutro rano)
1. Podaj **datę keynote** → zamienię T-n na kalendarz.
2. Potwierdź **8 ekranów golden-path** (lub skoryguj).
3. Wskaż **sygnaturę** (co ma być momentem „wow").
→ To domyka Fazę 1 i otwiera gate Cloud na wzorce wizualne.
