---
id: IDE-021
tytul: NAPRAWA — Przepływ: Wklej, Delete na połączeniu, Wstaw między; Eksport nie tworzy już rekordów
typ: zadanie
waga: wysoka
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Standard docelowy Idea Workspace — P1-4, P1-7, P1-3"
utworzone: 2026-07-24
ekran: processflow-canvas
wysokosc: 900
klik: "W Przepływie: kliknij prawym na krok → „Kopiuj", potem prawym na puste tło → „Wklej" (ma być aktywne i wkleić kopię). Zaznacz połączenie i wciśnij Delete (ma zniknąć). Zaznacz krok z jednym wyjściem i użyj „Wstaw między" na pływającym pasku."
---

## 1. PROBLEM

Cztery rzeczy w Przepływie, które wyglądały na działające, a nie działały.

- **„Wklej"** duplikowało zaznaczenie zamiast wkleić schowek — a schowka w ogóle nie było. W menu tła, gdzie nic nie jest zaznaczone, było to kliknięcie w próżnię.
- **Delete na połączeniu** nic nie robił. Kasowanie liczyło tylko kroki, więc zaznaczone samo połączenie było dla niego niewidzialne.
- **„Wstaw między"** za każdym razem kończyło się błędem „zaznacz najpierw połączenie". Jego jedyny przycisk siedzi na pasku, który pojawia się tylko przy zaznaczonym kroku — a akcja wymagała zaznaczonego połączenia. Te dwa stany się wykluczają.
- **Eksport** zawierał „Raport" i „Prezentację", które tworzyły trwały rekord w systemie, a nie plik.

## 2. ROZWIĄZANIE

- Prawdziwy schowek: „Kopiuj" w menu kroku, „Wklej" w menu tła. Puste — „Wklej" wyszarzone z powodem. Wklejenie zachowuje połączenia wewnątrz kopiowanego fragmentu.
- Kasowanie liczy teraz kroki i połączenia. Zaznaczone połączenie znika po Delete.
- „Wstaw między" wnioskuje połączenie z zaznaczonego kroku, gdy wybór jest jednoznaczny (jedno wyjście). Przy wielu wyjściach mówi, że trzeba wskazać połączenie — zamiast dawać ogólny błąd.
- „Raport" i „Prezentacja" wyprowadzone z Eksportu. Były duplikatem — te same pozycje są w Konwersji, gdzie należą. W Eksporcie zostały same formaty plików.

## 3. JAK ODEBRAĆ

Ścieżka do przeklikania jest w nagłówku. Dodatkowo: otwórz „Eksport" — nie ma tam już „Raportu" ani „Prezentacji (deck)". Otwórz „Konwertuj" — obie tam są.

## 4. WERYFIKACJA WYKONANA PRZED ODDANIEM

- Pełny cykl schowka zmierzony w działającej aplikacji: pusto → „Wklej" wyszarzone; po „Kopiuj" → aktywne; wklejenie dodaje dokładnie jeden krok.
- Delete na połączeniu: zmierzone, usuwa jedno połączenie.
- Obiekt testowy przywrócony do czystego stanu 9/9 po testach — zero śladów.
- ★ Przy weryfikacji złapałem własny błąd: „Kopiuj" najpierw czytało zaznaczenie, a prawy klik kroku go nie zaznacza, więc schowek zostawał pusty. Poprawione, żeby kopiować krok spod menu.
