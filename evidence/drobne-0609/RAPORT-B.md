# CZĘŚĆ B — 7 + 5 czerwonych testów zastanych (DLUG-DNIA)

## Liczby PRZED (zmierzone `npx vitest run <ścieżki> --reporter=json`)

| Plik | total | failed przed |
|---|---|---|
| AdminAuditExportHistoryPanel.test.tsx | 2 | 1 |
| AdminAuditIntegrityPanel.test.tsx | 3 | 0 (już zielony) |
| AdminDay2I18n.test.ts | 10 | 1 |
| AdminDependenciesPanel.test.tsx | 3 | 1 |
| AdminJobsPanel.test.tsx | 3 | 1 |
| AdminSeatsLicencesPanel.test.tsx | 3 | 2 |
| AdminSecurityAlertsPanel.test.tsx | 3 | 1 |
| resultsVNextLegacyArchiveWiring.test.tsx | 10 | 5 |
| **SUMA** | **37** | **12** (7 rodzina Admin + 5 resultsVNext — zgadza się ze zgłoszeniem DLUG-DNIA) |

## Liczby PO

| Plik | failed po |
|---|---|
| AdminAuditExportHistoryPanel.test.tsx | 0 |
| AdminAuditIntegrityPanel.test.tsx | 0 |
| **AdminDay2I18n.test.ts** | **1 — POZOSTAJE CZERWONY, ŚWIADOMIE** |
| AdminDependenciesPanel.test.tsx | 0 |
| AdminJobsPanel.test.tsx | 0 |
| AdminSeatsLicencesPanel.test.tsx | 0 |
| AdminSecurityAlertsPanel.test.tsx | 0 |
| resultsVNextLegacyArchiveWiring.test.tsx | 0 |
| **SUMA** | **1/37** |

11 z 12 zielonych. `esbuild` na każdym zmienionym pliku testowym: exit 0.

## Naprawione — przyczyna: stare selektory/asercje (błąd testu, nie produktu)

1. **AdminAuditExportHistoryPanel.test.tsx:29** — oczekiwał surowego enuma
   `'audit_logs_csv'`; komponent (`AdminAuditExportHistoryPanel.tsx:36`)
   renderuje `t('...kinds.audit_logs_csv')`, a klucz ISTNIEJE w
   `public/locales/pl/translation.json:22691` = `"Dziennik audytu (CSV)"`.
   Naprawa: asercja na przetłumaczony tekst.
2. **AdminDependenciesPanel.test.tsx:38** — `findByText('Baza danych')`
   łapał DWA elementy: nagłówek (fixture `label`) i tłumaczenie
   `admin.dependencies.kind.database` (też "Baza danych" w słowniku PL) —
   kolizja fixture testu z realnym słownikiem, nie defekt produktu. Naprawa:
   `getByRole('heading', {name: 'Baza danych'})`.
3. **AdminJobsPanel.test.tsx:33** — oczekiwał `'role-change'`; brak klucza
   `admin.health.queues-jobs.types.role-change` w PL → komponent
   (`AdminJobsPanel.tsx:45`) spada na `defaultValue: humanizeEnum(...)` =
   `"Role Change"`. Naprawa: asercja na sformatowaną etykietę.
4. **AdminSeatsLicencesPanel.test.tsx:47,54** — analogicznie, brak klucza
   `...seats-licences.types.invite` → `humanizeEnum('invite')` = `"Invite"`.
5. **AdminSecurityAlertsPanel.test.tsx:29** — analogicznie, brak klucza
   `...security-alerts.eventTypes.login_failed` → `humanizeEnum(...)` =
   `"Login Failed"`.
6. **resultsVNextLegacyArchiveWiring.test.tsx** (5 przypadków, 2 przyczyny):
   - 3× `useLocation() may be used only in the context of a <Router>` —
     `StandardModuleBar` → `useStandardPanelControls` → `useJedenPanel`
     (`src/components/shared/PreviewPane/useJedenPanel.ts:74`) woła dziś
     `useLocation()`; test renderował `<ResultsRoiRegistryPage/>` i
     `<ResultsOkrRegistryPage/>` BEZ `<MemoryRouter>` (KPI-owy wariant w tym
     samym pliku już miał wrapper — ten sam wzorzec zastosowany do ROI/OKR).
     Po naprawie Routera ujawniły się DWIE dodatkowe stare asercje o
     `data-testid="results-vnext-{roi,okr}-disabled"` — `roiRegistry`/
     `okrRegistry` są dziś default-ON (DEC 03.09 wieczór A1,
     `resultsVNextFeatureFlags.ts:224-231`), więc bez `?resultsView=legacy`
     montuje się realny Hub, nie placeholder „jeszcze nie włączone”. Usunięto
     tę jedną, już nieaktualną asercję — rdzeń testu (`legacyPanelMock`
     NIE wywołany) zostaje, identyczny wzorzec jak w sąsiednim teście KPI w
     tym samym pliku (który nigdy takiej asercji nie miał).
   - 2× `expect(ids).toEqual([...])` bez `'search'` — `resultsSearch` jest
     dziś TAKŻE default-ON wszędzie (ta sama decyzja A1). Zaktualizowano
     oczekiwaną listę zakładek do `['kpi','okr','roi','search']` (flaga OFF)
     i `['kpi','okr','roi','search','legacy']` (flaga ON) — zero
     rozluźnienia: nadal `not.toContain('legacy')` przy fladze OFF.

## NIE naprawione — ZNALEZISKO realne (produkt, nie test)

**AdminDay2I18n.test.ts — „keeps the exact 26-panel denominator free of ...
defaultValue"** (linia 62-67) skanuje źródło 26 paneli i odrzuca KAŻDE
wystąpienie literału `defaultValue` — zamierzony bezpiecznik przeciw cichym
angielskim/surowym fallbackom w i18n. Test zatrzymuje się na PIERWSZYM
naruszeniu w kolejności tablicy `PANELS` (zwykła pętla `for` z `expect`, nie
zbiera wszystkich naruszeń) — trafia na `AdminAccessReviewsPanel.tsx:48`.

Realny problem: wzorzec `t(key, {defaultValue: humanizeEnum(...)})` /
`t(key, {defaultValue: row.role})` jest DZIŚ używany w co najmniej 5 plikach
z listy 26 kontraktowanych paneli — dokładnie te same pliki, których testy
właśnie naprawiłem w tej sesji, bo ICH testy oczekują TEGO WŁAŚNIE
zachowania (`defaultValue: humanizeEnum(...)`):

- `src/components/Admin/AdminAccessReviewsPanel.tsx:48`
- `src/components/Admin/AdminAuditExportHistoryPanel.tsx:36`
- `src/components/Admin/AdminJobsPanel.tsx:45`
- `src/components/Admin/AdminSeatsLicencesPanel.tsx:96`
- `src/components/Admin/AdminSecurityAlertsPanel.tsx:35`

Czyli DWA kontrakty w tym samym module się wykluczają: (a) i18n-contract
test mówi „zero `defaultValue` w tych 26 plikach"; (b) enum-humanization
konwencja (`utils/enumLabels.ts`, „nigdy surowego enuma") używa DOKŁADNIE
`t(key, {defaultValue: humanizeEnum(...)})` jako jedynego bezpiecznego
sposobu pokazania czytelnej etykiety, gdy klucz tłumaczenia nie istnieje.
Sprzeczność własnego szkieletu (ten sam kształt co DEC-317 „naprawa
sprzeczności szkieletu" z niedawnego dyżuru) — NIE rozstrzygana tutaj:
- NIE rozluźniłem asercji testu (usunięcie/zmiana `not.toContain('defaultValue')`
  ukryłoby prawdziwy defekt kontraktu).
- NIE zmieniałem 5 plików produktu (poza zakresem „tylko błędy testów”; moduł
  14_ADMIN zamrożony, zmiana wzorca i18n w 5 plikach na raz to decyzja, nie
  poprawka testu).
- Test świadomie POZOSTAJE czerwony (1/37) — zgłoszone jako ZNALEZISKO,
  potrzebna decyzja właściciela: albo dodać wyjątek do i18n-contract testu
  dla wzorca `defaultValue: humanizeEnum(...)`/`defaultValue: row.role`
  (odróżnić go od zakazanych literałów typu `t('x', 'Raw English')`), albo
  zastąpić `humanizeEnum` fallback w tych 5 plikach realnymi kluczami
  tłumaczeń.
