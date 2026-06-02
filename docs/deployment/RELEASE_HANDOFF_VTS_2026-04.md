# Paczka wdrożeniowa VTS / sweep (kwiecień 2026)

Dokument pomocniczy na moment, gdy **wszystkie Twoje zmiany** są gotowe i idzie **jedna paczka**: GitHub + staging + produkcja.

## Model gałęzi (kanoniczny)

Zgodnie z [STAGING_PRODUCTION_OPERATING_MODEL.md](../operations/STAGING_PRODUCTION_OPERATING_MODEL.md):

1. **Scal wszystko do `develop`** (feature branch → `develop`).
2. **Push na `develop`** → automatyczny deploy **staging** (workflow `railway-deploy.yml`, ścieżki `src/**`, `server/**`, itd.).
3. **Walidacja na stagingu** (smoke + akceptacja biznesowa).
4. **PR `develop` → `main`**, merge po zielonym CI i akceptacji.
5. **Produkcja**: GitHub Actions → workflow **Railway Deploy** → `workflow_dispatch` → environment **production** → `confirm_production: yes` (tylko z ref **`refs/heads/main`**).

## Zmienne środowiskowe (nowe / istotne w tej paczce)

| Zmienna | Gdzie | Uwagi |
|--------|--------|--------|
| `SLACK_REGISTRATION_WEBHOOK_URL` | staging + production (backend) | Opcjonalny webhook rejestracji; wpis w `.env.example`. Ustaw w Railway tylko jeśli używasz tego kanału. |

Pozostałe sekrety bez zmian względem obecnego modelu (JWT, DB, OAuth callbacks, itd.) — patrz [RAILWAY_ENV_MATRIX.md](./RAILWAY_ENV_MATRIX.md).

## Backend — build produkcyjny

`server` musi przechodzić `npm run build` (tsc). W tej paczce naprawiono m.in.:

- typ przy wywołaniu `analyzeFeatureRequest` (`category || 'other'`),
- kompletność `P10_CONFIDENCE_SEMANTICS` (poziom `contradicted`),
- macierz ról `ROLE_CAPABILITIES` (brakujący `OWNER`),
- zgodność typów `contract_status` / `access_expires_at` w `BillingCommandService`.

## Frontend / monorepo — `npm run type-check`

Rootowy `npm run type-check` nadal może zgłaszać **błędy w plikach spoza tej paczki** (stan repo na 2026-04-15: rząd ~100+ pozycji). **PR na `main`/`develop` jest blokowany** przez job `lint-typecheck` w `test-suite.yml`, dopóki rootowe `tsc` nie przejdzie lub dopóki nie uzgodnicie wyjątku / naprawy globalnej.

Pliki bezpośrednio związane z tym sprintem (chat context, insight viewer, smart suggestions) są dopasowane pod ścisły `WorkspaceType` i konstruktor `Map`.

## Checklist przed wysłaniem paczki

- [ ] Wszystkie Twoje dopiski w jednym branchu, potem merge do **`develop`**.
- [ ] `cd server && npm run build` — **OK**.
- [ ] `npm run type-check` w root — **OK** lub świadoma naprawa reszty przed merge.
- [ ] `npm run lint` — bez błędów blokujących (wg polityki zespołu).
- [ ] Opcjonalnie: `bash scripts/deploy-gate.sh` (lokalnie; health skip jeśli serwer nie stoi).
- [ ] Railway: staging deploy zielony, smoke po liście dla testerów.
- [ ] PR `develop` → `main`, potem ręczny deploy produkcji zgodnie z runbookiem [STAGING_TO_PRODUCTION_RUNBOOK.md](../operations/STAGING_TO_PRODUCTION_RUNBOOK.md).

## Zawartość funkcjonalna paczki (skrót)

Superadmin (users/org/feedback, Slack), Teresa/chat (język, załączania, stream), Discovery/Interview (insight UI, API v8), feedback HIGH/CRITICAL (szybka odpowiedź HTTP + eskalacja w tle), edycja providerów LLM, serwis analizy insightów (v8) + testy — oraz poprawki kompilacji backendu wymienione wyżej.
