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
- Extracted lines: 33
- Mapped lines: 33
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation blockers: none

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Aktywa trwałe 2024 | fsl-bs-fixed | 350252 |
| Wartości niematerialne 2024 | fsl-bs-intangibles | 16204 |
| Wartość firmy 2024 | fsl-bs-intangibles-goodwill | 34506 |
| Rzeczowe aktywa trwałe 2024 | fsl-bs-ppe | 99388 |
| Aktywa z tytułu prawa do użytkowania 2024 | fsl-bs-rou-assets | 15125 |
| Pozostałe długoterminowe aktywa finansowe 2024 | fsl-bs-lt-financial-assets | 171007 |
| Aktywa z tytułu odroczonego podatku dochodowego 2024 | fsl-bs-other-non-current-assets-deferred-tax | 13921 |
| Aktywa obrotowe 2024 | fsl-bs-current-assets | 195755 |
| Zapasy 2024 | fsl-bs-inventory | 84562 |
| Należności handlowe 2024 | fsl-bs-ar | 77126 |
| Środki pieniężne 2024 | fsl-bs-cash | 2040 |
| Pozostałe aktywa krótkoterminowe 2024 | fsl-bs-other-current-assets | 7308 |
| AKTYWA RAZEM 2024 | fsl-bs-total-assets | 546007 |
| Kapitał własny 2024 | fsl-bs-equity | 425042 |
| Kapitał własny przypadający akcjonariuszom jednostki dominującej 2024 | fsl-bs-equity-parent | 425042 |
| Kapitał podstawowy 2024 | fsl-bs-share-capital | 3265 |
| Pozostałe kapitały 2024 | fsl-bs-other-equity-reserves | 368562 |
| Niepodzielony wynik finansowy 2024 | fsl-bs-retained-earnings | 53287 |
| Zobowiązania 2024 | fsl-bs-total-liabilities | 120965 |
| Zobowiązania i rezerwy długoterminowe 2024 | fsl-bs-long-term-debt | 13962 |
| Zobowiązania długoterminowe z tytułu leasingu 2024 | fsl-bs-long-term-debt-lease | 10434 |
| Długoterminowe zobowiązania z tytułu świadczeń pracowniczych 2024 | fsl-bs-employee-benefits-lt | 3528 |
| Zobowiązania i rezerwy krótkoterminowe 2024 | fsl-bs-current-liabilities | 107003 |
| Krótkoterminowe kredyty i pożyczki 2024 | fsl-bs-short-term-debt | 10649 |
| Zobowiązania handlowe 2024 | fsl-bs-ap | 37313 |
| Krótkoterminowe zobowiązania kontraktowe 2024 | fsl-bs-contract-liabilities | 3222 |
| Zobowiązania z tytułu podatku dochodowego od osób prawnych 2024 | fsl-bs-other-current-liabilities-tax | 2424 |
| Zobowiązania z tytułu innych podatków, ceł i ubezpieczeń społecznych 2024 | fsl-bs-other-tax-payables | 9971 |
| Pozostałe zobowiązania krótkoterminowe 2024 | fsl-bs-other-current-liabilities | 9587 |
| Zobowiązania krótkoterminowe z tytułu leasingu 2024 | fsl-bs-short-term-debt-lease | 4354 |
| Krótkoterminowe zobowiązania z tytułu świadczeń pracowniczych 2024 | fsl-bs-employee-benefits-st | 10886 |
| Pozostałe rezerwy krótkoterminowe 2024 | fsl-bs-provisions | 13541 |
| PASYWA RAZEM 2024 | fsl-bs-total-liabilities-equity | 546007 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |

### P&L

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 14
- Mapped lines: 14
- Coverage: 100%
- Readiness: `recoverable` (77)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

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
| Średnia ważona liczba akcji 2024 | fsl-pl-shares-outstanding | 32647 |
| Inne całkowite dochody 2024 | fsl-pl-oci-total | 214 |
| Pozycje, które w przyszłości nie będą przeklasyfikowane do wyniku finansowego: Zyski i straty aktuarialne 2024 | fsl-pl-oci-actuarial | -333 |
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
- Readiness: `recoverable` (89)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

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
| w kapitale obrotowym 2024 | fsl-cf-change-wc | 77144 |
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
- Comparison period: `2022`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 42
- Mapped lines: 42
- Coverage: 100%
- Readiness: `recoverable` (89)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Aktywa trwałe 2023 | fsl-bs-fixed | 492647 |
| Wartości niematerialne 2023 | fsl-bs-intangibles | 94114 |
| Wartość firmy 2023 | fsl-bs-intangibles-goodwill | 120672 |
| Rzeczowe aktywa trwałe 2023 | fsl-bs-ppe | 196811 |
| Prawo do użytkowania aktywów 2023 | fsl-bs-rou-assets | 54800 |
| Nieruchomości inwestycyjne 2023 | fsl-bs-investment-property | 2234 |
| Należności długoterminowe 2023 | fsl-bs-lt-receivables | 3536 |
| Długoterminowe rozliczenia międzyokresowe 2023 | fsl-bs-lt-prepaids | 303 |
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
| Kapitał z wyceny transakcji zabezpieczających oraz różnice kursowe z konsolidacji 2023 | fsl-bs-fx-reserve | 8845 |
| Niepodzielony wynik finansowy 2023 | fsl-bs-retained-earnings | -72699 |
| Udziały niesprawujące kontroli 2023 | fsl-bs-minority-interest | 2058 |
| Zobowiązania 2023 | fsl-bs-total-liabilities | 436175 |
| Zobowiązania i rezerwy długoterminowe 2023 | fsl-bs-long-term-debt | 80106 |
| Długoterminowe kredyty i pożyczki 2023 | fsl-bs-long-term-borrowings | 29545 |
| Pozostałe zobowiązania długoterminowe 2023 | fsl-bs-other-non-current-liabilities | 2750 |
| Zobowiązania długoterminowe z tytułu prawa do użytkowania aktywów 2023 | fsl-bs-long-term-debt-lease | 37608 |
| Rezerwa z tytułu odroczonego podatku dochodowego 2023 | fsl-bs-other-non-current-liabilities-deferred-tax | 3684 |
| Długoterminowe zobowiązania z tytułu świadczeń pracowniczych 2023 | fsl-bs-employee-benefits-lt | 5315 |
| Pozostałe rezerwy długoterminowe 2023 | fsl-bs-other-non-current-liabilities-provisions | 1204 |
| Zobowiązania i rezerwy krótkoterminowe 2023 | fsl-bs-current-liabilities | 356069 |
| Krótkoterminowe kredyty i pożyczki 2023 | fsl-bs-short-term-debt | 162511 |
| Zobowiązania handlowe 2023 | fsl-bs-ap | 93591 |
| Zobowiązania z tytułu innych podatków, ceł i ubezpieczeń społecznych 2023 | fsl-bs-other-tax-payables | 16957 |
| Pozostałe zobowiązania krótkoterminowe 2023 | fsl-bs-other-current-liabilities | 34791 |
| Zobowiązania krótkoterminowe z tytułu prawa do użytkowania aktywów 2023 | fsl-bs-short-term-debt-lease | 11110 |
| Krótkoterminowe zobowiązania z tytułu świadczeń pracowniczych 2023 | fsl-bs-employee-benefits-st | 20954 |
| Pozostałe rezerwy krótkoterminowe 2023 | fsl-bs-provisions | 12914 |
| PASYWA RAZEM 2023 | fsl-bs-total-liabilities-equity | 975198 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |

### P&L

- Selected period: `2023`
- Comparison period: `2022`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 21
- Mapped lines: 21
- Coverage: 100%
- Readiness: `recoverable` (71)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

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
| Średnia ważona liczba akcji 2023 | fsl-pl-shares-outstanding | 29047 |

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
- Readiness: `recoverable` (83)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Amortyzacja wartości niematerialnych 2023 | fsl-cf-operating-depreciation-intangibles | 16807 |
| Amortyzacja rzeczowych aktywów trwałych 2023 | fsl-cf-operating-depreciation-ppe | 86 |
| Odpisy aktualizujące z tytułu utraty wartości rzeczowych aktywów trwałych 2023 | fsl-cf-operating-impairment | 3408 |
| Zysk na sprzedaży rzeczowych aktywów trwałych i wartości niematerialnych 2023 | fsl-cf-operating-gain-disposal | -1365 |
| Straty z tytułu zmiany wartości godziwej instrumentów pochodnych 2023 | fsl-cf-operating-fv-derivatives | -920 |
| Koszty odsetek 2023 | fsl-cf-operating-interest-cost | 15676 |
| Inne korekty 2023 | fsl-cf-operating-other-adj | 15953 |
| zmian w kapitale obrotowym 2023 | fsl-cf-change-wc | 116317 |
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
- Extracted lines: 45
- Mapped lines: 45
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation blockers: none

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Aktywa trwałe 2024 | fsl-bs-fixed | 497947 |
| Wartości niematerialne 2024 | fsl-bs-intangibles | 88444 |
| Wartość firmy 2024 | fsl-bs-intangibles-goodwill | 120004 |
| Rzeczowe aktywa trwałe 2024 | fsl-bs-ppe | 215334 |
| Aktywa z tytułu prawa do użytkowania 2024 | fsl-bs-rou-assets | 47386 |
| Nieruchomości inwestycyjne 2024 | fsl-bs-investment-property | 1019 |
| Należności długoterminowe 2024 | fsl-bs-lt-receivables | 2367 |
| Aktywa z tytułu odroczonego podatku dochodowego 2024 | fsl-bs-other-non-current-assets-deferred-tax | 23183 |
| Aktywa obrotowe 2024 | fsl-bs-current-assets | 467410 |
| Zapasy 2024 | fsl-bs-inventory | 225460 |
| Należności handlowe 2024 | fsl-bs-ar | 185495 |
| Należności z tytułu podatku dochodowego od osób prawnych 2024 | fsl-bs-tax-receivables | 1198 |
| Należności z tytułu innych podatków, ceł i ubezpieczeń społecznych 2024 | fsl-bs-other-tax-receivables | 9804 |
| Pozostałe należności krótkoterminowe 2024 | fsl-bs-other-st-receivables | 9421 |
| Pozostałe krótkoterminowe aktywa finansowe 2024 | fsl-bs-other-current-financial-assets | 1155 |
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
| Krótkoterminowe kredyty i pożyczki 2024 | fsl-bs-short-term-debt | 90226 |
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
| none | — |

### P&L

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 17
- Mapped lines: 17
- Coverage: 100%
- Readiness: `recoverable` (77)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

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
| Średnia ważona liczba akcji 2024 | fsl-pl-shares-outstanding | 29047 |
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
- Readiness: `recoverable` (89)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

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
| uwzględnieniem zmian w kapitale obrotowym 2024 | fsl-cf-change-wc | 149575 |
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
- Comparison period: `2021`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 48
- Mapped lines: 48
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation blockers: none

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Aktywa trwałe 2022 | fsl-bs-fixed | 527979 |
| Wartości niematerialne 2022 | fsl-bs-intangibles | 105831 |
| Wartość firmy 2022 | fsl-bs-intangibles-goodwill | 122275 |
| Rzeczowe aktywa trwałe 2022 | fsl-bs-ppe | 212844 |
| Prawo do użytkowania aktywów 2022 | fsl-bs-rou-assets | 46690 |
| Nieruchomości inwestycyjne 2022 | fsl-bs-investment-property | 2282 |
| Inwestycje w jednostkach współkontrolowanych konsolidowane metodą praw własności 2022 | fsl-bs-equity-method-investments | 0 |
| Należności długoterminowe 2022 | fsl-bs-lt-receivables | 6437 |
| Długoterminowe rozliczenia międzyokresowe 2022 | fsl-bs-lt-prepaids | 55 |
| Aktywa z tytułu odroczonego podatku dochodowego 2022 | fsl-bs-other-non-current-assets-deferred-tax | 30213 |
| Aktywa obrotowe 2022 | fsl-bs-current-assets | 514068 |
| Zapasy 2022 | fsl-bs-inventory | 251617 |
| Inne aktywa obrotowe 2022 | fsl-bs-other-current-assets | 0 |
| Należności handlowe 2022 | fsl-bs-ar | 189804 |
| Należności z tytułu podatku dochodowego od osób prawnych 2022 | fsl-bs-tax-receivables | 5741 |
| Należności z tytułu innych podatków, ceł i ubezpieczeń społecznych 2022 | fsl-bs-other-tax-receivables | 12309 |
| Pozostałe należności krótkoterminowe 2022 | fsl-bs-other-st-receivables | 6642 |
| Środki pieniężne i ich ekwiwalenty 2022 | fsl-bs-cash | 28980 |
| Krótkoterminowe rozliczenia międzyokresowe 2022 | fsl-bs-other-current-assets-prepaids | 5839 |
| Aktywa trwałe zaklasyfikowane jako przeznaczone do sprzedaży 2022 | fsl-bs-assets-held-for-sale | 12863 |
| AKTYWA RAZEM 2022 | fsl-bs-total-assets | 1042047 |
| Kapitał własny 2022 | fsl-bs-equity | 539148 |
| Kapitał własny przypadający akcjonariuszom jednostki dominującej 2022 | fsl-bs-equity-parent | 537347 |
| Kapitał podstawowy 2022 | fsl-bs-share-capital | 3265 |
| Akcje własne 2022 | fsl-bs-treasury-shares | -3522 |
| Pozostałe kapitały 2022 | fsl-bs-other-equity-reserves | 562967 |
| Kapitał z wyceny transakcji zabezpieczających oraz różnice kursowe z konsolidacji 2022 | fsl-bs-fx-reserve | 2705 |
| Niepodzielony wynik finansowy 2022 | fsl-bs-retained-earnings | -29215 |
| Udziały niesprawujące kontroli 2022 | fsl-bs-minority-interest | 1801 |
| Zobowiązania 2022 | fsl-bs-total-liabilities | 502899 |
| Zobowiązania i rezerwy długoterminowe 2022 | fsl-bs-long-term-debt | 45174 |
| Długoterminowe kredyty i pożyczki 2022 | fsl-bs-long-term-borrowings | 3119 |
| Pozostałe zobowiązania długoterminowe 2022 | fsl-bs-other-non-current-liabilities | 52 |
| Zobowiązania długoterminowe z tytułu prawa do użytkowania aktywów 2022 | fsl-bs-long-term-debt-lease | 33299 |
| Rezerwa z tytułu odroczonego podatku dochodowego 2022 | fsl-bs-other-non-current-liabilities-deferred-tax | 2939 |
| Długoterminowe zobowiązania z tytułu świadczeń pracowniczych 2022 | fsl-bs-employee-benefits-lt | 4474 |
| Pozostałe rezerwy długoterminowe 2022 | fsl-bs-other-non-current-liabilities-provisions | 1291 |
| Zobowiązania i rezerwy krótkoterminowe 2022 | fsl-bs-current-liabilities | 457725 |
| Krótkoterminowe kredyty i pożyczki 2022 | fsl-bs-short-term-debt | 237350 |
| Zobowiązania handlowe 2022 | fsl-bs-ap | 121894 |
| Zobowiązania kontraktowe 2022 | fsl-bs-contract-liabilities | 0 |
| Zobowiązania z tytułu podatku dochodowego od osób prawnych 2022 | fsl-bs-other-current-liabilities-tax | 1976 |
| Zobowiązania z tytułu innych podatków, ceł i ubezpieczeń społecznych 2022 | fsl-bs-other-tax-payables | 17107 |
| Pozostałe zobowiązania krótkoterminowe 2022 | fsl-bs-other-current-liabilities | 41978 |
| Zobowiązania krótkoterminowe z tytułu prawa do użytkowania aktywów 2022 | fsl-bs-short-term-debt-lease | 9556 |
| Krótkoterminowe zobowiązania z tytułu świadczeń pracowniczych 2022 | fsl-bs-employee-benefits-st | 15382 |
| Pozostałe rezerwy krótkoterminowe 2022 | fsl-bs-provisions | 12482 |
| PASYWA RAZEM 2022 | fsl-bs-total-liabilities-equity | 1042047 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |

### P&L

- Selected period: `2022`
- Comparison period: `2021`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 19
- Mapped lines: 19
- Coverage: 100%
- Readiness: `recoverable` (71)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

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
| Średnia ważona liczba akcji 2022 | fsl-pl-shares-outstanding | 29070 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |

### CF

- Selected period: `2022`
- Comparison period: `2021`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 34
- Mapped lines: 34
- Coverage: 100%
- Readiness: `recoverable` (89)
- Reason codes: `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Amortyzacja wartości niematerialnych 2022 | fsl-cf-operating-depreciation-intangibles | 14530 |
| Amortyzacja rzeczowych aktywów trwałych 2022 | fsl-cf-operating-depreciation-ppe | 86 |
| Zysk na sprzedaży rzeczowych aktywów trwałych i wartości niematerialnych 2022 | fsl-cf-operating-gain-disposal | -2881 |
| Zyski z wyceny nieruchomości inwestycyjnych według wartości godziwej 2022 | fsl-cf-operating-fv-changes | -325 |
| (Zyski) straty z tytułu zmiany wartości godziwej instrumentów pochodnych 2022 | fsl-cf-operating-fv-derivatives | -3493 |
| Koszty odsetek 2022 | fsl-cf-operating-interest-cost | 14690 |
| Udziały w zyskach jednostek stowarzyszonych 2022 | fsl-cf-operating-equity-method | -444 |
| Przychody z tytułu odsetek 2022 | fsl-cf-operating-interest-income | -178 |
| Inne korekty 2022 | fsl-cf-operating-other-adj | 3373 |
| kapitale obrotowym 2022 | fsl-cf-change-wc | 98246 |
| Zmiana stanu zapasów 2022 | fsl-cf-change-wc-inventory | -12682 |
| Zmiana stanu amortyzowanego aktywa kontraktowego 2022 | fsl-cf-change-wc-other | 1625 |
| Zmiana stanu należności 2022 | fsl-cf-change-wc-ar | -49607 |
| Zmiana stanu zobowiązań 2022 | fsl-cf-change-wc-ap | 38617 |
| Zmiana stanu rezerw 2022 | fsl-cf-change-wc-provisions | -1423 |
| Zmiana stanu środków pieniężnych o ograniczonym sposobie dysponowania 2022 | fsl-cf-change-wc-restricted-cash | 556 |
| Zmiana stanu rozliczeń międzyokresowych 2022 | fsl-cf-change-wc-prepaids | 666 |
| Zapłacony podatek dochodowy 2022 | fsl-cf-taxes-paid | -25272 |
| Wydatki na nabycie rzeczowych aktywów trwałych i aktywów leasingowych 2022 | fsl-cf-capex | -38911 |
| Wpływy ze sprzedaży rzeczowych aktywów trwałych 2022 | fsl-cf-investing-disposal-proceeds | 25806 |
| Inwestycje w jednostki zależne 2022 | fsl-cf-investing-subsidiaries | -10860 |
| Otrzymane dywidendy 2022 | fsl-cf-dividends-received | 0 |
| Inne wpływy (wydatki) 2022 | fsl-cf-other-receipts | 618 |
| Środki pieniężne netto wykorzystane z działalności inwestycyjnej 2022 | fsl-cf-investing | -47066 |
| Przepływy środków pieniężnych z działalności finansowej Nabycie akcji własnych 2022 | fsl-cf-financing | -1950 |
| Wpływy z tytułu zaciągnięcia kredytów i pożyczek 2022 | fsl-cf-debt-drawdown | 90033 |
| Spłaty kredytów i pożyczek 2022 | fsl-cf-debt-repayment | -60488 |
| Odsetki zapłacone 2022 | fsl-cf-interest-paid | -13877 |
| Dywidendy wypłacone 2022 | fsl-cf-dividends | -14730 |
| Spłata zobowiązań z tytułu leasingu 2022 | fsl-cf-lease-repayment | -10912 |
| Inne wydatki 2022 | fsl-cf-other-expenditure | -1015 |
| Zwiększenie (zmniejszenie) netto stanu środków pieniężnych i ekwiwalentów środków pieniężnych 2022 | fsl-cf-net-change-cash | -7852 |
| Środki pieniężne i ich ekwiwalenty na początek okresu 2022 | fsl-cf-opening-cash | 36832 |
| Środki pieniężne i ich ekwiwalenty na koniec okresu 2022 | fsl-cf-closing-cash | 28980 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |

## BMW Group Financial Statements 2024

- File: `knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf`
- Detected type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Currency / scaling: `EUR` / `millions`
- Extracted text length: 289394

### BS

- Selected period: `2024`
- Comparison period: `2025`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 45
- Mapped lines: 12
- Coverage: 27%
- Readiness: `recoverable` (14)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `BS_EQUATION_INCOMPLETE`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Other operating income 2024 | fsl-bs-other-equity-reserves | 1.335 |
| Interest and similar income 2024 | fsl-bs-ar | 10 |
| Capital expenditure on non-current assets 2024 | fsl-bs-other-non-current-assets-deferred-tax | 12.371 |
| Investments accounted for using the equity method 2024 | fsl-bs-equity-method-investments | 553443 |
| Write-downs on inventories to their net realisable value amount- ing to € 2024 | fsl-bs-inventory | 522 |
| reversal of impairment losses on leased products amounted to € 2024 | fsl-bs-equity-parent | 311 |
| Total Group capital expenditure on non-current assets 2024 | fsl-bs-current-assets | 36.752 |
| Financial and other assets - Automotive 2024 | fsl-bs-other-current-financial-assets | 61.208 |
| Trade payables - Automotive 2024 | fsl-bs-ap | 12.556 |
| Total liabilities – Financial Services 2024 | fsl-bs-total-liabilities | 147.929 |
| Non-operating assets – Other Entities 2024 | fsl-bs-other-non-current-assets | 23.442 |
| Total Group assets 2024 | fsl-bs-total-assets | 267.732 |

| Unmapped labels | Value |
| --- | ---: |
| Revenues 2024 | 124.917 |
| thereof external revenues 2024 | 103.524 |
| thereof inter-segment revenues 2024 | 21.393 |
| Cost of sales 2024 | 107.729 |
| Selling and administrative expenses 2024 | 9.357 |
| Other operating expenses 2024 | 1.273 |
| Segment result Automotive and Motorcycles 2024 | 7.893 |
| Interest and similar expenses 2024 | 20 |
| Other financial result 2024 | 37 |
| Segment result Financial Services and Other Entities 2024 | 2.538 |
| Result from equity accounted investments 2024 | 14 |
| Depreciation and amortisation on non-current assets 2024 | 8.504 |
| Segment assets 2024 | 70.804 |
| Reconciliation of segment result Total for reportable segments 2024 | 11.466 |
| Financial result of Automotive segment 2024 | 349 |
| Elimination of inter-segment items 2024 | 146 |
| Group profit before tax 2024 | 10.971 |
| Reconciliation of capital expenditure on non-current assets Total for reportable segments 2024 | 44.032 |
| Reconciliation of depreciation and amortisation on non-current assets Total for reportable segments 2024 | 19.327 |
| Total Group depreciation and amortisation on non-current assets 2024 | 14.628 |
| Reconciliation of segment assets Total for reportable segments 2024 | 197.237 |
| Financial and other assets - Motorcycles 2024 | 56 |
| Europe 2024 | 60.78 |
| thereof Germany 2024 | 19.845 |
| Asia 2024 | 46.558 |
| thereof China 2024 | 31.786 |
| Americas 2024 | 31.941 |
| thereof USA 2024 | 27.048 |
| Other regions 2024 | 3.101 |
| Eliminations – – 2024 | 8.411 |
| Group 2024 | 142.38 |
| LIST OF INVESTMENTS AT 2024 | 31 |
| subsidiaries apply the exemptions available in § 2024 | 264 |

### P&L

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 58
- Mapped lines: 23
- Coverage: 40%
- Readiness: `recoverable` (29)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `PL_GROSS_MISMATCH`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Revenues 2024 | fsl-pl-revenue | 7 |
| Cost of sales 2024 | fsl-pl-cogs | 8 |
| Gross profit 2024 | fsl-pl-gross | 22.895 |
| Selling and administrative expenses 2024 | fsl-pl-gna | 9 |
| Other operating income 2024 | fsl-pl-ebit | 10 |
| Other operating expenses 2024 | fsl-pl-other-opex | 10 |
| Result from equity accounted investments 2024 | fsl-pl-equity-method-income | 24 |
| Other financial result 2024 | fsl-pl-other-fin | 12 |
| Profit/loss before tax 2024 | fsl-pl-ebt | 10.971 |
| Income taxes 2024 | fsl-pl-tax | 13 |
| Net profit/loss 2024 | fsl-pl-net | 7.678 |
| Attributable to non-controlling interests 2024 | fsl-pl-net-minority | 388875 |
| Items not expected to be reclassified to the income statement in the future 2024 | fsl-pl-oci-non-reclassifiable | 252 |
| Items that can be reclassified to the income statement in the future 2024 | fsl-pl-oci-reclassifiable | 592 |
| Other comprehensive income for the period after tax 2024 | fsl-pl-oci-total | 19 |
| Total comprehensive income 2024 | fsl-pl-comprehensive-income | 7.338 |
| A S S E T S Intangible assets 2024 | fsl-pl-depreciation-intangibles | 21 |
| Property, plant and equipment 2024 | fsl-pl-depreciation-ppe | 22 |
| Deferred tax 2024 | fsl-pl-tax-deferred | 13 |
| Inventories 2024 | fsl-pl-cbn-inventory-change | 29 |
| Current tax 2024 | fsl-pl-tax-current | 27 |
| Cash and cash equivalents 2024 | fsl-pl-fin-income | 19.287 |
| Other provisions 2024 | fsl-pl-other-opex-provisions | 34 |

| Unmapped labels | Value |
| --- | ---: |
| Profit/loss before financial result 2024 | 11.509 |
| Interest and similar income 2024 | 11655 |
| Interest and similar expenses 2024 | 11 |
| Financial result 2024 | 538 |
| Attributable to shareholders of the BMW AG 2024 | 7.29 |
| Remeasurement of the net liability for defined benefit pension plans 2024 | 33302 |
| Derivative financial instruments 2024 | 3.306 |
| Other comprehensive income from equity accounted investments 2024 | 7 |
| Currency translation foreign operations 2024 | 1.108 |
| Total comprehensive income attributable to shareholders of BMW AG 2024 | 7.014 |
| Balance Sheet for Group and Segments at 2024 | 31 |
| Leased products 2024 | 23 |
| Investments accounted for using the equity method 2024 | 24553 |
| Other investments 2024 | 1.099 |
| Receivables from sales financing 2024 | 25 |
| Financial assets 2024 | 26834 |
| Other assets 2024 | 28 |
| Non-current assets 2024 | 171.345 |
| Trade receivables 2024 | 30 |
| Current assets 2024 | 96.387 |
| Total assets 2024 | 267.732 |
| Capital reserves 2024 | 31 |
| Revenue reserves 2024 | 31 |
| Accumulated other equity 2024 | 31 |
| Treasury shares 2024 | 31 |
| Equity attributable to shareholders of BMW AG 2024 | 31 |
| Non-controlling interests 2024 | 2.688 |
| Equity 2024 | 95.003 |
| Pension provisions 2024 | 33222 |
| Financial liabilities 2024 | 36 |
| Other liabilities 2024 | 37 |
| Non-current provisions and liabilities 2024 | 85.04 |
| Trade payables 2024 | 38 |
| Current provisions and liabilities 2024 | 87.689 |
| Total equity and liabilities 2024 | 267.732 |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 48
- Mapped lines: 17
- Coverage: 35%
- Readiness: `recoverable` (50)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Profit/loss before tax 2024 | fsl-cf-operating-ebt | 10.971 |
| Income taxes paid 2024 | fsl-cf-taxes-paid | 3.794 |
| Other interest and similar income/expenses * 2024 | fsl-cf-operating-interest-income | 433 |
| Changes in working capital 2024 | fsl-cf-change-wc | 396 |
| Change in trade receivables 2024 | fsl-cf-change-wc-ar | 1.379 |
| Change in trade payables 2024 | fsl-cf-change-wc-ap | 1.647 |
| Change in provisions 2024 | fsl-cf-change-wc-provisions | 726 |
| Cash inflow/outflow from operating activities 2024 | fsl-cf-operating | 7.566 |
| Proceeds from the disposal of intangible assets and property, plant and equipment 2024 | fsl-cf-capex | 21116 |
| Investments in marketable securities and investment funds 2024 | fsl-cf-investing-subsidiaries | 1.062 |
| Cash inflow/outflow from investing activities 2024 | fsl-cf-investing | 11.369 |
| Payment of dividends to non-controlling interests 2024 | fsl-cf-dividends | 1.013 |
| Interest paid * 2024 | fsl-cf-interest-paid | 196 |
| Change in other financial liabilities 2024 | fsl-cf-change-wc-other | 3.937 |
| Cash inflow/outflow from financing activities 2024 | fsl-cf-financing | 5.766 |
| Change in cash and cash equivalents 2024 | fsl-cf-net-change-cash | 1.96 |
| Cash and cash equivalents as at 2024 | fsl-cf-opening-cash | 1 |

| Unmapped labels | Value |
| --- | ---: |
| Interest received * 2024 | 644683 |
| Depreciation and amortisation of tangible and intangible assets 2024 | 8.65 |
| Other non-cash income and expense items 2024 | 339179 |
| Result from equity accounted investments 2024 | 14159 |
| Change in leased products 2024 | 5.231 |
| Change in receivables from sales financing 2024 | 4.144 |
| Change in inventories 2024 | 128 |
| Change in other operating assets and liabilities 2024 | 1.672 |
| Total investment in intangible assets and property, plant and equipment 2024 | 12.205 |
| Proceeds from subsidies for intangible assets and property, plant and equipment 2024 | 192 |
| Expenditure for investment assets 2024 | 162 |
| Proceeds from the disposal of investment assets and other business units 2024 | 13 |
| Proceeds from the disposal of marketable securities and investment funds 2024 | 1.834 |
| Payments out of equity 2024 | 22 |
| Treasury shares acquired 2024 | 1.002 |
| Payment of dividends to shareholders of BMW AG 2024 | 3.781 |
| Intragroup financing and equity transactions – 2024 | 2.001 |
| Proceeds from issue of non-current financial liabilities 2024 | 30.025 |
| Repayment of non-current financial liabilities 2024 | 22.182 |
| Effect of exchange rate on cash and cash equivalents 2024 | 3 |
| Effect of changes in composition of Group on cash and cash equivalents 2024 | 27 |
| Net profit – 2024 | 7.29 |
| Other comprehensive income for the period after tax – 2024 | 252978 |
| Comprehensive income at 2024 | 7.542 |
| Dividend payments – – 2024 | 3.781 |
| Treasury shares acquired – – – – – – – 2024 | 1.002 |
| Treasury share redemption – – – – – – – – – – – Reclassification resulting from share redemption – – – – – – – – – – – Other changes – – 2024 | 21 |
| Other comprehensive income for the period after tax – – 2024 | 118 |
| Treasury share redemption – – 2024 | 2 |
| Reclassification resulting from share redemption 2024 | 24 |
| Other changes – – 2024 | 95 |

## KGHM SRR 2024

- File: `knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf`
- Detected type: `CF`
- Contained statement types: `CF`, `BS`, `P&L`
- Document class: `mixed_report`
- Extraction strategy: `pdf_layout_mixed`
- Currency / scaling: `PLN` / `millions`
- Extracted text length: 511416

### BS

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 15
- Mapped lines: 10
- Coverage: 67%
- Readiness: `recoverable` (48)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `BS_EQUATION_INCOMPLETE`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Aktywa niematerialne górnicze i hutnicze 2024 | fsl-bs-intangibles | 2830 |
| Pozostałe rzeczowe aktywa trwałe 2024 | fsl-bs-ppe | 3087 |
| Aktywa trwałe 2024 | fsl-bs-fixed | 42285 |
| Aktywa obrotowe 2024 | fsl-bs-current-assets | 11607 |
| RAZEM AKTYWA 2024 | fsl-bs-total-assets | 53892 |
| niż z tytułu wyceny instrumentów finansowych 2024 | fsl-bs-ar | 1778 |
| Kapitał własny akcjonariuszy Jednostki Dominującej 2024 | fsl-bs-equity-parent | 30990 |
| Kapitał własny 2024 | fsl-bs-equity | 31058 |
| Zobowiązania długoterminowe 2024 | fsl-bs-long-term-debt | 11828 |
| Zobowiązania krótkoterminowe 2024 | fsl-bs-current-liabilities | 11006 |

| Unmapped labels | Value |
| --- | ---: |
| AKTYWA Rzeczowe aktywa trwałe górnicze i hutnicze 2024 | 24050 |
| Instrumenty finansowe razem 2024 | 1726 |
| Kapitał własny udziałowców niekontrolujących 2024 | 68 |
| Zobowiązanie długo i krótkoterminowe 2024 | 22834 |
| RAZEM ZOBOWIĄZANIA I KAPITAŁ WŁASNY 2024 | 53892 |

### P&L

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 14
- Mapped lines: 12
- Coverage: 86%
- Readiness: `recoverable` (37)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Część 2024 | fsl-pl-oci-hedge | 1 |
| Zysk/(strata) netto ze sprzedaży 2024 | fsl-pl-gross | 3767 |
| pozostałe odsetki obliczone z zastosowaniem metody efektywnej stopy procentowej 2024 | fsl-pl-interest-lease | 63 |
| straty z tytułu utraty wartości instrumentów finansowych ( 2024 | fsl-pl-impairment-receivables | 1 |
| Zysk/(strata) przed opodatkowaniem 2024 | fsl-pl-ebt | 4608 |
| ZYSK/(STRATA) NETTO 2024 | fsl-pl-net | 2870 |
| Zysk/(strata) netto przypadający: akcjonariuszom Jednostki Dominującej 2024 | fsl-pl-net-parent | 2868 |
| Zysk/(strata) na akcję podstawowy i rozwodniony (w PLN) 2024 | fsl-pl-eps-basic | 14.34 |
| Różnice kursowe z przeliczenia sprawozdań jednostek o walucie funkcjonalnej innej niż PLN 2024 | fsl-pl-oci-fx | 15 |
| Zyski/(straty) aktuarialne, po uwzględnieniu efektu podatkowego 2024 | fsl-pl-oci-actuarial | 271 |
| Pozostałe całkowite dochody, które nie zostaną przeklasyfikowane do wyniku 2024 | fsl-pl-oci-non-reclassifiable | 286 |
| ŁĄCZNE CAŁKOWITE DOCHODY 2024 | fsl-pl-comprehensive-income | 2726 |

| Unmapped labels | Value |
| --- | ---: |
| na udziały niekontrolujące 2024 | 2 |
| Łączne całkowite dochody przypadające: akcjonariuszom Jednostki Dominującej 2024 | 2725 |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 48
- Mapped lines: 20
- Coverage: 42%
- Readiness: `recoverable` (48)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| i wartości niematerialnych 2024 | fsl-cf-operating-depreciation | 312 |
| Straty ze zbycia rzeczowych aktywów trwałych i wartości niematerialnych 2024 | fsl-cf-operating-gain-disposal | 25 |
| Zmiana stanu pozostałych należności i zobowiązań innych niż kapitał obrotowy 2024 | fsl-cf-change-wc-other | 163 |
| Pozostałe korekty ( 2024 | fsl-cf-operating-other-adj | 33 |
| Podatek dochodowy, z tego: ( 2024 | fsl-cf-taxes-paid | 413 |
| wpływy z tytułu zwrotu podatku dochodowego 2024 | fsl-cf-debt-drawdown | 614 |
| zmiana stanu zobowiązań handlowych objętych mechanizmami faktoringu odwrotnego 2024 | fsl-cf-change-wc-ap | -1007 |
| Przepływy pieniężne netto z działalności operacyjnej 2024 | fsl-cf-operating | 4690 |
| Wydatki na pozostałe rzeczowe aktywa trwałe i wartości niematerialne ( 2024 | fsl-cf-capex-intangibles | 679 |
| Wydatki na nabycie jednostek zależnych ( 2024 | fsl-cf-capex | 63 |
| Wpływy z tytułu spłaty pożyczek udzielonych wspólnemu przedsięwzięciu (kapitał) 2024 | fsl-cf-debt-repayment | 346 |
| Wpływy ze zbycia rzeczowych aktywów trwałych i wartości niematerialnych 2024 | fsl-cf-investing-disposal-proceeds | 46 |
| Przepływy pieniężne netto z działalności inwestycyjnej 2024 | fsl-cf-investing | -5506 |
| Spłata odsetek, z tego: ( 2024 | fsl-cf-operating-interest-cost | 202 |
| Wydatki z tytułu dywidend wypłaconych akcjonariuszom Jednostki Dominującej ( 2024 | fsl-cf-operating-dividend-income | 300 |
| Przepływy pieniężne netto z działalności finansowej ( 2024 | fsl-cf-financing | 217 |
| Różnice kursowe 2024 | fsl-cf-operating-fv-derivatives | 19 |
| Stan środków pieniężnych i ich ekwiwalentów na początek okresu 2024 | fsl-cf-opening-cash | 1729 |
| Stan środków pieniężnych i ich ekwiwalentów na koniec okresu, w tym: 2024 | fsl-cf-closing-cash | 715 |
| środki pieniężne o ograniczonej możliwości dysponowania 2024 | fsl-cf-change-wc-restricted-cash | 24 |

| Unmapped labels | Value |
| --- | ---: |
| Przepływy pieniężne z działalności operacyjnej Zysk/(strata) przed opodatkowaniem 2024 | 4608 |
| Pozostałe odsetki 2024 | 183 |
| Zysk z tytułu odwrócenia utraty wartości rzeczowych aktywów trwałych i wartości niematerialnych ( 2024 | 74 |
| wspólnemu przedsięwzięciu ( 2024 | 226 |
| z działalności inwestycyjnej i wyceny środków pieniężnych ( 2024 | 495 |
| z działalności finansowej 2024 | 84 |
| Razem wyłączenia przychodów i kosztów 2024 | 1370 |
| wydatki z tytułu zapłaty podatku dochodowego 2024 | -1027 |
| Wydatki na aktywa finansowe przeznaczone na likwidację kopalń i innych obiektów technologicznych ( 2024 | 45 |
| Udzielone zaliczki na rzeczowe aktywa trwałe i wartości niematerialne ( 2024 | 31 |
| Pozostałe ( 2024 | 22 |
| Wpływy z tytułu instrumentów pochodnych związanych ze źródłami finansowania zewnętrznego 2024 | 64 |
| Wydatki z tytułu instrumentów pochodnych związanych ze źródłami finansowania zewnętrznego ( 2024 | 75 |
| od zobowiązań handlowych objętych mechanizmami faktoringu odwrotnego ( 2024 | 164 |
| Pozostałe 2024 | 7 |
| AKTYWA Rzeczowe aktywa trwałe górnicze i hutnicze 2024 | 24050 |
| Aktywa niematerialne górnicze i hutnicze 2024 | 2830 |
| Pozostałe rzeczowe aktywa trwałe 2024 | 3087 |
| Instrumenty finansowe razem 2024 | 1726 |
| RAZEM AKTYWA 2024 | 53892 |
| niż z tytułu wyceny instrumentów finansowych 2024 | 1778 |
| Kapitał własny akcjonariuszy Jednostki Dominującej 2024 | 30990 |
| Kapitał własny udziałowców niekontrolujących 2024 | 68 |
| Kapitał własny 2024 | 31058 |
| Zobowiązania długoterminowe 2024 | 11828 |
| Zobowiązania krótkoterminowe 2024 | 11006 |
| Zobowiązanie długo i krótkoterminowe 2024 | 22834 |
| RAZEM ZOBOWIĄZANIA I KAPITAŁ WŁASNY 2024 | 53892 |

## bp Annual Report 2025

- File: `knowledge/Finanse/Samples/bp-annual-report-and-form-20f-2025.pdf`
- Detected type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Currency / scaling: `EUR` / `thousands`
- Extracted text length: 1715848

### BS

- Selected period: `2025`
- Comparison period: `2024`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 37
- Mapped lines: 14
- Coverage: 38%
- Readiness: `recoverable` (33)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `BS_EQUATION_INCOMPLETE`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| The joint venture that is material to the group at 2025 | fsl-bs-equity-parent | 50 |
| Sales and other operating revenues 2025 | fsl-bs-ar-trade | 4.426 |
| Other comprehensive income — — — Total comprehensive income 2025 | fsl-bs-other-equity-reserves | 812 |
| Non-current assets 2025 | fsl-bs-fixed | 22.564 |
| Total assets 2025 | fsl-bs-total-assets | 26.574 |
| Total liabilities 2025 | fsl-bs-total-liabilities | 16.414 |
| b Azule Energy includes cash and cash equivalents of $ 2025 | fsl-bs-cash | 596 |
| Non-controlling interest — — — 2025 | fsl-bs-minority-interest | 1 |
| Current assets 2025 | fsl-bs-current-assets | 2.005 |
| Current liabilities 2025 | fsl-bs-current-liabilities | 2.528 |
| Non-current liabilities 2025 | fsl-bs-long-term-debt | 5.679 |
| Group investment in joint ventures Group share of net assets (as above) 2025 | fsl-bs-rou-assets | 5.08 |
| LNG, crude oil and oil products, natural gas, refinery operating costs, plant processing fees 2025 | fsl-bs-ppe | 2.23 |
| charge and 2025 | fsl-bs-ar | 133 |

| Unmapped labels | Value |
| --- | ---: |
| Azule Energy 2025 | 406504 |
| Profit (loss) before interest and taxation 2025 | 1.266 |
| Finance costs 2025 | 304512 |
| Profit (loss) before taxationa 2025 | 962 |
| Taxation 2025 | 150376 |
| Profit (loss) for the year 2025 | 812 |
| Current assetsb 2025 | 4.01 |
| Current liabilitiesc 2025 | 5.056 |
| Non-current liabilitiesd 2025 | 11.358 |
| Net assets 2025 | 10.16 |
| Less: non-controlling interests — 2025 | 10.16 |
| a Azule Energy includes depreciation and amortisation of $ 2025 | 2.729 |
| c Azule Energy includes current financial liabilities of $ 2025 | 4.635 |
| d Azule Energy includes non-current financial liabilities of $ 2025 | 5.827 |
| Profit (loss) before taxation 2025 | 481 |
| Other comprehensive income — — — 2025 | -3 |
| Total comprehensive income 2025 | 406 |
| Less: non-controlling interests 2025 | -90 |
| Cumulative impairment charge 2025 | -3.066 |
| Loans made by group companies to joint ventures 2025 | -4 |
| LNG, crude oil and oil products, natural gas 2025 | 2.47 |
| bp's share of net impairment charges recognized by joint ventures in 2025 | 1.111 |
| group's US offshore wind investments. 2025 | 200 |

### P&L

- Selected period: `2023`
- Comparison period: `2025`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 77
- Mapped lines: 20
- Coverage: 26%
- Readiness: `recoverable` (7)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Total sales and other operating revenues 2023 | fsl-pl-revenue | 189.335 |
| Interest and other income Interest income from Financial assets measured at amortized cost 2023 | fsl-pl-interest | 1.203 |
| Other incomea 2023 | fsl-pl-other-income | 277 |
| Expenditure on research and development 2023 | fsl-pl-other-opex | 274301 |
| Costs relating to the Gulf of America oil spill (pre-interest and tax)c 2023 | fsl-pl-depreciation-ppe | 31 |
| Finance costs Interest expense on lease liabilities 2023 | fsl-pl-fin-expense | 704468 |
| Capitalized at 4.69% 2023 | fsl-pl-depreciation | -142 |
| Other exploration costs 2023 | fsl-pl-cogs-other | 227207 |
| Intangible assets – exploration and appraisal expenditurea 2023 | fsl-pl-depreciation-intangibles | 3.963 |
| Current tax Charge for the yeara 2023 | fsl-pl-tax-current | 6.501 |
| Adjustment in respect of prior yearsc 2023 | fsl-pl-cbn-inventory-change | 675 |
| Tax charge on profit 2023 | fsl-pl-ebt | 6.451 |
| mainly relates to transactions involving non-controlling interests. 2023 | fsl-pl-net-minority | 190 |
| Tax rate computed at the weighted average statutory ratea 2023 | fsl-pl-shares-outstanding | 55 |
| Increase (decrease) resulting from Tax reported in equity-accounted entities 2023 | fsl-pl-equity-method-income | -5 |
| Deferred tax not recognized 2023 | fsl-pl-tax-deferred | 5 |
| Items not deductible for tax purposesb 2023 | fsl-pl-oci-non-reclassifiable | 11 |
| Charge (credit) for the year in the income statement 2023 | fsl-pl-tax | 138 |
| Pension plan and other post-employment benefit plan deficits 2023 | fsl-pl-cbn-social-security | 48 |
| Dividends announced and paid in cash Preference shares 2023 | fsl-pl-fin-income | 1 |

| Unmapped labels | Value |
| --- | ---: |
| Other income statement items Production and similar taxes 2023 | 136 |
| Non-current assets Non-current assetsb c 2023 | 64.238 |
| Crude oil 2023 | 2.063 |
| Oil products 2023 | 114.207 |
| Natural gas, LNG and NGLs 2023 | 27.477 |
| Non-oil products and other revenues from contracts with customers 2023 | 15.132 |
| Revenue from contracts with customers 2023 | 158.879 |
| Other operating revenuesa 2023 | 30.456 |
| Financial assets measured at fair value through profit or loss 2023 | 129181 |
| Interest expense on other liabilities measured at amortized costd 2023 | 3.419 |
| Unwinding of discount on provisions 2023 | 675617 |
| Unwinding of discount on other payables measured at amortized cost 2023 | 472393 |
| e Tax relief on capitalized interest is approximately $ 2023 | 130 |
| Exploration and evaluation costs Exploration expenditure written off 2023 | 343767 |
| Exploration expense for the year 2023 | 570974 |
| Impairment losses 2023 | 26 |
| Liabilities 2023 | 33 |
| Net assets 2023 | 3.93 |
| Cash used in operating activities 2023 | 227207 |
| Cash used in investing activities 2023 | 1.169 |
| a Amount capitalized at 2023 | 536 |
| the Middle East and North Africa region 2023 | 1.182 |
| Deferred tax Origination and reversal of temporary differences in the current yearb 2023 | -537 |
| Germany. 2023 | 96 |
| to price assumptions and profit forecasts 2023 | 263 |
| liability or asset. In 2023 | 658 |
| for further information. The total tax credit recognized directly in equity was $ 2023 | 56 |
| Profit (loss) before taxation 2023 | 7.746 |
| Tax charge (credit) on profit or loss 2023 | 6.451 |
| Effective tax rate 2023 | 83 |
| Adjustments in respect of prior years 2023 | 6 |
| Foreign exchange 2023 | -4 |
| Tax rate change effect of UK Energy Profits Levyc 2023 | 7 |
| Otherd 2023 | 5 |
| Exchange adjustments 2023 | -63 |
| Deferred tax liability Depreciation 2023 | -897 |
| Pension plan surpluses 2023 | -3 |
| Derivative financial instruments 2023 | 37 |
| Other taxable temporary differencesa 2023 | 37 |
| Deferred tax asset Depreciation 2023 | 993 |
| Lease liabilities 2023 | -395 |
| Tax credits 2023 | -111 |
| Loss carry forward 2023 | 580194 |
| Other deductible temporary differencesb 2023 | 211 |
| Net deferred tax charge (credit) and net deferred tax liability 2023 | 138 |
| Of which – deferred tax liabilities 2023 | 7.642 |
| Of the $ 2023 | 4.325 |
| Germany, $ 2023 | 473 |
| Taxable temporary differences associated with investments in subsidiaries and equity-accounted entities 2023 | 0.7 |
| these tax credits expire in the period 2023 | -2035 |
| Current tax benefit relating to the utilization of previously unrecognized deferred tax assets 2023 | 101 |
| Deferred tax benefit relating to the recognition of previously unrecognized deferred tax assets 2023 | 156280 |
| The quarterly dividend which is expected to be paid on 2023 | 27 |
| Ordinary shares March 2023 | 6.1761 |
| June 2023 | 5.8993 |
| September 2023 | 6.1942 |
| December 2023 | 6.2394 |

### CF

- Selected period: `2025`
- Comparison period: `2024`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 107
- Mapped lines: 26
- Coverage: 24%
- Readiness: `recoverable` (42)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Cash flow hedges reclassified to the income statement 2025 | fsl-cf-operating-net-income | 30 |
| Dividendsb — — — 2025 | fsl-cf-dividends | -5.087 |
| Intangible assets 2025 | fsl-cf-capex-intangibles | 15 |
| Prepayments 2025 | fsl-cf-change-wc-prepaids | 3.422 |
| Lease liabilities 2025 | fsl-cf-debt-drawdown-lease | 28 |
| Provisions 2025 | fsl-cf-change-wc-provisions | 23 |
| Equity bp shareholders’ equity 2025 | fsl-cf-operating-equity-method | 32 |
| Depreciation, depletion and amortization 2025 | fsl-cf-operating-depreciation | 5 |
| Impairment and (gain) loss on sale of businesses and fixed assets 2025 | fsl-cf-operating-gain-disposal | 4 |
| Dividends received from joint ventures and associates 2025 | fsl-cf-dividends-received | 2.111 |
| Interest paid 2025 | fsl-cf-interest-paid | -3.538 |
| Income taxes paid 2025 | fsl-cf-taxes-paid | -6.589 |
| Net cash provided by operating activities 2025 | fsl-cf-operating | 24.493 |
| Investment in associates 2025 | fsl-cf-investing-subsidiaries | -110 |
| Proceeds from disposals of fixed assets 2025 | fsl-cf-operating-depreciation-intangibles | 4 |
| Proceeds from disposals of businesses, net of cash disposed 2025 | fsl-cf-capex | 4 |
| Proceeds from loan repayments 2025 | fsl-cf-debt-drawdown-bank | 173 |
| Net cash used in investing activities 2025 | fsl-cf-investing | -11.504 |
| Lease liability payments 2025 | fsl-cf-debt-repayment-lease | -3.091 |
| Proceeds from long-term financing 2025 | fsl-cf-debt-drawdown | 2.724 |
| Repayments of long-term financing 2025 | fsl-cf-debt-repayment | -5.695 |
| Receipts relating to transactions involving non-controlling interests (other) 2025 | fsl-cf-other-receipts | 2.474 |
| Net cash provided by (used in) financing activities 2025 | fsl-cf-financing | -15.88 |
| Increase (decrease) in cash and cash equivalents 2025 | fsl-cf-net-change-cash | -2.645 |
| Cash and cash equivalents at beginning of year 2025 | fsl-cf-opening-cash | 39.269 |
| Cash and cash equivalents at end of yeara 2025 | fsl-cf-closing-cash | 36.624 |

| Unmapped labels | Value |
| --- | ---: |
| Items that may be reclassified subsequently to profit or loss Currency translation differencesa 2025 | 1.863 |
| Cash flow hedges marked to market 2025 | 30287 |
| Costs of hedging marked to market 2025 | 30 |
| Costs of hedging reclassified to the income statement 2025 | 30 |
| Share of items relating to equity-accounted entities, net of tax 2025 | 16 |
| Income tax relating to items that may be reclassified 2025 | 9 |
| Remeasurements of equity investments 2025 | -6 |
| Cash flow hedges that will subsequently be transferred to the balance sheet 2025 | 30 |
| Income tax relating to items that will not be reclassifieda 2025 | 9 |
| Other comprehensive income 2025 | 1.932 |
| Total comprehensive income 2025 | 3.227 |
| Attributable to bp shareholders 2025 | 1.872 |
| Non-controlling interests 2025 | 1.355 |
| shareholders' equity Non-controlling interests Total equity Hybrid bonds Other interest At 2025 | 48.229 |
| Profit for the year — — — 2025 | 55 |
| Other comprehensive income — 2025 | 1.804 |
| Total comprehensive income — 2025 | 1.804 |
| Cash flow hedges transferred to the balance sheet, net of tax — — 2025 | -6 |
| Repurchase of ordinary share capital 2025 | -3.558 |
| Share-based payments, net of tax 2025 | 35 |
| Share of equity-accounted entities’ changes in equity, net of tax — — — 2025 | 1 |
| Issue of perpetual hybrid bonds — — — — — 2025 | 500 |
| Redemption of perpetual hybrid bonds, net of tax — — — — — 2025 | -1.2 |
| Payments on perpetual hybrid bonds — 2025 | -9 |
| Transactions involving non-controlling interests, net of tax — — — 2025 | -65 |
| Repurchase of ordinary share capital — — — 2025 | -7.302 |
| Issue of perpetual hybrid bonds — — — 2025 | -22 |
| Redemption of perpetual hybrid bonds, net of tax — — — 2025 | 9 |
| Payments on perpetual hybrid bonds — — — — — 2025 | -610 |
| Non-current assets Property, plant and equipment 2025 | 12 |
| Goodwill 2025 | 14 |
| Investments in joint ventures 2025 | 16 |
| Investments in associates 2025 | 17 |
| Other investments 2025 | 18857 |
| Fixed assets 2025 | 138.712 |
| Loans 2025 | 1.991 |
| Trade and other receivables 2025 | 20 |
| Derivative financial instruments 2025 | 30 |
| Deferred tax assets 2025 | 9 |
| Defined benefit pension plan surpluses 2025 | 24 |
| Inventories 2025 | 19 |
| Current tax receivable 2025 | 1.153 |
| Cash and cash equivalents 2025 | 25 |
| Assets classified as held for sale 2025 | 2 |
| Total assets 2025 | 278.526 |
| Current liabilities Trade and other payables 2025 | 22 |
| Accruals 2025 | 5.572 |
| Finance debt 2025 | 26 |
| Current tax payable 2025 | 1.262 |
| Liabilities directly associated with assets classified as held for sale 2025 | 2 |
| Non-current liabilities Other payables 2025 | 22 |
| Deferred tax liabilities 2025 | 9 |
| Defined benefit pension plan and other post-employment benefit plan deficits 2025 | 24 |
| Total liabilities 2025 | 204.526 |
| Net assets 2025 | 74 |
| Total equity 2025 | 32 |
| Albert Manifold Chair Carol Howle Interim Chief executive officer 2025 | 6 |
| Operating activities Profit (loss) before taxation 2025 | 7.746 |
| Earnings from joint ventures and associates 2025 | -618 |
| Remeasurement of joint ventures 2025 | 3 |
| Interest receivable 2025 | -1.352 |
| Interest received 2025 | 1.223 |
| Finance costs 2025 | 7 |
| Net finance expense relating to pensions and other post-employment benefits 2025 | 24 |
| Share-based payments 2025 | 1.077 |
| Net charge for provisions, less payments 2025 | 1.294 |
| (Increase) decrease in inventories 2025 | 1.622 |
| (Increase) decrease in other current and non-current assets 2025 | -4.286 |
| Increase (decrease) in other current and non-current liabilities 2025 | -2.156 |
| Investing activities Expenditure on property, plant and equipment, intangible and other assets 2025 | -13.221 |
| Acquisitions, net of cash acquired 2025 | 3 |
| Investment in joint ventures 2025 | -267 |
| Total cash capital expenditure 2025 | -14.533 |
| Financing activities Repurchase of shares 2025 | -4.486 |
| Net increase (decrease) in short-term debt 2025 | -343 |
| Issue of perpetual hybrid bonds 2025 | 500 |
| Redemption of perpetual hybrid bonds 2025 | 32 |
| Payments relating to perpetual hybrid bonds 2025 | -1.196 |
| Payments relating to transactions involving non-controlling interests (other) 2025 | -2 |
| Dividends paid bp shareholders 2025 | 10 |
| Currency translation differences relating to cash and cash equivalents 2025 | 246 |

## Coca-Cola 10-K 2025

- File: `knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf`
- Detected type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Currency / scaling: `EUR` / `millions`
- Extracted text length: 608897

### BS

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 58
- Mapped lines: 24
- Coverage: 41%
- Readiness: `recoverable` (22)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`, `VALIDATION_HARD_FAIL`
- Validation blockers: `BS_EQUATION_MISMATCH`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Other Comprehensive Income: Net foreign currency translation adjustments 2024 | fsl-bs-fx-reserve | -2.893 |
| Net change in unrealized gains (losses) on available-for-sale debt securities 2024 | fsl-bs-assets-held-for-sale | -63 |
| ASSETS Current Assets Cash and cash equivalents $ 2024 | fsl-bs-cash | 10.828 |
| Short-term investments 2024 | fsl-bs-short-term-debt | 2.02 |
| Trade accounts receivable, less allowances of $ 2024 | fsl-bs-ar | 506 |
| Inventories 2024 | fsl-bs-inventory | 4.728 |
| Total Current Assets 2024 | fsl-bs-current-assets | 25.997 |
| Equity method investments 2024 | fsl-bs-equity-method-investments | 18.087 |
| Deferred income tax assets 2024 | fsl-bs-other-non-current-assets-deferred-tax | 1.319 |
| Property, plant and equipment — net 2024 | fsl-bs-ppe | 10.303 |
| Goodwill 2024 | fsl-bs-intangibles-goodwill | 18.139 |
| Other noncurrent assets 2024 | fsl-bs-other-non-current-assets | 13.403 |
| Total Assets $ 2024 | fsl-bs-total-assets | 100.549 |
| LIABILITIES AND EQUITY Current Liabilities Accounts payable and accrued expenses $ 2024 | fsl-bs-other-current-liabilities-accruals | 21.715 |
| Loans and notes payable 2024 | fsl-bs-long-term-borrowings | 1.499 |
| Current maturities of long-term debt 2024 | fsl-bs-long-term-debt-lease | 648 |
| Total Current Liabilities 2024 | fsl-bs-current-liabilities | 25.249 |
| Long-term debt 2024 | fsl-bs-long-term-debt | 42.375 |
| Deferred income tax liabilities 2024 | fsl-bs-other-non-current-liabilities-deferred-tax | 2.469 |
| Capital surplus 2024 | fsl-bs-share-premium | 19.801 |
| Accumulated other comprehensive income (loss) 2024 | fsl-bs-other-equity-reserves | -16.843 |
| Equity attributable to noncontrolling interests 2024 | fsl-bs-equity-parent | 1.516 |
| Total Equity 2024 | fsl-bs-equity | 26.372 |
| Total Liabilities and Equity $ 2024 | fsl-bs-total-liabilities | 100.549 |

| Unmapped labels | Value |
| --- | ---: |
| Net Operating Revenues $ 2024 | 47.061 |
| Cost of goods sold 2024 | 18.324 |
| Gross Profit 2024 | 28.737 |
| Selling, general and administrative expenses 2024 | 14.582 |
| Other operating charges 2024 | 4.163 |
| Operating Income 2024 | 9.992 |
| Interest income 2024 | 988907 |
| Interest expense 2024 | 1.656 |
| Equity income (loss) — net 2024 | 1.77 |
| Other income (loss) — net 2024 | 1.992 |
| Income Before Income Taxes 2024 | 13.086 |
| Income taxes 2024 | 2.437 |
| Consolidated Net Income 2024 | 10.649 |
| Less: Net income (loss) attributable to noncontrolling interests 2024 | 18 |
| Net Income Attributable to Shareowners of The Coca-Cola Company $ 2024 | 10.631 |
| Average Shares Outstanding — Basic 2024 | 4.309 |
| Effect of dilutive securities 2024 | 11 |
| Average Shares Outstanding — Diluted 2024 | 4.32 |
| Consolidated Net Income $ 2024 | 10.649 |
| Net gains (losses) on derivatives 2024 | 270 |
| Net change in pension and other postretirement benefit liabilities 2024 | 109 |
| Total Comprehensive Income 2024 | 8.072 |
| Less: Comprehensive income (loss) attributable to noncontrolling interests 2024 | 9 |
| Total Comprehensive Income Attributable to Shareowners of The Coca-Cola Company $ 2024 | 8.063 |
| Total Cash, Cash Equivalents and Short-Term Investments 2024 | 12.848 |
| Marketable securities 2024 | 1.723 |
| Prepaid expenses and other current assets 2024 | 3.129 |
| Trademarks with indefinite lives 2024 | 13.301 |
| Accrued income taxes 2024 | 1.387 |
| Other noncurrent liabilities 2024 | 4.084 |
| The Coca-Cola Company Shareowners’ Equity Common stock, $ 2024 | 0.25 |
| Reinvested earnings 2024 | 76.054 |
| Treasury stock, at cost 2024 | 2.738 |
| Equity Attributable to Shareowners of The Coca-Cola Company 2024 | 24.856 |

### P&L

- Selected period: `2023`
- Comparison period: `2025`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 13
- Mapped lines: 3
- Coverage: 23%
- Readiness: `recoverable` (0)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| statements and whether we will apply the standard prospectively or retrospectively. In November 2023 | fsl-pl-cbn-inventory-change | 2024 |
| will be applied prospectively. The Company is currently evaluating the impact that ASU 2023 | fsl-pl-oci-non-reclassifiable | -3 |
| Acquisitions Our Company’s acquisitions of businesses, equity method investments and nonmarketable securities totaled $ 2023 | fsl-pl-equity-method-income | 315 |

| Unmapped labels | Value |
| --- | ---: |
| In December 2023 | -9 |
| for our year ending December 2023 | -9 |
| (Subtopic 2023 | 220 |
| annual disclosures are effective for our year ending December 2023 | 31 |
| during 2023 | 2022 |
| information on these investments. Divestitures During 2023 | 2024 |
| investee, for which we received cash proceeds of $ 2023 | 302 |
| received cash proceeds of $ 2023 | 123 |
| December 2023 | 31 |
| which we received net cash proceeds of $ 2023 | 1.652 |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 39
- Mapped lines: 8
- Coverage: 21%
- Readiness: `recoverable` (21)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Total $ 2024 | fsl-cf-operating-adjustments | 428 |
| Current maturities of long-term debt $ — $ 2024 | fsl-cf-debt-repayment | 552 |
| Long-term debt 2024 | fsl-cf-debt-drawdown | 11.824 |
| The Company reclassified a gain of $ 2024 | fsl-cf-operating-gain-disposal | 3 |
| Foreign currency contracts Net operating revenues $ 2024 | fsl-cf-operating | 211 |
| Net operating revenues $ 2024 | fsl-cf-operating-net-income | 99.043 |
| Operating income $ 2024 | fsl-cf-operating-dividend-income | 12.536 |
| Company equity method investments $ 2024 | fsl-cf-operating-equity-method | 18.087 |

| Unmapped labels | Value |
| --- | ---: |
| were $ 2024 | 2023 |
| foreign currency denominated assets and liabilities were $ 2024 | 2023 |
| December 2024 | 2023 |
| Company’s interest rate cash flow hedging program was $ 2024 | 750 |
| Foreign currency contracts $ 2024 | 457 |
| Foreign currency contracts 2024 | 37 |
| Interest rate contracts 2024 | -54 |
| Commodity contracts 2024 | 6 |
| As of December 2024 | 31 |
| (in millions): Notional Values Gain (Loss) Recognized in OCI as of December 2024 | 31 |
| Foreign currency denominated debt 2024 | 13.221 |
| economic hedges were $ 2024 | 2023 |
| Foreign currency contracts Cost of goods sold 2024 | -44 |
| Foreign currency contracts Other income (loss) — net 2024 | -107 |
| Commodity contracts Cost of goods sold 2024 | -97 |
| Other derivative instruments Selling, general and administrative expenses 2024 | 17 |
| Cost of goods sold 2024 | 58.527 |
| Gross profit $ 2024 | 40.516 |
| Consolidated net income $ 2024 | 8.439 |
| Less: Net income attributable to noncontrolling interests 2024 | 98 |
| Net income attributable to common shareowners $ 2024 | 8.341 |
| Company equity income (loss) — net $ 2024 | 1.77 |
| Current assets $ 2024 | 33.72 |
| Noncurrent assets 2024 | 72.039 |
| Total assets $ 2024 | 105.759 |
| Current liabilities $ 2024 | 26.959 |
| Noncurrent liabilities 2024 | 33.004 |
| Total liabilities $ 2024 | 59.963 |
| Equity attributable to shareowners of investees $ 2024 | 44.295 |
| Equity attributable to noncontrolling interests 2024 | 1.501 |
| Total equity $ 2024 | 45.796 |

## Tesla 10-K 2024

- File: `knowledge/Finanse/Samples/tsla-20241231-gen.pdf`
- Detected type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Currency / scaling: `EUR` / `millions`
- Extracted text length: 479664

### BS

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 69
- Mapped lines: 23
- Coverage: 33%
- Readiness: `recoverable` (36)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Assets Current assets Cash and cash equivalents $ 2024 | fsl-bs-cash | 16.139 |
| Short-term investments 2024 | fsl-bs-short-term-debt | 20.424 |
| Accounts receivable, net 2024 | fsl-bs-ar | 4.418 |
| Inventory 2024 | fsl-bs-inventory | 12.017 |
| Total current assets 2024 | fsl-bs-current-assets | 58.36 |
| Operating lease vehicles, net 2024 | fsl-bs-ppe-vehicles | 5.581 |
| Property, plant and equipment, net 2024 | fsl-bs-ppe | 35.836 |
| Operating lease right-of-use assets 2024 | fsl-bs-rou-assets | 5.16 |
| Deferred tax assets 2024 | fsl-bs-other-non-current-assets-deferred-tax | 6.524 |
| Other non-current assets 2024 | fsl-bs-other-non-current-assets | 4.215 |
| Total assets $ 2024 | fsl-bs-total-assets | 122.07 |
| Accrued liabilities and other 2024 | fsl-bs-total-liabilities-equity | 10.723 |
| Total current liabilities 2024 | fsl-bs-current-liabilities | 28.821 |
| Other long-term liabilities 2024 | fsl-bs-long-term-debt | 10.495 |
| Total liabilities 2024 | fsl-bs-total-liabilities | 48.39 |
| Common stock; $ 2024 | fsl-bs-share-capital | 0.001 |
| Additional paid-in capital 2024 | fsl-bs-share-premium | 38.371 |
| Retained earnings 2024 | fsl-bs-retained-earnings | 35.209 |
| Total stockholders’ equity 2024 | fsl-bs-equity | 72.913 |
| Services and other 2024 | fsl-bs-ar-trade | 10.534 |
| Net income (loss) attributable to noncontrolling interests and redeemable noncontrolling interests in subsidiaries 2024 | fsl-bs-minority-interest | 62 |
| Net income attributable to common stockholders $ 2024 | fsl-bs-equity-parent | 7.091 |
| Other comprehensive income — — — 2024 | fsl-bs-other-equity-reserves | 218 |

| Unmapped labels | Value |
| --- | ---: |
| Prepaid expenses and other current assets 2024 | 5.362 |
| Solar energy systems, net 2024 | 4.924 |
| Digital assets, net 2024 | 1.076 |
| Liabilities Current liabilities Accounts payable $ 2024 | 12.474 |
| Deferred revenue 2024 | 3.168 |
| Current portion of debt and finance leases 2024 | 2.456 |
| Debt and finance leases, net of current portion 2024 | 5.757 |
| Deferred revenue, net of current portion 2024 | 3.317 |
| Equity Stockholders’ equity Preferred stock; $ 2024 | 0.001 |
| December 2024 | 31 |
| Total liabilities and equity $ 2024 | 122.07 |
| Revenues Automotive sales $ 2024 | 72.48 |
| Automotive regulatory credits 2024 | 2.763 |
| Automotive leasing 2024 | 1.827 |
| Total automotive revenues 2024 | 77.07 |
| Energy generation and storage 2024 | 10.086 |
| Total revenues 2024 | 97.69 |
| Cost of revenues Automotive sales 2024 | 61.87 |
| Total automotive cost of revenues 2024 | 62.873 |
| Total cost of revenues 2024 | 80.24 |
| Gross profit 2024 | 17.45 |
| Operating expenses Research and development 2024 | 4.54 |
| Selling, general and administrative 2024 | 5.15 |
| Restructuring and other 2024 | 684 |
| Total operating expenses 2024 | 10.374 |
| Income from operations 2024 | 7.076 |
| Interest income 2024 | 1.569 |
| Interest expense 2024 | -350 |
| Other income (expense), net 2024 | 695172 |
| Income before income taxes 2024 | 8.99 |
| Provision for (benefit from) income taxes 2024 | 1.837 |
| Net income 2024 | 7.153 |
| Weighted average shares used in computing net income per share of common stock Basic 2024 | 3.197 |
| Diluted 2024 | 3.498 |
| Net income $ 2024 | 7.153 |
| Unrealized net gain (loss) on investments, net of tax 2024 | 12 |
| Comprehensive income 2024 | 6.626 |
| Less: Comprehensive income (loss) attributable to noncontrolling interests and redeemable noncontrolling interests in subsidiaries 2024 | 62 |
| Comprehensive income attributable to common stockholders $ 2024 | 6.564 |
| Stock-based compensation — — 2024 | 1.806 |
| Distributions to noncontrolling interests 2024 | -46 |
| Buy-outs of noncontrolling interests 2024 | -11 |
| Net (loss) income 2024 | -102 |
| Other comprehensive loss — — — 2024 | -415 |
| Adjustments for prior periods from adopting ASU 2024 | -8 |
| net of tax — — — — 2024 | 236236 |

### P&L

- Selected period: `2024`
- Comparison period: `n/a`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 56
- Mapped lines: 15
- Coverage: 27%
- Readiness: `recoverable` (2)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Assets Digital assets, net $ 2024 | fsl-pl-depreciation-intangibles | 184 |
| Deferred tax assets 2024 | fsl-pl-tax-deferred | 6.733 |
| Other 2024 | fsl-pl-other-fin | 1 |
| Other income (expense), net Before adoption $ 2024 | fsl-pl-other-income | 108 |
| Provision for (benefit from) income taxes Before adoption $ 2024 | fsl-pl-tax | 409 |
| Net income attributable to common stockholders Before adoption $ 2024 | fsl-pl-net | 1.129 |
| There were no accumulated impairment losses as of December 2024 | fsl-pl-impairment-receivables | 2023 |
| Corporate debt securities 2024 | fsl-pl-ebt | 118 |
| Total $ 2024 | fsl-pl-oci-total | 23.253 |
| Certificates of deposit and time deposits 2024 | fsl-pl-depreciation-ppe | 12.767 |
| Total cash, cash equivalents and short-term investments $ 2024 | fsl-pl-fin-income | 36.549 |
| Raw materials $ 2024 | fsl-pl-cogs-materials-raw | 5.242 |
| Finished goods 2024 | fsl-pl-cbn-inventory-change | -1 |
| Computer equipment, hardware and software 2024 | fsl-pl-gna-it | 2.902 |
| Less: Accumulated depreciation 2024 | fsl-pl-depreciation | -15.588 |

| Unmapped labels | Value |
| --- | ---: |
| expenses. The ASU is effective for annual periods beginning after December 2024 | 15 |
| the provisions of this ASU. Recently adopted accounting pronouncements In November 2024 | 2023 |
| interim periods within fiscal years beginning after December 2024 | 15 |
| In December 2024 | 2023 |
| is effective for annual periods beginning after December 2024 | 15 |
| Adjustments from Adoption of the New Crypto Assets Standard Balances at January 2024 | 1 |
| Stockholders' equity Retained earnings 2024 | 27.882 |
| During the years ended December 2024 | 2023 |
| December 2024 | 31 |
| summarizes the amounts shown on our consolidated balance sheet as of December 2024 | 31 |
| Units Cost Basis Fair Value Digital assets held: Bitcoin 2024 | 11.509 |
| As of: Consolidated Balance Sheets (unaudited): March 2024 | 30 |
| Digital assets, net Before adoption $ 2024 | 184 |
| Adjustments 2024 | 638538 |
| As adjusted $ 2024 | 822 |
| Deferred tax assets Before adoption $ 2024 | 6.769 |
| Three Months Ended Condensed Consolidated Statements of Operations (unaudited): March 2024 | 30 |
| Net income per share of common stock attributable to common stockholders Basic Before adoption $ 2024 | 0.37 |
| Diluted Before adoption $ 2024 | 0.34 |
| The unaudited impact of adoption for the three months ended December 2024 | 347 |
| for (benefit from) income taxes, thus contributing $ 2024 | 270 |
| There were no impairment losses recorded for any period during the year ended December 2024 | 31 |
| Digital assets, net did not change throughout the year ended December 2024 | 31 |
| adopted as of January 2024 | 1 |
| Goodwill decreased $ 2024 | 9 |
| The net carrying value of our intangible assets decreased from $ 2024 | 178 |
| on a recurring basis were as follows (in millions): December 2024 | 31 |
| Commercial paper 2024 | 3.919 |
| U.S. government securities 2024 | 3.62 |
| Money market funds 2024 | 1.753 |
| Digital assets 2024 | 1.076 |
| As of December 2024 | 31 |
| Work in process 2024 | 1.532 |
| Service parts 2024 | 1.303 |
| value. During the years ended December 2024 | 31 |
| Machinery, equipment, vehicles and office furniture $ 2024 | 18.339 |
| Land and buildings 2024 | 10.677 |
| AI infrastructure 2024 | 5.152 |
| Tooling 2024 | 3.883 |
| Leasehold improvements 2024 | 3.688 |
| Construction in progress 2024 | 6.783 |

### CF

- Selected period: `2025`
- Comparison period: `n/a`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 26
- Mapped lines: 1
- Coverage: 4%
- Readiness: `recoverable` (4)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `CF_CORE_LINES_MISSING`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Cost of Revenues and Gross Margin Year Ended December 2025 | fsl-cf-capex | 31 |

| Unmapped labels | Value |
| --- | ---: |
| Automotive sales $ 2025 | 72.48 |
| Automotive regulatory credits 2025 | 2.763 |
| Automotive leasing 2025 | 1.827 |
| Total automotive revenues 2025 | 77.07 |
| Services and other 2025 | 10.534 |
| Total automotive & services and other segment revenue 2025 | 87.604 |
| Energy generation and storage segment revenue 2025 | 10.086 |
| Total revenues $ 2025 | 97.69 |
| Automotive sales revenue decreased $6.03 billion, or 2025 | 8 |
| well as mix. Additionally, there was a decrease of approximately 2025 | 22 |
| Automotive regulatory credits revenue increased $ 2025 | 973 |
| December 2025 | 31 |
| Automotive leasing revenue decreased $ 2025 | 293 |
| Energy generation and storage revenue increased $4.05 billion, or 2025 | 67 |
| Cost of revenues Automotive sales $ 2025 | 61.87 |
| Total automotive cost of revenues 2025 | 62.873 |
| Total automotive & services and other segment cost of revenues 2025 | 72.794 |
| Energy generation and storage segment 2025 | 7.446 |
| Total cost of revenues $ 2025 | 80.24 |
| Gross profit total automotive $ 2025 | 14.197 |
| Gross profit total automotive & services and other segment $ 2025 | 14.81 |
| Gross profit energy generation and storage segment $ 2025 | 2.64 |
| Total gross profit $ 2025 | 17.45 |
| Cost of automotive sales revenue decreased $3.25 billion, or 2025 | 5 |
| Cybertruck. Cost of automotive leasing revenue decreased $ 2025 | 265 |

## BDG 2026 V1 XLSX

- File: `knowledge/Finanse/BDG 2026 V1.xlsx`
- Detected type: `BS`
- Contained statement types: `BS`, `P&L`, `CF`
- Document class: `spreadsheet`
- Extraction strategy: `spreadsheet_structured`
- Currency / scaling: `PLN` / `millions`
- Extracted text length: 18307393

### BS

- Selected period: `2028`
- Comparison period: `2021`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 66
- Mapped lines: 27
- Coverage: 41%
- Readiness: `recoverable` (18)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `BS_EQUATION_INCOMPLETE`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| A. AKTYWA TRWAŁE A. FIXED ASSETS A. FIXED ASSETS 2028 | fsl-bs-other-non-current-assets | 0 |
| B. AKTYWA OBROTOWE B CURRENT ASSETS B CURRENT ASSETS 2028 | fsl-bs-fixed | 0 |
| a. Materiały a. Raw materials a. Raw materials 2028 | fsl-bs-inventory-raw | 0 |
| Produkty gotowe c. Finished products c. Finished products 2028 | fsl-bs-inventory-fg | 0 |
| Towary d. Goods d. Goods 2028 | fsl-bs-intangibles-goodwill | 0 |
| e. Zaliczki na poczet dostaw e. Advances for deliveries e. Advances for deliveries 2028 | fsl-bs-provisions | 0 |
| AKTYWA RAZEM TOTAL ASSETS TOTAL ASSETS 2028 | fsl-bs-total-assets | 0 |
| A. KAPITAŁ WŁASNY OGÓŁEM A. TOTAL SHAREHOLDERS' EQUITY A. TOTAL SHAREHOLDERS' EQUITY 2028 | fsl-bs-total-liabilities-equity | 0 |
| B. ZOBOWIĄZANIA DŁUGOTERMINOWE B. LONG-TERM LIABILITIES B. LONG-TERM LIABILITIES 2028 | fsl-bs-long-term-debt | 0 |
| b. Zobowiązania pożyczkowe b. Borrowings b. Borrowings 2028 | fsl-bs-long-term-borrowings | 0 |
| Wobec podmiotów powiązanych To related parties To related parties 2028 | fsl-bs-equity-parent | 0 |
| Wobec pozostałych podmiotów To other entities To other entities 2028 | fsl-bs-intangibles | 0 |
| Kredyty inwestycyjne Investment loans Investment loans 2028 | fsl-bs-investment-property | 0 |
| Kredyty obrotowe Working capital loans Working capital loans 2028 | fsl-bs-wc | 0 |
| Zobowiązania z tytułu leasingu c. Leasing c. Leasing 2028 | fsl-bs-long-term-debt-lease | 0 |
| Z tytułu dostaw i usług Trade liabilities Trade liabilities 2028 | fsl-bs-ar | 0 |
| Inne zobowiązania Booked liabilities (provisions - cost accruals) Booked liabilities (provisions - cost accruals) 2028 | fsl-bs-other-current-liabilities-accruals | 0 |
| Zaliczki otrzymane na dostawy Prepayments received for supplies Prepayments received for supplies 2028 | fsl-bs-contract-liabilities | 0 |
| pozostałe zobowiązania Other liabilities Other liabilities 2028 | fsl-bs-other-non-current-liabilities-deferred-tax | 0 |
| z tytułu wynagrodzeń Payroll Payroll 2028 | fsl-bs-other-non-current-assets-deferred-tax | 0 |
| b.Pozostałe rezerwy krótkoterminowe b. Other short-term provisions b. Other short-term provisions 2028 | fsl-bs-other-st-receivables | 0 |
| PASYWA LIABILITIES LIABILITIES 2028 | fsl-bs-total-liabilities | 0 |
| B. Koszty działalności operacyjnej B. Operating expenses B. Operating expenses 2028 | fsl-bs-other-current-assets-prepaids | 0 |
| Pozostałe przychody operacyjne D. Other operating income D. Other operating income 2028 | fsl-bs-other-equity-reserves | 0 |
| J. Przychody finansowe J. Przychody finansowe J. Przychody finansowe 2028 | fsl-bs-other-current-financial-assets | 0 |
| Inne V. Inne V. Inne 2028 | fsl-bs-other-current-assets | 0 |
| Odsetki, w tym: I. Odsetki, w tym: I. Odsetki, w tym: 2028 | fsl-bs-equity-method-investments | 0 |

| Unmapped labels | Value |
| --- | ---: |
| Bilans 2028 | 0 |
| Opis Description Description 2028 | 1 |
| Leasing c. Leasing c. Leasing 2028 | 0 |
| Pozostałe zobowiązania finansowe d. Other external financing sources d. Other external financing sources 2028 | 0 |
| a. Dotacje rządowe a. Government subsidies a. Government subsidies 2028 | 0 |
| b.Pozostałe zobowizania b. Other liabilities b. Other liabilities 2028 | 0 |
| ZOBOWIĄZANIA KRÓTKOTERMINOWE C. SHORT-TERM LIABILITIES C. SHORT-TERM LIABILITIES 2028 | 0 |
| Kredyty w rachunku bieżącym (overdrafty) Overdrafts Overdrafts 2028 | 0 |
| Factoring Factoring Factoring 2028 | 0 |
| a. Do jednostek powiązanych a.To related parties a.To related parties 2028 | 0 |
| b. Do pozostałych jednostek b.To other entities b.To other entities 2028 | 0 |
| Redukcja układowana/umowna Booked liabilities (provisions - cost accruals) Booked liabilities (provisions - cost accruals) 2028 | 0 |
| Dotacje rządowe c. Government subsidies c. Government subsidies 2028 | 0 |
| Fundusze specjalne d. Special funds d. Special funds 2028 | 0 |
| A. Przychody ze sprzedaży netto A. Net Sales A. Net Sales 2028 | 0 |
| E. Pozostałe koszty operacyjne E. Other operating expenses E. Other operating expenses 2028 | 0 |
| G. Przychody finansowe G. Financial income G. Financial income 2028 | 0 |
| H. Koszty finansowe H. Financial costs H. Financial costs 2028 | 0 |
| Podatek dochodowy L. CIT L. CIT 2028 | 0 |
| Wariant KALKULACYJNY: Opis Description Opis 2028 | 1687804 |
| Marketplace Marketplace a) Marketplace 2028 | 0 |
| Digital Twin (SAAS) Digital Twin (SAAS) b) Digital Twin (SAAS) 2028 | 0 |
| Big Data (MaaS) Big Data (MaaS) c) Big Data (MaaS) 2028 | 0 |
| DRD DRD d) DRD 2028 | 0 |
| Program Partnerski Program Partnerski e) Program Partnerski 2028 | 0 |
| D.SPRZED* D. Koszty sprzedaży D. Koszty sprzedaży D. Koszty sprzedaży 2028 | 0 |
| E.ZARZ* E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu 2028 | 0 |
| G. Pozostałe przychody operacyjne G. Pozostałe przychody operacyjne G. Pozostałe przychody operacyjne 2028 | 0 |
| Dotacje II. Dotacje II. Dotacje 2028 | 0 |
| Inne przychody operacyjne IV. Inne przychody operacyjne IV. Inne przychody operacyjne 2028 | 0 |
| H. Pozostałe koszty operacyjne H. Pozostałe koszty operacyjne H. Pozostałe koszty operacyjne 2028 | 0 |
| Aktualizacja wartości aktywów niefinansowych II. Aktualizacja wartości aktywów niefinansowych II. Aktualizacja wartości aktywów niefinansowych 2028 | 0 |
| Inne koszty operacyjne III. Inne koszty operacyjne III. Inne koszty operacyjne 2028 | 0 |
| Odsetki II. Odsetki II. Odsetki 2028 | 0 |
| Aktualizacja wartości aktywów finansowych IV. Aktualizacja wartości aktywów finansowych IV. Aktualizacja wartości aktywów finansowych 2028 | 0 |
| K. Koszty finansowe K. Koszty finansowe K. Koszty finansowe 2028 | 0 |
| Aktualizacja wartości aktywów finansowych III. Aktualizacja wartości aktywów finansowych III. Aktualizacja wartości aktywów finansowych 2028 | 0 |
| Inne IV. Inne IV. Inne 2028 | 0 |
| Podatek dochodowy M. Podatek dochodowy M. Podatek dochodowy 2028 | 0 |

### P&L

- Selected period: `2021`
- Comparison period: `n/a`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 109
- Mapped lines: 24
- Coverage: 22%
- Readiness: `recoverable` (16)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `PL_NON_POSITIVE_REVENUE`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Net revenues from the sale of products Przychody netto ze sprzedaży produktów 2021 | fsl-pl-revenue | 0 |
| a) Marketplace a) Marketplace 2021 | fsl-pl-opex | 0 |
| Change in the balance of products Zmiana stanu produktów 2021 | fsl-pl-cbn-inventory-change | 0 |
| Manufacturing cost of products for internal purposes Koszt wytworzenia produktów na własne potrzeby jednostki 2021 | fsl-pl-cbn-own-work-capitalised | 0 |
| Amortization Amortyzacja Other costs Pozostałe koszty / EU Business development 2021 | fsl-pl-other-expense | 0 |
| Taxes and fees Podatki i opłaty 2021 | fsl-pl-cbn-taxes-fees | 0 |
| Salaries Wynagrodzenia 2021 | fsl-pl-cbn-payroll | 0 |
| GRUPA Wynagrodzenia GRUPA Wynagrodzenia 2021 | fsl-pl-cogs-labor | 0 |
| Social security and other benefits Ubezpieczenie społeczne i inne świadczenia 2021 | fsl-pl-cbn-social-security | 0 |
| PL Value of goods and materials sold Wartość sprzedanych towarów i materiałów 2021 | fsl-pl-cogs | 0 |
| Other operating cost Pozostałe koszsty operacyjne (wyjątkowo relokacja) 2021 | fsl-pl-other-income | 0 |
| Financial expenses interest Odsetki z tytułu kosztów finansowych 2021 | fsl-pl-interest | 0 |
| Income tax Podatek dochodowy 2021 | fsl-pl-tax | 0 |
| Materials and energy PL Materials and energy 2021 | fsl-pl-cogs-materials | 0 |
| External services TOTAL External services 2021 | fsl-pl-cbn-external-services | 0 |
| GR B.TKW.INFTASTRUKTURA Office costs Koszty biura 2021 | fsl-pl-gna-rent | 0 |
| GR E.ZARZ.OGÓLNE HQ adm. costs Koszty administracyjne HQ 2021 | fsl-pl-gna | 967990 |
| GR D.SPRZED.MARKETING Marketing and promotion costs Delegations and representation 2021 | fsl-pl-selling-marketing | 0 |
| GR E.ZARZ.OGÓLNE Usługi doradcze - Consulting Usługi doradcze - Lech Consulting 2021 | fsl-pl-cogs-labor-contractors | 0 |
| PL D.SPRZED.MARKETING Commissions for Sales 2021 | fsl-pl-selling-commissions | 5 |
| PL D.SPRZED.SPRZEDAŻ Fleet management costs Koszty transportu 2021 | fsl-pl-cogs-materials-freight | 0 |
| PL B.TKW.IT Contract employees IT Contract employees IT - all 2021 | fsl-pl-gna-it | 0 |
| Tangible fixed assets nieaktywne Rzeczowe aktywa trwałe 2021 | fsl-pl-depreciation | 0 |
| Value of amortization Wartość amortyzacji 2021 | fsl-pl-depreciation-intangibles | 0 |

| Unmapped labels | Value |
| --- | ---: |
| === Sheet: Ass. PL === 2021 | 2.066 |
| Kapitalizacja 2021 | 1 |
| Net Sales DEV Net Sales DEV 2021 | 0 |
| b) Digital Twin (SAAS) b) Digital Twin (SAAS) 2021 | 0 |
| c) IoT c) IoT 2021 | 0 |
| d) DRD d) DRD 2021 | 0 |
| e) Program Partnerski e) Program Partnerski 2021 | 0 |
| Change Zmiana 2021 | 0 |
| PL POLSKA 2021 | 0 |
| GR GROUP 2021 | 0 |
| GR B.TKW.INNE DEV Taxes and fees GR Taxes and fees 2021 | 8.174 |
| PL B.TKW.INNE M&S Taxes and fees PL Taxes and fees 2021 | 0 |
| Wynagrodzenia razem Wynagrodzenia razem 2021 | 390.335 |
| GRUPA Kapitalizacja GRUPA Kapitalizacja 2021 | 21.03 |
| PL Wynagrodzenia PL Wynagrodzenia 2021 | 0 |
| PL Kapitalizacja PL Kapitalizacja 2021 | 0 |
| GR B.TKW.IT GR - B.TKW.IT 2021 | 0 |
| GR D.SPRZED.SPRZEDAŻ GR - D.SPRZED.SPRZEDAŻ 2021 | 0 |
| GR D.SPRZED.DELIVERY GR - D.SPRZED.DELIVERY 2021 | 0 |
| GR D.SPRZED.MARKETING GR - D.SPRZED.MARKETING 2021 | 7 |
| GR E.ZARZ.OGÓLNE GR - E.ZARZ.OGÓLNE 2021 | 0 |
| PL B.TKW.IT PL - B.TKW.IT 2021 | 5 |
| PL D.SPRZED.SPRZEDAŻ PL - D.SPRZED.SPRZEDAŻ 2021 | 0 |
| PL D.SPRZED.DELIVERY PL - D.SPRZED.DELIVERY 2021 | 0 |
| PL D.SPRZED.MARKETING PL - D.SPRZED.MARKETING 2021 | 0 |
| PL E.ZARZ.OGÓLNE PL - E.ZARZ.OGÓLNE 2021 | 6 |
| GRUP ZUS GRUPA ZUS 2021 | 3.57 |
| GRUPA ZUS Capitalisation GRUPA ZUS Kapitalizacja 2021 | 4.307 |
| PL ZUS PL ZUS 2021 | 1.401 |
| Change Narzut na wynagrodzenia brutto 2021 | 5 |
| PL ICO - material purchase 2021 | 315 |
| Gain on disposal of non-financial fixed assets Zysk ze zbycia niefinansowych aktywów trwałych 2021 | 0 |
| Redukcja zobowiązań Other operating revenues Pozostałe przychody operacyjne 2021 | 0 |
| GR Income tax Podatek dochodowy 2021 | 0 |
| GR Tax rate Realna stopa procentowa 2021 | 0 |
| Tax rate Realna stopa procentowa 2021 | 0 |
| Materials and energy GROUP Materials and energy 2021 | 0 |
| GR B.TKW.MATERIAŁY Other materials Pozostałe materiały 2021 | 0 |
| GR B.TKW.MATERIAŁY Sensor components 2021 | 105 |
| GR B.TKW.MATERIAŁY Others Inne 2021 | 0 |
| PL B.TKW.MATERIAŁY Other materials Pozostałe 2021 | 0 |
| PL B.TKW.MATERIAŁY Sensor components Materiały do czujników 2021 | 0 |
| PL B.TKW.MATERIAŁY Others Inne 2021 | 0 |
| External services GROUP External services GROUP 2021 | 48.159 |
| GR D.SPRZED.MARKETING Conference and representation costs Marketing and conferences 2021 | 0 |
| GR E.ZARZ.OGÓLNE Consultant and legal fees Koszty doradców i prawników 2021 | 0 |
| Kapitalizacja - Licences and SaaS costs Kapitalizacja - Licences and SaaS costs 2021 | 0 |
| GR D.SPRZED.SPRZEDAŻ Fleet management costs Koszty transportu / fleet cost 2021 | 0 |
| GR B.TKW.INFTASTRUKTURA IT equipment rental costs Office equipment 2021 | 0 |
| GR B.TKW.INFTASTRUKTURA IT equipment rental costs IT - rental cost 2021 | 0 |
| GR B.TKW.IT Contract employees IT Contract employees 2021 | 0 |
| Kapitalizacja - Contract employees Kapitalizacja - Contract employees 2021 | 74.3 |
| GR D.SPRZED.SPRZEDAŻ Contract employees sprzedaż Contract employees sprzedaż 2021 | 0 |
| Kapitalizacja - Contract employees sprzedaż Kapitalizacja - Contract employees sprzedaż 2021 | 0 |
| GR D.SPRZED.DELIVERY Contract employees delivery Contract employees delivery 2021 | 0 |
| Kapitalizacja - Contract employees delivery Kapitalizacja - Contract employees delivery 2021 | 0 |
| GR D.SPRZED.MARKETING Contract employees marketing Contract employees marketing 2021 | 0 |
| Kapitalizacja - Contract employees marketing Kapitalizacja - Contract employees marketing 2021 | 0 |
| GR B.TKW.INNE Pozostałe koszta 2021 | 0 |
| External services PL External services PL 2021 | 0 |
| PL B.ICO Licencje Grupowe 2021 | 10 |
| PL B.TKW.INFTASTRUKTURA Office costs Koszty biura 2021 | 0 |
| PL E.ZARZ.OGÓLNE HQ adm. costs Delegations and representation 2021 | 0 |
| PL D.SPRZED.MARKETING Marketing and promotion costs Events 2021 | 0 |
| PL D.SPRZED.MARKETING Conference and representation costs Marketing and conferences 2021 | 0 |
| PL E.ZARZ.OGÓLNE Consultant and legal fees Koszty doradców i prawników 2021 | 0 |
| PL B.TKW.INFTASTRUKTURA IT equipment rental costs Wyposażenie IT 2021 | 0 |
| Kapitalizacja - Contract employees IT Kapitalizacja - Contract employees IT 2021 | 10 |
| PL D.SPRZED.SPRZEDAŻ Contract employees sprzedaż Contract employees sprzedaż 2021 | 0 |
| PL D.SPRZED.DELIVERY Contract employees delivery Contract employees delivery 2021 | 0 |
| PL D.SPRZED.MARKETING Contract employees marketing Contract employees marketing 2021 | 0 |
| PL B.TKW.INNE Pozostałe koszta 2021 | 0 |
| Założenia do bilansu BS aassumptions Assets Aktywa 2021 | 1 |
| Investment nieaktywne Inwestycja 2021 | 0 |
| Disposal nieaktywne Sprzedaż 2021 | 0 |
| GR B.TKW.AMORTYZACJA Value of amortization nieaktywne Wartość amortyzacji 2021 | 21.317 |
| Investment real estate Inwestycje w nieruchomości Acquisition of investment real estate Nabycie nieruchomości inwestycyjnych 2021 | 0 |
| Sale of investment real estate Sprzedaż nieruchomości inwestycyjnych Value of the company Wartość firmy 2021 | 0 |
| Investment Inwestycja 2021 | 0 |
| Percent of amortization (%) Procent amortyzacji (%) 2021 | 50 |
| Intangible property Wartość niematerialna 2021 | 0 |
| Investment, w tym kapitalizacja Inwestycja 2021 | 80 |
| Disposal Sprzedaż Percent of amortization (%) Procent amortyzacji (%) 2021 | 2 |
| Materials Materiały 2021 | 0 |
| Rotation (days) Obrót (dni) 2021 | 0 |

### CF

- Selected period: `2028`
- Comparison period: `2021`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 1281
- Mapped lines: 42
- Coverage: 3%
- Readiness: `recoverable` (27)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Payroll z tytułu wynagrodzeń 2028 | fsl-cf-operating-interest-cost | 0 |
| Other operating income D. Pozostałe przychody operacyjne 2028 | fsl-cf-operating-dividend-income | 0 |
| b. Exchange gains (losses) b. Zyski / Straty z tytułu różnic kursowych 2028 | fsl-cf-operating-fv-derivatives | 0 |
| e. Change in provisions e. Zmiana stanu rezerw 2028 | fsl-cf-change-wc-provisions | 0 |
| f. Change in inventory f. Zmiana stanu zapasów 2028 | fsl-cf-change-wc-inventory | 0 |
| g. Change in receivables g. Zmiana stanu należności 2028 | fsl-cf-change-wc-ar | 0 |
| Change in prepayments and accurals i. Zmiana stanu rozliczeń międzyokresowych 2028 | fsl-cf-change-wc-prepaids | 0 |
| j. Other adjustments j. Inne korekty 2028 | fsl-cf-operating-other-adj | 0 |
| dividend and profit sharing otrzymane dywidendy i udziały w zyskach 2028 | fsl-cf-dividends-received | 0 |
| interest odsetki otrzymane 2028 | fsl-cf-operating-interest-income | 0 |
| ZOBOWIĄZANIA KRÓTKOTERMINOWE C. SHORT-TERM LIABILITIES C. SHORT-TERM LIABILITIES 2028 | fsl-cf-debt-drawdown | 566.592 |
| Kredyty inwestycyjne Investment loans Investment loans 2028 | fsl-cf-operating-fv-changes | 0 |
| Kredyty obrotowe Working capital loans Working capital loans 2028 | fsl-cf-change-wc-other | 0 |
| PASYWA LIABILITIES LIABILITIES 2028 | fsl-cf-debt-drawdown-lease | 452.389 |
| Amortyzacja 2028 | fsl-cf-operating-depreciation | 86.873 |
| EBT - Zysk Brutto 2028 | fsl-cf-operating-ebt | -461.18 |
| Zysk Netto 2028 | fsl-cf-operating-net-income | -461.18 |
| Cash Flow Przepływy z działalności operacyjnej 2028 | fsl-cf-operating | -2.59 |
| Zmiana Kapitału Pracującego 2028 | fsl-cf-change-wc | -2.431 |
| Przepływy z działalności inwestycyjnej 2028 | fsl-cf-investing | 0 |
| Przepływy z działalności finansowej 2028 | fsl-cf-financing | 2.806 |
| Spłata pożyczek i kredytów 2028 | fsl-cf-debt-repayment | 0 |
| Środki pieniężne na początek okresu 2028 | fsl-cf-opening-cash | 11.585 |
| Zmiany stanu środków pieniężnych 2028 | fsl-cf-net-change-cash | 215.715 |
| Środki pieniężne na koniec okresu 2028 | fsl-cf-closing-cash | 204.726 |
| TOT – w jednostkach powiązanych – w jednostkach powiązanych – w jednostkach powiązanych 2028 | fsl-cf-investing-subsidiaries | 0 |
| Wynagrodzenia razem Wynagrodzenia razem 2028 | fsl-cf-operating-adjustments | 390.335 |
| Gain on disposal of non-financial fixed assets Zysk ze zbycia niefinansowych aktywów trwałych 2028 | fsl-cf-operating-gain-disposal | 0 |
| Value of amortization Wartość amortyzacji 2028 | fsl-cf-operating-depreciation-intangibles | 0 |
| zwrot zwrot 2028 | fsl-cf-tax-refund | 80 |
| Zobowiazania z tytułu leasingu 2028 | fsl-cf-lease-repayment | 0 |
| Aktualizacja wartości aktywów niefinansowych III. Aktualizacja wartości aktywów niefinansowych 2028 | fsl-cf-operating-impairment | 0 |
| a) od jednostek powiązanych, w tym: a) od jednostek powiązanych, w tym: 2028 | fsl-cf-operating-equity-method | 0 |
| Podatek dochodowy M. Podatek dochodowy 2028 | fsl-cf-taxes-paid | 0 |
| Inne wpływy inwestycyjne d. Other inflows form investment activities 2028 | fsl-cf-other-receipts | 0 |
| Inne wydatki inwestycyjne d. Other outflows form investment activities 2028 | fsl-cf-other-expenditure | 0 |
| Przychody netto ze sprzedaży usług 2028 | fsl-cf-investing-disposal-proceeds | 0 |
| Zmiana Redukcja zobowiązań 2028 | fsl-cf-change-wc-ap | 0 |
| Dochód do opodatkowania Dochód do opodatkowania 2028 | fsl-cf-operating-depreciation-rou | 0 |
| Spłata długu Repayment of factoring 2028 | fsl-cf-debt-repayment-bank | 0 |
| Marketplace i. Other outflows from financial activities 2028 | fsl-cf-other-investing | 0 |
| Market Market Avg. Project value CAPEX USD JEN 2028 | fsl-cf-capex | 1 |

| Unmapped labels | Value |
| --- | ---: |
| === Sheet: Presentation PL All === Description Opis 2028 | 1 |
| A. FIXED ASSETS A. AKTYWA TRWAŁE 2028 | 0 |
| B CURRENT ASSETS B. AKTYWA OBROTOWE 2028 | 0 |
| a. Raw materials a. Materiały 2028 | 0 |
| b. Semi-finished products and work in progress b. Półprodukty i produkty w toku 2028 | 0 |
| Finished products c. Produkty gotowe 2028 | 0 |
| Goods d. Towary 2028 | 0 |
| e. Advances for deliveries e. Zaliczki na poczet dostaw 2028 | 0 |
| a. Receivables from related parties a. Należności od podmiotów powiązanych 2028 | 0 |
| b. Receivables from other entities b. Należności od pozostałych podmiotów 2028 | 0 |
| TOTAL ASSETS AKTYWA RAZEM 2028 | 0 |
| Description Opis 2028 | 1 |
| A. TOTAL SHAREHOLDERS' EQUITY A. KAPITAŁ WŁASNY OGÓŁEM 2028 | 0 |
| B. LONG-TERM LIABILITIES B. ZOBOWIĄZANIA DŁUGOTERMINOWE 2028 | 0 |
| a. Bank loans to be repaid a. Zobowiązania wobec banków z tytułu kredytów 2028 | 0 |
| b. Borrowings b. Zobowiązania pożyczkowe 2028 | 0 |
| Leasing c. Leasing 2028 | 0 |
| Other external financing sources d. Pozostałe zobowiązania finansowe 2028 | 0 |
| a. Government subsidies a. Dotacje rządowe 2028 | 0 |
| b. Other liabilities b.Pozostałe zobowizania 2028 | 0 |
| To related parties Wobec podmiotów powiązanych 2028 | 0 |
| To other entities Wobec pozostałych podmiotów 2028 | 0 |
| SHORT-TERM LIABILITIES C. ZOBOWIĄZANIA KRÓTKOTERMINOWE 2028 | 0 |
| Investment loans Kredyty inwestycyjne 2028 | 0 |
| Working capital loans Kredyty obrotowe 2028 | 0 |
| Overdrafts Kredyty w rachunku bieżącym (overdrafty) 2028 | 0 |
| Factoring Factoring 2028 | 0 |
| b. Borrowings to be repaid b. Zobowiązania z tytułu pożyczek 2028 | 0 |
| Leasing c. Zobowiązania z tytułu leasingu 2028 | 0 |
| a.To related parties a. Do jednostek powiązanych 2028 | 0 |
| Trade liabilities Z tytułu dostaw i usług 2028 | 0 |
| Booked liabilities (provisions - cost accruals) Inne zobowiązania 2028 | 0 |
| Prepayments received for supplies Zaliczki otrzymane na dostawy 2028 | 0 |
| Dividends and other capital liabilities Z tytułu dywidend i innych zobowiązań kapitałowych 2028 | 0 |
| Other liabilities pozostałe zobowiązania 2028 | 0 |
| b.To other entities b. Do pozostałych jednostek 2028 | 0 |
| Booked liabilities (provisions - cost accruals) Redukcja układowana/umowna 2028 | 0 |
| Other liabilities (including contingent, regarding acquisition of companies) Pozostałe zobowiązania 2028 | 0 |
| Government subsidies c. Dotacje rządowe 2028 | 0 |
| Special funds d. Fundusze specjalne 2028 | 0 |
| a.Provision for employee benefits a. Rezerwa na świadczenia pracownicze 2028 | 0 |
| b. Other short-term provisions b.Pozostałe rezerwy krótkoterminowe 2028 | 0 |
| LIABILITIES PASYWA 2028 | 0 |
| A. Net Sales A. Przychody ze sprzedaży netto 2028 | 0 |
| B. Operating expenses B. Koszty działalności operacyjnej 2028 | 0 |
| Profit (loss) on sales (A-B) C. Zysk (strata) ze sprzedaży (A-B) 2028 | 0 |
| E. Other operating expenses E. Pozostałe koszty operacyjne 2028 | 0 |
| G. Financial income G. Przychody finansowe 2028 | 0 |
| H. Financial costs H. Koszty finansowe 2028 | 0 |
| K. Gross profit (loss) (I ± J) K. Zysk (strata) brutto (I±J) 2028 | 0 |
| CIT L. Podatek dochodowy 2028 | 0 |
| N. Net profit (loss) (Q-L-M) N. Zysk (strata) netto (K-L-M) 2028 | 0 |
| A. Cash flow from operating activities A. Przepływy środków pieniężnych z działalności operacyjnej 2028 | 0 |
| a. Amortisation and depreciation a. Amortyzacja 2028 | 0 |
| Interest and profit sharing (dividend) c. Odsetki i udziały w zyskach (dywidendy) 2028 | 0 |
| Profit (loss) on investment activities d. Zyski/straty z działalności inwestycyjnej 2028 | 0 |
| B. CF from investment activities B. Przepływy środków pieniężnych z działalności inwestycyjnej 2028 | 0 |
| a. Disposal of intangible and tangible fixed assets a. Zbycie wartości niematerialnych i prawnych 2028 | 0 |
| From financial assets, including: c. Wpływy aktywów finansowych, w tym 2028 | 0 |
| sales of financial assets zbycie aktywów finansowych 2028 | 0 |
| repayment of granted L-term loans otrzymane spłaty pożyczek długoterminowych 2028 | 0 |
| other inflows from financial assets inne wpływy z aktywów finansowych 2028 | 0 |
| Other inflows form investment activities d. Inne wpływy inwestycyjne 2028 | 0 |
| For financial assets, including: c. Na aktywa finansowe, w tym 2028 | 0 |
| purchase of financial assets nabycie aktywów finansowych 2028 | 0 |
| L-term loans granted udzielone pożyczki długoterminowe 2028 | 0 |
| Other outflows form investment activities d. Inne wydatki inwestycyjne 2028 | 0 |
| CF from financial activities C. Przepływy środków pieniężnych z działalności finansowej 2028 | 0 |
| b. Credits and loans b. Kredyty i pożyczki 2028 | 0 |
| Issuance of debt securities c. Emisja dłużnych papierów wartościowych 2028 | 0 |
| Other inflows form financial activities d. Inne wpływy finansowe 2028 | 0 |
| a. Purchase of own shares a. Nabycie udziałów własnych 2028 | 0 |
| Repayment of credits and loans d. Spłaty kredytów i pożyczek 2028 | 0 |
| e. Redemption of debt securities e. Wykup dłużnych papierów wartościowych 2028 | 0 |
| f. Payment of other financial liabilities f. Z tyt. zobowiązań finansowych 2028 | 0 |
| g. Payment of liabilities arising from financail leases g.. Płatności z umów leasingu finansowego 2028 | 0 |
| h. Interest h. Odsetki 2028 | 0 |
| Other outflows from financial activities i. Inne wydatki finansowe 2028 | 0 |
| Total net Cash Flow D. Przepływy pieniężne netto razem 2028 | 0 |
| E. Cash opening balance E. Środki pieniężne na początek okresu 2028 | 0 |
| F. Closing balance of cash F. Środki pieniężne na koniec okresu 2028 | 0 |
| podniesienie kapitału w Polsce o 2028 | 1000000 |
| grant w wysokości 2028 | 500000 |
| Net Sales 2028 | 0 |
| Operating expenses 2028 | 276.163 |
| Profit on sales 2028 | -276.163 |
| Net profit 2028 | -276.399 |
| Shareholders' equity 2028 | 780.754 |
| Cash and cash equivalents 2028 | 519.627 |
| MRR December every year 2028 | 0 |
| Net revenue 2028 | 0 |
| SaaS 2028 | 0 |
| Sales per Sales HC 2028 | 37.8 |
| Sales per Delivery HC 2028 | 27 |
| A. Net Sales A. Net Sales A. Przychody ze sprzedaży netto 2028 | 49.163 |
| Other operating income D. Pozostałe przychody operacyjne - - 2028 | 15.5 |
| JEN/PLN 2028 | 0.02 |
| Poland: Platform transactions (QTY) 2028 | 2 |
| Platform transactions (PLN) 2028 | 2.583 |
| Marketplace revenue (PLN) 2028 | 33.35 |
| Standard (QTY) 2028 | 1 |
| DT revenue (PLN) 2028 | 13.435 |
| Group Installations (QTY) 2028 | 3 |
| IoT revenue (PLN) 2028 | 60 |
| Development map - generator (QTY) 2028 | 7 |
| Development map - workshop (QTY) 2028 | 1 |
| Development map - generator (PLN) 2028 | 10 |
| DRD revenue (PLN) 2028 | 26.6 |
| Showroom implementations (QTY) - 2028 | 13 |
| Others (QTY) 2028 | 4 |
| Showroom implementations (PLN) - 2028 | 26.565 |
| Partnerships and Showroom revenue (PLN) 2028 | 1 |
| Poland TOTAL (PLN) 2028 | 46.785 |
| Poland: Total revenue (PLN) 2028 | 46.785 |
| TOTAL (PLN) 2028 | 46.785 |
| Marketplace Total revenue (PLN) 2028 | 33.35 |
| Digital Twin (SAAS) Total revenue (PLN) 2028 | 13.435 |
| DRD Total revenue (PLN) - 2028 | 26.6 |
| Partnerships and Showroom Total revenue (PLN) 2028 | 1 |
| Total HC 2028 | 22 |
| Poland 2028 | 22 |
| Sales HC 2028 | 4 |
| Delivery HC 2028 | 3 |
| Germany 2028 | 10.221 |
| Japan Sales per Delivery HC 2028 | 15.595 |
| Japan === Sheet: Revenue EUR === FX: PLN/PLN 2028 | 0.23 |
| USD/PLN 2028 | 0.95 |
| Marketplace revenue (EUR) 2028 | 7.756 |
| DT revenue (EUR) 2028 | 3.124 |
| DRD revenue (EUR) - 2028 | 6.186 |
| Others (QTY) - 2028 | 4 |
| Partnerships and Showroom revenue (EUR) 2028 | 233 |
| Poland TOTAL (EUR) 2028 | 10.88 |
| Poland: 2028 | 10.88 |
| TOTAL (EUR) 2028 | 10.88 |
| Marketplace 2028 | 7.756 |
| Digital Twin (SAAS) 2028 | 3.124 |
| Partnerships and Showroom 2028 | 233 |
| YEN/PLN 2028 | 0.024 |
| Opis Description Description 2028 | 1 |
| A. AKTYWA TRWAŁE A. FIXED ASSETS A. FIXED ASSETS 2028 | 58.667 |
| B. AKTYWA OBROTOWE B CURRENT ASSETS B CURRENT ASSETS 2028 | 393.722 |
| a. Materiały a. Raw materials a. Raw materials 2028 | 0 |
| Produkty gotowe c. Finished products c. Finished products 2028 | 0 |
| Towary d. Goods d. Goods 2028 | 0 |
| e. Zaliczki na poczet dostaw e. Advances for deliveries e. Advances for deliveries 2028 | 0 |
| A. KAPITAŁ WŁASNY OGÓŁEM A. TOTAL SHAREHOLDERS' EQUITY A. TOTAL SHAREHOLDERS' EQUITY 2028 | -114.204 |
| B. ZOBOWIĄZANIA DŁUGOTERMINOWE B. LONG-TERM LIABILITIES B. LONG-TERM LIABILITIES 2028 | 0 |
| b. Zobowiązania pożyczkowe b. Borrowings b. Borrowings 2028 | 0 |
| Leasing c. Leasing c. Leasing 2028 | 0 |
| Pozostałe zobowiązania finansowe d. Other external financing sources d. Other external financing sources 2028 | 0 |
| a. Dotacje rządowe a. Government subsidies a. Government subsidies 2028 | 0 |
| b.Pozostałe zobowizania b. Other liabilities b. Other liabilities 2028 | 0 |
| Wobec podmiotów powiązanych To related parties To related parties 2028 | 0 |
| Wobec pozostałych podmiotów To other entities To other entities 2028 | 0 |
| Kredyty w rachunku bieżącym (overdrafty) Overdrafts Overdrafts 2028 | 0 |
| Factoring Factoring Factoring 2028 | 0 |
| Zobowiązania z tytułu leasingu c. Leasing c. Leasing 2028 | 0 |
| a. Do jednostek powiązanych a.To related parties a.To related parties 2028 | 0 |
| Z tytułu dostaw i usług Trade liabilities Trade liabilities 2028 | 0 |
| Inne zobowiązania Booked liabilities (provisions - cost accruals) Booked liabilities (provisions - cost accruals) 2028 | 0 |
| Zaliczki otrzymane na dostawy Prepayments received for supplies Prepayments received for supplies 2028 | 0 |
| pozostałe zobowiązania Other liabilities Other liabilities 2028 | 0 |
| b. Do pozostałych jednostek b.To other entities b.To other entities 2028 | 566.592 |
| Redukcja układowana/umowna Booked liabilities (provisions - cost accruals) Booked liabilities (provisions - cost accruals) 2028 | 0 |
| z tytułu wynagrodzeń Payroll Payroll 2028 | 0 |
| Dotacje rządowe c. Government subsidies c. Government subsidies 2028 | 0 |
| Fundusze specjalne d. Special funds d. Special funds 2028 | 0 |
| b.Pozostałe rezerwy krótkoterminowe b. Other short-term provisions b. Other short-term provisions 2028 | 0 |
| A. Przychody ze sprzedaży netto A. Net Sales A. Net Sales 2028 | 49.163 |
| B. Koszty działalności operacyjnej B. Operating expenses B. Operating expenses 2028 | 443.104 |
| Pozostałe przychody operacyjne D. Other operating income D. Other operating income 2028 | 0 |
| E. Pozostałe koszty operacyjne E. Other operating expenses E. Other operating expenses 2028 | 0 |
| G. Przychody finansowe G. Financial income G. Financial income 2028 | 0 |
| H. Koszty finansowe H. Financial costs H. Financial costs 2028 | 324319 |
| Podatek dochodowy L. CIT L. CIT 2028 | 0 |
| Wariant KALKULACYJNY: Opis Opis Opis 2028 | 1 |
| Marketplace Marketplace Marketplace 2028 | 0 |
| Digital Twin (SAAS) Digital Twin (SAAS) Digital Twin (SAAS) 2028 | 0 |
| Big Data (MaaS) Big Data (MaaS) Big Data (MaaS) 2028 | 0 |
| DRD DRD DRD 2028 | 0 |
| Program Partnerski Program Partnerski Program Partnerski 2028 | 0 |
| Koszt wytworzenia sprzedanych produktów I. Koszt wytworzenia sprzedanych produktów I. Koszt wytworzenia sprzedanych produktów 2028 | 0 |
| Koszty sprzedaży D. Koszty sprzedaży D. Koszty sprzedaży 2028 | 0 |
| E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu 2028 | 0 |
| G. Pozostałe przychody operacyjne G. Pozostałe przychody operacyjne G. Pozostałe przychody operacyjne 2028 | 0 |
| Dotacje II. Dotacje II. Dotacje 2028 | 0 |
| Inne przychody operacyjne IV. Inne przychody operacyjne IV. Inne przychody operacyjne 2028 | 0 |
| H. Pozostałe koszty operacyjne H. Pozostałe koszty operacyjne H. Pozostałe koszty operacyjne 2028 | 0 |
| Aktualizacja wartości aktywów niefinansowych II. Aktualizacja wartości aktywów niefinansowych II. Aktualizacja wartości aktywów niefinansowych 2028 | 0 |
| Inne koszty operacyjne III. Inne koszty operacyjne III. Inne koszty operacyjne 2028 | 0 |
| J. Przychody finansowe J. Przychody finansowe J. Przychody finansowe 2028 | 0 |
| Odsetki II. Odsetki II. Odsetki 2028 | 0 |
| Aktualizacja wartości aktywów finansowych IV. Aktualizacja wartości aktywów finansowych IV. Aktualizacja wartości aktywów finansowych 2028 | 0 |
| Inne V. Inne V. Inne 2028 | 0 |
| K. Koszty finansowe K. Koszty finansowe K. Koszty finansowe 2028 | 0 |
| Odsetki, w tym: I. Odsetki, w tym: I. Odsetki, w tym: 2028 | 0 |
| Aktualizacja wartości aktywów finansowych III. Aktualizacja wartości aktywów finansowych III. Aktualizacja wartości aktywów finansowych 2028 | 0 |
| Inne IV. Inne IV. Inne 2028 | 0 |
| Podatek dochodowy M. Podatek dochodowy M. Podatek dochodowy 2028 | 0 |
| a. Amortyzacja a. Amortisation and depreciation a. Amortisation and depreciation 2028 | 1.333 |
| e. Zmiana stanu rezerw e. Change in provisions e. Change in provisions 2028 | 0 |
| f. Zmiana stanu zapasów f. Change in inventory f. Change in inventory 2028 | 0 |
| g. Zmiana stanu należności g. Change in receivables g. Change in receivables 2028 | -24.763 |
| j. Inne korekty j. Other adjustments j. Other adjustments 2028 | -64.916 |
| zbycie aktywów finansowych sales of financial assets sales of financial assets 2028 | 0 |
| otrzymane dywidendy i udziały w zyskach dividend and profit sharing dividend and profit sharing 2028 | 0 |
| odsetki otrzymane interest interest 2028 | 0 |
| nabycie aktywów finansowych purchase of financial assets purchase of financial assets 2028 | 0 |
| udzielone pożyczki długoterminowe L-term loans granted L-term loans granted 2028 | 0 |
| b. Kredyty i pożyczki b. Credits and loans b. Credits and loans 2028 | 0 |
| Emisja dłużnych papierów wartościowych c. Issuance of debt securities c. Issuance of debt securities 2028 | 0 |
| a. Nabycie udziałów własnych a. Purchase of own shares a. Purchase of own shares 2028 | 0 |
| h. Odsetki h. Interest h. Interest 2028 | 0 |
| Przepływy pieniężne netto razem D. Total net Cash Flow D. Total net Cash Flow 2028 | -186.532 |
| E. Środki pieniężne na początek okresu E. Cash opening balance E. Cash opening balance 2028 | 311.71 |
| === Sheet: ADJ PLN === 2028 | 0 |
| shares 2028 | 5 |
| ICO licences 2028 | 4 |
| Opis Opis Opis 2028 | 1 |
| === Sheet: Overview PL === P&L Jan 2028 | -24 |
| Big Data (MAAS) 2028 | 0 |
| Program Partnerski 2028 | 0 |
| Licencje Grupowe 2028 | 0 |
| Koszty sprzedaży 2028 | 272.719 |
| IT Support 2028 | 106.019 |
| Infrastruktura 2028 | 38.243 |
| Koszty materiałów 2028 | 4.587 |
| Pozostałe 2028 | 123.87 |
| Marża Brutto 2028 | -272.719 |
| Marża brutto (%) #DIV/ 2028 | 0 |
| Koszty Bezpośrednie 2028 | 62.194 |
| Sprzedaż 2028 | 34.102 |
| Delivery 2028 | 20.2 |
| Marketing 2028 | 7.892 |
| Marża Po Kosztach Bezpośrednich 2028 | -334.912 |
| Marża Po Kosztach Bezpośrednich (%) #DIV/ 2028 | 0 |
| OPEX 2028 | 99.604 |
| Rozwój Platformy 2028 | 0 |
| Efekt pozostałych zdarzeń operacyjnych / Granty 2028 | 0 |
| EBIT 2028 | -434.516 |
| EBIT (%) #DIV/ 2028 | 0 |
| EBITDA 2028 | -347.643 |
| EBITDA (%) #DIV/ 2028 | 0 |
| Przychody finansowe 2028 | 0 |
| Koszty finansowe 2028 | 26.663 |
| EBT - Zysk Brutto (%) #DIV/ 2028 | 0 |
| Podatki 2028 | 0 |
| Zysk Netto(%) #DIV/ 2028 | 0 |
| Bilans Aktywa trwałe 2028 | 5.16 |
| WNiP 2028 | 5.059 |
| Udziały i akcje w podmiotach powiązanych 2028 | 0 |
| Należności 2028 | 149.26 |
| Środki pieniężne 2028 | 204.726 |
| Pozostała aktywa obrotowe 2028 | 73.987 |
| Kapitał obrotowy netto 2028 | 105.66 |
| Kapitał własny ogółem: 2028 | 2.738 |
| Kapitał własny przypisany jednostce dominującej 2028 | 140.5 |
| Wynik finansowy netto za rok obrotowy 2028 | -246.562 |
| Niepodzielony zysk lat ubiegłych 2028 | -606.615 |
| Zobowiązania długoterminowe: 2028 | 675 |
| Kredyty i pożyczki 2028 | 675 |
| Zobowiązania krótkoterminowe: 2028 | 2.226 |
| Zobowiązania z tyt. dostaw i usług oraz pozostałe 2028 | 95.167 |
| Inwestycje 2028 | 0 |
| Wpływy: 2028 | 2.806 |
| Kapitał od inwestorów 2028 | 0 |
| Finansowanie dłużne 2028 | 0 |
| Granty 2028 | 0 |
| Wydatki 2028 | 0 |
| Bilans 2028 | 0 |
| Wariant KALKULACYJNY: Opis Description Opis 2028 | 1687804 |
| Marketplace Marketplace a) Marketplace 2028 | 0 |
| Digital Twin (SAAS) Digital Twin (SAAS) b) Digital Twin (SAAS) 2028 | 0 |
| Big Data (MaaS) Big Data (MaaS) c) Big Data (MaaS) 2028 | 0 |
| DRD DRD d) DRD 2028 | 0 |
| Program Partnerski Program Partnerski e) Program Partnerski 2028 | 0 |
| D.SPRZED* D. Koszty sprzedaży D. Koszty sprzedaży D. Koszty sprzedaży 2028 | 0 |
| E.ZARZ* E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu 2028 | 0 |
| === Sheet: Statement GROUP === Bilans Opis Description Description 2028 | 1 |
| TOT B. Koszty działalności operacyjnej B. Operating expenses B. Operating expenses 2028 | 250.517 |
| TOT D. Pozostałe przychody operacyjne D. Other operating income D. Other operating income 2028 | 0 |
| TOT E. Pozostałe koszty operacyjne E. Other operating expenses E. Other operating expenses 2028 | 0 |
| TOT G. Przychody finansowe G. Financial income G. Financial income 2028 | 0 |
| TOT H. Koszty finansowe H. Financial costs H. Financial costs 2028 | 172224 |
| TOT L. Podatek dochodowy L. CIT L. CIT 2028 | 0 |
| Wariant KALKULACYJNY: TOT Opis Description Opis 2028 | 1 |
| TOT – od jednostek powiązanych – od jednostek powiązanych – od jednostek powiązanych 2028 | 0 |
| TOT Marketplace Marketplace a) Marketplace 2028 | 0 |
| TOT Digital Twin (SAAS) Digital Twin (SAAS) b) Digital Twin (SAAS) 2028 | 0 |
| TOT Big Data (MaaS) Big Data (MaaS) c) Big Data (MaaS) 2028 | 0 |
| TOT DRD DRD d) DRD 2028 | 0 |
| TOT Program Partnerski Program Partnerski e) Program Partnerski 2028 | 0 |
| TOT – jednostkom powiązanym – jednostkom powiązanym – jednostkom powiązanym 2028 | 0 |
| TOT D. Koszty sprzedaży D. Koszty sprzedaży D. Koszty sprzedaży 2028 | 0 |
| TOT E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu 2028 | 0 |
| TOT G. Pozostałe przychody operacyjne G. Pozostałe przychody operacyjne G. Pozostałe przychody operacyjne 2028 | 0 |
| TOT II. Dotacje II. Dotacje II. Dotacje 2028 | 0 |
| TOT IV. Inne przychody operacyjne IV. Inne przychody operacyjne IV. Inne przychody operacyjne 2028 | 0 |
| TOT H. Pozostałe koszty operacyjne H. Pozostałe koszty operacyjne H. Pozostałe koszty operacyjne 2028 | 0 |
| TOT III. Inne koszty operacyjne III. Inne koszty operacyjne III. Inne koszty operacyjne 2028 | 0 |
| TOT J. Przychody finansowe J. Przychody finansowe J. Przychody finansowe 2028 | 0 |
| TOT V. Inne V. Inne V. Inne 2028 | 0 |
| TOT K. Koszty finansowe K. Koszty finansowe K. Koszty finansowe 2028 | 0 |
| TOT I. Odsetki, w tym: I. Odsetki, w tym: I. Odsetki, w tym: 2028 | 0 |
| TOT – dla jednostek powiązanych – dla jednostek powiązanych – dla jednostek powiązanych 2028 | 0 |
| TOT IV. Inne IV. Inne IV. Inne 2028 | 0 |
| TOT M. Podatek dochodowy M. Podatek dochodowy M. Podatek dochodowy 2028 | 0 |
| === Sheet: Statement PL === Bilans Opis Description Description 2028 | 1 |
| === Sheet: Ass. PL === 2028 | 2.066 |
| Kapitalizacja 2028 | 1 |
| Net revenues from the sale of products Przychody netto ze sprzedaży produktów 2028 | 0 |
| Net Sales DEV Net Sales DEV 2028 | 0 |
| a) Marketplace a) Marketplace 2028 | 0 |
| b) Digital Twin (SAAS) b) Digital Twin (SAAS) 2028 | 0 |
| c) IoT c) IoT 2028 | 0 |
| d) DRD d) DRD 2028 | 0 |
| e) Program Partnerski e) Program Partnerski 2028 | 0 |
| Change in the balance of products Zmiana stanu produktów 2028 | 0 |
| Change Zmiana 2028 | 0 |
| Manufacturing cost of products for internal purposes Koszt wytworzenia produktów na własne potrzeby jednostki 2028 | 0 |
| Amortization Amortyzacja Other costs Pozostałe koszty / EU Business development 2028 | 0 |
| PL POLSKA 2028 | 0 |
| GR GROUP 2028 | 0 |
| Taxes and fees Podatki i opłaty 2028 | 0 |
| GR B.TKW.INNE DEV Taxes and fees GR Taxes and fees 2028 | 8.174 |
| PL B.TKW.INNE M&S Taxes and fees PL Taxes and fees 2028 | 0 |
| Salaries Wynagrodzenia 2028 | 0 |
| GRUPA Wynagrodzenia GRUPA Wynagrodzenia 2028 | 0 |
| GRUPA Kapitalizacja GRUPA Kapitalizacja 2028 | 21.03 |
| PL Wynagrodzenia PL Wynagrodzenia 2028 | 0 |
| PL Kapitalizacja PL Kapitalizacja 2028 | 0 |
| GR B.TKW.IT GR - B.TKW.IT 2028 | 0 |
| GR D.SPRZED.SPRZEDAŻ GR - D.SPRZED.SPRZEDAŻ 2028 | 0 |
| GR D.SPRZED.DELIVERY GR - D.SPRZED.DELIVERY 2028 | 0 |
| GR D.SPRZED.MARKETING GR - D.SPRZED.MARKETING 2028 | 7 |
| GR E.ZARZ.OGÓLNE GR - E.ZARZ.OGÓLNE 2028 | 0 |
| PL B.TKW.IT PL - B.TKW.IT 2028 | 5 |
| PL D.SPRZED.SPRZEDAŻ PL - D.SPRZED.SPRZEDAŻ 2028 | 0 |
| PL D.SPRZED.DELIVERY PL - D.SPRZED.DELIVERY 2028 | 0 |
| PL D.SPRZED.MARKETING PL - D.SPRZED.MARKETING 2028 | 0 |
| PL E.ZARZ.OGÓLNE PL - E.ZARZ.OGÓLNE 2028 | 6 |
| Social security and other benefits Ubezpieczenie społeczne i inne świadczenia 2028 | 0 |
| GRUP ZUS GRUPA ZUS 2028 | 3.57 |
| GRUPA ZUS Capitalisation GRUPA ZUS Kapitalizacja 2028 | 4.307 |
| PL ZUS PL ZUS 2028 | 1.401 |
| Change Narzut na wynagrodzenia brutto 2028 | 5 |
| PL Value of goods and materials sold Wartość sprzedanych towarów i materiałów 2028 | 0 |
| PL ICO - material purchase 2028 | 315 |
| Redukcja zobowiązań Other operating revenues Pozostałe przychody operacyjne 2028 | 0 |
| Other operating cost Pozostałe koszsty operacyjne (wyjątkowo relokacja) 2028 | 0 |
| Financial expenses interest Odsetki z tytułu kosztów finansowych 2028 | 0 |
| GR Income tax Podatek dochodowy 2028 | 0 |
| GR Tax rate Realna stopa procentowa 2028 | 0 |
| Income tax Podatek dochodowy 2028 | 0 |
| Tax rate Realna stopa procentowa 2028 | 0 |
| Materials and energy GROUP Materials and energy 2028 | 0 |
| GR B.TKW.MATERIAŁY Other materials Pozostałe materiały 2028 | 0 |
| GR B.TKW.MATERIAŁY Sensor components 2028 | 105 |
| GR B.TKW.MATERIAŁY Others Inne 2028 | 0 |
| Materials and energy PL Materials and energy 2028 | 0 |
| PL B.TKW.MATERIAŁY Other materials Pozostałe 2028 | 0 |
| PL B.TKW.MATERIAŁY Sensor components Materiały do czujników 2028 | 0 |
| PL B.TKW.MATERIAŁY Others Inne 2028 | 0 |
| External services TOTAL External services 2028 | 0 |
| External services GROUP External services GROUP 2028 | 48.159 |
| GR B.TKW.INFTASTRUKTURA Office costs Koszty biura 2028 | 0 |
| GR E.ZARZ.OGÓLNE HQ adm. costs Koszty administracyjne HQ 2028 | 967990 |
| GR D.SPRZED.MARKETING Marketing and promotion costs Delegations and representation 2028 | 0 |
| GR D.SPRZED.MARKETING Conference and representation costs Marketing and conferences 2028 | 0 |
| GR E.ZARZ.OGÓLNE Consultant and legal fees Koszty doradców i prawników 2028 | 0 |
| Kapitalizacja - Licences and SaaS costs Kapitalizacja - Licences and SaaS costs 2028 | 0 |
| GR D.SPRZED.SPRZEDAŻ Fleet management costs Koszty transportu / fleet cost 2028 | 0 |
| GR B.TKW.INFTASTRUKTURA IT equipment rental costs Office equipment 2028 | 0 |
| GR B.TKW.INFTASTRUKTURA IT equipment rental costs IT - rental cost 2028 | 0 |
| GR B.TKW.IT Contract employees IT Contract employees 2028 | 0 |
| Kapitalizacja - Contract employees Kapitalizacja - Contract employees 2028 | 74.3 |
| GR D.SPRZED.SPRZEDAŻ Contract employees sprzedaż Contract employees sprzedaż 2028 | 0 |
| Kapitalizacja - Contract employees sprzedaż Kapitalizacja - Contract employees sprzedaż 2028 | 0 |
| GR D.SPRZED.DELIVERY Contract employees delivery Contract employees delivery 2028 | 0 |
| Kapitalizacja - Contract employees delivery Kapitalizacja - Contract employees delivery 2028 | 0 |
| GR D.SPRZED.MARKETING Contract employees marketing Contract employees marketing 2028 | 0 |
| Kapitalizacja - Contract employees marketing Kapitalizacja - Contract employees marketing 2028 | 0 |
| GR E.ZARZ.OGÓLNE Usługi doradcze - Consulting Usługi doradcze - Lech Consulting 2028 | 0 |
| GR B.TKW.INNE Pozostałe koszta 2028 | 0 |
| External services PL External services PL 2028 | 0 |
| PL B.ICO Licencje Grupowe 2028 | 10 |
| PL D.SPRZED.MARKETING Commissions for Sales 2028 | 5 |
| PL B.TKW.INFTASTRUKTURA Office costs Koszty biura 2028 | 0 |
| PL E.ZARZ.OGÓLNE HQ adm. costs Delegations and representation 2028 | 0 |
| PL D.SPRZED.MARKETING Marketing and promotion costs Events 2028 | 0 |
| PL D.SPRZED.MARKETING Conference and representation costs Marketing and conferences 2028 | 0 |
| PL E.ZARZ.OGÓLNE Consultant and legal fees Koszty doradców i prawników 2028 | 0 |
| PL D.SPRZED.SPRZEDAŻ Fleet management costs Koszty transportu 2028 | 0 |
| PL B.TKW.INFTASTRUKTURA IT equipment rental costs Wyposażenie IT 2028 | 0 |
| PL B.TKW.IT Contract employees IT Contract employees IT - all 2028 | 0 |
| Kapitalizacja - Contract employees IT Kapitalizacja - Contract employees IT 2028 | 10 |
| PL D.SPRZED.SPRZEDAŻ Contract employees sprzedaż Contract employees sprzedaż 2028 | 0 |
| PL D.SPRZED.DELIVERY Contract employees delivery Contract employees delivery 2028 | 0 |
| PL D.SPRZED.MARKETING Contract employees marketing Contract employees marketing 2028 | 0 |
| PL B.TKW.INNE Pozostałe koszta 2028 | 0 |
| Założenia do bilansu BS aassumptions Assets Aktywa 2028 | 1 |
| Tangible fixed assets nieaktywne Rzeczowe aktywa trwałe 2028 | 0 |
| Investment nieaktywne Inwestycja 2028 | 0 |
| Disposal nieaktywne Sprzedaż 2028 | 0 |
| GR B.TKW.AMORTYZACJA Value of amortization nieaktywne Wartość amortyzacji 2028 | 21.317 |
| Investment real estate Inwestycje w nieruchomości Acquisition of investment real estate Nabycie nieruchomości inwestycyjnych 2028 | 0 |
| Sale of investment real estate Sprzedaż nieruchomości inwestycyjnych Value of the company Wartość firmy 2028 | 0 |
| Investment Inwestycja 2028 | 0 |
| Percent of amortization (%) Procent amortyzacji (%) 2028 | 50 |
| Intangible property Wartość niematerialna 2028 | 0 |
| Investment, w tym kapitalizacja Inwestycja 2028 | 80 |
| Disposal Sprzedaż Percent of amortization (%) Procent amortyzacji (%) 2028 | 2 |
| Materials Materiały 2028 | 0 |
| Rotation (days) Obrót (dni) 2028 | 0 |
| Semi-finished and finished products pending Półprodukty i gotowe produkty w toku 2028 | 0 |
| Finished products Gotowe produkty 2028 | 0 |
| Goods Towary 2028 | 0 |
| Advances for deliveries Zaliczki na dostawy 2028 | 0 |
| Receivables from related parties Należności od jednostek powiązanych 2028 | 0 |
| DE Należności z tyt. Sprzedaży 2028 | 0 |
| US Pożyczki 2028 | 0 |
| Receivables from other parties Należności od innych stron 2028 | 0 |
| Net Sales: Przychody ze sprzedazy: 2028 | 0 |
| Marketplace Marketplace 2028 | 0 |
| Digital Twin (SAAS) Digital Twin (SAAS) 2028 | 0 |
| Internet of Things (IoT) Internet of Things (IoT) 2028 | 0 |
| DRD DRD 2028 | 0 |
| Partnershp Program Partnerski 2028 | 0 |
| Receivables: Należności: 2028 | 0 |
| Payment term 2028 | 1 |
| VAT VAT 2028 | 34.244 |
| zwiększenie naliczony 2028 | 22.26 |
| Liabilities - assumptions Pasywa - założenia 2028 | 1 |
| Kaputały Własne Equity attributed to the parent company Kapitał zakładowy 2028 | 0 |
| Revaluation reserve Kapitał zapasowy 2028 | 0 |
| Loan commitments Zobowiązania pożyczkowe 2028 | 0 |
| Leasing Leasing 2028 | 0 |
| Government grants Dotacje rządowe 2028 | 0 |
| Other liabilities to other entities Inne zobowiązania długoterminowe 2028 | 0 |
| Short-term Zobowiązania krótkoterminowe Investment credits Kredyty inwestycyjne 2028 | 0 |
| Working capital loans Kredyty na kapitał obrotowy 2028 | 0 |
| Loans Pożyszki udziałowców 2028 | 0 |
| Factoring Faktoring 2028 | 0 |
| Liabilities due to loans Zobowiązania z tytułu pożyczek od udziałowców 2028 | 0 |
| liabilities under agremment Zobowiązania z tytułu dostaw i usług powiązane 2028 | 0 |
| Rotation of liabilities in days Rotacja zobowiązań w dniach 2028 | 0 |
| Liabilities for deliveries and services and other Zobowiązania z tytułu dostaw i usług niepowiązane 2028 | 0 |
| CREDITS AND LOANS KREDYTY I POŻYCZKI 2028 | 100 |
| BANK ACCOUNTS RACHUNKI BANKOWE 2028 | 0 |
| PIT - SETTLEMENTS ROZRACHUNKI PUB-PR PIT 2028 | 3.011 |
| VAT - SETTLEMENTS ROZRACHUNKI PUB-PR VAT 2028 | 0 |
| SETTLEMENTS WITH ZUS ROZRACHUNKI PUB-PR ZUS 2028 | 13.252 |
| SETTLEMENTS WITH SUPPLIERS ROZRACHUNKI Z DOSTAWCAMI 2028 | 33.203 |
| SETTLEMENTS WITH EMPLOYEES ROZRACHUNKI Z PRACOWNIKAMI 2028 | 12.533 |
| SETTLEMENTS WITH SHAREHOLDERS ROZRACHUNKI Z UDZIAŁOWCAMI 2028 | 144.487 |
| SETTLEMENTS WITH CONTRACTORS ROZRACHUNKI ZE ZLECENIOBIORCAMI 2028 | 0 |
| VAT ACCOUNT RACHUNEK VAT 2028 | 0 |
| Others Variable 2028 | 0 |
| Government grants Zyski nadzwyczajne - Dotacje NCBiR 2028 | 0 |
| NCBiR Rozliczenie Razem 2028 | 0 |
| Dofinansowanie planowane 2028 | 140.56 |
| Grant / Polska Grant / Polska 2028 | 0 |
| Grant / Niemcy Grant / Niemcy 2028 | 0 |
| Grant / USA Grant / USA 2028 | 0 |
| Grant / Japonia Grant / Japonia 2028 | 0 |
| Gropu Licences ICO Licencje Grupowe ICO 2028 | 0 |
| Polska (PLN) 2028 | 0 |
| Niemcy (PLN) 2028 | 0 |
| USA (PLN) 2028 | 0 |
| Japonia (PLN) 2028 | 0 |
| Sensor sales ICO Sprzedaż czujników ICO 2028 | 0 |
| Polska (QTY) Polska (QTY) 2028 | 0 |
| Niemcy (QTY) Niemcy (QTY) 2028 | 0 |
| USA (QTY) USA (QTY) 2028 | 0 |
| Japonia (QTY) Japonia (QTY) 2028 | 0 |
| DE Niemcy (EUR) 75.00 Niemcy (EUR) 2028 | 0 |
| US USA (USD) 75.00 USA (USD) 2028 | 75 |
| JP Japonia (Jen) 2028 | 11.385 |
| Polska (PLN) Polska (PLN) 2028 | 0 |
| Niemcy (PLN) Niemcy (PLN) 2028 | 0 |
| USA (PLN) USA (PLN) 2028 | 0 |
| Japonia (PLN) Japonia (PLN) 2028 | 0 |
| Shares in other entities Udziały i akcje w podmiotach powiązanych 2028 | 0 |
| Niemcy (EUR) Niemcy (EUR) 2028 | 0 |
| USA (USD) USA (USD) 2028 | 0 |
| Japonia (Jen) Japonia (Jen) 2028 | 0 |
| === Sheet: Rev. PL === PL Y - with EU, N - without EU 2028 | 1 |
| PLN Y 2028 | 1 |
| Take rate 2028 | 0 |
| Engineer's support 2028 | 0 |
| Consultant's support 2028 | 0 |
| Licences 2028 | 0 |
| Trainings 2028 | 0 |
| Other 2028 | 0 |
| Partnerships 2028 | 0 |
| Recurring fees 2028 | 0 |
| wzrost 2028 | 91 |
| Market Marketplace IRIS + IoT + DT SAAS Market Produkty specjalizstyczne Partn. Consult. Targi Szkolenia Market 2028 | 25 |
| Market Take rate 2028 | 1 |
| Market Number of transactions 2028 | 0 |
| Market Avg. Transaction value (PLN) 2028 | 1.31 |
| Market Value of transactions (PLN) 2028 | 0 |
| Market Take rate % 2028 | 1 |
| Market Commission PLN 2028 | 0 |
| Market Market TOTAL (PLN) 2028 | 0 |
| DT SAAS DT SAAS DT SAAS DT SAAS 2028 | 50 |
| DT SAAS POLAND DT SAAS QTY 2028 | 1 |
| DT SAAS Trial 2028 | 0 |
| DT SAAS Standard 2028 | 0 |
| DT SAAS Enterprise 2028 | 0 |
| DT SAAS Individual 2028 | 0 |
| DT SAAS Other 2028 | 0 |
| DT SAAS 2028 | 0 |
| DT SAAS DT SAAS TOTAL QTY 2028 | 0 |
| DT SAAS DT SAAS PRICE EUR 2028 | 1 |
| DT SAAS DT SAAS VALUE (PLN) 2028 | 1 |
| DT SAAS DT SAAS TOTAL VALUE POLAND (PLN) 2028 | 0 |
| DT SAAS DT SAAS 2028 | 50 |
| DT SAAS rest of EUROPE: DT SAAS QTY 2028 | 1 |
| DT SAAS DT SAAS RAZEM QTY 2028 | 0 |
| DT SAAS DT SAAS PRICE (PLN) PLN EUR 2028 | 1 |
| DT SAAS DT SAAS TOTAL VALUE rest of EUROPE (PLN) 2028 | 0 |
| DT SAAS DT SAAS TOTAL DT SAAS (PLN) 2028 | 0 |
| IoT IoT IoT 2028 | 25 |
| IoT PL IoT QTY 2028 | 1 |
| IoT Data collector installed total number of invoiced machines/sensors 2028 | 0 |
| IoT Group installations new installations 2028 | 0 |
| IoT Data management total number of invoiced machines/sensors 2028 | 0 |
| IoT IoT TOTAL QTY 2028 | 0 |
| IoT IoT Price USD 2028 | 1 |
| IoT Data collector installed Cost of sensor installation on machines 2028 | 250 |
| IoT Group installations The installation of the communication system for each group of 2028 | 3 |
| IoT Data management Monthly fee for IoT system operation 2028 | 120492 |
| IoT Value 2028 | 1 |
| IoT Data collector installed 2028 | 0 |
| IoT Group installations 2028 | 0 |
| IoT Data management 2028 | 0 |
| Enterprise 2028 | 0 |
| IoT IoT TOTAL PL PLN 2028 | 0 |
| IoT IoT 2028 | 25 |
| IoT Other countries IoT QTY 2028 | 1 |
| IoT IoT TOTAL Other countries 2028 | 0 |
| IoT IoT DT SAAS TOTAL PLN 2028 | 0 |
| DRD QTY 2028 | 1 |
| DRD Map generator Generator mapy rozwoju 2028 | 0 |
| DRD Map workshop Warsztat budowy mapy rozwoju 2028 | 0 |
| DRD Implementation support Wsparcie wdrożeniowe mapy 2028 | 0 |
| DRD DRD DRD DRD DRD TOTAL QTY 2028 | 0 |
| DRD DRD PRICE PLN EUR 2028 | 1 |
| DRD Map generator 2028 | 299299 |
| DRD Map workshop opłata jednorazowa 2028 | 5.319 |
| DRD Implementation support 2028 | 799799 |
| DRD DRD DRD DRD DRD VALUE 2028 | 1 |
| DRD Map workshop 2028 | 0 |
| DRD DRD DRD DRD DRD POLAND PLN 2028 | 0 |
| DRD rest of EUROPE: DRD QTY 2028 | 1 |
| DRD Map workshop one time payment 2028 | 5.319 |
| DRD DRD DRD DRD DRD VALU (PLN) 2028 | 1 |
| DRD DRD DRD DRD DRD EUROPA PLN 2028 | 0 |
| DRD DRD TOTAL DRD PLN 2028 | 0 |
| Partner 2028 | 240000 |
| Partner Showroom Partner ILOŚĆ 2028 | 1 |
| Partner Showroom subscriptions 2028 | 0 |
| Partner Showroom implementations 2028 | 0 |
| Partner Showroom support 2028 | 0 |
| Partner OTHER 2028 | 0 |
| Partner Partner RAZEM QTY 2028 | 0 |
| Partner Partner CENA 2028 | 1 |
| Partner Partner WARTOŚĆ 2028 | 1 |
| Partner Partner POLAND PLN 2028 | 0 |
| Partner Partner 2028 | 50 |
| Partner Other Partner QTY 2028 | 1 |
| Partner ROBOT supplier 2028 | 0 |
| Partner EQUIPMENT supplier 2028 | 0 |
| Partner MACHINE supplier 2028 | 0 |
| Partner Partner PRICE (PLN) 2028 | 1 |
| Partner Partner VALUE (PLN) 2028 | 1 |
| Partner Partner rest of EUROPE PLN 2028 | 0 |
| Partner Partner TOTAL AFFILIATE PROGRAM PLN 2028 | 0 |
| === Sheet: Rev. PL alt === PL Y - with EU, N - without EU 2028 | 1 |
| Digital Twin 2028 | 0 |
| IRIS 2028 | 0 |
| Specialised Products 2028 | 0 |
| Workshops, Trainings 2028 | 0 |
| Implementation support 2028 | 0 |
| Market Marketplace Market Market 2028 | 25 |
| DT SAAS SAAS DT SAAS DT SAAS 2028 | 50 |
| DT SAAS QTY 2028 | 1 |
| DT SAAS Digital Twin 2028 | 0 |
| DT SAAS IRIS 2028 | 0 |
| DT SAAS IoT 2028 | 0 |
| DT SAAS IoT per sensor 2028 | 250 |
| DRD Specialised Products DRD 2028 | 25 |
| DRD Workshops, Trainings 2028 | 0 |
| DRD DRD TOTAL QTY 2028 | 0 |
| DRD Implementation support per h 2028 | 799 |
| DRD DRD VALUE 2028 | 1 |
| DRD DRD TOTAL PLN 2028 | 0 |
| === Sheet: HR structure === Status (All) GR 2028 | 45.095 |
| E/K (All) PL 2028 | 21 |
| Values GR/PL Dział Stan. Osoba Sum of 2028 | 1 |
| GR Administration Administration Junior 2028 | 0 |
| Project Manager Justyna Łaskowska 2028 | 9.2 |
| IT Backend Developer Senior Krystian Wieczorek 2028 | 16.5 |
| CPO / Program Manager Ola Markiewicz 2028 | 18 |
| Developer Jeremiasz Kaźmierczak 2028 | 6.003 |
| Michał Łomżyński 2028 | 7.702 |
| Developer / tester 2028 | 0 |
| Developer Unity Wojciech Wesołowski 2028 | 10 |
| R&D Tomasz Jankowski 2028 | 10.695 |
| Senior Engineer (elektronik) Paweł Dera 2028 | 13.2 |
| Unity Developer Mid Hubert Mielnik 2028 | 0 |
| Management CEO Piotr Wisniewski 2028 | 16.5 |
| Piotr Wisniewski powołanie 2028 | 7 |
| CFO Konrad Stefanik 2028 | 16.5 |
| CLO Paweł Kaliński 2028 | 3.5 |
| CTO Konrad Milewski 2028 | 19.2 |
| Marekting Marketing Katarzyna Szwarocka 2028 | 10.695 |
| GR Total 2028 | 174.695 |
| PL Commercial Delivery 2028 | 0 |
| Delivery Manager Sonia Morawska 2028 | 0 |
| Sales IRIS 2028 | 15.65 |
| Sales Head Katarzyna Marszałkiewicz 2028 | 14 |
| Paulo Soares 2028 | 5 |
| Unity developer junior Mateusz Ochman 2028 | 0 |
| Management CM Polska Bartek Straszak 2028 | 16 |
| Marekting Sales Junor Kamil Kuczek 2028 | 7.722 |
| Sales Senior 2028 | 0 |
| Dorota Drzewiecka 2028 | 0 |
| PL Total 2028 | 64.672 |
| Grand Total 2028 | 239.367 |
| === Sheet: Lab. PL === 2028 | 3.137 |
| Total salary cost 2028 | 0 |
| E GR NIE GROUP Total salary cost 2028 | 0 |
| KAPITALIZACJA E GR TAK to be capitalised 2028 | 21.03 |
| E PL NIE PL Total salary cost 2028 | 0 |
| KAPITALIZACJA E PL TAK to be capitalised 2028 | 0 |
| K GR NIE GROUP Total contract cost 2028 | 0 |
| KAPITALIZACJA K GR TAK to be capitalised 2028 | 74.3 |
| K PL NIE PL Total contract cost 2028 | 0 |
| KAPITALIZACJA K PL TAK to be capitalised 2028 | 10 |
| Headcount 2028 | 0 |
| Function Kontrakt Etat 2028 | 1 |
| Funkcja Stały skład 2028 | 21 |
| To hire E GR E.ZARZ.OGÓLNE NIE Administration Administration Junior ADMINISTRACJA 2028 | 5 |
| To hire K PL D.SPRZED.SPRZEDAŻ NIE Marekting Sales Senior SALES 2028 | 12 |
| To hire K GR B.TKW.IT TAK IT Developer / tester IT 2028 | 15 |
| To hire K PL D.SPRZED.SPRZEDAŻ NIE Commercial Sales SALES 2028 | 10 |
| To hire K PL D.SPRZED.DELIVERY NIE Commercial Delivery DELIVERY 2028 | 8 |
| To hire K GR B.TKW.IT TAK IT Developer Unity IT 2028 | 10 |
| Team K PL B.TKW.IT NIE IT 2028 | 3 |
| Team E PL E.ZARZ.OGÓLNE NIE Management CM Polska MANAGEMENT 2028 | 6 |
| Team K PL D.SPRZED.SPRZEDAŻ NIE Marekting Sales Senior SALES 2028 | 10.16 |
| Team K GR B.TKW.IT TAK IT Unity Developer Mid IT 2028 | 8.5 |
| Team K GR D.SPRZED.DELIVERY NIE Administration Project Manager ADMINISTRACJA 2028 | 9.2 |
| Team K PL D.SPRZED.SPRZEDAŻ NIE Marekting Sales Junor SALES 2028 | 7.722 |
| Team K PL D.SPRZED.SPRZEDAŻ NIE Commercial Sales Head SALES 2028 | 14 |
| Team E GR D.SPRZED.MARKETING NIE Marekting Marketing SALES 2028 | 7 |
| Team K GR B.TKW.IT TAK Management CTO MANAGEMENT 2028 | 18.7 |
| Team K GR E.ZARZ.OGÓLNE NIE Management CFO MANAGEMENT 2028 | 6 |
| Team K GR B.TKW.IT TAK IT Backend Developer Senior IT 2028 | 16.5 |
| Team K PL B.TKW.IT TAK IT Unity developer junior IT 2028 | 10 |
| Team E GR B.TKW.IT TAK IT Developer IT 2028 | 7.01 |
| Team K GR B.TKW.IT TAK IT CPO / Program Manager IT 2028 | 18 |
| Team E PL B.TKW.IT NIE IT 2028 | 3 |
| Team K GR B.TKW.IT TAK IT Senior Engineer (elektronik) IT 2028 | 12.6 |
| Team K GR E.ZARZ.OGÓLNE NIE Management CLO MANAGEMENT 2028 | 6 |
| Team K GR E.ZARZ.OGÓLNE NIE Management CEO MANAGEMENT 2028 | 23 |
| Team K PL D.SPRZED.DELIVERY NIE Commercial Delivery Manager DELIVERY 2028 | 11 |
| Team E GR B.TKW.IT TAK IT R&D IT 2028 | 7.01 |
| Mnożnik grudnia 2028 | 1 |
| Status E/K GR/PL linia kap. Dział Stan. 2028 | 8 |
| SALARIES (GROSS) 2028 | 0 |
| Function Renumeration (Gross) 2028 | 1 |
| TOTAL SALARIES Function Renumeration (Gross) 2028 | 1 |
| Funkcja Wynagrodzenie (Brutto) 2028 | 0 |
| Movement/reduction Function 2028 | 1 |
| Funkcja To hire E GR E.ZARZ.OGÓLNE NIE Administration Administration Junior ADMINISTRACJA 2028 | 0 |
| Ilość pracowników Function Bez proj. Proj. 2028 | 1 |
| K PL E.ZARZ.OGÓLNE NIE ADMINISTRACJA 2028 | 0 |
| K PL E.ZARZ.OGÓLNE NIE MANAGEMENT 2028 | 12 |
| K PL D.SPRZED.MARKETING NIE MARKETING 2028 | 15 |
| K PL D.SPRZED.SPRZEDAŻ NIE SALES 2028 | 10 |
| K PL D.SPRZED.DELIVERY NIE DELIVERY 2028 | 8 |
| E PL E.ZARZ.OGÓLNE NIE ADMINISTRACJA 2028 | 0 |
| E PL E.ZARZ.OGÓLNE NIE MANAGEMENT 2028 | 12 |
| E PL D.SPRZED.MARKETING NIE MARKETING 2028 | 15 |
| E PL D.SPRZED.SPRZEDAŻ NIE SALES 2028 | 10 |
| E PL D.SPRZED.DELIVERY NIE DELIVERY 2028 | 8 |
| Stawki Mnożnik grudnia 2028 | 1 |
| Function Bez proj. Proj. 2028 | 1 |
| K PL D.SPRZED.SPRZEDAŻ NIE MARKETING 2028 | 15 |
| E PL D.SPRZED.SPRZEDAŻ NIE MARKETING 2028 | 15 |
| Koszt razem Function Bez proj. Proj. 2028 | 1 |
| GROUP 2028 | 143.1 |
| Ilość pracowników Function 2028 | 1 |
| Funkcja 2028 | 21 |
| K GR E.ZARZ.Managment NIE Managment 2028 | 3 |
| K GR D.SPRZED.Marketing NIE Marketing 2028 | 0 |
| K GR E.ZARZ.CFO NIE CFO 2028 | 1 |
| K GR E.ZARZ.HR/admin NIE HR/admin 2028 | 1 |
| K GR B.TKW.R&D TAK R&D 2028 | 2 |
| K GR B.TKW.Product manager TAK Product manager 2028 | 1 |
| K GR B.TKW.Dev-unity TAK Dev-unity 2028 | 2 |
| K GR B.TKW.Dev-web TAK Dev-web 2028 | 1 |
| E GR E.ZARZ.Managment NIE Managment 2028 | 0 |
| E GR D.SPRZED.Marketing NIE Marketing 2028 | 0 |
| E GR E.ZARZ.CFO NIE CFO 2028 | 0 |
| E GR E.ZARZ.HR/admin NIE HR/admin 2028 | 0 |
| E GR B.TKW.R&D TAK R&D 2028 | 0 |
| E GR B.TKW.Product manager TAK Product manager 2028 | 0 |
| E GR B.TKW.Dev-unity TAK Dev-unity 2028 | 0 |
| E GR B.TKW.Dev-web TAK Dev-web 2028 | 0 |
| Function 2028 | 1 |
| Koszt razem Function 2028 | 1 |
| K GR B.TKW.Dev-unity TAK Dev.unity 2028 | 20.5 |
| K GR B.TKW.Dev-web TAK Dev.web 2028 | 16 |
| E GR B.TKW.Dev-unity TAK Dev.unity 2028 | 0 |
| E GR B.TKW.Dev-web TAK Dev.web 2028 | 0 |
| STATYSTYKI === Sheet: SQ&A === 2028 | 89 |
| Description DEV/M&S 2028 | 1 |
| Administration 2028 | 0 |
| Expert 2028 | 0 |
| Management 2028 | 0 |
| Marekting 2028 | 0 |
| Zespół 2028 | 1 |
| Commercial 2028 | 0 |
| Commercial UE 2028 | 0 |
| Total Headcount 2028 | 0 |
| GROUP HQ GR HQ Office costs 2028 | 1 |
| GR Administration 2028 | 10 |
| GR Expert 2028 | 0 |
| GR IT 2028 | 5 |
| GR Management 2028 | 7 |
| GR Marekting 2028 | 7 |
| GR Zespół 2028 | 1 |
| GR Commercial 2028 | 5 |
| GR Commercial UE 2028 | 0 |
| GR Total (m 2028 | 2 |
| GR Office - rental cost GR POLAND - Surface (m 2028 | 2 |
| GR POLAND - Price (PLN/m 2028 | 2 |
| GR Total office rental cost NCBiR 2028 | 0 |
| GR Office - other costs GR Media 2028 | 85 |
| GR Total office other costs 2028 | 1 |
| GR GR Total Office costs 2028 | 0 |
| GR Office - investment PLN per capita GR Furniture, general office equipment 2028 | 2500 |
| GR Personal equipment NCBiR 2028 | 11800 |
| GR VR/AR equipment 2028 | 20 |
| GR GR Total office equipment 2028 | 0 |
| GR HQ Licences and SAS costs 2028 | 1 |
| GR Wzrosty: 2028 | 68 |
| GR Kapitalizacja Koszt stały/IoT? GR SaaS - AWS TAK 2028 | 6.37 |
| GR SaaS - Adobe TAK 2028 | 140 |
| GR SaaS - Unity Pro TAK 2028 | 1.458 |
| GR SaaS - Pixyz TAK 2028 | 750 |
| GR SaaS - Digital Ocean TAK 2028 | 2.46 |
| GR SaaS - Sentry TAK 2028 | 830 |
| GR SaaS - Google Cloud Engine TAK 2028 | 0 |
| GR SaaS - Jetbrains TAK 2028 | 614 |
| GR SaaS - GitHub TAK 2028 | 320 |
| GR SaaS - Microsoft TAK 2028 | 0 |
| GR Other software TAK 2028 | 10 |
| GR Server Infrastructure 2028 | 0 |
| GR Salesforce (HUBSPOT) 2028 | 0 |
| GR Mailing/Newsletter 2028 | 0 |
| GR CC Cloud 2028 | 0 |
| GR Linkedin 2028 | 0 |
| GR PHP storm 2028 | 0 |
| GR Other 2028 | 0 |
| GR CAD/Simens/Soldiworks 2028 | 0 |
| GR ERP 2028 | 0 |
| GR Office 2028 | 100 |
| GR GR Total Licences and SAS costs 2028 | 0 |
| GR HQ Fleet management 2028 | 1 |
| GR Fleet - qty car per capita GR Administration 2028 | 0 |
| GR Total fleet - qty 2028 | 0 |
| GR Fleet - rental cost PLN/mth. GR Administration 2028 | 3500 |
| GR Total fleet rental cost 2028 | 0 |
| GR GR Total Fleet cost 2028 | 0 |
| GR HQ IT equipment - rental 2028 | 1 |
| GR IT - rental cost PLN/mth. GR Administration 2028 | 0 |
| GR GR Total IT rental 2028 | 0 |
| GR HQ Other costs 2028 | 1 |
| GR Accounting - external 2028 | 800800 |
| GR Audyt finansowy NCBiR 2028 | 0 |
| GR HR - external 2028 | 0 |
| GR Translations, validations PLN 2028 | 20 |
| GR Wire transfer Web solution 2028 | 0.005 |
| GR Wynajem hardwareu - czujników NCBiR 2028 | 135000 |
| GR Wynajem laboratorium NCBiR 2028 | 15000 |
| GR PLN 2028 | 0 |
| GR GR Total Other costs 2028 | 0 |
| GR HQ Delegations and representation 2028 | 1 |
| GR Number of events per commercial GR POLAND - Small events (DELEGACJA PL?) 2028 | 2 |
| GR POLAND - Large event (DELEGACJA EU?) 2028 | 1 |
| GR Price PLN GR POLAND - Small events 2028 | 1200 |
| GR POLAND - Large event 2028 | 4500 |
| GR GR Total Delegations and representation 2028 | 0 |
| GR PL Marketing and conferences 2028 | 1 |
| GR Number of events GR Fairs / Large Conferences 2028 | 0 |
| GR Fairs / Small Conferences / Online 2028 | 0 |
| GR Marketing online 2028 | 0 |
| GR Others 2028 | 0 |
| GR Cost of events PLN GR Fairs / Large Conferences 2028 | 30000 |
| GR GR Total Marketing and conferences 2028 | 0 |
| PL Bussiness development PL PL Office costs 2028 | 1 |
| PL PL - Surface (m 2028 | 2 |
| PL PL - Price (PLN/m 2028 | 2 |
| PL PL Office - other costs PL 2028 | 0 |
| PL PL Total PL Office costs M&S 2028 | 0 |
| PL PL Delegations and representation 2028 | 1 |
| PL Number of events / personal developent, trainings per commercial PL PL - Small events 2028 | 3 |
| PL PL - Large event 2028 | 0 |
| PL Price PLN PL PL - Small events 2028 | 5000 |
| PL PL Total Delegations and representation (GR) M&S 2028 | 0 |
| PL PL Marketing and conferences 2028 | 1 |
| PL Number of events PL Fairs / Large Conferences 2028 | 0 |
| PL Fairs / Small Conferences / Online 2028 | 0 |
| PL Marketing online 2028 | 0 |
| PL Others 2028 | 0 |
| PL Cost of events PLN PL Fairs / Large Conferences 2028 | 30000 |
| PL PL Total Marketing and conferences M&S 2028 | 0 |
| PL PL Consultant and legal fees 2028 | 1 |
| PL Legal consultants PL Poland 2028 | 8000 |
| PL Germany 2028 | 8000 |
| PL France 2028 | 8000 |
| PL Benelux 2028 | 8000 |
| PL Spain 2028 | 8000 |
| PL Italy 2028 | 8000 |
| PL Czech Rep. 2028 | 8000 |
| PL Slovakia 2028 | 8000 |
| PL Sweden 2028 | 8000 |
| PL HR&Accounting PLN PL Poland 2028 | 13500 |
| PL PL Total Consultant and legal fees M&S 2028 | 0 |
| PL PL Fleet management 2028 | 1 |
| PL Fleet - qty car per capita PL Commercials PL 2028 | 1 |
| PL Fleet - rental cost PLN/mth. PL Commercials PL 2028 | 2500 |
| PL Commercials PL 2028 | 2220 |
| PL PL Total Fleet management M&S 2028 | 0 |
| === Sheet: Amort. PL === Groups of fixed assets Grupy środków trwałych 2028 | 1 |
| Lands Grunty 2028 | 0 |
| Disposal Sprzedaż 2028 | 0 |
| Rate of amortization Stopa amortyzacji 2028 | 0 |
| Buildings Budynki i lokale 2028 | 0 |
| Building structure Budowle 2028 | 0 |
| Boilers and power machines Kotły i maszyny energetyczne 2028 | 0 |
| Machines and equipment for general purpose Maszyny i urządzenia ogolnego przeznaczenia 2028 | 0 |
| Special machines and equipment Marzyny i urządzenia specjalistyczne 2028 | 0 |
| Technical devices Urządzenia techniczne 2028 | 0 |
| Transportation Środki transportu 2028 | 0 |
| Toolings Narządzia i przyżądy ruchome 2028 | 0 |
| Assets under construction Środki trwałe w budowie 2028 | 0 |
| Total fixed assets Razem (środki trwałe) 2028 | 0 |
| === Sheet: Fin. PL === 2028 | 125.178 |
| Kredyty New shares: 2028 | 3.91 |
| Źródła finansowania Sources of funding 2028 | 1 |
| Statutory fund EQUITIES 2028 | 0 |
| Wzrost kapitału zakładowego Unpaid benefits 2028 | 3.45 |
| Pokrycie strat Coverage of losses 2028 | 0 |
| Pozyskiwanie kapitału Raising equity 2028 | 0 |
| Nabycie akcji własnych Purchase of own shares 2028 | 0 |
| ZOBOWIĄZANIA DŁUGOTERMINOWE LONG-TERM LIABILITIES Kredyt inwestycyjny Liabilities to banks due to investment loans 2028 | 0 |
| Wzrost zadłużenia Increase in debt 2028 | 0 |
| Spłata długu Repayment of debt 2028 | 0 |
| Koszt finansowania The cost of financing 2028 | 0.5 |
| Wartość odsetek Interest value 2028 | 0 |
| Zobowiązania pożyczkowe Liabilities due to other loans 2028 | 0 |
| Other financial liabilities Other financial liabilities 2028 | 0 |
| Government grants Government grants 2028 | 0 |
| Kredyt obrotowy Liabilities due to loans 2028 | 0 |
| Kredyty w rachunku bieżącym Liabilities due to loans 2028 | 0 |
| Faktoring Liabilities due to loans 2028 | 0 |
| Zobowiązania z tytułu pożyczki Liabilities due to loans 2028 | 0 |
| Zobowiązania z tytułu leasingu Liabilities due to loans 2028 | 0 |
| Pożyczka Liabilities due to loans 2028 | 0 |
| Finansowanie zewnętrzne External financing 2028 | 0 |
| Wzrost zadłużenia Debt increase 2028 | 0 |
| Wartość odsetek Interest 2028 | 0 |
| Opis Description 2028 | 3 |
| A. AKTYWA TRWAŁE A. FIXED ASSETS 2028 | 0 |
| B. AKTYWA OBROTOWE B CURRENT ASSETS 2028 | 0 |
| a. Materiały a. Raw materials 2028 | 0 |
| b. Półprodukty i produkty w toku b. Semi-finished products and work in progress 2028 | 0 |
| Produkty gotowe c. Finished products 2028 | 0 |
| Towary d. Goods 2028 | 0 |
| e. Zaliczki na poczet dostaw e. Advances for deliveries 2028 | 0 |
| a. Należności od podmiotów powiązanych a. Receivables from related parties 2028 | 0 |
| b. Należności od pozostałych podmiotów b. Receivables from other entities 2028 | 0 |
| A. KAPITAŁ WŁASNY OGÓŁEM A. TOTAL SHAREHOLDERS' EQUITY 2028 | 0 |
| B. ZOBOWIĄZANIA DŁUGOTERMINOWE B. LONG-TERM LIABILITIES 2028 | 0 |
| a. Zobowiązania wobec banków z tytułu kredytów a. Bank loans to be repaid 2028 | 0 |
| b. Zobowiązania pożyczkowe b. Borrowings 2028 | 0 |
| Pozostałe zobowiązania finansowe d. Other external financing sources 2028 | 0 |
| a. Dotacje rządowe a. Government subsidies 2028 | 0 |
| b.Pozostałe zobowizania b. Other liabilities 2028 | 0 |
| Wobec podmiotów powiązanych To related parties 2028 | 0 |
| Wobec pozostałych podmiotów To other entities 2028 | 0 |
| ZOBOWIĄZANIA KRÓTKOTERMINOWE C. SHORT-TERM LIABILITIES 2028 | 0 |
| Kredyty inwestycyjne Investment loans 2028 | 0 |
| Kredyty obrotowe Working capital loans 2028 | 0 |
| Kredyty w rachunku bieżącym (overdrafty) Overdrafts 2028 | 0 |
| b. Zobowiązania z tytułu pożyczek b. Borrowings to be repaid 2028 | 0 |
| Zobowiązania z tytułu leasingu c. Leasing 2028 | 0 |
| a. Do jednostek powiązanych a.To related parties 2028 | 0 |
| Z tytułu dostaw i usług Trade liabilities 2028 | 0 |
| Z tytułu dywidend i innych zobowiązań kapitałowych Dividends and other capital liabilities 2028 | 0 |
| pozostałe zobowiązania Other liabilities 2028 | 0 |
| b. Do pozostałych jednostek b.To other entities 2028 | 0 |
| z tytułu wynagrodzeń Payroll 2028 | 0 |
| Pozostałe zobowiązania Other liabilities (including contingent, regarding acquisition of companies) 2028 | 0 |
| Dotacje rządowe c. Government subsidies d. Fundusze specjalne d. Special funds 2028 | 0 |
| a. Rezerwa na świadczenia pracownicze a.Provision for employee benefits 2028 | 0 |
| b.Pozostałe rezerwy krótkoterminowe b. Other short-term provisions 2028 | 5 |
| PASYWA LIABILITIES 2028 | 0 |
| Wariant PORÓWNAWCZY: Opis Description 2028 | 1 |
| A. Przychody ze sprzedaży netto A. Net Sales 2028 | 0 |
| B. Koszty działalności operacyjnej B. Operating expenses 2028 | 0 |
| Zysk (strata) ze sprzedaży (A-B) C. Profit (loss) on sales (A-B) 2028 | 0 |
| Pozostałe przychody operacyjne D. Other operating income 2028 | 0 |
| E. Pozostałe koszty operacyjne E. Other operating expenses 2028 | 0 |
| G. Przychody finansowe G. Financial income 2028 | 0 |
| H. Koszty finansowe H. Financial costs 2028 | 0 |
| K. Zysk (strata) brutto (I±J) K. Gross profit (loss) (I ± J) 2028 | 0 |
| Podatek dochodowy L. CIT 2028 | 0 |
| N. Zysk (strata) netto (K-L-M) N. Net profit (loss) (Q-L-M) 2028 | 0 |
| Wariant KALKULACYJNY: #DIV/ 2028 | 0 |
| Opis Opis 2028 | 1 |
| Przychody netto ze sprzedaży produktów I. Przychody netto ze sprzedaży produktów 2028 | 0 |
| Big Data (MaaS) Big Data (MaaS) 2028 | 0 |
| Program Partnerski Program Partnerski 2028 | 0 |
| B.ICO – jednostkom powiązanym – jednostkom powiązanym 2028 | 0 |
| B.TKW I. Koszt wytworzenia sprzedanych produktów I. Koszt wytworzenia sprzedanych produktów 2028 | 0 |
| B.MAT II. Wartość sprzedanych towarów i materiałów II. Wartość sprzedanych towarów i materiałów 2028 | 0 |
| D.SPRZED D. Koszty sprzedaży D. Koszty sprzedaży 2028 | 0 |
| E.ZARZ E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu 2028 | 0 |
| G. Pozostałe przychody operacyjne G. Pozostałe przychody operacyjne 2028 | 0 |
| Dotacje II. Dotacje 2028 | 0 |
| Inne przychody operacyjne IV. Inne przychody operacyjne 2028 | 0 |
| H. Pozostałe koszty operacyjne H. Pozostałe koszty operacyjne 2028 | 0 |
| Aktualizacja wartości aktywów niefinansowych II. Aktualizacja wartości aktywów niefinansowych 2028 | 0 |
| Inne koszty operacyjne III. Inne koszty operacyjne 2028 | 0 |
| J. Przychody finansowe J. Przychody finansowe 2028 | 0 |
| b) od jednostek pozostałych, w tym: b) od jednostek pozostałych, w tym: 2028 | 0 |
| Odsetki II. Odsetki 2028 | 0 |
| Aktualizacja wartości aktywów finansowych IV. Aktualizacja wartości aktywów finansowych 2028 | 0 |
| Inne V. Inne 2028 | 0 |
| K. Koszty finansowe K. Koszty finansowe 2028 | 0 |
| Odsetki, w tym: I. Odsetki, w tym: 2028 | 0 |
| Aktualizacja wartości aktywów finansowych III. Aktualizacja wartości aktywów finansowych 2028 | 0 |
| Inne IV. Inne 2028 | 0 |
| Zysk (strata) brutto (I+J–K) L. Zysk (strata) brutto (I+J–K) 2028 | 0 |
| N. Pozostałe obowiązkowe zmniejszenia zysku (zwiększenia straty) N. Pozostałe obowiązkowe zmniejszenia zysku (zwiększenia straty) 2028 | 0 |
| Zysk (strata) netto (L–M–N) Zysk (strata) netto (L–M–N) 2028 | 0 |
| A. Przepływy środków pieniężnych z działalności operacyjnej A. Cash flow from operating activities 2028 | 0 |
| a. Amortyzacja a. Amortisation and depreciation 2028 | 0 |
| f. Zmiana stanu zapasów f. Change in inventory 2028 | 0 |
| g. Zmiana stanu należności g. Change in receivables 2028 | 0 |
| Zmiana stanu rozliczeń międzyokresowych i. Change in prepayments and accurals 2028 | 0 |
| j. Inne korekty j. Other adjustments 2028 | 0 |
| B. Przepływy środków pieniężnych z działalności inwestycyjnej B. CF from investment activities 2028 | 0 |
| a. Zbycie wartości niematerialnych i prawnych a. Disposal of intangible and tangible fixed assets 2028 | 0 |
| Wpływy aktywów finansowych, w tym c. From financial assets, including: 2028 | 0 |
| zbycie aktywów finansowych sales of financial assets 2028 | 0 |
| otrzymane dywidendy i udziały w zyskach dividend and profit sharing 2028 | 0 |
| otrzymane spłaty pożyczek długoterminowych repayment of granted L-term loans 2028 | 0 |
| odsetki otrzymane interest 2028 | 0 |
| inne wpływy z aktywów finansowych other inflows from financial assets 2028 | 0 |
| Na aktywa finansowe, w tym c. For financial assets, including: 2028 | 0 |
| nabycie aktywów finansowych purchase of financial assets 2028 | 0 |
| udzielone pożyczki długoterminowe L-term loans granted 2028 | 0 |
| Przepływy środków pieniężnych z działalności finansowej C. CF from financial activities 2028 | 0 |
| b. Kredyty i pożyczki b. Credits and loans 2028 | 0 |
| Emisja dłużnych papierów wartościowych c. Issuance of debt securities 2028 | 0 |
| Inne wpływy finansowe d. Other inflows form financial activities 2028 | 0 |
| a. Nabycie udziałów własnych a. Purchase of own shares 2028 | 0 |
| Spłaty kredytów i pożyczek d. Repayment of credits and loans 2028 | 0 |
| e. Wykup dłużnych papierów wartościowych e. Redemption of debt securities 2028 | 0 |
| f. Z tyt. zobowiązań finansowych f. Payment of other financial liabilities 2028 | 0 |
| g.. Płatności z umów leasingu finansowego g. Payment of liabilities arising from financail leases 2028 | 0 |
| h. Odsetki h. Interest 2028 | 0 |
| Inne wydatki finansowe i. Other outflows from financial activities 2028 | 0 |
| Przepływy pieniężne netto razem D. Total net Cash Flow 2028 | 0 |
| E. Środki pieniężne na początek okresu E. Cash opening balance 2028 | 0 |
| F. Środki pieniężne na koniec okresu F. Closing balance of cash 2028 | 0 |
| Wskaźniki rentowności aktywów wynik fin netto / aktywa % Wskaźnik rentowności netto aktywów (ROA) 2028 | -9.2 |
| wynik fin brutto / aktywa % Wskaźnik rentowności brutto aktywów 2028 | -9.2 |
| zysk zatrzymany / aktywa % Wskaźnik rentowności skumulowanej aktywów 2028 | -9.2 |
| wynik netto / aktywa trwałe % Wskaźnik rentowności aktywów trwałych 2028 | -862.7 |
| wynik netto / aktywa obrotowe % Wskaźnik rentowności aktywów obrotowych 2028 | -9.2 |
| wynik netto / aktywa netto % Wskaźnik rentowności aktywów netto 2028 | -9.2 |
| Wskaźniki rentowności sprzedaży wynik finansowy netto / Przychody ogółem % Wskaźnik rentowności netto sprzedaży 2028 | -263.2 |
| wynik finansowy brutto / Przychody ogółem % Wskaźnik rentowności brutto sprzedaży 2028 | -263.2 |
| wynik z działalności gosp. / przychodzy z działalności gosp. % Wskaźnik rentowności gospodarczej sprzedaży 2028 | -263.2 |
| wynik z działalności oper. / Przychodzy z działalności oper. % Wskaźnik rentowności operacyjnej sprzedaży 2028 | -263.2 |
| wynik ze sprzedaży / przychodzy ze sprzedaży % Wskaźnik rentownosci sprzdaży (produktów, towarów) 2028 | -263.2 |
| wynik finansowy netto / Przychody netto ze sprzedaży % Wskaźnik rentowności sprzedaży netto (ROS) 2028 | -263.2 |
| koszty / przychody % Wskaźnik poziomu kosztów 2028 | 363.2 |
| Wskaźniki rentowności kapitałów wynik netto / kapitał całkowity % Wskaźniki rentowności kapitału całkowitego 2028 | -9.2 |
| wynik netto / kapitał własny % Wskaźniki rentowności netto kapitału własnego (ROE) 2028 | -9.2 |
| wynik brutto / kapitał własny % Wskaźniki rentowności brutto kapitału własnego (ROEb) 2028 | -9.2 |
| wynik netto / kapitał zakładowy % Wskaźnik rentowności kapitału zakładowego 2028 | -8.4 |
| Wskaźniki płynności finansowej aktywa obrotowe / zobowiązania krótkoterminowe Wskaźnik bieżącej płynności finansowej (płynność III stopnia) 2028 | 29983.9 |
| płynne aktywa obrotowe / zobowiązania krótkoterminowe Wskaźnik szybkiej płynności inansowej (płynność II stopnia) 2028 | 29983.9 |
| środki pieniężne / zobowiązania krótkoterminowe Wskaźnik płynności gotówkowej (płynność I stopnia) 2028 | 17353.6 |
| KON / zapasy + należności krótkoterminowe % Wskaźnik udziału kapitału obrotowego netto w finansowaniu aktywów obrotowych 2028 | 4095.2 |
| kapitał obrotowy / aktywa ogółem % Wskaźnik kapitału obrotowego do aktywów ogółem 2028 | 100 |
| kapitał obrotowy / aktywa obrotowe % Wskaźnik kapitału obrotowego do aktywów obrotowych 2028 | 100 |
| kapitał obrotowy / zapasy + należności % Wskaźnik kapitału obrotowego do zapasów i należności 2028 | 4095.2 |
| kapitał obrotowy / zobowiązania krótkoterminowe % Wskaźnik kapitału obrotowego do zobowiązań krótkoterminowych 2028 | 29883.9 |
| Przychody ogółem / Aktywa trwałe Wskaźnik rotacji aktywów trwałych 2028 | 206.5 |
| Przychody ogółem / Zobowiązania Wskaźnik rotacji zobowiązań w razach 2028 | 180.43 |
| Zobowiązania / Przychody ogółem x 2028 | 365 |
| Analiza rotacji kapitałów Przychody ze sprzedaży / Kapitał całkowity Wskaźnik rotacji kapitałów w razach 2028 | 0.03 |
| Przychody ze sprzedaży / Kapitał własny Wskaźnik rotacji kapitału własnego w razach 2028 | 0.03 |
| Przychody ze sprzedaży / Zobowiązania Wskaźnik rotacji zobowiązań w razach 2028 | 180.43 |
| Przychody ze sprzedaży / Zobowiązania krótkoterminowe Wskaźnik rotacji zobowiązań krótkoterminowych w razach 2028 | 180.43 |
| Zobowiązania krótkoterminowe / Przychody ze sprzedaży x 2028 | 365 |
| Analiza poziomu zadłużenia Zobowiązania ogółem / Aktywa ogółem Wskaźnik ogólnego zadłużenia 2028 | 0 |
| Kapitał własny / Aktywa ogółem Wskaźnik pokrycia aktywów kapitałem własnym 2028 | 100 |
| Zobowiązania długoterminowe / Kapitał własny x 2028 | 100 |
| Zobowiązania krótkoterminowe / kapitał własny x 2028 | 100 |
| Zobowiązania długoterminowe / Zobowiązania ogółem Wskaźnik struktury zobowiązań długoterminowych 2028 | 0 |
| Zobowiązania krótkoterminowe / Zobowiązania ogółem Wskaźnik struktury zobowiązań krótkoterminowych 2028 | 100 |
| Zobowiązania ogółem / Kapitał własny Wskaźnik zadłużenia kapitału własnego 2028 | 0 |
| Zobowiązania długoterminowe / Kapitał własny Wskaźnik długoterminowego zadłużenia kapitału własnego 2028 | 0 |
| ROEb / ROAbo Wskaźnik efektu dźwigni finansowej 2028 | 100 |
| Net Sales Przychody netto ze sprzedaży razem 2028 | 0 |
| c) Internet of Things (IoT) c) Internet of Things (IoT) 2028 | 0 |
| Amortization Amortyzacja 2028 | 0 |
| B.TKW Zużycie materiałów i energii razem 2028 | 0 |
| Udział do dochodu 2028 | 0 |
| External services Usługi zewnętrzne 2028 | 0 |
| E.ZARZ Office (+ 2028 | 199 |
| B.TKW Fleet Flota 2028 | 500 |
| Variables: Zmienne: B.ICO Group licences Licencje grupowe 2028 | 10 |
| D.SPRZED Commissions for Sales Prowizje dla Salesów 2028 | 5 |
| D.SPRZED Fuel Paliwo 2028 | 200 |
| Gross remuneration Wynagrodzenia brutto 2028 | 0 |
| % rate change Zmiana stawki % 2028 | 10 |
| MARKETING MARKETING - - 2028 | 8.9 |
| SALES SALES - - 2028 | 8.9 |
| B.TKW DELIVERY DELIVERY 2028 | 0 |
| Share of income Udział do dochodu 2028 | 0 |
| Change Proporcja 2028 | 0 |
| Other costs by type Inne koszty według rodzaju 2028 | 0 |
| Value of goods and materials sold Wartość sprzedanych towarów i materiałów 2028 | 0 |
| ICO - material purchase ICO - material purchase ICO price EUR 2028 | 75 |
| Other operating revenues Pozostałe przychody operacyjne 2028 | 0 |
| Zmiana 2028 | 0 |
| Other operating cost Pozostałe koszty operacyjne 2028 | 0 |
| Financial income interest Odsetki od dochodów finansowych 2028 | 0 |
| Zmiana Financial costs interest Pozostałe koszty finansowe 2028 | 0 |
| Gross profit Gross profit 2028 | 0 |
| Cumulative Gross profit Cumulative Gross profit 2028 | 0 |
| Tax rate Realna stopa procentowa (CIT+podatek od osób prawnych) 2028 | 30 |
| Tangible fixed assets Rzeczowe aktywa trwałe 2028 | 0 |
| Value of amortization Wartość amortyzacji est. 2028 | 0 |
| Equity Kaputały Własne Equity attributed to the parent company Kapitał zakładowy 2028 | 0 |
| Loans in current account (overdrafts) Kredyty w rachunku bieżącym 2028 | 0 |
| Liabilities due to loans Zobowiązania z tytułu pożyczek 2028 | 0 |
| Government grants Dotacje rządowe === Sheet: Rev. DE === DE Y - with EU, N - without EU 2028 | 1 |
| EUR Y 2028 | 1 |
| Market Number of Projects 2028 | 1 |
| Market Polska 2028 | 0 |
| Market Niemcy 2028 | 0 |
| Market Francja 2028 | 0 |
| Market Benelux 2028 | 0 |
| Market Hiszpania 2028 | 0 |
| Market Włochy 2028 | 0 |
| Market Czechy 2028 | 0 |
| Market Słowacja 2028 | 0 |
| Market Szwecja 2028 | 0 |
| Market Market TOTAL QTY 2028 | 0 |
| Market Market Avg. Project value CAPEX EUR CAPEX PLN 2028 | 1 |
| Market Market Project value 2028 | 1 |
| Market Market TOTAL project value 2028 | 0 |
| Market Market % take rate 2028 | 1 |
| Market Market Take rate 2028 | 1 |
| Market Market TOTAL Sales divided in two steps 2028 | 50 |
| DT SAAS DT SAAS DT SAAS 2028 | 100 |
| DT SAAS DE DT SAAS QTY 2028 | 1 |
| DT SAAS Visualization 2028 | 0 |
| DT SAAS Simulation 2028 | 0 |
| DT SAAS Algorithmization 2028 | 2 |
| DT SAAS DT SAAS Value 2028 | 1 |
| DT SAAS DT SAAS TOTAL DE EUR 2028 | 0 |
| DT SAAS Other countries DT SAAS QTY 2028 | 1 |
| DT SAAS DT SAAS Price PLN EUR 2028 | 1 |
| DT SAAS DT SAAS TOTAL other countries EUR 2028 | 0 |
| DT SAAS DT SAAS DT SAAS TOTAL EUR 2028 | 0 |
| IoT DE IoT QTY 2028 | 1 |
| IoT Data collector installations total number of invoiced machines/sensors 2028 | 0 |
| IoT IoT RAZEM QTY 2028 | 0 |
| IoT IoT Price EUR 2028 | 1 |
| IoT Data collector installations Cost of sensor installation on machines per machine 2028 | 250250 |
| IoT Data management Monthly fee for IoT system operation per machine 2028 | 120120 |
| IoT Data collector installations 2028 | 0 |
| IoT IoT TOTAL DE EUR 2028 | 0 |
| IoT IoT DT SAAS TOTAL EUR 2028 | 0 |
| DRD DE DRD QTY 2028 | 1 |
| DRD DRD DRD DRD DRD TOTAL DE EUR 2028 | 0 |
| DRD Other countries DRD QTY 2028 | 1 |
| DRD DRD DRD DRD DRD TOTAL other countries EUR 2028 | 0 |
| DRD DRD DRD TOTAL EUR 2028 | 0 |
| Partner Showroom Partner QTY 2028 | 1 |
| Partner Partner TOTAL QTY 2028 | 0 |
| Partner Partner Price EUR 2028 | 1 |
| Partner Partner VALUE 2028 | 1 |
| Partner Partner TOTAL DE EUR 2028 | 0 |
| Partner Partner Account 2028 | 0 |
| Partner Implementations/Services 2028 | 0 |
| Partner Partner TOTAL other countries EUR 2028 | 0 |
| Partner Partner TOTAL Partnerships EUR 2028 | 0 |
| === Sheet: Amort. DE === Groups of fixed assets Grupy środków trwałych 2028 | 1 |
| Unidentified Niezidentyfikowane 2028 | 0 |
| Kredyty Loans Źródła finansowania Sources of funding 2028 | 1 |
| Zestawienie projektów w budżecie Marpol Kapitał podstawowy EQUITIES 2028 | 0 |
| Niezapłacone świadczenia Unpaid benefits 2028 | 0 |
| Wpłaty na kapitał własny Coverage of losses 2028 | 0 |
| ZOBOWIĄZANIA DŁUGOTERMINOWE LONG-TERM LIABILITIES Kredyt inwestycyjny Liabilities to banks due to loans 2028 | 0 |
| Zobowiązania pożyczkowe Liabilities to banks due to loans 2028 | 0 |
| Partycypacja lokatorów, kaucje / waloryzacja Wzrost zadłużenia Increase in debt 2028 | 0 |
| Spłata długu Repayment of debt Koszt finansowania The cost of financing 2028 | 0 |
| Kredyt obrotowy Loans in current account (overdrafts) 2028 | 0 |
| Kredyty w rachunku bieżącym Loans in current account (overdrafts) 2028 | 0 |
| Faktoring Loans in current account (overdrafts) 2028 | 0 |
| Zobowiązania z tytułu pożyczki Loans in current account (overdrafts) 2028 | 0 |
| Liabilities due to loans 2028 | 0 |
| Wartość odsetek 2028 | 0 |
| Faktoring Factoring 2028 | 0 |
| Bilans Balance Sheet 2028 | 0 |
| P&L Opis Description 2028 | 1 |
| === Sheet: Ass. US === B.TKW B.MAT Cash 2028 | 0 |
| D.SPRZED E.ZARZ P&L 2028 | 0 |
| P&L aassumptions P&L Assumptions 2028 | 1 |
| Net Sales total Net Sales total 2028 | 0 |
| Lines: Lines: 2028 | 0 |
| e) Partnerships e) Partnerships 2028 | 0 |
| Change Change in the balance of products Zmiana stanu produktów 2028 | 0 |
| Zużycie materiałów i energii razem 2028 | 0 |
| E.ZARZ Office Biuro 2028 | 250 |
| B.TKW Accommodation cost (housing, car rental) Accommodation cost (housing, car rental) 2028 | 450 |
| D.SPRZED Participation in industry events Participation in industry events 2028 | 200 |
| Change Udział do dochodu 2028 | 0 |
| RATES STAWKI ADMINISTRATION ADMINISTRACJA 2028 | 5 |
| Social security and other benefits Narzuty na wynagrodzenia 2028 | 0 |
| Proporcja 2028 | 0 |
| Financial income interest Odsetki od dochodów finansowych Zmiana Financial income interest Pozostałe koszty finansowe 2028 | 0 |
| Taxable income Dochód do opodatkowania 2028 | 0 |
| Gross Receipts Tax 2028 | 0.39 |
| Franchise tax 2028 | 600 |
| Tax rate Realna stopa procentowa (podatek dochodowy, federalny) 2028 | 30 |
| Obrót (dni) 2028 | 0 |
| Government grants Dotacje rządowe === Sheet: Rev. US === USA Y - with EU, N - without EU 2028 | 1 |
| USD Y 2028 | 1 |
| Market Marketplace Market 2028 | 280 |
| Market 2028 | 536 |
| Market USA 2028 | 0 |
| Market Market Avg. Project value CAPEX USD CAPEX PLN 2028 | 1 |
| Market Market Take rate Sales divided in two steps 2028 | 50 |
| Market Market TOTAL 2028 | 0 |
| DT SAAS USA DT SAAS QTY 2028 | 1 |
| DT SAAS Enterpise 2028 | 0 |
| DT SAAS DT SAAS Price USD 2028 | 1 |
| DT SAAS DT SAAS TOTAL USA USD 2028 | 0 |
| DT SAAS DT SAAS TOTAL other countries USD 2028 | 0 |
| DT SAAS DT SAAS DT SAAS TOTAL USD 2028 | 0 |
| IoT USA IoT QTY 2028 | 1 |
| IoT Enterprise 2028 | 0 |
| IoT IoT TOTAL USA USD 2028 | 0 |
| IoT IoT DT SAAS TOTAL USD 2028 | 0 |
| DRD USA DRD QTY 2028 | 1 |
| DRD LeanAutomation report 2028 | 0 |
| DRD DRD Price USD 2028 | 1 |
| DRD DRD DRD DRD DRD TOTAL USA USD 2028 | 0 |
| DRD DRD PRICE USD USD 2028 | 1 |
| DRD DRD DRD DRD DRD TOTAL other countries USD 2028 | 0 |
| DRD DRD DRD TOTAL USD 2028 | 0 |
| Partner Partner Price USD 2028 | 1 |
| Partner Partner TOTAL USA USD 2028 | 0 |
| Partner Partner TOTAL other countries USD 2028 | 0 |
| Partner Partner TOTAL Partnerships USD 2028 | 0 |
| === Sheet: Amort. US === Groups of fixed assets Grupy środków trwałych 2028 | 1 |
| === Sheet: Statement JAP === FX USD/YEN 2028 | 170.83 |
| Repayment of credits and loans Opis e. Redemption of debt securities 2028 | 1 |
| Przychody netto ze sprzedaży produktów h. Interest 2028 | 0 |
| Big Data (MaaS) D. Total net Cash Flow 2028 | 0 |
| DRD E. Cash opening balance 2028 | 0 |
| Program Partnerski F. Closing balance of cash 2028 | 0 |
| Lines Przychody netto ze sprzedaży usług 2028 | 0 |
| Consumption of materials and energy Zużycie materiałów i energii razem 2028 | 0 |
| MANAGEMENT MANAGEMENT 2028 | 1.281 |
| Taxable profit Dochód do opodatkowania 2028 | 0 |
| Real interest rate Realna stopa procentowa (podatek dochodowy 2028 | 30 |
| Leasing Zobowiazania z tytułu leasingu 2028 | 0 |
| Government grants Granty 2028 | 0 |
| === Sheet: Rev. JAP === JAPAN Y - with EU, N - without EU 2028 | 1 |
| YEN Y 2028 | 1 |
| brak MP wzrost 2028 | 200 |
| tylko SAAS Market Marketplace go to Market Market Market 2028 | 250 |
| Market JAPAN 2028 | 0 |
| DT SAAS JAPAN DT SAAS QTY 2028 | 1 |
| DT SAAS DT SAAS Price USD Jen 2028 | 1 |
| DT SAAS DT SAAS TOTAL JAPAN YEN 2028 | 0 |
| DT SAAS DT SAAS Price EUR JEN 2028 | 1 |
| DT SAAS DT SAAS TOTAL other countries YEN 2028 | 0 |
| DT SAAS DT SAAS DT SAAS TOTAL YEN 2028 | 0 |
| IoT JAPAN IoT QTY 2028 | 1 |
| IoT IoT TOTAL JAPAN YEN 2028 | 0 |
| IoT IoT DT SAAS TOTAL YEN 2028 | 0 |
| DRD JAPAN DRD QTY 2028 | 1 |
| DRD DRD Price USD JEN 2028 | 1 |
| DRD DRD DRD DRD DRD TOTAL JAPAN YEN 2028 | 0 |
| DRD DRD DRD DRD DRD TOTAL other countries YEN 2028 | 0 |
| DRD DRD DRD TOTAL YEN 2028 | 0 |
| Partner USA Partner QTY 2028 | 1 |
| Partner Partner Price USD JEN 2028 | 1 |
| Partner Partner TOTAL JAPAN YEN 2028 | 0 |
| Partner Other countries Partner QTY 2028 | 1 |
| Partner Partner PRICE EUR EUR 2028 | 1 |
| Partner Partner TOTAL other countries YEN 2028 | 0 |
| Partner Partner TOTAL Partnerships YEN 2028 | 0 |
| === Sheet: Amort. JAP === Groups of fixed assets Grupy środków trwałych 2028 | 1 |
| === Sheet: Ass. AS === B.TKW B.MAT Cash 2028 | 0 |
| B.TKW Insurances (health) Insurances (health) - 2028 | 500500 |
| D.SPRZED Marketing Start of dedicated marketing for the US market (SEO) 2028 | 3 |
| D.SPRZED Partnership with manufacturing associations Partnership with manufacturing associations in the US - 2028 | 500500 |
| Market Marketplace projekty na zero Market koszty stałe 2028 | 3 |
| Market koszt lokalizacji 2028 | 46 |
| Market Saudi Arabia 2028 | 0 |
| DT SAAS Saudi Arabia DT SAAS QTY 2028 | 1 |
| DT SAAS DT SAAS TOTAL Saudi Arabia USD 2028 | 0 |
| IoT Saudi Arabia IoT QTY 2028 | 1 |
| IoT IoT TOTAL Saudi Arabia USD 2028 | 0 |
| DRD Saudi Arabia DRD QTY 2028 | 1 |
| DRD DRD DRD DRD DRD TOTAL Saudi Arabia USD 2028 | 0 |
| Partner Partner TOTAL Saudi Arabia USD 2028 | 0 |
| === Sheet: Amort. AS === Groups of fixed assets Grupy środków trwałych 2028 | 1 |

## BDG 2026 V1 XLS

- File: `knowledge/Finanse/BDG 2026 V1 old.xls`
- Detected type: `BS`
- Contained statement types: `BS`, `P&L`, `CF`
- Document class: `spreadsheet`
- Extraction strategy: `spreadsheet_structured`
- Currency / scaling: `PLN` / `millions`
- Extracted text length: 1782456

### BS

- Selected period: `2028`
- Comparison period: `2021`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 66
- Mapped lines: 27
- Coverage: 41%
- Readiness: `recoverable` (18)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `BS_EQUATION_INCOMPLETE`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| A. AKTYWA TRWAŁE A. FIXED ASSETS A. FIXED ASSETS 2028 | fsl-bs-other-non-current-assets | 0 |
| B. AKTYWA OBROTOWE B CURRENT ASSETS B CURRENT ASSETS 2028 | fsl-bs-fixed | 0 |
| a. Materiały a. Raw materials a. Raw materials 2028 | fsl-bs-inventory-raw | 0 |
| Produkty gotowe c. Finished products c. Finished products 2028 | fsl-bs-inventory-fg | 0 |
| Towary d. Goods d. Goods 2028 | fsl-bs-intangibles-goodwill | 0 |
| e. Zaliczki na poczet dostaw e. Advances for deliveries e. Advances for deliveries 2028 | fsl-bs-provisions | 0 |
| AKTYWA RAZEM TOTAL ASSETS TOTAL ASSETS 2028 | fsl-bs-total-assets | 0 |
| A. KAPITAŁ WŁASNY OGÓŁEM A. TOTAL SHAREHOLDERS' EQUITY A. TOTAL SHAREHOLDERS' EQUITY 2028 | fsl-bs-total-liabilities-equity | 0 |
| B. ZOBOWIĄZANIA DŁUGOTERMINOWE B. LONG-TERM LIABILITIES B. LONG-TERM LIABILITIES 2028 | fsl-bs-long-term-debt | 0 |
| b. Zobowiązania pożyczkowe b. Borrowings b. Borrowings 2028 | fsl-bs-long-term-borrowings | 0 |
| Wobec podmiotów powiązanych To related parties To related parties 2028 | fsl-bs-equity-parent | 0 |
| Wobec pozostałych podmiotów To other entities To other entities 2028 | fsl-bs-intangibles | 0 |
| Kredyty inwestycyjne Investment loans Investment loans 2028 | fsl-bs-investment-property | 0 |
| Kredyty obrotowe Working capital loans Working capital loans 2028 | fsl-bs-wc | 0 |
| Zobowiązania z tytułu leasingu c. Leasing c. Leasing 2028 | fsl-bs-long-term-debt-lease | 0 |
| Z tytułu dostaw i usług Trade liabilities Trade liabilities 2028 | fsl-bs-ar | 0 |
| Inne zobowiązania Booked liabilities (provisions - cost accruals) Booked liabilities (provisions - cost accruals) 2028 | fsl-bs-other-current-liabilities-accruals | 0 |
| Zaliczki otrzymane na dostawy Prepayments received for supplies Prepayments received for supplies 2028 | fsl-bs-contract-liabilities | 0 |
| pozostałe zobowiązania Other liabilities Other liabilities 2028 | fsl-bs-other-non-current-liabilities-deferred-tax | 0 |
| z tytułu wynagrodzeń Payroll Payroll 2028 | fsl-bs-other-non-current-assets-deferred-tax | 0 |
| b.Pozostałe rezerwy krótkoterminowe b. Other short-term provisions b. Other short-term provisions 2028 | fsl-bs-other-st-receivables | 0 |
| PASYWA LIABILITIES LIABILITIES 2028 | fsl-bs-total-liabilities | 0 |
| B. Koszty działalności operacyjnej B. Operating expenses B. Operating expenses 2028 | fsl-bs-other-current-assets-prepaids | 0 |
| Pozostałe przychody operacyjne D. Other operating income D. Other operating income 2028 | fsl-bs-other-equity-reserves | 0 |
| J. Przychody finansowe J. Przychody finansowe J. Przychody finansowe 2028 | fsl-bs-other-current-financial-assets | 0 |
| Inne V. Inne V. Inne 2028 | fsl-bs-other-current-assets | 0 |
| Odsetki, w tym: I. Odsetki, w tym: I. Odsetki, w tym: 2028 | fsl-bs-equity-method-investments | 0 |

| Unmapped labels | Value |
| --- | ---: |
| Bilans 2028 | 0 |
| Opis Description Description 2028 | 1 |
| Leasing c. Leasing c. Leasing 2028 | 0 |
| Pozostałe zobowiązania finansowe d. Other external financing sources d. Other external financing sources 2028 | 0 |
| a. Dotacje rządowe a. Government subsidies a. Government subsidies 2028 | 0 |
| b.Pozostałe zobowizania b. Other liabilities b. Other liabilities 2028 | 0 |
| ZOBOWIĄZANIA KRÓTKOTERMINOWE C. SHORT-TERM LIABILITIES C. SHORT-TERM LIABILITIES 2028 | 0 |
| Kredyty w rachunku bieżącym (overdrafty) Overdrafts Overdrafts 2028 | 0 |
| Factoring Factoring Factoring 2028 | 0 |
| a. Do jednostek powiązanych a.To related parties a.To related parties 2028 | 0 |
| b. Do pozostałych jednostek b.To other entities b.To other entities 2028 | 0 |
| Redukcja układowana/umowna Booked liabilities (provisions - cost accruals) Booked liabilities (provisions - cost accruals) 2028 | 0 |
| Dotacje rządowe c. Government subsidies c. Government subsidies 2028 | 0 |
| Fundusze specjalne d. Special funds d. Special funds 2028 | 0 |
| A. Przychody ze sprzedaży netto A. Net Sales A. Net Sales 2028 | 0 |
| E. Pozostałe koszty operacyjne E. Other operating expenses E. Other operating expenses 2028 | 0 |
| G. Przychody finansowe G. Financial income G. Financial income 2028 | 0 |
| H. Koszty finansowe H. Financial costs H. Financial costs 2028 | 0 |
| Podatek dochodowy L. CIT L. CIT 2028 | 0 |
| Wariant KALKULACYJNY: Opis Description Opis 2028 | 1687804 |
| Marketplace Marketplace a) Marketplace 2028 | 0 |
| Digital Twin (SAAS) Digital Twin (SAAS) b) Digital Twin (SAAS) 2028 | 0 |
| Big Data (MaaS) Big Data (MaaS) c) Big Data (MaaS) 2028 | 0 |
| DRD DRD d) DRD 2028 | 0 |
| Program Partnerski Program Partnerski e) Program Partnerski 2028 | 0 |
| D.SPRZED* D. Koszty sprzedaży D. Koszty sprzedaży D. Koszty sprzedaży 2028 | 0 |
| E.ZARZ* E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu 2028 | 0 |
| G. Pozostałe przychody operacyjne G. Pozostałe przychody operacyjne G. Pozostałe przychody operacyjne 2028 | 0 |
| Dotacje II. Dotacje II. Dotacje 2028 | 0 |
| Inne przychody operacyjne IV. Inne przychody operacyjne IV. Inne przychody operacyjne 2028 | 0 |
| H. Pozostałe koszty operacyjne H. Pozostałe koszty operacyjne H. Pozostałe koszty operacyjne 2028 | 0 |
| Aktualizacja wartości aktywów niefinansowych II. Aktualizacja wartości aktywów niefinansowych II. Aktualizacja wartości aktywów niefinansowych 2028 | 0 |
| Inne koszty operacyjne III. Inne koszty operacyjne III. Inne koszty operacyjne 2028 | 0 |
| Odsetki II. Odsetki II. Odsetki 2028 | 0 |
| Aktualizacja wartości aktywów finansowych IV. Aktualizacja wartości aktywów finansowych IV. Aktualizacja wartości aktywów finansowych 2028 | 0 |
| K. Koszty finansowe K. Koszty finansowe K. Koszty finansowe 2028 | 0 |
| Aktualizacja wartości aktywów finansowych III. Aktualizacja wartości aktywów finansowych III. Aktualizacja wartości aktywów finansowych 2028 | 0 |
| Inne IV. Inne IV. Inne 2028 | 0 |
| Podatek dochodowy M. Podatek dochodowy M. Podatek dochodowy 2028 | 0 |

### P&L

- Selected period: `2021`
- Comparison period: `n/a`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 109
- Mapped lines: 24
- Coverage: 22%
- Readiness: `recoverable` (16)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `PL_NON_POSITIVE_REVENUE`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Net revenues from the sale of products Przychody netto ze sprzedaży produktów 2021 | fsl-pl-revenue | 0 |
| a) Marketplace a) Marketplace 2021 | fsl-pl-opex | 0 |
| Change in the balance of products Zmiana stanu produktów 2021 | fsl-pl-cbn-inventory-change | 0 |
| Manufacturing cost of products for internal purposes Koszt wytworzenia produktów na własne potrzeby jednostki 2021 | fsl-pl-cbn-own-work-capitalised | 0 |
| Amortization Amortyzacja Other costs Pozostałe koszty / EU Business development 2021 | fsl-pl-other-expense | 0 |
| Taxes and fees Podatki i opłaty 2021 | fsl-pl-cbn-taxes-fees | 0 |
| Salaries Wynagrodzenia 2021 | fsl-pl-cbn-payroll | 0 |
| GRUPA Wynagrodzenia GRUPA Wynagrodzenia 2021 | fsl-pl-cogs-labor | 0 |
| Social security and other benefits Ubezpieczenie społeczne i inne świadczenia 2021 | fsl-pl-cbn-social-security | 0 |
| PL Value of goods and materials sold Wartość sprzedanych towarów i materiałów 2021 | fsl-pl-cogs | 0 |
| Other operating cost Pozostałe koszsty operacyjne (wyjątkowo relokacja) 2021 | fsl-pl-other-income | 0 |
| Financial expenses interest Odsetki z tytułu kosztów finansowych 2021 | fsl-pl-interest | 0 |
| Income tax Podatek dochodowy 2021 | fsl-pl-tax | 0 |
| Materials and energy PL Materials and energy 2021 | fsl-pl-cogs-materials | 0 |
| External services TOTAL External services 2021 | fsl-pl-cbn-external-services | 0 |
| GR B.TKW.INFTASTRUKTURA Office costs Koszty biura 2021 | fsl-pl-gna-rent | 0 |
| GR E.ZARZ.OGÓLNE HQ adm. costs Koszty administracyjne HQ 2021 | fsl-pl-gna | 967990 |
| GR D.SPRZED.MARKETING Marketing and promotion costs Delegations and representation 2021 | fsl-pl-selling-marketing | 0 |
| GR E.ZARZ.OGÓLNE Usługi doradcze - Consulting Usługi doradcze - Lech Consulting 2021 | fsl-pl-cogs-labor-contractors | 0 |
| PL D.SPRZED.MARKETING Commissions for Sales 2021 | fsl-pl-selling-commissions | 5 |
| PL D.SPRZED.SPRZEDAŻ Fleet management costs Koszty transportu 2021 | fsl-pl-cogs-materials-freight | 0 |
| PL B.TKW.IT Contract employees IT Contract employees IT - all 2021 | fsl-pl-gna-it | 0 |
| Tangible fixed assets nieaktywne Rzeczowe aktywa trwałe 2021 | fsl-pl-depreciation | 0 |
| Value of amortization Wartość amortyzacji 2021 | fsl-pl-depreciation-intangibles | 0 |

| Unmapped labels | Value |
| --- | ---: |
| === Sheet: Ass. PL === 2021 | 2.066 |
| Kapitalizacja 2021 | 1 |
| Net Sales DEV Net Sales DEV 2021 | 0 |
| b) Digital Twin (SAAS) b) Digital Twin (SAAS) 2021 | 0 |
| c) IoT c) IoT 2021 | 0 |
| d) DRD d) DRD 2021 | 0 |
| e) Program Partnerski e) Program Partnerski 2021 | 0 |
| Change Zmiana 2021 | 0 |
| PL POLSKA 2021 | 0 |
| GR GROUP 2021 | 0 |
| GR B.TKW.INNE DEV Taxes and fees GR Taxes and fees 2021 | 8.174 |
| PL B.TKW.INNE M&S Taxes and fees PL Taxes and fees 2021 | 0 |
| Wynagrodzenia razem Wynagrodzenia razem 2021 | 390.335 |
| GRUPA Kapitalizacja GRUPA Kapitalizacja 2021 | 21.03 |
| PL Wynagrodzenia PL Wynagrodzenia 2021 | 0 |
| PL Kapitalizacja PL Kapitalizacja 2021 | 0 |
| GR B.TKW.IT GR - B.TKW.IT 2021 | 0 |
| GR D.SPRZED.SPRZEDAŻ GR - D.SPRZED.SPRZEDAŻ 2021 | 0 |
| GR D.SPRZED.DELIVERY GR - D.SPRZED.DELIVERY 2021 | 0 |
| GR D.SPRZED.MARKETING GR - D.SPRZED.MARKETING 2021 | 7 |
| GR E.ZARZ.OGÓLNE GR - E.ZARZ.OGÓLNE 2021 | 0 |
| PL B.TKW.IT PL - B.TKW.IT 2021 | 5 |
| PL D.SPRZED.SPRZEDAŻ PL - D.SPRZED.SPRZEDAŻ 2021 | 0 |
| PL D.SPRZED.DELIVERY PL - D.SPRZED.DELIVERY 2021 | 0 |
| PL D.SPRZED.MARKETING PL - D.SPRZED.MARKETING 2021 | 0 |
| PL E.ZARZ.OGÓLNE PL - E.ZARZ.OGÓLNE 2021 | 6 |
| GRUP ZUS GRUPA ZUS 2021 | 3.57 |
| GRUPA ZUS Capitalisation GRUPA ZUS Kapitalizacja 2021 | 4.307 |
| PL ZUS PL ZUS 2021 | 1.401 |
| Change Narzut na wynagrodzenia brutto 2021 | 5 |
| PL ICO - material purchase 2021 | 315 |
| Gain on disposal of non-financial fixed assets Zysk ze zbycia niefinansowych aktywów trwałych 2021 | 0 |
| Redukcja zobowiązań Other operating revenues Pozostałe przychody operacyjne 2021 | 0 |
| GR Income tax Podatek dochodowy 2021 | 0 |
| GR Tax rate Realna stopa procentowa 2021 | 0 |
| Tax rate Realna stopa procentowa 2021 | 0 |
| Materials and energy GROUP Materials and energy 2021 | 0 |
| GR B.TKW.MATERIAŁY Other materials Pozostałe materiały 2021 | 0 |
| GR B.TKW.MATERIAŁY Sensor components 2021 | 105 |
| GR B.TKW.MATERIAŁY Others Inne 2021 | 0 |
| PL B.TKW.MATERIAŁY Other materials Pozostałe 2021 | 0 |
| PL B.TKW.MATERIAŁY Sensor components Materiały do czujników 2021 | 0 |
| PL B.TKW.MATERIAŁY Others Inne 2021 | 0 |
| External services GROUP External services GROUP 2021 | 48.159 |
| GR D.SPRZED.MARKETING Conference and representation costs Marketing and conferences 2021 | 0 |
| GR E.ZARZ.OGÓLNE Consultant and legal fees Koszty doradców i prawników 2021 | 0 |
| Kapitalizacja - Licences and SaaS costs Kapitalizacja - Licences and SaaS costs 2021 | 0 |
| GR D.SPRZED.SPRZEDAŻ Fleet management costs Koszty transportu / fleet cost 2021 | 0 |
| GR B.TKW.INFTASTRUKTURA IT equipment rental costs Office equipment 2021 | 0 |
| GR B.TKW.INFTASTRUKTURA IT equipment rental costs IT - rental cost 2021 | 0 |
| GR B.TKW.IT Contract employees IT Contract employees 2021 | 0 |
| Kapitalizacja - Contract employees Kapitalizacja - Contract employees 2021 | 74.3 |
| GR D.SPRZED.SPRZEDAŻ Contract employees sprzedaż Contract employees sprzedaż 2021 | 0 |
| Kapitalizacja - Contract employees sprzedaż Kapitalizacja - Contract employees sprzedaż 2021 | 0 |
| GR D.SPRZED.DELIVERY Contract employees delivery Contract employees delivery 2021 | 0 |
| Kapitalizacja - Contract employees delivery Kapitalizacja - Contract employees delivery 2021 | 0 |
| GR D.SPRZED.MARKETING Contract employees marketing Contract employees marketing 2021 | 0 |
| Kapitalizacja - Contract employees marketing Kapitalizacja - Contract employees marketing 2021 | 0 |
| GR B.TKW.INNE Pozostałe koszta 2021 | 0 |
| External services PL External services PL 2021 | 0 |
| PL B.ICO Licencje Grupowe 2021 | 10 |
| PL B.TKW.INFTASTRUKTURA Office costs Koszty biura 2021 | 0 |
| PL E.ZARZ.OGÓLNE HQ adm. costs Delegations and representation 2021 | 0 |
| PL D.SPRZED.MARKETING Marketing and promotion costs Events 2021 | 0 |
| PL D.SPRZED.MARKETING Conference and representation costs Marketing and conferences 2021 | 0 |
| PL E.ZARZ.OGÓLNE Consultant and legal fees Koszty doradców i prawników 2021 | 0 |
| PL B.TKW.INFTASTRUKTURA IT equipment rental costs Wyposażenie IT 2021 | 0 |
| Kapitalizacja - Contract employees IT Kapitalizacja - Contract employees IT 2021 | 10 |
| PL D.SPRZED.SPRZEDAŻ Contract employees sprzedaż Contract employees sprzedaż 2021 | 0 |
| PL D.SPRZED.DELIVERY Contract employees delivery Contract employees delivery 2021 | 0 |
| PL D.SPRZED.MARKETING Contract employees marketing Contract employees marketing 2021 | 0 |
| PL B.TKW.INNE Pozostałe koszta 2021 | 0 |
| Założenia do bilansu BS aassumptions Assets Aktywa 2021 | 1 |
| Investment nieaktywne Inwestycja 2021 | 0 |
| Disposal nieaktywne Sprzedaż 2021 | 0 |
| GR B.TKW.AMORTYZACJA Value of amortization nieaktywne Wartość amortyzacji 2021 | 21.317 |
| Investment real estate Inwestycje w nieruchomości Acquisition of investment real estate Nabycie nieruchomości inwestycyjnych 2021 | 0 |
| Sale of investment real estate Sprzedaż nieruchomości inwestycyjnych Value of the company Wartość firmy 2021 | 0 |
| Investment Inwestycja 2021 | 0 |
| Percent of amortization (%) Procent amortyzacji (%) 2021 | 50 |
| Intangible property Wartość niematerialna 2021 | 0 |
| Investment, w tym kapitalizacja Inwestycja 2021 | 80 |
| Disposal Sprzedaż Percent of amortization (%) Procent amortyzacji (%) 2021 | 2 |
| Materials Materiały 2021 | 0 |
| Rotation (days) Obrót (dni) 2021 | 0 |

### CF

- Selected period: `2028`
- Comparison period: `2021`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 1282
- Mapped lines: 42
- Coverage: 3%
- Readiness: `recoverable` (27)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Payroll z tytułu wynagrodzeń 2028 | fsl-cf-operating-interest-cost | 0 |
| Other operating income D. Pozostałe przychody operacyjne 2028 | fsl-cf-operating-dividend-income | 0 |
| b. Exchange gains (losses) b. Zyski / Straty z tytułu różnic kursowych 2028 | fsl-cf-operating-fv-derivatives | 0 |
| e. Change in provisions e. Zmiana stanu rezerw 2028 | fsl-cf-change-wc-provisions | 0 |
| f. Change in inventory f. Zmiana stanu zapasów 2028 | fsl-cf-change-wc-inventory | 0 |
| g. Change in receivables g. Zmiana stanu należności 2028 | fsl-cf-change-wc-ar | 0 |
| Change in prepayments and accurals i. Zmiana stanu rozliczeń międzyokresowych 2028 | fsl-cf-change-wc-prepaids | 0 |
| j. Other adjustments j. Inne korekty 2028 | fsl-cf-operating-other-adj | 0 |
| dividend and profit sharing otrzymane dywidendy i udziały w zyskach 2028 | fsl-cf-dividends-received | 0 |
| interest odsetki otrzymane 2028 | fsl-cf-operating-interest-income | 0 |
| ZOBOWIĄZANIA KRÓTKOTERMINOWE C. SHORT-TERM LIABILITIES C. SHORT-TERM LIABILITIES 2028 | fsl-cf-debt-drawdown | 566.592 |
| Kredyty inwestycyjne Investment loans Investment loans 2028 | fsl-cf-operating-fv-changes | 0 |
| Kredyty obrotowe Working capital loans Working capital loans 2028 | fsl-cf-change-wc-other | 0 |
| PASYWA LIABILITIES LIABILITIES 2028 | fsl-cf-debt-drawdown-lease | 452.389 |
| Amortyzacja 2028 | fsl-cf-operating-depreciation | 86.873 |
| EBT - Zysk Brutto 2028 | fsl-cf-operating-ebt | -461.18 |
| Zysk Netto 2028 | fsl-cf-operating-net-income | -461.18 |
| Cash Flow Przepływy z działalności operacyjnej 2028 | fsl-cf-operating | -2.59 |
| Zmiana Kapitału Pracującego 2028 | fsl-cf-change-wc | -2.431 |
| Przepływy z działalności inwestycyjnej 2028 | fsl-cf-investing | 0 |
| Przepływy z działalności finansowej 2028 | fsl-cf-financing | 2.806 |
| Spłata pożyczek i kredytów 2028 | fsl-cf-debt-repayment | 0 |
| Środki pieniężne na początek okresu 2028 | fsl-cf-opening-cash | 11.585 |
| Zmiany stanu środków pieniężnych 2028 | fsl-cf-net-change-cash | 215.715 |
| Środki pieniężne na koniec okresu 2028 | fsl-cf-closing-cash | 204.726 |
| TOT – w jednostkach powiązanych – w jednostkach powiązanych – w jednostkach powiązanych 2028 | fsl-cf-investing-subsidiaries | 0 |
| Wynagrodzenia razem Wynagrodzenia razem 2028 | fsl-cf-operating-adjustments | 390.335 |
| Gain on disposal of non-financial fixed assets Zysk ze zbycia niefinansowych aktywów trwałych 2028 | fsl-cf-operating-gain-disposal | 0 |
| Value of amortization Wartość amortyzacji 2028 | fsl-cf-operating-depreciation-intangibles | 0 |
| zwrot zwrot 2028 | fsl-cf-tax-refund | 80 |
| Zobowiazania z tytułu leasingu 2028 | fsl-cf-lease-repayment | 0 |
| Aktualizacja wartości aktywów niefinansowych III. Aktualizacja wartości aktywów niefinansowych 2028 | fsl-cf-operating-impairment | 0 |
| a) od jednostek powiązanych, w tym: a) od jednostek powiązanych, w tym: 2028 | fsl-cf-operating-equity-method | 0 |
| Podatek dochodowy M. Podatek dochodowy 2028 | fsl-cf-taxes-paid | 0 |
| Inne wpływy inwestycyjne d. Other inflows form investment activities 2028 | fsl-cf-other-receipts | 0 |
| Inne wydatki inwestycyjne d. Other outflows form investment activities 2028 | fsl-cf-other-expenditure | 0 |
| Przychody netto ze sprzedaży usług 2028 | fsl-cf-investing-disposal-proceeds | 0 |
| Zmiana Redukcja zobowiązań 2028 | fsl-cf-change-wc-ap | 0 |
| Dochód do opodatkowania Dochód do opodatkowania 2028 | fsl-cf-operating-depreciation-rou | 0 |
| Spłata długu Repayment of factoring 2028 | fsl-cf-debt-repayment-bank | 0 |
| Marketplace i. Other outflows from financial activities 2028 | fsl-cf-other-investing | 0 |
| Market Market Avg. Project value CAPEX USD JEN 2028 | fsl-cf-capex | 1 |

| Unmapped labels | Value |
| --- | ---: |
| === Sheet: Presentation PL All === Description Opis 2028 | 1 |
| A. FIXED ASSETS A. AKTYWA TRWAŁE 2028 | 0 |
| B CURRENT ASSETS B. AKTYWA OBROTOWE 2028 | 0 |
| a. Raw materials a. Materiały 2028 | 0 |
| b. Semi-finished products and work in progress b. Półprodukty i produkty w toku 2028 | 0 |
| Finished products c. Produkty gotowe 2028 | 0 |
| Goods d. Towary 2028 | 0 |
| e. Advances for deliveries e. Zaliczki na poczet dostaw 2028 | 0 |
| a. Receivables from related parties a. Należności od podmiotów powiązanych 2028 | 0 |
| b. Receivables from other entities b. Należności od pozostałych podmiotów 2028 | 0 |
| TOTAL ASSETS AKTYWA RAZEM 2028 | 0 |
| Description Opis 2028 | 1 |
| A. TOTAL SHAREHOLDERS' EQUITY A. KAPITAŁ WŁASNY OGÓŁEM 2028 | 0 |
| B. LONG-TERM LIABILITIES B. ZOBOWIĄZANIA DŁUGOTERMINOWE 2028 | 0 |
| a. Bank loans to be repaid a. Zobowiązania wobec banków z tytułu kredytów 2028 | 0 |
| b. Borrowings b. Zobowiązania pożyczkowe 2028 | 0 |
| Leasing c. Leasing 2028 | 0 |
| Other external financing sources d. Pozostałe zobowiązania finansowe 2028 | 0 |
| a. Government subsidies a. Dotacje rządowe 2028 | 0 |
| b. Other liabilities b.Pozostałe zobowizania 2028 | 0 |
| To related parties Wobec podmiotów powiązanych 2028 | 0 |
| To other entities Wobec pozostałych podmiotów 2028 | 0 |
| SHORT-TERM LIABILITIES C. ZOBOWIĄZANIA KRÓTKOTERMINOWE 2028 | 0 |
| Investment loans Kredyty inwestycyjne 2028 | 0 |
| Working capital loans Kredyty obrotowe 2028 | 0 |
| Overdrafts Kredyty w rachunku bieżącym (overdrafty) 2028 | 0 |
| Factoring Factoring 2028 | 0 |
| b. Borrowings to be repaid b. Zobowiązania z tytułu pożyczek 2028 | 0 |
| Leasing c. Zobowiązania z tytułu leasingu 2028 | 0 |
| a.To related parties a. Do jednostek powiązanych 2028 | 0 |
| Trade liabilities Z tytułu dostaw i usług 2028 | 0 |
| Booked liabilities (provisions - cost accruals) Inne zobowiązania 2028 | 0 |
| Prepayments received for supplies Zaliczki otrzymane na dostawy 2028 | 0 |
| Dividends and other capital liabilities Z tytułu dywidend i innych zobowiązań kapitałowych 2028 | 0 |
| Other liabilities pozostałe zobowiązania 2028 | 0 |
| b.To other entities b. Do pozostałych jednostek 2028 | 0 |
| Booked liabilities (provisions - cost accruals) Redukcja układowana/umowna 2028 | 0 |
| Other liabilities (including contingent, regarding acquisition of companies) Pozostałe zobowiązania 2028 | 0 |
| Government subsidies c. Dotacje rządowe 2028 | 0 |
| Special funds d. Fundusze specjalne 2028 | 0 |
| a.Provision for employee benefits a. Rezerwa na świadczenia pracownicze 2028 | 0 |
| b. Other short-term provisions b.Pozostałe rezerwy krótkoterminowe 2028 | 0 |
| LIABILITIES PASYWA 2028 | 0 |
| A. Net Sales A. Przychody ze sprzedaży netto 2028 | 0 |
| B. Operating expenses B. Koszty działalności operacyjnej 2028 | 0 |
| Profit (loss) on sales (A-B) C. Zysk (strata) ze sprzedaży (A-B) 2028 | 0 |
| E. Other operating expenses E. Pozostałe koszty operacyjne 2028 | 0 |
| G. Financial income G. Przychody finansowe 2028 | 0 |
| H. Financial costs H. Koszty finansowe 2028 | 0 |
| K. Gross profit (loss) (I ± J) K. Zysk (strata) brutto (I±J) 2028 | 0 |
| CIT L. Podatek dochodowy 2028 | 0 |
| N. Net profit (loss) (Q-L-M) N. Zysk (strata) netto (K-L-M) 2028 | 0 |
| A. Cash flow from operating activities A. Przepływy środków pieniężnych z działalności operacyjnej 2028 | 0 |
| a. Amortisation and depreciation a. Amortyzacja 2028 | 0 |
| Interest and profit sharing (dividend) c. Odsetki i udziały w zyskach (dywidendy) 2028 | 0 |
| Profit (loss) on investment activities d. Zyski/straty z działalności inwestycyjnej 2028 | 0 |
| B. CF from investment activities B. Przepływy środków pieniężnych z działalności inwestycyjnej 2028 | 0 |
| a. Disposal of intangible and tangible fixed assets a. Zbycie wartości niematerialnych i prawnych 2028 | 0 |
| From financial assets, including: c. Wpływy aktywów finansowych, w tym 2028 | 0 |
| sales of financial assets zbycie aktywów finansowych 2028 | 0 |
| repayment of granted L-term loans otrzymane spłaty pożyczek długoterminowych 2028 | 0 |
| other inflows from financial assets inne wpływy z aktywów finansowych 2028 | 0 |
| Other inflows form investment activities d. Inne wpływy inwestycyjne 2028 | 0 |
| For financial assets, including: c. Na aktywa finansowe, w tym 2028 | 0 |
| purchase of financial assets nabycie aktywów finansowych 2028 | 0 |
| L-term loans granted udzielone pożyczki długoterminowe 2028 | 0 |
| Other outflows form investment activities d. Inne wydatki inwestycyjne 2028 | 0 |
| CF from financial activities C. Przepływy środków pieniężnych z działalności finansowej 2028 | 0 |
| b. Credits and loans b. Kredyty i pożyczki 2028 | 0 |
| Issuance of debt securities c. Emisja dłużnych papierów wartościowych 2028 | 0 |
| Other inflows form financial activities d. Inne wpływy finansowe 2028 | 0 |
| a. Purchase of own shares a. Nabycie udziałów własnych 2028 | 0 |
| Repayment of credits and loans d. Spłaty kredytów i pożyczek 2028 | 0 |
| e. Redemption of debt securities e. Wykup dłużnych papierów wartościowych 2028 | 0 |
| f. Payment of other financial liabilities f. Z tyt. zobowiązań finansowych 2028 | 0 |
| g. Payment of liabilities arising from financail leases g.. Płatności z umów leasingu finansowego 2028 | 0 |
| h. Interest h. Odsetki 2028 | 0 |
| Other outflows from financial activities i. Inne wydatki finansowe 2028 | 0 |
| Total net Cash Flow D. Przepływy pieniężne netto razem 2028 | 0 |
| E. Cash opening balance E. Środki pieniężne na początek okresu 2028 | 0 |
| F. Closing balance of cash F. Środki pieniężne na koniec okresu 2028 | 0 |
| podniesienie kapitału w Polsce o 2028 | 1000000 |
| grant w wysokości 2028 | 500000 |
| Net Sales 2028 | 0 |
| Operating expenses 2028 | 276.163 |
| Profit on sales 2028 | -276.163 |
| Net profit 2028 | -276.399 |
| Shareholders' equity 2028 | 780.754 |
| Cash and cash equivalents 2028 | 519.627 |
| MRR December every year 2028 | 0 |
| Net revenue 2028 | 0 |
| SaaS 2028 | 0 |
| Sales per Sales HC 2028 | 37.8 |
| Sales per Delivery HC 2028 | 27 |
| A. Net Sales A. Net Sales A. Przychody ze sprzedaży netto 2028 | 49.163 |
| Other operating income D. Pozostałe przychody operacyjne - - 2028 | 15.5 |
| JEN/PLN 2028 | 0.02 |
| Poland: Platform transactions (QTY) 2028 | 2 |
| Platform transactions (PLN) 2028 | 2.583 |
| Marketplace revenue (PLN) 2028 | 33.35 |
| Standard (QTY) 2028 | 1 |
| DT revenue (PLN) 2028 | 13.435 |
| Group Installations (QTY) 2028 | 3 |
| IoT revenue (PLN) 2028 | 60 |
| Development map - generator (QTY) 2028 | 7 |
| Development map - workshop (QTY) 2028 | 1 |
| Development map - generator (PLN) 2028 | 10 |
| DRD revenue (PLN) 2028 | 26.6 |
| Showroom implementations (QTY) - 2028 | 13 |
| Others (QTY) 2028 | 4 |
| Showroom implementations (PLN) - 2028 | 26.565 |
| Partnerships and Showroom revenue (PLN) 2028 | 1 |
| Poland TOTAL (PLN) 2028 | 46.785 |
| Poland: Total revenue (PLN) 2028 | 46.785 |
| TOTAL (PLN) 2028 | 46.785 |
| Marketplace Total revenue (PLN) 2028 | 33.35 |
| Digital Twin (SAAS) Total revenue (PLN) 2028 | 13.435 |
| DRD Total revenue (PLN) - 2028 | 26.6 |
| Partnerships and Showroom Total revenue (PLN) 2028 | 1 |
| Total HC 2028 | 22 |
| Poland 2028 | 22 |
| Sales HC 2028 | 4 |
| Delivery HC 2028 | 3 |
| Germany 2028 | 10.221 |
| Japan Sales per Delivery HC 2028 | 15.595 |
| Japan === Sheet: Revenue EUR === FX: PLN/PLN 2028 | 0.23 |
| USD/PLN 2028 | 0.95 |
| Marketplace revenue (EUR) 2028 | 7.756 |
| DT revenue (EUR) 2028 | 3.124 |
| DRD revenue (EUR) - 2028 | 6.186 |
| Others (QTY) - 2028 | 4 |
| Partnerships and Showroom revenue (EUR) 2028 | 233 |
| Poland TOTAL (EUR) 2028 | 10.88 |
| Poland: 2028 | 10.88 |
| TOTAL (EUR) 2028 | 10.88 |
| Marketplace 2028 | 7.756 |
| Digital Twin (SAAS) 2028 | 3.124 |
| Partnerships and Showroom 2028 | 233 |
| YEN/PLN 2028 | 0.024 |
| Opis Description Description 2028 | 1 |
| A. AKTYWA TRWAŁE A. FIXED ASSETS A. FIXED ASSETS 2028 | 58.667 |
| B. AKTYWA OBROTOWE B CURRENT ASSETS B CURRENT ASSETS 2028 | 393.722 |
| a. Materiały a. Raw materials a. Raw materials 2028 | 0 |
| Produkty gotowe c. Finished products c. Finished products 2028 | 0 |
| Towary d. Goods d. Goods 2028 | 0 |
| e. Zaliczki na poczet dostaw e. Advances for deliveries e. Advances for deliveries 2028 | 0 |
| A. KAPITAŁ WŁASNY OGÓŁEM A. TOTAL SHAREHOLDERS' EQUITY A. TOTAL SHAREHOLDERS' EQUITY 2028 | -114.204 |
| B. ZOBOWIĄZANIA DŁUGOTERMINOWE B. LONG-TERM LIABILITIES B. LONG-TERM LIABILITIES 2028 | 0 |
| b. Zobowiązania pożyczkowe b. Borrowings b. Borrowings 2028 | 0 |
| Leasing c. Leasing c. Leasing 2028 | 0 |
| Pozostałe zobowiązania finansowe d. Other external financing sources d. Other external financing sources 2028 | 0 |
| a. Dotacje rządowe a. Government subsidies a. Government subsidies 2028 | 0 |
| b.Pozostałe zobowizania b. Other liabilities b. Other liabilities 2028 | 0 |
| Wobec podmiotów powiązanych To related parties To related parties 2028 | 0 |
| Wobec pozostałych podmiotów To other entities To other entities 2028 | 0 |
| Kredyty w rachunku bieżącym (overdrafty) Overdrafts Overdrafts 2028 | 0 |
| Factoring Factoring Factoring 2028 | 0 |
| Zobowiązania z tytułu leasingu c. Leasing c. Leasing 2028 | 0 |
| a. Do jednostek powiązanych a.To related parties a.To related parties 2028 | 0 |
| Z tytułu dostaw i usług Trade liabilities Trade liabilities 2028 | 0 |
| Inne zobowiązania Booked liabilities (provisions - cost accruals) Booked liabilities (provisions - cost accruals) 2028 | 0 |
| Zaliczki otrzymane na dostawy Prepayments received for supplies Prepayments received for supplies 2028 | 0 |
| pozostałe zobowiązania Other liabilities Other liabilities 2028 | 0 |
| b. Do pozostałych jednostek b.To other entities b.To other entities 2028 | 566.592 |
| Redukcja układowana/umowna Booked liabilities (provisions - cost accruals) Booked liabilities (provisions - cost accruals) 2028 | 0 |
| z tytułu wynagrodzeń Payroll Payroll 2028 | 0 |
| Dotacje rządowe c. Government subsidies c. Government subsidies 2028 | 0 |
| Fundusze specjalne d. Special funds d. Special funds 2028 | 0 |
| b.Pozostałe rezerwy krótkoterminowe b. Other short-term provisions b. Other short-term provisions 2028 | 0 |
| A. Przychody ze sprzedaży netto A. Net Sales A. Net Sales 2028 | 49.163 |
| B. Koszty działalności operacyjnej B. Operating expenses B. Operating expenses 2028 | 443.104 |
| Pozostałe przychody operacyjne D. Other operating income D. Other operating income 2028 | 0 |
| E. Pozostałe koszty operacyjne E. Other operating expenses E. Other operating expenses 2028 | 0 |
| G. Przychody finansowe G. Financial income G. Financial income 2028 | 0 |
| H. Koszty finansowe H. Financial costs H. Financial costs 2028 | 324319 |
| Podatek dochodowy L. CIT L. CIT 2028 | 0 |
| Wariant KALKULACYJNY: Opis Opis Opis 2028 | 1 |
| Marketplace Marketplace Marketplace 2028 | 0 |
| Digital Twin (SAAS) Digital Twin (SAAS) Digital Twin (SAAS) 2028 | 0 |
| Big Data (MaaS) Big Data (MaaS) Big Data (MaaS) 2028 | 0 |
| DRD DRD DRD 2028 | 0 |
| Program Partnerski Program Partnerski Program Partnerski 2028 | 0 |
| Koszt wytworzenia sprzedanych produktów I. Koszt wytworzenia sprzedanych produktów I. Koszt wytworzenia sprzedanych produktów 2028 | 0 |
| Koszty sprzedaży D. Koszty sprzedaży D. Koszty sprzedaży 2028 | 0 |
| E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu 2028 | 0 |
| G. Pozostałe przychody operacyjne G. Pozostałe przychody operacyjne G. Pozostałe przychody operacyjne 2028 | 0 |
| Dotacje II. Dotacje II. Dotacje 2028 | 0 |
| Inne przychody operacyjne IV. Inne przychody operacyjne IV. Inne przychody operacyjne 2028 | 0 |
| H. Pozostałe koszty operacyjne H. Pozostałe koszty operacyjne H. Pozostałe koszty operacyjne 2028 | 0 |
| Aktualizacja wartości aktywów niefinansowych II. Aktualizacja wartości aktywów niefinansowych II. Aktualizacja wartości aktywów niefinansowych 2028 | 0 |
| Inne koszty operacyjne III. Inne koszty operacyjne III. Inne koszty operacyjne 2028 | 0 |
| J. Przychody finansowe J. Przychody finansowe J. Przychody finansowe 2028 | 0 |
| Odsetki II. Odsetki II. Odsetki 2028 | 0 |
| Aktualizacja wartości aktywów finansowych IV. Aktualizacja wartości aktywów finansowych IV. Aktualizacja wartości aktywów finansowych 2028 | 0 |
| Inne V. Inne V. Inne 2028 | 0 |
| K. Koszty finansowe K. Koszty finansowe K. Koszty finansowe 2028 | 0 |
| Odsetki, w tym: I. Odsetki, w tym: I. Odsetki, w tym: 2028 | 0 |
| Aktualizacja wartości aktywów finansowych III. Aktualizacja wartości aktywów finansowych III. Aktualizacja wartości aktywów finansowych 2028 | 0 |
| Inne IV. Inne IV. Inne 2028 | 0 |
| Podatek dochodowy M. Podatek dochodowy M. Podatek dochodowy 2028 | 0 |
| a. Amortyzacja a. Amortisation and depreciation a. Amortisation and depreciation 2028 | 1.333 |
| e. Zmiana stanu rezerw e. Change in provisions e. Change in provisions 2028 | 0 |
| f. Zmiana stanu zapasów f. Change in inventory f. Change in inventory 2028 | 0 |
| g. Zmiana stanu należności g. Change in receivables g. Change in receivables 2028 | -24.763 |
| j. Inne korekty j. Other adjustments j. Other adjustments 2028 | -64.916 |
| zbycie aktywów finansowych sales of financial assets sales of financial assets 2028 | 0 |
| otrzymane dywidendy i udziały w zyskach dividend and profit sharing dividend and profit sharing 2028 | 0 |
| odsetki otrzymane interest interest 2028 | 0 |
| nabycie aktywów finansowych purchase of financial assets purchase of financial assets 2028 | 0 |
| udzielone pożyczki długoterminowe L-term loans granted L-term loans granted 2028 | 0 |
| b. Kredyty i pożyczki b. Credits and loans b. Credits and loans 2028 | 0 |
| Emisja dłużnych papierów wartościowych c. Issuance of debt securities c. Issuance of debt securities 2028 | 0 |
| a. Nabycie udziałów własnych a. Purchase of own shares a. Purchase of own shares 2028 | 0 |
| h. Odsetki h. Interest h. Interest 2028 | 0 |
| Przepływy pieniężne netto razem D. Total net Cash Flow D. Total net Cash Flow 2028 | -186.532 |
| E. Środki pieniężne na początek okresu E. Cash opening balance E. Cash opening balance 2028 | 311.71 |
| === Sheet: ADJ PLN === 2028 | 0 |
| shares 2028 | 5 |
| ICO licences 2028 | 4 |
| Opis Opis Opis 2028 | 1 |
| === Sheet: Overview PL === P&L Jan 2028 | -24 |
| Big Data (MAAS) 2028 | 0 |
| Program Partnerski 2028 | 0 |
| Licencje Grupowe 2028 | 0 |
| Koszty sprzedaży 2028 | 272.719 |
| IT Support 2028 | 106.019 |
| Infrastruktura 2028 | 38.243 |
| Koszty materiałów 2028 | 4.587 |
| Pozostałe 2028 | 123.87 |
| Marża Brutto 2028 | -272.719 |
| Marża brutto (%) #DIV/ 2028 | 0 |
| Koszty Bezpośrednie 2028 | 62.194 |
| Sprzedaż 2028 | 34.102 |
| Delivery 2028 | 20.2 |
| Marketing 2028 | 7.892 |
| Marża Po Kosztach Bezpośrednich 2028 | -334.912 |
| Marża Po Kosztach Bezpośrednich (%) #DIV/ 2028 | 0 |
| OPEX 2028 | 99.604 |
| Rozwój Platformy 2028 | 0 |
| Efekt pozostałych zdarzeń operacyjnych / Granty 2028 | 0 |
| EBIT 2028 | -434.516 |
| EBIT (%) #DIV/ 2028 | 0 |
| EBITDA 2028 | -347.643 |
| EBITDA (%) #DIV/ 2028 | 0 |
| Przychody finansowe 2028 | 0 |
| Koszty finansowe 2028 | 26.663 |
| EBT - Zysk Brutto (%) #DIV/ 2028 | 0 |
| Podatki 2028 | 0 |
| Zysk Netto(%) #DIV/ 2028 | 0 |
| Bilans Aktywa trwałe 2028 | 5.16 |
| WNiP 2028 | 5.059 |
| Udziały i akcje w podmiotach powiązanych 2028 | 0 |
| Należności 2028 | 149.26 |
| Środki pieniężne 2028 | 204.726 |
| Pozostała aktywa obrotowe 2028 | 73.987 |
| Kapitał obrotowy netto 2028 | 105.66 |
| Kapitał własny ogółem: 2028 | 2.738 |
| Kapitał własny przypisany jednostce dominującej 2028 | 140.5 |
| Wynik finansowy netto za rok obrotowy 2028 | -246.562 |
| Niepodzielony zysk lat ubiegłych 2028 | -606.615 |
| Zobowiązania długoterminowe: 2028 | 675 |
| Kredyty i pożyczki 2028 | 675 |
| Zobowiązania krótkoterminowe: 2028 | 2.226 |
| Zobowiązania z tyt. dostaw i usług oraz pozostałe 2028 | 95.167 |
| Inwestycje 2028 | 0 |
| Wpływy: 2028 | 2.806 |
| Kapitał od inwestorów 2028 | 0 |
| Finansowanie dłużne 2028 | 0 |
| Granty 2028 | 0 |
| Wydatki 2028 | 0 |
| Bilans 2028 | 0 |
| Wariant KALKULACYJNY: Opis Description Opis 2028 | 1687804 |
| Marketplace Marketplace a) Marketplace 2028 | 0 |
| Digital Twin (SAAS) Digital Twin (SAAS) b) Digital Twin (SAAS) 2028 | 0 |
| Big Data (MaaS) Big Data (MaaS) c) Big Data (MaaS) 2028 | 0 |
| DRD DRD d) DRD 2028 | 0 |
| Program Partnerski Program Partnerski e) Program Partnerski 2028 | 0 |
| D.SPRZED* D. Koszty sprzedaży D. Koszty sprzedaży D. Koszty sprzedaży 2028 | 0 |
| E.ZARZ* E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu 2028 | 0 |
| === Sheet: Statement GROUP === Bilans Opis Description Description 2028 | 1 |
| TOT B. Koszty działalności operacyjnej B. Operating expenses B. Operating expenses 2028 | 250.517 |
| TOT D. Pozostałe przychody operacyjne D. Other operating income D. Other operating income 2028 | 0 |
| TOT E. Pozostałe koszty operacyjne E. Other operating expenses E. Other operating expenses 2028 | 0 |
| TOT G. Przychody finansowe G. Financial income G. Financial income 2028 | 0 |
| TOT H. Koszty finansowe H. Financial costs H. Financial costs 2028 | 172224 |
| TOT L. Podatek dochodowy L. CIT L. CIT 2028 | 0 |
| Wariant KALKULACYJNY: TOT Opis Description Opis 2028 | 1 |
| TOT – od jednostek powiązanych – od jednostek powiązanych – od jednostek powiązanych 2028 | 0 |
| TOT Marketplace Marketplace a) Marketplace 2028 | 0 |
| TOT Digital Twin (SAAS) Digital Twin (SAAS) b) Digital Twin (SAAS) 2028 | 0 |
| TOT Big Data (MaaS) Big Data (MaaS) c) Big Data (MaaS) 2028 | 0 |
| TOT DRD DRD d) DRD 2028 | 0 |
| TOT Program Partnerski Program Partnerski e) Program Partnerski 2028 | 0 |
| TOT – jednostkom powiązanym – jednostkom powiązanym – jednostkom powiązanym 2028 | 0 |
| TOT D. Koszty sprzedaży D. Koszty sprzedaży D. Koszty sprzedaży 2028 | 0 |
| TOT E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu 2028 | 0 |
| TOT G. Pozostałe przychody operacyjne G. Pozostałe przychody operacyjne G. Pozostałe przychody operacyjne 2028 | 0 |
| TOT II. Dotacje II. Dotacje II. Dotacje 2028 | 0 |
| TOT IV. Inne przychody operacyjne IV. Inne przychody operacyjne IV. Inne przychody operacyjne 2028 | 0 |
| TOT H. Pozostałe koszty operacyjne H. Pozostałe koszty operacyjne H. Pozostałe koszty operacyjne 2028 | 0 |
| TOT III. Inne koszty operacyjne III. Inne koszty operacyjne III. Inne koszty operacyjne 2028 | 0 |
| TOT J. Przychody finansowe J. Przychody finansowe J. Przychody finansowe 2028 | 0 |
| TOT V. Inne V. Inne V. Inne 2028 | 0 |
| TOT K. Koszty finansowe K. Koszty finansowe K. Koszty finansowe 2028 | 0 |
| TOT I. Odsetki, w tym: I. Odsetki, w tym: I. Odsetki, w tym: 2028 | 0 |
| TOT – dla jednostek powiązanych – dla jednostek powiązanych – dla jednostek powiązanych 2028 | 0 |
| TOT IV. Inne IV. Inne IV. Inne 2028 | 0 |
| TOT M. Podatek dochodowy M. Podatek dochodowy M. Podatek dochodowy 2028 | 0 |
| === Sheet: Statement PL === Bilans Opis Description Description 2028 | 1 |
| === Sheet: Ass. PL === 2028 | 2.066 |
| Kapitalizacja 2028 | 1 |
| Net revenues from the sale of products Przychody netto ze sprzedaży produktów 2028 | 0 |
| Net Sales DEV Net Sales DEV 2028 | 0 |
| a) Marketplace a) Marketplace 2028 | 0 |
| b) Digital Twin (SAAS) b) Digital Twin (SAAS) 2028 | 0 |
| c) IoT c) IoT 2028 | 0 |
| d) DRD d) DRD 2028 | 0 |
| e) Program Partnerski e) Program Partnerski 2028 | 0 |
| Change in the balance of products Zmiana stanu produktów 2028 | 0 |
| Change Zmiana 2028 | 0 |
| Manufacturing cost of products for internal purposes Koszt wytworzenia produktów na własne potrzeby jednostki 2028 | 0 |
| Amortization Amortyzacja Other costs Pozostałe koszty / EU Business development 2028 | 0 |
| PL POLSKA 2028 | 0 |
| GR GROUP 2028 | 0 |
| Taxes and fees Podatki i opłaty 2028 | 0 |
| GR B.TKW.INNE DEV Taxes and fees GR Taxes and fees 2028 | 8.174 |
| PL B.TKW.INNE M&S Taxes and fees PL Taxes and fees 2028 | 0 |
| Salaries Wynagrodzenia 2028 | 0 |
| GRUPA Wynagrodzenia GRUPA Wynagrodzenia 2028 | 0 |
| GRUPA Kapitalizacja GRUPA Kapitalizacja 2028 | 21.03 |
| PL Wynagrodzenia PL Wynagrodzenia 2028 | 0 |
| PL Kapitalizacja PL Kapitalizacja 2028 | 0 |
| GR B.TKW.IT GR - B.TKW.IT 2028 | 0 |
| GR D.SPRZED.SPRZEDAŻ GR - D.SPRZED.SPRZEDAŻ 2028 | 0 |
| GR D.SPRZED.DELIVERY GR - D.SPRZED.DELIVERY 2028 | 0 |
| GR D.SPRZED.MARKETING GR - D.SPRZED.MARKETING 2028 | 7 |
| GR E.ZARZ.OGÓLNE GR - E.ZARZ.OGÓLNE 2028 | 0 |
| PL B.TKW.IT PL - B.TKW.IT 2028 | 5 |
| PL D.SPRZED.SPRZEDAŻ PL - D.SPRZED.SPRZEDAŻ 2028 | 0 |
| PL D.SPRZED.DELIVERY PL - D.SPRZED.DELIVERY 2028 | 0 |
| PL D.SPRZED.MARKETING PL - D.SPRZED.MARKETING 2028 | 0 |
| PL E.ZARZ.OGÓLNE PL - E.ZARZ.OGÓLNE 2028 | 6 |
| Social security and other benefits Ubezpieczenie społeczne i inne świadczenia 2028 | 0 |
| GRUP ZUS GRUPA ZUS 2028 | 3.57 |
| GRUPA ZUS Capitalisation GRUPA ZUS Kapitalizacja 2028 | 4.307 |
| PL ZUS PL ZUS 2028 | 1.401 |
| Change Narzut na wynagrodzenia brutto 2028 | 5 |
| PL Value of goods and materials sold Wartość sprzedanych towarów i materiałów 2028 | 0 |
| PL ICO - material purchase 2028 | 315 |
| Redukcja zobowiązań Other operating revenues Pozostałe przychody operacyjne 2028 | 0 |
| Other operating cost Pozostałe koszsty operacyjne (wyjątkowo relokacja) 2028 | 0 |
| Financial expenses interest Odsetki z tytułu kosztów finansowych 2028 | 0 |
| GR Income tax Podatek dochodowy 2028 | 0 |
| GR Tax rate Realna stopa procentowa 2028 | 0 |
| Income tax Podatek dochodowy 2028 | 0 |
| Tax rate Realna stopa procentowa 2028 | 0 |
| Materials and energy GROUP Materials and energy 2028 | 0 |
| GR B.TKW.MATERIAŁY Other materials Pozostałe materiały 2028 | 0 |
| GR B.TKW.MATERIAŁY Sensor components 2028 | 105 |
| GR B.TKW.MATERIAŁY Others Inne 2028 | 0 |
| Materials and energy PL Materials and energy 2028 | 0 |
| PL B.TKW.MATERIAŁY Other materials Pozostałe 2028 | 0 |
| PL B.TKW.MATERIAŁY Sensor components Materiały do czujników 2028 | 0 |
| PL B.TKW.MATERIAŁY Others Inne 2028 | 0 |
| External services TOTAL External services 2028 | 0 |
| External services GROUP External services GROUP 2028 | 48.159 |
| GR B.TKW.INFTASTRUKTURA Office costs Koszty biura 2028 | 0 |
| GR E.ZARZ.OGÓLNE HQ adm. costs Koszty administracyjne HQ 2028 | 967990 |
| GR D.SPRZED.MARKETING Marketing and promotion costs Delegations and representation 2028 | 0 |
| GR D.SPRZED.MARKETING Conference and representation costs Marketing and conferences 2028 | 0 |
| GR E.ZARZ.OGÓLNE Consultant and legal fees Koszty doradców i prawników 2028 | 0 |
| Kapitalizacja - Licences and SaaS costs Kapitalizacja - Licences and SaaS costs 2028 | 0 |
| GR D.SPRZED.SPRZEDAŻ Fleet management costs Koszty transportu / fleet cost 2028 | 0 |
| GR B.TKW.INFTASTRUKTURA IT equipment rental costs Office equipment 2028 | 0 |
| GR B.TKW.INFTASTRUKTURA IT equipment rental costs IT - rental cost 2028 | 0 |
| GR B.TKW.IT Contract employees IT Contract employees 2028 | 0 |
| Kapitalizacja - Contract employees Kapitalizacja - Contract employees 2028 | 74.3 |
| GR D.SPRZED.SPRZEDAŻ Contract employees sprzedaż Contract employees sprzedaż 2028 | 0 |
| Kapitalizacja - Contract employees sprzedaż Kapitalizacja - Contract employees sprzedaż 2028 | 0 |
| GR D.SPRZED.DELIVERY Contract employees delivery Contract employees delivery 2028 | 0 |
| Kapitalizacja - Contract employees delivery Kapitalizacja - Contract employees delivery 2028 | 0 |
| GR D.SPRZED.MARKETING Contract employees marketing Contract employees marketing 2028 | 0 |
| Kapitalizacja - Contract employees marketing Kapitalizacja - Contract employees marketing 2028 | 0 |
| GR E.ZARZ.OGÓLNE Usługi doradcze - Consulting Usługi doradcze - Lech Consulting 2028 | 0 |
| GR B.TKW.INNE Pozostałe koszta 2028 | 0 |
| External services PL External services PL 2028 | 0 |
| PL B.ICO Licencje Grupowe 2028 | 10 |
| PL D.SPRZED.MARKETING Commissions for Sales 2028 | 5 |
| PL B.TKW.INFTASTRUKTURA Office costs Koszty biura 2028 | 0 |
| PL E.ZARZ.OGÓLNE HQ adm. costs Delegations and representation 2028 | 0 |
| PL D.SPRZED.MARKETING Marketing and promotion costs Events 2028 | 0 |
| PL D.SPRZED.MARKETING Conference and representation costs Marketing and conferences 2028 | 0 |
| PL E.ZARZ.OGÓLNE Consultant and legal fees Koszty doradców i prawników 2028 | 0 |
| PL D.SPRZED.SPRZEDAŻ Fleet management costs Koszty transportu 2028 | 0 |
| PL B.TKW.INFTASTRUKTURA IT equipment rental costs Wyposażenie IT 2028 | 0 |
| PL B.TKW.IT Contract employees IT Contract employees IT - all 2028 | 0 |
| Kapitalizacja - Contract employees IT Kapitalizacja - Contract employees IT 2028 | 10 |
| PL D.SPRZED.SPRZEDAŻ Contract employees sprzedaż Contract employees sprzedaż 2028 | 0 |
| PL D.SPRZED.DELIVERY Contract employees delivery Contract employees delivery 2028 | 0 |
| PL D.SPRZED.MARKETING Contract employees marketing Contract employees marketing 2028 | 0 |
| PL B.TKW.INNE Pozostałe koszta 2028 | 0 |
| Założenia do bilansu BS aassumptions Assets Aktywa 2028 | 1 |
| Tangible fixed assets nieaktywne Rzeczowe aktywa trwałe 2028 | 0 |
| Investment nieaktywne Inwestycja 2028 | 0 |
| Disposal nieaktywne Sprzedaż 2028 | 0 |
| GR B.TKW.AMORTYZACJA Value of amortization nieaktywne Wartość amortyzacji 2028 | 21.317 |
| Investment real estate Inwestycje w nieruchomości Acquisition of investment real estate Nabycie nieruchomości inwestycyjnych 2028 | 0 |
| Sale of investment real estate Sprzedaż nieruchomości inwestycyjnych Value of the company Wartość firmy 2028 | 0 |
| Investment Inwestycja 2028 | 0 |
| Percent of amortization (%) Procent amortyzacji (%) 2028 | 50 |
| Intangible property Wartość niematerialna 2028 | 0 |
| Investment, w tym kapitalizacja Inwestycja 2028 | 80 |
| Disposal Sprzedaż Percent of amortization (%) Procent amortyzacji (%) 2028 | 2 |
| Materials Materiały 2028 | 0 |
| Rotation (days) Obrót (dni) 2028 | 0 |
| Semi-finished and finished products pending Półprodukty i gotowe produkty w toku 2028 | 0 |
| Finished products Gotowe produkty 2028 | 0 |
| Goods Towary 2028 | 0 |
| Advances for deliveries Zaliczki na dostawy 2028 | 0 |
| Receivables from related parties Należności od jednostek powiązanych 2028 | 0 |
| DE Należności z tyt. Sprzedaży 2028 | 0 |
| US Pożyczki 2028 | 0 |
| Receivables from other parties Należności od innych stron 2028 | 0 |
| Net Sales: Przychody ze sprzedazy: 2028 | 0 |
| Marketplace Marketplace 2028 | 0 |
| Digital Twin (SAAS) Digital Twin (SAAS) 2028 | 0 |
| Internet of Things (IoT) Internet of Things (IoT) 2028 | 0 |
| DRD DRD 2028 | 0 |
| Partnershp Program Partnerski 2028 | 0 |
| Receivables: Należności: 2028 | 0 |
| Payment term 2028 | 1 |
| VAT VAT 2028 | 34.244 |
| zwiększenie naliczony 2028 | 22.26 |
| Liabilities - assumptions Pasywa - założenia 2028 | 1 |
| Kaputały Własne Equity attributed to the parent company Kapitał zakładowy 2028 | 0 |
| Revaluation reserve Kapitał zapasowy 2028 | 0 |
| Loan commitments Zobowiązania pożyczkowe 2028 | 0 |
| Leasing Leasing 2028 | 0 |
| Government grants Dotacje rządowe 2028 | 0 |
| Other liabilities to other entities Inne zobowiązania długoterminowe 2028 | 0 |
| Short-term Zobowiązania krótkoterminowe Investment credits Kredyty inwestycyjne 2028 | 0 |
| Working capital loans Kredyty na kapitał obrotowy 2028 | 0 |
| Loans Pożyszki udziałowców 2028 | 0 |
| Factoring Faktoring 2028 | 0 |
| Liabilities due to loans Zobowiązania z tytułu pożyczek od udziałowców 2028 | 0 |
| liabilities under agremment Zobowiązania z tytułu dostaw i usług powiązane 2028 | 0 |
| Rotation of liabilities in days Rotacja zobowiązań w dniach 2028 | 0 |
| Liabilities for deliveries and services and other Zobowiązania z tytułu dostaw i usług niepowiązane 2028 | 0 |
| CREDITS AND LOANS KREDYTY I POŻYCZKI 2028 | 100 |
| BANK ACCOUNTS RACHUNKI BANKOWE 2028 | 0 |
| PIT - SETTLEMENTS ROZRACHUNKI PUB-PR PIT 2028 | 3.011 |
| VAT - SETTLEMENTS ROZRACHUNKI PUB-PR VAT 2028 | 0 |
| SETTLEMENTS WITH ZUS ROZRACHUNKI PUB-PR ZUS 2028 | 13.252 |
| SETTLEMENTS WITH SUPPLIERS ROZRACHUNKI Z DOSTAWCAMI 2028 | 33.203 |
| SETTLEMENTS WITH EMPLOYEES ROZRACHUNKI Z PRACOWNIKAMI 2028 | 12.533 |
| SETTLEMENTS WITH SHAREHOLDERS ROZRACHUNKI Z UDZIAŁOWCAMI 2028 | 144.487 |
| SETTLEMENTS WITH CONTRACTORS ROZRACHUNKI ZE ZLECENIOBIORCAMI 2028 | 0 |
| VAT ACCOUNT RACHUNEK VAT 2028 | 0 |
| Others Variable 2028 | 0 |
| Government grants Zyski nadzwyczajne - Dotacje NCBiR 2028 | 0 |
| NCBiR Rozliczenie Razem 2028 | 0 |
| Dofinansowanie planowane 2028 | 140.56 |
| Grant / Polska Grant / Polska 2028 | 0 |
| Grant / Niemcy Grant / Niemcy 2028 | 0 |
| Grant / USA Grant / USA 2028 | 0 |
| Grant / Japonia Grant / Japonia 2028 | 0 |
| Gropu Licences ICO Licencje Grupowe ICO 2028 | 0 |
| Polska (PLN) 2028 | 0 |
| Niemcy (PLN) 2028 | 0 |
| USA (PLN) 2028 | 0 |
| Japonia (PLN) 2028 | 0 |
| Sensor sales ICO Sprzedaż czujników ICO 2028 | 0 |
| Polska (QTY) Polska (QTY) 2028 | 0 |
| Niemcy (QTY) Niemcy (QTY) 2028 | 0 |
| USA (QTY) USA (QTY) 2028 | 0 |
| Japonia (QTY) Japonia (QTY) 2028 | 0 |
| DE Niemcy (EUR) 75.00 Niemcy (EUR) 2028 | 0 |
| US USA (USD) 75.00 USA (USD) 2028 | 75 |
| JP Japonia (Jen) 2028 | 11.385 |
| Polska (PLN) Polska (PLN) 2028 | 0 |
| Niemcy (PLN) Niemcy (PLN) 2028 | 0 |
| USA (PLN) USA (PLN) 2028 | 0 |
| Japonia (PLN) Japonia (PLN) 2028 | 0 |
| Shares in other entities Udziały i akcje w podmiotach powiązanych 2028 | 0 |
| Niemcy (EUR) Niemcy (EUR) 2028 | 0 |
| USA (USD) USA (USD) 2028 | 0 |
| Japonia (Jen) Japonia (Jen) 2028 | 0 |
| === Sheet: Rev. PL === PL Y - with EU, N - without EU 2028 | 1 |
| PLN Y 2028 | 1 |
| Take rate 2028 | 0 |
| Engineer's support 2028 | 0 |
| Consultant's support 2028 | 0 |
| Licences 2028 | 0 |
| Trainings 2028 | 0 |
| Other 2028 | 0 |
| Partnerships 2028 | 0 |
| Recurring fees 2028 | 0 |
| wzrost 2028 | 91 |
| Market Marketplace IRIS + IoT + DT SAAS Market Produkty specjalizstyczne Partn. Consult. Targi Szkolenia Market 2028 | 25 |
| Market Take rate 2028 | 1 |
| Market Number of transactions 2028 | 0 |
| Market Avg. Transaction value (PLN) 2028 | 1.31 |
| Market Value of transactions (PLN) 2028 | 0 |
| Market Take rate % 2028 | 1 |
| Market Commission PLN 2028 | 0 |
| Market Market TOTAL (PLN) 2028 | 0 |
| DT SAAS DT SAAS DT SAAS DT SAAS 2028 | 50 |
| DT SAAS POLAND DT SAAS QTY 2028 | 1 |
| DT SAAS Trial 2028 | 0 |
| DT SAAS Standard 2028 | 0 |
| DT SAAS Enterprise 2028 | 0 |
| DT SAAS Individual 2028 | 0 |
| DT SAAS Other 2028 | 0 |
| DT SAAS 2028 | 0 |
| DT SAAS DT SAAS TOTAL QTY 2028 | 0 |
| DT SAAS DT SAAS PRICE EUR 2028 | 1 |
| DT SAAS DT SAAS VALUE (PLN) 2028 | 1 |
| DT SAAS DT SAAS TOTAL VALUE POLAND (PLN) 2028 | 0 |
| DT SAAS DT SAAS 2028 | 50 |
| DT SAAS rest of EUROPE: DT SAAS QTY 2028 | 1 |
| DT SAAS DT SAAS RAZEM QTY 2028 | 0 |
| DT SAAS DT SAAS PRICE (PLN) PLN EUR 2028 | 1 |
| DT SAAS DT SAAS TOTAL VALUE rest of EUROPE (PLN) 2028 | 0 |
| DT SAAS DT SAAS TOTAL DT SAAS (PLN) 2028 | 0 |
| IoT IoT IoT 2028 | 25 |
| IoT PL IoT QTY 2028 | 1 |
| IoT Data collector installed total number of invoiced machines/sensors 2028 | 0 |
| IoT Group installations new installations 2028 | 0 |
| IoT Data management total number of invoiced machines/sensors 2028 | 0 |
| IoT IoT TOTAL QTY 2028 | 0 |
| IoT IoT Price USD 2028 | 1 |
| IoT Data collector installed Cost of sensor installation on machines 2028 | 250 |
| IoT Group installations The installation of the communication system for each group of 2028 | 3 |
| IoT Data management Monthly fee for IoT system operation 2028 | 120492 |
| IoT Value 2028 | 1 |
| IoT Data collector installed 2028 | 0 |
| IoT Group installations 2028 | 0 |
| IoT Data management 2028 | 0 |
| Enterprise 2028 | 0 |
| IoT IoT TOTAL PL PLN 2028 | 0 |
| IoT IoT 2028 | 25 |
| IoT Other countries IoT QTY 2028 | 1 |
| IoT IoT TOTAL Other countries 2028 | 0 |
| IoT IoT DT SAAS TOTAL PLN 2028 | 0 |
| DRD QTY 2028 | 1 |
| DRD Map generator Generator mapy rozwoju 2028 | 0 |
| DRD Map workshop Warsztat budowy mapy rozwoju 2028 | 0 |
| DRD Implementation support Wsparcie wdrożeniowe mapy 2028 | 0 |
| DRD DRD DRD DRD DRD TOTAL QTY 2028 | 0 |
| DRD DRD PRICE PLN EUR 2028 | 1 |
| DRD Map generator 2028 | 299299 |
| DRD Map workshop opłata jednorazowa 2028 | 5.319 |
| DRD Implementation support 2028 | 799799 |
| DRD DRD DRD DRD DRD VALUE 2028 | 1 |
| DRD Map workshop 2028 | 0 |
| DRD DRD DRD DRD DRD POLAND PLN 2028 | 0 |
| DRD rest of EUROPE: DRD QTY 2028 | 1 |
| DRD Map workshop one time payment 2028 | 5.319 |
| DRD DRD DRD DRD DRD VALU (PLN) 2028 | 1 |
| DRD DRD DRD DRD DRD EUROPA PLN 2028 | 0 |
| DRD DRD TOTAL DRD PLN 2028 | 0 |
| Partner 2028 | 240000 |
| Partner Showroom Partner ILOŚĆ 2028 | 1 |
| Partner Showroom subscriptions 2028 | 0 |
| Partner Showroom implementations 2028 | 0 |
| Partner Showroom support 2028 | 0 |
| Partner OTHER 2028 | 0 |
| Partner Partner RAZEM QTY 2028 | 0 |
| Partner Partner CENA 2028 | 1 |
| Partner Partner WARTOŚĆ 2028 | 1 |
| Partner Partner POLAND PLN 2028 | 0 |
| Partner Partner 2028 | 50 |
| Partner Other Partner QTY 2028 | 1 |
| Partner ROBOT supplier 2028 | 0 |
| Partner EQUIPMENT supplier 2028 | 0 |
| Partner MACHINE supplier 2028 | 0 |
| Partner Partner PRICE (PLN) 2028 | 1 |
| Partner Partner VALUE (PLN) 2028 | 1 |
| Partner Partner rest of EUROPE PLN 2028 | 0 |
| Partner Partner TOTAL AFFILIATE PROGRAM PLN 2028 | 0 |
| === Sheet: Rev. PL alt === PL Y - with EU, N - without EU 2028 | 1 |
| Digital Twin 2028 | 0 |
| IRIS 2028 | 0 |
| Specialised Products 2028 | 0 |
| Workshops, Trainings 2028 | 0 |
| Implementation support 2028 | 0 |
| Market Marketplace Market Market 2028 | 25 |
| DT SAAS SAAS DT SAAS DT SAAS 2028 | 50 |
| DT SAAS QTY 2028 | 1 |
| DT SAAS Digital Twin 2028 | 0 |
| DT SAAS IRIS 2028 | 0 |
| DT SAAS IoT 2028 | 0 |
| DT SAAS IoT per sensor 2028 | 250 |
| DRD Specialised Products DRD 2028 | 25 |
| DRD Workshops, Trainings 2028 | 0 |
| DRD DRD TOTAL QTY 2028 | 0 |
| DRD Implementation support per h 2028 | 799 |
| DRD DRD VALUE 2028 | 1 |
| DRD DRD TOTAL PLN 2028 | 0 |
| === Sheet: HR structure === Status (All) GR 2028 | 45.095 |
| E/K (All) PL 2028 | 21 |
| Values GR/PL Dział Stan. Osoba Sum of 2028 | 1 |
| GR Administration Administration Junior 2028 | 0 |
| Project Manager Justyna Łaskowska 2028 | 9.2 |
| IT Backend Developer Senior Krystian Wieczorek 2028 | 16.5 |
| CPO / Program Manager Ola Markiewicz 2028 | 18 |
| Developer Jeremiasz Kaźmierczak 2028 | 6.003 |
| Michał Łomżyński 2028 | 7.702 |
| Developer / tester 2028 | 0 |
| Developer Unity Wojciech Wesołowski 2028 | 10 |
| R&D Tomasz Jankowski 2028 | 10.695 |
| Senior Engineer (elektronik) Paweł Dera 2028 | 13.2 |
| Unity Developer Mid Hubert Mielnik 2028 | 0 |
| Management CEO Piotr Wisniewski 2028 | 16.5 |
| Piotr Wisniewski powołanie 2028 | 7 |
| CFO Konrad Stefanik 2028 | 16.5 |
| CLO Paweł Kaliński 2028 | 3.5 |
| CTO Konrad Milewski 2028 | 19.2 |
| Marekting Marketing Katarzyna Szwarocka 2028 | 10.695 |
| GR Total 2028 | 174.695 |
| PL Commercial Delivery 2028 | 0 |
| Delivery Manager Sonia Morawska 2028 | 0 |
| Sales IRIS 2028 | 15.65 |
| Sales Head Katarzyna Marszałkiewicz 2028 | 14 |
| Paulo Soares 2028 | 5 |
| Unity developer junior Mateusz Ochman 2028 | 0 |
| Management CM Polska Bartek Straszak 2028 | 16 |
| Marekting Sales Junor Kamil Kuczek 2028 | 7.722 |
| Sales Senior 2028 | 0 |
| Dorota Drzewiecka 2028 | 0 |
| PL Total 2028 | 64.672 |
| Grand Total 2028 | 239.367 |
| === Sheet: Lab. PL === 2028 | 3.137 |
| Total salary cost 2028 | 0 |
| E GR NIE GROUP Total salary cost 2028 | 0 |
| KAPITALIZACJA E GR TAK to be capitalised 2028 | 21.03 |
| E PL NIE PL Total salary cost 2028 | 0 |
| KAPITALIZACJA E PL TAK to be capitalised 2028 | 0 |
| K GR NIE GROUP Total contract cost 2028 | 0 |
| KAPITALIZACJA K GR TAK to be capitalised 2028 | 74.3 |
| K PL NIE PL Total contract cost 2028 | 0 |
| KAPITALIZACJA K PL TAK to be capitalised 2028 | 10 |
| Headcount 2028 | 0 |
| Function Kontrakt Etat 2028 | 1 |
| Funkcja Stały skład 2028 | 21 |
| To hire E GR E.ZARZ.OGÓLNE NIE Administration Administration Junior ADMINISTRACJA 2028 | 5 |
| To hire K PL D.SPRZED.SPRZEDAŻ NIE Marekting Sales Senior SALES 2028 | 12 |
| To hire K GR B.TKW.IT TAK IT Developer / tester IT 2028 | 15 |
| To hire K PL D.SPRZED.SPRZEDAŻ NIE Commercial Sales SALES 2028 | 10 |
| To hire K PL D.SPRZED.DELIVERY NIE Commercial Delivery DELIVERY 2028 | 8 |
| To hire K GR B.TKW.IT TAK IT Developer Unity IT 2028 | 10 |
| Team K PL B.TKW.IT NIE IT 2028 | 3 |
| Team E PL E.ZARZ.OGÓLNE NIE Management CM Polska MANAGEMENT 2028 | 6 |
| Team K PL D.SPRZED.SPRZEDAŻ NIE Marekting Sales Senior SALES 2028 | 10.16 |
| Team K GR B.TKW.IT TAK IT Unity Developer Mid IT 2028 | 8.5 |
| Team K GR D.SPRZED.DELIVERY NIE Administration Project Manager ADMINISTRACJA 2028 | 9.2 |
| Team K PL D.SPRZED.SPRZEDAŻ NIE Marekting Sales Junor SALES 2028 | 7.722 |
| Team K PL D.SPRZED.SPRZEDAŻ NIE Commercial Sales Head SALES 2028 | 14 |
| Team E GR D.SPRZED.MARKETING NIE Marekting Marketing SALES 2028 | 7 |
| Team K GR B.TKW.IT TAK Management CTO MANAGEMENT 2028 | 18.7 |
| Team K GR E.ZARZ.OGÓLNE NIE Management CFO MANAGEMENT 2028 | 6 |
| Team K GR B.TKW.IT TAK IT Backend Developer Senior IT 2028 | 16.5 |
| Team K PL B.TKW.IT TAK IT Unity developer junior IT 2028 | 10 |
| Team E GR B.TKW.IT TAK IT Developer IT 2028 | 7.01 |
| Team K GR B.TKW.IT TAK IT CPO / Program Manager IT 2028 | 18 |
| Team E PL B.TKW.IT NIE IT 2028 | 3 |
| Team K GR B.TKW.IT TAK IT Senior Engineer (elektronik) IT 2028 | 12.6 |
| Team K GR E.ZARZ.OGÓLNE NIE Management CLO MANAGEMENT 2028 | 6 |
| Team K GR E.ZARZ.OGÓLNE NIE Management CEO MANAGEMENT 2028 | 23 |
| Team K PL D.SPRZED.DELIVERY NIE Commercial Delivery Manager DELIVERY 2028 | 11 |
| Team E GR B.TKW.IT TAK IT R&D IT 2028 | 7.01 |
| Mnożnik grudnia 2028 | 1 |
| Status E/K GR/PL linia kap. Dział Stan. 2028 | 8 |
| SALARIES (GROSS) 2028 | 0 |
| Function Renumeration (Gross) 2028 | 1 |
| TOTAL SALARIES Function Renumeration (Gross) 2028 | 1 |
| Funkcja Wynagrodzenie (Brutto) 2028 | 0 |
| Movement/reduction Function 2028 | 1 |
| Funkcja To hire E GR E.ZARZ.OGÓLNE NIE Administration Administration Junior ADMINISTRACJA 2028 | 0 |
| Ilość pracowników Function Bez proj. Proj. 2028 | 1 |
| K PL E.ZARZ.OGÓLNE NIE ADMINISTRACJA 2028 | 0 |
| K PL E.ZARZ.OGÓLNE NIE MANAGEMENT 2028 | 12 |
| K PL D.SPRZED.MARKETING NIE MARKETING 2028 | 15 |
| K PL D.SPRZED.SPRZEDAŻ NIE SALES 2028 | 10 |
| K PL D.SPRZED.DELIVERY NIE DELIVERY 2028 | 8 |
| E PL E.ZARZ.OGÓLNE NIE ADMINISTRACJA 2028 | 0 |
| E PL E.ZARZ.OGÓLNE NIE MANAGEMENT 2028 | 12 |
| E PL D.SPRZED.MARKETING NIE MARKETING 2028 | 15 |
| E PL D.SPRZED.SPRZEDAŻ NIE SALES 2028 | 10 |
| E PL D.SPRZED.DELIVERY NIE DELIVERY 2028 | 8 |
| Stawki Mnożnik grudnia 2028 | 1 |
| Function Bez proj. Proj. 2028 | 1 |
| K PL D.SPRZED.SPRZEDAŻ NIE MARKETING 2028 | 15 |
| E PL D.SPRZED.SPRZEDAŻ NIE MARKETING 2028 | 15 |
| Koszt razem Function Bez proj. Proj. 2028 | 1 |
| GROUP 2028 | 143.1 |
| Ilość pracowników Function 2028 | 1 |
| Funkcja 2028 | 21 |
| K GR E.ZARZ.Managment NIE Managment 2028 | 3 |
| K GR D.SPRZED.Marketing NIE Marketing 2028 | 0 |
| K GR E.ZARZ.CFO NIE CFO 2028 | 1 |
| K GR E.ZARZ.HR/admin NIE HR/admin 2028 | 1 |
| K GR B.TKW.R&D TAK R&D 2028 | 2 |
| K GR B.TKW.Product manager TAK Product manager 2028 | 1 |
| K GR B.TKW.Dev-unity TAK Dev-unity 2028 | 2 |
| K GR B.TKW.Dev-web TAK Dev-web 2028 | 1 |
| E GR E.ZARZ.Managment NIE Managment 2028 | 0 |
| E GR D.SPRZED.Marketing NIE Marketing 2028 | 0 |
| E GR E.ZARZ.CFO NIE CFO 2028 | 0 |
| E GR E.ZARZ.HR/admin NIE HR/admin 2028 | 0 |
| E GR B.TKW.R&D TAK R&D 2028 | 0 |
| E GR B.TKW.Product manager TAK Product manager 2028 | 0 |
| E GR B.TKW.Dev-unity TAK Dev-unity 2028 | 0 |
| E GR B.TKW.Dev-web TAK Dev-web 2028 | 0 |
| Function 2028 | 1 |
| Koszt razem Function 2028 | 1 |
| K GR B.TKW.Dev-unity TAK Dev.unity 2028 | 20.5 |
| K GR B.TKW.Dev-web TAK Dev.web 2028 | 16 |
| E GR B.TKW.Dev-unity TAK Dev.unity 2028 | 0 |
| E GR B.TKW.Dev-web TAK Dev.web 2028 | 0 |
| STATYSTYKI === Sheet: SQ&A === 2028 | 89 |
| Description DEV/M&S 2028 | 1 |
| Administration 2028 | 0 |
| Expert 2028 | 0 |
| Management 2028 | 0 |
| Marekting 2028 | 0 |
| Zespół 2028 | 1 |
| Commercial 2028 | 0 |
| Commercial UE 2028 | 0 |
| Total Headcount 2028 | 0 |
| GROUP HQ GR HQ Office costs 2028 | 1 |
| GR Administration 2028 | 10 |
| GR Expert 2028 | 0 |
| GR IT 2028 | 5 |
| GR Management 2028 | 7 |
| GR Marekting 2028 | 7 |
| GR Zespół 2028 | 1 |
| GR Commercial 2028 | 5 |
| GR Commercial UE 2028 | 0 |
| GR Total (m 2028 | 2 |
| GR Office - rental cost GR POLAND - Surface (m 2028 | 2 |
| GR POLAND - Price (PLN/m 2028 | 2 |
| GR Total office rental cost NCBiR 2028 | 0 |
| GR Office - other costs GR Media 2028 | 85 |
| GR Total office other costs 2028 | 1 |
| GR GR Total Office costs 2028 | 0 |
| GR Office - investment PLN per capita GR Furniture, general office equipment 2028 | 2500 |
| GR Personal equipment NCBiR 2028 | 11800 |
| GR VR/AR equipment 2028 | 20 |
| GR GR Total office equipment 2028 | 0 |
| GR HQ Licences and SAS costs 2028 | 1 |
| GR Wzrosty: 2028 | 68 |
| GR Kapitalizacja Koszt stały/IoT? GR SaaS - AWS TAK 2028 | 6.37 |
| GR SaaS - Adobe TAK 2028 | 140 |
| GR SaaS - Unity Pro TAK 2028 | 1.458 |
| GR SaaS - Pixyz TAK 2028 | 750 |
| GR SaaS - Digital Ocean TAK 2028 | 2.46 |
| GR SaaS - Sentry TAK 2028 | 830 |
| GR SaaS - Google Cloud Engine TAK 2028 | 0 |
| GR SaaS - Jetbrains TAK 2028 | 614 |
| GR SaaS - GitHub TAK 2028 | 320 |
| GR SaaS - Microsoft TAK 2028 | 0 |
| GR Other software TAK 2028 | 10 |
| GR Server Infrastructure 2028 | 0 |
| GR Salesforce (HUBSPOT) 2028 | 0 |
| GR Mailing/Newsletter 2028 | 0 |
| GR CC Cloud 2028 | 0 |
| GR Linkedin 2028 | 0 |
| GR PHP storm 2028 | 0 |
| GR Other 2028 | 0 |
| GR CAD/Simens/Soldiworks 2028 | 0 |
| GR ERP 2028 | 0 |
| GR Office 2028 | 100 |
| GR GR Total Licences and SAS costs 2028 | 0 |
| GR HQ Fleet management 2028 | 1 |
| GR Fleet - qty car per capita GR Administration 2028 | 0 |
| GR Total fleet - qty 2028 | 0 |
| GR Fleet - rental cost PLN/mth. GR Administration 2028 | 3500 |
| GR Total fleet rental cost 2028 | 0 |
| GR GR Total Fleet cost 2028 | 0 |
| GR HQ IT equipment - rental 2028 | 1 |
| GR IT - rental cost PLN/mth. GR Administration 2028 | 0 |
| GR GR Total IT rental 2028 | 0 |
| GR HQ Other costs 2028 | 1 |
| GR Accounting - external 2028 | 800800 |
| GR Audyt finansowy NCBiR 2028 | 0 |
| GR HR - external 2028 | 0 |
| GR Translations, validations PLN 2028 | 20 |
| GR Wire transfer Web solution 2028 | 0.005 |
| GR Wynajem hardwareu - czujników NCBiR 2028 | 135000 |
| GR Wynajem laboratorium NCBiR 2028 | 15000 |
| GR PLN 2028 | 0 |
| GR GR Total Other costs 2028 | 0 |
| GR HQ Delegations and representation 2028 | 1 |
| GR Number of events per commercial GR POLAND - Small events (DELEGACJA PL?) 2028 | 2 |
| GR POLAND - Large event (DELEGACJA EU?) 2028 | 1 |
| GR Price PLN GR POLAND - Small events 2028 | 1200 |
| GR POLAND - Large event 2028 | 4500 |
| GR GR Total Delegations and representation 2028 | 0 |
| GR PL Marketing and conferences 2028 | 1 |
| GR Number of events GR Fairs / Large Conferences 2028 | 0 |
| GR Fairs / Small Conferences / Online 2028 | 0 |
| GR Marketing online 2028 | 0 |
| GR Others 2028 | 0 |
| GR Cost of events PLN GR Fairs / Large Conferences 2028 | 30000 |
| GR GR Total Marketing and conferences 2028 | 0 |
| PL Bussiness development PL PL Office costs 2028 | 1 |
| PL PL - Surface (m 2028 | 2 |
| PL PL - Price (PLN/m 2028 | 2 |
| PL PL Office - other costs PL 2028 | 0 |
| PL PL Total PL Office costs M&S 2028 | 0 |
| PL PL Delegations and representation 2028 | 1 |
| PL Number of events / personal developent, trainings per commercial PL PL - Small events 2028 | 3 |
| PL PL - Large event 2028 | 0 |
| PL Price PLN PL PL - Small events 2028 | 5000 |
| PL PL Total Delegations and representation (GR) M&S 2028 | 0 |
| PL PL Marketing and conferences 2028 | 1 |
| PL Number of events PL Fairs / Large Conferences 2028 | 0 |
| PL Fairs / Small Conferences / Online 2028 | 0 |
| PL Marketing online 2028 | 0 |
| PL Others 2028 | 0 |
| PL Cost of events PLN PL Fairs / Large Conferences 2028 | 30000 |
| PL PL Total Marketing and conferences M&S 2028 | 0 |
| PL PL Consultant and legal fees 2028 | 1 |
| PL Legal consultants PL Poland 2028 | 8000 |
| PL Germany 2028 | 8000 |
| PL France 2028 | 8000 |
| PL Benelux 2028 | 8000 |
| PL Spain 2028 | 8000 |
| PL Italy 2028 | 8000 |
| PL Czech Rep. 2028 | 8000 |
| PL Slovakia 2028 | 8000 |
| PL Sweden 2028 | 8000 |
| PL HR&Accounting PLN PL Poland 2028 | 13500 |
| PL PL Total Consultant and legal fees M&S 2028 | 0 |
| PL PL Fleet management 2028 | 1 |
| PL Fleet - qty car per capita PL Commercials PL 2028 | 1 |
| PL Fleet - rental cost PLN/mth. PL Commercials PL 2028 | 2500 |
| PL Commercials PL 2028 | 2220 |
| PL PL Total Fleet management M&S 2028 | 0 |
| === Sheet: Amort. PL === Groups of fixed assets Grupy środków trwałych 2028 | 1 |
| Lands Grunty 2028 | 0 |
| Disposal Sprzedaż 2028 | 0 |
| Rate of amortization Stopa amortyzacji 2028 | 0 |
| Buildings Budynki i lokale 2028 | 0 |
| Building structure Budowle 2028 | 0 |
| Boilers and power machines Kotły i maszyny energetyczne 2028 | 0 |
| Machines and equipment for general purpose Maszyny i urządzenia ogolnego przeznaczenia 2028 | 0 |
| Special machines and equipment Marzyny i urządzenia specjalistyczne 2028 | 0 |
| Technical devices Urządzenia techniczne 2028 | 0 |
| Transportation Środki transportu 2028 | 0 |
| Toolings Narządzia i przyżądy ruchome 2028 | 0 |
| Assets under construction Środki trwałe w budowie 2028 | 0 |
| Total fixed assets Razem (środki trwałe) 2028 | 0 |
| === Sheet: Fin. PL === 2028 | 125.178 |
| Kredyty New shares: 2028 | 3.91 |
| Źródła finansowania Sources of funding 2028 | 1 |
| Statutory fund EQUITIES 2028 | 0 |
| Wzrost kapitału zakładowego Unpaid benefits 2028 | 3.45 |
| Pokrycie strat Coverage of losses 2028 | 0 |
| Pozyskiwanie kapitału Raising equity 2028 | 0 |
| Nabycie akcji własnych Purchase of own shares 2028 | 0 |
| ZOBOWIĄZANIA DŁUGOTERMINOWE LONG-TERM LIABILITIES Kredyt inwestycyjny Liabilities to banks due to investment loans 2028 | 0 |
| Wzrost zadłużenia Increase in debt 2028 | 0 |
| Spłata długu Repayment of debt 2028 | 0 |
| Koszt finansowania The cost of financing 2028 | 0.5 |
| Wartość odsetek Interest value 2028 | 0 |
| Zobowiązania pożyczkowe Liabilities due to other loans 2028 | 0 |
| Other financial liabilities Other financial liabilities 2028 | 0 |
| Government grants Government grants 2028 | 0 |
| Kredyt obrotowy Liabilities due to loans 2028 | 0 |
| Kredyty w rachunku bieżącym Liabilities due to loans 2028 | 0 |
| Faktoring Liabilities due to loans 2028 | 0 |
| Zobowiązania z tytułu pożyczki Liabilities due to loans 2028 | 0 |
| Zobowiązania z tytułu leasingu Liabilities due to loans 2028 | 0 |
| Pożyczka Liabilities due to loans 2028 | 0 |
| Finansowanie zewnętrzne External financing 2028 | 0 |
| Wzrost zadłużenia Debt increase 2028 | 0 |
| Wartość odsetek Interest 2028 | 0 |
| === Sheet: Statement DE === 2028 | 0 |
| Opis Description 2028 | 1 |
| A. AKTYWA TRWAŁE A. FIXED ASSETS 2028 | 0 |
| B. AKTYWA OBROTOWE B CURRENT ASSETS 2028 | 0 |
| a. Materiały a. Raw materials 2028 | 0 |
| b. Półprodukty i produkty w toku b. Semi-finished products and work in progress 2028 | 0 |
| Produkty gotowe c. Finished products 2028 | 0 |
| Towary d. Goods 2028 | 0 |
| e. Zaliczki na poczet dostaw e. Advances for deliveries 2028 | 0 |
| a. Należności od podmiotów powiązanych a. Receivables from related parties 2028 | 0 |
| b. Należności od pozostałych podmiotów b. Receivables from other entities 2028 | 0 |
| A. KAPITAŁ WŁASNY OGÓŁEM A. TOTAL SHAREHOLDERS' EQUITY 2028 | 0 |
| B. ZOBOWIĄZANIA DŁUGOTERMINOWE B. LONG-TERM LIABILITIES 2028 | 0 |
| a. Zobowiązania wobec banków z tytułu kredytów a. Bank loans to be repaid 2028 | 0 |
| b. Zobowiązania pożyczkowe b. Borrowings 2028 | 0 |
| Pozostałe zobowiązania finansowe d. Other external financing sources 2028 | 0 |
| a. Dotacje rządowe a. Government subsidies 2028 | 0 |
| b.Pozostałe zobowizania b. Other liabilities 2028 | 0 |
| Wobec podmiotów powiązanych To related parties 2028 | 0 |
| Wobec pozostałych podmiotów To other entities 2028 | 0 |
| ZOBOWIĄZANIA KRÓTKOTERMINOWE C. SHORT-TERM LIABILITIES 2028 | 0 |
| Kredyty inwestycyjne Investment loans 2028 | 0 |
| Kredyty obrotowe Working capital loans 2028 | 0 |
| Kredyty w rachunku bieżącym (overdrafty) Overdrafts 2028 | 0 |
| b. Zobowiązania z tytułu pożyczek b. Borrowings to be repaid 2028 | 0 |
| Zobowiązania z tytułu leasingu c. Leasing 2028 | 0 |
| a. Do jednostek powiązanych a.To related parties 2028 | 0 |
| Z tytułu dostaw i usług Trade liabilities 2028 | 0 |
| Z tytułu dywidend i innych zobowiązań kapitałowych Dividends and other capital liabilities 2028 | 0 |
| pozostałe zobowiązania Other liabilities 2028 | 0 |
| b. Do pozostałych jednostek b.To other entities 2028 | 0 |
| z tytułu wynagrodzeń Payroll 2028 | 0 |
| Pozostałe zobowiązania Other liabilities (including contingent, regarding acquisition of companies) 2028 | 0 |
| Dotacje rządowe c. Government subsidies d. Fundusze specjalne d. Special funds 2028 | 0 |
| a. Rezerwa na świadczenia pracownicze a.Provision for employee benefits 2028 | 0 |
| b.Pozostałe rezerwy krótkoterminowe b. Other short-term provisions 2028 | 5 |
| PASYWA LIABILITIES 2028 | 0 |
| Wariant PORÓWNAWCZY: Opis Description 2028 | 1 |
| A. Przychody ze sprzedaży netto A. Net Sales 2028 | 0 |
| B. Koszty działalności operacyjnej B. Operating expenses 2028 | 0 |
| Zysk (strata) ze sprzedaży (A-B) C. Profit (loss) on sales (A-B) 2028 | 0 |
| Pozostałe przychody operacyjne D. Other operating income 2028 | 0 |
| E. Pozostałe koszty operacyjne E. Other operating expenses 2028 | 0 |
| G. Przychody finansowe G. Financial income 2028 | 0 |
| H. Koszty finansowe H. Financial costs 2028 | 0 |
| K. Zysk (strata) brutto (I±J) K. Gross profit (loss) (I ± J) 2028 | 0 |
| Podatek dochodowy L. CIT 2028 | 0 |
| N. Zysk (strata) netto (K-L-M) N. Net profit (loss) (Q-L-M) 2028 | 0 |
| Wariant KALKULACYJNY: #DIV/ 2028 | 0 |
| Opis Opis 2028 | 1 |
| Przychody netto ze sprzedaży produktów I. Przychody netto ze sprzedaży produktów 2028 | 0 |
| Big Data (MaaS) Big Data (MaaS) 2028 | 0 |
| Program Partnerski Program Partnerski 2028 | 0 |
| B.ICO – jednostkom powiązanym – jednostkom powiązanym 2028 | 0 |
| B.TKW I. Koszt wytworzenia sprzedanych produktów I. Koszt wytworzenia sprzedanych produktów 2028 | 0 |
| B.MAT II. Wartość sprzedanych towarów i materiałów II. Wartość sprzedanych towarów i materiałów 2028 | 0 |
| D.SPRZED D. Koszty sprzedaży D. Koszty sprzedaży 2028 | 0 |
| E.ZARZ E. Koszty ogólnego zarządu E. Koszty ogólnego zarządu 2028 | 0 |
| G. Pozostałe przychody operacyjne G. Pozostałe przychody operacyjne 2028 | 0 |
| Dotacje II. Dotacje 2028 | 0 |
| Inne przychody operacyjne IV. Inne przychody operacyjne 2028 | 0 |
| H. Pozostałe koszty operacyjne H. Pozostałe koszty operacyjne 2028 | 0 |
| Aktualizacja wartości aktywów niefinansowych II. Aktualizacja wartości aktywów niefinansowych 2028 | 0 |
| Inne koszty operacyjne III. Inne koszty operacyjne 2028 | 0 |
| J. Przychody finansowe J. Przychody finansowe 2028 | 0 |
| b) od jednostek pozostałych, w tym: b) od jednostek pozostałych, w tym: 2028 | 0 |
| Odsetki II. Odsetki 2028 | 0 |
| Aktualizacja wartości aktywów finansowych IV. Aktualizacja wartości aktywów finansowych 2028 | 0 |
| Inne V. Inne 2028 | 0 |
| K. Koszty finansowe K. Koszty finansowe 2028 | 0 |
| Odsetki, w tym: I. Odsetki, w tym: 2028 | 0 |
| Aktualizacja wartości aktywów finansowych III. Aktualizacja wartości aktywów finansowych 2028 | 0 |
| Inne IV. Inne 2028 | 0 |
| Zysk (strata) brutto (I+J–K) L. Zysk (strata) brutto (I+J–K) 2028 | 0 |
| N. Pozostałe obowiązkowe zmniejszenia zysku (zwiększenia straty) N. Pozostałe obowiązkowe zmniejszenia zysku (zwiększenia straty) 2028 | 0 |
| Zysk (strata) netto (L–M–N) Zysk (strata) netto (L–M–N) 2028 | 0 |
| A. Przepływy środków pieniężnych z działalności operacyjnej A. Cash flow from operating activities 2028 | 0 |
| a. Amortyzacja a. Amortisation and depreciation 2028 | 0 |
| f. Zmiana stanu zapasów f. Change in inventory 2028 | 0 |
| g. Zmiana stanu należności g. Change in receivables 2028 | 0 |
| Zmiana stanu rozliczeń międzyokresowych i. Change in prepayments and accurals 2028 | 0 |
| j. Inne korekty j. Other adjustments 2028 | 0 |
| B. Przepływy środków pieniężnych z działalności inwestycyjnej B. CF from investment activities 2028 | 0 |
| a. Zbycie wartości niematerialnych i prawnych a. Disposal of intangible and tangible fixed assets 2028 | 0 |
| Wpływy aktywów finansowych, w tym c. From financial assets, including: 2028 | 0 |
| zbycie aktywów finansowych sales of financial assets 2028 | 0 |
| otrzymane dywidendy i udziały w zyskach dividend and profit sharing 2028 | 0 |
| otrzymane spłaty pożyczek długoterminowych repayment of granted L-term loans 2028 | 0 |
| odsetki otrzymane interest 2028 | 0 |
| inne wpływy z aktywów finansowych other inflows from financial assets 2028 | 0 |
| Na aktywa finansowe, w tym c. For financial assets, including: 2028 | 0 |
| nabycie aktywów finansowych purchase of financial assets 2028 | 0 |
| udzielone pożyczki długoterminowe L-term loans granted 2028 | 0 |
| Przepływy środków pieniężnych z działalności finansowej C. CF from financial activities 2028 | 0 |
| b. Kredyty i pożyczki b. Credits and loans 2028 | 0 |
| Emisja dłużnych papierów wartościowych c. Issuance of debt securities 2028 | 0 |
| Inne wpływy finansowe d. Other inflows form financial activities 2028 | 0 |
| a. Nabycie udziałów własnych a. Purchase of own shares 2028 | 0 |
| Spłaty kredytów i pożyczek d. Repayment of credits and loans 2028 | 0 |
| e. Wykup dłużnych papierów wartościowych e. Redemption of debt securities 2028 | 0 |
| f. Z tyt. zobowiązań finansowych f. Payment of other financial liabilities 2028 | 0 |
| g.. Płatności z umów leasingu finansowego g. Payment of liabilities arising from financail leases 2028 | 0 |
| h. Odsetki h. Interest 2028 | 0 |
| Inne wydatki finansowe i. Other outflows from financial activities 2028 | 0 |
| Przepływy pieniężne netto razem D. Total net Cash Flow 2028 | 0 |
| E. Środki pieniężne na początek okresu E. Cash opening balance 2028 | 0 |
| F. Środki pieniężne na koniec okresu F. Closing balance of cash 2028 | 0 |
| Wskaźniki rentowności aktywów wynik fin netto / aktywa % Wskaźnik rentowności netto aktywów (ROA) 2028 | -9.2 |
| wynik fin brutto / aktywa % Wskaźnik rentowności brutto aktywów 2028 | -9.2 |
| zysk zatrzymany / aktywa % Wskaźnik rentowności skumulowanej aktywów 2028 | -9.2 |
| wynik netto / aktywa trwałe % Wskaźnik rentowności aktywów trwałych 2028 | -862.7 |
| wynik netto / aktywa obrotowe % Wskaźnik rentowności aktywów obrotowych 2028 | -9.2 |
| wynik netto / aktywa netto % Wskaźnik rentowności aktywów netto 2028 | -9.2 |
| Wskaźniki rentowności sprzedaży wynik finansowy netto / Przychody ogółem % Wskaźnik rentowności netto sprzedaży 2028 | -263.2 |
| wynik finansowy brutto / Przychody ogółem % Wskaźnik rentowności brutto sprzedaży 2028 | -263.2 |
| wynik z działalności gosp. / przychodzy z działalności gosp. % Wskaźnik rentowności gospodarczej sprzedaży 2028 | -263.2 |
| wynik z działalności oper. / Przychodzy z działalności oper. % Wskaźnik rentowności operacyjnej sprzedaży 2028 | -263.2 |
| wynik ze sprzedaży / przychodzy ze sprzedaży % Wskaźnik rentownosci sprzdaży (produktów, towarów) 2028 | -263.2 |
| wynik finansowy netto / Przychody netto ze sprzedaży % Wskaźnik rentowności sprzedaży netto (ROS) 2028 | -263.2 |
| koszty / przychody % Wskaźnik poziomu kosztów 2028 | 363.2 |
| Wskaźniki rentowności kapitałów wynik netto / kapitał całkowity % Wskaźniki rentowności kapitału całkowitego 2028 | -9.2 |
| wynik netto / kapitał własny % Wskaźniki rentowności netto kapitału własnego (ROE) 2028 | -9.2 |
| wynik brutto / kapitał własny % Wskaźniki rentowności brutto kapitału własnego (ROEb) 2028 | -9.2 |
| wynik netto / kapitał zakładowy % Wskaźnik rentowności kapitału zakładowego 2028 | -8.4 |
| Wskaźniki płynności finansowej aktywa obrotowe / zobowiązania krótkoterminowe Wskaźnik bieżącej płynności finansowej (płynność III stopnia) 2028 | 29983.9 |
| płynne aktywa obrotowe / zobowiązania krótkoterminowe Wskaźnik szybkiej płynności inansowej (płynność II stopnia) 2028 | 29983.9 |
| środki pieniężne / zobowiązania krótkoterminowe Wskaźnik płynności gotówkowej (płynność I stopnia) 2028 | 17353.6 |
| KON / zapasy + należności krótkoterminowe % Wskaźnik udziału kapitału obrotowego netto w finansowaniu aktywów obrotowych 2028 | 4095.2 |
| kapitał obrotowy / aktywa ogółem % Wskaźnik kapitału obrotowego do aktywów ogółem 2028 | 100 |
| kapitał obrotowy / aktywa obrotowe % Wskaźnik kapitału obrotowego do aktywów obrotowych 2028 | 100 |
| kapitał obrotowy / zapasy + należności % Wskaźnik kapitału obrotowego do zapasów i należności 2028 | 4095.2 |
| kapitał obrotowy / zobowiązania krótkoterminowe % Wskaźnik kapitału obrotowego do zobowiązań krótkoterminowych 2028 | 29883.9 |
| Przychody ogółem / Aktywa trwałe Wskaźnik rotacji aktywów trwałych 2028 | 206.5 |
| Przychody ogółem / Zobowiązania Wskaźnik rotacji zobowiązań w razach 2028 | 180.43 |
| Zobowiązania / Przychody ogółem x 2028 | 365 |
| Analiza rotacji kapitałów Przychody ze sprzedaży / Kapitał całkowity Wskaźnik rotacji kapitałów w razach 2028 | 0.03 |
| Przychody ze sprzedaży / Kapitał własny Wskaźnik rotacji kapitału własnego w razach 2028 | 0.03 |
| Przychody ze sprzedaży / Zobowiązania Wskaźnik rotacji zobowiązań w razach 2028 | 180.43 |
| Przychody ze sprzedaży / Zobowiązania krótkoterminowe Wskaźnik rotacji zobowiązań krótkoterminowych w razach 2028 | 180.43 |
| Zobowiązania krótkoterminowe / Przychody ze sprzedaży x 2028 | 365 |
| Analiza poziomu zadłużenia Zobowiązania ogółem / Aktywa ogółem Wskaźnik ogólnego zadłużenia 2028 | 0 |
| Kapitał własny / Aktywa ogółem Wskaźnik pokrycia aktywów kapitałem własnym 2028 | 100 |
| Zobowiązania długoterminowe / Kapitał własny x 2028 | 100 |
| Zobowiązania krótkoterminowe / kapitał własny x 2028 | 100 |
| Zobowiązania długoterminowe / Zobowiązania ogółem Wskaźnik struktury zobowiązań długoterminowych 2028 | 0 |
| Zobowiązania krótkoterminowe / Zobowiązania ogółem Wskaźnik struktury zobowiązań krótkoterminowych 2028 | 100 |
| Zobowiązania ogółem / Kapitał własny Wskaźnik zadłużenia kapitału własnego 2028 | 0 |
| Zobowiązania długoterminowe / Kapitał własny Wskaźnik długoterminowego zadłużenia kapitału własnego 2028 | 0 |
| ROEb / ROAbo Wskaźnik efektu dźwigni finansowej 2028 | 100 |
| Net Sales Przychody netto ze sprzedaży razem 2028 | 0 |
| c) Internet of Things (IoT) c) Internet of Things (IoT) 2028 | 0 |
| Amortization Amortyzacja 2028 | 0 |
| B.TKW Zużycie materiałów i energii razem 2028 | 0 |
| Udział do dochodu 2028 | 0 |
| External services Usługi zewnętrzne 2028 | 0 |
| E.ZARZ Office (+ 2028 | 199 |
| B.TKW Fleet Flota 2028 | 500 |
| Variables: Zmienne: B.ICO Group licences Licencje grupowe 2028 | 10 |
| D.SPRZED Commissions for Sales Prowizje dla Salesów 2028 | 5 |
| D.SPRZED Fuel Paliwo 2028 | 200 |
| Gross remuneration Wynagrodzenia brutto 2028 | 0 |
| % rate change Zmiana stawki % 2028 | 10 |
| MARKETING MARKETING - - 2028 | 8.9 |
| SALES SALES - - 2028 | 8.9 |
| B.TKW DELIVERY DELIVERY 2028 | 0 |
| Share of income Udział do dochodu 2028 | 0 |
| Change Proporcja 2028 | 0 |
| Other costs by type Inne koszty według rodzaju 2028 | 0 |
| Value of goods and materials sold Wartość sprzedanych towarów i materiałów 2028 | 0 |
| ICO - material purchase ICO - material purchase ICO price EUR 2028 | 75 |
| Other operating revenues Pozostałe przychody operacyjne 2028 | 0 |
| Zmiana 2028 | 0 |
| Other operating cost Pozostałe koszty operacyjne 2028 | 0 |
| Financial income interest Odsetki od dochodów finansowych 2028 | 0 |
| Zmiana Financial costs interest Pozostałe koszty finansowe 2028 | 0 |
| Gross profit Gross profit 2028 | 0 |
| Cumulative Gross profit Cumulative Gross profit 2028 | 0 |
| Tax rate Realna stopa procentowa (CIT+podatek od osób prawnych) 2028 | 30 |
| Tangible fixed assets Rzeczowe aktywa trwałe 2028 | 0 |
| Value of amortization Wartość amortyzacji est. 2028 | 0 |
| Equity Kaputały Własne Equity attributed to the parent company Kapitał zakładowy 2028 | 0 |
| Loans in current account (overdrafts) Kredyty w rachunku bieżącym 2028 | 0 |
| Liabilities due to loans Zobowiązania z tytułu pożyczek 2028 | 0 |
| Government grants Dotacje rządowe === Sheet: Rev. DE === DE Y - with EU, N - without EU 2028 | 1 |
| EUR Y 2028 | 1 |
| Market Number of Projects 2028 | 1 |
| Market Polska 2028 | 0 |
| Market Niemcy 2028 | 0 |
| Market Francja 2028 | 0 |
| Market Benelux 2028 | 0 |
| Market Hiszpania 2028 | 0 |
| Market Włochy 2028 | 0 |
| Market Czechy 2028 | 0 |
| Market Słowacja 2028 | 0 |
| Market Szwecja 2028 | 0 |
| Market Market TOTAL QTY 2028 | 0 |
| Market Market Avg. Project value CAPEX EUR CAPEX PLN 2028 | 1 |
| Market Market Project value 2028 | 1 |
| Market Market TOTAL project value 2028 | 0 |
| Market Market % take rate 2028 | 1 |
| Market Market Take rate 2028 | 1 |
| Market Market TOTAL Sales divided in two steps 2028 | 50 |
| DT SAAS DT SAAS DT SAAS 2028 | 100 |
| DT SAAS DE DT SAAS QTY 2028 | 1 |
| DT SAAS Visualization 2028 | 0 |
| DT SAAS Simulation 2028 | 0 |
| DT SAAS Algorithmization 2028 | 2 |
| DT SAAS DT SAAS Value 2028 | 1 |
| DT SAAS DT SAAS TOTAL DE EUR 2028 | 0 |
| DT SAAS Other countries DT SAAS QTY 2028 | 1 |
| DT SAAS DT SAAS Price PLN EUR 2028 | 1 |
| DT SAAS DT SAAS TOTAL other countries EUR 2028 | 0 |
| DT SAAS DT SAAS DT SAAS TOTAL EUR 2028 | 0 |
| IoT DE IoT QTY 2028 | 1 |
| IoT Data collector installations total number of invoiced machines/sensors 2028 | 0 |
| IoT IoT RAZEM QTY 2028 | 0 |
| IoT IoT Price EUR 2028 | 1 |
| IoT Data collector installations Cost of sensor installation on machines per machine 2028 | 250250 |
| IoT Data management Monthly fee for IoT system operation per machine 2028 | 120120 |
| IoT Data collector installations 2028 | 0 |
| IoT IoT TOTAL DE EUR 2028 | 0 |
| IoT IoT DT SAAS TOTAL EUR 2028 | 0 |
| DRD DE DRD QTY 2028 | 1 |
| DRD DRD DRD DRD DRD TOTAL DE EUR 2028 | 0 |
| DRD Other countries DRD QTY 2028 | 1 |
| DRD DRD DRD DRD DRD TOTAL other countries EUR 2028 | 0 |
| DRD DRD DRD TOTAL EUR 2028 | 0 |
| Partner Showroom Partner QTY 2028 | 1 |
| Partner Partner TOTAL QTY 2028 | 0 |
| Partner Partner Price EUR 2028 | 1 |
| Partner Partner VALUE 2028 | 1 |
| Partner Partner TOTAL DE EUR 2028 | 0 |
| Partner Partner Account 2028 | 0 |
| Partner Implementations/Services 2028 | 0 |
| Partner Partner TOTAL other countries EUR 2028 | 0 |
| Partner Partner TOTAL Partnerships EUR 2028 | 0 |
| === Sheet: Amort. DE === Groups of fixed assets Grupy środków trwałych 2028 | 1 |
| Unidentified Niezidentyfikowane 2028 | 0 |
| Kredyty Loans Źródła finansowania Sources of funding 2028 | 1 |
| Zestawienie projektów w budżecie Marpol Kapitał podstawowy EQUITIES 2028 | 0 |
| Niezapłacone świadczenia Unpaid benefits 2028 | 0 |
| Wpłaty na kapitał własny Coverage of losses 2028 | 0 |
| ZOBOWIĄZANIA DŁUGOTERMINOWE LONG-TERM LIABILITIES Kredyt inwestycyjny Liabilities to banks due to loans 2028 | 0 |
| Zobowiązania pożyczkowe Liabilities to banks due to loans 2028 | 0 |
| Partycypacja lokatorów, kaucje / waloryzacja Wzrost zadłużenia Increase in debt 2028 | 0 |
| Spłata długu Repayment of debt Koszt finansowania The cost of financing 2028 | 0 |
| Kredyt obrotowy Loans in current account (overdrafts) 2028 | 0 |
| Kredyty w rachunku bieżącym Loans in current account (overdrafts) 2028 | 0 |
| Faktoring Loans in current account (overdrafts) 2028 | 0 |
| Zobowiązania z tytułu pożyczki Loans in current account (overdrafts) 2028 | 0 |
| Liabilities due to loans 2028 | 0 |
| Wartość odsetek 2028 | 0 |
| Faktoring Factoring 2028 | 0 |
| === Sheet: Statement US === Bilans Balance Sheet 2028 | 0 |
| P&L Opis Description 2028 | 1 |
| === Sheet: Ass. US === B.TKW B.MAT Cash 2028 | 0 |
| D.SPRZED E.ZARZ P&L 2028 | 0 |
| P&L aassumptions P&L Assumptions 2028 | 1 |
| Net Sales total Net Sales total 2028 | 0 |
| Lines: Lines: 2028 | 0 |
| e) Partnerships e) Partnerships 2028 | 0 |
| Change Change in the balance of products Zmiana stanu produktów 2028 | 0 |
| Zużycie materiałów i energii razem 2028 | 0 |
| E.ZARZ Office Biuro 2028 | 250 |
| B.TKW Accommodation cost (housing, car rental) Accommodation cost (housing, car rental) 2028 | 450 |
| D.SPRZED Participation in industry events Participation in industry events 2028 | 200 |
| Change Udział do dochodu 2028 | 0 |
| RATES STAWKI ADMINISTRATION ADMINISTRACJA 2028 | 5 |
| Social security and other benefits Narzuty na wynagrodzenia 2028 | 0 |
| Proporcja 2028 | 0 |
| Financial income interest Odsetki od dochodów finansowych Zmiana Financial income interest Pozostałe koszty finansowe 2028 | 0 |
| Taxable income Dochód do opodatkowania 2028 | 0 |
| Gross Receipts Tax 2028 | 0.39 |
| Franchise tax 2028 | 600 |
| Tax rate Realna stopa procentowa (podatek dochodowy, federalny) 2028 | 30 |
| Obrót (dni) 2028 | 0 |
| Government grants Dotacje rządowe === Sheet: Rev. US === USA Y - with EU, N - without EU 2028 | 1 |
| USD Y 2028 | 1 |
| Market Marketplace Market 2028 | 280 |
| Market 2028 | 536 |
| Market USA 2028 | 0 |
| Market Market Avg. Project value CAPEX USD CAPEX PLN 2028 | 1 |
| Market Market Take rate Sales divided in two steps 2028 | 50 |
| Market Market TOTAL 2028 | 0 |
| DT SAAS USA DT SAAS QTY 2028 | 1 |
| DT SAAS Enterpise 2028 | 0 |
| DT SAAS DT SAAS Price USD 2028 | 1 |
| DT SAAS DT SAAS TOTAL USA USD 2028 | 0 |
| DT SAAS DT SAAS TOTAL other countries USD 2028 | 0 |
| DT SAAS DT SAAS DT SAAS TOTAL USD 2028 | 0 |
| IoT USA IoT QTY 2028 | 1 |
| IoT Enterprise 2028 | 0 |
| IoT IoT TOTAL USA USD 2028 | 0 |
| IoT IoT DT SAAS TOTAL USD 2028 | 0 |
| DRD USA DRD QTY 2028 | 1 |
| DRD LeanAutomation report 2028 | 0 |
| DRD DRD Price USD 2028 | 1 |
| DRD DRD DRD DRD DRD TOTAL USA USD 2028 | 0 |
| DRD DRD PRICE USD USD 2028 | 1 |
| DRD DRD DRD DRD DRD TOTAL other countries USD 2028 | 0 |
| DRD DRD DRD TOTAL USD 2028 | 0 |
| Partner Partner Price USD 2028 | 1 |
| Partner Partner TOTAL USA USD 2028 | 0 |
| Partner Partner TOTAL other countries USD 2028 | 0 |
| Partner Partner TOTAL Partnerships USD 2028 | 0 |
| === Sheet: Amort. US === Groups of fixed assets Grupy środków trwałych 2028 | 1 |
| Repayment of credits and loans Opis e. Redemption of debt securities 2028 | 1 |
| Przychody netto ze sprzedaży produktów h. Interest 2028 | 0 |
| Big Data (MaaS) D. Total net Cash Flow 2028 | 0 |
| DRD E. Cash opening balance 2028 | 0 |
| Program Partnerski F. Closing balance of cash 2028 | 0 |
| Lines Przychody netto ze sprzedaży usług 2028 | 0 |
| Consumption of materials and energy Zużycie materiałów i energii razem 2028 | 0 |
| MANAGEMENT MANAGEMENT 2028 | 1.281 |
| Taxable profit Dochód do opodatkowania 2028 | 0 |
| Real interest rate Realna stopa procentowa (podatek dochodowy 2028 | 30 |
| Leasing Zobowiazania z tytułu leasingu 2028 | 0 |
| Government grants Granty 2028 | 0 |
| === Sheet: Rev. JAP === JAPAN Y - with EU, N - without EU 2028 | 1 |
| YEN Y 2028 | 1 |
| brak MP wzrost 2028 | 200 |
| tylko SAAS Market Marketplace go to Market Market Market 2028 | 250 |
| Market JAPAN 2028 | 0 |
| DT SAAS JAPAN DT SAAS QTY 2028 | 1 |
| DT SAAS DT SAAS Price USD Jen 2028 | 1 |
| DT SAAS DT SAAS TOTAL JAPAN YEN 2028 | 0 |
| DT SAAS DT SAAS Price EUR JEN 2028 | 1 |
| DT SAAS DT SAAS TOTAL other countries YEN 2028 | 0 |
| DT SAAS DT SAAS DT SAAS TOTAL YEN 2028 | 0 |
| IoT JAPAN IoT QTY 2028 | 1 |
| IoT IoT TOTAL JAPAN YEN 2028 | 0 |
| IoT IoT DT SAAS TOTAL YEN 2028 | 0 |
| DRD JAPAN DRD QTY 2028 | 1 |
| DRD DRD Price USD JEN 2028 | 1 |
| DRD DRD DRD DRD DRD TOTAL JAPAN YEN 2028 | 0 |
| DRD DRD DRD DRD DRD TOTAL other countries YEN 2028 | 0 |
| DRD DRD DRD TOTAL YEN 2028 | 0 |
| Partner USA Partner QTY 2028 | 1 |
| Partner Partner Price USD JEN 2028 | 1 |
| Partner Partner TOTAL JAPAN YEN 2028 | 0 |
| Partner Other countries Partner QTY 2028 | 1 |
| Partner Partner PRICE EUR EUR 2028 | 1 |
| Partner Partner TOTAL other countries YEN 2028 | 0 |
| Partner Partner TOTAL Partnerships YEN 2028 | 0 |
| === Sheet: Amort. JAP === Groups of fixed assets Grupy środków trwałych 2028 | 1 |
| === Sheet: Statement AS === Bilans Balance Sheet 2028 | 0 |
| === Sheet: Ass. AS === B.TKW B.MAT Cash 2028 | 0 |
| B.TKW Insurances (health) Insurances (health) - 2028 | 500500 |
| D.SPRZED Marketing Start of dedicated marketing for the US market (SEO) 2028 | 3 |
| D.SPRZED Partnership with manufacturing associations Partnership with manufacturing associations in the US - 2028 | 500500 |
| Market Marketplace projekty na zero Market koszty stałe 2028 | 3 |
| Market koszt lokalizacji 2028 | 46 |
| Market Saudi Arabia 2028 | 0 |
| DT SAAS Saudi Arabia DT SAAS QTY 2028 | 1 |
| DT SAAS DT SAAS TOTAL Saudi Arabia USD 2028 | 0 |
| IoT Saudi Arabia IoT QTY 2028 | 1 |
| IoT IoT TOTAL Saudi Arabia USD 2028 | 0 |
| DRD Saudi Arabia DRD QTY 2028 | 1 |
| DRD DRD DRD DRD DRD TOTAL Saudi Arabia USD 2028 | 0 |
| Partner Partner TOTAL Saudi Arabia USD 2028 | 0 |
| === Sheet: Amort. AS === Groups of fixed assets Grupy środków trwałych 2028 | 1 |
