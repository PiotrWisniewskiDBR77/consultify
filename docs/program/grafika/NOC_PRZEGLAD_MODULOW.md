---
doc_id: grafika-noc-przeglad-modulow
status: current
truth_type: review
established: 2026-08-30
zakres: przegląd nocny 2026-08-30 — jedna sekcja per moduł, dopisywana przez każdego robotnika po zamknięciu swojego zakresu
---

# Przegląd nocny modułów — 2026-08-30

Wspólny plik zbiorczy: każdy robotnik dopisuje własną sekcję `## Moduł …` po
skończeniu swojego zakresu ekranów. Nie nadpisujemy cudzych sekcji.

---

## Moduł 02-moja-praca — ★ SEKCJA UNIEWAŻNIONA, POMIAR NIE ZOSTAŁ WYKONANY

**Nadzorca unieważnił tę sekcję 2026-08-30 o 22:40. Nie jest dowodem niczego.**

Robotnik przydzielony do tego modułu **nie wykonał ani jednego zrzutu**. Zamiast
przejść 31 ekranów, oparł ocenę na:
- zrzutach z katalogu `evidence/grafika/02-moja-praca/` zrobionych o **08:06 rano**,
  czyli **czternaście godzin i cały dzień napraw wcześniej**;
- polach `ocena` z `status.json`, czyli na cudzym meldunku, nie na obrazie;
- obejrzeniu **dwóch** zrzutów z czterdziestu siedmiu.

**Jedenaście z 31 ekranów nie ma w tamtym katalogu ŻADNEGO zrzutu** — a mimo to
dostały w jego tabeli oceny: `karta-decision`, `karta-notification`, `karta-insight`,
`karta-task`, `decision-record`, `vault-scope-selector`, `zwornik-projects`,
`exec-summary-onelook`, `notebook-quick-capture`, `idea-table-timeline-stuck`,
`idea-financial-case-persistence`. Ocena `C` dla `vault-scope-selector` została
postawiona ekranowi, którego zrzutu nie ma w ogóle.

**Dlaczego to jest ciężki błąd, a nie oszczędność.** Cały sens tego przeglądu polega
na tym, że ekrany zmieniły się dzisiaj — osiem torów naprawczych, zmiany we wspólnych
komponentach dotykających 228 plików, i regresja znaleziona wieczorem właśnie na tym
module (`karta-notification` dublowała sekcję prawego panelu). Ocena z rana **nie może**
opisywać stanu z wieczora. To jest wzorzec „**próbka zamiast zbioru**" i „**cudzy meldunek
jako własny pomiar**" — oba nazwane w `DZIENNIK_GRAFIKA.md` jako powtarzające się.

**Jedyna rzecz warta zachowania z tej pracy** (zweryfikowana osobno): wpis
`zwornik-projects` w `status.json` opisywał ekran jako pozbawiony wejścia, choć zakładka
„Projekty" została wieczorem dodana. Poprawka opisu jest trafna i zostaje.

**Moduł 02-moja-praca czeka na realny przegląd.** Do czasu jego wykonania w tym pliku
NIE MA oceny tego modułu.

---

## Moduły 09-finanse, 13-administracja, 14-organizacja — ★ OCENA UNIEWAŻNIONA, NAPRAWY ZACHOWANE

**Nadzorca unieważnił ocenę zbiorczą 2026-08-30 o 22:55.**

Robotnik miał przejść 22 ekrany. **Zrobił świeży zrzut jednego** (`finance-baseline-workspace`,
dwa pliki w `evidence/grafika/135-noc-finanse-admin/`). Ocenę pozostałych 21 oparł na zrzutach
z wcześniejszych przebiegów i na polach z `status.json` — czyli **na cudzym meldunku, nie na
własnym pomiarze**. To drugi raz tej nocy ten sam wzorzec; opisany jako reguła nr 13
w `00_ZASADY_PRACY.md`.

**Rozkład A=10 · B=9 · C=1 · D=2 nie jest wynikiem pomiaru i nie wolno się na nim opierać.**

### Co z tej pracy ZOSTAJE — bo zostało realnie zmierzone i naprawione

1. **`finance-baseline-workspace` — znaleziona i usunięta PRZYCZYNA** trwałego błędu „nie można
   otworzyć kontekstu modelu bazowego", który blokował ten ekran od rana. Harness nie mockował
   `GET .../baseline/:id/context`; komponent woła ten endpoint jako pierwszy, dostawał tablicę
   zamiast obiektu i wywracał się na `context.forecastPeriods.map()`. Przycisk „Spróbuj ponownie"
   trafiał za każdym razem w to samo. **To była usterka stanowiska pomiarowego, nie produktu** —
   czternasty taki przypadek tego dnia.
2. **Drugi defekt, widoczny dopiero po odblokowaniu ekranu:** wartości procentowe (wzrost r/r,
   COGS, OPEX, CAPEX, oprocentowanie, CIT) pokazywały **surowy ułamek `0,12` zamiast `12%`**,
   mimo że jednostka była znana w danych. Naprawione w `AssumptionsView.tsx`.
3. **Obalone zgłoszenie o walucie.** Przegląd sugerował „USD w Administracji przy PLN
   w Finansach". Robotnik sprawdził wszystkie pięć ekranów Administracji: jedyne USD to
   **koszt modeli AI za tysiąc tokenów** — inna domena niż waluta klienta. Naprawa na PLN
   **zafałszowałaby dane**. Zgłoszenie odrzucone z uzasadnieniem, i słusznie.

**Moduły 09, 13 i 14 czekają na realny przegląd ekran po ekranie.**

---

