---
id: VLT-005
tytul: Client Vault — warstwa tabeli sejfów (menu → tabela → dokumenty sejfu)
typ: zadanie
waga: wysoka
obszar: VLT
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Piotr 2026-07-24 (zrzut demo): wejście w Client Vault ma pokazywać tabelę sejfów jak Decisions, nie od razu upload"
utworzone: 2026-07-24
---

## 1. PROBLEM

Wchodząc w zakładkę **Client Vault** trafiasz od razu w narzędzie (Document Vault: upload + płaska lista dokumentów). Brakuje warstwy pośredniej. Konsultant ma **wielu klientów** — każdy z osobnym zestawem dokumentów. Powinno być jak w **Decisions**: zakładka → **tabela sejfów** → wejście do jednego → dopiero wtedy jego dokumenty. Cytat Piotra: „potrzebujemy mieć poziom segregowania pomiędzy przyciskiem z menu głównego a samym narzędziem".

## 2. PRZYCZYNA

`src/components/MyWork/MyWorkHub.tsx` — `case 'vault'` renderuje `DocumentsRAGTab variant="client"` bezpośrednio (bez warstwy listy). Wzór poprawny istnieje w tym samym pliku: `case 'decisions'` renderuje tabelę pozycji (kanon `src/components/standard/`). Vault nie ma dziś encji folderu/sejfu — ale są: encja `projects`, `my-memberships` (dorobka B), oraz `scope` osoba/projekt/org na `knowledge_docs`.

## 3. ROZWIĄZANIE

Decyzja Piotra: **sejf = klient/projekt** (reużyć encję projektów, zero nowej tabeli).
1. Ekran wejściowy zakładki `vault` = **tabela sejfów** (użyj kanonu `src/components/standard/` — skill `consultify-triada`, wzór jak `case 'decisions'`). Wiersze: **[Mój sejf]** (osobisty, scope=user) + **[Sejf organizacji]** (scope=org) + po jednym **na projekt/klienta** (z `my-memberships`). Kolumny: nazwa, liczba dokumentów, ostatnia zmiana.
2. Klik w wiersz → `DocumentsRAGTab` **przefiltrowany do tego sejfu** (scope + project_id). Breadcrumb „Sejf klienta › [nazwa]", powrót do tabeli.
3. Backend: endpoint listy sejfów z **licznikami dokumentów** per sejf (reużyj `my-memberships` + COUNT per scope/project na `knowledge_docs`). Bez migracji.
Zakres uploadu/3 poziomów bez zmian (to VLT-001..003) — tu tylko warstwa nawigacji.

## 4. KRYTERIUM ODBIORU

Master robi zrzut (dev-render/żywe demo, bez logowania Piotra): wejście w Client Vault pokazuje **TABELĘ sejfów** (nie od razu upload); jest Mój sejf + Sejf organizacji + sejfy per klient z licznikami; klik w sejf otwiera dokumenty TEGO sejfu z breadcrumbem i powrotem. Dark+light. Dopiero potem Piotr patrzy.

## 5. DOWODY

Gałąź `feat/vlt-005-sejfy` (`d0b5172c19`, baza origin/demo). Nie pushowana.
- `server/src/routes/knowledge.routes.ts` — `GET /api/knowledge/vault-safes`: jedno zapytanie `GROUP BY scope, project_id, owner_id` + `getMemberProjectIds` → Mój sejf + Sejf organizacji + sejf per projekt, z licznikiem dokumentów i `MAX(updated_at)`. **Zero migracji.**
- `src/views/vault/VaultSafesTable.tsx` (nowy) — tabela na `StandardTable` (kanon triady): nazwa / dokumenty / ostatnia zmiana, ikony rozróżniające typ sejfu.
- `src/views/superadmin/.../DocumentsRAGTab.tsx` — propsy `initialScope`/`initialProjectId` (poziom zablokowany na sejf, filtr poziomu ukryty w środku sejfu). Bez propsów zachowanie identyczne (drugi caller nietknięty).
- `src/views/vault/ClientDocumentsVault.tsx` — orkiestracja: brak wyboru → tabela; klik → dokumenty sejfu + breadcrumb „Sejf klienta › [nazwa]" + powrót.
- **`MyWorkHub.tsx` NIETKNIĘTY** — logika w `ClientDocumentsVault` (świadomie, zero konfliktu z równoległym AGT-010).
- `dev-render/screens/vault-safes-table.tsx` (`?screen=vault-safes-table`).
- **Master zweryfikował: zrzut tabeli sejfów** — DBR77 (3 dok.), Manufacturing (0), Mój sejf (2), Sejf organizacji (1), sortowalne kolumny. Wykonawca: klik w sejf filtruje dokumenty (Mój sejf → 2 dok., Level zablokowany „Private"; DBR77 → Level=Project prewypełniony, 3 dok.), breadcrumb wraca; dark+light; konsola czysta, żądania 200. esbuild+eslint 0 nowych.

**Do domknięcia po deployu:** zrzut z żywego demo (dziś render z mock-danymi).

## 6. DZIENNIK

**2026-07-24** — utworzone przez Mastera z uwagi Piotra (zrzut demo). Decyzja: sejf=klient/projekt (reużycie encji projektów). Baza: origin/demo (partia VLT wdrożona `7b1ba021c2`). Wzór: `case 'decisions'` + `consultify-triada`.
