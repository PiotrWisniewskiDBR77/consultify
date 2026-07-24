---
id: ART-021
tytul: Podgląd = tylko czytanie we wszystkich 6 kartach n-Type
typ: zadanie
waga: wysoka
obszar: ART
stan: do-odbioru
wlasciciel: piotr
blokuje: []
zablokowane_przez: []
zrodlo: "Decyzja właściciela 2026-07-24: „W Podglądzie żadnej akcji zmieniającej stan. Chcesz coś zmienić → przełącz na Edycję.\""
utworzone: 2026-07-24
ekran: karta-initiative
wysokosc: 900
klik: "Przełącz Edycja ⇄ Podgląd. W Podglądzie: brak przycisku w Menu 1, sekcja „Akcje\" mówi „Akcje są ukryte w trybie Podgląd\", kebab bez „Oznacz jako zablokowane\". W Edycji wszystko wraca. To samo na kartach Insight, Powiadomienie."
---

## 1. PROBLEM

Pstryczek Edycja|Podgląd blokował już pola i uchwyty na wszystkich sześciu kartach, ale **akcje** zostały niespójne. W Podglądzie — trybie „do pokazania klientowi" — dało się dalej zmienić stan artefaktu:

| Karta | Aktywne w Podglądzie PRZED |
|---|---|
| Inicjatywa | „Oznacz jako ukończone" (CTA Menu 1) · „Utwórz wariant" · „Oznacz jako zablokowane" (kebab) |
| Insight | „Konwertuj na inicjatywę" · „Zgłoś do recenzji" · 5 przycisków zmiany stanu · „Oznacz gotowe" · kafelki tworzenia · żywe pole komentarza |
| Powiadomienie | „Oznacz przeczytane" · „Odłóż" · „Ponów" (nadpisuje 5 pól) · „Zapisz jako notatkę" · „Wycisz to" · „Wycisz podobne" · „Usuń" (kebab) |
| Zadanie · Decyzja | — (wzór, chowały poprawnie) |
| Narzędzie | „Startuj sesję" — karta **nie ma** pstryczka (patrz §6) |

## 2. PRZYCZYNA

Każda karta chowała akcje własnym sposobem albo wcale. Istniejący `hideActions` **nie jest** równoważny Podglądowi — Decyzja wiąże go z zablokowanym etapem workflow, Inicjatywa z brakiem uprawnień; użycie go do chowania w Podglądzie zdjęłoby akcje także w Edycji.

## 3. ROZWIĄZANIE

Zastosowany **istniejący wzorzec Zadania i Decyzji**, bez nowego mechanizmu:
- sekcja „Akcje" prawego panelu → `isEmpty: readMode` + `emptyLabel: „Akcje są ukryte w trybie Podgląd"`,
- `NModeHeader.primaryAction` → `undefined` w Podglądzie,
- kompozytor komentarzy → `locked={readMode}` (ten sam prop, którym blokuje go Zadanie),
- kebab Menu 1 → pozycje zmieniające stan odpadają w Podglądzie.

**Świadomie ZOSTAWIONE w Podglądzie** (czytanie i nawigacja, nie zapis): „Otwórz dokument/źródło", „Kopiuj link", „Skopiuj kod obiektu", „Eksport…", „Tryb pokazu", „Analizuj z AI", rejestr „Już powstało", komunikat o błędzie AI (bez przycisku „Ponów").

## 4. KRYTERIUM ODBIORU

Zmierzone na własnym renderze (dev-render, port 3170), 6 kart × 2 tryby × light+dark, tryb rozstrzygany przez `aria-checked`, nie przez tekst:

| Karta | Zmieniających stan w PODGLĄDZIE (przed → po) | Aktywnych w EDYCJI (przed → po) |
|---|---|---|
| Inicjatywa | 2 (+1 w kebabie) → **0** | 76 → 76 |
| Insight | 8 (+1 żywe pole) → **0** | 86 → 86 |
| Zadanie | 0 → **0** | 48 → 48 |
| Decyzja | 0 → **0** | 57 → 57 |
| Powiadomienie | 4 (+3 w kebabie) → **0** | 26 → 26 |
| Narzędzie | 1 → **1** (brak pstryczka, patrz §6) | 17 → 17 |

Bramki (uruchomione ze **stagingiem**, tak jak robi to hook — bez tego skrypty nie widzą żadnego pliku i dają fałszywą zieleń):
- `check-artefakt.sh` — **zielona** (7 vs baseline 274, dług nie rośnie)
- `check-triada.sh` — **zielona** (3 pliki, brak nowych naruszeń crimson)
- `check-list-canon.sh` — **CZERWONA, dług zastany**, nie moja regresja. Te same 3 naruszenia (`InitiativeDocumentView`, `InsightViewer` ×2) wypadają identycznie na **pierwotnych** wersjach plików z `73519334e5`; zgodne ze sprostowaniem w `_AUDYT_GOTOWOSCI_ARTEFAKTY_2026-07-24.md` (11 naruszeń zastanych na demo).

esbuild na 3 dotkniętych plikach — czysto.

## 5. DOWODY

- Gałąź `fix/podglad-tylko-czytanie` (baza `odbior/hub-2026-07-23`)
- `src/components/Initiatives/InitiativeDocumentView.tsx` · `src/components/Interview/InsightViewer.tsx` · `src/components/MyWork/NotificationDetailView.tsx`
- Skrypt pomiaru: `scripts/probe-podglad-tylko-czytanie.mjs` (odtwarza tabelę wyżej)
- 24 zrzuty (6 kart × 2 tryby × light+dark) obejrzane przed pokazaniem właścicielowi

## 6. DO DECYZJI WŁAŚCICIELA

**Narzędzie nie ma pstryczka Edycja|Podgląd** — i to jest świadome: karta to biblioteka referencyjna read-only, backend `/api/known-tools` ma wyłącznie `GET`, a pstryczek zdjęto 2026-07-23 jako atrapę (nie sterował niczym). Jedyna akcja tej karty, „Startuj sesję", tworzy sesję narzędzia. Reguła „w Podglądzie nic nie zmienia stanu" jej nie dotyczy, bo Narzędzie nigdy nie jest „w Podglądzie" — ono po prostu nie ma trybu edycji. **Nie wyciąłem jej samowolnie**: to jedyne wejście do użycia narzędzia; wycięcie odebrałoby karcie sens. Do rozstrzygnięcia: zostaje tak, czy Narzędzie ma dostać pstryczek dla samej symetrii.

## 7. DZIENNIK

**2026-07-24** — wykonane i zmierzone na własnym renderze. Gałąź NIE scalona do hubu i NIE wypchnięta (promocja hubu w toku).
