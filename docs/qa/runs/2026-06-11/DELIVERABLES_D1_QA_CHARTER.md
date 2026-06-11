# D1 — QA charter: Deliverables light (deck / doc / sheet)

> **Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` @ `191f31a7` · **Środowisko:** dev → staging DB (Railway), flagi `ENABLE_DELIVERABLES_LIGHT=true` + `ENABLE_TERESA_RETRIEVAL=true`.
> **Metoda:** API-driven (token w przeglądarce z kontekstem org) + code-verify dla wymiarów, których live na demo nie da się uczciwie odtworzyć (RBAC viewer, flag-off). Zgodnie z planem wykonawczym §D1.
> **Werdykt: GO dla flag-on na stagingu.** Wszystkie bramki bezpieczeństwa i poprawności zielone; multi-tenant isolation potwierdzona na żywo na realnej drugiej organizacji.

---

## 1. Bezpieczeństwo / RBAC / izolacja

| # | Test | Oczekiwane | Wynik | Dowód |
|---|---|---|---|---|
| T1 | POST bez auth | 401 | **401** ✓ | live API |
| T2 | POST `format:"banana"` | 400 | **400** ✓ | live API |
| T3 | doc bez `intent` | 400 `invalid_setup` | **400 invalid_setup** ✓ | live API |
| T4 | doc bez `conversationId` | 400 `invalid_setup` | **400 invalid_setup** ✓ | live API (P2-4) |
| T5 | GET nieistniejącej generacji | 404 | **404** ✓ | live API |
| T6 | Podwójny `generate` tej samej generacji | 409 `invalid_state` | **409 invalid_state** ✓ | live API (idempotencja) |
| T7 | **Cross-tenant isolation** — odczyt draftu `dbr77` tokenem `demo-org` | 404 (mimo że draft istnieje w DB) | **404** ✓ | live API — realny drugi tenant |
| T7b | Cross-tenant `generate` draftu `dbr77` | 404 | **404** ✓ | live API |
| T8 | RBAC: VIEWER → `generate` | 403 `PERMISSION_DENIED` | **code+unit ✓** | matrix: VIEWER ma tylko `presentation_view`+`presentation_export`, router gate'uje `presentation_create` |
| T9 | Flaga OFF → cała powierzchnia | 404 | **code ✓** | per-request guard zwraca 404 bezwarunkowo |
| T10 | Rate-limit | 30/min prod (200/min dev) | **code ✓** | `aiRateLimiter` na obu POST (3× wpięty) |

**T7 to najmocniejszy wynik:** draft `61104d8d…` istnieje w bazie pod `organization_id='dbr77'`,
a token `demo-org` (ADMIN!) dostaje na nim 404 zarówno przy odczycie, jak i starcie generacji —
dowód, że scoping `AND organization_id = ?` (8× w workCanvasService, 1× getDeckRow) jest szczelny
przeciw realnemu drugiemu tenantowi, nie tylko przeciw zmyślonym ID.

## 2. Poprawność funkcjonalna

| # | Test | Wynik |
|---|---|---|
| F1 | Eksport doc → **markdown** | 200 · `text/markdown` · 2970 B ✓ |
| F2 | Eksport doc → **DOCX** | 200 · `…openxmlformats-officedocument` · 9415 B ✓ |
| F3 | Eksport doc → **PDF** | 200 · `application/pdf` · 4396 B ✓ |
| F4 | Eksport sheet → **XLSX** | 200 · `…openxmlformats-officedocument` · 6770 B ✓ |
| F5 | Eksport sheet → **CSV** | 200 · `text/csv` · 559 B ✓ |
| F6 | Błąd silnika LLM ⇒ stan `error`, draft nienaruszony (anti-placeholder) | **unit ✓** (`wyjątek silnika ⇒ stan error`, `stub ⇒ error draft nienaruszony`) |
| F7 | Restart serwera w trakcie ⇒ stan wnioskowany z DB | **unit ✓** (`statusDoc po restarcie`) |
| F8 | Grounding source_refs / auto_scan / conversation | **DB-proof** (telemetria `grounding_mode`) |
| F9 | Sekcja Źródła w artefakcie (B3) | **DB-proof** (`## Źródła` z tytułami encji) |

23 testy jednostkowe runtime deliverables zielone; 855 testów documentStudio bez regresji.

## 3. Świadome ograniczenia tej rundy (uczciwość)

1. **RBAC VIEWER (T8)** nie odtworzony żywym tokenem viewera — wszystkie konta `register-demo`
   są ADMIN-em w `demo-org`. Zweryfikowane przez macierz uprawnień (kod) + istniejący unit test
   `presentationAccessPolicyService`. Do pełnego live: konto VIEWER w organizacji testowej.
2. **Rate-limit (T10)** nie był hammerowany na żywo — 200 żądań/min zaśmieciłoby bazę 200 draftami
   (każdy plan tworzy draft). Wpięcie middleware code-verified; próg dev 200/min, prod 30/min.
3. **Flaga OFF (T9)** nie testowana przez przełączenie env (wymaga restartu współdzielonego z drugą
   sesją) — guard zwraca 404 bezwarunkowo, ścieżka kodu trywialna.

## 4. Rekomendacja

**GO na staging z flagami ON.** Brak znalezisk blokujących. Przed prod-on (D3): pełny live-test
RBAC viewer w środowisku z kontami wielo-rolowymi + 1 hammer-test rate-limitu na izolowanej org.
Rollback = flagi OFF (bez migracji, bez utraty danych — drafty zostają w `work_canvas_drafts`).

**Następne na ścieżce krytycznej:** D3 (decyzja `[P]` o włączeniu flag) — zależne od promocji
Londyn→prod. Równolegle wolne: A3 (streaming sekcji), C1–C2 (edit-light), C3 (re-scoped po stubie).


---

## 5. Metryki §8 (live, endpoint `GET /api/deliverables/generations/metrics`)

Dodane po D1 (operacjonalizacja telemetrii D2 dla decyzji D3). Snapshot 2026-06-11 (demo-org, 30 dni):

| Metryka §8 | Cel | Live |
|---|---|---|
| Completion rate (completed / terminal) | > 95% | **100%** (7/7, 0 failed) |
| Honest-failure coverage | 100% | **1.0** (zero cichych degradacji) |
| Time-to-completion doc | proxy <10s (TTFC) | p50 **19s** / p95 19.4s (one-shot; A3 streaming obniży TTFC) |
| Time-to-completion sheet | — | p50 **4.8s** |
| Time-to-completion deck | — | **13.7s** / 5 kart |
| Udział groundingu w danych org (source_refs+auto_scan) | > 50% po fazie B | **43%** (29% source_refs + 14% auto_scan; reszta conversation) |

Endpoint admin-scoped (ADMIN/OWNER/SUPERADMIN), org-scoped, za flagą. Daje Piotrowi twarde
liczby pod D3 zamiast przeczucia. **Jedyny cel poniżej progu:** udział groundingu 43% vs cel >50% —
naturalnie wzrośnie z B1 (wejście z encji) gdy użytkownicy zaczną tworzyć z kart, nie z pustego promptu.
