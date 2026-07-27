# SPIS MARTWYCH DO KASACJI — 2026-07-27

> Fala sprzątania 1a (robotnik, gałąź `chore/prezentacje-scalenie-wejsc`,
> worktree `/private/tmp/army-scal-wizard`, baza `origin/demo`).
> Źródło zlecenia: `Harvard/wdrozenie-100/_INWENTARZ_GENERATORY_3_FORMATY_2026-07-27.md`,
> sekcja "DO WYGASZENIA".
>
> **Ten plik jest DOWODEM dla Haiku-wykonawcy, NIE wykonaniem kasacji.** Każda
> pozycja ma świeży grep (2026-07-27, PO scaleniu wejść wizarda w tym samym
> commicie) — stan mógł się zmienić od czasu spisania inwentarza, więc każdy
> wpis został zweryfikowany od nowa, nie przepisany z inwentarza. Tam gdzie
> świeży grep zaprzeczył inwentarzowi (1 przypadek — `POST /artifact-runs/*`
> outputType `report`), werdykt jest ZOSTAW z wyjaśnieniem, nie automatyczne
> KASUJ.
>
> Metoda: `grep -rln` po literalnej nazwie symbolu/pliku w całym `src/` i
> `server/src/`, z wykluczeniem samego pliku i jego `__tests__`. Zero
> importerów = zero sposobu, żeby kod wykonał się w runtime (poza testem
> jednostkowym samego siebie).

---

## 1. `src/components/Presentations/PresentationsHub.tsx` (stary V3-J02)

**Dowód:**
```
$ grep -rn "from '@/components/Presentations/PresentationsHub'\|Presentations/PresentationsHub\"" src/
(brak wyników)
```
Żaden route w `src/routes/AppRoutes.tsx` nie montuje tego komponentu (kanoniczny
hub pod `/presentations` to `ReportsAndPresentationsHub.tsx` — inny plik, inny
katalog: `src/components/ReportsAndPresentations/`).

**Werdykt: KASUJ.**

**Zależności do usunięcia razem:**
- `src/components/Presentations/DeckTemplateGallery.tsx` (patrz punkt 2 —
  jedyny żywy importer to właśnie ten plik).
- Sprawdzić `src/components/Presentations/index.ts` (jeśli re-eksportuje
  `PresentationsHub`, usunąć linię eksportu razem z plikiem).

---

## 2. `src/components/Presentations/DeckTemplateGallery.tsx`

**Dowód:**
```
$ grep -rln "DeckTemplateGallery" src/ --include="*.tsx" --include="*.ts"
src/components/Presentations/DeckTemplateGallery.tsx        (definicja)
src/components/Presentations/PresentationsHub.tsx            (martwy, patrz #1)
src/services/presentationTemplateArchitect.ts                (TYLKO komentarz — "same envelope shape as DeckTemplateGallery.tsx's local unwrap", zero importu)
```
Jedyny realny importer (`PresentationsHub.tsx`) jest sam martwy (punkt 1) —
łańcuch zamknięty, zero drogi do runtime.

**Werdykt: KASUJ (razem z #1).**

**Uwaga:** `DeckTemplateGallery.onSelectTemplate` przekazywał RAW id rekordu
`presentation_templates` (`tmpl.id`) jako `templateId` — inna przestrzeń id niż
`templateArtifactId` (indeks artefaktów) używana wszędzie indziej po 26.07.
To był jedyny producent tego konkretnego kształtu linku do
`/presentations/wizard?templateId=...`; po kasacji nikt już go nie generuje.

---

## 3. `src/components/AIChat/KimiWorkspace/WordyView.tsx` + tor `lane==='wordy'` w `useKimiArtifactPipeline.ts`

**Dowód (komponent):**
```
$ grep -rn "WordyView" src/ server/src/ --include="*.tsx" --include="*.ts" \
    | grep -v "WordyView.tsx:\|index.ts:14:\|__tests__"
src/components/ReportsAndPresentations/artifactNavigation.ts:71  (komentarz)
src/routes/AppRoutes.tsx:222                                      (komentarz)
src/routes/AppRoutes.tsx:1516                                     (komentarz)
```
`src/components/AIChat/KimiWorkspace/index.ts:14` eksportuje `WordyView` z
barrela, ale **nic w repo nie importuje `{ WordyView }`** — potwierdzone
osobnym gerpem po `^import.*WordyView`. `/wordy` (route) jest dziś redirect-only
do `/document-studio` (`AppRoutes.tsx` linia ~1512-1521) — trasa, która kiedyś
montowała ten komponent, go już nie montuje.

**Dowód (tor `lane==='wordy'` w hooku):**
```
$ grep -rn "useKimiArtifactPipeline(" src/ --include="*.tsx" --include="*.ts" \
    | grep -v "useKimiArtifactPipeline.ts:\|__tests__"
PrezentacjeView.tsx:144   useKimiArtifactPipeline('prezentacje')
TabeleView.tsx:65         useKimiArtifactPipeline('tabele')
ExceleView.tsx:56         useKimiArtifactPipeline('excele')
WordyView.tsx:37          useKimiArtifactPipeline('wordy')   ← JEDYNY caller lane='wordy', a WordyView sam jest martwy
```
Cały kod w `useKimiArtifactPipeline.ts` rozgałęziony na `lane === 'wordy'`
(linie ~352, 354, 435, 580-597, 783, 837, 1168-1170, 1197-1198 w stanie na
2026-07-27) jest nieosiągalny — jedyna droga do niego prowadzi przez martwy
komponent.

**Werdykt: KASUJ** (komponent) **+ WYTNIJ gałęzie `lane==='wordy'`** (hook —
NIE cały hook, bo `prezentacje`/`tabele`/`excele` są żywe).

**Zależności do usunięcia razem:**
- Eksport `WordyView` z `src/components/AIChat/KimiWorkspace/index.ts:14`.
- Typ `KimiPipelineLane` (czy jak się nazywa union type w `useKimiArtifactPipeline.ts`)
  — usunąć `'wordy'` z unii PO wycięciu gałęzi kodu, nie przed (inaczej tsc
  krzyknie na nieużywany case gdzie indziej najpierw).
- Sprawdzić `melsPrezentacjeFlag.ts`/`melsTabeleFlag.ts` (sąsiednie flagi) —
  NIE dotyczą wordy, zostają bez zmian.

---

## 4. `POST /api/artifact-runs/*` z `outputType: 'report'` — ★ ZOSTAW (inwentarz się zdezaktualizował)

**Dowód:**
```
$ grep -rn "artifact-runs" src/ --include="*.tsx" --include="*.ts" | grep -v __tests__
src/services/api/artifactRuns.ts:113   const ARTIFACT_RUNS_BASE = '/api/artifact-runs';
```
`ArtifactRunsApi` (ten plik) jest importowany przez `src/hooks/useV8ArtifactRuns.ts`,
który z kolei jest importowany przez:
```
$ grep -rln "useV8ArtifactRuns" src/ --include="*.tsx" --include="*.ts" | grep -v __tests__
src/components/AIChat/V8ArtifactRunControl.tsx
src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts
```
`V8ArtifactRunControl.tsx` ma `outputType: 'report'` jako **żywą, wybieralną
opcję** w UI (etykieta "Document", linie 61/160/179/236 w stanie na 2026-07-27)
i woła `ArtifactRunsApi.createFromChat({ requestedOutputType: 'report', ... })`
wprost z czatu. Ten komponent jest zamontowany w:
```
$ grep -rln "V8ArtifactRunControl" src/ --include="*.tsx" | grep -v __tests__
src/components/AIChat/UnifiedChatPanel.tsx
src/components/AIChat/WorkCanvas/WorkCanvasShell.tsx
```
`UnifiedChatPanel` jest z kolei zamontowany w `SplitLayout.tsx` i
`AIConsultantPanel.tsx` — czyli w GŁÓWNEJ, żywej powłoce czatu aplikacji.

**Werdykt: ZOSTAW.** Ta ścieżka NIE jest tożsama z `WordyView`/lane `wordy` —
to niezależny, żywy tor: "Stwórz dokument z czatu" → `POST
/artifact-runs/from-chat` (`outputType:'report'`) → materializacja →
`report_builder_reports` (originRuntime `'report'`, otwiera się pod
`/reports/builder/{id}` — patrz `buildActionTargetPayload` w
`artifacts.routes.ts`). To jest właśnie "DRUGI SILNIK WORDA" (Report Builder)
opisany w inwentarzu jako żywy-ale-do-wygaszenia-PO-migracji, nie martwy kod.
**Inwentarz z 27.07 rano pomylił to z torem WordyView** (oba historycznie
prowadziły do `report_builder`, ale to dwie różne, niezależne ścieżki wejścia
— jedna z KimiWorkspace/WordyView [martwa], druga z AI-czatu
V8ArtifactRunControl [żywa]). Nie kasować `artifact-runs.routes.ts` ani
`requestedOutputType==='report'` w `artifactRegistryService.ts`.

---

## 5. `src/components/ReportBuilder/ReportBuilderWizard.tsx`

**Dowód:**
```
$ grep -rln "ReportBuilderWizard" src/ --include="*.tsx" --include="*.ts" | grep -v __tests__
src/components/ReportBuilder/ReportBuilderWizard.tsx   (definicja)
src/components/ReportBuilder/index.ts                  (re-eksport w barrelu)

$ grep -rn "<ReportBuilderWizard" src/ --include="*.tsx"
src/components/ReportBuilder/ReportBuilderWizard.tsx:92   (własna definicja, nie mount)

$ grep -rn "from '@/components/ReportBuilder'\|from '\.\./ReportBuilder'" src/ | grep -v "ReportBuilder/"
src/components/Reports/index.ts:4   ReportBuilder (INNY komponent, inna ścieżka: src/components/Reports/ReportBuilder — false positive na nazwę katalogu)
```
Barrel eksportuje symbol, ale nic w repo nie importuje `{ ReportBuilderWizard }`
z tego barrela ani bezpośrednio z pliku. Zero JSX mountu.

**Werdykt: KASUJ.**

**Zależności do usunięcia razem:**
- Linia eksportu w `src/components/ReportBuilder/index.ts` (`export {
  ReportBuilderWizard } from './ReportBuilderWizard';`).
- Sprawdzić, czy `ReportBuilderWizard.tsx` importuje coś UNIKALNEGO (np.
  osobny hook/typ), co po jego kasacji też staje się martwe — nie sprawdzane
  głębiej w tej fali (zakres: dowód na sam plik).

---

## 6. `src/components/ReportBuilder/ReportBuilderCommentPanel.tsx`

**Dowód:**
```
$ grep -rln "ReportBuilderCommentPanel" src/ --include="*.tsx" --include="*.ts" | grep -v __tests__
src/components/ReportBuilder/ReportBuilderCommentPanel.tsx   (definicja)
src/components/ReportBuilder/index.ts                        (re-eksport w barrelu)

$ grep -rn "<ReportBuilderCommentPanel" src/ --include="*.tsx"
src/components/ReportBuilder/ReportBuilderCommentPanel.tsx:132   (własna definicja, nie mount)
```
Ten sam wzorzec co #5 — barrel eksportuje, nikt nie importuje, zero JSX mountu.

**Werdykt: KASUJ.**

**Zależności do usunięcia razem:**
- Linia eksportu w `src/components/ReportBuilder/index.ts` (`export {
  ReportBuilderCommentPanel } from './ReportBuilderCommentPanel';`).

---

## 7. `src/components/DocumentStudio/DocumentStudioEditorPanel.tsx` + `TransformativeConfirmDialog.tsx`

**Dowód:**
```
$ grep -rln "DocumentStudioEditorPanel" src/ --include="*.tsx" --include="*.ts" | grep -v __tests__
src/components/DocumentStudio/DocumentStudioEditorPanel.tsx   (definicja)

$ grep -rn "<DocumentStudioEditorPanel" src/ --include="*.tsx"
(brak wyników — zero mountów gdziekolwiek, nawet we własnym pliku poza definicją)

$ grep -rln "TransformativeConfirmDialog" src/ --include="*.tsx" --include="*.ts" | grep -v __tests__
src/components/DocumentStudio/DocumentStudioEditorPanel.tsx   (JEDYNY importer/mount: linia 519 <TransformativeConfirmDialog)
src/components/DocumentStudio/TransformativeConfirmDialog.tsx (definicja)
```
`TransformativeConfirmDialog` żyje wyłącznie wewnątrz `DocumentStudioEditorPanel`,
który sam nie ma ŻADNEGO zewnętrznego importera/mountu. Para martwa razem.

**Werdykt: KASUJ (oba razem, `TransformativeConfirmDialog` jako zależność
`DocumentStudioEditorPanel`).**

**Uwaga:** to jest OSOBNY plik od żywego edytora Document Studio
(`DocumentTipTapEditor` — kanon wg inwentarza). Nie pomylić przy kasacji —
grep na dokładną nazwę `DocumentStudioEditorPanel`, nie na `DocumentStudio*Panel*`
ogólnie (jest kilka innych, żywych paneli w tym katalogu).

---

## 8. `src/components/ReportBuilder/ReportEditor/InlineEditor.tsx`

**Dowód:**
```
$ grep -rln "InlineEditor" src/ --include="*.tsx" --include="*.ts" | grep -v __tests__
src/components/ReportBuilder/ReportEditor/InlineEditor.tsx   (definicja — JEDYNY wynik)

$ grep -n "InlineEditor" src/components/ReportBuilder/ReportEditor/index.ts
(brak wyników — nawet barrel go nie eksportuje)

$ grep -rn "<InlineEditor" src/ --include="*.tsx"
src/components/ReportBuilder/ReportEditor/InlineEditor.tsx:93   (własna definicja, nie mount)
```
Jedyny plik z zerowym śladem gdziekolwiek indziej — nawet nie wystawiony
przez barrel `ReportEditor/index.ts` (w przeciwieństwie do #5/#6, które
przynajmniej były re-eksportowane).

**Werdykt: KASUJ.** Najbezpieczniejsza pozycja na liście — brak nawet
pośredniego punktu zaczepienia.

---

## 9. `server/src/services/documentStudio/documentTeresaIntent.ts`

**Dowód:**
```
$ grep -rln "documentTeresaIntent" src/ server/src/ --include="*.tsx" --include="*.ts" | grep -v __tests__
server/src/services/documentStudio/documentTeresaIntent.ts   (definicja — JEDYNY wynik)

$ grep -rln "detectTeresaEditorIntent\|detectTeresaCreationIntent\|TERESA_INTENT_LEXICONS\|TERESA_CREATION_LEXICONS" server/src/ src/ --include="*.ts" --include="*.tsx" | grep -v documentTeresaIntent
server/src/services/documentStudio/__tests__/documentTeresaCreationIntent.test.ts   (tylko własny test)
```
Zero importerów żadnego z exportów (`detectTeresaEditorIntent`,
`detectTeresaCreationIntent`, oba lexicon-y) poza własnymi testami
jednostkowymi. Serwis nie jest podpięty pod żaden route ani wywoływany przez
żaden inny serwis.

**Werdykt: KASUJ** (razem z `server/src/services/documentStudio/__tests__/documentTeresaIntent.test.ts`
i `documentTeresaCreationIntent.test.ts`) **— chyba że ktoś ma w planach
faktyczne podłączenie** (inwentarz zostawiał to jako "podłączyć albo usunąć";
świeży grep dziś nie pokazuje żadnego callera, więc domyślny werdykt to
kasacja, nie połowiczne "zostaw na później").

---

## 10. `POST /api/workbook/generate-and-download`

**Dowód:**
```
$ grep -rn "generate-and-download" server/src/ src/ --include="*.ts" --include="*.tsx"
server/src/routes/workbook.routes.ts:6     (komentarz dokumentacyjny)
server/src/routes/workbook.routes.ts:769   (komentarz dokumentacyjny)
server/src/routes/workbook.routes.ts:773   router.post('/generate-and-download', ...)   ← definicja endpointu

$ grep -rn "generate-and-download\|generateAndDownload" src/ --include="*.ts" --include="*.tsx"
(brak wyników — zero callerów klienckich)
```
Endpoint istnieje i jest zamontowany, ale zero kodu klienckiego w `src/` go
wywołuje (żaden `Api.post`/`fetch` na tę ścieżkę).

Handler (linie 772-805) woła `WorkbookGeneratorService.generate(...)` —
**ten serwis jest głównym, żywym silnikiem Excela** (kanon wg inwentarza,
5-fazowy pipeline) z wieloma innymi callerami (m.in. Teresa `/tabele`).
Kasacja dotyczy WYŁĄCZNIE tego jednego `router.post('/generate-and-download', ...)`
bloku (linie 772-805) — `WorkbookGeneratorService` NIE jest kasowany, to
osobny, żywy plik.

**Werdykt: KASUJ** (tylko blok routera linie 772-805 w `workbook.routes.ts`;
`WorkbookGeneratorService.generate` zostaje nietknięty — ma innych, żywych
callerów).

---

## Podsumowanie werdyktów

| # | Pozycja | Werdykt |
|---|---|---|
| 1 | `PresentationsHub.tsx` (stary V3-J02) | KASUJ |
| 2 | `DeckTemplateGallery.tsx` | KASUJ (razem z #1) |
| 3 | `WordyView.tsx` + lane `wordy` w `useKimiArtifactPipeline.ts` | KASUJ |
| 4 | `POST /artifact-runs/*` outputType `report` | **ZOSTAW** — żywe przez `V8ArtifactRunControl` w głównym czacie |
| 5 | `ReportBuilderWizard.tsx` | KASUJ |
| 6 | `ReportBuilderCommentPanel.tsx` | KASUJ |
| 7 | `DocumentStudioEditorPanel.tsx` + `TransformativeConfirmDialog.tsx` | KASUJ (para) |
| 8 | `InlineEditor.tsx` (ReportBuilder/ReportEditor) | KASUJ |
| 9 | `documentTeresaIntent.ts` (+ testy) | KASUJ (chyba że plan podłączenia) |
| 10 | `POST /workbook/generate-and-download` | KASUJ (endpoint; serwis pod spodem — sprawdzić inne callery) |

8 pozycji do kasacji, 1 do zostawienia (inwentarz się pomylił — sprawdzone
świeżym grepem), 1 wymaga jednozdaniowej decyzji przy kasacji (#10: nie kasować
funkcji serwisowej, jeśli ma innych callerów niż ten jeden endpoint).

**Dla Haiku-wykonawcy:** kasuj pozycje 1-3, 5-9 dokładnie w kolejności podanej
(1+2 razem, 7 razem), commit per pozycja, targeted vitest po każdej (nie cały
pakiet). Pozycja 4 NIE jest do ruszenia. Pozycja 10 wymaga jednego dodatkowego
grepa przed kasacją handlera (czy funkcja serwisowa ma innych callerów).
