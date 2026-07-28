# STD-002 — Jakość standardu: 8 fal (triada + 4 typy materiałów + generatory)

- **Stan:** DO ODBIORU (2026-07-26)
- **Gałąź/commity:** `loop/integration-0726` → scalone na demo `4afa506200` (merge --no-ff na
  `origin/demo`, potem inna sesja dopisała 11 commitów PRV-009 na wierzchu — nieskolidowane).
- **Tag bezpieczny:** `demo-safe-2026-07-26-standard` (SHA `4afa506200`).
- **Deploy:** Railway `579e1f54` SUCCESS, health-check 200, `gitSha` na żywo potwierdzony.

## Kontekst
Mandat Piotra: dokończyć standard (tabele/menu/preview) i zweryfikować podłączenie 4 typów
materiałów (dokument/prezentacja/arkusz/raport) + ich generatorów. Metoda: 4 równoległe audyty
runtime na tipie demo → 8 robotników Sonnet → integracja → render-verify własny (reguła #7) →
push. Pełny dziennik: `Harvard/wdrozenie-100/_SESJA_JAKOSC_STANDARD_2026-07-26.md`.

## Co wykonano (mechanika, zero flag wizualnych przełączonych na ON)
1. **Strażniki triady realnie mierzalne** — pierwszy pełny pomiar pełnego drzewa (było tylko
   diff-owe): 3348 naruszeń/915 plików. Regex łapie primary-50..900 (wcześniej tylko 400-700).
   Rule 2 wymaga konkretnie `StandardModuleBar` w hubach (ujawniło: 12/13 hubów ma legacy menu).
   Wszystkie 3 strażniki spięte z CI jako kroki blokujące.
2. **Materiały R1.1 — prezentacja**: „Użyj wzorca" dla decka przekazuje realną strukturę
   (`outline_json`→karty) zamiast gubić ją w prompt AI. Serwerowy resolver, stany blokujące PL.
3. **Materiały — raport**: „Użyj wzorca" dla raportu z Biblioteki naprawiony (ta sama klasa buga
   co Word przed R1 — szablon był cicho gubiony). Konsolidacja 2 innych tras tej samej luki.
4. **Merytoryka Deck**: Narrative Engine +5 intencji slajdów, konsumuje briefing szablonu
   (keyMessage/dataNeeded). Kill-switch `ENABLE_DECK_NARRATIVE_EXTENDED` (default ON).
5. **Merytoryka Excel**: dopasowanie wzorca z czatu 1/7 → 7/7 (PL+EN frazy).
6. **i18n**: 84 brakujące klucze PL/EN architektów szablonów (namespace prezentacji nie istniał
   w ogóle). Docstringi flag mówią teraz prawdę o defaultach.
7. **DRD Audit Report** — kompletny, wcześniej odpięty silnik podłączony do modułu Audyty za
   flagą `ff_drd_report` (default OFF — patrz osobny wpis AUD-001 niżej).
8. **Czystka**: −6204 linii martwego kodu (`Report*`, stary Sidebar, martwe route'y).

## Weryfikacja
- 3 strażniki: zielone (triada 3348/3348, list-canon 423/423, artefakt 7/7 — dziedziczy
  zaostrzony baseline z równoległej sesji STD-001).
- 306+ testów jednostkowych/integracyjnych zielonych (targeted vitest, bez pełnego tsc).
- Render-verify OSOBIŚCIE (reguła #7): 3 ekrany × light/dark — prezentacja (loading/orphaned/
  forbidden), raport z Biblioteki (modal z zablokowanym szablonem/deprecated), Audyty→Raporty DRD
  (lista + edytor pełnego raportu). Zero crimson, tokeny c-* poprawne.

## Znalezione przy okazji (do odbioru/decyzji, NIE naprawiane w tej fali)
- Modal „Nowy raport z wzorca" ma pola formularza po angielsku (Assessment/Cancel/Create draft)
  mimo polskiego nagłówka — pre-existing w `NewAssessmentReportModal`, wystawione na nowej ścieżce.
- `AuditsHub` nagłówki kolumn tabeli mieszają PL/EN (ASSESSMENT/STATUS vs PROGRAM/AKTUALIZACJA).
- `PresentationWizard.tsx` ma własny kliencki resolver id szablonu bez walidacji serwera —
  ta sama klasa luki co naprawiona w tej fali, inny ekran (kandydat na kolejną falę).
- EN fallback dla 3 pól briefingu Deck jest po polsku (użytkownik EN widzi polskie słowa).

## 5 decyzji czekających na Piotra (nierozstrzygnięte, zebrane, nie moje do podjęcia)
1. Konflikt: `ff_deck_architect`/`ff_excele` default ON (flip Piotra 2026-07-22) vs decyzja
   architekta D6 (2026-07-24) mówiąca OFF.
2. Czy „Raport" ma być 4. kafelkiem formatu w „Nowy materiał" (dziś 3: Dokument/Prezentacja/Arkusz).
3. Unifikacja 2 równoległych silników raportów (`report-builder` vs `assessment-reports`).
4. Przycisk „New Report" w Execution Hub jest atrapą (wizard bez zapisu) — naprawić czy usunąć.
5. Flip `ff_workbook_templates` (czeka od pętli DO 9, 2026-07-23) + nowa `ff_drd_report`.

## Do klikania w odbiorze
Wszystko za flagami OFF — nic nie widać bez query param/localStorage. Do obejrzenia na zrzutach
w tym zgłoszeniu (patrz też AUD-001, EXC-001 niżej dla szczegółów per-powierzchnia).
