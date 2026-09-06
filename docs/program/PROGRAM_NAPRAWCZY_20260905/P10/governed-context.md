# Kontekst zarządzany organizacji (`governed-context`)

**Status:** PROPOZYCJA — do słowa właściciela, z **jednym pytaniem klasyfikacyjnym otwartym**
(§0/§7). Pomiar 06.09.2026 z żywego stanowiska, zrzut `evidence/p10b8/07-organization-hub.png`
(redirect do `/organization/profile/identity-scale`) i `08-governed-context.png`
(`/organization/sources/claims-sources`, `bledyKonsoli: []`, rekord realny: 1 źródło z czatu,
1 twierdzenie oczekujące).

## §0. Tożsamość — i pytanie o klasyfikację

- Nazwa PL: **Kontekst zarządzany** (nagłówek karty: „Nadzorowany kontekst organizacji”) — przegląd
  twierdzeń pochodzących ze źródeł (czat/dokumenty/wywiady) i publikacja niezmiennych wersji
  kontekstu.
- Moduł: `01_ORGANIZATION`. Archetyp z inwentarza: **D — Matryca**, ale to klasyfikacja **do
  potwierdzenia** — patrz niżej.
- Trasa: `/organization/sources/claims-sources` (i alias `/organization/readiness/versions-
  publication` — ten sam komponent, `OrganizationView.tsx:296,299`). **Brak `:id` w adresie** —
  jeden egzemplarz na organizację, bez tożsamości rekordu w URL.
- Otwarcie: `/organization` → Menu 2 „Źródła i wiedza” → „Źródła i twierdzenia” (zakładka wewnątrz
  strony ustawień organizacji, nie osobny ekran-obiekt).
- Komponent: `src/components/Organization/GovernedContextWorkspace.tsx:107` (816 linii).
- Powłoka: **brak** — własne `<section>` z nagłówkami `<h2>`/`<h3>`, żaden `StandardArtifactShell`/
  `NModeShell`/`ArtifactRightPanel`.
- **Pytanie klasyfikacyjne (potwierdzone kodem, nie zgadywane):** Karta N w definicji SSOT
  (`ARTIFACT_ANATOMY_STANDARD.md` §13) to „ekran-obiekt otwierany z tożsamością” — trasa z `:id`
  albo `?artifact=`. Ten ekran nie ma żadnego z nich: to jedna, stała zakładka wewnątrz strony
  ustawień organizacji (`OrganizationView.tsx`), bez odrębnego rekordu do otworzenia z listy. Sama
  treść (twierdzenia, źródła, konflikty, wersje) ma tożsamości wewnątrz (`claim.claimId`,
  `source.itemId`), ale ekran jako całość nie jest instancją z adresem. **To jest dokładnie ta sama
  wątpliwość, którą inwentarz już oznaczył jako „do rozstrzygnięcia: obiekt-organizacja czy ekran
  ustawień”** (`INWENTARZ_KART_N_PELNY.md` wiersz 68 i §5).

## §1. Sekcje (centrum ekranu)

Nie ma katalogu sekcji — pięć `<section>` na sztywno w JSX:

| sekcja | po co użytkownikowi | źródło danych → writer | reguła pustki | S/L |
|---|---|---|---|---|
| Sources (`:510-547`) | jakie źródła są widoczne (typ + zakres widoczności) | `organizationGovernedContextApi` → `GET` lista źródeł (serwis, plik dedykowany) | „No visible governed sources” gdy pusto | — |
| Conflicts (`:549-581`) | które twierdzenia się kłócą między źródłami | wyliczane z listy `claims` po stronie klienta (grupowanie po `claimPath`) | „No conflicting visible claim values” | — |
| Claims (`:584-646`) | lista twierdzeń do zatwierdzenia/odrzucenia | `claim.value/sourceType/confidence/reviewState` → `GovernedContextApi` (approve/reject) | „No sourced claims are waiting…” | — |
| Versions (`:648-713`) | historia opublikowanych, niezmiennych wersji kontekstu | `GovernedSnapshotVersion[]` | — | — |
| Publish panel (`:716-810`) | upload dokumentu źródłowego + publikacja zatwierdzonych twierdzeń | upload multipart z idempotency-key (`stableUploadKey`, `:26-39`) | — | — |

Realny, żywy rekord na zrzucie: 1 źródło („Wiadomość czatu”, zasięg „Cała organizacja”), 0
konfliktów, 1 twierdzenie oczekujące („Kontekst z czatu”, 85% pewności, status „Oczekuje na
decyzję”), 0 opublikowanych wersji.

## §2. Prawy panel

**Brak w ogóle** — nie ma `ArtifactRightPanel`. Akcje (Zatwierdź/Odrzuć twierdzenia, upload
dokumentu, publikacja) są rozsiane inline wewnątrz sekcji, nie w panelu bocznym. K6–K11 wszystkie
✗ z braku powłoki.

## §3. Menu 5 i nawigacja

Brak w całości — pojedyncza przewijana strona, bez lewego spisu sekcji, bez „Edycja/Podgląd”, bez
„Pracuj z AI”. Nagłówek strony to `<div>`, świadomie NIE `<header>`, żeby nie dublować landmarku
axe `banner` obok istniejącego nagłówka strony organizacji (komentarz autora, `:409-412` — dobra
praktyka dostępności, ale potwierdza brak własnego Menu 1/4).

## §4. AI — zero, i to jest zgodne z DEC-419

**Zero wzmianek „Teresa” w tym pliku** (grep pełny, potwierdzone). To jest **zgodne** z zadaniem
(„po DEC-419 bez «Zapytaj Teresę o kontekst»”) — usunięcie się utrzymało. Jedyna wzmianka Teresy w
tym obszarze produktu żyje w **sąsiednim** komponencie: `OrgContextSummaryBanner.tsx:202`
(„Teresa korzysta z tego kontekstu, aby odpowiadać na Twoje pytania”, klucz
`organization.context.banner.teresaUsing`), potwierdzone na żywo zrzutem
(`08-governed-context.png.json`, tekst „Kontekst Teresy: 1 elementów… Teresa korzysta z tego
kontekstu…”) — ale to banner strony organizacji, renderowany **obok** `GovernedContextWorkspace`,
nie wewnątrz niego. Nie liczę tego jako naruszenie K27 TEJ karty, bo nie jest jej częścią —
odnotowuję dla ścisłości, bo leży dosłownie nad tym samym ekranem.

Brak `<PracujZAI>`, brak wpisu `governed_context`/`organization_context` w `cardAnalysisRubric.ts`
ani `registry.ts` (K21/K24 ✗ formalnie).

## §5. Czytelność

- `grep -c "primary-[0-9]"` = 0 (K17 ✓).
- **K28 naruszone, potwierdzone na żywo.** Sekcja Claims renderuje `renderValue(claim.value)`
  (`:42-48`) — dla twierdzenia „Kontekst z czatu” to surowy `JSON.stringify` z **UUID w treści**:
  zrzut (`08-governed-context.png.json`) pokazuje dosłownie
  `"conversationId": "a52bf840-143a-40f7-b784-b403ec18998e"` i `"messageId": "8989a523-..."` w
  widocznym DOM. To dokładnie zakazany kształt K28 („użytkownik nie widzi UUID… w widocznym DOM”).
- **K25 naruszenie z plik:linia, potwierdzone na żywo w sąsiedniej karcie tej samej rodziny**
  (`toolConclusionBridge.ts`, patrz `conclusion.md` tej samej partii) — nie dotyczy bezpośrednio
  tego pliku, ale ten sam wzorzec „`renderValue`/JSON surowy zamiast czytelnego tekstu” występuje
  tu jako K28, tam jako K25.
- Kod ma już przemyślaną warstwę humanizacji (`sourceTypeLabel`, `reviewStateLabel`,
  `visibilityScopeLabel`, `claimPathLabel`, `:60-79`) z komentarzem autora wyjaśniającym, że to
  reakcja na uwagę Piotra o „surowych/niezrozumiałych” kodach na `org-claims-sources` i
  `org-source-conflicts` — czyli **connaissance** o problemie już istnieje, tylko nie objęła
  `claim.value` (samej treści twierdzenia), tylko jego metadanych (typ/status/zakres).
- K19: n/d — to nie jest karta z pigułką modułu w klasycznym sensie (§0 pytanie klasyfikacyjne).
- K20: zrzut 1440 bez poziomego przewijania.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | 5 `<section>` na sztywno |
| K6–K11 prawy panel | ✗ (wszystkie) | brak `ArtifactRightPanel` (§2) |
| K12 Menu 5 | ✗ | brak w całości (§3) |
| K16 klasa S/L | n/d | brak wpisu w rejestrze, brak drabiny otwierania z listy (§0) |
| K17 zero primary | ✓ | 0 trafień |
| K19 pigułka modułu | n/d | pytanie klasyfikacyjne (§0) — jeśli to NIE jest karta N, K19 nie ma zastosowania |
| K21 Pracuj z AI | ✗ | zero AI w ogóle (§4) |
| K27 Teresa tylko Menu 1 | ✓ **dla tego pliku**; sąsiedni banner ma wzmiankę poza Menu 1 (nie ten plik) | §4 |
| **K28 zero UUID w DOM** | **✗** | `conversationId`/`messageId` surowe w treści twierdzenia, potwierdzone zrzutem (§5) |
| K29 zero błędów konsoli | ✓ | `bledyKonsoli: []` |
| K30 zrzut 1440 z realnym rekordem | ✓ | `08-governed-context.png`, rekord realny (1 źródło, 1 twierdzenie) |

## §7. Luki → naprawa

1. **K28 — ukryć surowe pola techniczne w treści twierdzenia.** `renderValue()` (`:42-48`) powinna
   rozpoznawać znane kształty (`conversationId`/`messageId`) i albo je pomijać z widoku, albo
   humanizować (np. „Wiadomość z rozmowy X, 6 wrz”) zamiast `JSON.stringify` w całości. Wzorzec do
   naśladowania: `sourceTypeLabel`/`claimPathLabel` już w tym pliku (`:60-79`) — ten sam typ
   naprawy, inny fragment danych. Rozmiar: M.
2. **Zapisać string „Tool-derived conclusion…” po polsku** — nie dotyczy tego pliku wprost, ale
   tej samej rodziny problemu (`toolConclusionBridge.ts`, patrz `conclusion.md`).

**Pytanie do właściciela (max 1, zgodnie z limitem partii):** czy `governed-context` ma wejść do
kanonu Karty N (SPEC-A, `ArtifactRightPanel`, Menu 5) mimo braku tożsamości w adresie — traktując
organizację jako niejawny, singletonowy „rekord” — czy zostaje ekranem ustawień poza tym kanonem
(jak inne zakładki `OrganizationView`)? Rekomendacja: **zostaje ekranem ustawień, poza kanonem Karty
N.** Uzasadnienie: żaden inny fragment `OrganizationView` (Tożsamość, Cele, Wyzwania, Synteza,
Gotowość) nie jest kartą N mimo analogicznej budowy (zakładka strony, nie obiekt z adresem) — objęcie
tylko tej jednej zakładki kanonem tworzyłoby niespójność w obrębie tego samego modułu. Naprawa #1
(K28) zostaje aktualna niezależnie od odpowiedzi na to pytanie.

**STOP:** brak w sensie blokującym — pytanie klasyfikacyjne jest jedynym otwartym punktem i nie
wstrzymuje naprawy #1 (K28), która obowiązuje niezależnie od odpowiedzi.
