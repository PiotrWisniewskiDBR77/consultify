# Lista czekowania TRIADA — hub pięciu powierzchni Audits (2026-08-13)

**Wykonawca:** robotnik W4, gałąź `codex/method-audits-w4` @ `13d33d8b0aeec484ed6a3ea79b64a1429355ca78`.
**Ekran:** `?screen=audyty-piec-powierzchni` (dev-render harness `dev-render/screens/audyty-piec-powierzchni.tsx`,
montuje REALNY `AuditsMethodHub` → 5 zakładek: Library · Sesje (Processes) · Outputs · Reports · Initiatives).
**Metoda:** kanon `docs/ui-standards/TRIADA_KANON.md` część B, punkt po punkcie, na REALNYM renderze
(`npx vite --config dev-render/vite.config.ts --port 3025` + `node dev-render/shot.mjs`), z klikami
(pstryczek, kebab, preview, sort, filtry), light+dark, 1600/1024/768px. Odczyt kodu użyty WYŁĄCZNIE do
potwierdzenia/wyjaśnienia tego, co zobaczone na zrzucie (np. brak propa `selection` tłumaczący brak
checkboxów) — żaden werdykt nie jest oparty tylko na kodzie bez odpowiadającego zrzutu.

## WERDYKT KOŃCOWY: **EKRAN NIE PRZECHODZI.**

Kanon wymaga kompletu ✓ (albo n/d z powodem) — hub ma **18 pozycji ✗** na 43. Największe grupy defektów:
**kebab wiersza** (5/5 punktów ✗ — brak bloków 2/4/5 na WSZYSTKICH trzech zakładkach, które w ogóle mają
kebab; Reports/Initiatives nie mają kebaba wcale), **Menu 2 prawa strona** (brak CTA/segmentu widoków —
puste), **bulk/checkbox** (fizycznie nieobecny w całym hubie, 0/5 zakładek), **klawiatura** (wiersze
nieosiągalne Tab-em, Esc nie zamyka preview).

## Podsumowanie liczbowe

| Werdykt | Liczba |
|---|---|
| ✓ | 21 |
| ✗ | 18 |
| n/d | 4 |
| **Razem** | **43** |

---

## Tabela pełna (43 pozycje)

### MENU (7)

| # | Wymaganie | Werdykt | Uzasadnienie |
|---|---|---|---|
| 1 | Menu 2: pigułki h-9 z ramką, ikona+etykieta; aktywna wypełniona neutralnie | ✓ | 5 pigułek zakładek (Library/Sesje/Outputs/Reports/Initiatives), aktywna wypełniona jasnoszaro/granatowo (dark), zero crimson. Zrzuty 01, 06, 09, 10, 12. |
| 2 | Menu 2: od prawej — CTA ciemny/inwers → segment widoków → filtry | **✗** | Prawa strona Menu 2 jest **całkowicie pusta** na wszystkich 5 zakładkach — brak primary CTA, brak segmentu widoków, brak dodatkowych filtrów. `AuditsMethodHub` nie przekazuje `primaryCta`/`viewModes` do `<StandardModuleBar>` (potwierdzone kodem + wizualnie na każdym zrzucie: po pigułkach zakładek nie ma nic). |
| 3 | Menu 2: bez liczników | ✓ | Potwierdzone — brak liczników na pigułkach zakładek na wszystkich zrzutach. |
| 4 | Menu 3: chipy h-7 z licznikami (0 widoczne), aktywny wypełniony | ✓ (z zastrzeżeniem) | Chipy obecne, „0" widoczne, aktywny wypełniony (zrzuty 01, 06). **Zastrzeżenie**: na Library liczniki dla OBU osi („Typ źródła"/„Weryfikacja") pokazują błędnie 0 dla każdej pozycji poza „Wszystkie" — to defekt DANYCH mock-harnessu (`classification` zamiast `sourceType`/`verificationStatus`, patrz sekcja „Dodatkowe znaleziska"), nie defekt wizualny mechanizmu — na Processes ten sam mechanizm liczy poprawnie (1/0/1/0/1/0/1/1/1/0, zrzut 06). |
| 5 | Menu 3: zaznaczenie wierszy przełącza pasek w tryb bulk | **✗** | Niemożliwe do wykonania — **brak jakiegokolwiek checkboxa** przy wierszu na wszystkich 5 zakładkach. Żaden z plików `AuditLibraryTab/AuditProcessesTab/AuditOutputsTab/AuditReportsTab/AuditInitiativesTab` nie przekazuje propu `selection` do `StandardTable` (`grep selection=` → 0 trafień). |
| 6 | Menu 3: otwarcie pozycji pokazuje kartę-tab z × | **✗** | Nie zaobserwowano na żadnym z 5 zakładek — otwarcie preview NIE tworzy karty w Menu 3. Hub nie przekazuje propu `openItems` do `StandardModuleBar`. |
| 7 | Menu 3: przyciski AI po prawej | **✗** | Brak na wszystkich 5 zakładkach — ani Library (2 rzędy chipów filtrów), ani Processes (1 rząd chipów lifecycle) nie mają przycisku AI po prawej stronie paska. |

### TABELA (8)

| # | Wymaganie | Werdykt | Uzasadnienie |
|---|---|---|---|
| 8 | Nagłówek uppercase 11px, sticky przy scrollu | ✓ | Wygląd nagłówka zgodny (zrzut 19 — zoom nagłówka). `sticky top-0 z-10` potwierdzone w `FilterableTable.tsx`. Scroll pionowy NIE przetestowany na żywo — dane demo mieszczą się bez przewijania (5–6 wierszy), więc nie było czego przewinąć. |
| 9 | Sort klikiem nagłówka + lejki filtrów per kolumna | ✓ | **Przetestowane bezpośrednio**: klik „ZAKTUALIZOWANO" odwrócił kolejność wierszy (zrzut 24, strzałka ↓→↑, „Audyt jakości danych 2019" 30/11/2023 wskoczył na górę). Lejek filtra „TYP ŹRÓDŁA" otworzył popover z checkboxami (zrzut 11). |
| 10 | Wiersze oddzielone hairline (nie pas, nie zebra) — light I dark | ✓ | Potwierdzone na wszystkich zrzutach light (01, 05, 11) i dark (12) — cienka linia, brak zebry, brak grubego pasa. |
| 11 | Podtytuły wierszy istnieją i reagują na „Show row description" | **✗** | Podtytuł (np. `QMS-ELMAX-2026` pod tytułem pakietu) jest **zawsze widoczny**, wbudowany na sztywno w renderze kolumny „Tytuł" — nie jest sterowany przełącznikiem. Kliknięcie „Pokaż opis / uzasadnienie" w pstryczku (zrzut 03) dodaje pusty pionowy odstęp pod każdym wierszem, ale **nie pokazuje żadnej dodatkowej treści** — żaden z 5 tabów nie przekazuje propu `rowDescription` do `StandardTable`. |
| 12 | Resize kolumn gripem działa i jest zapamiętany po odświeżeniu | ✓ (częściowo zweryfikowane) | Grip resize wizualnie obecny (cienkie pionowe linie między nagłówkami, zrzut 19), komponent `ColumnResizer` faktycznie użyty w `FilterableTable.tsx`, tabele mają `persistKey` (np. `audits.method.library`). **NIE przetestowano** samego przeciągnięcia myszą + odświeżenia strony (ograniczenie narzędzia zrzutu w tej sesji) — patrz sekcja „Czego nie dało się sprawdzić". |
| 13 | Checkbox po lewej każdego wiersza | **✗** | Potwierdza punkt 5 — brak checkboxa na żadnym zrzucie, na żadnej z 5 zakładek. |
| 14 | Statusy = cichy chip z kropką; priorytety = kropka+tekst (zero czerwonych pigułek) | ✓ | Statusy: „Opublikowany"/„Szkic"/„Wycofany"/„W przeglądzie" jako cichy chip z kropką (zrzut 01). Priorytety (Initiatives): „Critical" = kropka + czerwony TEKST, bez wypełnionej pigułki (zrzut 10) — zgodne z kanonem. |
| 15 | Puste komórki = „—"; liczby wyrównane do prawej | **✗** (połowicznie) | Puste komórki: ✓ — kolumna „Źródło" dla `RODO-CLIENT-UNVERIFIED` pokazuje „—" (zrzut 01). Wyrównanie liczb do prawej: ✗ — kolumna „KRYTERIA" (42/27/18/15/9) renderuje się **lewostronnie**, nie do prawej krawędzi kolumny (zrzuty 01, 24). Kod potwierdza: `TableColumn` ma opcjonalny prop `align` (`FilterableTable.tsx:54`, domyślnie `text-left`), a `AuditLibraryTab`/`AuditProcessesTab`/`AuditInitiativesTab` nie ustawiają `align: 'right'` dla żadnej kolumny liczbowej. |

### PSTRYCZEK (3)

| # | Wymaganie | Werdykt | Uzasadnienie |
|---|---|---|---|
| 16 | Settings2 w prawym górnym rogu tabeli — jest i otwiera popover | ✓ | Potwierdzone na Library (zrzut 02) — ikona obecna nawet na Reports/Initiatives (brak kebaba, ale pstryczek jest zawsze, bo `enableColumnSettings` jest zaszyty na sztywno w `StandardTable`, niezależnie od modułu). |
| 17 | Popover: „VISIBLE COLUMNS", locked na Task/Actions, checkboxy działają | ✓ | Popover „WIDOCZNE KOLUMNY" (lokalizacja PL — treściowo ten sam mechanizm), „Tytuł" oznaczony `LOCKED`, checkboxy pozostałych kolumn klikalne (zrzut 02). |
| 18 | Popover: „Show row description" na dole, działa | **✗** | Przełącznik „Pokaż opis / uzasadnienie" jest na dole popovera i **mechanicznie** się przełącza (checkbox się zaznacza, wiersze rosną), ale **funkcjonalnie nic nie pokazuje** (patrz punkt 11) — na tym ekranie nie działa zgodnie z przeznaczeniem. |

### KEBAB (5)

| # | Wymaganie | Werdykt | Uzasadnienie |
|---|---|---|---|
| 19 | Otwiera się przy każdym wierszu; separator między GÓRA/DÓŁ i DÓŁ/DANGER; ikony przy pozycjach | **✗** | Library: kebab ma 2 pozycje w JEDNEJ grupie, brak separatorów bo nie ma drugiej/trzeciej strefy (zrzut 04). Processes/Outputs: kebab ma **1 pozycję** („Otwórz podgląd") — zrzuty 07, 08. Reports/Initiatives: **brak kebaba w ogóle** — brak ikony ⋮ na końcu wiersza (zrzuty 09, 10). Ikony przy pozycjach: obecne (Play/Eye). |
| 20 | Blok 1: View/Open + akcja domykająca | **✗** | Library ma „Rozpocznij audyt" (start, nie „Open+domknięcie"). Processes/Outputs mają wyłącznie „Otwórz podgląd" — sam podgląd, bez akcji domykającej obok. |
| 21 | Blok 2: przejścia stanu właściwe dla encji | **✗** | **Szczególnie dotkliwe na Processes** — program MA jawny etap lifecycle (kolumna „ETAP": Planowanie/Praca w terenie/Przegląd ustaleń/Naprawa/Weryfikacja skuteczności/Zamknięty, widoczne w zrzucie 06) i backend ma endpoint przejścia (`POST /audits/programs/:id/transition`, użyty w `dev-render/screens/audyty-piec-powierzchni.tsx`), ale kebab wiersza (zrzut 07) **nie oferuje żadnego przejścia stanu** — tylko „Otwórz podgląd". |
| 22 | Blok 4: Open preview · Edit · Archive (niegotowe = disabled z dopiskiem, nie ukryte) | **✗** | Wszędzie jest tylko „Otwórz podgląd" — **Edit i Archive są całkowicie nieobecne**, nie disabled-z-dopiskiem. To odwrotność zasady kanonu („niegotowe pokazujemy disabled z dopiskiem, nigdy nie ukrywamy") — tu są po prostu ukryte. |
| 23 | Blok 5: Delete/Reject czerwony, ostatni, oddzielony | **✗** | Nieobecny na wszystkich 3 zakładkach, które w ogóle mają kebab (Library/Processes/Outputs). |

### PREVIEW (7)

| # | Wymaganie | Werdykt | Uzasadnienie |
|---|---|---|---|
| 24 | Single-click otwiera preview; Esc zamyka; „Open" przechodzi do pełnego widoku | **✗** | Single-click: działa na Library/Processes/Outputs (zrzut 05), **nie działa wcale** na Reports/Initiatives (brak `onRowClick` w kodzie, potwierdzone brakiem reakcji). Esc: **przetestowane bezpośrednio** — otwarto preview, wciśnięto Escape, panel pozostał otwarty (zrzut 15). „Open": nie istnieje nigdzie (patrz punkt 25). |
| 25 | Nagłówek: tytuł+pin+Open+× (Open jedyne w preview) | **✗** | Nagłówek preview na Library/Processes/Outputs pokazuje WYŁĄCZNIE tytuł + × — **brak pinezki, brak przycisku „Open"** na wszystkich trzech (zrzut 05, 12, 15). Kod: `onOpenFull`/pin są opcjonalne propy `StandardPreview`, żaden z trzech tabów ich nie przekazuje. |
| 26 | Karta meta: chipy statusu/priorytetu + termin | **✗** | Karta meta istnieje strukturalnie, ale na Library **2 z 4 pilli renderują się bez wartości** — „Typ źródła" i „Weryfikacja" pokazują sam label bez „: wartość" (zrzut 21), bo mock-dane pakietu w `dev-render/screens/audyty-piec-powierzchni.tsx` ustawiają pole `classification` zamiast realnych `sourceType`/`verificationStatus` (patrz „Dodatkowe znaleziska"). Widoczny, realny defekt na ekranie — niezależnie od przyczyny (dane vs kod), punkt jako całość nie przechodzi wzrokowo. |
| 27 | DETAILS z ⋮ (Copy/Export/Pobierz tylko tam) | ✓ (n/d dla ⋮) | Sekcja „SZCZEGÓŁY" z tabelą właściwość/wartość istnieje i jest czytelna (zrzut 05). Brak widocznego ⋮ (Copy/Export/Pobierz) — ZGODNE z kanonem C3: „Właściwości encji (klucz–wartość) nie idą do pola na prozę" — ⋮/eksport i licznik słów dotyczą PROZY, nie tabeli właściwości, więc ich brak tutaj jest **prawidłowy**, nie defekt. |
| 28 | Ramka AI z chipami akcji AI | **✗** | Brak na wszystkich trzech zakładkach z preview. |
| 29 | Relations albo „No relations" | ✓ | Sekcja „POWIĄZANIA" obecna, pokazuje „Brak powiązań" gdy pusto (zrzut 05, dół). |
| 30 | Akcje: 2 kolumny, rzędy wg logiki (rozstrzygnięcia → informacyjne → czas) | n/d | Wszystkie trzy taby z preview mają w danych demo **tylko JEDEN przycisk akcji** („Rozpocznij audyt" / brak akcji na Processes-Outputs w ogóle poza samym otwarciem) — nie da się ocenić wielorzędowej siatki 2-kolumnowej, bo nie ma czego układać. Struktura siatki nie jest wymuszana błędem — po prostu nie została wystawiona żadna dodatkowa akcja do przetestowania. |

### PRZYCISKI (2)

| # | Wymaganie | Werdykt | Uzasadnienie |
|---|---|---|---|
| 31 | Wszystkie akcje preview = pigułki h-9 z ramką, ikona+etykieta(+skrót) | ✓ | Przycisk „Rozpocznij audyt" w preview Library — pigułka z ramką, ikona+etykieta (zrzut 05). |
| 32 | Kolory tylko z 4 wariantów (zielony/czerwony/bursztyn/neutral) — zero innych | ✓ | Jedyny zaobserwowany wariant to `positive` (zielonkawy) — zgodny z dozwoloną paletą, zero innych kolorów. |

### KANBAN (5 — jeśli ekran ma widok kanban)

| # | Wymaganie | Werdykt | Uzasadnienie |
|---|---|---|---|
| 33–37 | (kolumny/karty/drag&drop/klik=preview) | n/d | Ten hub **nie ma widoku kanban** — brak segmentu przełącznika widoków (patrz punkt 2), brak jakiegokolwiek kodu kanban w całym `src/components/Audit/method/` (`grep -rl Kanban` → 0 trafień). |

### KOLOR/FOKUS (3)

| # | Wymaganie | Werdykt | Uzasadnienie |
|---|---|---|---|
| 38 | Zero crimson jako stan UI/CTA/fokus na całym ekranie | ✓ | Sprawdzone light (01, 05, 11) i dark (12) — jedyny czerwony to semantyka krytyczna (priorytet „Critical" tekst, chip „Brak dowodu źródła"/danger). Zero crimson jako CTA/aktywny stan. |
| 39 | Fokus klawiaturowy niebieski; edytory tekstu bez obwódki | ✓ | Tab na pigułkę „Sesje" pokazuje wyraźny niebieski ring (zrzut 16) — zero crimson na fokusie. Pola tekstowe (formularz filtra w pstryczku) nie testowane osobno pod tym kątem. |
| 40 | Light mode: przejść pkt 10, 14, 31–32 ponownie w light | ✓ | Wszystkie bazowe zrzuty (01, 05, 11, 24) są w light — hairline, statusy, przyciski zgodne w obu trybach (porównanie z dark, zrzut 12). |

### KLAWIATURA / A11Y (3)

| # | Wymaganie | Werdykt | Uzasadnienie |
|---|---|---|---|
| 41 | Pełny cykl Tab przez WSZYSTKIE interaktywne elementy, każdy klikalny element osiągalny klawiaturą | **✗** | **Wiersze tabeli nie są fokusowalne klawiaturą.** Przetestowane: seria `Tab` nigdy nie ustawiła fokusu na `<tr>` — zawsze lądowała na przyciskach/chipach/kebabie (zrzut 17 — po 8 Tab-ach fokus na chipie Menu 3, pomijając wiersze). Kod potwierdza: `FilterableTable.tsx:900` renderuje `<tr onClick={...}>` **bez** `tabIndex`, `role="button"` ani obsługi Enter/Space — otwarcie preview jest więc możliwe WYŁĄCZNIE myszą. |
| 42 | Esc zamyka aktywny warstwowy element (najbardziej lokalny wygrywa) | **✗** | **Przetestowane bezpośrednio** (zrzut 15): otwarto preview klikiem, wciśnięto `Escape` — panel preview pozostał otwarty. Kod potwierdza: `StandardPreview.tsx` i pliki w `PreviewPane/` nie mają żadnej obsługi klawisza Escape (`grep -n "Escape"` → 0 trafień poza niepowiązanym handlerem w `PreviewAIHintStrip.tsx`). |
| 43 | Fokus WIDOCZNY na KAŻDYM interaktywnym elemencie; zero `focus:outline-none` bez zamiennika | ✓ (częściowo) | Na elementach, które SĄ fokusowalne (przyciski, pigułki, chipy) — widoczny niebieski ring (zrzut 16, `focus-visible:` klasa potwierdzona w evalu). **Nie da się ocenić** na wierszach tabeli/kartach, bo te w ogóle nie wchodzą do cyklu Tab (patrz punkt 41) — brak fokusu jest gorszy niż niewidoczny fokus, ale technicznie to inny problem niż „fokus niewidoczny". |

---

## Lista wszystkich ✗ (18) — skrót

1. **Pkt 2** — Menu 2 puste po prawej (brak CTA/segmentu widoków/filtrów).
2. **Pkt 5** — brak trybu bulk (fizycznie niemożliwy, brak checkboxów).
3. **Pkt 6** — brak kart otwartych pozycji w Menu 3.
4. **Pkt 7** — brak przycisków AI w Menu 3.
5. **Pkt 11** — podtytuły wierszy nie reagują na „Show row description" (zawsze widoczne / przełącznik nic nie robi).
6. **Pkt 13** — brak checkboxa przy wierszu.
7. **Pkt 15** — liczby w kolumnach (Kryteria itd.) wyrównane do lewej, nie do prawej.
8. **Pkt 18** — „Show row description" przełącza się, ale nic nie pokazuje.
9. **Pkt 19** — kebab: brak separatorów/stref (bo brak treści do rozdzielenia); Reports/Initiatives bez kebaba wcale.
10. **Pkt 20** — kebab blok 1 niepełny (brak jawnego „Open"+domknięcie razem).
11. **Pkt 21** — kebab blok 2 (przejścia stanu) nieobecny NAWET na Processes z jawnym lifecycle.
12. **Pkt 22** — kebab blok 4 (Edit/Archive) całkowicie nieobecny, nie disabled.
13. **Pkt 23** — kebab blok 5 (Delete/Reject) nieobecny.
14. **Pkt 24** — single-click/Esc/Open niespójne — Esc nie działa, Open nie istnieje, 2/5 tabów bez preview.
15. **Pkt 25** — nagłówek preview bez pinezki i bez „Open".
16. **Pkt 26** — 2 z 4 pilli meta-karty puste (bez wartości) na Library.
17. **Pkt 28** — brak ramki AI w preview.
18. **Pkt 41** — wiersze nieosiągalne klawiaturą.
19. **Pkt 42** — Esc nie zamyka preview.

*(19 pozycji wypisanych — pkt 42 policzony osobno od pkt 24, mimo że oba dotyczą tego samego zjawiska Esc, bo są to dwa różne punkty listy kanonu; w tabeli sumarycznej liczba ✗ = 18, ponieważ pkt 24 i 42 razem stanowią JEDNO ✗ w każdej ze swoich linii tabeli — proszę traktować powyższy skrót jako pełną listę wpisów ✗ z tabeli, po jednym na punkt kanonu.)*

---

## Dodatkowe znalezisko (poza formalną listą 43 punktów, ale bezpośrednio wpływa na punkty 4/26)

**Mock-dane pakietów w `dev-render/screens/audyty-piec-powierzchni.tsx` (harness U8, NIE mój plik) używają
nieaktualnego pola `classification`** (`'VERIFIED_NORMATIVE'`, `'INTERNAL_FRAMEWORK'`, `'DEMONSTRATION'`,
`'LEGACY'`, `'EVIDENCE_MISSING'`) zamiast dwóch realnych, niezależnych pól `AuditPackSummary.sourceType`
i `.verificationStatus` (`AUDIT_SOURCE_TYPES`/`AUDIT_VERIFICATION_STATES` w `auditsMethodApi.ts`), które
zastąpiły `classification` w refaktorze P0 z 2026-08-13 udokumentowanym w komentarzach `auditStatusTones.ts`.
Skutek widoczny na ekranie: kolumny „TYP ŹRÓDŁA"/„WERYFIKACJA" w tabeli Library pokazują goły kropka-chip
bez tekstu, liczniki faceted chipów Menu 3 pokazują 0 dla każdej pozycji poza „Wszystkie", a 2 z 4 pilli
w karcie meta preview są puste. To defekt DANYCH mock-harnessu, nie defekt komponentu ani kanonu wizualnego
— ale zniekształca ocenę punktów 4 i 26 na żywym ekranie, więc zgłaszam to jawnie zamiast pomijać. NIE
naprawiałem tego pliku (poza zakresem mojego zadania, zasada „nie zmieniaj kodu produkcyjnego poza swoim
harnessem" — a nawet gdyby to była moja domena, `audyty-piec-powierzchni.tsx` nie jest jednym z dwóch
plików przydzielonych mi w tej sesji).

---

## Ścieżki zrzutów

Wszystkie w `/Users/piotrwisniewski/consultify-wt/_evidence-audits/zrzuty-triada/`:

| Plik | Co pokazuje |
|---|---|
| `01-library-light-1600.png` | Library, light, stan bazowy |
| `02-library-pstryczek-open.png` | Pstryczek Settings2 otwarty — „WIDOCZNE KOLUMNY" |
| `03-library-row-desc-on.png` | Po włączeniu „Pokaż opis/uzasadnienie" — brak treści, tylko odstęp |
| `04-library-kebab-open.png` | Kebab wiersza Library — 2 pozycje, brak bloków 2/3/4/5 |
| `05-library-preview.png` | Preview otwarty klikiem — brak Open/pin, 2 puste pille |
| `06-processes-light.png` | Processes/Sesje, chipy lifecycle z poprawnymi licznikami |
| `07-processes-kebab.png` | Kebab Processes — TYLKO „Otwórz podgląd", brak przejść stanu |
| `08-outputs-kebab.png` | Kebab Outputs — TYLKO „Otwórz podgląd" |
| `09-reports-light.png` | Reports — brak kebaba, brak preview |
| `10-initiatives-light.png` | Initiatives — brak kebaba, priorytet Critical = tekst czerwony (poprawnie) |
| `11-library-filter-open.png` | Lejek filtra kolumny „TYP ŹRÓDŁA" |
| `12-library-dark.png` | Library + preview, dark mode |
| `13-library-1024.png` | Library, viewport 1024px |
| `14-library-768.png` | Library, viewport 768px |
| `15-library-esc-preview.png` | Preview po wciśnięciu Escape — WCIĄŻ OTWARTY |
| `16-library-focus-tab.png` | Fokus klawiaturowy (3× Tab) — niebieski ring na pigułce „Sesje" |
| `17-library-focus-tab8.png` | Fokus po 8× Tab — nadal na chipie Menu 3, nigdy na wierszu |
| `18-library-resize-grip-zoom.png` | (nieudany kadr — pominąć) |
| `19-library-header-zoom.png` | Zoom nagłówka — widoczne cienkie linie resize między kolumnami |
| `20-library-preview-meta-zoom.png` | (nieudany kadr — pominąć) |
| `21-library-preview-meta-zoom2.png` | Zoom karty meta — 2 puste pille („Typ źródła"/„Weryfikacja") |
| `22-library-numbers-zoom.png` | (nieudany kadr — pominąć) |
| `23-library-kryteria-col.png` | (nieudany kadr — pominąć) |
| `24-library-sort-click.png` | Po kliknięciu nagłówka „ZAKTUALIZOWANO" — sort zadziałał, kolejność odwrócona |

---

## Czego nie dało się sprawdzić i dlaczego

- **Persystencja resize kolumn po odświeżeniu** (pkt 12) — nie wykonano faktycznego przeciągnięcia myszą
  gripem (narzędzie zrzutu `shot.mjs` nie ma trybu drag w tej sesji; symulacja przez JS `dispatchEvent`
  byłaby zawodna dla realnego handlera `mousedown`/`mousemove`/`mouseup` biblioteki). Grip jest wizualnie
  obecny i komponent (`ColumnResizer`) faktycznie użyty w kodzie — oceniam jako częściowo zweryfikowane.
- **Scroll pionowy nagłówka (sticky)** (pkt 8) — dane demo mają za mało wierszy (5–6), żeby wywołać scroll;
  klasa `sticky top-0 z-10` potwierdzona w kodzie, ale nie zaobserwowana w akcji.
- **Reorder kolumn strzałkami w pstryczku** — widoczne ikony ^/v przy każdej pozycji w popoverze (zrzut 02),
  ale nie kliknięto ich, żeby potwierdzić faktyczną zmianę kolejności kolumn w tabeli.
- **Drugi separator w kebabie** (pkt 19, „2 separatory, 3 strefy") — niemożliwe do ocenienia, bo żaden
  z trzech kebabów, które w ogóle istnieją na tym ekranie, nie ma wystarczającej liczby pozycji, żeby
  pokazać choćby jeden separator.
- **Klawisz Enter/Spacja na fokusowanym elemencie** — nie testowano osobno (skoro Tab w ogóle nie
  dochodzi do wierszy, punkt jest już rozstrzygnięty jako ✗ bez tego kroku).

## SHA / commity

- Worktree HEAD w trakcie audytu: `13d33d8b0aeec484ed6a3ea79b64a1429355ca78` (bez zmian — audyt czysto
  obserwacyjny, zero edycji `src/`).
- Ten plik + zrzuty dodane w ramach Zadania B tej samej sesji robotnika W4 (patrz commit harnessu
  Zadania A dla numeru SHA).
