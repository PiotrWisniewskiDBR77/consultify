# Przegląd danych DBR77 na stagingu — stan 08.09.2026 (kopia bazy z 05:50)

Cel: uporządkować dane, których używamy na stagingu i na demonstracji. Pomiar zrobiony na kopii bazy stagingu (organizacja DBR77), bez zmian w bazie. Każdy wiersz = decyzja właściciela: **usunąć / uzupełnić / zostawić**.

## 1. Inicjatywy (104)
| Co | Ile | Przykłady | Propozycja |
|---|---|---|---|
| Wpisy demo w rejestrze runtime (nie w tabeli inicjatyw) | 16 | `demo-story-20260826-*`, `demo-piotr-*`, `manual-aco-ready` | **usunąć** — zasłaniają pierwszy ekran siatki kart |
| Nazwa testowa/seedowa | 12 | `[ACCEPTANCE]`, `seed:`, `demo-` | **usunąć** przed pokazem |
| Szkice bez autora | 52 z 69 | API Gateway v2, Data Platform — Lakehouse | naprawione w kodzie: administrator może je przesłać; dane bez zmian |
| Bez właściciela biznesowego | 73 | — | uzupełnić dla tych, które idą na pokaz |
| Bez opisu | 80 | — | uzupełnić dla pokazowych |
| Duplikaty nazw | 14 grup | Wdrożenie RPA ×3, Transformacja DevOps ×3 | rozliczyć: zostawić jedną |
| Tytuł po angielsku | 51 | — | przetłumaczyć |
| Identyfikator ze znakiem `\|` | 3 | `seed:wyniki-dbr77-…` | naprawić identyfikator (ryzyko w adresie URL) |
| W realizacji (8): bez projektu / bez dat planu / bez właściciela wykonania / bez zadań | 5 / 5 / 5 / 6 | — | **uzupełnić** — bez projektu realizacja jest niewidoczna (zasada fail-closed), bez dat wskaźnik RAG mówi „Brak dat planu” |

## 2. Zadania (197)
| Co | Ile | Propozycja |
|---|---|---|
| Bez osoby przypisanej | 35 | uzupełnić |
| Bez osoby, ale z „właścicielem” technicznym (UI pokazuje kogoś, kto tylko edytował) | 34 | naprawa w kodzie (STOP 2 w karcie), dane bez zmian |
| Bez terminu | 68 | uzupełnić |
| Otwarte i po terminie | 104 | rozliczyć: zamknąć lub przesunąć |
| Bez powiązanej inicjatywy | 92 | powiązać |
| Tytuł / opis po angielsku | 114 / 71 | przetłumaczyć |
| Nazwa testowa | 5 | usunąć |

## 3. Użytkownicy (17)
| Co | Ile | Propozycja |
|---|---|---|
| Bez stanowiska (`job_title`) | 13 | **uzupełnić** — bez tego Zasoby i Obciążenie nie znają roli |
| Stanowisko = rola systemowa („Platform SuperAdmin”, „Tenant Admin”) | 2 | poprawić na realne stanowisko |
| Bez tygodniowej dostępności (domyślne 40 h) | 17 | uzupełnić dla osób na pokazie |
| Konta testowe (`acceptance.owner@consultify.local`) | 1 | usunąć |

## 4. Realizacje kanoniczne, RAID, decyzje
| Co | Ile | Propozycja |
|---|---|---|
| Realizacje kanoniczne seedowe (`demo-story-`, `acceptance`, `aco-`) | 6 z 6 | usunąć — DBR77 nie ma ani jednej prawdziwej |
| RAID bez terminu / po angielsku | 7 / 7 | uzupełnić terminy, przetłumaczyć |
| Decyzje | 79 | przejrzeć razem (terminy, decydenci) |

## 5. Co proponuję jako kolejność
1. Usunięcia (wiersze „usunąć”) — jedna migracja danych z listą identyfikatorów, dry-run najpierw, na stagingu, potem demo.
2. Uzupełnienia dla zestawu pokazowego: wybierz 5–8 inicjatyw w realizacji, dla nich komplet: projekt, daty, właściciel, 3–5 zadań z osobami i terminami; 6–8 osób ze stanowiskiem i dostępnością.
3. Tłumaczenia tytułów tam, gdzie pokazujemy.

Źródła pomiaru: `evidence/przeglad-dbr77/realizacja/przeglad-danych-dbr77.txt`, meldunek przeglądu Inicjatyw (rejestr).
