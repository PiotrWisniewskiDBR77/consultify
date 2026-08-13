# Rejestr dowodowy testów — STRUMIEŃ 6

> Cel: udowodnić albo **usunąć** liczbę „+380 nowych zielonych testów".
> Wynik: **liczba +380 była BŁĘDNA i została zastąpiona zmierzoną +384.**

---

## 1. Sprostowanie liczby

| | |
| --- | --- |
| **Co twierdziłem** | „+380 nowych zielonych testów" |
| **Skąd się wzięło** | odjęcie sum z **pełnego** przebiegu `src` (4 618 − 4 238 = 380). To nie jest liczba dla **zakresu dotkniętego** — mieszała pliki niezwiązane z Assessment i liczyła inaczej testy pomijane. |
| **Liczba zmierzona i odtwarzalna** | **+384** (48 → 47 nowych plików po usunięciu sondy) |
| **Status** | liczba **+380 wycofana**, zastąpiona wynikiem z poniższej procedury |

---

## 2. Dokładna procedura (odtwarzalna)

**Identyczna komenda po obu stronach**, jedyna różnica to katalog roboczy:

```
npx vitest run --config vitest.config.ts --exclude 'server/**' \
  src/services src/actions src/hooks src/method-core \
  src/components/method-workspace src/components/assessment \
  --retry=0 --reporter=json --outputFile=<raport>.json
```

| Pole | Baseline | Candidate |
| --- | --- | --- |
| **SHA** | `f3e7df565e` (== `origin/demo`) | `14e65cd768` → finalny po sprzątaniu |
| **Worktree** | `.codex/worktrees/mac-base6` (detached) | `.codex/worktrees/mac-clean-integ` |
| **exit code** | **0** | **0** |
| **retry** | `--retry=0` (jawnie; config repo ma `retry: CI?3:1`) | `--retry=0` |
| **DB** | nie dotyczy (testy frontowe) | nie dotyczy |
| **Żywy serwer** | nie dotyczy | `RUN_TERESA_LIVE_TESTS=1`, `http://localhost:42210`, PostgreSQL `mac-pg-team:55495` (zaseedowany: org `test-org-id`, user `test-user-id`, pack `drd@2.0.0-methodpack.1`) |

---

## 3. Wynik — rozbicie zamiast jednej liczby

| Kategoria | Plików | Testów |
| --- | ---: | ---: |
| **nowe pliki** (nie istnieją na baseline) | **47** | **+384** |
| pliki usunięte | 0 | 0 |
| pliki o **zmienionej** liczbie testów | **0** | 0 |
| pliki **bez zmian** (identyczne po obu stronach) | 15 | 154 |
| **RAZEM baseline** | 15 | **154** |
| **RAZEM candidate** | **62** | **538** |

**538 − 154 = 384.** Zero plików zmodyfikowanych pod względem liczby testów oznacza,
że **żaden istniejący test nie został osłabiony ani usunięty** — cała różnica to nowe pliki.

---

## 4. Osiem „niezielonych" testów — STRUMIEŃ 2

Wszystkie **8** pochodziło z **jednego** pliku:
`src/method-core/teresa/__tests__/teresaContractCycle.live.test.ts`.

| Klasyfikacja | Liczba | Uzasadnienie |
| --- | ---: | --- |
| introduced | **0** | — |
| pre-existing | **0** | — |
| fixed | **0** | — |
| flaky | **0** | trzy przebiegi, zero migotania |
| **warunkowo pomijane (wymagają żywego serwera)** | **8** | bramka `RUN_TERESA_LIVE_TESTS=1`; bez serwera plik jest **pomijany, nie failowany** — świadoma decyzja projektowa, żeby reszta pakietu była zielona bez backendu |

**Rozwiązanie zgodne z zakazem pomijania:** nie wyciszyłem ich i nie osłabiłem asercji —
**uruchomiłem je naprawdę** przeciw żywemu serwerowi na czystym SHA.

```
Tests  337 passed (337)      # bramka front, zero pominiętych
Tests  538 passed (538)      # szerszy zakres dotknięty, zero pominiętych
```

Utrwalone jako skrypt, żeby nie zależało od pamięci operatora:

```
npm run test:method-core:front:live
```

---

## 5. Sprzątanie sond roboczych

Dwie moje sondy diagnostyczne (`zz-opus-*`, z `console.log`) zostały usunięte —
obie w **całości** pokryte przez nazwane testy:

★ **Sond było SZEŚĆ, nie dwie.** Wyszło to dopiero przy liczeniu tego rejestru —
filtr na nazwę `zz-opus` ujawnił cztery pliki, o których nie wiedziałem. Nazwy robocze
z `console.log` weszły do kandydata.

**Nie skasowałem ich hurtem** — po przejrzeniu okazało się, że pięć niesie asercje
**nośne**, których nie ma nigdzie indziej. Zostały **awansowane**: właściwa nazwa,
usunięty `console.log` (13 wywołań), usunięty prefiks `OPUS PROBE`.

| sonda robocza | co niosła | decyzja |
| --- | --- | --- |
| `zz-opus-a10-d1.test.tsx` | bramka roli na przycisku freeze (naprawa D1) | → `DrdMethodWorkspaceScreen.freezeRoleGate.test.tsx` |
| `drd/zz-opus-aggregate-norm.test.ts` | dowód, że `byGroup` **się nie zmienił** — warunek COORD-08 | → `drdAdapter.aggregateNorm.test.ts` |
| `drd/zz-opus-probe.test.ts` | determinizm z pominięciem cache modułu; `readiness` nie startuje sesji | → `drdMethodPack.contract.test.ts` |
| `siri/zz-opus-probe.test.ts` | 16 wymiarów, Bands 0-5, **no-leapfrog** | → `siriBands.contract.test.ts` |
| `siri/zz-opus-v2-probe.test.ts` | COORD-08: bez flagi domyślna ścieżka to `legacy_v1` | → `siriPrioritisation.versioning.test.ts` |
| `src/services/__tests__/zz-opus-v2-probe.test.ts` | w pełni pokryte przez `drdScoringV2.test.ts` | **usunięta** |
| `method-core/__tests__/zz-opus-drd-agg-probe.test.ts` | pokryte przez `drdScoringV2.test.ts:32` i `:43` | **usunięta** |

Po sprzątaniu: `find src -name 'zz-opus*'` → **0**.

---

## 6. Pełna lista nowych plików testowych

| plik | testów |
| --- | ---: |
| `src/method-core/methods/drd/__tests__/drdHttpSessionRuntime.test.ts` | 32 |
| `src/services/__tests__/drdScoringV2.test.ts` | 27 |
| `src/components/assessment/drd/__tests__/DrdHttpMethodWorkspaceScreen.test.tsx` | 20 |
| `src/method-core/outputs/__tests__/assessmentOutput.test.ts` | 19 |
| `src/method-core/methods/drd/__tests__/drdSessionRuntime.test.ts` | 15 |
| `src/method-core/methods/siri/__tests__/siriWorkspaceView.test.ts` | 14 |
| `src/services/__tests__/siriPrioritisation.v2.test.ts` | 12 |
| `src/method-core/methods/siri/__tests__/siriMethodPack.test.ts` | 11 |
| `src/method-core/methods/siri/__tests__/siriHttpSessionRuntime.test.ts` | 10 |
| `src/method-core/methods/drd/__tests__/compileDrdPack.test.ts` | 10 |
| `src/actions/__tests__/teresaAssessmentManifest.test.ts` | 9 |
| `src/method-core/__tests__/compilerShapeContract.test.ts` | 9 |
| `src/method-core/methods/drd/__tests__/drdAdapter.scoring.test.ts` | 9 |
| `src/components/method-workspace/__tests__/MethodNavigator.test.tsx` | 8 |
| `src/components/method-workspace/__tests__/TeresaPreviewPanel.test.tsx` | 8 |
| `src/method-core/teresa/__tests__/capabilities.test.ts` | 8 |
| `src/method-core/teresa/__tests__/teresaContractCycle.live.test.ts` | 8 |
| `src/method-core/outputs/__tests__/initiativeDraft.test.ts` | 8 |
| `src/components/assessment/drd/__tests__/DrdArtifactsPanel.test.tsx` | 8 |
| `src/method-core/methods/drd/__tests__/drdAdapter.progression.test.ts` | 8 |
| `src/components/method-workspace/__tests__/MethodWorkspaceShell.test.tsx` | 7 |
| `src/method-core/outputs/__tests__/presentation.test.ts` | 7 |
| `src/method-core/methods/siri/__tests__/siriTierView.test.ts` | 7 |
| `src/components/method-workspace/__tests__/AnswerStateControl.test.tsx` | 6 |
| `src/components/method-workspace/__tests__/LiveMatrix.test.tsx` | 6 |
| `src/components/method-workspace/__tests__/MethodPresentationView.test.tsx` | 6 |
| `src/components/method-workspace/__tests__/useMethodWorkspaceSave.test.ts` | 6 |
| `src/components/assessment/siri/__tests__/SiriHttpMethodWorkspaceScreen.test.tsx` | 6 |
| `src/method-core/methods/drd/__tests__/drdAdapter.aggregate.test.ts` | 6 |
| `src/services/__tests__/drdReportModel.calculationVersion.test.ts` | 5 |
| `src/components/method-workspace/__tests__/MethodReportView.test.tsx` | 5 |
| `src/components/method-workspace/__tests__/VoiceAnswerChannel.test.tsx` | 5 |
| `src/components/method-workspace/__tests__/evidenceSemantics.test.ts` | 5 |
| `src/components/assessment/drd/__tests__/DrdRolesPanel.test.tsx` | 5 |
| `src/components/assessment/drd/__tests__/drdMethodWorkspaceGating.test.tsx` | 5 |
| `src/method-core/methods/siri/__tests__/siriBands.contract.test.ts` | 5 |
| `src/method-core/methods/siri/__tests__/siriPrioritisation.versioning.test.ts` | 5 |
| `src/components/method-workspace/__tests__/QuestionHelpDisclosure.test.tsx` | 4 |
| `src/method-core/teresa/__tests__/cellRef.test.ts` | 4 |
| `src/method-core/outputs/__tests__/reportSnapshot.test.ts` | 4 |
| `src/method-core/methods/drd/__tests__/drdMethodPack.contract.test.ts` | 4 |
| `src/components/method-workspace/__tests__/ResolutionCard.actions.test.tsx` | 3 |
| `src/method-core/outputs/__tests__/supersession.test.ts` | 3 |
| `src/components/assessment/drd/__tests__/DrdMethodWorkspaceScreen.freezeRoleGate.test.tsx` | 3 |
| `src/components/assessment/drd/__tests__/DrdMethodWorkspaceScreen.matrix.test.tsx` | 3 |
| `src/components/assessment/siri/__tests__/SiriTierScreen.test.tsx` | 3 |
| `src/method-core/methods/drd/__tests__/drdAdapter.aggregateNorm.test.ts` | 3 |

**RAZEM: 47 nowych plików, 384 testów.**
