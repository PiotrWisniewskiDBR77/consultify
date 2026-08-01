---
doc_id: ssot-repository-structure
truth_type: runtime-current
status: canonical
owner: engineering
last_reviewed: 2026-07-30
---

# Struktura repozytorium

## Katalogi wykonawcze

| Katalog | Odpowiedzialność |
| --- | --- |
| `src/` | główny frontend React/TypeScript |
| `server/src/` | backend, trasy, usługi, middleware i zadania |
| `packages/` | współdzielone pakiety i kontrakty |
| `apps/` | dodatkowe aplikacje/workspace’y |
| `tests/`, `e2e/` | testy jednostkowe, komponentowe, integracyjne i E2E |
| `scripts/` | migracje, kontrole, QA, operacje i narzędzia repo |
| `server/migrations/` | produkcyjne migracje danych |
| `config/`, `infrastructure/` | konfiguracja i infrastruktura |
| `public/`, `assets/` | zasoby aplikacji |

## Wiedza i dowody

| Katalog | Klasa informacji |
| --- | --- |
| `docs/ssot/` | mapa źródeł prawdy i bramki kompletności |
| `docs/program/` | opis całego programu |
| `docs/modules/`, `docs/functional/` | kontrakty funkcjonalne |
| `docs/product/` | decyzje i standardy produktowe |
| `docs/ui-standards/` | kanon UI/UX |
| `docs/architecture/`, `docs/database/` | materiały techniczne; aktualność trzeba potwierdzać kodem |
| `docs/operations/`, `docs/security-compliance/` | runbooki i governance |
| `Harvard/` | aktywne i historyczne materiały programu wdrożeniowego |
| `rejestr/` | zadania, decyzje i odbiory |
| `evidence/`, `wdrozenia/` | dowody i historia wykonania |
| `_quarantine/` | odzyskiwalna kwarantanna, nie źródło prawdy |

## Katalogi generowane i lokalne

`node_modules/`, `out/`, `tmp/`, `reports/`, `screenshots/`, `test-screenshots/`,
`uploads/` i pliki wyników testów mogą zawierać artefakty generowane lub
historycznie śledzone. Nie są automatycznie źródłem produktu. Ich usunięcie lub
wycofanie z Git wymaga osobnej, zatwierdzonej migracji, ponieważ część jest już
elementem historii repozytorium.

## Zasada profesjonalnego porządku

- nowy kod trafia do katalogu właścicielskiego, nie do root;
- nowy kanon aktualizuje istniejący kontrakt;
- raport datowany trafia do evidence/reports, nie konkuruje z kanonem;
- plik tymczasowy nie jest commitowany;
- sekret nigdy nie trafia do Git; w repo mogą znajdować się wyłącznie
  bezpieczne szablony `.env*.example`.
