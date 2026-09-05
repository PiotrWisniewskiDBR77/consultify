# Odbiór na żywo 05.09 — pakiet 05 „Ocena” (17 ekranów)

## Liczby
- ZGODNY: 1
- ROZNI_SIE: 13
- NIE_DOTARLEM: 3

## Różnice (po jednym zdaniu)
1. **assessment-menu3-status-chips** — na zakładce „Biblioteka” chipy Menu 3 są kategoriami obszaru, a nie siedmioma chipami statusu z obrazu (zestaw statusowy jest dopiero na „Procesach”).
2. **assessment-report-contract** — ekran jest, ale etykiety szyny rozdziałów są ucięte do „Pr…”, „Cy…”, „Za…”, zamiast czytelnych „Oś 1…Oś 7”.
3. **assessment-quality-review-panel** — brak trzech kafli i tabeli osi; w ich miejscu „Ocena dostępna tylko dla assessmentów DRD.” na rekordzie DRD.
4. **assessment-reports-table** — brak nagłówka strony, pola wyszukiwania i kolumny KONTEKST; podzakładki zastąpione chipami statusu.
5. **assessment-artifacts-restart** — tabela pusta („No insights yet”), bo w danych właściciela jest zero zamrożonych Outputów.
6. **assessment-five-surfaces** — biblioteka ma siedem kolumn zamiast czterech i nie ma kolumny DZIAŁANIA z przyciskiem „Uruchom”.
7. **drd-library-entry** — /assessment/drd ląduje na Bibliotece, a nie na widoku „Procesy” z listą sesji DRD; kolumny inne, lista niezawężona do DRD.
8. **assessment-list** — brak kolumn JEDNOSTKA, WYNIK i PEWNOŚĆ oraz segmentu „Wszystkie/Moje/Szablony”.
9. **assessment-reports-panel** — panel istnieje w DOM, ale renderuje się poza ekranem (top = wysokość okna), więc użytkownik go nie zobaczy.
10. **siri-workspace** — sesja SIRI otwiera stronę „V8 SHARED WORKBENCH”, a nie warsztat pytań z obrazu.
11. **assessment-initiatives-panel** — jak wyżej: panel poza widocznym obszarem.
12. **assessment-manage-panel** — „Zarządzanie” po kliknięciu „Zarządzaj” jest w DOM, ale poza ekranem; w sesji DRD przycisku nie ma wcale.
13. **drd-macierz-oceny** — zakładka „Macierz” pokazuje ubogą tabelkę L1–L7 zamiast macierzy obszary × poziomy z treścią komórek, przełącznikiem AS-IS/TO-BE i kaflami.

## Nie dotarłem
- **assessment-output-report** — zero zamrożonych Outputów (`/api/method/outputs` → total 0); trasa kończy się ekranem „Nie znaleziono zamrożonego Outputu”.
- **assessment-presentation-view** — ta sama przyczyna; dziewięciu slajdów nie da się dziś obejrzeć bez tworzenia rekordu.
- **assessment-initiatives-table** — komponent `assessment/InitiativesTable.tsx` nie istnieje już w kodzie (zostały tylko wzmianki w komentarzach).

## Najważniejsze potwierdzenie dla właściciela (macierz DRD w raporcie)
Zlecone sprawdzenie: „macierz DRD rysowana odrzuconą tabelą »Axis matrix table« z angielskimi kolumnami”.
Zmierzone:
- W ekranie „Raport” sesji DRD **NIE MA** elementu o `aria-label` zawierającym „Axis matrix table” (jest test, który tego pilnuje).
- Jest za to element `aria-label="Macierz DRD — obszary × poziomy"` — czyli WŁAŚCIWA macierz właściciela (9 obszarów × 7 poziomów, treść w komórkach).
- Ale wszystkie jej etykiety są **po angielsku**: obszary „Sales Processes / Marketing Processes / Process Technology and R&D / Purchasing / Logistics / Production / Quality / Financial Management / HR Processes”, podczas gdy drzewo tej samej sesji obok pokazuje je po polsku („Procesy Sprzedaży”…).
- Etykiety wierszy to **nazwy systemów, nie nazwy poziomów**: „7. AI Support / 6. ERP / 5. MES / 4. Automation / 3. Process Control / 2. Workstation Control / 1. Basic Data Registration” — zamiast drabiny „7. Autonomous … 1. Basic/Manual” z obrazu.
- Macierz jest ściśnięta do ~504 px szerokości; widać 2–3 kolumny z 9, pod spodem napis „Jeszcze 7 kolumn po prawej — przewiń w bok”.
- Brak przełącznika AS-IS/TO-BE, opcji „Spacious”, przycisku pełnego ekranu i czterech kafli podsumowania.
Bogata macierz z obrazu żyje w `DRDAssessmentEditor` (stary `AssessmentSessionEditorView`), który przy włączonej fladze warsztatu metody nie jest już dla DRD renderowany. Zrzut: `drd-macierz-w-raporcie.png`.

## Inne rzeczy warte uwagi
- Dwie z czterech ocen na liście („Ocena dojrzałości cyfrowej Q1” = dbr77-assess-001 i „Analiza gotowości AI” = dbr77-assess-002) po otwarciu dają „Session not found” i 404 na `/api/method/sessions/:id`. Działa tylko sesja „DRD · 63b79765”.
- Panel „Wnioski” czyta inny backend (`/api/v8/assessment/:id`) niż lista sesji (`/api/method/sessions`) — dla działającej sesji DRD daje „Assessment not found” i trzy 404.
- W zakładce „Macierz” wybrany poziom jest obwiedziony czerwienią, choć nie jest stanem krytycznym (kanon: czerwień tylko dla krytycznych).
- Interfejs raz ładuje się po polsku, raz po angielsku — zależnie od tego, czy paczka tłumaczeń zdąży się wczytać przed zrzutem. To nie jest ustawienie konta.

## Czas i trudności
Ok. 1,5 h. Najtrudniejsze: (1) dojście do panelu „Zarządzanie”, który renderuje się poza ekranem — musiałem go mierzyć przez getBoundingClientRect, bo na zrzucie nie widać nic; (2) brak jakichkolwiek zamrożonych Outputów, przez co trzy ekrany są nieosiągalne bez tworzenia rekordów; (3) niestabilny czas ładowania modułu (5 s bywa za mało, przez co pierwsze zrzuty złapały angielskie napisy zanim doładował się polski locale).
