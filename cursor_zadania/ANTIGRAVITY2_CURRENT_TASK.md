# 🎯 ZADANIE DLA ANTIGRAVITY #2 - TypeScript Error Fixing

## 📋 TWOJE ZADANIE
Napraw błędy TypeScript w **10 plikach** z największą liczbą błędów.

**Cel**: Zredukować 307 błędów TypeScript o ~150 błędów

**Czas**: 2-3 godziny

---

## 📝 LISTA PLIKÓW DO NAPRAWY

Napraw błędy w kolejności (od największej liczby błędów):

1. ✅ **DocumentationRenderer.tsx** - 17 błędów (ZROBIONE przez Antigravity #1)
2. ✅ **ContactInformationSection.tsx** - 15 błędów (ZROBIONE)
3. ✅ **AISettings.tsx** - 11 błędów (ZROBIONE)
4. ✅ **useActionHandler.ts** - 10 błędów (ZROBIONE)
5. ✅ **EnterpriseSecurityPanel.tsx** - 9 błędów (ZROBIONE)
6. ⏳ **Studio/nodes/index.ts** - 8 błędów ← **AKTUALNIE TU**
7. ⏳ **ProjectTeamPanel.tsx** - 7 błędów
8. ⏳ **Tooltip.tsx** - 6 błędów
9. ⏳ **EnterpriseBackupPanel.tsx** - 6 błędów
10. ⏳ **ProjectDetailsView.tsx** - 5 błędów

**POSTĘP: 5/10 plików ukończone (50%) | 45 błędów naprawionych**


---

## 🔧 JAK NAPRAWIAĆ BŁĘDY

### Krok 1: Sprawdź błędy w pliku
```bash
npm run type-check 2>&1 | grep "ContactInformationSection.tsx"
```

### Krok 2: Otwórz plik i znajdź błędy
Najczęstsze błędy:
- `Parameter 'x' implicitly has an 'any' type` → Dodaj typ
- `Property 'x' does not exist` → Dodaj optional chaining `?.`
- `Type 'X' is not assignable to type 'Y'` → Dodaj type assertion `as Y`

### Krok 3: Napraw błędy

**Przykład 1: Implicit any**
```typescript
// ❌ Przed
array.map((item, i) => ...)

// ✅ Po
array.map((item: any, i: number) => ...)
```

**Przykład 2: Missing property**
```typescript
// ❌ Przed
user.profile.name

// ✅ Po
user.profile?.name ?? 'Unknown'
```

**Przykład 3: Type assertion**
```typescript
// ❌ Przed
const data = content as typeof SOME_TYPE[string];

// ✅ Po
const data = content as any; // Type from SOME_TYPE
```

### Krok 4: Weryfikuj po każdym pliku
```bash
npm run type-check 2>&1 | grep -c "error TS"
```

---

## 📊 RAPORTOWANIE

Po każdym naprawionym pliku, zaktualizuj `cursor_zadania/ANTIGRAVITY2_PROGRESS.md`:

```markdown
## [DATA] - Progress Update

### Completed Files
- ✅ ContactInformationSection.tsx - 15 errors fixed
- ✅ AISettings.tsx - 11 errors fixed

### Current Status
- Files fixed: 2/10
- Errors fixed: 26/~150
- Time spent: 1h

### Next
- EnterpriseSecurityPanel.tsx
```

---

## 🚨 WAŻNE ZASADY

1. **Naprawiaj PO KOLEI** - jeden plik na raz
2. **Testuj po każdym pliku** - `npm run type-check`
3. **Commituj często** - po każdym naprawionym pliku
4. **Raportuj postęp** - aktualizuj ANTIGRAVITY2_PROGRESS.md
5. **Pytaj jeśli blokada** - w TEAM_COORDINATION.md

---

## 📁 PLIKI DO NAPRAWY (szczegóły)

### 2. ContactInformationSection.tsx (15 błędów)
**Lokalizacja**: `components/settings/ContactInformationSection.tsx`

**Typowe błędy**:
- Implicit any w map callbacks
- Missing type definitions
- Optional chaining needed

**Napraw**:
```bash
# 1. Zobacz błędy
npm run type-check 2>&1 | grep "ContactInformationSection.tsx"

# 2. Otwórz plik
# 3. Dodaj typy do wszystkich parametrów
# 4. Dodaj optional chaining gdzie potrzeba
# 5. Testuj
npm run type-check 2>&1 | grep "ContactInformationSection.tsx"
```

### 3. AISettings.tsx (11 błędów)
**Lokalizacja**: `components/settings/AISettings.tsx`

**Napraw podobnie jak powyżej**

### 4. useActionHandler.ts (10 błędów)
**Lokalizacja**: `hooks/useActionHandler.ts`

**Napraw podobnie jak powyżej**

... (i tak dalej dla pozostałych plików)

---

## ✅ SUCCESS CRITERIA

Zadanie ukończone gdy:
- [ ] 10 plików naprawionych
- [ ] ~150 błędów TypeScript naprawionych
- [ ] Wszystkie pliki commitowane
- [ ] ANTIGRAVITY2_PROGRESS.md zaktualizowany
- [ ] Master Plan zaktualizowany

---

## 📞 KONTAKT

**Koordynator**: Antigravity #1
**Pytania**: Dodaj do `cursor_zadania/TEAM_COORDINATION.md`

**Powodzenia!** 🚀
