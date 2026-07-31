---
doc_kind: UI_COMPONENT_ADOPTION_AUDIT
status: VERIFIED_AS_IS
owner: Piotr Wisniewski
auditor: Codex
audited_at: 2026-07-31
scope: application UI and MVP modules
---

# Audyt wykorzystania standardowych komponentów UI/UX

## 1. Werdykt

**Aplikacja nie osiągnęła jeszcze pełnego ujednolicenia graficznego.** Ma silny, realnie używany fundament standardowych komponentów, kanony i automatyczne bramki zapobiegające wzrostowi długu. Jednocześnie wiele starszych i specjalistycznych ekranów nadal używa lokalnych tabel, preview, shelli, kart, formularzy i overlayów.

Werdykt całościowy: **`PARTIAL / FIX`**.

Nie wolno interpretować zielonego `npm run check:ui` jako pełnej zgodności. Checkery działają obecnie w modelu ratchet: tolerują dług zapisany w baseline, ale blokują jego zwiększenie.

## 2. Dowody z kodu

Kanoniczny katalog `src/components/standard/` zawiera m.in.:

- `StandardModuleBar`;
- `StandardTable`;
- `StandardPreview`;
- `StandardKanban` i `StandardKanbanCard`;
- `StandardGridCard`;
- `StandardArtifactShell`;
- `ArtifactRightPanel`, `ArtifactPropertiesTable`, `ArtifactApprovalStatusBar`;
- `PriorityCell` i rejestr kart N.

W całym `src` znaleziono:

- 109 plików odwołujących się do `components/standard`;
- 97 plików odwołujących się do `StandardTable`;
- 29 do `StandardPreview`;
- 33 do `StandardModuleBar`;
- 66 do `shared/ModuleHub`;
- 67 do `shared/states`.

Liczby są wskaźnikiem adopcji, nie liczbą niezależnych ekranów — jeden plik może importować kilka elementów, a wystąpienie w teście lub typie nie dowodzi kompletnego UX.

## 3. Wynik automatycznych bramek

Uruchomiono:

```text
npm run check:ui
bash scripts/check-list-canon.sh --report
bash scripts/check-artefakt.sh --report
```

Wynik:

- bramki zakończyły się sukcesem — brak nowych regresji ponad baseline;
- `check-list-canon`: 159 plików, **409 istniejących naruszeń**, baseline 409;
- tylko 1 z 12 badanych `*Hub.tsx` został wykryty jako hub listowy z legacy menu bez `StandardModuleBar`;
- `check-artefakt`: **7 istniejących naruszeń** crimson w powłoce, baseline 7;
- karty N: 0 blokujących naruszeń R2/R3 i 1 ostrzeżenie R1 w `MyWork/TaskDetailView.tsx`.

Wniosek: governance działa, lecz mierzy regresję względem obecnego długu, a nie absolutną zgodność.

## 4. Ocena modułów MVP

| Moduł | Dowód adopcji | Ocena | Główne odstępstwa |
| --- | --- | --- | --- |
| Chat | pojedyncze użycia standard shell/table/preview/artifact, rozbudowany własny runtime | `PARTIAL` | liczne lokalne renderery artefaktów i preview; wymagany audyt Canvas/Artifact Host |
| My Work | wiele użyć Standard Table/Bar i wspólnych states | `PARTIAL+` | największa liczba starszych powierzchni; Decision/Task, Ideas Table, lokalne widoki i table runtime nadal generują dług |
| Interview | Hub, Standard Table/Preview/Bar i shared states obecne | `PARTIAL+` | wiele wyspecjalizowanych preview; sprawdzić wspólny schema i akcje |
| Tools | używa ModuleHub, lecz brak bezpośredniej adopcji Standard Table/Preview/Bar w głównych komponentach | `PARTIAL/NO-GO do potwierdzenia wizualnego` | własny workspace i preview; brak dowodu pełnej zgodności wspólnego shellu |
| Assessment | szeroka adopcja Standard Table/Preview/Bar | `PARTIAL+` | starsze edytory DRD/SIRI/ADMA i raporty mają lokalne tabele/układy |
| Initiatives | Hub i podstawowa triada obecne | `PARTIAL` | liczne lokalne sekcje tabelaryczne i karty; wymagane spięcie z N-mode contract |
| Execution | Hub, tabela, preview i bar obecne | `PARTIAL+` | lokalne raporty, rollout i Manager ProblemTable |
| Results/KPI | Module Bar/states, mało standard Table/Preview | `PARTIAL/NO-GO` | wiele lokalnych KPI/ROI tables i drawers; jeden z najsłabszych obszarów MVP |
| Finance | Hub i podstawowa triada obecne | `PARTIAL` | Finance Preview, statement tables, modele i ledger używają wyspecjalizowanych lokalnych implementacji |
| Materials | ModuleHub obecny, brak bezpośredniej adopcji głównych Standard Table/Preview/Bar w Document Studio | `PARTIAL/NO-GO` | własny editor shell, document preview, tables i liczne prymitywne Button; potrzebny audit artefaktów, decków i workbooków |

Ocena `NO-GO` nie oznacza, że cały moduł nie działa. Oznacza brak wystarczających dowodów, by uznać jego warstwę komponentową za ujednoliconą przed stagingiem.

## 5. Ocena rodzin komponentów

| Rodzina | Stan adopcji | Werdykt |
| --- | --- | --- |
| Module Hub/Menu 1–3 | szeroka adopcja i checker | `PARTIAL+` |
| App Table | silny StandardTable, ale 409 naruszeń obejmuje wiele lokalnych tabel/list | `FIX` |
| Preview | StandardPreview + PreviewPane istnieją, równoległe preview domenowe | `FIX` |
| Kanban/Grid | standardowe komponenty istnieją, adopcja niepełna | `PARTIAL` |
| Artifact Shell/N-mode | mocny StandardArtifactShell i rejestr kart | `PARTIAL+` |
| Canvas/diagram | wspólne prymitywy, ale kilka runtime i shelli | `FIX` |
| States | shared states szeroko używane, równolegle primitives/domain states | `FIX` |
| Buttons/actions | co najmniej kilka ścieżek importów i lokalne stylowanie | `FIX` |
| Forms | `shared/forms`, UI controls i lokalne formularze współistnieją | `FIX` |
| Modal/Drawer/Popover | primitives i shadcn-style komponenty współistnieją | `FIX` |
| Cards | StandardGridCard/N-mode istnieją, wiele kart domenowych | `FIX` |
| AI proposal | wiele proposal/diff panels bez jednego publicznego envelope | `FIX` |
| Help | standard i współdzielone implementacje istnieją | `PARTIAL+` |
| Permission gates | współdzielone gate/guards istnieją; backend musi pozostać autorytetem | `PARTIAL+` |
| Spreadsheet/Deck/Document | z natury wyspecjalizowane, brak jednego wspólnego host contract w całym runtime | `FIX / strategic` |

## 6. Plan ujednolicenia bez ryzykownego big-bang refactoru

### Fala C0 — absolutny rdzeń

1. Wybrać `StandardModuleBar`, `StandardTable`, `StandardPreview`, `StandardKanban`, `shared/states` i wspólny action contract jako publiczne API.
2. Utworzyć macierz wszystkich zamontowanych ekranów listowych, nie wszystkich plików zawierających `<table>` — tabele w dokumencie i arkuszu mają inną funkcję.
3. Dla każdego ekranu wykonać checklistę 43 punktów TRIADA oraz dark/light/keyboard/error.
4. Migrować najpierw Results, Materials i Tools, następnie Finance/Initiatives; zachować istniejący komponent do czasu pełnego E2E nowego.
5. Po każdej migracji zmniejszać baseline; nigdy nie aktualizować baseline w górę.

### Fala C1 — artefakty

1. Ustalić jeden Artifact Host i adaptery Document/Deck/Workbook/Canvas.
2. Wspólne: identity, header, save/version, review, relations, sources, AI proposal, export/share i error recovery.
3. Specjalistyczny środek artefaktu pozostaje domenowy; ujednolicamy shell i zachowanie, nie udajemy, że Excel jest App Table.

### Fala C2 — prymitywy i governance

1. Jeden zalecany import dla Button, Field, Modal, Drawer, Popover, Toast i states.
2. Codemod dopiero po testach kompatybilności; żadnego mechanicznego przepisywania bez odbioru wizualnego.
3. Rozszerzyć checkery o zakazane importy w nowym kodzie oraz wymagany component ID w zadaniach UI.

## 7. Kryterium końcowe

Możemy powiedzieć „aplikacja jest graficznie ujednolicona” dopiero, gdy:

- wszystkie zamontowane ekrany golden flows mają przypisany component ID i referencyjny komponent;
- `check-list-canon` nie tylko nie rośnie, ale baseline dla ekranów MVP wynosi 0;
- krytyczne powłoki artefaktów mają 0 naruszeń;
- dark/light, keyboard, responsive, error/recovery i realny zapis są potwierdzone;
- lokalny fork istnieje wyłącznie jako zatwierdzony komponent domenowy, nie przypadkowa kopia stylu.

## 8. Ostateczna odpowiedź na pytanie właściciela

**Nie, standardowe komponenty nie są jeszcze wykorzystane konsekwentnie w całej aplikacji.** Są dobrze zbudowane, szeroko zaadoptowane i zabezpieczone przed nowymi regresjami. Potrzebujemy teraz kontrolowanej migracji istniejącego długu, zaczynając od Table + Preview + Module Hub na ekranach MVP.
