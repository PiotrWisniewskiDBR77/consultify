# Flagi — rozdzielony odczyt `import.meta.env` (dyżur 2026-09-05)

Worktree: `/private/tmp/ag-flagi-env` (branch `agent/flagi-env-statyczny-odczyt-20260905`, z `m03`).
Kontekst zlecenia: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/AGENT_MATERIALY_DEFEKTY_20260905.md`
defekt 5. Wzór naprawy: `src/utils/zaiTeresaFlag.ts` (commit `f5fdab8662`).

## 1. Pomiar — ile plików miało rozdzielony wzorzec

Polecenia z zlecenia:

```
rg -n "= import\.meta as" src --glob '*.ts' --glob '*.tsx'
rg -n "meta\?\.env|meta\.env" src
```

Pierwsze polecenie trafiło **108 plików**, wszystkie z BAJT-IDENTYCZNĄ
deklaracją:

```ts
const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
```

po której — w osobnej instrukcji, zawsze w tej samej funkcji — następowało
`meta?.env?.[ENV_KEY]` (albo `meta.env?.[ENV_KEY]`, albo w dwóch plikach
`meta?.env?.LITERAL_KEY` / `meta?.env?.[FLAG_ENV]`). Po transpilacji TS cast
znika, więc kod produkcyjny brzmiał `const meta = import.meta; ...
meta?.env` — DWA oddzielone wyrażenia. Vite/esbuild podstawiają obiekt
`import.meta.env` WYŁĄCZNIE gdy `import.meta` i `.env` tworzą JEDEN
łańcuch `MemberExpression` w skompilowanym kodzie — rozdzielenie na dwie
instrukcje oznacza, że podstawienie nigdy się nie odpala, więc
`import.meta` w buildzie zostaje natywnym obiektem bez `.env`, i
`meta?.env` jest zawsze `undefined` w `vite build` (działało tylko
przypadkiem w `vitest`, który ma inny mechanizm wstrzykiwania).

Drugie polecenie (`meta\?\.env|meta\.env`, bez ograniczenia do samego
wzorca deklaracji) trafiło szerzej — złapało też m.in. `i18n.ts`,
`App.tsx`, `AppProviders.tsx`, `navigationGuard.ts`, `useConversationStore.ts`
i kilkanaście innych. Każdy z tych dodatkowych trafień zweryfikowany
ręcznie: to były już POPRAWNE, statyczne odczyty (`import.meta.env.VITE_X`
literalnie, albo `.env` zjedzone w TYM SAMYM wyrażeniu co cast: `(import.meta
as unknown as {...}).env` — bez pośredniej zmiennej trzymającej samo
`import.meta`). Zero dodatkowych realnych defektów poza tymi 108.

### Wynik podziału 108 plików

- **106 plików** — dokładnie ta sama deklaracja + `meta?.env?.[ENV_KEY]` (albo
  `meta.env?.[ENV_KEY]`, `meta?.env?.[FLAG_ENV]`).
- **`src/components/Interview/InsightViewer.tsx`** — jedyny plik z odczytem
  przez dot-literal na zmiennej: `meta?.env?.VITE_VF1_INSIGHT_CARD_CONTRACT`
  (ten sam defekt, inny styl dostępu do klucza).
- **`src/components/Initiatives/sections/initiativeCardContract.ts`** —
  zmienna klucza nazywa się `FLAG_ENV`, nie `ENV_KEY`.

### 5 plików z listy "na pewno obejmij" — realny stan PRZED naprawą

| Plik | Stan przed |
|---|---|
| `src/utils/assessmentDocxFlag.ts` | **ZEPSUTY** — w liście 108. |
| `src/utils/assessmentOutputArtifactsFlag.ts` | **już poprawny** — `.env` był w tym samym wyrażeniu co cast (`const env = (import.meta as unknown as {...}).env;`), nie w liście 108. |
| `src/utils/financeValuePanelsFlag.ts` | **ZEPSUTY** — w liście 108. |
| `src/utils/initiativeBridgeFlag.ts` | **ZEPSUTY** — w liście 108. |
| `src/components/ResultsVNext/resultsVNextFeatureFlags.ts` (`readEnv`) | **już poprawny** — ta sama struktura co `assessmentOutputArtifactsFlag.ts`, nie w liście 108. |

Prawdopodobny powód: te dwa pliki dostały już punktową naprawę przy okazji
innej pracy (ten sam wzorzec „scal cast z `.env`” widać też w
`src/utils/ideaBusinessCaseSchemaFlag.ts`, `src/contracts/tableSurface/
validators.ts` i 10 innych plikach, które NIE weszły do listy 108 — wszystkie
zweryfikowane ręcznie jako poprawne).

## 2. Naprawa — pełna lista 108 plików (przed → po)

Wzorzec naprawy (identyczny dla całej listy poza dwoma wyjątkami opisanymi
niżej): zamiast deklaracji + osobnego odczytu, JEDNO wyrażenie —

```ts
// PRZED (zepsute w vite build):
const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
const parsed = parseFlag(meta?.env?.[ENV_KEY]);

// PO (naprawione — import.meta i .env w jednym wyrażeniu):
const parsed = parseFlag(
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[ENV_KEY]
);
```

Zero zmian semantyki: te same klucze `ENV_KEY`/`FLAG_ENV`, ta sama kolejność
rozstrzygania (query → localStorage → env → default), te same wartości
domyślne. Zweryfikowane per plik: `git diff` każdego z 108 plików zmienia
WYŁĄCZNIE kształt odczytu env, nic więcej.

Pełna lista 108 plików i klucz `VITE_*`, który teraz faktycznie działa w
`vite build` (wcześniej martwy niezależnie od tego, co ustawiono na
Railway):

| Plik | Klucz VITE_* odblokowany |
|---|---|
| `src/components/Initiatives/sections/initiativeCardContract.ts` | `VITE_VF1_INITIATIVE_CARD_CONTRACT` |
| `src/components/Interview/InsightViewer.tsx` | `VITE_VF1_INSIGHT_CARD_CONTRACT` |
| `src/components/MyWork/panel/ideaPanel6SectionsFlag.ts` | `VITE_IDEA_PANEL_6_SECTIONS` |
| `src/utils/agentPlanFlag.ts` | `VITE_AGENT_PLAN` |
| `src/utils/artifactStudioFlags.ts` | `VITE_ARTIFACT_STUDIO` |
| `src/utils/assessmentDocxFlag.ts` | `VITE_ASSESSMENT_DOCX_ENABLED` |
| `src/utils/assessmentReportViewFlag.ts` | `VITE_ASSESSMENT_REPORT_VIEW` |
| `src/utils/auditProgramEditStubFlag.ts` | `VITE_AUDIT_PROGRAM_EDIT` |
| `src/utils/auditsFindingsAndReportViewFlag.ts` | `VITE_AUDITS_FINDINGS_AND_REPORT_VIEW` |
| `src/utils/auditsReportChainFlag.ts` | `VITE_AUDITS_REPORT_CHAIN` |
| `src/utils/auditsScaleAndPolishFlag.ts` | `VITE_AUDITS_SCALE_AND_POLISH` |
| `src/utils/backToChatButtonFlag.ts` | `VITE_BACK_TO_CHAT_BUTTON` |
| `src/utils/backToChatShortcutFlag.ts` | `VITE_BACK_TO_CHAT_SHORTCUT` |
| `src/utils/bargeInToastFlag.ts` | `VITE_BARGE_IN_TOAST` |
| `src/utils/billingSelfServeFlag.ts` | `VITE_BILLING_SELF_SERVE` |
| `src/utils/canvasDevDiagnosticsFlag.ts` | `VITE_DEV_DIAGNOSTICS` |
| `src/utils/canvasNewDocOptionsFlag.ts` | `VITE_CANVAS_NEW_DOC_OPTIONS` |
| `src/utils/canvasObjectEditBarFlag.ts` | `VITE_CANVAS_OBJECT_EDIT_BAR` |
| `src/utils/canvasUndoInRailOnlyFlag.ts` | `VITE_CANVAS_UNDO_IN_RAIL_ONLY` |
| `src/utils/chatSignalsFeedFlag.ts` | `VITE_CHAT_SIGNALS_FEED` |
| `src/utils/clientReaderFlag.ts` | `VITE_CLIENT_READER_ENABLED` |
| `src/utils/clientVaultFlag.ts` | `VITE_CLIENT_VAULT` |
| `src/utils/criterionWorkspaceV2Flag.ts` | `VITE_CRITERION_WORKSPACE_V2` |
| `src/utils/deckArchitectFlag.ts` | `VITE_DECK_ARCHITECT_ENABLED` |
| `src/utils/drdReportFlag.ts` | `VITE_DRD_REPORT_ENABLED` |
| `src/utils/drdScoringV2Flag.ts` | `VITE_DRD_SCORING_V2` |
| `src/utils/exceleEditFlag.ts` | `VITE_EXCELE_EDIT_ENABLED` |
| `src/utils/exceleFlag.ts` | `VITE_EXCELE_ENGINE_ENABLED` |
| `src/utils/exceleRightRailFlag.ts` | `VITE_EXCELE_RIGHT_RAIL_ENABLED` |
| `src/utils/financeEvBasketFlag.ts` | `VITE_FINANCE_EV_BASKET` |
| `src/utils/financeValuePanelsFlag.ts` | `VITE_FINANCE_VALUE_PANELS` |
| `src/utils/flagsPanelDescriptionExpandFlag.ts` | `VITE_FLAGS_PANEL_DESCRIPTION_EXPAND` |
| `src/utils/flagsPanelDocLinksFlag.ts` | `VITE_FLAGS_PANEL_DOC_LINKS` |
| `src/utils/flagsPanelFilterEscapeClearFlag.ts` | `VITE_FLAGS_PANEL_FILTER_ESCAPE_CLEAR` |
| `src/utils/flagsPanelFilterFlag.ts` | `VITE_FLAGS_PANEL_FILTER` |
| `src/utils/flagsPanelGroupingFlag.ts` | `VITE_FLAGS_PANEL_GROUPING` |
| `src/utils/flagsPanelOverrideUrlCopyFlag.ts` | `VITE_FLAGS_PANEL_OVERRIDE_URL_COPY` |
| `src/utils/flagsPanelRowShortcutsFlag.ts` | `VITE_FLAGS_PANEL_ROW_SHORTCUTS` |
| `src/utils/flagsPanelShortcutCheatSheetFlag.ts` | `VITE_FLAGS_PANEL_SHORTCUT_CHEAT_SHEET` |
| `src/utils/flagsPanelStickyGroupHeadersFlag.ts` | `VITE_FLAGS_PANEL_STICKY_GROUP_HEADERS` |
| `src/utils/flagsResetUrlFlag.ts` | `VITE_FLAGS_RESET_URL` |
| `src/utils/flagsSnapshotCopyFlag.ts` | `VITE_FLAGS_SNAPSHOT_COPY` |
| `src/utils/ideaBottomBarUnifiedFlag.ts` | `VITE_IDEA_BOTTOM_BAR_UNIFIED` |
| `src/utils/ideaDecisionLogFlag.ts` | `VITE_IDEA_DECISION_LOG` |
| `src/utils/ideaDetailsInPanelFlag.ts` | `VITE_IDEA_DETAILS_IN_PANEL` |
| `src/utils/ideaFinancialCaseFlag.ts` | `VITE_IDEA_FINANCIAL_CASE` |
| `src/utils/ideaTableGuidedBarFlag.ts` | `VITE_IDEA_TABLE_GUIDED_BAR` |
| `src/utils/ideaTopBarOneLineFlag.ts` | `VITE_IDEA_TOP_BAR_ONE_LINE` |
| `src/utils/ideasPreviewOverlayFlag.ts` | `VITE_IDEAS_PREVIEW_OVERLAY` |
| `src/utils/initiativeBridgeFlag.ts` | `VITE_INITIATIVE_BRIDGE` |
| `src/utils/initiativeDedupActionableFlag.ts` | `VITE_INITIATIVE_DEDUP_ACTIONABLE` |
| `src/utils/initiativesBulkStubFlag.ts` | `VITE_INITIATIVES_BULK_STUB` |
| `src/utils/inputCharCounterFlag.ts` | `VITE_INPUT_CHAR_COUNTER` |
| `src/utils/inputHintStripFlag.ts` | `VITE_INPUT_HINT_STRIP` |
| `src/utils/inputSoftLimitToastFlag.ts` | `VITE_INPUT_SOFT_LIMIT_TOAST` |
| `src/utils/interviewCreatorShellFlag.ts` | `VITE_INTERVIEW_CREATOR_SHELL` |
| `src/utils/interviewPendingReviewTabFlag.ts` | `VITE_INTERVIEW_PENDING_REVIEW_TAB` |
| `src/utils/interviewPipelineStepperFlag.ts` | `VITE_INTERVIEW_PIPELINE_STEPPER` |
| `src/utils/m03InboxStandardTableFlag.ts` | `VITE_M03_INBOX_STANDARD_TABLE` |
| `src/utils/m03TasksStandardTableFlag.ts` | `VITE_M03_TASKS_STANDARD_TABLE` |
| `src/utils/m05DecisionWorkspaceFlag.ts` | `VITE_M05_DECISION_WORKSPACE` |
| `src/utils/melsDeckBuilderFlag.ts` | `VITE_MELS_DECK_BUILDER` |
| `src/utils/melsPrezentacjeFlag.ts` | `VITE_MELS_PREZENTACJE` |
| `src/utils/melsTabeleFlag.ts` | `VITE_MELS_TABELE` |
| `src/utils/myWorkTwoLevelNavFlag.ts` | `VITE_MYWORK_TWO_LEVEL_NAV` |
| `src/utils/navDeclutterFlag.ts` | `VITE_NAV_DECLUTTER` |
| `src/utils/nextModelChipFlag.ts` | `VITE_NEXT_MODEL_CHIP` |
| `src/utils/orgRedesignFlag.ts` | `VITE_ORG_REDESIGN_V1_ENABLED` |
| `src/utils/piiHeuristicSessionDismissFlag.ts` | `VITE_PII_HEURISTIC_SESSION_DISMISS` |
| `src/utils/piiHeuristicToastFlag.ts` | `VITE_PII_HEURISTIC_TOAST` |
| `src/utils/privateModeDetailsFlag.ts` | `VITE_PRIVATE_MODE_DETAILS` |
| `src/utils/recordProvenanceFlag.ts` | `VITE_RECORD_PROVENANCE` |
| `src/utils/scimGroupSyncFlag.ts` | `VITE_SCIM_GROUP_SYNC` |
| `src/utils/siriPmV2Flag.ts` | `VITE_SIRI_PM_V2` |
| `src/utils/ssoSelfServiceFlag.ts` | `VITE_SSO_SELF_SERVICE` |
| `src/utils/studioFlag.ts` | `VITE_STUDIO_ENABLED` |
| `src/utils/tabeleAiEditorFlag.ts` | `VITE_TABELE_AI_EDITOR` |
| `src/utils/tabeleConversionsFlag.ts` | `VITE_TABELE_CONVERSIONS` |
| `src/utils/tabeleFormIntakeFlag.ts` | `VITE_TABELE_FORM_INTAKE` |
| `src/utils/tabeleQaFlag.ts` | `VITE_TABELE_QA` |
| `src/utils/tabeleSourcePackFlag.ts` | `VITE_TABELE_SOURCE_PACK` |
| `src/utils/templateEditorFlag.ts` | `VITE_TPL_EDITOR_ENABLED` |
| `src/utils/templateLifecycleFlag.ts` | `VITE_TEMPLATE_LIFECYCLE` |
| `src/utils/templatesGalleryFlag.ts` | `VITE_GALERIA_SZABLONOW_ENABLED` |
| `src/utils/toolsInsightsWiringFlag.ts` | `VITE_TOOLS_INSIGHTS_WIRING` |
| `src/utils/triModeFlag.ts` | `VITE_TRI_TRYBY` |
| `src/utils/trustBadgeCitationDomainFlag.ts` | `VITE_TRUST_BADGE_CITATION_DOMAIN` |
| `src/utils/trustBadgeCitationLinksFlag.ts` | `VITE_TRUST_BADGE_CITATION_LINKS` |
| `src/utils/trustBadgeCopyCitationsFlag.ts` | `VITE_TRUST_BADGE_COPY_CITATIONS` |
| `src/utils/trustBadgeCopyReasoningFlag.ts` | `VITE_TRUST_BADGE_COPY_REASONING` |
| `src/utils/trustBadgeFlag.ts` | `VITE_TRUST_BADGE` |
| `src/utils/trustBadgeHumanizeModelFlag.ts` | `VITE_TRUST_BADGE_HUMANIZE_MODEL` |
| `src/utils/trustBadgeReasoningFlag.ts` | `VITE_TRUST_BADGE_REASONING` |
| `src/utils/vf1CanvasSpecAFlag.ts` | `VITE_VF1_CANVAS_SPECA` |
| `src/utils/vf1InitSpecAFlag.ts` | `VITE_VF1_INIT_SPECA` |
| `src/utils/voiceFunnelTelemetryFlag.ts` | `VITE_VOICE_FUNNEL_TELEMETRY` |
| `src/utils/voiceLegendCopyTextFlag.ts` | `VITE_VOICE_LEGEND_COPY_TEXT` |
| `src/utils/voiceLegendShortcutFlag.ts` | `VITE_VOICE_LEGEND_SHORTCUT` |
| `src/utils/voiceModeLegendFlag.ts` | `VITE_VOICE_MODE_LEGEND` |
| `src/utils/whiteboardSessionInPanelFlag.ts` | `VITE_WHITEBOARD_SESSION_IN_PANEL` |
| `src/utils/workspaceBreadcrumbConversationFlag.ts` | `VITE_WORKSPACE_BREADCRUMB_CONVERSATION` |
| `src/utils/workspaceBreadcrumbFlag.ts` | `VITE_WORKSPACE_BREADCRUMB` |
| `src/utils/workspaceBreadcrumbRecentsArrowKeysFlag.ts` | `VITE_WORKSPACE_BREADCRUMB_RECENTS_ARROW_KEYS` |
| `src/utils/workspaceBreadcrumbRecentsFlag.ts` | `VITE_WORKSPACE_BREADCRUMB_RECENTS` |
| `src/utils/workspaceBreadcrumbRecentsPinnedFlag.ts` | `VITE_WORKSPACE_BREADCRUMB_RECENTS_PINNED` |
| `src/utils/workspaceBreadcrumbRecentsTriggerArrowFlag.ts` | `VITE_WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW` |
| `src/utils/workspaceBreadcrumbRecentsTriggerArrowUpFlag.ts` | `VITE_WORKSPACE_BREADCRUMB_RECENTS_TRIGGER_ARROW_UP` |
| `src/utils/workspaceBreadcrumbRecentsViewAllFlag.ts` | `VITE_WORKSPACE_BREADCRUMB_RECENTS_VIEW_ALL` |

## 3. Dowód w buildzie (nie tylko `vitest`)

Codemod użyty do naprawy: `scripts/dev/fix-split-import-meta-env.mjs`
(jednorazowy, ale zostawiony w repo jako dokumentacja + `--check` = ta sama
logika detekcji co poniższy strażnik). Zastosowany do wszystkich 108 plików,
zweryfikowany:
- `node scripts/dev/fix-split-import-meta-env.mjs --check` → `0` naruszeń.
- `esbuild <plik>` per plik (108/108) → **0 błędów składni**.
- `prettier --write` na 108 plikach → zero rozjazdów formatowania względem
  reszty repo (printWidth 100, styl projektu).

Nowy stały strażnik: **`scripts/check-flags-env-static.mjs`**. Dwa kroki:

**(a) Skan regexem** (uogólniony poza dokładny tekst 108 plików — łapie
deklarację `const IDENT = import.meta as ...;` w DOWOLNYM kształcie castu i
sprawdza, czy `IDENT` jest później czytany jako `IDENT?.env`/`IDENT.env` w
OSOBNEJ instrukcji):

```
$ node scripts/check-flags-env-static.mjs --scan-only
[check-flags-env-static] (a) skan OK — 0 rozdzielonych wzorcow (sprawdzono 177 plikow).
```

**(b) Dowód w buildzie** — esbuild (bundle, `platform: browser`, format cjs,
`--define:import.meta.env={...VITE_*:"true"}`) buduje probnik
`scripts/dev/probe/envFlagsBuildProof.entry.ts`, który importuje 3 naprawione
flagi (`assessmentDocxFlag`, `financeValuePanelsFlag`, `initiativeBridgeFlag`
— reprezentują 3 różne kształty rozstrzygania: proste `parsed === null ?
false : parsed`, `?? ... ?? false` z cache, `?? ... ?? false` bez cache),
uruchamia zbundlowany kod i sprawdza, że wszystkie 3 flagi zwracają `true`:

```
$ node scripts/check-flags-env-static.mjs
[check-flags-env-static] (a) skan OK — 0 rozdzielonych wzorcow (sprawdzono 177 plikow).
[check-flags-env-static] (b) dowod builda OK — esbuild bundle (platform browser) z
  --define:import.meta.env={"VITE_ASSESSMENT_DOCX_ENABLED":"true","VITE_FINANCE_VALUE_PANELS":"true","VITE_INITIATIVE_BRIDGE":"true"}
  daje {"assessmentDocx":true,"financeValuePanels":true,"initiativeBridge":true}.
```

**Dowód mutacyjny na samym strażniku** (wykonany ręcznie przy pisaniu):
przywrócono rozdzielony wzorzec w `assessmentDocxFlag.ts` → `--scan-only`
zgłosił naruszenie i skończył kodem 1; po przywróceniu naprawionej wersji →
`0` naruszeń, kod 0.

Skrypt wpięty:
- `package.json` → `check:flags-env-static` (pełny, a+b) i
  `check:flags-env-static:scan-only` (samo a, szybkie).
- `.husky/pre-commit`, punkt 13 — odpala się, gdy commit dotyka `src/**/*.ts(x)`
  (analogicznie do punktu 8, `check-focus-canon.sh`). Zweryfikowane na żywo:
  odpalił się i przeszedł przy commicie tego samego dyżuru.

## 4. Testy jednostkowe — dowód mutacyjny dla 5 plików z listy

5 plików `*.envStaticRead.test.ts` na wzór
`src/utils/__tests__/zaiTeresaFlag.envStaticRead.test.ts` — bronią KSZTAŁTU
odczytu w źródle (po zdjęciu komentarzy), bo test runtime'owy (`vitest`)
niczego by nie złapał: vitest sam podstawia prawdziwe `import.meta.env`
niezależnie od kształtu kodu, więc i zepsuta, i naprawiona wersja
przechodzą jednakowo w środowisku testowym.

| Test | Plik pod testem | Dowód mutacyjny wykonany |
|---|---|---|
| `src/utils/__tests__/assessmentDocxFlag.envStaticRead.test.ts` | `assessmentDocxFlag.ts` | TAK — przywrócono `const meta = import.meta as ...; meta?.env?.[ENV_KEY]` → oba testy czerwone; przywrócono naprawę → zielone. |
| `src/utils/__tests__/financeValuePanelsFlag.envStaticRead.test.ts` | `financeValuePanelsFlag.ts` | TAK — jw. → test 1 czerwony; naprawa → zielony. |
| `src/utils/__tests__/initiativeBridgeFlag.envStaticRead.test.ts` | `initiativeBridgeFlag.ts` | TAK — jw. → test 1 czerwony; naprawa → zielony. |
| `src/utils/__tests__/assessmentOutputArtifactsFlag.envStaticRead.test.ts` | `assessmentOutputArtifactsFlag.ts` | TAK — zamieniono `const env = (import.meta as unknown as {...}).env;` na `const meta = import.meta as unknown as {...}; const env = meta?.env;` → oba testy czerwone; przywrócenie → zielone. |
| `src/components/ResultsVNext/__tests__/resultsVNextFeatureFlags.envStaticRead.test.ts` | `resultsVNextFeatureFlags.ts` (`readEnv`) | TAK — jw. → oba testy czerwone; przywrócenie → zielone. |

Wynik uruchomienia wszystkich 5 (10 testów) na naprawionym stanie:

```
Test Files  5 passed (5)
     Tests  10 passed (10)
```

Efekt uboczny naprawiony przy pisaniu testów: pierwsza wersja
`scripts/check-flags-env-static.mjs` skanowała TAKŻE pliki `__tests__/*.test.ts`
i łapała WŁASNY tekst dokumentacyjny tych 5 nowych testów (docstring cytujący
zepsuty wzorzec jako przykład) jako fałszywe naruszenie. Naprawione: skan (a)
teraz zdejmuje komentarze przed dopasowaniem i pomija katalogi `__tests__/`
oraz pliki `*.test.ts(x)` — chronimy pliki produkcyjne, nie prozę testów,
która CELOWO cytuje zły wzorzec.

## 5. Skutek dla stagingu (jedno zdanie)

Z **30 zmiennych `VITE_*` ustawionych dziś na Railway** — te, które
odpowiadają którejkolwiek z **108 flag z tabeli w sekcji 2** (czyli każda,
której nazwa `VITE_*` pasuje do kolumny prawej w tabeli — w tym
`VITE_ASSESSMENT_DOCX_ENABLED`, `VITE_FINANCE_VALUE_PANELS`,
`VITE_INITIATIVE_BRIDGE` i pozostałe 105), **zaczną faktycznie działać
dopiero PO wdrożeniu tej gałęzi** — do tego momentu były martwe niezależnie
od wartości ustawionej na Railway, bo `vite build` nigdy nie podstawiał
obiektu `import.meta.env` w te 108 miejsc; `VITE_ASSESSMENT_OUTPUT_ARTIFACTS_ENABLED`
i klucze z `resultsVNextFeatureFlags.ts` (`VITE_RESULTS_VNEXT_*`) już działały
przed tym dyżurem i nie zmieniają zachowania.

## 6. Commity (branch `agent/flagi-env-statyczny-odczyt-20260905`, z `m03`)

1. `de229c15b5` — `fix(env-flags): napraw 108 rozdzielonych odczytow import.meta.env`
   (codemod `scripts/dev/fix-split-import-meta-env.mjs` + 108 plików źródłowych).
2. `e497aa4d55` — `feat(guard): dodaj scripts/check-flags-env-static.mjs (dowod builda + skan)`
   (nowy strażnik + probnik + wpięcie do pre-commit/package.json).
3. `f3f744fd14` — `test(env-flags): dowod mutacyjny dla 5 flag z listy "na pewno obejmij"`
   (5 nowych testów + naprawa false-positive w strażniku).

Zero `git push` (worktree robotnika, zgodnie z zakazem). Do scalenia przez
nadzorcę sesji głównej.
