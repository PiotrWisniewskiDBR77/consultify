# Rozliczenie P0/P1 vs decyzje właściciela i korpus uwag — Wave 3 (2026-09-03)

Dyżur robotnika w worktree `/private/tmp/ag-p0p1-dec` (gałąź `agent/p0p1-decyzje-20260903`,
baza `/private/tmp/m03` HEAD `67d235cfa0`). Zero zmian w `src/`/`server/src/` — dyżur
dokumentacyjny. Zero edycji `OWNER_DECISION_LEDGER_2026-08-24.md`, `TRIAZ_UWAG_20260902.md`
ani żadnego `MODULE_ACCEPTANCE.md` — wyłącznie odczyt i skrzyżowanie źródeł.

## Wejście i metoda

Wejście: `ROZLICZENIE_P0P1_20260903.md` — 79 z 121 pozycji P0/P1 oznaczonych OTWARTE
(46 P0 + 33 P1; rozbite na "źródło A+B" — 14 P0 + 29 P1 z `MASTER_STATUS_REGISTER.md` +
16×`MODULE_ACCEPTANCE.md` — i "trzecie źródło" — 32 P0 + 4 P1 z
`owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md` [OF] i
`modules/03_TOOLS/TOOLS_OWNER_REVIEW_REGISTER.md` [TLS]).

Dla każdej z 79 pozycji: (1) grep ID dosłownie w `OWNER_DECISION_LEDGER_2026-08-24.md`
(398 wierszy, DEC-2026-08-24-01 … DEC-2026-09-03-346 — ledger żyje do dziś, mimo nazwy
pliku); (2) grep tematu/modułu/cytatu właściciela w tym samym ledgerze, gdy ID nie
występuje wprost; (3) sprawdzenie `TRIAZ_UWAG_20260902.md` (77 uwag `UW-XX-YY`, triaż
stanu w kodzie 02.09) i `docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md`
(kolejka decyzji CTO→właściciel z wieczora 03.09) pod kątem tego samego tematu;
(4) dla My Work dodatkowo `modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md` własna etykieta
`FALA_4_OWNER_DECISION` — to jest pozycja rejestru modułu wprost przyznająca się do
braku decyzji, nie moje domniemanie. Brak dopasowania w krokach 1–4 = **NADAL OTWARTE
BEZ DECYZJI**, nigdy "prawdopodobnie załatwione".

Każde cytowane `DEC-…` podane jest z numerem linii w
`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` (jeden
wiersz = jedna decyzja, plik jest tabelą markdown). Pięć cytowanych commitów zweryfikowano
(`git cat-file -e` + `git merge-base --is-ancestor … HEAD`): `aed131a2ab`, `3a8c11eb4d`,
`ac21d2fb66`, `4497d3de60`, `1c115a03d4` — wszystkie istnieją i są przodkami HEAD.

Werdykty (z instrukcji):
- **NAPRAWIONE** — decyzja + kod scalony, komit zweryfikowany.
- **ZAMKNIĘTE DECYZJĄ** — DEC rozstrzyga KIERUNEK/zakres; to, co było "niezdecydowaną
  architekturą" (P0 bo nikt nie wiedział co budować), przestaje nią być — kod może
  jeszcze nie być gotowy, ale nie czeka już na Piotra, tylko na robotnika.
- **ODŁOŻONE DECYZJĄ** — właściciel świadomie powiedział "nie teraz"/"nie w MVP".
- **DO ROZMOWY** — sam rejestr źródłowy (`MODULE_ACCEPTANCE.md` etykieta
  `FALA_4_OWNER_DECISION`/`OWNER_REVIEW_REQUIRED`, albo kolejka
  `DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md`) przyznaje, że to pytanie czeka na
  odpowiedź właściciela, a nie że ktoś zapomniał je zadać.
- **NADAL OTWARTE BEZ DECYZJI** — zero śladu w obu źródłach. Jedyne prawdziwe blokery.

---

## R1a — Źródło A+B, P0 otwarte (14 pozycji)

| ID | Opis | Werdykt | Dowód (plik:linia) |
|---|---|---|---|
| `CHAT-OWN-017` | Kompletna kwalifikacja funkcjonalna Canvas (brama akceptacyjna) | NADAL OTWARTE BEZ DECYZJI | Meta-brama zależna od 6 pozycji P1 Chat poniżej (002/003/004/013/015/016); żaden pojedynczy DEC jej nie zamyka. `DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md` nie ma sekcji Chat poza B5/B6 (kebab, preferencje) — nie pokrywa reszty gate'u. |
| `INI-OWN-002` | Canonical card availability | **NAPRAWIONE** | `OWNER_DECISION_LEDGER_2026-08-24.md:398` (`DEC-2026-09-03-346`, dziś): właściciel przywrócił `InitiativeDocumentView` jako jedyny rekord inicjatywy dla KAŻDEJ inicjatywy, `CanonicalInitiativeCardWorkspace` usunięty. Commit `aed131a2ab` — zweryfikowany, ancestor HEAD. |
| `INT-CREATOR-OWN-001` | Creator Shell — cross-creator UX, DUŻE | ZAMKNIĘTE DECYZJĄ (kierunek); **wdrożenie NADAL OTWARTE** | `…:119` (`DEC-2026-08-25-67`) prototyp 3 kroków zaakceptowany z 10 rekomendacjami; `…:136` (`DEC-2026-08-26-84`) powłoka S.0–S.7 scalona jako kod martwy za flagą OFF; `…:256-266` (`DEC-2026-08-28-205/206/215`) proces zrzutów do akceptu w toku, 3 defekty zgłoszone do naprawy przed włączeniem flagi. Kroki 2–5 (Insight/Initiative) nadal niedokończone. |
| `MYW-IDEAS-CORE-001` | Wspólny lewy panel Ideas + zakres AI Advice | CZĘŚCIOWO **DO ROZMOWY** | `modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md:112` — raw-ID i `AI Expand` to zwykła robota (Fala 1), ale "co ma robić `AI Advice`" to wprost `FALA_4_OWNER_DECISION` (item 9), nieobecne w ledgerze. |
| `MYW-IDEAS-CORE-002` | Trzy osobne inspektory Ideas do zunifikowania | **ODŁOŻONE DECYZJĄ** | `OWNER_DECISION_LEDGER_2026-08-24.md:79` (`DEC-2026-08-25-27`) akceptował prototyp F3-01 25.08 (budowa za flagą OFF) — ALE nowsza decyzja właściciela z 01.09 (cytowana w `TRIAZ_UWAG_20260902.md` jako `UW-07-17`: "trzeba wrzucić to do backlogu, żeby przeanalizować") i potwierdzona `docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md:32` (pozycja `B3` — "MW-4 — prawy panel Idei/Notatnika … ODŁOŻONE, Twoja własna kwalifikacja z 01.09") **zastępuje** wcześniejszy akcept. Aktualny stan = odłożone, nie zamknięte. |
| `MYW-MGR-REC-001` | Manager — dashboard z mock danych | NADAL OTWARTE BEZ DECYZJI | Brak wzmianki "Manager"/"Executive dashboard"/"bottleneck" w ledgerze poza `DEC-2026-08-24-03` (banner V8 wokół Manager Cockpit — inny temat, dostępność banera, nie przebudowa danych). |
| `MYW-NBK-CORE-001` | Notatnik: dwa widoki Work/Context zamiast Tools/Work/Context | **DO ROZMOWY** | `modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md:132` — status wprost `OWNER_REVIEW_REQUIRED`; kod gotowy za flagą `ENABLE_NOTEBOOK_SPEC_A_SHELL` (default `false`), 8/8 zrzutów + 31/31 plików/82/82 testów PASS, ale "brak zgody na zmianę defaultu". Brak w ledgerze. |
| `MYW-NBK-CORE-002` | Notebook — governed-api dla akcji blocked/partial | ZAMKNIĘTE DECYZJĄ (kierunek); **wdrożenie NADAL OTWARTE** | `OWNER_DECISION_LEDGER_2026-08-24.md:80` (`DEC-2026-08-25-28`) prototyp F3-02 (szyna Praca/Kontekst, bloki) zaakceptowany 25.08; implementacja za flagą OFF, kontrolki odblokowywane "REALNYMI kontraktami kwitancji" — 3 blocked/4 partial z audytu wciąż nierozliczone. |
| `MYW-PHOTO-001` | Bramka danych demo (fixture) dla całego My Work | NADAL OTWARTE BEZ DECYZJI | Brak wzmianki w ledgerze; własny status modułu to `FALA_2` (praca wewnętrzna zaplanowana, nie decyzja właściciela). |
| `MYW-PHOTO-002` | Inbox — rozróżnienie denied-vs-empty | NADAL OTWARTE BEZ DECYZJI | Jw. — `FALA_2`/`FALA_3`, brak wpisu w ledgerze. |
| `MYW-PHOTO-007` | Bramka danych — Tasks/Decisions | NADAL OTWARTE BEZ DECYZJI | Status dokumentu `WYMAGA_DECYZJI`/data gate, ale sama decyzja nie ma numeru `FALA_4` ani wpisu w ledgerze — zawieszona bez adresata. |
| `MYW-PHOTO-010` | Bramka danych — CAS/wersjonowanie | NADAL OTWARTE BEZ DECYZJI | `FALA_2`, brak w ledgerze. |
| `RES-OWN-002` | Domain navigation / architektura Wyników | **ZAMKNIĘTE DECYZJĄ** | `OWNER_DECISION_LEDGER_2026-08-24.md:26` (`DEC-2026-08-24-04`) — `ResultsVNext/*` jedyną generacją, stary `ResultsHub` = HISTORICAL bez prawa powrotu; literalny zapis "**RES-OWN-002/007 realizowane później na tym fundamencie**" — autoryzowane, nie zablokowane brakiem decyzji. Nawigacja domenowa (KPI/ROI/OKR) sama w sobie jeszcze niezbudowana. |
| `XMOD-CARD-REC-001` | Wspólny standard kart N-Type (cross-module) | NADAL OTWARTE BEZ DECYZJI | `…:393-394` (`DEC-2026-08-29-341/342`) to USTALENIA STANU nadzorcy ("92% kart w jednym artefakcie", "wszystkie 7 kontraktów za flagami OFF") — potwierdzają problem, ale nie są decyzją zamykającą pytanie "jaki ma być wspólny standard". `FALA_3` bez właściciela. |

## R1b — Źródło A+B, P1 otwarte (29 pozycji)

| ID | Opis | Werdykt | Dowód (plik:linia) |
|---|---|---|---|
| `INT-MENU-OWN-001` | Macierz akcji dla Inbox/Sessions/Templates/Insights/Initiatives Interview | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania — DEC-01 dotyczy tylko tożsamości adresu, nie macierzy akcji pozostałych typów obiektów. |
| `INT-PREV-OWN-001` | Cross-tab Preview canon | **NAPRAWIONE** | `…:109` (`DEC-2026-08-25-57`) — panele preview przebudowane do kanonu, zaakceptowane na 6 zrzutach, "Wyjątek z DEC-53 zamknięty — Interview etap 1 w komplecie akceptów". Commit `3a8c11eb4d` — zweryfikowany, ancestor HEAD. |
| `INI-OWN-003` | Card architecture / visual consistency | ZAMKNIĘTE DECYZJĄ (częściowo) | `…:398` (`DEC-346`) ustala jedną kanoniczną kartę (`InitiativeDocumentView`); `…:396` (`DEC-2026-08-29-344`) katalogu dokładnie, co w tej karcie jeszcze nie działa (7/27 sekcji martwych, 2/27 puste, w tym realna utrata załączników) — architektura rozstrzygnięta, wykonanie zmierzone i jawnie niedokończone. |
| `INI-OWN-006` | Kreator premise→AI draft→human review | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania w ledgerze (DEC-51/59/60 dotyczą Plan Arrange/Analyze AI, nie kreatora tworzenia inicjatywy). |
| `INI-OWN-009` | Wspólny standard UI (preview/menu) Initiatives | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `MYW-IDEAS-008` | Identity row / usunięcie Save | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania (DEC-50 "polish dnia 3" i DEC-76 "partia H" nie wymieniają tej pozycji imiennie). |
| `MYW-IDEAS-009` | `Api.getMyIdeaConversions` — jeden konsument | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `MYW-IDEAS-011` | AI nudge strip — 2 z 4 powierzchni | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `MYW-IDEAS-012` | Rejestr konwersji — brak Note/Notebook | **DO ROZMOWY** | `modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md:123` — wprost `FALA_4_OWNER_DECISION` (item 8): "czy konwersja Idea→Note/Notebook wchodzi w zakres?". Brak w ledgerze. |
| `MYW-IDEAS-013` | Kontrakt enumeracji kontrolek (4 narzędzia) | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `MYW-IDEAS-014` | Pełny łańcuch konwersji UI/API/DB | **DO ROZMOWY** | `…:125` — zależne wprost od `MYW-IDEAS-012`/`FALA_4_OWNER_DECISION` item 8. |
| `MYW-NBK-003` | Model prowieniencji/historii/konfliktów Notatnika | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `MYW-NBK-004` | Faceted search cross-notebook | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania (szybkie wyszukiwanie tytuł/treść już wdrożone Fala 1 — to nie jest nowa informacja z tego dyżuru). |
| `MYW-INB-REC-001` | AI Trash / triage Inbox | **DO ROZMOWY** | `…:149` — wprost `FALA_4_OWNER_DECISION` (item 7): "czy `InboxTriage.tsx` (585 linii, 0 importerów) to fundament do podłączenia, czy martwy kod do skasowania?". Brak w ledgerze. |
| `MYW-IDEA-REC-002` | Foldery Ideas — scope/rename/archive | NADAL OTWARTE BEZ DECYZJI | `DEC-2026-08-25-29` dotyczy folderów **Sejfu klienta** (Vault), nie folderów Ideas — inny byt, mylące podobieństwo tematu; brak realnego dopasowania. |
| `MYW-CAL-REC-001` | Kalendarz — model danych spotkań (nowy typ artefaktu) | ZAMKNIĘTE DECYZJĄ (kierunek+backend); **UI NADAL OTWARTE** | `…:76` (`DEC-24`, BUILD_REAL_NOW) + `…:82` (`DEC-30`, prototyp+4 rozstrzygnięcia) + `…:273` (`DEC-2026-08-28-222`, merge `1c115a03d4` — zweryfikowany ancestor HEAD) naprawił backend (`req.db`, `editAuthority`/`ownerId`) — ale ten sam wpis kończy się: "**UI (modal edycji, akcja odwołania, flaga, zrzuty) NIE ZROBIONE**". |
| `MYW-CAL-REC-002` | Kalendarz — schemat serwera nie przyjmuje pól spotkania | ZAMKNIĘTE DECYZJĄ (kierunek); **wdrożenie NADAL OTWARTE** | Jak wyżej — DEC-24/30/222 ustalają kierunek budowy realnego kalendarza, ale rozszerzenie schematu `my-work.routes.ts` o pola spotkania nie jest częścią żadnego scalonego DEC. |
| `MYW-CAL-REC-003` | Kalendarz — brak UI dołączania artefaktu | ZAMKNIĘTE DECYZJĄ (kierunek); **wdrożenie NADAL OTWARTE** | Jak wyżej — `DEC-222`: "B.6 NIE_ZACZĘTE (świadomie porzucone jako ostatnie w kolejce)". |
| `MYW-PHOTO-003` | MyWorkNav — scroll affordance | NADAL OTWARTE BEZ DECYZJI | Brak w ledgerze; wg samego dokumentu to "Fala 1 candidate" (mechaniczna robota, nie pytanie do właściciela) — DROBNE, ale nie ma wpisu decyzji. |
| `MYW-PHOTO-004` | "MY WORK" element bez czytelnej roli | **DO ROZMOWY** | `modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md:192` — wprost `FALA_4_OWNER_DECISION` (item 4), "brak zdefiniowanej roli/kontraktu, potrzebne potwierdzenie wizualne". |
| `MYW-PHOTO-005` | Brak jednego scroll-containera nav+treść | NADAL OTWARTE BEZ DECYZJI | Jak `MYW-PHOTO-003` — sam dokument: "Fala 1 candidate", brak wpisu w ledgerze. |
| `MYW-PHOTO-011` | Brak macierzy PL/EN/light/tablet/keyboard | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `RES-OWN-005` | Shared preview — pozytywna obserwacja | NADAL OTWARTE BEZ DECYZJI | Sam status dokumentu to `OWNER_POSITIVE_OBSERVATION` (nie defekt) — ale formalnie moduł nadal `MODULE_PENDING` i brak wpisu zamykającego w ledgerze. |
| `CHAT-OWN-002` | Jedna wysokość nagłówka + prawdziwy model zapisu | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania w ledgerze. |
| `CHAT-OWN-003` | Dowieść gałęzie konwersacji albo usunąć UI | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `CHAT-OWN-004` | Rola produktowa "Important signals" | **NAPRAWIONE** | `…:88` (`DEC-36`, BUILD_PRODUCER_NOW) → `…:141` (`DEC-89`, zakres D1/D2/D3) → `…:159/161` (`DEC-107/110`, rdzeń deterministyczny zbudowany i scalony) → `…:194` (`DEC-143`, front feedu scalony) → `…:196` (`DEC-145`, **akcept właściciela na zrzutach, flaga `ff_chatSignalsFeed` domyślnie ON**). Commit `ac21d2fb66` — zweryfikowany, ancestor HEAD. |
| `CHAT-OWN-013` | Przebudować IA historii (prywatna/organizacyjna) | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `CHAT-OWN-015` | Zweryfikować tryby głosowe Teresy cross-app | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `CHAT-OWN-016` | Bezpieczne zamknięcie błędów żywego providera | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |

## R1c — Trzecie źródło, P0 otwarte (32 pozycje: 24 ASM[OF] + 8 TLS)

| ID | Opis | Werdykt | Dowód (plik:linia) |
|---|---|---|---|
| `ASM-OWN-001[OF]` | Library = czysta biblioteka metodologii | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania w ledgerze mimo szerokiego grepu ("Library", "katalog metodolog"). |
| `ASM-OWN-002[OF]` | Wzbogacić katalog, każda ocena jako Process | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `ASM-OWN-003[OF]` | Odrzucić zamrożoną powierzchnię canonical-session | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania — najbliższe tematycznie `DEC-2026-08-27-147` "WYMÓG WŁAŚCICIELA: Assessment musi mieć MACIERZ i RAPORT OPISOWY równolegle" dotyczy innego wątku (macierz+raport, nie porzucenia frozen-session). |
| `ASM-OWN-006[OF]` | Standaryzować Insights/Reports/Initiatives | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `ASM-OWN-007[OF]` | Przywrócić backend-connected tool jako primary | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `ASM-OWN-008[OF]` | Odrzucić DRD workspace jako niezrozumiały | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `ASM-OWN-009[OF]` | Cztery tryby zadaniowe workspace | NADAL OTWARTE BEZ DECYZJI | Brak w ledgerze; zweryfikowane grepem negatywnie już w dokumencie źródłowym (0 śladu w kodzie). |
| `ASM-OWN-010[OF]` | Tylko główne menu aplikacji w sesji | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `ASM-OWN-011[OF]` | Kompaktowy pasek nawigacji lokalnej | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `ASM-OWN-012[OF]` | Metadane dokumentu w pierwszej karcie Settings | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `ASM-OWN-014[OF]` | Trzecia linia narzędziowa kontekstowa | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `ASM-OWN-015[OF]` | Stabilna architektura akcji L3 | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `ASM-OWN-016[OF]` | Interview jako dwuetapowy nawigator | NADAL OTWARTE BEZ DECYZJI | Brak w ledgerze; zweryfikowane grepem negatywnie już w dokumencie źródłowym. |
| `ASM-OWN-017[OF]` | Kanoniczne karty poziomów QBank + kolor | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `ASM-OWN-018[OF]` | Progresywna karta poziomu z dowodami | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `ASM-OWN-019[OF]` | Hierarchiczny postęp + deep-link Matrix | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `ASM-OWN-021[OF]` | Zwinąć narzędzie do Interview/Matrix/Report | **ZAMKNIĘTE DECYZJĄ** | `…:24` (`DEC-2026-08-24-02`) — dosłownie: "Zakładki dokładnie Interview | Matrix | Report; Split usunięty; Workspace nie wraca… **Zgodne z ASM-OWN-021/022**." |
| `ASM-OWN-022[OF]` | Ponownie użyć interakcji demo DRD jako donora | **ZAMKNIĘTE DECYZJĄ** | `…:24` (`DEC-2026-08-24-02`) — "Mechanika pracy … przenoszona ze starego `DRDAssessmentEditor`/`DRDMatrixSession` jako dawcy. **Zgodne z ASM-OWN-021/022**." |
| `ASM-OWN-023[OF]` | Uprawnienia zespołu i etapowe zatwierdzenia | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `ASM-OWN-024[OF]` | Raport jako ekspercka interpretacja firmowa | ZAMKNIĘTE DECYZJĄ / **NAPRAWIONE** (jakościowo) | `…:202` (`DEC-2026-08-28-151`) — "★ ZŁOTY PLIK RAPORTU DRD — AKCEPT WŁAŚCICIELA": Piotr osobiście ocenił wygenerowany raport ("mam ten raport i w pdf. sa zajebiste") jako pierwszy w historii programu naprawdę dobry dokument; wzorzec zatwierdzony jako złoty standard. |
| `ASM-OWN-025[OF]` | Siedem rozdziałów osi wg stałego szablonu | ZAMKNIĘTE DECYZJĄ (struktura); **wdrożenie DO ROZMOWY dziś wieczór** | `…:98` (`DEC-2026-08-25-46`) — "7 osi wszędzie (raport/eksport/opis produktu); stary spec 8 wymiarów i preview '5 osi' do poprawy" — kierunek rozstrzygnięty. Ale `TRIAZ_UWAG_20260902.md:67` (`UW-04-02`) 02.09 nadal widzi to jako DUŻE przeprojektowanie struktury; `DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md:30` (pozycja `B1`) to dziś wieczór osobne pytanie do Piotra o harmonogram budowy ("MVP TERAZ, osobnym torem — prototyp 1 dzień, budowa 2–3 dni"). |
| `ASM-OWN-026[OF]` | Eksport jednej osi lub całego PDF 7-osiowego | **ZAMKNIĘTE DECYZJĄ**; wdrożenie NADAL OTWARTE | `…:205` (`DEC-2026-08-28-154`, punkt c) — właściciel dosłownie: "**zbudować nie ukrywać**" (KOREKTA rekomendacji nadzorcy, który proponował ukrycie) — decyzja jednoznaczna, ale w kodzie z 03.09 nadal 0 śladu implementacji (zweryfikowane grepem w dokumencie źródłowym). |
| `ASM-OWN-027[OF]` | IA Settings, uprawnienia i kredyty raportu | **DO ROZMOWY** | Status dokumentu źródłowego `COMMERCIAL_CONTRACT_NEEDED` — to pytanie o model biznesowy (kredyty/limity), nie o kod; brak wpisu w ledgerze. |
| `ASM-OWN-028[OF]` | Komentarze ludzkie i AI-doradca Matrix/Report | **DO ROZMOWY** | Status dokumentu źródłowego `AI_CONTRACT_NEEDED` — pytanie o kontrakt AI (koszt/provider), nie o kod; brak wpisu w ledgerze. |
| `TLS-OUTPUT-OWN-001` | Zmiana nazwy Outputs→Insights, lineage sesja→insight | **ODŁOŻONE DECYZJĄ** (nazwa już ustalona) | `…:84` (`DEC-2026-08-25-32`) — "właściciel zdecydował: jednak Insights" (odwraca wcześniejszy zapis kontraktu) — kierunek jednoznaczny, ALE ten sam wiersz: "Realizacja: pozycja projektowa planu Tools (**nie w Fali 1**)" — świadomie odłożona budowa, wzmocnione ogólnym zakazem `DEC-238` (patrz niżej) na rozbudowę Tools poza SWOT. |
| `TLS-REPORT-OWN-001` | Rejestr Reports (Word/PPT/XLSX) + generator | **ODŁOŻONE DECYZJĄ** | `…:289` (`DEC-2026-08-28-238`) — "★★ WIĄŻĄCE: ZAKAZ … budowania pozycji IMPLEMENTATION_NOT_AUTHORIZED (4 klasy wyniku TLS-CHAIN, etap Rekomendacji TLS-REC, **rejestr raportów TLS-REPORT**, menu TLS-MENU)" — Piotr dosłownie: "nie wkładamy Tools poza SWOT do MVP". |
| `TLS-INIT-OWN-001` | Wspólny Initiative Creator z kwalifikacją źródeł Tools | NADAL OTWARTE BEZ DECYZJI | Nie wymieniony imiennie w `DEC-238` (który nazywa tylko CHAIN/REC/REPORT/MENU) ani gdzie indziej — brak jednoznacznego dopasowania, choć ogólny duch "Tools MVP = wyłącznie SWOT" sugeruje to samo rozstrzygnięcie; nie zgaduję. |
| `TLS-MENU-OWN-001` | Governed Action Registry dla menu Tools | **ODŁOŻONE DECYZJĄ** | `…:289` (`DEC-238`) — wymieniony imiennie jako "menu TLS-MENU" w zakazie budowy. |
| `TLS-SWOT-OWN-001` | Pełny model sesji Dynamic SWOT (7-etapowy kręgosłup) | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania — paradoksalnie SWOT jest JEDYNYM zatwierdzonym narzędziem MVP (`DEC-238`), ale rozbudowa jego PEŁNEGO 7-etapowego modelu sesji nie ma własnej decyzji, tylko "FINAL_RECOMMENDATION_WRITTEN" bez odpowiedzi właściciela. |
| `TLS-REC-OWN-001` | Etap Recommendations po Synthesis & Insights | **ODŁOŻONE DECYZJĄ** | `…:289` (`DEC-238`) — wymieniony imiennie jako "etap Rekomendacji TLS-REC". |
| `TLS-READY-OWN-001` | "Results & Readiness" zamiast Outputs&Actions | **ZAMKNIĘTE DECYZJĄ** | `…:86` (`DEC-2026-08-25-34`) — "Results & Readiness" / PL "Wyniki i gotowość" (**odblokowuje R19/TLS-READY-OWN-001**)" — nazwa ustalona wprost. |
| `TLS-CHAIN-OWN-001` | 4 klasy Outputs/Insights/Reports/Initiatives rozdzielone | **ODŁOŻONE DECYZJĄ** | `…:289` (`DEC-238`) — wymieniony imiennie jako "4 klasy wyniku TLS-CHAIN". |

## R1d — Trzecie źródło, P1 otwarte (4 pozycje)

| ID | Opis | Werdykt | Dowód (plik:linia) |
|---|---|---|---|
| `ASM-OWN-005[OF]` | Process Preview → kanoniczna karta pełnowysokościowa | NADAL OTWARTE BEZ DECYZJI | Status dokumentu `TECHNICAL_BROWSER_PASS/OWNER_RETEST_REQUIRED` (technicznie gotowe, czeka na formalny retest właściciela) — ale brak wpisu w ledgerze, więc formalnie nierozliczone. |
| `ASM-OWN-013[OF]` | Usunąć niejasną globalną legendę stanu | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `ASM-OWN-020[OF]` | Nie duplikować nawigacji osi w Interview L3 | NADAL OTWARTE BEZ DECYZJI | Brak dopasowania. |
| `TLS-PREV-CONTENT-OWN-001` | Cross-app Preview Content Contract | **ZAMKNIĘTE DECYZJĄ** | `…:87` (`DEC-2026-08-25-35`) — "Lokalny fork deskryptorów Tools zostaje PODNIESIONY do wspólnego kontraktu cross-app (pola wg XMOD-OWN-008); jedno źródło deskryptorów dla wszystkich modułów." |

---

## R2 — Podsumowanie liczbowe

### Wszystkie 79 pozycji, wg werdyktu

| Werdykt | P0 | P1 | Razem |
|---|---:|---:|---:|
| NAPRAWIONE (decyzja + kod scalony, commit zweryfikowany) | 1 | 2 | **3** |
| ZAMKNIĘTE DECYZJĄ (kierunek rozstrzygnięty, wdrożenie bywa niedokończone) | 9 | 5 | **14** |
| ODŁOŻONE DECYZJĄ (świadome "nie teraz") | 6 | 0 | **6** |
| DO ROZMOWY (rejestr źródłowy sam przyznaje: czeka na Piotra) | 4 | 4 | **8** |
| NADAL OTWARTE BEZ DECYZJI (zero śladu — jedyne prawdziwe blokery) | 26 | 22 | **48** |
| **Razem** | **46** | **33** | **79** |

Nie zdecydowana architektura, którą DEC-y realnie rozstrzygnęły lub świadomie odłożyły
(NAPRAWIONE+ZAMKNIĘTE+ODŁOŻONE) = **23 z 79** (29%). Reszta — **56 z 79** (71%,
DO ROZMOWY + NADAL OTWARTE) — nie ma żadnego śladu decyzji w ledgerze z 398 wpisów ani
w korpusie uwag; z tego **48 to prawdziwe blokery bez adresata nawet w postaci pytania**.

### Lista NADAL OTWARTYCH P0 (26) — nazwa, co trzeba zrobić, szacunek

| ID | Co trzeba zrobić | Szacunek |
|---|---|---|
| `CHAT-OWN-017` | Zamknąć 6 pozycji P1 Chat poniżej (002/003/004✓/013/015/016) i dopiero wtedy ocenić bramę Canvas | DUŻE |
| `MYW-MGR-REC-001` | Przeprojektować Manager na realne dane (bottlenecks z aktywności, nie mock) | DUŻE |
| `MYW-PHOTO-001` | Rozszerzyć fixture demo o pełne stany (active/blocked/overdue/action-required/Done) | ŚREDNIE |
| `MYW-PHOTO-002` | Zbudować realne rozróżnienie "brak wyników" vs "odmowa dostępu" w Inbox | ŚREDNIE |
| `MYW-PHOTO-007` | Uzupełnić fixture o zadania/pending w pełnym zakresie stanów | ŚREDNIE |
| `MYW-PHOTO-010` | Dokończyć dowód end-to-end mechaniki CAS (409 już działa, brakuje pełnej matrycy) | ŚREDNIE |
| `XMOD-CARD-REC-001` | Zrobić inwentarz 7 kontraktów kart + jeden wspólny standard cross-module | DUŻE |
| `INT-MENU-OWN-001` | Rozszerzyć registry akcji z Assignment na Inbox/Sessions/Templates/Insights/Initiatives | ŚREDNIE |
| `INI-OWN-006` | Zbudować kreator premise→AI draft→human review dla inicjatyw | DUŻE |
| `INI-OWN-009` | Audyt zgodności preview/menu Initiatives z `consultify-triada`/`consultify-preview` | ŚREDNIE |
| `MYW-IDEAS-008` | Dokończyć usunięcie przycisku Save z paska tożsamości Ideas | DROBNE |
| `MYW-IDEAS-009` | Zbudować kanoniczny status "priorConversionCount" zamiast jednego wywołania w kodzie | DUŻE |
| `MYW-IDEAS-011` | Rozszerzyć AI nudge strip na Process Flow + Table (dziś tylko Whiteboard/Mind Map) | ŚREDNIE |
| `MYW-IDEAS-013` | Dopisać test kontraktowy enumerujący każdą kontrolkę na 4 powierzchniach Ideas | ŚREDNIE |
| `MYW-NBK-003` | Zaprojektować model prowieniencji/historii/rozwiązywania konfliktów notatnika | DUŻE |
| `MYW-NBK-004` | Dodać faceted filtering do już wdrożonego wyszukiwania cross-notebook | ŚREDNIE |
| `MYW-IDEA-REC-002` | Dodać migrację `scope`/`project_id` do `my_idea_folders` + rename/archive | ŚREDNIE |
| `MYW-PHOTO-003` | Wspólny scroll-affordance dla `MyWorkNav` (Fala 1, mechaniczne) | DROBNE |
| `MYW-PHOTO-005` | Jeden właściciel scroll-containera nav+treść (ten sam root cause co wyżej) | DROBNE |
| `MYW-PHOTO-011` | Zbudować macierz regresji PL/EN/light/tablet/klawiatura dla Ideas | ŚREDNIE |
| `RES-OWN-005` | Formalny odbiór właściciela współdzielonego preview w Results (kod już działa) | DROBNE |
| `CHAT-OWN-002` | Ujednolicić wysokość nagłówka Chat + realny model zapisu (nie localStorage) | ŚREDNIE |
| `CHAT-OWN-003` | Dowieść mechanikę gałęzi konwersacji albo usunąć przedwczesne UI | ŚREDNIE |
| `CHAT-OWN-013` | Przebudować IA historii czatu (prywatna vs organizacyjna) | DUŻE |
| `CHAT-OWN-015` | Audyt trybów głosowych Teresy w całej aplikacji | ŚREDNIE |
| `CHAT-OWN-016` | Bezpieczna, nietechniczna obsługa błędów żywego providera AI | ŚREDNIE |

Uwaga: powyższa lista NIE obejmuje 19 P0 z trzeciego źródła (`ASM-OWN-00X[OF]` architektura
DRD workspace/QBank/navigatora + `TLS-INIT-OWN-001`/`TLS-SWOT-OWN-001`) — te są opisane
w R1c i mają identyczny werdykt, ale są to w większości pytania architektoniczne ("jak ma
wyglądać X"), nie punktowe naprawy — pełna lista w tabeli R1c.

### Lista DO ROZMOWY — gotowe pytania do właściciela (8, poniżej limitu 15)

1. **`MYW-NBK-CORE-001`** — Notatnik ma gotowy za flagą widok "Work/Context zamiast
   Tools/Work/Context" (8/8 zrzutów PASS) — zgadzasz się przełączyć domyślnie?
2. **`MYW-IDEAS-CORE-001`** — czym ma być "AI Advice" w panelu Ideas (poza już istniejącym
   AI Summary)?
3. **`MYW-IDEAS-012`/`MYW-IDEAS-014`** — czy konwersja Idea→Notatka/Notatnik wchodzi w
   zakres MVP, czy zostaje tylko Initiative/Task/Report?
4. **`MYW-INB-REC-001`** — `InboxTriage.tsx` (585 linii, zero importerów) to fundament do
   podłączenia funkcji triage Inbox, czy martwy kod do skasowania?
5. **`MYW-PHOTO-004`** — duży element "MY WORK" pod filtrami bez czytelnej roli —
   zostaje z nazwaną funkcją, czy znika?
6. **`ASM-OWN-025[OF]`** (= pozycja `B1` w `DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md`) —
   przebudowa struktury raportu Oceny (7 osi, wstęp→odpowiedzi→podsumowanie) osobnym
   torem teraz (prototyp 1 dzień + budowa 2–3 dni), czy poczekać?
7. **`ASM-OWN-027[OF]`** — jaki model komercyjny (uprawnienia, kredyty raportu) dla
   Assessment Settings?
8. **`ASM-OWN-028[OF]`** — jaki kontrakt AI (koszt/provider) dla komentarzy-doradcy przy
   Matrix/Report?

---

## R3 — Reguła dla bramki G20 "zero open P0/P1"

Bramka powinna liczyć trzy koszyki osobno, nie jeden wspólny licznik: pozycje
**NAPRAWIONE** i **ZAMKNIĘTE/ODŁOŻONE DECYZJĄ** (23 z 79 dziś) NIE blokują — decyzja
architektoniczna, która była powodem statusu P0/P1, już zapadła, a resztę wykonuje się
jak zwykły dług inżynierski poza bramką decyzyjną. Pozycje **DO ROZMOWY** (8) blokują
WYŁĄCZNIE dopóki nie dostaną numeru `DEC-…` w ledgerze — to gotowe pytania, nie
nierozpoznane problemy, więc ich koszt zamknięcia to jedna rozmowa, nie dyżur. Pozycje
**NADAL OTWARTE BEZ DECYZJI** (48) są jedynym realnym mianownikiem bramki G20 — to jest
dług bez adresata, którego nikt nawet nie oznaczył jako czekający na Piotra. Praktyczny
próg: G20 przechodzi, gdy `NADAL OTWARTE BEZ DECYZJI = 0` I `DO ROZMOWY = 0`, niezależnie
od tego, ile pozycji ZAMKNIĘTE/ODŁOŻONE DECYZJĄ wciąż czeka na kod — to jest różnica
między "nikt nie wie, co robić" (blokuje) a "wiadomo co, ktoś jeszcze tego nie napisał"
(zwykły backlog). Każda nowa pozycja P0/P1 powinna przy wpisaniu do rejestru dostać od
razu próbę dopasowania do ledgeru (grep ID w tym samym commicie, który ją dodaje) — inaczej
rozjazd między 4 rejestrami z `ROZLICZENIE_P0P1_20260903.md` (dziś 61 z 121 pozycji poza
licznikiem master) powtórzy się dla warstwy decyzyjnej.
