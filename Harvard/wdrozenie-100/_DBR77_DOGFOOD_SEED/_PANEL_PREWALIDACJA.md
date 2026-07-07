# Panel sceptyków BCG — pre-walidacja seed DBR77 (Tools + Assessment)

**Data:** noc 07-08. **Metoda:** 4 adwersaryjne obiektywy (opus), każdy czyta cały bundle 01-07 + plan v2. Analog panelu DBR77 Scale-Up v1(42)→v2. **Cel:** wychwycić luki ZANIM treść trafi do żywego produktu (pre-walidacja jakości generatora + doktryny).

## Wyniki (średnia **65/100**)
| Obiektyw | Score | Werdykt |
|---|---|---|
| Kompletność | 58 | DO UZUPEŁNIENIA — brak warstwy finansowej (unit economics, scenariusze, plan B, popyt) |
| Rygor | 58 | Kruchy liczbowo — double-count, marża 45% bez dowodu, nakłady>bramka |
| Prezentacja | 71 | Świetne pliki z osobna, ale 7 sylosów bez strony zarządczej |
| Logika strategiczna | 74 | Spójna narracja, ale 3 pęknięcia arytmetyki +6.6M nie rozstrzygnięte |
| **ŚREDNIA** | **65** | **Dojrzała teza strategiczna; wymaga warstwy finansowej + reconciliation przed zarządem** |

> Kontekst: v1 DBR77 (poprzedni panel) = 42. Ten seed = 65 na starcie, bo bazuje na planie v2 (już po pierwszym panelu) i autorzy sami złapali ~60% napięć. To potwierdza wartość metody i doktryny.

## Findings skonsolidowane (ranking wg zbieżności między obiektywami)

### 🔴 KRYTYCZNE (≥2 obiektywy, dotykają celu +6.6M)
1. **De-duplikacja przychodu — podwójne liczenie (rigor F1 + strategic F1/F2).** Dwa wystąpienia:
   - **ARR↔delivery:** +2.5M ARR pochodzi z konwersji 40-50% klientów delivery (02 l.32) → ten sam klient liczony w +2.8M delivery i +2.5M ARR. 06 deklaruje „bez potrójnego liczenia ✔" jako fakt; 02(T4)/04 flagują jako otwarte. **Zawyża do +5.3M.**
   - **DE↔DACH:** INI-4 = „Popyt PL+**DE**" (03) a INI-5 DACH = +1.3M „nowy strumień" (06). DE ⊂ DACH → geografia niemiecka liczona dwa razy lub przychód DE z INI-4 niepoliczony.
   - **Rozstrzygnięcie (kanon):** ARR rozbić na net-new (nie konkuruje) vs konwersja (odjąć od bazy delivery). DE w INI-4 = tylko pipeline/pilot, przychód 0; cały przychód niemiecki księgowany RAZ w INI-5.
2. **DACH +1.3M = fikcja harmonogramowa (rigor F6 + completeness F1 + strategic F7).** Najgłębszy gap (3) + rok 3 + niewyceniona bramka compliance (BDSG/ISO, oś DRD 4+6) → nie zdąży w 30-36 mies. **Cel realnie 8.7-10M (przedział), nie punkt 10M.** 4 frameworki mówią to niezależnie.
3. **Marża 18.8%→45% bez dowodu (rigor F4 + completeness F2).** ×2.4 skok podany jako parametr; miesza marżę ogniwa (brutto) z EBITDA firmy. Cała teza „differentiation" i +2.8M na tym stoi. → Status: HIPOTEZA do walidacji na realnych kontraktach, konsekwentnie.

### 🟠 SPÓJNOŚĆ / RYGOR (szybkie do naprawy)
4. **Gap zdolności: 3 wartości w 1 pliku (all: presentation F7 + rigor F2 + strategic F8).** 05: answer-first 1.9, tabela 1.7, faktyczna suma 1+2+2+2+2+3=12 → **2.0**. → Jedna wartość: **2.0**.
5. **Retencja niespójna (strategic F6).** „≥90% logo-retention" (05,06) vs „NRR≥100%" (07). Dla 6× ARR trzeba NRR ~130-150% + net-new. → Ujednolicić: NRR cel, 90% logo = podłoga.
6. **Zawisły SSOT (all 4).** README/07 wskazują `_PROJEKT_DBR77_SCALEUP_2026_PLAN_v2.md` — jest w `Harvard/wdrozenie-100/`, NIE w drzewie seeda. → Baza faktów w README jest samodzielną kotwicą; poprawić ścieżkę.
7. **Nakłady 4.5M > bramka 4M (rigor F5 + strategic F5).** Luka 0.5M „z EBITDA 640K" — ale R1 świadomie deficytowy. → INI-0 celuje w ~5M albo dociąć zakres.

### 🟡 KOMPLETNOŚĆ / STRUKTURA (warstwa do dobudowania — wymaga realnych danych Piotra)
8. **Brak modelu finansowego / unit economics (completeness F2).** CAC, LTV, ACV, liczba kont, payback, cena×wolumen delivery. → Brakujący 8. dokument.
9. **Brak scenariuszy base/bear/bull (completeness F1).** Wszystko single-point. → Bear ~6.4M / Base ~8.7-10M / Bull.
10. **Brak planu B na 2 własne bramki (completeness F3 + strategic F5).** Kapitał (dług/grant/bootstrap staged) i Talent (remote/relokacja/akwizycja).
11. **Brak strony popytowej (completeness F4).** TAM/SAM/SOM, pipeline, nazwane konta, obecna retencja jako liczba.
12. **Moat vs PRZEJĘCIE (completeness F7 + strategic F4).** Dane bronią przed kopiowaniem, nie przejęciem Siemens/GE; +ryzyko własności danych klienta (prawne). → Warstwa anty-przejęciowa lub jawna teza build-to-exit.
13. **7 sylosów bez strony zarządczej (presentation F1).** → `00_EXECUTIVE_SUMMARY` (dodane w reconcile).

## Meta-wniosek
Trzy findingi krytyczne (#1 de-dup, #2 DACH, częściowo #4 gap) to DOKŁADNIE klasa błędu, którą ma łapać feature **Adversarial Review / cross-record spójność** (`_FEATURE_ADVERSARIAL_REVIEW_SPEC`). To trzecie niezależne potwierdzenie wartości tego feature'a na żywej treści. Rekomendacja: #1, #2, #4 to killer-demo dla „BCG Partner Review".
