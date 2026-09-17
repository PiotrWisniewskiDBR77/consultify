# FEEDBACK-1 poz. 1 — K-02 v2: trwałość sesji DRD i Wywiadu

**Werdykt wykonawcy: READY FOR CTO REVIEW. Dwa P1 z Wpisu 180 są zamknięte, zgłoszenie #30 ma zachowaniowy dowód mutacyjny, a realny PostgreSQL przeszedł pełną ścieżkę migracji i 16/16 testów HTTP.**

## Tożsamość

- Tor: A / Codex-1.
- Gałąź: `codex/feedback-1-k02-session-persistence-v2-20260917`.
- Baza v2: `be57c5dae677844a224d78d874d3ab52444a882d`.
- Kandydat HOLD, na którym zbudowano v2: `a45e9ac43e29534cdee0dde567a57704b0d4f65f`.
- Zakres: KANAL.md Wpis 180 oraz FEEDBACK-1 poz. 1 z Wpisu 120.
- Bez migracji produktu, nowych flag, staging write, deployu, Railway i chronionych refów.

## Wynik Wpisu 180

1. **P1-1 TSC:** oba nowe przekazania identyfikatora w `InterviewWorkspace` używają opcjonalnego `session?.id`. Diagnostyki TS18047 z obu miejsc zniknęły.
2. **P1-2 wołacz CAS:** `assessmentUiTechnicalFixture.prepareForReview()` pobiera świeże `session.version` bezpośrednio przed każdym zapisem eventu i wysyła je jako `expectedVersion`. Jeden odczyt przed pętlą byłby błędny, bo każdy zapis podbija wersję.
3. **#30 / P-P03:** produktowa poprawka nie pochodzi z K-02. Istnieje na linii od `a805effb69` (DEC-496). V2 nie przypisuje jej sobie; wzmacnia test tak, aby podczas wiszącego `refresh()` bronił kroku 2/3, tego samego pytania i wpisanego tekstu.
4. **P2 DIRTY po ręcznym zapisie:** zamknięte. Anulowanie debounce nadal samo nie udaje sukcesu. Dopiero po potwierdzonym ręcznym `recordAnswer` hook przechodzi do `SAVED`; błąd pozostawia `DIRTY`.
5. **PATCH nazwy sesji:** nie jest cichy — `handleSave` pokazuje błąd i zachowuje stan brudny. Pełny test powłoki answer → PATCH pozostaje P2 poza v2.
6. **Kursor pytania:** nadal jest lokalny dla przeglądarki i nie jest sprzątany po zamknięciu sesji. To jawny P2; v2 nie rozszerza kontraktu o synchronizację między urządzeniami.

## Dowody zachowania

- Focused suite: **8 plików / 45 testów PASS**.
- RealPG: lokalny `pgvector/pgvector:pg16`, `127.0.0.1:6454/consultify_k02`, `tmpfs`, kontener usunięty po teście.
- Strict fresh migrations: **925/925 PASS**.
- `server/src/method-core/__tests__/http.integration.test.ts`: **16/16 PASS**, bez skipów. Obejmuje CAS, stale-write 409, idempotentny replay i rollback wersji przy błędzie insertu.
- Fixture CAS: **1/1 PASS**. Mutacja usuwająca `expectedVersion` daje **1/1 RED** (`undefined` zamiast `4,5,6`).
- #30 P-P03: w stanie `loading` z istniejącą sesją pozostają krok 2/3, to samo pytanie i tekst. Mutacja historycznego warunku do `loading={state.status === 'loading'}` daje **1/3 RED** i pokazuje pełnoekranowe `Loading session…`.
- P-P04: oczekujący debounce jest anulowany; zapis już w locie jest serializowany przed decyzją użytkownika; po potwierdzeniu wskaźnik ma `data-save-state="SAVED"`.
- Niezależny review przed finalnym freeze: kod produktu P0=0/P1=0; wykryty P2 DIRTY został następnie zamknięty kodem i testem.

Focused suite obejmuje:

| Obszar | Wynik |
|---|---:|
| `useMethodWorkspaceSave.test.ts` | 9/9 |
| `DrdHttpMethodWorkspaceScreen.k02RecoveryRace.test.tsx` | 3/3 |
| `DrdHttpMethodWorkspaceScreen.pilotazPawel.test.tsx` | 3/3 |
| `DrdLevelInterviewWorkspace.dec552.test.tsx` | 5/5 |
| `drdHttpSessionRuntime.test.ts` | 9/9 |
| `MethodEventStore.test.ts` | 7/7 |
| `InterviewSingleQuestionRuntime.ownerBehavior.test.tsx` | 8/8 |
| `assessmentUiTechnicalFixture.test.ts` | 1/1 |

## TypeScript i importerzy

- Instalacja: czyste `npm ci`, root `@types/node` **22.19.3**, zgodne z lockfile.
- Front exact-lock w tym checkoutcie: **152 diagnostyki**; żadna nie dotyczy plików delty v2. Pomiar środowiska linii CTO z Wpisu 180: **169**. Podajemy obie liczby jawnie: 152 (czyste `npm ci` w checkoutcie) / 169 (linia CTO).
- Server TSC exact-lock: **0 diagnostyk, RC=0**.
- Niezależny zestaw importerów zmienionych plików: **121/132 PASS**. Jedenaście czerwonych jest identycznym, odziedziczonym długiem językowym w rodzinach `naglowekIStanOdpowiedzi` (3), `skipCode` (6), `zapytajTerese` (2); regresja K-02 = 0.

## Otwarte ograniczenia

- Dokładny scenariusz `status === 'recovery'` nadal używa pełnoekranowego widoku kolejki i może odmontować starszy panel. Nie jest to pierwotny #30: zwykły zapis przechodzi przez transient `loading`, a offline przez `offline`. Rejestrujemy jako osobny P2.
- Kursor pytania jest lokalny w `localStorage`; brak cleanupu po submit/close.
- Nie uruchamiano stagingu ani przeglądarki na stagingu. Wpis 180 wymagał naprawy kodu, RealPG i pełnych pomiarów, nie zapisu do środowiska.
