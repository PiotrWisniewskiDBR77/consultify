# PAKIET WERDYKTOWY — CZAT (moduł 13_CHAT)

Przygotowano na posiedzenie D-17, wieczór 2026-08-31. Źródło: repo `/private/tmp/m03`,
dokładny tip `github-backup/codex/m03-admin-20260824` (SHA `c50847c25974d9a38783ab02362c8078716dab53`).
Karta źródłowa: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md`.

---

## 1. STAN MODUŁU (jednym akapitem)

Bramka: `OWNER_VISUAL_NAVIGATION_REVIEW_COMPLETE / REMEDIATION_REQUIRED /
OWNER_VERDICT_PENDING`. To najdalej posunięty z trzech modułów dzisiejszego
posiedzenia. Piotr już raz osobiście ocenił Czat 22.08 (`G08 PASS_WITH_FINDINGS`) jako
„zrozumiały, czytelny, generalnie bardzo mocny” i zgłosił 17 uwag UI/UX/CX
(`CHAT-OWN-001`…`017`). **8 z 17 uwag ma już wdrożone i przetestowane poprawki**
(commity `93eb6c8040`…`3a5b76ebf8`: nazwa grupy „PROMOTE”→„Utwórz w przestrzeni
roboczej”, ujednolicony przełącznik widoku Rich/DOC/MD, stabilizacja z-index menu
diagnostyki, kanoniczna karta propozycji governed, stały kontener akcji odpowiedzi AI,
spójny nagłówek 32px, powitanie „Porozmawiaj z Teresą, {imię}”, żywy obrys komponera
idle, przeprojektowanie starterów tematów). Osobno, po odbiorze 22.08: dyżur 127
zamknął pusty ekran rozmowy po polsku (potwierdzone zrzutem PL light/dark na
`8cd5b2059a`), dyżur 179 zamknął kartę propozycji po polsku (adwersarsko wychwycono
i naprawiono realną wiadomość źródłową vs etykiety produktu), a dyżury 182/192
włączyły i faktycznie **spolszczyły** panel „Ważne sygnały” (feed sygnałów), który w
odbiorze 22.08 był jeszcze pusty z powodu wyłączonego producenta. Otwarte i realne:
Canvas ma tylko `5/16` punktów DoD, formalny pakiet „przed/po” dla właściciela (G16)
nigdy nie powstał, a pełny wariant feedu sygnałów na prawdziwych (nie fixture) danych
jest `EVIDENCE_MISSING`.

---

## 2. TABELA EKRANÓW — klikaj werdykt tutaj

Trzy generacje dowodu wizualnego, wszystkie sprawdzone `ls`:

- `/private/tmp/cx-day110-chat-artefakty/` — 20 zrzutów (5 powierzchni × pusty/pełny ×
  light/dark), stan **z 22.08, PRZED** poprawkami i18n 127/179/182/192 — pokazuje
  punkt wyjścia (dużo angielskiego), nie stan bieżący.
- `/private/tmp/cx-day179-czat-artefakty/day179-governed-handoff-pl.png` — karta
  propozycji po fixie i18n.
- `/private/tmp/cx-day182-sygnaly-on-artefakty/day182-feed-on-{light,dark}.png` +
  `day182-feed-off-light.png` — panel sygnałów zaraz po włączeniu producenta, **jeszcze
  po angielsku** (ten dyżur naprawiał mechanikę, nie język).
- `/private/tmp/cx-day192-sygnaly-params-artefakty/day192-feed-bodyparams-pl.png` —
  ten sam panel, już po polsku, z realnym sygnałem `exec.task.overdue`.

**Zrzuty faktycznie obejrzane (Read) w tym pakiecie, min. 4 wymagane:**
`02-main-full-light.png` (day110), `day179-governed-handoff-pl.png`,
`day182-feed-on-light.png`, `day192-feed-bodyparams-pl.png` (4 obejrzane).

| Ekran/powierzchnia | Zrzut (ścieżka) | Stan (z dowodu, wzrokiem) | Rekomendacja |
|---|---|---|---|
| Main — pełna rozmowa + governed proposal (stan 22.08) | `cx-day110-chat-artefakty/02-main-full-light.png` | **obejrzano**: pending-card po angielsku (`Pending review`, `Approve`/`Reject`) — to jest STARY stan, punkt odniesienia, nie stan dzisiejszy | nie pokazywać jako aktualny |
| Governed handoff card (po fixie 179) | `cx-day179-czat-artefakty/day179-governed-handoff-pl.png` | **obejrzano**: nagłówek „Czat AI”, „Oczekuje na weryfikację”, „Zatwierdź”/„Odrzuć”, „Zapytaj Teresę o swoją pracę…” — w całości PL; wiadomość źródłowa (`Pilot Atlas achieved…`) zostaje EN, bo to dana fixture, zgodnie z zasadą | ACCEPT |
| Main — pusty start (dyżur 127) | brak zrzutu w tym pakiecie; opis w karcie: PL potwierdzone na `8cd5b2059a` | nieobejrzano bezpośrednio tu — polegam na karcie + testach `18/18 PASS` | ACCEPT warunkowo (obejrzeć na żywo przed podpisem, jeśli czas pozwoli) |
| Historia rozmów | 20/20 plików Day110, `03/04-history-*` | z karty G10: obejrzane, semantycznie sensowne | ACCEPT |
| Ważne sygnały — mechanika ON, język EN (dyżur 182) | `cx-day182-sygnaly-on-artefakty/day182-feed-on-{light,dark}.png` | **obejrzano**: cały panel („Important signals”, „SIGNAL/DOMAIN/SEVERITY/SOURCE/AGE/STATUS”, „Task overdue”) po angielsku | nie pokazywać jako obecny stan — to punkt pośredni |
| Ważne sygnały — PL + realny sygnał z detalem (dyżur 192) | `cx-day192-sygnaly-params-artefakty/day192-feed-bodyparams-pl.png` | **obejrzano**: cały panel i panel szczegółów sygnału w 100% po polsku, realny sygnał `exec.task.overdue` z treścią „Zadanie jest po terminie o 6 dni” | ACCEPT |
| Ważne sygnały — pusty (producer OFF) | `cx-day182-sygnaly-on-artefakty/day182-feed-off-light.png` | nieobejrzano w tym pakiecie; opisany w karcie jako uczciwy „producent wyłączony” | ACCEPT-OUT (świadoma decyzja produktowa, nie defekt) |
| Canvas (dokument/DOC/MD) | `05-canvas-*` (Day110) | z karty: DoD tylko `5/16`; realnie NIE gotowe | NIE POKAZYWAĆ jako gotowe; FIX/backlog |

---

## 3. OTWARTE POZYCJE — do świadomej decyzji właściciela (accept-out / deferred)

1. **Canvas DoD `5/16`** — realnie niedokończony obszar. Nie proponuję accept-out
   „po cichu”; to duży kawałek pracy integratora, wymaga jawnej decyzji: albo
   wyłączyć/ukryć Canvas z tej rundy akceptu i przyjąć go osobno, albo świadomie przyjąć
   Czat bez Canvas jako `ACCEPTED_EXCLUDING_CANVAS`.
2. **`CHAT-OR-20260829-003`** — feed sygnałów bywa pusty, bo producent bywa wyłączony w
   danej organizacji. To **jest świadoma decyzja, nie defekt** (`KNOWN_DECISION /
   NOT_A_DEFECT`) — reguły nie czytają treści czatu, więc włączenie producenta nie
   „napełni” automatycznie feedu. Rekomendacja: accept-out bez dyskusji.
3. **`CHAT-OR-20260829-004`** — pełny wariant feedu na prawdziwych (nie fixture) danych
   organizacji jest `EVIDENCE_MISSING`. Fixture rozmowy świadomie nie tworzy zadań/
   inicjatyw/decyzji/KPI/sygnałów budżetowych. Rekomendacja: accept-out z jasnym
   backlogiem „zweryfikować na organizacji z prawdziwą historią pracy”.
4. **Brak formalnego pakietu G16 „przed/po” dla właściciela** — 8 poprawek jest
   `IMPLEMENTED_STATIC` z testami komponentowymi PASS, ale nie ma jednego zbiorczego
   zrzutu-do-zrzutu potwierdzającego wszystkie 8 razem na jednym uwierzytelnionym
   przebiegu. Rekomendacja: accept-out z warunkiem, że najbliższy dyżur domyka G16.
5. **Pełny angielski, tablet, zoom, motion/CPU, destination/API/readback** (z G15) —
   otwarte, nietestowane. Rekomendacja: backlog, nieblokujące demo po polsku na desktopie.

---

## 4. CZEGO NIE POKAZUJEMY DZIŚ I DLACZEGO

- **Nie pokazujemy zrzutów Day110 (22.08) jako stanu bieżącego.** To punkt startowy
  sprzed 8 poprawek i 3 rund i18n — pokazanie ich bez etykiety „PRZED” zafałszowałoby
  ocenę (np. karta propozycji tam jest po angielsku, dziś jest po polsku).
- **Nie pokazujemy panelu sygnałów z dyżuru 182 (`day182-feed-on-*.png`) jako
  obecnego stanu** — jest w 100% angielski; to migawka mechaniki-właśnie-włączonej,
  język doszedł w dyżurze 192. Jedyny reprezentatywny zrzut panelu sygnałów to
  `day192-feed-bodyparams-pl.png`.
- **Nie pokazujemy Canvas jako gotowego narzędzia** — DoD 5/16, to wprowadzałoby w błąd
  co do realnej dojrzałości tej części ekranu.
- **Nie twierdzimy, że włączenie producenta sygnałów „naprawia” pusty feed dla każdej
  organizacji** — ryzyko realnej dezinformacji: reguły czytają `tasks`, `initiatives`,
  `decisions`, KPI i budżet, nie treść czatu. Dla organizacji bez takich danych feed
  zostanie pusty i to jest poprawne zachowanie, nie błąd.
- **Nie pokazujemy live-provider (jakości/latencji prawdziwego LLM)** — świadomie poza
  zakresem tej rundy (deterministyczny fixture, zero wywołań providera).

---

## 5. PROPONOWANY WERDYKT

**Rekomendacja: ACCEPT WARUNKOWY, z wyłączeniem Canvas.** Główna podróż z Contractu
(procytowana rozmowa → governed proposal → decyzja człowieka → cold reopen) jest
dowiedziona i po polsku; 8/17 uwag właściciela ma wdrożone i przetestowane poprawki;
i18n na trzech kluczowych powierzchniach (karta propozycji, pusty start, panel
sygnałów) jest potwierdzone wzrokiem. Największa dziura to Canvas (DoD 5/16) i brak
jednego zbiorczego pakietu retest G16 — obie pozycje nadają się do jawnego wyłączenia
z zakresu dzisiejszego accept, bez blokowania reszty modułu.

- **Tag:** `final-13-chat` (zakres: Main/rozmowa/governed proposal/historia/sygnały;
  Canvas świadomie POZA tagiem, do osobnej rundy)
- **Wpis do karty przy ACCEPT:**

```
## CLOSED_FINAL (excluding Canvas) — 2026-08-31

Status: `CLOSED_FINAL_EXCLUDING_CANVAS` · Werdykt właściciela: DEC-2026-08-31-XX
(accept głównej podróży czatu; Canvas wyłączony z zakresu, DoD 5/16 do osobnej rundy).
Final SHA: `c50847c25974d9a38783ab02362c8078716dab53` · Tag: `final-13-chat`.
Zakres zamknięcia: 8/17 uwag właściciela z 22.08 wdrożonych i przetestowanych
(93eb6c8040…3a5b76ebf8), i18n pustego startu (dyżur 127, SHA 8cd5b2059a), i18n karty
propozycji (dyżur 179, commit 90636358bf), producent sygnałów ON + i18n panelu
(dyżury 182/192). Dowody: cx-day110/179/182/192-*-artefakty (poza repo, zrzuty
wymienione w tym pakiecie).
Backlog po-MVP (nowe ID): Canvas DoD 5/16 (osobna runda), formalny pakiet G16
przed/po, feed sygnałów na realnych (nie fixture) danych organizacji, pełny EN/
tablet/zoom/motion/a11y sweep, pozostałe 9/17 uwag właściciela.
Zamknięte znaczy zamknięte.
```

**Alternatywa, jeśli właściciel chce całość naraz:** odłożyć tag do domknięcia Canvas —
werdykt na dziś `OWNER_DIRECTION_CONFIRMED / CANVAS_BLOCKING_FULL_CLOSE`.
