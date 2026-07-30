# HANDOFF — doprowadzenie tabel do kanonu (przegląd 2, 2026-07-28)

> Dokument przekazania pracy. Poprzednia sesja wyczerpała okno kontekstu.
> **Czytaj w całości przed pierwszą linijką kodu.**

---

## 1. MISJA

Doprowadzić **wszystkie ekrany listowe** Consultify do kanonu TRIADA. Nie „poprawić parę
rzeczy" — przejść produkt widok po widoku i dla **każdego** sprawdzić sześć elementów,
które Piotr wymienił jako standard:

**Menu 1 · Menu 2 · Menu 3 · tabela · kebab (menu wiersza) · preview** — plus kolory,
układy i odległości.

Metoda zamówiona przez Piotra dosłownie:
> „przeanalizować dla każdego view i wytypować błędy, a następnie zrobić listę błędów
> i krok po kroku je poprawić"

---

## 2. GDZIE TO JEST

| Co | Gdzie |
|---|---|
| **Gałąź** | `fix/przeglad-2026-07-28` (na GitHubie, commit `c124313e65`) |
| **Baza** | `origin/demo` `e299a33b30` — ★ demo ŻYJE, zawsze `git fetch` przed pracą |
| **Zrzuty Piotra** | `rejestr/_zrzuty/2026-07-28/` — **74 PNG**, chronologicznie = kolejność przechodzenia |
| **Rozliczenie** | `Harvard/wdrozenie-100/_PRZEGLAD_2_TABELE_2026-07-28.md` |
| **★ MACIERZ + LISTA BŁĘDÓW** | `Harvard/wdrozenie-100/_PRZEGLAD_2_MACIERZ_2026-07-28.md` ← **punkt wejścia** |
| Przegląd źródłowy (wczoraj) | `Harvard/wdrozenie-100/_ODBIOR_TABELE_PREVIEW_2026-07-27.md` (28 uwag P-*, 13 PILNE-*, 107 N-*) |
| Kanon | `docs/ui-standards/TRIADA_KANON.md` + skill `consultify-triada` + `consultify-preview` |

**Poprzednia fala** (24 commity) jest już **na demo** jako `77d04f623a`,
tag `demo-safe-2026-07-28-tabele`. Ta gałąź to **druga** iteracja, po tym jak Piotr
przeszedł produkt ponownie.

---

## 3. STAN: CO ZROBIONE, CO ZOSTAŁO

### Zrobione w tej gałęzi (1 commit)
- **Daty w całym My Work** → `formatListDate`: Inbox (RECEIVED), Tasks (DUE DATE), Run agent (DATE + harmonogram)
- **Atrapy z etykietą `soon`** — wzorzec `czyAtrapa` rozszerzony (szukał tylko „coming soon"), + 2 nowe przypadki w strażniku
- **PILNE-2** `Source: manual` ×2 w podglądzie Idei — usunięty duplikat z `relationItems`
- **P-4** kebab ⋮ w bloku DETAILS Idei — dodany w **`IdeasTableContent`** (poprzednio trafiło w zły plik)
- **P-24 Finance** dokończone — `entityName` + **drugi** blok mapowania (3085–3088)

### Przejrzane zrzuty: **10 z 74**
Ideas (lista/preview/kebab, dark+light), Inbox (lista+preview), Tasks, Run agent,
Tools→Library, Finance→Statements.

### Do przejrzenia: **64 zrzuty**
Decisions, Notebook, Client Vault, Interview ×6 zakładek, Documents ×4, Results, Execution, Audits.

### Lista błędów do naprawy
W `_PRZEGLAD_2_MACIERZ_2026-07-28.md`, pogrupowana:
- **G1** — jedna przyczyna, wiele ekranów (największy zwrot)
- **G2** — pojedyncze ekrany (G2-1…G2-10)
- **G3** — dane, nie kod

---

## 4. ★★★ TRZY PUŁAPKI, KTÓRE KOSZTOWAŁY MNIE DZIEŃ

Piotr ocenił pierwszą falę: *„nie zrobiłeś nawet połowy"*. Miał rację, a przyczyna była
zawsze ta sama — **naprawa wyglądała na zrobioną, bo kod się kompilował i testy przechodziły**.

### 4.1 Naprawa w NIEWŁAŚCIWYM komponencie
Ekran Idei idzie łańcuchem:
`MyWorkHub` → **`MyIdeasListContent`** → (dla `viewMode='table'`) → **`IdeasTableContent`**

Naprawiłem `MyIdeasListContent` — czyli widok **kart**. Tabelę i jej podgląd renderuje
`IdeasTableContent`. Na ekranie zero zmiany, a ja zaraportowałem „zrobione".

→ **Zanim naprawisz: sprawdź, który plik REALNIE renderuje to, co widać na zrzucie.**
`grep` na hub → zobacz co montuje → sprawdź delegacje wewnątrz.

### 4.2 Jedno z DWÓCH miejsc
`FinanceHub` mapuje dane w **dwóch** blokach (851–866 i 3085–3088). Sanityzowałem pierwszy,
ekran karmi się z drugiego. Do tego kolumna NAME czyta `entityName`, którego nie było
w żadnym.

→ **Po każdej naprawie `grep` na WSZYSTKIE wystąpienia wzorca**, nie tylko pierwsze.

### 4.3 Fałszywa zieleń w Playwright
Sześć testów świeciło na zielono **nad zasłoniętym ekranem** — modal powitalny ma
„Skip for now", a skopiowany helper szukał „Skip tour". Asercje czytały treść modala.
Drugi raz: stałe `waitForTimeout` przepuszczało pomiar na spinnerze (17 znaków tekstu).

→ **Po przejściu e2e ZAWSZE obejrzyj zrzut.** Wynik testu nie wystarcza.
→ Onboarding wyłączaj przez `consultify_onboarding_done:{userId}` w localStorage.
→ `E2E_MOCK_DB` **nie niesie danych** — potwierdza strukturę, nie treść wierszy.

---

## 5. ZASADY PRACY (z CLAUDE.md, nienaruszalne)

1. **Piotr nigdy nie jest pierwszym testerem wizualnym** (reguła #7). Zrzut robisz TY,
   zanim on spojrzy. Harness: `dev-render/screens/`, uruchamiany bez logowania.
2. **Baza gałęzi zawsze `origin/demo`**, nigdy Londyn ani `tp-*`.
3. **Praca w izolowanym worktree**, nie w głównym drzewie (współdzielone z innymi sesjami).
4. **Zero force-push** na demo. Cofnięcie idzie DO PRZODU (`git revert -m 1`).
5. **`tsc --noEmit` z `NODE_OPTIONS=--max-old-space-size=8192`** — i sprawdź, czy bramka
   nie padła, zanim zinterpretujesz wynik (pusty output przy crashu wygląda jak sukces).
6. **Baseline mierz TYM SAMYM poleceniem** w osobnym worktree — nigdy `git stash`
   (jest wspólny dla repo).
7. Demo ma **~434 czerwone testy zastane** — sprawdź baseline, zanim uznasz coś za swoją regresję.

---

## 6. OTWARTE DECYZJE PIOTRA (nie rób bez odpowiedzi)

| Sprawa | Dlaczego czeka |
|---|---|
| **D-02 folder w każdej liście** | To NIE propagacja UI. `folder_id` istnieje wyłącznie w `my_ideas`; dla innych encji = migracja bazy + generyczne endpointy. Uwaga: równoległa sesja robi `FolderCreateDialog` — sprawdź, czy nie dubluje |
| **Linia rekomendacji** (kanon A7.2) | W Decisions pochodzi z endpointu AI `/decisions/:id/brief`. Kopiowanie = endpoint per encja. Wariant bez AI to projektowanie, nie propagacja |
| **Fala 4** | Results (D-04 brak listy pośredniej), Finance (D-05 rekonstrukcja), kalendarz Tasks (P-13) — wymagają decyzji produktowych |
| **Migracja `MyWorkHub`** | 4152 linie, jedyny z 12 hubów bez `StandardModuleBar` (bramka R2b). Tłumaczy dublet CTA, różne wysokości kontrolek, brak segmentów. Analogiczna migracja 07-26 dała 3 regresje propów |

---

## 7. NIEPOTWIERDZONE — sprawdź, zanim ruszysz

**N-1: nagłówki Ideas rzekomo Title Case.** Kod ma `uppercase` w `<th>` w **siedmiu**
miejscach, identycznie w wersji z demo Piotra (`0bc0a4df0b44`). Albo źle odczytałem
drobny font z `tracking-wider`, albo problem leży gdzie indziej.
**Nie „naprawiaj" czegoś poprawnego** — najpierw zweryfikuj wzrokiem albo przez DOM.

---

## 8. PIERWSZE TRZY KROKI NASTĘPCY

1. `git fetch origin demo` → sprawdź, czy demo się nie ruszyło; jeśli tak, domerguj
2. Przeczytaj `_PRZEGLAD_2_MACIERZ_2026-07-28.md` — tam jest lista i kolejność
3. Przejrzyj kolejne zrzuty z `rejestr/_zrzuty/2026-07-28/` (od 11. w kolejności
   chronologicznej), uzupełniając macierz — i dopiero potem naprawiaj

Po każdej grupie napraw: `tsc` + strażniki + **zrzut na dowód**, potem karta do
`rejestr/3-DO-ODBIORU/`.
