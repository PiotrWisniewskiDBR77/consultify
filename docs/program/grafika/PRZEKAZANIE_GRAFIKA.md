---
doc_id: przekazanie-grafika
status: canonical
truth_type: handover
established: 2026-08-30
od: nadzorca toru grafiki (sesja 30.08)
dla: następcy — sesja „Grafika"
---

# PRZEKAZANIE — tor Grafika

**Czytaj to pierwsze. Potem `REJESTR_DECYZJI_20260830.md`, potem `00_ZASADY_PRACY.md`.**

---

## 1. Czym jest ten tor

Właściciel (Piotr, nie-koder, komunikacja **po polsku**, krótko, obrazkami) odbiera
produkt **ekran po ekranie**. Ty jesteś nadzorcą: mierzysz, naprawiasz oczywiste
defekty graficzne, a rzeczy sporne albo funkcjonalne zgłaszasz **torowi funkcji**
przez `docs/program/KOORDYNACJA.md`.

**Reguła nr 7 z `CLAUDE.md` jest nienaruszalna: właściciel NIGDY nie jest pierwszym
testerem wizualnym.** Zanim zobaczy ekran — Ty go renderujesz, oglądasz zrzut
własnymi oczami i naprawiasz, co widać. On patrzy **do akceptu, nie do odkrywania
zepsucia**.

---

## 2. Stan na koniec sesji 30.08

| | |
| --- | --- |
| Ekranów w rejestrze | **201** w 16 modułach (kolejność menu bocznego) |
| Do odbioru | **181** (141 na A, 40 na B) |
| Świadomie niepokazanych | 20, każdy z powodem |
| Odłożonych (archiwum dowodów z fal napraw) | 21 |
| **Decyzji właściciela w bazie** | **162** — 98 akceptacji, 48 do poprawki, 15 odrzuceń |
| Komentarzy właściciela | 70 |
| Napraw wykonanych | 106 |

---

## 3. Infrastruktura — uruchom to najpierw

**Katalog roboczy:** `/private/tmp/m03`, gałąź `codex/m03-admin-20260824`,
zdalne `github-backup`.

### Harness dev-render (port 3020) — tu renderujesz ekrany
```
cd /private/tmp/m03 && npx vite --config dev-render/vite.config.ts --port 3020 --strictPort
```
Adres ekranu: `http://127.0.0.1:3020/?screen=<ID>&lang=pl&theme=light|dark`

**★ UWAGA: do harnessu prowadzą DWIE drogi.** Wspólna to `?screen=`, ale
**osiemnaście** ekranów ma własny plik `dev-render/<id>.html` i przez `?screen=`
ich nie widać — narzędzie odpowiada wtedy listą awaryjną, co wygląda **dokładnie
tak samo jak „ekran się nie renderuje"**. Dwa ekrany SIRI dostały przez to fałszywą
ocenę D. Sprawdzaj `ls dev-render/*.html`.

### Serwer odbioru (port 3030) — tu klika właściciel
```
cd /private/tmp/m03 && node scripts/dev/odbior-serwer.mjs
```
Otwiera się na `http://127.0.0.1:3030/`. **Musi działać, kiedy właściciel pracuje.**

### Narzędzia
- `scripts/dev/grafika-zrzuty.mjs` — zrzuty.
  `--ekrany=a,b --katalog=NN-nazwa --faza=PRZED|PO --motywy=light,dark`
  `--parametry='ff_cos=1&tab=x'` (flagi i parametry adresu)
  `--wejscie=html` (własny punkt wejścia zamiast `?screen=`)
  `--osiad=9000` (dłuższy czas osiadania — do wykrywania animacji)
- `scripts/dev/grafika-ile-danych.mjs` — mierzy, ile treści realnie się wyrenderowało.
- `scripts/dev/odbior-poprawka.mjs <ekran> "<co zmieniłem>"` — **zapala właścicielowi
  zieloną kartę**. Wołaj to DOPIERO po zrobieniu nowego zrzutu (znacznik czasu
  odświeża obrazek u niego; ze starym zrzutem oceni nieaktualny stan).
- `scripts/dev/grafika-strona-odbioru.mjs` — statyczna strona (starsza, zastąpiona serwerem).

### Dane
- `docs/program/grafika/status.json` — rejestr ekranów: ocena, `co`, `gdzie`,
  `naprawione[]`, `wyjatki[]`, `warianty[]`.
- `docs/program/grafika/odbior.sqlite` — **decyzje właściciela**. Tabele `decyzje`
  (stan bieżący), `historia` (każde kliknięcie, nic nie ginie), `poprawki`
  (Twoje zgłoszenia). Poza gitem. Czytaj przez `node:sqlite`.
- `docs/program/grafika/ODBIOR_DECYZJE.json` — eksport bazy do czytania i do gita.

---

## 4. Jak pracować z właścicielem — protokół wypracowany 30.08

**Pisz krótko.** Powiedział wprost: *„jak piszesz bardzo długi tekst, to mi jest
trudno odpowiadać. Padliśmy w narrację: pytanie, odpowiedź"*. Zadawaj **konkretne
pytania z rekomendowaną odpowiedzią** (narzędzie `AskUserQuestion`), nie eseje.

**Nie czekaj na niego.** *„Nie rozumiem, po co na mnie czekasz. Mnie potrzebujesz
na samym końcu do zatwierdzeń."* Pracuj ciągle, wieloma robotnikami równolegle,
raportuj partiami.

**Pytaj tylko o to, co on może rozstrzygnąć** — co widzi na ekranie albo decyzję
biznesową. Wszystko techniczne rozstrzygasz sam (reguła 0 w `00_ZASADY_PRACY.md`).

**Prostuj się natychmiast i głośno.** Ceni surową szczerość bardziej niż dobre
wiadomości. Sprostowanie własnego błędu buduje zaufanie; przemilczenie je niszczy.

**Wspólna paczka:** ustalone 30.08 — ekran wchodzi do odbioru, gdy gotowe są **obie
połowy**, wygląd i działanie. Ekran, który wygląda dobrze i nie zapisuje danych,
wchodzi **z jawnie nazwanym brakiem**, nie w ciszy.

**Następny odbiór:** modułami, od 01 Czat w dół. Arkusz jest już tak ułożony.

---

## 5. ★ Sześć sposobów, w jakie kłamie stanowisko pomiarowe

To najważniejsza rzecz, jakiej nauczył ten dzień. **Za każdym razem wyglądało to
jak defekt produktu i za każdym razem to byliśmy my.**

1. **Sztuczne zwężenie w harnessie.** Dziesięć ekranów miało wpisane
   `maxWidth: 1180` — właściciel **pięć razy** zgłosił „tabela nie jest na pełną
   szerokość". Miał rację co do obrazu; przyczyna leżała w harnessie.
2. **Zły wariant za flagą.** Bez `--parametry` mierzyliśmy starą powierzchnię
   i nazywali ją ocenianym ekranem.
3. **Fałszywe „nie renderuje się".** Trzy ekrany wymagały parametrów
   **udokumentowanych w komentarzu nagłówkowym własnego pliku**. Pierwszy przebieg
   dał im D.
4. **Zepsuty import jednego ekranu zatruwa zrzuty innych** — Vite jest wspólny.
5. **Brak wymuszenia języka** w dedykowanym wejściu — tabela renderowała się po
   angielsku i wyglądała na defekt, którego w produkcie nie ma.
6. **Obiekt, którego nie ma w drzewie strony.** Zrób **drugi zrzut z innym czasem
   osiadania**. Przesunął się → to animacja, szukaj w `src/index.css`.

**Zasada:** zanim zgłosisz defekt, sprawdź, czy nie patrzysz przez brudne szkło.

---

## 6. Moje błędy — nie powtórz ich

**Szerokie dodawanie plików do commitu.** `git add -A src/` przy pięciu robotnikach
w jednym katalogu **zagarnia cudzą pracę w locie**. Raz zagarnąłem rejestrację
ekranu **bez pliku, który ona importuje** — na czystym pobraniu wywalało to cały
harness, a u mnie działało. **Do commitu wchodzą wyłącznie pliki wymienione z nazwy.**

**Zignorowane ostrzeżenia robotników.** Dwaj zgłosili mi kolizję katalogu w swoich
raportach, zanim wykryłem skutek. Uznałem to za szum organizacyjny. **Sekcja
„zgłaszam" w raporcie robotnika to nie szum.**

**Propagowanie cudzych twierdzeń.** Dwa razy raport robotnika zawierał „potwierdzony
błąd w `src/`", którego nie było — raz przez zacytowanie dwóch fragmentów kodu
z pominięciem efektu leżącego **dokładnie między nimi**. **Każde „potwierdzony błąd"
sprawdzaj sam, zanim wejdzie do rejestru.**

**Próbka zamiast zbioru.** Obejrzenie dwóch najstarszych plików i ogłoszenie ich
defektów stanem dzisiejszym. **Policz, ile jest X-ów, i posortuj po dacie.**

---

## 7. Co zostaje otwarte

### Czeka na właściciela (4)
1. **Włączenie flagi prawego pasa** (`ENABLE_ARTIFACT_RIGHT_RAIL`) — dziewięć
   powierzchni gotowych, flaga wyłączona, czeka na akcept zrzutów.
2. **Warsztat arkusza i prezentacji** — włączony w harnessie na jego prośbę,
   decyzja o włączeniu na stałe nie zapadła.
3. **Kreator szablonów poza wspólnym systemem** — potwierdzenie decyzji.
4. **Karta narzędzia** — jego uwaga o „usunięciu dwóch przykładów z trzech" jest
   dla mnie niezrozumiała; ma pokazać na ekranie.

### Czeka na tor funkcji (15) — pełna lista w `KOORDYNACJA.md`
**Dwa priorytetowe, zatwierdzone przez właściciela:**
- **Wskaźnik:** w świeżej organizacji nie da się założyć pierwszego
  (`409 NO_ACTIVE_VISIBILITY_POLICY`) — żadna trasa nie publikuje polityki
  widoczności dla domeny `kpi`.
- **Cel:** check-in niewykonalny — `generateCadenceOccurrencesAndSeedCheckInObligations`
  (`okrCheckInScheduler.ts:64`) nie ma **ani jednego wywołania**.

Dalej m.in.: wskaźniki nie mają nazw w kontrakcie danych (tylko kody); cztery sekcje
karty zadania bez ścieżki odczytu; dokument nie wie, z czego powstał ani co z niego
wyszło; kontrola jakości tylko w Wordzie; kanon dat omijany w 198 plikach; procent
czytany jako piksel we wspólnej tabeli; agent nie wznawia po akcepcie (kolizja klucza
idempotencji, `agentTaskDispatchService.ts`).

### Czeka na tor grafiki (8)
- Rozwiezienie prawego pasa **po akcepcie** — zostają: kreator szablonów
  (świadomie poza), powłoka modułu wykonawczego, szósty panel idei za wyłączoną flagą.
- 48 ekranów „do poprawki" z odbioru — pojedyncze uwagi, w `odbior.sqlite`.
- Prezentacja z oceny: wykres bez nazw osi (zmiana we wspólnym jądrze metodyk).
- Dwa panele oceny w całości po angielsku (884 linie bez kluczy tłumaczeń).
- Trzy ekrany niezarejestrowane w harnessie (m.in. `assessment-matryca`).
- Weryfikacja **klikiem** opisów `gdzie` — powstały z czytania kodu.
- Polerowanie stylu (fala 5 z `PLAN_PO_ODBIORZE.md`).

---

## 8. Pierwsze kroki następcy

1. Podnieś oba serwery (§3) i sprawdź, że odpowiadają.
2. Przeczytaj `REJESTR_DECYZJI_20260830.md` — 22 decyzje właściciela z cytatami.
3. Przeczytaj `odbior.sqlite`: 48 pozycji „poprawka" i 15 „nie" — **to jest lista
   roboczą numer jeden**, prosto od właściciela, jego słowami.
4. Zapytaj go **jednym pytaniem z rekomendacją**, od czego zaczynamy: dokończenie
   48 poprawek czy włączenie prawego pasa.
5. Nie ruszaj `origin/demo`. Nie dotykaj bazy demo ani staging — to twarz produktu.

**Ostatnia rzecz.** Ten produkt jest **znacznie dalej, niż wygląda**. Dziś **cztery
razy** funkcja uznana za brakującą okazała się zbudowana i pozbawiona wejścia:
pełne narzędzie ROI, centrum agentów, wejście do Finansów, warsztat arkusza.
**Zakładaj, że rzecz istnieje, dopóki nie udowodnisz, że jej nie ma.** Odwrotne
założenie było dziś błędne cztery razy z czterech.
