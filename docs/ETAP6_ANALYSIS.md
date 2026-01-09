# ETAP 6: Analiza Usunięcia Legacy JS Plików

**Data:** 2026-01-04

## Stan Aktualny

### Legacy JS Pliki
- **437 plików** w `server/services/`
- **282 ma TypeScript wrappery** w `server/src/services/`
- **155 nie ma wrapperów** (głównie w `ai/` i innych podkatalogach)

### Użycie Legacy Plików

1. **Legacy Routes (126 plików)**
   - Używają bezpośrednio legacy JS services
   - Przykłady: `server/routes/ai.js`, `server/routes/assessments.js`, etc.

2. **Testy (65 plików)**
   - Używają bezpośrednio legacy JS services
   - Przykłady: `tests/unit/backend/assessmentService.test.js`, etc.

3. **server/src/index.ts**
   - Dynamiczne importy niektórych legacy JS plików
   - Przykłady: `import('./services/ai/startupValidator.js')`, etc.

4. **TypeScript Wrappery (282 pliki)**
   - Importują legacy JS pliki jako pośrednicy
   - Przykłady: `server/src/services/adminSessionService.ts` → `../../services/adminSessionService.js`

## Rekomendacja

⚠️ **NIE USUWAĆ legacy JS plików w tym momencie**, ponieważ:

1. **Legacy routes** nadal używają legacy JS services bezpośrednio
2. **Testy** używają legacy JS services bezpośrednio
3. **server/src/index.ts** używa niektórych legacy JS plików bezpośrednio
4. **TypeScript wrappery** zależą od legacy JS plików

## Następne Kroki (Poza zakresem obecnej migracji)

Aby bezpiecznie usunąć legacy JS pliki, należy:

1. **Przekonwertować legacy routes** do TypeScript (185 plików)
2. **Zaktualizować testy**, aby używały TypeScript services
3. **Zaktualizować server/src/index.ts**, aby używał TypeScript services
4. **Usunąć wrappery TypeScript** i używać bezpośrednio skonwertowanych plików
5. **Na końcu usunąć legacy JS pliki**

## Alternatywna Strategia

Zamiast usuwać legacy pliki teraz, można:

1. ✅ **Zaktualizować wszystkie importy database** (już zrobione)
2. ✅ **Upewnić się, że wszystkie pliki używają TypeScript database** (już zrobione)
3. ⏳ **Pozostawić legacy pliki** jako są (są używane przez routes i testy)
4. ⏳ **W przyszłości przekonwertować routes i testy** do TypeScript
5. ⏳ **Wtedy usunąć legacy pliki**

## Wnioski

**ETAP 6 nie może być zakończony w pełni** w obecnym stanie, ponieważ:
- Legacy routes i testy zależą od legacy JS plików
- Usunięcie ich teraz zepsułoby aplikację

**Rekomendacja:** Oznaczyć ETAP 6 jako częściowo zakończony i przejść do ETAP 7 (finalizacja dokumentacji).












