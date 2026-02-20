# Agent handoff — Consultify V2 (dla nowego czatu)

Ten dokument ma umożliwić nowemu czatowi/agentowi prowadzenie Piotra “za rękę” bez utraty kontekstu.

## 1) Co to za projekt
Consultify (repo: `consultify/`) to B2B SaaS wspierające transformację (assessment → initiatives → execution → reports), z silnym komponentem AI (chat, research, governance).

**Cel V2:** stan “ready to show the world” — finalne, dobre rozwiązania (nie używamy języka “MVP”; rzeczy poza V2 nazywamy **post‑V2**).

**Priorytet V2:** monetization / trial→paid conversion (kategoria B) > “demo wow”.

## 2) Kanoniczne dokumenty (SSOT)
- Specy tasków T001–T122 (SSOT):
  - `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md`
  - `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.txt`
- Manual QA checklist: `docs/test-quality/V2_MANUAL_QA_CHECKLIST_122_TASKS.md`
- UI/UX standards (MUST): `docs/ui-standards/README.md`
- Delivery plan (bundles/workflow/progress): `docs/plans/v2-delivery/*`

## 3) Kluczowe zasady produktu i UX (must)
- Cała aplikacja ma być **enterprise-grade** i “Tech Sexy”.
- Wszędzie, gdzie to możliwe: **N‑mode (page-first)**; a **C‑mode** jako opcjonalny action-first view (ClickUp-like).
- i18n: aplikacja wspiera 6 języków: `en, pl, de, es, ar, ja` (dla `ar` ważne RTL tam gdzie dotyczy).
- Brak placeholderów / stubów w produkcji — jeśli coś wyłączone, to jawnie z reason.

## 4) Safety / “nie wywalamy appki”
- Pracujemy paczkami na branchach (WIP=3: 1 Codex + 2 Cursor).
- Merge gate: minimum `npm run verify:quick`, a dla krytycznych zmian `npm run test:protect` i/lub `npm run test:e2e:smoke`.
- Nie używamy destrukcyjnych komend (git clean -fd, reset --hard) bez jawnej zgody i backupu.

## 5) Jak prowadzić Piotra (styl pracy)
- Piotr chce kontroli i jasnego statusu: “czy idzie zgodnie z planem i czy nie ma bałaganu”.
- Każda paczka: jasny scope, lista plików dotykanych, test plan, manual QA bullets.
- Duże tematy wymagające uwagi Piotra planujemy na weekend (finance, reports/presentations, final UI/UX).

## 6) Plan implementacji
- Mapa 30 paczek: `docs/plans/v2-delivery/30-bundles-plan.md`
- Dashboard postępu: `docs/plans/v2-delivery/progress.md`

## 7) Codex packet (template do delegowania)
Wklej do Codex zawsze to:
- **Bundle ID + taski Txxx**
- **Scope (V2) — IN/OUT + DoD** (z `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md`)
- **Manual QA** (4–6 punktów per Txxx)
- **Pliki/obszary do edycji** (lista ścieżek)
- **Testy do przejścia** (np. `npm run verify:quick`, `npm run test:e2e:smoke`)
- **Zakazy**: brak stubów, brak nowych UI standardów, i18n must.

## 8) Kontekst techniczny (komendy i testy)
Najważniejsze script-y (z `package.json`):
- dev: `npm run dev`
- quick verify: `npm run verify:quick`
- critical security gate: `npm run test:protect`
- smoke e2e: `npm run test:e2e:smoke`

## 9) Uwaga o repo stanie
Branch roboczy podczas przygotowania planu: `Londyn`.
Repo ma dużo zmian w working tree — **przed startem paczek** warto zrobić “checkpoint” commit albo stash (bez kasowania plików).

