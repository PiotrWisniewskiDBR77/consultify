# Partner — raport dyżuru dnia 12 (2026-08-25)

Status: `P.1–P.4 TECHNICAL_PASS / P.5 PARTIAL / P.6 POZA_ZAKRESEM / OWNER_PENDING / NO_RELEASE`

Gałąź `codex/partner-day12-20260825`; worktree `/private/tmp/consultify-partner-day12`; baza `659a57baed` (marker `5f96e936ac` jest przodkiem). Zero fetch, push, merge, deploy i zmian w głównym checkoutcie.

## Decyzje wiążące

D8: `/partner` jest wyłącznie pulpitem operacyjnym; niepodłączony, onboarding, stan nieznany i błąd nigdy nie widzą marketingu. `connection` wybiera stan podłączenia, a `lifecyclePhase` tylko zawartość podłączonego pulpitu.

DEC-2026-08-25-64: connection = `STRICT EXACT-TENANT`, read-only, dokładne `owner_organization_id`, bez self-heal. Historyczne rekordy wymagają jawnego idempotentnego backfillu i zgodności liczby podłączonych przed/po; niejednoznaczne rekordy są wyjątkami do decyzji właściciela. Legacy `/api/partners/connection` pozostaje. Ekonomia pozostaje wyłączona przez `AMD-PRT-ECONOMICS-002`.

## Wyniki P.1–P.6

| Pozycja | Commit       | Status                                   | Dowód / ograniczenie                                                                                                                                                           |
| ------- | ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P.1     | `21ffba1543` | `TECHNICAL_PASS / DATA_READBACK_NOT_RUN` | Read-only resolver i GET `/api/v8/partner/connection`; exact-tenant, brak writera/self-heal; UI na V8; kontrolowany backfill z parytetem i wyjątkami.                          |
| P.2     | `14304b897e` | `TECHNICAL_PASS`                         | Onboarding jest jednoekranowym stanem operacyjnym bez treści akwizycyjnej.                                                                                                     |
| P.3     | `626842bf9f` | `TECHNICAL_PASS`                         | Siedem historycznych kart nie jest osiągalnych z `/partner`; mapa retirementu jest w kodzie.                                                                                   |
| P.4     | `fef87d9394` | `TECHNICAL_PASS`                         | Testy stanów bramki potwierdzają brak marketingu.                                                                                                                              |
| P.5     | `f7ea24314e` | `PARTIAL / STOP_I18N_TEST_CONTRACT`      | Usunięto dekoracyjny crimson. Usunięcie fallbacków i18n łamie zastany kontrakt `ClientAccessView.v8-clients.test.tsx`; cofnięto je zamiast rozszerzać dozwolony zakres testów. |
| P.6     | —            | `POZA_ZAKRESEM`                          | Potwierdzone przez właściciela; lista klientów nieprzebudowana.                                                                                                                |

## P.1 — kontrakt i backfill

- Resolver connection jest wyłącznie odczytem strict V8.
- GET V8 wymaga aktywnego członkostwa w tenantcie, lecz jest przed bramką wymagającą podłączonego partnera.
- Błąd odczytu daje 503, więc UI nie może przejść do marketingu.
- Legacy route pozostała bez zmiany.
- Skrypt bindingu zachowuje podpisany manifest, idempotencję, atomowość i receipt. Przed APPLY wylicza legacy-connected users, wymaga jawnego mapowania i aktywnego membershipu w owner tenantcie; po APPLY wymaga równości strict-connected z legacy-connected.

### Wyjątki backfillu

`NOT_EVALUATED_NO_AUTHORIZED_DISPOSABLE_DATASET`.

Nie wykonano backfillu ani odczytu realnej bazy. RealPG wymaga jawnego `PRT_OWNER_BINDING_DB_PREFIX` dla disposable DB; warunek nie był spełniony. Lista konkretnych rekordów i rzeczywiste liczniki przed/po pozostają `EVIDENCE_MISSING`, nie pustą listą. Implementowany wyjątek to `ACTIVE_OWNER_MEMBERSHIP_MISSING`; APPLY blokuje się przed zapisem przy wyjątku lub rozjeździe parytetu.

## P.3 — mapa retirementu

| Dawna karta   | Cel                                  |
| ------------- | ------------------------------------ |
| dashboard     | `/become-partner`                    |
| metrics       | brak publicznego celu; kod zachowany |
| earnings      | `/partner/pricing`                   |
| company-info  | `/become-partner/apply`              |
| learning-path | brak publicznego celu; kod zachowany |
| documentation | `/become-partner`                    |
| templates     | `/become-partner`                    |

Nie zmieniono gramatyki tras i nie usunięto treści bez zatwierdzonego celu.

## Testy i dowody

Pakiet Day 12: `8 files / 22 tests PASS` — service, handler, klient API, foreign tenant, brak self-heal, parytet, retirement i stany UI.

Szeroki replay Partner: `37 files PASS / 14 FAIL / 5 SKIPPED; 260 tests PASS / 66 FAIL / 94 SKIPPED`. Failingi obejmują zastane kontrakty legacy/economics, niedopasowane mocki po nowej bramce i RealPG z niezgodnym schematem. Nie są zielonym dowodem Day 12 i nie były naprawiane poza zakresem. Backfill Day 12 nie został wykonany.

Dowody 4 stany × light/dark PL: `NOT_PROVEN`. Brak bezpiecznej autoryzowanej persony lub fixture runtime; screenshotów nie sfabrykowano z testowego DOM. Akceptacja wizualna pozostaje `OWNER_PENDING`.

## Otwarte bramki

1. DRY-RUN backfillu na jawnie autoryzowanej disposable DB: liczniki legacy/strict i pełna lista wyjątków; APPLY wymaga osobnej zgody.
2. Decyzja, czy wolno zmienić kontrakt testów i18n, aby domknąć P.5.
3. Bezpieczna persona/fixture runtime i dowody 4 stany × light/dark PL.
4. Naprawa zastanego szerokiego suite wymaga osobnego zakresu; brak release authority.
