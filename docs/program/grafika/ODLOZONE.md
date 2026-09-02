---
doc_id: grafika-odlozone
status: canonical
truth_type: work-register
established: 2026-08-30
---

# Katalog odłożonych — ekrany, których dziś nie ruszamy

**Zasada właściciela, dosłownie:** *„nie chcemy stracić czegoś, co może mieć
wartość"*. Dlatego tu **nic nie jest kasowane**. Kod zostaje na miejscu; ten plik
jest wyłącznie **oznaczeniem i pogrupowaniem**.

## ★ Bezpiecznik

Ekran wpisany do tego katalogu **nie wchodzi do żadnej partii roboczej bez
wyraźnej zgody właściciela**. Nie wraca sam, nie wraca „przy okazji", nie wraca
dlatego, że agent go znalazł greppem.

## Format wpisu — trzy pola obowiązkowe

| Ekran / plik | Dlaczego odłożony | Co niósł wartościowego | Jak przywrócić |
| --- | --- | --- | --- |
| _pusto — katalog zakładany 2026-08-30_ | | | |

## Grupy

Wpisy grupujemy według powodu, nie według katalogu w kodzie:
- **martwy** — nie jest renderowany z żadnego punktu wejścia
- **za flagą bez decyzji** — zbudowany, czeka na rozstrzygnięcie właściciela
- **poza zakresem rundy** — świadomie odłożony decyzją
- **duplikat** — istnieje nowsza powierzchnia pełniąca tę rolę

---

## Grupa: dowody z zakończonych fal napraw (21 pozycji, wpis 2026-08-30)

**To nie są ekrany produktu.** To jednorazowe stanowiska dowodowe zbudowane po to,
żeby zrobić zrzut PRZED/PO przy konkretnej naprawie i pokazać, że naprawa zadziałała.
Sprawdziłem to czytając nagłówek każdego pliku, nie zgadując po nazwie — każdy z nich
sam się do tego przyznaje w pierwszych liniach („Screenshot-only PRZED/PO gallery",
„render-verify jednorazowy", „measurement harness", „smoke").

**Dlaczego odłożone:** właściciel ogląda produkt, a nie dokumentację naszych własnych
napraw. Postawienie tych 21 pozycji obok realnych ekranów rozmyłoby odbiór — 21 z 209
pozycji harnessu to nie ekrany do zaakceptowania, tylko archiwum dowodów.

**Co niosły wartościowego:** są zapisem, że fala napraw naprawdę się wydarzyła i jak
wyglądał stan sprzed niej. To jedyne miejsce w repo, gdzie widać „przed". Kasowanie
ich zniszczyłoby możliwość sprawdzenia, czy naprawa nie cofnęła się po miesiącach.

**Jak przywrócić:** nic nie trzeba przywracać — pliki stoją nietknięte w
`dev-render/screens/`, otwierają się tym samym adresem co zawsze. Wracają do partii
roboczej wtedy i tylko wtedy, gdy podejrzewamy cofnięcie się którejś naprawy i chcemy
porównać dzisiejszy stan z zapisanym „przed".

| Ekran | Czego dowodził |
| --- | --- |
| `crimson-mywork-wave2` | usunięcie ~36 crimsonowych przycisków w Mojej pracy |
| `crimson-wave-chrome-2026-07-26` | fala czyszczenia crimsonu w obudowie aplikacji |
| `wave3-creators-crimson` | ~250 nadużyć crimsonu w kreatorach, czacie i spotkaniach |
| `wave4-choices-crimson` | crimson na wyborach i przełącznikach |
| `wave5-internal-crimson` | crimson w Studiu, panelu nadzorcy i logowaniu |
| `settings-crimson-neutralized` | neutralizacja crimsonu w Ustawieniach |
| `accent-soft-token-fix` | błąd przezroczystości tokenu akcentu |
| `rose-danger-token-parity` | dowód, że dwie palety to ta sama paleta |
| `ui-foundation-focus-01-evidence` | niebieski fokus zamiast crimsonowego |
| `tabele-fala2-przed-po` | fala poprawek tabel z 28.07 |
| `i18n-fala1-smoke` | pierwsza fala tłumaczeń, trzy moduły naraz |
| `mindmap-i18n-smoke` | tłumaczenia modali mapy myśli |
| `staging-fixes-execution-i18n` | naprawa mieszanki językowej w Realizacji |
| `staging-fixes-initiatives-i18n` | naprawa mieszanki językowej w Inicjatywach |
| `menu-canon-sidebar-check` | potwierdzenie, że z menu bocznego znikł Excel |
| `menu-dlugi-domkniecie` | domknięcie czterech długów Menu |
| `navdeclutter-sidebar` | menu boczne z flagą odchudzenia i bez niej |
| `exe-002-004-ui-audit` | audyt kręgosłupa zarządzania realizacją |
| `mm-ppm-measure` | pomiar, czy menu kontekstowe mieści się bez przewijania |
| `capability-gate-demo` | te same przyciski w trzech trybach uprawnień |
| `odbior` | stary panel odbioru z lipca, zastąpiony przez `odbior-grafika.html` |

---

## Grupa: duplikat — generator szablonów Excela (K8, wpis 2026-08-30)

**Kontekst:** właściciel odrzucił CZTERY ekrany z grupy K8
(`MAPA_UWAG_WLASCICIELA.md`, sekcja K8) słowami *„nie wiem, po co on w ogóle
jest"* (×2), *„to samo nie wiem, po co on jest"* i, o jednym z nich wprost:
*„Nie potrzebny w ogóle ten arkusz. Z pozostałością w ogóle pierwszych jakichś
prób."* Opisał też docelowy przepływ: *„gdy mamy generator do wyboru,
wybieramy »generuj tabelę template«, otwiera się generator szablonów, a potem
mamy je w liście szablonów"*.

**Zbadałem wszystkie cztery PRZED odstawieniem którejkolwiek (zasada „siedem
razy okazało się czymś innym").** Wynik: TYLKO JEDEN z czterech przechodzi
badanie bezpiecznie. Pozostałe trzy okazały się jedynym, żywym wejściem do
mechanizmów, które realnie działają i mają za sobą świadome decyzje
właściciela z lipca — patrz grupa niżej „Zbadane, ale NIE odłożone".

### `gen-excel-templates-tab` — jedyny odstawiony z tej czwórki

| Ekran / plik | Dlaczego odłożony | Co niósł wartościowego | Jak przywrócić |
| --- | --- | --- | --- |
| `gen-excel-templates-tab` (`dev-render/screens/gen-excel-templates-tab.tsx`, montuje `src/components/AIChat/KimiWorkspace/ExceleParametricTemplates.tsx`) | Właściciel dosłownie: *„Nie potrzebny w ogóle ten arkusz. Z pozostałością w ogóle pierwszych jakichś prób."* Zweryfikowałem: to zakładka huba „Generator szablonów Excel" w `ReportsAndPresentationsHub.tsx` (`templatesView === 'workbookTemplates'`, linie ~1427-1438), za flagą `ff_workbook_templates` (`src/utils/workbookTemplatesFlag.ts`) — **domyślnie OFF**. Menu-wejście do niej (`TemplatesNewSplitButton` → „Generator szablonów") pokazuje się tylko gdy `isWorkbookTemplatesEnabled()===true` (`ReportsAndPresentationsHub.tsx:1516-1517`) — czyli dziś **żaden zwykły użytkownik go nie widzi**. To jest dokładnie „pozostałość pierwszych prób": starszy, zdublowany sposób pokazania tego samego komponentu, wyparty przez nowszy przepływ (patrz kolumna obok). | Sam komponent `ExceleParametricTemplates` (rejestr parametrycznych modeli P&L/budżet/DCF, buduje realny `.xlsx` przez `POST /api/workbook/templates/:id/build`) — **nie jest tracony, bo żyje gdzie indziej, nietknięty**: (1) `/excele` (czat) → zakładka „Szablony" montuje ten sam komponent bezpośrednio, bez flagi hubowej (`ArtifactModuleHome.tsx:217-224`, `lane==='excele'`); trasa `/excele` jest za `ff_excele`, **domyślnie ON** (`src/utils/exceleFlag.ts`, akcept Piotra 2026-07-22); (2) „Nowy szablon" (Biblioteka wzorców) → kafel „Arkusz" otwiera **nowszy** `TemplateBuilderFlow` (wizard nazwa→typ→dostępność → builder → zapis), a po zapisie builder sam przełącza widok na `workbookTemplates` i pokazuje toast „Szablon zapisany — wybierz »Zbuduj skoroszyt«" (`ReportsAndPresentationsHub.tsx:1628-1649`) — czyli DOKŁADNIE ten sam `ExceleParametricTemplates`, tylko wejście inne. `ff_templateBuilder` jest **domyślnie ON poza publiczną produkcją**, zaakceptowane przez Piotra na zrzutach 2026-07-13 (`src/components/TemplateBuilder/templateBuilderFlags.ts`). | Kod nietknięty (nic nie skasowane). Żeby przywrócić hub-tab jako osobne wejście: `?ff_workbook_templates=1` albo `localStorage['ff.workbookTemplates']='1'`, albo zmienić default w `src/utils/workbookTemplatesFlag.ts`. Rejestr odbioru: `docs/program/grafika/status.json`, moduł `10-materialy`, id `gen-excel-templates-tab`, `ocena` przestawiona z `A` na `D`. Zrzut stanu zastanego (przed odstawieniem): `evidence/grafika/107-generatory-odstawione/gen-excel-templates-tab__PRZED__light.png`. |

**Wejście w interfejsie do ukrycia:** brak do zrobienia — flaga `ff_workbook_templates`
jest już domyślnie OFF, więc menu-pozycja „Generator szablonów" w split-buttonie
„Nowy szablon" **już się nie pokazuje** zwykłym użytkownikom. Jedyna „dziura"
to ręczny deep-link `?tab=workbook_templates` (działa niezależnie od flagi,
`ReportsAndPresentationsHub.tsx:220-226`) — celowo zostawiony, bo to ten sam
link, którego używa `TemplateBuilderFlow.onSaved` (patrz kolumna „co niósł").
Nic więcej nie trzeba chować.

---

## Grupa: zbadane w rundzie K8, ale NIE odłożone — żywa mechanika bez zamiennika (wpis 2026-08-30)

Te trzy ekrany też są w grupie K8 („nie wiem, po co on jest") i też przeszły
pełne badanie — ale badanie ich **nie przepuściło**. Za każdym stoi żywa
mechanika (generator albo trasa API), do której **nie ma dziś żadnej innej
drogi**. Reguła zadania: *„jeśli za ekranem stoi żywa mechanika, do której nie
ma innej drogi — NIE zdejmuj go i zgłoś to natychmiast w raporcie."* Dlatego
zostają w rejestrze odbioru (`status.json`, ocena `A`, bez zmian) i w
przepływie produktu — to poniższy zapis jest zgłoszeniem, nie odłożeniem.

| Ekran | Co faktycznie mocuje | Dowód (plik:linia) |
| --- | --- | --- |
| `gen-word-content-hints` (montuje `DocumentStudioTemplateArchitectView`) | **Jedyne** wejście do tworzenia szablonów dokumentów Word. „Nowy szablon" (Biblioteka wzorców) → kafel „Dokument" nawiguje wprost tu, bez wyboru trybu. Szkice zatwierdzone tu wpadają do wspólnej Biblioteki wzorców przez „Most" wbudowany świadomą decyzją właściciela 24.07.2026. | `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx:506-507` (`format==='document' → navigate('/document-studio?tab=templates')`); `src/components/DocumentStudio/DocumentStudioView.tsx:911-916` (montowanie, bez flagi); `server/src/services/deliverableTemplateService.ts:231-241` (komentarz „Most Word Architect → Biblioteka", decyzja Piotra „Most document_studio → rejestr"); backend żywy: `server/src/routes/document-studio.routes.ts:1118` (`POST /templates/plan`). |
| `gen-deck-content-hints` (montuje `PresentationTemplateArchitectView`) | **Jedyne** wejście do tworzenia szablonów prezentacji. „Nowy szablon" → kafel „Prezentacja" nawiguje wprost tu. Zapisane szablony trafiają bezpośrednio do tabeli `presentation_templates`, którą Biblioteka wzorców czyta natywnie (bez mostu). | `ReportsAndPresentationsHub.tsx:514-520` (branża `else` w `handleTemplateLauncherSelect` → `?tab=template_architect`); `ReportsAndPresentationsHub.tsx:1417-1425` (montowanie w `templatesView==='deckArchitect'`); backend żywy: `server/src/routes/presentations.routes.ts:1354` (`POST /templates/plan`), `:1462` (`/templates/:id/clone`), `:1630+` (governance/transition/deprecate/lineage); `server/src/services/deliverableTemplateService.ts:135-140` (`listDeckTemplates` czyta `presentation_templates` wprost). |
| `prezentacje-template-states` (montuje pełny `PrezentacjeView`, testuje 3 stany „Użyj wzorca") | To NIE jest osobny ekran do odstawienia — to stany błędu/ładowania GŁÓWNEGO, produkcyjnego generatora prezentacji (`/prezentacje`), używanego do KAŻDEJ prezentacji, nie tylko z szablonu. „Użyj wzorca" z Biblioteki dla typu `presentation` prowadzi właśnie tutaj i realnie woła `POST /presentations/decks/from-template`. | `src/routes/AppRoutes.tsx:1906` (`<PrezentacjeView />` pod `/presentations`/`/prezentacje`); `src/components/ReportsAndPresentations/artifactNavigation.ts` (`routeMap.presentation = '/prezentacje'`, fallback „Użyj wzorca"); `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx:351-380` (efekt czytający `templateArtifactId`, woła `from-template`). |

**Docelowy przepływ właściciela — werdykt (sprawdzony, nie założony):**
*„generator → »generuj szablon« → lista szablonów"* **działa dziś dla
wszystkich trzech formatów** — ale trzema RÓŻNYMI ścieżkami kodu, co samo w
sobie tłumaczy, dlaczego właściciel nie rozpoznaje spójnego wzorca. Działa
niezależnie od odstawionego `gen-excel-templates-tab` (Arkusz ma zamiennik —
patrz wyżej) i niezależnie od `prezentacje-template-states` (to stany błędu
osobnej, „użyj wzorca" ścieżki, nie ścieżka tworzenia szablonu) — ALE dla
Worda i Decku przepływ nadal fizycznie PRZECHODZI przez `gen-word-content-hints`
i `gen-deck-content-hints`, czyli te dwa ekrany nie mają dziś zamiennika:
- **Arkusz (spreadsheet):** nowy `TemplateBuilderFlow` (wizard → builder →
  zapis → „Zbuduj skoroszyt") — najbliżej opisu właściciela, zaakceptowany
  2026-07-13. Dowód: `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx:1628-1649`.
- **Dokument (Word):** stary Architekt (`gen-word-content-hints`) + „Most" do
  wspólnej Biblioteki (tylko `status='approved'`). Dowód:
  `server/src/services/deliverableTemplateService.ts:231-260`.
- **Prezentacja (Deck):** stary Architekt (`gen-deck-content-hints`), zapis
  bezpośrednio do `presentation_templates`, bez mostu. Dowód:
  `server/src/services/deliverableTemplateService.ts:135-140`.

Innymi słowy: przepływ właściciela JUŻ ISTNIEJE i działa dla wszystkich
trzech formatów — tylko dla Worda i Decku realizuje go WCIĄŻ ten sam
„architekt", którego właściciel odrzucił jako ekran. Zdjęcie tych dwóch
architektów z drogi bez zamiennika zostawiłoby Word i Deck **bez żadnego**
sposobu tworzenia nowych szablonów. To decyzja produktowa (zbudować
`TemplateBuilderFlow`-owy odpowiednik dla doc/deck, tak jak już jest dla
`table` — `templateBuilderModel.ts` ma typy `'doc' | 'deck' | 'table'`
gotowe, wizard (`TemplateCreateWizard.tsx`) już oferuje wszystkie trzy karty
typu, tylko nic poza kafelkiem „Arkusz" tam dziś nie prowadzi) — nie
graficzna, i nie moja do podjęcia w tej rundzie.

Zrzuty stanu zastanego (wszystkie cztery, `light`, PRZED jakąkolwiek zmianą):
`evidence/grafika/107-generatory-odstawione/gen-word-content-hints__PRZED__light.png`,
`evidence/grafika/107-generatory-odstawione/gen-deck-content-hints__PRZED__light.png`,
`evidence/grafika/107-generatory-odstawione/prezentacje-template-states__PRZED__light.png`.

## Grupa: ESKALACJA — szerokość powłoki arkusza (Excel), wpis 2026-09-01

**To NIE jest wpis „odkładamy ekran".** To zgłoszenie właściciela, którego
NIE MOŻNA zamknąć zmianą szerokości, bo mierzalnie nie ma czego zmieniać —
a właściwa naprawa to przebudowa powłoki, wymagająca prototypu i akceptu.

**Ekrany:** `sheet-artifact`, `excele-prawy-panel-standard`
(oba montują ten sam `SpreadsheetArtifactStudio`).

**Uwaga właściciela (2026-08-30):** „tak jak tabela w Excelu, sama tabela
powinna zaczynać się od samej góry […] jedna trzecia ekranu jest zużyta
zupełnie niepotrzebnie na informacje albo funkcje, które mogłyby być
w panelu bocznym rozwijanym" oraz „musimy usunąć więcej niepotrzebnego
panelu, aby tabela zajmowała całą centralną część ekranu".

**POMIAR w żywym DOM (okno 1440×900, 2026-09-01):**
- lewa szyna „Arkusze": 280 px · płótno: 840 px · prawy panel SPEC-A: 320 px
- tabela: 814 px — czyli **100% wnętrza płótna** (816 px po odjęciu `p-3`
  i ramki karty). Nic jej nie zwęża.
- kontrola przy 1920 px: płótno 1320, tabela 1294 — szyny zostają 280/320,
  tabela bierze CAŁĄ resztę. Zero `max-width`, zero `table-fixed` z sumą
  mniejszą od kontenera.

**Wniosek:** 600 px (41,7% okna) zjadają dwie powierzchnie, obie kanoniczne:
1. lewa szyna = ZAKŁADKI ARKUSZY. `ExecutiveModuleShell/index.tsx:752-757`
   ma jawną decyzję: arbitraż celowo NIE zwija tej szyny, bo „w arkuszu lewa
   szyna to zakładki arkuszy — bez nich skoroszyt przestaje być skoroszytem".
   Zwinięta szyna ma 48 px i CHOWA treść (`LeftRail.tsx:50,107`).
2. prawy panel = `ArtifactRightPanel` SPEC-A, szerokość z tokenu
   `--ntype-right-panel-width: 320px` (`src/index.css:93`) — ujednolicona
   dla sześciu kart dopiero 2026-09-01 (dyżur 164). `ArtifactRightPanel`
   nie ma dziś zwijania CAŁEGO panelu, tylko akordeon per sekcja.

Część uwagi jest już zrobiona i nie wolno robić jej drugi raz: górę ekranu
wyczyszczono do tytułu + paska narzędzi + paska formuły, a metadane (nazwa
pliku, format, liczba arkuszy, opis) przeniesiono do prawego panelu —
komentarz `SpreadsheetArtifactStudio.tsx:2011-2020` cytuje przy tym te same
słowa właściciela.

**Co zostaje do decyzji właściciela (przebudowa, nie poprawka):**
zakładki arkuszy jako pasek NA DOLE (jak w Excelu) zamiast szyny 280 px
i/lub zwijanie całego prawego panelu SPEC-A. Pierwsze uwalnia 280 px
(tabela 814 → ~1094 px, +34%), drugie kolejne 320 px. Oba ruszają kanon
wspólny dla WIĘCEJ NIŻ TEGO EKRANU (szyna: Word/Deck/Mindmap; panel:
sześć kart SPEC-A), więc idą przez prototyp + akcept, nie przez dyżur
szerokości. Dowody: `evidence/grafika/166-tabela-szerokosc/`.

---

## Grupa: do przebudowy, nie do zdjęcia — `results-vnext-okr-workspace` (wpis 2026-09-01)

**Słowa właściciela (01.09, 05:55):** *„To miało być w N-type karcie"*.

**Werdykt: intuicja trafna co do KSZTAŁTU, ale ekranu nie zdejmujemy.**
`cel-jedna-karta` go nie zastępuje, bo to **inny poziom**. Zgodnie z decyzją
właściciela z 30.08 (`DECYZJA_WYNIKI_TRZY_POZIOMY.md`) Wyniki mają trzy poziomy:
rejestr zestawień → **tabela zestawu** → karta pojedynczego celu. Warsztat OKR
jest poziomem 2 — tym, który właściciel sam kazał dobudować. Karta celu to karta
jednego wiersza z tabeli, którą warsztat pokazuje.

**Ekran jest żywy na demo:** trasa `/results/okr/sets/:okrSetId`
(`AppRoutes.tsx:3105-3125`) to główne działanie „Otwórz" w rejestrze zestawów
(`okrRegistryPresenters.tsx:240-247`, `ResultsOkrHub.tsx:606-608`).
Zdjęcie odcięłoby: dopasowania celów, prośby o wsparcie, blokady, refleksję
z Teresą, historię i **cały cykl akceptacji zestawu**. Ryzyko wysokie.

### Plan przebudowy — wzorzec ROI z 30.08

Naśladujemy dokładnie to, co właściciel zatwierdził dla ROI: *„To musi być
N-karta, gdzie będziemy mieli z nowej strony te zakładki, które teraz masz
w menu"* — `results-vnext-roi-full-tool` został tego samego dnia przebudowany
w `roi-jedna-karta` (zakładki poziome → sekcje w lewej kolumnie). Warsztat OKR
ma **dokładnie tę samą wadę powłoki**: sześć zakładek w poziomie, brak prawego
panelu kanonu.

**Co trafia do karty N (sekcje lewej kolumny — dzisiejsze zakładki 1:1):**

| Dzisiejsza zakładka | Staje się sekcją karty N |
| --- | --- |
| Przegląd | Właściwości zestawu (`ArtifactPropertiesTable`) |
| Cele i Kluczowe Rezultaty | Tabela celów z zejściem do KR i check-inów |
| Dopasowania | Dopasowania |
| Rozmowy i wsparcie | Prośby o wsparcie i blokady |
| Przegląd i refleksja | Refleksja (tu wchodzi Teresa) |
| Historia | Historia |

**Co trafia do prawego panelu (`ArtifactRightPanel`, 7 sekcji kanonu):**
cykl życia zestawu — złożenie, akceptacja, żądanie poprawek, aktywacja,
anulowanie — jako **blok akcji w prawym panelu**, a nie rząd przycisków pod
tabelą. Reguły dostępności każdego przycisku zostają wypisane wprost, tak jak
dziś (nic nie znika, zmienia się miejsce).

**Co zostaje bez zmian:** cała treść i cała mechanika serwera. To przebudowa
POWŁOKI, nie funkcji.

**Przy okazji, dwie drobne rzeczy widoczne na zrzucie:** pola „Właściciel"
i „Recenzent" pokazują ucięte `user-ann…` / `user-tom…` zamiast nazwisk. Ten sam
defekt w ekranie „Uwaga" jest już naprawiony przez odczyt listy członków
organizacji (`OrganizationApi.getOrganizationMembers`) — rozwiązanie do
przeniesienia 1:1.

**Skąd wziąć wzorzec:** `dev-render/screens/roi-jedna-karta.tsx` i
`wskaznik-jedna-karta.tsx` — obie karty N używają wyłącznie wspólnych cegiełek
SPEC-A (`NModeShell` + `ArtifactRightPanel` + `ArtifactPropertiesTable` +
`PreviewRelations`), zero własnego layoutu.

**Stan dziś:** ekran zostaje w rejestrze odbioru z obecną oceną `A` i adnotacją,
że czeka na przebudowę. Dowody stanu zastanego:
`evidence/grafika/168-odrzucone/results-vnext-okr-workspace__PRZED__*.png`.

---

## ★ SPRAWA DO DECYZJI WŁAŚCICIELA — co zginęło razem z wycofanym hubem Wyników (wpis 2026-09-01)

**To nie jest wpis o wyglądzie. To jest zgłoszenie utraty FUNKCJI.**

Stary hub Wyników (`ResultsHub.tsx`, 2485 linii) został wycofany 24.08
(commit `8df1cd413d`) i **nie ma dziś żadnej trasy** — `/results` przekierowuje
na rejestr KPI (`ResultsOwnerReviewEntry.tsx:12`), a `<ResultsHub />` montują już
tylko pliki testów. Razem z nim przestało być osiągalne wszystko, co tylko on
montował. Zmierzone (nie z dokumentacji — greppem po realnych wołaczach):

### 1. Diagnostyka odchyleń (`ff_deviationDiagnostics`) — **UTRACONA W CAŁOŚCI**

Trzy silniki serwera **żyją i są zamontowane w routerze**:
`kpiAnomalyService` (`v8/results.routes.ts:2716`), `kpiForecastService`
(`:2788`), `deviationRcaSuggestService` (`:1319`). Klienckie owijki też istnieją:
`getKpiAnomalies` (`src/services/api/v8/results.ts:848`), `getKpiForecast`
(`:852`), `rca-suggest` (`:861`).

**Wołaczy w interfejsie: ZERO.** `getKpiAnomalies` i `getKpiForecast` nie mają
ani jednego konsumenta w całym `src/`; `rcaSuggest` ma jednego — martwy
`KPITimeSeriesDrawer` (`:1347-1372`). Nowy `KpiToolPage`/
`KpiDeviationCaseSubview` nie odwołuje się do żadnego z nich (grep po
`anomal|forecast|rca` w `src/components/ResultsVNext/kpiTool/` — zero trafień).
`kpiTeresaRcaDraft.ts` **nie jest zamiennikiem**: jego własny nagłówek mówi, że
przepuszcza przez pipeline dokładnie ten tekst, który człowiek już napisał —
to governance, nie podpowiadanie przyczyn.

**Decyzja nadzorcy/CTO (2026-09-01, nie właściciela) — rozbita na dwie części,
bo silniki mają różny koszt odtworzenia:**
- **automatyczne sugestie przyczyn źródłowych** (`deviationRcaSuggestService`
  / `rca-suggest`) → **PÓŹNIEJ** (~1,5 dyżuru). Wymaga przeportowania silnika
  na nowy model danych (`DeviationCaseDto`) — „wystarczy przycisk" to nie jest
  prawda, to realna integracja.
- **wykrywanie anomalii i prognoza** (`kpiAnomalyService`, `kpiForecastService`)
  → **ODŁOŻONE** (~2 dyżury). Duży koszt budowy/utrzymania wobec małej
  przewagi nad tym, co konsultant i tak zrobi sam patrząc na wykres.

Kontekst wspólny dla tej decyzji i decyzji w sekcji 2. niżej: te funkcje stały
się nieosiągalne przy wycofaniu starego huba Wyników 24.08 (commit
`8df1cd413d`). Mechanika części z nich żyje na serwerze, ale stare i nowe
narzędzie zapisują dane w dwóch niepołączonych miejscach — więc odzyskanie
którejkolwiek z nich to nie jest „dorobienie drzwi", tylko budowa mostu.

### 2. Karta naprawcza (`ff_recoveryCard`) — **CZĘŚCIOWO**, cztery funkcje UTRACONE

`RecoveryCardPanel.tsx` (2101 linii, nagłówek :1-16) prowadzi pełną pętlę
naprawczą jednej sprawy odchylenia. Następcą jest `KpiDeviationCaseSubview`
(maszyna 9 stanów). Porównanie **funkcji, nie nazw**:

| Funkcja karty naprawczej | Odpowiednik w nowej karcie wskaźnika | Werdykt |
| --- | --- | --- |
| hipoteza → potwierdzona przyczyna | `submitRootCause` (`kpiDeviationApi.ts:284`) | MA ODPOWIEDNIK |
| działania korygujące (tytuł/właściciel/termin/status) | `addCorrectiveAction`/`updateCorrectiveAction` (`:313`, `:347`) | MA ODPOWIEDNIK |
| zamknięcie z dowodem + ocena skuteczności | `submitEffectivenessVerification` + `closeDeviationCase` | MA ODPOWIEDNIK |
| kontynuuj / eskaluj | `escalateDeviationCase`/`deescalateDeviationCase` | MA ODPOWIEDNIK |
| **powiązanie działania z Zadaniem** (`link-task`, `taskLinkStatus`) | brak — zero trafień `linkedTaskId` w `kpiTool/` | **UTRACONA** |
| **eksperymenty** (utwórz/recenzuj/rozstrzygnij, werdykt + decyzja) | brak jakiegokolwiek odpowiednika | **UTRACONA** |
| **zależności i ryzyka** (listy na karcie) | brak pól w `DeviationCaseDto` | **UTRACONA** |
| **typ działania** IMMEDIATE / DURABLE | brak pola w `CorrectiveActionDto` | **UTRACONA** |
| punkty kontrolne (seria dat PENDING/MET/MISSED, każdy wpięty w pomiar) | JEDEN `recoveryObservationMeasurementId` | CZĘŚCIOWO — seria → jeden punkt |
| priorytet LOW…CRITICAL | `severity` warning/critical — to waga WYKRYCIA, nie priorytet planu | CZĘŚCIOWO |
| kryteria skuteczności ustalane Z GÓRY | weryfikacja po fakcie (`rationale`) + polityka odpowiedzi KPI | CZĘŚCIOWO |

**Decyzja nadzorcy/CTO (2026-09-01, nie właściciela) — per pozycja UTRACONA:**
- **powiązanie działania naprawczego z Zadaniem** (`link-task`,
  `taskLinkStatus`) → **ROBIMY** (~1 dyżur). Bez tego pętla naprawcza się
  rwie: działanie korygujące nie trafia na niczyją listę zadań.
- **typ działania natychmiastowe/trwałe** (IMMEDIATE/DURABLE) → **ROBIMY**
  (~0,5 dyżuru). Tanie, a odróżnia gaszenie pożaru od naprawy przyczyny.
- **eksperymenty** (utwórz/recenzuj/rozstrzygnij, werdykt + decyzja) →
  **NIE WRACAJĄ**. To filozofia starego narzędzia; nowe prowadzi naprawę
  prościej, a mieszanie dwóch podejść zaszkodziłoby produktowi.
- **zależności i ryzyka** (listy na karcie) → **NIE WRACAJĄ**. Ta sama
  przyczyna co eksperymenty.

Kontekst (wspólny z decyzją w sekcji 1. wyżej): te funkcje stały się
nieosiągalne przy wycofaniu starego huba Wyników 24.08 (commit
`8df1cd413d`). Mechanika części z nich żyje na serwerze, ale stare i nowe
narzędzie zapisują dane w dwóch niepołączonych miejscach — więc odzyskanie
którejkolwiek z nich to nie jest „dorobienie drzwi", tylko budowa mostu.

Punkty serwera dla wszystkich tych funkcji **żyją**
(`v8/results.routes.ts:1885-2239`). Utracone jest wyłącznie **wejście**.

### 3. Szuflada szeregów czasowych KPI (`KPITimeSeriesDrawer`) — **CZĘŚCIOWO**

Jedenaście sekcji (`kpiDomain.ts:10-21`): `summary · deviation · recovery ·
record · history · definition · targets · lineage · settings · links · danger`.
Nowy `KpiToolPage` ma sześć sekcji z realnym odczytem i **sam uczciwie
przyznaje** (nagłówek `KpiToolPage.tsx:23-66`), że dwie są niedostępne, bo nie
ma tras: **Historia/Rodowód** (`history`/`lineage`) i **Karty wyników
i konteksty**; „Kontrakt" jest PARTIAL — żaden `GET` nie zwraca wersji definicji
(nazwa, jednostka, geometria progu, status akceptacji), czyli sekcja `targets`
starej szuflady nie ma pełnego pokrycia.

### Co z tym zrobić — stan po decyzji nadzorcy/CTO (2026-09-01)

**Nic z tego obszaru nie zostało w tym dyżurze zdjęte, skasowane ani
zaimplementowane** — decyzje niżej rozstrzygają KIERUNEK, nie wykonanie.
Ale sam `results-three-pairs` zszedł do oceny `D`, więc martwy hub przestał być
widoczny w rejestrze odbioru — a razem z nim przestały być widoczne te trzy
sprawy. Dlatego są tutaj, wypisane.

Stan per pozycja:
1. **Diagnostyka odchyleń** — **ROZSTRZYGNIĘTE** (patrz decyzja w sekcji 1.
   wyżej): automatyczne sugestie przyczyn źródłowych → PÓŹNIEJ; wykrywanie
   anomalii i prognoza → ODŁOŻONE.
2. **Cztery utracone funkcje karty naprawczej** — **ROZSTRZYGNIĘTE** (patrz
   decyzja w sekcji 2. wyżej): powiązanie z Zadaniem i typ działania → ROBIMY;
   eksperymenty i zależności/ryzyka → NIE WRACAJĄ.
3. **Historia/Rodowód wskaźnika** — **WCIĄŻ OTWARTE**. To brak TRAS serwera,
   nie brak ekranu; osobna praca po stronie `server/`.

Implementacja pozycji oznaczonych ROBIMY/PÓŹNIEJ/ODŁOŻONE nie została w tym
dyżurze rozpoczęta: `ResultsHub.tsx`, `KPITimeSeriesDrawer.tsx`,
`RecoveryCardPanel.tsx` i trzy silniki serwera **zostają nietknięte**, dopóki
któryś z tych kierunków nie trafi do partii roboczej.

---

## 2026-09-02 · Trzy rzeczy świadomie odłożone po rodzinie „ucięcia tekstu"

Wszystkie trzy zmierzone na **żywym DOM** (nie z kodu) przez robotnika naprawiającego
rodzinę; wszystkie trzy odłożone z podaniem powodu, nie przemilczane.

### 1. Zasłonięcie ostatniej kolumny przez przypiętą kolumnę akcji

**Dlaczego wygląda na defekt, którym nie jest.** Na `results-vnext-okr-registry`
nagłówek wygląda jak ucięte „PEW". Pomiar w przeglądarce: pełne słowo „Pewność"
mieści się w swoim boksie (`scrollWidth === clientWidth === 62px`) — **nic się nie
ucina**. Zasłania je sąsiedni `th.sticky` z nieprzezroczystym tłem, zaczynający się
w x=935. To samo na `results-vnext-okr-objectives` (znika cała kolumna
„Zaktualizowano") i `audyty-piec-powierzchni` (suma szerokości kolumn 1350 px
w kontenerze 994 px).

**Co niesie wartościowego:** przypięta kolumna akcji jest dobrym wzorcem — kebab
zawsze pod ręką, niezależnie od przewinięcia.

**Dlaczego odłożone:** naprawa wymaga **mechanizmu chowania kolumn wg priorytetu**,
a produkt nie ma dziś pojęcia „która kolumna jest ważniejsza". Autor poprzedniej
poprawki (dyżur 193, 01.09) zapisał to samo wprost. Dorobienie priorytetu na oko,
per ekran, dałoby dziesięć różnych porządków kolumn w dziesięciu modułach.

**Jak przywrócić:** zdefiniować priorytet kolumn w kontrakcie tabeli
(`StandardTable`), potem chować od najniższego przy zwężeniu — jedna zmiana
w komponencie, nie w ekranach. Zdarzenie poboczne warte naprawy przy okazji:
`ResizeObserver` przeliczający szerokości po otwarciu podglądu bywa spóźniony —
ręczne wywołanie `resize` na oknie naprawiało stan natychmiast.

### 2. Wspólny mechanizm klamrowania nie stawia wielokropka na pojedynczym długim słowie

`CELL_TEXT_CLAMP_CLASS` (`break-normal overflow-hidden text-ellipsis`) **nie działa**
dla jednego słowa dłuższego niż kolumna, gdy komórka jest wielolinijkowa i rośnie
(`white-space: normal`) — tak działa `text-overflow: ellipsis` zgodnie ze specyfikacją
CSS, to nie jest błąd implementacji. Widoczne na `capacity-advisor-a3` („ogranic",
„dotycz" bez kropek) i resztkowo na `chat-signals-feed` („Ostrzeżeni|e",
„Interpretac|ja").

**Dlaczego odłożone:** poprawka (np. `-webkit-line-clamp`) dotyka komponentu
współdzielonego przez dziesiątki ekranów już raz odebranych. To osobna runda
z pełnym przeglądem regresji, nie poprawka przy okazji — inaczej naprawiając jeden
ekran zepsujemy trzydzieści.

### 3. `results-zestawienia` — ekran istnieje tylko w przyrządzie

Zmierzone: `dev-render/screens/results-zestawienia.tsx` **nie ma odpowiednika
w `src/`** (`grep -rl "ZestawienieRow\|pluralizeWskaznik" src` — pusto). Defekt
„3 wskaźnik / i" jest realny, ale naprawienie go byłoby naprawą przyrządu, nie
produktu (reguła 17: harness ma pokazywać produkt, nie własną kompozycję).

**Do rozstrzygnięcia:** albo rejestr zestawień okresowych powstaje w produkcie
i wtedy ekran ma co pokazywać, albo karta schodzi z odbioru jako prototyp.
**Nie zostawiać jej w odbiorze z oceną A** — właściciel ocenia wtedy rysunek.

---

## 2026-09-02 · RODZINA DO ZROBIENIA (nie odłożona — czeka na wolnego robotnika): odmiana liczebnika po polsku

**Zgłoszenie punktowe, które jest próbką.** Na dwóch niezależnych ekranach widać ten sam błąd:
`exec-summary-onelook` pokazuje w kolumnie WIEK **„1 dni"** zamiast „1 dzień";
`admin-command-attention-queue` pokazuje **„1 testów nieudanych"** zamiast „1 test nieudany".

**Dlaczego to rodzina, a nie dwie literówki.** Polski ma trzy formy liczby mnogiej
(1 dzień · 2–4 dni · 5+ dni; 1 test · 2–4 testy · 5+ testów), angielski dwie. Kod pisany
pod angielski wzorzec `${n} dni` daje poprawny wynik dla większości liczb i błędny dla 1 —
czyli **defekt pokazuje się rzadko i wygląda jak przypadek**, a jest systemowy.

**Pierwszy pomiar (dolna granica, nie zakres):** wzorzec `${...} dni` znaleziony m.in. w
`src/components/Organization/OrgContextSummaryBanner.tsx:59`,
`src/components/Organization/redesign/OrganizationDirectionConstraintsScreen.tsx:120`
oraz w co najmniej ośmiu plikach `src/components/MyWork/*`. Zlecenie ma żądać pomiaru
CAŁEGO zbioru (wszystkie miejsca, gdzie liczba jest sklejana z polskim rzeczownikiem),
nie tych dwóch zgłoszonych.

**Jak naprawić u przyczyny, nie per wywołanie:** jedna funkcja odmiany
(`liczebnik(n, ['dzień','dni','dni'])`) w warstwie wspólnej i podmiana wywołań. Naprawa
per-wywołanie w tym repozytorium już raz odrosła po ośmiu tygodniach w dwunastu plikach.

**Dlaczego warto mimo niskiego priorytetu technicznego:** to jest dokładnie ten rodzaj
drobiazgu, po którym właściciel mówi „grafika jak sprzed pięciu lat". Kosztuje jeden dyżur.


---

## 2026-09-02 · ODMIANA LICZEBNIKA — reszta rodziny, osobny dyżur (zmierzona, nie oszacowana)

**Co już zrobione:** funkcja `liczebnik(n, [forma1, forma2, forma3])` w `src/utils/liczebnik.ts`
z testem `tests/unit/utils/liczebnik.test.ts` (11 przypadków: 1, 2, 5, 12, 22, 25, 0, 101, 112
plus wartości niecałkowite i NaN — wszystkie przechodzą). Naprawione dwa ekrany:
„1 dni" → „1 dzień" (`exec-summary-onelook`), „1 testów nieudanych" → „1 test nieudany"
(`admin-command-attention-queue`).

**Co zostaje — LICZBY z pomiaru całego zbioru, nie z próbki:**

| | |
| --- | --- |
| Wystąpień w kodzie (`src/**/*.ts(x)`) | **~68** (z ~70 znalezionych, 2 naprawione) |
| Plików | **~46** |
| Kluczy w `public/locales/pl/translation.json` z `{{count}}`/`{{v0}}` przy rzeczowniku | **156** |
| Różnych rzeczowników | kilkanaście (dni, elementów, kroków, wierszy, inicjatyw, decyzji, kolumn, zmian, ryzyk…) |
| Moduły objęte | `MyWork` (9 plików), `Organization`, `Reports`, `Finance`, `Execution`, `Initiatives`, `Interview`, `Assessment`, `SuperAdmin` |

**Dlaczego NIE zrobione dziś, mimo że mechanizm jest gotowy:** zbiór jest zbyt zróżnicowany
(kilkanaście rzeczowników, dwie konwencje wywołania `v0` vs `count`), żeby zmienić go bezpiecznie
i obejrzeć każdy ekran na własne oczy w jednym dyżurze. Podmiana bez dowodu wzrokowego per ekran
to dokładnie ta operacja, która w tym repozytorium raz już zniszczyła działającą treść.

**★ Ustalenie, które oszczędzi następnemu dyżurowi pół dnia:** poprawny wzorzec **już istnieje
i jest natywny dla i18next** — **207 kluczy** w `translation.json` używa sufiksów
`_one/_few/_many/_other` (np. `linkedArtifactsCount`). Dla stringów przechodzących przez `t()`
używaj TEGO, nie owijania w dodatkową funkcję JS. `liczebnik()` jest dla miejsc, gdzie tekst
składany jest w kodzie, poza `t()`. **Nie wprowadzaj trzeciego mechanizmu.**

Znalezione też dwie starsze, lokalne funkcje odmiany: `odmienNapiecia()`
(`src/toolOutputs/buildSwotOutput.ts:203`) i `polskaOdmianaKolumn()`
(`src/components/assessment/drd/DRDMatrixReadOnly.tsx:55`) — kandydaci do zastąpienia
przy okazji, żeby nie zostały cztery sposoby na tę samą rzecz.

---

## Grupa: liczebnik — klasa B po domknięciu klasy A (wpis 2026-09-02, gałąź `grafika/trzy-rodziny-20260902`)

**Sprostowanie liczby z wpisu powyżej.** Tamten wpis mówił „156 kluczy w `translation.json`
z `{{count}}` przy rzeczowniku" i „207 kluczy używa `_one/_few/_many/_other`". Zmierzone dziś
własnym skryptem przechodzącym CAŁY plik `pl/translation.json`: **kluczy do naprawy było 314,
nie 156**, a kluczy z natywnym mechanizmem było **285, nie 207**. Nie podważam tamtej roboty —
podaję liczby, bo na 156 partia wygląda na jednodniową, a na 314 nie.

**Zrobione dzisiaj (nie odkładam):** cała **klasa A — 16 kluczy z protezą w nawiasie**
(`harmonogram(ów)`, `reguł(y)`, `blok(ów)`, `task(ów)`, `zależnoś(ć)`, `program(ów)`, `karta(y)`,
`uwag(a)`, `cykl(i)`, `element(y)`, `wiersz(y)`, `plik(ów)`, `komentarz(y)`, `ostrzeżenie(a)` ×2,
`reguł(y)` ×2). Nawias to był sygnał, że autor **wiedział** o problemie i go ominął — dlatego
poszedł pierwszy. **Po naprawie klasa A = 0.**

| co zostaje | ile |
| --- | --- |
| klucze `{{count}} + rzeczownik` bez rodziny `_one/_few/_many/_other` | **296** |
| klucze, które JUŻ mają rodzinę mnogą (stan po dzisiejszej partii) | **361** |
| klucze z nawiasem RODZAJU (`Podpisał(a)`, `Zatwierdził(a)`, `Zgłosił(a)`, `utworzył(a)`, `zaktualizował(a)`, `Rozwiązał(a)`) | 6 — **NIE są defektem**, to poprawna polska konwencja; nie ruszać |

**Dlaczego martwe / czemu odłożone:** żaden z 296 nie jest widoczny na 12 ekranach zlecenia
„trzy rodziny". Zmiana dotyka dwóch plików zbiorczych (`pl` + `en` `translation.json`), a każdy
klucz wymaga decyzji o trzech formach — to partia mierzalna, nie doklejka.

**Co niosły wartościowego:** komplet jest policzalny i sprawdzalny jednym poleceniem, więc partia
ma twardą bramkę wejścia i wyjścia (296 → 0).

**Jak przywrócić / jak to zrobić:** skrypt pomiarowy, którym zmierzono te liczby, jest w raporcie
`docs/program/grafika/TRZY_RODZINY_20260902.md` (klasa A = regex nawiasu przy zmiennej,
klasa B = `{{count|value|totalItems}} + [a-ząćęłńóśźż]{3,}` bez rodzeństwa z sufiksem).
Kolejność naprawy sprawdzona dziś na 19 kluczach: (1) w `pl` zamień klucz na cztery
`_one/_few/_many/_other`, (2) w `en` na dwa `_one/_other`, (3) **sprawdź wołacza — i18next
pluralizuje WYŁĄCZNIE po zmiennej `count`**; wołacz przekazujący `{{totalItems}}`/`{{warnings}}`
musi dostać `count` (dwa takie były: `CalendarView.tsx`, `TemplateBuilder.tsx`).

**Trzeci mechanizm — jeden usunięty, dwa zostają.** `pluralizeWskaznik()` w
`dev-render/screens/results-zestawienia.tsx` (lokalna kopia reguły CLDR) została dziś zastąpiona
wywołaniem `liczebnik()`. Nadal żyją: `odmienNapiecia()` (`src/toolOutputs/buildSwotOutput.ts:203`)
i `polskaOdmianaKolumn()` (`src/components/assessment/drd/DRDMatrixReadOnly.tsx:55`).

---

## Grupa: kolumny węższe niż podłoga czytelności (wpis 2026-09-02, gałąź `grafika/trzy-rodziny-20260902`)

**Zmierzone: 180 kolumn w 76 plikach** (`src/` + `dev-render/`) deklaruje `width` poniżej
`FIT_MIN_COLUMN_WIDTH` (112 px) — rozkład: 82 × 110 px, 40 × 100 px, 34 × 90 px, 8 × 80 px,
4 × 70 px, 4 × 60 px oraz pojedyncze 18/26/44/48 px.

**Dlaczego NIE podniesione hurtem — decyzja, nie zaniechanie.** Kanon mówi wprost, w komentarzu
przy `FIT_MIN_COLUMN_WIDTH`: *„podłoga nigdy nie ROZPYCHA, tylko ogranicza kurczenie"*. Podniesienie
tych 180 kolumn do 112 px przepchnęłoby dziesiątki tabel ponad realny obszar, `columnFit` skalowałby
je proporcjonalnie w dół, a skutkiem byłaby regresja na ekranach z akceptem właściciela. Cena jest
wyższa niż zysk.

**Co niosło wartościowego:** ta lista jest gotowym rankingiem ryzyka „tekst nie mieści się w
kolumnie" — kolumny 18/26/44/48 px to niemal na pewno defekty, a nie decyzje projektowe, i warto
je obejrzeć w pierwszej kolejności.

**Jak przywrócić:** pomiar jednym poleceniem —
`grep -rhoE "width: '[0-9]{1,3}px'" src/ dev-render/ | grep -oE '[0-9]+' | awk '$1<112' | sort -n | uniq -c`.
Po naprawie z 02.09 (warstwa `CELL_ELEMENT_WRAP_CLASS` w `FilterableTable`) wąska kolumna
**nie rozrywa już wyrazu** — najgorszym skutkiem jest zawinięcie na spacji, więc sprawa przestała
być pilna i może iść ekran po ekranie, z akceptem.

---

## Grupa: crimson w ikonie nagłówka karty ustawień (wpis 2026-09-02, gałąź `grafika/trzy-rodziny-20260902`)

`src/components/settings/shared/SettingsSection.tsx:141-142` rysuje kafelek ikony
(`bg-c-accent-soft` + `text-c-accent` = Harvard Crimson `#85182f`) w nagłówku **każdej** karty
ustawień — **23 pliki** modułu ustawień.

**Dlaczego odłożone, a nie naprawione razem z 21 ikonami podsekcji:** właściciel zgłosił „ikony
zwykłych sekcji (Zarządzanie zgodami, Retencja danych)" — czyli podnagłówki, i te są naprawione.
Kafelek nagłówka KARTY to element marki stosowany konsekwentnie w całym module; jego zdjęcie to
restyling, którego nikt nie zlecił (REGUŁA NR 16 — reguła dopuszcza stan zastany czy nakazuje
zmianę?). To jest pytanie „podoba się / nie podoba" na zrzucie, czyli pytanie do właściciela.

**Co niesie wartościowego:** jeśli właściciel powie „zdjąć", naprawa to DWIE linie w jednym
wspólnym pliku i obejmuje wszystkie 23 karty naraz — tanio i bez ryzyka rozjazdu.

**Jak przywrócić / gdzie patrzeć:** zrzut `evidence/grafika/217-trzy-rodziny/ustawienia-dane-prywatnosc__PO__light.png`,
lewy górny róg karty „Kontrola danych" — to jedyna czerwień, jaka na tym ekranie została.

---

## Grupa: odmiana jednostki przy liczbie („1 dzień" vs „1 dni") — wpis 2026-09-02, gałąź `grafika/trzy-rodziny-20260902`

**Zrobione dzisiaj (nie odkładam):** separator. Jednostka będąca SŁOWEM dostaje spację
(`8 dni`, `120 zł`), jednostka będąca SYMBOLEM przykleja się (`74%`, `20°`). Wspólny pomocnik
`src/utils/jednostka.ts` + test z dowodem mutacyjnym na OBU gałęziach reguły.

**Co ZOSTAJE i dlaczego to NIE jest zaniechanie.** Przy wartości `1` poprawne jest „1 dzień",
a nie „1 dni". Separator tego nie załatwi i **nie powinien**: jednostka przychodzi z danych jako
GOTOWY NAPIS w jednym polu `unit: 'dni'`. Odmiana wymaga trzech form (`dzień · dni · dni`),
czyli **zmiany kontraktu wskaźnika**, a nie poprawki w prezenterze. Zrobienie tego po stronie
prezentera oznaczałoby zgadywanie odmiany ze skróconego napisu — dokładnie ten rodzaj
„inteligentnej" heurystyki, który w tym repozytorium już raz wyprodukował `Wiśniewski` z
`wisniewski` (się nie da) i `1 pozycji` zamiast `1 pozycja`.

**Skala:** dziś w danych demo Rolloutu jest JEDEN wskaźnik z jednostką-słowem
(`Czas realizacji zamówienia`, `unit: 'dni'`). Pozostałe mają `%`, którego problem nie dotyczy.
Defekt odmiany zobaczy się dopiero, gdy któryś wskaźnik osiągnie wartość `1`.

**Jak to zrobić, gdy przyjdzie kolej — droga sprawdzona dziś na 19 kluczach i18n:**
zamienić `unit: string` na `unit: string | [string, string, string]` w kontrakcie wskaźnika
(`RolloutTab.tsx` typ `unit` linia 64 + odpowiadające pole w danych), a w `zJednostka()` dodać
gałąź: tablica trzech form → `liczebnik(wartosc, formy)` (`src/utils/liczebnik.ts`, już istnieje
i ma testy). Napis pojedynczy dalej działa bez zmian — zgodność wsteczna dla wszystkich
wskaźników z `%`. **Nie wprowadzać czwartego mechanizmu odmiany** (są już: `_one/_few/_many`
i18next, `liczebnik()`, oraz dwie stare lokalne funkcje wymienione we wpisie z 30.08).

---

## Grupa: nazwiska w module Wyniki — ZATRZYMANE PRZED NAPRAWĄ (wpis 2026-09-02)

**Zlecenie brzmiało:** „katalog osób w źródle danych Wyników plus prezentery, które go czytają —
tak samo jak w Realizacji". **Nie wykonałem i uważam, że wykonać nie należy.** Trzy pomiary,
każdy osobno wystarczający, żeby się zatrzymać:

**1. Źródeł jest 49, nie trzy.** Reguła zatrzymania ze zlecenia („jeśli źródeł jest więcej niż
trzy — zatrzymaj się") uruchomiła się z zapasem. Pomiar:
`grep -rlE "'user-(anna|marek|piotr|katarzyna|tomasz|…)[a-z-]*'"` → **49 plików, 22 różne
identyfikatory osób**. Katalog per moduł oznaczałby kilkanaście katalogów i tę samą osobę pod
różnymi nazwiskami w różnych modułach — stan GORSZY niż dzisiejszy.

**2. Wszystkie 49 plików leży w `dev-render/`, ZERO w `src/`.** To nie są dane produktu, tylko
atrapy harnessu. W danych już dziś widać dryf tożsamości: `user-anna` (56×), `user-anna-kowalska`
(50×), `user-anna-kowalczyk` (10×), `user-anna-demo` (9×), `user-anna-k` (1×) — pięć
identyfikatorów, których przypisanie do osób jest DECYZJĄ TREŚCIOWĄ, nie techniczną.

**3. ★ Moduł Wyniki MA JUŻ POPRAWNY MECHANIZM — i nie jest nim katalog atrap.**
`resolveMemberName` (`ResultsAttentionPage.tsx:112`, `ResultsRoiHub.tsx:275`) mapuje identyfikator
na nazwisko z **REALNEJ listy członków organizacji** (`OrganizationApi.getOrganizationMembers`,
dane już pobrane, bez nowego wywołania serwera) i uczciwie spada do skróconego identyfikatora,
gdy członka nie ma. Komentarz przy `attentionPresenters.tsx:83` opisuje wprost tę samą lukę
„surowe id zamiast nazwy". **To jest rodzeństwo z gotową poprawką** — dokładnie ten trop, który
dziś zadziałał już dwa razy. Właściwą naprawą jest PODPIĘCIE istniejącego resolvera do
prezenterów OKR, nie zbudowanie obok niego katalogu atrap.

**Dlaczego mimo to nie podpiąłem tego dzisiaj — powód, który jest ważniejszy od powyższych:**
`OkrObjectivesView.tsx` nie ma `currentOrganization` (0 wystąpień), więc podpięcie wymaga
przeprowadzenia resolvera przez drzewo widoków OKR. A **harness OKR nie atrapuje
`getOrganizationMembers`** — sprawdzone: w `results-vnext-okr-objectives.tsx` i
`results-vnext-okr-registry.tsx` nie ma ani jednego mocka tego wywołania. Skutek: poprawnie
wykonana naprawa **nie zmieniłaby nic na zrzucie** — resolver spadłby do skróconego
identyfikatora, właściciel zobaczyłby to samo, a ja zameldowałbym naprawę bez dowodu w obrazie.
To jest kształt „zamknięte przez wygaszenie": zielono, bo kontekst nie dociera.

**Zasięg, gdy przyjdzie kolej:** 29 plików w `ResultsVNext` dotyka `ownerUserId`; **6 miejsc
renderuje go surowo** jako komórkę właściciela (`okrObjectivePresenters.tsx:224`,
`okrKeyResultPresenters.tsx:214`, `OkrSetOverviewView.tsx:105` + 3 dalsze).

**Kolejność naprawy, gdy zapadnie decyzja:** (1) dopisz mock `getOrganizationMembers` do dwóch
ekranów harnessu OKR — inaczej nie ma czym udowodnić; (2) pokaż, że ekran psuje się WIDOCZNIE
(nazwiska nadal surowe mimo mocka) — dopiero to dowodzi, że defekt jest w prezenterze;
(3) przeprowadź `resolveMemberName` do widoków OKR wzorem `ResultsAttentionPage`;
(4) zrzut PO. Kolejność „najpierw atrapa, potem kod" — reguła 21.

**Decyzja projektowa do podjęcia przez nadzorcę/właściciela:** czy `executionReviewPeople`
(katalog 8 osób, który zrobiłem dziś dla Realizacji, bo tamten fixture nie ma listy członków
organizacji) ma się docelowo rozpuścić w jednym wspólnym katalogu atrap harnessu, czy zostać
lokalny. Nie rozstrzygam tego sam — to dotyka wszystkich 49 plików.

---

## Grupa: dryf identyfikatorów osób w stanowisku podglądowym (wpis 2026-09-02, gałąź `grafika/trzy-rodziny-20260902`)

**Zmierzone:** **22 różne identyfikatory osób w 49 plikach `dev-render/`** (zero w `src/` — to
atrapy, nie dane produktu). Ta sama osoba żyje pod wieloma identyfikatorami naraz:

| identyfikator | wystąpień |
| --- | --- |
| `user-anna` | 56 |
| `user-anna-kowalska` | 50 |
| `user-anna-kowalczyk` | 10 |
| `user-anna-demo` | 9 |
| `user-anna-k` | 1 |
| `user-marek` | 48 |
| `user-marek-zielinski` | 13 |
| `user-marek-demo` | 3 |
| `user-marek-n` | 1 |

**Właściwym wyjściem jest JEDEN wspólny zestaw osób dla całego `dev-render`** (identyfikator,
imię i nazwisko z polskimi znakami, e-mail, rola), z którego korzystają wszystkie atrapy —
a nie prostowanie 22 wariantów po jednym, bo to tylko przesunęłoby dryf, zamiast go usunąć.

**To jest decyzja projektowa i nie wykonuję jej w tym dyżurze.** Dotyka 49 plików, a przypisanie
„kim jest `user-anna-k`" jest rozstrzygnięciem TREŚCIOWYM (czy Kowalska i Kowalczyk to ta sama
osoba, czy dwie), nie technicznym. Wymaga decyzji nadzorcy albo właściciela.

**Co już jest gotowe i można na tym budować:** dwa lokalne zestawy zrobione dziś — `executionReviewPeople`
(8 osób, Realizacja) i atrapa listy członków organizacji w dwóch ekranach OKR (4 osoby, kształt
serwera `userId · email · name · role · status`). Wspólny zestaw powinien wchłonąć oba, a nie
stanąć obok nich jako trzeci.

## 2026-09-02 · TOR FUNKCJI: pięć z dziewięciu ekranów „zbudowanych i niepodłączonych" ODŁOŻONE

Dopisek toru funkcji (nie edytuję niczyjego wpisu wyżej). Podstawa: zgłoszenie
grafiki `ZGLOSZENIA_DO_TORU_FUNKCJI.md` §„DWANAŚCIE EKRANÓW…"; pełny pomiar
czterech warstw: `docs/program/funkcje/WOLACZE_20260902.md`.

Grafika słusznie zastrzegła: *„wpis »zero wołaczy« mówi, że nikt go nie
renderuje — nie mówi, że powinien"*. Dla pięciu z dziewięciu odpowiedź brzmi:
nie powinien — z pięciu różnych powodów.

| Ekran / plik | Dlaczego odłożony | Co niósł wartościowego | Jak przywrócić |
| --- | --- | --- | --- |
| `teresa-chipy-panel-artefaktu` — `src/components/shared/NModeLayout/AIConsultantPanel.tsx` | **świadomie wycofany**: odpięty 2026-09-01 decyzją właściciela „JEDNA TERESA, W SWOIM OKNIE" (`InitiativeDocumentView.tsx:160-168`, `:9700-9707`; wcześniej to samo w `InsightViewer`/D17). Podłączenie cofnęłoby decyzję sprzed jednego dnia. | Powłoka panelu z pięciopunktowym menu akcji AI nad `UnifiedChatPanel` — gotowy wzorzec, gdyby kiedyś wrócił czat osadzony w artefakcie. | Tylko przez odwrócenie decyzji właściciela o jednej Teresie. Dzisiejsza droga: `TeresaEntryButton` → dokowane okno Teresy. |
| `unified-create-launcher` — `src/components/shared/UnifiedCreateLauncher.tsx` | **za flagą bez decyzji + zakres**: flaga `isUnifiedCreateLauncherEnabled()` jest domyślnie ON od 2026-07-14, ale nikt jej nie odczytuje. Podłączenie = podmiana `primaryCta` w SZEŚCIU żywych ścieżkach tworzenia naraz (Inicjatywy `InitiativesHub.tsx:2427`, Spotkania `MeetingHub.tsx:848`, Audyty `AuditsMethodHub.tsx:489`, …) — wprost zakazane przez CLAUDE.md #9. | Jeden krok wyboru rodzaju obiektu (Wniosek/Inicjatywa/Decyzja) delegujący do NIEZMIENIONYCH generatorów — bezpieczna Faza 0 planu `Harvard/wdrozenie-100/_PLAN_I1-I3_UNIFIKACJA_KREATOROW.md`. | Faza 1+ tego planu, JEDEN moduł na raz, każdy z osobnym akceptem na zrzucie. Nie hurtem. |
| `assessment-initiatives-table` — `src/components/assessment/InitiativesTable.tsx` | **duplikat istniejącej drogi**: zakładka „Inicjatywy" w `AssessmentHub.tsx:2408` renderuje kanoniczny `StandardTable` nad tymi samymi danymi; trzeci ślad tej listy żyje w `InitiativesManagementPanel`. | Osobny, samodzielny komponent tabeli inicjatyw z oceny (kanon `StandardTable`) — kandydat, gdyby ktoś chciał ZASTĄPIĆ wklejoną tabelę w hubie wspólnym komponentem. | Nie jako druga droga, tylko jako refaktor: podmienić wklejoną tabelę w `AssessmentHub` na ten komponent, bez nowej pozycji menu. |
| `assessment-reports-table` — `src/components/assessment/ReportsTable.tsx` | **duplikat istniejącej drogi**: zakładka „Raporty" w `AssessmentHub.tsx:2288` czyta ten sam `Api.get('/report-builder')` własnym `StandardTable`. | j.w. — samodzielna, kanoniczna tabela raportów z importem (`ImportReportModal`). | j.w. — refaktor podmienny, nie nowe wejście. |
| `audyty-drd-report` — `src/components/Audit/AuditsHub.tsx` | **martwy poprzednik, udokumentowany**: `AuditsMethodHub.tsx:10` — *„Dawny równoległy `AuditsHub` nad `/api/audit` nie jest już mounted; jego write endpoints pozostają wycofane po stronie serwera"*. Zapis zwraca 410 (`audit-programs.routes.ts:45-84`). | Zakładka „Raporty DRD" (za `isDrdReportEnabled`, OFF) — sama zdolność żyje dalej: `DRDAuditReportView` MA własną trasę w `AppRoutes.tsx` (`DRDAuditReportRoute`). | Nie reanimować pliku. Odzyskanie funkcji idzie przez `AuditsMethodHub` (zakładka `reports`/`findings`). |
| `rn-g3-class-l-record-shell` — `src/components/shared/states/TeresaState.tsx` (`TeresaUnavailableNotice`) | **konflikt kanonu, nie brak przewodu**: w repo żyją DWA sprzeczne wzorce tego samego stanu — informacyjny `TeresaUnavailableNotice` (`role="status"`, świadomie bez ostrzeżenia) i JUŻ RENDEROWANY `TeresaUnavailableBanner` (`ResultsVNext/teresa/`, `role="alert"`, `c-warning`, montowany w `TeresaProposalPanel.tsx:319`). Rozlanie któregokolwiek przed wyborem pogłębi rozjazd. | Spójny, nieostrzegawczy stan „AI niedostępna, praca ręczna działa dalej" — gotowy do rolloutu w miejscu jednorazowych toastów (`DecisionsPanelContent.tsx:1150,1209`, `DecisionPreviewPanel.tsx:683,702`). | Najpierw rozstrzygnięcie toru grafiki/właściciela: KTÓRY z dwóch wzorców jest kanonem. Potem rollout jedną falą, z akceptem na zrzucie. |

**Uwaga do samego ekranu harnessu `rn-g3-class-l-record-shell`:** jego nagłówek
mówi wprost, że jest SYNTETYCZNĄ demonstracją przepisu powłoki klasy L, a nie
hostem realnego komponentu („żaden z trzech torów domenowych KPI/ROI/OKR nie
zbudował jeszcze pełnostronicowego widoku rekordu"). To ta sama sytuacja co
`results-zestawienia` wyżej — ekran istnieje w przyrządzie, produkt go nie ma.
Zgłoszenie „zero wołaczy" dla `TeresaUnavailableNotice` jest prawdziwe, ale
dotyczy JEDNEGO klocka z tej demonstracji, nie całej powłoki.
