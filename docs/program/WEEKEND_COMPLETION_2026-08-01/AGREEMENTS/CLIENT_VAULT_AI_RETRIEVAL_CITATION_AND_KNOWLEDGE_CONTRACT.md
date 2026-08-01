---
document_id: CLIENT-VAULT-AI-RETRIEVAL-CITATION
module: My Work / Client Vault
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Client Vault — AI, retrieval, cytowania i kontekst

## 1. Tryby użycia AI

1. `Ask` — odpowiedź na pytanie z cytatami.
2. `Search` — semantyczne i słownikowe odnajdywanie źródeł.
3. `Summarize` — streszczenie jednego dokumentu lub kolekcji.
4. `Compare` — różnice, podobieństwa, sprzeczności i missing information.
5. `Extract` — ustrukturyzowane dane do Review Table.
6. `Deep analysis` — plan wyszukiwania, iteracyjne poszerzanie i raport.
7. `Draft with sources` — produkt pracy w Materials/Canvas z manifestem źródeł.

## 2. Kontrakt retrieval

Zapytanie niesie caller identity, organization, project memberships, wybrany
scope, source IDs/versions, folder/collection, purpose i sensitivity policy.
Serwer sam wylicza effective ACL; parametry od modelu/UI nigdy nie poszerzają
dostępu. Retrieval łączy keyword/vector/reranking, lecz każdy wynik musi zachować
document ID, version, page/section anchor, score i permission decision.

Prywatny dokument może być użyty tylko przez właściciela i wyłącznie wtedy, gdy
caller identity dociera przez cały pipeline. Obecne wykluczenie prywatnych
dokumentów z RAG bez `userId` jest bezpiecznym fail-closed, ale nie spełnia
funkcji „Mój sejf uzupełnia mój kontekst” — to luka P0.

## 3. Cytowania i odpowiedź

Każde twierdzenie oparte na Vault ma cytat do konkretnego fragmentu. UI pokazuje
nazwę, wersję, stronę/sekcję i krótki supporting snippet, a klik otwiera preview.
Odpowiedź rozróżnia:

- `supported` — źródła wprost potwierdzają;
- `inferred` — wniosek z kilku źródeł;
- `conflicting` — źródła są sprzeczne;
- `not found` — brak podstawy w wybranym zbiorze;
- `general knowledge` — użyte tylko, jeśli użytkownik jawnie zezwolił.

Brak uprawnienia po czasie nie ujawnia snippetów; audit zachowuje tylko
bezpieczne metadata zgodnie z polityką.

## 4. Knowledge manifest

Każdy Chat, Agent, Workflow, analiza i generator zapisuje manifest: wybrane
źródła, faktycznie użyte wersje/fragments, query plan, czas, policy decision,
model oraz output citations. Daje to reprodukowalność, impact analysis po
aktualizacji dokumentu i możliwość oznaczenia wyniku jako stale.

Pinning:

- `exact version` dla audytów i zatwierdzonych rezultatów;
- `latest compatible` dla żywych workflowów;
- `published KB version` dla standardów organizacji.

## 5. Teresa

Teresa pomaga dobrać scope, pyta o brakujące źródła, ostrzega przed użyciem
niezatwierdzonego/starego dokumentu, tworzy zapytania, streszcza i wskazuje
sprzeczności. Nie może zmienić scope/ACL, opublikować Knowledge Base, zatwierdzić
evidence ani twierdzić, że przeczytała dokument z błędem indeksowania.

Przed długą analizą Teresa podsumowuje: cel, źródła, wyłączenia, oczekiwany
format, standard cytowań i przybliżony koszt/czas. Użytkownik może zmienić plan.

## 6. Pytania do wspólnego odbioru

1. Czy AI może domyślnie łączyć Vault z wiedzą ogólną, czy wyłącznie po opt-in?
2. Czy przy każdym wyniku wymagamy citations, czy dopuszczamy tryb roboczy bez nich?
3. Jak oznaczamy wiarygodność: confidence, coverage, source quality czy kombinacja?
4. Czy użytkownik może ręcznie zatwierdzać fragmenty jako authoritative?
5. Jak długo przechowujemy pełny retrieval manifest i query history?
