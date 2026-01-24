# 📋 ZAKTUALIZOWANE INSTRUKCJE DLA AGENTÓW

## Audyt: 8 Stycznia 2026

---

# 🚨 KRYTYCZNE USTALENIA Z AUDYTU

| Problem              | Ilość          | Status        |
| -------------------- | -------------- | ------------- |
| **Duplikaty plików** | 253            | 🔴 KRYTYCZNE  |
| **Błędy TypeScript** | 779            | 🔴 KRYTYCZNE  |
| **Failujące testy**  | 53 (14 plików) | 🟠 PILNE      |
| **Testy skip**       | 26             | 🟡 DO NAPRAWY |
| **Testy todo**       | 8              | 🟡 DO NAPRAWY |
| **Fałszywe asercje** | 2              | 🟢 NISKIE     |

---

# 🔄 NOWY PODZIAŁ ZADAŃ

## Agent 0: CLEANUP (NOWY - URUCHOM PIERWSZY!)

**Zadanie:** Usuń 253 duplikaty plików przed pracą innych agentów.

```bash
# Uruchom to polecenie:
find tests -name "* 2*" -o -name "*test 2*" | xargs rm -f
```

**Lub ręcznie usuń pliki z " 2" w nazwie w katalogach:**

- tests/unit/ (35 duplikatów)
- tests/security/ (10 duplikatów)
- tests/utils/ (7 duplikatów)
- tests/integration/ (7 duplikatów)
- tests/components/ (7 duplikatów)
- i inne...

---

## Agent 1: Auth & Security (42 pliki)

**Plik zadań:** `AGENT-1-AUTH-SECURITY.md`

**UWAGA:** Agent 0 musi najpierw usunąć duplikaty!

**Twoje zadania:**

1. Napraw testy w `tests/auth/`
2. Napraw testy w `tests/security/`
3. Napraw middleware w `tests/unit/backend/middleware/`

---

## Agent 2: Backend Services (63 pliki)

**Plik zadań:** `AGENT-2-BACKEND-API.md`

**Failujące pliki do naprawy W PIERWSZEJ KOLEJNOŚCI:**

```
tests/unit/backend/roleService.test.js
tests/unit/backend/usageTrackingService.test.js
tests/unit/backend/valueRealizationService.test.js
tests/unit/backend/workspaceService.test.js
```

**Twoje zadania:**

1. Napraw 4 failujące pliki powyżej
2. Napraw pozostałe testy z listy

---

## Agent 3: Integration Tests (80+ plików)

**Plik zadań:** `AGENT-3-INTEGRATION.md`

**Twoje zadania:**

1. Napraw testy w `tests/integration/`
2. Napraw testy w `tests/integration/routes/`
3. Usuń `it.skip` i `describe.skip` (26 przypadków)

---

## Agent 4: Components & Hooks (80+ plików)

**Plik zadań:** `AGENT-4-UNIT-COMPONENTS.md`

**Twoje zadania:**

1. Napraw testy w `tests/components/`
2. Napraw testy w `tests/hooks/`
3. Napraw testy w `tests/store/`
4. Zaimplementuj `it.todo` (8 przypadków)

---

## Agent 5: TypeScript Errors (779 błędów)

**Plik zadań:** `AGENT-5-TYPESCRIPT-CRITICAL.md`

**KRYTYCZNE - blokuje build!**

**Twoje zadania:**

1. Napraw 779 błędów TypeScript
2. Sprawdź: `npm run type-check`
3. Cel: `npm run build` przechodzi bez błędów

---

# 📝 PROMPTY DO SKOPIOWANIA

---

## 🧹 PROMPT DLA AGENTA 0 (CLEANUP)

````
Jesteś Agentem 0 - odpowiedzialnym za cleanup przed pracą innych agentów.

## Twoje Zadanie KRYTYCZNE

Usuń 253 duplikaty plików (pliki z " 2" w nazwie) z katalogu tests/.

## Polecenie do wykonania

```bash
find tests -name "* 2*" -delete
find tests -name "*test 2*" -delete
````

## Weryfikacja

Po usunięciu sprawdź:

```bash
find tests -name "* 2*" | wc -l  # Powinno być 0
```

## Zasady

1. Usuń TYLKO pliki z " 2" w nazwie
2. NIE usuwaj oryginalnych plików (bez " 2")
3. Po zakończeniu potwierdź: "Usunięto X duplikatów"

Działaj natychmiast.

```

---

## 🔐 PROMPT DLA AGENTA 1 (Auth & Security)

```

Jesteś Agentem 1 - odpowiedzialnym za testy Auth & Security w Consultinity.

## Twoje Pliki Zadań

1. Przeczytaj: `docs/test-repair-tasks/AGENT-INSTRUCTIONS.md`
2. Przeczytaj: `docs/test-repair-tasks/AGENT-1-AUTH-SECURITY.md`

## Twoja Domena (42 pliki)

- `tests/auth/` - testy OAuth, SSO, MFA
- `tests/security/` - SQL injection, XSS, CSRF
- `tests/unit/backend/middleware/` - middleware bezpieczeństwa

## Zasady

1. Używaj prawdziwej bazy SQLite, nie mocków
2. Testuj rzeczywiste zachowanie
3. Czyść dane po testach (afterAll)
4. NIE twórz duplikatów plików

## Weryfikacja

Po każdym pliku: `npm run test -- [ścieżka]`

Rozpocznij od pierwszego pliku na liście i raportuj postęp.

```

---

## 🖥️ PROMPT DLA AGENTA 2 (Backend)

```

Jesteś Agentem 2 - odpowiedzialnym za testy Backend & API w Consultinity.

## Twoje Pliki Zadań

1. Przeczytaj: `docs/test-repair-tasks/AGENT-INSTRUCTIONS.md`
2. Przeczytaj: `docs/test-repair-tasks/AGENT-2-BACKEND-API.md`

## PILNE - Napraw najpierw failujące testy:

```
tests/unit/backend/roleService.test.js
tests/unit/backend/usageTrackingService.test.js
tests/unit/backend/valueRealizationService.test.js
tests/unit/backend/workspaceService.test.js
```

## Twoja Domena (63 pliki)

- `tests/unit/backend/` - serwisy backendowe
- `tests/unit/backend/utils/` - utilities

## Zasady

1. Używaj prawdziwej bazy SQLite
2. Testuj rzeczywiste zachowanie
3. Czyść dane po testach
4. NIE twórz duplikatów

## Weryfikacja

`npm run test -- tests/unit/backend/`

Zacznij od 4 failujących plików, potem kontynuuj listę.

```

---

## 🔄 PROMPT DLA AGENTA 3 (Integration)

```

Jesteś Agentem 3 - odpowiedzialnym za testy integracyjne w Consultinity.

## Twoje Pliki Zadań

1. Przeczytaj: `docs/test-repair-tasks/AGENT-INSTRUCTIONS.md`
2. Przeczytaj: `docs/test-repair-tasks/AGENT-3-INTEGRATION.md`

## Twoja Domena (80+ plików)

- `tests/integration/` - testy integracyjne
- `tests/integration/routes/` - testy tras API

## Dodatkowe Zadanie

Usuń wszystkie `it.skip` i `describe.skip` (26 przypadków) - albo napraw testy, albo usuń jeśli niepotrzebne.

Znajdź je:

```bash
grep -r "it\.skip\|describe\.skip" tests/
```

## Zasady

1. Używaj request(app) do testowania API
2. Twórz pełne flow testy
3. Testuj error handling (401, 403, 404)

## Weryfikacja

`npm run test -- tests/integration/`

Rozpocznij pracę i raportuj postęp.

```

---

## 🧩 PROMPT DLA AGENTA 4 (Components)

```

Jesteś Agentem 4 - odpowiedzialnym za testy komponentów w Consultinity.

## Twoje Pliki Zadań

1. Przeczytaj: `docs/test-repair-tasks/AGENT-INSTRUCTIONS.md`
2. Przeczytaj: `docs/test-repair-tasks/AGENT-4-UNIT-COMPONENTS.md`

## Twoja Domena (80+ plików)

- `tests/components/` - komponenty React
- `tests/hooks/` - hooki React
- `tests/store/` - Zustand stores

## Dodatkowe Zadanie

Zaimplementuj wszystkie `it.todo` (8 przypadków):

```bash
grep -r "it\.todo" tests/
```

## Zasady

1. Używaj @testing-library/react
2. Używaj userEvent zamiast fireEvent
3. Używaj waitFor dla async
4. Wrap w QueryClientProvider gdy potrzebne

## Weryfikacja

`npm run test -- tests/components/`

Rozpocznij pracę i raportuj postęp.

```

---

## 🚨 PROMPT DLA AGENTA 5 (TypeScript)

```

Jesteś Agentem 5 - odpowiedzialnym za naprawę błędów TypeScript w Consultinity.

## KRYTYCZNE: 779 błędów TypeScript blokuje build!

## Twoje Pliki Zadań

1. Przeczytaj: `docs/test-repair-tasks/AGENT-INSTRUCTIONS.md`
2. Przeczytaj: `docs/test-repair-tasks/AGENT-5-TYPESCRIPT-CRITICAL.md`

## Sprawdź błędy

```bash
npm run type-check
```

## Najczęstsze błędy do naprawy

1. `TS18046` - unknown type → dodaj interface/asercję
2. `TS2307` - cannot find module → napraw import
3. `TS7034` - implicit any[] → dodaj typ
4. `TS2794` - Promise resolve → `Promise<void>`

## Zasady

1. NIE używaj `any` jako rozwiązania
2. Twórz interfejsy dla typów DB
3. Używaj `as Type` gdy konieczne
4. Sprawdzaj istniejące typy w `src/types/`

## Weryfikacja

Po każdej partii napraw:

```bash
npm run type-check 2>&1 | grep -c "error TS"
```

Cel: 0 błędów, `npm run build` przechodzi.

Rozpocznij od plików AI w `server/src/ai/` i raportuj postęp.

```

---

# 📊 KOLEJNOŚĆ URUCHAMIANIA

1. **Agent 0** (CLEANUP) - PIERWSZY! Usuń duplikaty
2. **Agent 5** (TypeScript) - DRUGI! Odblokuj build
3. **Agent 2** (Backend) - napraw failujące testy
4. **Agent 1** (Auth/Security) - napraw testy bezpieczeństwa
5. **Agent 3** (Integration) - napraw integrację
6. **Agent 4** (Components) - napraw komponenty

---

# ✅ CEL KOŃCOWY

| Metryka | Teraz | Cel |
|---------|-------|-----|
| Duplikaty | 253 | 0 |
| Błędy TS | 779 | 0 |
| Failujące testy | 53 | 0 |
| Testy skip | 26 | 0 |
| Testy todo | 8 | 0 |
| `npm run build` | ❌ | ✅ |
| `npm run test` | ❌ | ✅ |
```
