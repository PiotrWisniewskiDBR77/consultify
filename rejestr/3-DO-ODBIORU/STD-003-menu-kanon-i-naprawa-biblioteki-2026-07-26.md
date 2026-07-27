# STD-003 — Menu kanon 5 tabów + naprawa Biblioteki Szablonów (po żywym feedbacku)

- **Stan:** DO ODBIORU (2026-07-26, wieczór)
- **Demo:** `20b5339d41`, tag `demo-safe-2026-07-26-menu-canon`. Deploy Railway `b96ea43f` SUCCESS,
  health-check 200 potwierdzony.
- **Kontekst:** reakcja na Twój żywy feedback (zrzuty demo) — analiza wykazała 4 problemy,
  3 naprawione mechanicznie, 1 (kolorowa "tęcza" w filtrze Source) świadomie odłożony.

## Co naprawione

**1. Menu Materiałów — z powrotem 5 kanonicznych pozycji**
Zgodnie z `docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md` §3.
"Architekt szablonów" i "Generator szablonów Excel" NIE są już osobnymi zakładkami — przeniesione
do wnętrza zakładki **Szablony**, osiągalne przez przycisk **"New template"** (split-button:
klik na strzałce obok pokazuje "Architekt szablonów (Prezentacja)" / "Generator szablonów (Arkusz)").
Zero utraty funkcji — to co włączyłeś 07-22 działa dalej, tylko inaczej dostępne.
Sidebar: usunięty duplikat "Excel" (trasa `/excele` działa nadal wpisana ręcznie w URL).
Stare linki `?tab=template_architect`/`?tab=workbook_templates` nadal działają (lądują w Szablonach).

**2. Chipy statusu w Bibliotece Szablonów — teraz żywe**
Wcześniej Active/Draft/Deprecated/Archived pokazywały 0/0/0/0 przy "All 111" — strukturalnie ślepe
(dwa z czterech statusów nigdy nie mogły wystąpić w danych). Teraz chipy generowane dynamicznie,
pokrywają realne statusy (Published/Approved/Draft/Deprecated).

**3. Zdublowane wiersze w Bibliotece — naprawiona przyczyna, nie tylko objaw**
To NIE był duplikat danych ani błędna migracja — to była **cicha usterka współbieżności** w
rejestrowaniu artefaktów, trwająca od kwietnia. 52% szablonów w Bibliotece (180 z 347) było
"sierotami" tego błędu. Naprawione na przyszłość + ukryte istniejące sieroty z list (żadne dane
nie zostały skasowane).

## Do klikania w odbiorze
1. Menu boczne: sprawdź że nie ma już osobnej pozycji "Excel" (jest tylko "Materiały").
2. `/presentations` (Materiały): licz zakładki Menu 1 — powinno być dokładnie 5 (Wszystkie/
   Dokumenty/Prezentacje/Arkusze/Szablony), bez "Architekt szablonów"/"Generator Excel" jako osobnych.
3. Zakładka Szablony: kliknij strzałkę obok "New template" → 2 opcje generatorów → otwiera się
   w miejscu tabeli z przyciskiem "← Szablony" u góry.
4. Ta sama zakładka: sprawdź chipy statusu u góry — powinny pokazywać niezerowe liczby dla
   Published/Approved (nie tylko "All").
5. Policz wiersze dla "KPI Review Report" i podobnych — powinien być JEDEN wiersz, nie dwa.

## ★ Znaleziony przy okazji, ODŁOŻONY do następnej rundy (nie w tym pushu)
Zgłoszony przez Ciebie na żywo: filtr "Source" w zakładce Presentations ma tęczowe kolory pigułek
(Tool/Assessment/Finance/Upload), w dark theme dropdown nachodzi na górny pasek. Nie zbadałem
jeszcze źródła — wymaga osobnego śledztwa, nie chciałem naprawiać naprędce bez zrozumienia
mechanizmu (może dotyczyć wielu tabel w aplikacji, nie tylko tej jednej).

## Uczciwe zastrzeżenie weryfikacji
Sidebar (brak Excel) zweryfikowałem osobiście, zrzut light+dark. Wnętrza zakładki Szablony
(split-button) NIE zobaczyłem na żywo własnymi oczami — hook danych tego ekranu jest zbyt ciężki
do bezpiecznego zamockowania pod presją czasu. Polegam na 19/20 automatycznych testów (1 nieistotny,
pre-existing) + czystym strażniku kolorów. Jeśli przy klikaniu coś wygląda inaczej niż opisano —
to jest dokładnie ten fragment, którego jeszcze nie widziałem.
