# Audyt „Award Winning / CES 2027” — 05.09.2026

**Cel:** jedna trwała lista rozbieżności i niestabilności na wszystkich ekranach 16 modułów, z rankingiem i planem — podstawa programu po MVP ([[formula-harvey-po-mvp]] w pamięci nadzorcy; §D niżej).

**Metoda:** trzy równoległe przejścia agentów na lokalnej instancji (`localhost:3000` → staging `5097394eb6`, sesja właściciela, jasny motyw 1440 + 1280/1920 dla ekranów flagowych). Każdy ekran i przepływ klikany realnie (Playwright), zapisane: błędy konsoli, odpowiedzi ≥400, żądania >5 s, przesunięcia layoutu, przycięcia, martwe przyciski. Dwie oceny 0–3: **A stabilność**, **B spójność grafiki** (typografia, rytm 8 px, tokeny `c-*`, jeden prawy panel, Menu 1/2/3, puste stany, chipy, ikony, kebab pionowy, polszczyzna). 3 = do pokazania na scenie.

**Wzorce „złota”:** `evidence/odbior-cto-20260905/moja-praca/polish/a-table-no-selection.png`, `evidence/odbior-zywo-20260905/08-wyniki/okr-cel/proof-okr-L2.png`, `evidence/odbior-zywo-20260905/02-moja-praca/mapa-jeden-panel/02-element.png`.

## Części
- `A_moja-praca_czat_wywiad_narzedzia.md`
- `B_ocena_inicjatywy_realizacja_wyniki.md`
- `C_finanse_materialy_audyty_spotkania_org_admin_ustawienia_partner.md`
- `D_SYNTEZA_I_PLAN.md` — ranking wniosków (wpływ × wysiłek), ekrany flagowe per moduł, plan w kolejności; powstaje po A–C.

Dowody: `evidence/audyt-award-20260905/<modul>/`.

## Równolegle
Właściciel przechodzi staging (`5097394eb6`) i zgłasza uwagi na `http://127.0.0.1:3100/final` (pole „Uwaga” przy module) — trafiają do `decyzje_zywo` (klucz `FINAL:<MODUL>`) i `docs/program/grafika/DECYZJE_20260905.json`. Synteza D łączy oba źródła.
