---
doc_id: consultify-environment-and-naming-authority
truth_type: product-target
status: canonical
owner: piotr
process_owner: codex
last_reviewed: 2026-08-01
---

# Kanon nazwy produktu i środowiska odbiorowego

## Twarda decyzja

1. Nazwa produktu brzmi **Consultify**.
2. `Consultinity` jest starą, wycofaną nazwą. Nie wolno jej używać w nowym UI,
   dokumentacji produktowej, komunikatach, nazwach nowych kontraktów ani instrukcjach
   dla agentów.
3. Historyczne identyfikatory techniczne zawierające `consultinity` mogą pozostać
   tymczasowo tylko wtedy, gdy ich zmiana wymaga migracji. Muszą być oznaczone jako
   dług kompatybilności, a nie aktualna nazwa produktu.

## Jedyny target odbioru

| Warstwa | Kanon |
| --- | --- |
| Projekt Railway | `consultify` |
| Environment Railway | `demo` |
| Aplikacja | `consultify` service |
| Publiczny staging | `https://demo.consultify.ai` |
| Baza | PostgreSQL service w tym samym Railway environment `demo` |
| Dodatkowe usługi | Redis i pgvector w environment `demo` |
| Produkcja — poza zakresem | `https://consultify.ai`, Railway environment `production` |

Stan został potwierdzony read-only przez Railway CLI 2026-08-01: aplikacja, PostgreSQL,
Redis i pgvector w `demo` miały status `SUCCESS`. Historyczny alias
`stage.consultinity.ai` istnieje w konfiguracji Railway, ale nie jest kanoniczną domeną
produktu ani adresem odbioru.

## Zakaz lokalnego odbioru

- nie uznajemy lokalnego serwera, SQLite ani lokalnego PostgreSQL za środowisko
  odbiorowe;
- lokalne unit/contract tests mogą wspierać development, ale nie dowodzą gotowości
  funkcji ani golden flow;
- rezultat `GO` wymaga wykonania na `demo.consultify.ai` i read-backu z PostgreSQL
  environment `demo`;
- test nie może po cichu przełączyć się na mock, SQLite, `.env.test` ani inną bazę.

## Bezpieczna praca na Railway demo

Przed każdą mutacją Codex sprawdza jawnie projekt, environment i service. Paczka
stagingowa musi mieć:

1. revision/commit wdrożony na `demo`;
2. backup lub potwierdzony recovery odpowiedni do ryzyka;
3. namespaced fixture z ownerem i cleanupem;
4. test tenant isolation oraz read-back z owner store;
5. zakaz dotykania `production`;
6. log/screenshot/identyfikatory jako evidence;
7. werdykt `GO / FIX / NO-GO`.

Migracje, deploy, zmiana zmiennych i masowe operacje na danych wymagają osobnej,
jawnej paczki operacyjnej. Samo przygotowanie kodu nie upoważnia do ich wykonania.
Environment `production` i domena `consultify.ai` nie są używane nawet do smoke testu
w tej fali bez osobnej decyzji Product Ownera.

## Instrukcja dla agentów

Każdy packet dla Claude zaczyna się od:

> Produkt: Consultify. Target odbioru: Railway project `consultify`, environment
> `demo`, `https://demo.consultify.ai`, PostgreSQL `demo`. Localhost nie jest evidence.
> Nie wykonuj deployu, migracji ani mutacji stagingu bez jawnego polecenia Codex.
