# ETAP 6: Strategia Usunięcia Legacy JS Plików

**Data:** 2026-01-04

## Analiza Stanu

### Znalezione:
- **437 legacy JS plików** w `server/services/`
- **282 pliki mają TypeScript wrappery** w `server/src/services/`
- **155 plików nie ma wrapperów** (głównie w `ai/` i innych podkatalogach)
- **296 importów** z legacy JS plików w `server/src/`

### Strategia Usunięcia

**FAZA 1: Weryfikacja użycia**
1. Sprawdzić, które legacy JS pliki są używane bezpośrednio (nie przez wrappery)
2. Sprawdzić użycie w routes i testach
3. Zidentyfikować pliki bezpieczne do usunięcia

**FAZA 2: Backup**
1. Utworzyć backup wszystkich legacy plików
2. Utworzyć git branch dla bezpieczeństwa

**FAZA 3: Usunięcie (etapami)**
1. Najpierw usunąć pliki z wrapperami, które nie są używane bezpośrednio
2. Następnie przekonwertować pozostałe pliki do TypeScript
3. Na końcu usunąć wszystkie legacy pliki

## Uwagi

⚠️ **WAŻNE:** Nie można usunąć wszystkich legacy plików naraz, ponieważ:
- Wiele z nich jest używanych przez wrappery TypeScript
- Niektóre mogą być używane przez routes (legacy JS routes)
- Niektóre mogą być używane przez testy
- Niektóre mogą być używane bezpośrednio w innych miejscach

## Rekomendacja

Zamiast usuwania wszystkich plików naraz, powinienem:
1. **Zaktualizować wrappery**, aby używały bezpośrednio TypeScript database (już zrobione ✅)
2. **Przekonwertować pozostałe legacy JS pliki** do TypeScript (jeśli potrzebne)
3. **Usunąć wrappery TypeScript** i używać bezpośrednio skonwertowanych plików
4. **Na końcu usunąć legacy JS pliki**, gdy wszystkie będą przekonwertowane

## Następne kroki

1. Sprawdzić użycie legacy plików w routes
2. Sprawdzić użycie w testach
3. Zidentyfikować bezpieczne pliki do usunięcia
4. Utworzyć backup
5. Usunąć bezpieczne pliki



