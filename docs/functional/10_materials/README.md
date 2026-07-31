---
doc_id: materials-functional-contract
title: Materials — kontrakt funkcjonalny
menu_item: materials
truth_type: product-target
scope: biblioteka i tworzenie materiałów
status: working
owner: product
last_reviewed: 2026-07-29
runtime_commit: e62623cb99249e963eee5710946f5eb0e8286d79
---

# Materials

## Cel

Materials jest wspólną biblioteką i miejscem tworzenia materiałów powstających
z pracy w Consultinity: dokumentów, arkuszy, prezentacji i raportów.

Decyzja zakresowa z 2026-07-30: odbiór obejmuje wszystkie główne formaty.
Excel/Table jest największym strumieniem pracy, a generatory szablonów arkuszy
są częścią wymaganego domknięcia, nie odległym rozszerzeniem.

Użytkownik nie powinien zastanawiać się, który historyczny „Studio” otworzyć.
Wchodzi do Materials, wybiera typ lub istniejący materiał i kontynuuje pracę.

## Granice

Materials:

- przechowuje i prezentuje artefakty,
- umożliwia tworzenie, edycję, wersjonowanie i eksport,
- zachowuje źródła i powiązania.

Materials nie przejmuje własności:

- KPI od Results,
- modeli i założeń od Finance,
- inicjatyw od Initiatives,
- stanu wykonania od Execution,
- scoringu od Assessment.

## Podsystemy

| ID | Podsystem | Historyczny kontrakt |
| --- | --- | --- |
| MAT-S-01 | Biblioteka i outputs | `docs/modules/09_outputs/` |
| MAT-S-02 | Dokumenty | `docs/modules/10_dokumenty/` |
| MAT-S-03 | Arkusze i tabele | `docs/modules/11_tabele/` |
| MAT-S-04 | Prezentacje | `docs/modules/12_prezentacje/` |

## Mapa funkcji

| ID | Funkcja | Stan |
| --- | --- | --- |
| MAT-F-001 | Jedna biblioteka materiałów | partial |
| MAT-F-002 | Filtrowanie według typu/statusu/źródła | partial |
| MAT-F-003 | Nowy materiał i wybór formatu | partial |
| MAT-F-004 | Otwieranie i wznawianie pracy | partial |
| MAT-F-005 | Edycja dokumentu | partial |
| MAT-F-006 | Edycja arkusza | partial; nowsze demo włączyło edycję |
| MAT-F-007 | Edycja prezentacji | partial |
| MAT-F-008 | Generowanie z kontekstu i szablonu | partial |
| MAT-F-009 | Szablony wyglądu i treści | target/partial |
| MAT-F-010 | Źródła i provenance | partial |
| MAT-F-011 | Wersje, zapis i „Zapisz jako” | gap |
| MAT-F-012 | Eksport DOCX/XLSX/PPTX/PDF | partial |
| MAT-F-013 | Udostępnianie i uprawnienia | unknown/partial |
| MAT-F-014 | Przełączanie narzędzi i pełny ekran | target/partial |
| MAT-F-015 | AI lokalne i Teresa globalna | target/partial |

## Główny przepływ

`źródło lub pusty start → wybór formatu → plan treści → generowanie/edycja →
przegląd → zapis → udostępnienie/eksport`

Materiał może powstać z:

- Chat,
- Idea/Notebook w My Work,
- Interview,
- Tool/Assessment/Audit,
- Initiative/Execution,
- Results/Finance,
- istniejącego szablonu lub pliku.

## Model artefaktu

Każdy materiał powinien posiadać:

- stabilne ID,
- typ,
- tytuł,
- właściciela i dostęp,
- status,
- treść/model danych,
- wersję,
- szablon,
- źródła,
- powiązania z obiektami platformy,
- historię AI i edycji,
- eksporty.

## AI

Trzy tryby współpracy:

1. ręczna edycja,
2. lokalne polecenie dotyczące wybranego elementu/slajdu/zakresu,
3. globalna praca z Teresą nad całym materiałem.

AI powinno pokazywać plan, postęp, źródła i błędy. Cichy fallback do uboższego
formatu jest niedozwolony.

Przed produkcją Teresa lub dedykowane okno tworzy **Generation Brief**. Dla
dokumentu i prezentacji zawiera strukturę, odbiorcę, źródła i plan wizualny.
Dla workbooka zawiera założenia, wejścia, sheets, logikę formuł i oczekiwane
wyniki. Użytkownik zatwierdza lub poprawia brief przed rozpoczęciem generacji.

Dokumenty, prezentacje, arkusze oraz ich template używają wspólnego shellu,
menu, lifecycle, źródeł, review i delivery. Zachowują jednak wyspecjalizowane
przepływy właściwe dla sekcji, slajdów oraz komórek/sheets.

Prezentacje wymagają kontrolowanego systemu semantycznych layoutów, grafik,
image routera i VisionQA na poziomie Gamma lub lepszym.

Każdy materiał można obejrzeć w aplikacji, pobrać, udostępnić kontrolowanym
linkiem oraz wysłać jako link albo załącznik z potwierdzeniem użytkownika.

## AS-IS

- jedna pozycja menu `MODULE_PRESENTATIONS`,
- label `Materials`,
- historyczne trasy studiów pozostają dostępne jako deep linki,
- Excel nie jest osobną pozycją menu,
- nowszy `origin/demo` zawiera program „jeden edytowalny Excel”,
- stan poszczególnych generatorów wymaga odbioru format po formacie.

## TO-BE

Nadrzędne źródła:

- `docs/product/MATERIALS_MODULE_MASTER_SPEC.md`
- `docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md`
- zaakceptowane decyzje w `Harvard/wdrozenie-100/`
- cztery historyczne kontrakty podsystemów.

## GAP / NEXT

1. Ujednolicić model artefaktu.
2. Zweryfikować funkcje MAT-F-001–015 format po formacie.
3. Scalić cztery kontrakty w rozdziały tego modułu.
4. Uzgodnić kanon nawigacji, prawego panelu i pasków edycji.
5. Potwierdzić provenance i zapis.
6. Zbudować macierz import/edycja/eksport dla DOCX/XLSX/PPTX/PDF.
7. Oznaczyć dokumenty historyczne jako supporting lub superseded.
8. Domknąć generatory oraz lifecycle szablonów Excel/Table.
