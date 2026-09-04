---
doc_id: wave3-testy-puste-dowody-20260904
status: aktualny
data: 2026-09-04
---

# Testy puste — dowody mutacyjne z odbioru adwersaryjnego (04.09)

★ **Ten plik jest pisany ręcznie.** Sąsiedni `REJESTR_TESTY_PUSTE_20260903.md` jest
**generowany** przez `scripts/dev/testy-puste-skan.mjs` i każdy przebieg bezpiecznika
`tests/unit/config/noEmptyAssertions.test.ts` nadpisuje go w całości — ręczny dopisek tam
znika bez śladu (zdarzyło się 04.09, dopisek przeżył 12 minut). Wnioski, których skaner nie
umie wyprodukować, trzymamy tutaj.

## Dlaczego kolumna `PUSTY` w rejestrze stoi na 0

Skaner **nigdy** nie nadaje klasy `PUSTY` na podstawie tekstu — wymaga dowodu mutacyjnego,
którego sam wykonać nie może. Dyżur 309 odmówił zgadywania i to była decyzja uczciwa.
Odbiorca adwersaryjny (Opus, 04.09) wykonał 5 mutacji funkcji **produkcyjnych**:

| Kandydat | Mutacja produktu | Wynik | Klasa |
|---|---|---|---|
| `scimService.test.ts` | `SCIMService.ts` → `export default {}` | **12/12 PASS** | **PUSTY** |
| `contentService.test.ts` („should return dashboard data”) | funkcja zwraca `{-999,-999}` | **PASS** | **PUSTY** |
| `billingCron` | mutacja funkcji | test czerwieni | NIE pusty |
| `siemService` | mutacja funkcji | test czerwieni | NIE pusty |
| `chatPolicyGateway` | mutacja funkcji | test czerwieni | NIE pusty — ale broni **tylko literału**: produkcja bezwarunkowo dopisuje dwa napisy do listy, nie ma tam egzekucji do zmutowania |

**Ekstrapolacja odbiorcy: rzędu 8 pustych z 21 kandydatów.**

## Ślepa plama skanera — poza zasięgiem obecnej heurystyki

Skaner szuka sygnału sieci/bazy, więc nie widzi testów, które z produktem nie rozmawiają wcale:

- **267 plików / 1766 bloków** bez żadnego wiązania z produktem;
- **13 plików definiuje PODMIOT TESTU wewnątrz pliku testu** — np.
  `const MessageBubble = () => <div data-testid=... />`. Test renderuje własną atrapę
  i przechodzi niezależnie od tego, co robi produkt. To jest kształt „biblioteka bez
  wywołania” przeniesiony do testów;
- `tests/unit/services/api-extensions.test.ts` **testuje moduł, którego w repo nie ma** —
  `find` po `*api-extensions*` w `src/` i `server/` zwraca pustkę.

## Do następnego dyżuru
1. Rozszerzyć skaner o wykrywanie podmiotu testu zdefiniowanego w pliku testu.
2. Rozstrzygnąć mutacją pozostałe 16 kandydatów (2 z 21 już rozstrzygnięte jako `PUSTY`).
3. Usunąć albo naprawić `api-extensions.test.ts`.

## Dyżur 318 — dowody własne

| ID | Kandydat | Mutacja produktu | Przed | Po mutacji | Klasa na markerze | Działanie |
|---|---|---|---|---|---|---|
| E0016 | `billingCron.test.ts:111` — `should handle database errors` | `server/cron/billingCron.ts::checkAndTriggerAlerts` → natychmiastowy `return` | PASS | PASS | **PUSTY** | Mock bazy zmieniony na odrzucany Promise; dodano asercję zapytania i braku wywołania serwisu. Po naprawie: PASS; ta sama mutacja: FAIL. |
| E0017 | `billingCron.test.ts:119` — `should continue processing even if one org fails` | `server/cron/billingCron.ts::checkAndTriggerAlerts` → natychmiastowy `return` | PASS | PASS | **PUSTY** | Mock bazy zmieniony na Promise z dwiema organizacjami; dodano asercje obu wywołań serwisu. Po naprawie: PASS; ta sama mutacja: FAIL. |
| E0002 | `SlashMenu.behavior.test.tsx:145` — filtr `ai` | `SlashMenu.tsx` → filtr zawsze zwraca pustą listę | PASS | FAIL | **NIE PUSTY** | `e2-przed.json`, `e2-mutacja.json`; mutacja cofnięta, diff produktu pusty. |
| E0004 | `help.routes.test.ts:79` — rationale `en` + `pl` | `buildRationale` → `en=''`, `pl=''` | PASS | FAIL | **NIE PUSTY** | `e4-przed.json`, `e4-mutacja.json`; właściwy config serwerowy, mutacja cofnięta. |
| E0006 | `governedRetrievalService.test.ts:318` — walidacja ACL | `checkACL` → pusty obiekt | PASS | FAIL | **NIE PUSTY** | `e6-przed.json`, `e6-mutacja.json`; właściwy config serwerowy, mutacja cofnięta. |
| E0012 | `my-work.convert.contract.test.ts:226` — zapis `promoted_to` | SQL produktu `promoted_to` → `mutated_to` | PASS | FAIL | **NIE PUSTY** | `e12-przed.json`, `e12-mutacja.json`; mutacja cofnięta. |
| E0015 | `aiContextBuilder.test.ts:68` — pełny kontekst | `buildContext` → pusty obiekt | PASS | FAIL | **NIE PUSTY** | `e15-przed.json`, `e15-mutacja.json`; mutacja cofnięta. |
| E0001 | `MeetingHub.smoke.test.tsx:120` — błąd i retry | nie wykonano: baseline jest czerwony | FAIL (`querySelector` na `null`, linia 134) | n/d | **NOT_PROVEN** | `e1-przed.json`; bez zielonego kierunku mutacja nie rozstrzyga klasy. |
| E0003 | `table-platform.routes.test.ts:427` — istnienie route | nie wykonano: baseline jest czerwony | FAIL (`argument handler must be a function`) | n/d | **NOT_PROVEN** | `e3-przed.json`; uruchomiono z `server/vitest.config.ts`, bez zielonego kierunku. |
| E0008 | `CandidatesTable.t28.test.tsx:49` — kolumny kandydata | nie wykonano: suite nie ładuje produktu | FAIL (zerwana ścieżka importu `../../../src/...`) | n/d | **NOT_PROVEN** | `e8-przed.json`; 0 wykonanych przypadków, więc nie ma baseline do mutacji. |
| E0009 | `ollama.integration.test.ts:22` — health | brak funkcji produktu; blok woła bezpośrednio `localhost:11434` | SKIP przy `OLLAMA_TEST=false` | n/d | **NOT_PROVEN** | `e9-przed.json`; uruchomienie z `OLLAMA_TEST=true` narusza Z15. |
| E0010 | `ollama.integration.test.ts:82` — streaming | brak funkcji produktu; blok woła bezpośrednio `localhost:11434` | SKIP przy `OLLAMA_TEST=false` | n/d | **NOT_PROVEN** | `e10-przed.json`; brak dopuszczalnego celu mutacji produktu. |
| E0011 | `ollama.integration.test.ts:102` — chat completions | brak funkcji produktu; blok woła bezpośrednio `localhost:11434` | SKIP przy `OLLAMA_TEST=false` | n/d | **NOT_PROVEN** | `e11-przed.json`; brak dopuszczalnego celu mutacji produktu. |
| E0013 | `pmo-project-members.integration.test.ts:115` — typy RACI | nie uruchomiono: test importuje `server/src/index.ts` | n/d | n/d | **NOT_PROVEN** | Z30 wprost zakazuje uruchamiania pełnego `server/src/index.ts` dla testów; brak bezpiecznego celu mutacji. |
| E0014 | `workbook.p23ext.test.ts:374` — lista workbooków | brak funkcji produktu; bezpośredni `fetch` do runtime i `return` przy jego braku/401 | n/d | n/d | **NOT_PROVEN** | Blok nie importuje handlera; instrukcja przydziela harness 5474, a test nie montuje go i ma własny adres. |

## Dyżur 332 — triage 64 plików bez importu + rozstrzygnięcie 8 NOT_PROVEN

Pomiar własny: `selfDefinedSubjects=190`, `selfDefinedSubjectsWithoutProductImports=64`.
Klasa `REALNY DEFEKT` oznacza lokalny podmiot o nazwie istniejącego komponentu produktu,
renderowany zamiast niego. `UZASADNIONY WZORZEC` oznacza jawny `Mock*`/`Harness` albo nazwę,
której odpowiednika-komponentu nie ma w `src/` ani `server/src/`.

| Plik | Podmiot | Klasa | Uzasadnienie |
|---|---|---|---|
| `tests/components/AIChat/ArtifactsPanel.test.tsx` | `ArtifactsPanel` | **REALNY DEFEKT** | Produkt eksportuje `src/components/AIChat/Artifacts/ArtifactsPanel.tsx`; test renderuje lokalną atrapę. |
| `tests/components/AIChat/FocusModeSelector.test.tsx` | `FocusModeSelector` | **REALNY DEFEKT** | Produkt eksportuje `src/components/AIChat/Input/FocusModeSelector.tsx`; test renderuje lokalną atrapę. |
| `tests/components/AIChat/MessageBubble.test.tsx` | `MessageBubble` | **REALNY DEFEKT** | Produkt eksportuje `src/components/AIChat/Messages/MessageBubble.tsx`; test renderuje lokalną atrapę. |
| `tests/components/AIChat/ThinkingBlock.test.tsx` | `ThinkingBlock` | **REALNY DEFEKT** | Produkt eksportuje `src/components/AIChat/Messages/ThinkingBlock.tsx`; test renderuje lokalną atrapę. |
| `tests/components/Admin/AdminLayout.test.tsx` | `AdminLayout` | UZASADNIONY WZORZEC | Brak komponentu produktu o nazwie `AdminLayout`. |
| `tests/components/Admin/AdminSidebar.test.tsx` | `AdminSidebar` | UZASADNIONY WZORZEC | Brak komponentu produktu o nazwie `AdminSidebar`; istnieje odrębny `SuperAdminSidebar`. |
| `tests/components/AssessmentHubDashboard.test.tsx` | `MockAssessmentHubDashboard` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`; nie podszywa się pod nazwę produktu. |
| `tests/components/Economics/FinancialMetricsPanel.test.tsx` | `FinancialMetricsPanel` | **REALNY DEFEKT** | Produkt eksportuje `src/components/Economics/FinancialMetricsPanel.tsx`; test renderuje lokalną atrapę. |
| `tests/components/MyWork/DecisionsPanel.test.tsx` | `MockDecisionsPanel` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`; nie podszywa się pod nazwę produktu. |
| `tests/components/MyWork/InboxTriage.test.tsx` | `InboxTriage` | **REALNY DEFEKT** | Produkt eksportuje `src/components/MyWork/Inbox/InboxTriage.tsx`; test renderuje lokalną atrapę. Zakres zapisu MyWork jest wyłączony przez B.4.3. |
| `tests/components/MyWork/MyWorkHub.test.tsx` | `MockMyWorkHub` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`; nie podszywa się pod nazwę produktu. |
| `tests/components/MyWork/table/financial/FinancialCaseDialog.persistence.test.tsx` | `Harness` | UZASADNIONY WZORZEC | Jawny harness testowy, brak komponentu produktu `Harness`. |
| `tests/components/Onboarding/OnboardingComplete.test.tsx` | `OnboardingComplete` | UZASADNIONY WZORZEC | Brak komponentu produktu o tej nazwie. |
| `tests/components/Onboarding/OnboardingProgress.test.tsx` | `OnboardingProgress` | UZASADNIONY WZORZEC | Brak komponentu produktu o tej nazwie; występuje jedynie typ/usługa. |
| `tests/components/Onboarding/OnboardingStep.test.tsx` | `OnboardingStep` | UZASADNIONY WZORZEC | Brak komponentu produktu o tej nazwie; występuje jedynie typ. |
| `tests/components/Onboarding/OnboardingWelcome.test.tsx` | `OnboardingWelcome` | UZASADNIONY WZORZEC | Brak komponentu produktu o tej nazwie. |
| `tests/components/Onboarding/OnboardingWizard.test.tsx` | `OnboardingWizard` | **REALNY DEFEKT** | Produkt eksportuje `src/views/OnboardingWizard.tsx`; test renderuje lokalną atrapę. |
| `tests/unit/components/Assessment/RolloutPlanTab.test.tsx` | `MockRolloutPlanTab` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/Demo/DemoLoadingOverlay.test.tsx` | `MockDemoLoadingOverlay` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/Demo/DemoUpgradePrompt.test.tsx` | `MockDemoUpgradePrompt` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/Demo/DemoWelcomeTour.test.tsx` | `MockDemoWelcomeTour` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/Demo/SmartDemoBanner.test.tsx` | `MockSmartDemoBanner` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/Modal/ExitIntentModal.test.tsx` | `MockExitIntentModal` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/Navigation/Sidebar.test.tsx` | `MockSidebar` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Accordion.test.tsx` | `MockAccordion` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Alert.test.tsx` | `MockAlert` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Avatar.test.tsx` | `MockAvatar` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Badge.test.tsx` | `MockBadge` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Breadcrumb.test.tsx` | `MockBreadcrumb` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Button.test.tsx` | `MockButton` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Card.test.tsx` | `MockCard` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Checkbox.test.tsx` | `MockCheckbox` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Chip.test.tsx` | `MockChip` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Collapse.test.tsx` | `MockCollapse` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/DataTable.test.tsx` | `MockDataTable` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/DatePicker.test.tsx` | `MockDatePicker` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Divider.test.tsx` | `MockDivider` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Drawer.test.tsx` | `MockDrawer` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Dropdown.test.tsx` | `MockDropdown` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/EmptyState.test.tsx` | `MockEmptyState` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/FileUpload.test.tsx` | `MockFileUpload` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/FormControl.test.tsx` | `MockFormControl` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Input.test.tsx` | `MockInput` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Label.test.tsx` | `MockLabel` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Modal.test.tsx` | `MockModal` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Pagination.test.tsx` | `MockPagination` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Popover.test.tsx` | `MockPopover` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/ProgressBar.test.tsx` | `MockProgressBar` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Radio.test.tsx` | `MockRadio` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/RadioGroup.test.tsx` | `MockRadioGroup` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Rating.test.tsx` | `MockRating` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/SearchInput.test.tsx` | `MockSearchInput` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Select.test.tsx` | `MockSelect` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Skeleton.test.tsx` | `MockSkeleton` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Slider.test.tsx` | `MockSlider` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Spinner.test.tsx` | `MockSpinner` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Stepper.test.tsx` | `MockStepper` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Switch.test.tsx` | `MockSwitch` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Tabs.test.tsx` | `MockTabs` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Textarea.test.tsx` | `MockTextarea` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Timeline.test.tsx` | `MockTimeline` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Toast.test.tsx` | `MockToast` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/components/UI/Tooltip.test.tsx` | `MockTooltip` | UZASADNIONY WZORZEC | Jawna nazwa `Mock*`. |
| `tests/unit/naglowkiKolumnJezyk.test.ts` | `KLUCZ_NAGLOWKA` | UZASADNIONY WZORZEC | Lokalny predykat testowy, nie komponent produktu. |

Wynik: **7 REALNYCH DEFEKTÓW, 57 UZASADNIONYCH WZORCÓW**. `InboxTriage` nie może być
naprawiony w tym dyżurze, ponieważ B.4.3 jawnie wyłącza zapis w `src/components/MyWork/**`;
pozostaje briefem dla dyżuru 331.

### R2 — naprawa potwierdzonego przykładu

| Plik | Kierunek zielony | Mutacja produktu | Wynik mutacji | Werdykt |
|---|---|---|---|---|
| `tests/components/AIChat/MessageBubble.test.tsx` | realny `MessageBubble` renderuje treść; 2/2 PASS | usunięto wyświetlenie `message.content` w produkcie | asercja treści FAIL, drugi przypadek PASS; po `cp` diff produktu pusty | **NAPRAWIONY, NIE PUSTY** |

Pozostałe realne defekty R1 nie są tu oznaczone jako naprawione. `InboxTriage` jest poza
licencją zapisu B.4.3; pięć pozostałych wymaga osobnych adaptacji kontraktów i mutacji.
