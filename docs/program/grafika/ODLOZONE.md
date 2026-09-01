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
