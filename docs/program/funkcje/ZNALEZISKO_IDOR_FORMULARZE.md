---
doc_id: funkcje-znalezisko-idor-formularze
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# Obca organizacja mogła czytać I TRWALE KASOWAĆ formularze cudzej organizacji

Znalezione **przypadkiem**, przy naprawie zupełnie innej rzeczy — kreatora formularzy,
który nie zapisywał. Naprawiający podpinał ekran do zaplecza i **przy okazji sprawdził
uprawnienia**, bo tak każe instrukcja. Gdyby nie sprawdził, ta dziura zostałaby.

## Dziura — zmierzona na żywo, przed naprawą
Trzy trasy formularzy (**odczyt, zmiana, usunięcie**) **nie miały żadnej kontroli
organizacji**. Token organizacji **B**:
- **odczytał** formularz organizacji **A** — odpowiedź `200`, pełna zawartość;
- **usunął go TRWALE** — odpowiedź `204`, rekord zniszczony.

Sąsiednie trasy (tworzenie i lista) **miały** kontrolę. Czyli zabezpieczenie było
**założone w połowie rodziny tras**, a nie w całej.

## Naprawa
Dodano kontrolę wzorowaną **na dwóch istniejących, poprawnych** kontrolach tego samego
modułu — nie wymyślano nowego mechanizmu.

**Po naprawie:** obcy dostaje `403` na wszystkich trzech trasach, właściciel `200`/`204`
na tych samych operacjach na tym samym rekordzie. **Para dowodowa spełniona w obie strony** —
drugi człon jest tu istotny, bo sam `403` dla wszystkich też byłby „zielony".

**Dowód mutacyjny:** po usunięciu zabezpieczenia obcy znowu **czyta i kasuje**; po
przywróceniu — cztery testy z czerwonych robią się zielone, a razem z zastanymi **20 na 20**.

## ★ Wniosek, który jest ważniejszy od tej jednej dziury
> **Zabezpieczenie założone na części rodziny tras jest gorsze niż jego brak w całej —
> bo wygląda na obecne.**

Ktoś patrzący na moduł widzi kontrolę przy tworzeniu i liście i **rozsądnie zakłada**,
że reszta też ją ma. Ten sam kształt widzieliśmy dziś przy **Spotkaniach**: naprawa
otworzyła **dwie z trzech bramek** tej samej funkcji.

**Do zrobienia:** przegląd wszystkich rodzin tras pod kątem „czy kontrola jest na KAŻDEJ,
czy tylko na niektórych". To jest tani przebieg, a klasa ryzyka jest najwyższa z możliwych.

## Jak naprawiono sam kreator — wzorzec do naśladowania
Naprawiający **nie łatał zepsutego okna**. Odkrył, że w tym samym pliku **od dawna istnieje
poprawny, działający mechanizm** formularzy — wołający realne zaplecze i pokazujący sukces
dopiero po wyniku — tylko **osiągalny jedną z czterech dróg z menu**.

**Usunął zepsute okno (53 linie) i przekierował trzy pozostałe wejścia do tego, co już
działało.** Zero nowego kodu zapisu.

To jest dokładnie odpowiedź na wniosek z tego samego dnia: *zabezpieczenie w warstwie
wspólnej nie chroni przed wywołaniem, które tej warstwy nie używa* — więc **wywołanie
podpina się pod warstwę, zamiast dostawać własną kopię naprawy**. Naprawa per-wywołanie
już raz odrosła w tym produkcie po ośmiu tygodniach w dwunastu plikach.
