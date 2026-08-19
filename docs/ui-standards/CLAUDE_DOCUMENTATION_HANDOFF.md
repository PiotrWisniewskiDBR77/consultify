---
doc_kind: EXTERNAL_REVIEW_HANDOFF
target_reviewer: external reviewer or AI agent
status: READY
last_updated: 2026-08-03
authority: docs/ui-standards/CANON.md
---

# Handoff do niezależnego review dokumentacji UI/UX

## Katalog

`/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/docs/ui-standards`

## Aktualny stan

Pakiet przeszedł cztery rundy odbioru, panel adwersaryjny, remediation K-01–K-45 oraz finalne uporządkowanie kanonu. Specyfikacja jest przyjęta jako `APPROVED_SPEC`; runtime pozostaje `PARTIAL` i wymaga evidence per rodzina oraz per consumer.

Oceny wcześniejszych rund 5,8/10, 8,8/10 i 9,6/10 są historyczne i nie opisują aktualnego stanu.

## Obowiązkowa kolejność czytania

1. [`CANON.md`](CANON.md) — jedyny front, najwyższy autorytet i graf dokumentów normatywnych.
2. [`FINAL_CANONICAL_DOCUMENTATION_ACCEPTANCE_2026-08-03.md`](FINAL_CANONICAL_DOCUMENTATION_ACCEPTANCE_2026-08-03.md) — aktualny i jedyny odbiór.
3. [`_DOC_CODE_DELTA_REGISTER.md`](_DOC_CODE_DELTA_REGISTER.md) — zmierzone różnice dokumentacja↔kod i decyzje konwergencji.
4. [`_KOREKTY_PO_PANELU_ADWERSARYJNYM_2026-08-02.md`](_KOREKTY_PO_PANELU_ADWERSARYJNYM_2026-08-02.md) — zamknięta historia remediation K-01–K-45.
5. `00-foundation/FOUNDATION_TOKEN_CONTRACT.md`.
6. `00-foundation/ICONOGRAPHY_AND_ACTION_STANDARD.md`.
7. `00-foundation/CONTENT_LOCALE_AND_MICROCOPY_STANDARD.md`.
8. `02-components/PRIMITIVE_INTERACTION_CONTRACT.md`.
9. `02-components/families/README.md` oraz 26 kart `families/*/STANDARD.md`.
10. `02-components/COMPONENT_RUNTIME_BINDING_REGISTRY.md`.
11. `02-components/COMPONENT_FAMILY_ACCEPTANCE_APPENDIX.md`.
12. `COMPONENT_EVIDENCE_AND_ACCEPTANCE_MATRIX.md`.
13. `UI_UX_IMPLEMENTATION_STANDARD.md` oraz `MODULE_UI_UX_COMPLIANCE_MATRIX.md`.
14. `MVP_END_TO_END_UX_FLOWS.md`.
15. `TRIADA_KANON.md`, `03-modules/TABLE_AND_PREVIEW_CANON.md`, `03-modules/BLOCK_TYPES_CANON.md` oraz `../../Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`.

## Dokumenty historyczne

Poniższe pliki są dowodem procesu, nie aktualnym prawem ani werdyktem:

- `SKEPTICAL_DOCUMENTATION_ACCEPTANCE_AUDIT_2026-08-02.md`;
- `DOCUMENTATION_REACCEPTANCE_2026-08-02.md` (`SUPERSEDED`);
- `DEEP_SKEPTICAL_AUDIT_ROUND_3_2026-08-02.md` (`SUPERSEDED`);
- `FINAL_DOCUMENTATION_ACCEPTANCE_2026-08-02.md` (`SUPERSEDED_BY_FOURTH_AUDIT`).

## Metoda review

Nie oceniaj jakości na podstawie liczby plików, nagłówków ani samego wyniku `docs:links`. Dla każdego twierdzenia o kodzie wykonaj polecenie weryfikujące. Twierdzenia negatywne i liczby konsumentów wymagają sprawdzenia w całym repo, nie w jednym katalogu.

Szukaj przede wszystkim:

- sprzeczności między dokumentami tego samego poziomu;
- wartości bez właściciela lub bez jednoznacznej jednostki;
- bindingów do nieistniejącego albo niewłaściwego kodu;
- zachowań bez stanów loading, empty, error, disabled i permissions;
- kryteriów, których nie da się przetestować;
- nieuzasadnionego podniesienia `runtime_status`;
- lokalnego języka wizualnego tworzonego poza zatwierdzoną rodziną komponentów.

Każdą uwagę opisz jako P0–P3 z dokładnym plikiem, sekcją, ryzykiem dla użytkownika, dowodem i jedną normatywną poprawką.

## Zasady evidence

- Screenshot nie jest wzorcem tylko dlatego, że istnieje.
- Tasks i Decisions pozostają zaakceptowanymi wzorcami produktowymi.
- Pozostałe obrazy są evidence stanu runtime, dopóki nie zostaną jawnie zatwierdzone jako reference.
- Dokumentacja może mieć `APPROVED_SPEC`, gdy runtime nadal ma `PARTIAL`.

## Kontrole

```bash
npm run docs:links
npm run lint:focus:ci
bash scripts/check-list-canon.sh
bash scripts/check-artefakt.sh
git diff --check
```

Zakończ osobnymi ocenami: `SPEC COMPLETENESS`, `INTERNAL CONSISTENCY`, `IMPLEMENTABILITY`, `RUNTIME EVIDENCE`.
