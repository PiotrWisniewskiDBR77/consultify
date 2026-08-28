# PLAN DOJŚCIA — powrót do Fazy 2: pętla per moduł

**Podstawa:** plan zaakceptowany przez właściciela 2026-08-24. Faza 0 i 1 zamknięte.
**Jesteśmy w Fazie 2** i tylko w niej: integracja 16 modułów, moduł po module.
Ten dokument NIE wprowadza nowej metodyki — przywraca ustaloną.

---

## 1. PĘTLA PER MODUŁ — jedyny sposób zamykania

```
  podepnij → pogódź nazwane pliki → sprawdź → KOMPLETNE ZRZUTY → werdykt właściciela
```

**`CLOSED_FINAL` = SHA + hash zrzutów + tag `final-XX-nazwa`.**
Zamknięty moduł **nie wraca**. Nowe pomysły → backlog po-MVP.

**Warunek zrzutów (nienaruszalny):** kompletne z góry — jasny i ciemny motyw, stan pusty
i pełny, kebab wiersza, podgląd, karta. Właściciel nigdy nie jest pierwszym, który je widzi:
ogląda wykonawca → ogląda nadzorca → dopiero właściciel, do AKCEPTU.

---

## 2. STAN FAKTYCZNY — 16 modułów, zmierzony 2026-08-28

| # | moduł | status | co blokuje zamknięcie |
|---|---|---|---|
| 15 | Ustawienia | **CLOSED_FINAL** | — (tag `final-02`) |
| 01 | Organizacja | OWNER_REVIEW | 2 pozycje zamknięte; czeka werdykt |
| 03 | Narzędzia | OWNER_REVIEW | panel ekspercki 5,0/9,5 |
| 04 | Ocena | OWNER_REVIEW + **NO_GO** | panel 4,0; baza pusta (1 oceniony obszar na 39) |
| 08 | Spotkania | OWNER_REVIEW | 5 pozycji z dyżuru 57 otwartych |
| 09 | Wyniki | OWNER_REVIEW | panel; koperta uprawnień |
| 12 | Audyty | OWNER_REVIEW | panel 6,5 — najwyższy wynik programu |
| 13 | Czat | OWNER_REVIEW | producent sygnałów |
| 14 | Administracja | OWNER_REVIEW | 5 pozycji z dyżuru 53 otwartych |
| 02 | Wywiad | BLOCKED | ścieżka respondenta publicznego |
| 06 | Realizacja | BLOCKED | panel 3,6 — najniższy; zapis bez czytelnika |
| 07 | Moja praca | BLOCKED | parytet paneli, flagi cofnięte |
| 05 | Inicjatywy | **BLOCKED + NO_GO** | panel 4,0 |
| 10 | Finanse | **bez wpisu** | nigdy nie przechodzone |
| 11 | Materiały | **bez wpisu** | nigdy nie przechodzone |
| 16 | Partner | **bez wpisu** | łamie DEC-08 |
| 17 | Agent/Teresa | wydzielony (DEC-23) | na sam koniec, zaczyna od architektury |

**Zamknięte: 1 z 16.** Panele eksperckie: 3,6–6,5 przy celu 9,5.

---

## 3. KOLEJNOŚĆ — trzy grupy, nie szesnaście osobnych planów

Kolejność wynika z jednej zasady: **najpierw to, co blokuje najwięcej innych.**

### GRUPA A — trzy moduły nigdy nie przechodzone (10, 11, 16)
Idą pierwsze, bo nie wiemy o nich nic. Moduł bez wpisu to niewiadoma, a niewiadoma
psuje każdy szacunek. Pierwszy dyżur każdego to **rekonesans + pełne zrzuty**, nie budowa.

### GRUPA B — dziewięć modułów w OWNER_REVIEW (01, 03, 04, 08, 09, 12, 13, 14)
Mechanika jest, brakuje domknięcia i werdyktu. To najkrótsza droga do podniesienia
licznika zamkniętych. Każdy potrzebuje: domknięcia otwartych pozycji → zrzutów → werdyktu.

### GRUPA C — cztery zablokowane (02, 05, 06, 07)
Najdroższe. Każdy ma blokadę wymagającą decyzji produktowej albo przebudowy.
Idą na końcu, bo praca nad nimi bez rozstrzygnięcia blokady jest stratą.

---

## 4. CO DYŻUR MA ROBIĆ — żeby system nie wymyślał zadań

**Dyżur modułowy ma DOKŁADNIE trzy produkty i nic poza tym:**

1. **Domknięcie pozycji otwartych** wymienionych w `MODULE_ACCEPTANCE.md` tego modułu —
   po nazwie, nie „co się znajdzie".
2. **Komplet zrzutów** wg warunku z §1.
3. **Karta dowodowa** + wpis do dziennika budowy modułu.

**Czego dyżur NIE robi:** nie szuka pracy poza listą pozycji · nie refaktoryzuje ·
nie dodaje funkcji · nie poprawia innych modułów. Znalezisko poza zakresem → wpis
do rejestru jako pozycja otwarta, **bez naprawiania**.

To jest odpowiedź na „system zawsze wymyśli zadanie": **zakres dyżuru to lista pozycji
z rejestru modułu, zamknięta przed wydaniem.** Jeśli lista jest pusta — moduł idzie
od razu do zrzutów i werdyktu, bez dyżuru.

---

## 5. RACHUNEK

| grupa | modułów | dyżurów na moduł | razem |
|---|---|---|---|
| A — nieprzechodzone | 3 | 1 rekonesans + 1–2 budowa | 6–9 |
| B — owner review | 9 | 1 domknięcie + 1 zrzuty/werdykt | 18 |
| C — zablokowane | 4 | 1 rozstrzygnięcie + 2 budowa | 12 |
| moduł 17 Agent | 1 | architektura + 2 | 3 |
| bloki przekrojowe | — | dług testowy (6, plan gotowy) + wygląd | 6 + wygląd |

**Razem: 45–48 dyżurów modułowych + 6 długu testowego.**
Ta liczba **nie jest mnożeniem** — wynika z listy pozycji otwartych per moduł.
Zweryfikuje się po Grupie A: jeśli rekonesans trzech nieprzechodzonych pokaże więcej
pracy, niż zakładam, podnoszę liczbę jawnie i z przyczyną.

---

## 6. ODBIÓR GRAFIKI — wrócił do pętli

Przestaliśmy odbierać grafikę i to był błąd. **Wraca jako warunek werdyktu**, nie
osobna faza: moduł bez kompletu zrzutów nie dostaje `CLOSED_FINAL`, niezależnie od
tego, jak zielona jest jego mechanika.

Kolejność bez wyjątku: wykonawca renderuje i ogląda → nadzorca ogląda → właściciel akceptuje.

---

## 7. CZEGO PILNUJEMY, ŻEBY NIE POWTÓRZYĆ

- **Nie mnożymy metodyk.** Obowiązuje pętla per moduł z §1. Wszystko inne — test dymny,
  ścieżki użytkownika, inwentaryzacje — to narzędzia wewnątrz tej pętli, nie zamiast niej.
- **Nie zamykamy modułu bez zrzutów.** Zielona mechanika bez oględzin to połowa dowodu.
- **Nie otwieramy zamkniętych.** `CLOSED_FINAL` jest ostateczny.
- **Nie planujemy pojemnością.** Liczba dyżurów wynika z listy pozycji, nie z mnożenia
  modułów przez średnią.
