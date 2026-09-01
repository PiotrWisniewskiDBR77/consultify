# Consultinity — dokumentacja funkcjonalna według menu

To jest główny spis dokumentacji funkcjonalnej aplikacji. Jego struktura
odpowiada **dokładnie menu widocznemu dla użytkownika**, a nie technicznym
katalogom, trasom ani dawnym nazwom projektów.

Źródło kolejności runtime:
`src/components/navigation/Sidebar/menuConfig.ts` oraz
`src/components/navigation/Sidebar/SidebarFooter.tsx`.

Mapa rodzajów prawdy i zasad pierwszeństwa:
[`SOURCE_OF_TRUTH.md`](SOURCE_OF_TRUTH.md).

Obowiązujący standard kompletności i szablon modułu:
[`ssot/COMPLETE_DOCUMENTATION_STANDARD.md`](ssot/COMPLETE_DOCUMENTATION_STANDARD.md).

## Jak czytać tę dokumentację

Każda pozycja menu docelowo otrzyma jeden komplet:

1. **Cel i obietnica** — po co użytkownik otwiera ten moduł.
2. **Mapa funkcji** — zakładki, widoki, obiekty i czynności.
3. **Przepływy użytkownika** — wejście, praca, wynik i dalsze przejścia.
4. **Obiekty i dane** — co moduł czyta, tworzy i zmienia.
5. **AI i automatyzacje** — rola Teresy, agentów i operacji w tle.
6. **Role i uprawnienia**.
7. **Integracje z innymi pozycjami menu**.
8. **Stan obecny** — potwierdzony w kodzie/runtime.
9. **Stan docelowy** — zaakceptowany produkt.
10. **Luki i decyzje otwarte**.
11. **Testy i dowody**.
12. **Changelog decyzji**.

## Menu główne

> **★ CZYTAJ RAZEM Z POMIAREM Z 1.09.** Cztery pakiety dokumentacji zaktualizowano tego dnia
> na podstawie ośmiu dyżurów pomiarowych. Kolumna „Stan dokumentacji" mówi o **kompletności
> opisu**, nie o gotowości modułu. Pełne pomiary:
> [`functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md`](functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md) ·
> [`functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md`](functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md) ·
> [`functional/POMIAR_2026-09-01_AUDYTY_CZAT_PRACA_PARTNER.md`](functional/POMIAR_2026-09-01_AUDYTY_CZAT_PRACA_PARTNER.md) ·
> [`functional/12_prezentacje/README.md`](functional/12_prezentacje/README.md)
>
> **Oznaczenie `CLOSED_FINAL` wymaga odtąd zapisania, CO zaakceptowano** — prototyp, zrzut
> realnego ekranu, czy działający przepływ. Powód i trzy zasady:
> [`program/funkcje/CO_ZNACZYLO_ZAMKNIETE_OSTATECZNIE.md`](program/funkcje/CO_ZNACZYLO_ZAMKNIETE_OSTATECZNIE.md).


| # | Pozycja | Status w menu | Kontrakt / punkt wejścia | Stan dokumentacji |
| ---: | --- | --- | --- | --- |
| 1 | Chat | aktywny | [`modules/01_czat/09_AS_IS.md`](modules/01_czat/09_AS_IS.md) | skonsolidowany; Canvas NO_GO · **pomiar 1.09: 8 z 14 typów akcji czatu bez producenta** |
| 2 | My Work | aktywny | [`modules/02_moja-praca/CURRENT_CONTRACT.md`](modules/02_moja-praca/CURRENT_CONTRACT.md) | skonsolidowany · **1.09: kreator formularzy pokazuje „zapisano” i NIC nie zapisuje** — dziewiąty przypadek wzorca, naprawa w toku |
| 3 | Interview | aktywny | [`modules/03_wywiad/CURRENT_CONTRACT.md`](modules/03_wywiad/CURRENT_CONTRACT.md) | skonsolidowany |
| 4 | Tools | aktywny | [`modules/04_narzedzia/CURRENT_CONTRACT.md`](modules/04_narzedzia/CURRENT_CONTRACT.md) | skonsolidowany |
| 5 | Assessment | aktywny | [`functional/05_assessment/README.md`](functional/05_assessment/README.md) | kontrakt konsolidujący utworzony |
| 6 | Initiatives | aktywny | [`modules/05_inicjatywy/CURRENT_CONTRACT.md`](modules/05_inicjatywy/CURRENT_CONTRACT.md) | skonsolidowany |
| 7 | Execution | aktywny | [`modules/06_realizacja/CURRENT_CONTRACT.md`](modules/06_realizacja/CURRENT_CONTRACT.md) | skonsolidowany |
| 8 | Results | beta | [`modules/07_rezultaty/CURRENT_CONTRACT.md`](modules/07_rezultaty/CURRENT_CONTRACT.md) | skonsolidowany · **KOREKTA 1.09: OKR i ROI SĄ widoczne na demo** (zmienna środowiskowa omija flagi); mianownik `135` **wycofany** |
| 9 | Finance | **pełny zakres MVP** (DEC-2026-08-28-177 odwrócił wcześniejsze zamknięcie w becie) | [`modules/08_finanse/CURRENT_CONTRACT.md`](modules/08_finanse/CURRENT_CONTRACT.md) | skonsolidowany |
| 10 | Materials | beta | [`functional/10_materials/README.md`](functional/10_materials/README.md) | **★ 1.09: BRAK KLUCZA DO MODELU unieważnia dotychczasowe oceny generatorów** — oceniano zastępniki, nie generatory. Arkusz **działa**; dokument i prezentacja do ponownego pomiaru |
| 11 | Audits | fragment runtime oznaczony beta; produkt poza MVP | [`functional/11_audits/README.md`](functional/11_audits/README.md) | kierunek zaakceptowany; pełna implementacja w drugiej fali |
| 12 | Meeting | realny fundament · **1.09: 2 z 3 bramek otwarte — menu odmawia, adres wpuszcza** | [`modules/13_meeting/CURRENT_CONTRACT.md`](modules/13_meeting/CURRENT_CONTRACT.md) | Teresa jako aktywny facilitator i orkiestrator całej aplikacji; podstawowy golden flow przed roadmapą live |

### Prezentacje — podobszar Materiałów, własny kontrakt od 1.09

| Pozycja nadrzędna | Kontrakt | Stan |
| --- | --- | --- |
| 10 Materials | [`functional/12_prezentacje/README.md`](functional/12_prezentacje/README.md) · [`AS_IS_2026-09-01.md`](functional/12_prezentacje/AS_IS_2026-09-01.md) | opisane wg **trzech filarów właściciela**; **sufit biblioteki: 0 gradientów, 0 osadzania czcionek** (zmierzone dwukrotnie) |

## Menu dolne

| # | Pozycja | Widoczność | Kontrakt / punkt wejścia |
| ---: | --- | --- | --- |
| 13 | Organization | zależna od dostępu · **CLOSED_FINAL 2026-08-25 ZAKWESTIONOWANE 1.09** — zamknięto na akcepcie PROTOTYPU; 11 ekranów nieosiągalnych, właściciel nie obejrzał | [`modules/16_organizacja/CURRENT_CONTRACT.md`](modules/16_organizacja/CURRENT_CONTRACT.md) |
| 14 | Admin Panel | administrator | [`modules/17_panel-administratora/CURRENT_CONTRACT.md`](modules/17_panel-administratora/CURRENT_CONTRACT.md) |
| 15 | Settings | aktywny · **CLOSED_FINAL 2026-08-25 ZAKWESTIONOWANE 1.09** — przegląd wizualny NIGDY nie rozpoczęty; 33 z 37 sekcji niedostępnych dla zwykłego użytkownika, przekierowanie **bez śladu w dzienniku** | [`modules/18_ustawienia/CURRENT_CONTRACT.md`](modules/18_ustawienia/CURRENT_CONTRACT.md) |
| 16 | Partner Portal | zależna od dostępu | [`modules/19_portal-partnerski/CURRENT_CONTRACT.md`](modules/19_portal-partnerski/CURRENT_CONTRACT.md) |

## ★ Gdzie żyje aktualny stan decyzji — czytaj to razem ze spisem

Wszystkie kontrakty modułów pochodzą z jednego commita z **2026-07-31**, a ich
warstwa źródłowa z maja 2026. Decyzje właściciela podjęte po tej dacie **nie
zostały do nich przeniesione** i żyją w rejestrze:
[`program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`](program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md).

**Kolejność czytania przy rozbieżności:** rejestr decyzji → kontrakt modułu →
warstwa źródłowa `00_META`…`07_ACCEPTANCE`. Nowsza decyzja właściciela wygrywa
ze starszym kontraktem.

**★ Pułapka, którą trzeba znać przed użyciem słowa „domknięty".**
`DEC-2026-08-25-74` ustalił wzorzec `RUNTIME-IDENTITY-MISMATCH`: wpis
`CLOSED_FINAL` potrafi opisywać stan **za flagą wyłączoną**, którego użytkownik
nigdy nie widzi. Dotyczy to m.in. Organizacji, gdzie odebrany komplet 11 ekranów
leży za flagą, a domyślny runtime pokazuje stary układ. **„Zrobione za flagą" nie
znaczy „widoczne dla użytkownika".**

## 2. My Work — zakres zagnieżdżony

Client Vault i Run Agent nie są osobnymi modułami głównego menu. Kod przeniósł
je do zakładek My Work, zachowując trasy zgodności wstecznej. Dokumentujemy je
zatem wewnątrz My Work.

## 10. Materials — pakiet zbiorczy

Materials jest jedną pozycją menu i jedną biblioteką wszystkich materiałów.
Nie należy tworzyć osobnych rozdziałów najwyższego poziomu sidebara dla
Document Studio, Presentation Studio, Table Studio ani Excel.

Materiały obejmują:

| Podobszar | Obecny kontrakt |
| --- | --- |
| Biblioteka wyników i raportów | [`modules/09_outputs/SSOT.md`](modules/09_outputs/SSOT.md) |
| Dokumenty / Word | [`modules/10_dokumenty/SSOT.md`](modules/10_dokumenty/SSOT.md) |
| Tabele / Excel | [`modules/11_tabele/SSOT.md`](modules/11_tabele/SSOT.md) |
| Prezentacje | [`modules/12_prezentacje/SSOT.md`](modules/12_prezentacje/SSOT.md) |
| Specyfikacja zbiorcza | [`product/MATERIALS_MODULE_MASTER_SPEC.md`](product/MATERIALS_MODULE_MASTER_SPEC.md) |
| Aktualny kanon kierunku | [`product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md`](product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md) |

Docelowo powstanie jeden nadrzędny kontrakt Materials, a cztery powyższe
kontrakty staną się jego rozdziałami/podsystemami.

## Elementy, które nie są pozycjami głównego menu

Poniższe obszary pozostają ważne, lecz są dokumentowane jako funkcje
zagnieżdżone, infrastruktura albo historia:

- Outputs — część Materials,
- Documents — część Materials,
- Tables/Excel — część Materials,
- Presentations — część Materials,
- Client Vault — część My Work,
- Run Agent — część My Work,
- MCP IRIS i MCP Marketplace — trasy wycofane/przekierowane; nie są menu,
- Conclusions — ukryte decyzją właściciela,
- SuperAdmin — osobna, uprawniona płaszczyzna sterowania, nie standardowa
  pozycja pokazanego menu.

## Reguła budowania dalszej dokumentacji

Każda kolejna inwentaryzacja, opis AS-IS, wizja TO-BE i roadmapa powstaje
w kolejności 1–16 z tego dokumentu. Dokument techniczny może mieć inną
strukturę, ale musi wskazać, której pozycji menu służy.
