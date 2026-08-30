---
doc_id: funkcje-odbior-189
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 189 — Partner i18n · SCALIĆ PO FIX-189 (trywialny, wydany)

Rdzeń solidny: licencja A (zero zmian klas — zweryfikowane zbiorami className),
breadcrumby 49/49 przez t(), getDisplayStatus bez surowych enumów (mutacja
czerwona→zielona), 4 zrzuty obejrzane — najgorsze ekrany z 177 są po polsku,
jakość PL A− (ludzkie etykiety learning-path). Zero sierot pl↔en w nowych kluczach.

## Bloker (klasa błędu, którą dyżur miał zamknąć — żywa w licencjonowanym pliku)
`EarningsSection.tsx:988,1087` — fallback `t(..., payout.status)` = surowy enum;
słownik nie zna `FAILED`/`CANCELLED` (kanoniczny PAYOUT_STATUS je ma, trasa nie
filtruje) → partner z nieudaną wypłatą zobaczy „FAILED" wielkimi literami.
Wiersz raportu twierdzi, że zamknięte — **fałszywie zamknięta pozycja R1**
(wzorzec poprawny istniał obok, w ClientsSection). FIX-189: 2 klucze pl+en +
bezpieczny fallback + test na EarningsSection.

## Do rejestru
CommissionView (martwy, 0 importerów) i ProviderHomeView (`/become-partner`,
poza hubem) — ang. literały ujawnione uczciwie; 130 kluczy PL bez pary EN (dług
historyczny, ujawniony).
