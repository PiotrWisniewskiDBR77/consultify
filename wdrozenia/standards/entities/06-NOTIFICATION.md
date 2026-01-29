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

Wymóg: notyfikacja ma mieć **Primary CTA** prowadzące do konkretnego działania (nie “read more”).

---

### Trigger (kanon)

Notyfikacje muszą powstawać co najmniej z:

- brak decyzji / decyzja overdue / decision critical
- blokada taska (w szczególności: “blocked by decision”)
- przekroczony próg kosztu opóźnienia
- aging (brak ruchu / brak aktualizacji)
- “shadow execution” (próba pchania taska bez decyzji)

---

### Adresat (routing wg roli)

Adresaci wynikają z grafu odpowiedzialności:

- **Decydent** → presja, koszt, CTA “Decide/Delegate/Escalate”
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
- Taski w blokadzie (zwłaszcza “blocked by decision”)
- Krytyczne zaległości / no-response

Każdy element: 4-liniowy format + Primary CTA + (opcjonalnie) Snooze z powodem.

#### Notification Center

To archiwum + preferencje:

- filtrowanie po priorytecie i encji
- grupowanie po encji (Decision/Task)
- “why you got it” (rola: decider/owner/manager/sponsor)

---

### DoD (Notification)

- Treść zgodna z 4-liniowym kanonem + Primary CTA.
- Routing wg ról + RACI.
- Anti-spam + agregacja.
- Integracja z Inbox (My Work) jako kolejką akcji.

---

### Historia zmian

- 2026-01-28: dodano standard Notification zgodnie z kanonem „komunikacja i taskowanie”
