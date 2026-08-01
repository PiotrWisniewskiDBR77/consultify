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
