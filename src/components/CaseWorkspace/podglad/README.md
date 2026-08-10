# Harness zrzutowy modułu Zlecenia — `podglad/`

## ★★★ TO JEST ATRAPA. NIE DOWÓD ŻYWEGO STOSU. ★★★

Ten katalog montuje realne komponenty React modułu Zlecenia
(`CaseWorkspaceHub`) z realnym arkuszem stylów i realnym i18n, ale **sieć
jest ręcznie napisaną atrapą** (`main.tsx` → `trasuj()`), nie prawdziwym
backendem.

Dobre użycie: szybki test komponentu — layout, i18n, motyw jasny/ciemny,
wymuszone stany brzegowe listy (`?awaria=puste|blad|brak-dostepu`),
zrzuty do wstępnego OK właściciela (CLAUDE.md reguła #7).

Złe użycie: traktowanie zielonego zrzutu z tego harnessu jako dowodu, że
kontrakt backendu jest poprawny. Atrapa może się rozjechać z rzeczywistą
odpowiedzią API bez żadnego ostrzeżenia — nic tu nie porównuje kształtu
atrapy ze schematem/handlerem serwera automatycznie.

### Udokumentowany incydent (CW-T-F1, 2026-08-10)

Trasa `GET /plan-versions/:id/graph` w rzeczywistości zwraca KOPERTĘ
`{ graphId, graphDigest, semanticGraph }`
(`server/src/routes/caseWorkspace/casePlanVersions.routes.ts:158-170` →
`casePlanVersionService.ts:getGraph:1382-1393`). Atrapa w tym katalogu
przez pewien czas zwracała goły `CanonicalGraph` (bez koperty). Produkcyjny
kod (`CaseDetailScreen.tsx`) miał błąd przypisujący kopertę wprost do
zmiennej `graph` — z gołym grafem z atrapy błąd nie ujawniał się nigdy w
tym harnessie, tylko na żywym stosie w przeglądarce (opublikowany plan z
krokami renderował się jako „Ten plan nie ma jeszcze kroków"). Dowód:
`server/src/services/caseWorkspace/__tests__/e2e/liveStack.e2e.pg.test.ts`,
test „the response ENVELOPE of /graph is a wrapper, not the graph".

Kontrakt atrapy w `main.tsx` jest teraz zsynchronizowany z realną kopertą
(budowany z `PLAN_VERSIONS`, który już niesie `graphDigest` +
`semanticGraph` razem) — ale to NIE gwarantuje, że pozostanie zsynchronizowany
po następnej zmianie backendu. Przy każdej zmianie kontraktu trasy
`case-workspace` sprawdź `trasuj()` w `main.tsx` ręcznie.

### Dowód żywego stosu — jedyny ważny

- Testy `server/src/services/caseWorkspace/**/*.pg.test.ts` na realnym
  PostgreSQL (`RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=...`).
- Ręczna próba na żywym backendzie (`docs/product/case-workspace/LIVE_STACK_RUNBOOK.md`).

Nigdy: zielony zrzut z tego harnessu.

### Uruchomienie

```
npx vite --port 3610 --strictPort
http://localhost:3610/src/components/CaseWorkspace/podglad/index.html?sciezka=/zlecenia&motyw=light
```

Parametry adresu: `sciezka` (trasa startowa), `motyw` (`light|dark`),
`awaria` (`puste|blad|brak-dostepu` — wymuszony stan brzegowy listy).
