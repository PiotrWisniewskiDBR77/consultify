# 🔧 PACZKA 2: Quick Fixes - Ostatnie 7 fałszywych asercji

## 📋 MISJA

Naprawić ostatnie 7 instancji `expect(true).toBe(true)` - **szacowany czas: 15 min**

---

## 📁 PLIKI DO NAPRAWY

### 1. `tests/integration/rapidlean-error-handling.test` (4 asercje)

**Linie:** 153, 161, 167, 172

```bash
# Podgląd kontekstu
sed -n '150,175p' tests/integration/rapidlean-error-handling.test
```

**Strategia:** Zamień na prawdziwe asercje testujące error handling

### 2. `tests/components/OrgSwitcher.test.tsx` (1 asercja)

**Linia:** 79

```bash
# Podgląd kontekstu
sed -n '75,85p' tests/components/OrgSwitcher.test.tsx
```

**Strategia:** Zamień na `it.todo()` lub prawdziwy test

### 3. `tests/migration/performance.test` (1 asercja)

**Linia:** 71

```bash
# Podgląd kontekstu
sed -n '68,75p' tests/migration/performance.test
```

**Strategia:** Zamień na `it.todo()` lub test performance

### 4. `tests/migration/types.test` (1 asercja)

**Linia:** 29

```bash
# Podgląd kontekstu
sed -n '25,35p' tests/migration/types.test
```

**Strategia:** Zamień na test typów lub `it.todo()`

---

## 📝 WZORZEC NAPRAWY

### Opcja A: Zamień na `it.todo()`

```javascript
// ❌ PRZED:
it('should handle error', () => {
  expect(true).toBe(true);
});

// ✅ PO:
it.todo('should handle error');
```

### Opcja B: Zamień na `it.skip()` z komentarzem

```javascript
// ✅ PO:
it.skip('should handle error - needs real implementation', () => {
  // TODO: Implement real error handling test
});
```

### Opcja C: Napraw na prawdziwy test

```javascript
// ✅ PO:
it('should handle error', () => {
  expect(() => {
    throw new Error('Test error');
  }).toThrow('Test error');
});
```

---

## ✅ WERYFIKACJA

```bash
# Po naprawie - powinno być 0
grep -rn "expect(true).toBe(true)" tests/ | wc -l

# Uruchom testy
npm test
```

---

## 🎯 CEL

- [ ] 0 instancji `expect(true).toBe(true)`
- [ ] Wszystkie testy nadal przechodzą
