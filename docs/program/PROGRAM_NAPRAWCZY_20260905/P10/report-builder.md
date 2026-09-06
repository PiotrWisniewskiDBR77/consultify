# Raport (kreator) — `report-builder`

**Status:** PROPOZYCJA — do słowa właściciela. Karta #61 inwentarza, moduł `11_MATERIALS`.
Klasyfikacja wg testu z `_wzorzec-raport-dokument.md`: **JEST kartą B** (tożsamość rekordu
prawdziwa — patrz §0), ale powłoka jest w 100% autorska, nie kanon.

## §0. Tożsamość

- Nazwa PL: **Raport (kreator)**. Moduł: `11_MATERIALS`. Archetyp: **B — Dokument**.
- Trasa: `/reports/builder/:reportId` (`ROUTES.REPORTS.BUILDER`, `AppRoutes.tsx:2620`) — realna
  tożsamość rekordu: `report.id`/`reportId` z URL, `reportIdForActions` (`ReportEditor.tsx:754`)
  steruje eksportem (`GET /api/report-builder/:reportId/export/:format`) i wczytaniem powiązań.
  Legacy alias `/reports-builder/:reportId` przekierowuje na kanoniczną trasę
  (`AppRoutes.tsx:2273`, `ReportsBuilderLegacyRedirect`).
- Kontener widoku: `src/views/ReportBuilderView.tsx:1` (602 linie) — komentarz nagłówkowy: „In V3,
  the library/list view lives in the unified 'Presentations' module (Reports & Presentations
  Hub). This route is kept as the editor/wizard surface for report creation and editing." Renderer
  właściwy: `src/components/ReportBuilder/ReportEditor/ReportEditor.tsx:1` (2815 linii).
- Powłoka: żadna ze standardu — zero importów `ArtifactRightPanel`/`ExecutiveModuleShell`/
  `NModeShell`/`StandardArtifactShell` w całym 2815-liniowym pliku (potwierdzone grepem, zero
  trafień). To jest bespoke edytor z własnym drzewem komponentów.

## §1. Sekcje

Treść generowana z wybranego źródła (Assessment/inne — `SourceSelectStep`), edytowana w
`ReportEditor`. Brak katalogu `KanonicznaKarta` (K1 nie spełnione).

## §2. Odpowiednik prawego panelu — dwa autorskie bloki, nie `ArtifactRightPanel`

| kanon (K6–K11) | odpowiednik w tym pliku | zgodność |
|---|---|---|
| Akcje | eksport (`downloadExport`, PDF/PPTX/DOCX, `:775-800`), guard „Save the report to enable export" gdy brak `reportId` | funkcjonalnie zgodne, forma inna niż sekcja „Akcje" panelu |
| Właściwości (**tabela**) | brak w ogóle — zero wystąpień „properties"/„Właściwości" w pliku | K7 nie istnieje nawet w formie niekanonicznej |
| Powiązania | `ReviewPanel` (status zatwierdzenia, `:904-910`) + „Użyte w (powiązania)" (`EmbeddedView`, `:912-931`, dane z `Api.getLinkGraphBacklinks({type:'report', id})`) | funkcjonalnie odpowiada K8, inna forma |
| Źródła i założenia | brak wprost — źródło raportu wybiera się raz przy tworzeniu (`SourceSelectStep`), nie jest wystawione jako sekcja odczytu | brak |
| Komentarze / Historia | nie znaleziono w przeglądzie tego pliku | brak (nie wykluczone gdzie indziej w 2815 liniach — nie potwierdzone w tej partii) |

Etykiety backlinków przetłumaczone PL: „Użyte w (powiązania)"/„Brak powiązań"
(`translation.json:41101-41103`, zweryfikowane) — K25 dla tego bloku spełnione.

## §3. Menu 5 i nawigacja

Brak Menu 5 kanonu. Tryb `isTemplateMode` przełącza edytor między raportem a wzorcem raportu
(inny obiekt, ten sam komponent — analogicznie do `template-architect-*`).

## §4. AI

Brak `PracujZAI`. `report-builder`/`report_template` poza `cardAnalysisRubric.ts`/`registry.ts`
(K21 nie spełnione, K24 nie spełnione). Biblioteka „Użyj wzorca"/„Klonuj"
(`ReportBuilderView.tsx`, komentarz „LIBRARY 'UŻYJ WZORCA' / 'KLONUJ' (report_template,
2026-07-26)") ma własny słownik komunikatów z angielskimi KLUCZAMI
(`LIBRARY_TEMPLATE_ERROR_MESSAGES`, `:31-38`) ale wartościami po polsku — to są stałe
programistyczne (kody błędów), nie literały UI, K25 nie dotyczy.

## §5. Czytelność

`grep -c "primary-[0-9]"` w `ReportEditor.tsx` = 0 (K17 spełnione, zmierzone bezpośrednio).

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | nie spełnione | brak |
| K6 Akcje | częściowo, forma inna | eksport + guard |
| K7 tabela Właściwości | nie spełnione, całkowity brak | zero wystąpień w pliku |
| K8 Powiązania | częściowo (backlinks), forma inna | `:912-931` |
| K9 Źródła i założenia | nie spełnione | brak sekcji odczytu |
| K10 Komentarze/Historia | nie spełnione (niepotwierdzone) | nie znaleziono w przeglądzie |
| K12 Menu 5 | nie spełnione | brak |
| K17 zero primary | spełnione | 0 trafień, zmierzone |
| K21 Pracuj z AI | nie spełnione | brak |
| K24 AI per typ | nie spełnione | brak wpisu |
| K25 i18n (blok backlinks) | spełnione | zweryfikowane w `translation.json` |
| Tożsamość rekordu | spełnione | `reportId` w URL, `GET`/eksport po id, trasa realna |
| K30 zrzut żywy | brak | nie zmierzone w tej partii |

## §7. Luki → naprawa

1. Zero tabeli Właściwości (K7) — dodać `ArtifactPropertiesTable` (Status/Typ raportu/Autor/
   Źródło/Utworzono/Zaktualizowano — pola już istnieją jako `templateMetaForPanel`,
   `:740-743`, tylko nie są wystawione jako odczyt). Rozmiar S–M, Sonnet.
2. Powiązania/Akcje w formie niekanonicznej — przenieść `ReviewPanel` + blok backlinków do
   `ArtifactRightPanel` (sekcje Akcje/Powiązania), zachowując dane 1:1. Rozmiar M, Sonnet.
3. Cała powłoka poza kanonem — to największa praca tej karty: 2815-liniowy plik bez
   `ExecutiveModuleShell`/`NModeShell` w ogóle. Przepisanie na wspólną powłokę to praca rzędu
   tygodnia, nie łatka — do decyzji właściciela, czy priorytetem jest ujednolicenie tej
   konkretnej karty, biorąc pod uwagę że lista/hub raportów i tak żyje w module Prezentacji
   (komentarz nagłówkowy pliku). Rozmiar L, Opus.

Otwarta kwestia: brak zrzutu żywego (K30) — nie zmierzono na żywo w tej partii; brak
potwierdzenia obecności/braku Komentarzy i Historii poza fragmentami przejrzanymi grepem
(2815 linii, nie czytane w całości). Przepis: otworzyć realny `/reports/builder/<reportId>`
DBR77, zrzut 1440.
