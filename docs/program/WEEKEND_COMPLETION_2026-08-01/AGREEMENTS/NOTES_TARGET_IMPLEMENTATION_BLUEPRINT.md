---
doc_kind: TARGET_IMPLEMENTATION_BLUEPRINT
function_id: MW_NOTEBOOK
status: REVIEW
last_updated: 2026-07-31
---

# Notes — finalny blueprint wdrożeniowy

## 1. Cel dokumentu

Ten dokument zamyka drogę od benchmarku do implementacji. Każda rekomendacja przyjęta w pakiecie Notes ma tutaj miejsce w ekranie, właściciela danych, bramkę AI, priorytet i dowód odbioru. W razie sprzeczności szczegółowej ten blueprint oraz dokument główny są nadrzędne wobec starszego kontraktu `MW_NOTEBOOK.md`.

## 2. Docelowy produkt w jednym zdaniu

Notes jest minimalistycznym warsztatem, w którym użytkownik natychmiast przechwytuje wiedzę, bezpiecznie ją rozwija i weryfikuje z Teresą, odnajduje przez źródła i relacje, a następnie świadomie przekształca w działanie lub materiał bez utraty provenance.

## 3. Docelowy układ

```text
Menu 1: My Work
Menu 2: Notatki
Menu 3: Wszystkie | Inbox | Aktywne | + Nowa strona | Search

Workspace
├── Lewa kolumna: capture + soczewki + lista stron
├── Centrum: breadcrumb + metadata + edytor blokowy
└── Prawy panel (domyślnie zamknięty)
    ├── Teresa
    └── Powiązania
```

Biblioteka notatników jest poziomem nadrzędnym. `Folder` nie istnieje jako zamiennik notatnika. Wszystkie ścieżki mają jawne `Wróć`, save/resume i deep link.

## 4. Traceability przyjętych decyzji

| Decyzja | Funkcje | Implementacja docelowa | Test odbioru |
| --- | --- | --- | --- |
| capture bez klasyfikacji | NB-C01–C06 | brak pól obowiązkowych poza treścią; default do Inbox | GF-N1/GF-N2 |
| jeden słownik | NB-L01–L04 | Notes → Notebook → Page → Block | test etykiet i routingu |
| minimalistyczny rail | NB-A01–A08, NB-K05 | tylko Teresa/Powiązania | test użyteczności i screenshot |
| AI jako proposal | NB-A01–A08 | preview/diff, partial accept, reject | mutation audit test |
| źródło ≠ ekstrakcja ≠ AI | NB-K01–K04 | osobne pola i wizualne provenance | import fidelity test |
| scoped search | NB-S01–S04 | page/notebook/all/project + filtry | search scope E2E |
| ACL przed retrieval | NB-G01–G03 | filter na query/retrieval/preview | GF-N5 |
| stabilne relacje | NB-E07–E08, NB-K05 | link graph + docelowo block IDs | backlink/permission test |
| jeden handoff | NB-H01–H08 | `Utwórz z notatki` + picker + preview | GF-N4 |
| owner read-back | NB-H01–H08 | target ID/status + idempotency key | retry/no-duplicate test |
| wersje i recovery | NB-E09–E10, NB-K06 | autosave, conflict, restore-as-new | GF-N6 |
| mały katalog template'ów | NB-O07 | 6 kuratorowanych template'ów | create-from-template test |

## 5. P0 — dokładny zakres staging

### P0.1 Biblioteka i wejście

- lista private/project z ownerem i activity;
- create/open/rename/archive;
- delete blokowany przy zawartości z opcją przeniesienia;
- pewny route/back/deep-link.

### P0.2 Capture i triage

- szybki tekst oraz import PDF/XLSX/TXT/MD;
- zachowanie pliku i metadanych;
- Inbox z przejściem do active/archive;
- pin i podstawowe przeniesienie między notatnikami.

### P0.3 Edytor

- zamknięty katalog podstawowych bloków;
- slash menu, bubble toolbar, skróty i undo/redo;
- autosave z widocznym stanem;
- flush przy zmianie strony;
- konflikt bez silent overwrite;
- historia i restore jako nowa wersja.

### P0.4 Teresa

- summarize, rewrite, structure, questions/gaps, action extraction;
- praca na stronie albo zaznaczeniu;
- źródła i scope wejścia;
- preview/diff i jawne zastosowanie;
- brak bezpośredniego bulk-create tasków.

### P0.5 Output

- jeden picker: Idea, Task, Decision, Initiative candidate;
- planning preview i brakujące pola;
- idempotency key per proposal/target;
- owner-module ID, backlink i ledger;
- retry nie tworzy duplikatu.

### P0.6 Trust

- private/project i owner;
- source file, assumption marker;
- ACL w list/search/AI/preview;
- log zmian widoczności, AI acceptance i handoff.

## 6. P1/P2

P1: web/e-mail/meeting capture, semantic search z cytatami, block anchors, topics/backlinks, batch triage, verification/freshness, review/comments, templates, import/export fidelity.

P2: offline-first, OCR i audio search, graph analytics, public/client sharing, digesty i governed memory promotion.

## 7. Minimalizm — budżet interfejsu

- maksymalnie 3 kontekstowe sugestie AI;
- maksymalnie 2 zakładki raila;
- 1 dominujące CTA na powierzchnię;
- 1 komponent odpowiedzialny za każde polecenie;
- maksymalnie 2 tagi na wierszu strony;
- sekcja niewnosząca wartości jest ukryta;
- pełny katalog jest zawsze o poziom głębiej niż rekomendowane akcje.

## 8. Dane i własność

`Notebook` i `Page` są własnością Notes. Link graph może przechowywać relację, ale nie kopię obiektu docelowego. Handoff tworzy proposal i żądanie do owner module. Embedding oraz indeks wyszukiwania są pochodną, możliwą do odbudowy, z ACL i identyfikatorem wersji źródła.

## 9. Kolejność realizacji

1. nazwy, routing i adapter kanonicznego API;
2. save/conflict/recovery;
3. capture/import/provenance;
4. uproszczenie raila i AI proposal engine;
5. jednolity handoff/read-back;
6. search/ACL;
7. golden flows i visual QA;
8. dopiero potem P1 knowledge graph i automatyzacje.

## 10. Bramka finalna

Notes nie jest odebrany, dopóki GF-N1–GF-N6 nie przejdą na świeżej bazie dla co najmniej dwóch użytkowników i dwóch scope'ów, a test wizualny nie potwierdzi prawego panelu bez duplikacji funkcji.
