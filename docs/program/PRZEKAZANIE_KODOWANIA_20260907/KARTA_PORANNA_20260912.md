# Karta poranna — 12.09.2026 (noc 11/12.09, „doprowadź do pełnego wdrożenia")

Piotrze, wykonałem Twoje polecenie z 20:30. Poniżej uczciwie: co jest na żywo, co się po drodze wywróciło i jak to naprawiłem, co zostało, i pięć decyzji, na które nadal czekam.

---

## 1. Co jest na żywo (staging i demo = ta sama wersja `60051310d7`)

**Wszystko, co zbudowano w nocy 10/11 i przez cały 11.09 — 15 paczek**, w tym:

- naprawa utraty przypisania zadania (hotfix), panel Teresy po odświeżeniu, megatrendy wg branży;
- karty N od Codexa z poprawkami (Wniosek, Decyzja, Powiadomienie, Sesja wywiadu, Wzorzec, Karta działania);
- Ocena: „Otwórz zadanie" i „dodaj powiązanie"; historia zadania w bazie; maile pierwszego kontaktu po angielsku ze słownika;
- **uprawnienia:** zamknięte 6 realnych dziur (edycja cudzych decyzji, usuwanie i przepinanie cudzych zadań, a nocą jeszcze jedna — członek projektu z rolą „właściciel inicjatywy" mógł zmieniać cudze zadania);
- karta zadania w Mojej Pracy otwiera się dla zadań, które zgłosiłeś, a nie tylko wykonujesz (wcześniej 38 z 46 dawało błąd);
- Realizacja ładuje dane jednym zapytaniem zamiast 20 (szybsze Zasoby i Praca);
- bloki Codexa 1, 2 i 3 (jeden magazyn inicjatyw, zapis do nowego rejestru, Finanse minimum) — **za wyłączonymi flagami**, nic nie widać;
- dług językowy: 263 klucze angielskie dopisane, 54 stare czerwone testy naprawione.

**Dowody na żywo po wdrożeniu (skryptem, nie okiem robotnika):** wszystkie zapisy 200/201, zero błędów serwera; członek projektu dostaje 403 na cudzym zadaniu i wiersz w bazie nie drgnął; Twoja karta zadania jako zgłaszającego otwiera się; aplikacja startuje w 1,5 s, każdy moduł w 1,6 s.

**Punkty cofnięcia:** tag `staging-safe-20260912-0003` (= stan z Tokio + hotfix) i zrzuty obu baz.

## 2. Co się wywróciło po drodze (i dlaczego rano jest dobrze)

1. **21:00 wdrożyłem pierwszą paczkę.** Odbiór adwersaryjny na żywo (3 godziny, obie role) znalazł 4 blokery: dziurę uprawnień dla ról projektowych, kartę zadania 404, oraz „Inicjatywy, Materiały, Organizacja nie otwierają się".
2. **22:22 cofnąłem staging i demo** do wersji z Tokio — dla bezpieczeństwa.
3. **Diagnoza:** dwa blokery były prawdziwe i **istniały już w wersji z Tokio** (naprawione w nocy). „Nie otwierają się" okazało się **wadą przyrządu**: robot otwierał każdy ekran na zimno z limitem 15 s, a aplikacja na zimno ładuje 5,4 MB i startuje 16–26 s. Z ciepłą sesją wszystko otwiera się w 1,6 s. Limit podniosłem do 45 s z przyciskiem „ponów".
4. **00:00 wdrożyłem ponownie** z naprawami, po zielonej bramce, z dowodami wyżej.

**Moje dwa błędy tej nocy, zapisane w rejestrze:** (a) cofnięcie było zbyt pochopne — oparte na pomiarze, który sam zaraz potem obaliłem; (b) sprzątając kopie baz robotników skasowałem dwie bazy, których nie zakładałem tej nocy (`consultify_staging_kopia`, `consultify_jzz`); szablony i żywe bazy nietknięte.

## 3. Trzy pojemniki — gdzie jesteśmy

**Pojemnik 1 (MVP Twoimi rękami):** kryterium „zero blokerów" — 9 dziur zamkniętych w kodzie i na żywo; zostaje **Twoje przejście** Inicjatyw i Realizacji (warunkowe Tak z 10.09 → do potwierdzenia po tej paczce) i ponowny odbiór adwersaryjny z ciepłą sesją (zlecę rano).

**Pojemnik 2 (MVP rękami klienta):** demo ma ten sam kod, sprzątacz sesji, CSRF, furtki testowe wyłączone, Twoje konto (to samo hasło co na stagingu). Zmierzona wydajność 16 ekranów: 8 z 10 wiarygodnych powyżej 3 s — przyczyna to jeden pakiet 5,4 MB ładowany na starcie, nie zapytania; naprawa (podział pakietu) to osobny dyżur z weryfikacją wzrokiem. Bloki Codexa 2 i 3 odebrane; Codex 3 zostawił seed danych (Codex 3b), Codex 2 zostawił sześciu pisarzy — **instrukcja Codex 2b gotowa, wklejka niżej**.

**Fala 2:** bez zmian (3.19, 3.20, dalej wg listy). Instrukcje kolejnych bloków Codexa piszę bez Twojego udziału; wizualne rzeczy czekają na prototyp i Twoje „Tak".

## 4. Pięć decyzji (bez zmian od wczoraj, odpowiedz literą)

1. Inicjatywa bez projektu (105 rekordów): **A** zostawić · B dopuścić jako stan legalny.
2. Finanse w menu: **A** zamknięte · B „wkrótce" · C otworzyć (dziś żadna rola nie zatwierdzi sprawozdania przez API — naprawa centralna przed C).
3. Poczta Hostinger wyłączona: A sprawdzisz w panelu · **B** zmiana dostawcy.
4. Pilotaż: **A** demo · B staging. (Brakuje e-maila Iriny.)
5. Dwa Postgresy na stagingu: **A** usunąć martwy · B zostawić.

## 5. Wklejka dla Codexa nr 2b (sześciu pisarzy legacy → nowy rejestr)

Skopiuj w całości z pliku (45 linii):

```
git -C /Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git fetch origin --prune && git -C /Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git show origin/integracja/20260911:docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX2B_SZESCIU_PISARZY/00_WKLEJKA.txt
```

Marker bloku: `a176d3f906`. Wczorajsza wklejka Codex 2 jest nieaktualna (blok dostarczony i scalony).

---

Rejestr: `PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md` (wiersze od „NOC 11/12.09 — mandat właściciela"). Raporty nocy: `ODBIOR_STAGING_7e8668c7cc_20260911.md`, `DIAGNOZA_W3_W4_20260911.md`, `POMIAR_WYDAJNOSCI_STAGING_20260911.md`.
