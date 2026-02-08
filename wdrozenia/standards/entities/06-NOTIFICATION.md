<!--
KANON SYSTEMOWY: Notifications / komunikacja i taskowanie
Notyfikacje są systemem presji, nie feedem informacji.
-->

## ✅ Standard encji: Notification (KANON – komunikacja i taskowanie)

### CEL NOTYFIKACJI

Notyfikacje istnieją po to, aby:

- zapobiegać bezruchowi,
- eskalować brak decyzji,
- utrzymywać napięcie decyzyjne.

Nie służą do informowania. Służą do **sterowania zachowaniem organizacji**.

Zasada: jeśli coś blokuje działania, koszt narasta i nikt nie reaguje → notyfikacja **musi** się pojawić.

---

### Rola w systemie

Notyfikacje są:

- systemem nerwowym aplikacji,
- warstwą presji i odpowiedzialności,
- mechanizmem rozładowywania zatorów.

Notyfikacje nie zastępują Inboxa.  
**Inbox = lista wymaganych reakcji**, notyfikacje = mechanika generowania presji + historii.

---

### Typ / Hierarchia (kanon)

- `CRITICAL` – blokuje realne działania / rośnie koszt / wymaga reakcji teraz
- `HIGH` – eskalacja / brak reakcji / zbliżanie się do punktu krytycznego
- `MEDIUM` – operacyjne (do wykonania w rytmie pracy)
- `LOW` – informacyjne (archiwum / ślad)

W implementacji można mapować na `urgent/high/normal/low`, ale UX musi zachować semantykę powyżej.

---

### Treść (kanon – zawsze ta sama logika)

Każda notyfikacja odpowiada na:

1. **Co się dzieje**
2. **Dlaczego to ważne**
3. **Co jest blokowane**
4. **Jakiej akcji oczekujemy** (jednoznaczny CTA)

Wymóg: notyfikacja ma mieć **Primary CTA** prowadzące do konkretnego działania (nie "read more").

---

### Trigger (kanon)

Notyfikacje muszą powstawać co najmniej z:

- brak decyzji / decyzja overdue / decision critical
- blokada taska (w szczególności: "blocked by decision")
- przekroczony próg kosztu opóźnienia
- aging (brak ruchu / brak aktualizacji)
- "shadow execution" (próba pchania taska bez decyzji)

---

### Adresat (routing wg roli)

Adresaci wynikają z grafu odpowiedzialności:

- **Decydent** → presja, koszt, CTA "Decide/Delegate/Escalate"
- **Manager** → blokady zespołu, przepływ
- **Wykonawca** → na co czeka, co ma zrobić
- **Sponsor** → ryzyko strategiczne, koszt domina

Wymóg: routing musi uwzględniać RACI z Decision (`accountable/consulted/informed`).

---

### Dynamika (escalation + rytm)

- brak reakcji = eskalacja (priorytet + adresat + częstotliwość)
- decyzja = cisza (zamyka presję)
- długotrwały brak decyzji = rosnąca częstotliwość

Wymóg: mechanizm musi mieć anti-spam:

- cooldown per `(eventType, entityId, recipientId)`
- agregacja (wiele podobnych zdarzeń → jedno powiadomienie z listą)

---

### UI/UX (kanon)

#### Inbox (My Work)

Inbox pokazuje tylko elementy wymagające reakcji (z notyfikacji/zdarzeń):

- Decisions wymagające aktu
- Taski w blokadzie (zwłaszcza "blocked by decision")
- Krytyczne zaległości / no-response

Każdy element: 4-liniowy format + Primary CTA + (opcjonalnie) Snooze z powodem.

#### Notification Center

To archiwum + preferencje:

- filtrowanie po priorytecie i encji
- grupowanie po encji (Decision/Task)
- "why you got it" (rola: decider/owner/manager/sponsor)

---

### DoD (Notification)

- Treść zgodna z 4-liniowym kanonem + Primary CTA.
- Routing wg ról + RACI.
- Anti-spam + agregacja.
- Integracja z Inbox (My Work) jako kolejką akcji.

---

### Notification Detail View (2026-01-29)

Pełny widok szczegółowy notyfikacji zgodny z Golden Standard:

#### Header
- Fioletowy gradient (jak Task Detail View)
- 2 przyciski: **Mark Read** (niebieski) + **Chat** (fioletowy)
- Severity indicator (kolorowa kropka)

#### Lewa kolumna (2/3)
1. **What's Happening** - co się dzieje, dlaczego ważne, co blokowane
2. **AI Analysis** ⭐ - priorytet, wpływ, rekomendacja AI, przycisk "Zapytaj AI"
3. **Expected Action** - oczekiwana akcja + interaktywna checklista
4. **Related Items** - powiązane task/decision/project
5. **Comments** - komentarze (przygotowane)
6. **Activity Log** - historia aktywności

#### Prawa kolumna (1/3)
1. **Control** - typ, severity, kategoria, daty, Primary CTA, Mute, Delete
2. **Stakeholders** - interesariusze (przygotowane)
3. **Why You Got It** - wyjaśnienie dlaczego otrzymano

#### Snooze Mechanism
- Presety: 1h, 4h, jutro, następny tydzień
- Custom datetime
- Persystowane w localStorage

---

### Historia zmian

- 2026-01-29: dodano Notification Detail View zgodny z Golden Standard
- 2026-01-29: dodano sekcję AI Analysis
- 2026-01-29: dodano interaktywną checklistę akcji
- 2026-01-29: dodano snooze mechanism z offline persistence
- 2026-01-28: dodano standard Notification zgodnie z kanonem „komunikacja i taskowanie"
