---
doc_id: funkcje-znalezisko-podglad
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# Trzeci element kanonu list — PODGLĄD — nie został sfotografowany ANI RAZU

## Pomiar toru grafiki
Kanon ekranu listowego to **pasek + tabela + podgląd**. Podgląd otwiera się po kliknięciu
w wiersz.

**Dwanaście obejrzanych zrzutów, z dwunastu różnych modułów: dwanaście pokazuje samą tabelę.
ZERO z podglądem.**

Potwierdzone w kodzie: **33 ekrany** mają podgląd bramkowany kliknięciem (23 zmierzone
co do linii), 164 nierozstrzygnięte — a **wzorzec bramkowania jest identyczny w całej
aplikacji**, nie lokalną anomalią. **Realna liczba jest wyższa.**

## Nasz pomiar — jesteśmy w tym samym miejscu
```
0 z 20 ekranów dowodowych dyżurów zawiera cokolwiek o stanie podglądu
```
**Żaden z naszych ekranów dowodowych nie fotografuje otwartego podglądu.** Nie „część" —
**żaden.**

## Co to znaczy dla akceptów właściciela
Właściciel ocenia ekrany listowe **od miesięcy**. **Widział pasek i tabelę.**
**Trzeciej części kanonu — tej, którą sam ustanowił jako obowiązkową — nie widział ani razu.**

To nie jest ta sama sprawa co **kształt 21** (atrapa uwiarygodniła defekt). Tam obraz
**kłamał**. Tu obraz jest **prawdziwy, ale niepełny** — i nikt nie zauważył, czego na nim nie ma.

> **Pytaliśmy „czy ten zrzut pokazuje produkt". Nie pytaliśmy „czy pokazuje CAŁY ekran".**

## ★ To jest reguła „zgłoszona pozycja jest próbką" zastosowana do SPOSOBU PRACY, nie do defektu
Regułę o próbkach wprowadziliśmy dziś dla **defektów**: zgłoszona trasa jest próbką rodziny,
zgłoszone piętro jest próbką mechanizmu.

**Tor grafiki zastosował ją do samego fotografowania** — i wyszło, że **każdy zrzut jest
próbką ekranu**, a my braliśmy go za ekran.

**Ta sama zmiana pytania działa w obu miejscach.**

## Zdanie, które rozstrzyga pilność
Robotnik toru grafiki, przed przelotem przez 253 ekrany:
> **„Bez świadomej decyzji powtórzymy dokładnie ten sam błąd na dużo większą skalę."**

**Dlatego to musi trafić do właściciela PRZED następną turą zrzutów, nie po.**

## Do rozstrzygnięcia przez właściciela — jedno pytanie, JEDNA wspólna rekomendacja

**Czy zrzuty ekranów listowych mają odtąd obejmować stan z otwartym podglądem?**

### ★ Rekomendacja WSPÓLNA obu torów (moja pierwotna była droższa i została wycofana)

> **Dwa zrzuty po kliknięciu w wiersz. Cztery tylko tam, gdzie podgląd ZASŁANIA tabelę.
> Archiwum bez przefotografowania, ale z adnotacją WYMIENIAJĄCĄ Z NAZWY, czego w kadrze
> nie było.**

**Koszt: ZERO dodatkowych zrzutów.** Nadal dwa na ekran (jasny i ciemny) — tylko poprzedzone
kliknięciem. **Zmienia się jedna rzecz w przelocie, nie jego rozmiar.**

**Podstawa — zmierzona po obu stronach:** podgląd w tym produkcie jest **panelem BOCZNYM,
nie nakładką**, więc **jeden kadr pokazuje tabelę i podgląd naraz**.
Potwierdzone niezależnie u nas: kanoniczny `StandardPreview.tsx` **nie ma żadnego
pozycjonowania nakładkowego** (`fixed` / `absolute` / `inset-0` — zero wystąpień),
czyli jest elementem w przepływie strony. Panel boczny używany w **5** miejscach,
wariant nakładkowy w **3**.

**Wyjątek nazwany:** tam, gdzie podgląd jest nakładką zasłaniającą tabelę, jeden kadr
nie wystarczy — **cztery zrzuty, ale tylko tam**. Rozstrzygać **mechanicznie**
(nakładka czy panel boczny), nigdy per ekran z pamięci.

### Moja pierwotna rekomendacja i dlaczego ją WYCOFUJĘ
Proponowałem **cztery zrzuty na każdy ekran listowy**. Tor grafiki wykazał, że to podwaja
koszt bez potrzeby — i **nie chodzi o czas maszyny**:

> **Przy 253 ekranach to jest różnica między 506 a 1012 kadrami do przejrzenia PRZEZ CZŁOWIEKA.
> Czas maszyny jest tani, jego czas nie.**

**Policzyłem koszt po niewłaściwej stronie.** Liczyłem zrzuty, a wąskim gardłem jest
**właściciel patrzący na obrazy**.

### Zaostrzenie adnotacji do archiwum — od toru grafiki, przyjęte
Moje „pokazuje dwie części z trzech" jest **za słabe, bo nie mówi, CZEGO właściciel nie
widział**. Adnotacja ma **wymieniać z nazwy** brakujące elementy — u nich: blok AI,
powiązania, akcje i „co dalej".

> **Wtedy właściciel wie, CO ma obejrzeć przy najbliższej okazji, zamiast wiedzieć,
> że coś mu umknęło.**

## ★ Zastrzeżenie do naszego wspólnego pomiaru — NIE sumować dwóch liczb
Nasze **0 z 20** i ich **12 z 12** są **zgodne co do kierunku, ale mierzą CO INNEGO**:
- **my** — czy dowody dyżurów **wspominają** o stanie podglądu;
- **oni** — czy panel **jest w kadrze**.

**To są dwa różne braki.** Sformułowanie toru grafiki, przyjęte:

> **Nie sumujmy tych liczb i nie podawajmy właścicielowi jako jednego pomiaru — inaczej sami
> zrobimy to, co dziś ścigaliśmy: dwie kontrole karmiące się z różnych źródeł, zlepione
> w jedno zdanie mocniejsze niż każda z osobna.**

## ★ Sprostowanie do wcześniejszego zapisu tego dokumentu
Zapisaliśmy wcześniej z uznaniem, że tor grafiki „zostawił sześć bezpieczników świadomie,
z powodem". **Tor grafiki sam to wycofał**: ich przeglądający **wrzucił trzy skrypty
do jednej rodziny i orzekł o wszystkich na podstawie dwóch**.

Jeden z tych trzech — `check-list-canon.sh` — **ma fallback na pełny skan**, czyli
zachowanie wzorcowe, a nie „ostrzeż i przepuść". **To ten sam plik, ta sama linia
co u nas** — nie ich wersja kontra nasza.

**Czyli „sześć zostawionych świadomie" to była próbka ogłoszona stanem zbioru** — dokładnie
ten kształt, który w tym programie kosztował już cały dzień. **Do czasu ich pomiaru tamta
lista jest NIEZWERYFIKOWANA i tak ją tu odnotowujemy.**
