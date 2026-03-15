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
- Extracted lines: 53
- Mapped lines: 20
- Coverage: 38%
- Readiness: `recoverable` (45)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Bieżące obciążenie z tytułu podatku dochodowego 2024 | fsl-pl-interest-lease | 3608 |
| Odroczony podatek dochodowy 2024 | fsl-pl-tax-deferred | -126 |
| Zysk przed opodatkowaniem 2024 | fsl-pl-ebt | 66563 |
| Podatek dochodowy obliczony według obowiązującej stawki 2024 | fsl-pl-tax | 12647 |
| Aktywo na podatek z tytułu działalności w SSE 2024 | fsl-pl-ebit | -5500 |
| odpis aktualizujący 2024 | fsl-pl-impairment-receivables | -1439 |
| Koszt własny sprzedaży razem 2024 | fsl-pl-cogs | 394861 |
| Koszty sprzedaży 2024 | fsl-pl-selling | 19843 |
| Koszty ogólnego zarządu 2024 | fsl-pl-gna | 64008 |
| Koszty w układzie funkcjonalnym razem 2024 | fsl-pl-cbn-total-by-nature | 478712 |
| Amortyzacja 2024 | fsl-pl-depreciation | 23579 |
| Zużycie materiałów i energii 2024 | fsl-pl-cogs-materials | 242415 |
| Usługi obce 2024 | fsl-pl-gna-external | 68457 |
| Pozostałe koszty 2024 | fsl-pl-other-expense | 14831 |
| Koszty wytworzenia produktów na własne potrzeby jednostki 2024 | fsl-pl-cbn-own-work-capitalised | -5896 |
| Zmiana stanu wyrobów gotowych i produkcji niezakończonej 2024 | fsl-pl-cbn-inventory-change | 14153 |
| kraj 2024 | fsl-pl-revenue-product-domestic | 84809 |
| eksport 2024 | fsl-pl-revenue-product-export | 38626 |
| Razem przychody 2024 | fsl-pl-revenue | 536578 |
| Przychody operacyjne 2024 | fsl-pl-other-income | 1533 |

| Unmapped labels | Value |
| --- | ---: |
| Związany z powstaniem i odwróceniem się różnic przejściowych 2024 | -5933 |
| Ulga podatkowa z tytułu działalności w specjalnej strefie ekonomicznej 2024 | 5807 |
| Obciążenie podatkowe wykazane w sprawozdaniu z całkowitych dochodów 2024 | 3482 |
| Aktywa finansowe 2024 | 268268 |
| Instrumenty pochodne 7 2024 | 64 |
| Pozostałe 2024 | 503714 |
| Nettowanie aktywa i rezerwy 2024 | -2433 |
| W dniu 28 grudnia 2024 | 69 |
| Zastosowana stawka podatkowa 2024 | 19 |
| Korekty 2024 | -9165 |
| Podatek od innych przychodów zwolnionych z opodatkowania** 2024 | -2685 |
| Inne odliczenia podatkowe 2024 | -5 |
| Podatek dochodowy wykazany w sprawozdaniu z całkowitych dochodów 2024 | 3482 |
| Efektywna stopa podatkowa 2024 | 5.23 |
| Koszt sprzedanych produktów i usług, w tym: 2024 | 380829 |
| koszt wytworzenia 2024 | 375970 |
| złomowanie 2024 | 2905 |
| naprawy gwarancyjne 2024 | 2098 |
| Koszt sprzedanych towarów i materiałów, w tym: 2024 | 14032 |
| cena zakupu 2024 | 11078 |
| Świadczenia pracownicze 2024 | 107141 |
| Koszt sprzedanych towarów i materiałów 2024 | 14032 |
| Koszty w układzie rodzajowym razem 2024 | 478712 |
| Przychody ze sprzedaży ogółem zgodne z rachunkiem z całkowitych dochodów, w tym: 2024 | 536578 |
| przychód rozpoznany w punkcie czasu 2024 | 519998 |
| przychód rozpoznawany w czasie 2024 | 16580 |
| Aparatura łączeniowa, w tym: 2024 | 123435 |
| Aparatura pomiarowa, w tym: 2024 | 357598 |
| Automatyka, w tym: 2024 | 55546 |
| wynosi 2024 | 3.2 |
| Umowy zawarte w bieżącym roku 2024 | 1398 |
| Zobowiązania kontraktowe - stan na koniec okresu 2024 | 3222 |
| Odszkodowania otrzymane z tytułu rzeczowych aktywów trwałych 2024 | 143 |

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
- Extracted lines: 40
- Mapped lines: 40
- Coverage: 100%
- Readiness: `ready` (100)
- Reason codes: none
- Validation blockers: none

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
| Kapitał z wyceny transakcji zabezpieczających oraz różnice kursowe z konsolidacji 2023 | fsl-bs-fx-reserve | 8845 |
| Niepodzielony wynik finansowy 2023 | fsl-bs-retained-earnings | -72699 |
| Udziały niesprawujące kontroli 2023 | fsl-bs-minority-interest | 2058 |
| Zobowiązania 2023 | fsl-bs-total-liabilities | 436175 |
| Zobowiązania i rezerwy długoterminowe 2023 | fsl-bs-long-term-debt | 80106 |
| Długoterminowe kredyty i pożyczki 2023 | fsl-bs-long-term-borrowings | 29545 |
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
- Extracted lines: 49
- Mapped lines: 19
- Coverage: 39%
- Readiness: `recoverable` (28)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Bieżące obciążenie z tytułu podatku dochodowego 2023 | fsl-pl-interest-lease | 9341 |
| Odroczony podatek dochodowy 2023 | fsl-pl-tax-deferred | 11714 |
| Zobowiązania z tytułu świadczeń pracowniczych 2023 | fsl-pl-oci-actuarial | 5029 |
| Podatek dochodowy 2023 | fsl-pl-tax | 19040 |
| Amortyzacja 2023 | fsl-pl-depreciation | 56414 |
| Zużycie materiałów i energii 2023 | fsl-pl-cogs-materials | 534846 |
| Usługi obce 2023 | fsl-pl-gna-external | 126093 |
| Pozostałe koszty 2023 | fsl-pl-other-expense | 38545 |
| Koszty wytworzenia produktów na własne potrzeby jednostki 2023 | fsl-pl-cbn-own-work-capitalised | -3883 |
| Zmiana stanu wyrobów gotowych, produkcji niezakończonej oraz rozliczeń międzyokresowych 2023 | fsl-pl-cbn-inventory-change | 11940 |
| Koszt sprzedanych towarów i materiałów 2023 | fsl-pl-cogs | 62587 |
| Razem koszty 2023 | fsl-pl-cbn-total-by-nature | 1079904 |
| Przychody operacyjne 2023 | fsl-pl-other-income | 3020 |
| Koszty operacyjne 2023 | fsl-pl-opex | -20158 |
| Utworzenie rezerwy na zobowiązania 2023 | fsl-pl-other-opex-provisions | -328 |
| Przychody finansowe 2023 | fsl-pl-fin-income | 8079 |
| Koszty finansowe 2023 | fsl-pl-fin-expense | -20667 |
| Odsetki od kredytów i pożyczek 2023 | fsl-pl-interest-bank | -13690 |
| Ujemne różnice kursowe 2023 | fsl-pl-oci-fx | -1486 |

| Unmapped labels | Value |
| --- | ---: |
| Obciążenie podatkowe wykazane w skróconym skonsolidowaniu sprawozdaniu z całkowitych dochodów 2023 | 19040 |
| Instrumenty pochodne 2023 | 324305 |
| Rezerwy 2023 | 4015 |
| Strata podatkowa 2023 | 869 |
| Ulga podatkowa do rozliczenia w przyszłych okresach 2023 | 5807 |
| Pozostałe 2023 | 2643 |
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
| Efektywna stopa podatkowa 2023 | 69.13 |
| Świadczenia pracownicze 2023 | 253362 |
| Wynik na sprzedaży rzeczowych aktywów trwałych 2023 | 768 |
| Koszt zlikwidowanych rzeczowych aktywów trwałych 2023 | -107 |
| Utworzenie odpisów aktualizujących wartości niematerialne 2023 | -9176 |
| Zaniechane inwestycje 2023 | -1849 |
| Przekazane darowizny 2023 | -65 |
| Koszty operacyjne netto 2023 | -17138 |
| Przychody z tytułu transakcji walutowych (w tym instrumentów pochodnych) 2023 | 6894 |
| Odsetki płatne do budżetu 2023 | -44 |
| Odsetki od zobowiązań leasingowych 2023 | -2558 |
| Pozostałe odsetki 2023 | -1380 |
| Koszty finansowe netto 2023 | -12588 |

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
- Extracted lines: 65
- Mapped lines: 27
- Coverage: 42%
- Readiness: `recoverable` (42)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Bieżące obciążenie z tytułu podatku dochodowego 2024 | fsl-pl-interest-lease | 12719 |
| Odroczony podatek dochodowy 2024 | fsl-pl-tax-deferred | -4115 |
| Wykorzystanie ulgi podatkowej z tytułu działalności w SSE 2024 | fsl-pl-ebit | 5807 |
| Zobowiązania z tytułu świadczeń pracowniczych 2024 | fsl-pl-oci-actuarial | 5386 |
| Zysk przed opodatkowaniem 2024 | fsl-pl-ebt | 81818 |
| Podatek dochodowy 2024 | fsl-pl-tax | 8604 |
| odpis aktualizujący 2024 | fsl-pl-impairment-receivables | -1064 |
| rezerwa na świadczenia pracownicze 2024 | fsl-pl-cbn-social-security | -8 |
| Koszt własny sprzedaży razem 2024 | fsl-pl-cogs | 913065 |
| Koszty sprzedaży 2024 | fsl-pl-selling | 48381 |
| Koszty ogólnego zarządu 2024 | fsl-pl-gna | 162894 |
| Koszty w układzie funkcjonalnym razem 2024 | fsl-pl-cbn-total-by-nature | 1124340 |
| Amortyzacja 2024 | fsl-pl-depreciation | 57312 |
| Zużycie materiałów i energii 2024 | fsl-pl-cogs-materials | 558392 |
| Usługi obce 2024 | fsl-pl-gna-external | 144826 |
| Pozostałe koszty 2024 | fsl-pl-other-expense | 32417 |
| Koszty wytworzenia produktów na własne potrzeby jednostki 2024 | fsl-pl-cbn-own-work-capitalised | -5923 |
| Zmiana stanu wyrobów gotowych i produkcji niezakończonej 2024 | fsl-pl-cbn-inventory-change | -335 |
| Przychody operacyjne 2024 | fsl-pl-other-income | 2365 |
| Koszty operacyjne 2024 | fsl-pl-opex | -20410 |
| Utworzenie rezerwy na zobowiązania 2024 | fsl-pl-other-opex-provisions | -14329 |
| Wynik na pozostałej działalności operacyjnej 2024 | fsl-pl-other-op-result | -18045 |
| Przychody finansowe 2024 | fsl-pl-fin-income | 7001 |
| Koszty finansowe 2024 | fsl-pl-fin-expense | -14600 |
| Odsetki od zobowiązań 2024 | fsl-pl-interest-bank | -26 |
| Ujemne różnice kursowe 2024 | fsl-pl-oci-fx | -3234 |
| Wynik na działalności finansowej 2024 | fsl-pl-interest | -7599 |

| Unmapped labels | Value |
| --- | ---: |
| Związany z powstaniem i odwróceniem się różnic przejściowych 2024 | -9922 |
| Obciążenie podatkowe wykazane w skróconym skonsolidowaniu sprawozdaniu z całkowitych dochodów 2024 | 8604 |
| Odroczony podatek dochodowy od przeszacowania rezerwy aktuarialnej 2024 | -61 |
| Instrumenty pochodne 2024 | 191324 |
| Rezerwy 2024 | 7808 |
| Ulga podatkowa do rozliczenia w przyszłych okresach 2024 | 5500 |
| Pozostałe 2024 | 2649 |
| Nettowanie aktywa i rezerwy 2024 | -7701 |
| W dniu 28 grudnia 2024 | 69 |
| Podatek dochodowy obliczony według obowiązujących stawek 2024 | 14956 |
| Podatek od przychodów zwolnionych z opodatkowania (różnice trwałe), w tym: 2024 | -1425 |
| Podatek od kosztów niestanowiących kosztów uzyskania przychodów (różnice trwałe) 2024 | 2544 |
| Podatek od transakcji wewnątrzgrupowych (różnice trwałe) 2024 | -298 |
| Aktywo na podatek z tytułu działalności w SSE 2024 | -5500 |
| Korekta strat podatkowych z lat ubiegłych 2024 | -261 |
| Inne odliczenia podatkowe 2024 | -815 |
| Efektywna stopa podatkowa 2024 | 10.52 |
| Koszt sprzedanych produktów i usług, w tym: 2024 | 854221 |
| koszt wytworzenia 2024 | 845476 |
| złomowanie 2024 | 6318 |
| różnice inwentaryzacyjne 2024 | 738 |
| naprawy gwarancyjne 2024 | 2761 |
| Koszt sprzedanych towarów i materiałów, w tym: 2024 | 58844 |
| cena zakupu 2024 | 53436 |
| Świadczenia pracownicze 2024 | 278807 |
| Koszt sprzedanych towarów i materiałów 2024 | 58844 |
| Koszty w układzie rodzajowym razem 2024 | 1124340 |
| Utworzenie odpisów aktualizujących rzeczowe aktywa trwałe 2024 | -453 |
| Utworzenie odpisów aktualizujących wartości niematerialne 2024 | -3091 |
| Zaniechane inwestycje 2024 | -270 |
| Przekazane darowizny 2024 | -14 |
| Koszty sądowe, komornicze, zastępstwo procesowe 2024 | -24 |
| Składki nieobowiązkowe 2024 | -15 |
| Przychody z tytułu transakcji walutowych (w tym instrumentów pochodnych) 2024 | 5694 |
| Odsetki i prowizje od kredytów i pożyczek 2024 | -7172 |
| Odsetki płatne do budżetu 2024 | -284 |
| Odsetki od zobowiązań leasingowych 2024 | -2434 |
| Pozostałe odsetki 2024 | -737 |

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
- Extracted lines: 30
- Mapped lines: 30
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
| AKTYWA RAZEM 2022 | fsl-bs-total-assets | 1042047 |
| Kapitał własny 2022 | fsl-bs-equity | 539148 |
| Kapitał własny przypadający akcjonariuszom jednostki dominującej 2022 | fsl-bs-equity-parent | 537347 |
| Akcje własne 2022 | fsl-bs-treasury-shares | -3522 |
| Pozostałe kapitały 2022 | fsl-bs-other-equity-reserves | 562967 |
| Niepodzielony wynik finansowy 2022 | fsl-bs-retained-earnings | -29215 |
| Zobowiązania 2022 | fsl-bs-total-liabilities | 502899 |
| Zobowiązania i rezerwy długoterminowe 2022 | fsl-bs-long-term-debt | 45174 |
| Zobowiązania i rezerwy krótkoterminowe 2022 | fsl-bs-current-liabilities | 457725 |
| Krótkoterminowe kredyty i pożyczki 2022 | fsl-bs-short-term-debt | 237350 |
| Zobowiązania handlowe 2022 | fsl-bs-ap | 121894 |
| PASYWA RAZEM 2022 | fsl-bs-total-liabilities-equity | 1042047 |

| Unmapped labels | Value |
| --- | ---: |
| none | — |

### P&L

- Selected period: `2022`
- Comparison period: `2021`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 38
- Mapped lines: 17
- Coverage: 45%
- Readiness: `recoverable` (32)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Bieżące obciążenie z tytułu podatku dochodowego 2022 | fsl-pl-interest-lease | 9019 |
| Odroczony podatek dochodowy 2022 | fsl-pl-tax-deferred | -309 |
| Zobowiązania z tytułu świadczeń pracowniczych 2022 | fsl-pl-oci-actuarial | 4184 |
| Pozostałe 2022 | fsl-pl-other-expense | 2536 |
| Nieutworzone aktywo od strat na działalności strefowej 2022 | fsl-pl-interest | 771 |
| Podatek dochodowy 2022 | fsl-pl-tax | 8710 |
| Koszt własny sprzedaży w 2022 | fsl-pl-cogs | 857.531 |
| Przychody operacyjne 2022 | fsl-pl-other-income | 4924 |
| Wynik na sprzedaży rzeczowych aktywów trwałych 2022 | fsl-pl-depreciation | 2893 |
| Koszty operacyjne 2022 | fsl-pl-opex | -19118 |
| Przychody finansowe 2022 | fsl-pl-fin-income | 5268 |
| Koszty finansowe 2022 | fsl-pl-fin-expense | -20693 |
| Odsetki od kredytów i pożyczek 2022 | fsl-pl-interest-bank | -13510 |
| Ujemne różnice kursowe 2022 | fsl-pl-oci-fx | -1700 |
| Utworzenie odpisów aktualizujących należności 2022 | fsl-pl-impairment-receivables | -1002 |
| Gwarancje i prowizje bankowe (poza prowizjami od kredytów) 2022 | fsl-pl-selling-commissions | -697 |
| Przychody (koszty) finansowe netto 2022 | fsl-pl-other-fin | -15425 |

| Unmapped labels | Value |
| --- | ---: |
| Związany z powstaniem i odwróceniem się różnic przejściowych 2022 | -309 |
| Obciążenie podatkowe wykazane w skróconym skonsolidowaniu sprawozdaniu z całkowitych dochodów 2022 | 8710 |
| Instrumenty pochodne 2022 | 305 |
| Rezerwy 2022 | 3880 |
| Strata podatkowa 2022 | 10707 |
| Ulga podatkowa do rozliczenia w przyszłych okresach 2022 | 10517 |
| Nettowanie aktywa i rezerwy 2022 | -8358 |
| W dniu 28 grudnia 2022 | 69 |
| grudnia 2022 | 15.8 |
| Podstawa opodatkowania 2022 | 15915 |
| Zastosowana stawka podatkowa 2022 | 19 |
| Podatek dochodowy obliczony według obowiązującej stawki 2022 | 2697 |
| Podatek od pozycji nieujętych w wyniku finansowym okresu 2022 | -63 |
| Efektywna stopa podatkowa 2022 | 54.73 |
| Otrzymane odszkodowania i kary umowne 2022 | 917 |
| Dotacje - Covid 2022 | -19 |
| Zaniechane inwestycje 2022 | -1280 |
| Przekazane darowizny 2022 | -66 |
| Przychody (koszty) operacyjne netto 2022 | -14194 |
| Odsetki płatne do budżetu 2022 | -26 |
| Odsetki od zobowiązań 2022 | -157 |

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
| kapitale obrotowym 2022 | fsl-cf-change-wc | 98246 |
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
