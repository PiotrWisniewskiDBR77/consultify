# HANDOFF — FALA C: polish (menu · nawigacja · grafika) — 2026-07-22
Wejście: `_HANDOFF_DOKUMENTY_2026-07-22.md`. Zadania z oceny PRZED (framework §4-9). plik:linia do potwierdzenia grepem. Reguła kanonu: listy = StandardTable/StandardModuleBar; artefakty = tokeny `c-*`, zero crimson-jako-dane; weryfikacja WZROKIEM (dev-render, oba motywy).

## MENU
- **3 tryby jawne na wejściu** (czysto/AI/template) — dziś wszędzie zlewają się w „AI generuje". Deck: „Start new" i szablon i tak idą przez pipeline AI (`PrezentacjeView.tsx:152-198`). Excel: tylko Start-new-AI + szablony-prompty, brak pustego arkusza. **Zadanie:** dodać jawny tryb „czysto/ręcznie" na wejściu każdego narzędzia. [M]
- **Deck M1:** brak [indeksu]; PRIMARY=„Prezentuj" powinno „Eksportuj". [S]
- **Powłoka SPEC-A** gdzie brak: `KimiWorkspaceShell` (Excel) bez `ArtifactRightPanel`/kebab. [M]

## NAWIGACJA
- **Deck ← powrót niepodłączony** (`DeckBuilder.tsx`, 0 wiring `onBack`). [S]
- **Deck panel prawy:** klucz `media` deklarowany (`DeckBuilderMelsRightRail.tsx:85`) a nieobsłużony w `rightRailPanels` (`DeckBuilder.tsx:1117-1163`) → pusty panel. [S]
- **Deck tryb prezentera martwy** (`PresentMode.tsx:76` nigdy nie wywoływany; `DeckBuilder` nie ustawia `'presenter'`). [S]
- **Excel split-brain:** `/excele` bez flagi = redirect na `/tabele` (`AppRoutes.tsx` ~1457); żaden sidebar nie linkuje `/excele`; router klasyfikuje `/excele` jako `AppView.TABELE` (`routeConfig.ts:770`). **Po akcepcie Piotra:** flaga `VITE_EXCELE_ENGINE_ENABLED` domyślnie ON (Railway var) + wpis w sidebarze (`menuConfig.ts`). ⚠ zmiana WIDOCZNA — wymaga akceptu na zrzucie. [S-M]

## GRAFIKA / KANON
- **Galerie szablonów łamią kanon:** `DeckTemplateGallery.tsx` i `PresentationTemplateGovernanceView.tsx:766` używają surowych `slate-*`/`navy-*`/gradientów zamiast `c-*`. [S]
- **Excel podgląd arkusza:** pokazuje tylko metadane (nazwa/kolumny/wiersze), brak cell-data/formuł — trzeba pobrać plik żeby zobaczyć (`KimiWorkspaceShell.tsx:484-572`, `workbook.routes.ts:241`). **Zadanie:** podgląd realnych komórek/formuł. [M]
- **Deck bramki jakości:** 4 z 5 (Styler/Critic/AudienceVariants/QA) martwe dla realnego decka — tylko premium-bundle. Podłączyć do ścieżki `/prezentacje` (poprawia grafikę+merytorykę). [M]

## P0 — STORAGE NIETRWAŁY (systemowy)
- Eksport decka na lokalnym dysku Railway (`presentationGeneratorService.ts:1873`, `process.cwd()/exports/presentations`) → ginie po redeployu. Ten sam wzorzec dotyka innych narzędzi (uploady obrazów). **Fix wspólny:** volume/S3-R2 raz dla wszystkich. [L, wymaga sekretu/decyzji]

## Kolejność Fali C
Polish idzie PO Fali A (merytoryka) i B (generatory) — to warstwa wykończenia do progu PO. Priorytet w Fali C: (1) 3 tryby jawne, (2) Deck nawigacja (powrót/panel), (3) /excele w sidebar (akcept), (4) kanon grafiki galerii, (5) podgląd arkusza, (6) storage P0 (osobny duży temat). Każde: dev-render oba motywy → zrzut → akcept.
