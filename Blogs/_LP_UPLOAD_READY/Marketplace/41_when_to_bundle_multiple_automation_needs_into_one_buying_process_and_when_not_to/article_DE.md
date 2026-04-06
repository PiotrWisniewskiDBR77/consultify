# Wann Sie mehrere Automatisierungsbedarfe in einem Einkaufsprozess buendeln sollten und wann nicht

Target persona: Sponsor / Portfolio-Owner ueber Linien und Capex-Zyklen  
Funnel stage: Consideration bis Evaluation (Portfolio-Formung vor RFQ-Design)  
Core problem: Buendeln reduziert Transaktionszahl, zerstoert aber oft Vergleichbarkeit, versteckt schwache Scopes und koppelt Zeitplaene, die unabhaengig bleiben sollten  
Main promise: eine Entscheidungsmatrix fuer Bundle versus Split entlang Schnittstellen, Risikokopplung und Award-Logik

Buendeln fuehlt sich effizient an.

Es ist effizient, wenn es Vergleichbarkeit erhoeht und Integrationssnaehte reduziert.

Es ist teuer, wenn es unverbundene Risiken in eine Kehle zwingt.

## Direkte Antwort

Buendeln Sie mehrere Automatisierungsbedarfe in einem Einkaufsprozess, wenn sie Schnittstellen, Timing-Constraints oder Lieferantenfaehigkeiten teilen, sodass ein Integrator kohaerente Lieferung mit einem Akzeptanzrecord besitzen kann.

Teilen Sie in parallele oder sequenzierte Einkaeufe, wenn Scopes unterschiedliche technische Owner, unterschiedliche Readiness-Kalender, unterschiedliche Risikoprofile haben oder Buendeln einen Single-Award ueber unverbundene Wetten erzwingen wuerde.

## Dimension 1: Schnittstellenkopplung

Hohe Kopplung (illustrativ):

- geteilte MES-Events und Routing-Logik ueber Zellen
- geteilte Materialfluss-Spine, die mehrere Stationen speist

Niedrige Kopplung:

- unabhaengige Linien mit separaten Qualitaets-Stichprobenmodellen und ohne gemeinsame Steuerungsphilosophie

Hohe Kopplung beguenstigt einen Thread.

Niedrige Kopplung beguenstigt trennbare Entscheidungen.

## Dimension 2: Zeitplankopplung

Fragen Sie, ob ein Slip in Projekt A Projekt B rechtlich und operativ mitziehen soll.

Wenn ja, kann Buendeln Realitaet abbilden.

Wenn nein, kann Buendeln kuenstliche Geiselnahme erzeugen.

## Dimension 3: Vergleichbarkeitsintegritaet

Buendeln funktioniert, wenn Sie weiter definieren koennen:

- Akzeptanzobjekte pro Arbeitspaket im Umschlag
- Change-Order-Regeln, die Accountability zwischen Paketen nicht verwischen

Wird das Buendel zu einem vagen "Automatisierungsprogramm," verlieren Sie Inspectability.

## Dimension 4: Lieferantenfaehigkeits-Fit

Manche Lieferanten sind stark in integrierten Zellen.

Andere in schmalen Deliverables.

Buendeln sollte Faehigkeit treffen, nicht nur Bequemlichkeit.

## Schnellvergleich (illustrativ)

| Signal | fuer Bundle | fuer Split |
| --- | --- | --- |
| geteilte Handshake-Punkte | ja | nein |
| unterschiedliche interne Owner und Kalender | nein | ja |
| unterschiedliche Unsicherheitsniveaus | nein | ja |
| Bedarf an einer Kehle fuer Integrationssnaehte | ja | nein |

## Begrenztes Protokoll

Fahren Sie ein zweiseitiges internes Memo (illustrativ):

1. Bedarfe mit Ownern und Readiness-Daten listen
2. Schnittstellenkanten zwischen Bedarfen markieren
3. Bundle, Split oder phasierte Sequenz mit expliziten Stop-Regeln entscheiden

## Was das fuer DBR77 Marketplace bedeutet

DBR77 Marketplace ist Workflow fuer Automatisierungsentscheidungen und System zum Angebotsvergleich.

Portfolio-Disziplin ist Teil dieses Workflows: zuerst Struktur, dann Marktengagement.

Marketplace ist kein Roboterkatalog.

Es ist eine herstellernahe Vertrauensschicht fuer Integratorenauswahl und Vergleichbarkeit.

## Fazit

Buendeln fuer kohaerente Integration und Vergleichbarkeit.

Teilen, um unverbundene Risiken und Kalender zu schuetzen.

Nicht nur zur Papierreduktion buendeln.
