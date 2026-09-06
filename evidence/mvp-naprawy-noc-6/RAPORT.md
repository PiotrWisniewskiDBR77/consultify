# Raport — mvp/naprawy-noc-6 (06.09.2026)

Gałąź: `mvp/naprawy-noc-6`, base `codex/m03-admin-20260824` (6fa7db5ed1).
HEAD: `49f6f303ea`. 5 commitów, zero push, worktree `/private/tmp/wt-fix6`.
Weryfikacja żywa: własny vite `:3096` + backend NOC `127.0.0.1:4100`, sesja
`audyt@dbr77.local`, zrzuty w tym katalogu.

## 1. BLOKER — "Resultaty"→"Wyniki" (834e5d3820)
- Plik: `public/locales/pl/translation.json` (`sidebar.results`,
  `agentPlan.canvas.moduleTag.results`), `src/components/navigation/Sidebar/menuConfig.ts`,
  `src/hooks/useBreadcrumbs.ts`, `src/routes/AppRoutes.tsx`.
- Test: `tests/unit/i18n/results-module-naming.test.ts` (3/3 PASS) — mutacja:
  przywrócenie "Resultaty" → czerwony.
- Zrzut: nie zrobiony osobno (defekt czysto tekstowy, pokryty testem +
  literalną zmianą wartości klucza używanego w 19 miejscach `AppRoutes.tsx`).
- `AgentPlanCanvas.tsx` (13_CHAT) świadomie NIE dotknięty — poza zakresem
  BLOKERA i poza listą modułów z DEC-397.

## 2. BLOKER — OKR Check-iny surowy enum (6e75982d3b)
- Plik: `src/components/ResultsVNext/okr/OkrObjectiveCardPage.tsx:815-820`.
- Naprawa: `okrCheckInStatusLabel()` + `OKR_CHECKIN_STATUS_TONE` (mapper już
  istniejący, użyty w L2 — `okrCheckInPresenters.tsx:76`).
- Test: `okrObjectiveCardPage.checkinStatusLabel.test.ts` (4/4 PASS) — mutacja
  źródłowa (przywrócenie `label={entry.ownerDeclaredStatus}`) → czerwony.
- Nie dotyczy Wyniki/OKR — moduł niezamrożony, brak markera potrzebny.

## 3. WAŻNY — Finanse "AKTUALIZACJA" ucięte (ce2aef57dd)
- Plik: `src/components/Economics/FinanceHub.tsx` (`currency`,
  `sourceStatementCount` w zakładce statements → `dataType:'number'`).
- Przyczyna zmierzona żywo (nie zgadnięta): 8 kolumn na 1440px, `columnFit`
  schodzi do podłóg; 'currency'/'sourceStatementCount' bez `dataType` miały
  domyślną podłogę 'text'=140px zamiast realnie potrzebnych ~90px — kradły
  budżet kolumnie "Aktualizacja" (140px, ucięte "AKTU…").
- Zrzut PRZED/PO: `finance-statements-przed.png` (140px, ucięte) /
  `finance-statements-po.png` (168px, pełny nagłówek + strzałka sortu) +
  `finance-statements-po__dark.png`. 0 błędów konsoli.
- Rodzeństwo zmierzone żywo: Analiza 180px, Predykcja/Wycena 189px — OK, bez
  zmian. Modele — pusty stan lokalnie (0 rekordów), tabela się nie renderuje.
- Test: `tests/unit/ui/financeStatementsColumnBudget.test.ts` (3/3 PASS).
  Regresja: `FinanceHub.statementsPreview.canon.test.tsx` 10/10 PASS.

## 4. WAŻNY — "PL · Silesia" w danych Organizacji (259700201e)
- Skrypt: `server/scripts/napraw-region-silesia.ts` (`--dry-run|--apply
  [--org=<id>]`), idempotentny.
- Zastosowano LOKALNIE: dry-run (1 wiersz) → apply → dry-run (0 wierszy).
  Zrzut PO: `organizacja-po.png` (/organization → Tożsamość → Skala → Kraj
  siedziby = "PL · Śląskie").
- **Staging: NIE zastosowano** — worktree było podpięte pod inny projekt
  Railway (`dbr77-leads`, nie Consultify); przełączenie linku bez nadzoru
  sesji głównej uznałem za zbyt ryzykowne w dostępnym czasie. Komenda gotowa
  dla nadzorcy: `DATABASE_URL=<staging DATABASE_PUBLIC_URL> npx tsx
  server/scripts/napraw-region-silesia.ts --dry-run` (potem `--apply`), org
  właściciela `a3e05d4a-5397-419d-b486-8e44366c0063`.
- Test: `tests/unit/scripts/napraw-region-silesia.test.ts` (5/5 PASS,
  strażnik kontraktu — wymaga jawnego trybu, zapis tylko pod `--apply`).

## 5. WAŻNY — Ustawienia → Szablony po angielsku (49f6f303ea)
- Przyczyna: mechanizm humanizacji już istniał (`SettingsTemplates.tsx`
  `getTemplateLabel()`), ale słownik i18n miał klucze z INNEGO,
  nieaktualnego zestawu szablonów (`security_focused`/`productivity`/
  `ai_power_user`) — żaden nie pasował do 4 REALNYCH id z
  `settings.routes.ts` ('minimal'/'power-user'/'privacy-focused'/'enterprise').
- Naprawa: dodano 4 brakujące klucze `settings.templates.system.{minimal,
  power_user, privacy_focused, enterprise}.{name,description}` w PL+EN.
- Zrzut PO: `settings-templates-po.png` (`/settings/templates`, 1440px,
  wszystkie 4 karty PL, 0 błędów konsoli).
- Test: `tests/unit/i18n/settings-templates-system-labels.test.ts` (5/5
  PASS). Regresja: `settings-required-keys.test.ts` 2/2 PASS.

## Kosmetyka (punkt 6)
Nie zrobione — brak czasu w budżecie 90 min po 5 pozycjach głównych.

## Domknięcie
- `esbuild` per dotknięty plik: OK (FinanceHub.tsx, OkrObjectiveCardPage.tsx,
  napraw-region-silesia.ts) — zero błędów.
- `vitest` ścieżkowo: `tests/unit/i18n` + `src/components/ResultsVNext/okr` +
  nowe pliki testowe — WSZYSTKIE ZIELONE poza 2 PRE-ISTNIEJĄCYMI failami w
  `tests/unit/i18n/idea-workspace-required-keys.test.ts` (moduł MyWork/Idea
  Table, niedotknięty tą sesją — zweryfikowane `git diff` względem bazy
  `codex/m03-admin-20260824`: 0 różnic na plikach, których dotyczy ten test).
- `scripts/check-list-canon.sh`: OK (dług spadł 364→361, brak nowych
  naruszeń).
- `scripts/check-artefakt.sh`: OK (8/8, bez zmian).
- Serwer: brak zmian w routes/serwisach (tylko nowy skrypt jednorazowy) —
  pełny `tsc` serwera pominięty zgodnie z zakazem robotnika; `napraw-region-
  silesia.ts` uruchomiony i przetestowany REALNIE (`npx tsx`) na żywej bazie
  lokalnej, zero błędów.
- Migracje: 0 zmodyfikowanych.
- `git status --short`: czysto (wszystko scommitowane, zero push).
