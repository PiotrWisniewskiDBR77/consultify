---
doc_id: consultinity-cross-cutting-standards
title: Consultinity — standardy przekrojowe
truth_type: product-target
scope: cały program
status: canonical
owner: product-engineering
last_reviewed: 2026-07-29
---

# Standardy przekrojowe

Ten dokument wskazuje właściciela reguł obowiązujących w wielu pozycjach menu.
Moduł powinien linkować do standardu, a nie kopiować go lokalnie.

| Obszar | Źródło | Zastosowanie |
| --- | --- | --- |
| Mapa źródeł prawdy | `docs/SOURCE_OF_TRUTH.md` | cała dokumentacja |
| Standard dokumentacji | `docs/ssot/COMPLETE_DOCUMENTATION_STANDARD.md` | wszystkie moduły |
| UI/UX | `docs/ui-standards/README.md` | wszystkie ekrany |
| Ekrany listowe | `docs/ui-standards/TRIADA_KANON.md` | listy i huby |
| Zamrożone układy | `docs/ui-standards/FROZEN_LAYOUTS.md` | zaakceptowane powierzchnie |
| Role i governance | `docs/product/ROLES_MODEL.md` | uprawnienia i widoczność |
| Źródła i traceability | `docs/product/SOURCE_TRACEABILITY_SPEC.md` | handoffy i artefakty |
| Workflow | `docs/00_foundation/WORKFLOW_CANON_MASTER.md` | statusy i przejścia |
| Architektura | `docs/architecture/ARCHITECTURE_MAP.md` | granice techniczne |
| Baza danych | `docs/database/README.md` | dane i migracje |
| Środowiska i release | `docs/operations/STAGING_PRODUCTION_OPERATING_MODEL.md` | deploy i runtime |
| Bezpieczeństwo | `docs/security-compliance/COMPLIANCE_MATRIX.md` | kontrolki i dowody |

## Standardy wymagające konsolidacji

### AI, Teresa i agenci

Materiały istnieją w wielu dokumentach produktowych i implementacyjnych.
Potrzebny jest jeden przekrojowy kontrakt opisujący:

- role AI,
- context hierarchy,
- tool use,
- approval,
- provenance,
- memory,
- koszty,
- observability,
- zachowanie przy błędzie.

### Wspólne obiekty

Potrzebny jest jeden katalog encji platformy z właścicielem domenowym:

- task,
- decision,
- initiative,
- insight,
- assessment,
- tool session,
- report/material,
- KPI/result,
- financial model,
- evidence,
- notification.

### Statusy i lifecycle

Istnieją standardy workflow, ale wymagają porównania z realnymi enumami i
schematem bazy. Dokument nie powinien normalizować statusów, których runtime
nie rozpoznaje.

### Powiadomienia, komentarze i aktywność

Wymagają jednego kontraktu określającego zdarzenia, odbiorców, kanały,
przeczytanie, follow-up i audyt.

### Import, eksport i provenance

Materials, Tools, Assessment, Finance i Initiatives muszą stosować wspólny
model źródła, wersji, transformacji i eksportu.
