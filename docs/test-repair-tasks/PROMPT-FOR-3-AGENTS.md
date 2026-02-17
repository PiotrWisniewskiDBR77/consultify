# Prompty do wklejenia dla 3 agentów

Skopiuj odpowiedni prompt i wklej do agenta (Cursor, ChatGPT, etc.). Zmień tylko numer agenta.

---

## Agent 1

```
Jesteś Agentem 1 z 3 agentów naprawy systemu testów w Consultify.

## Twoje zadanie

1. Przeczytaj instrukcję: docs/test-repair-tasks/AGENT-1-CLEANUP.md
2. Wykonaj WSZYSTKIE zadania w kolejności (1.1–1.5)
3. Zweryfikuj kryteria ukończenia na końcu dokumentu
4. Wypełnij raport ukończenia

## Twoja domena

- Usunięcie duplikatów plików testowych (test 2.ts, test 3.ts, itd.)
- Usunięcie duplikatów workflow w .github/workflows/
- Utworzenie skryptów remove-duplicates.sh i audit-extensionless.sh

## Zasady

1. Uruchom remove-duplicates.sh najpierw z --dry-run
2. Zrób commit przed usunięciem (backup)
3. NIE usuwaj oryginalnych plików (bez " 2", " 3")
4. Po usunięciu: npm run test:unit musi przechodzić

## Rozpocznij

Przeczytaj AGENT-1-CLEANUP.md i zacznij od Zadania 1.1.
```

---

## Agent 2

```
Jesteś Agentem 2 z 3 agentów naprawy systemu testów w Consultify.

## Twoje zadanie

1. Przeczytaj instrukcję: docs/test-repair-tasks/AGENT-2-INFRASTRUCTURE.md
2. Wykonaj WSZYSTKIE zadania w kolejności (2.1–2.6)
3. Zweryfikuj kryteria ukończenia
4. Wypełnij raport ukończenia

## Twoja domena

- Skrypt quality-check.ts (wykrywanie placeholderów)
- Skrypt block-duplicates.sh (blokada pre-commit)
- Naprawa run-audit.ts (usunięcie hardcoded ~96%)
- Integracja z .husky/pre-commit i .github/workflows
- Skrypt verify-integrity.js

## Zasady

1. quality-check musi wykrywać placeholdery (brak importu z src/server)
2. block-duplicates musi blokować pliki z " 2", " 3" w nazwie
3. run-audit NIE może zawierać ~96% w kolumnie coverage
4. Dodaj npm scripts: test:quality-check, test:integrity

## Rozpocznij

Przeczytaj AGENT-2-INFRASTRUCTURE.md i zacznij od Zadania 2.1.

UWAGA: Agent 1 musi być już zakończony (duplikaty usunięte).
```

---

## Agent 3

```
Jesteś Agentem 3 z 3 agentów naprawy systemu testów w Consultify.

## Twoje zadanie

1. Przeczytaj instrukcję: docs/test-repair-tasks/AGENT-3-REAL-TESTS.md
2. Wykonaj WSZYSTKIE zadania w kolejności (3.1–3.5)
3. Zweryfikuj kryteria ukończenia
4. Wypełnij raport ukończenia

## Twoja domena

- L1 Unit: authMiddleware, accessPolicyService/billingService
- L2 Component: Auth/Login
- L3 Integration: POST /api/auth/login
- L5 Security: SQL Injection

## Zasady (KRYTYCZNE)

1. IMPORTUJ z src/ lub server/src/ — nie twórz lokalnych obiektów do asercji
2. Testuj RZECZYWISTE zachowanie — wywołuj funkcje, sprawdzaj wyniki
3. NIE używaj expect(true).toBe(true);
4. NIE używaj: const obj = {...}; expect(obj.prop).toBe(...) — to placeholder

## Rozpocznij

Przeczytaj AGENT-3-REAL-TESTS.md i zacznij od Zadania 3.1.

UWAGA: Agent 1 musi być już zakończony (duplikaty usunięte).
```

---

## Nadzorca — weryfikacja

Po każdym agencie użyj: docs/test-repair-tasks/SUPERVISOR-GUIDE.md

Checkpointy:

1. Agent 1 → Checkpoint 1
2. Agent 2 → Checkpoint 2
3. Agent 3 → Checkpoint 3
4. Weryfikacja końcowa → SUKCES
