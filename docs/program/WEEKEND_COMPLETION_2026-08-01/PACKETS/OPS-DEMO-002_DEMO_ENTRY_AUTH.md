---
doc_id: OPS-DEMO-002
truth_type: operations
status: BLOCKED
owner: codex
product_owner: piotr
priority: P0
depends_on: OPS-DEMO-001
last_reviewed: 2026-08-01
---

# OPS-DEMO-002 — publiczne wejście do demo

## Próba stagingowa 2026-08-01

Na `https://demo.consultify.ai` publiczne CTA `Try demo` prawidłowo otwiera modal
`Experience Consultify Demo`, ale logowanie kanonicznymi kontami wskazanymi w kodzie
zwraca `Invalid email or password`:

- `piotr.wisniewski@demo.com`;
- `anna.zielinska@ateliertoys-demo.com`.

Istniejące konto administratorskie `piotr.wisniewski@dbr77.com` pozwoliło wejść do
`Demo Mode · Atelier Toys`, dlatego dalszy odbiór techniczny był możliwy. Nie jest to
jednak poprawna ścieżka wejścia użytkownika/prospekta.

Dodatkowo `isQuickAccessShortcutHost()` nie klasyfikuje `demo.consultify.ai` jako
stagingu (`stage.*` i `staging.*` są obsłużone, `demo.*` nie), więc przewidziane skróty
testowe nie są dostępne na docelowej domenie odbiorowej.

## Werdykt

**NO-GO dla publicznego Try demo.** Ochrona tras prywatnych działa, ale obiecana ścieżka
wejścia do seedowanego workspace nie działa znanymi danymi dostępowymi.

## Pakiet naprawczy

1. ustalić jedną kanoniczną politykę wejścia: login istniejącego konta demo albo
   izolowane `register-demo`;
2. zapewnić idempotentne istnienie konta/tenant seeda na Railway `demo`;
3. objąć `demo.consultify.ai` klasyfikacją stagingową bez rozszerzania jej na produkcję;
4. dodać smoke: landing → Try demo → auth → Atelier Toys → `/chat`;
5. nie logować, nie dokumentować ani nie seedować hasła produkcyjnego;
6. po naprawie potwierdzić tenant isolation i sposób usunięcia kont testowych.

## Slice naprawczy gotowy lokalnie

- `demo.consultify.ai` zostało dodane do jawnej allowlisty hostów stagingowych;
- resolver PIN-u odrzuca teraz każdy host spoza allowlisty (wcześniej sam resolver
  zwracał stagingowe dane także dla dowolnej innej domeny, jeśli został wywołany poza UI guardem);
- produkcyjne `consultify.ai` nadal dopuszcza wyłącznie istniejący skrót `1111`;
- testy host allowlist / obcy host / produkcja: `3/3 PASS`;
- frontend type-check: PASS.

Status pozostaje `BLOCKED`, ponieważ ten slice naprawia kontrolowany dostęp QA, ale nie
materializuje brakującego konta Anna ani nie naprawia publicznego `Try demo`.

## Promocja slice'u

- revision `c522a861839f54d0f26baa918566589aab3f6f6b`;
- Railway deployment `595c7e03-8495-4240-8d24-b4f090599f07`: `SUCCESS`;
- `/ping`, `/api/health`, `/auth`, `/materials`, `/finance`: HTTP `200`;
- runtime badge: `DEMO @c522a861839f`;
- bounded log query: brak wpisów `@level:error` po wdrożeniu;
- produkcja nietknięta.
