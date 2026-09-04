# Naprawa dyżuru 334 — G20 po odbiorze adwersaryjnym (2026-09-04)

Gałąź: `agent/naprawa-334-20260904`, baza `/private/tmp/m03` HEAD `e31e74c2d9`.
Zastępuje niescaloną gałąź `codex/day334-g20-pietnascie-20260904` (werdykt odbioru:
**NIE SCALAĆ**). Zabiera z niej część wartościową, cofa trzy fałszywe rozstrzygnięcia
i zamyka dziurę w bezpieczniku, która je umożliwiła.

## 0. Liczby

| Stan | BLOKUJE | exit |
|---|---|---|
| HEAD przed pracą (`e31e74c2d9`) | **15** | 1 |
| zgłoszenie dyżuru 334 | 10 | 1 |
| pomiar odbiorcy | 13 | — |
| **ta gałąź** | **13** | **1** |

Mianownik bez zmian: **121**. NAPRAWIONE 30 → **32**, ZAMKNIETE_DEC 18 → **34**,
ODLOZONE_DEC 58 → **42**, W_BUDOWIE 0.

Moja liczba zgadza się z liczbą odbiorcy. Bramka G20 pozostaje **czerwona**.

Odtworzenie:

```
node scripts/dev/p0p1-licznik-e1.mjs --marker afc923d912d9a636d28798a7f035f693bb18ce8d --snapshot-date 2026-09-04
```

## 1. Co cofnąłem i dlaczego

Dyżur 334 przypisał SHA pięciu pozycjom. Trzy upadły, bo cytowany commit jest
**starszy niż zgłoszenie defektu** i nie dotyka obiektu, który cytuje dowód.

| Pozycja | SHA dyżuru 334 | Data commita | Data zgłoszenia | Dlaczego cofnięte |
|---|---|---|---|---|
| `MYW-CV-REC-001` | `d0b5172c19` | 2026-07-24 | 2026-08-22 | Commit o miesiąc starszy od uwagi. Jego wersja `VaultSafesTable.tsx` ma 152 linie i **nie zawiera** ani `TableWithPreviewLayout`, ani `PreviewMetaCard`, które dowód cytuje w liniach 356–460. **Dokument źródłowy** (`modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md`, sekcja „Fala 4") stawia tej pozycji status `FALA_4_OWNER_DECISION` i **wymaga świeżego zrzutu przed zamknięciem** — SHA nie wystarczy. |
| `MYW-DEC-REC-001` | `7b7ec198aa` | 2026-07-15 | 2026-08-22 | Pięć tygodni przed zgłoszeniem. `git show --stat` dotyka **wyłącznie** `DecisionsPanelContent.tsx`; dowód pozycji wskazuje `MyWorkHub.tsx:4137`, którego ten commit w ogóle nie rusza. |
| `MYWORK-DEC-OWN-001` | `7b7ec198aa` | 2026-07-15 | 2026-08-23 | Ten sam commit, ta sama wada. Pozycja to duplikat zgłoszenia `MYW-DEC-REC-001`. |

Wszystkie trzy wracają do `UNRESOLVED` z powodem zapisanym w tabeli
(`scripts/dev/p0p1-licznik-e1.mjs`, `DAY320_RESOLUTIONS`), a przy
`MYW-CV-REC-001` dopisany jest wprost wymóg świeżego zrzutu.

### Co zostawiłem jako uczciwie zamknięte

`ASM-OWN-001` i `ASM-OWN-002` → `e4dc14df6e` (2026-09-04, **młodszy** niż
zgłoszenie 2026-08-22). Odbiorca sprawdził kod na HEAD: siedem kolumn dokładnie
wg `DEC-2026-09-03-353`, podgląd z opisem, osiami i CTA „Rozpocznij ocenę".

**★ UJAWNIENIE dopisane przy obu pozycjach (raport 334 tego nie pokazywał):**
kolumny `duration` i `lastUsed` renderują **twarde `'—'`** —
`src/components/Assessment/library/AssessmentLibraryTab.tsx:453-456` i `477-481`
mają `render: () => '—'`, a typ pola w `MethodologyRow` (linie 82–83) to dosłownie
`null`. **Kolumna jest, danych nie ma.** To dług do rozliczenia osobno; nie
odbiera zamknięcia pozycji (właściciel zatwierdził listę kolumn), ale nie może
zniknąć z rejestru.

## 2. Co zabrałem z gałęzi 334 jako wartościowe

Commity `694df9ba22` + `12b2e066f3` (R3 i jego korekta): `ledgerDecisions()`
zwraca **mapę DEC → wiersz ledgeru** zamiast zbioru identyfikatorów, a dyspozycja
decyzji („teraz" vs „po bramkach") czytana jest z **tego wiersza**, nie z całego
tekstu dowodowego pozycji. Wcześniej przypadkowe słowo `NIE` w cudzej linii
odkładało decyzję, którą właściciel nakazał wykonać.

Rozszerzyłem to na **obie** ścieżki klasyfikacji — jawne rozstrzygnięcie `DECISION`
i gałąź fallback po cytowanych DEC (gałąź 334 poprawiła tylko pierwszą, przez co
sprzeczność `[OF]` z punktu 4 zostawała nierozstrzygnięta).

**Odrzuciłem** commit `6e91f41691` (test R4 dyżuru 334). Ten test wstrzykuje
`shaCheck: () => 'SHA_CHECKPOINT'` i tym samym **omija badane zabezpieczenie** —
sprawdza tylko, że funkcja przepisuje wstrzyknięty napis do werdyktu. Nie broni
niczego. Moje testy R3 idą **domyślnym `gitShaState`** po realnym repozytorium.

## 3. ★ Zamknięta dziura w bezpieczniku

### Dziura

`gitShaState()` (`scripts/dev/p0p1-licznik-e1.mjs`) sprawdzał trzy rzeczy:

1. commit istnieje (`git cat-file -e`),
2. commit jest przodkiem HEAD (`git merge-base --is-ancestor`),
3. temat commita nie zawiera słowa `checkpoint`.

**Nie sprawdzał, czy commit jest młodszy od zgłoszenia defektu.** Dowolną pozycję
dało się więc zamknąć commitem sprzed jej powstania — i dokładnie tak stało się
trzy razy w dyżurze 334.

### Zamknięcie

Nowy stan `SHA_STARSZY_NIZ_ZGLOSZENIE`. Data commita to **wcześniejsza z `%aI`
i `%cI`** (cherry-pick / forward-port przesuwa datę commitera do przodu i mógłby
ukryć stary commit).

**Skąd bierze się data zgłoszenia — nie zgaduję, czytam z repo.** Nowa funkcja
`collectReportedDates(root)`, trzy źródła, najwcześniejsza data wygrywa
(pierwsze zgłoszenie obiektu):

| # | Źródło | Format | Pokrycie korpusu 121 |
|---|---|---|---|
| 1 | kolumna daty w wierszu rejestru właściciela `modules/*/MODULE_ACCEPTANCE.md` | `| \`ID\` | 2026-08-22 | …` albo `| \`ID\` | \`2026-08-22 21:05 Europe/Warsaw\` | …` | 74 |
| 2 | nagłówek `Intake date: \`YYYY-MM-DD\`` w `owner_feedback/*/OWNER_FEEDBACK_REGISTER.md` — dotyczy każdego ID w pliku | `Intake date: \`2026-08-23\`` | +ASM |
| 3 | data w **nazwie** pliku przeglądu (`*OWNER_REVIEW*`, `*OWNER_FEEDBACK*`, `*OWNER_NOTES*`) | `OWNER_REVIEW_2026-08-22.md` | +CHAT, +TLS |

Pozycja `X[OF]` dziedziczy datę bazowego `X` (ten sam obiekt właściciela,
odzyskany z owner-feedback).

**Brak daty nie przepuszcza po cichu**: stan `SHA_BRAK_DATY_ZGLOSZENIA` → `BLOKUJE`.
Brak pomiaru nie jest wynikiem. Test `R3: daty zgłoszeń czytane z repo pokrywają
wszystkie pozycje z SHA` pilnuje, żeby każda pozycja `type: 'SHA'` w
`DAY320_RESOLUTIONS` miała datę — jeśli ktoś doda pozycję bez daty, test czerwieni się
zanim licznik zdąży ją przepuścić.

### ★ Dowód mutacyjny — celuje w ZABEZPIECZENIE, nie w mechanizm

Obie mutacje przez realną ścieżkę (`node scripts/dev/p0p1-licznik-e1.mjs`), cofane
przez `cp`, nigdy przez `git stash`.

**Mutacja 1 — podstawienie SHA starszych niż zgłoszenie (dokładnie ta sama
podmiana, którą zrobił dyżur 334):**

```
'MYW-CV-REC-001':     { type: 'SHA', sha: 'd0b5172c19' }   // 2026-07-24
'MYW-DEC-REC-001':    { type: 'SHA', sha: '7b7ec198aa' }   // 2026-07-15
'MYWORK-DEC-OWN-001': { type: 'SHA', sha: '7b7ec198aa' }   // 2026-07-15
```

Wynik: **`BLOKUJE: 15`** (nie 12), wszystkie trzy z powodem:

```
| `MYW-CV-REC-001`     | BLOKUJE | SHA_STARSZY_NIZ_ZGLOSZENIE | d0b5172c19:SHA_STARSZY_NIZ_ZGLOSZENIE |
| `MYW-DEC-REC-001`    | BLOKUJE | SHA_STARSZY_NIZ_ZGLOSZENIE | 7b7ec198aa:SHA_STARSZY_NIZ_ZGLOSZENIE |
| `MYWORK-DEC-OWN-001` | BLOKUJE | SHA_STARSZY_NIZ_ZGLOSZENIE | 7b7ec198aa:SHA_STARSZY_NIZ_ZGLOSZENIE |
```

**Mutacja 2 — skasowanie SAMEGO warunku daty, przy tych samych fałszywych SHA**
(mutacja celująca w zabezpieczenie: dowodzi, że to warunek daty je łapie, a nie
coś obok):

```
- return commitDate < reportedDate ? 'SHA_STARSZY_NIZ_ZGLOSZENIE' : 'OK';
+ return 'OK';
```

Wynik: **`BLOKUJE: 12`**, wszystkie trzy fałszywie `NAPRAWIONE / SHA_OK`.
**To jest dokładnie exploit dyżuru 334, odtworzony w kontrolowanych warunkach.**

**Cofnięcie przez `cp`:** rejestr bajt w bajt identyczny ze stanem przed mutacją
(`diff` na tabeli werdyktów bez różnic), `BLOKUJE: 13`.

**Mutacja na testach:** skasowanie warunku daty czerwieni **5 z 21** testów
(`21 pass / 0 fail` → `16 pass / 5 fail`). Test, który nie czerwieni się po
skasowaniu zabezpieczenia, nie broni zabezpieczenia.

## 4. Sprzeczność klasyfikacji par `[OF]` — rozstrzygnięta 3/3

Par `[OF]` z istniejącą bazą jest **dokładnie 3** (mianownik 121, pozycji `[OF]` 27).
Przejrzałem wszystkie trzy.

| Para | Decyzja | Treść decyzji | Było | Jest |
|---|---|---|---|---|
| `ASM-OWN-001` / `[OF]` | `DEC-2026-09-03-367` | „właściciel **TAK, teraz**" | BLOKUJE / **ODLOZONE_DEC** ✗ | NAPRAWIONE / **ZAMKNIETE_DEC** ✓ |
| `ASM-OWN-002` / `[OF]` | `DEC-2026-09-03-367` | „właściciel **TAK, teraz**" | BLOKUJE / **ODLOZONE_DEC** ✗ | NAPRAWIONE / **ZAMKNIETE_DEC** ✓ |
| `ASM-OWN-003` / `[OF]` | `DEC-2026-09-03-364` | „właściciel **PO BRAMKACH (fala 2)**" | **ZAMKNIETE_DEC** / ODLOZONE_DEC ✗ | **ODLOZONE_DEC** / ODLOZONE_DEC ✓ |

Wszystkie trzy pary są teraz wewnętrznie spójne i zgodne z treścią decyzji.
**Nic z par `[OF]` nie zostaje dla właściciela.**

### Skutek uboczny do ujawnienia

Rozszerzenie zawężonej reguły na gałąź fallback przeklasyfikowało **24 wiersze**
(20× ODLOZONE→ZAMKNIETE, 4× ZAMKNIETE→ODLOZONE). **Żaden z nich nie zmienia
liczby BLOKUJE** — oba werdykty są nieblokujące. Sprawdziłem próbkę wobec
wierszy ledgeru: `DEC-370` („TAK. Wykonane 03.09") → ZAMKNIETE ✓,
`DEC-373` („NIE (fala 2)") → ODLOZONE ✓, `DEC-365` („RAZEM Z R-1 (fala 2)") →
ODLOZONE ✓, `DEC-2026-08-24-04` (OWNER_ACCEPT) → ZAMKNIETE ✓.

**Znane ograniczenie, świadomie zostawione:** dopasowanie działa na poziomie
**wiersza ledgeru**, a wiersz bywa wspólny dla rodziny pozycji o **różnych**
dyspozycjach. Przykład zmierzony: `DEC-2026-09-03-378` mówi
`INI-OWN-009 → TERAZ` i `INI-OWN-006 → FALA 2` w jednym wierszu, więc
`INI-OWN-009` dostaje `ODLOZONE_DEC` mimo dyspozycji „teraz". Zawężenie do zdania
zawierającego ID **zepsułoby** `ASM-OWN-003` (jego ID występuje w tytule wiersza,
a dyspozycja w zdaniu obok), więc tego nie zrobiłem. Skutek jest wyłącznie
opisowy — nie dotyka bramki.

## 5. Problem strukturalny: mierzy i ocenia ten sam plik

**Stan.** Bramkę G20 zamyka się dziś **edytując tablicę `DAY320_RESOLUTIONS`
w `scripts/dev/p0p1-licznik-e1.mjs`** — czyli w tym samym pliku, który bramkę
mierzy. Wynik (`REJESTR_P0P1_BLOKUJACE_G20.md`) też generuje ten skrypt.

**Czym to grozi.**

1. **Zmiana werdyktu wygląda jak zmiana narzędzia.** Commit „fix(licznik)" może
   równie dobrze poprawiać regułę, co przestawiać werdykt pozycji. Przegląd
   `--stat` tego nie odróżnia — trzeba czytać treść. Dyżur 334 w jednym commicie
   „attach functional SHAs" przestawił pięć werdyktów; trzeba było odbioru
   adwersaryjnego, żeby zobaczyć, że trzy są fałszywe.
2. **Autor narzędzia jest sędzią własnej sprawy.** Kto pisze regułę, ten w tym
   samym pliku wpisuje dane, na których reguła działa. Nie ma miejsca, w którym
   ktoś inny mógłby zakwestionować same dane.
3. **Bezpiecznik nie może obronić danych, które sam trzyma.** Bezpiecznik R3
   złapał teraz starą datę, ale nie złapie np. SHA prawidłowej daty podstawionego
   pod niewłaściwy obiekt — na to potrzeba drugiego czytelnika, nie drugiego `if`.
4. **Brak historii per pozycja.** `git log -p` na pliku ze 121 pozycjami miesza
   zmiany reguł ze zmianami werdyktów; nie da się prześledzić, kto i kiedy zamknął
   konkretną pozycję.

**Jak to rozdzielić** (nie wykonane — poza licencją tego dyżuru):

- **Dane out-of-code.** `DAY320_RESOLUTIONS` → osobny plik danych
  (`docs/program/waves/WAVE_03_ACCEPTANCE/G20_ROZSTRZYGNIECIA.yaml` albo `.json`)
  z polami `id`, `type`, `sha`/`decision`, `reportedDate`, `evidence`, `author`,
  `date`. Skrypt tylko czyta. Wtedy `git log` na pliku danych to czysta historia
  werdyktów, a `git log` na skrypcie to czysta historia reguł.
- **Osobne ścieżki przeglądu.** Zmiana skryptu = przegląd kodu; zmiana pliku
  danych = odbiór merytoryczny (kto podstawił SHA i na jakim dowodzie).
- **Pole `evidence` obowiązkowe i sprawdzane.** Dla `type: SHA` skrypt wymusza
  ścieżkę pliku + zakres linii; osobny bezpiecznik sprawdza, czy commit
  **dotyka tego pliku** (`git show --stat <sha> -- <plik>` niepuste). To zamyka
  drugą połowę dziury 334 — SHA, który nie rusza obiektu z dowodu.
- **Rejestr generowany do katalogu wyjściowego**, nie obok źródeł, żeby nie dało
  się go poprawić ręcznie i podać za pomiar.

## 6. Commity tej gałęzi

| SHA | Treść |
|---|---|
| `cdeacf2194` | dyspozycja decyzji z wiersza ledgeru, nie z całego tekstu (przeniesione z 334 R3 + rozszerzone na fallback, 3 testy realną ścieżką) |
| `7b7d7a5a92` | ★ bezpiecznik R3: SHA musi być młodszy niż zgłoszenie; `collectReportedDates`; 7 testów bez wstrzykiwania `shaCheck` |
| `afc923d912` | cofnięcie trzech fałszywych rozstrzygnięć + ujawnienie `duration`/`lastUsed` przy ASM-OWN-001/002 |
| `56a0690e0d` | przegenerowany rejestr — `BLOKUJE: 13` |

Testy: `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` → **21/21**.
`esbuild` per zmieniony plik: czysto.
