# Zakres dla 2. agenta — czysty, ZERO kolizji z `qa/remediation-2026-06-08`

Mój branch jest na origin, zweryfikowany stabilny (`STABILITY-SIGNOFF.md`). Poniższe pozycje **nie dotykają** moich plików (lista zakazana w `DEDUP-MANIFEST.md`) → drugi agent może brać OD RAZU, równolegle.

## ✅ Wolne do wzięcia teraz (bez kolizji)
1. **Faza 3 — hardening runnera migracji** (root cause driftu). Runner „Table Platform migrations" raportuje „245 applied" mimo braku obiektów, bo połyka błędy (SQLite-izmy typu `TEXT DEFAULT CURRENT_TIMESTAMP` padają na PG). Zadanie: (a) zatrzymuj deploy na błędzie migracji, (b) weryfikuj istnienie obiektów po migracji, (c) wyczyść SQLite-izmy w `server/migrations/*`. **Najważniejsze procesowo** — bez tego drift wróci.
2. **#9 / BE-S2-1 — N+1 w `title/generate`** (164 zapytania / 2.1s). Refaktor zapytań. Plik: serwis generowania tytułu rozmowy (NIE `modelRouter.ts`).
3. **BUG-17 — sidebar @375px** (responsywność mobile). NIE rusza `public/locales/*` ani `BottomNavigation` labeli (i18n już zrobione).
4. **BUG-13** — najpierw LIVE-VERIFY kontem nie-pilotowym (wg kodu to gating pilotażowy `SettingsView.tsx:238-241`, nie bug). Zmiana tylko jeśli realnie się powtórzy.
5. **#21–#24** (jego P3 z MASTER) — o ile nie dotykają moich 8 plików.
6. **Rebuild/przebudowa modułu** (jeśli to osobny obszar: Ideas, EE/Deliverables, Notebook) — zero styku z backendem auth/exec, który ja ruszałem.

## ⛔ NIE pisać (jest u mnie, gotowe — dublowanie = konflikt na wrażliwym auth)
- **#20 / auth fallback** = `auth.middleware.ts` (BUG-02/15) — zacommitowany, czeka na review. Bierzemy mój.
- **#16 mobile i18n** — zrobione (`locales/{en,pl}`).
- **#18 PII gate** — zrobione (`execution-control.routes.ts`).
- BUG-14/21/22 + ModelRouter + OrgContext — zrobione.

## 🔗 Punkt styku = jeden integration branch
Mój branch + jego → jeden integration branch → review (szczególnie #20) → deploy. FF-czysto od `Londyn`, więc merge bez bólu.
