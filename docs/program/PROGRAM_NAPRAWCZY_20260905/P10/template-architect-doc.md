# Architekt wzorca dokumentu (`template-architect-doc`)

**Status:** PROPOZYCJA — do słowa właściciela. Karta #58 inwentarza, moduł `11_MATERIALS`.
Bliźniacza karta: `template-architect-deck.md` (#59, Prezentacja) — **klon jeden do drugiego**
(komentarz nagłówkowy pliku deck: „Klon wzorca `DocumentStudio/DocumentStudioTemplateArchitectView.tsx`
dostosowany do decka") — ten plik niesie pełną analizę, deck-owy dostaje tylko różnice.

## §0. Tożsamość

- Nazwa PL: **Architekt wzorca dokumentu** — warsztat AI do tworzenia/zatwierdzania/wersjonowania
  wzorców dokumentów (Mode 2 Document Studio: „Draft a new template from a brief" → przegląd →
  zatwierdź/wycofaj, bramkujące użycie w Mode 3).
- Moduł: `11_MATERIALS`. Archetyp: nominalnie **B**, faktycznie **narzędzie/wizard bez powłoki**
  (patrz niżej) — bliżej „ekranu generatora" niż karty z tożsamością rekordu.
- Otwarcie: `DocumentStudioView.tsx:1046` — **zakładka WEWNĄTRZ Document Studio**
  (`activeTab === 'templates'`, ta sama trasa `/document-studio`, różny tylko stan `Tab`), NIE
  osobna trasa z `:id`.
- Komponent: `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx:1`
  (1381 linii). **Zero importów `ArtifactRightPanel`/`ExecutiveModuleShell`/`RightRail`/
  `NModeShell`/`StandardArtifactShell`** — potwierdzone grepem, zero trafień w całym pliku.
  To jest gołe drzewo: `FilterableTable` (lista wzorców, komponent STANDARDOWY z
  `@/components/shared/ModuleHub` — poprawne użycie, nie bespoke) + panel edycji struktury po
  prawej, złożone ręcznie w divach, bez żadnej powłoki kanonu.
- **Tożsamość rekordu**: `selectedTemplateId` to `useState` lokalny (`:160`), NIE parametr URL —
  identyczna luka jak `template.md` (#57): nie da się wysłać linku do konkretnego draftu wzorca.

## §1–§3. Sekcje / prawy panel / Menu 5 — nie istnieją w formie kanonu

Brak wszystkiego: brak katalogu sekcji (K1 ✗), brak `ArtifactRightPanel` więc brak Akcji/
Właściwości-tabeli/Powiązań/Źródeł/Komentarzy/Historii w KSZTAŁCIE kanonu (K6–K11 wszystkie ✗ —
funkcjonalnie odpowiedniki mogą istnieć jako custom divy, ale nie w standardowym komponencie),
brak Menu 5 (K12 ✗).

## §4. AI

Warsztat SAM W SOBIE jest „generatorem z AI" (`planDocumentStudioTemplate` — `POST` do brief→
draft), ale to nie jest `PracujZAI`/„Analizuj z AI" kanonu — to jednorazowy generator w formularzu
briefu, nie trzy-pozycyjne menu na gotowym obiekcie. Governance (approve/deprecate/lineage/audit)
to ODDZIELNY ekran SuperAdmin (`PresentationTemplateGovernanceView.tsx` dla deck-owego bliźniaka —
analogiczny prawdopodobnie istnieje dla dokumentu, nie zweryfikowano w tej partii). `template`/
`template-architect-doc` poza `cardAnalysisRubric.ts`/`registry.ts` (K21 ✗, K24 ✗).

## §5. Czytelność

Nie zmierzone szczegółowo (brak zrzutu, brak czasu w budżecie tej partii na pełny przegląd
1381 linii pod kątem `primary-[0-9]`/i18n). Import `ColorPatternPicker`/`useBrandKitColors` sugeruje
zgodność z systemem motywów org (osobno od kolorów UI).

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak |
| K6–K11 prawy panel kanonu | ✗ całość | zero importu `ArtifactRightPanel` |
| K12 Menu 5 | ✗ | brak |
| K21 Pracuj z AI | ✗ | generator briefu jednorazowy, nie kanon |
| K24 AI per typ | ✗ | brak wpisu |
| **Tożsamość rekordu** | **✗** | `selectedTemplateId` to stan lokalny, nie URL |
| K30 zrzut żywy | **brak** | nie zmierzone w tej partii |

## §7. Luki → naprawa

To narzędzie jest dalej od kanonu niż jakakolwiek inna karta tej partii — brak POWŁOKI w ogóle,
nie tylko brak pojedynczych sekcji. Rekomendacja: **nie łatać punktowo** (dodanie
`ArtifactRightPanel` do 1381-liniowego pliku bez powłoki-kontenera to praca rzędu przepisania
ekranu), tylko potraktować jako kandydata do przeniesienia na `ExecutiveModuleShell` wspólny z
`TemplateBuilderShell.tsx` (ten sam wzorzec co `template.md` #57 — po co DWIE różne architektury
dla „edycji wzorca dokumentu" i „tworzenia wzorca dokumentu z AI"?). **Do decyzji właściciela**:
czy `template-architect-doc` powinien w ogóle być osobną kartą N, czy Mode 2 Document Studio to
raczej krok WEWNĄTRZ przepływu tworzenia wzorca (`template`), nie osobny obiekt. Rozmiar: ocena
architektoniczna, nie kosmetyka — poza możliwościami tej partii dokumentacyjnej.

**STOP:** brak zrzutu żywego (K30) i brak pełnego przeglądu czytelności (K17/K25) — czas budżetu
tej partii poszedł w priorytecie do dokumentu/prezentacji/arkusza/sejfu. Przepis: otworzyć
`/document-studio?tab=templates` na żywo, zrzut 1440 jasny z rozwiniętym panelem edycji struktury.
