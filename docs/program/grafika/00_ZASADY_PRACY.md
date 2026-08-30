---
doc_id: grafika-zasady-pracy
status: canonical
owner: piotr
truth_type: process
established: 2026-08-30
---

# Grafika — zasady pracy (uzgodnione z właścicielem 2026-08-30)

To jest **kontrakt pracy nad wyglądem**, nie propozycja. Obowiązuje każdą sesję
i każdego agenta pracującego nad ekranami. Kolejny nadzorca czyta ten plik
**przed** dotknięciem czegokolwiek.

## Podział pracy — nienaruszalny

| Tor | Wykonawca | Zakres |
| --- | --- | --- |
| **Grafika** | nadzorca sam + wewnętrzni robotnicy | wygląd ekranów, zgodność z kanonem, zrzuty, odbiory |
| **Funkcje** | Codex, dyżury z generatora | mechanika, dane, trasy, bezpieczeństwo |

Grafika **nie idzie do Codexa**. Funkcje **nie są robione ad hoc w torze grafiki**.

## ★★ REGUŁA NR 1 — zakaz budowania w ciemno

> **Żaden ekran nie wchodzi do budowy, dopóki nie ma zrzutu stanu zastanego.**

Nie „sprawdziłem w kodzie". Nie „grep nie znalazł". **Zrzut albo dowód, że trasa
nie istnieje.** Powód: 2026-08-29 trzykrotnie okazało się, że rzecz uznana za
nieistniejącą jest zbudowana i renderowana.

Kolejność obowiązkowa na każdym ekranie:
1. znajdź **trasę** i **komponent**;
2. sprawdź **czwartą warstwę** — czy komponent jest faktycznie renderowany
   (wpis w rejestrze, mapa widoczności, `import` — **to nie są dowody**);
3. jeżeli za flagą — **włącz lokalnie** i zrób zrzut;
4. dopiero teraz decyzja: **poprawiać czy budować**.

**Budowa od zera jest ostatnią możliwością, nie pierwszą.**

## ★★ REGUŁA NR 2 — klasyfikacja przed pokazaniem

Ocena własna **przed** pokazaniem właścicielowi. Cztery stopnie:

| Ocena | Warunek | Czy właściciel widzi |
| --- | --- | --- |
| **A** | przechodzi listę czekowania (43 pkt, 38 bez kanbanu) + 9 MUST parytetu, oba motywy, zero atrap | **TAK** — do odbioru |
| **B** | przechodzi z **nazwanymi** wyjątkami (np. brak danych demo) | **TAK** — wyjątki podane **przed** spojrzeniem |
| **C** | nie przechodzi | **NIE** — naprawa i powrót |
| **D** | martwy · za flagą bez decyzji · cudzy zakres | **NIE** — idzie do `ODLOZONE.md` |

**Do właściciela trafia wyłącznie A i B.** Nigdy C.

## ★★ REGUŁA NR 3 — właściciel nie jest pierwszym testerem

Utrzymana w mocy z `CLAUDE.md` §7. Nadzorca ogląda **każdy** zrzut przed nim.
Ekran wraca do właściciela **do akceptu, nie do odkrywania zepsucia**.
Odbiór **partiami po pięć**, nie pojedynczo — właściciel ma być ustawiaczem
bramek, nie wąskim gardłem.

## ★★ REGUŁA NR 4 — kanon rośnie z odbiorów

Gdy właściciel zatwierdza ekran, a ekran zawiera rozwiązanie, którego standard
**nie opisuje** — dopisujemy je do `KANON_Z_ODBIOROW.md`: **jedna linia**, data,
ekran-źródło. Nie esej.

Cel: przy piątym module połowa pytań już nie powstaje, bo odpowiedź jest
w kanonie. **Nie pytamy właściciela dwa razy o to samo.**

## ★★ REGUŁA NR 5 — martwe odkładamy, nie kasujemy

Słowa właściciela: *„nie chcemy stracić czegoś, co może mieć wartość"*.
Wpis idzie do `ODLOZONE.md` z trzema polami: **dlaczego martwy · co niósł
wartościowego · jak przywrócić**. **Kod zostaje na miejscu.**

Ekran oznaczony `ODŁOŻONY` **nie wchodzi do żadnej partii bez wyraźnej zgody
właściciela**. Nie wraca sam.

## ★★ REGUŁA NR 6 — trwały zapis zamiast rozmowy

Kontekst sesji się urywa i model bywa podmieniany. **Wszystko, co ustalone,
mierzone albo odebrane, ląduje w pliku w repo — w tej samej godzinie, nie na
koniec dnia.** Rozmowa nie jest nośnikiem wiedzy.

Pliki tego toru:
- `REJESTR_EKRANOW.md` — jeden wiersz na ekran, stan i dowody
- `ODLOZONE.md` — katalog odłożonych
- `KANON_Z_ODBIOROW.md` — reguły wywiedzione z odbiorów właściciela
- `00_ZASADY_PRACY.md` — ten plik

## Wzorzec wizualny — co jest wiążące

Wzorzec zatwierdzony przez właściciela 2026-08-30 (ekran wniosku `INS-2026-014`).
Wiążąca jest **powłoka** i — ważniejsze — **język uczciwości**:

- okruszki → pasek tożsamości (kod · tytuł · status jako **pigułka z tekstem** ·
  znacznik zapisu **osobno** · kebab · **jeden** przycisk główny)
- zakładki z licznikami postępu (`3/6`), po prawej wejście Teresy
- prawy panel jako accordion w stałej kolejności: **Akcje · Właściwości ·
  Powiązania · Źródła i założenia · Komentarze · Historia**
- **język uczciwości, nienaruszalny:**
  - pewność nazwana wprost („Niewystarczające · potrzebna walidacja")
  - „**To interpretacja, nie fakt potwierdzony**"
  - „**BRAKUJĄCE — NAZWANE**, nie «brak danych»"
  - „**liczba 0 nie oznacza braku działań**" tam, gdzie widok jest ograniczony
  - uprawnienia jako **Możesz / Nie możesz** z zamkami
- kolor: neutralny; **crimson wyłącznie semantyka krytyczna**; fokus niebieski

## ★★ REGUŁA NR 7 — protokół odbioru na żywym podglądzie (2026-08-30)

Właściciel pracuje na kilku ekranach naraz i może przegapić wpis. Dlatego **każdy
krok odbioru ma jawny znacznik w rozmowie**, a nie tylko w panelu podglądu.

**Formuła:** ekran stoi na żywo w harnessie po prawej stronie, właściciel patrzy
i mówi jednym zdaniem, co pasuje. Adres podaję zawsze wprost.

### Trzy znaczniki, zawsze wypisane w rozmowie

| Znacznik | Kto pisze | Co musi zawierać |
| --- | --- | --- |
| **★ DO ODBIORU** | nadzorca | adres w harnessie · co dokładnie oglądać · ocena `A` albo `B` · przy `B` **wyjątki wypisane PRZED spojrzeniem** |
| **✔ ZATWIERDZONE** | **nadzorca, natychmiast po decyzji właściciela** | co dokładnie zostało przyjęte · jaka reguła z tego wynika · gdzie zapisana |
| **✖ DO POPRAWKI** | nadzorca po uwagach | co konkretnie poprawiam · kiedy wraca |

**Zasada nadrzędna tego protokołu:** decyzja właściciela wypowiedziana w rozmowie
**nie jest zapisem**. Zapisem jest wpis nadzorcy: `✔ ZATWIERDZONE` w rozmowie
**oraz** wiersz w `REJESTR_EKRANOW.md` **oraz** — jeśli doszła nowa reguła —
linia w `KANON_Z_ODBIOROW.md`. Wszystko w tej samej godzinie.

**Nigdy nie zakładam zgody z ciszy.** Brak odpowiedzi to brak odbioru, nie akcept.

## ★ Audyt przedstartowy 2026-08-30 — pięć luk domkniętych

Finalny przegląd procesu przed startem wykrył pięć braków operacyjnych.
Bez nich pierwszy ekran stanąłby na pytaniu „ale jak właściwie mam to zmierzyć".

### 1. Środowisko pomiarowe — JAK renderuję ekran

Dwie drogi, wybór per ekran, zapis w rejestrze która:
- **Żywy runtime**: `npm run dev` lokalnie (front `:3000`, backend `:3001`,
  baza staging=demo). Do ekranów osiągalnych z nawigacji. Zero logowania
  właściciela — konto testowe.
- **Harness dev-render**: `dev-render/` + wpis w `.claude/launch.json`
  (wzór: istniejące konfiguracje na portach 33xx/45xx). Do ekranów za flagą,
  prototypów i ekranów bez danych. Mock-dane, bez backendu.

**Flagi włączam WYŁĄCZNIE w środowisku uruchomienia** (env / config harnessu).
Zmiana wartości domyślnej flagi w kodzie = odsłonięcie ekranu bez akceptu —
zakazane do chwili odbioru (reguły #7/#9 `CLAUDE.md` pozostają w mocy;
po akcepcie flagi włączamy **jedna po drugiej**, nigdy hurtem).

### 2. Jednostka rejestru — czym jest „ekran"

**Jeden wiersz = jedna trasa + jedna zakładka/stan główny.** Nie plik, nie
komponent, nie moduł. Powód: poprzedni spis powierzchni upadł na mieszaniu
jednostek (pliki vs powierzchnie) i żadnej liczby nie dało się obronić.

### 3. Konwencja zrzutów — gdzie leżą dowody

`evidence/grafika/<NN-modul>/<ekran>__<PRZED|PO>__<dark|light>.png`
Podkatalog per moduł (katalog `evidence/` jest dziś płaski i ma ~500 plików —
nie dokładamy do sterty). Zrzut wchodzi do repo w tym samym commicie co wiersz
rejestru, który się na niego powołuje.

### 4. Wzorzec musi być plikiem, nie wspomnieniem

Ekran wzorcowy `INS-2026-014` **nie istnieje w repozytorium** — właściciel
pokazał go w rozmowie. Substancja jest utrwalona jako 10 reguł
w `KANON_Z_ODBIOROW.md` + wzorce `../plany/WZORZEC_*.html`.
**Partia 0 tego toru: odtworzyć ekran wzorcowy jako plik w `dev-render/`**,
porównać zrzut z regułami kanonu i dopiero wtedy używać go jako lustra.
Do tego czasu wiążące są reguły, nie pamięć obrazu.

### 5. Domknięcie partii — co znaczy „odebrane"

Po akcepcie partii, **w tej samej godzinie**: wiersze rejestru dostają werdykt ·
nowe reguły idą do `KANON_Z_ODBIOROW.md` · zrzuty PO leżą w `evidence/grafika/` ·
commit + push na `github-backup`. Ekran bez tego kompletu **nie jest** odebrany,
choćby właściciel powiedział „ładne".

### Krok zerowy całego toru (z planu grafiki, wiążący)

**Pogodzenie dwóch rejestrów odbioru** — macierz zgodności UI (2.08, zero
odbiorów) i rejestr decyzji właściciela (24–27.08, 59 akceptów) nie znają się
nawzajem. Zanim cokolwiek pomaluję, każdy moduł dostaje w `REJESTR_EKRANOW.md`
stan odbioru uzgodniony z OBU źródeł. Bez tego będę „poprawiał" ekrany, które
właściciel już przyjął — czego jawnie zakazał.

## Kolejność pracy

Sidebar z góry na dół, w module funkcje od lewej do prawej, zgodnie z procesem
pracy w module. Kolejność kanoniczna wg `src/components/navigation/Sidebar/menuConfig.ts`.
