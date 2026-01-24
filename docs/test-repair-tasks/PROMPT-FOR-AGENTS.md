# 📋 Prompt do Wklejenia dla Agentów

Skopiuj poniższy prompt i wklej go do każdego agenta. Zmień tylko `[X]` na numer agenta (1-5).

---

## 🔄 PROMPT DO SKOPIOWANIA

```
Jesteś Agentem nr [X] z 5 agentów odpowiedzialnych za naprawę testów w Consultinity.

## Twoje Zadanie

1. Przeczytaj instrukcję główną: `docs/test-repair-tasks/AGENT-INSTRUCTIONS.md`
2. Przeczytaj swój plik zadań: `docs/test-repair-tasks/AGENT-[X]-*.md`
3. Systematycznie napraw wszystkie testy z listy w swoim pliku

## Twoja Domena (Agent [X])

- Agent 1: Auth & Security (42 pliki) - `AGENT-1-AUTH-SECURITY.md`
- Agent 2: Backend & API (63 pliki) - `AGENT-2-BACKEND-API.md`
- Agent 3: Integration Tests (80+ plików) - `AGENT-3-INTEGRATION.md`
- Agent 4: Unit & Components (80+ plików) - `AGENT-4-UNIT-COMPONENTS.md`
- Agent 5: TypeScript Errors (766 błędów w 39 plikach) - `AGENT-5-TYPESCRIPT-CRITICAL.md`

## Zasady

1. Używaj prawdziwej bazy danych SQLite, nie mocków
2. Testuj rzeczywiste zachowanie, nie `expect(true).toBe(true)`
3. Czyść dane po testach (afterAll)
4. NIE twórz duplikatów plików
5. NIE używaj `any` jako rozwiązania TypeScript

## Rozpocznij

Przeczytaj oba dokumenty i zacznij naprawiać testy od pierwszego pliku na liście.
Po każdej naprawie uruchom: `npm run test -- [ścieżka-do-pliku]`

Działaj systematycznie i raportuj postęp.
```

---

## 📝 Przykłady Użycia

### Dla Agenta 1 (Auth & Security)

```
Jesteś Agentem nr 1 z 5 agentów odpowiedzialnych za naprawę testów w Consultinity.

## Twoje Zadanie

1. Przeczytaj instrukcję główną: `docs/test-repair-tasks/AGENT-INSTRUCTIONS.md`
2. Przeczytaj swój plik zadań: `docs/test-repair-tasks/AGENT-1-AUTH-SECURITY.md`
3. Systematycznie napraw wszystkie testy z listy w swoim pliku

## Twoja Domena (Agent 1)

- Agent 1: Auth & Security (42 pliki) - `AGENT-1-AUTH-SECURITY.md` ← TO TY

## Zasady

1. Używaj prawdziwej bazy danych SQLite, nie mocków
2. Testuj rzeczywiste zachowanie, nie `expect(true).toBe(true)`
3. Czyść dane po testach (afterAll)
4. NIE twórz duplikatów plików
5. NIE używaj `any` jako rozwiązania TypeScript

## Dodatkowe dla Agenta 1

NAJPIERW usuń duplikaty plików w tests/auth/ i tests/security/ (pliki z " 2" w nazwie).

## Rozpocznij

Przeczytaj oba dokumenty i zacznij naprawiać testy od pierwszego pliku na liście.
Po każdej naprawie uruchom: `npm run test -- [ścieżka-do-pliku]`

Działaj systematycznie i raportuj postęp.
```

### Dla Agenta 2 (Backend & API)

```
Jesteś Agentem nr 2 z 5 agentów odpowiedzialnych za naprawę testów w Consultinity.

## Twoje Zadanie

1. Przeczytaj instrukcję główną: `docs/test-repair-tasks/AGENT-INSTRUCTIONS.md`
2. Przeczytaj swój plik zadań: `docs/test-repair-tasks/AGENT-2-BACKEND-API.md`
3. Systematycznie napraw wszystkie testy z listy w swoim pliku

## Twoja Domena (Agent 2)

- Agent 2: Backend & API (63 pliki) - `AGENT-2-BACKEND-API.md` ← TO TY

## Zasady

1. Używaj prawdziwej bazy danych SQLite, nie mocków
2. Testuj rzeczywiste zachowanie, nie `expect(true).toBe(true)`
3. Czyść dane po testach (afterAll)
4. NIE twórz duplikatów plików
5. NIE używaj `any` jako rozwiązania TypeScript

## Rozpocznij

Przeczytaj oba dokumenty i zacznij naprawiać testy od pierwszego pliku na liście.
Po każdej naprawie uruchom: `npm run test -- [ścieżka-do-pliku]`

Działaj systematycznie i raportuj postęp.
```

### Dla Agenta 3 (Integration)

```
Jesteś Agentem nr 3 z 5 agentów odpowiedzialnych za naprawę testów w Consultinity.

## Twoje Zadanie

1. Przeczytaj instrukcję główną: `docs/test-repair-tasks/AGENT-INSTRUCTIONS.md`
2. Przeczytaj swój plik zadań: `docs/test-repair-tasks/AGENT-3-INTEGRATION.md`
3. Systematycznie napraw wszystkie testy z listy w swoim pliku

## Twoja Domena (Agent 3)

- Agent 3: Integration Tests (80+ plików) - `AGENT-3-INTEGRATION.md` ← TO TY

## Zasady

1. Używaj prawdziwej bazy danych SQLite, nie mocków
2. Testuj rzeczywiste zachowanie, nie `expect(true).toBe(true)`
3. Czyść dane po testach (afterAll)
4. NIE twórz duplikatów plików
5. NIE używaj `any` jako rozwiązania TypeScript

## Rozpocznij

Przeczytaj oba dokumenty i zacznij naprawiać testy od pierwszego pliku na liście.
Po każdej naprawie uruchom: `npm run test -- [ścieżka-do-pliku]`

Działaj systematycznie i raportuj postęp.
```

### Dla Agenta 4 (Unit & Components)

```
Jesteś Agentem nr 4 z 5 agentów odpowiedzialnych za naprawę testów w Consultinity.

## Twoje Zadanie

1. Przeczytaj instrukcję główną: `docs/test-repair-tasks/AGENT-INSTRUCTIONS.md`
2. Przeczytaj swój plik zadań: `docs/test-repair-tasks/AGENT-4-UNIT-COMPONENTS.md`
3. Systematycznie napraw wszystkie testy z listy w swoim pliku

## Twoja Domena (Agent 4)

- Agent 4: Unit & Components (80+ plików) - `AGENT-4-UNIT-COMPONENTS.md` ← TO TY

## Zasady

1. Używaj prawdziwej bazy danych SQLite, nie mocków
2. Testuj rzeczywiste zachowanie, nie `expect(true).toBe(true)`
3. Czyść dane po testach (afterAll)
4. NIE twórz duplikatów plików
5. NIE używaj `any` jako rozwiązania TypeScript

## Rozpocznij

Przeczytaj oba dokumenty i zacznij naprawiać testy od pierwszego pliku na liście.
Po każdej naprawie uruchom: `npm run test -- [ścieżka-do-pliku]`

Działaj systematycznie i raportuj postęp.
```

### Dla Agenta 5 (TypeScript)

```
Jesteś Agentem nr 5 z 5 agentów odpowiedzialnych za naprawę testów w Consultinity.

## Twoje Zadanie

1. Przeczytaj instrukcję główną: `docs/test-repair-tasks/AGENT-INSTRUCTIONS.md`
2. Przeczytaj swój plik zadań: `docs/test-repair-tasks/AGENT-5-TYPESCRIPT-CRITICAL.md`
3. Systematycznie napraw wszystkie błędy TypeScript z listy w swoim pliku

## Twoja Domena (Agent 5)

- Agent 5: TypeScript Errors (766 błędów w 39 plikach) - `AGENT-5-TYPESCRIPT-CRITICAL.md` ← TO TY

## Zasady

1. NIE używaj `any` jako rozwiązania
2. Twórz interfejsy dla typów z bazy danych
3. Używaj asercji typów `as Type` gdy konieczne
4. Dodawaj `<void>` do Promise bez wartości zwracanej
5. NIE twórz duplikatów plików

## Weryfikacja

Po każdej naprawie uruchom: `npm run type-check`
Na końcu: `npm run build`

## Rozpocznij

Przeczytaj oba dokumenty i zacznij naprawiać błędy od pierwszego pliku na liście.
Działaj systematycznie i raportuj postęp.
```

---

## 📊 Podział Pracy

| Agent   | Plików          | Szac. Czas | Priorytet    |
| ------- | --------------- | ---------- | ------------ |
| Agent 1 | 42              | 2-3h       | 🔴 Krytyczny |
| Agent 2 | 63              | 3-4h       | 🔴 Krytyczny |
| Agent 3 | 80+             | 4-5h       | 🟠 Wysoki    |
| Agent 4 | 80+             | 4-5h       | 🟡 Średni    |
| Agent 5 | 39 (766 błędów) | 3-4h       | 🔴 Krytyczny |

**Razem:** ~317 plików/zadań do naprawy
