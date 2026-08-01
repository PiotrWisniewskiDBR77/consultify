---
doc_id: ssot-technical-architecture
truth_type: runtime-current
status: canonical
owner: engineering
last_reviewed: 2026-07-30
---

# Techniczna mapa prawdy

## Frontend

- stos: React + TypeScript;
- routing: `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`;
- nawigacja: `src/components/navigation/Sidebar/`;
- komponenty i widoki: `src/components/`, `src/views/`;
- stan i kontekst: `src/store/`, `src/contexts/`, `src/hooks/`;
- komunikacja API: `src/services/`;
- standard UI: `docs/ui-standards/` oraz komponenty współdzielone.

## Backend

- główny kod: `server/src/`;
- montowanie tras i middleware: `server/src/Gateway.ts` oraz entrypointy
  backendu;
- endpointy: `server/src/routes/`;
- logika biznesowa: `server/src/services/`;
- kontrola dostępu i tenancy: `server/src/middleware/`;
- inicjalizacja/abstrakcja danych: `server/src/database/`;
- cykliczne operacje: schedulery, cron i workery w `server/src/`.

## Dane

Produkcyjnym kierunkiem i źródłem danych jest PostgreSQL. Prawda schematu to
wykonane migracje oraz schemat właściwego środowiska, nie opis w starym
dokumencie. SQLite może występować w historycznych skryptach i testach; nie
należy z tego wnioskować, że jest wspieranym backendem produkcyjnym.

## AI

AI obejmuje Chat/Teresę, routing modeli, retrieval, cytowania, narzędzia,
generowanie artefaktów i akcje. Punkty wykonawcze znajdują się przede wszystkim
w `server/src/services/ai/`, `server/src/routes/ai.routes.ts` oraz
`src/components/AIChat/`.

Operację AI klasyfikujemy jako:

- doradczą;
- generatywną;
- wykonawczą;
- deterministyczną automatyzację.

Operacja wykonawcza nie może omijać capability, właściciela danych, akceptacji
i audytu.

## Integracje

Stan integracji potwierdza kod konfiguracji, backend connector/service,
przechowywanie poświadczeń, health check i test na właściwym środowisku.
Obecność nazwy integracji w UI lub dokumencie nie dowodzi gotowego połączenia.

## Ostrzeżenie o materiałach historycznych

`docs/architecture/ARCHITECTURE_MAP.md` jest użyteczną mapą nawigacyjną, ale
zawiera datowane liczby plików i deklaracje technologiczne. Należy go traktować
jako supporting. Ten dokument wskazuje stabilne lokalizacje wykonawcze; dokładny
stan zawsze potwierdza repozytorium.
