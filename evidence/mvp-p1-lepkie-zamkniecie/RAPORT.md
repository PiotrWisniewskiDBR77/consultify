# RAPORT — mvp/p1-lepkie-zamkniecie (73f3cb369d, na b0c492e27b)

Worktree `/private/tmp/wt-p1fix` (bare `consultify-recovery-vault-20260820.git`,
branch z `codex/m03-admin-20260824`). 3 commity, bez push.

## Defekt 1 — panel wraca po X (regresja P1)
Plik: `src/components/shared/TableWithPreviewLayout.tsx` (~196-201, teraz usunięte).
Przyczyna: efekt bezwarunkowo wołał `jedenPanel.pokazPanel()` na każde przejście
`controlledPreviewOpen` false→true — czyli też na zwykły klik w kolejny wiersz
(konsumenci kontrolowani czyszczą previewId na `null` przy X, ustawiają go z
powrotem na klik wiersza = to samo przejście). Usunięty; `panelWidoczny` już
poprawnie liczy widoczność bez tego efektu.
Test: `src/components/shared/PreviewPane/__tests__/jedenPanel.contract.test.tsx`
T4 (nowy) — odwzorowuje realny wzorzec `MyTasksListContent`/`ExecutionHub`.
Mutacja: przywrócenie usuniętego efektu → T4 pada (zweryfikowane).
Zrzuty na żywo: NIE wykonane — wstrzykiwanie sesji (`localStorage` z
`auth-p1fix.json`) do świeżego portu 3091 zablokował klasyfikator uprawnień
(traktuje zapis tokenów jako działanie poświadczeniowe); nie obchodzę tego
innymi środkami. Weryfikacja opiera się na teście reprodukującym dokładny
kontrakt `previewOpen`/`selectedId` z realnych plików + mutacji.

## Defekt 2 — i18n pustego stanu Oceny
Plik: `src/components/assessment/AssessmentHub.tsx:1608-1616` (`emptyStateMessage`
teraz przez `t()`). Dodano klucz `assessment.emptyState.warningDescription`
(pl/en) w `public/locales/{pl,en}/translation.json`; podpięto istniejący
`assessment.emptyState.description` (miał już polskie tłumaczenie, nieużywany
w tym miejscu).
Test: `tests/unit/i18n/i18nTrescPolska.test.ts` — 0 nowych naruszeń (1 zastałe,
`settings.templates.system.enterprise.name`, zweryfikowane jako identyczne
na HEAD przed tym commitem via `git stash`).

## Defekt 3 — surowy UUID w polu "Źródło" (Materiały)
Plik: `src/components/ReportsAndPresentations/PresentationsTabContent.tsx`
(nowa `resolvePreviewSourceName()` + `relations` ~linia 517). Rozwiązuje
`sourceId` na `artifact_name` z `sourceRefs` (dane już wczytane z backendu),
wzorzec jak P4 `useResultsEntityNames`/`useOrganizationMemberNames`; „—" gdy
brak dopasowania. Wspólny guard `businessDisplayLabel.ts` nie łapał tego
kształtu (32-hex bez myślników nie pasuje do `UUID_PATTERN`).
Test: `tests/components/ReportsAndPresentations/PresentationsTabContent.sourceLabel.test.tsx`
(3 przypadki). Mutacja: powrót do surowego `sourceId` → 2/3 testy padają.

## Domknięcie
esbuild: `TableWithPreviewLayout.tsx`, `AssessmentHub.tsx`,
`PresentationsTabContent.tsx` — wszystkie czyste.
vitest ścieżkowo (`src/components/shared`, `tests/unit/i18n`, +nowy test
Materiałów): 0 nowych regresji — 13 zastanych failów (tablePreviewGeometry
brak Routera, NModeHeader.ownerActions, i18nTrescPolska Enterprise,
idea-workspace-required-keys) zweryfikowane `git stash` jako identyczne na
HEAD przed moimi zmianami.
`scripts/check-list-canon.sh` — PASS (dług SPADŁ o 3, nie rośnie).
`scripts/check-artefakt.sh` — PASS (bez zmian, 8/8 zastałe).

## Skrzynka i Wywiad — NIE ruszane (brak wzorca P1, do osobnej roboty)
- Skrzynka: `src/components/MyWork/InboxContent.tsx:4324` — własny
  `<div data-preview-pane>`, nigdy nie wchodzi przez
  `TableWithPreviewLayout`/`JedenPrawyPanel`.
- Wywiad: `src/components/Interview/InterviewHub.tsx:8620` — ręcznie pisany
  `<aside>` + `StandardPreview` wprost, nie `JedenPrawyPanel`.

## Uwaga poboczna (nie naprawiona, zgłoszona osobno)
`tests/components/ReportsAndPresentations/PresentationsTabContent.qualityBadge.test.tsx`
i `.deeplink.test.tsx` są już zepsute niezależnie od tej roboty — mockują
`react-router-dom` bez `useLocation`, a `JedenPrawyPanel` (P1) woła
`useJedenPanel`/`useLocation` bezwarunkowo. Zweryfikowane `git stash` jako
zastałe (8/8 i 2/2 failed na HEAD przed moimi commitami).
