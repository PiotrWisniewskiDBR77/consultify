# INWENTARZ: narzędzia Word · Excel · PowerPoint + generatory szablonów · 2026-07-27

> Zlecenie Piotra (4:50 rano): „zacznij od poszukania zrealizowanych projektów i zinwentaryzowania,
> żebyśmy nie budowali czegoś, co już jest wybudowane". 3 audyty read-only na tipie demo
> `dee77b18f0`. Pełne raporty w transkrypcie sesji; to jest SSOT syntezy i werdyktów.

## WERDYKT NACZELNY
**Wszystkie trzy silniki ISTNIEJĄ i są dojrzałe. Niczego nie budujemy od zera.**
Problem produktu to nie brak silników, tylko: (1) za dużo równoległych WEJŚĆ do nich,
(2) niedokończone migracje (szablony, eksporty), (3) martwy kod mylący ludzi i agentów,
(4) kilka ekranów „z lat 90" psujących odbiór całości.

## MAPA KANONÓW (na tym budujemy — zakaz dublowania)

| Format | Silnik generacji | Edytor | Generator szablonów |
|---|---|---|---|
| **PowerPoint** | `presentationGeneratorService` (+narrativeEngine) | **DeckBuilder** (kolaboracja live, wersje, quality gates) | ★ **Architekt szablonów prezentacji** (`PresentationTemplateArchitectView`) — TEN, który Piotr pamięta jako „zajebisty" (statusy draft→approved→deprecated, briefing per slajd, sylwetki; budowany 22-23.07). Wejście: Szablony → „New template" |
| **Word** | Document Studio / wave5 (`documentStudioService`) | **DocumentTipTapEditor** (prawdziwy WYSIWYG, QA-gate, wersje, audiencje, brand voice) | Architekt szablonów dokumentów (`DocumentStudioTemplateArchitectView`) — parytet z deckowym |
| **Excel** | `WorkbookGeneratorService` (5-fazowy pipeline) + **WorkbookBuilder** (ExcelJS 5/5: formuły przeżywają eksport, walidacje, freeze) | podgląd siatki (edycji komórek BRAK — świadomie, MVP wg kanonu) | 7 modeli parametrycznych (budżet/DCF/break-even/cashflow/unit-econ/amortyzacja/P&L) — rejestr kodowy; registry szablonów USERA brak (D4, świadomie) |

**Wejście z AI = Teresa** (dyrektywa Piotra): czat → pipeline → silnik → edytor. Działa dla
wszystkich 3 formatów (Excel: dopasowanie 7/7 modeli z czatu po naprawie 26.07).

## DRUGI SILNIK WORDA — jedyna duża decyzja architektoniczna
**Report Builder** (`/reports/builder`, ReportEditor): drugi żywy silnik dokumentów. Mocne strony,
których Document Studio NIE ma: generacja AI per typ sekcji (12+ promptów), RAG na książce DRD,
bloki analityczne (matryce/roadmapy/heatmapy), agent czatu z propozycją outline'u, eksport PPTX.
Słabość dyskwalifikująca jako kanon: edycja treści to TEXTAREA (nie WYSIWYG).
**Kierunek (zgodny z decyzją Piotra „raport = dokument Word"):** Document Studio = jedyny kanon
dokumentu; zdolności Report Buildera (RAG, sekcje-typy, bloki analityczne) WCHŁANIAMY do DS;
RB UI wygaszamy po migracji. Koncept unifikacji = sesja Fable w tym tygodniu; implementacja
(L/XL) po urodzinach — do tego czasu oba działają poprawnie obok siebie (shimy P0 z 27.07).

## DO SCALENIA (duplikaty wejść/warstw — sprzątanie, nie budowa)
1. **PresentationWizard** (`/presentations/wizard`, osierocony z nawigacji) → scalić jako tryb
   „Z szablonu" wejścia `/prezentacje`; ten sam endpoint co Teresa.
2. **4 niezależne implementacje eksportu .docx** → jeden `documentDocxRenderer` (wzór: już
   zrobione dla Initiative-materialize i bundle).
3. **Zapis szablonów z Biblioteki** nadal trafia do tabeli LEGACY (`report_builder_templates`)
   mimo spisanego kanonu → przestawić na `document_studio_templates` (S/M, domyka migrację).
4. **ExceleParametricTemplates montowany w 2 miejscach** → jeden montaż przed redesignem.
5. **Sheets w bibliotece**: 61/75 „arkuszy" to płaskie eksporty Table Studio nieodróżnialne od
   modeli finansowych → badge/rozróżnienie w liście (wyjaśnia wrażenie „tabel o niczym").

## DO WYGASZENIA (martwe/porzucone — potwierdzone zero wejść)
- `PresentationsHub.tsx` (stary V3-J02) + `DeckTemplateGallery.tsx` — zero tras; mountują DRUGĄ
  kopię Architekta.
- **Presentation Studio** (`/presentation-studio`) — porzucony sprint z maja (nakładka
  preview+approval na ten sam silnik), zero linków w UI. Wygasić front; backend może zostać
  jako fundament pod przyszły „approval gate".
- `WordyView.tsx` + lane wordy pipeline (redirect i tak omija) — z nienaprawionym bugiem w środku.
- `ReportBuilderWizard`, `ReportBuilderCommentPanel`, `DocumentStudioEditorPanel`(+dialog),
  `InlineEditor`, `documentTeresaIntent` (podłączyć albo usunąć), endpoint
  `POST /workbook/generate-and-download` (0 callerów).
- Martwy placeholder „AI Editor" w prawym panelu Document Studio (statyczna atrapa).

## DŁUGI FUNKCJONALNE (żywe pułapki znalezione przy okazji)
- **Rejestracja dokumentu w bibliotece jest fail-soft bez retry** — dokument może powstać
  i nigdy nie pojawić się w My Work/Materiałach. [M]
- **Kickoff do Teresy ginie na /prezentacje** (embedded czat nie konsumuje chatKickoffMessage) —
  utajona pułapka pod przyszłe przyciski „Stwórz prezentację z X". [S/M]
- **chartImages w Excelu**: mechanizm istnieje, 0% użycia (żaden szablon, prompt milczy) —
  dopiąć do 2-3 modeli finansowych albo jawnie oznaczyć „na później". [M]
- Konflikt flag ff_tpl_editor/ff_deck_architect (kod ON vs D6 OFF) — rozstrzygnięty PRAKTYCZNIE
  przez przeniesienie architektów pod „New template" (26.07); D6 uznać za wykonane inaczej,
  odnotować w decyzjach.

## „LATA 90" — do redesignu (Gamma/Airtable + „lekkie AI-app")
1. **DataSourcesTabContent** — surowy textarea z JSON-em, hardcoded blue/amber/slate, goła tabelka. NAJPILNIEJSZE.
2. **Formularz parametrów Excela** — 22 pola naraz; progresywne ujawnianie + podgląd wpływu.
3. Chipy/i18n w Architekcie prezentacji (EN resztki wg ODB-DECK-02).

## CO REALNIE BRAKUJE (dopiero po sprzątnięciu powyższego)
- Edycja komórek arkusza w aplikacji (świadomy brak MVP — decyzja kiedy/czy).
- Workbook template registry usera (D4) — szablony Excela tworzone przez użytkownika.
- Miniatury/galeria szablonów w Bibliotece (dziś tabela nazw; sylwetki już istnieją — reuse).
- Wchłonięcie zdolności RB do DS (patrz decyzja wyżej).
