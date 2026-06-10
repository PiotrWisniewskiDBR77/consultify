# Consultify — Strategia pakietów i cennika (D9)

**Data:** 2026-06-02
**Kontekst decyzji:** ICP = butikowy konsulting + firmy obsługujące wielu klientów (D1). Sprzedaż: hybryda, start sales-led → cel self-serve (D2). Billing v1: ręczne faktury + ręczne limity, Stripe dorobimy szybko (D8). Waluta główna: **EUR** (USD ~parytet dla zagranicy). Kotwica właściciela: **1 seat ≈ 45 €**, z limitem tokenów i dysku; później add-ony.
**Status:** zatwierdzone punkty (2026-06-02): **Professional = 89 €** · nazwa licznika = **„AI Credits"** · **darmowe miejsca gościnne = TAK** · **program „Founding 25" = TAK** · routing modeli LLM = dostroimy później · **trial skrócony do 7 dni** (14 było za długie) · **multimodal (generowanie obrazów + głos „mówiącej Teresy") wchodzi do ekonomii kredytów** — patrz §4.

---

## 1. Rekomendacja w jednym akapicie

Trójpoziomowy model **Good‑Better‑Best** (Starter / Professional / Enterprise) + **7‑dniowy trial bez karty**. Metryka wartości = **seat (miejsce konsultanta) jako oś główna + Kredyty AI jako licznik zużycia + dysk jako limit**. **Nie okrajamy „wow" (golden path + AI‑deliverable) w najtańszym planie** — bramkujemy na *skali* (liczba miejsc, wolumen AI, dysk, współpraca, bezpieczeństwo, wsparcie), nie na rdzeniu magii. Klienci końcowi (recenzenci po stronie firmy klienckiej) dostają **darmowe miejsca gościnne** — to nasz wedge w konsultingu (lepkość + viralność). Marżę na drogim AI chroni **mnożnik kredytów dla modelu premium (Opus)**, dzięki czemu nawet entry seat za 45 € trzyma ~60–70% marży brutto.

---

## 2. Dlaczego ta metryka wartości (a nie inna)

| Opcja | Plus | Minus | Werdykt |
|---|---|---|---|
| Tylko per‑seat (flat) | proste, przewidywalne | heavy‑userzy AI palą marżę; brak ekspansji z użycia | ❌ ryzyko marży na Opus |
| Tylko usage (kredyty) | sprawiedliwe | nieprzewidywalny rachunek, trudna sprzedaż | ❌ słabe sales‑led |
| **Seat + kredyty + dysk (hybryda)** | rynkowy standard, przewidywalny seat + ochrona marży przez kredyty + naturalna ekspansja | trochę więcej do wyjaśnienia | ✅ **rekomendacja** |

Seat = jak klient myśli o zespole. Kredyty = jak my chronimy koszt AI. Dysk = naturalny dla deliverabli (PDF/PPTX/DOCX).

---

## 3. Pakiety (propozycja)

> Ceny w EUR, **za miejsce / miesiąc**. Rozliczenie roczne ≈ **2 miesiące gratis (−17%)**. Kredyty są **pulą na poziomie workspace** (allotment = liczba miejsc × grant na miejsce) — zespół dzieli się pulą.

| | **Trial** | **Starter** | **Professional** ⭐ | **Enterprise** |
|---|---|---|---|---|
| **Cena / seat / mies.** | 0 € (7 dni) | **45 €** (rocznie 39 €) | **89 €** (rocznie 74 €) | od **149 €**, indywidualnie |
| **Dla kogo** | test | solo / 1–3 os. | zespoły konsultingowe (HERO) | większe firmy / enterprise |
| **Min. miejsc** | — | 1 | 1 | 5–10 |
| **Moduły** | wszystkie CORE | wszystkie CORE | CORE + zaawansowane (głębia Narzędzi, Realizacja, eksport premium) | wszystko + moduły enterprise |
| **Kredyty AI / seat / mies.** | 150 (cała pula) | **500** | **1 500** | indywidualnie (10k+) |
| **Model premium (Opus)** | — | metr. (5× kredytów) | metr. (5× kredytów) | dostępny + opcja BYOK |
| **Dysk (workspace)** | 5 GB | **50 GB** | **250 GB** | 1 TB+ |
| **Miejsca gościnne (klienci: podgląd/komentarz/akceptacja)** | 3 | **5** | **bez limitu** | bez limitu |
| **Współpraca / komentarze** | ✓ | podstawowa | pełna | pełna + governance |
| **Integracje** | — | podstawowe | pełne | pełne + prywatne |
| **Bezpieczeństwo** | — | standard | standard | **SSO/SCIM, DPA, audyt, RBAC** |
| **Wsparcie** | self‑serve | e‑mail | priorytet | dedykowany CSM + SLA |
| **Onboarding** | self / sample | self / sample | wsparcie | done‑with‑you (płatny add‑on) |

**Pozycjonowanie:** „Professional" to plan‑bohater (recommended). Starter to próg wejścia (foot‑in‑door), Enterprise to bezpieczeństwo/skala. Różnica 45 → 99 → custom napędza ekspansję.

---

## 4. Ekonomia kredytów AI (sedno ochrony marży)

Użytkownik nie myśli w tokenach — myśli w „akcjach". Wprowadzamy **AI Credits** — jeden, wspólny licznik dla **całego multimodal** (tekst, obraz, głos), metrowany per typ akcji × mnożnik modelu. Jedna waluta na wszystko = prostota dla klienta i pełna kontrola COGS po naszej stronie.

**A) Akcje tekstowe (model standardowy, Sonnet‑tier = 1×):**

| Akcja | Kredyty |
|---|---|
| Wiadomość czatu / inline‑assist | 1 |
| Ekstrakcja insightów / analiza | 3 |
| Pełne wygenerowanie deliverable (dok / deck / tabela) | 15 |
| Akcja agentowa wielokrokowa (bulk) | 25 |

**Mnożnik modelu (tekst):** Light (Haiku) **0,25×** · Standard (Sonnet) **1×** · **Premium (Opus) 5×**.
→ Premium daje najlepszą jakość, ale „pali" kredyty 5× szybciej — co samoczynnie chroni marżę i daje power‑userom świadomy wybór.

**B) Generowanie obrazów** (osobny COGS — modele image, ~$0,04–0,12/obraz):

| Akcja | Kredyty |
|---|---|
| Obraz standardowy (ilustracja, ikona, tło slajdu) | 5 |
| Obraz HD / duży format / wariacje | 10 |

**C) „Mówiąca Teresa" — głos** (TTS + STT / realtime audio — drogi COGS, metrowany per minuta):

| Akcja | Kredyty |
|---|---|
| Odsłuch (TTS) — synteza mowy | 2 / min |
| Dyktowanie (STT) — transkrypcja | 1 / min |
| Rozmowa głosowa realtime z Teresą | **10 / min** |

> Multimodal celowo ma wyższy koszt kredytowy niż tekst — bo realnie kosztuje więcej. Dzięki jednej walucie („AI Credits") klient widzi prosty licznik, a my chronimy marżę u źródła. Limity głosu/obrazu możemy dodatkowo bramkować per plan, jeśli analityka pokaże nadużycia (np. realtime‑voice tylko od Professional).

**Przełożenie na „ile to deliverabli":** 500 kredytów (Starter) ≈ **~30 pełnych deliverabli** lub ~500 interakcji czatu / mies. 1 500 (Pro) ≈ **~100 deliverabli**. (Komunikujemy w UI i kredyty, i przybliżenie „≈ X deliverabli".)

**Overage (po wyczerpaniu puli):** pakiety doładowań — **19 € / 500 kredytów** (≈0,038 €/kredyt). Bez twardego cut‑offu w trakcie pracy: miękki próg + propozycja doładowania.

---

## 5. Add‑ony (Twoje „później wprowadzić jakieś…")

**Dostępne od startu (proste, wysoka marża):**
- **Pakiet kredytów AI** — 19 € / 500 (lub 79 € / 2 500 — rabat hurtowy).
- **Dodatkowy dysk** — 9 € / +100 GB / mies.
- **Done‑with‑you onboarding / setup** — jednorazowo (np. 490–1 900 €). Świetna marża, pasuje do sales‑led, generuje case study.

**Roadmapa add‑onów (gdy moduły dojdą):**
- **Meeting / transkrypcja** (moduł 13) — add‑on per seat (np. +15 €/seat) z integracją Recall.ai/Fireflies.
- **Portal Partnerski / kanał** (moduł 19) — pakiet Enterprise.
- **White‑label** — Enterprise.
- **SSO/SCIM** — Enterprise (lub add‑on +X €/mies. do Pro).
- **BYOK (własny klucz AI)** — Enterprise; obniża nasz COGS, więc rabat na kredyty.
- **🔑 Private / Dedicated AI (DBR77)** — atut strategiczny i osobny strumień przychodu. DBR77 dostarcza **dedykowane prywatne API** (własne modele, np. Llama 3) oraz **`DBR77 Vector` (120B, transformacja przemysłowa/operacyjna)** w trybie **on‑prem / private API / isolated** (ref: vector.dbr77.com; „dane klienta nigdy nie trafiają do treningu"). Pakowanie: **flat za dedykowaną pojemność** (przewidywalny COGS → możliwa „prawie‑nieograniczona" pula kredytów dla klienta) **lub** pay‑per‑use compute. Pozycjonowanie: Enterprise / regulowane branże / klienci operacyjno‑przemysłowi. Spina się z suwerennością danych (compliance) i z modułami 04/06 (tryb operacyjny napędzany własnym modelem).
- **Branżowe pakiety szablonów / frameworków** — przyszły marketplace (moduł 15, później).

---

## 6. Program „Founding Partner" (bo startujemy wśród znajomych)

Mocna dźwignia na start — zamienia wczesnych klientów‑znajomych w aktywo marketingowe:

- **Oferta:** −50% przez 12 mies. (lub dożywotnie −40%) na Professional.
- **W zamian:** case study + testimonial + zgoda na logo + regularny feedback produktowy.
- **Limit:** pierwszych **25 firm** („Founding 25").
- **Efekt:** wczesny przychód + materiały sprzedażowe + dane do kuratorowanego tenanta demo (spina się z decyzją D19 o danych demo) + goodwill.

---

## 7. Model marży (sanity‑check, że 45 € się broni)

Założenia: 1 kredyt ≈ ~3K tokenów blended; Sonnet blended ~$10/M → **~$0,03 / kredyt** COGS (model standardowy).

| Plan | Przychód/seat | COGS AI przy 100% puli (standard) | COGS przy typowym ~40% | Dysk/infra | Marża brutto (typowa) |
|---|---|---|---|---|---|
| Starter 45 € | ~$48 | ~$15 | ~$6 | ~$2 | **~80%** |
| Professional 89 € | ~$95 | ~$45 | ~$18 | ~$3 | **~78%** |

Nawet w skrajnym maksymalnym zużyciu standardowego modelu marża zostaje dodatnia (Starter ~65%, Pro ~55%); premium (Opus) jest samolimitujące przez mnożnik 5×. **Wniosek: 45 € jako entry jest bezpieczne** pod warunkiem domyślnego routingu na model standardowy i świadomego włączania Opus.

---

## 8. Wdrożenie billingu (zgodne z D8)

**Faza 1 — teraz (sales‑led, ręcznie):** faktura ręczna + ręczne nadanie planu/limitów. Potrzebne minimum w Adminie (do uwzględnienia w planie modułu 17/18): przypisz plan, ustaw pulę kredytów, limit dysku, liczbę miejsc, datę wygaśnięcia. Licznik kredytów i dysku **musi** działać od v1 (egzekwowanie limitu), nawet jeśli płatność jest poza systemem.
**Faza 2 — self‑serve:** checkout Stripe (już podpięty do Twoich innych produktów → szybkie), te same plany, automatyczne overage i doładowania, portal klienta.

---

## 9. Zasady pakowania (filozofia, której się trzymamy)

1. **Nie okradaj „wow".** Golden path (Wywiad→…→Deliverable) i jakość AI‑deliverabli są pełne już w Starterze. Bramkujemy skalę, nie magię → lepsza konwersja i poczta pantoflowa.
2. **Land‑and‑expand.** Niski próg (45 €) → ekspansja: miejsca → kredyty → Pro (współpraca) → Enterprise (bezpieczeństwo/skala).
3. **Darmowi goście = wedge konsultingowy.** Klient końcowy współpracuje za 0 € → wartość rośnie, a my „wchodzimy" do jego organizacji.
4. **Sprzedaj wynik, nie funkcje.** Konsultant fakturuje 1 000+ €/dzień; jeśli oszczędzamy godziny i dajemy deliverable „gotowe dla klienta", 45–99 €/seat to oczywiste ROI.
5. **Marża chroniona u źródła** (mnożnik modelu), nie przez okrajanie planów.

---

## 10. Status decyzji

**✅ Zatwierdzone (2026-06-02):**
1. Struktura **3 plany + 7‑dniowy trial bez karty**. **Professional = 89 €** (rocznie ~74 €).
2. Licznik = **„AI Credits"** — jedna wspólna waluta dla tekstu, obrazów i głosu. Mnożnik premium tekstu 5×.
3. **Darmowe miejsca gościnne** dla klientów końcowych — TAK.
4. **Program „Founding 25"** (−50% / 12 mies. za case study) — TAK.
5. **Multimodal** (generowanie obrazów + „mówiąca Teresa") wchodzi do tej samej waluty kredytów (§4.B, §4.C).

**⏳ Do dostrojenia później:**
- **Routing modeli LLM** (które zadanie → który model: Haiku/Sonnet/Opus + image + voice) i finalne mnożniki/koszty kredytowe — skalibrujemy po pomiarze realnego COGS.
- Czy realtime‑voice i image‑HD bramkować per plan (np. od Professional), czy tylko metrować — decyzja na podstawie analityki nadużyć.
- Finalne grant‑y kredytów per plan po kalibracji multimodal.
