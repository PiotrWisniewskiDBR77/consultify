---
doc_id: NOTEBOOK_STRUCTURE_SSOT
doc_kind: PRODUCT_SSOT
module_id: MODULE_MY_WORK
function_id: MW_NOTEBOOK
version: 1.0
owner: user
status: canonical
last_updated: 2026-06-02
supersedes_on_structure:
  - docs/product/NOTEBOOK_V3.md          # (rola/linki/AI — nadal obowiązuje; struktura kontenerów = TEN dokument)
  - docs/modules/LIVING_NOTEBOOK_MODULE.md
  - docs/UI_UX/28_IDEA_NOTEBOOK_UX.md
aligns_with:
  - docs/modules/02_moja-praca/functions/MW_NOTEBOOK.md  # Folder-first IA (kanon funkcji)
---

# Notebook — struktura notatników (SSOT)

> **Cel:** Jedno źródło prawdy dla *struktury* modułu Notatki w My Work: hierarchia,
> model kontenera (notatnik), typologia dostępu (personal/team), udostępnianie do
> kontekstu organizacji oraz powiązanie z resztą systemu.
> Ten dokument **rozstrzyga strukturę**. Pozostałe dokumenty Notebooka (rola, linkowanie,
> AI, provenance, lifecycle) obowiązują dalej tam, gdzie nie kolidują ze strukturą.

---

## 0. Dlaczego ten dokument istnieje (reconciliation)

Do tej pory Notebook był opisany w trzech rozjeżdżających się dokumentach:

| Dokument | Co wnosi | Status wobec struktury |
|---|---|---|
| `MW_NOTEBOOK.md` (kanon funkcji) | IA „Folder-first": `Notatki → tabela folderów → karty` | ✅ **bazą struktury jest ten kontrakt** |
| `NOTEBOOK_V3.md` | Rola, embedded refs, backlinks, AI command, create-from-note | ✅ obowiązuje (warstwa zawartości, nie struktury) |
| `LIVING_NOTEBOOK_MODULE.md` | Wizja „żywej bazy wiedzy", Knowledge Pulse | ✅ obowiązuje jako wizja/outcome |
| `28_IDEA_NOTEBOOK_UX.md` | Quick capture, enrichment, memory candidates, governance | ✅ obowiązuje (governance + roadmapa) |

**Decyzja terminologiczna:** kontener nazywamy **Notatnik** (UI-facing, język użytkownika).
W kanonie `MW_NOTEBOOK.md` ten sam byt występuje jako `Folder`. Traktujemy je jako
synonim na poziomie struktury; `Notatnik` jest nazwą produktową, `Folder` — legacy aliasem.

---

## 1. Docelowa hierarchia (potwierdzona)

Dodajemy **jeden** nowy poziom na samej górze (lista notatników). Reszta już istnieje.

```
Poziom 0 — Wejście:        zakładka "Notatki" w My Work                     [istnieje]
Poziom 1 — Lista notatników:  tabela notatników (jak tabela Idei)           [NOWY]
Poziom 2 — Workspace notatnika: lewa lista notatek (tematów) + prawa treść  [istnieje → "wnętrze notatnika"]
Poziom 3 — Karta notatki:    pojedyncza notatka (edytor TipTap)             [istnieje]
```

- Lista notatników jest **płaska** — bez zagnieżdżania (brak podnotatników/podfolderów).
  Grupowanie zapewnia typologia (`personal`/`team`) i filtry, nie drzewo.
- To, co dziś widać po wejściu w Notatki (lewa lista + prawa treść), staje się
  **Poziomem 2** — wnętrzem wybranego notatnika. Nie przebudowujemy edytora.

---

## 2. Model kontenera (Notatnik)

Notatnik jest **własnością osoby** i jest **cross-projektowy**.

### 2.1 Dwie niezależne osie

Świadomie rozdzielamy „kto widzi" od „czy zasila AI organizacji". To różne pytania.

**Oś A — Dostęp (`scope`): kto może otworzyć/edytować notatnik w UI**
- `personal` → tylko właściciel (`owner_user_id`).
- `team` → właściciel + członkowie wskazanego zespołu (`team_id` → `team_members`).
  Użytkownik bywa w wielu zespołach, więc typ `team` MUSI wskazywać który (`team_id`).

**Oś B — Kontekst (`context_sharing`): czy treść zasila AI/pamięć organizacji**
- `private` → treść notatnika nie wchodzi do kontekstu org (**DOMYŚLNIE**).
- `org_context` → treść może być użyta jako kontekst/memory na poziomie organizacji,
  zgodnie z governance (memory candidates + approval, deny-by-default).
- **Niezależne od `scope`.** Notatnik `personal` może (świadomie) zasilać kontekst org;
  notatnik `team` może być z niego wyłączony (np. wrażliwe notatki o kliencie).

> Zgodne z kanonem: *„private/restricted notes are deny-by-default for broader context usage;
> memory promotion remains explicit and policy-governed"* — `MW_NOTEBOOK.md §10`.

### 2.2 Relacja do projektu

- Notatnik **nie jest** przypięty do projektu (`projectId` nie istnieje na kontenerze).
- Projekt może pozostać **tagiem na pojedynczej notatce** (poziom 3), nie na notatniku.
- Powód: notatnik to osobista, cross-projektowa przestrzeń myślenia właściciela.

---

## 3. Model danych

### 3.1 Nowa encja `notebook` (kontener)

```
notebook
  id                TEXT PK
  owner_user_id     TEXT NOT NULL        -- właściciel (osoba)
  organization_id   TEXT NOT NULL        -- granica tenant
  title             TEXT NOT NULL
  icon              TEXT NULL
  scope             TEXT NOT NULL DEFAULT 'personal'   -- 'personal' | 'team'
  team_id           TEXT NULL            -- wymagane gdy scope='team'
  context_sharing   TEXT NOT NULL DEFAULT 'private'    -- 'private' | 'org_context'
  created_at        TIMESTAMP
  updated_at        TIMESTAMP
```

### 3.2 Zmiana w `notebook_pages`

- Dodajemy `notebook_id TEXT` (FK → `notebook.id`).
- `visibility` (`private`/`project`) na stronie — do rewizji: dostęp ustala teraz
  notatnik (oś A). Page-level visibility zostaje dla zgodności wstecznej; docelowo
  dostęp dziedziczony z notatnika.

### 3.3 Migracja istniejących notatek

- Dla każdego użytkownika z istniejącymi `notebook_pages` tworzymy **notatnik domyślny**
  (`scope='personal'`, `context_sharing='private'`), np. „Moje notatki".
- Wszystkie dotychczasowe płaskie strony dostają `notebook_id` tego notatnika.
- Zero utraty danych; dotychczasowy widok = wnętrze notatnika domyślnego.

---

## 4. Reguły dostępu (access control)

Rozszerzenie `canAccessNotebookRow` o poziom kontenera:

```
dostęp do notatnika (i jego notatek):
  if owner_user_id == userId            -> ALLOW
  if scope == 'team' and userId ∈ team_members(team_id) -> ALLOW (rola decyduje o edit/view)
  else -> DENY

kontekst AI org:
  treść notatnika trafia do kontekstu org TYLKO gdy context_sharing == 'org_context'
  i przeszła governance (memory candidate approval).
```

- Tenant boundary twarda: zawsze filtr po `organization_id`.
- UI nie myli „brak uprawnień" z „brak danych" (kanon UX 28).

---

## 5. Co reużywamy z Idei (wzorzec listy-kontenerów)

Poziom 1 (lista notatników) odwzorowuje sprawdzony wzorzec Idei:

- Komponent listy: wzór `MyIdeasListContent` (tabela/grid) → nowy `NotebookLibraryContent`.
- Routing: `/my-work/notebook` (lista) + `/my-work/notebook/{notebookId}` (workspace)
  + `/my-work/notebook/{notebookId}/{pageId}` (konkretna notatka). Wzór z `RouterSync`.
- Stan otwarcia: `activeDocumentId`-owy wzorzec w `MyWorkHub` (lista vs otwarty kontener).
- Recents/Favorites: hooki na wzór `useRecentIdeas` / `useFavoriteIdeas`
  (klucze `consultify.mywork.notebooks.*`).

Różnica wobec Idei (świadoma): Idee = płaska przestrzeń z widokami; Notatki = 2 poziomy
(lista notatników → wnętrze). To jest zamierzone.

---

## 6. Zakres v1 vs odłożone

**W v1:**
- Lista notatników (poziom 1) + CRUD notatnika.
- Typologia `scope: personal | team` (+ `team_id`).
- Flag `context_sharing` (domyślnie `private`).
- Migracja do notatnika domyślnego.
- Wnętrze notatnika = obecny edytor bez zmian funkcjonalnych.

**Odłożone (świadomie):**
- Real-time collaborative editing / presence (kanon: MVP5; LIVING_NOTEBOOK §6 „później").
- Zagnieżdżanie notatników (podfoldery).
- Pełen transfer własności i historia udostępnień — do zaprojektowania jako kolejny krok
  (oś A daje już dostęp teamowy; transfer/historia to rozszerzenie).
- Semantic search / memory candidates UI — istnieje infra (embeddings, FTS), spinamy później.

---

## 7. Otwarte decyzje (do rozstrzygnięcia w trakcie)

- Rola w `team_members` a prawo edycji vs tylko podgląd notatnika teamowego.
- Czy `context_sharing` działa na całym notatniku, czy per-notatka (rekomendacja: na notatniku, prościej).
- Finalne kopie stanów degraded/empty dla poziomu 1 (pusta biblioteka notatników).
- Czy transfer własności + historia udostępnień wchodzą zaraz po v1, czy później.

---

## 8. Kryterium gotowości struktury

- Wejście w „Notatki" pokazuje **listę notatników** (nie od razu edytor).
- Można utworzyć notatnik `personal` i `team` (z wyborem zespołu).
- `context_sharing` jest jawnym przełącznikiem, domyślnie OFF.
- Istniejące notatki są dostępne w notatniku domyślnym (zero utraty).
- Otwarcie notatnika pokazuje dotychczasowy workspace (lewa lista + prawa treść).
