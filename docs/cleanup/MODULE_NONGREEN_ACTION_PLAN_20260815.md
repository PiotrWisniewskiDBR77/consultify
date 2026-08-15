# CLEANUP Non-Green Impact Plan

Źródło:  
`/var/folders/pb/sc90m9b12_966jx4l2klt5br0000gn/T/consultify-standard-sharded-f6a00552802d-hr9J8k/summary.json`  
`run_sha: f6a00552802d3a5d0f2bbd2c72316c05b55b8f82`

Wnioski operacyjne (stan na 2026-08-15):
- Całkowite testy: **39 884**
- PASS: **38 798**
- FAIL: **581**
- PENDING: **485**
- TODO: **19**
- Non-green files: **283**
- Missing/unexpected: **0/0**

## Kluczowy ranking obszarów (wg liczby non-green suite)

| Obszar | Liczba non-green | Priorytet
|---|---:|---|
| `tests/integration` | 136 | P0 – blokuje odbiór routing/API/modułów
| `tests/components` | 55 | P0 – stabilność UI per moduł
| `tests/unit` | 49 | P1 – kontrakty i bezpieczeństwo
| `src/components/MyWork` | 9 | P1 – obszar produkcyjnie używany
| `server/src/routes` | 7 | P1 – endpointy i middleware
| `server/src/services` | 6 | P1 – zależności backendowe
| `src/components/AIChat` | 5 | P2 – ryzyko dla prezentacji
| `src/components/Initiatives` | 3 | P0 – klucz strategiczny
| `src/components/Audit` | 2 | P2 – lifecycle i showcase
| `src/components/DiscoveryTools` | 2 | P1 – AI/Tools entry
| pozostałe pojedyncze | 1 każdy | P2/P3

## Priorytet działań na teraz

1. Najpierw domknąć `tests/integration` i `tests/components` (to najkrótsza droga do redukcji blockerów).
2. Następnie `tests/unit` + `server/src/*` dla bezpieczeństwa API i kontraktów.
3. Dopiero na końcu `MyWork`/`AIChat`/`Initiatives` powierzchni pomocnicze.

Dla każdej grupy przypiąć wynik back-to-back:
- **BLOCKED_ARCHITECTURE** (gdy brak jednoznacznego ownera ścieżki runtime)
- **BLOCKED_DATA** (brak fixture/seed/evidence)
- **READY_FOR_RUNTIME_RECHECK** (ścieżki istnieją, ale wymagają sprawdzenia runtime i remanentu)

## Top listy surowe (pierwsze elementy)

- `server/src/routes/__tests__/initiative-controller-interview-insight.test.ts`
- `server/src/routes/__tests__/presentationAutosaveTitlePersistence.test.ts`
- `server/src/routes/__tests__/presentationCustomTemplateContract.test.ts`
- `server/src/routes/__tests__/presentationTemplateApprovalLibraryRoundTrip.test.ts`
- `server/src/routes/__tests__/presentations-template-resolve-wiring.test.ts`
- `server/src/routes/v8/__tests__/my-work-calendar.routes.test.ts`
- `server/src/services/__tests__/artifactRegistryPresentationTemplatePosture.test.ts`
- `server/src/services/assessment/__tests__/assessmentWorkbench.p28b-e2e.test.ts`
- `server/src/services/initiative/__tests__/initiativeLifecycleCanon.test.ts`
- `server/src/services/v8/__tests__/executionSpineService.initiative-scope.test.ts`
- `server/src/services/v8/__tests__/planningPortfolioReadService.support-tables.test.ts`
- `server/src/services/v8/__tests__/v8-migration-runner.test.ts`
- `src/components/AIChat/KimiWorkspace/__tests__/ArtifactModuleHome.scope.test.tsx`
- `src/components/AIChat/tabeleShell/...` (4 pliki)
- `src/components/MyWork/__tests__/IdeaTemplateGallery.l06.test.tsx`
- `src/components/MyWork/NotebookLibraryContent.smoke.test.tsx`
- `tests/components/Initiatives/InitiativesHub.r11-wiring.source-anchor.test.ts`
- `tests/components/Initiatives/InitiativesHub.t30-wiring.source-anchor.test.ts`
- `tests/integration/initiative*`, `tests/integration/a*`, `tests/integration/finance*`

## Notatka

To nie są nowe bugi — to mapa do wykonania ładnego „przewietrzenia” i domknięcia obszarów przed weekendem.
