---
module_id: MODULE_PARTNER_PORTAL
truth_type: product-target
status: canonical
owner: product
last_reviewed: 2026-07-31
---

# Portal Partnera — aktualny kontrakt funkcjonalny

## Cel i granica

Portal Partnera jest wspólną chronioną powierzchnią techniczną dla dwóch
oddzielnych formuł biznesowych:

1. **Program Poleceń** — dla osób fizycznych, w tym pracowników firm
   korzystających z Consultinity. Uczestnik poznaje aktualny produkt, akceptuje
   zasady, otrzymuje własny kod, poleca Consultinity i otrzymuje wynagrodzenie
   za skuteczną sprzedaż.
2. **Program Partnerski** — dla firm, konsultantów i wdrożeniowców. Obejmuje
   rozszerzoną sprzedaż, certyfikację, materiały, poziomy oraz opcjonalne
   uprawnienia delivery.

Obie formuły współdzielą aktualności produktowe, wiedzę sprzedażową, materiały,
certyfikację, atrybucję kodem i rozliczenia, ale mają osobne wejście, warunki,
profil i zakres uprawnień.

Portal nie jest osobną aplikacją klienta. Konto partnerskie osoby fizycznej jest
oddzielone od danych i uprawnień jej pracodawcy.

## Funkcje

| ID | Funkcja | Stan |
| --- | --- | --- |
| `PAR-F-001` | Dwa wejścia: Program Poleceń i Program Partnerski | TO-BE / gap |
| `PAR-F-002` | Start, nowości produktowe i następny krok | AS-IS / partial |
| `PAR-F-003` | Aktualna metoda sprzedaży i prezentacje | AS-IS / partial |
| `PAR-F-004` | Akademia, egzamin i ważność certyfikatu | AS-IS / partial |
| `PAR-F-005` | Indywidualny kod/link i atrybucja sprzedaży | AS-IS / partial |
| `PAR-F-006` | Naliczenia, zestawienia i wypłaty | AS-IS / partial |
| `PAR-F-007` | Profil osoby albo organizacji partnerskiej | AS-IS / partial |
| `PAR-F-008` | Opcjonalny katalog i dostęp delivery Partnera | partial / later wave |

## Przepływ, dane i role

Kanoniczny przepływ Programu Poleceń:

`zainteresowanie → rejestracja osoby → aktualna wiedza → certyfikacja → kod →
sprzedaż → naliczenie → wypłata`.

Program Partnerski korzysta z tego samego rdzenia i rozszerza go o profil
organizacji, poziomy, katalog, co-selling lub delivery.

Partner widzi wyłącznie własny kod, własne atrybucje i minimalny status
pozyskanego klienta. Każda kwota wskazuje kod/atrybucję, obowiązującą regułę,
walutę, status i historię. Korekta atrybucji wymaga audytu.

## AS-IS

Chroniona rodzina tras `/partner/*` jest aktywna i ma szerokie powierzchnie:
Start, Polecenia, Klienci, Akademia, Materiały, Rozliczenia i Profil. Runtime ma
status `real + partial`.

Obecny model jest organizacjocentryczny i nie realizuje jeszcze prostego,
odrębnego wejścia osoby fizycznej. Równolegle działają endpointy legacy i V8.
Materiały, certyfikacja oraz rozliczenia wymagają pełnego dowodu runtime.

## TO-BE i luki

Pierwszy docelowy golden flow:

`osoba fizyczna → Program Poleceń → wiedza/certyfikacja → kod → klient →
naliczenie → wypłata`.

Następnie rozszerzamy ten sam rdzeń o Program Partnerski dla organizacji.

- dodać jawny typ uczestnika: `REFERRAL_INDIVIDUAL` albo `SOLUTION_PARTNER`;
- oddzielić profil i rozliczenia osoby od organizacji pracodawcy;
- wprowadzić wersję i ważność metod, prezentacji oraz zasad prowizji;
- uczynić kod stabilnym źródłem atrybucji;
- udowodnić naliczanie, korekty i wypłatę;
- potwierdzić izolację partnerów i minimalizację danych klientów;
- zunifikować V8/legacy na aktywnym golden flow;
- dodać E2E osoba → certyfikat → kod → sprzedaż → naliczenie.

Otwarte pozostają szczegóły: korzyść klienta z kodu, wpływ wygaśnięcia
certyfikatu na prowizję oraz dokument rozliczeniowy partnera.

Pełna zatwierdzona definicja:
`docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/01_PARTNER_PORTAL_REVIEW.md`.

Ocena: `B`. Dowody: `STATUS.md`, `CODEMAP.md`, `/partner/*`, guardy dostępu i
zatwierdzona karta modułu.
