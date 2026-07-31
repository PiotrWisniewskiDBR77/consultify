---
doc_kind: FUNCTION_CATALOG
function_id: MW_NOTEBOOK
status: REVIEW
last_updated: 2026-07-31
---

# Notes — kompletny katalog funkcji

## 1. Zasada czytania

Każda funkcja ma cel, trigger, wynik, rolę Teresy i kryterium jakości. `AS-IS` oznacza potwierdzony ślad w repo, nie automatycznie gotowy UX. Priorytet określa potrzebę produktową.

## 2. Biblioteka i nawigacja

| ID | Funkcja | Cel i zachowanie | AI | Stan / priorytet |
| --- | --- | --- | --- | --- |
| NB-L01 | Lista notatników | skanowanie nazwy, ownera, scope, projektu, aktywności i liczby stron | może sugerować porządek, bez przenoszenia | AS-IS / P0 |
| NB-L02 | Nowy notatnik | nazwa, opis, private/project, opcjonalny projekt; sensowne defaulty | proponuje nazwę/strukturę | AS-IS / P0 |
| NB-L03 | Otwórz/powrót | zachowuje notatnik, stronę, scroll i filtr | brak | AS-IS / P0 |
| NB-L04 | Rename/archive/delete | delete dopiero po empty/move; archive odwracalny | nie wykonuje automatycznie | częściowo / P0 |
| NB-L05 | Wyszukaj bibliotekę | tytuł/opis/owner/projekt | brak generacji | gap UX / P1 |

## 3. Capture i Inbox

| ID | Funkcja | Cel i zachowanie | AI | Stan / priorytet |
| --- | --- | --- | --- | --- |
| NB-C01 | Quick capture text | zapis w jednym kroku do Inbox | opcjonalny tytuł po zapisie | AS-IS / P0 |
| NB-C02 | Capture link | zachowuje URL, czas, tytuł i preview | ekstrakcja/smart filing jako proposal | backend / P1 |
| NB-C03 | Import file | PDF/XLSX/TXT/MD: oryginał + ekstrakcja | podsumowanie oddzielone od źródła | AS-IS / P0 |
| NB-C04 | Capture chat/meeting | cytat + source object ID + uczestnicy | proponuje notatkę z rozmowy | częściowo / P1 |
| NB-C05 | Capture e-mail | message ID, sender, date i content | klasyfikacja | backend / P1 |
| NB-C06 | Voice capture | audio policy + transcript + confidence | transkrypcja/podsumowanie | częściowo / P2 |
| NB-C07 | Batch triage | move, topic, scope, archive dla wielu | preview grupowania i duplikatów | gap / P1 |

## 4. Lista i organizacja stron

| ID | Funkcja | Cel i zachowanie | AI | Stan / priorytet |
| --- | --- | --- | --- | --- |
| NB-O01 | Status lifecycle | inbox/active/converted/archived | rekomendacja bez mutacji | AS-IS / P0 |
| NB-O02 | Scope lens | all/mine/team, tylko gdy potrzebne | brak | AS-IS / P0 |
| NB-O03 | Smart views | pinned/recent/review/fresh/orphaned | sygnały quality | AS-IS / P1 |
| NB-O04 | Topics/tags | niezależne od hierarchii i projektu | propozycje topiców | AS-IS / P1 |
| NB-O05 | Pin/reminder | focus i powrót w czasie | proponuje reminder z treści | AS-IS / P1 |
| NB-O06 | Move/copy | bezpieczne przeniesienie między notatnikami | wykrywa duplikat | do weryfikacji / P1 |
| NB-O07 | Templates | sześć kuratorowanych startów | dobiera template do intencji | gap / P1 |

## 5. Edytor strony

| ID | Funkcja | Cel i zachowanie | AI | Stan / priorytet |
| --- | --- | --- | --- | --- |
| NB-E01 | Title/icon/cover | orientacja i rozpoznawalność | propozycja tytułu | AS-IS / P0 |
| NB-E02 | Basic blocks | tekst, H1–H3, listy, checklist, quote, callout, table, link, file, image, code, divider | może proponować blok | AS-IS / P0 |
| NB-E03 | Slash/+ menu | jedno miejsce dodawania bloków | wyszukiwanie intencji | AS-IS / P0 |
| NB-E04 | Bubble toolbar | szybka edycja zaznaczenia | krótki entry do AI | AS-IS / P0 |
| NB-E05 | Drag/reorder | zmiana kolejności bez utraty | brak | do potwierdzenia / P0 |
| NB-E06 | Undo/redo/clipboard | przewidywalna praca | brak | AS-IS / P0 |
| NB-E07 | Mentions/embeds | jawne referencje do obiektów | rekomenduje, użytkownik łączy | AS-IS / P1 |
| NB-E08 | Block anchors | link/cytat do konkretnego bloku | cytuje block ID | gap / P1 |
| NB-E09 | Autosave | status zapisu i flush przy wyjściu | brak | AS-IS / P0 |
| NB-E10 | Conflict/recovery | nie traci dwóch wersji | proponuje merge, człowiek zatwierdza | częściowo / P0 |

## 6. Wiedza, źródła i współpraca

| ID | Funkcja | Cel i zachowanie | AI | Stan / priorytet |
| --- | --- | --- | --- | --- |
| NB-K01 | Source file | zachowanie oryginału i metadanych | ekstrakcja z attribution | AS-IS / P0 |
| NB-K02 | Attachments | materiały pomocnicze i bezpieczny download | analiza na żądanie | AS-IS / P0 |
| NB-K03 | Verification | unverified/verified/disputed z osobą i datą | wskazuje luki, nie weryfikuje | częściowo / P1 |
| NB-K04 | Freshness | review date/staleAt/owner | wykrywa ryzyko przestarzałości | częściowo / P1 |
| NB-K05 | Backlinks | widoczne tylko zgodnie z ACL | proponuje relacje | AS-IS / P1 |
| NB-K06 | Version history | podgląd i restore jako nowa wersja | opisuje różnice | AS-IS / P0 |
| NB-K07 | Presence/collab | świadomość współedycji | brak | AS-IS / P1 |
| NB-K08 | Comments/review | rozmowa bez wpisywania uwag w treść | podsumowanie dyskusji | gap/niejasne / P1 |
| NB-K09 | Graph | eksploracja sieci wiedzy | wskazuje orphan/cluster | AS-IS / P2 |

## 7. Search i recall

| ID | Funkcja | Cel i zachowanie | AI | Stan / priorytet |
| --- | --- | --- | --- | --- |
| NB-S01 | Find in page | exact search/highlight | brak | do potwierdzenia / P0 |
| NB-S02 | Scoped text search | page/notebook/all/project + filtry | ranking explainable | częściowo / P0 |
| NB-S03 | Semantic search | odnalezienie znaczeniowe | pokazuje powód dopasowania | backend / P1 |
| NB-S04 | Ask notes / RAG | odpowiedź tylko z cytatami | odmawia bez podstawy | backend / P1 |
| NB-S05 | Saved search | stały widok powtarzalnego pytania | proponuje warunki | gap / P1 |
| NB-S06 | OCR/transcript search | tekst obrazów/audio | confidence i źródło | gap / P2 |

## 8. Teresa

| ID | Funkcja | Cel i zachowanie | Bramka jakości | Stan / priorytet |
| --- | --- | --- | --- | --- |
| NB-A01 | Summarize | zwięzłe podsumowanie strony/zaznaczenia | preview + scope | AS-IS / P0 |
| NB-A02 | Rewrite/translate | poprawa wskazanego fragmentu | diff, bez utraty źródeł | AS-IS / P0 |
| NB-A03 | Structure | outline, sekcje, tabela/checklist | preview, apply fragment | częściowo / P0 |
| NB-A04 | Find gaps/questions | pomoc konsultingowa | oddziela brak danych od opinii | AS-IS-ish / P0 |
| NB-A05 | Extract actions | propozycje działań | nigdy direct bulk-create | AS-IS wymaga zmiany / P0 |
| NB-A06 | Topics/classify | porządkowanie strony/Inbox | preview + accept/reject | AS-IS / P1 |
| NB-A07 | Detect contradictions | porównanie z dostępną wiedzą | cytaty i confidence | gap / P1 |
| NB-A08 | Full conversation | praca iteracyjna na stronie | jawny context scope | AS-IS / P0 |

## 9. Output i integracja

| ID | Funkcja | Cel i zachowanie | Bramka jakości | Stan / priorytet |
| --- | --- | --- | --- | --- |
| NB-H01 | Create Idea | kandydat z problemem/szansą i źródłem | preview + Ideas ID | AS-IS / P0 |
| NB-H02 | Create Task | kandydat z owner/due/priority proposal | individual/batch review + ID | AS-IS direct path do korekty / P0 |
| NB-H03 | Create Decision | pytanie, opcje, przesłanki, deadline | preview + Decisions ID | AS-IS / P0 |
| NB-H04 | Create Initiative | draft candidate, nigdy aktywna inicjatywa | quality gate + ID | AS-IS / P0 |
| NB-H05 | Create Material | dokument/report/prezentacja z założeniami | planning preview + source list | częściowo / P1 |
| NB-H06 | Link existing object | referencja zamiast duplikatu | ACL + explicit relation | AS-IS / P1 |
| NB-H07 | Output ledger | lista celu/statusu/read-backu | retry idempotentny | częściowo / P0 |
| NB-H08 | Export/share | przenośność i prezentacja | warning ACL/fidelity | częściowo / P1 |

## 10. Administracja i bezpieczeństwo

| ID | Funkcja | Cel i zachowanie | Stan / priorytet |
| --- | --- | --- | --- |
| NB-G01 | Private/project scope | dostęp do strony i wszystkich pochodnych | AS-IS / P0 |
| NB-G02 | Project membership | prawo odczytu/edycji wynikające z projektu | AS-IS / P0 |
| NB-G03 | AI/search ACL | filtr przed retrieval i embedding response | do udowodnienia / P0 |
| NB-G04 | Retention/delete | źródła, załączniki, wersje i archive | gap kontraktu / P1 |
| NB-G05 | Audit log | high-impact AI, scope, verification i handoff | częściowo / P0/P1 |

## 11. Funkcje wymagające korekty przed rozpisaniem tasków

1. `ActionItemsPanel` wykonuje bezpośrednie tworzenie tasków, w tym sekwencyjne `Create all`; target wymaga review, idempotency i owner read-back.
2. `AIChatInlinePanel` wstawia wygenerowaną treść jako callout; target wymaga wyboru sposobu aplikacji i diffu.
3. Siedem kafli konwersji należy zastąpić jedną komendą z pickerem.
4. Metadata, visibility i delete trzeba wyjąć z raila do nagłówka/menu strony.
5. Sugerowane obiekty w `ContextPanel` trzeba oddzielić od faktycznych backlinków i outputów.
6. `Assessment` jako bezpośredni target wymaga osobnego kontraktu owner-module; do tego czasu nie jest publiczną opcją.
