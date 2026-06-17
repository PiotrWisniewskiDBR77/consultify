# M02 — Instrukcja dla Piotra: flaga DELIVERABLES_LIGHT na Railway (DEBLOKER)

**Data:** 2026-06-17 · **Autor:** Harvard 1 · **Priorytet:** #1 (debloker dla Harvard 5 — M17/M18/M19)
**Status kodu:** ✅ gotowy i live-proven lokalnie 2026-06-10 · **Status deploy:** ⛔ flaga prawdopodobnie OFF na Railway

---

## 1. Problem w jednym zdaniu

Triada generacji **deck/doc/sheet z czatu** (Canvas deliverables-light) **działa w kodzie**, ale jest **wyłączona na Railway** (staging/demo/prod), bo flaga środowiskowa nie jest ustawiona w dashboardzie Railway — tylko w lokalnym `.env.local`. Bez niej: backend zwraca **404** na całej powierzchni `/api/deliverables/generations`, a frontend cicho przekierowuje na legacy `/wordy`/`/excele`/`/prezentacje`.

## 2. Dlaczego nie mogę tego zrobić sam

- Zmienne Railway ustawia się w **dashboardzie Railway** (Variables), nie w pliku repo — nie mam tam dostępu.
- Pliki `.env*` / `.railway*` / `railway.toml` są **zabronione** dla agentów (ryzyko sekretów + override prod).
- To zmiana środowiska **prod (centerbeam)** → wymaga Twojej świadomej zgody ([[feedback_prod_caution]]).

## 3. Co dokładnie ustawić (DWIE zmienne — to NIE jest jedna!)

Flaga jest **dwuczęściowa** — frontend i backend mają osobne nazwy i osobny moment użycia:

| Zmienna | Warstwa | Kiedy czytana | Plik w kodzie |
|---------|---------|---------------|---------------|
| `VITE_ENABLE_DELIVERABLES_LIGHT=true` | **Frontend (build-time!)** | przy `vite build` — **wpalana w bundla** | `src/services/deliverablesGeneration.ts:46` |
| `ENABLE_DELIVERABLES_LIGHT=true` | **Backend (runtime)** | przy każdym requeście | `server/src/config/FeatureFlags.ts:117` |

> ⚠️ **Kluczowe:** `VITE_*` jest **build-time** — musi istnieć w środowisku **w momencie budowania frontendu** na Railway, inaczej zostanie wpalone `undefined` do bundla i żaden runtime-restart tego nie naprawi. Po ustawieniu zmiennej **trzeba przebudować** (redeploy z czystym buildem).

## 4. Kroki (per środowisko Railway)

Dla **każdego** serwisu/środowiska, gdzie triada ma być włączona (staging caboose → potem prod centerbeam za osobną zgodą):

1. Railway → projekt → wybierz **serwis** (frontend i/lub backend — patrz niżej).
2. Zakładka **Variables** → **New Variable**:
   - **na serwisie frontendu (build):** `VITE_ENABLE_DELIVERABLES_LIGHT` = `true`
   - **na serwisie backendu (runtime):** `ENABLE_DELIVERABLES_LIGHT` = `true`
   - (jeśli to monorepo na jednym serwisie — ustaw **obie** na tym samym serwisie)
3. **Redeploy z rebuildem** (nie tylko restart) — żeby `VITE_*` trafiło do nowego bundla.
4. Weryfikacja (patrz §5).

## 5. Jak zweryfikować, że zadziałało

- **Backend (runtime):** request na `POST /api/deliverables/generations` z auth → **NIE** powinno być `404 {"error":"Not found"}` (to sygnatura wyłączonej flagi z `deliverablesGenerations.routes.ts:40`). Powinno przejść do logiki PLAN.
- **Frontend (build):** w czacie poproś Teresę „zrób dokument/deck/tabelę" → po prawej powinien zamontować się **żywy artefakt** (Canvas), a **nie** nastąpić przekierowanie na `/wordy`/`/excele`/`/prezentacje`.
- Smoke szybki: w konsoli przeglądarki `import.meta.env.VITE_ENABLE_DELIVERABLES_LIGHT` (jeśli dostępne w devtools build) lub po prostu obserwacja braku redirectu.

## 6. Zależności (dlaczego to debloker)

Harvard 5 (M17 Outputs / M18 Dokumenty / M19 Prezentacje) opiera część przepływów na tej samej triadzie deliverables. Dopóki flaga jest OFF na Railway, ich „nigdy nie działało" ma **to** za root-cause (nie kod) — patrz [[finding_deliverables_vite_flag_deploy]].

## 7. Ryzyko / uwagi

- Włączenie flagi udostępnia generację LLM (koszt tokenów) — świadoma decyzja produktowa.
- Najpierw **staging (caboose)**, potem prod (centerbeam) **osobno**.
- Kod tej powierzchni dostał w tej fali dwie poprawki bezpieczeństwa/kontraktu (L-05 generate→400, L-10b token-shape) — bezpieczne do włączenia.
