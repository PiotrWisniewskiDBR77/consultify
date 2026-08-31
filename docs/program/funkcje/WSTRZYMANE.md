---
doc_id: funkcje-wstrzymane
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# Dyżury wstrzymane — gotowe do wydania, czekają na decyzję o tempie

Ten plik istnieje, żeby **wstrzymana praca nie zginęła w rozmowie**. Instrukcja jest
złożona, sprawdzona i leży w repozytorium; brakuje wyłącznie klonu i wklejki, a jedno
i drugie odtwarza się w minutę.

---

## Dyżur 156 — warianty redakcji w dokumencie klienta

**Wstrzymany 2026-08-30 na polecenie właściciela:** utrzymujemy **trzy** nurty
równoległe, nie cztery.

**Stan w chwili wstrzymania:** zero commitów, zero pracy wykonanej, klon usunięty.
**Nic nie przepadło.**

**Instrukcja gotowa:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_156_REDAKCJA_DOKUMENTU.md`

**Dlaczego wybrałem akurat ten do wstrzymania.** Z czterech wydanych to jedyny,
którego wynikiem **nie jest naprawa, tylko materiał do decyzji właściciela** —
dwa warianty do wyboru. Pozostałe trzy usuwają konkretne szkody: 153 kończy
łatanie tej samej przyczyny po jednym obiekcie, 154 naprawia ciche pęknięcie
łańcucha, przez które produkt zgłasza sukces zamiast błędu, 155 sprawia, że
załącznik przestaje znikać po odświeżeniu.

**Dodatkowy powód:** temat 156 i tak jest zablokowany decyzją właściciela o tym,
jak ma wyglądać dokument klienta. Wydanie go przed tą decyzją groziło tym, że
warianty trzeba by przerabiać.

**Co niesie ze sobą, gdy wróci:** pomiar zasięgu warstwy redakcji, dwa warianty
za flagą domyślnie wyłączoną, i **trzy realne pliki** (dziś, wariant A, wariant B)
z sumami kontrolnymi, żeby właściciel wybrał, patrząc na papier.

**Znalezisko, które już z niego wyszło i nie czeka na wydanie:**
`documentQaService.ts:804-836` — funkcja `isSafetyPlaceholder` **wyklucza napisy
o usuniętej treści z pomiaru jakości**. Dokument pełen redakcji może przejść
kontrolę gęstości, bo te akapity **się nie liczą**. To jest ślepa plamka miernika,
osobna od samej redakcji, i **jest już zapisana** jako pozycja do rozstrzygnięcia.

**Warunek wznowienia:** zwolnienie jednego z trzech nurtów **albo** decyzja
właściciela o wariancie redakcji — wtedy dyżur może od razu budować wybrany,
zamiast przygotowywać oba.
