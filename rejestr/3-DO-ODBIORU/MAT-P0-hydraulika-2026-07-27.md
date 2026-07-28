# MAT-P0 — Hydraulika Materiałów: klik otwiera treść, język konta, widoczność dokumentów

- **Stan:** DO ODBIORU (2026-07-27, nocna realizacja fazy P0 planu „na 100%")
- **Demo:** `b4cc519307`, tag `demo-safe-2026-07-27-p0-hydraulika`. Deploy SUCCESS, health 200,
  gitSha na żywo potwierdzony.
- **Plan-matka:** `Harvard/wdrozenie-100/_PLAN_100_MATERIALY_MODELE_2026-07-27.md`

## Co klikać rano (3 minuty)

1. **Klik w dokument otwiera DOKUMENT** (dramat z wczoraj): Materiały → Dokumenty → klik w wiersz
   → edytor z treścią, NIE generator. (Częściowo naprawione już wcześniej przez równoległą sesję,
   domknięte tej nocy dla dokumentów tworzonych w Document Studio.)
2. **Zepsuty link = uczciwy błąd**: wejdź na `/document-studio?artifactId=nie-istnieje-xyz` →
   polski komunikat „Nie znaleziono tego dokumentu…" + przycisk „Wróć do Materiałów". NIGDY
   formularz generatora. (Zrzuty light+dark zrobione przeze mnie przed Tobą.)
3. **Język konta steruje aplikacją**: Ustawienia → język Polski → od tego momentu KAŻDA
   przeglądarka/incognito na Twoim koncie startuje po polsku (wcześniej decydował język
   przeglądarki — stąd wczorajszy angielski ekran). Wybór zapisuje się NA KONCIE.
4. **Dokumenty z Document Studio widoczne**: utwórz dokument przez „Dodaj → Dokument → Z AI"
   → po zapisaniu MUSI być widoczny na liście Dokumenty/Wszystkie i otwierać się poprawnie
   (wcześniej znikały — rejestrowały się pod typem, którego lista nie znała).
5. Drobne: „New AI document" wchodzi od razu w tryb Z AI; tytuł w Document Studio nie dubluje
   już „Consultify Document Studio".

## Niewidoczne (mechanika): 17 flag z kłamiącymi opisami wyprostowane (zero zmian zachowania),
migracja `users.language` (addytywna, auto-run — przeszła przy deploy'u).

## Uczciwe zastrzeżenia
- Na tipie demo jest **8 czerwonych testów Hub** wprowadzonych nocną integracją menu-unifikacji
  (inna sesja) — moja praca ma 0 nowych porażek (dowód: identyczny przebieg na czystym tipie).
  Rano rozstrzygamy: selektory testów czy realnie zepsute deep-linki.
- Pełny test „dokument z DS na liście" wykonany testami automatycznymi z wejścia produkcyjnego,
  nie żywym klikiem na demo (dane demo = twarz produktu, nie chciałem nocą tworzyć rekordów
  testowych na Twoim koncie). Punkt 4 wyżej to Twój żywy dowód.
