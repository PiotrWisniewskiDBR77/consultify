# P8 — Teresa: jedno wejście, jeden kontrakt per narzędzie

> **Uwaga redakcyjna:** w `01_INDEKS_I_HARMONOGRAM.md` etykieta „P8" oznaczała zadanie *danych* (sprzątanie historii Czatu, bez własnego pliku, wykonywane w P3/P5). Ta paczka jest zadaniem *kodu*. Przy najbliższej aktualizacji indeksu zadanie danych przenieść pod „P8-D", a ten plik zostawić jako P8.
>
> Źródła: `docs/ssot/ZASADY_AI_TERESA_SSOT.md` (zasady) · `docs/ssot/KONTRAKTY_NARZEDZI_AI.md` (kontrakty + pomiar 05.09) · `docs/program/AUDYT_FORMULY_PRACY_20260905.md` (luka przekrojowa nr 5).

## 1. Cel dla użytkownika

Teresa jest w każdym module dostępna **z jednego, tego samego miejsca** — przycisku w sekcji „Akcje" prawego panelu — i w każdym narzędziu wie, o czym rozmawia, zamiast być raz zakładką, raz banerem, a raz niczym.

## 2. Zakres

| Obszar | Pozycje | Moduły (id z `MVP_FINAL_ZAMROZONE.json`) |
|---|---|---|
| Wspólne wejście do Teresy w prawym panelu | 9 modułów renderujących `ArtifactRightPanel` | `02_INTERVIEW`, `03_TOOLS`, `04_ASSESSMENT`, `05_INITIATIVES`, `07_MY_WORK_AGENT`, `11_MATERIALS`, `12_AUDITS`, `13_CHAT` + Wyniki (niezamrożone) |
| Moduł bez wołacza | 01 Organizacja (baner „Teresa context" nie prowadzi do Teresy) | `01_ORGANIZATION` |
| Props przyjęte i wyrzucone | 04 Ocena (`MethodWorkspaceShell` nie renderuje `TeresaPreviewPanel`) | `04_ASSESSMENT` |
| Cicha pustka + angielski | 08 Spotkania (blok AI) | `08_MEETINGS` |
| Martwe powierzchnie AI | `AIActionSlot`, `AIConsultantPanel`, `canvasMutationRisk` | wspólne (`src/components/shared/`, `src/utils/`) |
| Kontrakt per narzędzie | 12 narzędzi Discovery — `systemPrompts.ts` + strażnik zgodności listy | `03_TOOLS` |

**Dotkniętych ekranów: 9 modułów × prawy panel + 3 ekrany punktowe + 12 promptów narzędzi.**

## 3. Przyczyna źródłowa (zweryfikowane na HEAD `codex/m03-admin-20260824`)

1. `src/utils/artifactRightRailFlag.ts:57` — `export const ENABLE_ARTIFACT_RIGHT_RAIL = false`, a `isArtifactRightRailEnabled()` kończy się `return ENABLE_ARTIFACT_RIGHT_RAIL`. Wspólny mechanizm wstrzykiwania `TeresaEntryButton` (`src/components/standard/ArtifactRightRail.tsx:627`) jest **wyłączony**, a komentarz w pliku flagi mówi „ZASTĄPIONE 2026-09-01 … nowe powierzchnie NIE powinny go włączać" — mechanizm porzucono **bez następcy**.
2. `src/components/standard/ArtifactRightPanel.tsx:65–73` — `ARTIFACT_PANEL_SECTION_ORDER` nie przewiduje wejścia do Teresy; 9 modułów renderuje ten panel i żaden nie dostaje przycisku „z pudełka".
3. `src/components/method-workspace/MethodWorkspaceShell.tsx:46,67` — importuje **tylko typ** `TeresaPreviewPanelProps`, przyjmuje `teresaProps` i nigdzie ich nie renderuje; `<TeresaPreviewPanel` występuje wyłącznie w `__tests__`.
4. `src/components/Organization/OrgContextSummaryBanner.tsx:178,197` — baner mówi „Teresa context: {{count}} claims", a w całym `src/components/Organization/` nie ma ani jednego `useOpenChatWithContext`.
5. `src/components/shared/Menu3/AIActionSlot.tsx` — kanoniczny slot Menu 3 (przykład w pliku: `label="Ask Teresa"`), **0 użyć** poza własnym barrelem `Menu3/index.ts`.
6. `src/components/shared/NModeLayout/AIConsultantPanel.tsx` — **0 importów**; 17 trafień grepa to komentarze o jego usunięciu.
7. `src/utils/canvas/canvasMutationRisk.ts:86` — `const canAutoApply = actor === 'teresa' && risk === 'low'`, **0 konsumentów**; martwa reguła sprzeczna z zakazem auto-apply (`docs/strategy/TABELE_V8_AI_GOVERNANCE.md` §1).
8. `src/components/DiscoveryTools/toolAiActions.ts:51–54` — komentarz przyznaje, że lista `TOOLS_WITH_APPLY_HANDLER` jest ręczna i że poza nią przyciski „silently no-op"; zgodności z `useToolAI` nie sprawdza żaden test.

## 4. Projekt rozwiązania

**Jedna decyzja architektoniczna:** wejście do Teresy przestaje być osobnym mechanizmem (`ArtifactRightRail`) i staje się **elementem kanonu prawego panelu**.

- `ArtifactRightPanel` dostaje opcjonalny props `teresaEntry?: { label: string; onOpen: () => void; disabled?: boolean; disabledReason?: string }`. Gdy podany — panel renderuje `TeresaEntryButton` **jako pierwszy element sekcji `actions`**. Bez `teresaEntry` panel wygląda jak dziś.
- Etykieta jest **per typ obiektu** i nazywa obiekt, nie funkcję: „Zapytaj Teresę o tę notatkę / o tę ideę / o tę inicjatywę / o to kryterium / o ten miernik". Nie „AI", nie „Konsultant AI" (kanon w nagłówku `TeresaEntryButton.tsx`).
- `onOpen` woła **wyłącznie** `useOpenChatWithContext` — jedna rozmowa, dwa wejścia (zasada P1 z `ZASADY_AI_TERESA_SSOT.md`). Zakaz montowania drugiego `UnifiedChatPanel` w panelu.
- `ArtifactRightRail` i jego flaga **zostają nietknięte** (są w drodze do usunięcia osobnym krokiem); powierzchnie, które go deklarują, przechodzą na `teresaEntry`.

**Co się zmienia w komponentach wspólnych:** `ArtifactRightPanel.tsx` (jeden props + jeden render), nowy strażnik `scripts/check-teresa-kontrakty.sh`.
**Co per moduł:** przekazanie `teresaEntry` z właściwą etykietą i kontekstem.

**Zakazy (kanon):** wyłącznie `StandardTable`/`StandardModuleBar`/`StandardPreview`/`ArtifactRightPanel`; tokeny `c-*`, **zero `primary-*`** (każdy numer = crimson #85182F); fokus `c-focus`; kebab pionowy; i18n pl+en, polski domyślny; **zero nowych flag**; zero drugiego czatu w panelu.

## 5. Kroki wykonania

| # | Krok | Pliki | Rozmiar | Odmrożenie |
|---|---|---|:-:|---|
| 1 | `ArtifactRightPanel`: props `teresaEntry` + render `TeresaEntryButton` na czele sekcji `actions`; test jednostkowy „bez props panel bez zmian / z props przycisk jest pierwszy" | `src/components/standard/ArtifactRightPanel.tsx` (+ test) | M | — |
| 2 | Podłączyć `teresaEntry` w 4 powierzchniach, które dziś deklarują je przez wyłączony rail | `MyWork/notebook/NotebookRightRail.tsx:467`, `standard/IdeaRightPanel.tsx:331`, `AIChat/KimiWorkspace/ExceleRightPanel.tsx:337`, `Presentations/DeckBuilder/DeckBuilderMelsView.tsx` | M | `[ODMROZENIE 07_MY_WORK_AGENT DEC-397]`, `[ODMROZENIE 11_MATERIALS DEC-397]` |
| 3 | Podłączyć `teresaEntry` w pozostałych powierzchniach z `ArtifactRightPanel` (Wywiad, Narzędzia, Ocena-raport, Audyty, Wyniki, Zadania/Decyzje/Powiadomienia Mojej Pracy) | `Interview/InterviewWorkspace.tsx:3634`, `Interview/InsightViewer.tsx:9284`, `DiscoveryTools/ToolDocumentView.tsx:2463`, `DiscoveryTools/KnownToolDetailView.tsx:2621`, `assessment/report/AssessmentReportContractView.tsx:536`, `Audit/method/workspace/v2/CriterionWorkspaceV2.tsx:1811`, `Audit/method/AuditReportDocumentView.tsx:1453`, `ResultsVNext/*` (5 plików), `MyWork/{TaskDetailView,DecisionDetailView,NotificationDetailView}.tsx` | L | `[ODMROZENIE 02_INTERVIEW DEC-397]`, `[ODMROZENIE 03_TOOLS DEC-397]`, `[ODMROZENIE 04_ASSESSMENT DEC-397]`, `[ODMROZENIE 12_AUDITS DEC-397]`, `[ODMROZENIE 07_MY_WORK_AGENT DEC-397]` |
| 4 | 01 Organizacja: baner `OrgContextSummaryBanner` dostaje akcję „Zapytaj Teresę o kontekst organizacji" (`useOpenChatWithContext`), tekst po polsku | `Organization/OrgContextSummaryBanner.tsx`, `views/OrganizationView.tsx:607` | S | `[ODMROZENIE 01_ORGANIZATION DEC-397]` |
| 5 | 04 Ocena: `MethodWorkspaceShell` **renderuje** `TeresaPreviewPanel` z przekazanych `teresaProps` (dziś je wyrzuca); import wartości, nie tylko typu | `method-workspace/MethodWorkspaceShell.tsx:46,67` | M | `[ODMROZENIE 04_ASSESSMENT DEC-397]` |
| 6 | 08 Spotkania: blok AI po polsku + uczciwy komunikat braku dostępu zamiast „cichej pustki" (bez zmiany allowlisty — to decyzja operacyjna, nie kodowa) | `Meeting/MeetingHub.tsx:255–275`, `public/locales/{pl,en}/translation.json` | S | `[ODMROZENIE 08_MEETINGS DEC-397]` |
| 7 | Usunąć martwe powierzchnie: `shared/NModeLayout/AIConsultantPanel.tsx`, `utils/canvas/canvasMutationRisk.ts`; `shared/Menu3/AIActionSlot.tsx` **albo** dostaje konsumenta w Menu 3 Narzędzi, **albo** znika razem z eksportem z `Menu3/index.ts` | j.w. | M | `[ODMROZENIE 03_TOOLS DEC-397]` jeśli konsument |
| 8 | Kontrakt per narzędzie w promptach: 12 wpisów (co robi / czego nie wolno) wg `KONTRAKTY_NARZEDZI_AI.md` §2 | `src/hooks/discovery/toolAi/systemPrompts.ts` | M | `[ODMROZENIE 03_TOOLS DEC-397]` |
| 9 | Strażnik `scripts/check-teresa-kontrakty.sh` + wpięcie w `.husky/pre-commit` obok `check-list-canon.sh` | nowy plik + `.husky/pre-commit` | M | — |

Kolejność wymuszona: 1 → (2,3 równolegle) → 4,5,6 → 7 → 8 → 9. Krok 9 na końcu, bo mierzy efekt kroków 1–8.

## 6. Testy

**Jednostkowe (asercje + dowód mutacyjny):**

| Plik testu | Asercja | Dowód mutacyjny |
|---|---|---|
| `src/components/standard/__tests__/ArtifactRightPanel.teresaEntry.test.tsx` (NOWY, `git add -f`) | z `teresaEntry` przycisk jest **pierwszym** dzieckiem sekcji `actions`; bez props sekcja identyczna jak dziś | usuń render `TeresaEntryButton` z panelu → test musi paść |
| `src/components/method-workspace/__tests__/MethodWorkspaceShell.teresa.test.tsx` (NOWY) | shell renderuje `TeresaPreviewPanel` z przekazanych `teresaProps` | przywróć `import type` zamiast importu wartości → test musi paść |
| `src/components/Organization/__tests__/OrgContextSummaryBanner.teresa.test.tsx` (NOWY) | klik w akcję banera woła `openChatWithContext` z `organizationId` | usuń `onClick` → test musi paść |
| `src/components/DiscoveryTools/__tests__/toolAiContract.test.ts` (NOWY) | każdy typ z `TOOLS_WITH_APPLY_HANDLER` ma wpis w `systemPrompts.ts` **i** handler `apply…`; brak któregokolwiek = FAIL | usuń jeden wpis z `systemPrompts.ts` → test musi paść (to jest test na **zabezpieczenie**, nie na mechanizm) |

**Zakaz maskowania:** `--retry=0` w każdym przebiegu; `No test files found` i `Transform failed` to **błąd komendy, nie PASS**; w raporcie podajesz `numTotalTests`, nie tylko `numFailedTests`.

**Wizualne:** 1280 / 1440 / 1920 px, jasny **i** ciemny, po jednym zrzucie na każdą z 9 powierzchni z kroku 2–3 (prawy panel **rozwinięty**, sekcja „Akcje" otwarta — zwinięta sekcja nie jest dowodem). Para jasny/ciemny musi się różnić: `mean_luma` obu obrazów nie może być bliższa niż 40.

**Przepływ klikany (Playwright):** otwórz inicjatywę → prawy panel → „Zapytaj Teresę o tę inicjatywę" → dok otwiera się z **historią z czatu głównego** (nie pustą rozmową) → zadaj pytanie → odpowiedź niesie kontekst inicjatywy. Powtórz dla notatki i kryterium audytu. To jest dowód zasady „jedna Teresa, jedna rozmowa" — bez niego krok 1–3 są nieodebrane.

## 7. Kryterium odbioru właściciela

Na `:3000` w dowolnym module: prawy panel ma na górze sekcji „Akcje" jeden przycisk „Zapytaj Teresę o …", klik otwiera **tę samą** Teresę z historią — i tak samo wygląda to w Wywiadzie, Narzędziach, Inicjatywach, Notatniku, Audytach i Wynikach.

## 8. Ryzyka i cofanie

| Ryzyko | Skutek | Cofanie |
|---|---|---|
| Sekcja „Akcje" przepełnia się na wąskim ekranie | przycisk wypycha akcje 2. rzędu | przycisk w jednym wierszu z `truncate`; zrzut 1280 px jest bramką |
| Podwójne wejście (przycisk + stara zakładka) w Mojej Pracy | dwie Teresy na jednym ekranie — dokładnie to, co właściciel odrzucił 01.09 | krok 2 **zastępuje** zakładkę `IdeaElementInspector`, nie dokłada; test „dokładnie jedno wejście na ekran" |
| Usunięcie `AIActionSlot`/`AIConsultantPanel` zrywa import gdzieś poza pomiarem | build pada | przed usunięciem `grep -rn "<AIActionSlot\|<AIConsultantPanel" src` musi być pusty; potem `tsc` |
| Moduł zamrożony bez markera | `check-freeze.sh` odrzuca commit | marker `[ODMROZENIE <MODUL> DEC-397]` w komunikacie — lista w §5 |
| Regresja wizualna | panel wygląda inaczej niż zatwierdzony | tag `demo-safe-<data>` sprzed paczki; `git revert` per krok (commit-per-krok) |

**Podstawa odmrożeń:** `DEC-397` — `01_INDEKS_I_HARMONOGRAM.md` (wiersz P9) rozstrzyga, że DEC-397 obejmuje także P8 i P9; właściciel może to uchylić. Bez markera `check-freeze.sh` zatrzyma Codexa na pierwszym commicie w module zamrożonym.

## 9. Nakład

| Rola | Kroki | Osobodni |
|---|---|---|
| Opus | 1, 5, 7 (usunięcia z weryfikacją), 9 | 1,5 |
| Sonnet | 2, 3, 4, 6, 8 | 2,5 |

**Razem ≈ 4 osobodni; ścieżka krytyczna 2,5 dnia** (krok 1 blokuje 2–3; 4/5/6 równolegle po 1). W sesjach Codexa (1 sesja ≈ 4–6 h): **7–8 sesji**, z czego 4 równoległe.

## 10. Cel osiągnięty = samokontrola Codexa (praca do celu)

**Komendy po każdym kroku, z oczekiwanym wynikiem:**

```bash
cd <worktree>
npx esbuild <każdy dotknięty plik> --loader:.tsx=tsx --outfile=/dev/null   # exit 0
npx vitest run --retry=0 --reporter=json --outputFile=/private/tmp/p8/<krok>.json \
  src/components/standard/__tests__/ArtifactRightPanel.teresaEntry.test.tsx \
  src/components/method-workspace/__tests__/MethodWorkspaceShell.teresa.test.tsx \
  src/components/Organization/__tests__/OrgContextSummaryBanner.teresa.test.tsx \
  src/components/DiscoveryTools/__tests__/toolAiContract.test.ts
bash scripts/check-list-canon.sh      # exit 0
bash scripts/check-artefakt.sh        # exit 0
bash scripts/check-teresa-kontrakty.sh # exit 0 (od kroku 9)
```
Otwórz każdy `.json` i sprawdź **polem**: `numTotalTests` ≥ liczba przypadków, `numFailedTests` = 0, żaden test w stanie `skipped`. Kod wyjścia 0 przy `skipped` **nie jest PASS**.

**Progi liczbowe (bramka STOP):**

| Miara | Komenda | Próg |
|---|---|---|
| żywe wejścia do Teresy | `grep -rn "<TeresaEntryButton" src --include='*.tsx' \| grep -v __tests__ \| wc -l` | **≥ 13** (dziś 2) |
| martwe powierzchnie AI | `grep -rn "<AIActionSlot\|<AIConsultantPanel\|<TeresaPreviewPanel" src \| grep -v __tests__ \| wc -l` | `TeresaPreviewPanel` ≥ 1, pozostałe **= 0** |
| martwa reguła auto-apply | `ls src/utils/canvas/canvasMutationRisk.ts 2>/dev/null \| wc -l` | **0** |
| kontrakt per narzędzie | `node -e "…"` zgodność `TOOLS_WITH_APPLY_HANDLER` ↔ `systemPrompts.ts` | **12/12** |
| angielski w bloku AI Spotkań | zrzut + stop-lista EN | **0 tokenów** |
| przepełnienia poziome | `node scripts/dev/odbior-zywo/zrzut.mjs --url=… --port=… --host=127.0.0.1 --dom=aside` | `aside` = 1, `przepelnieniaPoziome` = 0, zero błędów konsoli, zero wpisów ≥ 400 |

**Pomiar na żywo:** własny vite na wolnym porcie, `cp /private/tmp/m03/.env.local .`; zrzuty 1280/1440/1920 × jasny/ciemny dla 9 powierzchni; porównanie z obrazem odniesienia `evidence/audyt-award-20260905/` — sekcja „Akcje" ma być identyczna poza dodanym przyciskiem na czele.

**Dowód mutacyjny (obowiązkowy, celuje w zabezpieczenie, nie w mechanizm):** dla każdego z 4 testów §6 wykonaj wskazaną mutację, zapisz `fullName` przypadku, który padł, przywróć kod. Test, który przechodzi po mutacji, **nie broni niczego** — napraw go, zanim ogłosisz krok.

**Warunek STOP:** wszystkie progi spełnione → commit + raport. Próg niespełnialny bez decyzji właściciela (np. allowlista `VITE_INTERNAL_TOOLS_ENABLED` w kroku 6) → **zatrzymaj się i opisz**, nie obchodź.

**Zakazy:** `--no-verify`, `git stash`, `pkill`, tworzenie flag (żadnej nowej, żadnej zmiany wartości domyślnej istniejącej), edycja plików modułów zamrożonych bez markera `[ODMROZENIE <MODUL> DEC-397]`, pytania do właściciela (niejasność → „założenie CTO" w raporcie), `push`.

## 11. Wklejka dla Codexa

```markdown
ZADANIE P8 — Teresa: jedno wejście, jeden kontrakt per narzędzie.

KATALOG ROBOCZY: własne worktree z `origin/staging` (świeża gałąź per krok, commit-per-krok, BEZ push).
Referencje: docs/ssot/ZASADY_AI_TERESA_SSOT.md, docs/ssot/KONTRAKTY_NARZEDZI_AI.md,
docs/program/PROGRAM_NAPRAWCZY_20260905/P8_TERESA_KONTRAKTY.md

CEL: Teresa jest w każdym module dostępna z jednego miejsca — przycisku w sekcji „Akcje" prawego
panelu — i w każdym narzędziu wie, o czym rozmawia.

DECYZJA ARCHITEKTONICZNA (nie zmieniaj jej):
- `ArtifactRightPanel` dostaje props `teresaEntry?: { label; onOpen; disabled?; disabledReason? }`
  i renderuje `TeresaEntryButton` jako PIERWSZY element sekcji `actions`. Bez props — panel jak dziś.
- `onOpen` woła WYŁĄCZNIE `useOpenChatWithContext`. Zakaz montowania drugiego `UnifiedChatPanel`.
- Etykieta per typ obiektu: „Zapytaj Teresę o tę notatkę / ideę / inicjatywę / to kryterium / ten miernik".
  Nie „AI", nie „Konsultant AI".
- `ArtifactRightRail` i jego flagę zostaw nietknięte.
- Kanon: StandardTable/StandardModuleBar/StandardPreview/ArtifactRightPanel; tokeny `c-*`;
  ZERO `primary-*` (każdy numer = crimson #85182F); fokus `c-focus`; kebab pionowy; i18n pl+en.

KROKI (kolejność: 1 → (2,3 równolegle) → 4,5,6 → 7 → 8 → 9):
1. ArtifactRightPanel: props `teresaEntry` + render. [src/components/standard/ArtifactRightPanel.tsx]
2. Podłącz `teresaEntry` tam, gdzie dziś deklaruje je wyłączony rail:
   MyWork/notebook/NotebookRightRail.tsx:467, standard/IdeaRightPanel.tsx:331,
   AIChat/KimiWorkspace/ExceleRightPanel.tsx:337, Presentations/DeckBuilder/DeckBuilderMelsView.tsx
   → markery [ODMROZENIE 07_MY_WORK_AGENT DEC-397] [ODMROZENIE 11_MATERIALS DEC-397]
3. Podłącz `teresaEntry` w pozostałych powierzchniach z ArtifactRightPanel:
   Interview/InterviewWorkspace.tsx:3634, Interview/InsightViewer.tsx:9284,
   DiscoveryTools/ToolDocumentView.tsx:2463, DiscoveryTools/KnownToolDetailView.tsx:2621,
   assessment/report/AssessmentReportContractView.tsx:536,
   Audit/method/workspace/v2/CriterionWorkspaceV2.tsx:1811, Audit/method/AuditReportDocumentView.tsx:1453,
   ResultsVNext/* (5 plików), MyWork/{TaskDetailView,DecisionDetailView,NotificationDetailView}.tsx
   → markery [ODMROZENIE 02_INTERVIEW|03_TOOLS|04_ASSESSMENT|12_AUDITS|07_MY_WORK_AGENT DEC-397]
   ★ W Mojej Pracy przycisk ZASTĘPUJE dotychczasową zakładkę Teresy w IdeaElementInspector — nie dokłada.
4. 01 Organizacja: OrgContextSummaryBanner dostaje akcję „Zapytaj Teresę o kontekst organizacji"
   (useOpenChatWithContext), tekst po polsku. [ODMROZENIE 01_ORGANIZATION DEC-397]
5. 04 Ocena: method-workspace/MethodWorkspaceShell.tsx:46,67 — dziś importuje TYLKO TYP
   `TeresaPreviewPanelProps`, przyjmuje `teresaProps` i nigdy ich nie renderuje. Zaimportuj wartość
   i wyrenderuj panel. [ODMROZENIE 04_ASSESSMENT DEC-397]
6. 08 Spotkania: Meeting/MeetingHub.tsx:255–275 — blok AI po polsku + uczciwy komunikat braku
   dostępu zamiast cichej pustki. NIE zmieniaj allowlisty ani VITE_INTERNAL_TOOLS_ENABLED.
   [ODMROZENIE 08_MEETINGS DEC-397]
7. Usuń martwe: shared/NModeLayout/AIConsultantPanel.tsx (0 importów),
   utils/canvas/canvasMutationRisk.ts (0 konsumentów, przyznaje Teresie cichy zapis — sprzeczne
   z zakazem auto-apply). shared/Menu3/AIActionSlot.tsx: albo daj mu konsumenta w Menu 3 Narzędzi,
   albo usuń wraz z eksportem z Menu3/index.ts. Przed usunięciem grep musi być pusty, potem tsc.
8. src/hooks/discovery/toolAi/systemPrompts.ts — 12 wpisów kontraktu per narzędzie (co robi /
   czego nie wolno) wg KONTRAKTY_NARZEDZI_AI.md §2. [ODMROZENIE 03_TOOLS DEC-397]
9. scripts/check-teresa-kontrakty.sh + wpięcie w .husky/pre-commit obok check-list-canon.sh.

TESTY (NOWE pliki w tests/ i __tests__ wymagają `git add -f`):
- ArtifactRightPanel.teresaEntry.test.tsx — przycisk jest PIERWSZY w sekcji `actions`;
  mutacja: usuń render → test musi paść.
- MethodWorkspaceShell.teresa.test.tsx — shell renderuje TeresaPreviewPanel z teresaProps;
  mutacja: wróć do `import type` → test musi paść.
- OrgContextSummaryBanner.teresa.test.tsx — klik woła openChatWithContext z organizationId;
  mutacja: usuń onClick → test musi paść.
- toolAiContract.test.ts — każdy typ z TOOLS_WITH_APPLY_HANDLER ma wpis w systemPrompts.ts
  I handler apply…; mutacja: usuń jeden wpis → test musi paść.
Każdy przebieg z --retry=0 i --reporter=json --outputFile=/private/tmp/p8/<krok>.json.
Otwórz JSON i sprawdź POLEM: numTotalTests, numFailedTests=0, żaden test `skipped`.
`No test files found` i `Transform failed` to BŁĄD KOMENDY, nie PASS.

SAMOKONTROLA — progi, przy których wolno Ci uznać cel za osiągnięty:
- grep -rn "<TeresaEntryButton" src --include='*.tsx' | grep -v __tests__ | wc -l  → ≥ 13 (dziś 2)
- grep -rn "<AIActionSlot\|<AIConsultantPanel" src | grep -v __tests__ | wc -l     → 0
- grep -rn "<TeresaPreviewPanel" src | grep -v __tests__ | wc -l                   → ≥ 1
- ls src/utils/canvas/canvasMutationRisk.ts 2>/dev/null | wc -l                     → 0
- zgodność TOOLS_WITH_APPLY_HANDLER ↔ systemPrompts.ts                             → 12/12
- npx esbuild <każdy dotknięty plik> → exit 0; bash scripts/check-list-canon.sh → exit 0;
  bash scripts/check-artefakt.sh → exit 0
- zrzuty 1280/1440/1920 × jasny+ciemny, prawy panel ROZWINIĘTY, sekcja „Akcje" otwarta;
  aside = 1, przepelnieniaPoziome = 0, zero błędów konsoli; para jasny/ciemny różni się
  mean_luma o ≥ 40 (identyczna para = przyrząd kłamie, nie sukces).
- przepływ klikany: inicjatywa → panel → „Zapytaj Teresę o tę inicjatywę" → dok otwiera się
  z HISTORIĄ z czatu głównego (nie pustą rozmową). Powtórz dla notatki i kryterium audytu.

WARUNEK STOP: wszystkie progi spełnione → commit + raport z liczbami. Próg niespełnialny bez
decyzji właściciela (np. allowlista w kroku 6) → ZATRZYMAJ SIĘ i opisz. Nie obchodź.

ZAKAZY: --no-verify · git stash · pkill · tworzenie flag i zmiana wartości domyślnych istniejących ·
edycja plików modułów zamrożonych bez markera [ODMROZENIE <MODUL> DEC-397] · pytania do właściciela
(niejasność → zapisz „założenie CTO" w raporcie) · push.
```
