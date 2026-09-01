# POMIAR R2 — zasięg trzech przyczyn angielskiego w interfejsie

Data pomiaru: 2026-09-01. Katalog roboczy: `/private/tmp/m03` (gałąź `codex/m03-admin-20260824`), stan na commit
`3c178295af` (HEAD w chwili pomiaru). Zadanie czysto pomiarowe — zero zmian w kodzie.

Zasada uczciwości: liczby poniżej pochodzą z konkretnych komend `grep`/`python3` uruchomionych na tym
drzewie, nie z pamięci ani z docs. Gdzie pomiar jest heurystyczny (regex, nie pełny parser AST), zaznaczono
to wprost i podano dowód na niedoszacowanie.

Decyzja właściciela z 2026-08-31 (angielski wiodący dla nazw metodyki/technologii) zastosowana przy ocenie
każdego przykładu w R2c i przy ocenie plików w R2a.

---

## R2a — pliki .tsx bez ŻADNEGO wywołania `t(`

### Metoda
```
find src/components src/views -name "*.tsx" | wc -l                       # wszystkie pliki
grep -rl "t(" --include="*.tsx" src/components src/views                  # pliki z substringiem "t("
comm -23 <(sort wszystkie) <(sort z-t)                                    # różnica = kandydaci R2a
```
Uwaga metodologiczna: `grep "t("` to dopasowanie SUBSTRINGU, nie wywołania funkcji `t()`. Łapie fałszywe
pozytywy (np. `setTimeout(`, `reject(`, `sort(` — patrz niżej ActionCenter.tsx/ResearchSessionsDock.tsx,
które i tak trafiły do zbioru „ma t(" mimo zera prawdziwych wywołań `t()`). To znaczy: liczba plików BEZ
`t(` poniżej jest zaniżeniem prawdziwej liczby plików bez i18n — realna liczba jest WYŻSZA.

### Wynik surowy
- Plików `.tsx` w `src/components` + `src/views`: **3000**
- Plików z substringiem `t(`: **2627**
- Kandydatów R2a (bez `t(` wcale): **373**

### Klasyfikacja 373 kandydatów (heurystyka: obecność widocznego tekstu JSX)
Dla każdego pliku sprawdzono: (a) czy w ogóle ma `return (...)`/`return <...>` (czy to komponent renderujący),
(b) czy zawiera literalny tekst między `>` a `<` lub w atrybutach `aria-label`/`placeholder`/`title`/`alt`
(regex jednoliniowy — NIE łapie tekstu rozbitego na wiele linii ani tekstu wstawianego przez zmienną z
stałej, patrz dowód niżej).

| Kategoria | Liczba | Znaczenie |
|---|---|---|
| `TEXT` — ma JSX + wykryty literalny tekst w regexie | **83** | pewny defekt R2a (potwierdzony automatycznie) |
| `JSXNOTEXT` — ma JSX, regex nie złapał tekstu | **273** | NIEROZSTRZYGNIĘTE — patrz dowód niedoszacowania niżej |
| `NOJSX` — brak `return (`/`return <` w pliku | **17** | prawdopodobnie logika/typy/barrel, nie ekran — zweryfikowano próbkę 3/17 |

**Dowód, że kategoria `JSXNOTEXT` (273 pliki) zawiera prawdziwe defekty, które regex przeoczył:**
`src/components/AIChat/AIRoleBadge.tsx` trafił do `JSXNOTEXT`, ale realnie renderuje angielski tekst przez
zmienną, nie literał w JSX:
```
src/components/AIChat/AIRoleBadge.tsx:30:    label: 'Operator',
src/components/AIChat/AIRoleBadge.tsx:32:    description: 'Can execute actions',
src/components/AIChat/AIRoleBadge.tsx:52:      {config.label}
```
Podobnie `src/components/Finance/Valuation/steps/SensitivityStep.tsx` trafił do `TEXT` dopiero po ręcznym
odczycie (regex jednoliniowy nie złapał tekstu rozbitego na wiele linii), a jego tekst jest już PO POLSKU
(`Wrażliwość — WACC × wzrost terminalny`, `Metoda` — linie 84, 89) — czyli plik nie ma `t()`, ale nie jest
defektem R2a w sensie „pokazuje angielski", jest jedynie zaszyty na sztywno (nie przełączy się na EN dla
klienta z angielskim UI, ale to nie jest przedmiot tego zlecenia).

**Wniosek uczciwy: prawdziwa liczba plików R2a (bez `t()`, renderujących widoczny angielski tekst) leży
między 83 (dolna, potwierdzona granica) a 356 (83+273, górna granica przy założeniu że cały `JSXNOTEXT`
też renderuje tekst) — nie zmierzyłem dokładnej liczby, bo wymagałoby to ręcznego odczytu 273 plików, co
przekracza budżet tej sesji pomiarowej.** Rekomenduję przy naprawie traktować `JSXNOTEXT` jako pulę do
przejrzenia ręcznie, nie jako „bezpieczne".

### Pełna lista 83 potwierdzonych plików `TEXT` (dowód: pierwsza dopasowana linia)
```
src/components/AIChat/AIOSWave0GateReport.tsx -- 78: <strong>not</strong> a live health check...
src/components/AIChat/AgentWorkshopControls.tsx -- 167: aria-label="Data i godzina uruchomienia" (PL, ale bez t())
src/components/AIChat/DiagramArtifact.tsx -- 90: <span>Open</span>
src/components/AIChat/StructuredOutputBlock.tsx -- 45: <div className="font-medium">Risks</div>
src/components/AIChat/TrustPanel.tsx -- 115: <div className="font-medium">Source classes</div>
src/components/AISettings/ProactivitySelector.tsx -- 179: <h3>AI Proactivity</h3>
src/components/AIUsageIndicator.tsx -- 82: <span>Usage unavailable</span>
src/components/AdvancedAnalytics.tsx -- 24: <h3>Burn-Down Chart</h3>
src/components/Charts/RadarChart.tsx -- 57: <span>Aktualny:</span> (PL, bez t())
src/components/DiscoveryTools/report/ToolReportView.tsx -- 65: <Eyebrow>Dowody</Eyebrow> (PL, bez t())
src/components/Economics/charts/DistributionHistogram.tsx -- 93: aria-label="NPV distribution histogram"
src/components/EmptyStates/AxisEmptyState.tsx -- 96: title="Brak osi decyzyjnych" (PL, bez t())
src/components/Finance/Prediction/ScenarioResultsView.tsx -- 103: <th>Linia</th> (PL, bez t())
src/components/Finance/Valuation/steps/ExportStep.tsx -- 16: <h2>Eksport</h2> (PL, bez t())
src/components/Finance/Valuation/steps/SensitivityStep.tsx -- 84: "Wrażliwość — WACC × wzrost terminalny" (PL, bez t())
src/components/Finance/statementPackWorkspaceV2/SourceEvidencePanel.tsx -- 167: <dt>Kategoria mapowania</dt> (PL, bez t())
src/components/Intelligence/InterviewProgress.tsx -- 131: <span>Progress</span>
src/components/Interview/InterviewSummary.tsx -- 119: <h3>Interview Summary</h3>
src/components/Interview/SummaryView.tsx -- 119: <span>Interview Progress</span>
src/components/MyWork/IdeaExportMenu.tsx -- (aria-label, nie-tekstowy)
src/components/MyWork/PersonalExecutionBar.tsx -- 39: <span>Done</span>
src/components/MyWork/TaskRow.tsx -- 176: title="Unassigned"
src/components/Organization/redesign/OrganizationStatePanel.tsx -- 136: "Stan danych" (PL, bez t())
src/components/PMO/PMODashboard.tsx -- 51: <h2>Portfolio Overview</h2>
src/components/PMO/PhaseIndicator.tsx -- 41: <span>No project selected</span>
src/components/Partner/CommissionIntelligence.tsx -- 222: <h3>Active Deals</h3>
src/components/Partner/EcosystemAnalytics.tsx -- 106: <span>ISO 21500:</span>
src/components/Partner/TrustProgressionIndicator.tsx -- 85: <span>Progress</span>
src/components/PlaybookEditor/PlaybookPropertiesPanel.tsx -- 56: <h3>Node Properties</h3>
src/components/PlaybookEditor/PlaybookToolbar.tsx -- 58: <span>Add:</span>
src/components/Portfolio/PortfolioGridView.tsx -- 135: <p>No initiatives found</p>
src/components/ReportBuilder/blocks/ChartRenderer.tsx -- 153: <p>No chart data available</p>
src/components/ReportBuilder/blocks/PrioritizationMatrix.tsx -- 143: <p>No prioritization data available</p>
src/components/ReportBuilder/blocks/RoadmapTimeline.tsx -- 125: <p>No roadmap data available</p>
src/components/Reports/Management/PortfolioHealthReport.tsx -- 90: <h3>Health Drivers</h3>
src/components/Reports/Management/RaidReport.tsx -- 41: <th>Title</th>
src/components/Reports/Management/TeamMeetingReport.tsx -- 232: <h3>Project Breakdown</h3>
src/components/Reports/Premium/Editor/Extensions/MetricCard.tsx -- 86: placeholder="Etykieta" (PL, bez t())
src/components/Reports/Premium/Editor/Extensions/RecommendationCard.tsx -- 160: <option>Krytyczny</option> (PL, bez t())
src/components/Results/ResultsUIPrimitives.tsx -- 383: <div>BANKED</div>
src/components/RolloutStrategyTab.tsx -- 89: <h3>Program Definition</h3>
src/components/RolloutTeamsTab.tsx -- 87: <th>Role</th>
src/components/Studio/StudioToolbar.tsx -- 145: <span>More</span>
src/components/SuperAdmin/SuperadminRootClosurePanel.tsx -- 11: <h2>One visible platform control plane</h2>
src/components/Trial/TrialBanner.tsx -- 31: <span>Trial Plan</span>
src/components/ai/MAXModeToggle.tsx -- 52: <span>MAX</span>
src/components/dashboard/DashboardExecutionSnapshot.tsx -- 153: <div>Total Initiatives</div>
src/components/dashboard/DashboardOverview.tsx -- 162: <h2>Welcome to Your Transformation Dashboard</h2>
src/components/dashboard/OnboardingDashboard.tsx -- 119: <p>Completed</p>
src/components/governance/GovernanceDashboard.tsx -- 62: <h3>Security Alerts</h3>
src/components/governance/GovernanceRules.tsx -- 41: <th>Rule Name</th>
src/components/governance/GovernanceSettings.tsx -- 14: title="Audit Strategy"
src/components/method-workspace/QuestionHelpDisclosure.tsx -- 101: <p>Typowe dowody:</p> (PL, bez t())
src/components/method-workspace/ResolutionCard.tsx -- 66: <dt>Kto prawdopodobnie wie</dt> (PL, bez t())
src/components/settings/ActivityLog.tsx -- 17: <h3>Activity Log</h3>
src/components/settings/AvatarUploader.tsx -- 52: alt="Avatar"
src/components/settings/BillingSettings.tsx -- 38: title="Subscription Agreement"
src/components/settings/SocialLinksSection.tsx -- 37: <h3>Social Links</h3>
src/components/settings/shared/DomainScreenHeader.tsx -- 58: aria-label="Breadcrumb"
src/components/shared/Banner/Banner.tsx -- 169: aria-label="Dismiss"
src/components/shared/ModuleHub/ActiveFilters.tsx -- 34: <span>Filters:</span>
src/components/shared/Onboarding/OnboardingBanner.tsx -- 14: (komentarz JSDoc — patrz zastrzeżenie niżej)
src/components/shared/TaskMilestoneBlastRadius.tsx -- 38: aria-label="Task milestone blast radius"
src/components/shared/ToolWizard/ToolWizardStepNav.tsx -- 119: title="Missing required items"
src/components/shared/forms/Field.tsx -- 8: (komentarz JSDoc — FAŁSZYWY POZYTYW, nie prawdziwy ekran)
src/components/ui/primitives/Badge.tsx -- 8: (komentarz JSDoc — FAŁSZYWY POZYTYW)
src/components/ui/primitives/Card.tsx -- 8: (komentarz JSDoc — FAŁSZYWY POZYTYW)
src/components/v10/V10TeresaRuntimeWorkspace.tsx -- 39: <div>Voice enabled</div>
src/components/workspaces/AIInsightFeed.tsx -- 21: <h3>AI Insights</h3>
src/components/workspaces/FullStep3Workspace.tsx -- 245: <span>Effort:</span>
src/components/workspaces/ROIPaybackChart.tsx -- 33: <div>ROI</div>
src/components/workspaces/Step1Workspace.tsx -- 125: <label>ERP</label>
src/components/workspaces/Step2Workspace.tsx -- 25: <span>Quick Assessment</span>
src/components/workspaces/Step3Workspace.tsx -- 136: <h4>Strategic Context Ready</h4>
src/views/FullPilotView.tsx -- 10: <h1>Pilot View</h1>
src/views/MyWorkView.tsx -- 31: title="My Work"
src/views/PricingView.tsx -- 441: <span>GDPR Compliant</span>
src/views/StudioUnavailableView.tsx -- 26: <h2>Studio is not available yet</h2>
src/views/V10RuntimeWorkspaceView.tsx -- 56: aria-label="V10 runtime smoke surface"
src/views/docs/DocsChangelogView.tsx -- 425: <h1>Changelog</h1>
src/views/legal/AboutView.tsx -- 88: <h2>Our Mission</h2>
src/views/superadmin/SuperAdminUserManagement.tsx -- 25: <h1>User Management</h1>
src/views/superadmin/components/UserAssignmentsPanel.tsx -- 23: <h3>User Assignments</h3>
```
Zastrzeżenie: 3 wpisy (`Field.tsx`, `Badge.tsx`, `Card.tsx`) to fałszywe pozytywy — regex złapał przykład
w komentarzu JSDoc (`* <Badge variant="primary">New</Badge>`), nie realny render. Nie liczyłem ich do 83
jako „potwierdzone", ale zostawiłem w liście dla przejrzystości — realna liczba potwierdzonych to raczej
**80**, nie 83.

Zaznaczyłem też przy części pozycji `(PL, bez t())` — to pliki, które NIE pokazują angielskiego (więc nie są
priorytetem tego zlecenia), tylko mają polski tekst zaszyty na sztywno bez `t()`. Zostawiam je w liście, bo
formalnie spełniają kryterium R2a (zero `t()`), ale naprawa tych to inny priorytet niż plików z angielskim.

### `NOJSX` (17) — zweryfikowana próbka
Sprawdzono ręcznie 3/17: `Economics/types.tsx` (plik z samymi typami TS), `ui/Button.tsx` (barrel re-export
`export * from './primitives/Button'`), `Reports/Premium/Editor/Extensions/index.tsx` (barrel re-export) —
wszystkie 3 to potwierdzone NIE-ekrany. Pozostałych 14 NIE zweryfikowano indywidualnie — oznaczam jako
prawdopodobnie bezpieczne na podstawie wzorca nazw (`*TopBarChips.tsx`, `*Toolbar*Primitives.tsx`,
`ConvertToMenu.tsx`, `index.tsx`), ale to NIE jest dowód, tylko domysł.

---

## R2b — brakujące klucze i18n dla 6 wskazanych ekranów

### Metoda
Z `dev-render/screens/` zidentyfikowano komponenty produkcyjne montowane przez każdy harness:

| Ekran | Plik harnessu | Komponent produkcyjny |
|---|---|---|
| tool-outputs-panel | `dev-render/screens/tool-outputs-panel.tsx:18` | `src/components/DiscoveryTools/report/ToolOutputsPanel.tsx` |
| report-builder-block-types | `dev-render/screens/report-builder-block-types.tsx:17` | `src/components/ReportBuilder/BlockTypesManager.tsx` |
| report-builder-templates | `dev-render/screens/report-builder-templates.tsx:19` | `src/components/ReportBuilder/TemplatesManager.tsx` |
| aios-home | `dev-render/screens/aios.tsx:37` | `src/components/AIChat/AIOSHub.tsx` |
| aios-actions | `dev-render/screens/aios.tsx:36` | `src/components/AIChat/ActionCenter.tsx` |
| aios-research | `dev-render/screens/aios.tsx:38` | `src/components/AIChat/ResearchSessionsDock.tsx` |

Uwaga: `aios.tsx` montuje jeden harness z wieloma panelami (ActionCenter, ResearchSessionsDock, AIOSHub i
inne) — „aios-home/actions/research" to najbliższe dopasowania po nazwie/funkcji, nie ma osobnych plików
`aios-home.tsx` itd. w `dev-render/screens/`.

Skryptem python wyciągnięto wszystkie literalne klucze `t('...')` oraz klucze szablonowe `` t(`${NS}...`) ``
z każdego pliku i sprawdzono istnienie w `public/locales/pl/translation.json` i `en/translation.json`.

### Wynik

| Ekran | Woła `t()` wcale? | Kluczy (literalnych) | Brakuje w pl | Brakuje w en |
|---|---|---|---|---|
| tool-outputs-panel (`ToolOutputsPanel.tsx`) | TAK | 17 unikalnych | **0** | **0** |
| report-builder-block-types (`BlockTypesManager.tsx`) | TAK (klucze szablonowe `${NS}.x`, NS=`reportBuilder.blockTypesManager`) | 57 wzorców → wszystkie rozwiązane ręcznie do pełnego poddrzewa | **0** | **0** |
| report-builder-templates (`TemplatesManager.tsx`) | TAK (klucze szablonowe, NS=`reportBuilder.templatesManager`) | 44 wzorce → pełne poddrzewo | **0** | **0** |
| aios-home (`AIOSHub.tsx`) | **NIE — zero wywołań `t()`** | 0 | n/d (to R2a, nie R2b) | n/d |
| aios-actions (`ActionCenter.tsx`) | **NIE — zero wywołań `t()`** (substring `t(` łapał `reject(`, `inspect(`, `setSelectedAudit(` itp.) | 0 | n/d (to R2a, nie R2b) | n/d |
| aios-research (`ResearchSessionsDock.tsx`) | **NIE — zero wywołań `t()`** (substring `t(` łapał `setTimeout(`, `reject(` itp.) | 0 | n/d (to R2a, nie R2b) | n/d |

**Ustalenie kluczowe, sprzeczne z przekazanym kontekstem zlecenia:** dla `toolOutputs.*` sprawdzono
`git log -p -- public/locales/pl/translation.json` i znaleziono commit, który JUŻ dodał wszystkie ~23
brakujące klucze:
```
i18n: dodaj brakujące klucze toolOutputs.* (PL/EN)
ToolOutputsPanel/SlideDeckView wołały ~23 klucze t('toolOutputs.*', ...)
```
Zweryfikowano bezpośrednio: wszystkie 17 kluczy realnie wywoływanych przez `ToolOutputsPanel.tsx` istnieją
i mają pełną treść PL i EN (np. `toolOutputs.title` = pl:`'Wyniki'` / en:`'Outputs'`). **Przykład „~15 kluczy
toolOutputs.* nie ma ani w pl, ani w en" z kontekstu zlecenia jest NIEAKTUALNY — defekt już naprawiono w
tej gałęzi przed tym pomiarem.** To samo dotyczy `reportBuilder.blockTypesManager.*` i
`reportBuilder.templatesManager.*` — pełne poddrzewa istnieją w obu językach (sprawdzono treścią, nie tylko
obecnością klucza — patrz przykład: `blockTypesManager.modal.editTitle` pl:`'Edytuj blok'`
en:`'Edit Block'`).

Trzy ekrany `aios-*` NIE są przypadkiem R2b (brakujący klucz) — są przypadkiem R2a (zero i18n w ogóle).
`AIOSHub.tsx` był już na liście R2a wyżej. Dowód dla `ActionCenter.tsx` i `ResearchSessionsDock.tsx`
(które NIE trafiły na listę R2a, bo substring `t(` dał fałszywy pozytyw):
```
src/components/AIChat/ActionCenter.tsx:152:  <h1>Action Center</h1>
src/components/AIChat/ActionCenter.tsx:186:  <div>Loading AI actions...</div>
src/components/AIChat/ActionCenter.tsx:264:  <h2>Run Ledger</h2>
src/components/AIChat/ActionCenter.tsx:294:  <h2>Audit Viewer</h2>
src/components/AIChat/ResearchSessionsDock.tsx:297: <h2>Create Session</h2>
src/components/AIChat/ResearchSessionsDock.tsx:349: <h2>Session Dock</h2>
src/components/AIChat/ResearchSessionsDock.tsx:366: <div>No research sessions yet.</div>
src/components/AIChat/AIOSHub.tsx:101-102: <h1>AI OS control plane</h1>
src/components/AIChat/AIOSHub.tsx:104-108: "One entrypoint for manual acceptance tests of AI Actions..."
```
To znaczy: R2a-owa lista 373 kandydatów (z prostego `grep -rl "t("`) NIEDOSZACOWUJE zbiór, bo pliki
zawierające substring `t(` z innego powodu (np. `setTimeout`) nie trafiają do kandydatów mimo że mają
zero prawdziwych wywołań i18n. Nie przeliczyłem tego systemowo na całym drzewie — to kolejny dowód, że
373 to DOLNA granica, nie górna.

---

## R2c — klucze o identycznej wartości w pl i en

### Metoda
Spłaszczono oba pliki JSON do par `klucz.pełna.ścieżka = wartość` i porównano.

```
Kluczy w pl (spłaszczonych, liście): 33539
Kluczy w en (spłaszczonych, liście): 31610
Kluczy identycznych (ta sama niepusta wartość string w pl i en): 780
```

### 30 przykładów z oceną wg decyzji właściciela (2026-08-31)

| Klucz | Wartość (identyczna w pl i en) | Ocena |
|---|---|---|
| `chatSignals.refType.program` | `Program` | DOZWOLONE — słowo identyczne w obu językach |
| `myWork.filters.status` | `Status` | DOZWOLONE — słowo wskazane wprost przez właściciela jako przykład dozwolony |
| `interview.reviewer.link` | `Link` | DOZWOLONE — zapożyczenie powszechne w polskim UI |
| `assessment.preview.frameworkLabel` | `Framework` | DOZWOLONE — nazwa pojęcia metodyki |
| `initiatives.tabs.portfolio` | `Portfolio` | GRANICZNE — w polskim żargonie biznesowym powszechne, ale to etykieta zakładki menu; rekomendacja: dopuścić (branża konsultingowa używa "portfolio" 1:1) |
| `initiatives.initiativeCharterWizard.lever.compliance` | `Compliance` | GRANICZNE/DEFEKT — dźwignia inicjatywy, nie nazwa metodyki sensu stricto; realny polski odpowiednik "Zgodność" istnieje i jest używany gdzie indziej w apce — REKOMENDACJA: DEFEKT |
| `execution.rollout.risks.col.status` | `Status` | DOZWOLONE |
| `settings.profile.jobTitleSuggestions.cto` | `CTO` | DOZWOLONE — skrót stanowiska, międzynarodowy |
| `settings.profile.timezones.Australia/Sydney` | `Sydney (AEST/AEDT)` | DOZWOLONE — nazwa miasta + kod strefy czasowej, nietłumaczalne |
| `settings.notifications.sounds.sound_bell` | `Bell` | DEFEKT — nazwa dźwięku powiadomienia, nie nazwa metodyki/technologii; powinno być "Dzwonek" |
| `settings.accessibility.colorVision.protanopia` | `Protanopia` | DOZWOLONE — termin medyczny, identyczny w obu językach |
| `showcase.audits.items.adma.fullName` | `Advanced Digital Maturity Assessment` | DOZWOLONE — pełna nazwa własna frameworku audytowego |
| `partner.beta.stories.1.company` | `TransformACE Consulting` | DOZWOLONE — nazwa własna firmy |
| `cloud.providers.dropbox` | `Dropbox` | DOZWOLONE — nazwa własna produktu |
| `aiChat.menu.urlLabel` | `URL` | DOZWOLONE — skrót techniczny |
| `finance.m16.sensitivity.addDriver` | `+ driver` | DEFEKT — to etykieta przycisku UI ("+ driver"), nie nazwa metodyki — powinno być "+ zmienna"/"+ czynnik" |
| `organization.governance.claimPaths.profile.linkedinUrl` | `LinkedIn` | DOZWOLONE — nazwa własna platformy |
| `demo.archilex.tagline` | `Architecting Legal Excellence` | DOZWOLONE — hasło reklamowe firmy demonstracyjnej (dane demo, nie realny klient) |
| `results.drawer.kpiFallback` | `KPI` | DOZWOLONE — skrót techniczny standardowy |
| `pages.partner.process.steps.onboarding.title` | `Onboarding` | GRANICZNE — powszechnie używane w polskim biznesie, ale to nagłówek kroku procesu na stronie publicznej; REKOMENDACJA: dopuścić, niski priorytet |
| `meeting.followUp2` | `Follow-up` | DEFEKT — etykieta UI, ma naturalny polski odpowiednik "Działania następcze"/"Follow-up" bywa już przetłumaczony gdzie indziej w apce niespójnie |
| `docs.layout.brand` | `Consultify Docs` | DOZWOLONE — nazwa własna produktu |
| `ideas.mindmap.minMaxDetail` | `Min: {{min}}, Max: {{max}}` | DOZWOLONE — skróty matematyczne uniwersalne |
| `processFlow.propertiesPanel.systemLabel` | `System` | DOZWOLONE |
| `myWorkTable.inlineAIFill.aiFillButton` | `AI Fill ({{count}})` | DEFEKT — etykieta przycisku akcji w tabeli, powinna być "Uzupełnij AI ({{count}})" |
| `reportBuilder.newAssessmentReportModal.assessment` | `Assessment` | DOZWOLONE — nazwa modułu/metodyki Consultify |
| `sidebar.mcpMarketplace` | `MCP Marketplace` | GRANICZNE — "MCP" to nazwa technologii (dozwolone), ale "Marketplace" to zwykłe słowo UI menu bocznego — REKOMENDACJA: DEFEKT częściowy (przetłumaczyć samo "Marketplace") |
| `settings.profile.jobTitleSuggestions.projectManager` | `Project Manager` | GRANICZNE — sugestia stanowiska, nie nazwa metodyki/technologii z zasady właściciela, ale powszechny anglicyzm zawodowy w PL; REKOMENDACJA: dopuścić (niski priorytet, kosmetyka) |
| `results.strategic.bsc` | `Balanced Scorecard` | DOZWOLONE — nazwa własna frameworku strategicznego (metodyka) |
| `rap.preview.updatedAt` | `Ostatnia zmiana` | **DEFEKT ODWROTNY** — to POLSKI tekst identyczny w pliku EN; interfejs angielski pokaże polskie słowa |

### Znalezisko dodatkowe: defekt odwrotny (polski tekst w pliku EN)
Wśród 780 identycznych par, **co najmniej 40** (33 ze znakami diakrytycznymi wykryte automatycznie + 7
dodatkowych bez diakrytyków znalezionych przez dopasowanie słów typu "Nowy"/"Wybierz"/"Otwórz") to przypadki,
gdzie plik `en/translation.json` zawiera POLSKI tekst zamiast angielskiego — czyli klient z UI ustawionym na
angielski zobaczy polskie słowa. To nie było przedmiotem zlecenia (R2a/R2b/R2c dotyczą braku polskiego), ale
zasługuje na osobne zgłoszenie, bo to ten sam mechanizm defektu w drugą stronę. Przykłady:
```
reports.toast.reportGenerated       pl=en= 'Raport wygenerowany pomyślnie'
reports.toast.shareLinkCopied       pl=en= 'Link do udostępniania skopiowany'
reports.export.pptxSuccess          pl=en= 'PowerPoint wygenerowany pomyślnie'
rap.actions.newFromTemplate         pl=en= 'Nowy z szablonu'
rap.preview.updatedAt               pl=en= 'Ostatnia zmiana'
presentations.templateArchitect.keyMessagePlaceholder  pl=en= 'Jednozdaniowa teza tego slajdu...'
welcome.videoPerson                 pl=en= 'Paweł Bochniarz'  (DOZWOLONE — imię i nazwisko, nazwa własna)
```
Skupione głównie w namespace `reports.toast.*` i `reports.export.*` (co najmniej 19 z 40 przykładów) —
sugeruje, że te klucze zostały PL-first, a EN nigdy nie dostał realnego tłumaczenia, tylko kopię.

---

## PODSUMOWANIE i rekomendacja kolejności naprawy

Miary rzeczywiste (nie audytowe, nie z docs):
- **R2a**: 80 plików pewnie potwierdzonych (po odrzuceniu 3 fałszywych trafień JSDoc) + nieznana, ale
  realna liczba dodatkowa w puli 273 nieprzebadanych `JSXNOTEXT` (potwierdzony dowód niedoszacowania:
  `AIRoleBadge.tsx`) + nieznana liczba plików pominiętych przez fałszywy pozytyw `grep "t("` (potwierdzony
  dowód: `ActionCenter.tsx`, `ResearchSessionsDock.tsx` wcale nie trafiły do kandydatów R2a mimo zera
  prawdziwych wywołań `t()`).
- **R2b**: dla 3 z 6 wskazanych ekranów (tool-outputs-panel, report-builder-block-types,
  report-builder-templates) — **0 brakujących kluczy, defekt już naprawiony wcześniejszym commitem**.
  Pozostałe 3 ekrany (aios-home/actions/research) to NIE R2b — to R2a (zero i18n).
- **R2c**: 780 kluczy o identycznej wartości pl/en; z próbki 30 oszacowano proporcję: ok. 60-65%
  DOZWOLONE (nazwy własne, metodyka, skróty techniczne, słowa identyczne), ok. 20-25% GRANICZNE (do
  decyzji Piotra), ok. 10-15% wyraźny DEFEKT (etykiety przycisków/menu po angielsku bez uzasadnienia
  metodycznego). Dodatkowo min. 40 kluczy to defekt ODWROTNY (polski tekst w pliku EN) — osobna kategoria,
  poza zakresem R2a/R2b/R2c ale tego samego mechanizmu.

### Rekomendowana kolejność naprawy (najtańsze i najszersze najpierw)
1. **R2b — już zamknięte, nic do zrobienia** dla 3 z 6 ekranów; potwierdzić na żywym demo (nie tylko w
   kodzie), bo to jedyny sposób odróżnienia „naprawione w kodzie" od „naprawione i wdrożone".
2. **R2c defekt odwrotny (EN=PL, ~40 kluczy)** — najtańsze: skoncentrowane w 2 namespace'ach
   (`reports.toast.*`, `reports.export.*`), jedna osoba może przetłumaczyć wszystkie w jednym przebiegu,
   bez ryzyka dotknięcia komponentów (tylko JSON).
3. **R2a — 80 potwierdzonych plików z listy `TEXT`** — mechaniczna naprawa (dodać `t()` + klucz), zysk
   natychmiast widoczny, ryzyko niskie (pliki już zidentyfikowane z numerem linii).
4. **R2c defekt jednoznaczny (~10-15% z 780, czyli ~80-120 kluczy)** — wymaga oceny każdego przypadku
   względem reguły właściciela (metodyka/technologia vs UI), więc wolniejsze niż punkt 3, ale nadal czysto
   tekstowe (JSON only).
5. **R2c przypadki GRANICZNE (~20-25%, ~160-195 kluczy)** — wymaga decyzji Piotra per przypadek lub per
   kategoria (np. „czy tytuły stanowisk zostają po angielsku") — NIE naprawiać bez akceptu, bo właśnie ten
   rodzaj samowolnego rozciągnięcia reguły już raz zaszkodził (zamiana działającego polskiego na angielski).
6. **R2a — pula 273 `JSXNOTEXT`** — najdroższe: wymaga ręcznego przeglądu każdego pliku (regex już
   udowodnił, że zawodzi), bo trzeba odróżnić prawdziwy brak UI (komponent typu ikona/log) od tekstu
   wstawianego przez zmienną (jak `AIRoleBadge.tsx`). Rekomendacja: podzielić na paczki po katalogach
   modułów i zlecić przegląd równolegle, zaczynając od katalogów z dużą liczbą kandydatów widocznych w
   R2a (Presentations/DeckBuilder, MyWork, Studio, ui/primitives).
