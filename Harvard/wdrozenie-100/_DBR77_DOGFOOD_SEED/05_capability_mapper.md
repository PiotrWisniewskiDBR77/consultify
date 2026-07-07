# Capability Mapper — DBR77 Scale-Up 3.4M → 10M PLN (30–36 mies.)

> **Framework:** Capability Mapper (gap current → target, decyzja build / buy / partner per zdolność)
> **Kontekst:** dogfooding Consultify Tools na realnym projekcie DBR77 (AI dla przemysłu, konkurent Siemens/GE).
> **Krok w sekwencji:** narzędzie diagnostyczne PRZED Ambition Decomposer i Portfolio Priority — mówi *czym musimy się stać*, zanim policzymy *ile z tego przychodu*.

---

## ANSWER-FIRST (dla panelu, 3 zdania)

DBR77 ma **6 kluczowych zdolności** do scale-upu; średni gap dojrzałości wynosi **2.0 pkt** (suma 12/6, skala 1–5), a najgłębsze luki są w **sprzedaży DACH/Mittelstand (gap 3)** i **modelach diagnostyki / moat (gap 2)** — dokładnie tam, gdzie leży domknięcie +6.6M PLN.
Twardy bottleneck rynku (**<50 senior AI/ML rocznie w PL**) wymusza żelazną dyscyplinę: **senior tylko na 2 role rdzeniowe** (Head of Product/Moat + Delivery Lead), reszta = **junior + szkolenie na własnych playbookach + partnerzy** — inaczej talent zabije tempo.
Dlatego rekomendacja to **hybryda build/buy/partner**: budujemy trwały rdzeń IP (modele + playbooki + dane = moat), kupujemy 2 senior kompetencje deficytowe, partnerujemy tam gdzie zakup jest za drogi lub za wolny (DACH GTM, część capacity delivery).

---

## 1. Legenda skali dojrzałości (1–5)

| Poziom | Nazwa | Opis operacyjny |
|---|---|---|
| 1 | Ad-hoc | robimy to reaktywnie, zależne od 1–2 osób, brak procesu |
| 2 | Powtarzalne | działa, ale bez standardu; wiedza w głowach, nie w assetach |
| 3 | Ustandaryzowane | jest playbook/proces, powtarzalna jakość, mierzone |
| 4 | Zarządzane | mierzone + optymalizowane, skaluje się bez założyciela |
| 5 | Przewaga | asset generuje moat — konkurent nie odtworzy tanio/szybko |

**Decyzja build/buy/partner — reguła:**
- **BUILD** gdy zdolność = źródło moatu (musi zostać wewnątrz jako IP) i mamy zalążek.
- **BUY** (senior hire / akwizycja kompetencji) gdy gap krytyczny, czas nagli, a rynek pozwala — **limit 2 role senior** (bottleneck <50/rok).
- **PARTNER** gdy zakup za drogi/za wolny, a zdolność nie jest rdzeniem IP (np. zasięg GTM, nadwyżkowa capacity delivery).

---

## 2. Mapa zdolności (MECE — 6 zdolności, brak nakładania, brak luk)

Podział MECE wzdłuż łańcucha wartości scale-upu: **Kapitał → Ludzie → Produkt(IP) → Dostawa → Popyt → Ekspansja**. Każda zdolność należy do dokładnie jednego ogniwa.

### Z1 — Data Science / Modele diagnostyki (RDZEŃ MOAT)
- **Obecna: 3** — działające modele diagnostyki przemysłowej, ale zależne od kilku seniorów, słabo skodyfikowane jako reużywalny asset.
- **Docelowa: 5** — modele + dane + biblioteka diagnostyk = przewaga nieodtwarzalna tanio przez Siemens/GE na segmencie Mittelstand.
- **Gap: 2**
- **Rekomendacja: BUILD (rdzeń) + 1× BUY senior.** To serce moatu — musi zostać wewnątrz jako IP. Jedna z 2 dozwolonych ról senior (Head of Product/Moat obejmuje ten obszar). Reszta zespołu: junior + ramp na własnych playbookach.
- **Uzasadnienie:** przewagi się nie kupuje ani nie wynajmuje — buduje się ją i broni. [ZAŁOŻENIE] zalążek modeli już generuje ~0.5M ARR, więc baza istnieje.

### Z2 — Delivery Ops / Playbooki wdrożeniowe
- **Obecna: 2** — delivery działa, marża realna, ale wiedza w głowach; brak ustandaryzowanego playbooka → każdy projekt „od nowa".
- **Docelowa: 4** — powtarzalny playbook, ramp<90 dni, marża 45% utrzymana przy 3× wolumenie.
- **Gap: 2**
- **Rekomendacja: BUILD (playbook = część moatu) + 1× BUY Delivery Lead (senior) + PARTNER na nadwyżkową capacity.** Druga z 2 dozwolonych ról senior. Skalowanie ludzi: junior + szkolenie na playbooku; partnerzy-integratorzy przejmują peaki, gdy własna capacity nie nadąża.
- **Uzasadnienie:** playbook zamienia delivery w asset (część moatu), a partner amortyzuje ryzyko przeciążenia bez palenia limitu senior.

### Z3 — Sprzedaż DACH / Mittelstand (NAJGŁĘBSZY GAP)
- **Obecna: 1** — brak ugruntowanej obecności w DACH; sprzedaż niemieckiego Mittelstandu wymaga języka, sieci, referencji, których dziś nie ma.
- **Docelowa: 4** — powtarzalny motion sprzedażowy DE, pierwsze referencje, DACH Lead z siecią.
- **Gap: 3 (największy)**
- **Rekomendacja: BUY DACH Lead (ale POZA limitem 2 senior AI/ML — to rola GTM, nie inżynierska, inny rynek talentu) + PARTNER lokalny (kanał/reseller/integrator DE).**
- **Uzasadnienie:** to najgłębsza luka i najdalszy horyzont (rok 3). Budowa od zera za wolna; sam hire za ryzykowny bez kanału. Hybryda hire+partner skraca time-to-first-reference. **Uwaga:** limit „2 senior" dotyczy talentu AI/ML (deficyt <50/rok PL) — DACH Lead to inny basen, więc nie konkuruje o ten sam zasób.

### Z4 — Customer Success / Retencja
- **Obecna: 2** — relacje trzymają się na założycielu; retencja niesformalizowana, brak własnej funkcji CS.
- **Docelowa: 4** — retencja ≥90% (cel INI-1), proces onboardingu i ekspansji konta, NRR>100%.
- **Gap: 2**
- **Rekomendacja: BUILD (junior CS + proces) — bez senior hire.** Retencja to dyscyplina procesu, nie deficytowy talent AI. Zbudować własną funkcję na playbooku Z2.
- **Uzasadnienie:** ARR (cel 0.5M→3M) stoi na retencji — churn wywraca całą arytmetykę wątku ARR. Ale nie wymaga senior AI/ML, więc nie zjada limitu.

### Z5 — Product Management
- **Obecna: 2** — produkt prowadzony intuicyjnie przez założyciela; brak dedykowanej roli PM, roadmapa reaktywna.
- **Docelowa: 4** — PM domyka pętlę modele→produkt→rynek, priorytetyzacja wg wartości.
- **Gap: 2**
- **Rekomendacja: BUILD — połączyć z rolą Head of Product/Moat (Z1).** Nie osobny senior hire; PM i moat to jedna rola rdzeniowa w tej skali firmy.
- **Uzasadnienie:** rozdzielanie PM od moatu przy tej wielkości = nadmiar; jedna silna rola senior obejmuje oba (mieści się w limicie 2, wspólnie z Z1).

### Z6 — Pozyskiwanie kapitału (BRAMKA)
- **Obecna: 2** — historia finansowa jest (3.4M rev / 640K EBITDA), ale nie ma ugruntowanego procesu fundraisingu na ~4M PLN nakładu (6× EBITDA).
- **Docelowa: 3** — domknięta runda/finansowanie ~4M, gotowość inwestorska (data room, model, narracja).
- **Gap: 1 (najmniejszy, ale NAJPILNIEJSZY — bramka INI-0)**
- **Rekomendacja: BUILD (założyciel + doradca) + PARTNER (doradca transakcyjny / dług venture).** Bez senior FTE.
- **Uzasadnienie:** gap najmniejszy, ale sekwencyjnie pierwszy — bez kapitału nie ruszają Z1–Z5. Nie wymaga budowy stałego zespołu; wystarczy założyciel + partner doradczy na czas rundy.

---

## 3. Tabela zbiorcza (gap + decyzja + priorytet wg sekwencji INI)

| # | Zdolność | Obecna | Docel. | Gap | Decyzja | Senior hire? | Priorytet (INI) |
|---|---|:---:|:---:|:---:|---|---|---|
| Z6 | Pozyskiwanie kapitału | 2 | 3 | 1 | BUILD + PARTNER | nie | **1 — INI-0 (bramka)** |
| Z1 | Data Science / Modele (MOAT) | 3 | 5 | 2 | BUILD + BUY | **TAK (1/2)** | 2 — INI-1→INI-2 |
| Z5 | Product Management | 2 | 4 | 2 | BUILD (w roli Z1) | nie (łączona) | 2 — INI-1→INI-2 |
| Z2 | Delivery Ops / Playbooki | 2 | 4 | 2 | BUILD + BUY + PARTNER | **TAK (2/2)** | 3 — INI-1→INI-3 |
| Z4 | Customer Success / Retencja | 2 | 4 | 2 | BUILD | nie | 3 — INI-3 (ARR) |
| Z3 | Sprzedaż DACH / Mittelstand | 1 | 4 | 3 | BUY (poza limitem AI) + PARTNER | GTM, nie AI | 5 — INI-4→INI-5 |

**Suma gapów: 12 pkt · Średni gap: 2.0 · Najgłębszy: Z3 (DACH, 3) · Najpilniejszy: Z6 (kapitał, bramka).**

---

## 4. Alokacja limitu talentu (bottleneck <50 senior AI/ML / rok PL)

To centralne ograniczenie projektu. Reguła: **maks. 2 senior AI/ML**, reszta buduje się inaczej.

| Rola | Typ | Liczy się do limitu 2? | Sposób obsadzenia |
|---|---|---|---|
| Head of Product / Moat (Z1+Z5) | senior AI/ML | **TAK — 1/2** | BUY (hire senior, ramp<90 dni) |
| Delivery Lead (Z2) | senior AI/ML | **TAK — 2/2** | BUY (hire senior) |
| 3× Delivery (cel INI-1) | junior/mid | NIE | junior + szkolenie na playbooku Z2 + partnerzy na peaki |
| DACH Lead (Z3) | senior GTM | NIE (inny basen) | BUY (rynek DE, nie deficyt PL AI) |
| CS / Retencja (Z4) | junior/mid | NIE | BUILD własną funkcję na procesie |
| Kapitał (Z6) | founder + doradca | NIE | PARTNER doradczy na czas rundy |

**Wniosek:** cały wzrost headcount inżynierskiego (poza 2 seniorami) idzie ścieżką **junior → ramp na własnych playbookach → partner na nadwyżkę**. To jedyny sposób obejścia limitu <50/rok bez zaduszenia tempa. [ZAŁOŻENIE] rynek juniorów AI/ML jest znacząco głębszy niż seniorów, więc skalowanie „junior + szkolenie" jest wykonalne.

---

## 5. Sekwencja domknięcia gapów (spójna z sekwencją INI)

```
INI-0 Kapitał (bramka) ── domknij Z6 (gap 1) ── ~4M PLN nakładu odblokowane
        │
        ▼
INI-1 Talent ── obsadź 2 senior (Z1 Moat, Z2 Delivery) + DACH Lead + start ramp juniorów
        │        cele: Head of Product/Moat + DACH Lead + 3× Delivery do +9 mies., ramp<90 dni, retencja≥90%
        ▼
INI-2 Produkt + Moat ── domknij Z1 (gap 2) i Z5 do poziomu 4–5 (modele+playbooki+dane = przewaga vs Siemens/GE)
        │
        ▼
INI-3 Delivery ── domknij Z2 (gap 2) + Z4 retencja≥90% (gap 2); marża 45% przy 3× wolumenie
        │
        ▼
INI-4 Popyt (PL + DE) ── uruchom motion sprzedażowy, pierwsze konta DE
        │
        ▼
INI-5 DACH (rok 3) ── domknij Z3 (gap 3, najgłębszy) — najdłuższy horyzont, dlatego ostatni
```

**Logika:** kolejność domknięcia = kolejność INI. Kapitał (Z6) bramkuje wszystko. Talent (INI-1) jest enablerem, nie strumieniem przychodu — obsadza rdzeń. Dopiero Z1–Z2 (moat + delivery) budują bazę pod przychód, Z3 (DACH) domyka najdłuższy horyzont na końcu.

---

## 6. Napięcia do panelu (sceptycy)

1. **Z3 (DACH) ma gap 3 i horyzont rok 3, a odpowiada za +1.3M z celu — czy nie za późno zaczynamy?** Jeśli budowa kanału DE trwa >12 mies., „rok 3" może nie wystarczyć; rozważyć wcześniejszy start PARTNER (kanał) równolegle z INI-1, nie czekając do INI-5.
2. **Limit 2 senior vs. ambicja moatu (Z1→5) i delivery 3× (Z2→4) jednocześnie.** Czy 2 seniorzy + juniorzy realnie domkną DWA gapy po 2 pkt w oknie 30–36 mies.? Ryzyko, że ramp juniorów okaże się wolniejszy niż zakłada „reszta = junior + szkolenie".
3. **Z6 (kapitał) ma najmniejszy gap, ale jest bramką — jeśli runda ~4M się nie domknie, cała mapa staje.** Pojedynczy punkt awarii; brak planu B na finansowanie (dług venture? bootstrap wolniejszy?) czyni całą arytmetykę scale-upu warunkową.
