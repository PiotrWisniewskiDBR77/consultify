# Szablon promptów V2 — po lekcjach z Wave 1

## Changelog vs V1
| Problem z Wave 1 | Poprawka V2 |
|---|---|
| Agent napisał migrację SQLite zamiast PostgreSQL | Dodana sekcja "Kontekst techniczny" z info o DB, adaptQuery, konwencjach SQL |
| Wszyscy edytowali `progress.md` → konflikty merge | Agent NIE edytuje progress.md. Raportuje status, a Ty aktualizujesz centralnie |
| Pre-existing test failures mylą agentów | Jasna instrukcja: "ignoruj pre-existing, liczy się TYLKO twoje pliki" |
| Brak info o numeracji migracji | Instrukcja: sprawdź `server/migrations/` i użyj kolejnego wolnego numeru |
| Konflikty w `translation.json` (3 agenty dodają klucze) | Instrukcja: dodawaj klucze na KOŃCU pliku, w bloku oznaczonym komentarzem bundla |
| Codex dał słabszy raport | Sztywny template raportu z wymaganymi sekcjami |
| Hardcoded wartości w UI | Zasada: dane konfiguracyjne z DB/config, nie hardcode w komponentach |
| Agent dodał nowe analytics events ale nie rozszerzył typu `FunnelEventName` | Instrukcja: jeśli dodajesz nowe eventy analytics, rozszerz `FunnelEventName` w `src/services/funnelAnalytics.ts` |
| Codex nie obsłużył nullable w TypeScript (currentStep possibly null) | Instrukcja: zawsze obsługuj nullable — TypeScript strict mode |

---

## SZABLON — Cursor Agent

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle XX — [NAZWA]** (taski [LISTA]).

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-XX-nazwa

## Krok 2: Implementacja

### [Txxx] — [Nazwa taska]
Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## Txxx")

Kluczowe deliverables:
- [LISTA DELIVERABLES z V2_TASK_SPECS]

Pliki do edycji (istniejące):
- [LISTA PLIKÓW]

## Kontekst techniczny projektu (MUST READ)

### Baza danych
- Projekt używa **PostgreSQL** (pg Pool). NIE SQLite.
- ORM/wrapper: `server/src/database/PostgresDatabase.ts` z funkcją `adaptQuery()`.
- `adaptQuery()` konwertuje `?` → `$1/$2`, `datetime('now')` → `NOW()`, `IFNULL` → `COALESCE`, itp.
- W kodzie serwisów (*.ts) używaj `?` jako placeholderów — adaptQuery zamieni je na `$1/$2`.
- W plikach migracji SQL (`server/migrations/*.sql`) pisz **natywny PostgreSQL** — migracje NIE przechodzą przez adaptQuery.
- Boolean w PostgreSQL: `TRUE`/`FALSE`, nie `1`/`0`.

### Migracje
- Folder: `server/migrations/`
- Numeracja: sprawdź ostatni numer w folderze i użyj kolejnego (aktualnie ostatni to ~552).
- Format nazwy: `NNN_opis.sql`
- Syntax: natywny PostgreSQL (DO $$ ... IF NOT EXISTS, NOW(), BOOLEAN DEFAULT FALSE, itp.)
- NIE używaj SQLite syntax (datetime('now'), ADD COLUMN IF NOT EXISTS na ALTER TABLE).

### i18n
- Pliki: `public/locales/{en,pl}/translation.json`
- Dodawaj nowe klucze NA KOŃCU pliku (przed ostatnim `}`).
- Prefix kluczy nazwą modułu (np. `trial.banner.expired`, `legal.modal.title`).
- Minimum: EN + PL. Reszta języków (de, es, ar, ja) — post-V2.

### UI Standards
- Przeczytaj `docs/ui-standards/README.md` PRZED edycją komponentów.
- N-mode (page-first) jako domyślny. C-mode (action-first) jako opcja.
- Shared components: `src/components/shared/NModeSections/`, `NModeBlocks/`, `NModeLayout/`
- Ikony: `lucide-react` (canonical icon set).

### Analytics events
- Jeśli dodajesz nowe analytics events (np. `upgrade_cta_clicked`), MUSISZ rozszerzyć typ `FunnelEventName` w `src/services/funnelAnalytics.ts`.
- Bez tego TypeScript zgłosi błąd.

### TypeScript strict mode
- Projekt używa strict TypeScript. Zawsze obsługuj nullable (np. `| null`, `| undefined`).
- Jeśli zmienna może być null, dodaj guard (`if (!x) return;`) PRZED użyciem.

### Testy — pre-existing failures
- W repo są pre-existing lint errors i test failures (np. backup files, LLM-related tests).
- **Ignoruj je.** Liczy się TYLKO:
  1. Twoje nowe/zmienione pliki przechodzą `npx tsc --noEmit` bez nowych błędów.
  2. Nie dodajesz nowych ESLint errors.
  3. Jeśli dotykasz billing/auth/policy: `npm run test:protect` — Twoje testy muszą przejść.

## Krok 3: Testy
Po implementacji uruchom:
```bash
npm run verify:quick
```
Jeśli dotyka billing/auth/policy/middleware:
```bash
npm run test:protect
```

## Krok 4: Commit i raport

### Commity
Rób małe logiczne commity po każdym kroku. Format: `bundle-XX: [opis]`

### Raport końcowy (WYMAGANY FORMAT)
Po zakończeniu pracy napisz raport w DOKŁADNIE tym formacie:

---
**Bundle:** XX — [Nazwa]
**Branch:** bundle-XX-nazwa
**Status:** in_review

**Pliki zmienione/dodane:**
| Plik | Typ zmiany | Opis |
|------|-----------|------|
| path/to/file.ts | modified | co zmienione |
| path/to/new.ts | new | co dodane |

**Migracje DB:** tak/nie (jeśli tak: numer i nazwa)

**Manual QA (do sprawdzenia):**
- [ ] punkt 1
- [ ] punkt 2
- [ ] ...

**Testy:**
- verify:quick: PASS/FAIL (jeśli FAIL — czy to pre-existing?)
- test:protect: PASS/FAIL/N/A
- type-check na moich plikach: PASS/FAIL

**Ryzyka / otwarte pytania:**
- ...

**Konflikty z innymi bundlami:** tak/nie (jeśli tak — jakie pliki)
---

## Zasady (MUST)
- NIGDY nie rób `git reset --hard` ani `git clean -fd`
- Brak stubów/placeholderów w produkcji
- i18n: EN + PL minimum
- Nie dotykaj plików spoza scope
- UI zgodne z `docs/ui-standards/README.md`
- Dane konfiguracyjne (plany, limity, ceny) z DB/config — NIE hardcode w komponentach
- **NIE edytuj** `docs/plans/v2-delivery/progress.md` — raportuj status, a owner zaktualizuje centralnie
```

---

## SZABLON — Codex

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle XX — [NAZWA]** (taski [LISTA]).

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-XX-nazwa

## Krok 2: Implementacja

### [Txxx] — [Nazwa taska]
Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## Txxx")

Kluczowe deliverables:
- [LISTA DELIVERABLES z V2_TASK_SPECS]

Pliki do edycji (istniejące):
- [LISTA PLIKÓW]

## Kontekst techniczny projektu (MUST READ)

### Baza danych
- Projekt używa **PostgreSQL** (pg Pool). NIE SQLite.
- ORM/wrapper: `server/src/database/PostgresDatabase.ts` z funkcją `adaptQuery()`.
- `adaptQuery()` konwertuje `?` → `$1/$2`, `datetime('now')` → `NOW()`, `IFNULL` → `COALESCE`.
- W kodzie serwisów (*.ts) używaj `?` jako placeholderów — adaptQuery zamieni je.
- W plikach migracji SQL (`server/migrations/*.sql`) pisz **natywny PostgreSQL**.
- Boolean w PostgreSQL: `TRUE`/`FALSE`, nie `1`/`0`.

### Migracje
- Folder: `server/migrations/`
- Sprawdź ostatni numer i użyj kolejnego (aktualnie ~552).
- Format: `NNN_opis.sql`, natywny PostgreSQL.

### i18n
- Pliki: `public/locales/{en,pl}/translation.json`
- Dodawaj klucze NA KOŃCU pliku. Prefix: nazwa modułu.
- Minimum: EN + PL.

### UI Standards
- Przeczytaj `docs/ui-standards/README.md` PRZED edycją UI.
- N-mode (page-first) domyślny. Ikony: `lucide-react`.

### Analytics events
- Jeśli dodajesz nowe analytics events, rozszerz typ `FunnelEventName` w `src/services/funnelAnalytics.ts`.

### TypeScript strict mode
- Zawsze obsługuj nullable (`| null`, `| undefined`). Dodaj guard przed użyciem.

### Testy — pre-existing failures
- W repo są pre-existing lint/test failures. **Ignoruj je.**
- Liczy się: Twoje pliki przechodzą type-check, brak nowych ESLint errors.

## Krok 3: Testy
```bash
npm run verify:quick
```

## Krok 4: Commit i raport

Rób małe logiczne commity. Format: `bundle-XX: [opis]`

### RAPORT KOŃCOWY (WYMAGANY FORMAT — wypełnij DOKŁADNIE)

```
**Bundle:** XX — [Nazwa]
**Branch:** bundle-XX-nazwa
**Status:** in_review

**Pliki zmienione/dodane:**
| Plik | Typ zmiany | Opis |
|------|-----------|------|
| ... | ... | ... |

**Migracje DB:** tak/nie (numer i nazwa)

**Manual QA:**
- [ ] punkt 1
- [ ] punkt 2

**Testy:**
- verify:quick: PASS/FAIL (pre-existing?)
- type-check moich plików: PASS/FAIL

**Ryzyka / otwarte pytania:**
- ...

**Konflikty z innymi bundlami:** tak/nie
```

## Zasady (MUST)
- NIGDY nie rób `git reset --hard` ani `git clean -fd`
- Brak stubów/placeholderów w produkcji
- i18n: EN + PL minimum
- Nie dotykaj plików spoza scope
- UI zgodne z `docs/ui-standards/README.md`
- **NIE edytuj** `docs/plans/v2-delivery/progress.md`
```

---

## Checklist przed odpaleniem Wave

Przed wygenerowaniem promptów dla nowej wave:

1. [ ] Sprawdź `git branch` — czy poprzednie bundla są merged/cleaned
2. [ ] Sprawdź ostatni numer migracji w `server/migrations/`
3. [ ] Sprawdź czy bundla nie mają overlapping plików (szczególnie `translation.json`, `Gateway.ts`, `AppRoutes.tsx`)
4. [ ] Jeśli bundla dotykają tych samych plików — uruchom je SEKWENCYJNIE, nie równolegle
5. [ ] Wpisz w prompt aktualny numer migracji
6. [ ] Wpisz w prompt konkretne pliki do edycji (po sprawdzeniu w repo)
