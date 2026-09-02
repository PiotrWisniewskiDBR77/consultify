# Rejestr rodziny: surowy identyfikator/enum zamiast etykiety (2026-09-02)

Punkt wyjścia: zgłoszenie właściciela w Finansach — kolumna „Okres bazowy” pokazywała
surową wartość techniczną `per-2025-12` zamiast `12/2025`. Dyżur naprawczy rozszerzył
kontrakt kontekstu bazowego (etykieta + daty okresu, dowód mutacyjny: `UPDATE` etykiety
w bazie zmienił odpowiedź trasy → commit `ff5f3fd863`, już na gałęzi bazowej).

Ten dyżur: **poszukiwanie rodziny po wzorcu sklejania** (nie po napisie), zgodnie z
zasadą „naprawa per-zgłoszenie daje poprawne w dwóch na trzy” (defekt `8dni`).

Środowisko: `git worktree add /private/tmp/ag-surowe-id -b agent/surowe-id-20260902 6fe16e2bd4`.

## Metoda (K1-K2)

Szukano wzorców, nie napisów: renderowanie pola `*Id`/`*_id` w treści JSX (nie w
`key=`, `data-*`, `href=`, logu, URL — to nie jest defekt), sklejanie prefiksów
(`per-`, `org-`, `usr-`, `mod-`), wyświetlanie wartości `enum` bez tłumaczenia.
Zapytania: `grep -rnE` po wzorcach `{x.id}`, `{x.xxxId}`/`{x.xxx_id}` w pozycji tekstu
JSX, `render:`/`cell:`/`accessor:` w definicjach kolumn tabel, oraz przegląd historii
gita pod kątem wcześniejszych napraw tej samej rodziny (`git log --oneline --all | grep
surow`) — **potwierdził, że rodzina jest bardzo duża i systematycznie powracająca**:
≥ 35 wcześniejszych commitów naprawczych tej samej rodziny w historii repo (m.in.
`022ddbda29`/`902b50d50d` „noc naprawcza 2026-07-27”, `d3a36b4b4e`, `e3d87b2f37`,
`0234487d50`, `073dc4cbbd`, `78fc30e7f6` i inne).

## Liczby

- **Kandydatów przejrzanych szczegółowo:** ~55 (z pierwszego przebiegu grep) + dodatkowa
  weryfikacja historii gita.
- **Realnych defektów potwierdzonych:** 4 (patrz niżej).
- **Fałszywych alarmów odrzuconych po K2:** ~15 szczegółowo zweryfikowanych (reszta
  kandydatów z surowego grepa to `data-testid`, klucze `key=`, URL-e API, atrybuty —
  odrzucone bez dalszej analizy, zgodnie z K2).

Rodzina jest zbyt duża, by przejść całą (dziesiątki lat wcześniejszych napraw pokazują,
że to permanentny wzorzec architektoniczny — komponenty łączące ID i etykietę w jednym
obiekcie DTO, bez wymuszenia typu, są wciąż tworzone). Zgodnie z instrukcją: **rejestr
jest ważniejszy niż liczba napraw** — zatrzymano się po naprawieniu najbardziej
oczywistych, tanich pozycji.

## REALNE DEFEKTY

| # | Miejsce | Co pokazywało | Etykieta dostępna klient-side? | Klasyfikacja | Status |
|---|---|---|---|---|---|
| 1 | `src/components/Initiatives/sections/InitiativeTeamSection.tsx` (panel propozycji AI: dodaj/zaktualizuj/usuń członka zespołu, ok. linii 744/775/807) | `{r.userId}` / `{a.userId}` / `{u.userId}` wprost, pogrubione, jako główny tekst propozycji | TAK — `orgUsers` (z `useInitiativeContext().users`, pola `id/firstName/lastName/email`) i `members` (z `/projects/:id/members`, pole `userName`) już załadowane w tym samym komponencie | **TANIE** | **NAPRAWIONE** (commit `67c09e5273`) |
| 2 | `src/components/settings/NotificationSettingsV2/WatchingTab.tsx:89` | `Notify: {watcher.notifyOn}` — surowy enum `all`\|`mentions`\|`status_changes` | TAK — zamknięty enum, mapa etykiet nie wymaga danych z serwera | **TANIE** | **NAPRAWIONE** (commit `6d7eac6306`) |
| 3 | `src/components/settings/NotificationSettingsV2/WatchingTab.tsx:88` | `<p className="font-medium">{watcher.objectId}</p>` — obserwowany obiekt (task/initiative/project) pokazany po surowym id zamiast tytułu | NIE — `Watcher` (`src/hooks/useUserNotificationPreferences.tsx:81-87`) ma tylko `objectId`, brak `title`/`name`; trzeba by dociągnąć tytuł z API taska/inicjatywy/projektu | **WYMAGA KONTRAKTU** | odłożone |
| 4 | `src/components/Economics/panels/ValueCapturePipelinePanel.tsx:344` | Kolumna „Initiative” (`finance.m16d.capture.colInitiative`) pokazuje `{gate.initiativeId}` | NIE — `ValueCaptureGate` (`src/services/api/v8/financeValue.ts:163-175`) ma tylko `initiativeId`, brak nazwy inicjatywy | **WYMAGA KONTRAKTU** | odłożone |
| 5 | `src/components/Finance/Prediction/ScenarioAssumptionsView.tsx:270-271` | Kolumny „Podmiot”/„Okres” pokazują `{o.entityId}`/`{o.periodId}` | NIE — `DraftDriverOverride` (`predictionScenarioModel.ts:84-97`) nie ma nazw; cały panel to zaawansowany edytor nadpisań z polami tekstowymi id (`periodId` wpisywany ręcznie jako `p-2026-03`) — **niska pewność defektu**, może być celowo techniczny | **WYMAGA KONTRAKTU** (niska pewność) | odłożone |
| 6 | `src/components/Execution/ExecutionReportsSurface.tsx:1183` | `<option>{item.executionCaseId}</option>` w dropdownie „Wybierz realizację” | CZĘŚCIOWO — lokalna atrapa `executionReviewCases` ma `title`, ale żywe API (`GET /api/initiatives/runtime-v1/execution-cases`, `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:4071`) zwraca surowy rekord bez nazwy inicjatywy | **WYMAGA KONTRAKTU** (dla danych produkcyjnych) | odłożone |

## FAŁSZYWE ALARMY (zweryfikowane i odrzucone)

| Miejsce | Dlaczego to nie jest defekt |
|---|---|
| `src/components/MaturityMatrix.tsx:173` „AREA {currentArea.id}” | `id` to krótki mnemoniczny kod obszaru (`1A`, `1B`, …, z `src/services/drdStructure.ts`), nie techniczny identyfikator — to jest etykieta sama w sobie, pełna nazwa jest pokazana osobno niżej |
| `src/components/MyWork/ScheduleDecisionQueue.tsx`, `DefinitionDecisionQueue.tsx`, `AnalysisDecisionQueue.tsx`, `EffectivenessClosureQueue.tsx` (panele podglądu) | Cała rodzina to jawnie techniczne/operacyjne workbenche PMO — pola opisane wprost jako „Canonical Decision ID”, „Results Case … v{version}” z numerami wersji; id JEST właściwą treścią etykiety, nie podszywa się pod nazwę biznesową |
| `src/components/Discovery/nodes/AssessmentNode.tsx:74` `{frameworkId}` | Mały badge z kodem frameworku (np. „DRD”), pełna nazwa (`name`) pokazana osobno w nagłówku poniżej |
| `src/components/Results/RecoveryCardPanel.tsx:1530` `{action.ownerUserId}` | Pole to w rzeczywistości wolny tekst — formularz ma placeholder „Owner” i zwykły `<input>` bez wyboru użytkownika; to, co się wyświetla, JEST tym, co wpisał użytkownik, nie ma ukrytej etykiety |
| `src/components/ResultsVNext/okr/OkrKeyResultFormModal.tsx:561`, `KpiDraftFormModal.tsx:479` `{ownerUserId}` | Pole tylko-do-odczytu „(nie do zmiany z tego formularza)”, stylizowane `font-mono` — celowo techniczny odczyt własnego id sesji, nie pretenduje do bycia nazwą |
| `src/views/superadmin/**` (PricingRegistryTab, MarketInboxTab, AIBudgetsView, SCIMProvisioningView, ModelTierAssignments, PricingPanel), `src/components/governance/AuditLogViewer.tsx`, `src/components/Admin/commandCenter/CommandCenterAuditTab.tsx`, `src/views/admin/HelpAnalyticsDashboard.tsx` | Rejestry techniczne/audytowe dla superadmina — `model_id`, `correlationId`, `content_id` SĄ właściwą, oczekiwaną treścią kolumny (nie podszywają się pod nazwę), zgodnie z konwencją tych ekranów w całym repo |

## Naprawione (TANIE) — z dowodem mutacyjnym

1. **`InitiativeTeamSection.tsx`** — dodano `resolveUserLabel(userId)` (szuka w
   `orgUsers`, potem w `members`, dopiero na końcu surowy id jako fallback) i podmieniono
   trzy miejsca renderowania (`remove`/`add`/`update`). Test:
   `src/components/Initiatives/sections/__tests__/InitiativeTeamSection.aiProposalNames.test.tsx`
   — dwa rendery tego samego `userId` z różną nazwą źródłową dają różny wyświetlony
   tekst; po cofnięciu naprawy 2/3 testów failuje (potwierdzone bezpośrednio przez
   `git stash`/`git stash pop`).
2. **`WatchingTab.tsx`** — dodano mapę etykiet `NOTIFY_ON_LABEL_KEYS` dla zamkniętego
   enuma `notifyOn`, z prawdziwymi kluczami PL/EN w `public/locales/{en,pl}/translation.json`
   (`settings.notifications.watchNotify*`) — nie tylko fallback angielski w kodzie. Test:
   `src/components/settings/NotificationSettingsV2/__tests__/WatchingTab.notifyOnLabel.test.tsx`
   — ta sama zasada dowodu mutacyjnego, potwierdzona przez `git stash`/`git stash pop`
   (1/3 testów failuje na cofniętej naprawie).

## Co zostaje (WYMAGA KONTRAKTU — nie naprawiane w tym dyżurze)

Pozycje #3–#6 z tabeli wyżej wymagają zmiany kontraktu serwera (dociągnięcia nazwy razem
z id, analogicznie do naprawy `base_period_id` w Finansach) — zero zmian kontraktów w tym
dyżurze, zgodnie z zasadą twardą. Rekomendacja: każda pozycja to osobny, mały dyżur typu
„K3: UI konsumuje etykietę X” po wzorze `ff5f3fd863`.

## Commity tego dyżuru

- `67c09e5273` — fix(initiatives/team): AI-owe propozycje zespołu pokazują nazwę, nie surowy userId
- `6d7eac6306` — fix(settings/notifications): panel Watching pokazuje etykietę notifyOn, nie surowy enum
