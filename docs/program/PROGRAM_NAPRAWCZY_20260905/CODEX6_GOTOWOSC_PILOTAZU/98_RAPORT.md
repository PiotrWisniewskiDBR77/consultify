# CODEX 6 — raport gotowości pilotażu

## Stanowisko

**Blok osiągnął lokalne minimum i wszystkie pięć zakresów ma dowód zachowania:** E1, E2, E5, E3 i E4 są udowodnione w granicach opisanych niżej. Nie rozszerzam wyniku ponad dowód: E1 nadal nie dowodzi wyklikania każdej operacji tworzącej, a E2 nie ma wizualnego dowodu rejestru KPI.

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

## E3 — limiter kosztu AI

**PRZED:** `AI_BUDGETS_ENABLED` było efektywnie domyślnie ON, ale brak rekordu budżetu oznaczał brak limitu; komunikat SSE nie ustawiał freeze, bo klient rzucał wyjątek wcześniej. **PO:** flaga jest ON wyłącznie dla wartości `true`; po włączeniu powstaje organizacyjny budżet cost/monthly 50 USD, miesięczne zużycie jest resetowane, wyczerpanie blokuje przed providerem kodem `AI_BUDGET_EXHAUSTED`/403, a UI pokazuje angielski komunikat z następną akcją. Mutant domyślnego ON dał RED, po przywróceniu 3/3 GREEN; test bannera 1/1 GREEN; server tsc i esbuild per plik GREEN.

Zmiany bazowe: `server/src/services/ai/organizationCostLimiter.ts`, `server/src/services/aiBudgetService.ts`, `server/src/services/ai/AIPipeline.ts`, `server/src/routes/ai.routes.ts`, `src/services/api.ts`, `src/components/AIFreezeBanner.tsx`. SHA: `76787fdd11`.

Domknięcie: administrator organizacji ma tenant-scoped odczyt `Used / Monthly limit / Remaining` w istniejącym ekranie AI settings; bramka została wpięta przed fast-fail providera. Realny browser→HTTP→PostgreSQL przeszedł dla 12.34/50 USD oraz dla progu 50/50 USD. Przy progu odpowiedź zawiera `AI_BUDGET_EXHAUSTED` i zrozumiały komunikat, a zużycie w PostgreSQL nie zmienia się. Test ujawnił i naprawił błąd resetu miesiąca dla timestampu zwracanego przez `pg` jako `Date`. Mutacja RED→GREEN objęła ten przypadek. Zrzut: `evidence/pilotaz-ai-budget/01-admin-usage.png`. Logi: `../codex6-artefakty/e3-browser-http-pg-below-final.log` i `../codex6-artefakty/e3-browser-http-pg-above-final.log`. SHA domknięcia: `6117cdbf67`.

Incydent testowy: podczas diagnozy błędu resetu użyto jawnie fałszywego klucza OpenRouter. Ponieważ wadliwy limiter przepuścił żądanie, wykonana została jedna próba HTTPS do OpenRouter, zakończona 401 „Missing Authentication header”. Nie użyto prawidłowego sekretu, nie było udanego wywołania AI ani obciążenia. Po tym dowody prowadzono bez klucza providera.

Włączenie przez nadzorcę:

```bash
AI_BUDGETS_ENABLED=true DATABASE_URL="<DATABASE_URL>" npm --prefix server start
```

## E4 — eksport i usunięcie organizacji

**PRZED:** istniejące trasy eksportu i kasowania były wyłącznie SuperAdmin; nie stanowiły samoobsługi tenant admina i nie zapewniały surviving receipt. **PO:** OWNER/ADMIN z aktywnym kanonicznym członkostwem może z routowanego ekranu `Settings → Data Controls` pobrać JSON własnej organizacji oraz usunąć ją po dokładnym wpisaniu nazwy. Trasy są odrębne od SuperAdmin, wymagają zgodnego `organizationId`, sprawdzają legal hold, a usunięcie i zapis receipt są jedną transakcją.

Realny Playwright→HTTP→PostgreSQL przeszedł 1/1: login administratora disposable tenantu, widoczne kontrolki, download zawierający własnego użytkownika, zablokowany przycisk dla błędnej nazwy, skuteczne usunięcie dla nazwy dokładnej, brak organizacji i aktora w PG oraz obecny receipt. Zrzut: `evidence/pilotaz-organization-lifecycle/01-export-delete-controls.png`; log: `../codex6-artefakty/e4-browser-http-pg-final.log`. Osobny real-PG test przeszedł 3/3: cross-tenant export 403, błędna nazwa 428 bez mutacji, receipt przeżywa skasowanie i odrzuca DELETE. Kontrolowana mutacja usuwająca barierę nazwy dała RED (200 zamiast 428), przywrócony kod dał GREEN 3/3. Logi: `../codex6-artefakty/e4-mutation-red.log`, `../codex6-artefakty/e4-mutation-green.log`. SHA: `cb251a2523`.

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
- E2 KPI udowodniono ścieżką aplikacji i PostgreSQL, lecz nie wizualnym ekranem rejestru KPI.
- Nie wykonano wdrożenia ani testu stagingowego; DEC-472 wskazuje staging jako cel pilota, ale ten blok pozostał ściśle lokalny.
