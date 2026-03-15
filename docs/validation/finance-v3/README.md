## Finance V3 — validation pack (SSOT → evidence → tests)

Ten folder zawiera **kompletny pakiet walidacyjny** dla V3 “narzędzia budowania modułu finansowego” (Finance Hub + T054 Financial Model Workspace + eksporty/traceability do Reports/Presentations/Initiatives).

### Co tu jest

- `SSOT_COMPLIANCE_MATRIX.md`: macierz zgodności wymagań SSOT (MUST/SHOULD) vs. aktualna implementacja + evidence + sposób walidacji.
- `SMOKE_CHECKLIST.md`: scenariusze “user journey” do ręcznego smoke (dev/staging).
- `AUTOMATION.md`: zestaw poleceń testowych + sugerowane profile (fast vs full).
- `generated/FINANCE_IMPORT_MULTI_STANDARD_HANDOFF_2026-03-13.md`: handoff stanu prac dla rozszerzenia wielojęzycznego i wielostandardowego importu sprawozdań.

### Jak używać

1. Zacznij od `SSOT_COMPLIANCE_MATRIX.md` i przejdź wszystkie punkty oznaczone jako P0/MUST.
2. Jeśli punkt ma test automatyczny, odpal komendę z `AUTOMATION.md`.
3. Jeśli punkt jest manualny, przejdź `SMOKE_CHECKLIST.md` (dev/staging) i zaznacz wynik.

