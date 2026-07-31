# Consultinity — mapa źródeł prawdy

To jest **jedyny punkt wejścia** do dokumentacji normatywnej całej aplikacji.
Nie zastępuje dokumentów domenowych. Wskazuje, **który dokument lub system
rozstrzyga dane pytanie** i jak traktować pozostałe materiały.

Kompletna, uporządkowana karta wiedzy:
[`ssot/README.md`](ssot/README.md)

Dokumentacja funkcjonalna według menu:
[`FUNCTIONAL_DOCUMENTATION.md`](FUNCTIONAL_DOCUMENTATION.md)
Dokumentacja całego programu:
[`program/README.md`](program/README.md)
Standard kompletnej dokumentacji:
[`ssot/COMPLETE_DOCUMENTATION_STANDARD.md`](ssot/COMPLETE_DOCUMENTATION_STANDARD.md)
Rejestr maszynowy: [`ssot/registry.json`](ssot/registry.json)
Cykl życia dokumentów: [`ssot/DOCUMENT_LIFECYCLE.md`](ssot/DOCUMENT_LIFECYCLE.md)
Kolejka uzgodnień: [`ssot/RECONCILIATION_BACKLOG.md`](ssot/RECONCILIATION_BACKLOG.md)

## Najważniejsza zasada

Nie istnieje jedno źródło prawdy odpowiadające na wszystkie pytania.
Consultinity ma kilka **rozłącznych rodzajów prawdy**:

| Pytanie | Źródło rozstrzygające |
| --- | --- |
| Co rzeczywiście działa dzisiaj? | kod, migracje, konfiguracja runtime i test wykonany na właściwym środowisku |
| Jak produkt ma działać docelowo? | rejestr produktu i kontrakt właściwego modułu |
| Jak interfejs ma wyglądać i zachowywać się? | standardy UI oraz współdzielone komponenty implementujące standard |
| Jaki jest model danych i API? | migracje/schemat bazy, kontrakty API i kod backendu |
| Jak wdrażamy i obsługujemy system? | aktualne runbooki operacyjne |
| Jaki jest aktualny stan realizacji? | rejestr pracy i dowody odbioru, nie stary plan |
| Dlaczego podjęto decyzję? | zaakceptowana decyzja/ADR, następnie historia i evidence |
| Jaki jest kierunek przyszłego rozwoju? | strategia; strategia nie dowodzi, że funkcja już działa |

## Hierarchia autorytetu

W obrębie **tego samego rodzaju prawdy** obowiązuje kolejność:

1. jawna decyzja właściciela produktu lub zatwierdzony ADR,
2. kanoniczny dokument wskazany w rejestrze,
3. kontrakt modułu,
4. aktualny kod i testy — dla stanu rzeczywistego,
5. evidence i raport z datą,
6. plan roboczy, handoff lub audyt,
7. historyczna próba albo kopia.

Kod nie unieważnia docelowej decyzji produktowej — pokazuje tylko stan obecny.
Dokument docelowy nie jest dowodem wdrożenia — wdrożenie potwierdza runtime.

## Punkty wejścia

### Produkt i zachowanie

- Funkcjonalny spis według menu: [`FUNCTIONAL_DOCUMENTATION.md`](FUNCTIONAL_DOCUMENTATION.md)
- Rejestr nadrzędny: [`product/DOCUMENTATION_REGISTRY.md`](product/DOCUMENTATION_REGISTRY.md)
- Kontrakty modułów: [`modules/README.md`](modules/README.md)
- Model operacyjny aplikacji: [`modules/APPLICATION_OPERATING_MODEL.md`](modules/APPLICATION_OPERATING_MODEL.md)

### UI/UX

- Indeks: [`ui-standards/README.md`](ui-standards/README.md)
- Kanon ekranów listowych: [`ui-standards/TRIADA_KANON.md`](ui-standards/TRIADA_KANON.md)
- Zamrożone układy: [`ui-standards/FROZEN_LAYOUTS.md`](ui-standards/FROZEN_LAYOUTS.md)
- Prawda wykonawcza: `src/components/standard/` i współdzielone powłoki w
  `src/components/shared/`

### Architektura, dane i API

- Architektura: [`architecture/ARCHITECTURE_MAP.md`](architecture/ARCHITECTURE_MAP.md)
- Baza danych: [`database/README.md`](database/README.md)
- Prawda wykonawcza: `server/src/`, migracje w `server/` oraz współdzielone
  typy w `packages/shared/`

### Operacje, bezpieczeństwo i jakość

- Operacje: [`operations/STAGING_PRODUCTION_OPERATING_MODEL.md`](operations/STAGING_PRODUCTION_OPERATING_MODEL.md)
- Bezpieczeństwo: [`security-compliance/COMPLIANCE_MATRIX.md`](security-compliance/COMPLIANCE_MATRIX.md)
- Jakość: CI i aktualne wyniki testów; dokument z metrykami jest raportem,
  nie mocniejszym dowodem niż bieżący run

### Strategia i plany

- Strategia: [`strategy/README.md`](strategy/README.md)
- Plany robocze/historyczne: [`plans/README.md`](plans/README.md)
- Plan staje się prawem produktu dopiero po promocji do rejestru produktu,
  kontraktu modułu albo zatwierdzonej decyzji.

### Status pracy i historia

- Bieżące zadania/odbiór: `rejestr/`
- Program Harvard/Vegas/Oxford: [`../Harvard/wdrozenie-100/README.md`](../Harvard/wdrozenie-100/README.md)
- Historyczne wdrożenia: [`../wdrozenia/README.md`](../wdrozenia/README.md)
- Zasady klasyfikacji starych drzew:
  [`cleanup/README.md`](cleanup/README.md)

`Harvard/`, `wdrozenia/`, `evidence/`, raporty audytowe i handoffy są ważnym
zapisem wiedzy, lecz nie stają się automatycznie nadrzędnym SSOT tylko dlatego,
że zawierają słowo „kanon”, „master” lub „final”.

## Konflikt między dokumentami

1. Ustal rodzaj prawdy, którego dotyczy konflikt.
2. Sprawdź oba dokumenty w `ssot/registry.json` i rejestrze produktu.
3. Wybierz źródło o wyższym autorytecie i aktualnym statusie.
4. Nie kasuj źródła przegrywającego. Dodaj w nim lub w rejestrze informację
   `superseded_by`.
5. Jeśli oba źródła twierdzą, że są kanoniczne i brak rozstrzygnięcia,
   oznacz konflikt jako `disputed` i nie wdrażaj na podstawie zgadywania.

## Statusy dokumentów

- `canonical` — obowiązujące źródło dla jasno określonego zakresu,
- `supporting` — rozwija kanon, ale go nie zastępuje,
- `working` — aktywna propozycja lub plan,
- `evidence` — dowód stanu w określonym czasie,
- `historical` — zachowane tło i wcześniejsza próba,
- `superseded` — zastąpione przez wskazany dokument,
- `disputed` — nierozstrzygnięta sprzeczność.

Szczegółowe zasady i wymagane metadane opisuje
[`ssot/DOCUMENT_LIFECYCLE.md`](ssot/DOCUMENT_LIFECYCLE.md).

## Zasada dla nowych prac

Przed implementacją:

1. otwórz tę mapę,
2. wybierz kontrakt modułu,
3. sprawdź właściwy standard przekrojowy,
4. zweryfikuj realny runtime,
5. zapisz nowe ustalenie w istniejącym źródle kanonicznym zamiast tworzyć
   kolejny plik z nazwą `FINAL`, `MASTER` lub `SSOT`.

Kontrola:

```bash
npm run check:ssot
```
