# Raport UI/UX — Pełny walkthrough aplikacji
**Data:** 2026-06-30 / 2026-07-01 | **Autor:** Harvard Strateg na podstawie sesji z Piotrem
**Status:** CZĘŚĆ 1 z 2 — rano Piotr dokończy przegląd

---

## Kontekst

Piotr przeprowadził kompletny walkthrough aplikacji moduł po module, komentując co działa i co nie. Ten raport = synteza WSZYSTKICH obserwacji + źródło dla:
- Programu re-skin app-wide (RESKIN_AUDIT_2026-06-30.md = uzupełniać)
- Listy bugów do Cloud
- Decyzji architektonicznych (D-UI-*)
- Nowych programów artefaktów

---

## CZĘŚĆ A — Systemowe wzorce (dotyczą całej aplikacji)

### A-1 Multi-select złamany wszędzie (P0)
**Moduły:** Ideas, Tasks, Decisions, Interview Inbox, Interview Assigned, Tools, Assessment, KPI (M15)
**Objaw:** Nie można zaznaczyć więcej niż jednej pozycji w żadnej tabeli
**Klasyfikacja:** P0 system-wide bug — jeden fix radiuje wszędzie

### A-2 Menu 2 — regresja z pill do plain text
**Moduły:** Notebook, Interview, M15 Results
**Objaw:** Wcześniej były przyciski w zaokrąglonych ramkach (pill style — jak w My Work); teraz plain text z podkreśleniem
**Standard:** Pill/rounded jak w My Work = wzorzec do przywrócenia wszędzie
**Wyjątek pozytywny:** My Work taby nadal mają pill — to jest wzorzec

### A-3 Menu 3 — brak ramek na przyciskach
**Moduły:** Ideas multi-select toolbar, Assessment
**Objaw:** Przyciski w Menu 3 bez ramek/obramowania — nieczytelna hierarchia wizualna
**Fix:** Dodać ramki do wszystkich przycisków w Menu 3 (chip/button border)

### A-4 Edit Columns — systemowy dramat
**Moduły:** Tools, Assessment, M15 KPI
**Objaw:**
- Ikony eye = czerwone (crimson primary-leak)
- Etykiety kolumn = ALL CAPS (nieprofesjonalne)
- Instruction text "DRAG TO REORDER, CLICK EYE TO TOGGLE VISIBILITY" renderuje się jako body text
**Klasyfikacja:** Jeden współdzielony komponent złamany — jeden fix = wszystkie moduły

### A-5 Preview pane — brak standardu
**Moduły:** Reports&Presentations, Sessions, Initiatives, Tools, Assessment Reports
**Objaw:** Każdy moduł ma inny preview — niektóre dramatycznie puste, bez akcji, bez struktury
**Standard:** `TABLE_AND_PREVIEW_CANON.md` istnieje ale nie jest stosowany
**Decyzja:** Preview pane = osobny program standaryzacji

### A-6 Kebab menu — zbyt ubogie w większości modułów
**Moduły:** Notebook (szczególnie ubogi), Tools, Assessment
**Wzorzec pozytywny:** Ideas kebab = bogaty, kontekstowy — wzorzec do naśladowania
**Wzorzec pozytywny 2:** M15 KPI kebab = bogaty (Preview/Open/Record value/Follow KPI/Definition/Lineage/Targets/History/Delete) — zachować

### A-7 Prawy przycisk myszy — brak koncepcji systemowej
**Objaw:** Kontekst menu prawego kliku nie istnieje jako system — każdy moduł robi to inaczej lub wcale
**Potrzeba:** Zaprojektować całą koncepcję prawego przycisku myszy: co pokazuje gdzie, kiedy, z jaką zawartością — NOWY PROGRAM

### A-8 Crimson primary-leak (4 403 wystąpień)
**Objaw:** `primary` = crimson #85182F zamiast neutral/accent; pojawia się w badge domyślnym, fokus ringach, AI bąblach czatu, empty state ikonach
**Source:** tailwind.config.js primary.DEFAULT = crimson
**Klasyfikacja:** Klasa 1 długu — patrz RESKIN_AUDIT

### A-9 Dane testowe w produkcji (P1)
**Moduły:** M15 Results (Value Driver Tree, KPI, footer)
**Objaw:** "E2E KPI 1782494920708", "M05-E2E-CV-Init-y3sbhb", "Debug test", "DEMO @106303fd2374" widoczne w demo org
**Klasyfikacja:** P1 — nie kosmetyka

---

## CZĘŚĆ B — Per moduł (obserwacje Piotra)

### M01 Chat (Teresa)
- **OK:** Ogólnie przyzwoity; przyciski mogą być czarne — OK
- **B-1:** Ramka animowana nie obejmuje właściwego obszaru — powinna obejmować cały czat, nie tylko pole
- **B-2:** Logo "Consultify" mogłoby być niżej
- **B-3:** Pulsujące logo jak Claude — OK jako inspiracja
- **B-4:** Ikona "C" jako avatar — OK

### M06–M09 Ideas (My Work)
- **B-5:** Lista + column selector + context menu + topbar w light mode = OK, zgodne ze standardem
- **B-6 (nowy element):** "Przypisanie do folderów" — OK koncepcja, ale dodatkowe 2 linie menu stracone ze screen real estate. Należy to rozwiązać w Menu 3 bez osobnego rzędu
- **B-7:** Przyciski w Menu 3 multi-select bez ramek (→ A-3)
- **B-8:** Process Flow canvas = "pierdolnik elementów" — zgłaszane wcześniej, wiadomo, 16 problemów UI-L1…L16 w tablicy koordynacji; D-I Editor Shell priorytet #1

### M04 Notebook
- **B-9:** Menu 2 — regresja z pill do plain text (→ A-2)
- **B-10:** Kontekst menu wiersza ubogi vs Ideas (→ A-6)
- **B-11:** Edytor notatek = dramat — Notebook musi wejść do programu przebudowy artefaktów (jak Ideas, KPI, inne) — **NOWY PROGRAM: Artefakt Notatka**

### M10 Interview
- **B-12:** Menu 2 — regresja z pill do plain text (→ A-2)
- **B-13:** Multi-select złamany (→ A-1)
- **B-14:** Templates i Assigned — poza Menu 2 wszystko super ✅
- **B-15:** AI Insight Creator — generalnie OK, może można lepiej
- **B-16:** AI Initiative Wizard — OK, ale generatory będą przeprojektowane (centrum generowania — do przemyślenia)

### M12A Tools (biblioteka narzędzi)
- **B-17:** Lista narzędzi = OK ✅
- **B-18:** Edit Columns = dramat (→ A-4)
- **B-19:** Kebab menu = za mało (→ A-6)
- **B-20:** Generator inicjatyw w Tools NIE wyświetla inicjatyw — pokazuje bibliotekę narzędzi (błąd renderowania — **P1 bug**)
- **B-21:** Tool detail page (np. Market Forces, Ansoff) = dramatyczny — **NAJWAŻNIEJSZY artefakt do zaprojektowania**:
  - To jest serce produktu konsultingowego
  - Nigdy nie było UI/UX work na tym widoku
  - Wymaga: połączenia z resztą aplikacji, standardowych metod pracy, nowego artifact design

### M12B Assessment
- **B-22:** Brak ramek na przyciskach Menu 3 (→ A-3)
- **B-23:** Edit Columns = dramat (→ A-4)
- **B-24:** Kebab = stary (→ A-6)
- **B-25:** Macierze gotowości cyfrowej — były (DRD/SIRI/ADMA), nadal istnieją w kodzie
- **B-26:** `DRDReportTemplate.tsx` napisany ale ODCIĘTY od live app — raporty się nie otwierają
- **B-27:** `DRDAssessmentMap.tsx` nie istnieje (SIRI/ADMA mają swoje mapy, DRD nie)
- **B-28:** Assessment > Initiatives panel = generator inicjatyw działa (modal Assessment+Report/Tylko Assessment/Tylko Report) ale kolory CTA = lime green spoza palety tokenów
- **B-29:** Preview inicjatywy otwiera panel boczny zamiast full-page M13 detail

### M13 Inicjatywy (Reports & Presentations, Sessions, Initiatives, Library)
- **B-30:** Różne kolory czcionki między widokami — brak spójności
- **B-31:** Multi-select złamany (→ A-1)
- **B-32:** Preview pane niestandardowe (→ A-5)
- **B-33:** Report Builder — wygląda "nadzwyczaj dobrze" ✅ ale **złe miejsce** — powinien być w Materiały (M17), nie w Inicjatywach

### M15 Results
- **R-1:** Brak Menu 3 (Command Row)
- **R-2:** Filtry (Stage/Health/KPI link) = dobra koncepcja ✅ (pill z ramką + dropdown), zły styl (kształt/font)
- **R-3:** Filtry dark vs light — bez ramek w dark, z ramkami w light (niespójność)
- **R-4:** Badge "Wstrzymaj"/"Zatrzymaj" = crimson/różowy styl niespójny ze standardem statusów
- **R-5 (arch):** Widok Initiatives = 4 różne koncepty w jednym scrollu bez hierarchii (Wartość transformacji + Lejek wartości + Rekomendacje + Skrzynka z wdrożenia) — **wymaga przeprojektowania IA, nie tylko re-skinu**
- **R-6:** Value Driver Tree = węzły nieinteraktywne, wyglądają jak klikalne
- **R-7:** KPI kebab = bogaty i dobry ✅ (Preview/Open/Record value/Follow KPI/Definition/Lineage/Targets/History/Delete)

### Sidebar
- **S-1:** Graficznie OK ✅
- **S-2:** Tools → powinno być Tools + Assessment (osobne)
- **S-3:** Dodać: Audits
- **S-4:** Wywalić: Meetings

### Generatory (deck PPTX, Excel, raport Word)
- **G-1:** Menu 2 i Menu 3 nie trzymają standardu
- **G-2:** Za dużo elementów
- **G-3:** "Grafika z lat 90 do 2026" — artyfakty i tabele w rozsypce

---

## CZĘŚĆ C — Nowe programy (wynikające z walkthrough)

### Program 1: ARTEFAKT — Tool Detail Page (NOWY, KRYTYCZNY)
- Najważniejszy kawałek aplikacji (serce konsultingu)
- Nigdy nie miał UI/UX work
- Wymaga: nowego artifact design, połączenia z M13/M14/M15, standardowych metod pracy (jak Ideas, KPI)
- Wejście do programu re-skinu artefaktów

### Program 2: ARTEFAKT — Notatnik
- Wejście do programu przebudowy artefaktów
- Standard: jak Ideas (edytor bogaty, metody pracy, połączenia)

### Program 3: Prawy przycisk myszy — system koncepcja
- Zaprojektować całą koncepcję kontekstową prawego kliku
- Contextual help, quick actions, navigation shortcuts
- Jeden spójny system dla całej aplikacji

### Program 4: Edit Columns — redesign komponentu
- Jeden komponent, naprawa w jednym miejscu
- Fix: normalne ikony, normalne etykiety, tooltip zamiast instruction text

### Program 5: Preview pane — standaryzacja
- Audyt wszystkich preview panes vs TABLE_AND_PREVIEW_CANON
- Ujednolicenie: action bar, metadata, navigation

### Program 6: Generator inicjatyw → "Centrum generowania"
- Piotr: "musi być łatwiejsze i dobrze przemyślane"
- Jeden punkt wejścia dla wszystkich generatorów (inicjatywy, raporty, decyzje)
- Zintegrowany z Chat (Teresa)

### Program 7: Report Builder → Materiały (M17)
- Przenieść z M13 do M17 Materiały
- Dobry UX ✅ — złe miejsce

### Program 8: Assessment — podłączenie DRD
- DRDReportTemplate.tsx → podłączyć do ReportEditor
- DRDAssessmentMap.tsx → zbudować (SIRI/ADMA mają, DRD nie)
- Zadanie dla Cloud

---

## CZĘŚĆ D — Decyzje D-UI (do potwierdzenia przez Piotra)

| ID | Decyzja | Rekomendacja CTO | Status |
|----|---------|-----------------|--------|
| D-UI-1 | Dual mode (dark+light) | Tak, obowiązkowy | ✅ zamknięta |
| D-UI-2 | Multi-select fix = system-wide 1 fix | Tak | do potwierdzenia |
| D-UI-3 | Menu 2 = przywrócić pill style wszędzie | Tak | do potwierdzenia |
| D-UI-4 | Tool Detail Page = nowy artifact program | Tak, priorytet | do potwierdzenia |
| D-UI-5 | Report Builder → przenieść do M17 | Tak | do potwierdzenia |
| D-UI-6 | Sidebar: wywalić Meetings, dodać Audits | Tak | do potwierdzenia |
| D-UI-7 | Edit Columns = jeden komponent, jeden fix | Tak | do potwierdzenia |
| D-UI-8 | Prawy klik = nowy systemowy program | Tak | do potwierdzenia |
| D-UI-9 | Centrum generowania = jeden UI zamiast rozproszonych | Tak | do potwierdzenia |
| D-UI-10 | DRD Assessment → podłączyć template+mapę | Tak, Cloud task | do potwierdzenia |

---

## CZĘŚĆ E — Priorytety dla Cloud (zaraz po odbiorze)

**P0 (blokuje użytkowność):**
1. Multi-select złamany system-wide
2. Generator inicjatyw w Tools = wrong content (pokazuje library)

**P1 (istotne, nieblokujące):**
3. Menu 2 pill style — regresja (Notebook, Interview, M15)
4. Edit Columns — czerwone ikony + ALL CAPS + instruction text
5. DRDReportTemplate odcięty — raporty się nie otwierają
6. DEMO @106303fd2374 widoczny w footer UI na produkcji

**Program (kolejna fala):**
7. Tool Detail Page — nowy artifact design
8. Preview pane standaryzacja
9. Menu 3 — ramki na przyciskach
10. DRDAssessmentMap.tsx — brakujący plik

---

## Stan raportu

- [x] Część 1: Chat, Ideas, Notebook, Interview, Tools, Assessment, M15 Results, Sidebar
- [ ] Część 2: **do uzupełnienia rano przez Piotra** — pozostałe moduły (M14 ExecutionHub, M16 Finance, M23, M24 Admin, Settings, Landing, onboarding, inne)

Po uzupełnieniu Część 2 → synteza w RESKIN_AUDIT_2026-06-30.md + aktualizacja _KOORDYNACJA z zadaniami dla Cloud.
