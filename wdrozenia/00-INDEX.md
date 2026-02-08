# 📚 Wdrożenia (source of truth)

## O tym katalogu
`wdrozenia/` to **robocze źródło prawdy** dla rozwoju Consultify „moduł po module”.

- **Kod jest prawdą**: dokumentacja ma wskazywać *co jest*, *czego brakuje*, *jak dowieźć* (z dowodami w kodzie).
- **Bez „ładnej” warstwy**: dopóki pracujemy, wszystko trafia tutaj. Po stabilizacji przeniesiemy „wypolerowaną” wersję do `docs/`.

## Najważniejsze linki
- **Tracker postępu**: `wdrozenia/01-PROGRESS-TRACKER.md`
- **Master plan (E2E)**: `wdrozenia/plan-rollout-master.md`
- **Pakiet wdrożeniowy**: `wdrozenia/pakiet-wdrozeniowy.md`
- **Plan implementacji workflow (E2E)**: `wdrozenia/plan-workflow-implementation.md`
- **Prompty dla agentów**: `wdrozenia/PROMPTY_DLA_AGENTOW.md`
- **Golden Standard UI/UX**: `wdrozenia/UI_UX_GOLDEN_STANDARD.md`

## Struktura dokumentacji (kanoniczna)
- **Standardy globalne**: `wdrozenia/standards/`
- **Standardy encji (Task/Decision/Report/...)**: `wdrozenia/standards/entities/`
- **Szablony (audyt, moduł, widok, API)**: `wdrozenia/templates/`
- **Dokumentacja komponentów shared**: `wdrozenia/components/`
- **Dokumentacja modułów**: `wdrozenia/modules/`
- **Workflowy przekrojowe**: `wdrozenia/workflows/`
- **Integracje przekrojowe**: `wdrozenia/integrations/`

## Nowe kanoniczne standardy (artefakty Discovery)
- **Tool Report (Tools)**: `wdrozenia/standards/entities/04-TOOL-REPORT.md`
- **Assessment Report**: `wdrozenia/standards/entities/05-ASSESSMENT-REPORT.md`

## Kanon ról i delegacji (workflow)
- **Jedno rozumienie ról + delegacje**: `wdrozenia/workflows/01-ROLES-AND-ASSUMPTIONS.md`

## Konwencje
### Statusy w dokumentacji
- ✅ zrobione / wdrożone
- 🟡 częściowo
- ⬜ do zrobienia
- ❌ brak / blokada

### „Zasada bez mocków”
W produkcyjnym UI **nie używamy mock/demo/sample fallbacków**. Jeśli API nie działa → UI pokazuje **loading/error/empty** i daje **retry**.

## Jak pracować „moduł po module”
1. Otwórz `wdrozenia/01-PROGRESS-TRACKER.md` i wybierz moduł.
2. Pracuj w `wdrozenia/modules/<module>/` (UI/API/Dane/Testy/Ryzyka).
3. Po zmianach: zrób **audyt zgodności** (szablon w `wdrozenia/templates/`).
4. Zaktualizuj tracker: status + data + wpis w logu zmian.

