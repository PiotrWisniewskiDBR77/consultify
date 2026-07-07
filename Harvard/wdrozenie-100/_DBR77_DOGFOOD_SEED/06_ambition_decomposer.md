# Ambition Decomposer — DBR77: revenue 3.4M → 10M PLN (30–36 mies.)

> **Framework:** Ambition Decomposer (cel → 4–7 mierzalnych wątków strategicznych, każdy z horyzontem + metryką + właścicielem)
> **Kontekst:** dogfooding Consultify Tools na realnym projekcie DBR77 (AI dla przemysłu, konkurent Siemens/GE).
> **Krok w sekwencji:** narzędzie PRZED Portfolio Priority — najpierw rozkładamy ambicję na wątki, które SUMUJĄ się do celu; dopiero potem priorytetyzujemy portfel.

---

## ANSWER-FIRST (dla panelu, 3 zdania)

Cel „3.4M → 10M PLN (+6.6M) w 30–36 mies." rozkłada się na **6 wątków**, z czego **3 są strumieniami przychodu** (ARR +2.5M · Delivery +2.8M · DACH +1.3M = **+6.6M dokładnie**) i **3 są enablerami** (Kapitał, Talent, Moat) bez własnego przychodu — co eliminuje potrójne liczenie.
Arytmetyka jest domknięta i wąska: **suma wątków przychodowych = +6.6M, ani grosza więcej** — enablery są warunkiem, nie dodatkiem do sumy.
Horyzonty układają się sekwencyjnie wzdłuż INI: enablery w roku 1, ARR i Delivery narastają rok 1–3, DACH dokłada +1.3M dopiero w roku 3 (najdłuższy horyzont, najgłębszy gap zdolności).

---

## 1. Zasada dekompozycji (jak unikamy potrójnego liczenia)

Kluczowa dyscyplina Ambition Decomposera: **każda złotówka przychodu należy do dokładnie jednego wątku (MECE).** Enablery (Kapitał, Talent, Moat) **umożliwiają** przychód, ale **NIE mają własnego strumienia** — gdyby je policzyć jako przychód, ten sam pieniądz zostałby zliczony 2–3×.

- **Strumienie przychodu (sumują się do +6.6M):** W1 ARR · W2 Delivery · W3 DACH.
- **Enablery (przychód = 0, warunek konieczny):** W4 Kapitał · W5 Talent · W6 Moat.
- **De-duplikacja DACH:** przychód DACH (W3) to **nowy** strumień geograficzny; nie jest przeliczeniem ARR ani delivery z rynku PL. Konta DE liczone RAZ, w W3.

```
+6.6M PLN  =  W1 ARR (+2.5M)  +  W2 Delivery (+2.8M)  +  W3 DACH (+1.3M)
                                                       [enablery W4/W5/W6 = 0 przychodu]
```

---

## 2. Wątki strategiczne (6 — w progu 4–7, MECE)

### W1 — Wzrost ARR (subskrypcja / produkt powtarzalny)
- **Teza:** ARR to najwyżej wyceniany, najbardziej powtarzalny strumień — rośnie z 0.5M do 3M dzięki produktowi opartemu na modelach diagnostyki i retencji ≥90%.
- **Horyzont:** rok 1–3 (narastająco; retencja bramkuje od roku 1).
- **Target metric:** **ARR 0.5M → 3.0M PLN = wkład +2.5M PLN** do celu.
- **Właściciel-rola:** Head of Product / Moat.
- **Zależność:** wymaga W6 (Moat) i retencji (Customer Success); bez ≥90% retencji cel ARR się nie domyka.

### W2 — Skalowanie Delivery (projekty wdrożeniowe, marża 45%)
- **Teza:** delivery to największy pojedynczy wkład w cel — skalowanie wolumenu projektów przy utrzymanej marży 45%, napędzane playbookiem i 3× powiększonym zespołem (junior + partnerzy).
- **Horyzont:** rok 1–3 (ramp od roku 1, pełny wolumen rok 2–3).
- **Target metric:** przychód delivery **+2.8M PLN**, marża delivery utrzymana na **45%**.
- **Właściciel-rola:** Delivery Lead.
- **Zależność:** wymaga W5 (Talent — 3× Delivery, ramp<90 dni) i playbooka (Capability Z2).

### W3 — Ekspansja DACH / Mittelstand (nowy rynek geograficzny)
- **Teza:** DACH to nowy strumień geograficzny — niemiecki Mittelstand jako segment, w którym DBR77 konkuruje ze Siemens/GE na diagnostyce; przychód liczony osobno, RAZ, bez przenikania z PL.
- **Horyzont:** **rok 3** (najgłębszy gap zdolności — sprzedaż DACH obecna 1/docelowa 4; najdłuższy time-to-reference).
- **Target metric:** przychód DACH **+1.3M PLN (rok 3)**.
- **Właściciel-rola:** DACH Lead.
- **Zależność:** wymaga W5 (hire DACH Lead) + partner-kanał DE; startuje najpóźniej, dlatego najmniejszy wkład.

### W4 — Kapitał (ENABLER — bramka INI-0, przychód 0)
- **Teza:** ~4M PLN nakładu (6× EBITDA) to bramka — bez domkniętego finansowania nie ruszają W1–W3. To warunek, nie strumień.
- **Horyzont:** rok 1 (pierwsze — bramkuje resztę).
- **Target metric:** **~4M PLN pozyskanego finansowania** (nakład, NIE przychód → nie wchodzi do sumy +6.6M).
- **Właściciel-rola:** Founder + doradca transakcyjny.
- **Anty-double-count:** kapitał to WEJŚCIE (cash in), nie przychód (sales). Zero wkładu do +6.6M.

### W5 — Talent (ENABLER — INI-1, przychód 0)
- **Teza:** obsada 2 senior AI/ML (Moat, Delivery) + DACH Lead + 3× Delivery to fundament ludzki całego wzrostu; limit <50 senior/rok PL wymusza „reszta = junior + szkolenie + partnerzy".
- **Horyzont:** rok 1 (cele INI-1: Head of Product + DACH Lead + 3× Delivery do +9 mies., ramp<90 dni, retencja≥90%).
- **Target metric:** **2 senior obsadzeni + 3× Delivery ramp<90 dni + retencja≥90%** (metryki zdolności, NIE przychód).
- **Właściciel-rola:** Founder / Head of Product.
- **Anty-double-count:** talent umożliwia przychód W1/W2/W3 — jego „wartość" jest już zaksięgowana w tych strumieniach, nie osobno.

### W6 — Moat / Modele + Playbooki + Dane (ENABLER — INI-2, przychód 0)
- **Teza:** trwała przewaga (modele diagnostyki + playbooki + dane) to powód, dla którego ARR i delivery są obronne wobec Siemens/GE; buduje pricing power, ale sama nie jest fakturą.
- **Horyzont:** rok 1–2 (buduje bazę pod W1/W2 zanim domkną się w roku 2–3).
- **Target metric:** **modele + playbooki + dane na poziomie dojrzałości 5** (moat), pricing power widoczny w utrzymanej marży 45% i retencji ≥90%.
- **Właściciel-rola:** Head of Product / Moat.
- **Anty-double-count:** moat podnosi jakość W1/W2, ale przychód materializuje się TAM, nie w osobnej linii.

---

## 3. Arytmetyka domknięcia (suma wątków = cel, dokładnie)

| Wątek | Typ | Horyzont | Target metric | Wkład w +6.6M |
|---|---|---|---|:---:|
| W1 ARR | przychód | rok 1–3 | ARR 0.5M → 3.0M | **+2.5M** |
| W2 Delivery | przychód | rok 1–3 | +2.8M @ marża 45% | **+2.8M** |
| W3 DACH | przychód | rok 3 | +1.3M (Mittelstand) | **+1.3M** |
| W4 Kapitał | enabler | rok 1 | ~4M pozyskane (nakład) | **0** |
| W5 Talent | enabler | rok 1 | 2 senior + 3× Delivery | **0** |
| W6 Moat | enabler | rok 1–2 | modele+playbooki+dane = 5 | **0** |
| | | | **SUMA PRZYCHODU** | **+6.6M** |

**Kontrola domknięcia:** 2.5 + 2.8 + 1.3 = **6.6M PLN**. ✔
**Cel:** 3.4M (baza) + 6.6M (wątki) = **10.0M PLN**. ✔
**Bez potrójnego liczenia:** enablery W4/W5/W6 = 0 wkładu; kapitał to wejście nie przychód; DACH liczony raz jako nowy rynek. ✔

---

## 4. Wizualizacja domknięcia (waterfall)

```
3.4M  ┤ baza FY2025
      │
+2.5M ┤ ██████████  W1 ARR (0.5M→3M)
+2.8M ┤ ███████████ W2 Delivery (@45% marża)
+1.3M ┤ █████       W3 DACH (rok 3)
      │ ─────────────────────────────
10.0M ┤ ═══════════ CEL
      │
      │ [W4 Kapitał ~4M nakład · W5 Talent · W6 Moat = enablery, 0 przychodu]
```

---

## 5. Sekwencja horyzontów (spójna z INI)

```
ROK 1: W4 Kapitał (bramka) → W5 Talent (obsada) → W6 Moat (start budowy)
       + W1/W2 ramp (pierwsze przyrosty ARR i delivery)
ROK 2: W6 Moat dojrzewa → W1 ARR i W2 Delivery narastają (główny wolumen)
ROK 3: W1/W2 pełny bieg + W3 DACH dokłada +1.3M (najdłuższy horyzont)
```

Enablery skoncentrowane w roku 1 (warunek startu). Strumienie przychodu narastają rok 1→3. DACH — najgłębszy gap zdolności, najkrótszy czas w rynku — dokłada się ostatni i najmniej.

---

## 6. Napięcia do panelu (sceptycy)

1. **DACH (+1.3M) całe w roku 3 = ryzyko harmonogramu.** Jeśli scale-up trwa 30 (nie 36) mies., „rok 3" DACH może się nie zmieścić — wtedy z celu wypada 1.3M i domknięcie robi się +5.3M, nie +6.6M. Wątek W3 jest najbardziej kruchym elementem sumy.
2. **W2 Delivery (+2.8M @ 45%) zależy od talentu z limitem <50 senior/rok.** Największy strumień stoi na 3× Delivery obsadzonych juniorami — jeśli ramp<90 dni się nie uda, największy wkład w cel osuwa się pierwszy. Arytmetyka jest domknięta, ale nie odporna.
3. **Wszystkie 3 strumienie przychodu zależą od W4 Kapitału (bramka).** Suma +6.6M jest matematycznie czysta, ale WARUNKOWA — pojedynczy punkt awarii (runda ~4M) wywraca cały rozkład. Ambition Decomposer pokazuje CO ma się zsumować; nie gwarantuje, że enabler-bramka zadziała.
