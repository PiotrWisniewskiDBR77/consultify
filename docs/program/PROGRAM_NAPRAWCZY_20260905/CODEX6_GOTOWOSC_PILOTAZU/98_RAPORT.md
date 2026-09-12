# CODEX 6 — raport gotowości pilotażu

## Stanowisko

**Minimum bloku osiągnięte:** E1 i E2 mają lokalny dowód. E5 jest udowodnione. E3 jest **PARTIAL**. E4 jest **NIEWYKONANY po pomiarze**: istniejący eksport i delete działają dla SUPERADMIN, ale nie spełniają wymagania samoobsługi administratora organizacji. Nie rozszerzałem wyniku ponad dowód.

Marker: `45c07b024c`. Worktree: `codex6-gotowosc-pilotazu`. Zero połączeń do Railway, stagingu, demo i produkcji.

## E1 — pusta organizacja → pierwsza wartość

**PRZED:** rejestracja nie gwarantowała używalnego kontekstu świeżej organizacji; endpoint zapisu kontekstu nie istniał. **PO:** rejestracja tworzy `First value workspace`, a `POST /api/onboarding/context` zapisuje kontekst. Playwright przeszedł rejestrację oraz render/readback siedmiu etapów bez 404/5xx; 14 zrzutów light/dark jest w `evidence/pilotaz-przeplyw/`.

Zmiany: `server/src/controllers/AuthController.ts`, `server/src/routes/onboarding.routes.ts`, `server/src/routes/__tests__/codex6-fresh-organization.http.pg.test.ts`, `tests/e2e/onboarding/codex6-first-value.spec.ts`. SHA: `0c65beabf6`.

Ograniczenie dowodu: tworzenie wywiadu, oceny, inicjatywy, zadania i wyniku w teście odbywa się przez rzeczywiste HTTP aplikacji (`page.request`), następnie jest sprawdzane w przeglądarce. Nie jest to dowód, że użytkownik wyklika każdą operację utworzenia wyłącznie kontrolkami UI.

## E2 — angielski seed pilotażu

**PRZED:** brak governowanego, idempotentnego seeda. **PO:** `scripts/dane/seed-pilotaz-20260912.mjs` jest domyślnie dry-run, wymaga manifestu dla apply, używa ścieżek aplikacyjnych i jednej transakcji. Udowodniono rollback mutanta, dwa apply bez duplikatów oraz readback UI.

Stan końcowy lokalny: 4 członków, 12 inicjatyw, 12 zadań, 3 KPI, 6 pomiarów, 1 wywiad, 1 ocena; treść EN. Zrzuty: `evidence/pilotaz-seed/`. SHA: `9f778907f6`.

Ograniczenie: menu Results pokazuje moduł wyników wykonania, nie rejestr definicji KPI. Nazwy KPI udowodniono endpointem aplikacji i PostgreSQL, nie tym ekranem.

## E5 — dziennik zgłoszeń

**PRZED:** premise poczty nie został przyjęty. **PO:** zgłoszenie wysłane z Feedback zapisuje się w PostgreSQL z użytkownikiem, organizacją i route; chroniony endpoint dziennika odczytuje ten sam rekord. Dowód UI: `evidence/pilotaz-feedback/01-feedback-confirmation.png`. SHA: `b2e4dd9459`.

Zapytanie nadzorcy (ostatnia doba):

```sql
SELECT id, created_at, user_id, organization_id, category, title, status,
       source_env, context
FROM user_feedback
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

## E3 — limiter kosztu AI — PARTIAL

**PRZED:** `AI_BUDGETS_ENABLED` było efektywnie domyślnie ON, ale brak rekordu budżetu oznaczał brak limitu; komunikat SSE nie ustawiał freeze, bo klient rzucał wyjątek wcześniej. **PO:** flaga jest ON wyłącznie dla wartości `true`; po włączeniu powstaje organizacyjny budżet cost/monthly 50 USD, miesięczne zużycie jest resetowane, wyczerpanie blokuje przed providerem kodem `AI_BUDGET_EXHAUSTED`/403, a UI pokazuje angielski komunikat z następną akcją. Mutant domyślnego ON dał RED, po przywróceniu 3/3 GREEN; test bannera 1/1 GREEN; server tsc i esbuild per plik GREEN.

Zmiany: `server/src/services/ai/organizationCostLimiter.ts`, `server/src/services/aiBudgetService.ts`, `server/src/services/ai/AIPipeline.ts`, `server/src/routes/ai.routes.ts`, `src/services/api.ts`, `src/components/AIFreezeBanner.tsx`. SHA: `76787fdd11`.

**Nieudowodnione:** realny browser→HTTP→PG przebieg z budżetem ponad/pod limitem oraz widoczność zużycia dla administratora organizacji. Istniejąca administracja budżetami jest powierzchnią SuperAdmin. Z tego powodu E3 nie jest COMPLETE.

Włączenie przez nadzorcę:

```bash
AI_BUDGETS_ENABLED=true DATABASE_URL="<DATABASE_URL>" npm --prefix server start
```

## E4 — eksport i usunięcie — NIEWYKONANY po pomiarze

Real HTTP/PostgreSQL test istniejących tras SuperAdmin przeszedł 5/5: JSON zawiera organizację i użytkownika, CSV jest niepusty, delete bez nazwy daje 428 bez skutku, poprawne potwierdzenie usuwa organizację i użytkownika, brak tokenu jest odrzucany. Log: `../codex6-artefakty/e4-real-http-pg.log`.

To nie spełnia instrukcji: przyciski i trasy są dostępne dla **SUPERADMIN**, nie dla administratora organizacji. Nie ma też udowodnionej negatywnej kontroli, że eksport nie zawiera danych innego tenant-a, ani trwałego self-service audit receipt po skasowaniu aktora. Nie wprowadziłem ryzykownej pozornej samoobsługi. E4 wymaga osobnej implementacji i testu browser→download/delete→PG readback.

## Komendy dla nadzorcy

```bash
DATABASE_URL="<DATABASE_URL>" node scripts/dane/seed-pilotaz-20260912.mjs
DATABASE_URL="<DATABASE_URL>" node scripts/dane/seed-pilotaz-20260912.mjs --apply --manifest=/bezpieczna/sciezka/codex6-seed-manifest.json
DATABASE_URL="<DATABASE_URL>" node scripts/dane/seed-pilotaz-20260912.mjs --apply --manifest=/bezpieczna/sciezka/codex6-seed-manifest-second.json
```

## STOP-y i niezweryfikowany zakres

- Nie uruchamiano skryptu ani flagi na staging/demo/produkcji.
- Nie wykonano pełnego frontowego `tsc` (zakaz); wykonano esbuild per plik.
- E1 nie dowodzi wyklikania wszystkich operacji tworzących.
- E3 nie dowodzi administracyjnego widoku zużycia ani realnego requestu ponad/pod limitem.
- E4 pozostaje NIEWYKONANY w zakresie wymaganej samoobsługi administratora organizacji.
