# K5 — demo sandbox TTL, Wpis 73

Werdykt przed niezależnym przeglądem: READY FOR REVIEW.

## Zakres

- TTL 24 h dla organizacji `*-demo-session-*`.
- `ENABLE_DEMO_SANDBOX_TTL` jest domyślnie włączone; jawne `false` zatrzymuje usuwanie.
- Limit jest twardo ograniczony do 3 organizacji na przebieg, także gdy konfiguracja żąda więcej.
- Whitelist, typ `DEMO`, stan rozliczeń i brak realnego użytkownika są sprawdzane przed `LIMIT`.
- Purger obejmuje 49 tabel zależnych z planu CTO i usuwa dzieci przed rodzicami.
- Brak migracji i brak zmian UI.

## Dowody

- Real PostgreSQL `127.0.0.1:6454/consultinity`, kontener `cx-d-k5-w73-pg`, `MOCK_DB=false`.
- `tests/acceptance/demoCleanup.e2e.test.ts --retry=0`: 3/3 PASS. Stary sandbox usunięty; świeży, whitelisted i z realnym człowiekiem zachowane; limit 3 udowodniony; OFF udowodnione.
- Audyt planu: 49 tabel zależnych + `organizations`; zero pozostałości fixture. Disposable schema nie materializuje 5 tabel planu: `organization_context_claims`, `organization_context_items`, `organization_context_snapshots`, `project_kpis`, `assessment_report_sections`; ich brak został jawnie wypisany przez test.
- Server TypeScript: RC 0.
- Front TypeScript: RC 2, dokładnie 177 błędów, 7424 listFiles; próg W73 zachowany.
- `check:jezyk:ci`: PASS; K4en -68, K7 -1 względem baseline.
- `check:list-canon`: 349, bez wzrostu.
- `check:artefakt`: 8-0-117, bez wzrostu.
- Build produkcyjny: RC 0.
- Nowe `as any`: 0.

## Ryzyko

Test wykonuje realną operację wyłącznie na lokalnej bazie disposable. Nie uruchamiano cleanupu na stagingu, demo ani żadnym środowisku chronionym.
