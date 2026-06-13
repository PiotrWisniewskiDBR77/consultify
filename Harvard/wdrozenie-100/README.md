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
- **Dokumentacja:** 27 teczek + MASTER + wzorzec + decyzje — komplet, bramki 9/9 (Ideas 8/9, brak sesji żywej).
- **Faza 1 po R3:** realnie żywe blokery = **3** (M07 V8-mirror, M09 multiplayer, M10 głos PROD/VTS) — nie 9; reszta naprawiona/STALE (dowód w teczkach).
- **Kod (uboczny, na Londyn):** Tryb B canvas (`8a0e64b866`), detekcja PL (`53e3f86e09`), „Otwórz" inicjatywy (`18ed3e44f7`).

## Następny krok
Rozstrzygnąć [`_DECYZJE.md`](_DECYZJE.md) → wynik wpisać do Rejestrów Decyzji teczek → egzekucja od 3 żywych blokerów.

## Zasady (przeniesione do pamięci projektu)
- Praca na `Londyn`; **prod (centerbeam) tylko za osobną zgodą**.
- Każda zmiana UI → weryfikacja w preview + dowód; nigdy „done" na tsc/eslint.
- Karty zawyżają (~1/7) → status „naprawione/bloker" ważny tylko po weryfikacji w kodzie (R3).
- M11 Narzędzia — descoped (brak realnego kodu).
