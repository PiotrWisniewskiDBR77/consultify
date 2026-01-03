# 📋 INSTRUKCJE DLA ANTIGRAVITY #2

**Data**: 2026-01-03 21:31  
**Koordynator**: Antigravity #1  
**Twoja Rola**: TypeScript Error Fixing Specialist (Batch 2)

---

## 🎯 TWOJE ZADANIE: Fix 10 plików z największą liczbą błędów

### Cel: Zredukuj ~150 błędów TypeScript

### Pliki do naprawy (w kolejności):

**UWAGA**: Pierwsze 4 pliki już naprawione przez Antigravity #1:
1. ✅ DocumentationRenderer.tsx - 17 errors (DONE)
2. ✅ ContactInformationSection.tsx - 15 errors (DONE)
3. ✅ AISettings.tsx - 11 errors (DONE)
4. ✅ useActionHandler.ts - 10 errors (DONE)

**TWOJE PLIKI** (zacznij od #5):
5. ⏳ **EnterpriseSecurityPanel.tsx** - 9 errors ← **ZACZNIJ TU**
6. ⏳ Studio/nodes/index.ts - 8 errors
7. ⏳ ProjectTeamPanel.tsx - 7 errors
8. ⏳ Tooltip.tsx - 6 errors
9. ⏳ EnterpriseBackupPanel.tsx - 6 errors
10. ⏳ ProjectDetailsView.tsx - 5 errors
11. ⏳ [Następny plik z type-check]
12. ⏳ [Następny plik z type-check]
13. ⏳ [Następny plik z type-check]
14. ⏳ [Następny plik z type-check]

---

## 📝 WORKFLOW (dla każdego pliku):

### Krok 1: Sprawdź błędy
```bash
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
npm run type-check 2>&1 | grep "EnterpriseSecurityPanel.tsx"
```

### Krok 2: Otwórz plik
```bash
# Skopiuj ścieżkę z błędu, np:
# components/SuperAdmin/system/EnterpriseSecurityPanel.tsx
```

### Krok 3: Napraw błędy

**Wzorce błędów i rozwiązania:**

#### A) `Parameter 'x' implicitly has an 'any' type`
```typescript
// ❌ Przed
array.map((item, i) => ...)

// ✅ Po
array.map((item: any, i: number) => ...)
```

#### B) `Property 'x' does not exist`
```typescript
// ❌ Przed
user.profile.name

// ✅ Po
user.profile?.name ?? 'Unknown'
```

#### C) `Type 'X' is not assignable to type 'Y'`
```typescript
// ❌ Przed
const data = response as SomeType;

// ✅ Po
const data = response as any; // Type from API
```

#### D) Brakujące typy w types.ts
```typescript
// Dodaj do types.ts
export interface MissingType {
  id: string;
  name: string;
  // ... inne pola
}
```

### Krok 4: Weryfikuj
```bash
npm run type-check 2>&1 | grep "EnterpriseSecurityPanel.tsx"
# Powinno być 0 wyników = sukces!
```

### Krok 5: Raportuj
```bash
echo "✅ EnterpriseSecurityPanel.tsx - 9 errors fixed" >> cursor_zadania/ANTIGRAVITY2_PROGRESS.txt
```

### Krok 6: Następny plik
Przejdź do Studio/nodes/index.ts i powtórz kroki 1-5.

---

## ✅ DEFINICJA UKOŃCZENIA

Zadanie ukończone gdy:
- [ ] 10 plików naprawione
- [ ] ~150 błędów TypeScript naprawionych
- [ ] ANTIGRAVITY2_PROGRESS.txt zaktualizowany
- [ ] MASTER_PLAN.md zaktualizowany

---

## 📊 RAPORTOWANIE

### Po każdym pliku:
Dodaj do `cursor_zadania/ANTIGRAVITY2_PROGRESS.txt`:
```
### 2026-01-03 21:35
✅ EnterpriseSecurityPanel.tsx - 9 errors fixed
- Fixed implicit any types (5)
- Added optional chaining (3)
- Fixed type assertions (1)
```

### Po ukończeniu batcha:
```
🎉 BATCH COMPLETE!
Files Fixed: 10/10
Errors Fixed: 150/~150
Time Spent: 3h
```

---

## 🚨 JEŚLI MASZ PROBLEM

1. **Nie wiesz jak naprawić błąd?**
   - Sprawdź jak Antigravity #1 naprawił podobny błąd w DocumentationRenderer.tsx
   - Użyj `as any` jako ostateczność

2. **Błąd w types.ts?**
   - Dodaj brakujący typ/interface
   - Lub dodaj optional property: `property?: type`

3. **Nie możesz znaleźć pliku?**
   - Użyj pełnej ścieżki z błędu TypeScript

4. **Blokada?**
   - Zgłoś w `cursor_zadania/TEAM_COORDINATION.md`
   - Pomiń plik i przejdź do następnego

---

## 📁 STRUKTURA PLIKÓW

```
cursor_zadania/
├── ANTIGRAVITY2_CURRENT_TASK.md  ← Szczegóły zadania
├── ANTIGRAVITY2_PROGRESS.txt     ← TUTAJ raportuj
├── MASTER_PLAN.md                ← Aktualizuj checkboxy
└── TEAM_COORDINATION.md          ← Komunikacja
```

---

**ZACZNIJ TERAZ!** Otwórz EnterpriseSecurityPanel.tsx i napraw 9 błędów! 🚀

**Powodzenia!** 💪
