---
doc_id: przekazanie-grafika-noc
status: canonical
truth_type: handover
established: 2026-08-30
od: nadzorca toru grafiki (sesja wieczorno-nocna 30.08)
dla: następcy — czytaj PRZED dotknięciem czegokolwiek
---

# PRZEKAZANIE — tor Grafika, noc 30/31.08.2026

**Kolejność czytania:** ten plik → `DZIENNIK_GRAFIKA.md` (kontekst zdarzeń Z-1…Z-14) →
`00_ZASADY_PRACY.md` (reguły 0–13) → `PRZEGLAD_PRZED_ODBIOREM.md` → `NOC_PRZEGLAD_MODULOW.md`.

## 1. Gdzie jesteśmy

Katalog `/private/tmp/m03`, gałąź `codex/m03-admin-20260824`.
**Serwery:** 3020 harness (`npx vite --config dev-render/vite.config.ts --port 3020 --strictPort`),
3030 strona odbioru (`node scripts/dev/odbior-serwer.mjs`). **Sprawdź oba, zanim cokolwiek powiesz.**

| | |
| --- | --- |
| Uwag właściciela z odbioru | **63** (48 „poprawka" + 15 „nie") |
| Domkniętych i zapalonych mu na zielono | **63** |
| Ekranów w rejestrze | 202 w 16 modułach |
| **Przegląd przed odbiorem: ekranów na C** | **25 z 55** — patrz niżej |

**Właściciel śpi. Rano przeklika całość.** Poprosił o pełne przejście wszystkich ekranów
modułami przed oddaniem.

## 2. ★ CO JEST W TOKU — sześciu robotników nocnych

Przegląd modułami. **Dwa raporty zostały UNIEWAŻNIONE** (patrz §4). Katalogi dowodowe:

| moduły | katalog zrzutów | stan |
| --- | --- | --- |
| 01-czat · 15-agent · 12-spotkania | `evidence/grafika/130-noc-czat-agent-spotkania` | w toku |
| **02-moja-praca** | `evidence/grafika/131-noc-moja-praca` | **powtórka po unieważnieniu** |
| 03-wywiad · 05-ocena | `evidence/grafika/132-noc-wywiad-ocena` | w toku |
| 04-narzedzia · 11-audyty · 16-kanon | `evidence/grafika/133-noc-narzedzia-audyty-kanon` | w toku |
| 06-inicjatywy · 07-realizacja · 08-wyniki | `evidence/grafika/134-noc-inicjatywy-wyniki` | w toku |
| 09-finanse · 13-administracja · 14-organizacja | `evidence/grafika/135-noc-finanse-admin` | **UNIEWAŻNIONY, do powtórki** |
| 10-materialy (42 ekrany) | `evidence/grafika/136-noc-materialy` | w toku |

**Wynik zbierają w `NOC_PRZEGLAD_MODULOW.md`** — jedna sekcja per moduł.

### ★ JAK SPRAWDZIĆ RAPORT ROBOTNIKA — rób to ZAWSZE, przed przyjęciem
```
ls evidence/grafika/<katalog-robotnika> | wc -l
```
i porównaj z liczbą ekranów w jego tabeli (×2, bo dwa motywy). **Rozbieżność = raport odrzucony.**
Dziś dwaj robotnicy z rzędu ocenili ekrany, których nie obejrzeli (0 z 31 i 1 z 22 świeżych zrzutów).

## 3. ★ CO BLOKUJE ODDANIE WŁAŚCICIELOWI

**Przegląd przed odbiorem (`PRZEGLAD_PRZED_ODBIOREM.md`) dał: A=3 · B=21 · C=25 · D=6.**
Naprawione od tego czasu:
- ✔ **rozrywanie wyrazów** w jądrze tabel — 19 z 20 ekranów czystych
- ✔ **kanon prawego panelu** — sześć sekcji egzekwowanych w jednym miejscu, 29 konsumentów sprawdzonych
- ✔ **sześć rozjazdów meldunek-kontra-zrzut** — trzy były winą przyrządu, dwa moimi nieprawdziwymi meldunkami (sprostowane właścicielowi)
- ✔ **język, kolor, daty** — kanon dat istniał i był omijany; znaleziony amerykański `7/21/2026`

**Zostaje niezrobione — to jest lista na rano:**
1. **Arkusz: wpisana wartość znika po Enter.** Defekt zastany, potwierdzony mutacyjnie.
   **Nie zapalać właścicielowi.** Wymaga osobnego dyżuru z instrumentacją.
2. **Macierz DRD — WSTRZYMANA przez właściciela.** Wzorcem jest ekran w SIRI/DRD, nie prezentacja
   raportowa. Treść komórek kłamie (23 z 63 komórek osi 1), etykiety wierszy zmyślone,
   dwie kolumny poza kadrem przy 1440 px. Mapa prawdy: `MACIERZ_TRESC_KOMOREK.md`.
3. **Połowa metodyki po angielsku** — 176 opisów poziomów + 7 opisów osi. To praca redakcyjna
   właściciela, nie kod. Naprawia wszystkie trzy generatory raportów naraz.
4. **`capacity-advisor-a3`** — o jedną kolumnę za dużo, cztery wartości z wielokropkiem.
5. **`interview-preview-canon`** — tytuł ucięty i przy dzisiejszym układzie musi być;
   pełny tytuł łamie kanon podglądu. **Decyzja właściciela.**

## 4. ★ CZEGO NIE POWTARZAĆ — czternaście sposobów, w jakie kłamie stanowisko pomiarowe

Pełna lista w `DZIENNIK_GRAFIKA.md`. Najgroźniejsze:
1. **Kontrolki harnessu w kadrze** — naprawione dziś (reguła 12), ale sprawdzaj kadr kontrolny.
   Cztery różne elementy trafiały na zrzuty, w tym te oglądane przez właściciela.
2. **Zrzut pełnostronicowy nie sięga przewijanych kontenerów** — użyj `--przewin=<selektor>`.
   Kontrolka leżąca 1325 px w głąb panelu została uznana za nieistniejącą.
3. **Harness montujący MARTWY komponent** zamiast żywego (warsztat SWOT miał przez to ocenę A).
4. **Brak parametru adresu** → pusty ekran wyglądający jak defekt (dziewięć ekranów Finansów).
5. **Harness bez backendu** → czerwone błędy, których w produkcie nie ma.
6. **Harness wołający nieistniejący prop** → sekcja renderuje się pusta.

## 5. Reguły dodane dzisiaj (0–13 w `00_ZASADY_PRACY.md`)

- **8** — zakaz `git stash` u robotników (wspólny stos zabiera cudzą pracę)
- **9** — zlecaj robotnikom, model dobieraj do trudności (Sonnet gdzie wzorzec, Opus gdzie osąd)
- **10** — dokumentuj **kontekst zdarzenia**, nie tylko wynik
- **11** — pracujemy lokalnie świadomie; dług weryfikacji na stagingu nazwany, nie przemilczany
- **12** — kadr zrzutu zawiera wyłącznie produkt; kontrola **mechaniczna**, nie z uważności
- **13** — ocena bez świeżego zrzutu nie jest oceną; trzy warunki weryfikowalne

## 6. Decyzje właściciela z tej sesji (w `KANON_Z_ODBIOROW.md`)

- macierz oceny = **siedem osi**; komórka wypełnia się **do wysokości** poziomu (schodki)
- **partner AI zna tylko poziomy z metodyki** — usunięto 8 wymyślonych opisów
- **sekcja mieszka w jednym miejscu w całej aplikacji** — spójność wygrywa z lokalnym optimum
- **zgoda licencyjna** na opisy poziomów w raporcie dla klienta — zakres objęty i **nieobjęty**
  zapisany w nagłówku `src/components/assessment/report/drdLabels.ts`
- generatory szablonów: **zbadać przed zdjęciem** — 3 z 4 były jedynym wejściem do żywej mechaniki

## 7. Higiena — co zrobić rano

- **Push na `github-backup` jest odrzucany** (inna sesja wypchnęła). Scalić, **gdy robotnicy
  skończą** — mają niezacommitowaną pracę w tym katalogu.
- **Katalog jest współdzielony z inną sesją.** `git status` **nie jest listą Twoich zmian.**
  Commituj wyłącznie pliki wymienione z nazwy.
- Śmieci w korzeniu: `cards.json`, `extract.mjs` (z 29.08, nie nasze).
- Sześć nowych błędów typów w `DecisionDetailView.tsx` i `IdeaMapWorkspace.tsx` — nie nasz tor.
- Test `artifactStudioTelemetry` czerwony, bo utrwala świadomie zmienione założenie — zaktualizować.

## 8. Rzeczy, których nie wolno zapomnieć

- **Właściciel nigdy nie jest pierwszym testerem wizualnym.** Zrzut oglądam ja, przed nim.
- **Zielona karta jest obietnicą.** Zapalanie jej z raportu robotnika, bez własnego zrzutu
  w tym samym stanie, to przekazywanie cudzej niepewności jako swojej pewności — dziś sześć razy.
- **Właściciel ceni surową szczerość** bardziej niż dobre wiadomości. Sprostowanie własnego
  błędu buduje zaufanie; przemilczenie je niszczy.
- **Nie dotykać bazy demo ani staging.** Nie ruszać `origin/demo`.
- Pisać **krótko, obrazkami**. Pytania **z rekomendowaną odpowiedzią**, pojedynczo.
