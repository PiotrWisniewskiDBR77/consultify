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

| # | Pozycja | Status w menu | Kontrakt / punkt wejścia | Stan dokumentacji |
| ---: | --- | --- | --- | --- |
| 1 | Chat | aktywny | [`modules/01_czat/09_AS_IS.md`](modules/01_czat/09_AS_IS.md) | skonsolidowany; Canvas NO_GO |
| 2 | My Work | aktywny | [`modules/02_moja-praca/CURRENT_CONTRACT.md`](modules/02_moja-praca/CURRENT_CONTRACT.md) | skonsolidowany |
| 3 | Interview | aktywny | [`modules/03_wywiad/CURRENT_CONTRACT.md`](modules/03_wywiad/CURRENT_CONTRACT.md) | skonsolidowany |
| 4 | Tools | aktywny | [`modules/04_narzedzia/CURRENT_CONTRACT.md`](modules/04_narzedzia/CURRENT_CONTRACT.md) | skonsolidowany |
| 5 | Assessment | aktywny | [`functional/05_assessment/README.md`](functional/05_assessment/README.md) | kontrakt konsolidujący utworzony |
| 6 | Initiatives | aktywny | [`modules/05_inicjatywy/CURRENT_CONTRACT.md`](modules/05_inicjatywy/CURRENT_CONTRACT.md) | skonsolidowany |
| 7 | Execution | aktywny | [`modules/06_realizacja/CURRENT_CONTRACT.md`](modules/06_realizacja/CURRENT_CONTRACT.md) | skonsolidowany |
| 8 | Results | beta | [`modules/07_rezultaty/CURRENT_CONTRACT.md`](modules/07_rezultaty/CURRENT_CONTRACT.md) | skonsolidowany |
| 9 | Finance | beta | [`modules/08_finanse/CURRENT_CONTRACT.md`](modules/08_finanse/CURRENT_CONTRACT.md) | skonsolidowany |
| 10 | Materials | beta | [`functional/10_materials/README.md`](functional/10_materials/README.md) | kontrakt konsolidujący utworzony |
| 11 | Audits | fragment runtime oznaczony beta; produkt poza MVP | [`functional/11_audits/README.md`](functional/11_audits/README.md) | kierunek zaakceptowany; pełna implementacja w drugiej fali |
| 12 | Meeting | realny fundament + zaakceptowana wizja docelowa | [`modules/13_meeting/CURRENT_CONTRACT.md`](modules/13_meeting/CURRENT_CONTRACT.md) | Teresa jako aktywny facilitator i orkiestrator całej aplikacji; podstawowy golden flow przed roadmapą live |

## Menu dolne

| # | Pozycja | Widoczność | Kontrakt / punkt wejścia |
| ---: | --- | --- | --- |
| 13 | Organization | zależna od dostępu | [`modules/16_organizacja/CURRENT_CONTRACT.md`](modules/16_organizacja/CURRENT_CONTRACT.md) |
| 14 | Admin Panel | administrator | [`modules/17_panel-administratora/CURRENT_CONTRACT.md`](modules/17_panel-administratora/CURRENT_CONTRACT.md) |
| 15 | Settings | aktywny | [`modules/18_ustawienia/CURRENT_CONTRACT.md`](modules/18_ustawienia/CURRENT_CONTRACT.md) |
| 16 | Partner Portal | zależna od dostępu | [`modules/19_portal-partnerski/CURRENT_CONTRACT.md`](modules/19_portal-partnerski/CURRENT_CONTRACT.md) |

## 2. My Work — zakres zagnieżdżony

Client Vault i Run Agent nie są osobnymi modułami głównego menu. Kod przeniósł
je do zakładek My Work, zachowując trasy zgodności wstecznej. Dokumentujemy je
zatem wewnątrz My Work.

Docelowym kontraktem rozwoju Run Agent w lekkie `Zlecenia`/Case Workspace jest
[`product/case-workspace/12_CASE_WORKSPACE_MODULE_SSOT.md`](product/case-workspace/12_CASE_WORKSPACE_MODULE_SSOT.md).
Jest to podsystem My Work, nie nowa pozycja głównego menu. Zamrożone decyzje
właściciela znajdują się w `product/case-workspace/11_OWNER_DECISION_REGISTER.md`,
a plan wykonawczy nie zastępuje kontraktów V8 ani modułów będących właścicielami
artefaktów.

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
- Case Workspace / Zlecenia — docelowy podsystem My Work i następca powierzchni Run Agent,
- MCP IRIS i MCP Marketplace — trasy wycofane/przekierowane; nie są menu,
- Conclusions — ukryte decyzją właściciela,
- SuperAdmin — osobna, uprawniona płaszczyzna sterowania, nie standardowa
  pozycja pokazanego menu.

## Reguła budowania dalszej dokumentacji

Każda kolejna inwentaryzacja, opis AS-IS, wizja TO-BE i roadmapa powstaje
w kolejności 1–16 z tego dokumentu. Dokument techniczny może mieć inną
strukturę, ale musi wskazać, której pozycji menu służy.
