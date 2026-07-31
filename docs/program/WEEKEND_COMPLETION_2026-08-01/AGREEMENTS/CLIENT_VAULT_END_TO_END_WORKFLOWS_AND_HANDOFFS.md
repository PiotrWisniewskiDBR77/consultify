---
document_id: CLIENT-VAULT-E2E-WORKFLOWS-HANDOFFS
module: My Work / Client Vault
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Client Vault — kompletne przepływy pracy i handoffy

## 1. Flow A — szybkie uzupełnienie kontekstu

1. Użytkownik wchodzi do właściwego sejfu albo wybiera `Dodaj źródła` z Chat.
2. Przeciąga pliki, wskazuje folder/DMS albo wybiera już istniejące źródło.
3. System przed uploadem pokazuje destination, scope, projekt, sensitivity,
   AI visibility, wykryte duplikaty i dostępne formaty.
4. Po potwierdzeniu pipeline działa w tle; użytkownik może opuścić ekran.
5. Inbox pokazuje tylko actionable completion/error, bez spamowania etapami.
6. Po `ready` użytkownik wybiera dokumenty i `Użyj jako kontekst`.
7. Teresa pokazuje source scope i proponuje pytanie albo rodzaj analizy.
8. Odpowiedź ma inline citations i panel sources; klik otwiera dokładny fragment.

Edge cases: duplikat, błędny MIME, malware, dokument bez tekstu, słabe OCR,
password, partial parsing, utrata membership w trakcie analizy i usunięcie pliku.

## 2. Flow B — analiza całego zbioru przez Ask

1. Użytkownik zaznacza pliki/folder/kolekcję/Vault/Knowledge Base.
2. Teresa podsumowuje corpus: liczba plików, typy, zakres dat, błędy, wyłączenia,
   wersje i przewidywane coverage.
3. Użytkownik definiuje pytanie, format, język, horyzont i czy dopuszcza wiedzę
   spoza Vault. Teresa poprawia plan, nie zmienia celu bez zgody.
4. System wykonuje query planning, retrieval i reranking wyłącznie w ACL.
5. Wynik rozdziela answer, findings, conflicts, gaps, assumptions i sources.
6. Użytkownik może otworzyć fragment, zakwestionować cytat, wykluczyć źródło,
   zawęzić corpus albo uruchomić deep analysis.
7. Zatwierdzony finding można wysłać jako proposal do modułu właścicielskiego.

Handoff zawiera finding text, source manifest, citations, confidence, autora,
czas i destination intent. Moduł docelowy zapisuje obiekt i zwraca read-back.

## 3. Flow C — Review Table

### 3.1 Definicja

Użytkownik wybiera dokumenty i template albo pustą tabelę. Teresa najpierw
proponuje Table Instructions: cel, perspektywę, język, format, zasady `not found`,
required citation i standard dowodu. Następnie proponuje kolumny pogrupowane w:
identification, factual extraction, classification, risk, recommendation.

### 3.2 Kontrakt kolumny

Każda kolumna ma: ID/version, label, user question, normalized prompt, output
type, allowed values/schema, dependencies, source scope, citation requirement,
validation, missing policy, confidence threshold, model profile i cost class.
Conditional column wskazuje wcześniejsze column IDs, a nie tekstowe pozycje.

### 3.3 Wykonanie

Run tworzy jobs per row/column, ma retry, concurrency limit, progress i pause.
Zmiana promptu nie nadpisuje zaakceptowanych wyników: tworzy nową column version
i oznacza komórki jako stale/pending rerun. Użytkownik może uruchomić całość,
wybrane wiersze, kolumny albo komórki.

### 3.4 Review zespołowe

Wiersze można przypisać. Komórka ma status `generated`, `needs_review`,
`verified`, `edited_verified`, `flagged`, `rejected`, `not_found`, `error`.
Reviewer widzi output, cytat, source preview, confidence, prompt version,
activity i komentarze. Bulk verify wymaga jednorodnego scope i pokazuje liczbę.

### 3.5 Użycie wyniku

Rozmowa nad tabelą używa zatwierdzonych/wybranych komórek, cytując cell IDs.
Eksport XLSX/CSV zachowuje status i citations. Handoff do Finance/Audit/Tools
mapuje kolumny na docelowy schema i pokazuje preview/diff. Brak ukrytego zapisu.

## 4. Flow D — Knowledge Base

1. Owner tworzy draft KB z folderu, kolekcji lub całego sejfu.
2. System tworzy source manifest, wykrywa duplikaty, stare wersje, błędy indeksu,
   restricted sources i brak ownerów.
3. Owner opisuje purpose, audience, allowed uses, exclusions i review date.
4. Reviewer sprawdza coverage, jakość, ACL i przykładowe queries.
5. Publisher zatwierdza wersję; publikacja tworzy immutable manifest.
6. KB pojawia się w source pickerze tylko uprawnionym użytkownikom.
7. Dodanie/zmiana źródła tworzy draft kolejnej wersji i impact analysis.
8. Deprecation ostrzega workflow owners; archive nie niszczy historycznych runów.

## 5. Flow E — DMS sync

1. Admin włącza connector i capabilities; użytkownik autoryzuje minimalny scope.
2. W Sejfie wybiera source folder i ogląda preview plików, ścieżek, uprawnień,
   rozmiaru, wyłączeń i przewidywanego kosztu indeksu.
3. Mapuje destination scope, project, folder, tagi i deletion policy.
4. Initial sync zapisuje external IDs/versions i processing jobs.
5. Delta sync obsługuje create/update/move/delete/permission change.
6. Read-only badge wyjaśnia, że treść edytuje się w systemie źródłowym.
7. Reauth/permission loss zatrzymuje nowe ingest jobs, nie poszerza cache access.
8. Disconnect pokazuje wpływ oraz wybór archive/purge zgodnie z retencją.

## 6. Flow F — źródło do działania w Consultify

| Finding | Proposal docelowy | Obowiązkowe pola |
| --- | --- | --- |
| luka/ryzyko | Initiative lub Risk | observation, impact, citation, scope |
| wymagane rozstrzygnięcie | Decision | question, deadline, options/source |
| konkretna czynność | Task | outcome, owner proposal, DoD, evidence source |
| wskaźnik/liczba | KPI/Finance candidate | value, unit, period, extraction evidence |
| fragment raportu | Material/Canvas | content, style intent, citations, source manifest |

Teresa sugeruje właściwy typ i duplikaty. Człowiek wybiera destination i
zatwierdza payload. Vault zapisuje relation/read-back, ale nie staje się
właścicielem downstream lifecycle.

## 7. Pytania do wspólnego odbioru

1. Czy Table Instructions i Column Builder muszą działać po polsku i angielsku od pierwszego stagingu?
2. Czy reviewer może hurtowo verify bez otwierania cytatów?
3. Czy wynik `edited_verified` może być używany przez AI jako fakt authoritative?
4. Jakie obiekty downstream wolno tworzyć bezpośrednio, a jakie tylko jako candidate?
5. Czy zmiana membership w trakcie długiego runu przerywa cały run czy tylko chronione źródła?
