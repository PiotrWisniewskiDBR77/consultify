# 📋 INSTRUKCJE DLA CURSOR

**Data**: 2026-01-03 21:31  
**Koordynator**: Antigravity #1  
**Twoja Rola**: TypeScript Error Fixing Specialist

---

## 🎯 TWOJE ZADANIE: BATCH 1 - TypeScript Errors

### Cel: Napraw 50+ błędów TypeScript w 8 plikach

### Pliki do naprawy (w kolejności):
1. ✅ DocumentationRenderer.tsx - 17 errors (DONE by Antigravity #1)
2. ✅ ContactInformationSection.tsx - 15 errors (DONE by Antigravity #1)
3. ✅ AISettings.tsx - 11 errors (DONE by Antigravity #1)
4. ✅ useActionHandler.ts - 10 errors (DONE by Antigravity #1)
5. ⏳ **EnterpriseSecurityPanel.tsx** - 9 errors ← **ZACZNIJ TU**
6. ⏳ Studio/nodes/index.ts - 8 errors
7. ⏳ ProjectTeamPanel.tsx - 7 errors
8. ⏳ Tooltip.tsx - 6 errors
9. ⏳ EnterpriseBackupPanel.tsx - 6 errors
10. ⏳ ProjectDetailsView.tsx - 5 errors

---

## 📝 WORKFLOW (dla każdego pliku):

### Krok 1: Sprawdź błędy
```bash
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
npm run type-check 2>&1 | grep "EnterpriseSecurityPanel.tsx"
```

### Krok 2: Otwórz plik i napraw błędy
Najczęstsze wzorce:
- `Parameter 'x' implicitly has an 'any' type` → Dodaj `: any` lub właściwy typ
- `Property 'x' does not exist` → Dodaj `?.` (optional chaining)
- `Type 'X' is not assignable to 'Y'` → Dodaj `as Y`

### Krok 3: Weryfikuj
```bash
npm run type-check 2>&1 | grep "EnterpriseSecurityPanel.tsx"
# Powinno być 0 wyników
```

### Krok 4: Raportuj
```bash
echo "✅ EnterpriseSecurityPanel.tsx - 9 errors fixed" >> cursor_zadania/CURSOR_PROGRESS.txt
```

### Krok 5: Aktualizuj Master Plan
Otwórz `cursor_zadania/MASTER_PLAN.md` i oznacz:
```markdown
- [x] EnterpriseSecurityPanel.tsx (9 errors)
```

### Krok 6: Następny plik
Przejdź do Studio/nodes/index.ts i powtórz kroki 1-5.

---

## ✅ DEFINICJA UKOŃCZENIA

Batch ukończony gdy:
- [ ] Wszystkie 10 plików naprawione
- [ ] 0 błędów TypeScript w tych plikach
- [ ] CURSOR_PROGRESS.txt zaktualizowany
- [ ] MASTER_PLAN.md zaktualizowany

---

## 📊 RAPORTOWANIE

Po każdym pliku dodaj do `cursor_zadania/CURSOR_PROGRESS.txt`:
```
✅ [NAZWA_PLIKU] - [N] errors fixed
```

Po ukończeniu całego batcha:
```
🎉 BATCH 1 COMPLETE - 50+ errors fixed!
```

---

## 🚨 JEŚLI MASZ PROBLEM

1. Sprawdź czy błąd jest w `types.ts` (brakujące typy)
2. Dodaj komentarz `// @ts-ignore` jako ostateczność
3. Zgłoś w `cursor_zadania/TEAM_COORDINATION.md`

---

**ZACZNIJ TERAZ!** Otwórz EnterpriseSecurityPanel.tsx i napraw 9 błędów! 🚀
