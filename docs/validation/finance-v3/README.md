## Finance V3 — validation pack (SSOT → evidence → tests)

Ten folder zawiera **kompletny pakiet walidacyjny** dla V3 "narzędzia budowania modułu finansowego" (Finance Hub + T054 Financial Model Workspace + eksporty/traceability do Reports/Presentations/Initiatives).

### Co tu jest

#### System CFO Auto-Validation (NOWY)
- **`CFO_AUTO_VALIDATION.md`**: pełna dokumentacja systemu autonomicznej walidacji finansowej — kontrole krzyżowe, auto-naprawy, scoring 0-100, wzorce finansowe. **9/9 dokumentów na 100/100.**
- **`FINANCE_MODULE_SESSION_REPORT_2026-03-15.md`**: raport z sesji — co zrobiono, stan DB, znane ograniczenia, rekomendacje na następną sesję.

#### Walidacja i testy
- `SSOT_COMPLIANCE_MATRIX.md`: macierz zgodności wymagań SSOT (MUST/SHOULD) vs. aktualna implementacja + evidence + sposób walidacji.
- `SMOKE_CHECKLIST.md`: scenariusze "user journey" do ręcznego smoke (dev/staging).
- `AUTOMATION.md`: zestaw poleceń testowych + sugerowane profile (fast vs full).

#### Architektura i polityki
- `FINANCE_MAPPING_POLICY.md`: 3-tier mapping (heuristic → LLM → learning loop) + confidence tiers.
- `FINANCE_IMPORT_ARCHITECTURE_DECISION.md`: ADR dla architektury importu.
- `PROFESSIONAL_ANALYSIS_READINESS.md`: gotowość do profesjonalnej analizy finansowej.
- `RATIO_COVERAGE_MATRIX.md`: pokrycie wskaźnikowe canonical taxonomy.

#### Raporty
- `FINANCE_IMPORT_END_TO_END_REPORT_2026-03-15.md`: raport end-to-end z importu 9 dokumentów.
- `FINANCE_IMPORT_SYSTEM_PROGRESS_REPORT_2026-03-15.md`: postęp systemu.
- `FINANCE_IMPORT_SYSTEM_AUDIT.md`: audyt systemu.
- `FINANCE_IMPORT_REMEDIATION_PROGRAM.md`: program naprawczy.
- `FINANCE_IMPORT_GOVERNANCE.md`: governance importu.

#### Handoff
- `generated/FINANCE_IMPORT_MULTI_STANDARD_HANDOFF_2026-03-13.md`: handoff stanu prac dla rozszerzenia wielojęzycznego i wielostandardowego importu sprawozdań.

### Jak używać

1. **Nowy agent?** Zacznij od `FINANCE_MODULE_SESSION_REPORT_2026-03-15.md` — zawiera stan systemu, znane ograniczenia i priorytety.
2. **CFO Validation?** Przeczytaj `CFO_AUTO_VALIDATION.md` — architektura, kontrole, scoring, integracja.
3. **Mapping policy?** Przeczytaj `FINANCE_MAPPING_POLICY.md` — 3-tier mapping, learning loop, confidence tiers.
4. Zacznij od `SSOT_COMPLIANCE_MATRIX.md` i przejdź wszystkie punkty oznaczone jako P0/MUST.
5. Jeśli punkt ma test automatyczny, odpal komendę z `AUTOMATION.md`.
6. Jeśli punkt jest manualny, przejdź `SMOKE_CHECKLIST.md` (dev/staging) i zaznacz wynik.

### Komendy

```bash
# Pełny reimport z CFO auto-validation
ENV_FILE=.env.staging.local npx tsx server/scripts/reimport-all-statements.ts

# Cleanup obu baz
ENV_FILE=.env.staging.local npx tsx server/scripts/cleanup-all-finance-data.ts

# Standalone CFO quality check
ENV_FILE=.env.staging.local npx tsx server/scripts/cfo-quality-check.ts
```
