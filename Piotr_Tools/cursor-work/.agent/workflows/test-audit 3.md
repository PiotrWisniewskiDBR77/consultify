---
description: jak zapisać wyniki audytu testów automatycznych
---

# Test Audit Workflow

Po każdej sesji pracy nad testami automatycznymi, wykonaj poniższe kroki:

## 1. Uruchom pełny test suite
```bash
npx vitest run 2>&1 | grep -E "Test Files|Tests" | tail -3
```

## 2. Zapisz wyniki w rejestrze
Otwórz `/tests/TEST_AUDIT_REGISTRY.md` i dodaj nowy wpis w formacie:

```markdown
### YYYY-MM-DD | [Nazwa sesji]

| Poziom | Pokrycie | Pass Rate | Zmiana |
|--------|----------|-----------|--------|
| Unit | X% | Y% | opis |
| Component | X% | Y% | opis |
| Integration | X% | Y% | opis |
| E2E | X% | Y% | opis |
| Security+Perf | X% | Y% | opis |

**Działania:**
- [Lista wykonanych zmian]
```

## 3. Zaktualizuj główną tabelę
Zaktualizuj sekcję "Aktualny Stan Testów" na górze pliku z nowymi wartościami.

// turbo-all
