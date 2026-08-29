# Plany domknięcia Consultify — stan 2026-08-29

Dwa plany, rozdzielone wg tego, KTO wykonuje.

## PLAN A — dyżury Codexa
`PLAN_A_DYZURY_CODEX.html`

Sześć faz + pięć kamieni milowych łańcucha dostarczenia. Wykonawca: Codex,
duże klocki wydawane instrukcją z generatora. Nadzorca pisze, odbiera
adwersaryjnie, scala. To jest kontynuacja dotychczasowego trybu pracy.

Wydane i biegnące w chwili zapisu: dyżur 130 (utrata danych, 35 miejsc),
dyżur 131 (Teresa i wiedza organizacji + dwie granice bezpieczeństwa).
W kolejce: odblokowanie bramek kart, silnik agenta, odetkanie treści dokumentów.

## PLAN B — pełne uruchomienie UI/UX
`PLAN_B_UIUX.html`

Cztery fale + sześć decyzji właściciela + przypisanie powierzchni do kamieni.
Wykonawca: nadzorca sam (grafika nie idzie do Codexa).

## Wzorce wizualne — zaakceptowany język
- `WZORZEC_KSZTALTY_KART.html` — 104 karty w 7 artefaktach sprowadzone do 5 kształtów
- `WZORZEC_PRAWA_LICZBY.html` — reguły dla ekranów KPI, ROI i wyceny
- `WZORZEC_EKRAN_INICJATYWA.html` — ekran zbudowany w języku wzoru właściciela

## ★ CO MUSI ZROBIĆ NASTĘPCA, ZANIM ZACZNIE BUDOWAĆ

1. **Panel trzech niezależnych sceptyków** z różnych dyscyplin nad oboma planami.
   Zlecone przez właściciela 2026-08-29, NIEWYKONANE — zabrakło okna kontekstu.
   Dopiero po ich werdykcie i zatwierdzeniu finalnej wersji zaczyna się budowa.
2. **Sześć decyzji właściciela** z Planu B. Bez nich projektujemy rzeczy,
   które być może wyrzucimy.
3. **Dwa zapytania do żywej bazy demo** (baza demo=staging, wymienna):
   ile inicjatyw leży w magazynie kanonicznym `ie_aggregate_state`;
   ile fragmentów wiedzy nie ma znacznika organizacji.
   Rozstrzygają, czy część faz to naprawa czy budowa od zera.
4. **Stan flagi `ENABLE_DELIVERABLES_PREMIUM` na demo** — dwa dokumenty w repo
   twierdzą co innego. Od tego zależy, czy dokumenty są puste z powodu flagi.

## Zasada bezpieczeństwa dla grafiki (wprost od właściciela)
Nie kasujemy niczego, co może mieć wartość. ~473 martwe powierzchnie to nie
jest lista do usunięcia w ciemno — to lista do PRZEJRZENIA. Część z nich
(np. jedyne w produkcie narzędzie przedziałowe dla NPV) niesie funkcję,
która ma wrócić.
