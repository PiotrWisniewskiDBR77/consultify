# Chat v8 - History and library model

> Status: Draft v8
> Cel: Zdefiniowac kanoniczny model historii, folderow i revisit workflow dla `Chat v8`.

---

## 1. Rola historii

Historia w `Chat v8` nie jest pobocznym panelem.
To biblioteka rozmow, ktora ma pozwalac:
- zaczac nowa rozmowe,
- wracac do starych,
- organizowac rozmowy,
- odrozniac ważne i archiwalne watki,
- odzyskiwac kontekst pracy.

---

## 2. Nadrzedny model

History/library workflow ma byc:

`recent/all -> pinned -> folder -> search -> archived -> open -> continue`

User nie moze miec poczucia, ze rozmowa "znika", gdy trafi do folderu albo archiwum.

---

## 3. Entity model

### 3.1 `Conversation`

Core pola:
- `id`
- `title`
- `titleSource`
- `lastMessagePreview`
- `messageCount`
- `starred`
- `archived`
- `chatFolderId?`
- `projectId?`
- `lastMessageAt`
- `createdAt`
- `updatedAt`

### 3.2 `ChatFolder`

Core pola:
- `id`
- `name`
- `scope` as `personal | team`
- `color`
- `description?`
- `conversationCount`
- `createdBy`
- `organizationId`

### 3.3 Relationship rule

`chatFolderId` sluzy do organizacji biblioteki.
`projectId` sluzy do business context.
To nie sa te same rzeczy.

---

## 4. Lifecycle rules

### 4.1 Create conversation

Nowa rozmowa moze byc tworzona:
- bez folderu,
- w kontekscie folderu,
- w kontekscie business project,
- w kontekscie split workspace.

Rules:
- create in folder musi ustawic folder semantics jawnie,
- create in project nie moze byc mylone z create in folder,
- `titleSource` startuje jako `auto`, dopoki user nie zmieni tytulu.

### 4.2 Rename

Rename:
- zmienia title,
- ustawia `titleSource = user`,
- zatrzymuje niechciane auto-retitle.

### 4.3 Pin / unpin

`pinned` in UI jest semantycznie `starred` w danych.
Ta roznica musi byc traktowana jako implementacyjna, nie produktowa.

### 4.4 Archive / unarchive

Archive nie usuwa rozmowy z systemu.
Przenosi ja do stanu archival access.

Rules:
- archived thread jest nadal odzyskiwalny,
- archive nie moze zrywac deep-linkingu,
- archived musi byc czytelnie odroznione od delete.

### 4.5 Delete

Delete to akcja destrukcyjna.
Musi miec:
- explicit intent,
- clear warning,
- predictable result.

### 4.6 Move between folders

Conversation moze:
- wejsc do folderu,
- wyjsc z folderu,
- przejsc z folderu do folderu.

Rules:
- DnD i modal move sa dwiema sciezkami do tej samej mutacji,
- move nie moze mylic folderu z PMO project.

---

## 5. View model

### 5.1 Required views

- `All or default library view`
- `Pinned`
- `Folder-scoped`
- `Search results`
- `Archived`
- `Unassigned`

`v8` musi jawnie opisac, czy default view pokazuje naprawde wszystkie rozmowy, czy tylko wybrany podzbior.

### 5.2 Grouping model

Current grouping is time-based plus pinned and archived.
`v8` przyjmuje to jako sensowny baseline, ale:
- grouping nie moze ukrywac rozmow,
- search i folder drill-in musza pozostac zrozumiale,
- group semantics musza byc stale.

### 5.3 Search model

Search musi miec dwa poziomy:
- `baseline`: title + preview search,
- `target`: scalable server-side search with filters and pagination.

Dokumentacja ma rozdzielac baseline od targetu.

---

## 6. Personal vs team folder contract

### 6.1 Personal folders

Sluza do prywatnej organizacji rozmow usera.

### 6.2 Team folders

Sluza do wspolnej organizacji w obrebie tenant/team scope.

### 6.3 Rules

- scope folderu musi byc widoczny,
- prawa dostepu nie moga byc zgadywane,
- personal i team musza miec ten sam lifecycle contract, chyba ze polityka mowi inaczej.

---

## 7. Handoff and revisit expectations

Powrot do rozmowy musi zachowywac:
- title,
- aktywny thread,
- folder/project relationship,
- language,
- attachments context if still relevant,
- route continuity where supported.

---

## 8. History anti-patterns to avoid

- traktowanie folderu i projectu jako tego samego,
- ukrywanie folderowych rozmow z default view bez jasnej logiki,
- mieszanie pin/star nazewnictwa bez wyjasnienia,
- niejasna roznica miedzy archive i delete,
- search, ktory udaje calosciowy, a obejmuje tylko lokalny subset.

---

## 9. Definition of done

History and library model jest domkniety, gdy:
- conversation lifecycle jest opisany end-to-end,
- folder semantics sa jednoznaczne,
- default, folder, search i archived views sa opisane bez luk,
- revisit behavior jest przewidywalny,
- `chat folder` i `PMO project` sa rozdzielone w produkcie i dokumentacji.
