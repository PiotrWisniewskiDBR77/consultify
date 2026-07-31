---
doc_kind: AS_IS_TARGET_GAP_ANALYSIS
function_id: MW_NOTEBOOK
status: REVIEW
last_updated: 2026-07-31
---

# Notes — AS-IS, MVP, luki i rozstrzygnięcia

## 1. Wniosek ze zwiadu

Notes nie jest pustym modułem. To jeden z bardziej rozwiniętych obszarów My Work, ale dokumentacja była starsza od kodu i używała mylącego modelu `Folder`. Priorytetem nie jest budowa od zera, lecz spięcie istniejących funkcji w jeden golden flow oraz usunięcie podwójnych ścieżek API/legacy.

## 2. Potwierdzone AS-IS

| Obszar | Dowód w repo | Ocena |
| --- | --- | --- |
| biblioteka notatników | `NotebookLibraryContent.tsx` | istnieje |
| lista i edytor stron | `NotebookContent.tsx` | rozbudowane |
| quick capture | `NotebookQuickCapture.tsx` | istnieje |
| edytor i menu | toolbar, bubble/slash/mention/AI menu | istnieją |
| źródła i załączniki | frontend + routes/services | istnieją |
| statusy | `inbox/active/converted/archived` | istnieją w API |
| weryfikacja/aktualność | badges, `verification_status`, `staleAt` | częściowo spięte |
| topics/backlinks/graph | dedykowane komponenty i serwisy | istnieją |
| today/reminders/action extraction | dedykowane komponenty/endpoints | istnieją |
| wersje i obecność | history/presence/collab gateway | istnieją |
| semantic search/RAG | `notebook.routes.ts`, service/API | istnieje backendowo |
| propozycje AI | create/get/resolve + UI | istnieją |
| konwersje/handoff | conversion service/menu | istnieją, wymagają bramki E2E |
| testy | `tests/e2e/m04-notebook/**` i component/backend tests | szerokie, lecz nie pełny golden flow |

## 3. Krytyczne niespójności

1. **Nazewnictwo:** stary kontrakt miesza `Folder`, `Notebook` i `Notatki`. Decyzja: `Notatki → Notatnik → Strona → Bloki`.
2. **Dwie generacje API:** występują legacy, my-work i v8 routes. Potrzebny jeden adapter kanoniczny i plan wyłączenia starych endpointów, bez big-bang migration.
3. **Bogaty runtime, słaby kontrakt:** funkcje takie jak graph, today, topics i AI istnieją, ale nie tworzą jeszcze jednego prostego przepływu użytkownika.
4. **Handoff:** istnieje konwersja, lecz sukces musi zależeć od idempotency i read-backu właściciela docelowego.
5. **Wiedza a prawda:** maturity, verification, freshness i lifecycle wymagają osobnych pól i jasnych reguł.
6. **Usuwanie:** notatnik z zawartością zwraca konflikt; UI musi oferować archiwizację/przeniesienie, a nie obejście zabezpieczenia.
7. **Prawy panel:** technicznie skonsolidowany rail nadal łączy formatowanie, AI, page settings, siedem konwersji i rozbudowany kontekst; target redukuje go do `Teresa` + `Powiązania` zgodnie z osobnym standardem.
8. **Bezpośrednie taski:** `ActionItemsPanel` ma ścieżkę pojedynczego i zbiorczego `createPersonalTask`; musi zostać objęta preview, idempotency i owner read-backiem.

## 4. Zakres MVP — P0

1. biblioteka → notatnik → strona z bezpiecznym back/save/resume;
2. quick capture do Inbox bez obowiązkowej klasyfikacji;
3. triage `inbox → active → converted/archived`;
4. stabilny edytor podstawowych bloków, załączniki i source file;
5. wyszukiwanie tekstowe w jawnym zakresie;
6. prywatny/projektowy ACL oraz czytelny owner;
7. autosave, konflikt, historia wersji i recovery;
8. Teresa: summarize/structure/extract actions z preview, diff i accept/reject;
9. jawne konwersje co najmniej do Idea, Task, Decision i Initiative candidate;
10. idempotentny handoff oraz owner-module read-back;
11. kompletny golden-flow E2E na świeżej bazie.

## 5. P1 po stabilnym MVP

- semantic search/RAG z cytatami i testem ACL retrieval;
- topics, backlinks, mentions i wykrywanie osieroconych stron;
- today/reminders oraz batch triage;
- projektowa współpraca, presence i dojrzałe rozwiązywanie konfliktów;
- import web/e-mail/chat/meeting z pełnym provenance;
- stale review i workflow verification;
- export oraz draft do Materials.

## 6. P2

- graph jako dojrzały tryb eksploracji;
- voice capture/transcription;
- automatyczne, lecz zatwierdzane digesty;
- kontrolowana promocja do pamięci organizacyjnej;
- zaawansowane template'y stron i analityka wiedzy.

## 7. Golden flows

### GF-N1 — capture i powrót

Użytkownik zapisuje myśl bez klasyfikacji → strona pojawia się w Inbox → opuszcza funkcję → wraca → treść i pozycja są zachowane.

### GF-N2 — import z dowodem

Użytkownik importuje plik → widzi ekstrakcję i oryginał → poprawia treść → źródło pozostaje przypięte i możliwe do pobrania.

### GF-N3 — pomoc Teresy

Użytkownik zaznacza fragment → prosi o strukturę → widzi proposal/diff/źródła → przyjmuje część → powstaje nowa wersja.

### GF-N4 — handoff

Użytkownik wybiera `Utwórz task/ideę/decyzję/inicjatywę` → widzi preview i brakujące pola → zatwierdza → moduł docelowy zwraca ID → strona pokazuje backlink/output → retry nie duplikuje.

### GF-N5 — dostęp

Prywatna strona nie pojawia się drugiemu użytkownikowi w liście, search, RAG, topics, graph, embed preview ani odpowiedzi Teresy.

### GF-N6 — konflikt i odzyskanie

Dwie sesje edytują stronę → system nie nadpisuje po cichu → użytkownik widzi konflikt i odzyskuje obie wersje.

## 8. Standard benchmarkowy

Inspiracją jest sprawdzony model notebook → section/page, ciągłego zapisu oraz wyszukiwania w wybranym zakresie znany z dojrzałych narzędzi notatkowych. Consultify rozszerza go o provenance, weryfikację, kontekst organizacyjny i kontrolowane handoffy. Benchmark jest wzorcem interakcji, nie kopią produktu ani uzasadnieniem dla nowych właścicieli danych.

## 9. Otwarte decyzje właściciela

Te pytania nie blokują dokumentacji ani P0 discovery, ale muszą zostać zamknięte przed finalnym UI:

1. Czy label w UI ma brzmieć wyłącznie `Notatki`, czy dwujęzycznie `Notes`?
2. Czy jeden użytkownik ma domyślny notatnik `Inbox`, czy Inbox jest wirtualnym widokiem wszystkich notatników?
3. Kto może nadać `verified`: autor, project lead, manager czy rola konfigurowalna?
4. Czy `converted` jest statusem automatycznym po pierwszym outputcie, czy tylko znacznikiem obok nadal aktywnej strony?
5. Jak długo przechowujemy źródła web/e-mail/audio i kto może je eksportować?
6. Czy notatki projektowe mają być współedytowane w MVP, czy tylko współdzielone do odczytu/komentarza?

## 10. Bramka odbioru

- P0 nie wymaga graph, voice ani automatycznych digestów.
- Nie ogłaszamy Notes gotowym na podstawie obecności komponentów.
- Odbiór wymaga przejścia GF-N1–GF-N6 na świeżej bazie, testu uprawnień oraz potwierdzenia właścicieli modułów docelowych.
