# Wie man Bediener-Overrides in IoT-Workflows reviewed

Zielpersona: Operations-Vorgesetzter / EHS-Partner / Engineering Lead  

Funnel-Phase: Consideration Kernproblem: Overrides wachsen still an, Audits entdecken sie spaet, Bediener lernen, dass Umgehung einfacher ist als Signal- oder Prozess-Fix unterhalb Hauptversprechen: ein Review-Rhythmus: was geloggt wird, wie Ablaeufe funktionieren, wer Verlaengerungen freigibt, wie Reviews an Standards und Training gekoppelt sind Overrides sind nicht automatisch Fehlverhalten. Unreviewed Overrides sind operative Schulden. IoT macht Bypass sichtbar. Governance entscheidet, ob Sichtbarkeit Lernen oder Konflikt wird.

Reviewen Sie Bediener-Overrides nach einem **festen Kalender** mit drei Outputs: schliessen mit Bestaetigung, dass Maschine und Standards sicher sind; verlaengern mit benanntem Approver, neuem Ablauf und dokumentiertem Grund; Bypass-Pfad entfernen durch Signalqualitaets-Fix, Interlock-Logik oder Training. Wenn Overrides nie ablaufen, haben Sie keinen Workflow. Sie haben eine versteckte Kultur.

## Framework: Override-Datenfelder

Jeder Override-Datensatz sollte mindestens enthalten:

- Asset, Linie, Schicht
- Bediener-Identitaet und Supervisor-Bestaetigung wo erforderlich
- Startzeit, Ablaufzeit und maximal erlaubte Dauer nach Policy
- Grundcode aus einer endlichen Liste, keine Freitext-Romane
- Link zu verwandtem Instandhaltungs- oder Engineering-Ticket wenn zutreffend

Freitext gehoert in die Ticket-Narrative, nicht als einziges Governance-Feld.

## Vergleich: Schuld-Review versus Lern-Review

| Schuld-Review | Lern-Review |
|---|---|
| fokussiert auf wer | fokussiert was im System scheiterte |
| versteckt zukuenftige Overrides | macht Bypass zeitteuer, nicht angstteuer |
| stellt Safety gegen Output | bindet beides an Standards |
| frisst Vertrauen | verbessert Signalqualitaet |

## Schrittfolge: monatliches Override-Review

Overrides exportieren, die irgendeinen Tag im Monat aktiv waren, inklusive abgelaufener; nach wiederholten Assets und Grundcodes sortieren; Top-fuenf Muster fuer ein 45-minuten funktionsuebergreifendes Review waehlen; Owner zuweisen: Signal-Fix, Prozedur-Fix, Training-Fix oder Interlock-Redesign; Entscheidungen im Kommunikationskanal veroeffentlichen, den Bediener wirklich lesen.

## Checkliste: Overrides an Standards ausrichten

- [ ] Safety-Interlocks folgen nicht verhandelbarer Policy mit EHS geschrieben
- [ ] qualitaetskritische Overrides brauchen Qualitaets-Rollen-Bestaetigung wo erforderlich
- [ ] Verlaengerungen brauchen Supervisor oder Engineering per Policy, nicht Peer-to-Peer
- [ ] abgelaufene Overrides loesen automatische Eskalation oder Maschinenzustand-Sperre nach Werkregeln aus
- [ ] Trainings-Updates passieren, wenn derselbe Override-Grund ueber Schichten wiederholt

## Verbindung zur Signalqualitaet

Viele Overrides existieren, weil das Werk dem Automationspfad misstraut.

Behandeln Sie wiederholte Overrides als **Signalqualitaets-Tickets**, nicht nur als Disziplin-Tickets.

## Was das fuer DBR77 IoT bedeutet

DBR77 IoT unterstuetzt **Echtzeit-Maschinensichtbarkeit** und **Edge-first Entscheidungsunterstuetzung**, damit Override-Events dort sichtbar sind, wo Entscheidungen fallen, nicht nur in Monatslogs. Retrofit-freundliche Konnektivitaet bringt dieselbe Review-Disziplin ueber Vintage-Jahre.

## Bottom line

Reviewen Sie Overrides wie **Near-Misses**: nach Plan, mit Ownern, an Standards gebunden. Sichtbarkeit ohne Review wird Politik. Sichtbarkeit mit Review wird Verbesserung.
