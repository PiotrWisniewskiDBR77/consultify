# ZLECENIE — Agent A4 · Klaster: Results + Finance + Admin/Org/SuperAdmin/Settings/Internal Tools
**Wznów:** [`_PROTOKOL.md`](_PROTOKOL.md) → to zlecenie → [`_STATUS.md`](_STATUS.md) → spec.
**Branch/worktree:** `reskin/A4/wave-<n>`

## Własność wyłączna (pliki)
`src/components/Benefits/**` · `src/components/Results/**` · `src/components/Economics/**` · `src/components/Finance/**` · `src/components/Admin/**` · `src/views/admin/**` · `src/views/superadmin/**` · `src/components/SuperAdmin/**` · `src/views/SettingsView.tsx` · `src/views/settings/**` · `src/views/OrganizationView.tsx`

## Priorytet
P1 = Results + Finance (golden-path). P2 = Settings + Admin. P3 = SuperAdmin (24 ekrany, dbr77-internal) + Internal Tools — reskin PO golden-path.

## Zadania per fala
- **Fala 1 (Listy §14):** Results KPI table · Finance statements · Admin People/Team/Integrations/Audit-log/Bulk · SuperAdmin listy · Settings Integrations/API-keys · Org Members/Domains.
- **Fala 2 (Artefakty §11.2):** ROI View · Settings Profile · Org Profile/Goals/Challenges/Strategy/Branding · Admin Org-settings · SuperAdmin prompt-builder/whitelabel.
- **Fala 3 (Instrumenty §15):** Results StatusDashboard · Capacity Heatmap · Finance ROIPaybackChart · wszystkie panele Settings/Admin/SuperAdmin (billing/security/analytics/ai-config).
- **Fala 5 (Light).**

## Znane bugi (z walkthrough)
- M15 Results: BRAK Menu 3 (R-1) · Menu 2 nie w ramkach (R-5) · filtry dark bez ramek (R-3) · badge Wstrzymaj/Zatrzymaj niespójne (R-4) · **widok = 4 koncepty w jednym scrollu → REDESIGN IA nie tylko skóra (R-7)** · Value Driver Tree nieinteraktywne + śmieci E2E (R-13/14) · KPI Edit Columns dramat (R-15) · DEMO/E2E śmieci w prod (R-8/12) · Finance `dark:bg-slate-50`=białe w dark (antywzorzec) · Admin M24 „grafika 10 lat".

## RAPORTY
<!-- Fala X · ekran · pliki · DoD · pominięte -->

### RAPORT — Fala 1 · Results + Finance listy (2026-07-02, branch `reskin/A4/wave-1`)
**Commity:** `c22491133f` (Results ×5), `ca88c2280a` (Economics ×4), `9027053a80` (Finance ×2). Worktree `agent-af9968bc0683adebb`, NIE zmergowane.

**Ekrany / pliki (11):**
- `Results/ResultsKPITable.tsx` — KPI table+grid: pełna migracja slate/navy→`c.*`; sort-pille: aktywny stan crimson→neutral (`bg-c-surface-raised` + `border-c-border-strong`), nieaktywne dostały widoczną ramkę `border-c-border` w OBU trybach (R-3); avatar ownera i link inicjatywy: crimson→`c-info`/neutral; statusy emerald/danger→`text-c-success`/`text-c-danger`.
- `Results/ResultsHub.tsx` — filtry Stage/Health/KPI-link (wspólna klasa selecta): `bg-white/80 dark:bg-white/[0.04]`→`bg-c-surface`, ramka `border-c-border` widoczna w dark (R-3), `focus:ring-primary-500/30`→`focus:ring-c-focus`; chip "Realized ROI" kropka crimson→emerald.
- `Results/ResultsInitiativesView.tsx` — checkboxy: crimson accent→`text-c-focus-solid` + `ring-c-focus` (SYS-1); selected status w edytorze: crimson→neutral; panel bg→`c-surface`.
- `Results/ResultsKpiScorecardsView.tsx`, `Results/ResultsReportingEnterpriseViews.tsx` — inputy: `ring-c-focus`, `border-c-border`, `bg-c-surface`; panele→tokeny.
- `Finance/CanonicalStatementTable.tsx` (P1 statements) — nagłówek `bg-c-surface-raised text-c-text-muted`, kontener `bg-c-surface border-c-border-subtle`, zebra black/white-alpha, totale/subtotale `border-c-border(-subtle)` + `text-c-text`, delty `text-c-success/danger`, indent-bar `bg-c-border-subtle`.
- `Finance/FinancialStatementImportWizard.tsx` — panel `bg-c-surface`.
- `Economics/FinanceHub.tsx` + `Economics/modals/CreateBudgetModal.tsx` — **KRYTYCZNY antywzorzec `dark:bg-slate-50` (białe CTA w dark) usunięty**: inverted-primary wg §9.2① wyrażony tokenami `bg-c-text text-c-bg hover:opacity-90`; panele empty-state→`bg-c-surface`.
- `Economics/FinancePreviewPanel.tsx` — 6× `bg-white/80`→`bg-c-surface`; linki "View all"/"Show all" crimson→`text-c-info`; pigułka kategorii `budget` crimson→amber; kategoria wskaźników `efficiency` crimson→violet (crimson nigdy jako dana, §15.1④).
- `Economics/FinanceLaneStrip.tsx` — chipy lane: ramka `border-c-border` w obu trybach, spinner crimson→`c-info`, kropka `actual` crimson→`c-success`.

**DoD:** grep sanity 0× `dark:bg-slate-50` / `bg-white/80` / `ring-primary` w dotkniętych plikach; zmiany = wyłącznie klasy CSS (git diff 98+/98-, zero logiki). `npm run build` NIE odpalony (zlecenie: zero npm) — do odpalenia przez Stratega przed merge.

**Badge "Wstrzymaj/Zatrzymaj" (R-4):** stringów NIE MA w kodzie FE (grep cały src + pl/translation.json: tylko `initiative.stop` w `InitiativeDetailModal`). Wniosek: pigułki które widział Piotr są renderowane z DANYCH (payload rekomendacji V8/AI po polsku) — wymaga inspekcji runtime, nie fixu klas. `ResultsInitiativesView` już używa `getStatusStyle().dot`.

**Dane DEMO (R-8/R-12) — lokalizacje hardcoded w kodzie (P1 do osobnego fixu):**
- `src/components/Results/resultsShowcaseData.ts` — cały plik fake danych (showcase-init-1/2/3, showcase-kpi-1..., "SMED rollout on bottleneck line"); gate: `shouldUseResultsShowcaseData()` = tylko przy `shouldAllowDemoData()`, ale wstrzykuje się do pustych list w: `ResultsHub`, `ResultsKpiReportsView` (L228/250), `ResultsKpiScorecardsView`, `ResultsReportingEnterpriseViews`.

**TODO / luki (poza Falą 1):**
- `Benefits/ValuationWorkspace.tsx` L1136 pigułka kategorii `bg-primary-100 text-primary-700` (różowa) + L1165 CTA `dark:bg-[#F4F7FB]` hex — ten sam antywzorzec rodziny CTA, plik = artefakt Fala 2, nie ruszany teraz.
- `Results/OperationalAnalysisView.tsx` — rose-400/500 zamiast `c-danger` (instrument, Fala 3).
- `Results/ResultsKpiReportsView.tsx`, `ROITrackingView`, `ROIAnalysisView` — ~17 pozostałych `ring-primary`/navy (checkboxy L151/L1167/L185 mają `border-navy-600 bg-navy-800` nawet w light!) — kolejna porcja Fali 1.
- `PortfolioInsightsPanel.tsx` + `ValueDriverTree.tsx` — NIE dotknięte (pre-existing błędy TS, zakaz z zlecenia).
- Parity Gate §14.7 dla Results (preview pane, bulk bar) — praca Fala 1+, nie mechaniczna, nie zaczęta.
