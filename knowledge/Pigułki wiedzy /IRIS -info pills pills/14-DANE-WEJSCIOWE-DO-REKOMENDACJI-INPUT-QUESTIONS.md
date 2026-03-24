# IRIS — Dane Wejściowe do Rekomendacji (Input Questions)

Data: 2026-03-03  
Wersja: 1.0  
Cel: lista pytań, które “AI Sprzedawca” lub konsultant musi zadać, aby dobrać właściwy pakiet IRIS i zaproponować sensowny plan.

---

## 1) Dane o firmie (kontekst i skala)

1. Ile macie **zakładów** i czy planujecie rollout na wiele lokalizacji?
2. Jaka jest **branża** i typ produkcji (dyskretna/procesowa/mieszana)?
3. Ile jest **linii/gniazd/stanowisk** w obszarze, który ma być objęty IRIS w MVP?
4. Ile macie **SKU** (przybliżenie) i jak zmienna jest produkcja?
5. Ilu będzie **użytkowników IRIS** w MVP (CEO/CFO/COO/produkcja/UR/jakość/logistyka/IT)?
6. Jak wygląda **struktura organizacyjna** (działy, zespoły, zmiany, brygady)?
7. Czy macie wyznaczonego **sponsora** i **lidera projektu**?
8. Jaki jest **horyzont decyzyjny** (kiedy musi być efekt: 4 tyg., 8 tyg., kwartał)?
9. Czy obowiązują Was szczególne wymogi **compliance** (branżowe, kontraktowe)?
10. Czy preferujecie **SaaS**, **Private Cloud** czy **On-Prem** i dlaczego?

---

## 2) Cele biznesowe (wartość i ROI)

1. Jakie są top 3 **cele biznesowe** na najbliższe 6–12 miesięcy?
2. Co jest największym źródłem strat:
   - przestoje,
   - awarie,
   - braki materiałowe,
   - scrap/niezgodności,
   - nadmierne zapasy,
   - “czas ludzi” na raportowaniu?
3. Jaki jest szacunkowy **koszt 1 godziny przestoju** (lub widełki)?
4. Jak często występują **awarie krytyczne** i jaki jest ich koszt (części/serwis/nadgodziny/utracona produkcja)?
5. Jaki jest aktualny poziom **scrapu/odrzutów** i ile kosztuje?
6. Jak mierzycie **OTIF/terminowość** i gdzie powstają opóźnienia?
7. Jakie KPI są obecnie kluczowe dla COO/CFO?
8. Czy macie baseline i cel dla:
   - OEE,
   - MTTR/MTBF,
   - inventory accuracy,
   - lead time,
   - reklamacje?
9. Jakie inwestycje planujecie (robotyzacja, automatyzacja, modernizacja, nowe linie)?
10. Jak wygląda dziś proces podejmowania decyzji o inwestycjach (kto zatwierdza, jakie dane są wymagane)?
11. Czy celem jest **szybki proof-of-value** (4–8 tyg.) czy od razu program enterprise?

---

## 3) Wyzwania operacyjne (procesy i “pain”)

1. Które procesy są najbardziej krytyczne (produkcja, magazyn, jakość, UR)?
2. Gdzie najczęściej pojawia się “gaszenie pożarów” i dlaczego?
3. Jak wygląda dziś **planowanie i harmonogramowanie** (APS/MRP/Excel)?
4. Jak raportujecie postęp produkcji (zmiana/dzień/tydzień)?
5. Jak wygląda obieg informacji o awariach (telefon, mail, system)?
6. Jak zarządzacie jakością (kiedy są inspekcje, kto zatwierdza, co jest dowodem)?
7. Jak wygląda magazyn (lokacje, kody, rotacja) i gdzie powstają błędy?
8. Czy macie standard na zadania i follow-up (np. Kaizen, 8D, CAPA), czy to jest rozproszone?
9. Czy występują silosy między działami (IT vs produkcja, UR vs produkcja)?
10. Co jest największym ograniczeniem w egzekucji działań (brak ownerów, brak SLA, brak danych, brak czasu)?

---

## 4) Wyzwania techniczne (IT/OT, integracje, bezpieczeństwo)

1. Jakie systemy już macie: ERP, MES/WMS, CMMS, QMS, BI, SCADA, IoT platform?
2. Czy chcecie IRIS jako:
   - system centralny, czy
   - warstwę integracyjną i egzekucyjną nad istniejącymi narzędziami?
3. Czy wymagacie **SSO** (SAML/OIDC) i jakie IdP jest używane?
4. Jakie są ograniczenia bezpieczeństwa: allowlist, VPN, “no cloud”, szyfrowanie, DLP?
5. Czy możecie udostępnić dane przez:
   - API,
   - eksport CSV/XLSX,
   - bazę danych read-only,
   - stream/queue?
6. Czy macie standardy identyfikacji zasobów (asset codes), produktów (product codes), lokalizacji?
7. Jakie są wymagania dot. **data residency** (UE/PL/DE/USA) i retencji?
8. Czy potrzebujecie rozdzielenia środowisk (dev/test/prod) i audytów (np. pen test)?
9. Jakie są wymagania wydajnościowe (liczba zdarzeń/sekundę, użytkowników, urządzeń)?
10. Czy wymagana jest integracja IoT (alerty/metryki z maszyn) już w MVP, czy etapowo?

---

## 5) Pytania kwalifikujące do pakietu IRIS (rekomendacja modułów)

### 5.1. Jeśli największe straty to przestoje/awarie

- Czy macie katalog zasobów (machines/assets) i historię awarii?  
  - **Tak** → CMMS + KPI (start szybki)  
  - **Nie** → CMMS baseline + uzupełnienie master data + GEMBA_TASKS

### 5.2. Jeśli największe straty to braki materiałowe

- Czy macie kontrolę stanów magazynu i lokacji?  
  - **Tak** → WMS + KPI, integracje z ERP etapowo  
  - **Nie** → WMS baseline (stock + receive) + standard kodów i lokacji

### 5.3. Jeśli największe straty to jakość/scrap

- Czy inspekcje jakości są powiązane z produkcją i mają dowody?  
  - **Tak** → QMS + KPI, automatyzacje zdarzeń  
  - **Nie** → QMS baseline + minimalny workflow + raporty trendów

### 5.4. Jeśli największy problem to egzekucja i brak follow-up

- Czy macie system zadań z SLA i ownerami?  
  - **Nie** → start od GEMBA_TASKS + governance + cockpit KPI

