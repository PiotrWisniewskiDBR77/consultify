# Wdrożenie do 100% — zestaw dokumentacji

Plan i dokumentacja dokończenia wszystkich modułów Consultify do stanu docelowego (100%), po testach żywych właściciela 2026-06-13. Następca audytu Harvard (`Harvard/modules/*/KARTA_AUDYTU.md`) — podnosi z „Alpha/Beta-near" do „front↔back spięte, zero fasad, i18n/tokeny/§27, E2E w PR-gate".

## Od czego zacząć
1. **[`_DECYZJE.md`](_DECYZJE.md)** — 12 decyzji właściciela (z rekomendacjami) do rozstrzygnięcia **najpierw**; odblokowują egzekucję.
2. **[`MASTER.md`](MASTER.md)** — sekwencja faz (kręgosłup→klienci→reszta), żywe blokery (po weryfikacji R3), kręgosłup, zależności, bramki.
3. **[`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md)** — kanon 8 warstw + reguły R1–R6 + procedura reuse-first (jak powstała każda teczka).
4. **Teczki modułów** `MXX-*.md` — wzorzec referencyjny: **[`M13-inicjatywy.md`](M13-inicjatywy.md)**.

## Struktura teczki (8 warstw)
`00 nagłówek · MAPA POKRYCIA · A intencja · B UX docelowe · C dane+API+reguły · D AI/Teresa · E integracje · F epiki→stories · G DoD/jakość · H governance (rejestr wejść/luk/decyzji, flagi, ryzyka, log)`. Każda linkuje istniejące (karta audytu + `docs/product/*` + formuły), nie duplikuje.

## Stan (2026-06-13)
- **Dokumentacja:** 27 teczek + MASTER + wzorzec + `_DECYZJE` — komplet, bramki 9/9 (Ideas 8/9, brak sesji żywej). Decyzje DP-1..12 rozstrzygnięte i rozprowadzone.
- **Faza 1 — żywe blokery PO weryfikacji R3 i naprawach:** otwarte realnie = **2** (M07 V8-mirror, M09 multiplayer) + **M10 głos** (PROD/VTS, czeka na zgodę na env prod). **M18 data-loss** ✅ naprawione w kodzie (mig.780/781). **M20 IDOR** ✅ naprawione (`e9c6cb9c0a`). M22/M23/M19/M21 = STALE/naprawione (dowód w teczkach).
- **Kod na Londyn:** Tryb B canvas (`8a0e64b866`), detekcja PL (`53e3f86e09`), „Otwórz" inicjatywy (`18ed3e44f7`), M18 persystencja 6 warstw (`953955bc2b`+`8d2b5d8cf4`).

## Następny krok
Egzekucja Fazy 1: M07 (cut, DP-7) / M09 (multiplayer, DP-3) na Londyn; M10 głos po zgodzie na prod.

## Zasady (przeniesione do pamięci projektu)
- Praca na `Londyn`; **prod (centerbeam) tylko za osobną zgodą**.
- Każda zmiana UI → weryfikacja w preview + dowód; nigdy „done" na tsc/eslint.
- Karty zawyżają (~1/7) → status „naprawione/bloker" ważny tylko po weryfikacji w kodzie (R3).
- M11 Narzędzia — descoped (brak realnego kodu).
