# Wie man Kapazitaetsentscheidungen vor der naechsten Nachfrageverschiebung testet

Target persona: COO / Leiter Planung / Operations Director nahe S&OP  
Funnel stage: Consideration  
Core problem: Kapazitaetsentscheidungen basieren oft auf Tabellen und mittlerer Last und werden dann durch Mix-Spikes, Ramp-Kurven oder wandernde Constraints ueberrascht, wenn sich die Nachfrage bewegt  
Main promise: eine kompakte Methode, Kapazitaetsoptionen mit Szenarien zu stresstesten, damit die naechste Nachfrageverschiebung kein ungeplanter Firefight wird

**Direktantwort:** testen Sie Kapazitaetsentscheidungen, indem Sie die Entscheidung in einem Satz definieren, Baseline plus mindestens drei Nachfrageformen (Level-Shift, Mix-Shift, Spike) modellieren und Constraint-Wanderung, Warteschlangenwachstum, Ueberstunden und Service-Risiko beobachten. Nutzen Sie zuerst manuelle oder historische Inputs, wenn Live-Feeds nicht bereit sind. Das Ergebnis soll vergleichbare KPIs pro Szenario sein, keine einzelne Prognosezahl. Kapazitaet ist keine Headline-Zahl auf einer Folie. Sie ist Verhalten unter einem Plan, der nicht brav bleibt.

## Warum Durchschnitte Kapazitaetsentscheidungen irrefuehren

Durchschnittsnachfrage kann verbergen: woechentliche Spikes, die dieselben Maschinen wie die Basislast beanspruchen; Mix-Aenderungen, die Last auf langsamere Varianten verlagern; saisonale Rampen, die schneller kommen als Einstellung oder Training; gekoppelte Logistik-Constraints, die effektive Linienzeit kosten.

Wenn die Entscheidung lautet "bei X Einheiten pro Woche sind wir fine," kann die Fabrik dennoch scheitern, wenn X in der falschen Form kommt.

## Rahmen Sie die Kapazitaetsentscheidung als Vergleich

Vor jedem Modellierungsdetail schreiben Sie den Entscheidungssatz.

Beispiele: "Wir waehlen Ueberstunden zuerst versus inkrementellen Headcount versus gezielte Bottleneck-Investition fuer die naechsten 18 Monate."; "Wir verschieben die Erweiterung von Linie B, bis Linie A unter der neuen Produktfamilie stabil ist."; "Wir waehlen zwischen zwei Schichtmustern unter einem 20-Prozent-Uplift-Szenario.".

Wenn Sie Alternativen nicht vergleichen koennen, haben Sie noch keine Entscheidung. Sie haben eine Stimmung.

## Mindest-Szenarioset (Nachfrageverschiebungs-Linse)

Fahren Sie mindestens diese Nachfrageformen gegen dasselbe Operationsmodell: **Level-Shift:** gleichmaessiges Uplift oder Rueckgang nahe dem Basisfall des Leadership; **Mix-Shift:** Volumen stabil, aber die Produktfamilienverteilung aendert Laufzeiten und Ruesten genug; **Spike-Woche:** ein kurzes Fenster hoher Last mit realistischen Erholungsannahmen; **Ramp-Kurve:** Nachfrage waechst monatlich mit ehrlich modellierten Hiring- und Trainingsverzoegerungen. Sie sagen nicht voraus, welches eintrifft. Sie lernen, welcher Plan zuerst bricht.

## KPIs, die Kapazitaetsvergleiche ehrlich machen

Verfolgen Sie eine kleine Menge, die Leadership nicht wegdiskutieren kann:

- Durchsatz und Backlog-Risiko am Bottleneck
- WIP und Wartezeit an den Top-3-Constraint-Kandidaten
- Ueberstunden- und Zeitarbeiter-Exposure
- On-Time-Risiko-Proxy gekoppelt an Freigabe- und Versandregeln
- Stabilitaet: bleibt der Bottleneck oder wandert er zwischen Szenarien?

Wenn der Bottleneck wandert, ist das ein Signal, kein Modellfehler.

## Schrittfolge: von der Frage zum verteidigbaren Vergleich

**Entscheidungssatz und echte Alternativen fixieren.**; **Baseline definieren** mit juengsten Wochen, die Schmerz enthalten, nicht nur glatte Wochen; **Constraints kodieren**, die zaehlen: Staffing-Regeln, Werkzeug-Sharing, Materialfreigabe, Transport-Schleifen; **Szenarioset fahren** mit derselben Randomness-Politik (oder derselben Trace-Replay-Politik) ueber Alternativen; **Trade-offs** in klarer Sprache vergleichen: Kosten, Risiko, Flexibilitaet, Umsetzungszeit; **Annahmen dokumentieren**, die die Schlussfolgerung ungueltig machen wuerden, wenn sie falsch sind.

## Wenn dieser Ansatz scheitert

Er scheitert, wenn Teams Constraints nicht benennen, Leadership die Frage woechentlich wechselt oder das Modell darauf trimmt, die Folie zu reproduzieren statt den Plan zu stressen.

Er scheitert auch, wenn die Organisation ein huebsches Dashboard mit einem Entscheidungsprotokoll verwechselt.

## Was Digital Twin hier aendert

Digital Twin ist ein Szenario-Testumfeld fuer operative Entscheidungen. Es ist kein 3D-Showcase.

Es hilft zu sehen, wie Kapazitaetsplaene sich verhalten, bevor die Nachfrage die Lektion auf dem Shopfloor erzwingt.

## Was DBR77 Digital Twin hinzufuegt

DBR77 Digital Twin unterstuetzt praktischen Szenariovergleich mit einem Pfad von manuellen Inputs zu reicherer Integration.

Fuer Kapazitaetsentscheidungen bedeutet das: disziplinierte Side-by-Side-Bewertung von Staffing-, Schicht- und Investitionsoptionen; variability-aware Testing statt Ein-Punkt-Kapazitaetsrechnung; klarere Kommunikation mit Finance und Sales ueber Risiko statt falscher Praezision.

## Fazit

Testen Sie Kapazitaetsentscheidungen, indem Sie echte Alternativen unter mehreren Nachfrageformen vergleichen und beobachten, ob Constraints wandern.

Wenn Sie nur Durchschnitten vertrauen, lehrt die naechste Nachfrageverschiebung dieselbe Lektion mit hoeherer Dringlichkeit und weniger Wuerde.

---

*Möchten Sie sehen, wie das in der Praxis funktioniert? [Demo buchen](https://dbr77.com/digital-twin) oder [Use Cases ansehen](https://dbr77.com/demo).*
