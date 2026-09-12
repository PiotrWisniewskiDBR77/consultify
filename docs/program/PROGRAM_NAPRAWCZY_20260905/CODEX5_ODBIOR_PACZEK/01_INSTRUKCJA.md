---
doc_id: codex5-odbior-paczek
status: WYDANY
truth_type: codex-block-instruction
established: 2026-09-12
baza: origin/integracja/20260911 (tip w chwili startu — marker zapisujesz sam, §0.1)
---

# CODEX 5 — ODBIÓR PACZEK 2b i 4 (blok adwersaryjny)

**Twoje zadanie w tym bloku to OBALIĆ cudzą robotę, nie potwierdzić ją.** Odbierasz dwie paczki
napisane w blokach 2b („sześciu pisarzy legacy") i 4 („dług MVP"), scalone już przez nadzorcę
do linii integracyjnej za flagami wyłączonymi. Raport autora paczki jest **deklaracją, nie dowodem**.
Znalezisko, które obala cudzy raport, jest w tym bloku wart więcej niż potwierdzenie.

Ten blok **niczego nie naprawia**. Naprawy zlecane są osobno, po werdykcie nadzorcy.
Jedyny wyjątek: jeśli defekt blokuje dalszy pomiar, opisz obejście w raporcie — nie commituj go.

## §0 BEZPIECZNIKI (Z1–Z18)

- **Z1.** Nie pushujesz. Nie scalasz. Nie wdrażasz. **ZERO połączeń** do Railway, stagingu, demo
  i produkcji — w każdą stronę.
- **Z2.** Nie dotykasz `/Users/piotrwisniewski/Developer/Consultify` poza symlinkiem `node_modules`.
- **Z3.** **Nie zmieniasz kodu produkcyjnego.** Wolno ci dopisywać wyłącznie: przyrząd pomiarowy
  w `scripts/dev/odbior-5-<sha8>/`, testy mierzące (nie naprawiające) i raport. Jeżeli musisz coś
  zmienić w `src/**` albo `server/src/**`, żeby zmierzyć — **STOP i wpis w raporcie**.
- **Z4.** Zasoby wyłączne: kontener `cx-codex5-pg` (port **6456**), bazy `cx5_*`, API **4215**,
  vite preview **5215**, harness **5596**, artefakty `~/Developer/codex-wt/codex5-artefakty`.
  NIETYKALNE cudze: `cx-codex2b-pg` (6454), `cx-codex4-pg` (6455), `cx-codex1/2/3-pg` (6451–6453),
  `consultify-pg18` (54418 — tylko `SELECT`, `pg_dump` i `CREATE DATABASE cx5_* TEMPLATE consultify_staging_1009`).
- **Z5.** Zakaz `git stash`, zakaz `--no-verify`, zakaz `git push`. Commit tylko przyrządu i raportu,
  znacznik `[ODMROZENIE WSPOLNE DEC-468]`.
- **Z6.** Testy **per plik**, env w jednej linii, `--retry=0`, `--config server/vitest.config.ts`.
- **Z7.** Pełnego `tsc` frontu używasz **raz**, w bramce (§4) — nigdy równolegle z innym ciężkim
  procesem. Zabity proces daje fałszywe „0 błędów"; sprawdź, że bieg się zakończył.
- **Z8.** **Zanim ogłosisz regresję — zmierz ten sam zbiór na SHA sprzed paczki.** Czerwień zastana
  nie jest regresją. Ta pułapka dała już jeden fałszywy alarm i jedno pochopne cofnięcie wdrożenia.
- **Z9.** „Nie renderuje się" **bez zrzutu ekranu nic nie znaczy.** Zanim to napiszesz — zrób obraz
  i na niego popatrz. Trzy razy w tym programie „moduł się nie montuje" okazało się wadą przyrządu.
- **Z10.** Przyrząd przeglądarkowy: **jeden kontekst** na całą serię (nowy kontekst na każdy ekran
  = 16 zimnych startów po 16–36 s i fałszywy werdykt); warunek gotowości = **zmieniona** treść
  `body.innerText` + stabilność w 3 sprawdzeniach co 400 ms (przy nawigacji klienckiej poprzedni ekran
  zostaje w DOM i naiwny warunek daje „3 ms"); token sesji ma ważność 60 minut — **odświeżaj przed
  każdą serią**, inaczej mierzysz ekran logowania. Wzorzec: `scripts/dev/odbior-2-60051310d7/harness2.mjs`, `nav2.mjs`.
- **Z11.** Adresy modułów bierz z **żywego paska bocznego** (kliknięcie ikony + odczyt adresu),
  nie z dokumentacji — trzy adresy w starych briefach prowadzą nie tam.
- **Z12.** Motyw przełączasz przez zustand (`consultify-storage.state.theme`), nie przez
  `emulateMedia`/`prefers-color-scheme`. Parę jasny/ciemny sprawdź bezpiecznikiem jasności (różnica > 40),
  inaczej dwa zrzuty to ten sam obraz pod dwiema nazwami.
- **Z13.** Rozdziel w liczniku **błędy produktu** od własnych znaczników przyrządu.
- **Z14.** Każdą kontrolę negatywną (obca organizacja, członek bez uprawnień) potwierdzaj **dwoma**
  pomiarami: kod odpowiedzi ORAZ niezmieniony wiersz w bazie odczytany osobno.
- **Z15.** Dowód mutacyjny: skasuj zabezpieczenie (lokalnie, bez commita) i pokaż, że test czerwienieje.
  Test, który przechodzi po skasowaniu zabezpieczenia, nie broni niczego.
- **Z16.** Bezpiecznik, który nie mógł przejść, nie jest dowodem: jeśli krok pomiaru nie miał danych
  wejściowych, wpisz **NIEZMIERZONE**, nigdy PASS.
- **Z17.** Sprzątasz po sobie: każdy rekord utworzony sondą usuwasz i rozliczasz w raporcie
  (nazwa, id, czy usunięty, a jeśli nie — dlaczego). Bazy `cx5_*` kasujesz po pracy.
- **Z18.** `df -h /` < 5 GB wolnego = STOP bloku.

## §0.1 Stanowisko

```
V=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
git -C "$V" fetch origin --prune
WT=/Users/piotrwisniewski/Developer/codex-wt/codex5-odbior
git -C "$V" worktree add "$WT" -b codex/odbior-paczek-20260912 origin/integracja/20260911
printf '[core]\n\tbare = false\n' > "$V/worktrees/codex5-odbior/config.worktree"
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"
git -C "$WT" rev-parse HEAD    # ← TO jest SHA odbioru, wpisz go do raportu i w nazwę katalogu przyrządu
```

**Warunek wejścia:** w `git log --oneline -30` widzisz **oba** scalenia — bloku 2b
(sześciu pisarzy) i bloku 4 (dług MVP). Jeśli brakuje któregoś — odbierasz tylko ten, który jest,
i piszesz w raporcie, czego nie było. Nie czekasz.

## §1 WARSTWA 1 — kod kontra kontrakt

Dla **każdego** punktu „definicji ukończenia" z instrukcji obu bloków
(`CODEX2B_SZESCIU_PISARZY/01_INSTRUKCJA.md`, `CODEX4_DLUG_MVP/01_INSTRUKCJA.md`) wystaw wiersz:

| punkt | werdykt | dowód |
|---|---|---|
| cytat z definicji ukończenia | ZROBIONE · CZĘŚCIOWO · NIEWYKONANE · NIEMIERZALNE | `plik:linia` albo powód |

Trzy pytania, które w tym programie najczęściej obalały „gotowe":
1. **Czy istnieje wołacz?** Biblioteka z zielonymi testami i zerem konsumentów to nie funkcja.
   `grep` po realnym wołaczu w `src/` i `server/src/` (trasa, handler, komponent).
2. **Czy flaga ma implementację?** Bywały flagi bez ani jednej linii kodu. Sprawdź, że wyłączenie
   flagi realnie zmienia zachowanie, a nie tylko nazwę.
3. **Czy zapis idzie tam, skąd czyta ekran?** W bloku 2b to jest **cały sens paczki**: pisarz kanoniczny
   ma pisać do tej samej tabeli, którą czyta widok. Sprawdź to zapytaniem do bazy, nie czytaniem kodu.

## §2 WARSTWA 2 — runtime na żywym stanowisku

Baza: `CREATE DATABASE cx5_odbior TEMPLATE consultify_staging_1009`. API 4215, front z **budowy
produkcyjnej** (`vite preview` 5215). Konto: własne `audyt@dbr77.local` wstawione do kopii
(skrót hasła algorytmem aplikacji, onboarding ukończony) — wyłącznie lokalnie.

**A. Blok 2b — sześciu pisarzy.** Dla każdego z sześciu (`milestones`, `resources`, `staffing-plans`,
`budget-items`, `gate-roles`, `move`), osobno przy fladze `ENABLE_INITIATIVE_UNIFIED_WRITE` **OFF** i **ON**:
zapis przez realny ApiGateway → **pełne przeładowanie** → odczyt przez ekran → odczyt bezpośrednio
z bazy. Parytet OFF ma być **bit w bit** ze stanem sprzed paczki. Przy ON: ten sam skutek widoczny
w tym samym miejscu, idempotencja (powtórzone żądanie z tym samym identyfikatorem nie tworzy duplikatu),
obca organizacja odmowa + wiersz nietknięty.

**B. Blok 4.** E1: oba dawne 500 (`GET /api/my-work/inbox` na 4 wariantach, `POST /tasks/:id/assign`
dla zadania bez projektu) — kod odpowiedzi, treść, brak 5xx w logu; sprawdź też, czy naprawa nie
zmieniła kontraktu ścieżki kanonicznej. E2: `close` → `reopen` → odczyt statusu po przeładowaniu,
odmowa dla niepowołanego + wiersz nietknięty, zrzut jasny i ciemny **twój własny** (nie cudzy).
E3: **powtórz pomiar pakietu własnym przyrządem** — eager JS w bajtach z `index.html`, zimny start,
16 modułów + 3 karty; jeżeli twój pomiar różni się od raportu autora, twój jest wiążący.
E4: uruchom oba skrypty w trybie próbnym **na kopii** i sprawdź, że bez `--apply` nie piszą nic
(porównaj sumy wierszy przed i po), a manifest pozwala cofnąć zmianę.

**C. Rzeczy, które w tym produkcie psuły się niezależnie od paczek** (zmierz przy okazji, 20 minut):
16 modułów montuje treść w ciepłej sesji · 0 błędów konsoli produktu · 0 odpowiedzi 5xx w całym
przebiegu · logowanie działa po pełnym przeładowaniu · przełączenie motywu nie psuje układu.

## §3 WARSTWA 3 — bramka 4-krokowa na scalonej linii

Wykonaj bramkę z `docs/program/PLAN_CODEX_2DNI_20260912.md` §3 (6 kroków, sekwencyjnie, progi tam
opisane) i wklej **surowe** wyniki. Krok 6 (testy) obowiązkowo z pomiarem różnicowym wg Z8: ten sam
zbiór plików na SHA odbioru i na SHA sprzed obu scaleń; osobno wypisz „nowe czerwone" i „zastane czerwone".

## §4 RAPORT

`docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX5_ODBIOR_PACZEK/98_ODBIOR.md`:

1. Stanowisko (SHA odbioru, bazy, porty, godziny).
2. **Werdykt zbiorczy w jednym zdaniu per paczka** — i osobno: czy któryś punkt „definicji ukończenia"
   jest nieprawdziwy w raporcie autora.
3. Warstwa 1 — tabela punkt po punkcie.
4. Warstwa 2 — pomiary A, B, C z kodami odpowiedzi, zapytaniami do bazy i ścieżkami zrzutów.
5. Warstwa 3 — surowe wyniki bramki, tabela „nowe vs zastane".
6. **Lista znalezisk** z klasyfikacją BLOKER · WAŻNE · DROBNE · ZASTANE, każde z reprodukcją
   (komenda albo kliknięcia) i `plik:linia` przyczyny, jeśli ją ustaliłeś.
7. Sprzątanie — co utworzyłeś, co usunąłeś, co zostało i dlaczego.
8. **Czego nie zmierzyłeś** i dlaczego. Ta sekcja nie może być pusta bez uzasadnienia.

Zrzuty: `evidence/odbior-5-<sha8>/` (PNG + sidecar JSON z adresem, stanem, jasnością).
Logi surowe: poza repo, w `~/Developer/codex-wt/codex5-artefakty`.
