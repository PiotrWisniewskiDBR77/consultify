---
doc_id: funkcje-gamma-przewodnik
status: canonical
owner: piotr
truth_type: strategy
established: 2026-09-01
---

# Gamma — punkt wejścia. Co wiemy, skąd to wiemy, czego NADAL nie wiemy

Siedem dokumentów, pomiar kodu i **przejście po żywym koncie właściciela** (1.09).
Ten plik jest jedynym wejściem; reszta to szczegóły.

## Marzenie — sformułowane przez właściciela i przez niego potwierdzone

> **Gamma ma formę bez wiedzy. Consultify ma wiedzę bez formy.**

To **nie jest** prośba o ładne slajdy. Właściciel **prowadzi swoje doradztwo w Gammie**:
367 prezentacji na jednym motywie, sześć motywów na linie biznesowe, realni klienci.
Ból jest jeden: **treść mieszka w Consultify, artefakt powstaje w Gammie**, więc właściciel
**przepisuje ręcznie to, co system już wie**. Marzeniem jest **koniec tego rozdwojenia**.

Nasza własna dokumentacja mówi, że Consultify **nie ma być** „generatorem dokumentów bez
powiązania ze źródłami", a łańcuch obietnicy kończy się słowem **materiał**. Czyli marzenie
właściciela i deklarowany produkt to **to samo zdanie**, powiedziane dwa razy.

## Trzy filary — słowami właściciela, nie moimi

Zapytany, **co konkretnie** zachwyca ludzi w Gammie, wskazał trzy rzeczy:

1. **Obrazy w wybranym stylu** — użytkownik wybiera rodzaj (fotografia, rysunek i dalej,
   **sześć pozycji**), a Gamma generuje pasujące obrazy.
2. **Układ, kolorystyka, kształty** — z jego własnym zastrzeżeniem: *„formatów układów
   nie mają dużo i często się powtarzają, ale pierwsze wrażenie jest super"*.
3. **Treść pisana ZANIM ruszy produkcja slajdów** — *„to sprawia, że prezentacja wie,
   co opowiada"* — plus **agent, któremu mówisz co zmienić, i to się zmienia**.

**To jest właściwa miara naszej pracy.** Nie „czy wygląda jak Gamma", tylko
**czy te trzy filary działają u nas**.

## Stan filarów u nas — na 1.09, po scaleniu czternastu dyżurów

| Filar | Stan | Uczciwie |
| --- | --- | --- |
| **3. Treść przed slajdami + agent** | **Zbudowany** | Talia powstaje z wiedzy organizacji. Agent działa i **nie może już fabrykować cytowań**. Ale **nazwy trzech operacji kłamią**: „przeredaguj" nic nie redaguje, „podziel slajd" tnie w środku wyrazu. Szkielet, nie mięso. |
| **1. Obrazy w stylu** | **Przewód gotowy, jakość nieoceniona** | Sześć stylów, wybrany styl **realnie dociera do polecenia dla modelu**. Nikt nie porównał wyników z gammowymi. |
| **2. Układ, kolor, kształty** | **DZIURA** | Geometria — dyżur 227 w odbiorze. Kolor i typografia — dyżur 229 wydany, nic nie scalone. **Jedyny filar bez dorobku.** |

## ★ Twardy sufit — zmierzony w zainstalowanej paczce, nie z pamięci

Biblioteka, którą składamy PowerPointa (wersja 4.0.1), ma:
- **gradienty: ZERO wystąpień**
- **osadzanie czcionek: ZERO wystąpień**
- przezroczystość: obecna

**Gradientowego tła i własnego kroju pisma tą drogą nie dowieziemy.** To nie jest opinia
o trudności — to jest brak funkcji w bibliotece. A gradient i krój to **dwa z trzech
składników „pierwszego wrażenia"**, o którym mówi właściciel przy filarze 2.

## Mechanizmy Gammy rozstrzygnięte na żywym koncie

- **Dwa tryby projektowania slajdu** (przełącznik przy generowaniu).
- **Domyślne płótno nie jest 16:9** — jest płynne.
- **Treść powstaje jako zarys, przed slajdami** — kolejność potwierdzona co do przycisku.
- **★ Dopasowanie koloru obrazów — mechanizm ROZSTRZYGNIĘTY:** motyw niesie **polecenie
  stylu**, doklejane do **każdego** generowania obrazu. Stąd spójność 367 prezentacji.
  To jest **najtańsza do skopiowania rzecz z całej Gammy** i mamy jej odpowiednik
  w dyżurze 228.
- **Infografiki z wtopionym tekstem, po polsku.**
- **Edytor motywu ma sześć zakładek** i **własne sprawdzanie kontrastu** — wzorzec dla
  naszego martwego edytora.
- **Gamma sama ostrzega**, że eksport do PowerPointa przesuwa układ. Czyli **nawet oni**
  nie mają wierności między swoim renderem a plikiem.
- **Gamma ma API.**

## ★★ Czego NADAL nie wiem — i co z tego zmieniłoby plan

To jest uczciwa lista, nie retoryka. Każda z tych rzeczy może **odwrócić kierunek**.

1. **API Gammy — co dokładnie przyjmuje i co zwraca.** Widziałem, że istnieje;
   **nie otwierałem** dokumentacji ani cennika. **Jeśli przyjmuje gotową treść i oddaje
   gotową prezentację, to jest najkrótsza droga do marzenia właściciela** i cała nasza
   praca nad filarem 2 zmienia sens: przestajemy gonić wygląd, zaczynamy dostarczać treść.
   **To jest pytanie numer jeden.**
2. **Czy zmiana motywu naprawdę zmienia wygląd**, czy tylko paletę — nie testowałem
   edytora motywu na żywej prezentacji.
3. **Limity i koszt konta** — ile generowań, co się dzieje po przekroczeniu.
4. **Jak bardzo eksport psuje układ w praktyce** — ostrzeżenie widziałem, skutku nie.
5. **Czy da się wgrać własny motyw firmowy** z brandbooka klienta.

## Rekomendacja CTO (decyzja kierunku należy do właściciela)

**Trzy drogi do filaru 2**, wykluczające się kosztem, nie technicznie:

- **A. Zostajemy przy własnym składaniu.** Kolor, kształt, siatka, przezroczystość.
  Da się zrobić **czysto i porządnie**; **nie da się „wow" gradientem**.
- **B. Idziemy przez API Gammy.** Oni renderują, my dostarczamy treść. Rozdwojenie
  właściciela **znika**. Cena: zależność i opłata.
- **C. Renderujemy sami do obrazu** i wklejamy jako grafikę. Pełna kontrola wyglądu,
  ale slajd **przestaje być edytowalny** w PowerPoincie.

**Rekomenduję A na teraz, przy jednoczesnym ZBADANIU B jako osobnego, taniego toru** —
bo jeśli B naprawdę przyjmuje gotową treść, to **nie chcemy się o tym dowiedzieć
za trzy tygodnie**, po zbudowaniu filaru 2 własnymi rękami.

## Mapa dokumentów

| Plik | Co zawiera |
| --- | --- |
| `GAMMA_G0_POMIAR.md` | Co leży w naszym kodzie: martwy edytor motywu, **dwa niezgodne renderery**, sufit biblioteki, **utrata danych przy zapisie wyglądu** |
| `GAMMA_G1_SPECYFIKACJA.md` | 15 cech mierzalnych „jak z Gammy" — specyfikacja dla generatora |
| `GAMMA_G1_OBRAZY.md` | Sześć stylów obrazu, werdykt per styl |
| `GAMMA_G1_NAPIECIE.md` | Świadectwo właściciela kontra pomiar — rozstrzygnięcie |
| `GAMMA_G2_SESJA_NA_ZYWO.md` | Przejście procesu od środka |
| `GAMMA_G3_OBCHOD_MENU.md` | Obchód wszystkich menu; **mechanizm polecenia stylu** |
| `GAMMA_ZNALEZISKO_SZESC_STYLOW.md` | Sześć stylów było już w kodzie; **zawiera moje sprostowanie własnego fałszywego twierdzenia** |

## ★ Dokumentacja funkcjonalna dla właściciela — 2026-09-01

`docs/functional/12_prezentacje/README.md` odpowiada wprost na pytanie „co z
tych dziesięciu dyżurów działa", ustrukturyzowane wg trzech filarów
właściciela, z rozdziałem: działa · zbudowane ale wyłączone · nie istnieje ·
niemożliwe. `docs/functional/12_prezentacje/AS_IS_2026-09-01.md` to ten sam
pomiar, uporządkowany plik:linia per komponent kodu. Prezentacje pozostają
podsystemem `Materials` (menu 10), nie osobną pozycją menu — patrz
`docs/functional/10_materials/README.md`.
