# A2 — Inwentarz paneli podglądu (preview pane) vs kanon §7.3

Data: 2026-07-21 (uzupełnione A2b 2026-07-21) · Źródło: `origin/demo` (czytane przez `git show origin/demo:<ścieżka>`, NIE z checkoutu roboczego) · Autor: sesja audytowa (Claude) + 1 agent pomocniczy (batch „duże huby", zwrócił pełny materiał) + dokończenie A2b (Claude, batch „MyWork/Reports/Assessment").

## ⚠️ POKRYCIE — CZYTAJ PRZED UŻYCIEM

**A2b (2026-07-21): dokument DOMKNIĘTY.** Pierwotna sesja skończyła się w trakcie pracy — batch
„MyWork/Reports/Assessment" (11 plików) nie zdążył wrócić z materiałem i wisiał w sekcji (e) jako
NIEZBADANE. **Sprawdzone i potwierdzone: nie istnieje żaden osobny raport cząstkowy z tego batcha**
(`git log --all --diff-filter=A -- "**/_ANALIZA*"`, `git rev-list --all --objects | grep -i ANALIZA`,
worktree `.worktrees/a2-preview-inventory` — poza tym dokumentem samym nic się nie znalazło). Zadanie
A2b wykonało tę analizę od zera, tą samą metodą (grep `Standard*`/`Preview*` na `origin/demo`, per
plik: 7 stref z dowodem plik:linia), dopisując Grupy 4-5 niżej.

**Pokrycie teraz: 26 ekranów/tabów w 25 plikach** (oryginalne 15 + 10 nowych plików w Grupach 4-5,
`MyProjects.tsx` liczony jako 1 plik z 2 instancjami preview). Obejmuje wzorzec referencyjny
(Insights — ale patrz ★ niżej), najgorszy przypadek (Interview→Initiatives tab), najszerzej
reużywany komponent (`InitiativePreviewV3.tsx` — 5 modułów), najbardziej „głośny" ekran z przeglądu
Piotra (Ideas), wszystkie duże moduły biznesowe (Finance/Execution/Initiatives/Results/Audit/Meeting),
3 ekrany superadmin, cały moduł Assessment (3 taby), cały ReportBuilder (2 ekrany), cały
ReportsAndPresentations (3 taby) i resztę MyWork (Decisions/Focus/Inbox/Projects×2).

★ **Najważniejsze nowe ustalenie A2b:** `src/components/MyWork/DecisionPreviewPanel.tsx` — plik,
który `StandardPreview.tsx` cytuje jako **SSOT wzorca** we własnym docstringu (`StandardPreview.tsx`
L6: *„SSOT wzorca: My Work Decisions preview"*) — **ma ten sam defekt TYPE 11** (duplikat „Open"),
tylko pod inną etykietą („More info"), więc niewidoczny dla dosłownego grepa po stringu „Open"/
„Edytuj" (reguła (d)#14), ale łapany przez regułę referencyjną (d)#8. Patrz Grupa 4 i zaktualizowana
sekcja (c).

## KANON — przypomnienie (SSOT: `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` §7.3)

7 stref, sztywna kolejność góra→dół, strefa bez treści = **ukryta** (nie pusty box), kolejność
obecnych stref się nie zmienia:

1. **HEADER** (sticky): tytuł + pin/kopiuj (opc.) + „Open" (JEDYNE Open w preview) + „×"
2. **META BAR**: chipy status/typ/priorytet/SLA/data — stan, nie treść (`PreviewMetaCard`)
3. **DETAILS**: centrum, scroll, nagłówek „Details" + licznik „~N słów" + kebab ⋮ (kanon: Rozwiń/Zwiń·Kopiuj·Kopiuj prompt·Export·Pobierz) (`PreviewDetailsSection`)
4. **AI**: chipy Podsumuj/Zasugeruj, w karcie z ramką (`PreviewAIHintStrip`)
5. **RELATIONS** (jeśli są): pigułki KLIKALNE (`PreviewRelations`)
6. **CO DALEJ** (create-strip, opcjonalny): zwarte pigułki `h-8 rounded-full`, grupy „Dokumenty"/„W aplikacji" (§7.3a)
7. **ACTIONS** (opcjonalny, `h-9 rounded-full`): anty-duplikacja — nie dubluj Open (już w headerze) ani eksportu (już w kebabie Details)

MUST: stopka (4→7) w kolejności **AI → Relations → Co dalej → Actions**, karty `space-y-2.5`, **bez dividerów**.

---

## (a) Tabela zgodności — ekrany zbadane

Legenda: ✅ zgodne · ⚠️ obecne ale z odchyleniem · ❌ brak/łamie kanon · ➖ świadomie pominięte (zgodne z regułą „brak treści = ukryte") · `—` prop w ogóle nieprzekazany (różne od ❌ pustej tablicy)

### Grupa 1 — Interview module

| Ekran / tab | 1 Header | 2 Meta | 3 Details | 4 AI | 5 Relations | 6 Co dalej | 7 Actions | Kolejność | Sekcje SPOZA kanonu |
|---|---|---|---|---|---|---|---|---|---|
| **Interview → Insights** (WZORZEC) — `InterviewInsightPreview.tsx` | ✅ | ✅ | ✅ kebab=dokładnie kanon (L104-140) | ✅ | ➖ celowo pominięte (L176 komentarz) | ✅ `ArtifactActionPanel compact` (L184-199) | ➖ brak, Open tylko w headerze | ✅ idealna | brak |
| **Interview → Assigned** (tryb kart, taby `my_assignments`/`managed`) — `InterviewAssignmentPreview.tsx` + `InterviewHub.tsx` L8461-8607 | ✅ | ✅ (L60-72) | ⚠️ kebab custom: Expand/Summarize/Copy (L74-79), NIE kanon Copy/Export/Pobierz | ✅ | ❌ 2 pozycje, ŻADNA bez `onClick` (typ `{label,tone}` nie ma nawet pola onClick) — `InterviewHub.tsx` L8530-8539, mapping bez onClick `InterviewAssignmentPreview.tsx` L122-125 | ❌ brak | ✅ `PreviewActionBar` (Start/Continue/Fix) | ✅ (brak Co dalej więc nie ma czego przestawić) | brak |
| **Interview → Inbox** (tryb listy, `StandardPreview` facada) — `InterviewHub.tsx` L8391-8450 | ✅ | ✅ status+progress pills, trailing=due (L8399-8419) | ⚠️ kebab = TYLKO Copy (L8420-8431), brak Export/Pobierz | ⚠️ obecne ale `disabled: true` na stałe (L8436) — funkcjonalnie martwe | ⚠️ warunkowe, item „session" MA onClick (L8439-8447) — jedyny w CAŁYM Interview module z realnie klikalną relacją | ❌ brak | ✅ `inboxPreviewActions` (L8449) | ✅ | brak |
| **Interview → Templates** — `InterviewTemplatePreview.tsx` + `InterviewHub.tsx` L7940-8097 | ✅ | ✅ (L68-93, zawiera `category`) | ⚠️ kebab custom: Edit/Duplicate/Delete (L99-122), NIE kanon | ✅ (L280) | ❌ 2 pozycje (`category`, `used`), ŻADNA nie ma `onClick` (L216-219) | ❌ brak | ✅ `PreviewActionBar` (L285) | ❌ **QUESTIONS wstawione MIĘDZY Details(3) a AI(4)** (L156-183) | QUESTIONS block (L156-183) |
| **Interview → Sessions** — `InterviewSessionPreview.tsx` + `InterviewHub.tsx` L6967-7032 | ✅ | ⚠️ `EntityStatusChip` renderowany jako WOLNOSTOJĄCY blok PRZED `PreviewMetaCard`, nie wewnątrz niej (L110-116) | ✅ kebab custom: toggle/copy-stats/copy-id (L85-105) | ✅ | ⚠️ zawsze renderowane (L203) | ❌ brak | ✅ warunkowe (L205) | ⚠️ status-chip poza Meta Bar = de facto dodatkowa pół-strefa przed strefą 2 | wolnostojący `EntityStatusChip` (L110-115) |
| **Interview → Initiatives** (tab WEWNĄTRZ Interview, drafty przed promocją) — `InterviewHub.tsx` L7360-7414 (body) + L7510-7554 (footer) + `InterviewInitiativePreview.tsx` | ✅ | ❌ **BRAK `PreviewMetaCard`** — bespoke `<div>` z chipami (L7375-7392) | ❌ **BRAK `PreviewDetailsSection`** — zwykły `<div>`, zero kebaba, zero licznika słów (L7393-7406) | ⚠️ zawsze `disabled` (`InterviewInitiativePreview.tsx` L113-124, `onRunHint={() => {}}` no-op L120) | ❌ 3 pozycje (insight/priority/updated), ŻADNA `onClick` (L7514-7530) | ❌ brak | ✅ `PreviewActionBar` (L128) | ⚠️ strefy 2-3 nie istnieją jako kanon-komponenty, są zastąpione bespoke JSX | całe Meta+Details = custom JSX; **DUPLIKATY**: Priority (meta L7378 vs Relations L7519-7523), Updated (meta L7389-7391 vs Relations L7524-7530) |

### Grupa 2 — MyWork (częściowo)

| Ekran / tab | 1 Header | 2 Meta | 3 Details | 4 AI | 5 Relations | 6 Co dalej | 7 Actions | Kolejność | Sekcje SPOZA kanonu |
|---|---|---|---|---|---|---|---|---|---|
| **MyWork → Ideas** — `IdeasTableContent.tsx` L560-681 | ✅ (poza plikiem, wrapper) | ✅ (L584-597) | ✅ `PreviewDetailsSection` z zagnieżdżonym „Context" w `children` (L599-614) — kompatybilne, wewnątrz Details, nie obok | ✅ (L657) | ⚠️ warunkowe (tylko gdy `sourceType`), emptyLabel fallback (L659-662) | ⚠️ obecne, ALE `ConvertToOutputMenu variant="inline"` (L671-677): `rounded-md` nie `rounded-full`, BRAK grupowania „Dokumenty"/„W aplikacji", 7 targetów (w tym `financial_model/budget/valuation/analysis` spoza kanonicznych 6) | ✅ `PreviewActionBar` Convert/Open Flow (L634-652) | ❌ **Actions(7) PRZED Co dalej(6)** — odwrotna kolejność (L634-680) | brak dodatkowych, ale kolejność 6↔7 odwrócona |

### Grupa 3 — Duże huby modułowe (batch zwrócony w pełni)

| Ekran / tab | 1 Header | 2 Meta | 3 Details | 4 AI | 5 Relations | 6 Co dalej | 7 Actions | Kolejność | Sekcje SPOZA kanonu |
|---|---|---|---|---|---|---|---|---|---|
| **Audit** (jedyny tab) — `AuditsHub.tsx` L688 | ✅ **celowo BRAK `onOpenFull`** (komentarz L691-694: preview JEST pełnym widokiem) | ✅ 2 pille | ⚠️ kebab tylko `onCopy` (L734-738) | ⚠️ `disabled:true` na stałe | ❌ `config.plan` mapowane, bez `onClick` (L745-755), zawsze tablica | ❌ brak | ✅ Generate surveys + Delete | ✅ | brak — **WZORZEC anty-duplikacji Open** |
| **Finance → Statements** — `FinanceHub.tsx` L2542 | ✅ | ✅ status+completeness | ⚠️ kebab tylko `onCopy` | ⚠️ `disabled:true` | ⚠️ `childStatements` mapowane, MAJĄ `onClick` (L2593-2598) — ale `onClick` woła **ten sam** `handleOpenFull` co header = pseudo-interaktywne | ❌ brak | ✅ `statementPreviewActions` | ✅ | brak |
| **Finance → pozostałe** (models/prediction/analysis/investment/valuation) — `FinanceHub.tsx` L2851 + `FinancePreviewPanel.tsx` | ✅ | ➖➖ **celowo pominięte** (komentarz L2841-2850 „avoid double-rendering") — zastąpione `children` | ➖➖ jw. — własny `PreviewMetaCard`+`PreviewDetailsSection` wewnątrz `renderPreviewBody` (`FinancePreviewPanel.tsx:498-520`), kebab = TYLKO „More" → **duplikuje Open** | wewnątrz `children`, osobny AI blok | wewnątrz `children`, `PreviewRelations` | ❌ brak | wewnątrz `children`, WŁASNY action bar + kanoniczny `actions` prop RÓWNOLEGLE | ❌ **jawne `border-t ... my-3` dividery** w `renderPreviewFooter` (`FinancePreviewPanel.tsx` L1243, L1254) — łamie MUST | Pack health, `ModelStatementPreview`, walidacje, scenariusze budżetowe, ratio summary, DCF+sensitivity+advisory+negotiation-pack (`FinancePreviewPanel.tsx:522-908`), `FinanceVersionTimeline` w footerze |
| **Execution → Reports** — `ExecutionHub.tsx` L5046 | ✅ | ✅ RAG+cadence | ⚠️ kebab tylko `onCopy` | ✅ | ❌ `dataSources.map`, bez `onClick` | ❌ brak (ale patrz „Expected Follow-up Actions" niżej) | ✅ `reportPreviewActions` | ❌ **`children` (`renderReportPreviewBody`, L4770-4947) DUBLUJE treść już pokazaną w Meta/Relations** | RAG+cadence duplikat meta (L4806-4814); title+audience duplikat header+meta.trailing (L4816-4824); „Data Sources" (L4855-4870) duplikuje 1:1 `relations` (ten sam `report.dataSources` renderowany 2×); „AI Executive Readout" (L4872-4886) — DRUGI blok podpisany „AI"; „Expected Follow-up Actions" (L4910-4925) — pigułki imitujące „Co dalej" bez `onClick`, poza `whatsNext` |
| **Execution → List/Portfolio** — `ExecutionHub.tsx` L5677 | ✅ | ✅ status+progress% | ⚠️ kebab tylko `onCopy` | ✅ | ❌ warunkowe, bez `onClick` | ❌ brak | ✅ `listPreviewActions` | ✅ | progress%/deadline zduplikowane meta↔details.text |
| **Initiatives → tab „table"** — `InitiativesHub.tsx` L2046 | ✅ | ✅ status+priority | ⚠️ kebab tylko `onCopy` | ✅ | ✅ **JEDYNE w całym batchu B z realną nawigacją** — `onClick: navigate(...)` (warunkowe, sourceType&&sourceId) | ❌ brak | ✅ `tablePreviewActions` | ✅ | brak |
| **Initiatives → taby grid/kanban/timeline** — `InitiativesHub.tsx` L2128+ (bespoke system, `InitiativePreviewV3Body/Footer` via `TableWithPreviewLayout`, NIE `StandardPreview`) | ❌ **BRAK w ogóle** — `onOpenFull` nieprzekazany do `TableWithPreviewLayout` (mimo że komponent to wspiera, `TableWithPreviewLayout.tsx` L296-300) | ✅ | ✅ kebab: toggle/summarize/make-document/copy/copy-md/copy-slack (6 custom, brak export/download) | ✅ | ❌ source+tasks count, bez `onClick`, zawsze ≥1 element | ❌ brak | ✅ Open żyje TYLKO tutaj (L576-587) | ❌ **jawne `border-t` dividery** (`InitiativePreviewV3.tsx` L635, L639) — ta sama wada co Finance | `FinancialAnalysisCard`(L277,444-493) + `LinkedFinanceModels`(L373-442) + Interview/Insight Lineage(L279-312) między Details a AI |
| **Meeting** (jedyny tab) — `MeetingHub.tsx` L811 | ✅ | ✅ status | ⚠️ kebab tylko `onCopy` | ✅ **content realny** (hints/loading/error/result z Operator Brief — poprawne rozszerzone użycie API, WZORZEC dla strefy 4) | ❌ warunkowe, bez `onClick` | ❌ brak | ✅ `listPreviewActions` | ✅ | brak |
| **Results → catalog** (jedyny StandardPreview w pliku — L2262 to komentarz, nie 2. wystąpienie) — `ResultsHub.tsx` L1822 | ✅ | ✅ status+warunkowe | ⚠️ kebab tylko `onCopy` | ⚠️ `disabled:true` | ❌ warunkowe, bez `onClick` | ❌ brak | ✅ `catalogPreviewActions` | ✅ | brak |
| **ModelCatalogTable** (SuperAdmin) — L841 | ✅ (`onOpenFull=handleEdit`) | ✅ kind/provider/active+HealthBadge | ⚠️ kebab tylko `onCopy` | `—` nieprzekazany w ogóle (nie tylko disabled) | `—` nieprzekazany w ogóle | ❌ brak | ✅ Edit/Toggle/Test/Delete | ✅ | brak |
| **PromptRegistryTab** (SuperAdmin) — L315 | ✅ (świadomie bez `onOpenFull` — registry read-only) | ✅ module/owner/checksum+version | ⚠️ kebab tylko `onCopy` | `—` | `—` | `—` | `—` cały footer `undefined` → w ogóle nie renderowany | ✅ (3 z 7 stref, reszta świadomie pusta) | brak |
| **PartnerSettlementsView → Commissions** — L1105 | `—` bez `onOpenFull` | ✅ | ⚠️ kebab tylko `onCopy` | `—` | `—` | `—` | ✅ tylko „Approve" | ✅ | brak |
| **PartnerSettlementsView → Attribution** — L1244 | `—` | ✅ | ⚠️ kebab tylko `onCopy` | `—` | `—` | `—` | ✅ | ✅ | brak |
| **PartnerSettlementsView → Expiring** — L1309 | `—` | ✅ discount% | ❌ **BRAK kebaba w ogóle** (`hasMenu=false`) — jedyny taki przypadek w całym A2 | `—` | `—` | `—` | `—` cały footer pusty | ✅ (tylko Header+Meta+Details-bez-kebab) | brak |
| **PartnerSettlementsView → Analytics** — L1362 | `—` | ✅ partnerName+conversion% | ⚠️ kebab tylko `onCopy` | `—` | `—` | `—` | `—` | ✅ | brak |

### Grupa 4 — MyWork (dokończenie, A2b)

| Ekran / tab | 1 Header | 2 Meta | 3 Details | 4 AI | 5 Relations | 6 Co dalej | 7 Actions | Kolejność | Sekcje SPOZA kanonu |
|---|---|---|---|---|---|---|---|---|---|
| **MyWork → Decisions** (★ cytowany jako SSOT wzorca w `StandardPreview.tsx` L6) — `DecisionPreviewPanel.tsx`, bespoke `PreviewPaneShell` (L825-896 header/shell, L262-332 body, L334-529 footer) | ✅ ale patrz TYPE 11 niżej | ✅ `PreviewMetaCard` (L264-270) | ⚠️ kebab: Expand/Summarize/Copy/Copy as Markdown/Copy for Slack (L276-327) — **bogatszy niż dominujący wzorzec „tylko Copy", ale wciąż NIE literalnie „Export"/„Pobierz" z kanonu** | ✅ **w pełni funkcjonalna** (`PreviewAIHintStrip` z realnym `result`/`error`/`onRegenerate`, L466-476) — najwcześniejszy przykład dobrego wzorca strefy 4 w całym A2, poprzedza MeetingHub | ✅ `PreviewRelations` z realnymi `linkedItems` (L397-400), ALE bez `onClick` w mapowaniu → martwe | ➖ brak, niekanoniczne dla tego ekranu (workflow approve/reject, nie create-strip) | ✅ `PreviewActionBar` Approve/Reject + More info/Delegate (L402-460) | ✅ | brak |
| **MyWork → Focus** (side-panel per zaznaczony item) — `FocusView.tsx` L1857-1973 | ✅ (`actions` custom „Open" button L1863-1872) | ❌ **BRAK `PreviewMetaCard`** — bespoke `<div>` z typem/priorytetem/due-date (L1922-1960) | ❌ **BRAK `PreviewDetailsSection` — ZERO kebaba w ogóle** (opis renderowany jako zwykły `<p>`, L1962-1971) — trzeci taki przypadek w całym A2 obok PartnerSettlementsView→Expiring i MyProjects (Grupa 4/5) | ❌ **BRAK w ogóle** — nawet nie `disabled`, strefa nie istnieje | ❌ **BRAK `PreviewRelations`** — `initiativeName` pokazany jako zwykły tekst (L1955-1959), nie chip | ➖ brak | ⚠️ 4 bespoke `<button>` (Approve/Done, Snooze, Delegate, Remove, L1874-1918) — NIE `PreviewActionBar`/`ArtifactActionPanel` | — (nie ma stref 2/4/5 do ustawienia w kolejności) | **CAŁY panel bespoke** poza zewnętrznym `PreviewPaneShell` — zero importów `PreviewMetaCard`/`PreviewDetailsSection`/`PreviewAIHintStrip`/`PreviewRelations` w całym pliku (potwierdzone grepem) |
| **MyWork → Inbox** — `InboxContent.tsx`, bespoke `PreviewPaneShell` (L1492-1583) | ✅ „Open" (L1497-1503) | ✅ `PreviewMetaCard` (L1570) | ⚠️ kebab: Expand/Summarize/Copy + `extraCopyFormats` (Copy as MD/Copy for Slack, L1572-1579) — jak Decisions, bogatszy niż „tylko Copy" ale bez literalnego Export/Pobierz | ✅ `AIHintStrip` (komponent WŁASNY, nie `PreviewAIHintStrip` — inna nazwa tego samego wzorca, L1509-1520), realny content | ✅ `PreviewRelations` (L1523) z warunkowymi `linkedTaskId`/`linkedDecisionId` (L1481-1499 wyżej) — bez `onClick` gdy obecne → martwe; `[]` gdy brak obu → pusty box (TYPE 9) | ➖ brak | ✅ `PreviewActionBar` Today/Week/Later + Done/Save/Note/Dismiss (L1526) — **żadna pozycja nie duplikuje „Open"** (czysty wzorzec, jak MeetingHub dla strefy 7) | ✅ | ★ **NOWY TYPE 6**: `border-t border-c-border-subtle` divider przed „Undo last AI suggestion" (L1556) — trzeci potwierdzony divider w A2 obok `InitiativePreviewV3.tsx`/`FinancePreviewPanel.tsx` |
| **MyWork → Projects → Programs** (tab „programs", 1. instancja) — `MyProjects.tsx` L865-1046 | `—` **`onOpenFull` w ogóle nieprzekazany** (brak Open w headerze) | ✅ `meta.pills` (L868-879) | ❌ **ZERO kebaba** — `details.text` bez `onCopy`/`onExport`/`onDownload` (L881-889) — czwarty przypadek „brak kebaba w ogóle" w A2 | `—` nieprzekazany | `—` nieprzekazany | ➖ | ✅ `informational` Refresh/Edit/Delete (L890-923) — bez duplikatu Open (bo go nie ma w headerze) | ✅ (3 z 7 stref, reszta świadomie/nieświadomie puste) | **TYPE 1 potwierdzony**: `children` = Program rollup + Projects-in-program + Sub-programs (L925-1045), dokładnie jak w docstringu L12-13 „blok 3.5" |
| **MyWork → Projects → Projects** (tab „projects", 2. instancja) — `MyProjects.tsx` L1085-1415 | `—` **`onOpenFull` w ogóle nieprzekazany** (tylko `pinned`/`onTogglePin`, L1091-1092) | ✅ `meta.pills`+`trailing` (L1093-1110) | ❌ **ZERO kebaba** — `details.text` bez żadnej `onCopy`/`onExport` (L1111-1116) — piąty przypadek „brak kebaba" | `—` nieprzekazany | `—` nieprzekazany | ➖ | ✅ `previewActions` (edit/delete, zdefiniowane wyżej w pliku) | ✅ | **TYPE 1 potwierdzony**: `children` = Stakeholders (effective) + Finance rollup + Team (L1119-1310+), identyczny wzorzec co instancja 1 — **oba wystąpienia w tym samym pliku, ta sama choroba dwa razy** |

### Grupa 5 — Assessment / ReportBuilder / ReportsAndPresentations (dokończenie, A2b)

| Ekran / tab | 1 Header | 2 Meta | 3 Details | 4 AI | 5 Relations | 6 Co dalej | 7 Actions | Kolejność | Sekcje SPOZA kanonu |
|---|---|---|---|---|---|---|---|---|---|
| **AssessmentHub → 'list'** — `AssessmentHub.tsx` L1922-1974 (facada `StandardPreview`) | ✅ | ✅ | ⚠️ kebab tylko `onCopy` (L1958-1962) | ⚠️ `disabled:true` (L1969) | ❌ `relations={[]}` bezwarunkowo (L1972) → zawsze pusty box (TYPE 9) | ➖ | ✅ `listPreviewActions` | ❌ **TYPE 11**: `informational[0]` id `'open'` onClick `handleOpenDocument(selectedListRow)` (L1557-1563) = **DOKŁADNIE ten sam handler** co `onOpenFull` (L1925) | brak |
| **AssessmentHub → 'reports'** — `AssessmentHub.tsx` L2054-2114 | ✅ | ✅ | ⚠️ kebab tylko `onCopy` (L2093-2097) | `—` nieprzekazany | ❌ `relations={[]}` bezwarunkowo (L2099) | ➖ | ✅ `reportPreviewActions` | ❌ **TYPE 11**: `informational[0]` `handleOpenDocument(selectedReportRow)` (L1602-1609) = ten sam handler co `onOpenFull` (L2057) | **TYPE 1**: `children` = `ReportSlideOverContent` (L2107-2112) po Details, przed footer |
| **AssessmentHub → 'initiatives'** — `AssessmentHub.tsx` L2174-2225 | ✅ | ✅ | ⚠️ kebab tylko `onCopy` (L2217-2221) | `—` nieprzekazany | ❌ `relations={[]}` bezwarunkowo (L2223) | ➖ | ✅ `initiativePreviewActions` | ❌ **TYPE 11**: `informational[0]` `handleOpenDocument(selectedInitiativeRow)` (L1645-1652) = ten sam handler co `onOpenFull` (L2177) | brak |
| **AssessmentTable** (główna lista licencjonowanych narzędzi) — `AssessmentTable.tsx` L389-457 | ✅ | ✅ | ⚠️ kebab tylko `onCopy` (L437-441) | ⚠️ `disabled:true` (L443-450) | ⚠️ warunkowe `[{label,icon}]`/`[]` (L451-455), bez `onClick` gdy obecne | ➖ | ✅ `previewActions` | ❌ **TYPE 11 (wariant etykietowy)**: `informational[0]` id `'open-map'` label „Open in Map" onClick `onOpenInMap(previewAssessment.id)` (L284-289) = ten sam handler co `onOpenFull` (L395) — duplikat pod inną etykietą, jak DecisionPreviewPanel „More info" | brak |
| **ReportBuilder → Block Types** — `BlockTypesManager.tsx` L509-544 | ✅ (`onOpenFull={() => openEdit(previewBlock)}`, L512) | ✅ (L513-524) | ⚠️ kebab tylko `onCopy` (L537-541) | `—` nieprzekazany | `—` nieprzekazany | ➖ | ⚠️ **TYPE 11**: `resolutions[0]` id `'edit'` label „Edit" onClick `openEdit(previewBlock)` (L417-425) = **funkcjonalny duplikat** `onOpenFull` (sam handler, jak ModelCatalogTable Edit/Open) | ✅ (3 z 7 stref) | brak |
| **ReportBuilder → Templates** — `TemplatesManager.tsx` L614-651 | ⚠️ warunkowy: `undefined` dla systemowych szablonów, `() => openEditor(previewTemplate)` dla własnych (L617) — świadome zwolnienie, wzór jak AuditsHub | ✅ (L618-634) | ⚠️ kebab tylko `onCopy` (L646-648) | `—` nieprzekazany | `—` nieprzekazany | ➖ | ✅ **BEZ duplikatu Open** — `Use template`/`Duplicate`/`Delete` (L496-538), żadna nie woła `openEditor` | ✅ | **POZYTYWNY WZORZEC** — drugi po AuditsHub plik ze świadomym, poprawnym rozwiązaniem TYPE 11 |
| **Reports & Presentations → Outputs (aggregate)** — `OutputsAggregateTabContent.tsx` L1120-1196 | ✅ (`onOpenFull={() => openRow(previewItem)}`, L1123) | ✅ | ⚠️ kebab tylko `onCopy` (L1157-1161) | ⚠️ `disabled:true` (L1163-1169) | ⚠️ warunkowe `[{label:'Initiative linked'}]`/`[]` (L1171-1179), bez `onClick` | ➖ | ❌ **TYPE 11 NAJGORSZY PRZYPADEK W A2 — 3× ta sama funkcja**: `informational[0]` id `'open'` (L716-723) I `informational[1]` id `'open_sheet'` label **„Download XLSX"** (L725-735, flaga OFF) — **OBA wołają dosłownie `openRow(previewItem)`**, identyczny handler co `onOpenFull` (L1123). To jest **N1 z rejestru** („Download XLSX nic nie pobiera") — potwierdzone tu z pełnym dowodem: przycisk oznaczony jako pobieranie pliku otwiera wiersz, bo dzieli funkcję z „Open" | ✅ | **TYPE 1**: `children` = `TrustStatePreviewSection` + sheet-hint tekst (L1182-1195) po Details przed footer — **potwierdza, że TYPE 1 występuje NAWET przez fasadę `StandardPreview`** (nie tylko bespoke `PreviewPaneShell`), bo `StandardPreview.tsx` L373 renderuje `{children}` zaraz po `PreviewDetailsSection`, przed footerem `ai`/`relations`/`actions` |
| **Reports & Presentations → Presentations** — `PresentationsTabContent.tsx` L442-506 | ✅ | ✅ warunkowy `previewMeta` | ✅ **kebab zgodny z kanonem**: `onCopy` + `onExport` (Export PPTX, L461-467) — trzeci plik po Insights/(TemplatesManager częściowo) z formalnym Export | ⚠️ `disabled:true` (L469-473) | ⚠️ warunkowe `[{label:'Źródło: …'}]`/`[]` (L474-478), bez `onClick` | ➖ | ✅ **BEZ duplikatu Open** — `Start review`/`Udostępnij` (L479-505), żadna nie woła `openPresentation` | ✅ | **POZYTYWNY WZORZEC** — kebab Copy+Export zgodny z regułą (d)#3, actions bez TYPE 11 |
| **Reports & Presentations → Reports (Documents)** — `ReportsTabContent.tsx` L492-557 | ✅ | ✅ | ✅ **kebab zgodny z kanonem**: `onCopy` + `onExport` (Export PDF, L532-539) | ⚠️ `disabled:true` (L541-547) | ❌ `relations={[]}` bezwarunkowo (L549) | ➖ | ✅ **BEZ duplikatu Open** — tylko `start-review` warunkowy (L317-340) | ✅ | **TYPE 1**: `children` = `TrustStatePreviewSection` (L552-556) po Details przed footer, sam wzorzec co Outputs |

**Podsumowanie Grupy 4-5:** 11 nowo zbadanych plików (13 z liczonymi osobno instancjami/tabami) —
**8 z 13 ma TYPE 11** (duplikat Open, licząc warianty etykietowe), **4 z 13 mają zero kebaba w ogóle**
(Focus + MyProjects×2 — nowy rekord, poprzednio znany był 1 przypadek: PartnerSettlementsView→Expiring),
ale też **3 pozytywne wzorce nowe**: `TemplatesManager.tsx` i `PresentationsTabContent.tsx`/
`ReportsTabContent.tsx` (kebab Copy+Export zgodny z kanonem, bez duplikatu Open) — obok AuditsHub to
teraz **4 pliki bez TYPE 11**, dowód że wzorzec jest osiągalny, nie tylko teoretyczny.

### Częściowo potwierdzone (docstring, nie pełny kod) — NIE liczyć jako pełny dowód
*(Zamknięte przez A2b — `MyProjects.tsx` ma teraz pełny wiersz w Grupie 4 wyżej, obie instancje.)*

---

## (b) Defekty pogrupowane WEDŁUG TYPU

### TYPE 1 — Sekcje spoza kanonu wstawione MIĘDZY Details(3) a AI(4)
Wzorzec systemowy, potwierdzony w ≥5 miejscach:
- **Templates**: blok QUESTIONS, `InterviewTemplatePreview.tsx` L156-183
- **`InitiativePreviewV3.tsx`** (5 modułów: InitiativesHub grid/kanban/timeline, DiscoveryToolsHub, ExecutionHub, PortfolioAnalysisView, ResultsInitiativesView): `FinancialAnalysisCard` L277,444-493 + `LinkedFinanceModels` L373-442 + Interview/Insight Lineage L279-312
- **Finance → pozostałe taby**: cały `renderPreviewBody` z `FinancePreviewPanel.tsx` zastępuje meta+details własną wersją, do której dokłada Pack health/ModelStatementPreview/walidacje/scenariusze/ratio/DCF+heatmap+advisory (L522-908) — najbardziej rozbudowany przypadek w całym A2
- **Execution → Reports**: `renderReportPreviewBody` (`ExecutionHub.tsx` L4770-4947) — ale tu problem jest inny niż „dodatkowa treść": to **duplikacja** danych już pokazanych w kanonicznych strefach (patrz TYPE 12)
- **MyProjects.tsx — POTWIERDZONE PEŁNI przez A2b, OBIE instancje**: Programs (L925-1045: rollup + projects-in-program + sub-programs) i Projects (L1119-1310+: stakeholders + finance rollup + team) — dokładnie jak docstring L9-13 „blok 3.5" zapowiadał, teraz z pełnym dowodem plik:linia
- **★ A2b — potwierdza, że TYPE 1 istnieje NAWET przez fasadę `StandardPreview`, nie tylko bespoke `PreviewPaneShell`**: `StandardPreview.tsx` L373 renderuje `{children}` zaraz po `PreviewDetailsSection`, przed footerem `ai`/`relations`/`actions`. Dwa nowe potwierdzone przypadki: `OutputsAggregateTabContent.tsx` (`TrustStatePreviewSection` + sheet-hint, L1182-1195) i `ReportsTabContent.tsx` (`TrustStatePreviewSection`, L552-556) — obie idą PRZEZ `StandardPreview`, nie przez bespoke shell, więc root cause niżej dotyczy też „compliant" fasady, nie tylko bespoke kompozycji

Root cause: `StandardPreview`/`PreviewPaneShell`/`TableWithPreviewLayout` udostępniają
`children`/`renderPreview` jako JEDNO pole „body" renderowane w całości PRZED footerem — nie ma
oddzielnego slotu dla treści modułowej ponad Details. Moduł, który chce dodać coś ekstra, ląduje
automatycznie w tej samej pozycji, niezależnie od intencji. **A2b: dotyczy to również modułów, które
poprawnie używają kanonicznej fasady `StandardPreview`** — samo użycie fasady nie chroni przed TYPE 1,
bo `children` jest legalnym, udokumentowanym propem fasady, nie obejściem.

### TYPE 2 — Relations jako martwe `<span>` zamiast klikalnych `<button>`
Mechanizm: `src/components/shared/PreviewPane/PreviewRelations.tsx` L44: `const Tag = item.onClick ? 'button' : 'span';`
Potwierdzone bez `onClick` (dead): Interview→Assigned (`InterviewHub.tsx` L8530-8539), Interview→Templates (`InterviewTemplatePreview.tsx` L216-219), Interview→Initiatives tab (`InterviewHub.tsx` L7514-7530), `InitiativePreviewV3.tsx` (L556-570, 5 modułów), AuditsHub (L745-755), Finance→Statements (L2593-2598 — **ma `onClick`, ale duplikuje Open, patrz TYPE 11**), Execution→Reports i →List (bez onClick), MeetingHub (bez onClick), ResultsHub (bez onClick).

**Jedyne dwa wyjątki z realnym, sensownym `onClick`** w całym zbadanym zbiorze (Interview + 15 wystąpień hub):
1. Interview→Inbox, item „session" (`InterviewHub.tsx` L8439-8447)
2. **Initiatives→tab „table"** (`InitiativesHub.tsx` ok. L1934+, warunkowe `sourceType && sourceId`) — nawigacja do źródłowego rekordu

Na >15 zbadanych wystąpień Relations, **2 mają prawdziwą nawigację, 1 ma pseudo-nawigację (duplikuje
Open), reszta to statyczny tekst**. Wniosek: komponent bazowy wspiera interaktywność, ale prawie
żaden ekran jej nie używa — Relations funkcjonuje w praktyce jako drugi, gorszy Meta Bar.

### TYPE 3 — Kebab Details z niestandardowym/okrojonym zestawem akcji
Kanon (§7.3 pkt 3): Rozwiń/Zwiń·Kopiuj·Kopiuj prompt·Export do Tools·Pobierz. Jedyny ekran zgodny
1:1: Insights (`InterviewInsightPreview.tsx` L104-140, wzorzec).
Pozostałe odchylenia:
- Assigned: Expand/Summarize/Copy (`InterviewAssignmentPreview.tsx` L74-79)
- Templates: Edit/Duplicate/Delete (`InterviewTemplatePreview.tsx` L99-122) — zupełnie inna kategoria akcji (zarządzanie encją, nie treścią)
- Sessions: toggle/copy-stats/copy-id (`InterviewSessionPreview.tsx` L85-105)
- Inbox: tylko Copy
- **Cała Grupa 3 (9 z 9 hubów)**: kebab = **wyłącznie `onCopy`**, bez wyjątku (AuditsHub, Finance-Statements, Execution×2, Initiatives-table, Meeting, Results, ModelCatalogTable, PartnerSettlements×3) — brak Export/Pobierz WSZĘDZIE poza Insights
- InitiativePreviewV3: toggle/summarize/make-document/copy/copy-md/copy-slack (6 pozycji, ale wciąż brak formalnego export/download)
- **PartnerSettlementsView→Expiring: kebab NIE ISTNIEJE w ogóle** (`hasMenu=false`) — jedyny taki przypadek w całym A2
- Initiatives (tab w Interview): kebab NIE ISTNIEJE (patrz TYPE 4)
- **Grupa 4-5 (A2b), kebab wyłącznie Copy — 6 nowych**: AssessmentHub×3 taby (L1958,2093,2217), AssessmentTable (L437), BlockTypesManager (L537), OutputsAggregateTabContent (L1157)
- **Grupa 4-5 (A2b), kebab NIE ISTNIEJE w ogóle — 3 NOWE przypadki**, dołączają do PartnerSettlementsView→Expiring (razem 4 w całym A2): `FocusView.tsx` (L1962-1971, opis jako zwykły `<p>`, zero customActions), `MyProjects.tsx` Programs (L881-889) i Projects (L1111-1116) — **oba `details.text` bez `onCopy`/`onExport`/`onDownload`**
- **Grupa 4-5 (A2b), kebab BOGATSZY niż „tylko Copy" ale wciąż BEZ literalnego Export/Pobierz — 2 nowe**: `DecisionPreviewPanel.tsx` (Expand/Summarize/Copy/Copy as Markdown/Copy for Slack, L276-327 — ★ to jest kebab pliku cytowanego jako SSOT!), `InboxContent.tsx` (Expand/Summarize/Copy + extraCopyFormats Copy-MD/Copy-Slack, L1572-1579) — ten sam wzorzec co InitiativePreviewV3, ani jeden z nich formalnie „Export"/„Pobierz"
- **Grupa 4-5 (A2b), kebab ZGODNY z kanonem (Copy+Export) — 2 NOWE pozytywne**, dołączają do Insights: `PresentationsTabContent.tsx` (Copy + Export PPTX, L461-467), `ReportsTabContent.tsx` (Copy + Export PDF, L532-539)

Wniosek zaostrzony przez batch B i A2b: kebab „tylko Copy" nie jest odosobnionym wyjątkiem — to
**dominujący wzorzec w Grupie 3 ORAZ w połowie Grupy 5**. Export/Pobierz z §7.3 pkt 3 ma teraz
**3 zaimplementowane przykłady** (Insights + Presentations + Reports-Documents), a rodzina
„Expand/Summarize/Copy(+MD/+Slack)" (Decisions/Inbox/InitiativePreviewV3) jest osobnym, powtarzalnym
wzorem, który TEŻ nie spełnia kanonu dosłownie, mimo że jest bogatszy niż „tylko Copy" — reguła
(d)#3 powinna to rozróżniać: „Copy + 1 z {Export,Pobierz}" nie jest tym samym co „Copy + dowolna
liczba dodatkowych Copy-wariantów".

### TYPE 4 — Meta Bar i Details całkowicie zastąpione bespoke JSX
Potwierdzone: **Interview→Initiatives (tab)**, `InterviewHub.tsx` L7375-7406 — ręczny `<div>` zamiast
`PreviewMetaCard`/`PreviewDetailsSection`. Efekt: brak licznika słów, brak kebaba.
(Finance→pozostałe taby robi coś podobne, ale tam własny `PreviewMetaCard`/`PreviewDetailsSection`
SĄ użyte wewnątrz `children` — to inny problem, patrz TYPE 1/TYPE 12, nie TYPE 4.)

**★ NAJOSTRZEJSZY PRZYPADEK, znaleziony przez A2b: `FocusView.tsx`** (`MyWork/Focus/FocusView.tsx`
L1857-1973). To NIE jest częściowe zastąpienie jak Interview→Initiatives — to **całkowity brak
importu** `PreviewMetaCard`/`PreviewDetailsSection`/`PreviewAIHintStrip`/`PreviewRelations` w całym
pliku (potwierdzone grepem po importach). Panel używa WYŁĄCZNIE zewnętrznego `PreviewPaneShell` jako
kontenera; wszystko wewnątrz — meta (typ/priorytet/due-date), details (opis jako zwykły `<p>`, zero
kebaba), footer (4 bespoke `<button>`) — jest ręcznym JSX. Efekt kumulacyjny: brak licznika słów,
brak kebaba w ogóle (dołącza do „kebab nie istnieje" w TYPE 3), brak strefy AI w ogóle (nie
`disabled` — nieobecna), relacja (`initiativeName`) pokazana jako zwykły tekst zamiast chipa
Relations (dołącza do TYPE 2 jako „relacja bez chipa w ogóle", nie tylko „chip bez onClick").

### TYPE 5 — „Co dalej" niezgodny z §7.3a lub w złej kolejności względem Actions
- **Ideas**: `ConvertToOutputMenu variant="inline"` zamiast `ArtifactActionPanel variant="compact"`.
  `rounded-md` nie `rounded-full`, brak grupowania Dokumenty/W aplikacji, 7 targetów zamiast
  kanonicznych 6 (`ConvertToOutputMenu.tsx` L268-283). Kolejność odwrócona: Actions(L634-652) PRZED
  Co dalej(L666-678).
- **`StandardPreview.tsx`** (facada bazowa, L245-306): prop `whatsNext` renderowany PO `actionRows`.
  **Zweryfikowano dwukrotnie (własna weryfikacja + potwierdzone niezależnie przez agenta batcha B na
  9 dodatkowych plikach): prop `whatsNext` jest CAŁKOWICIE nieużywany w repo** (`git grep -n
  "whatsNext=" origin/demo -- 'src/*'` → 0 wyników). Pułapka uśpiona, nie aktywny defekt — ale
  blokująca dla przyszłych ekranów.
- **Execution→Reports**: „Expected Follow-up Actions" (`ExecutionHub.tsx` L4910-4925) — pigułki
  wizualnie przypominające „Co dalej" (`rounded-full text-[10px]`), ale renderowane jako statyczne
  spany bez `onClick`, POZA propem `whatsNext` — ad-hoc namiastka bloku 6, nie prawdziwa
  implementacja.

### TYPE 6 — Jawne linie-dividery w stopce (łamanie MUST „space-y-2.5, bez dividerów")
**Dwa niezależne źródła**, oba potwierdzone:
1. `src/components/Initiatives/InitiativePreviewV3.tsx` `InitiativePreviewV3Footer`, L624-644:
   `className="space-y-0"` (L625) + `<div className="border-t border-c-border-subtle my-3" />`
   (L635, L639). Reużywany w **5 modułach**: `InitiativesHub.tsx` (taby grid/kanban/timeline),
   `Discovery/DiscoveryToolsHub.tsx`, `Execution/ExecutionHub.tsx` (import typu),
   `Initiatives/Analysis/PortfolioAnalysisView.tsx`, `Results/ResultsInitiativesView.tsx`.
2. `src/components/Economics/FinancePreviewPanel.tsx` `renderPreviewFooter`, L1233-1257:
   identyczny wzorzec `space-y-0` + `<div className="border-t border-slate-200/50 ... my-3" />`
   (L1243, L1254), dodatkowo trzeci divider wokół warunkowego `FinanceVersionTimeline`. Zasila
   wszystkie taby Finance poza „Statements" (models/prediction/analysis/investment/valuation).
3. **★ NOWE, A2b**: `src/components/MyWork/InboxContent.tsx` L1556: `<div className="pt-2
   border-t border-c-border-subtle">` przed przyciskiem „Undo last AI suggestion" — trzecie
   niezależne źródło tego samego defektu, tym razem w MyWork/Inbox, poza footerem stworzonym
   przez `PreviewActionBar` (divider jest DOKLEJONY po nim, nie wewnątrz komponentu bazowego).

Kanon §7.3 wprost: *„Odstępy w stopce (MUST): sekcje to samodzielne karty z ramką → bez ciężkich
linii-dividerów między nimi"*. Naprawa TRZECH plików (usunięcie dividerów + `space-y-0`→
`space-y-2.5` gdzie dotyczy) naprawia **7 ekranów/modułów naraz** — razem z TYPE 11 to najwyższa
dźwignia w A2.

### TYPE 7 — Duplikaty informacji (ta sama dana w 2 miejscach preview)
- **Templates**: `category` w Meta pills (L70-72) I w Relations (L217)
- **Interview→Initiatives (tab)**: `priority` w bespoke meta-div (L7378) I w Relations
  (L7519-7523); `updatedAt` w meta-div (L7389-7391) I w Relations (L7524-7530)
- **Execution→Reports**: RAG+cadence w children (L4806-4814) DUPLIKUJE `meta.pills` (L5052-5054);
  title+audience w children (L4816-4824) DUPLIKUJE header+`meta.trailing` (L5057); **„Data
  Sources" w children (L4855-4870) DUPLIKUJE 1:1 tę samą tablicę `report.dataSources` renderowaną
  w `relations` (L5086)** — ten sam array renderowany DWA razy w jednym panelu
- **Execution→List**: progress% w `meta.pills` I w `details.text` „Progress: X%"; deadline w
  `meta.trailing` I w `details.text` „Due: ..."

### TYPE 8 — AI zone obecna, ale trwale wyłączona lub zdublowana etykietą
- Inbox: `ai.disabled: true` na stałe (L8436)
- Interview→Initiatives tab: `disabled`, `onRunHint={() => {}}` no-op (L120)
- AuditsHub: `disabled:true`
- ResultsHub: `disabled:true`
- **Execution→Reports**: DWA bloki podpisane „AI" w tym samym panelu — kanoniczny `ai` prop
  (`PreviewAIHintStrip`, 1 hint) ORAZ osobny bespoke tekst „AI Executive Readout" w `children`
  (L4872-4886) — użytkownik widzi „AI" dwukrotnie, z różną treścią i różnym zachowaniem

**Kontr-przykład / wzorzec pozytywny**: **MeetingHub** (`MeetingHub.tsx` L811) ma AI z REALNĄ
treścią (`hints`/`loading`/`error`/`result` z Operator Brief) — poprawne, w pełni funkcjonalne
użycie rozszerzonego API `PreviewAIHintStrip`, nie hack.

**★ KOREKTA A2b**: MeetingHub NIE jest „drugim ekranem-wzorcem" — jest **trzecim**. `DecisionPreviewPanel.tsx`
(`PreviewAIHintStrip` z realnym `result`/`error`/`onRegenerate`/`onClear`, L466-476), cytowany jako
SSOT wzorca w `StandardPreview.tsx` L6, ma w pełni funkcjonalną strefę AI i chronologicznie
poprzedza MeetingHub (MyWork jest starszy niż Meeting). `InboxContent.tsx` (`AIHintStrip`, komponent
o innej nazwie ale tym samym wzorcu, L1509-1520) ma to samo. **Funkcjonalna strefa AI ma więc
faktycznie 3 potwierdzone wzorce: Decisions, Inbox, Meeting** — nie jest tak rzadka, jak sugerował
oryginalny dokument sprzed A2b; problem jest głębszy niż „prawie nikt nie zaimplementował realnego
AI" — jest raczej „duże huby biznesowe (Grupa 3) i Assessment/ReportBuilder (Grupa 5) systematycznie
nie mają realnego AI, ale MyWork ma je od początku".

### TYPE 9 — `PreviewRelations` renderuje pusty box zamiast ukrywać strefę, gdy brak danych
Infrastrukturalne: `src/components/shared/PreviewPane/PreviewRelations.tsx` L118-125 — gdy
`items.length === 0`, komponent renderuje `min-h-[4.5rem]` box z placeholder-tekstem zamiast być
pominięty. Dotyczy każdego ekranu, który przekazuje `relations` bezwarunkowo: potwierdzone w
AuditsHub, Finance (oba taby), Execution (oba taby), MeetingHub, ResultsHub, Initiatives-table,
Assigned, Templates, Sessions. **Ekrany, które W OGÓLE nie przekazują `relations`** (prop
`undefined`, więc strefa poprawnie znika): ModelCatalogTable, PromptRegistryTab,
PartnerSettlementsView (wszystkie 4 taby) — to jest właściwe zachowanie, kontrast z resztą.

**A2b — nowe potwierdzone przypadki „pusty box" (`relations` przekazywane bezwarunkowo lub
warunkowo bez `onClick`)**: AssessmentHub × 3 taby (`relations={[]}` na sztywno, L1972/2099/2223),
`ReportsTabContent.tsx` (`relations={[]}` na sztywno, L549), `AssessmentTable.tsx`/
`InboxContent.tsx`/`OutputsAggregateTabContent.tsx`/`PresentationsTabContent.tsx` (warunkowe
tablice bez `onClick`, pusty box gdy warunek fałszywy). **Ekrany, które poprawnie NIE przekazują
`relations`** (kontynuacja dobrego wzorca): `BlockTypesManager.tsx`, `TemplatesManager.tsx`,
`MyProjects.tsx` (obie instancje).

### TYPE 10 — Martwy kod: 4 komponenty preview niepodłączone do żadnego żywego ekranu
Potwierdzone przez `git grep` (zero importów poza własnym plikiem/testem, `origin/demo`):
1. `src/components/Initiatives/InitiativePreview.tsx` (`V3-A07`) — zastąpiony przez
   `InitiativePreviewV3.tsx`; **zero** importów (`git grep -n "from '.*Initiatives/InitiativePreview'"` → 0)
2. `src/components/DiscoveryTools/ToolSessionPreview.tsx` (`V3-A07`) — zastąpiony przez
   `ToolSessionPreviewV3.tsx`; żywy jest TYLKO helper `getToolCategoryLabel` (import w
   `Discovery/DiscoveryToolsHub.tsx` L95), sam komponent — 0 importów
3. `src/components/assessment/AssessmentItemPreview.tsx` — importowany WYŁĄCZNIE we własnym
   smoke teście `src/components/assessment/__tests__/assessmentItemPreview.smoke.test.tsx`
4. `src/components/ReportsAndPresentations/previews/ReportPreview.tsx` — importowany WYŁĄCZNIE w
   `tests/components/ReportsAndPresentations/ArtifactTrustPreview.test.tsx` i w dokumentacji

Wszystkie 4 mają własne, przed-kanoniczne implementacje: `kicker` (pole `@deprecated`,
`PreviewPaneShell.tsx` L6-9) i zduplikowany „Open" w headerze ORAZ footerze (np.
`ToolSessionPreview.tsx` L132-141 vs L144-150). Nie wymaga naprawy zgodności — wymaga usunięcia
jako martwy kod (osobny temat).

### TYPE 11 — ★ „Open" zduplikowany w bloku Actions (literalny, ten sam handler) — NAJCZĘSTSZY DEFEKT W A2
Potwierdzone w **5 z 9 zbadanych hubów Grupy 3**, zawsze ten sam wzorzec: `actions.informational`
(lub `.resolutions`) ma pozycję `{id:'open'|'edit', label:'Open'/'Edit', shortcut:'O', onClick:
<DOKŁADNIE TA SAMA funkcja co onOpenFull w headerze>}`:
- **Finance→Statements**: Relations „child" chipy (L2593-2598) wołają `handleOpenFull` — pseudo-duplikat
- **Finance→pozostałe**: TRÓJNY duplikat, patrz niżej (najgorszy przypadek)
- **Execution→List**: `listPreviewActions.informational` (ok. L5225-5249), `handleOpenDocument`, shortcut `O`
- **Initiatives→table**: `tablePreviewActions.informational` (ok. L1947-1955), `handleOpenInitiativeDocument`, shortcut `O`
- **MeetingHub**: `listPreviewActions.informational` (L614-623), `openMeetingDocument`, shortcut `O`
- **ResultsHub**: `catalogPreviewActions.informational` (L1543-1551), `openKpiDrawer`, shortcut `O`
- **ModelCatalogTable**: `previewActions.resolutions[0]` (L693-699), `handleEdit` — sam handler co header „Open" (funkcjonalny duplikat, różne etykiety „Open" vs „Edit")

**Jedyny plik z jawnym, świadomym uzasadnieniem BRAKU tego duplikatu: AuditsHub** (komentarz
L691-694 — preview JEST pełnym widokiem, więc nie ma osobnego „Open" do zdublowania). To wzorzec
do naśladowania wszędzie indziej, GDZIE header rzeczywiście ma `onOpenFull`.

**Najgorszy przypadek — Finance→pozostałe taby**: TRZY przyciski o funkcji „otwórz pełny widok"
jednocześnie aktywne, DWA z identycznym skrótem klawiszowym `O`:
1. Header `onOpenFull` (`FinanceHub.tsx` L2854)
2. Bespoke „Otwórz" w `renderPreviewFooter`, shortcut `O` (`FinancePreviewPanel.tsx` L1226-1231)
3. Kanoniczny `actions` prop → „Edytuj" z `shortcut: action.id === 'edit' ? 'O' : undefined`
   (`FinanceHub.tsx` L2725-2733, `useFinanceRowActions.ts` L311-314) — **kolizja skrótu O z #2**

Do tego w tym samym miejscu: **podwójny „Export"** — bespoke `handleExport` w footerze
(`FinancePreviewPanel.tsx` L1219-1224) I osobna pozycja `informational` „export" z `getRowActions`
(`FinanceHub.tsx` L2725) — dwa przyciski Export w jednym panelu.

### ★★ A2b — TYPE 11 w Grupach 4-5: 8 nowych przypadków, w tym w pliku cytowanym jako SSOT

**Najważniejszy: `DecisionPreviewPanel.tsx` (★ SSOT wzorca per `StandardPreview.tsx` L6).** Header
„Open" button (`onClick={() => onOpenFullDetail(decisionId, decision)}`, L835) I footer „More info"
(`onMoreInfo={() => onOpenFullDetail(decisionId, decision)}`, L865, przekazane z
`DecisionPreviewFooter` na L430) **wołają DOSŁOWNIE tę samą funkcję**, `onOpenFullDetail(decisionId,
decision)`. Etykieta „More info" różni się od „Open"/„Edit", więc reguła (d)#14 (grep tekstu
„Open"/„Edytuj") by tego NIE złapała — tylko reguła (d)#8 (porównanie referencyjne handlerów) łapie
ten przypadek. **Skutek dla projektu**: plik, który miał być wzorem do kopiowania dla reszty
ekranów, sam demonstruje chorobę, którą miał zapobiegać — ktokolwiek kopiował „SSOT" 1:1, przenosił
defekt dalej.

**Pozostałe 7 nowych przypadków (Grupa 5, wszystkie przez fasadę `StandardPreview`):**
- AssessmentHub → list: `informational[0]` `handleOpenDocument(selectedListRow)` (L1562) = `onOpenFull` (L1925)
- AssessmentHub → reports: `informational[0]` `handleOpenDocument(selectedReportRow)` (L1609) = `onOpenFull` (L2057)
- AssessmentHub → initiatives: `informational[0]` `handleOpenDocument(selectedInitiativeRow)` (L1652) = `onOpenFull` (L2177)
- AssessmentTable: `informational[0]` id `'open-map'` label „Open in Map" `onOpenInMap(previewAssessment.id)` (L289) = `onOpenFull` (L395) — wariant etykietowy, jak ModelCatalogTable
- BlockTypesManager: `resolutions[0]` id `'edit'` label „Edit" `openEdit(previewBlock)` (L424) = `onOpenFull` (L512) — funkcjonalny duplikat, jak ModelCatalogTable
- **OutputsAggregateTabContent — NAJGORSZY PRZYPADEK W CAŁYM A2, gorszy niż Finance→pozostałe**: `informational[0]` id `'open'` (L722) I `informational[1]` id `'open_sheet'` label „Download XLSX" (L734) **WOŁAJĄ DOSŁOWNIE TĘ SAMĄ funkcję** `openRow(previewItem)`, identyczną z `onOpenFull` (L1123) — **3× ten sam handler, nie 3 różne funkcje jak w Finance**. To jest dowód dla **N1 z rejestru** („Download XLSX nic nie pobiera") — przycisk oznaczony jako pobieranie pliku faktycznie otwiera wiersz, bo dzieli funkcję 1:1 z „Open"
- (kontekst N2 z rejestru — „Open" w 3 kopiach w jednym podglądzie — potwierdzony tym samym dowodem: header + `informational[0]` „Open" + `informational[1]` „Download XLSX" to trzy przyciski z tym samym efektem)

**Pliki BEZ TYPE 11 w Grupie 4-5 (pozytywne, obok AuditsHub)**: `TemplatesManager.tsx` (świadome
`onOpenFull=undefined` dla systemowych szablonów + akcje `Use`/`Duplicate`/`Delete` bez duplikatu),
`PresentationsTabContent.tsx` (`Start review`/`Udostępnij`, brak duplikatu), `ReportsTabContent.tsx`
(`Start review` only, brak duplikatu), `MyProjects.tsx` (obie instancje — ale bo `onOpenFull` w
ogóle nie jest przekazywany, więc nie ma czego duplikować, nie jest to świadomy wzorzec jak
AuditsHub/TemplatesManager).

**Zaktualizowana skala**: TYPE 11 potwierdzony teraz w **12 z 26 zbadanych ekranów/tabów** (był 5 z
9 w Grupie 3, teraz +8 w Grupach 4-5, w tym plik-SSOT). To pozostaje najczęstszym pojedynczym
defektem w A2 i jedynym, który przenika WSZYSTKIE grupy łącznie z referencyjnym wzorcem.

### TYPE 12 — `children` powiela dane już pokazane w kanonicznych strefach (nie tylko „dodaje", ale DUBLUJE)
Najostrzejszy przypadek: **Execution→Reports** (`ExecutionHub.tsx` L4770-4947, `renderReportPreviewBody`):
- RAG-status + cadence pokazane W CHILDREN (L4806-4814) I w `meta.pills` (L5052-5054) — ta sama dana dwa razy
- Tytuł + audience w children (L4816-4824) I w headerze + `meta.trailing` (L5057)
- **„Data Sources" w children (L4855-4870, statyczne spany) renderuje TĘ SAMĄ tablicę
  `report.dataSources`, którą `relations` prop renderuje jako blok 5** (L5086) — dosłownie ten sam
  JS-owy array wyświetlony w dwóch różnych miejscach tego samego panelu, raz jako proza, raz jako
  chipy Relations
- Etykieta „Copy" oznacza dwie różne akcje w tym samym panelu: kebab-Copy kopiuje krótki string,
  Actions-row-Copy (`reportPreviewActions`, L5286-5309) kopiuje pełny markdown — myląca dla
  użytkownika nazwa identyczna dla różnych efektów

### TYPE 13 — Niespójne umiejscowienie „Open" między trybami widoku TEJ SAMEJ encji
**InitiativesHub**: tab „table" (StandardPreview) ma „Open" w headerze (`onOpenFull`, L2052).
Taby „grid"/„kanban"/„timeline" (bespoke `TableWithPreviewLayout` + `InitiativePreviewV3`)
**NIE przekazują `onOpenFull`** do `TableWithPreviewLayout` (mimo że komponent bazowy to wspiera —
`TableWithPreviewLayout.tsx` L296-300) → **brak Open w headerze w ogóle** dla tych 3 trybów;
jedyny „Open" żyje na dole w `InitiativePreviewV3Footer` Actions (L576-587). Efekt: przełączając
widok tej samej listy inicjatyw (table→grid), użytkownik traci „Open" z góry i musi go szukać na
dole panelu.

### TYPE 14 — Superadmin: systematycznie uboższy zestaw stref (nie błąd per se, ale niespójność głębi)
`ModelCatalogTable.tsx`, `PromptRegistryTab.tsx`, `PartnerSettlementsView.tsx` (wszystkie 4 taby)
konsekwentnie NIE przekazują `ai`/`relations` (prop `undefined`, poprawnie ukryte — to NIE jest
TYPE 9). `PromptRegistryTab` ma tylko 3 z 7 stref (Header/Meta/Details), reszta świadomie pusta.
`PartnerSettlementsView→Expiring` nie ma nawet kebaba (jedyny taki przypadek w A2, patrz TYPE 3).
To nie musi być defekt (narzędzia wewnętrzne, mniejsza potrzeba AI/Relations) — ale sygnalizuje, że
„bogaty domyślny szablon" z kanonu (§7.3 pkt 3, MUST) nie jest egzekwowany minimalnie nigdzie w
tych plikach — nawet Details bez kebaba przechodzi bez ostrzeżenia.

---

## (c) Ekran-wzorzec

**Interview → Insights** (`src/components/Interview/InterviewInsightPreview.tsx`) pozostaje jedynym
w pełni zbadanym ekranem BEZ ŻADNEGO odchylenia: kebab dokładnie kanoniczny (L104-140), AI→Co dalej
w poprawnej kolejności bez zbędnego Relations-boxa, „Co dalej" = `ArtifactActionPanel
variant="compact"` (potwierdzone też niezależnie w `ArtifactActionPanel.tsx` L606-632), zero
duplikatów Open.

Dodatkowe wzorce cząstkowe, warte kopiowania dla konkretnych stref (batch B + A2b):
- **AuditsHub** (`AuditsHub.tsx` L688-694) i **TemplatesManager** (`TemplatesManager.tsx` L617,
  A2b) — jedyne dwa pliki z jawnym, świadomym uzasadnieniem/mechanizmem, DLACZEGO nie ma duplikatu
  Open w Actions. Wzorzec dla strefy 1/7 (anty-duplikacja). `PresentationsTabContent.tsx`/
  `ReportsTabContent.tsx` (A2b) osiągają to samo bez komentarza — po prostu nie dodają akcji
  „Open"/„Edit" do `informational`/`resolutions`.
- **AI realny (strefa 4)**: trzy wzorce, NIE jeden — `DecisionPreviewPanel.tsx` (najwcześniejszy,
  A2b), `InboxContent.tsx` (`AIHintStrip`, A2b), `MeetingHub.tsx` L811. Wszystkie mają
  `loading`/`error`/`result`/regenerate, nie `disabled:true`.
- **Kebab zgodny z kanonem (Copy+Export)**: obok Insights, teraz też `PresentationsTabContent.tsx`
  (Export PPTX, A2b) i `ReportsTabContent.tsx` (Export PDF, A2b).

★ **ZASTRZEŻENIE A2b — Insights nie jest już „jedynym bez odchylenia" w sensie absolutnym**: nie
znaleziono w nim samym nowego defektu, ALE `DecisionPreviewPanel.tsx`, plik cytowany jako **SSOT
wzorca** w kodzie źródłowym `StandardPreview.tsx` (L6), ma potwierdzony TYPE 11 (header „Open" i
footer „More info" wołają dosłownie ten sam handler `onOpenFullDetail`, patrz TYPE 11 wyżej). Skoro
sam SSOT ma ten defekt, „ekran bez odchylenia" powinien być odtąd definiowany per-strefa (kopiuj
kebab z Insights, anty-duplikację z AuditsHub/TemplatesManager, AI z Decisions/Meeting), NIE przez
kopiowanie całego pliku 1:1 — nawet tego oznaczonego jako SSOT.

Każdy nowy/naprawiany ekran preview powinien: strukturę kopiować z Insights, anty-duplikację
Open z AuditsHub/TemplatesManager (NIE z DecisionPreviewPanel, mimo etykiety SSOT), a jeśli ma
realny backend AI — wzorować się na Decisions/Inbox/Meeting zamiast renderować `disabled:true`
na stałe.

---

## (d) CO BRAMKA MA SPRAWDZAĆ (reguły dla przyszłego lintera/hooka egzekwującego §7.3)

Wyprowadzone wprost z powyższych defektów — każda reguła ma konkretny przypadek, który by złapała:

1. **Zakaz treści w `children`/`renderPreview` PO wywołaniu `PreviewDetailsSection`** — jeśli plik
   renderuje jakikolwiek JSX blok PO `<PreviewDetailsSection>` a PRZED przekazaniem do
   `footer`/`renderPreviewFooter`, to FAIL. Łapie TYPE 1 (Templates QUESTIONS, `InitiativePreviewV3`
   FinancialAnalysisCard/lineage, Finance `renderPreviewBody` mega-blok). Wyjątek: treść przekazana
   jako `children` PreviewDetailsSection SAMEGO (zagnieżdżona wewnątrz) jest OK (wzorzec: Ideas).

2. **Każdy `RelationItem` bez `onClick` = FAIL**, chyba że jawnie oznaczony jako informacyjny.
   Na >15 zbadanych wystąpień tylko 2 mają sensowny `onClick` — reguła złapałaby ~90% z nich
   (TYPE 2). Dodatkowa reguła: `onClick` relacji NIE MOŻE być identyczny (referencyjnie) z
   `onOpenFull` headera (łapie pseudo-interaktywny przypadek Finance→Statements).

3. **Kebab Details MUSI zawierać przynajmniej: Kopiuj + 1 z {Export, Pobierz}.** Sam `onCopy` bez
   niczego więcej = FAIL (dziś to DOMINUJĄCY wzorzec w Grupie 3 — 8 z 9 plików — i w połowie Grupy 5).
   Brak kebaba w ogóle (`hasMenu=false`/brak `customActions`, jak PartnerSettlementsView→Expiring,
   `FocusView.tsx`, `MyProjects.tsx`×2, A2b) = FAIL krytyczny (**4 przypadki potwierdzone, nie 1**).
   **Doprecyzowanie A2b**: rodzina „Expand/Summarize/Copy(+Copy-MD/+Copy-Slack)" (Decisions, Inbox,
   InitiativePreviewV3) NIE spełnia tej reguły dosłownie — więcej pozycji niż „tylko Copy" nie
   równa się „ma Export/Pobierz". Reguła musi sprawdzać obecność `onExport`/`onDownload` konkretnie,
   nie liczbę pozycji kebaba.

4. **Zakaz bespoke `<div>` zamiast `PreviewMetaCard`/`PreviewDetailsSection`.** Grep: plik
   renderujący preview i NIE importujący `PreviewMetaCard` LUB NIE importujący
   `PreviewDetailsSection` = FAIL (TYPE 4 — Interview→Initiatives tab).

5. **„Co dalej" MUSI być `ArtifactActionPanel variant="compact"`, nie custom menu.** Każde użycie
   `ConvertToOutputMenu`, ręcznych `<button>` z `rounded-md`/`rounded-lg` w sekcji „Co dalej", pigułki
   imitujące create-strip bez realnego `whatsNext`/`ArtifactActionPanel` (Execution „Expected
   Follow-up Actions"), lub brak grupowania Dokumenty/W aplikacji = FAIL (TYPE 5).

6. **Zakaz `whatsNext` prop na `StandardPreview` dopóki bazowy komponent nie ma naprawionej
   kolejności** (`StandardPreview.tsx` L245-306, `whatsNext` PO `actionRows`). Napraw RAZ w bazowym
   komponencie, potem zdejmij blokadę.

7. **Zakaz `border-t`/dividerów wewnątrz kontenera stopki preview.** Grep `border-t` w bloku JSX ze
   stopką (`space-y-*` kontener z kartami `rounded-xl border`) = FAIL. Złapałoby **2 pliki naraz**
   (`InitiativePreviewV3.tsx` L635/639, `FinancePreviewPanel.tsx` L1243/1254) → naprawia 6 modułów
   (TYPE 6 — najwyższa dźwignia razem z regułą #8).

8. **Zakaz literalnego duplikatu „Open"/„Edytuj" w Actions, gdy handler jest referencyjnie tym
   samym co `onOpenFull` headera.** Statyczna reguła: jeśli `actions.*.onClick` wskazuje na tę samą
   funkcję/zmienną co `onOpenFull` przekazany do headera (po normalizacji nazwy zmiennej) = FAIL.
   Złapałoby **5 z 9 zbadanych hubów** (TYPE 11) — druga najwyższa dźwignia w A2. Wzorzec zwolnienia:
   komentarz uzasadniający jak w AuditsHub, gdy `onOpenFull` faktycznie nie istnieje.

9. **Zakaz kolizji skrótu klawiszowego między dwoma jednocześnie aktywnymi przyciskami w tym
   samym panelu preview.** Statyczna reguła: zbiór `shortcut` wszystkich renderowanych akcji (header
   + kebab + AI + actions) musi być unikalny. Złapałoby Finance→pozostałe (dwa `O` naraz, TYPE 11).

10. **Zakaz tej samej wartości (np. `priority`, `category`, `dataSources`, `RAG status`) w Meta
    pills/children I w Relations/details tego samego preview.** Statyczna reguła trudniejsza do
    zautomatyzowania w 100% (wymaga śledzenia zmiennych), ale grep na powtórzone stringi/nazwy pól
    źródłowych (np. ten sam identyfikator `dataSources` użyty w dwóch różnych blokach JSX) złapie
    najgorsze przypadki (TYPE 7, TYPE 12 — Execution „Data Sources").

11. **`disabled` na `ai`/`PreviewAIHintStrip` na stałe (literał `true`, nie wyprowadzony ze stanu)
    = FAIL** — strefa powinna być CAŁKOWICIE pominięta, nie pokazana wyszarzona (TYPE 8). Confirmed
    w Inbox, Interview→Initiatives, AuditsHub, ResultsHub — 4 z ~17 zbadanych ekranów.

12. **`PreviewRelations` (komponent bazowy) powinien zwracać `null` gdy `items.length === 0`,
    NIE renderować `min-h-[4.5rem]` placeholder.** Zmiana w komponencie bazowym
    (`PreviewRelations.tsx` L118-125), automatycznie naprawia TYPE 9 na ~9 ekranach naraz.

13. **`onOpenFull` musi być spójnie przekazywany (lub spójnie pominięty z komentarzem) między
    trybami widoku tej samej encji/listy** (table vs grid vs kanban vs timeline). Reguła
    trudniejsza do zautomatyzowania statycznie, ale audytowo: dla każdej pary
    `TableWithPreviewLayout`/`StandardPreview` renderujących tę samą encję w różnych `viewMode`,
    sprawdź czy `onOpenFull`/header-Open jest obecny w OBU lub w ŻADNYM (TYPE 13 — InitiativesHub).

14. **Dokładnie jeden tekst „Open"/„Otwórz" w całym renderowanym drzewie preview.** Już w kanonie
    (§7.3, punkt I checklisty) — potwierdź że łapie też martwe pliki z TYPE 10, gdyby ktoś je
    odgrzebał (`ToolSessionPreview.tsx` ma dziś 2 „Open").

---

## (e) NIEZBADANE — stan po A2b

**Batch „MyWork/Reports/Assessment" — ZAMKNIĘTY przez A2b (2026-07-21).** Wszystkie 11 plików mają
teraz pełny wiersz z dowodem plik:linia w Grupie 4 (MyWork) lub Grupie 5 (Assessment/ReportBuilder/
ReportsAndPresentations) wyżej — patrz tabela (a) i cytowania w sekcjach (b)/(c). Lista poniżej
zostaje jako rejestr tego, co było niezbadane PRZED A2b, wyłącznie do celów historycznych:
- `src/components/MyWork/DecisionPreviewPanel.tsx` → zbadany, Grupa 4 (★ SSOT z defektem TYPE 11)
- `src/components/MyWork/Focus/FocusView.tsx` → zbadany, Grupa 4 (najostrzejszy TYPE 4, zero kebaba)
- `src/components/MyWork/InboxContent.tsx` → zbadany, Grupa 4 (nowy TYPE 6 divider)
- `src/components/MyWork/MyProjects.tsx` (2 instancje) → zbadane, Grupa 4 (TYPE 1 potwierdzony ×2, zero kebaba ×2)
- `src/components/assessment/AssessmentHub.tsx` (3 taby) → zbadany, Grupa 5 (TYPE 11 ×3)
- `src/components/assessment/AssessmentTable.tsx` → zbadany, Grupa 5 (TYPE 11 wariant etykietowy)
- `src/components/ReportBuilder/BlockTypesManager.tsx` → zbadany, Grupa 5 (TYPE 11 Edit=Open)
- `src/components/ReportBuilder/TemplatesManager.tsx` → zbadany, Grupa 5 (POZYTYWNY wzorzec, brak TYPE 11)
- `src/components/ReportsAndPresentations/OutputsAggregateTabContent.tsx` → zbadany, Grupa 5 (dowód dla N1/N2 z rejestru — najgorszy TYPE 11 w A2)
- `src/components/ReportsAndPresentations/PresentationsTabContent.tsx` → zbadany, Grupa 5 (POZYTYWNY wzorzec: kebab Copy+Export, brak TYPE 11)
- `src/components/ReportsAndPresentations/ReportsTabContent.tsx` → zbadany, Grupa 5 (POZYTYWNY wzorzec kebaba, ale TYPE 1 przez `children`)

**Dwa pliki z oryginalnej listy (e) NIE wymagały osobnej analizy** — są już w pełni opisane pod
TYPE 10 (martwy kod, sekcja b) jako pozycje #3 i #4, ponownie zweryfikowane przez A2b
(`git grep` na `origin/demo`, 2026-07-21, wynik bez zmian — nadal 0 żywych importów poza testami):
- `src/components/assessment/AssessmentItemPreview.tsx` — martwy, TYPE 10 #3
- `src/components/ReportsAndPresentations/previews/ReportPreview.tsx` — martwy, TYPE 10 #4

**Pozostaje NIEZBADANE — świadomie poza właściwym scope'em A2** (infrastruktura/shell, nie
konkretny ekran preview per se; A2b nie ruszał tej listy, bo to inny rodzaj audytu — struktura
komponentu bazowego, nie zgodność treści per moduł):
- `src/components/standard/ArtifactRightPanel.tsx` (prawy panel PEŁNEGO artefaktu SPEC-A, nie preview pane)
- `src/components/shared/TableWithPreviewLayout.tsx` (shell/SSOT — zbadany fragmentarycznie tylko
  pod kątem wiring `renderPreview`/`renderPreviewFooter`→`children`/`footer` i braku wymuszania
  `onOpenFull`, patrz TYPE 13; nie pod kątem WSZYSTKICH własnych odchyleń)
- `src/pages/dev/styleguide/ComponentsSection.tsx` (strona deweloperska, nie żywy ekran)

**Rekomendacja po A2b:** dokument A2 jest teraz kompletny względem oryginalnego zlecenia (grep
`Standard*`/`Preview*` na `origin/demo`). Ewentualna kolejna runda powinna zejść o poziom niżej —
`ArtifactRightPanel.tsx`/`TableWithPreviewLayout.tsx` jako komponenty bazowe (nie kolejne ekrany) —
albo przejść do naprawy: reguły (d) są gotowe do wdrożenia jako lint/hook, a TYPE 11 (12 z 26
ekranów) i TYPE 1 (7+ potwierdzonych miejsc, w tym przez fasadę `StandardPreview`) to najwyższa
dźwignia napraw w całym A2.

**Rekomendacja:** kolejna sesja powinna dokończyć dokładnie listę „MyWork/Reports/Assessment"
metodą zastosowaną tutaj (per-plik: znajdź `<StandardPreview`/wywołania `PreviewPaneShell`,
sprawdź 7 stref z dowodem plik:linia, sprawdź szczególnie TYPE 3/9/11 — dominujące wzorce z tej
tury, bardzo prawdopodobnie się powtórzą) i dopisać wiersze do tabeli (a) + doincrementować
liczniki w (b). Struktura dokumentu jest gotowa do rozszerzenia bez przepisywania.
