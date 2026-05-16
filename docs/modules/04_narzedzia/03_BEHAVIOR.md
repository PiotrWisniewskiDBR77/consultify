---
module_id: MODULE_TOOLS
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Narzędzia

## Purpose

Opisać kontrakt zachowania sesji narzędziowej: uruchomienie, prowadzenie kroków, generowanie wyników i inicjatyw, oraz linkowanie do Assessment.

## Must

- MUST: uruchomienie narzędzia tworzy sesję (ToolSession) i prowadzi użytkownika przez kroki.
- MUST: AI integracja działa jako wsparcie sesji (prompting, ekstrakcje, wizualizacje), nie jako ukryta mutacja.
- MUST: inicjatywy generowane z narzędzia są propozycjami do potwierdzenia przez użytkownika przed wysłaniem do `Inicjatywy`.
- MUST: jeśli narzędzie rekomenduje assessment/framework, UI oferuje przejście do `/assessment/...`.

## Must Not

- MUST NOT: automatycznie tworzyć/zatwierdzać inicjatywy bez jawnego potwierdzenia (no silent execution).
- MUST NOT: udawać sukcesu jeśli nie zapisano sesji lub wyników (no fake success).

## Should

- SHOULD: zachować spójne akcje: uruchom, regeneruj insight, stwórz inicjatywę, eksportuj/udostępnij wynik.

## Acceptance Criteria

- [ ] Użytkownik może przejść: Library → Tool → Session → (Generate Initiative) → Initiatives wizard.
- [ ] UI ma czytelne stany loading/success/error/empty i nie blokuje się perma-spinnerem.

## Related Sources

- `DRD/consultify/docs/modules/DISCOVERY_TOOLS_MODULE.md`
- `DRD/consultify/docs/product/TOOLS_CATALOG_V3.md`

