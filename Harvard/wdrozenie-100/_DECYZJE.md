# DECYZJE WŁAŚCICIELA — skonsolidowane z 27 teczek

> ~60 wpisów `D-xx` z teczek zwinięte w **12 decyzji** (wiele to ten sam wzorzec powtórzony). Każda ma **rekomendację** — możesz zatwierdzić hurtem („wszystkie rekomendacje oprócz…"). Po rozstrzygnięciu wpisuję wynik do `Rejestru Decyzji` każdej teczki i odblokowuję epiki.

---

## A · PILNE / STRUKTURALNE (rozstrzygnąć pierwsze)

**DP-1 · Głos w Wywiadzie (M10-D05) — PILNE, VTS żywy (~131 osób)**
Który provider STT na prod (`OPENAI` / `GROQ` / oba)? Bez tego nagranie głosowe nie zapisuje odpowiedzi.
→ **Rekom: potwierdzić klucz `OPENAI` na prod** (sprawdzić env Railway centerbeam) + zacommitować FE interim-flush. Wymaga Twojej zgody na dostęp do env prod.

**DP-2 · Trzeci panel / in-context open (klaster #6/#7/#10 — M03/M04/M09/M13)**
Jeden wzorzec powłoki: globalny „dok" (IDE-tabs, przeżywa nawigację) czy panel kontekstowy per-moduł?
→ **Rekom: globalny workspace-rail (IDE-tabs)** + reguła otwierania: inicjatywa/notatka/zadanie → in-context; deck/doc/sheet → Canvas; ciężkie (budget/valuation/raport) → pełny moduł. To jedna decyzja zamykająca M03-D02/D03, M04-D01/D02, M13-D01.

**DP-3 · Whiteboard multiplayer (M09-D01) — strukturalna, zmienia kontrakt `my_idea_maps` dla całej puli Ideas**
Per-resource + membership (prawdziwy multiplayer) czy zostaw single-player (facilitation jako solo)?
→ **Rekom: per-resource + membership** (multiplayer to sedno tablicy), skoordynować z M05. Jeśli v1 nie potrzebuje multiplayer → tymczasowo solo + jawny label.

**DP-4 · A1 Affiliate (A1-D01) — warunek wejścia, blokuje WP**
Wyciąć czy budować od zera?
→ **Rekom: wyciąć** (uczciwy stub 503, brak roadmapy). Budować tylko, jeśli ekosystem partnerski jest w planie — wtedy z org-scope od startu.

---

## B · POLITYKI PRZEKROJOWE (jedna decyzja = wiele teczek)

**DP-5 · Stuby i martwe przyciski** — *M01, M02, M03, M05, M06, M07-D02, M08-D02, M12-D01, M19, M22-D02, M23-D01/D03, M24-D01, M26-D01*
Półzbudowane funkcje (404/401/no-op): dobudować czy ukryć?
→ **Rekom: ukryj za flagą + jawny label „wkrótce", nie półbuduj** — chyba że funkcja jest v1-critical dla klienta. Zero martwych CTA w UI klienta.

**DP-6 · Cross-module sync z Tabel (M20→M15/M16)** — *M15-D01, M16-D01, M20-D01*
`governed sync-to-results/finance/execution` to dziś STUB (pisze log, nie dane). Realny odbiór czy „preview"?
→ **Rekom: „preview" + komunikat teraz** (ukryć przyciski sync), realny odbiór jako osobna fala po Fazie 2. Jedna decyzja, trzy teczki.

**DP-7 · Dual-stack / legacy** — *M07-D01 (V8 mirror), M08-D01 (path-B ~40% kodu), M22-D01 (actionDecisions)*
Utrzymywać równoległe ścieżki czy wyciąć?
→ **Rekom: wytnij** (mniej dual-utrzymania, mniej bugów) — chyba że konkretnie w roadmapie. M07 mirror i M08 path-B = silni kandydaci do cięcia.

**DP-8 · Tokeny kolorów** — *M13 (graf), M16-D02 (51 hex w chartach), M20-D04*
Palety wykresów/grafów: tokenizować czy zostawić?
→ **Rekom: palety wykresów/grafów ZOSTAJĄ legalne** (to dane wizualne, nie UI-chrome); reszta hex → tokeny w sweepie Faza 4.

**DP-9 · §27 (kanon tabel) — timing** — *M03, M12-D02, M15-D02, M20*
Przerabiać tabele teraz per-moduł czy w sweepie?
→ **Rekom: do sweepu Faza 4** (spójnie, raz), nie rozpraszać per-moduł. Data-grid (M20) dostaje osobny „grid-canon".

**DP-10 · i18n powierzchni internal (DBR77-only)** — *M22-D03, M27-D01 (~114 plików)*
Tłumaczyć panele wewnętrzne (AI OS, SuperAdmin) czy przyjąć dług?
→ **Rekom: świadomy dług internal, udokumentować, NIE tłumaczyć w v1** (to nie powierzchnia klienta).

**DP-11 · Billing / checkout** — *M23-D01, M24-D01, M25-D01*
Gdzie billing i czy live-checkout?
→ **Rekom: jedno miejsce (Admin), label „zarządzane przez DBR77", BEZ live-checkout w v1.** Usunąć martwy route billing z Settings (M25-D01).

**DP-12 · Reasoning AI (M01-D02)**
Który tier/provider wymusić dla „show reasoning"?
→ **Rekom: wymusić model thinking-capable per provider** (param extended-thinking tam, gdzie wspierany), fallback: ukryć przełącznik gdy provider bez reasoning.

---

## C · MODUŁOWE (mniej powiązane — rozstrzygnąć przy wejściu w moduł)
Zostają w teczkach, nie blokują startu: M02-D02 (guest w Canvas), M05-D02 (kanon wersjonowania snapshots/versions), M06-D01 (duplikat drawer), M10-D01..D04 (#13 progi/stepper/pending_review), M14-D01..D03 (feed-forward/martwy kod/manager lanes), M17-D01 (stale testy), M18-D02/D03 (Mode3/duplikat migracji), M21-D02 (archive), M23-D02 (drift admin), M24-D02 (resztki Admin/), M25-D02/D03 (shortcuts/flags read-only), M26-D02/D03 (self-connect/resource-tier).

---

## Jak to wykorzystać
1. Przejdź A (4 pilne/strukturalne) + B (8 polityk) — to ~12 rozstrzygnięć zamiast 60.
2. Odpowiedz np. „A: DP-1 OPENAI, DP-2 rekom, DP-3 solo na v1, DP-4 wyciąć; B: wszystkie rekomendacje oprócz DP-7 (zostaw V8 mirror)".
3. Wpiszę wyniki do Rejestrów Decyzji teczek → epiki odblokowane → wchodzimy w egzekucję (start: 3 żywe blokery M07/M09/M10-głos wg DP).
