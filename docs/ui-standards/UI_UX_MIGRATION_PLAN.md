# UI/UX Migration Plan

Status: `v0 - execution plan`
Date: 2026-05-01
Parent standard: `docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md`
Audit: `docs/ui-standards/UI_UX_MIGRATION_AUDIT.md`

## 1. Cel planu

Ten plan prowadzi migrację Consultify UI/UX z obecnego stanu `STANDARD_EXISTS_IMPLEMENTATION_FRAGMENTED` do stanu `UI_UX_CANON_ENFORCED`.

Nie jest to plan "upiększania" ekranów. To program stabilizacji systemu UI:

- standard najpierw,
- audyt przed refactorem,
- zatwierdzenie brakujących komponentów,
- migracja ekran po ekranie,
- aktualizacja dokumentacji po każdym nowym wzorcu.

## 2. Zasady nieruszania logiki

Każdy refactor UI/UX ma domyślnie zakaz zmiany:

- API calls,
- routingu,
- modeli danych,
- permission modelu,
- logiki biznesowej,
- semantyki statusów,
- workflow użytkownika.

Jeśli zmiana UI wymaga zmiany workflow, musi powstać osobna decyzja produktowa i wpis w standardzie.

## 3. Bramka przed każdą migracją ekranu

Przed refactorem konkretnego ekranu agent musi przygotować lokalny plan:

| Pytanie | Wymagane |
|---|---|
| Jaki to typ ekranu? | ModuleHub / App Table / N-mode / Workspace / Admin control plane / Canvas / Other |
| Jaki jest target pattern? | Link do standardu |
| Jakie shared components istnieją? | Lista importów |
| Co jest one-off UI? | Lista elementów |
| Czy potrzebny nowy komponent/standard? | Tak/Nie + opis |
| Czy dotykamy API/routingu/logiki? | Domyślnie Nie |
| Jak sprawdzimy zgodność? | Checklist + lints/tests/manual evidence |

Bez tej bramki nie zaczynamy implementacji.

## 4. Bramka zatwierdzania komponentów

Jeśli istniejący komponent nie pasuje:

1. Sprawdzić `@/components/ui`, `@/components/shared`, `docs/ui-standards/`.
2. Zaproponować rozszerzenie istniejącego komponentu albo nowy komponent.
3. Opisać standard:
   - nazwa komponentu,
   - do czego służy,
   - kiedy go używać,
   - kiedy go nie używać,
   - props/variants,
   - relacja do App Topbar / Module Topbar / Command Row / Preview / N-mode.
4. Dodać dokumentację do `docs/ui-standards/`.
5. Dopiero wtedy używać komponentu w feature screen.

Nowy komponent bez dokumentacji = `unapproved UI`.

## 5. Fale migracji

### Wave 0 - Documentation lock

Cel: zamknąć standard i reguły pracy.

Zakres:

- `CONSULTIFY_UI_UX_OPERATING_STANDARD.md`
- `UI_UX_MIGRATION_AUDIT.md`
- `UI_UX_MIGRATION_PLAN.md`
- `.cursorrules`
- `.cursor/rules/consultify-ui-ux-canon.mdc`

Exit criteria:

- dokumenty istnieją,
- Cursor ma jedno operacyjne źródło prawdy,
- brak konkurencyjnego standardu Iris/Consultify,
- migration flow jest opisany.

### Wave 1 - Reference hardening

Cel: wybrać i utwardzić wzorce referencyjne.

Kandydaci:

1. `Chat / Global AI Workspace` - pierwszy ekran sidebara; wymaga zatwierdzenia osobnego standardu chat workspace.
2. `My Work > Decisions` - App Table + Preview.
3. `InterviewHub` - duży ModuleHub/list workflow.
4. `ToolDocumentView` - N-mode + Menu 3 + AI actions.
5. Wybrany Admin/SuperAdmin table - control plane.

Zakres prac:

- audyt zgodności z operating standard,
- wskazanie one-off UI,
- decyzja, co jest dopuszczalnym low-level elementem,
- decyzja, co migruje do shared component,
- aktualizacja docs, jeśli wzorzec zostaje referencją.

Exit criteria:

- mamy 2-3 zatwierdzone wzorce,
- każdy wzorzec ma checklistę zgodności,
- wiemy, które komponenty są kanoniczne dla kolejnych fal.

### Wave 1a - Chat / Global AI Workspace

Cel: zatwierdzić i uporządkować pierwszy ekran sidebara jako osobny typ ekranu.

Zakres:

- `/chat` i `/chat/:conversationId`,
- `UnifiedChatPanel`,
- `EnhancedChatInput`,
- `ChatHistorySidebar`,
- conversation row/actions,
- context/trust strip,
- welcome empty state,
- conversation state banners,
- auxiliary panels such as signals/history/export.

Target pattern:

- Global AI Workspace, nie `ModuleHub`, nie App Table i nie `N-mode`.
- Własny chat header, ale zgodny z button/control family `DBR77 Tech Sexy 2027`.
- Composer jako zatwierdzony AI input surface.
- History drawer jako zatwierdzony AI workspace drawer.
- Context/trust strip jako stały element honest AI UX.

Decyzje zatwierdzone 2026-05-01:

1. `Chat` jest wizualnie bardzo dobry na tym etapie i nie wymaga szerokiego redesignu.
2. `Nowa rozmowa` / `New chat` ma stracić leading `+`.
3. Historia rozmów zostaje as-is na tym etapie.
4. Welcome empty state zostaje as-is na tym etapie.

Exit criteria:

- Chat ma opisany target standard.
- Piotr zatwierdził zakres pierwszej korekty Chat.
- Header controls, composer controls i drawer rows mają jedną rodzinę wizualną.
- Nie zmieniamy runtime logiki czatu, providerów, streamingu, routingu ani permission modelu.

### Wave 2 - App Table migration

Cel: ujednolicić listy i huby tabelaryczne.

Obszary:

- Interviews tabs: Inbox/Sessions/Assigned/Templates/Insights.
- Admin tables.
- SuperAdmin security/API/support tables.
- Results/reports lists, jeśli są listami pracy.

Zakres:

- topbar `h-9`,
- search toggle -> expandable search,
- resizable columns,
- header filters,
- action column z pionowym kebab `⋮`,
- no duplicate breadcrumbs,
- no extra toolbars,
- empty/loading/error/degraded states,
- placeholder `—` dla brakujących danych.

Exit criteria:

- każda tabela ma target pattern,
- każda tabela ma decyzję preview yes/no/later,
- action menus są spójne,
- brak fake success i raw internals.

### Wave 3 - Preview pane rollout

Cel: wdrożyć preview pane tam, gdzie ma sens.

Kryteria "ma sens":

- lista ma wiele elementów do szybkiego przeglądu,
- istnieją quick actions,
- full detail jest cięższy niż podgląd,
- user potrzebuje skanować i decydować bez pełnej nawigacji.

Obszary startowe:

- Decisions - reference.
- Interview assignments/sessions/templates/insights - per tab decision.
- Admin/SuperAdmin support/security/API lists - tylko tam, gdzie quick actions są realne.
- Tools library/session previews - jeśli preview pomaga wybrać narzędzie lub sesję.

Exit criteria:

- preview używa shared shell,
- default OFF,
- single click = preview,
- double click/Enter = full view,
- footer ma parity z full view actions,
- close X odzyskuje szerokość tabeli.

### Wave 4 - N-mode and artifact detail migration

Cel: ujednolicić detail views i artefakty.

Obszary:

- Decisions detail.
- Tasks detail.
- Notifications detail.
- Initiatives detail.
- Discovery Tool documents.
- Future artifacts.

Zakres:

- `NModeShell`,
- `NModeHeader`,
- `NModePropertiesStrip`,
- `NModeLeftNav` 242px,
- `NModeCanvas`,
- Save state vs lifecycle state,
- AI actions w Menu 3/right slot,
- shared sections zamiast lokalnych sekcji.

Exit criteria:

- detail view nie ma własnego page shellu,
- sekcje są shared albo udokumentowane,
- rail nie zawija tytułów,
- save/lifecycle nie są mieszane.

### Wave 5 - Tool/workspace control bars

Cel: znormalizować tool flows, workspace i dodatkowe toolbary.

Obszary:

- DiscoveryTools phases.
- ToolWorkspace.
- ToolActionBar.
- ToolWizard.
- Workspace 3-tools strip.
- Canvas/timeline/board local controls.

Zakres:

- sklasyfikować każdy toolbar,
- usunąć ad-hoc bars,
- dopisać brakujące standardy dla `View-local Toolbar`, jeśli potrzebne,
- zachować phase navigation tylko jako zatwierdzony pattern,
- AI phase actions przenieść albo utrzymać tylko w zatwierdzonym slocie.

Exit criteria:

- każdy toolbar ma nazwany typ,
- żadnych nieopisanych pasków,
- brak duplikacji z Module Topbar/Menu 3,
- tool flow ma standard dokumentacyjny.

### Wave 6 - Admin / SuperAdmin control plane

Cel: uporządkować panele operacyjne bez ryzyka naruszenia governance.

Kolejność:

1. Admin shared components inventory.
2. Admin Settings / users / roles / audit.
3. SuperAdmin Security/IAM/API/support.
4. SuperAdmin customers/revenue/AI Platform.

Szczególne wymagania:

- honest degraded UI,
- no fake success,
- in-app confirm modals,
- safe empty states,
- read-back after mutation,
- audit/event proof for critical mutations,
- no raw backend errors.

Exit criteria:

- control plane tables używają standardu,
- destructive actions mają confirm,
- failed backend states są uczciwe,
- lokalne Admin shared components mają decyzję: approved adapter / migrate / remove.

### Wave 7 - AIChat and AI UX governance

Cel: utrzymać spójny AI UX bez rozbijania chat runtime.

Zakres:

- `UnifiedChatPanel`,
- `useOpenChatWithContext`,
- context passing,
- provider failure UX,
- no silent execution,
- no hidden learning,
- traceability/citations,
- private mode.

Exit criteria:

- chat działa jako kontekstowy panel,
- AI actions w modułach są spójne,
- provider degraded states są uczciwe,
- AI governance nie jest traktowane jak zwykła kosmetyka UI.

## 6. Kolejność pierwszych zadań wykonawczych

Po zatwierdzeniu dokumentów:

1. Focused audit: `My Work > Decisions`.
2. Focused audit: `InterviewHub`.
3. Focused audit: `DiscoveryTools > ToolDocumentView`.
4. Standard draft: `View-local Toolbar` / `ToolActionBar`.
5. Inventory: `Admin/shared` components.
6. Migration ticket: Interviews App Table tabs.
7. Migration ticket: first Admin table.

## 7. Szablon zadania migracyjnego

```text
Task: Migrate [screen/module] to Consultify UI/UX Operating Standard.

Standards:
- docs/ui-standards/CONSULTIFY_UI_UX_OPERATING_STANDARD.md
- docs/ui-standards/UI_UX_CANON_V3.md
- [specific standard]

Scope:
- UI structure and component migration only.
- No API changes.
- No routing changes.
- No business logic changes.
- No data model changes.

Audit findings:
- [copy from UI_UX_MIGRATION_AUDIT.md]

Migration steps:
1. Replace one-off UI with shared components.
2. Align shell/topbar/command row.
3. Align table/preview/N-mode/workspace behavior.
4. Add missing loading/empty/error/degraded states.
5. Verify honest feedback and read-back.
6. Update documentation if a new pattern is introduced.

Definition of Done:
- Screen passes operating standard checklist.
- No unapproved one-off UI remains.
- Tests/lints/manual evidence recorded.
```

## 8. Review checklist po migracji

| Check | Pass/Fail |
|---|---|
| Używa właściwego shellu | |
| Używa shared components | |
| Nie ma niezatwierdzonych toolbarów | |
| Topbar/Menu 3 zgodne z kanonem | |
| Table/preview zgodne, jeśli dotyczy | |
| Loading/empty/error/degraded states istnieją | |
| Actions mają feedback | |
| Mutacje mają read-back | |
| Destructive actions mają confirm | |
| AI actions nie wykonują silent execution | |
| Brak raw internals | |
| Light/dark mode zgodne | |
| Dokumentacja zaktualizowana, jeśli powstał nowy wzorzec | |

## 9. Zakazy procesowe

- Nie używać promptu "popraw UI aplikacji".
- Nie refaktorować wielu modułów naraz.
- Nie tworzyć nowego komponentu bez standardu.
- Nie robić automatycznej globalnej podmiany raw `<button>` bez audytu.
- Nie wymuszać App Table na ekranie, który jest świadomym canvas/board/workspace.
- Nie wciskać preview pane do listy bez realnego użytkowego sensu.
- Nie mieszać Iris i Consultify.

## 10. Artefakty wyjściowe programu

Program kończy się, gdy istnieją:

- zatwierdzony operating standard,
- aktualny audyt migracyjny,
- lista ekranów referencyjnych,
- plan fal migracji,
- opisane brakujące komponenty i control bary,
- reguły Cursor egzekwujące standard,
- zestaw checklist używany przy każdym nowym ekranie.
