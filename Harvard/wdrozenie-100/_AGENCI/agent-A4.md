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
