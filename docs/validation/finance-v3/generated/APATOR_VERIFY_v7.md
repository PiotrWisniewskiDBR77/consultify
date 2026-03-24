# Real Statement Import Audit

## Apator SA Raport R 2024

- File: `knowledge/Finanse/Apator SA Raport R 2024.pdf`
- Detected type: `P&L`
- Contained statement types: `P&L`, `BS`, `CF`
- Document class: `mixed_report`
- Extraction strategy: `pdf_layout_mixed`
- Currency / scaling: `PLN` / `thousands`
- Extracted text length: 222087

### BS

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 3
- Mapped lines: 3
- Coverage: 100%
- Readiness: `recoverable` (47)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `BS_EQUATION_INCOMPLETE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Zobowiązania i rezerwy długoterminowe 2024 | fsl-bs-long-term-debt | 14826 |
| Zobowiązania i rezerwy krótkoterminowe 2024 | fsl-bs-current-liabilities | 124818 |
| Pozostałe zobowiązania krótkoterminowe 2024 | fsl-bs-other-current-liabilities | 9852 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |

### P&L

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 11
- Mapped lines: 11
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation blockers: none

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Przychody ze sprzedaży dóbr i usług 2024 | fsl-pl-revenue | 536578 |
| Koszt własny sprzedaży 2024 | fsl-pl-cogs | -394861 |
| Zysk brutto ze sprzedaży 2024 | fsl-pl-gross | 141717 |
| Koszty sprzedaży 2024 | fsl-pl-selling | -19843 |
| Koszty ogólnego zarządu 2024 | fsl-pl-gna | -64008 |
| Zysk ze sprzedaży 2024 | fsl-pl-opex | 57866 |
| Zysk z działalności operacyjnej 2024 | fsl-pl-ebit | 53426 |
| Wynik na działalności finansowej 2024 | fsl-pl-interest | 13137 |
| Zysk przed opodatkowaniem 2024 | fsl-pl-ebt | 66563 |
| Podatek dochodowy 2024 | fsl-pl-tax | -3482 |
| Całkowite dochody ogółem 2024 | fsl-pl-comprehensive-income | 63295 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 28
- Mapped lines: 28
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation blockers: none

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Amortyzacja wartości niematerialnych 2024 | fsl-cf-operating-depreciation-intangibles | 6114 |
| Amortyzacja rzeczowych aktywów trwałych 2024 | fsl-cf-operating-depreciation-ppe | 13336 |
| Amortyzacja aktywów z tytułu prawa do użytkowania 2024 | fsl-cf-operating-depreciation-rou | 4129 |
| Odpisy aktualizujące z tytułu utraty wartości rzeczowych aktywów trwałych i wartości niematerialnych 2024 | fsl-cf-operating-impairment | 62 |
| Zysk na sprzedaży rzeczowych aktywów trwałych i wartości niematerialnych 2024 | fsl-cf-operating-gain-disposal | -526 |
| Zyski z wyceny nieruchomości inwestycyjnych według wartości godziwej 2024 | fsl-cf-operating-fv-changes | -717 |
| (Zyski) straty z tytułu zmiany wartości godziwej instrumentów pochodnych 2024 | fsl-cf-operating-fv-derivatives | -39 |
| Koszty odsetek 2024 | fsl-cf-operating-interest-cost | 1322 |
| Przychody z tytułu dywidend 2024 | fsl-cf-operating-dividend-income | -14134 |
| Inne korekty 2024 | fsl-cf-operating-other-adj | -182 |
| w kapitale obrotowym 2024 | fsl-cf-operating-before-wc | 77144 |
| Zmiana stanu zapasów 2024 | fsl-cf-change-wc-inventory | 26187 |
| Zmiana stanu należności 2024 | fsl-cf-change-wc-ar | -18938 |
| Zmiana stanu zobowiązań 2024 | fsl-cf-change-wc-ap | 5126 |
| Zmiana stanu rezerw 2024 | fsl-cf-change-wc-provisions | 3649 |
| Zapłacony podatek dochodowy 2024 | fsl-cf-taxes-paid | -2696 |
| Wydatki na nabycie rzeczowych aktywów trwałych 2024 | fsl-cf-capex | -30376 |
| Wpływy ze sprzedaży rzeczowych aktywów trwałych 2024 | fsl-cf-investing-disposal-proceeds | 774 |
| Otrzymane dywidendy 2024 | fsl-cf-dividends-received | 624 |
| Inne wydatki 2024 | fsl-cf-other-expenditure | -2069 |
| Środki pieniężne netto wykorzystane z działalności inwestycyjnej 2024 | fsl-cf-investing | -31428 |
| Przepływy środków pieniężnych z działalności finansowej Spłaty kredytów i pożyczek 2024 | fsl-cf-financing | -34759 |
| Odsetki zapłacone 2024 | fsl-cf-interest-paid | -754 |
| Dywidendy wypłacone 2024 | fsl-cf-dividends | -19588 |
| Spłata zobowiązań z tytułu leasingu 2024 | fsl-cf-lease-repayment | -3969 |
| Zwiększenie (zmniejszenie) netto stanu środków pieniężnych 2024 | fsl-cf-net-change-cash | -1258 |
| Środki pieniężne na początek okresu 2024 | fsl-cf-opening-cash | 3298 |
| Środki pieniężne na koniec okresu 2024 | fsl-cf-closing-cash | 2040 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |

## Grupa Apator Raport RS 2023

- File: `knowledge/Finanse/Grupa Apator Raport RS 2023.pdf`
- Detected type: `P&L`
- Contained statement types: `P&L`, `BS`, `CF`
- Document class: `mixed_report`
- Extraction strategy: `pdf_layout_mixed`
- Currency / scaling: `PLN` / `thousands`
- Extracted text length: 220517

### BS

- Selected period: `2023`
- Comparison period: `n/a`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 346
- Mapped lines: 63
- Coverage: 18%
- Readiness: `recoverable` (38)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Aktywa trwałe 2023 | fsl-bs-fixed | 492647 |
| Wartości niematerialne 2023 | fsl-bs-intangibles | 94114 |
| Wartość firmy 2023 | fsl-bs-intangibles-goodwill | 120672 |
| Rzeczowe aktywa trwałe 2023 | fsl-bs-ppe | 196811 |
| Prawo do użytkowania aktywów 2023 | fsl-bs-rou-assets | 54800 |
| Nieruchomości inwestycyjne 2023 | fsl-bs-investment-property | 2234 |
| Należności długoterminowe 2023 | fsl-bs-lt-receivables | 3536 |
| Aktywa z tytułu odroczonego podatku dochodowego 2023 | fsl-bs-other-non-current-assets-deferred-tax | 20177 |
| Aktywa obrotowe 2023 | fsl-bs-current-assets | 482551 |
| Zapasy 2023 | fsl-bs-inventory | 242296 |
| Należności z tytułu podatku dochodowego od osób prawnych 2023 | fsl-bs-tax-receivables | 6285 |
| Należności z tytułu innych podatków, ceł i ubezpieczeń społecznych 2023 | fsl-bs-other-tax-receivables | 8780 |
| Pozostałe należności krótkoterminowe 2023 | fsl-bs-other-st-receivables | 3293 |
| Środki pieniężne i ich ekwiwalenty 2023 | fsl-bs-cash | 22939 |
| AKTYWA RAZEM 2023 | fsl-bs-total-assets | 975198 |
| Kapitał własny 2023 | fsl-bs-equity | 539023 |
| Kapitał własny przypadający akcjonariuszom jednostki dominującej 2023 | fsl-bs-equity-parent | 536965 |
| Kapitał podstawowy 2023 | fsl-bs-share-capital | 3265 |
| Akcje własne 2023 | fsl-bs-treasury-shares | -3522 |
| Pozostałe kapitały 2023 | fsl-bs-other-equity-reserves | 600182 |
| Kapitał z przeszacowania programu określonych świadczeń 2023 | fsl-bs-actuarial-reserve | 894 |
| Niepodzielony wynik finansowy 2023 | fsl-bs-retained-earnings | -72699 |
| Udziały niesprawujące kontroli 2023 | fsl-bs-minority-interest | 2058 |
| Zobowiązania 2023 | fsl-bs-total-liabilities | 436175 |
| Długoterminowe kredyty i pożyczki 2023 | fsl-bs-long-term-borrowings | 29545 |
| Zobowiązania długoterminowe z tytułu prawa do użytkowania aktywów 2023 | fsl-bs-long-term-debt-lease | 37608 |
| Rezerwa z tytułu odroczonego podatku dochodowego 2023 | fsl-bs-other-non-current-liabilities-deferred-tax | 3684 |
| Długoterminowe zobowiązania z tytułu świadczeń pracowniczych 2023 | fsl-bs-employee-benefits-lt | 5315 |
| Pozostałe rezerwy długoterminowe 2023 | fsl-bs-other-non-current-liabilities-provisions | 1204 |
| Zobowiązania i rezerwy krótkoterminowe 2023 | fsl-bs-current-liabilities | 356069 |
| Zobowiązania handlowe 2023 | fsl-bs-ap | 93591 |
| Zobowiązania z tytułu innych podatków, ceł i ubezpieczeń społecznych 2023 | fsl-bs-other-tax-payables | 16957 |
| Pozostałe zobowiązania krótkoterminowe 2023 | fsl-bs-other-current-liabilities | 34791 |
| Zobowiązania krótkoterminowe z tytułu prawa do użytkowania aktywów 2023 | fsl-bs-short-term-debt-lease | 11110 |
| Krótkoterminowe zobowiązania z tytułu świadczeń pracowniczych 2023 | fsl-bs-employee-benefits-st | 20954 |
| Pozostałe rezerwy krótkoterminowe 2023 | fsl-bs-provisions | 12914 |
| PASYWA RAZEM 2023 | fsl-bs-total-liabilities-equity | 975198 |
| Zysk z działalności operacyjnej 2023 | fsl-bs-retained-earnings-prior | 40132 |
| Zysk netto z działalności kontynuowanej 2023 | fsl-bs-retained-earnings-current | 8504 |
| Zwiększenie (zmniejszenie) netto stanu środków pieniężnych i ekwiwalentów środków pieniężnych 2023 | fsl-bs-hedge-reserve | -6041 |
| Zysk netto za okres obrotowy 2023 | fsl-bs-wc | 8504 |
| Relacje z klientami 2023 | fsl-bs-contract-assets | 2106 |
| Patenty i licencje, oprogramowanie komputerowe 2023 | fsl-bs-intangibles-software | 11873 |
| Inwestycje niezakończone w prace rozwojowe 2023 | fsl-bs-equity-method-investments | 32325 |
| Grunty, budynki i budowle 2023 | fsl-bs-ppe-land | 92868 |
| Maszyny i urządzenia 2023 | fsl-bs-ppe-machinery | 47822 |
| Środki transportu 2023 | fsl-bs-ppe-vehicles | 2780 |
| Zwiększenie stanu z tytułu modernizacji 2023 | fsl-bs-other-current-assets-vat | 1024584 |
| Pozostałe aktywa finansowe ogółem, w tym: 2023 | fsl-bs-other-current-financial-assets | 5152 |
| Materiały 2023 | fsl-bs-inventory-raw | 144605 |
| Produkcja w toku 2023 | fsl-bs-inventory-wip | 47489 |
| Wyroby gotowe 2023 | fsl-bs-inventory-fg | 44515 |
| Należności handlowe 2023 | fsl-bs-ar | 188117 |
| Inne należności 2023 | fsl-bs-ar-other | 924 |
| Krótkoterminowe rozliczenia międzyokresowe 2023 | fsl-bs-other-current-assets-prepaids | 5689 |
| Kapitał zapasowy ze sprzedaży akcji własnych powyżej ich wartości nominalnej 2023 | fsl-bs-share-premium | 15142 |
| Zobowiązania długoterminowe 2023 | fsl-bs-long-term-debt | 40358 |
| Korekta o zobowiązania z tytułu podatku dochodowego 2023 | fsl-bs-other-current-liabilities-tax | -1265 |
| Różnice kursowe z konsolidacji 2023 | fsl-bs-fx-reserve | 4235 |
| Zaliczki otrzymane na dostawy 2023 | fsl-bs-contract-liabilities | -6 |
| Pozostałe zobowiązania 2023 | fsl-bs-other-non-current-liabilities | -74 |
| Zobowiązania finansowe 2023 | fsl-bs-short-term-debt | -33260 |
| Aktywa finansowe 2023 | fsl-bs-lt-financial-assets | 18827 |

| Unmapped labels | Value |
| --- | ---: |
| Podstawowe miejsce prowadzenia działalności gospodarczej – Ostaszewo 57C, 2023 | 87 |
| Kapitał z wyceny transakcji zabezpieczających oraz różnice kursowe z konsolidacji 2023 | 8845 |
| Zobowiązania i rezerwy długoterminowe 2023 | 80106 |
| Krótkoterminowe kredyty i pożyczki 2023 | 162511 |
| Zysk ze sprzedaży 2023 | 57270 |
| Wynik na pozostałej działalności operacyjnej, w tym: 2023 | -17138 |
| Wynik na działalności finansowej, w tym: 2023 | -12588 |
| Zysk przed opodatkowaniem 2023 | 27544 |
| Bieżący podatek dochodowy 2023 | -7326 |
| Odroczony podatek dochodowy 2023 | -11714 |
| Inne całkowite dochody Inne całkowite dochody netto 2023 | 5887 |
| Pozycje, które mogą w przyszłości być przeklasyfikowane do wyniku finansowego: 2023 | 6140 |
| Różnice kursowe z przeliczenia jednostek zagranicznych 2023 | 2839 |
| Wynik na rachunkowości zabezpieczeń wraz z efektem podatkowym 2023 | 3301 |
| Pozycje, które w przyszłości nie będą przeklasyfikowane do wyniku finansowego: 2023 | -253 |
| Zyski i straty aktuarialne 2023 | -253 |
| Całkowite dochody ogółem 2023 | 14391 |
| Amortyzacja wartości niematerialnych 2023 | 16807 |
| Amortyzacja rzeczowych aktywów trwałych 2023 | 86 |
| Odpisy aktualizujące z tytułu utraty wartości rzeczowych aktywów trwałych 2023 | 3408 |
| Zysk na sprzedaży rzeczowych aktywów trwałych i wartości niematerialnych 2023 | -1365 |
| Straty z tytułu zmiany wartości godziwej instrumentów pochodnych 2023 | -920 |
| Koszty odsetek 2023 | 15676 |
| Inne korekty 2023 | 15953 |
| zmian w kapitale obrotowym 2023 | 116317 |
| Zwrot podatku 2023 | 7277 |
| Zapłacony podatek dochodowy 2023 | -15423 |
| Wydatki na nabycie rzeczowych aktywów trwałych i aktywów leasingowych 2023 | -18499 |
| Wpływy ze sprzedaży rzeczowych aktywów trwałych 2023 | 12196 |
| Środki pieniężne netto wykorzystane z działalności inwestycyjnej 2023 | -25225 |
| Wpływy z tytułu zaciągnięcia kredytów i pożyczek 2023 | 24706 |
| Spłata zobowiązań z tytułu leasingu 2023 | -11582 |
| Inne wydatki 2023 | -1613 |
| Środki pieniężne i ich ekwiwalenty na początek okresu 2023 | 28980 |
| Środki pieniężne i ich ekwiwalenty na koniec okresu 2023 | 22939 |
| Przychody ze sprzedaży 2023 | 514978 |
| Pozostałe przychody (koszty) operacyjne 2023 | 750 |
| Amortyzacja 2023 | 26823 |
| Pozostałe przych / koszty fin. 2023 | -2549 |
| ZYSK BRUTTO 2023 | 31518 |
| (+) Podatek dochodowy 2023 | 19040 |
| (+) Koszty finansowe 2023 | 20667 |
| (-) Przychody finansowe 2023 | 8079 |
| (+) Amortyzacja 2023 | 56414 |
| Zdarzenia o charakterze jednorazowym 2023 | 17517 |
| EBITDA skorygowana 2023 | 114063 |
| Przychód z tytułu kontraktów rozpoznany z czego: 2023 | 1137174 |
| Przychody ogółem 2023 | 640513 |
| Sprzedaż na zewnątrz 2023 | 640513 |
| Sprzedaż do jednostek powiązanych 2023 | 3783 |
| Koszty prac rozwojowych 2023 | 45363 |
| Pozostałe wartości niematerialne 2023 | 950 |
| Inwestycje niezakończone w wartości niematerialne 2023 | 1497 |
| Zmniejszenie z tytułu likwidacji 2023 | -557 |
| Wartość brutto 2023 | 29809 |
| Suma dotychczasowego umorzenia i odpisów aktualizujących 2023 | -24052 |
| Wartość netto 2023 | 5757 |
| Wartość brutto wszystkich w pełni zamortyzowanych wartości niematerialnych będących nadal w używaniu 2023 | 76452 |
| Wartość nakładów na prace badawcze i rozwojowe ujętych jako koszt w okresie 2023 | 16215 |
| Centrum Automatyzacji Pracy Sieci Apator Rector Sp. z o.o. 2023 | 43106 |
| Linia Biznesowa Automatyki oraz ICT w Apator S.A. 2023 | 34506 |
| Woda i Ciepło Apator Powogaz S.A. 2023 | 17855 |
| Woda i Ciepło Apator Telemetria Sp. z o.o. 2023 | 5546 |
| Woda i Ciepło Miitors ApS 2023 | 18942 |
| Wartość firmy netto 2023 | 120672 |
| Wartość firmy brutto na początek okresu 2023 | 126528 |
| Wartość firmy brutto na koniec okresu 2023 | 124925 |
| Odpis aktualizujący z tytułu utraty wartości na koniec okresu 2023 | -4253 |
| Wartość firmy netto na koniec okresu 2023 | 120672 |
| planach finansowych spółek na lata 2023 | 2028 |
| Pozostałe rzeczowe aktywa trwałe 2023 | 41107 |
| Inwestycje niezakończone w rzeczowe aktywa trwałe 2023 | 12234 |
| Zwiększenie z tytułu nabycia 2023 | 48129 |
| Zwiększenie z tytułu własnej produkcji 2023 | 145 |
| Zwiększenie wynikające z przekwalifikowania- pozostałe 2023 | 272 |
| Zmniejszenie z tytułu zbycia 2023 | -6316 |
| Zmniejszenie wynikające z przekwalifikowania- pozostałe 2023 | 163 |
| Zmniejszenie dotychczasowego umorzenia z tytułu zbycia 2023 | 3825 |
| Zmniejszenie dotychczasowego umorzenia z tytułu likwidacji 22 2023 | 3886 |
| Różnice kursowe netto z przeliczenia sprawozdania finansowego na walutę prezentacji 2023 | 365 |
| Pozostałe zmiany- brutto 2023 | -273 |
| Pozostałe zmiany- umorzenie 2023 | 93374 |
| Pozostałe odpisy aktualizujące z tytułu utraty wartości aktywów 2023 | -596 |
| Zmniejszenie dotychczasowego umorzenia z tytułu likwidacji 2023 | 4660237 |
| Pozostałe zmiany - brutto 21 2023 | -62 |
| Utworzenie odpisu w ciężar bieżącego wyniku 2023 | -596 |
| Wartość na koniec okresu 2023 | 54800 |
| Zwiększenie z tytułu przyjęcia w leasing 2023 | 17750 |
| Długoterminowe zobowiązania z tytułu leasingu finansowego 2023 | 37608 |
| Krótkoterminowe zobowiązania z tytułu leasingu finansowego 2023 | 11110 |
| Zobowiązania z tytułu leasingu finansowego ogółem 2023 | 48718 |
| Opłaty Wartość bieżąca opłat Opłaty Wartość bieżąca opłat Płatne w okresie do 1 roku 2023 | 12844 |
| Płatne w okresie od 1 roku do 5 lat 2023 | 28772 |
| Płatne powyżej 5 lat 2023 | 11911 |
| Przyszłe minimalne opłaty z tytułu umów leasingu finansowego ogółem 2023 | 53527 |
| Przyszłe obciążenia finansowe (-) 2023 | -4809 |
| Wartość bieżąca minimalnych opłat leasingowych 2023 | 48718 |
| Wartość na początek okresu 2023 | 2282 |
| Bezpośrednie koszty operacyjne dotyczące nieruchomości inwestycyjnej, która w okresie przynosiła dochody z czynszów 2023 | 69 |
| Towary 2023 | 5293 |
| Pozostałe zapasy 2023 | 394 |
| Wartość zapasów ogółem 2023 | 242296 |
| Odpis aktualizujący zapasy ogółem Wartość odpisów na początek okresu 2023 | 20799 |
| Zwiększenie- utworzenie odpisu w ciężar bieżącego wyniku 2023 | 17316 |
| Zmniejszenie- odpisanie w przychody niewykorzystanych kwot 2023 | -1405 |
| Wykorzystanie odpisu- spisanie 2023 | -952 |
| Wartość odpisów na koniec okresu 2023 | 35717 |
| Wartość zapasów wykazywanych w wartości godziwej pomniejszonej o koszty sprzedaży 2023 | 241154 |
| Złożone depozyty, wadia, kaucje 2023 | 1862 |
| Długoterminowe należności handlowe 2023 | 2031 |
| Pozostałe 2023 | 721 |
| Należności krótkoterminowe, w tym: 2023 | 206475 |
| Należności handlowe brutto 2023 | 192110 |
| Odpis z tytułu utraty wartości należności handlowych 2023 | -3993 |
| Należności z tytułu sprzedanych rzeczowych aktywów trwałych oraz wartości niematerialnych 2023 | 1081 |
| Zaliczki na rzeczowe aktywa trwałe i wartości niematerialne i prawne 2023 | 818 |
| Należności ogółem, w tym: 2023 | 210011 |
| Niewymagalne 2023 | 167944 |
| Przeterminowane od 2023 | 0 |
| Przeterminowane od 31 do 2023 | 180 |
| Przeterminowane powyżej roku 2023 | 3514 |
| Wartość odpisów na początek okresu 2023 | 4808 |
| Utworzenie odpisów indywidualnych (stopień 3 modelu utraty wartości) 2023 | 3196 |
| Odwrócenie odpisów indywidualnych 2023 | -261 |
| Odpis indywidualny 2023 | 6849 |
| W dniu 22 grudnia 2023 | 11531 |
| Środki pieniężne na rachunkach bankowych 2023 | 18765 |
| Środki pieniężne na rachunkach VAT (split payment) 2023 | 4133 |
| Środki pieniężne i ich ekwiwalenty ogółem 2023 | 22939 |
| Ubezpieczenia 2023 | 1383 |
| Usługi informatyczne 2023 | 2705 |
| Kapitał zakładowy wynosi 2023 | 3.264 |
| Liczba wyemitowanych akcji, w pełni opłaconych 2023 | 32647 |
| Wartość nominalna akcji 2023 | 0.1 |
| Kapitał podstawowy na początek okresu 2023 | 3265 |
| Kapitał podstawowy na koniec okresu 2023 | 3265 |
| Tadeusz Sosgórnik 2023 | 1490000 |
| T. Sosgórnik z osobą blisko związaną 2023 | 1490000 |
| Danuta Guzowska 2023 | 954214 |
| Zbigniew Jaworski 2023 | 766348 |
| Apator Mining sp. z o. o. 2023 | 0 |
| Kazimierz Piotrowski z żoną 2023 | 664774 |
| PTE Allianz Polska* 2023 | 0 |
| Pozostali 2023 | 2268679 |
| Kapitał zapasowy, w tym: 2023 | 579667 |
| Pozostały kapitał zapasowy 2023 | 564525 |
| Kapitał z połączenia 2023 | 1146 |
| Kapitały rezerwowe 2023 | 19369 |
| Pozostałe kapitały ogółem 2023 | 600182 |
| 28 czerwca 2023 | 25593156.05 |
| w wysokości 2023 | 0.3 |
| rok w łącznej kwocie 2023 | 6529414.6 |
| Dywidendy ujęte jako wypłaty na rzecz właścicieli na jedną akcję (w PLN) 2023 | 0.5 |
| Apator Telemetria Sp. z o.o. 2023 | 2058 |
| Udziały niesprawujące kontroli ogółem 2023 | 2058 |
| Kredyty i pożyczki długoterminowe 2023 | 29545 |
| płatne powyżej 1 roku do 2 lat 2023 | 4924 |
| Kredyty i pożyczki krótkoterminowe 2023 | 162511 |
| Kredyty i pożyczki ogółem, w tym 2023 | 192056 |
| Kredyty 2023 | 192056 |
| Wykorzystanie rezerwy- rozliczenie z kosztami 2023 | -591 |
| Wartość rezerw na dzień 2023 | 31122022 |
| Zwiększenie- utworzenie rezerwy w ciężar bieżącego wyniku 2023 | 1016 |
| Zobowiązania długoterminowe z tytułu prawa do użytkowania aktywów w leasingu 2023 | 37608 |
| Zobowiązania krótkoterminowe, w tym: 2023 | 159690 |
| Zobowiązania bieżące 2023 | 77751 |
| Zobowiązania przeterminowane 2023 | 15840 |
| Zobowiązania z tytułu podatku dochodowego od osób prawnych 2023 | 3241 |
| Zobowiązania z tytułu wynagrodzeń 2023 | 9579 |
| Zobowiązania z tytułu dywidendy 2023 | 89 |
| Zobowiązania z tytułu instrumentów pochodnych 2023 | 466 |
| Zobowiązania inwestycyjne 2023 | 1173 |
| Przedpłaty- zaliczki otrzymane na dostawy 2023 | 1798 |
| Rozliczenia międzyokresowe przychodów 2023 | 7522 |
| Faktoring 2023 | 10001 |
| Inne zobowiązania 2023 | 4163 |
| Zobowiązania krótkoterminowe z tytułu prawa do użytkowania aktywów w leasingu 2023 | 11110 |
| Zobowiązania ogółem, w tym: 2023 | 200048 |
| Bieżące obciążenie z tytułu podatku dochodowego 2023 | 9341 |
| Obciążenie podatkowe wykazane w skróconym skonsolidowaniu sprawozdaniu z całkowitych dochodów 2023 | 19040 |
| Instrumenty pochodne 2023 | 324305 |
| Zobowiązania z tytułu świadczeń pracowniczych 2023 | 5029 |
| Rezerwy 2023 | 4015 |
| Strata podatkowa 2023 | 869 |
| Ulga podatkowa do rozliczenia w przyszłych okresach 2023 | 5807 |
| Nettowanie aktywa i rezerwy 2023 | -7107 |
| W dniu 28 grudnia 2023 | 69 |
| Podstawa opodatkowania 2023 | 27544 |
| Zastosowana stawka podatkowa 2023 | 19 |
| Podatek dochodowy obliczony według obowiązującej stawki 2023 | 4935 |
| Podatek od przychodów zwolnionych z opodatkowania (różnice trwałe) 2023 | -75 |
| Podatek od kosztów niestanowiących kosztów uzyskania przychodów (różnice trwałe) 2023 | 2224 |
| Podatek od transakcji wewnątrzgrupowych (różnice trwałe) 2023 | 3908 |
| Podatek od pozycji nieujętych w wyniku finansowym okresu 2023 | -105 |
| Korekta strat podatkowych z lat ubiegłych 2023 | 11352 |
| Inne odliczenia podatkowe 2023 | -2093 |
| Podatek dochodowy 2023 | 19040 |
| Efektywna stopa podatkowa 2023 | 69.13 |
| Zużycie materiałów i energii 2023 | 534846 |
| Usługi obce 2023 | 126093 |
| Świadczenia pracownicze 2023 | 253362 |
| Pozostałe koszty 2023 | 38545 |
| Koszty wytworzenia produktów na własne potrzeby jednostki 2023 | -3883 |
| Zmiana stanu wyrobów gotowych, produkcji niezakończonej oraz rozliczeń międzyokresowych 2023 | 11940 |
| Koszt sprzedanych towarów i materiałów 2023 | 62587 |
| Razem koszty 2023 | 1079904 |
| Przychody operacyjne 2023 | 3020 |
| Wynik na sprzedaży rzeczowych aktywów trwałych 2023 | 768 |
| Koszty operacyjne 2023 | -20158 |
| Koszt zlikwidowanych rzeczowych aktywów trwałych 2023 | -107 |
| Utworzenie odpisów aktualizujących wartości niematerialne 2023 | -9176 |
| Utworzenie rezerwy na zobowiązania 2023 | -328 |
| Zaniechane inwestycje 2023 | -1849 |
| Przekazane darowizny 2023 | -65 |
| Koszty operacyjne netto 2023 | -17138 |
| Przychody finansowe 2023 | 8079 |
| Przychody z tytułu transakcji walutowych (w tym instrumentów pochodnych) 2023 | 6894 |
| Koszty finansowe 2023 | -20667 |
| Odsetki od kredytów i pożyczek 2023 | -13690 |
| Odsetki płatne do budżetu 2023 | -44 |
| Odsetki od zobowiązań leasingowych 2023 | -2558 |
| Pozostałe odsetki 2023 | -1380 |
| Ujemne różnice kursowe 2023 | -1486 |
| Koszty finansowe netto 2023 | -12588 |
| Zmiana stanu pozostałych należności 2023 | 3349 |
| Korekta o należności z tytułu podatku dochodowego 2023 | 544 |
| Korekta o należności inwestycyjne 2023 | -1676 |
| Pozostałe zmiany 2023 | 179 |
| Zmiana stanu wykazana w rachunku przepływów 2023 | 10624 |
| Zmiana zobowiązań długoterminowych z tytułu prawa do użytkowania aktywów w leasingu 2023 | 4309 |
| Zmiana stanu pozostałych zobowiązań 2023 | -7187 |
| Korekta o zobowiązania z tytułu leasingu 2023 | -5863 |
| Korekta o zobowiązania z tytułu instrumentów pochodnych 2023 | 1469 |
| Korekta o zobowiązania inwestycyjne 2023 | 327 |
| Zmiana stanu krótkoterminowych rezerw z tytułu świadczeń pracowniczych 2023 | 5572 |
| Zmiana stanu krótkoterminowych rozliczeń międzyokresowych czynnych 2023 | 150 |
| Rozliczenie dotacji 2023 | -488 |
| Wpływy ze sprzedaży rzeczowych aktywów trwałych Przychody ze sprzedaży środków trwałych 2023 | 14749 |
| Wydatki na nabycie rzeczowych aktywów trwałych Zakup rzeczowych aktywów trwałych 2023 | -33910 |
| Wyłączenie z tytułu leasingu 2023 | 14460 |
| Wydatki na nabycie wartości niematerialnych Zakup wartości niematerialnych 2023 | -12804 |
| Zmiana stanu prac rozwojowych w budowie 2023 | -4420 |
| Wpływy / wypływy środków pieniężnych z tytułu kredytów Bilansowa zmiana kredytów długoterminowych 2023 | 26426 |
| Bilansowa zmiana kredytów krótkoterminowych 2023 | -74839 |
| Instrumenty pochodne (aktywa) 2023 | 5152 |
| Instrumenty pochodne (pasywa) 2023 | -466 |
| USD. Wartość nominalna 2023 | 7800 |
| Razem aktywa 2023 | 5152 |
| Instrumenty zabezpieczające 2023 | 466 |
| Razem zobowiązania 2023 | 466 |
| Stan na początek okresu 2023 | -2043 |
| Odwrócenie wyceny z poprzedniego okresu 2023 | 2043 |
| Wycena na koniec okresu 2023 | 2032 |
| Stan na koniec okresu 2023 | 2032 |
| w walucie w PLN w walucie w PLN Pozycje w euro (EUR) 2023 | 5027 |
| Środki pieniężne 2023 | 588 |
| Pozycje w dolarach amerykańskich (USD) 2023 | -2692 |
| Przekazane zaliczki na zakup materiałów i usług 2023 | 267 |
| Pozycje w funtach szterlingach (GBP) 2023 | 1459 |
| Pozycje w koronach czeskich (CZK) 2023 | -3713 |
| Pozycje w koronach duńskich (DKK) 2023 | 4944 |
| Pozycje w juanach chińskich (CNY) 2023 | -1895 |
| Przekazane zaliczki na zakup materiałów i usług 38 2023 | 25852 |
| Instrumenty zabezpieczające przepływy środków pieniężnych w USD 2023 | 5250 |
| USD / PLN +10% 2023 | -1037 |
| GBP / PLN +10% 2023 | -669 |
| DKK / PLN +10% 2023 | 288 |
| CNY/ PLN +10% 2023 | -105 |
| Instrumenty finansowe o stałej stopie procentowej 2023 | -30464 |
| Instrumenty finansowe o zmiennej stopie procentowej 2023 | -183888 |
| Wpływ na wynik finansowy brutto Wpływ na kapitał własny WIBOR + 2023 | 100 |
| SONIA + 2023 | 100 |
| EURIBOR + 2023 | 100 |
| PRIBOR + 2023 | 100 |
| SOFR + 2023 | 100 |
| Kredyty i pożyczki 2023 | 192056 |
| Zobowiązania z tytułu leasingu 2023 | 48718 |
| Krótkoterminowe świadczenia pracownicze 2023 | 13612 |
| Zakup produktów, usług, towarów i materiałów - 35 2023 | 4882 |
| Przeciętne zatrudnienie w etatach za okres 2023 | 2359 |
| Pracownicy fizyczni 2023 | 1439 |
| Stan zatrudnienia w etatach na koniec okresu 2023 | 2299 |
| Zarząd 2023 | -4 |

### P&L

- Selected period: `2023`
- Comparison period: `2022`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 20
- Mapped lines: 20
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation blockers: none

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Przychody ze sprzedaży dóbr i usług 2023 | fsl-pl-revenue | 1137174 |
| Koszt własny sprzedaży 2023 | fsl-pl-cogs | -881346 |
| Zysk brutto ze sprzedaży 2023 | fsl-pl-gross | 255828 |
| Koszty sprzedaży 2023 | fsl-pl-selling | -44903 |
| Koszty ogólnego zarządu 2023 | fsl-pl-gna | -153655 |
| Zysk ze sprzedaży 2023 | fsl-pl-opex | 57270 |
| Wynik na pozostałej działalności operacyjnej, w tym: 2023 | fsl-pl-other-op-result | -17138 |
| Zysk z działalności operacyjnej 2023 | fsl-pl-ebit | 40132 |
| Wynik na działalności finansowej, w tym: 2023 | fsl-pl-interest | -12588 |
| Zysk przed opodatkowaniem 2023 | fsl-pl-ebt | 27544 |
| Bieżący podatek dochodowy 2023 | fsl-pl-tax-current | -7326 |
| Odroczony podatek dochodowy 2023 | fsl-pl-tax-deferred | -11714 |
| Zysk netto z działalności kontynuowanej 2023 | fsl-pl-net-continuing | 8504 |
| Inne całkowite dochody Inne całkowite dochody netto 2023 | fsl-pl-oci-total | 5887 |
| Pozycje, które mogą w przyszłości być przeklasyfikowane do wyniku finansowego: 2023 | fsl-pl-oci-reclassifiable | 6140 |
| Różnice kursowe z przeliczenia jednostek zagranicznych 2023 | fsl-pl-oci-fx | 2839 |
| Wynik na rachunkowości zabezpieczeń wraz z efektem podatkowym 2023 | fsl-pl-oci-hedge | 3301 |
| Pozycje, które w przyszłości nie będą przeklasyfikowane do wyniku finansowego: 2023 | fsl-pl-oci-non-reclassifiable | -253 |
| Zyski i straty aktuarialne 2023 | fsl-pl-oci-actuarial | -253 |
| Całkowite dochody ogółem 2023 | fsl-pl-comprehensive-income | 14391 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |

### CF

- Selected period: `2023`
- Comparison period: `2022`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 26
- Mapped lines: 26
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation blockers: none

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Amortyzacja wartości niematerialnych 2023 | fsl-cf-operating-depreciation-intangibles | 16807 |
| Amortyzacja rzeczowych aktywów trwałych 2023 | fsl-cf-operating-depreciation-ppe | 86 |
| Odpisy aktualizujące z tytułu utraty wartości rzeczowych aktywów trwałych 2023 | fsl-cf-operating-impairment | 3408 |
| Zysk na sprzedaży rzeczowych aktywów trwałych i wartości niematerialnych 2023 | fsl-cf-operating-gain-disposal | -1365 |
| Straty z tytułu zmiany wartości godziwej instrumentów pochodnych 2023 | fsl-cf-operating-fv-derivatives | -920 |
| Koszty odsetek 2023 | fsl-cf-operating-interest-cost | 15676 |
| Inne korekty 2023 | fsl-cf-operating-other-adj | 15953 |
| zmian w kapitale obrotowym 2023 | fsl-cf-operating-before-wc | 116317 |
| Zmiana stanu zapasów 2023 | fsl-cf-change-wc-inventory | 9321 |
| Zmiana stanu należności 2023 | fsl-cf-change-wc-ar | 10624 |
| Zmiana stanu zobowiązań 2023 | fsl-cf-change-wc-ap | -27050 |
| Zmiana stanu rezerw 2023 | fsl-cf-change-wc-provisions | 6788 |
| Zwrot podatku 2023 | fsl-cf-tax-refund | 7277 |
| Zapłacony podatek dochodowy 2023 | fsl-cf-taxes-paid | -15423 |
| Wydatki na nabycie rzeczowych aktywów trwałych i aktywów leasingowych 2023 | fsl-cf-capex | -18499 |
| Wpływy ze sprzedaży rzeczowych aktywów trwałych 2023 | fsl-cf-investing-disposal-proceeds | 12196 |
| Środki pieniężne netto wykorzystane z działalności inwestycyjnej 2023 | fsl-cf-investing | -25225 |
| Wpływy z tytułu zaciągnięcia kredytów i pożyczek 2023 | fsl-cf-debt-drawdown | 24706 |
| Spłaty kredytów i pożyczek 2023 | fsl-cf-debt-repayment | -71482 |
| Odsetki zapłacone 2023 | fsl-cf-interest-paid | -14168 |
| Dywidendy wypłacone 2023 | fsl-cf-dividends | -14612 |
| Spłata zobowiązań z tytułu leasingu 2023 | fsl-cf-lease-repayment | -11582 |
| Inne wydatki 2023 | fsl-cf-other-expenditure | -1613 |
| Zwiększenie (zmniejszenie) netto stanu środków pieniężnych i ekwiwalentów środków pieniężnych 2023 | fsl-cf-net-change-cash | -6041 |
| Środki pieniężne i ich ekwiwalenty na początek okresu 2023 | fsl-cf-opening-cash | 28980 |
| Środki pieniężne i ich ekwiwalenty na koniec okresu 2023 | fsl-cf-closing-cash | 22939 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |

## Grupa Apator Raport RS 2024

- File: `knowledge/Finanse/Grupa Apator Raport RS 2024.pdf`
- Detected type: `BS`
- Contained statement types: `BS`, `P&L`, `CF`
- Document class: `mixed_report`
- Extraction strategy: `pdf_layout_mixed`
- Currency / scaling: `PLN` / `thousands`
- Extracted text length: 274440

### BS

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 30
- Mapped lines: 29
- Coverage: 97%
- Readiness: `recoverable` (75)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Środki pieniężne 2024 | fsl-bs-cash | 17716 |
| Pozostałe aktywa krótkoterminowe 2024 | fsl-bs-other-current-assets | 11208 |
| AKTYWA RAZEM 2024 | fsl-bs-total-assets | 965357 |
| Kapitał własny 2024 | fsl-bs-equity | 592502 |
| Kapitał własny przypadający akcjonariuszom jednostki dominującej 2024 | fsl-bs-equity-parent | 590290 |
| Kapitał podstawowy 2024 | fsl-bs-share-capital | 3265 |
| Akcje własne 2024 | fsl-bs-treasury-shares | -3522 |
| Pozostałe kapitały 2024 | fsl-bs-other-equity-reserves | 574829 |
| Kapitał z wyceny transakcji zabezpieczających 2024 | fsl-bs-hedge-reserve | 389 |
| Różnice kursowe z konsolidacji 2024 | fsl-bs-fx-reserve | 6132 |
| Niepodzielony wynik finansowy 2024 | fsl-bs-retained-earnings | 8590 |
| Udziały niesprawujące kontroli 2024 | fsl-bs-minority-interest | 2212 |
| Zobowiązania 2024 | fsl-bs-total-liabilities | 372855 |
| Zobowiązania i rezerwy długoterminowe 2024 | fsl-bs-long-term-debt | 63274 |
| Długoterminowe kredyty i pożyczki 2024 | fsl-bs-long-term-borrowings | 24621 |
| Zobowiązania długoterminowe z tytułu leasingu 2024 | fsl-bs-long-term-debt-lease | 28954 |
| Rezerwa z tytułu odroczonego podatku dochodowego 2024 | fsl-bs-other-non-current-liabilities-deferred-tax | 2565 |
| Długoterminowe zobowiązania z tytułu świadczeń pracowniczych 2024 | fsl-bs-employee-benefits-lt | 5567 |
| Pozostałe rezerwy długoterminowe 2024 | fsl-bs-other-non-current-liabilities-provisions | 1567 |
| Zobowiązania i rezerwy krótkoterminowe 2024 | fsl-bs-current-liabilities | 309581 |
| Zobowiązania handlowe 2024 | fsl-bs-ap | 722 |
| Krótkoterminowe zobowiązania kontraktowe 2024 | fsl-bs-contract-liabilities | 5940 |
| Zobowiązania z tytułu podatku dochodowego od osób prawnych 2024 | fsl-bs-other-current-liabilities-tax | 5427 |
| Zobowiązania z tytułu innych podatków, ceł i ubezpieczeń społecznych 2024 | fsl-bs-other-tax-payables | 19722 |
| Pozostałe zobowiązania krótkoterminowe 2024 | fsl-bs-other-current-liabilities | 16853 |
| Zobowiązania krótkoterminowe z tytułu leasingu 2024 | fsl-bs-short-term-debt-lease | 11950 |
| Krótkoterminowe zobowiązania z tytułu świadczeń pracowniczych 2024 | fsl-bs-employee-benefits-st | 22854 |
| Pozostałe rezerwy krótkoterminowe 2024 | fsl-bs-provisions | 29785 |
| PASYWA RAZEM 2024 | fsl-bs-total-liabilities-equity | 965357 |

| Unmapped labels | Value |
| --- | ---: |
| Krótkoterminowe kredyty i pożyczki 2024 | 90226 |

### P&L

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 16
- Mapped lines: 16
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation blockers: none

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Przychody ze sprzedaży dóbr i usług 2024 | fsl-pl-revenue | 1227799 |
| Koszt własny sprzedaży 2024 | fsl-pl-cogs | -913065 |
| Zysk brutto ze sprzedaży 2024 | fsl-pl-gross | 314734 |
| Koszty sprzedaży 2024 | fsl-pl-selling | -48381 |
| Koszty ogólnego zarządu 2024 | fsl-pl-gna | -162894 |
| Zysk ze sprzedaży 2024 | fsl-pl-opex | 103459 |
| Zmiana stanu odpisów aktualizujących należności 2024 | fsl-pl-impairment-receivables | -280 |
| Wynik na pozostałej działalności operacyjnej, w tym: 2024 | fsl-pl-other-op-result | -18045 |
| Zysk z działalności operacyjnej 2024 | fsl-pl-ebit | 85134 |
| Wynik na działalności finansowej, w tym: 2024 | fsl-pl-interest | -7599 |
| Zysk przed opodatkowaniem 2024 | fsl-pl-ebt | 81818 |
| Podatek dochodowy 2024 | fsl-pl-tax | -8604 |
| Inne całkowite dochody - Inne całkowite dochody netto 2024 | fsl-pl-oci-total | -2261 |
| Pozycje, które mogą w przyszłości być przeklasyfikowane do wyniku finansowego: 2024 | fsl-pl-oci-reclassifiable | -1974 |
| Różnice kursowe z przeliczenia jednostek zagranicznych 2024 | fsl-pl-oci-fx | -718 |
| Wynik na rachunkowości zabezpieczeń wraz z efektem podatkowym 2024 | fsl-pl-oci-hedge | -1256 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 28
- Mapped lines: 28
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation blockers: none

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Amortyzacja wartości niematerialnych 2024 | fsl-cf-operating-depreciation-intangibles | 16268 |
| Amortyzacja rzeczowych aktywów trwałych 2024 | fsl-cf-operating-depreciation-ppe | 30172 |
| Amortyzacja aktywów z tytułu prawa do użytkowania 2024 | fsl-cf-operating-depreciation-rou | 10872 |
| Odpisy aktualizujące z tytułu utraty wartości rzeczowych aktywów trwałych 2024 | fsl-cf-operating-impairment | 453 |
| Zysk na sprzedaży rzeczowych aktywów trwałych i wartości niematerialnych 2024 | fsl-cf-operating-gain-disposal | -867 |
| Zyski z wyceny nieruchomości inwestycyjnych według wartości godziwej 2024 | fsl-cf-operating-fv-changes | -716 |
| Koszty odsetek 2024 | fsl-cf-operating-interest-cost | 9877 |
| Inne korekty 2024 | fsl-cf-operating-other-adj | 274 |
| uwzględnieniem zmian w kapitale obrotowym 2024 | fsl-cf-operating-before-wc | 149575 |
| Zmiana stanu zapasów 2024 | fsl-cf-change-wc-inventory | 17454 |
| Zmiana stanu należności 2024 | fsl-cf-change-wc-ar | -8434 |
| Zmiana stanu pozostałych aktywów 2024 | fsl-cf-change-wc-other | -2109 |
| Zmiana stanu zobowiązań 2024 | fsl-cf-change-wc-ap | -18739 |
| Zmiana stanu rezerw 2024 | fsl-cf-change-wc-provisions | 19005 |
| Zwrot podatku 2024 | fsl-cf-tax-refund | 7070 |
| Zapłacony podatek dochodowy 2024 | fsl-cf-taxes-paid | -12623 |
| Wydatki na nabycie rzeczowych aktywów trwałych 2024 | fsl-cf-capex | -43691 |
| Wpływy ze sprzedaży rzeczowych aktywów trwałych 2024 | fsl-cf-investing-disposal-proceeds | 1758 |
| Inne wydatki 2024 | fsl-cf-other-expenditure | -2058 |
| Środki pieniężne netto wykorzystane z działalności inwestycyjnej 2024 | fsl-cf-investing | -58668 |
| Przepływy środków pieniężnych z działalności finansowej - Wpływy z tytułu zaciągnięcia kredytów i pożyczek 2024 | fsl-cf-financing | 31396 |
| Spłaty kredytów i pożyczek 2024 | fsl-cf-debt-repayment | -88845 |
| Odsetki zapłacone 2024 | fsl-cf-interest-paid | -8157 |
| Dywidendy wypłacone 2024 | fsl-cf-dividends | -17428 |
| Spłata zobowiązań z tytułu leasingu 2024 | fsl-cf-lease-repayment | -13257 |
| Zmniejszenie netto stanu środków pieniężnych 2024 | fsl-cf-net-change-cash | -5223 |
| Środki pieniężne na początek okresu 2024 | fsl-cf-opening-cash | 22939 |
| Środki pieniężne na koniec okresu 2024 | fsl-cf-closing-cash | 17716 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |

## Raport skonsolidowany Apator

- File: `knowledge/Finanse/Raport-skonsolidowany-Apator.pdf`
- Detected type: `BS`
- Contained statement types: `BS`, `P&L`, `CF`
- Document class: `mixed_report`
- Extraction strategy: `pdf_layout_mixed`
- Currency / scaling: `PLN` / `thousands`
- Extracted text length: 186704

### BS

- Selected period: `2022`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 42
- Mapped lines: 11
- Coverage: 26%
- Readiness: `recoverable` (0)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `BS_EQUATION_INCOMPLETE`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Zmniejszenie z tytułu zbycia 2022 | fsl-bs-other-tax-payables | -23 |
| Środki pieniężne i ich ekwiwalenty ogółem 2022 | fsl-bs-cash | 28980 |
| Krótkoterminowe rozliczenia międzyokresowe 2022 | fsl-bs-other-current-assets-prepaids | 5839 |
| Wartość nominalna akcji 2022 | fsl-bs-ar | 0.1 |
| Kapitał podstawowy 2022 | fsl-bs-share-capital | 3265 |
| Zmniejszenie kapitału podstawowego w okresie 2022 | fsl-bs-ap | -13 |
| Kapitał zapasowy ze sprzedaży akcji własnych powyżej ich wartości nominalnej 2022 | fsl-bs-share-premium | 15142 |
| Pozostałe kapitały ogółem 2022 | fsl-bs-other-equity-reserves | 562967 |
| Niepodzielony wynik finansowy 2022 | fsl-bs-retained-earnings | -29215 |
| Udziały niesprawujące kontroli ogółem 2022 | fsl-bs-minority-interest | 1801 |
| Kredyty i pożyczki długoterminowe 2022 | fsl-bs-long-term-borrowings | 3119 |

| Unmapped labels | Value |
| --- | ---: |
| Odwrócenie odpisów indywidualnych 2022 | -3429 |
| Bilans zamknięcia 2022 | 4808 |
| Odpis indywidualny 2022 | 4756 |
| W dniu 22 grudnia 2022 | 11531 |
| Środki pieniężne na rachunkach bankowych 2022 | 25548 |
| Środki pieniężne na rachunkach VAT (split payment) 2022 | 3381 |
| Ubezpieczenia 2022 | 1477 |
| Usługi informatyczne 2022 | 2712 |
| Wymiany wodomierzy (koszty rozliczane w czasie) 2022 | 829 |
| Liczba wyemitowanych akcji, w pełni opłaconych 2022 | 32647 |
| Kapitał podstawowy na początek okresu 2022 | 3278 |
| Umorzenie akcji własnych 2022 | -13 |
| Kapitał podstawowy na koniec okresu 2022 | 3265 |
| T. Sosgórnik z osobą blisko związaną 2022 | 1470000 |
| Danuta Guzowska 2022 | 954214 |
| Zbigniew Jaworski 2022 | 766348 |
| Apator Mining sp. z o. o. 2022 | 0 |
| Kazimierz Piotrowski z żoną 2022 | 664774 |
| PTE Allianz Polska* 2022 | 0 |
| Pozostali 2022 | 2289779 |
| Kapitał zapasowy, w tym: 2022 | 532451 |
| Pozostały kapitał zapasowy 2022 | 517309 |
| Kapitały rezerwowe 2022 | 29370 |
| wypłacona w dniu 24 stycznia 2022 | 9823208.4 |
| akcję. Wypłata pozostałej części dywidendy w wysokości 2022 | 6529414.6 |
| Apator Telemetria Sp. z o.o. 2022 | 1801 |
| Wynik finansowy przypisany udziałom niekontrolującym, w tym: Apator Telemetria Sp. z o.o. 2022 | 589 |
| płatne powyżej 1 roku do 2 lat 2022 | 3119 |
| Kredyty i pożyczki krótkoterminowe 2022 | 237350 |
| Kredyty i pożyczki ogółem, w tym 2022 | 240469 |
| tys. zł (na 31 grudnia 2022 | 105.691 |

### P&L

- Selected period: `2022`
- Comparison period: `2021`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 18
- Mapped lines: 18
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation blockers: none

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Przychody ze sprzedaży dóbr i usług 2022 | fsl-pl-revenue | 1081792 |
| Koszt własny sprzedaży 2022 | fsl-pl-cogs | -857531 |
| Zysk brutto ze sprzedaży 2022 | fsl-pl-gross | 224261 |
| Koszty sprzedaży 2022 | fsl-pl-selling | -42422 |
| Koszty ogólnego zarządu 2022 | fsl-pl-gna | -136749 |
| Zysk ze sprzedaży 2022 | fsl-pl-opex | 45090 |
| Wynik na pozostałej działalności operacyjnej, w tym: 2022 | fsl-pl-other-op-result | -14194 |
| Udział w zyskach jednostek objętych konsolidacją metodą praw własności 2022 | fsl-pl-equity-method-income | 444 |
| Zysk z działalności operacyjnej 2022 | fsl-pl-ebit | 31340 |
| Wynik na działalności finansowej, w tym: 2022 | fsl-pl-interest | -15425 |
| Zysk przed opodatkowaniem 2022 | fsl-pl-ebt | 15915 |
| Bieżący podatek dochodowy 2022 | fsl-pl-tax-current | -9019 |
| Odroczony podatek dochodowy 2022 | fsl-pl-tax-deferred | 309 |
| Zysk netto z działalności kontynuowanej 2022 | fsl-pl-net-continuing | 7205 |
| Inne całkowite dochody Inne całkowite dochody netto 2022 | fsl-pl-oci-total | 4767 |
| Wynik na rachunkowości zabezpieczeń wraz z efektem podatkowym 2022 | fsl-pl-oci-hedge | 1132 |
| Całkowite dochody ogółem 2022 | fsl-pl-comprehensive-income | 11972 |
| akcjonariuszom niesprawującym kontroli 2022 | fsl-pl-net-minority | 589 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |

### CF

- Selected period: `2022`
- Comparison period: `2021`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 21
- Mapped lines: 21
- Coverage: 100%
- Readiness: `recoverable` (89)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Amortyzacja rzeczowych aktywów trwałych 2022 | fsl-cf-operating-depreciation-ppe | 86 |
| Zysk na sprzedaży rzeczowych aktywów trwałych i wartości niematerialnych 2022 | fsl-cf-operating-gain-disposal | -2881 |
| Zyski z wyceny nieruchomości inwestycyjnych według wartości godziwej 2022 | fsl-cf-operating-fv-changes | -325 |
| Udziały w zyskach jednostek stowarzyszonych 2022 | fsl-cf-operating-equity-method | -444 |
| Przychody z tytułu odsetek 2022 | fsl-cf-operating-interest-income | -178 |
| kapitale obrotowym 2022 | fsl-cf-operating-before-wc | 98246 |
| Zmiana stanu zapasów 2022 | fsl-cf-change-wc-inventory | -12682 |
| Zmiana stanu rezerw 2022 | fsl-cf-change-wc-provisions | -1423 |
| Zmiana stanu rozliczeń międzyokresowych 2022 | fsl-cf-change-wc-prepaids | 666 |
| Zapłacony podatek dochodowy 2022 | fsl-cf-taxes-paid | -25272 |
| Wydatki na nabycie rzeczowych aktywów trwałych i aktywów leasingowych 2022 | fsl-cf-capex | -38911 |
| Inwestycje w jednostki zależne 2022 | fsl-cf-investing-subsidiaries | -10860 |
| Inne wpływy (wydatki) 2022 | fsl-cf-other-receipts | 618 |
| Środki pieniężne netto wykorzystane z działalności inwestycyjnej 2022 | fsl-cf-investing | -47066 |
| Przepływy środków pieniężnych z działalności finansowej Nabycie akcji własnych 2022 | fsl-cf-financing | -1950 |
| Wpływy z tytułu zaciągnięcia kredytów i pożyczek 2022 | fsl-cf-debt-drawdown | 90033 |
| Spłaty kredytów i pożyczek 2022 | fsl-cf-debt-repayment | -60488 |
| Odsetki zapłacone 2022 | fsl-cf-interest-paid | -13877 |
| Dywidendy wypłacone 2022 | fsl-cf-dividends | -14730 |
| Spłata zobowiązań z tytułu leasingu 2022 | fsl-cf-lease-repayment | -10912 |
| Inne wydatki 2022 | fsl-cf-other-expenditure | -1015 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |
