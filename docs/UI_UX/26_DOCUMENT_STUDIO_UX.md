---
uiux_doc_id: UIUX_DOCUMENT_STUDIO
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Document Studio — UX contract (Document Artifact Engine)

## Purpose

Zdefiniować docelowy UX dla `Consultify Document Studio`: produkcja profesjonalnych dokumentów enterprise jako **żywych artifactów** (schema + sources + versions + approvals), a nie “generator tekstu”.

## Applies To

- Moduł `Dokumenty` / `Document Studio` (Word/PDF outputs)
- Template Registry (document templates)
- Document artifact detail + edit loop
- Export surfaces (DOCX/PDF + share)

## Must

- **MUST**: Dokument jest **living artifact**, nie plik:
  - ma `Document Schema` (sekcje/akapity/tabele/citations…),
  - ma statusy (draft/review/approved/final),
  - ma wersje i diff,
  - ma audit trail (kto/kiedy/co/why),
  - ma confidentiality level i permissions.
- **MUST**: Word i PDF są formatami wyjściowymi. Produkt **nie konkuruje** z MS Word jako edytorem.
- **MUST**: `Request Intake` nie jest “samym promptem”:
  - UI zbiera intencję i parametry (typ, odbiorca, cel, język, formalność, template, termin, confidentiality…),
  - potrafi startować z wielu miejsc (chat/projekt/research/interview/artifact/CRM).
- **MUST**: `Source Pack Builder` jest widoczny dla użytkownika przed generacją i podczas review:
  - co użyto / co pominięto,
  - braki danych,
  - statusy źródeł (approved/working/blocked/partial),
  - ścieżka “kliknij źródło” (traceability).
- **MUST**: `Narrative Planner` pokazuje strukturę dokumentu **przed** wygenerowaniem treści (user akceptuje plan).
- **MUST**: AI edit loop jest kontrolowany:
  - AI proponuje zmianę,
  - UI pokazuje diff (minimum sekcja/akapit),
  - user akceptuje/odrzuca,
  - akceptacja tworzy nową wersję + audit trail.
- **MUST**: `QA Engine` zwraca listę konkretnych problemów (nie tylko pass/fail) i wskazuje rekomendowane poprawki:
  - kompletność,
  - zgodność z template’em/brandem,
  - źródła/citations,
  - sprzeczności i braki.
- **MUST**: Export:
  - DOCX musi mieć prawdziwe style (H1/H2/H3, TOC, header/footer, page breaks) — inaczej traci enterprise credibility,
  - PDF musi być stabilny paginacyjnie,
  - błąd eksportu nie niszczy artifactu (fallback: internal artifact + preview).
- **MUST**: “No silent writes”: żadna istotna mutacja (AI ani user) nie zachodzi bez jawnego potwierdzenia i bez śladu audytu.
- **MUST**: Integracja z Teresą:
  - komendy edycyjne usera idą przez Teresę (jedna powierzchnia rozmowy),
  - Document Studio nie hoduje własnego “module-local chat” inputu.

## Must Not

- **MUST NOT**: Przechowywać dokumentu wyłącznie jako blob `.docx` albo nieustrukturyzowany tekst bez możliwości diff/approval/sources.
- **MUST NOT**: Ukrywać braków źródeł i braków danych (brak “confident prose” bez evidence).
- **MUST NOT**: Udawać sukcesu eksportu/zapisu bez backend confirmation (no fake success).

## Should

- **SHOULD**: Wspierać edycję sekcyjną i chunking (długie dokumenty 50–150 stron) bez regenerowania całości.
- **SHOULD**: Wspierać warianty persony/audience (CEO/client/internal/board) jako transformacje wersji dokumentu.
- **SHOULD**: Template Registry ma pełne metadane: wersja, status (draft/review/approved/deprecated), owner, audience, region/language/brand, required inputs, export rules, history.

## Acceptance Criteria

- [ ] Flow “Generate without template”: intake → plan → source pack → generate → QA → preview → edit proposals → export.
- [ ] Flow “Plan template”: AI template architect → zapis do registry jako draft → review → approved.
- [ ] Flow “Generate from approved template”: walidacja required inputs + braki → mapping do sekcji → QA → diff vs previous → review/approval → export.
- [ ] Każda edycja AI jest proposal + diff + approve/reject + version bump.
- [ ] Source pack jest klikalny i nie ma claims bez jawnego statusu źródeł.
- [ ] DOCX otwiera się w Word i zachowuje style (H1/H2/H3/TOC/header/footer).

## Related Sources

- `DRD/consultify/docs/UI_UX/41_TERESA_AND_ASSISTANTS.md` (one conversation surface)
- `DRD/consultify/docs/UI_UX/44_AI_OUTPUT_TRUST.md`
- `DRD/consultify/docs/UI_UX/53_TRACEABILITY_AND_SOURCE_UI.md`
- `DRD/consultify/docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`
- `DRD/consultify/docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md`
- `DRD/consultify/docs/UI_UX/92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08.md`

