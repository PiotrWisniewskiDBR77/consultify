---
document_id: CANVAS-TERESA-COLLABORATION-SOURCES-HANDOFF
surface: Canvas
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Canvas — Teresa, źródła, współpraca i handoff

## 1. Dwa równorzędne sposoby pracy

### Manual-first

Użytkownik tworzy i edytuje. Teresa obserwuje tylko dozwolony context packet i
pomaga na żądanie. Nie przejmuje dokumentu ani nie regeneruje całości, jeśli
polecenie dotyczy fragmentu.

### Teresa-first

Użytkownik określa cel. Teresa najpierw podsumowuje: rezultat, odbiorcę, zakres,
założenia, potrzebne źródła, proponowaną strukturę i braki. Dopiero po akceptacji
tworzy pierwszy draft. Jest to obowiązkowa faza myślenia dla dużych dokumentów,
prezentacji, arkuszy, analiz i deliverables.

W obu wariantach człowiek może przejąć edycję w dowolnym momencie.

## 2. Context packet Teresy

Teresa otrzymuje wyłącznie:

- identity i dozwolony organization/project scope;
- aktywny draft, wersję, typ i lifecycle;
- aktualne zaznaczenie lub wskazany blok;
- Markdown projection;
- jawnie dołączone źródła i linked outputs;
- istotne zdarzenia workflow oraz komentarze dostępne dla użytkownika.

Nie otrzymuje ukrytych dokumentów, treści spoza ACL ani całej historii firmy
„na wszelki wypadek”. UI pokazuje aktualny zakres działania: selection, block,
section, artifact, conversation lub linked sources.

## 3. Kontrakt działań AI

| Ryzyko | Przykład | Zachowanie |
| --- | --- | --- |
| read-only | streszczenie, pytanie, diagnoza | wykonaj i pokaż źródła |
| reversible local | propozycja tekstu/układu | preview -> accept/reject |
| structural | konwersja tabeli, przebudowa sekcji | diff + walidacja + accept |
| cross-module write | utwórz task/decision/initiative | proposal -> permission -> confirm -> read-back |
| external/publish | wyślij, udostępnij, opublikuj | jawny odbiorca, zakres i final confirmation |

Teresa nie może fabrykować źródeł, usuwać ręcznej treści bez diffu, scalać
sprzecznych danych po cichu, zatwierdzać własnego outputu ani deklarować
materializacji bez target ID i read-backu.

## 4. Źródła i evidence

Każde źródło ma: source ID, typ, tytuł, ownera, ACL, wersję/timestamp, fragment
użyty, metodę pozyskania i status dostępności. Claim wymagający dowodu linkuje do
konkretnego fragmentu. Po zmianie źródła system oznacza zależne treści jako
`stale`; nie aktualizuje zatwierdzonego artefaktu po cichu.

Źródła mogą pochodzić z Client Vault, modułów aplikacji, załączników, connectorów
i web research. Każde podłączenie korzysta ze wspólnego MCP-like connector
contract: discovery, consent, minimal scope, health, revoke, sync log i error
recovery.

## 5. Współpraca i review

Role artefaktu: owner, editor, commenter, reviewer, viewer. Reviewer ocenia
konkretną wersję. Komentarz ma anchor do bloku/fragmentu, autora, czas, status i
thread. Zmiana po zatwierdzeniu tworzy nowy draft/version i nie nadpisuje
zatwierdzonego snapshotu.

Konflikt równoczesnej edycji nie może kończyć się last-write-wins bez informacji.
MVP może użyć optimistic locking i kontrolowanego merge; pełna współedycja CRDT
jest dalszym etapem.

## 6. Handoff do aplikacji

| Target | Minimalny payload | Gate |
| --- | --- | --- |
| Note | tytuł, treść, źródła | owner scope |
| Idea | problem/szansa, opis, evidence | review użytkownika |
| Decision | pytanie, opcje, rekomendacja, konsekwencje | decision owner/approver |
| Initiative Candidate | cel, rationale, rezultat, scope, ryzyka, evidence | initiative quality gate |
| Task | action, owner, due date, context | task policy |
| Materials/Output | typ, template, brand, wersja | deliverable review |
| Finance/KPI | założenia i dane wejściowe | walidacja domenowa |

Canvas przechowuje `materializedTo[]`; target przechowuje backlink do draftu i
wersji. Powtórne kliknięcie jest idempotentne albo tworzy jawną nową wersję, nie
duplikat.

## 7. Jakość pracy Teresy

Teresa przed wygenerowaniem dużego outputu:

1. rozpoznaje cel i odbiorcę;
2. sprawdza dostępny kontekst;
3. oddziela fakty, interpretacje i założenia;
4. wskazuje brakujące informacje;
5. proponuje strukturę i typ artefaktu;
6. uzgadnia poziom szczegółowości i styl;
7. dopiero potem generuje.

Po generowaniu wykonuje self-check, ale nie jest własnym approverem. Quality
summary pokazuje pokrycie, źródła, luki, ryzyka i rekomendowany następny krok.
